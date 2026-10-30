#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROUTER_IP="192.168.1.1"
ROUTER_PASS="YOUR_ROUTER_PASSWORD"
REMOTE_PATH="/www/luci-static/resources/view/firewall"

echo "=== 1. 回滚官方原版到路由器 ==="
sshpass -p "$ROUTER_PASS" ssh -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$ROUTER_IP "cat > $REMOTE_PATH/forwards.js" < "$DIR/forwards_orig.js"
sshpass -p "$ROUTER_PASS" ssh -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$ROUTER_IP "cat > $REMOTE_PATH/rules.js" < "$DIR/rules_orig.js"
sshpass -p "$ROUTER_PASS" ssh -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$ROUTER_IP "cat > $REMOTE_PATH/snats.js" < "$DIR/snats_orig.js"

echo "=== 2. 核验与清理缓存 ==="
sshpass -p "$ROUTER_PASS" ssh -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$ROUTER_IP "md5sum $REMOTE_PATH/forwards.js $REMOTE_PATH/rules.js $REMOTE_PATH/snats.js && rm -f /tmp/luci-indexcache* && echo '>>> ROLLBACK SUCCESS & CACHE CLEANED <<<'"