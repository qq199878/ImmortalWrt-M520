-- ts_key 时间归一化单元测试
-- 验证 PDU 格式与文本模式格式可正确比较

local pass, fail = 0, 0
local function check(name, cond, extra)
	if cond then
		pass = pass + 1
		print(string.format("[PASS] %s", name))
	else
		fail = fail + 1
		print(string.format("[FAIL] %s  %s", name, tostring(extra or "")))
	end
end

-- 与 sms.lua 中保持一致的实现
local function ts_key(ts)
	if not ts or ts == "" then return "00000000000000" end
	local y, mo, d, h, mi, s = ts:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)[ T](%d%d):(%d%d):?(%d*)")
	if y then
		return y .. mo .. d .. h .. mi .. (s ~= "" and s or "00")
	end
	local yy, m2, d2, h2, mi2, s2 = ts:match("^(%d%d)/(%d%d)/(%d%d),(%d%d):(%d%d):?(%d*)")
	if yy then
		local ynum = tonumber(yy) or 0
		local year = ynum >= 90 and (1900 + ynum) or (2000 + ynum)
		return tostring(year) .. m2 .. d2 .. h2 .. mi2 .. (s2 ~= "" and s2 or "00")
	end
	return ts
end

print("=== 1. 格式解析 ===")
check("PDU 格式", ts_key("2021-02-17 18:49:58") == "20210217184958", ts_key("2021-02-17 18:49:58"))
check("文本格式", ts_key("21/02/17,18:49:58+32") == "20210217184958", ts_key("21/02/17,18:49:58+32"))
check("两格式一致",
	ts_key("2021-02-17 18:49:58") == ts_key("21/02/17,18:49:58+32"),
	ts_key("2021-02-17 18:49:58") .. " vs " .. ts_key("21/02/17,18:49:58+32"))
check("空值兜底", ts_key("") == "00000000000000", ts_key(""))
check("nil 兜底", ts_key(nil) == "00000000000000", ts_key(nil))
check("无秒补00", ts_key("2021-02-17 18:49") == "20210217184900", ts_key("2021-02-17 18:49"))

print("\n=== 2. 跨年边界（90 年分界） ===")
check("99年 -> 1999", ts_key("99/12/31,23:59:59+32") == "19991231235959", ts_key("99/12/31,23:59:59+32"))
check("00年 -> 2000", ts_key("00/01/01,00:00:00+32") == "20000101000000", ts_key("00/01/01,00:00:00+32"))
check("89年 -> 2089", ts_key("89/01/01,00:00:00+32") == "20890101000000", ts_key("89/01/01,00:00:00+32"))

print("\n=== 3. 排序验证（模拟真实数据） ===")
-- 真实短信：注意 index 顺序与时间顺序不一致
local msgs = {
	{ index = 38, timestamp = "2021-02-17 18:49:58", text = "应急管理厅第1片" },
	{ index = 37, timestamp = "2021-02-17 18:49:58", text = "应急管理厅第2片" },
	{ index = 36, timestamp = "2021-02-17 11:37:12", text = "交通运输厅" },
	{ index = 35, timestamp = "2021-02-17 11:28:05", text = "市场监管局" },
	{ index = 34, timestamp = "2021-02-12 14:38:54", text = "预付优惠" },
	{ index = 33, timestamp = "2021-02-12 14:38:54", text = "市场监管局消委会" },
	{ index = 32, timestamp = "2021-02-12 13:20:21", text = "腾讯视频会员" },
}

table.sort(msgs, function(a, b)
	local ka = ts_key(a.timestamp)
	local kb = ts_key(b.timestamp)
	if ka ~= kb then return ka > kb end
	return (a.index or 0) > (b.index or 0)
end)

print("  排序结果（时间倒序）:")
for i, m in ipairs(msgs) do
	print(string.format("   %d. [idx=%d] %s  %s", i, m.index, m.timestamp, m.text))
end

check("第1条是最新时间", msgs[1].timestamp == "2021-02-17 18:49:58", msgs[1].timestamp)
check("最后1条是最早时间", msgs[#msgs].timestamp == "2021-02-12 13:20:21", msgs[#msgs].timestamp)
check("时间严格递减", (function()
	for i = 2, #msgs do
		if ts_key(msgs[i - 1].timestamp) < ts_key(msgs[i].timestamp) then return false end
	end
	return true
end)())

print("\n=== 4. 乱序输入验证 ===")
local shuffled = {
	{ index = 5, timestamp = "2021-02-12 13:20:21" },
	{ index = 40, timestamp = "2021-02-17 18:49:58" },
	{ index = 12, timestamp = "2021-02-10 20:21:04" },
	{ index = 1, timestamp = "2020-12-04 12:20:20" },
}
table.sort(shuffled, function(a, b)
	local ka, kb = ts_key(a.timestamp), ts_key(b.timestamp)
	if ka ~= kb then return ka > kb end
	return (a.index or 0) > (b.index or 0)
end)
check("乱序排序第1条=2021-02-17", shuffled[1].timestamp == "2021-02-17 18:49:58", shuffled[1].timestamp)
check("乱序排序最后=2020-12-04", shuffled[#shuffled].timestamp == "2020-12-04 12:20:20", shuffled[#shuffled].timestamp)
for i, m in ipairs(shuffled) do
	print(string.format("   %d. [idx=%d] %s", i, m.index, m.timestamp))
end

print(string.format("\n===== 结果: %d 通过, %d 失败 =====", pass, fail))
os.exit(fail == 0 and 0 or 1)