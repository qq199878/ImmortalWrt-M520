#!/bin/sh
# Lucky 信息缓存生成脚本
# 由 LuCI controller 后台调用，避免页面阻塞

CACHE=/tmp/lucky_info_cache.json
TMP=/tmp/lucky_info_cache.json.$$
CONF_DIR=$(uci -q get lucky.@lucky[0].configdir)
[ -z "$CONF_DIR" ] && CONF_DIR=/etc/lucky

# 三个命令都很慢（各 3~4 秒），这里串行跑一次并写文件
INFO=$(/usr/bin/lucky -info 2>/dev/null | tr -d '\n\r')
CONF=$(/usr/bin/lucky -baseConfInfo -cd "$CONF_DIR" 2>/dev/null | tr -d '\n\r')
ARCH=$(/usr/bin/luckyarch 2>/dev/null | tr -d '\n\r')

# 校验：拿不到有效数据就不覆盖旧缓存
if [ -z "$INFO" ] || [ -z "$CONF" ]; then
	logger -t lucky-cache "采集失败 info=${#INFO} conf=${#CONF}"
	rm -f "$TMP"
	exit 1
fi

TS=$(date +%s)

# 用 printf 拼 JSON，避免转义问题（lucky 输出本身不含双引号外的特殊字符）
printf '{"_ts":%s,"luckyInfo":%s,"conf":%s,"luckyArch":"%s"}\n' \
	"$TS" "$INFO" "$CONF" "$ARCH" > "$TMP" 2>/dev/null

# 原子替换
if [ -s "$TMP" ]; then
	mv -f "$TMP" "$CACHE"
	logger -t lucky-cache "缓存更新成功 ${#INFO} bytes"
else
	rm -f "$TMP"
	exit 1
fi