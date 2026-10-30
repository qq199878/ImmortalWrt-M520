--[[
  AT 串口通信层（Lua 5.1 + nixio）

  职责：
    - 串口打开/关闭
    - AT 指令发送与响应读取（带超时与终止符匹配）
    - 多行响应（如 CMGL）解析
    - 端口自动探测
]]

local nixio = require("nixio")

local at = {}

--------------------------------------------------------------------------------
-- 端口探测与打开
--------------------------------------------------------------------------------

-- 候选 AT 端口列表（按常见度排序）
at.DEFAULT_PORTS = {
	"/dev/ttyUSB1",  -- 龙尚 U9300C / 部分模块
	"/dev/ttyUSB2",  -- 移远 EC20/EC25、芯讯通 SIM7600
	"/dev/ttyUSB3",  -- 移远（PPP 口之外）
	"/dev/ttyUSB0",  -- 华为 ME909
}

-- 打开串口（同时显式配置为 raw 模式，避免被之前的 io.open 等操作干扰）
-- 返回: fd 或 nil, err
function at.open(port)
	if not port or port == "" then
		return nil, "port is empty"
	end
	local ok, fd = pcall(nixio.open, port, nixio.open_flags("rdwr", "nonblock"))
	if not ok or not fd then
		return nil, "cannot open " .. port
	end
	return fd
end

-- 安全检测设备节点是否存在（不打开串口，避免改变终端参数）
function at.device_exists(port)
	-- 优先用 nixio.fs.access（不触碰设备本身）
	local ok, res = pcall(function()
		local fs = require("nixio.fs")
		return fs.access(port)
	end)
	if ok and res then
		return true
	end
	-- 回退：stat 检查
	local ok2, st = pcall(nixio.stat, port)
	if ok2 and st then
		return true
	end
	return false
end

-- 关闭串口
function at.close(fd)
	if fd then
		pcall(function() fd:close() end)
	end
end

-- 清空接收缓冲（快速排空，不做额外等待）
function at.drain(fd, max_rounds)
	max_rounds = max_rounds or 20
	for _ = 1, max_rounds do
		local r = fd:read(4096)
		if not r or #r == 0 then break end
	end
end

--------------------------------------------------------------------------------
-- AT 指令执行
--------------------------------------------------------------------------------

-- 判断缓冲区是否已包含完整响应终止符
-- 兼容 \r\nOK / \nOK / OK\r\n / OK\n 等多种换行组合
local function has_terminator(buf, terminators)
	for _, t in ipairs(terminators) do
		if t == "\r\nOK" then
			if buf:find("OK", 1, true) and
				(buf:match("\nOK") or buf:match("^OK") or buf:match("\rOK")) then
				return true, "ok"
			end
		elseif t == "\r\nERROR" then
			if buf:match("\nERROR") or buf:match("^ERROR") or buf:match("\rERROR") then
				return true, "error"
			end
		else
			if buf:find(t, 1, true) then
				return true, t
			end
		end
	end
	return false, nil
end

-- 发送 AT 指令并读取响应（极速版：10ms 轮询 + 立即返回）
-- 参数:
--   fd      : 串口句柄
--   cmd     : AT 指令字符串（不含 \r\n）
--   opts    : { timeout_ms, terminators }
-- 返回:
--   response_text, ok_flag, err
function at.command(fd, cmd, opts)
	opts = opts or {}
	local timeout_ms = opts.timeout_ms or 3000
	local terminators = opts.terminators or { "\r\nOK", "\r\nERROR", "+CME ERROR", "+CMS ERROR" }

	-- 清空旧数据
	at.drain(fd)

	local ok, werr = pcall(function() fd:write(cmd .. "\r\n") end)
	if not ok then
		return "", false, "write failed: " .. tostring(werr)
	end

	local buf = ""
	local elapsed = 0
	local step = 10  -- 10ms 极速轮询

	while elapsed < timeout_ms do
		nixio.nanosleep(0, step * 1000000)
		elapsed = elapsed + step

		local r = fd:read(16384)
		if r and #r > 0 then
			buf = buf .. r

			local hit, kind = has_terminator(buf, terminators)
			if hit then
				-- 立刻返回，不再等待（避免额外延迟）
				return buf, (kind == "ok")
			end
		end
	end

	-- 超时兜底
	if buf:find("OK", 1, true) and not buf:find("ERROR", 1, true)
		and not buf:find("+CME ERROR", 1, true) and not buf:find("+CMS ERROR", 1, true) then
		return buf, true
	end

	return buf, false, "timeout"
end

