-- 长短信（UDH 拼接）单元测试
-- 用真机实测的两条分片 PDU 验证解码与拼接

package.path = "/storage/emulated/0/Download/路由器520/luci-app-modem-control/sms/?.lua;" .. package.path

local pdu = require "pdu"

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

-- ===== 1. 真机 PDU 分片解码 =====
-- 索引 38（第 1 片，seq=1）
local pdu_a = "0891683110808805F04405A10110F00008122071819485238C050003B4020130105E7F4E1C77015E9460257BA174065385300177016D889632655163F4603B961F301163D0919260A8FF1A753552A881EA884C8F664E2579818FDD89C451457535FF1B751F4EA77ECF84256027573A62404E2579818FDD89C44F4F4EBAFF1B5C454F4F7C7B573A6240505A597D6D8896325B895168201C4E0967E54E096E0556DB5173201D"
-- 索引 37（第 2 片，seq=2）
local pdu_b = "0891683110808805F04405A10110F000081220718194852354050003B40202FF0C5373FF1A67E5753556683001901A90533001706B6E90FF0C6E058D7090533001963353F0300153A8623FFF0C79BB5F0065F6517375356E903001706B6E9030016C146E90300195E87A973002"

local a, err_a = pdu.decode_auto(pdu_a)
local b, err_b = pdu.decode_auto(pdu_b)

check("第1片解码成功", a ~= nil, err_a)
check("第2片解码成功", b ~= nil, err_b)

if a then
	check("第1片 UDHI=1", a.udhi == true, tostring(a.udhi))
	check("第1片 concat 非空", a.concat ~= nil, "concat=" .. tostring(a.concat))
	if a.concat then
		check("第1片 ref=0xB4(180)", a.concat.ref == 180, "ref=" .. tostring(a.concat.ref))
		check("第1片 total=2", a.concat.total == 2, "total=" .. tostring(a.concat.total))
		check("第1片 seq=1", a.concat.seq == 1, "seq=" .. tostring(a.concat.seq))
	end
	check("第1片 发送方=10010", a.sender == "10010", a.sender)
	check("第1片 时间戳=2021/02/17 18:49:58",
		a.timestamp == "2021-02-17 18:49:58", a.timestamp)
	check("第1片 正文以【开头", a.text:sub(1, 3) == "【", a.text:sub(1, 20))
	print("  第1片正文: " .. a.text)
end

if b then
	check("第2片 UDHI=1", b.udhi == true, tostring(b.udhi))
	if b.concat then
		check("第2片 ref=0xB4(180)", b.concat.ref == 180, "ref=" .. tostring(b.concat.ref))
		check("第2片 total=2", b.concat.total == 2, "total=" .. tostring(b.concat.total))
		check("第2片 seq=2", b.concat.seq == 2, "seq=" .. tostring(b.concat.seq))
	end
	check("第2片 发送方=10010", b.sender == "10010", b.sender)
	print("  第2片正文: " .. b.text)
end

-- ===== 2. 拼接后完整性 =====
if a and b then
	local merged = a.text .. b.text
	check("拼接后以【开头", merged:sub(1, 3) == "【")
	check("拼接后含「广东省应急管理厅」", merged:find("广东省应急管理厅", 1, true) ~= nil)
	check("拼接后含「电动自行车」", merged:find("电动自行车", 1, true) ~= nil)
	check("拼接后以「。」结尾", merged:sub(-3) == "。")
	print("  拼接全文（" .. #merged .. " 字符）:")
	print("  " .. merged)
end

-- ===== 3. 无 UDH 短信不受影响 =====
local pdu_plain = "0891683110808805F0040BA10110F00008122071819485230A00610067006C002067E58BE28BE660C53002"
local c = pdu.decode_auto(pdu_plain)
check("普通短信解码成功", c ~= nil)
if c then
	check("普通短信 UDHI=0", c.udhi == false, tostring(c.udhi))
	check("普通短信 concat=nil", c.concat == nil, tostring(c.concat))
	print("  普通短信正文: " .. (c.text or ""))
end

print(string.format("\n===== 结果: %d 通过, %d 失败 =====", pass, fail))
os.exit(fail == 0 and 0 or 1)