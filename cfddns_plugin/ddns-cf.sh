#!/bin/sh
# =====================================================================
# Cloudflare DDNS 更新脚本 —— A 记录（公网出口 IPv4）
#
# 背景：本机 PPPoE 拿到的是运营商 NAT 内网地址（RFC1918 私有地址），
#       本地任何接口都查不到真实公网出口，必须访问外部服务探测。
#
# 用法：
#   ddns-cf.sh            正常同步（cron / 页面「立即更新」调用）
#   ddns-cf.sh --probe    只探测公网 IP，不写 Cloudflare
#   ddns-cf.sh --status   输出当前状态（key=value），不写 Cloudflare
#
# 退出码：
#   0  成功（含「IP 未变化，无需更新」）
#   1  探测公网 IP 失败
#   2  Cloudflare API 查询失败
#   3  Cloudflare 记录更新/创建失败
#   4  配置缺失
#   5  已有实例在运行（并发锁）
#   6  插件已关闭（总开关关闭时跳过执行）
# =====================================================================

CONF='/etc/cfddns.conf'
LOCK='/var/lock/cfddns.lock'

[ -f "$CONF" ] || { echo "missing $CONF"; exit 4; }
. "$CONF"

MODE='sync'
case "$1" in
	--probe)  MODE='probe' ;;
	--status) MODE='status' ;;
esac

# ---------- 插件总开关 ----------
# 关闭状态下直接退出，防止手动调用或 cron 未清干净时把记录重建回来。
# 只拦截 sync 和 probe：status 是纯只读查询，页面关着的时候还要能看状态。
# 注意：这个检查放在「并发锁」之前，避免无谓的加锁/解锁。
if [ "$ENABLED" = 'false' ] && [ "$MODE" != 'status' ]; then
	LOG_EARLY='/tmp/cfddns.log'
	[ -n "$LOG_FILE" ] && LOG_EARLY="$LOG_FILE"
	echo "$(date '+%F %T') plugin disabled (mode=${MODE}), skip" >> "$LOG_EARLY" 2>/dev/null
	exit 6
fi

log() {
	_msg="$(date '+%F %T') $1"
	[ -n "$LOG_FILE" ] && echo "$_msg" >> "$LOG_FILE" 2>/dev/null
	echo "$_msg" >&2
}

# 只保留最近 200 行，防止 /tmp 被刷爆
trim_log() {
	[ -f "$LOG_FILE" ] || return 0
	_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
	[ "$_lines" -gt 200 ] && tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" 2>/dev/null && mv "${LOG_FILE}.tmp" "$LOG_FILE"
}

# ---------- 并发锁 ----------
if [ "$MODE" = 'sync' ]; then
	if ! mkdir "$LOCK" 2>/dev/null; then
		# 锁超过 5 分钟视为僵死，强制清掉
		if [ -d "$LOCK" ]; then
			_age=$(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || echo 0) ))
			if [ "$_age" -gt 300 ]; then
				log "WARN stale lock ${_age}s, removing"
				rmdir "$LOCK" 2>/dev/null
				mkdir "$LOCK" 2>/dev/null || { log "lock busy"; exit 5; }
			else
				log "another instance running (${_age}s), skip"
				exit 5
			fi
		else
			log "cannot create lock"
			exit 5
		fi
	fi
	trap 'rmdir "$LOCK" 2>/dev/null; trim_log' EXIT
fi

# ---------- IPv4 格式校验 ----------
is_ipv4() {
	echo "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || return 1
	echo "$1" | awk -F. '{
		for (i = 1; i <= 4; i++) {
			if ($i < 0 || $i > 255) exit 1
		}
		exit 0
	}'
}

# ---------- 探测单个源 ----------
probe_one() {
	_url="$1"

	_raw=$(curl -4 -s ${WAN_IFACE:+--interface "$WAN_IFACE"} --max-time "${IP_TIMEOUT:-6}" "$_url" 2>/dev/null)

	# 从返回内容里抠出第一个合法 IPv4（兼容纯文本 / HTML / JSON 包装）
	echo "$_raw" | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1
}

