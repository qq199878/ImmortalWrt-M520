#!/bin/sh
# ============================================================
# chnroute ipset 开机恢复脚本
# 部署路径：/etc/chinadns-ng/ipset-init.sh
# 调用方：/etc/rc.local（开机执行一次）
#
# 背景：chinadns-ng 用 ipset 的 chnroute/chnroute6 做「IP 归属地判真」，
#       但 ipset 是内存态，重启即丢。丢了以后：
#         1. 日志每几秒刷 "test_res_ipset error ... No such file or directory"
#         2. 国内域名可能被误判为国外 → 走 trust-dns → 拿到污染结果
#       本脚本负责每次开机把 chnroute / chnroute6 重建并灌入数据。
#
# 注意启动顺序：chinadns-standalone 是 S19 启动，rc.local 在 S95 才跑。
#   所以开机瞬间 chinadns-ng 起来时 ipset 还不存在，会先报几行错；
#   本脚本灌完数据后会主动 restart 一次，让 chinadns-ng 重新读取 ipset。
# ============================================================

set -u

RULES_DIR=/usr/share/passwall/rules
CHN4="$RULES_DIR/chnroute"
CHN6="$RULES_DIR/chnroute6"
LOG_TAG=ipset-init
MIN_ENTRIES=100

log() { logger -t "$LOG_TAG" "$*"; }

# ---------- 前置检查 ----------
command -v ipset >/dev/null 2>&1 || { log "ipset 命令不存在，跳过"; exit 0; }
[ -f "$CHN4" ] || { log "规则文件 $CHN4 不存在，跳过"; exit 0; }

# ---------- 取成员条数（只认 Number of entries 行，避免统计到头部） ----------
count_set() {
    ipset list "$1" 2>/dev/null | awk '/^Number of entries:/{print $4; found=1} END{if(!found) print 0}'
}

NEED_RESTART=0

# ---------- IPv4 ----------
CNT=$(count_set chnroute)
if [ "${CNT:-0}" -lt "$MIN_ENTRIES" ]; then
    ipset create chnroute hash:net -exist 2>/dev/null
    awk 'BEGIN{print "create chnroute hash:net -exist"}
         !/^#/ && NF {print "add chnroute " $0}' "$CHN4" \
        | ipset restore -exist 2>/dev/null
    CNT=$(count_set chnroute)
    log "chnroute 已导入 $CNT 条"
    NEED_RESTART=1
else
    log "chnroute 已存在 $CNT 条，跳过"
fi

# ---------- IPv6 ----------
if [ -f "$CHN6" ]; then
    CNT6=$(count_set chnroute6)
    if [ "${CNT6:-0}" -lt "$MIN_ENTRIES" ]; then
        ipset create chnroute6 hash:net family inet6 -exist 2>/dev/null
        awk 'BEGIN{print "create chnroute6 hash:net family inet6 -exist"}
             !/^#/ && NF {print "add chnroute6 " $0}' "$CHN6" \
            | ipset restore -exist 2>/dev/null
        CNT6=$(count_set chnroute6)
        log "chnroute6 已导入 $CNT6 条"
        NEED_RESTART=1
    else
        log "chnroute6 已存在 $CNT6 条，跳过"
    fi
fi

# ---------- 有重建才重启 chinadns-ng，让它重新加载 ipset ----------
# 开机场景必然重建 → 必然重启；手动重复执行时条数够 → 不动，保持幂等。
if [ "$NEED_RESTART" = "1" ]; then
    if pidof chinadns-ng >/dev/null 2>&1; then
        /etc/init.d/chinadns-standalone restart >/dev/null 2>&1
        sleep 1
        if pidof chinadns-ng >/dev/null 2>&1; then
            log "chinadns-ng 已重启（重新加载 ipset）"
        else
            log "严重：重启后 chinadns-ng 未起来，请人工检查"
        fi
    fi
fi

exit 0