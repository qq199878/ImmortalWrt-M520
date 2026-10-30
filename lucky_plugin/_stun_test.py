#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STUN NAT 类型探测
判断 Lucky STUN 内网穿透是否能成功

NAT 类型判定：
  Full Cone (NAT1)      -> 打洞成功率极高
  Restricted (NAT2)     -> 可打洞
  Port Restricted(3)    -> 可打洞，需中继辅助
  Symmetric (NAT4)      -> 纯 P2P 打洞基本失败，必须走服务器中继
"""
import socket
import struct
import random
import sys

STUN_SERVERS = [
    ("stun.l.google.com", 19302),
    ("stun.cloudflare.com", 3478),
    ("stun.miwifi.com", 3478),
    ("stun.qq.com", 3478),
    ("stun.chat.bilibili.com", 3478),
]

MAGIC_COOKIE = 0x2112A442


def build_request():
    """构造 STUN Binding Request"""
    msg_type = 0x0001
    msg_len = 0
    tid = bytes(random.getrandbits(8) for _ in range(12))
    return struct.pack(">HHI", msg_type, msg_len, MAGIC_COOKIE) + tid


def parse_response(data):
    """解析 STUN 响应，返回 (ip, port)"""
    if len(data) < 20:
        return None
    msg_type, msg_len, cookie = struct.unpack(">HHI", data[:8])
    if cookie != MAGIC_COOKIE:
        return None
    if msg_type != 0x0101:  # Binding Success Response
        return None

    pos = 20
    end = min(20 + msg_len, len(data))
    while pos + 4 <= end:
        attr_type, attr_len = struct.unpack(">HH", data[pos:pos + 4])
        val = data[pos + 4:pos + 4 + attr_len]
        # XOR-MAPPED-ADDRESS = 0x0020
        if attr_type == 0x0020 and len(val) >= 8:
            family = val[1]
            if family == 0x01:
                xport = struct.unpack(">H", val[2:4])[0]
                port = xport ^ (MAGIC_COOKIE >> 16)
                xip = struct.unpack(">I", val[4:8])[0]
                ip = xip ^ MAGIC_COOKIE
                return (socket.inet_ntoa(struct.pack(">I", ip)), port)
        # MAPPED-ADDRESS = 0x0001（老式）
        elif attr_type == 0x0001 and len(val) >= 8:
            family = val[1]
            if family == 0x01:
                port = struct.unpack(">H", val[2:4])[0]
                ip = socket.inet_ntoa(val[4:8])
                return (ip, port)
        pos += 4 + attr_len
    return None


def probe(host, port, timeout=3):
    """对单个 STUN 服务器发起探测，返回 (local_port, mapped_ip, mapped_port)"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        sock.bind(("", 0))
        local_port = sock.getsockname()[1]
        sock.sendto(build_request(), (host, port))
        data, _ = sock.recvfrom(2048)
        sock.close()
        result = parse_response(data)
        if result:
            return (local_port, result[0], result[1])
        return (local_port, None, None)
    except socket.timeout:
        return (None, "TIMEOUT", None)
    except Exception as e:
        return (None, "ERR:%s" % e, None)


def main():
    print("=" * 58)
    print(" STUN NAT 类型探测")
    print(" 目的：判断 Lucky STUN 内网穿透能否成功")
    print("=" * 58)
    print()

    results = []
    for host, port in STUN_SERVERS:
        sys.stdout.write("[*] %-26s " % ("%s:%d" % (host, port)))
        sys.stdout.flush()
        lp, mip, mp = probe(host, port)
        if mip and not str(mip).startswith(("TIMEOUT", "ERR")):
            print("本地:%-5s -> 公网 %s:%s" % (lp, mip, mp))
            results.append((host, lp, mip, mp))
        else:
            print("失败 (%s)" % mip)

    print()
    print("=" * 58)
    print(" 分析")
    print("=" * 58)

    ok = [r for r in results if r[3]]
    if not ok:
        print("[-] 所有 STUN 服务器都没响应")
        print("    -> UDP 出站被封锁，或 DNS 解析失败")
        print("    -> Lucky STUN 无法工作")
        return

    if len(ok) == 1:
        print("[!] 只有 1 个服务器有响应，数据不足以判定 NAT 类型")
        print("    公网映射: %s:%s" % (ok[0][2], ok[0][3]))
        return

    ports = [r[3] for r in ok]
    ips = set(r[2] for r in ok)

    print("[*] 公网 IP:    %s" % ", ".join(sorted(ips)))
    print("[*] 映射端口:   %s" % ", ".join(str(p) for p in ports))
    print()

    # 用同一个 socket 依次探测不同服务器（判断 NAT 类型的关键）
    # 原理：同一个本地端口，如果不同目标看到的公网端口不同 -> 对称 NAT
    print("[*] 同一 socket 连续探测（关键判定）...")
    print()
    fixed_local = []
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3)
    sock.bind(("", 0))
    local_port = sock.getsockname()[1]
    print("    固定本地端口: %d" % local_port)
    print()
    for host, port in STUN_SERVERS:
        try:
            sock.sendto(build_request(), (host, port))
            data, _ = sock.recvfrom(2048)
            r = parse_response(data)
            if r:
                fixed_local.append((host, local_port, r[1]))
                print("    %-26s -> 公网 %s:%-5s" % (host, r[0], r[1]))
        except Exception as e:
            print("    %-26s -> 失败 (%s)" % (host, str(e)[:20]))
    sock.close()

    print()
    print("=" * 58)
    print(" 结论")
    print("=" * 58)

    if len(fixed_local) >= 2:
        mports = [f[2] for f in fixed_local]
        if len(set(mports)) == 1:
            print("[+] 同一本地端口 -> 公网端口保持一致")
            print()
            print("    NAT 类型: **Cone NAT（NAT1，全锥形/受限锥形）**")
            print()
            print("    Lucky STUN 内网穿透：**可行** ✅")
            print("    打洞成功率高，P2P 直连概率大。")
            print("    建议：Lucky STUN 规则里把多个 STUN 服务器都配上做冗余。")
        else:
            print("[-] 同一本地端口 -> 公网端口每次不同: %s" % mports)
            print()
            print("    NAT 类型: **Symmetric NAT（NAT4，对称型）**")
            print()
            print("    Lucky STUN 内网穿透：**纯 P2P 打洞基本失败** ❌")
            print()
            print("    原因：对称 NAT 为每个目标地址分配不同公网端口，")
            print("          对端拿到的地址和端口对不上，打洞必然失败。")
            print()
            print("    可行替代方案：")
            print("      1. Lucky 的 STUN 规则支持「穿透失败走中继」")
            print("         -> 需要一台有公网 IP 的服务器做 relay")
            print("      2. 用 Cloudflare Tunnel（免费、无需公网 IP、稳定）")
            print("      3. 用 frp + 公网服务器反代")
            print("      4. 找运营商要公网 IP（打客服说装监控）")
    else:
        print("[!] 有效响应不足，无法判定。看上面日志。")


if __name__ == "__main__":
    main()