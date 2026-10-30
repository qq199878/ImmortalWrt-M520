module("luci.controller.lucky", package.seeall)

-- 缓存文件路径与有效期（秒）
local CACHE_FILE = "/tmp/lucky_info_cache.json"
local CACHE_TTL  = 60
local LOCK_FILE  = "/tmp/lucky_info_cache.lock"

function index()
	if not nixio.fs.access("/etc/config/lucky") then
		return
	end
	entry({"admin", "services", "lucky"}, alias("admin", "services", "lucky", "setting"), _("Lucky"), 57).dependent = true
	entry({"admin", "services", "lucky", "setting"}, cbi("lucky/lucky"), _("基本设置"), 20).leaf = true
	entry({"admin", "services", "lucky_status"}, call("act_status"))
	entry({"admin", "services", "lucky_info"}, call("lucky_info"))
	entry({"admin", "services", "lucky_set_config"}, call("lucky_set_config"))
	entry({"admin", "services", "lucky_service"}, call("lucky_service"))
	-- 手动刷新缓存
	entry({"admin", "services", "lucky_refresh"}, call("lucky_refresh"))
end

function act_status()
	local e = {}
	e.running = luci.sys.call("pgrep -f 'lucky -c' >/dev/null") == 0
	luci.http.prepare_content("application/json")
	luci.http.write_json(e)
end

-- 读取缓存，返回 table 或 nil
local function read_cache()
	local f = io.open(CACHE_FILE, "r")
	if not f then return nil end
	local raw = f:read("*a")
	f:close()
	if not raw or raw == "" then return nil end

	local ok, obj = pcall(luci.jsonc.parse, raw)
	if not ok or type(obj) ~= "table" then return nil end

	-- 检查是否过期
	local ts = tonumber(obj._ts or 0) or 0
	if os.time() - ts > CACHE_TTL then
		return obj, true  -- 返回过期数据，调用方可决定是否刷新
	end
	return obj, false
end

-- 后台刷新缓存（不阻塞请求）
-- 实际工作交给独立 shell 脚本，Lua 只负责触发
local function refresh_cache_bg()
	-- 简单锁：避免并发重复刷新
	local lf = io.open(LOCK_FILE, "r")
	if lf then
		local t = tonumber(lf:read("*a") or "0") or 0
		lf:close()
		if os.time() - t < 8 then
			return  -- 8 秒内已有人刷新
		end
	end
	local wf = io.open(LOCK_FILE, "w")
	if wf then wf:write(tostring(os.time())) wf:close() end

	os.execute("/usr/bin/lucky-info-cache.sh >/dev/null 2>&1 &")
end

function lucky_info()
	local e = {}
	local cache, expired = read_cache()

	if not cache then
		-- 无缓存：同步生成一次（首次约 7 秒），之后全部走缓存
		luci.sys.call("/usr/bin/lucky-info-cache.sh >/dev/null 2>&1")
		cache = read_cache()
	end

	if cache then
		-- 关键：前端用 JSON.parse(info.luckyInfo) 解析，必须返回字符串
		local li = cache.luckyInfo
		if type(li) == "table" then
			e.luckyInfo = luci.jsonc.stringify(li)
		elseif type(li) == "string" then
			e.luckyInfo = li
		else
			e.luckyInfo = ""
		end
		e.luckyArch = cache.luckyArch or "armv7"
		if type(cache.conf) == "table" and type(cache.conf.BaseConfigure) == "table" then
			e.LuckyBaseConfigure = cache.conf.BaseConfigure
		end
		if expired then
			refresh_cache_bg()
		end
	else
		-- 缓存生成彻底失败
		e.luckyInfo = ""
		e.luckyArch = "armv7"
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(e)
end

-- 强制刷新（供前端调用）
function lucky_refresh()
	nixio.fs.remove(LOCK_FILE)
	nixio.fs.remove(CACHE_FILE)
	refresh_cache_bg()
	luci.http.prepare_content("application/json")
	luci.http.write_json({ ret = 0 })
end

function lucky_set_config()
	local key = luci.http.formvalue("key")
	local value = luci.http.formvalue("value")
	local e = { ret = 1 }
	if (key == "admin_http_port") then
		e.ret = setLuckyConf("AdminWebListenPort", value)
	end
	if (key == "admin_safe_url") then
		e.ret = setLuckyConf("SetSafeURL", value)
	end
	if (key == "reset_auth_info") then
		setLuckyConf("AdminAccount", "666")
		setLuckyConf("AdminPassword", "666")
		luci.sys.exec("/etc/init.d/lucky restart")
		e.ret = 0
	end
	if (key == "switch_Internetaccess") then
		e.ret = setLuckyConf("AllowInternetaccess", value)
	end
	-- 配置变更后清缓存
	nixio.fs.remove(CACHE_FILE)
	luci.http.prepare_content("application/json")
	luci.http.write_json(e)
end

function lucky_service()
	local action = luci.http.formvalue("action")
	if (action == "restart") then
		luci.sys.exec("uci set lucky.@lucky[0].enabled=1")
		luci.sys.exec("uci commit")
		luci.sys.exec("/etc/init.d/lucky restart")
	end
	if (action == "start") then
		luci.sys.exec("uci set lucky.@lucky[0].enabled=1")
		luci.sys.exec("uci commit")
		luci.sys.exec("/etc/init.d/lucky start")
	end
	if (action == "stop") then
		luci.sys.exec("uci set lucky.@lucky[0].enabled=0")
		luci.sys.exec("uci commit")
		luci.sys.exec("/etc/init.d/lucky stop")
	end
	-- 服务状态变化后清缓存
	nixio.fs.remove(CACHE_FILE)
end

function trim(s)
	return (string.gsub(s, "^%s*(.-)%s*$", "%1"))
end

function GetLuckyConfigureObj()
	local configPath = trim(luci.sys.exec("uci get lucky.@lucky[0].configdir"))
	local configContent = luci.sys.exec("lucky -baseConfInfo -cd " .. configPath)
	return luci.jsonc.parse(trim(configContent))
end

function setLuckyConf(key, value)
	local configPath = trim(luci.sys.exec("uci get lucky.@lucky[0].configdir"))
	local cmd = "/usr/bin/lucky -setconf -key " .. key .. " -value " .. value .. " -cd " .. configPath
	if (value == "") then
		cmd = "/usr/bin/lucky -setconf -key " .. key .. " -cd " .. configPath
	end
	luci.sys.exec(cmd)
	return 0
end