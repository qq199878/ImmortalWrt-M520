# -*- coding: utf-8 -*-
"""DNS 链路探测：对 192.168.1.1 的 53 / 6153 / 6053 三个端口逐个发 A 查询"""
import socket, struct, random

def query(host, qname, port=53, timeout=3):
    tid = random.randint(0, 65535)
    header = struct.pack('>HHHHHH', tid, 0x0100, 1, 0, 0, 0)
    q = b''.join(bytes([len(p)]) + p.encode() for p in qname.split('.')) + b'\x00'
    q += struct.pack('>HH', 1, 1)
    pkt = header + q
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.sendto(pkt, (host, port))
        data, _ = s.recvfrom(4096)
    except Exception as e:
        return 'ERR:%s' % e
    finally:
        s.close()
    ancount = struct.unpack('>H', data[6:8])[0]
    rcode = data[3] & 0x0F
    idx = 12
    while idx < len(data) and data[idx] != 0:
        idx += data[idx] + 1
    idx += 5
    ips = []
    for _ in range(ancount):
        if idx >= len(data):
            break
        if data[idx] & 0xC0 == 0xC0:
            idx += 2
        else:
            while idx < len(data) and data[idx] != 0:
                idx += data[idx] + 1
            idx += 1
        if idx + 10 > len(data):
            break
        rtype, rclass, ttl, rdlen = struct.unpack('>HHIH', data[idx:idx+10])
        idx += 10
        rdata = data[idx:idx+rdlen]
        idx += rdlen
        if rtype == 1 and rdlen == 4:
            ips.append(socket.inet_ntoa(rdata))
        elif rtype == 28 and rdlen == 16:
            ips.append(socket.inet_ntop(socket.AF_INET6, rdata))
    return 'rcode=%d %s' % (rcode, ','.join(ips) if ips else 'NO-A-RECORD')

DOMAINS = ['www.baidu.com', 'www.qq.com', 'www.google.com', 'github.com', 'doubleclick.net', 'www.youtube.com']

if __name__ == '__main__':
    for port in (53, 6153, 6053):
        print('===== 192.168.1.1:%d =====' % port)
        for d in DOMAINS:
            print('  %-22s %s' % (d, query('192.168.1.1', d, port)))
        print()
