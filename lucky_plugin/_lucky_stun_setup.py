#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lucky STUN 内网穿透 自动配置
创建规则 -> 启用 -> 验证

规则设计（针对本机实测 Cone NAT / NAT1）：
  穿透目标：路由器 LuCI 管理页 192.168.1.1:80
  STUN 协议：tcp4（TCP 打洞，浏览器可直接访问）
  STUN 服务器：用实测能通的（google / bilibili）+ 内置列表做冗余
"""
import base64
import json
import secrets
import sys
import time
import urllib.error
import urllib.request

BASE = "http://192.168.1.1:16603"
ACCOUNT = "YOUR_ACCOUNT"
PASSWORD = "YOUR_PASSWORD"

# ============ 穿透参数（要改就改这里）============
RULE_NAME = "LuCI管理页"
TARGET_ADDR = "192.168.1.1"      # 内网目标地址
TARGET_PORT = 80                  # 内网目标端口
STUN_TYPE = "tcp4"                # tcp4 / udp4
LISTEN_PORT = 0                   # 0 = 让系统自动分配

# 实测能通的 STUN 服务器（google 和 bilibili 实测有响应）
STUN_SERVERS = [
    "stun.l.google.com:19302",
    "stun.chat.bilibili.com:3478",
    "stun.nextcloud.com:3478",
    "stun.freeswitch.org:3478",
    "stun.stunprotocol.org:3478",
    "stun.sipnet.com:3478",
]
# ===============================================


def http(method, path, data=None, headers=None, timeout=20):
    url = BASE + path
    body = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, str(e).encode()


def rsa_encrypt(pem, plaintext):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    key = serialization.load_pem_public_key(pem.encode("utf-8"))
    ct = key.encrypt(plaintext.encode("utf-8"), padding.PKCS1v15())
    return base64.b64encode(ct).decode("ascii")


def login():
    sid = secrets.token_hex(32)
    hdrs = {"Lucky-Login-Session": sid}
    st, raw = http("GET", "/api/login/challenge", headers=hdrs)
    if st != 200:
        print("[X] 获取挑战失败 HTTP %s" % st)
        return None
    ch = json.loads(raw)
    payload = {
        "account": ACCOUNT,
        "password": PASSWORD,
        "twoFA": "",
        "challengeId": ch["challengeId"],
        "nonce": ch["nonce"],
    }
    cipher = rsa_encrypt(ch["publicKey"], json.dumps(payload, separators=(",", ":")))
    st2, raw2 = http("POST", "/api/login",
                     data={"challengeId": ch["challengeId"], "cipherText": cipher},
                     headers=hdrs)
    res = json.loads(raw2)
    if res.get("ret") != 0:
        print("[X] 登录失败: %s" % res.get("msg"))
        return None
    token = res.get("token") or ""
    print("[+] 登录成功")
    return {"Lucky-Login-Session": sid, "Lucky-Admin-Token": token}


def build_rule():
    """构造 STUN 规则（字段严格对齐前端默认对象）"""
    return {
        "Name": RULE_NAME,
        "Key": "",
        "Enable": True,
        "UseGlobalStunServerList": False,
        "DiaglogShowMode": "simple",
        "StunHeartbeatInterval": 2300,
        "StunTimeout": 3000,
        "StunRetryInterval": 3000,
        "StunAutoRetry": True,
        "AutoAddPubAddrWhiteList": False,
        "StunType": STUN_TYPE,
        "StunListenType": "ip",
        "SpecifyNetworkInterface": "",
        "NetworkInterfaceReg": "",
        "ListenIP": "",
        "AutoOptionsFirewall": True,
        "ListenPort": LISTEN_PORT,
        "NatPMP": False,
        "UPnPGawayIP": "",
        "NatPMPGateway": "",
        "UPnP": False,
        "UPnPLocalPort": 0,
        "UPnpLocalHost": "",
        "UPnPInternalClientIP": "",
        "UpnPDiyControlAPIUrl": "",
        "DisableStunAvalidCheck": False,
        "DisablePortForward": False,
        "TargetAddressList": [TARGET_ADDR],
        "TargetPort": TARGET_PORT,
        "LogLevel": 4,
        "AccessLogMaxNum": 128,
        "WebListShowLastLogMaxCount": 20,
        "Options": {
            "DisableSelfForwardingCheck": False,
            "SingleProxyMaxTCPConnections": 256,
            "SingleProxyMaxUDPReadTargetDatagoroutineCount": 32,
            "UDPShortMode": False,
            "SafeMode": "blacklist",
            "SecurityGroupKeys": [],
            "SecurityGroupRefreshOnTraffic": False,
            "TCPListenTLS": False,
            "TCPRelayTLS": False,
            "TCPRelayTLSServerName": "",
            "TCPRelayTLSInsecureSkipVerify": False,
            "TCPAcceptProxyProtocolV2": False,
            "TCPProxyProtocolV2": False,
            "TCPStreamEncryptionSource": False,
            "TCPStreamEncryptionAccept": False,
            "TCPStreamEncryptionKey": "",
            "SinglePortSpeedLimit": False,
            "SinglePortSendSpeedLimit": 0,
            "SinglePortReceSpeedLimit": 0,
            "RuleSpeedLimit": False,
            "RuleSendSpeedLimit": 0,
            "RuleReceSpeedLimit": 0,
            "UDPSessionTimeout": 30000,
            "UDPPacketSourceEncryption": False,
            "UDPPacketAcceptEncryption": False,
            "UDPPacketEncryptionKey": "",
            "UDPPacketSize": 1500,
        },
        "StunServerList": list(STUN_SERVERS),
        "TcpKeepAliveServerList": [],
        "GlobalWebhook": False,
        "WebhookEnable": False,
        "WebhookOnlyAddrChange": True,
        "WebhookURL": "",
        "WebhookMethod": "",
        "WebhookHeaders": [],
        "WebhookRequestBody": "",
        "WebhookDisableCallbackSuccessContentCheck": False,
        "WebhookSuccessContent": [],
        "WebhookNetworkType": "",
        "WebhookProxy": "",
        "WebhookProxyAddr": "",
        "WebhookProxyUser": "",
        "WebhookProxyPassword": "",
        "CallScript": False,
        "CallScriptContent": "",
        "RetryCount": 0,
        "RetryInterval": 500,
    }


def main():
    print("=" * 58)
    print(" Lucky STUN 自动配置")
    print("=" * 58)
    print("目标: %s:%d  (%s)" % (TARGET_ADDR, TARGET_PORT, RULE_NAME))
    print("协议: %s" % STUN_TYPE)
    print()

    auth = login()
    if not auth:
        return 1

    # ---- 0. 先看现有规则，避免重复 ----
    print()
    print("[0] 查询现有 STUN 规则...")
    st, raw = http("GET", "/api/stunrulelist", headers=auth)
    existing = []
    if st == 200:
        try:
            data = json.loads(raw)
            lst = data.get("ret") if isinstance(data.get("ret"), list) else data.get("data") or []
            if isinstance(lst, list):
                existing = lst
        except Exception:
            pass
    print("    现有规则数: %d" % len(existing))
    for r in existing:
        if isinstance(r, dict):
            print("      - %s (Key=%s, Enable=%s)" % (
                r.get("Name"), str(r.get("Key"))[:12], r.get("Enable")))

    # 检查重名
    for r in existing:
        if isinstance(r, dict) and r.get("Name") == RULE_NAME:
            print()
            print("[!] 已存在同名规则「%s」，跳过创建" % RULE_NAME)
            print("    如需重建，请先在面板删除或改名")
            return 0

    # ---- 1. 创建规则 ----
    print()
    print("[1] 创建 STUN 规则...")
    rule = build_rule()
    st, raw = http("POST", "/api/stunrule", data=rule, headers=auth)
    print("    HTTP %s" % st)
    try:
        res = json.loads(raw)
    except Exception:
        print("    原始响应: %s" % raw[:400])
        return 1
    print("    返回: %s" % json.dumps(res, ensure_ascii=False)[:300])

    if res.get("ret") != 0:
        print("    [X] 创建失败: %s" % res.get("msg"))
        return 1
    print("    [+] 创建成功")

    # ---- 2. 查询规则，拿 Key 和状态 ----
    print()
    print("[2] 查询规则状态（等待 STUN 打洞）...")
    key = None
    for attempt in range(8):
        time.sleep(3)
        st, raw = http("GET", "/api/stunrulelist", headers=auth)
        if st != 200:
            continue
        try:
            data = json.loads(raw)
            lst = data.get("list") or []
        except Exception:
            continue
        if not isinstance(lst, list):
            continue
        for r in lst:
            if isinstance(r, dict) and r.get("Name") == RULE_NAME:
                key = r.get("Key")
                pub = r.get("PublicAddr") or ""
                en = r.get("Enable")
                print("    [%d] Key=%s Enable=%s 公网地址=%s" % (
                    attempt + 1, str(key)[:12], en, pub or "(还在打洞)"))
                if pub:
                    print()
                    print("=" * 58)
                    print(" STUN 打洞成功！")
                    print("=" * 58)
                    print(" 公网入口 : %s" % pub)
                    print(" 内网目标 : %s:%d" % (TARGET_ADDR, TARGET_PORT))
                    print(" 访问地址 : http://%s/" % pub)
                    print("=" * 58)
                    return 0
                break

    if key:
        print()
        print("[!] 规则已创建，但还没拿到公网地址")
        print("    规则 Key = %s" % key)
        print("    再等一会儿去面板看，或者看日志排查")
    return 0


if __name__ == "__main__":
    sys.exit(main())