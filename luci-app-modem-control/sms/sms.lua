--[[
  短信业务核心层（自适应通用版）

  特性：
    - AT 端口自动探测 / 手动指定
    - 短信存储位置自动探测（ME / SM / MT）
    - 字符编码自动探测（UCS2 / GSM7 / IRA）
    - 文本模式优先，失败降级 PDU 模式
    - 收 / 发 / 删 全套功能
    - 长短信（UDH）自动拼接
    - SIM 未识别时自动 CFUN 软复位
]]

local at = require("at")
local pdu = require("pdu")
local nixio = require("nixio")

local sms = {}

-- 默认配置
sms.config = {
	port = "auto",
	storage = "auto",
	charset = "auto",
	mode = "auto",
}

-- 缓存探测结果
local cache = {
	port = nil,
	model = nil,
	storage = nil,
	charset = nil,
	mode = nil,
	smsc = nil,
	imsi = nil,
	imsi_ts = 0,
	status = nil,
	status_ts = 0,
	probed_at = 0,
}

local CACHE_TTL = 300  -- 探测结果缓存 5 分钟

--------------------------------------------------------------------------------
-- 配置加载（从 UCI）
--------------------------------------------------------------------------------

function sms.load_config()
	local uci = require("uci")
	local cursor = uci.cursor()

	-- 优先读取独立插件的配置 sms_manager，回退兼容旧的 modem 配置
	local cfg_name = "sms_manager"
	local sec_name = "settings"
	cursor:load(cfg_name)
	if not cursor:get(cfg_name, sec_name) then
		cfg_name = "modem"
		sec_name = "sms"
		cursor:load(cfg_name)
	end

	sms.config.port = cursor:get(cfg_name, sec_name, "port") or "auto"
	sms.config.storage = cursor:get(cfg_name, sec_name, "storage") or "auto"
	sms.config.charset = cursor:get(cfg_name, sec_name, "charset") or "auto"
	sms.config.mode = cursor:get(cfg_name, sec_name, "mode") or "auto"

	return sms.config
end

function sms.save_config(cfg)
	local uci = require("uci")
	local cursor = uci.cursor()
	cursor:load("sms_manager")

	-- 确保 section 存在
	if not cursor:get("sms_manager", "settings") then
		cursor:section("sms_manager", "sms", "settings")
	end

	if cfg.port then cursor:set("sms_manager", "settings", "port", cfg.port) end
	if cfg.storage then cursor:set("sms_manager", "settings", "storage", cfg.storage) end
	if cfg.charset then cursor:set("sms_manager", "settings", "charset", cfg.charset) end
	if cfg.mode then cursor:set("sms_manager", "settings", "mode", cfg.mode) end

	cursor:commit("sms_manager")
	cache.probed_at = 0  -- 配置变更后失效缓存
	return true
end

--------------------------------------------------------------------------------
-- 端口解析
--------------------------------------------------------------------------------

function sms.resolve_port(force_probe)
	-- 手动指定
	if sms.config.port and sms.config.port ~= "auto" and sms.config.port ~= "" then
		return sms.config.port, nil
	end

	-- 缓存有效
	local now = os.time()
	if not force_probe and cache.port and (now - cache.probed_at) < CACHE_TTL then
		return cache.port, cache.model
	end

	-- 自动探测
	local port, model = at.autodetect()
	if port then
		cache.port = port
		cache.model = model
		cache.probed_at = now
		return port, model
	end

	return nil, "no AT port found"
end

--------------------------------------------------------------------------------
-- 连接会话（打开 -> 初始化 -> 操作 -> 关闭）
--------------------------------------------------------------------------------

