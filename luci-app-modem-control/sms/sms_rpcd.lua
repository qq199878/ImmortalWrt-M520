#!/usr/bin/lua
--[[
  rpcd 后端接口（供 LuCI 前端通过 ubus 调用）

  方法：
    status    - 查询模组与短信状态
    probe     - 重新探测模组（端口/存储/编码）
    list      - 读取短信列表
    read      - 读取单条短信
    delete    - 删除单条短信
    delete_all- 删除全部短信
    send      - 发送短信
    get_config- 读取短信配置
    set_config- 保存短信配置
]]

local sms = require("sms")

local ucode_mode = false
local has_ubus = pcall(function() return require("ubus") end)

--------------------------------------------------------------------------------
-- 输出 JSON
--------------------------------------------------------------------------------

local function out(tbl)
	io.write(sms.to_json(tbl))
	io.write("\n")
end

local function out_ok(data)
	local r = { ok = true }
	if data then
		for k, v in pairs(data) do r[k] = v end
	end
	out(r)
end

local function out_err(msg, extra)
	local r = { ok = false, error = msg or "unknown error" }
	if extra then
		for k, v in pairs(extra) do r[k] = v end
	end
	out(r)
end

--------------------------------------------------------------------------------
-- 参数解析（支持 ubus 传入的 table 或命令行参数）
--------------------------------------------------------------------------------

local function parse_args(arg_tbl)
	-- ubus 直接传 table
	if type(arg_tbl) == "table" then
		return arg_tbl
	end
	-- 命令行 JSON 字符串（简化解析，避免依赖 json 库）
	local t = {}
	if type(arg_tbl) == "string" and #arg_tbl > 2 then
		for k, v in arg_tbl:gmatch('"([%w_]+)"%s*:%s*"([^"]*)"') do
			t[k] = v
		end
		for k, v in arg_tbl:gmatch('"([%w_]+)"%s*:%s*(%d+)') do
			t[k] = tonumber(v)
		end
	end
	return t
end

--------------------------------------------------------------------------------
-- 各方法实现
--------------------------------------------------------------------------------

local methods = {}

function methods.status()
	local st = sms.status()
	out_ok(st)
end

function methods.probe()
	local p = sms.probe()
	out(p)
end

function methods.list(args)
	args = parse_args(args)
	local msgs, info = sms.list({
		filter = args.filter or "ALL",
		limit = tonumber(args.limit) or 100
	})
	if not msgs then
		out_err(info or "读取短信失败")
		return
	end
	out_ok({
		messages = msgs,
		count = #msgs,
		info = info
	})
end

function methods.read(args)
	args = parse_args(args)
	local idx = tonumber(args.index)
	if not idx then
		out_err("缺少 index 参数")
		return
	end
	local msg, err = sms.read(idx)
	if not msg then
		out_err(err or "读取失败")
		return
	end
	out_ok({ message = msg })
end

function methods.delete(args)
	args = parse_args(args)
	local idx = args.index
	if idx == nil or idx == "" then
		out_err("缺少 index 参数")
		return
	end
	local ok, err = sms.delete(idx)
	if ok then
		out_ok({ deleted = idx })
	else
		out_err(err or "删除失败")
	end
end

function methods.delete_all()
	local ok, err = sms.delete("all")
	if ok then
		out_ok({ deleted = "all" })
	else
		out_err(err or "删除失败")
	end
end

-- 批量删除：参数 indexes 为逗号分隔的索引串（如 "1,2,3"）
function methods.delete_batch(args)
	args = parse_args(args)
	local raw = args.indexes
	if not raw or raw == "" then
		out_err("缺少 indexes 参数")
		return
	end

	local indexes = {}
	for token in tostring(raw):gmatch("[^,%s]+") do
		local n = tonumber(token)
		if n and n > 0 then indexes[#indexes + 1] = n end
	end

	if #indexes == 0 then
		out_err("indexes 参数无效")
		return
	end

	local ok_count, fail_count, failed = sms.delete_batch(indexes)
	out_ok({
		ok_count = ok_count,
		fail_count = fail_count,
		failed = failed,
		total = #indexes
	})
end

function methods.send(args)
	args = parse_args(args)
	local number = args.number
	local text = args.text
	if not number or number == "" then
		out_err("收件人号码不能为空")
		return
	end
	if not text or text == "" then
		out_err("短信内容不能为空")
		return
	end
	local ok, err = sms.send({ number = number, text = text })
	if ok then
		out_ok({ sent = true, number = number })
	else
		out_err(err or "发送失败")
	end
end

function methods.get_config()
	sms.load_config()
	out_ok({ config = sms.config })
end

function methods.set_config(args)
	args = parse_args(args)
	local cfg = {}
	if args.port then cfg.port = args.port end
	if args.storage then cfg.storage = args.storage end
	if args.charset then cfg.charset = args.charset end
	if args.mode then cfg.mode = args.mode end
	sms.save_config(cfg)
	sms.load_config()
	out_ok({ config = sms.config })
end

--------------------------------------------------------------------------------
-- 入口
--------------------------------------------------------------------------------

-- rpcd 调用模式：环境变量或参数传入方法名
local method_name = arg and arg[1]
local arg_json = arg and arg[2]

-- rpcd exec 模式：读取 stdin 的 JSON
if not method_name then
	local stdin_data = io.read("*a") or ""
	-- 尝试解析 {"method":"xxx", ...}
	method_name = stdin_data:match('"method"%s*:%s*"([%w_]+)"')
	if method_name then
		arg_json = stdin_data
	end
end

if not method_name or not methods[method_name] then
	out_err("unknown method: " .. tostring(method_name))
	os.exit(1)
end

local ok, err = pcall(methods[method_name], arg_json)
if not ok then
	out_err("internal error: " .. tostring(err))
	os.exit(1)
end

os.exit(0)