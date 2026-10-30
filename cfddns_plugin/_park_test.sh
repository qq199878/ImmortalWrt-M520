#!/bin/sh
# 停靠地址功能验收
DOM='home.example.com'

sv() {
	ubus call luci.cfddns set_park_ip "{\"ip\":\"$1\"}" | tr -d '\n\t '
}

getip() {
	ubus call luci.cfddns status '{"force":true}' 2>/dev/null | grep '"cf_ip"' | head -1 | sed 's/.*: "//; s/".*//'
}

echo "=== 1. 设置为默认值 127.0.0.1 ==="
sv '127.0.0.1'
echo ""
echo -n "  配置: "; grep '^PARKED_IP' /etc/cfddns.conf

echo ""
echo "=== 2. 非法输入应被拒 ==="
echo -n "  256.1.1.1  -> "; sv '256.1.1.1'; echo ""
echo -n "  abc        -> "; sv 'abc'; echo ""
echo -n "  空         -> "; sv ''; echo ""

echo ""
echo "=== 3. 运行态改地址：只存不生效 ==="
sv '10.0.0.1'
echo ""
echo -n "  线上记录: "; getip
echo "  (运行态下应保持真实 IP)"

echo ""
echo "=== 4. 恢复 127.0.0.1 后关闭插件 ==="
sv '127.0.0.1' >/dev/null
ubus call luci.cfddns set_enabled '{"enabled":false}' | tr -d '\n\t ' | head -c 160
echo ""
echo -n "  线上记录: "; getip
echo "  (应为 127.0.0.1)"

echo ""
echo "=== 5. 关闭态下改地址应立即生效 ==="
sv '192.0.2.1'
echo ""
echo -n "  线上记录: "; getip
echo "  (应为 192.0.2.1)"

echo ""
echo "=== 6. 再改回 127.0.0.1 ==="
sv '127.0.0.1'
echo ""
echo -n "  线上记录: "; getip

echo ""
echo "=== 7. 重新启用，域名应恢复真实 IP ==="
ubus call luci.cfddns set_enabled '{"enabled":true}' | tr -d '\n\t ' | head -c 200
echo ""
sleep 2
echo -n "  线上记录: "; getip
echo -n "  公网 DNS: "; nslookup "$DOM" 1.1.1.1 2>/dev/null | grep -A1 "Name:" | grep Address | tail -1

echo ""
echo "=== 8. 最终状态 ==="
grep -E '^(ENABLED|PARKED_IP)=' /etc/cfddns.conf
grep ddns-cf /etc/crontabs/root | head -1
ubus call luci.cfddns status_quick | grep -E '"park_ip"|"enabled"' | head -2