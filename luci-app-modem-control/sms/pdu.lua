--[[
  SMS PDU 编解码库（纯 Lua 5.1 兼容）
  遵循 3GPP TS 23.040 / TS 24.011

  支持：
    - SMS-SUBMIT 编码（发送短信）
    - SMS-DELIVER 解码（接收短信）
    - GSM 7bit 编码/解码
    - UCS2 (UTF-16BE) 编码/解码
    - 8bit 数据
    - 中文 UTF-8 <-> UCS2 双向转换（纯 Lua 实现）
]]

local bitlib = require("bitlib")

local pdu = {}

--------------------------------------------------------------------------------
-- UTF-8 <-> Unicode 码点转换
--------------------------------------------------------------------------------

-- UTF-8 字符串转码点数组
function pdu.utf8_to_codepoints(s)
	local cps = {}
	local i = 1
	local n = #s
	while i <= n do
		local c = s:byte(i)
		local cp, len
		if c < 0x80 then
			cp, len = c, 1
		elseif c >= 0xC0 and c < 0xE0 then
			local c2 = s:byte(i + 1) or 0
			cp = (c - 0xC0) * 0x40 + (c2 - 0x80)
			len = 2
		elseif c >= 0xE0 and c < 0xF0 then
			local c2 = s:byte(i + 1) or 0
			local c3 = s:byte(i + 2) or 0
			cp = (c - 0xE0) * 0x1000 + (c2 - 0x80) * 0x40 + (c3 - 0x80)
			len = 3
		elseif c >= 0xF0 and c < 0xF8 then
			local c2 = s:byte(i + 1) or 0
			local c3 = s:byte(i + 2) or 0
			local c4 = s:byte(i + 3) or 0
			cp = (c - 0xF0) * 0x40000 + (c2 - 0x80) * 0x1000 + (c3 - 0x80) * 0x40 + (c4 - 0x80)
			len = 4
		else
			cp, len = 0xFFFD, 1
		end
		cps[#cps + 1] = cp
		i = i + len
	end
	return cps
end

-- 码点数组转 UTF-8 字符串
function pdu.codepoints_to_utf8(cps)
	local out = {}
	for _, cp in ipairs(cps) do
		if cp < 0x80 then
			out[#out + 1] = string.char(cp)
		elseif cp < 0x800 then
			out[#out + 1] = string.char(0xC0 + math.floor(cp / 0x40), 0x80 + (cp % 0x40))
		elseif cp < 0x10000 then
			out[#out + 1] = string.char(
				0xE0 + math.floor(cp / 0x1000),
				0x80 + (math.floor(cp / 0x40) % 0x40),
				0x80 + (cp % 0x40)
			)
		else
			out[#out + 1] = string.char(
				0xF0 + math.floor(cp / 0x40000),
				0x80 + (math.floor(cp / 0x1000) % 0x40),
				0x80 + (math.floor(cp / 0x40) % 0x40),
				0x80 + (cp % 0x40)
			)
		end
	end
	return table.concat(out)
end

-- UTF-8 字符串转 UCS2 十六进制串（用于 AT+CMGS 文本模式）
function pdu.utf8_to_ucs2hex(s)
	local cps = pdu.utf8_to_codepoints(s)
	local out = {}
	for _, cp in ipairs(cps) do
		if cp > 0xFFFF then
			-- BMP 外字符拆成代理对
			local v = cp - 0x10000
			local hi = 0xD800 + math.floor(v / 0x400)
			local lo = 0xDC00 + (v % 0x400)
			out[#out + 1] = string.format("%04X%04X", hi, lo)
		else
			out[#out + 1] = string.format("%04X", cp)
		end
	end
	return table.concat(out)
end

-- UCS2 十六进制串转 UTF-8
function pdu.ucs2hex_to_utf8(hex)
	hex = hex:gsub("[^0-9A-Fa-f]", "")
	local cps = {}
	local i = 1
	while i + 3 <= #hex do
		local cp = tonumber(hex:sub(i, i + 3), 16)
		if cp then
			if cp >= 0xD800 and cp <= 0xDBFF and i + 7 <= #hex then
				local lo = tonumber(hex:sub(i + 4, i + 7), 16)
				if lo and lo >= 0xDC00 and lo <= 0xDFFF then
					cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
					i = i + 4
				end
			end
			cps[#cps + 1] = cp
		end
		i = i + 4
	end
	return pdu.codepoints_to_utf8(cps)
end

--------------------------------------------------------------------------------
-- GSM 7bit 编码表（3GPP TS 23.038 默认字母表）
--------------------------------------------------------------------------------

local GSM7_BASIC = {
	"@", "£", "$", "¥", "è", "é", "ù", "ì", "ò", "Ç", "\n", "Ø", "ø", "\r", "Å", "å",
	"Δ", "_", "Φ", "Γ", "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "\x1B", "Æ", "æ", "ß", "É",
	" ", "!", "\"", "#", "¤", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
	"¡", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
	"P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ä", "Ö", "Ñ", "Ü", "§",
	"¿", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
	"p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "ä", "ö", "ñ", "ü", "à"
}

-- GSM 7bit 扩展表（0x1B 前缀）
local GSM7_EXT = {
	[0x0A] = "\f", [0x14] = "^", [0x28] = "{", [0x29] = "}", [0x2F] = "\\",
	[0x3C] = "[", [0x3D] = "~", [0x3E] = "]", [0x40] = "|", [0x65] = "€"
}

-- 反查表
local GSM7_CHAR2CODE = {}
for i = 0, 127 do
	local ch = GSM7_BASIC[i + 1]
	if ch and ch ~= "\x1B" and not GSM7_CHAR2CODE[ch] then
		GSM7_CHAR2CODE[ch] = i
	end
end
local GSM7_EXT_CHAR2CODE = {}
for code, ch in pairs(GSM7_EXT) do
	GSM7_EXT_CHAR2CODE[ch] = code
end

-- 判断字符串是否可完全用 GSM 7bit 表示
function pdu.is_gsm7_compatible(s)
	local cps = pdu.utf8_to_codepoints(s)
	for _, cp in ipairs(cps) do
		if cp > 0xFFFF then return false end
		local ch = pdu.codepoints_to_utf8({ cp })
		if not GSM7_CHAR2CODE[ch] and not GSM7_EXT_CHAR2CODE[ch] then
			return false
		end
	end
	return true
end

-- GSM 7bit 解包（7bit 紧凑位流 -> 字符，LSB-first 位序）
function pdu.gsm7_decode(bytes, septet_count)
	local out = {}
	local bitpos = 0
	local ext_pending = false
	for _ = 1, septet_count do
		local val = bitlib.read_bits_le(bytes, bitpos, 7)
		bitpos = bitpos + 7
		if ext_pending then
			local ch = GSM7_EXT[val]
			out[#out + 1] = ch or " "
			ext_pending = false
		elseif val == 0x1B then
			ext_pending = true
		else
			out[#out + 1] = GSM7_BASIC[val + 1] or " "
		end
	end
	return table.concat(out)
end

-- GSM 7bit 打包（字符 -> 7bit 紧凑位流，LSB-first 位序）
function pdu.gsm7_encode(s)
	local septets = {}
	local cps = pdu.utf8_to_codepoints(s)
	for _, cp in ipairs(cps) do
		local ch = pdu.codepoints_to_utf8({ cp })
		if GSM7_EXT_CHAR2CODE[ch] then
			septets[#septets + 1] = 0x1B
			septets[#septets + 1] = GSM7_EXT_CHAR2CODE[ch]
		elseif GSM7_CHAR2CODE[ch] then
			septets[#septets + 1] = GSM7_CHAR2CODE[ch]
		else
			septets[#septets + 1] = GSM7_CHAR2CODE["?"]
		end
	end

	local total_bits = #septets * 7
	local byte_count = math.ceil(total_bits / 8)
	local bytes = string.rep("\0", byte_count)
	local bitpos = 0
	for _, v in ipairs(septets) do
		bytes = bitlib.write_bits_le(bytes, bitpos, 7, v)
		bitpos = bitpos + 7
	end
	return bytes, #septets
end

--------------------------------------------------------------------------------
-- 号码编解码（BCD 半字节交换）
--------------------------------------------------------------------------------

-- 号码 -> BCD 十六进制串（含长度半字节）
function pdu.encode_number(number)
	number = number:gsub("[^0-9+]", "")
	local is_intl = false
	if number:sub(1, 1) == "+" then
		is_intl = true
		number = number:sub(2)
	end

	local digits = number
	local ndigits = #digits
	local out = {}

	for i = 1, ndigits, 2 do
		local d1 = digits:sub(i, i)
		local d2 = digits:sub(i + 1, i + 1)
		local lo = tonumber(d1)
		local hi
		if d2 == "" then
			hi = 0xF
		else
			hi = tonumber(d2)
		end
		out[#out + 1] = string.format("%X%X", hi, lo)
	end

	local toa = is_intl and "91" or "81"
	local len_hex = string.format("%02X", ndigits)
	return toa .. len_hex .. table.concat(out)
end

-- BCD 十六进制串 -> 号码
function pdu.decode_number(hex)
	if #hex < 4 then return "" end
	local toa = tonumber(hex:sub(1, 2), 16) or 0x81
	local ndigits = tonumber(hex:sub(3, 4), 16) or 0
	local digits_hex = hex:sub(5)

	-- BCD 半字节交换：第 1 个半字节为高位数字，第 2 个半字节为低位数字
	local digits = {}
	for i = 1, #digits_hex, 2 do
		local hi_digit = digits_hex:sub(i, i)
		local lo_digit = digits_hex:sub(i + 1, i + 1)
		if lo_digit and lo_digit ~= "" and lo_digit ~= "F" then
			digits[#digits + 1] = lo_digit
		end
		if hi_digit and hi_digit ~= "" and hi_digit ~= "F" then
			digits[#digits + 1] = hi_digit
		end
	end

	local num = table.concat(digits):sub(1, ndigits)
	-- TOA 字节：bit7 固定 1，bit6-4 为 TON（000=unknown, 001=international）
	local ton_val = math.floor(toa / 16) % 8
	if ton_val == 1 then
		num = "+" .. num
	end
	return num
end

--------------------------------------------------------------------------------
-- 时间戳编解码（SCTS / TP-SCTS，7 字节 BCD 半字节交换，含时区）
--------------------------------------------------------------------------------

function pdu.decode_timestamp(hex)
	if #hex < 14 then return "" end
	local b = {}
	for i = 1, 7 do
		local pair = hex:sub((i - 1) * 2 + 1, i * 2)
		local lo = pair:sub(1, 1)
		local hi = pair:sub(2, 2)
		b[i] = hi .. lo
	end
	local yy = tonumber(b[1], 10) or 0
	local mm = tonumber(b[2], 10) or 1
	local dd = tonumber(b[3], 10) or 1
	local hh = tonumber(b[4], 10) or 0
	local mi = tonumber(b[5], 10) or 0
	local ss = tonumber(b[6], 10) or 0

	-- 时区：第 7 字节为独立 BCD，不做半字节交换
	-- 结构：bit7-bit4 = 十位数字，bit3 = 符号(0=+, 1=-)，bit2-bit0 = 个位数字
	local tz_raw = tonumber(hex:sub(13, 14), 16) or 0
	local tz_quarters = (tz_raw % 8) + math.floor(tz_raw / 16) * 10
	local sign = 1
	if math.floor(tz_raw / 8) % 2 == 1 then sign = -1 end
	local tz_offset_min = sign * tz_quarters * 15

	local year = 2000 + yy
	if yy >= 90 then year = 1900 + yy end

	local tz_sign = tz_offset_min >= 0 and "+" or "-"
	local tz_abs = math.abs(tz_offset_min)
	local tz_str = string.format("%s%02d%02d", tz_sign, math.floor(tz_abs / 60), tz_abs % 60)

	return string.format("%02d-%02d-%02d %02d:%02d:%02d", year, mm, dd, hh, mi, ss), tz_str
end

function pdu.encode_timestamp(iso_like)
	-- iso_like 格式："YY-MM-DD HH:MM:SS" 或 table
	local yy, mm, dd, hh, mi, ss
	if type(iso_like) == "table" then
		yy, mm, dd, hh, mi, ss = iso_like.yy, iso_like.mm, iso_like.dd, iso_like.hh, iso_like.mi, iso_like.ss
	else
		yy, mm, dd, hh, mi, ss = string.match(iso_like, "(%d+)%D+(%d+)%D+(%d+)%D+(%d+)%D+(%d+)%D+(%d+)")
	end
	yy, mm, dd, hh, mi, ss = tonumber(yy) or 0, tonumber(mm) or 1, tonumber(dd) or 1,
		tonumber(hh) or 0, tonumber(mi) or 0, tonumber(ss) or 0

	local function swap2(v)
		local s = string.format("%02d", v)
		return s:sub(2, 2) .. s:sub(1, 1)
	end

	-- 时区默认 +32（中国 UTC+8，8*4=32）
	return swap2(yy) .. swap2(mm) .. swap2(dd) .. swap2(hh) .. swap2(mi) .. swap2(ss) .. "32"
end

--------------------------------------------------------------------------------
-- SMS-DELIVER 解码（接收短信）
--------------------------------------------------------------------------------

function pdu.decode_deliver(hex)
	hex = hex:gsub("%s", ""):upper()
	local pos = 1

	local function readhex(nchars)
		local s = hex:sub(pos, pos + nchars - 1)
		pos = pos + nchars
		return s
	end

	local function readbyte()
		local s = hex:sub(pos, pos + 1)
		pos = pos + 2
		return tonumber(s, 16) or 0
	end

	-- 1. SMSC（以长度字节开头）
	local smsc_len = readbyte()
	if smsc_len > 0 then
		readhex(smsc_len * 2)
	end

	-- 2. 首字节 TP-MTI 等
	local first = readbyte()
	local mti = first % 4
	if mti ~= 0 then
		return nil, "not a SMS-DELIVER PDU (MTI=" .. mti .. ")"
	end
	local has_udhi = math.floor(first / 64) % 2 == 1
	local has_sri = math.floor(first / 32) % 2 == 1

	-- 3. 发送方号码（地址长度以"数字个数"计，字节数需向上取整）
	local addr_len_byte = readbyte()
	local addr_bytes = math.ceil(addr_len_byte / 2)
	local toa = readhex(2)
	local addr_hex = readhex(addr_bytes * 2)
	local sender = pdu.decode_number(toa .. string.format("%02X", addr_len_byte) .. addr_hex)

	-- 4. TP-PID, TP-DCS
	local pid = readbyte()
	local dcs = readbyte()

	-- 5. TP-SCTS
	local scts_hex = readhex(14)
	local timestamp, tz = pdu.decode_timestamp(scts_hex)

	-- 6. TP-UDL
	local udl = readbyte()

	-- 7. 数据编码判断 + UDH 处理
	local alphabet = math.floor(dcs / 4) % 4  -- 0=7bit, 1=8bit, 2=UCS2
	local text = ""
	local udh_bytes = nil      -- UDH 原始字节串
	local udh_len = 0          -- UDH 占用的字节数（含 UDHL 字节）
	local concat_info = nil    -- { ref=, total=, seq= }
	local ud_start = 1         -- 正文在字节流中的起始位置（1 基）

	if alphabet == 0 then
		-- ===== GSM 7bit =====
		local byte_len = math.ceil(udl * 7 / 8)
		local data_hex = readhex(byte_len * 2)
		local bytes = {}
		for i = 1, #data_hex, 2 do
			bytes[#bytes + 1] = string.char(tonumber(data_hex:sub(i, i + 1), 16) or 0)
		end
		local data = table.concat(bytes)

		if has_udhi and #data > 0 then
			-- 有 UDH：先解析 UDH
			udh_len = (data:byte(1) or 0) + 1
			udh_bytes = data:sub(1, udh_len)
			concat_info = pdu.parse_concat_udh(udh_bytes)

			-- UDH 占用的 septet 数（向上取整）
			local udh_septets = math.ceil(udh_len * 8 / 7)
			local text_septets = udl - udh_septets

			if text_septets > 0 then
				local bitpos = udh_septets * 7
				local out = {}
				local ext_pending = false
				for _ = 1, text_septets do
					local v = bitlib.read_bits_le(data, bitpos, 7)
					bitpos = bitpos + 7
					if ext_pending then
						out[#out + 1] = GSM7_EXT[v] or " "
						ext_pending = false
					elseif v == 0x1B then
						ext_pending = true
					else
						out[#out + 1] = GSM7_BASIC[v + 1] or " "
					end
				end
				text = table.concat(out)
			end
		else
			text = pdu.gsm7_decode(data, udl)
		end

	elseif alphabet == 2 then
		-- ===== UCS2 =====
		local data_hex = readhex(udl * 2)

		if has_udhi and #data_hex >= 2 then
			-- 有 UDH：UDHL 在第一个字节
			local udhl = tonumber(data_hex:sub(1, 2), 16) or 0
			udh_len = udhl + 1
			local udh_hex = data_hex:sub(1, udh_len * 2)

			-- 转成字节串供解析
			local ub = {}
			for i = 1, #udh_hex, 2 do
				ub[#ub + 1] = string.char(tonumber(udh_hex:sub(i, i + 1), 16) or 0)
			end
			udh_bytes = table.concat(ub)
			concat_info = pdu.parse_concat_udh(udh_bytes)

			-- 正文从 UDH 之后开始
			local body_hex = data_hex:sub(udh_len * 2 + 1)
			text = pdu.ucs2hex_to_utf8(body_hex)
		else
			text = pdu.ucs2hex_to_utf8(data_hex)
		end

	else
		-- ===== 8bit =====
		local data_hex = readhex(udl * 2)
		if has_udhi and #data_hex >= 2 then
			local udhl = tonumber(data_hex:sub(1, 2), 16) or 0
			udh_len = udhl + 1
			local udh_hex = data_hex:sub(1, udh_len * 2)
			local ub = {}
			for i = 1, #udh_hex, 2 do
				ub[#ub + 1] = string.char(tonumber(udh_hex:sub(i, i + 1), 16) or 0)
			end
			udh_bytes = table.concat(ub)
			concat_info = pdu.parse_concat_udh(udh_bytes)
			text = data_hex:sub(udh_len * 2 + 1)
		else
			text = data_hex
		end
	end

	return {
		sender = sender,
		timestamp = timestamp,
		timezone = tz,
		text = text,
		dcs = dcs,
		pid = pid,
		alphabet = alphabet,
		udhi = has_udhi,
		sri = has_sri,
		udh = udh_bytes,          -- UDH 原始字节（无则为 nil）
		udh_len = udh_len,        -- UDH 字节数
		concat = concat_info      -- { ref=, total=, seq= } 长短信信息
	}
end

--------------------------------------------------------------------------------
-- SMS-SUBMIT 编码（发送短信）
--------------------------------------------------------------------------------

-- opts: { number, text, smsc (可选十六进制), dcs (可选), use_ucs2 (bool) }
function pdu.encode_submit(opts)
	local number = opts.number or ""
	local text = opts.text or ""
	local smsc = opts.smsc

	local parts = {}

	-- SMSC
	if smsc and #smsc > 0 then
		local slen = math.floor(#smsc / 2)
		parts[#parts + 1] = string.format("%02X", slen) .. smsc
	else
		parts[#parts + 1] = "00"  -- 使用默认 SMSC
	end

	-- TP-MTI = 01 (SMS-SUBMIT), TP-VPF = 00 (无有效期)
	parts[#parts + 1] = "01"

	-- TP-MR (消息参考号)
	parts[#parts + 1] = "00"

	-- TP-DA (目标号码)
	parts[#parts + 1] = pdu.encode_number(number)

	-- TP-PID = 00
	parts[#parts + 1] = "00"

	-- 决定编码
	local use_ucs2 = opts.use_ucs2
	if use_ucs2 == nil then
		use_ucs2 = not pdu.is_gsm7_compatible(text)
	end

	local udl, ud_hex
	if use_ucs2 then
		parts[#parts + 1] = "08"  -- TP-DCS: UCS2
		local hex = pdu.utf8_to_ucs2hex(text)
		udl = math.floor(#hex / 2)
		ud_hex = hex
	else
		parts[#parts + 1] = "00"  -- TP-DCS: GSM 7bit
		local bytes, septets = pdu.gsm7_encode(text)
		udl = septets
		local out = {}
		for i = 1, #bytes do
			out[#out + 1] = string.format("%02X", bytes:byte(i))
		end
		ud_hex = table.concat(out)
	end

	parts[#parts + 1] = string.format("%02X", udl)
	parts[#parts + 1] = ud_hex

	local pdu_hex = table.concat(parts)

	-- 计算 TPDU 长度（不含 SMSC 部分）
	local smsc_len = (smsc and #smsc > 0) and (1 + math.floor(#smsc / 2)) or 1
	local tpdu_octets = math.floor(#pdu_hex / 2) - smsc_len

	return pdu_hex, tpdu_octets, use_ucs2
end

--------------------------------------------------------------------------------
-- 自动识别并解码 PDU（DELIVER / SUBMIT）
--------------------------------------------------------------------------------

function pdu.decode_auto(hex)
	hex = hex:gsub("%s", ""):upper()
	if #hex < 10 then
		return nil, "PDU too short"
	end

	-- 跳过 SMSC
	local pos = 3
	local smsc_len = tonumber(hex:sub(1, 2), 16) or 0
	pos = pos + smsc_len * 2

	local first_hex = hex:sub(pos, pos + 1)
	local first = tonumber(first_hex, 16) or 0
	local mti = first % 4

	if mti == 0 then
		return pdu.decode_deliver(hex)
	elseif mti == 1 then
		-- SUBMIT 不常用于接收，简单返回
		return { sender = "(submit)", text = "(SMS-SUBMIT PDU)", timestamp = "" }
	else
		return nil, "unsupported MTI=" .. mti
	end
end

--------------------------------------------------------------------------------
-- 长短信（UDH 拼接）支持
--------------------------------------------------------------------------------

-- 从含 UDH 的 7bit 数据中提取 UDH 与正文
function pdu.split_udh_7bit(bytes, udl)
	-- UDH 长度
	local udhl = bytes:byte(1) or 0
	local udh_octets = 1 + udhl
	local udh = bytes:sub(1, udh_octets)

	-- UDH 占用的 septet 数（向上取整）
	local udh_septets = math.ceil(udh_octets * 8 / 7)
	local udh_fill_bits = udh_septets * 7 - udh_octets * 8

	-- 正文从 udh_septets 之后开始
	local text_septets = udl - udh_septets
	if text_septets <= 0 then
		return udh, ""
	end

	local bitpos = udh_septets * 7
	local out = {}
	for _ = 1, text_septets do
		local v = bitlib.read_bits_be(bytes, bitpos, 7)
		bitpos = bitpos + 7
		out[#out + 1] = GSM7_BASIC[v + 1] or " "
	end
	return udh, table.concat(out)
end

-- 解析 UDH 中的长短信头（IEI 0x00 = 8bit ref, 0x08 = 16bit ref）
function pdu.parse_concat_udh(udh)
	if #udh < 2 then return nil end
	local udhl = udh:byte(1)
	local i = 2
	while i <= 1 + udhl do
		local iei = udh:byte(i)
		local ielen = udh:byte(i + 1) or 0
		if iei == 0x00 and ielen == 3 then
			local ref = udh:byte(i + 2)
			local total = udh:byte(i + 3)
			local seq = udh:byte(i + 4)
			return { ref = ref, total = total, seq = seq }
		elseif iei == 0x08 and ielen == 4 then
			local ref = (udh:byte(i + 2) or 0) * 256 + (udh:byte(i + 3) or 0)
			local total = udh:byte(i + 4)
			local seq = udh:byte(i + 5)
			return { ref = ref, total = total, seq = seq }
		end
		i = i + 2 + ielen
	end
	return nil
end

return pdu