#!/bin/sh
# STUN NAT 类型探测（busybox ash，无 python）
# 原理：向多个 STUN 服务器发 Binding Request，比较返回的公网端口
#   端口相同 -> Cone NAT（可打洞，Lucky STUN 能成功）
#   端口每次不同 -> Symmetric NAT（无法打洞）

REQ='\000\001\000\000\041\022\244\102ABCDEFGHIJKL'

stun_probe() {
	_h="$1"
	_p="$2"
	_tag="$3"
	# 解析域名为 IP（busybox nc 域名解析不一定可用）
	_ip=$(nslookup "$_h" 223.5.5.5 2>/dev/null | awk '/^Address: /{print $2}' | tail -1)
	[ -z "$_ip" ] && _ip=$(nslookup "$_h" 2>/dev/null | awk '/^Address: /{print $2}' | tail -1)
	if [ -z "$_ip" ]; then
		echo "$_tag|DNS_FAIL|"
		return
	fi
	_hex=$(printf "$REQ" | nc -u -w 4 "$_ip" "$_p" 2>/dev/null | od -An -tx1 | tr -d '\n ')
	if [ -z "$_hex" ]; then
		echo "$_tag|NO_RESP|$_ip"
		return
	fi
	echo "$_tag|$_ip|$_hex"
}

# 解析 STUN 响应，取 XOR-MAPPED-ADDRESS (attr 0x0020)
# 输入：完整 hex 串；输出：ip:port
parse_xor() {
	_hx="$1"
	# 定位 0020（XOR-MAPPED-ADDRESS）或 0001（MAPPED-ADDRESS）
	_pos=$(echo "$_hx" | sed 's/.*\(0020\)/\1/;s/0020.*//' | wc -c)
	# 用更稳的方式：逐段找
	i=0
	_len=${#_hx}
	while [ $((i + 3)) -lt "$_len" ]; do
		_attr=$(echo "$_hx" | cut -c$((i + 1))-$((i + 4)))
		if [ "$_attr" = "0020" ] || [ "$_attr" = "0001" ]; then
			# attr type(4) + len(4) + family(2) + xorport(4) + xorip(8)
			_fam=$(echo "$_hx" | cut -c$((i + 9))-$((i + 10)))
			_xp=$(echo "$_hx" | cut -c$((i + 11))-$((i + 14)))
			_xi=$(echo "$_hx" | cut -c$((i + 15))-$((i + 22)))
			if [ "$_fam" = "01" ]; then
				# IPv4: port ^ 0x2112, ip ^ 0x2112A442
				_p1=$(printf '%d' "0x$(echo "$_xp" | cut -c1-2)")
				_p2=$(printf '%d' "0x$(echo "$_xp" | cut -c3-4)")
				_p1=$((_p1 ^ 0x21))
				_p2=$((_p2 ^ 0x12))
				_port=$((_p1 * 256 + _p2))
				_b1=$(printf '%d' "0x$(echo "$_xi" | cut -c1-2)")
				_b2=$(printf '%d' "0x$(echo "$_xi" | cut -c3-4)")
				_b3=$(printf '%d' "0x$(echo "$_xi" | cut -c5-6)")
				_b4=$(printf '%d' "0x$(echo "$_xi" | cut -c7-8)")
				_b1=$((_b1 ^ 0x21))
				_b2=$((_b2 ^ 0x12))
				_b3=$((_b3 ^ 0xA4))
				_b4=$((_b4 ^ 0x42))
				echo "$_b1.$_b2.$_b3.$_b4:$_port"
				return
			fi
		fi
		i=$((i + 2))
	done
	echo "PARSE_FAIL"
}

echo "=========================================="
echo " STUN NAT 类型探测"
echo "=========================================="
echo ""

echo "[1] stun.l.google.com:19302"
R1=$(stun_probe stun.l.google.com 19302 S1)
echo "    raw: $R1"
H1=$(echo "$R1" | cut -d'|' -f3)
M1=$(parse_xor "$H1")
echo "    mapped: $M1"
echo ""

echo "[2] stun.cloudflare.com:3478"
R2=$(stun_probe stun.cloudflare.com 3478 S2)
echo "    raw: $R2"
H2=$(echo "$R2" | cut -d'|' -f3)
M2=$(parse_xor "$H2")
echo "    mapped: $M2"
echo ""

echo "[3] stun.miwifi.com:3478"
R3=$(stun_probe stun.miwifi.com 3478 S3)
echo "    raw: $R3"
H3=$(echo "$R3" | cut -d'|' -f3)
M3=$(parse_xor "$H3")
echo "    mapped: $M3"
echo ""

echo "=========================================="
echo " 结论"
echo "=========================================="
P1=$(echo "$M1" | rev | cut -d: -f1 | rev)
P2=$(echo "$M2" | rev | cut -d: -f1 | rev)
P3=$(echo "$M3" | rev | cut -d: -f1 | rev)
echo "端口: S1=$P1  S2=$P2  S3=$P3"
if [ -z "$P1" ] || [ "$P1" = "PARSE_FAIL" ] && [ -z "$P2" ]; then
	echo "-> 所有服务器都没响应，UDP 出站被封或 DNS 失败"
elif [ -n "$P1" ] && [ "$P1" = "$P2" ]; then
	echo "-> **端口一致 = Cone NAT（NAT1），打洞可行！**"
elif [ -n "$P1" ] && [ -n "$P2" ] && [ "$P1" != "$P2" ]; then
	echo "-> **端口不同 = Symmetric NAT（NAT4），直连打洞不可行**"
else
	echo "-> 数据不足，看上面原始输出判断"
fi