-- PDU 编解码单元测试（可在本地 Lua 5.3 与路由器 Lua 5.1 上运行）

package.path = "/storage/emulated/0/Download/路由器520/luci-app-modem-control/sms/?.lua;" .. package.path
if not package.path:find("/tmp/") then
	package.path = "/tmp/?.lua;" .. package.path
end

local pdu = require("pdu")

local pass, fail = 0, 0

local function check(name, actual, expected)
	if tostring(actual) == tostring(expected) then
		pass = pass + 1
		print(string.format("[PASS] %s", name))
	else
		fail = fail + 1
		print(string.format("[FAIL] %s\n  expected: %s\n  actual  : %s", name, tostring(expected), tostring(actual)))
	end
end

local function check_true(name, cond, detail)
	if cond then
		pass = pass + 1
		print(string.format("[PASS] %s", name))
	else
		fail = fail + 1
		print(string.format("[FAIL] %s  %s", name, detail or ""))
	end
end

print("=========================================")
print("  PDU 编解码单元测试")
print("=========================================")

-- ============ 1. UTF-8 <-> UCS2 ============
print("\n--- 1. UCS2 转换测试 ---")

check("中文 -> UCS2 hex",
	pdu.utf8_to_ucs2hex("你好"),
	"4F60597D")

check("UCS2 hex -> 中文",
	pdu.ucs2hex_to_utf8("4F60597D"),
	"你好")

check("纯 ASCII -> UCS2",
	pdu.utf8_to_ucs2hex("ABC"),
	"004100420043")

check("UCS2 -> ASCII",
	pdu.ucs2hex_to_utf8("004100420043"),
	"ABC")

check("混合中英 -> UCS2",
	pdu.utf8_to_ucs2hex("A中"),
	"00414E2D")

-- 真实抓取短信内容
check("真实短信 UCS2 解码",
	pdu.ucs2hex_to_utf8("00610067006C002067E58BE28BE660C53002"),
	"agl 查询详情。")

-- ============ 2. GSM 7bit ============
print("\n--- 2. GSM 7bit 编码测试 ---")

check_true("ASCII 兼容 GSM7", pdu.is_gsm7_compatible("Hello World"))
check_true("中文不兼容 GSM7", not pdu.is_gsm7_compatible("你好"))

local gsm_bytes, gsm_septets = pdu.gsm7_encode("Hi")
check("GSM7 'Hi' septet 数", gsm_septets, 2)

local decoded = pdu.gsm7_decode(gsm_bytes, gsm_septets)
check("GSM7 编解码往返", decoded, "Hi")

-- 标准测试向量：'hellohello' -> E8329BFD4697D9EC37
local hb, hs = pdu.gsm7_encode("hellohello")
local hex = {}
for i = 1, #hb do hex[#hex + 1] = string.format("%02X", hb:byte(i)) end
check("GSM7 'hellohello' 标准向量", table.concat(hex), "E8329BFD4697D9EC37")
check("GSM7 'hellohello' 解码", pdu.gsm7_decode(hb, hs), "hellohello")

-- ============ 3. 号码 BCD ============
print("\n--- 3. 号码编解码测试 ---")

check("国际号码 +8613800138000",
	pdu.encode_number("+8613800138000"),
	"91" .. "0D" .. "683108108300F0")

check("本地号码 10010",
	pdu.encode_number("10010"),
	"81" .. "05" .. "0110F0")

check("号码解码 +8613800138000",
	pdu.decode_number("91" .. "0D" .. "683108108300F0"),
	"+8613800138000")

check("号码解码 10010",
	pdu.decode_number("81" .. "05" .. "0110F0"),
	"10010")

-- ============ 4. 时间戳 ============
print("\n--- 4. 时间戳解码测试 ---")

local ts, tz = pdu.decode_timestamp("02" .. "21" .. "40" .. "21" .. "02" .. "02" .. "32")
check("时间戳解码", ts, "2020-12-04 12:20:20")
check("时区解码", tz, "+0800")

-- ============ 5. SMS-DELIVER 解码 ============
print("\n--- 5. SMS-DELIVER PDU 解码 ---")

