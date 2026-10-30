#!/bin/sh
# 总开关最终验收（含边界情况）
ZONE='YOUR_ZONE_ID'
DOM='home.example.com'

getip() {
	ubus call luci.cfddns status '{"force":true}' 2>/dev/null | grep '"cf_ip"' | head -1 | sed 's/.*: "//; s/".*//'
}

echo "=== 1. 重复关闭（幂等性）==="
ubus call luci.cfddns set_enabled '{"enabled":false}' | tr -d '\n\t '
echo ""
echo -n "  再关一次 -> "
ubus call luci.cfddns set_enabled '{"enabled":false}' | tr -d '\n\t ' | head -c 120
echo ""

echo ""
echo "=== 2. 关闭态下 cron 是否真被注释 ==="
grep ddns-cf /etc/crontabs/root | head -1
echo -n "  记录 IP: "
getip

echo ""
echo "=== 3. 关闭态下 DDNS 脚本拒绝执行 ==="
/etc/ddns-cf.sh >/dev/null 2>&1; echo "  sync=$? (期望6)"
/etc/ddns-cf.sh --status >/dev/null 2>&1; echo "  status=$? (期望0，只读放行)"

echo ""
echo "=== 4. 关闭态下重启 cron 服务，记录应保持不变 ==="
/etc/init.d/cron restart >/dev/null 2>&1
sleep 2
echo -n "  记录 IP: "
getip

echo ""
echo "=== 5. 重新启用 ==="
ubus call luci.cfddns set_enabled '{"enabled":true}' | tr -d '\n\t ' | head -c 200
echo ""

echo ""
echo "=== 6. 启用后 DNS 恢复 ==="
sleep 2
echo -n "  记录 IP: "
getip
echo -n "  公网 DNS: "
nslookup "$DOM" 1.1.1.1 2>/dev/null | grep -A1 "Name:" | grep Address | tail -1

echo ""
echo "=== 7. 重复启用（幂等性）==="
echo -n "  再开一次 -> "
ubus call luci.cfddns set_enabled '{"enabled":true}' | tr -d '\n\t ' | head -c 120
echo ""

echo ""
echo "=== 8. 最终状态 ==="
grep '^ENABLED=' /etc/cfddns.conf
grep ddns-cf /etc/crontabs/root | head -1
echo -n "  DNS: "
nslookup "$DOM" 1.1.1.1 2>/dev/null | grep -A1 "Name:" | grep Address | tail -1