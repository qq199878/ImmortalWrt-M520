#!/bin/sh
# 总开关实测：关闭 → 验证 → 开启 → 验证

ZONE='YOUR_ZONE_ID'
DOM='home.example.com'

show() {
	echo "--- $1 ---"
	echo -n "  cron:    "
	grep ddns-cf /etc/crontabs/root 2>/dev/null | head -1
	echo -n "  ENABLED: "
	grep '^ENABLED=' /etc/cfddns.conf 2>/dev/null || echo '(无此字段=启用)'
	echo -n "  CF记录:  "
	ubus call luci.cfddns list_records "{\"zone_id\":\"$ZONE\"}" 2>/dev/null | \
		grep -A3 "\"$DOM\"" | grep -E '\"content\"' | head -1
}

echo "=========== 关闭前 ==========="
show "before"

echo ""
echo "=========== 执行关闭 ==========="
ubus call luci.cfddns set_enabled '{"enabled":false}'

echo ""
echo "=========== 关闭后 ==========="
show "after-disable"

echo ""
echo "--- 关闭态：写操作应被拒绝 ---"
echo -n "  run_now      -> "
ubus call luci.cfddns run_now 2>&1 | tr -d '\n\t ' | head -c 100; echo ""
echo -n "  set_interval -> "
ubus call luci.cfddns set_interval '{"enabled":true,"minutes":10}' 2>&1 | tr -d '\n\t ' | head -c 100; echo ""
echo -n "  add_record   -> "
ubus call luci.cfddns add_record "{\"zone_id\":\"$ZONE\",\"zone_name\":\"example.com\",\"type\":\"A\",\"name\":\"zz\",\"content\":\"1.2.3.4\",\"ttl\":120,\"proxied\":false,\"set_target\":false}" 2>&1 | tr -d '\n\t ' | head -c 100; echo ""

echo ""
echo "--- 关闭态：只读操作应放行 ---"
echo -n "  status_quick -> "
ubus call luci.cfddns status_quick 2>&1 | grep -c '"quick"'; 
echo -n "  get_config   -> "
ubus call luci.cfddns get_config 2>&1 | grep -c '"domain"'
echo -n "  list_zones   -> "
ubus call luci.cfddns list_zones 2>&1 | tr -d '\n\t ' | head -c 60; echo ""

echo ""
echo "--- 关闭态：脚本应拒绝执行（exit 6）---"
/etc/ddns-cf.sh >/dev/null 2>&1
echo "  sync exit=$? (期望 6)"
/etc/ddns-cf.sh --probe >/dev/null 2>&1
echo "  probe exit=$? (期望 6)"

echo ""
echo "--- 关掉 cron 后等 3 秒确认记录没被改回 ---"
sleep 3
show "after-3s"

echo ""
echo "=========== 重新开启 ==========="
ubus call luci.cfddns set_enabled '{"enabled":true}'

echo ""
echo "=========== 开启后 ==========="
show "after-enable"

echo ""
echo "--- 开启态：DNS 应恢复真实 IP ---"
sleep 2
nslookup "$DOM" 1.1.1.1 2>/dev/null | grep -E "Address" | tail -1

echo ""
echo "=========== 收尾核对 ==========="
echo -n "  ENABLED: "
grep '^ENABLED=' /etc/cfddns.conf
echo -n "  cron:    "
grep ddns-cf /etc/crontabs/root | head -1