-- 构造一条真实的 UCS2 短信 PDU（来自 10010）
-- SMSC: 00 (使用默认)
-- First octet: 04 (SMS-DELIVER, 无 UDHI)
-- Sender: 0B 91 683108100100F0  -> +8613800100100? 用 10010
-- 简化测试：使用一个已知 PDU

-- 标准测试 PDU（UCS2 中文 "你好"）
-- 00          SMSC 长度 0（使用默认）
-- 04          TP-MTI=SMS-DELIVER, 无 UDHI
-- 0B          发送方号码数字个数 = 11
-- 91          TOA = 国际号码
-- 68310810010  + F0  号码 BCD 6 字节 (86138001001 0F -> +861380010010)
-- 00          TP-PID
-- 08          TP-DCS = UCS2
-- 21201151826100  TP-SCTS
-- 04          TP-UDL = 4 字节
-- 4F60 597D   正文 "你好"
local test_pdu = "00" .. "04" .. "0B" .. "91" .. "683108100100" ..
	"00" .. "08" ..
	"21201151826100" ..
	"04" .. "4F60597D"

local deliver = pdu.decode_deliver(test_pdu)
if deliver then
	check("DELIVER 解码文本", deliver.text, "你好")
	check("DELIVER 编码类型(UCS2=2)", deliver.alphabet, 2)
	check_true("DELIVER 发件人非空", deliver.sender and #deliver.sender > 0, "sender=" .. tostring(deliver.sender))
else
	check_true("DELIVER 解码", false, "decode_deliver 返回 nil")
end

-- ============ 6. SMS-SUBMIT 编码 ============
print("\n--- 6. SMS-SUBMIT PDU 编码 ---")

local pdu_hex, tpdu_len, used_ucs2 = pdu.encode_submit({
	number = "+8613800138000",
	text = "测试"
})
check_true("SUBMIT 生成非空", pdu_hex and #pdu_hex > 0)
check("SUBMIT 使用 UCS2", used_ucs2, true)
check_true("SUBMIT TPDU 长度合理", tpdu_len and tpdu_len > 10, "tpdu_len=" .. tostring(tpdu_len))
print("  PDU: " .. tostring(pdu_hex) .. "  (TPDU octets=" .. tostring(tpdu_len) .. ")")

local pdu_hex2, tpdu_len2, used_ucs2_2 = pdu.encode_submit({
	number = "10010",
	text = "Hello"
})
check("SUBMIT ASCII 用 GSM7", used_ucs2_2, false)
print("  PDU: " .. tostring(pdu_hex2) .. "  (TPDU octets=" .. tostring(tpdu_len2) .. ")")

-- ============ 7. 往返测试 ============
print("\n--- 7. 编解码往返测试 ---")

-- 编码后应能被 decode_deliver 识别（MTI 不同，这里只验证 SUBMIT 结构）
local rpdu = pdu.encode_submit({ number = "+8613800138000", text = "测试ABC123" })
check_true("往返：PDU 长度偶数", #rpdu % 2 == 0, "len=" .. #rpdu)
check_true("往返：PDU 全为十六进制", rpdu:match("^[0-9A-F]+$") ~= nil)

-- ============ 8. UDH 长短信 ============
print("\n--- 8. UDH 长短信解析 ---")

-- 8bit ref 长短信头：05 00 03 AB 02 01
local udh1 = string.char(0x05, 0x00, 0x03, 0xAB, 0x02, 0x01)
local c1 = pdu.parse_concat_udh(udh1)
check_true("UDH 8bit ref 解析", c1 ~= nil)
if c1 then
	check("UDH ref", c1.ref, 0xAB)
	check("UDH total", c1.total, 2)
	check("UDH seq", c1.seq, 1)
end

-- 16bit ref 长短信头：06 08 04 12 34 02 01
local udh2 = string.char(0x06, 0x08, 0x04, 0x12, 0x34, 0x02, 0x01)
local c2 = pdu.parse_concat_udh(udh2)
check_true("UDH 16bit ref 解析", c2 ~= nil)
if c2 then
	check("UDH16 ref", c2.ref, 0x1234)
	check("UDH16 total", c2.total, 2)
	check("UDH16 seq", c2.seq, 1)
end

-- ============ 汇总 ============
print("\n=========================================")
print(string.format("  测试完成：通过 %d 项，失败 %d 项", pass, fail))
print("=========================================")

if fail > 0 then
	os.exit(1)
end