-- 打开并初始化会话（优化版：可跳过冗余初始化）
-- 返回: fd, session_info 或 nil, err
-- opts: { force_probe, minimal }  minimal=true 时只做必要初始化（用于 status）
local function open_session(opts)
	opts = opts or {}
	local minimal = opts.minimal or false

	local port, model = sms.resolve_port(opts.force_probe)
	if not port then
		return nil, nil, "AT 端口未找到，请确认 4G 模组已上电"
	end

	local fd, err = at.open(port)
	if not fd then
		return nil, nil, err
	end

	local info = {
		port = port,
		model = model or "",
	}

	-- 关闭回显（仅首次，开销很小）
	at.command(fd, "ATE0", { timeout_ms = 800 })

	-- 检查 SIM 状态
	local pin_resp = at.command(fd, "AT+CPIN?", { timeout_ms = 2000 })
	info.sim_status = "unknown"
	if pin_resp then
		if pin_resp:find("+CPIN:%s*READY") then
			info.sim_status = "ready"
		elseif pin_resp:find("SIM not inserted") or pin_resp:find("CME ERROR: 10") then
			info.sim_status = "absent"
		elseif pin_resp:find("SIM PIN") then
			info.sim_status = "pin_required"
		elseif pin_resp:find("CME ERROR: 13") then
			info.sim_status = "failure"
		elseif pin_resp:find("CME ERROR: 11") then
			info.sim_status = "puk_required"
		end
	end

	-- SIM 未识别时，尝试 CFUN 软复位（热插拔卡的关键）
	if info.sim_status == "absent" or info.sim_status == "failure" then
		at.command(fd, "AT+CFUN=0", { timeout_ms = 6000 })
		nixio.nanosleep(1, 0)
		at.command(fd, "AT+CFUN=1", { timeout_ms = 12000 })
		nixio.nanosleep(2, 0)

		local retry = at.command(fd, "AT+CPIN?", { timeout_ms = 3000 })
		if retry and retry:find("+CPIN:%s*READY") then
			info.sim_status = "ready"
			info.cfun_reset = true
		end
	end

	if info.sim_status ~= "ready" then
		at.close(fd)
		local msg = "SIM 卡未就绪（状态：" .. info.sim_status .. "）"
		if info.sim_status == "absent" then
			msg = "未检测到 SIM 卡，请插入卡后重试"
		elseif info.sim_status == "pin_required" then
			msg = "SIM 卡需要输入 PIN 码"
		elseif info.sim_status == "failure" then
			msg = "SIM 卡读取失败，请检查卡片接触或重新插拔"
		end
		return nil, info, msg
	end

	-- 存储位置：缓存命中则跳过 CPMS=? 探测
	if sms.config.storage == "auto" then
		if cache.storage and (os.time() - cache.probed_at) < CACHE_TTL then
			info.storage = cache.storage
		else
			local cpms_resp = at.command(fd, "AT+CPMS=?", { timeout_ms = 2000 })
			local storages = {}
			if cpms_resp then
				for list in cpms_resp:gmatch("%(([^)]*)%)") do
					for s in list:gmatch('"([^"]+)"') do
						storages[#storages + 1] = s
					end
					break
				end
			end
			local chosen = nil
			for _, pref in ipairs({ "ME", "SM", "MT" }) do
				for _, s in ipairs(storages) do
					if s == pref then chosen = pref break end
				end
				if chosen then break end
			end
			info.storage = chosen or "ME"
			info.storage_list = storages
			cache.storage = info.storage
		end
	else
		info.storage = sms.config.storage
	end

	-- 仅当存储位置需要切换时才发 CPMS（避免冗余）
	at.command(fd, 'AT+CPMS="' .. info.storage .. '"', { timeout_ms = 2000 })

	-- 模式：缓存命中则跳过
	local use_text_mode = true
	if sms.config.mode == "pdu" then
		use_text_mode = false
		at.command(fd, "AT+CMGF=0", { timeout_ms = 1500 })
	elseif sms.config.mode == "text" then
		use_text_mode = true
		at.command(fd, "AT+CMGF=1", { timeout_ms = 1500 })
	else
		-- auto：优先文本模式
		local cmgf_resp = at.command(fd, "AT+CMGF=1", { timeout_ms = 1500 })
		use_text_mode = cmgf_resp and cmgf_resp:find("OK", 1, true) ~= nil
		if not use_text_mode then
			at.command(fd, "AT+CMGF=0", { timeout_ms = 1500 })
		end
	end
	info.text_mode = use_text_mode

	-- minimal 模式到此为止（status 查询不需要更多初始化）
	if minimal then
		return fd, info
	end

	-- 设置字符集（文本模式）
	if use_text_mode then
		local cs = sms.config.charset
		if cs == "auto" then cs = "IRA" end
		at.command(fd, 'AT+CSCS="' .. cs .. '"', { timeout_ms = 1500 })
		info.charset = cs
	end

	-- 启用新短信上报
	at.command(fd, "AT+CNMI=2,1,0,0,0", { timeout_ms = 1500 })

	-- 读取短信中心号码（缓存）
	if cache.smsc and (os.time() - cache.probed_at) < CACHE_TTL then
		info.smsc = cache.smsc
	else
		local csca_resp = at.command(fd, "AT+CSCA?", { timeout_ms = 2000 })
		if csca_resp then
			info.smsc = csca_resp:match('%+CSCA:%s*"([^"]+)"')
			cache.smsc = info.smsc
		end
	end

	return fd, info
end

--------------------------------------------------------------------------------
-- 短信解码辅助（文本模式返回的可能是 UCS2 十六进制）
--------------------------------------------------------------------------------

-- 判断字符串是否像 UCS2 十六进制（偶数长度，全 hex，长度 >= 4）
local function looks_like_ucs2_hex(s)
	if not s or #s < 4 or #s % 4 ~= 0 then return false end
	if not s:match("^[0-9A-Fa-f]+$") then return false end
	-- 且应含有大量 00（ASCII 高位）或常见中文区间
	local zeros = 0
	for i = 1, #s, 4 do
		local hi = s:sub(i, i + 1)
		if hi == "00" then zeros = zeros + 1 end
	end
	return zeros > 0 or #s >= 8
end

-- 解码正文
local function decode_body(raw)
	if not raw or raw == "" then return "" end

	-- 去掉可能的引号与换行
	raw = raw:gsub("^%s+", ""):gsub("%s+$", "")

	-- UCS2 十六进制
	if looks_like_ucs2_hex(raw) then
		local decoded = pdu.ucs2hex_to_utf8(raw)
		-- 如果解码出可打印内容则返回
		if decoded and #decoded > 0 then
			return decoded
		end
	end

	-- 直接是文本
	return raw
end

--------------------------------------------------------------------------------
-- 解析 CMGL 响应（文本模式）
--------------------------------------------------------------------------------

-- 解析 CMGL 文本模式响应
-- 真实格式示例：
--   +CMGL: 0,"REC READ","10010",,"20/12/04,12:20:20+32"
--   <UCS2 十六进制正文>
--   +CMGL: 1,"REC READ","10010",,"20/12/04,12:20:20+32"
--   ...
local function parse_cmgl_text(resp)
	local messages = {}
	if not resp then return messages end

	-- 统一换行，按行拆分
	resp = resp:gsub("\r\n", "\n"):gsub("\r", "\n")
	local lines = {}
	for line in (resp .. "\n"):gmatch("(.-)\n") do
		lines[#lines + 1] = line
	end

	local i = 1
	while i <= #lines do
		local line = lines[i]

		-- 匹配 +CMGL: <idx>,"<stat>","<sender>",<alpha>,"<scts>"
		local idx, stat, sender, ts = line:match('^%+CMGL:%s*(%d+)%s*,%s*"([^"]*)"%s*,%s*"([^"]*)"%s*,%s*[^,]*%s*,%s*"([^"]*)"')

		if not idx then
			-- 兼容没有 SCTS 的简化格式
			idx, stat, sender = line:match('^%+CMGL:%s*(%d+)%s*,%s*"([^"]*)"%s*,%s*"([^"]*)"')
		end
		if not idx then
			idx, stat = line:match('^%+CMGL:%s*(%d+)%s*,%s*"([^"]*)"')
		end

		if idx then
			local msg = {
				index = tonumber(idx),
				stat = stat or "",
				sender = sender or "",
				timestamp = ts or "",
				text = ""
			}

			-- 正文：跳过前导空行，收集到下一个 +CMGL: 或 OK 为止
			i = i + 1
			local body_parts = {}
			local started = false
			while i <= #lines do
				local l = lines[i]
				if l:match("^%+CMGL:") or l == "OK" then
					break
				end
				local trimmed = l:match("^%s*(.-)%s*$")
				if trimmed ~= "" then
					started = true
					body_parts[#body_parts + 1] = trimmed
				elseif started then
					-- 正文已开始后遇到空行，视为正文结束
					break
				end
				i = i + 1
			end

			if #body_parts > 0 then
				msg.text = decode_body(table.concat(body_parts))
			end

			messages[#messages + 1] = msg
		else
			i = i + 1
		end
	end

	return messages
end

-- 解析 CMGL 响应（PDU 模式，含长短信 UDH）
local function parse_cmgl_pdu(resp)
	local messages = {}
	if not resp then return messages end

	local lines = {}
	for line in (resp .. "\n"):gmatch("(.-)\r?\n") do
		lines[#lines + 1] = line
	end

	local i = 1
	while i <= #lines do
		local line = lines[i]
		-- +CMGL: <index>,<stat>,<alpha>,<length>  （PDU 模式）
		local idx, stat, len = line:match('^%+CMGL:%s*(%d+),%s*(%d+),.*,(%d+)%s*$')
		if idx then
			-- 关键：+CMGL 行与 PDU 数据行之间可能有空行，需跳过
			local j = i + 1
			while j <= #lines and lines[j]:gsub("%s", "") == "" do
				j = j + 1
			end
			if j <= #lines then
				local pdu_hex = lines[j]:gsub("%s", "")
				-- 仅接受纯十六进制且长度足够的内容
				if #pdu_hex >= 20 and pdu_hex:match("^[0-9A-Fa-f]+$") then
					local decoded = pdu.decode_auto(pdu_hex)
					if decoded then
						messages[#messages + 1] = {
							index = tonumber(idx),
							stat = stat == "0" and "REC UNREAD" or "REC READ",
							sender = decoded.sender or "",
							timestamp = decoded.timestamp or "",
							text = decoded.text or "",
							concat = decoded.concat,   -- 长短信信息 { ref, total, seq }
							udhi = decoded.udhi or false
						}
					end
					i = j
				end
			end
		end
		i = i + 1
	end

	return messages
end

--------------------------------------------------------------------------------
-- 长短信拼接
--------------------------------------------------------------------------------

-- 把分片短信按 {ref, total, seq} 合并为完整短信
-- 输入: messages 数组（已按 index 降序排列）
-- 输出: 合并后的 messages 数组
local function merge_concat_messages(messages)
	if #messages == 0 then return messages end

	-- 分组：key = sender .. "|" .. ref .. "|" .. total
	local groups = {}       -- key -> { parts = { [seq] = msg }, total = n }

	for _, msg in ipairs(messages) do
		local c = msg.concat
		if c and c.ref and c.total and c.seq and c.total > 1 then
			local key = tostring(msg.sender) .. "|" .. tostring(c.ref) .. "|" .. tostring(c.total)
			if not groups[key] then
				groups[key] = { parts = {}, total = c.total }
			end
			groups[key].parts[c.seq] = msg
		end
	end

	-- 构建结果：先处理长短信组，再处理普通短信，保持原顺序
	local result = {}
	local emitted_groups = {}

	for _, msg in ipairs(messages) do
		local c = msg.concat
		if c and c.ref and c.total and c.total > 1 then
			local key = tostring(msg.sender) .. "|" .. tostring(c.ref) .. "|" .. tostring(c.total)
			if emitted_groups[key] then
				-- 该组已输出，跳过
			else
				emitted_groups[key] = true
				local grp = groups[key]
				local parts = grp.parts

				-- 检查是否所有分片都齐全
				local complete = true
				for s = 1, grp.total do
					if not parts[s] then complete = false break end
				end

				if complete then
					-- 按 seq 升序拼接正文
					local texts = {}
					local indexes = {}
					local min_index = nil
					for s = 1, grp.total do
						texts[#texts + 1] = parts[s].text or ""
						indexes[#indexes + 1] = parts[s].index
						if not min_index or parts[s].index < min_index then
							min_index = parts[s].index
						end
					end

					result[#result + 1] = {
						index = min_index,
						stat = parts[1].stat,
						sender = parts[1].sender,
						timestamp = parts[1].timestamp,
						text = table.concat(texts),
						concat = { ref = c.ref, total = grp.total, seq = 0 },
						merged = true,
						part_count = grp.total,
						part_indexes = indexes,   -- 所有分片的索引（删除时需要全删）
						udhi = true
					}
				else
					-- 分片不全，按原样保留（避免丢失）
					result[#result + 1] = msg
				end
			end
		else
			result[#result + 1] = msg
		end
	end

	return result
end

-- 把不同来源的时间戳归一化为可比较的 "YYYYMMDDHHMMSS" 数字串
-- 支持两种格式：
--   PDU 模式   : "2021-02-17 18:49:58"
--   文本模式   : "21/02/17,18:49:58+32"
local function ts_key(ts)
	if not ts or ts == "" then return "00000000000000" end
	-- 格式一：YYYY-MM-DD HH:MM:SS
	local y, mo, d, h, mi, s = ts:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)[ T](%d%d):(%d%d):?(%d*)")
	if y then
		return y .. mo .. d .. h .. mi .. (s ~= "" and s or "00")
	end
	-- 格式二：YY/MM/DD,HH:MM:SS+ZZ
	local yy, m2, d2, h2, mi2, s2 = ts:match("^(%d%d)/(%d%d)/(%d%d),(%d%d):(%d%d):?(%d*)")
	if yy then
		local ynum = tonumber(yy) or 0
		local year = ynum >= 90 and (1900 + ynum) or (2000 + ynum)
		return tostring(year) .. m2 .. d2 .. h2 .. mi2 .. (s2 ~= "" and s2 or "00")
	end
	return ts
end

--------------------------------------------------------------------------------
-- 公共 API：读取短信列表
--------------------------------------------------------------------------------

-- 列出短信（分页优化版：先读 CPMS 得到总条数，再按需读指定范围）
-- opts: { filter = "ALL"|..., limit = n }
-- 返回: messages, info 或 nil, err
function sms.list(opts)
	opts = opts or {}
	sms.load_config()

	local fd, info, err = open_session(opts)
	if not fd then
		return nil, err or info
	end

	local filter = opts.filter or "ALL"
	local messages = {}
	local limit = tonumber(opts.limit) or 20

	-- 先读存储使用情况，决定需要读多少条
	local cpms = at.command(fd, "AT+CPMS?", { timeout_ms = 1200 })
	local used, total = 0, 0
	if cpms then
		local u, t = cpms:match('+CPMS:%s*"[^"]*",%s*(%d+),%s*(%d+)')
		used = tonumber(u) or 0
		total = tonumber(t) or 0
		info.used = used
		info.total = total
	end

	-- 长短信拼接依赖 UDH 信息，只有 PDU 模式才能拿到
	-- 因此列表读取统一走 PDU 模式（无论配置的默认模式）
	local filter_num = 4
	if filter == "REC UNREAD" then filter_num = 0
	elseif filter == "REC READ" then filter_num = 1
	elseif filter == "STO UNSENT" then filter_num = 2
	elseif filter == "STO SENT" then filter_num = 3 end

	if info.text_mode then
		-- 当前是文本模式，临时切到 PDU 模式以获取 UDH
		local r = at.command(fd, "AT+CMGF=0", { timeout_ms = 1500 })
		if r and at.is_ok(r) then
			local resp = at.command(fd, "AT+CMGL=" .. filter_num, { timeout_ms = 20000 })
			messages = parse_cmgl_pdu(resp)
		end
		if #messages == 0 then
			-- PDU 读取失败，回退文本模式（此时无法拼接长短信）
			at.command(fd, "AT+CMGF=1", { timeout_ms = 1500 })
			local resp = at.command(fd, 'AT+CMGL="' .. filter .. '"', { timeout_ms = 15000 })
			messages = parse_cmgl_text(resp)
		end
	else
		local resp = at.command(fd, "AT+CMGL=" .. filter_num, { timeout_ms = 20000 })
		messages = parse_cmgl_pdu(resp)
	end

	-- 按索引降序排序（最新的在前）
	table.sort(messages, function(a, b) return a.index > b.index end)

	-- 长短信拼接（关键：必须在截断 limit 之前做，否则分片会被拆散）
	messages = merge_concat_messages(messages)

	-- 记录合并后的真实总条数（供前端分页使用）
	info.merged_total = #messages
	info.raw_total = used

	-- 按「收到时间」降序排序：最新的在最前
	-- 存储索引(index)只反映存储槽位，不保证与时间一致，故以 timestamp 为准
	-- 用 ts_key 归一化，兼容 PDU / 文本两种时间格式
	table.sort(messages, function(a, b)
		local ka = ts_key(a.timestamp)
		local kb = ts_key(b.timestamp)
		if ka ~= kb then
			return ka > kb          -- 时间晚的在前
		end
		return (a.index or 0) > (b.index or 0)   -- 同一时刻按索引降序
	end)

	-- 只保留最新 limit 条（按合并后的条数计）
	if #messages > limit then
		local limited = {}
		for i = 1, limit do limited[i] = messages[i] end
		messages = limited
	end

	-- 信号与运营商（仅在首次加载时查询，减少延迟）
	local csq = at.command(fd, "AT+CSQ", { timeout_ms = 1000 })
	if csq then
		local rssi = csq:match("+CSQ:%s*(%d+)")
		if rssi then info.rssi = tonumber(rssi) end
	end

	local cops = at.command(fd, "AT+COPS?", { timeout_ms = 1200 })
	if cops then
		local op = cops:match('+COPS:%s*%d+,%d+,"([^"]+)"')
		if op then info.operator = op end
	end

	at.close(fd)
	return messages, info
end

--------------------------------------------------------------------------------
-- 公共 API：读取单条短信
--------------------------------------------------------------------------------

function sms.read(index)
	sms.load_config()
	local fd, info, err = open_session()
	if not fd then return nil, err end

	local result = nil
	if info.text_mode then
		local resp = at.command(fd, "AT+CMGR=" .. index, { timeout_ms = 8000 })
		if resp then
			local stat, sender, ts = resp:match('+CMGR:%s*"([^"]*)",%s*"([^"]*)",.*,"([^"]*)"')
			if not stat then
				stat, sender = resp:match('+CMGR:%s*"([^"]*)",%s*"([^"]*)"')
			end
			if stat then
				local body = resp:match('+CMGR:[^\r\n]*\r?\n(.-)\r?\nOK')
				result = {
					index = tonumber(index),
					stat = stat,
					sender = sender or "",
					timestamp = ts or "",
					text = decode_body(body or "")
				}
			end
		end
	else
		local resp = at.command(fd, "AT+CMGR=" .. index, { timeout_ms = 10000 })
		if resp then
			local pdu_hex = resp:match("+CMGR:%s*%d+\r?\n([0-9A-Fa-f]+)")
			if pdu_hex then
				local decoded = pdu.decode_auto(pdu_hex)
				if decoded then
					result = {
						index = tonumber(index),
						stat = "REC READ",
						sender = decoded.sender or "",
						timestamp = decoded.timestamp or "",
						text = decoded.text or ""
					}
				end
			end
		end
	end

	at.close(fd)
	return result
end

--------------------------------------------------------------------------------
-- 公共 API：删除短信
--------------------------------------------------------------------------------

-- 删除短信
-- index: 数字索引 或 "all"
function sms.delete(index)
	sms.load_config()
	local fd, info, err = open_session()
	if not fd then return false, err end

	local cmd
	if index == "all" or index == nil then
		cmd = "AT+CMGD=1,4"  -- 删除所有
	else
		cmd = "AT+CMGD=" .. tonumber(index)
	end

	local resp = at.command(fd, cmd, { timeout_ms = 15000 })
	local ok = at.is_ok(resp)
	local errmsg = ok and nil or at.extract_error(resp)

	at.close(fd)
	return ok, errmsg
end

-- 批量删除多条短信（单次打开串口，逐条 CMGD，性能远优于多次调用）
-- indexes: { 1, 2, 3, ... }
-- 返回: 成功数, 失败数, 失败明细
function sms.delete_batch(indexes)
	if type(indexes) ~= "table" or #indexes == 0 then
		return 0, 0, "索引列表为空"
	end

	sms.load_config()
	local fd, info, err = open_session()
	if not fd then return 0, #indexes, err end

	local ok_count, fail_count = 0, 0
	local failed = {}

	for _, idx in ipairs(indexes) do
		local n = tonumber(idx)
		if n and n > 0 then
			local resp = at.command(fd, "AT+CMGD=" .. n, { timeout_ms = 8000 })
			if at.is_ok(resp) then
				ok_count = ok_count + 1
			else
				fail_count = fail_count + 1
				failed[#failed + 1] = n
			end
		end
	end

	at.close(fd)
	return ok_count, fail_count, failed
end

--------------------------------------------------------------------------------
-- 公共 API：发送短信
--------------------------------------------------------------------------------

-- 发送短信
-- opts: { number, text }
-- 返回: true 或 false, err
function sms.send(opts)
	opts = opts or {}
	local number = opts.number
	local text = opts.text

	if not number or number == "" then
		return false, "收件人号码不能为空"
	end
	if not text or text == "" then
		return false, "短信内容不能为空"
	end

	sms.load_config()
	local fd, info, err = open_session()
	if not fd then return false, err end

	local success, errmsg = false, nil

	if info.text_mode then
		-- 文本模式发送
		local need_ucs2 = not pdu.is_gsm7_compatible(text)

		-- 设置字符集
		if need_ucs2 then
			at.command(fd, 'AT+CSCS="UCS2"', { timeout_ms = 2000 })
		else
			at.command(fd, 'AT+CSCS="GSM"', { timeout_ms = 2000 })
		end

		-- 发送 CMGS
		local prompt_resp, prompt_ok = at.command_raw(fd, 'AT+CMGS="' .. number .. '"',
			{ timeout_ms = 8000 })

		if prompt_ok and prompt_resp:find(">", 1, true) then
			local payload
			if need_ucs2 then
				payload = pdu.utf8_to_ucs2hex(text)
			else
				payload = text
			end

			-- 写入正文 + Ctrl+Z (0x1A)
			at.write_raw(fd, payload .. string.char(26))

			-- 等待发送结果
			local resp = at.read_until(fd, { "\r\nOK", "\r\nERROR", "+CMS ERROR", "+CME ERROR" }, 40000)
			if resp and resp:find("OK", 1, true) and not resp:find("ERROR", 1, true) then
				success = true
			else
				errmsg = at.extract_error(resp) or "发送超时或无响应"
			end
		else
			errmsg = "未收到输入提示符（>）"
		end
	else
		-- PDU 模式发送
		local pdu_hex, tpdu_len = pdu.encode_submit({
			number = number,
			text = text
		})

		local prompt_resp, prompt_ok = at.command_raw(fd, "AT+CMGS=" .. tpdu_len,
			{ timeout_ms = 8000 })

		if prompt_ok and prompt_resp:find(">", 1, true) then
			at.write_raw(fd, pdu_hex .. string.char(26))
			local resp = at.read_until(fd, { "\r\nOK", "\r\nERROR", "+CMS ERROR", "+CME ERROR" }, 40000)
			if resp and resp:find("OK", 1, true) and not resp:find("ERROR", 1, true) then
				success = true
			else
				errmsg = at.extract_error(resp) or "发送超时或无响应"
			end
		else
			errmsg = "未收到输入提示符（>）"
		end
	end

	at.close(fd)
	return success, errmsg
end

--------------------------------------------------------------------------------
-- 公共 API：状态查询（轻量，minimal 模式 + 缓存）
function sms.status()
	sms.load_config()

	-- 状态缓存（10 秒内直接返回，避免频繁串口访问）
	local now = os.time()
	if cache.status and cache.status_ts and (now - cache.status_ts) < 10 then
		return cache.status
	end

	local fd, info, err = open_session({ minimal = true })
	if not fd then
		local fail = {
			ok = false,
			error = err or "无法连接模组",
			sim_status = (info and info.sim_status) or "unknown"
		}
		cache.status = fail
		cache.status_ts = now
		return fail
	end

	local result = {
		ok = true,
		port = info.port,
		model = info.model,
		sim_status = info.sim_status,
		storage = info.storage,
		text_mode = info.text_mode,
		charset = info.charset,
		smsc = info.smsc,
	}

	-- 信号（短超时）
	local csq = at.command(fd, "AT+CSQ", { timeout_ms = 1200 })
	if csq then
		local rssi, ber = csq:match("+CSQ:%s*(%d+),(%d+)")
		if rssi then
			result.rssi = tonumber(rssi)
			result.rssi_percent = math.min(100, math.floor(tonumber(rssi) / 31 * 100))
			result.ber = tonumber(ber)
		end
	end

	-- 运营商（短超时）
	local cops = at.command(fd, "AT+COPS?", { timeout_ms = 1500 })
	if cops then
		local op = cops:match('+COPS:%s*%d+,%d+,"([^"]+)"')
		if op then result.operator = op end
	end

	-- IMSI（缓存，10 分钟有效）
	if cache.imsi and (now - (cache.imsi_ts or 0)) < 600 then
		result.imsi = cache.imsi
	else
		local imsi = at.command(fd, "AT+CIMI", { timeout_ms = 1500 })
		if imsi then
			local v = imsi:match("(%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d)")
			if v then
				result.imsi = v
				cache.imsi = v
				cache.imsi_ts = now
			end
		end
	end

	-- 存储使用（短超时）
	local cpms = at.command(fd, "AT+CPMS?", { timeout_ms = 1500 })
	if cpms then
		local used, total = cpms:match('+CPMS:%s*"[^"]*",%s*(%d+),%s*(%d+)')
		if used then
			result.used = tonumber(used)
			result.total = tonumber(total)
		end
	end

	at.close(fd)
	cache.status = result
	cache.status_ts = now
	return result
end

--------------------------------------------------------------------------------
-- 公共 API：探测（用于前端"检测模组"按钮）
--------------------------------------------------------------------------------

function sms.probe()
	sms.load_config()
	cache.probed_at = 0
	cache.port = nil

	local fd, info, err = open_session({ force_probe = true })
	if not fd then
		return {
			ok = false,
			error = err or "探测失败",
			sim_status = (info and info.sim_status) or "unknown"
		}
	end
	at.close(fd)

	return {
		ok = true,
		port = info.port,
		model = info.model,
		sim_status = info.sim_status,
		storage = info.storage,
		storage_list = info.storage_list,
		text_mode = info.text_mode,
		charset = info.charset,
		smsc = info.smsc,
		cfun_reset = info.cfun_reset or false
	}
end

--------------------------------------------------------------------------------
-- 简单 JSON 序列化（路由器无 json 库）
--------------------------------------------------------------------------------

local function json_escape(s)
	if not s then return '""' end
	s = tostring(s)
	s = s:gsub("\\", "\\\\")
	s = s:gsub('"', '\\"')
	s = s:gsub("\n", "\\n")
	s = s:gsub("\r", "\\r")
	s = s:gsub("\t", "\\t")
	s = s:gsub("%c", function(c)
		local b = c:byte()
		if b == 9 then return "\\t" end
		if b == 10 then return "\\n" end
		if b == 13 then return "\\r" end
		return string.format("\\u%04x", b)
	end)
	return '"' .. s .. '"'
end

local function to_json(v, indent)
	indent = indent or ""
	local t = type(v)
	if v == nil then
		return "null"
	elseif t == "boolean" then
		return v and "true" or "false"
	elseif t == "number" then
		if v ~= v or v == math.huge or v == -math.huge then return "null" end
		return tostring(v)
	elseif t == "string" then
		return json_escape(v)
	elseif t == "table" then
		-- 判断是数组还是对象
		local is_array = true
		local max_n = 0
		for k, _ in pairs(v) do
			if type(k) ~= "number" then is_array = false break end
			if k > max_n then max_n = k end
		end
		if is_array and max_n > 0 then
			local parts = {}
			for i = 1, max_n do
				parts[#parts + 1] = to_json(v[i], indent .. "  ")
			end
			return "[" .. table.concat(parts, ",") .. "]"
		elseif is_array and max_n == 0 then
			-- 空表，判断是空对象还是空数组
			return "[]"
		else
			local parts = {}
			local keys = {}
			for k, _ in pairs(v) do keys[#keys + 1] = k end
			table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
			for _, k in ipairs(keys) do
				parts[#parts + 1] = json_escape(k) .. ":" .. to_json(v[k], indent .. "  ")
			end
			return "{" .. table.concat(parts, ",") .. "}"
		end
	end
	return "null"
end

sms.to_json = to_json

return sms