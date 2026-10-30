#!/bin/sh
# 备份 + 实测 Cloudflare 是否接受黑洞地址

TS=$(date +%Y%m%d_%H%M%S)
BK="/root/cfddns_bak_$TS"
mkdir -p "$BK"
cp -f /usr/share/rpcd/ucode/cfddns.uc "$BK/" 2>/dev/null
cp -f /www/luci-static/resources/view/cfddns.js "$BK/" 2>/dev/null
cp -f /etc/ddns-cf.sh "$BK/" 2>/dev/null
cp -f /usr/share/rpcd/acl.d/luci-app-cfddns.json "$BK/" 2>/dev/null
cp -f /etc/cfddns.conf "$BK/" 2>/dev/null
chmod 600 "$BK/cfddns.conf" 2>/dev/null
echo "===BACKUP==="
echo "dir=$BK"
ls -l "$BK"

ZONE='YOUR_ZONE_ID'
ZNAME='example.com'

for IP in 0.0.0.0 192.0.2.1; do
	echo ""
	echo "===TEST $IP==="
	R=$(ubus call luci.cfddns add_record "{\"zone_id\":\"$ZONE\",\"zone_name\":\"$ZNAME\",\"type\":\"A\",\"name\":\"__offtest\",\"content\":\"$IP\",\"ttl\":120,\"proxied\":false,\"set_target\":false}")
	echo "$R"
	ID=$(echo "$R" | jsonfilter -e '$.id' 2>/dev/null)
	if [ -n "$ID" ]; then
		ubus call luci.cfddns del_record "{\"zone_id\":\"$ZONE\",\"rec_id\":\"$ID\"}" >/dev/null 2>&1
		echo "  RESULT: accepted, test record cleaned"
	else
		echo "  RESULT: rejected"
	fi
done

echo ""
echo "===ENSURE_CLEAN==="
ubus call luci.cfddns list_records "{\"zone_id\":\"$ZONE\"}" 2>/dev/null | grep -c '__offtest'