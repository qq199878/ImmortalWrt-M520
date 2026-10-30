#!/bin/sh
# ============================================================
# DNS 链路自动同步脚本（SmartDNS 看门狗 + PassWall 感知）
# 部署路径：/etc/chinadns-ng/dns-sync.sh
# cron: * * * * * /etc/chinadns-ng/dns-sync.sh
#
# 职责一（原 watchdog.sh）：SmartDNS(6053) 存活检测
#   活着 -> china-dns 127.0.0.1#6053（测速优选）
#   挂了 -> china-dns 223.5.5.5,119.29.29.29（直连兜底）
#
# 职责二（新增）：PassWall 开关感知
#   开了且真能用 -> trust-dns 127.0.0.1#<passwall的chinadns-ng端口>（经代理出，真答案）
#   关了或不可用 -> trust-dns 1.1.1.1（现状，接受污染）
#
# 设计要点：
#   1. flock 全局单锁，绝不并发改同一文件
#   2. 只有目标值 != 当前值 才改配置并重启，避免每分钟白重启
#   3. passwall 端口动态探测：只认 TCP 的 LISTEN 行，排除自身 6153
#      ★ 关键坑：netstat 的 -l 对 UDP 无效，chinadns-ng 的 UDP 出站 socket
#        会以 0.0.0.0:<随机端口> 混进结果。若不过滤，会把 trust-dns 指向
#        一个没人监听的死端口，导致 DNS 全线超时。故只取 -tnlp（TCP）。
#   4. 切换前先验证目标端口真能解析（且不是污染结果），验证失败不切/回退
#   5. 所有探测带 timeout，防止 SmartDNS 半死导致 cron 任务堆积
#
# 端口说明（实测 app.sh）：
#   passwall 的 NEXT_DNS_LISTEN_PORT 起始 15353。
#   本机配置 dns_shunt=chinadns-ng + dns_mode=udp + direct_dns_mode=auto
#   且无 acl_rule，故 passwall 的 chinadns-ng 实际监听 15353（不 +1）。
#   其进程形态为 `-C /tmp/etc/passwall/acl/default/chinadns_ng.conf`
#   （注意是 chinadns_ng.conf，下划线，与自有的 chinadns.conf 区分）。
# ============================================================

CONF=/etc/chinadns-ng/chinadns.conf
PROBE_CN=www.baidu.com
# 代理探活用的境外域名（多个交叉，任一拿到干净 IP 即认定代理在工作）
PROBE_GFW_LIST="www.google.com www.youtube.com www.wikipedia.org"
MY_PORT=6153
LOCK=/tmp/dns_sync.lock
LOG_TAG=dns-sync
PROBE_TIMEOUT=3

# ---------- 抢锁：拿不到就退出，绝不并发 ----------
exec 9>"$LOCK"
if ! flock -n 9; then
    exit 0
fi

log() { logger -t "$LOG_TAG" "$*"; }

[ -f "$CONF" ] || { log "配置文件 $CONF 不存在，退出"; exit 0; }

# ---------- 当前配置值 ----------
get_china() { grep "^china-dns " "$CONF" 2>/dev/null | head -1 | sed "s/^china-dns //"; }
get_trust() { grep "^trust-dns " "$CONF" 2>/dev/null | head -1 | sed "s/^trust-dns //"; }

# ---------- 通用探活：解析出 A 记录即算通 ----------
# probe_dns <域名> <端口>
probe_dns() {
    timeout "$PROBE_TIMEOUT" nslookup -type=A "$1" "127.0.0.1:$2" 2>/dev/null \
        | grep -qE '^Address:[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

# ---------- 取 A 记录首条（严格只匹配纯 IPv4，排除服务器地址行） ----------
# query_a <域名> <端口>
query_a() {
    timeout "$PROBE_TIMEOUT" nslookup -type=A "$1" "127.0.0.1:$2" 2>/dev/null \
        | awk '/^Address:[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/{print $2; exit}'
}

# ---------- 判断是否为 GFW DNS 污染地址 ----------
# 实测本机污染采样（连查 10 次 google，8 次命中下列网段）：
#   31.13.92.37 / 157.240.7.20 / 185.45.5.35 / 104.244.42.197
#   69.171.235.22 / 199.59.148.96 / 174.132.167.252
# 特征：全部落在 Facebook/Twitter/ThePlanet 等固定网段内，每次查询随机变化。
# 真代理拿到的是真实 IP，绝不会落在这些段里。
is_poisoned_ip() {
    case "$1" in
        31.13.*|157.240.*|69.171.*|69.63.*|66.220.*|179.60.*) return 0 ;;
        104.244.42.*|199.16.*|199.59.*) return 0 ;;
        185.45.*|174.132.*|173.201.*|97.74.*) return 0 ;;
        8.7.198.*|46.82.174.*|59.24.3.*|203.98.7.*|243.185.187.*|78.16.49.*) return 0 ;;
        93.46.8.*|159.106.121.*|169.132.13.*|192.67.198.*|202.106.1.*|37.61.54.*) return 0 ;;
        8.105.84.*|12.129.205.*|200.68.17.*|253.181.96.*|4.36.66.*) return 0 ;;
    esac
    return 1
}