# ---------- 多源探测 + 交叉验证 ----------
# 注意：不能用 $(detect_public_ip) 捕获，那样函数在子 shell 里跑，
#       设置的全局变量传不回来。改为设置 DETECTED_IP / PROBE_SRC / PROBE_AGREE。
# 返回：0 成功（IP 在 DETECTED_IP），1 失败
#
# 时间预算：rpcd 以 -t 30 运行，网页点「立即同步」时整个脚本必须在 30s 内收尾，
#           否则 rpcd 会被占满一个超时周期。这里给探测阶段设总预算，
#           预算耗尽就不再尝试后续源（已有可用 IP 则直接采用）。
PROBE_BUDGET=${PROBE_BUDGET:-12}
detect_public_ip() {
	_first=''
	_first_src=''
	_agree=0
	_tried=0
	_deadline=$(( $(date +%s) + PROBE_BUDGET ))

	_saved_ifs="$IFS"
	IFS=','
	for _u in $IP_SOURCES; do
		IFS="$_saved_ifs"
		_u=$(echo "$_u" | tr -d ' \t\r\n')
		[ -z "$_u" ] && continue
		# 预算耗尽：已有结果就直接用，没有则继续尝试（但最多再做一次）
		if [ "$(date +%s)" -ge "$_deadline" ]; then
			if [ -n "$_first" ]; then
				log "probe budget ${PROBE_BUDGET}s used up, use $_first (agree=$_agree)"
				break
			fi
		fi
		_tried=$((_tried + 1))

		_ip=$(probe_one "$_u")
		if is_ipv4 "$_ip"; then
			if [ -z "$_first" ]; then
				_first="$_ip"
				_first_src="$_u"
				_agree=1
				log "probe[$_tried] $_u => $_ip"
			elif [ "$_ip" = "$_first" ]; then
				_agree=$((_agree + 1))
				log "probe[$_tried] $_u => $_ip (agree)"
				# 两个源一致，直接采信，不再往下试（省时间）
				[ "$_agree" -ge 2 ] && break
			else
				log "probe[$_tried] $_u => $_ip (MISMATCH, ignore)"
			fi
		else
			log "probe[$_tried] $_u => invalid/empty"
		fi
		IFS=','
	done
	IFS="$_saved_ifs"

	DETECTED_IP="$_first"
	PROBE_SRC="$_first_src"
	PROBE_AGREE="$_agree"

	[ -n "$_first" ] || return 1
	return 0
}

# ---------- Cloudflare API ----------
CF_API='https://api.cloudflare.com/client/v4'

cf_get_record() {
	# 输出： "记录ID|当前内容" ，查不到输出空
	_resp=$(curl -s --max-time 10 -X GET \
		"${CF_API}/zones/${ZONE_ID}/dns_records?type=${RECORD_TYPE}&name=${DOMAIN}" \
		-H "Authorization: Bearer ${CF_TOKEN}" \
		-H "Content-Type: application/json" 2>/dev/null)

	_ok=$(echo "$_resp" | jsonfilter -e '$.success' 2>/dev/null)
	if [ "$_ok" != 'true' ]; then
		log "CF query failed: $(echo "$_resp" | head -c 200)"
		return 2
	fi

	_rid=$(echo "$_resp" | jsonfilter -e '$.result[0].id' 2>/dev/null)
	_cur=$(echo "$_resp" | jsonfilter -e '$.result[0].content' 2>/dev/null)
	echo "${_rid}|${_cur}"
	return 0
}

cf_put_record() {
	_rid="$1"; _ip="$2"
	_body="{\"type\":\"${RECORD_TYPE}\",\"name\":\"${DOMAIN}\",\"content\":\"${_ip}\",\"ttl\":${TTL:-120},\"proxied\":${PROXIED:-false}}"

	_resp=$(curl -s --max-time 15 -X PUT \
		"${CF_API}/zones/${ZONE_ID}/dns_records/${_rid}" \
		-H "Authorization: Bearer ${CF_TOKEN}" \
		-H "Content-Type: application/json" \
		--data "$_body" 2>/dev/null)

	_ok=$(echo "$_resp" | jsonfilter -e '$.success' 2>/dev/null)
	[ "$_ok" = 'true' ] && return 0
	log "CF PUT failed: $(echo "$_resp" | head -c 300)"
	return 3
}

