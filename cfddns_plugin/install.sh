#!/bin/sh
# =====================================================================
# Cloudflare DDNS 插件 - 安装脚本（在路由器上执行）
# 用法： sh install.sh
# =====================================================================
set -u

SRC=$(cd "$(dirname "$0")" && pwd)

echo "=== 1. 备份 ==="
BAK=/root/cfddns_bak_$(date +%Y%m%d_%H%M%S)
mkdir -p "$BAK"
for f in /etc/cfddns.conf \
         /etc/ddns-cf.sh \
         /usr/share/rpcd/ucode/cfddns.uc \
         /usr/share/luci/menu.d/luci-app-cfddns.json \
         /usr/share/rpcd/acl.d/luci-app-cfddns.json \
         /www/luci-static/resources/view/cfddns.js; do
    [ -f "$f" ] && cp "$f" "$BAK/" && echo "  backed: $f"
done
echo "  备份目录: $BAK"

echo "=== 2. 安装配置文件 ==="
cp "$SRC/cfddns.conf" /etc/cfddns.conf
chmod 600 /etc/cfddns.conf
echo "  /etc/cfddns.conf  (600)"

echo "=== 3. 安装同步脚本 ==="
cp "$SRC/ddns-cf.sh" /etc/ddns-cf.sh
chmod 755 /etc/ddns-cf.sh
echo "  /etc/ddns-cf.sh  (755)"

echo "=== 4. 安装 rpcd 后端 ==="
mkdir -p /usr/share/rpcd/ucode
cp "$SRC/cfddns.uc" /usr/share/rpcd/ucode/cfddns.uc
chmod 644 /usr/share/rpcd/ucode/cfddns.uc
echo "  /usr/share/rpcd/ucode/cfddns.uc"

echo "=== 5. 安装菜单 ==="
mkdir -p /usr/share/luci/menu.d
cp "$SRC/cfddns.json" /usr/share/luci/menu.d/luci-app-cfddns.json
chmod 644 /usr/share/luci/menu.d/luci-app-cfddns.json
echo "  /usr/share/luci/menu.d/luci-app-cfddns.json"

echo "=== 6. 安装 ACL ==="
mkdir -p /usr/share/rpcd/acl.d
cp "$SRC/luci-app-cfddns.json" /usr/share/rpcd/acl.d/luci-app-cfddns.json
chmod 644 /usr/share/rpcd/acl.d/luci-app-cfddns.json
echo "  /usr/share/rpcd/acl.d/luci-app-cfddns.json"

echo "=== 7. 安装前端页面 ==="
mkdir -p /www/luci-static/resources/view
cp "$SRC/cfddns.js" /www/luci-static/resources/view/cfddns.js
chmod 644 /www/luci-static/resources/view/cfddns.js
echo "  /www/luci-static/resources/view/cfddns.js"

echo "=== 8. 重启服务 ==="
/etc/init.d/rpcd restart >/dev/null 2>&1 && echo "  rpcd restarted"
rm -f /tmp/luci-indexcache* 2>/dev/null
/etc/init.d/uwsgi restart >/dev/null 2>&1
/etc/init.d/nginx  restart >/dev/null 2>&1
sleep 2

echo "=== 9. 验证 ==="
echo "--- 配置 ---"
ls -l /etc/cfddns.conf /etc/ddns-cf.sh
echo "--- 探测公网 IP ---"
/etc/ddns-cf.sh --probe 2>/dev/null
echo "--- ubus 方法 ---"
ubus -v list luci.cfddns 2>&1 | head -10
echo "--- 菜单注册 ---"
ls -l /usr/share/luci/menu.d/luci-app-cfddns.json

echo ""
echo "=== 安装完成 ==="
echo "访问路径： 服务 -> Cloudflare 动态域名"
echo "日志：     /tmp/cfddns.log"
echo "备份：     $BAK"