# ---------- 代理链路探活 ----------
# passwall 的 chinadns-ng 刚启动时端口已 LISTEN，但上游/节点可能还没就绪，
# 此时它会回落到直连 DNS，拿到的仍是污染答案。若直接切过去，等于白切。
#
# 判据：多域名投票。GFW 污染是概率性的——实测同一批查询里
#   google->104.244.42.197(污染) youtube->185.45.5.35(污染) wikipedia->103.102.166.224(真实)
#   三个里有两个是污染的。所以不能看单个域名，要统计比例：
#     污染数 >= 总数的一半 -> 判为污染，不切
#     污染数 <  总数的一半 -> 认为代理确实在起作用，切
#
# 之所以不用「与直连结果对比」：污染值每次随机，两次查询必然不同，
# 假代理也会"看起来不一样"，对比法完全无效。必须用网段黑名单 + 投票。
probe_proxy_dns() {
    local _port="$1" _d _ip _total=0 _bad=0
    for _d in $PROBE_GFW_LIST; do
        _ip=$(query_a "$_d" "$_port")
        [ -n "$_ip" ] || continue
        _total=$((_total + 1))
        if is_poisoned_ip "$_ip"; then
            _bad=$((_bad + 1))
        fi
    done
    [ "$_total" -gt 0 ] || return 1        # 一个都解析不出来，判死
    # 污染占一半及以上，判定为代理没生效
    [ "$_bad" -lt $(( (_total + 1) / 2 )) ] || return 1
    return 0
}

# ---------- 探测 passwall 的 chinadns-ng 端口 ----------
# 返回端口号到 stdout，失败返回空
find_passwall_port() {
    local pw_on port p cl
    pw_on=$(uci -q get passwall.@global[0].enabled 2>/dev/null)
    [ "$pw_on" = "1" ] || return 0

    # 只取 TCP 的 LISTEN 行（-tnlp），UDP 一律不要：
    # UDP 没有 LISTEN 状态，-l 无效，出站 socket 会污染结果
    port=$(netstat -tnlp 2>/dev/null \
           | grep "chinadns-ng" \
           | awk '{print $4}' \
           | sed 's/.*://' \
           | grep -E '^[0-9]+$' \
           | grep -v "^${MY_PORT}$" \
           | sort -un | head -1)

    # 兜底：从进程命令行解析 -l 参数，跳过自己（自己带 /etc/chinadns-ng/ 路径）
    if [ -z "$port" ]; then
        for p in $(pidof chinadns-ng 2>/dev/null); do
            cl=$(tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null)
            case "$cl" in
                *"/etc/chinadns-ng/"*) continue ;;
            esac
            port=$(echo "$cl" | sed -n 's/.*[[:space:]]-l[[:space:]]\{1,\}\([0-9]\{1,\}\).*/\1/p')
            [ -n "$port" ] && break
        done
    fi

    [ -n "$port" ] && echo "$port"
    return 0
}

# ---------- 写配置：行存在就改，不存在就追加 ----------
set_conf() {
    local _key="$1" _val="$2"
    if grep -q "^${_key} " "$CONF" 2>/dev/null; then
        sed -i "s|^${_key} .*|${_key} ${_val}|" "$CONF"
    else
        echo "${_key} ${_val}" >> "$CONF"
    fi
}

CHANGED=0

# ================= 职责一：SmartDNS 看门狗 =================
CUR_CHINA=$(get_china)
if probe_dns "$PROBE_CN" 6053; then
    WANT_CHINA="127.0.0.1#6053"
else
    WANT_CHINA="223.5.5.5,119.29.29.29"
fi

if [ "$CUR_CHINA" != "$WANT_CHINA" ]; then
    set_conf "china-dns" "$WANT_CHINA"
    if [ "$WANT_CHINA" = "127.0.0.1#6053" ]; then
        log "SmartDNS 已恢复，china-dns -> $WANT_CHINA"
    else
        log "SmartDNS 不可用，china-dns -> $WANT_CHINA（直连兜底）"
    fi
    CHANGED=1
fi

# ================= 职责二：PassWall 感知 =================
CUR_TRUST=$(get_trust)
PW_PORT=$(find_passwall_port)

WANT_TRUST="1.1.1.1"
MODE_DESC="直连"

if [ -n "$PW_PORT" ]; then
    if probe_proxy_dns "$PW_PORT"; then
        WANT_TRUST="127.0.0.1#$PW_PORT"
        MODE_DESC="代理(端口$PW_PORT)"
    else
        MODE_DESC="代理端口$PW_PORT 不可用(未就绪/节点故障/污染)，回退直连"
    fi
fi

if [ "$CUR_TRUST" != "$WANT_TRUST" ]; then
    set_conf "trust-dns" "$WANT_TRUST"
    log "trust-dns -> $WANT_TRUST（$MODE_DESC）"
    CHANGED=1
fi

# ================= 有变化才重启 =================
if [ "$CHANGED" = "1" ]; then
    /etc/init.d/chinadns-standalone restart >/dev/null 2>&1
    sleep 1
    if pidof chinadns-ng >/dev/null 2>&1; then
        log "chinadns-standalone 已重启（配置已更新）"
    else
        log "严重：重启后 chinadns-ng 未起来，请人工检查 $CONF"
    fi
fi

exit 0