cf_create_record() {
	_ip="$1"
	_body="{\"type\":\"${RECORD_TYPE}\",\"name\":\"${DOMAIN}\",\"content\":\"${_ip}\",\"ttl\":${TTL:-120},\"proxied\":${PROXIED:-false}}"

	_resp=$(curl -s --max-time 15 -X POST \
		"${CF_API}/zones/${ZONE_ID}/dns_records" \
		-H "Authorization: Bearer ${CF_TOKEN}" \
		-H "Content-Type: application/json" \
		--data "$_body" 2>/dev/null)

	_ok=$(echo "$_resp" | jsonfilter -e '$.success' 2>/dev/null)
	[ "$_ok" = 'true' ] && return 0
	log "CF POST failed: $(echo "$_resp" | head -c 300)"
	return 3
}

# =====================================================================
# 模式：--probe 只探测
# =====================================================================
if [ "$MODE" = 'probe' ]; then
	detect_public_ip
	if [ $? -ne 0 ] || [ -z "$DETECTED_IP" ]; then
		log "RESULT probe failed"
		echo "FAILED"
		exit 1
	fi
	log "RESULT probe ok ip=$DETECTED_IP src=$PROBE_SRC agree=$PROBE_AGREE"
	echo "IP=$DETECTED_IP"
	echo "SRC=$PROBE_SRC"
	echo "AGREE=$PROBE_AGREE"
	exit 0
fi

# =====================================================================
# 模式：--status 只读状态
# =====================================================================
if [ "$MODE" = 'status' ]; then
	_rec=$(cf_get_record)
	if [ $? -ne 0 ]; then
		echo "CF_OK=false"
		echo "CF_IP="
		echo "REC_ID="
	else
		echo "CF_OK=true"
		echo "CF_IP=$(echo "$_rec" | cut -d'|' -f2)"
		echo "REC_ID=$(echo "$_rec" | cut -d'|' -f1)"
	fi
	echo "DOMAIN=$DOMAIN"
	echo "RECORD_TYPE=$RECORD_TYPE"
	echo "WAN_IFACE=$WAN_IFACE"
	echo "LOCAL_IP=$(ip -4 addr show dev "${WAN_IFACE:-pppoe-wan}" 2>/dev/null | grep -o 'inet [0-9.]*' | awk '{print $2}' | head -1)"
	exit 0
fi

# =====================================================================
# 模式：正常同步
# =====================================================================
log "=== sync start ==="

detect_public_ip
if [ $? -ne 0 ] || [ -z "$DETECTED_IP" ]; then
	log "ERROR cannot detect public IP"
	echo "$(date '+%F %T') exit=1 reason=probe_failed" > "$LAST_FILE"
	exit 1
fi
IP="$DETECTED_IP"
log "public ip = $IP (src=$PROBE_SRC, agree=$PROBE_AGREE)"

# 单个源命中且没有第二源验证时给个提醒（不阻断）
if [ "$PROBE_AGREE" -lt 2 ]; then
	log "WARN only 1 source confirmed the IP"
fi

# 查现有记录
_rec=$(cf_get_record)
if [ $? -ne 0 ]; then
	echo "$(date '+%F %T') exit=2 reason=cf_query_failed ip=$IP" > "$LAST_FILE"
	exit 2
fi

REC_ID=$(echo "$_rec" | cut -d'|' -f1)
OLD_IP=$(echo "$_rec" | cut -d'|' -f2)

if [ -z "$REC_ID" ]; then
	# 记录不存在 → 自动创建
	log "no ${RECORD_TYPE} record for ${DOMAIN}, creating"
	if cf_create_record "$IP"; then
		log "CREATE ok => $IP"
		echo "$(date '+%F %T') exit=0 action=create ip=$IP" > "$LAST_FILE"
		exit 0
	fi
	echo "$(date '+%F %T') exit=3 reason=create_failed ip=$IP" > "$LAST_FILE"
	exit 3
fi

if [ "$OLD_IP" = "$IP" ]; then
	log "no change ($IP), skip"
	echo "$(date '+%F %T') exit=0 action=none ip=$IP" > "$LAST_FILE"
	exit 0
fi

log "updating $OLD_IP -> $IP (record $REC_ID)"
if cf_put_record "$REC_ID" "$IP"; then
	log "UPDATE ok => $IP"
	echo "$(date '+%F %T') exit=0 action=update old=$OLD_IP ip=$IP" > "$LAST_FILE"
	exit 0
fi

echo "$(date '+%F %T') exit=3 reason=update_failed old=$OLD_IP ip=$IP" > "$LAST_FILE"
exit 3