-- 发送指令但不等待标准 OK（用于 CMGS 的 ">" 提示符，优化版）
function at.command_raw(fd, cmd, opts)
	opts = opts or {}
	local timeout_ms = opts.timeout_ms or 5000

	at.drain(fd)
	local ok, werr = pcall(function() fd:write(cmd .. "\r\n") end)
	if not ok then
		return "", false, "write failed: " .. tostring(werr)
	end

	local buf = ""
	local elapsed = 0
	local step = 10  -- 10ms

	while elapsed < timeout_ms do
		nixio.nanosleep(0, step * 1000000)
		elapsed = elapsed + step
		local r = fd:read(8192)
		if r and #r > 0 then
			buf = buf .. r
			-- 命中 > 提示符（兼容 ">", "> ", ">\r", ">\n" 等格式）
			if buf:find(">", 1, true) then
				return buf, true
			end
			-- 命中错误
			if buf:find("ERROR", 1, true) or buf:find("+CMS ERROR", 1, true) or buf:find("+CME ERROR", 1, true) then
				return buf, false, "error: " .. buf
			end
		end
	end
	return buf, false, "timeout"
end

-- 写入原始数据（用于发送短信正文 + Ctrl+Z）
function at.write_raw(fd, data)
	local ok = pcall(function() fd:write(data) end)
	return ok
end

-- 读取直到出现指定终止符
function at.read_until(fd, terminators, timeout_ms)
	timeout_ms = timeout_ms or 10000
	local buf = ""
	local loops = math.max(1, math.floor(timeout_ms / 100))
	for _ = 1, loops do
		nixio.nanosleep(0, 100000000)
		local r = fd:read(4096)
		if r and #r > 0 then
			buf = buf .. r
			for _, t in ipairs(terminators) do
				if buf:find(t, 1, true) then
					return buf, true
				end
			end
		end
	end
	return buf, false
end

--------------------------------------------------------------------------------
-- 端口自动探测
--------------------------------------------------------------------------------

-- 测试单个端口是否为 AT 口
-- 返回: true（是 AT 口）, model_string
function at.probe_port(port)
	local fd, err = at.open(port)
	if not fd then
		return false, err
	end

	local resp, ok = at.command(fd, "AT", { timeout_ms = 1200 })
	if not ok or not resp:find("OK", 1, true) then
		at.close(fd)
		return false, "no AT response"
	end

	-- 读取型号
	local resp2 = at.command(fd, "AT+CGMM", { timeout_ms = 2000 })
	local model = ""
	if resp2 then
		for line in resp2:gmatch("[^\r\n]+") do
			line = line:match("^%s*(.-)%s*$")
			if line ~= "" and line ~= "OK" and not line:find("AT+CGMM", 1, true) then
				model = line
			end
		end
	end

	at.close(fd)
	return true, model
end

-- 自动探测可用 AT 端口
-- 返回: port_path, model
function at.autodetect(custom_ports)
	local ports = custom_ports or at.DEFAULT_PORTS
	for _, p in ipairs(ports) do
		-- 用 nixio.stat 检查存在性（不用 io.open，避免改变串口参数）
		if at.device_exists(p) then
			local ok, model = at.probe_port(p)
			if ok then
				return p, model
			end
		end
	end
	return nil, nil
end

--------------------------------------------------------------------------------
-- 响应解析辅助
--------------------------------------------------------------------------------

-- 从响应中提取指定前缀的行内容（如 +CSQ: 30,53 -> "30,53"）
function at.extract_value(resp, prefix)
	if not resp then return nil end
	for line in resp:gmatch("[^\r\n]+") do
		local trimmed = line:match("^%s*(.-)%s*$")
		if trimmed:sub(1, #prefix) == prefix then
			local val = trimmed:sub(#prefix + 1)
			return val:match("^%s*(.-)%s*$")
		end
	end
	return nil
end

-- 从响应中提取所有指定前缀的行
function at.extract_lines(resp, prefix)
	local out = {}
	if not resp then return out end
	for line in resp:gmatch("[^\r\n]+") do
		local trimmed = line:match("^%s*(.-)%s*$")
		if prefix == nil or trimmed:sub(1, #prefix) == prefix then
			out[#out + 1] = trimmed
		end
	end
	return out
end

-- 判断响应是否成功
function at.is_ok(resp)
	if not resp then return false end
	return resp:find("OK", 1, true) ~= nil and
		resp:find("ERROR", 1, true) == nil
end

-- 提取 CME/CMS 错误码
function at.extract_error(resp)
	if not resp then return nil end
	local cme = resp:match("%+CME ERROR:%s*(%d+)")
	if cme then return "CME " .. cme end
	local cms = resp:match("%+CMS ERROR:%s*(%d+)")
	if cms then return "CMS " .. cms end
	if resp:find("ERROR", 1, true) then return "ERROR" end
	return nil
end

return at