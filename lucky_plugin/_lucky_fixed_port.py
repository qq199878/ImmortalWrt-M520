#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lucky STUN 固定端口测试
验证：ListenPort 固定后，公网映射端口是否也固定

原理：本机 NAT 为端口保持型（Port-Preserving）
      本地监听 40261 -> 公网映射 40261
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

RULE_NAME = "LuCI管理页"
FIXED_PORT = 40261          # 要固定的端口
TARGET_ADDR = "192.168.1.1"
TARGET_PORT = 80
STUN_TYPE = "tcp4"

STUN_SERVERS = [
    "stun.l.google.com:19302",
    "stun.chat.bilibili.com:3478",
    "stun.nextcloud.com:3478",
    "stun.freeswitch.org:3478",
    "stun.stunprotocol.org:3478",
    "stun.sipnet.com:3478",
]


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
    return base64.b64encode(
        key.encrypt(plaintext.encode("utf-8"), padding.PKCS1v15())
    ).decode("ascii")


def login():
    sid = secrets.token_hex(32)
    hdrs = {"Lucky-Login-Session": sid}
    st, raw = http("GET", "/api/login/challenge", headers=hdrs)
    ch = json.loads(raw)
    payload = {
        "account": ACCOUNT, "password": PASSWORD, "twoFA": "",
        "challengeId": ch["challengeId"], "nonce": ch["nonce"],
    }
    cipher = rsa_encrypt(ch["publicKey"], json.dumps(payload, separators=(",", ":")))
    st2, raw2 = http("POST", "/api/login",
                     data={"challengeId": ch["challengeId"], "cipherText": cipher},
                     headers=hdrs)
    res = json.loads(raw2)
    if res.get("ret") != 0:
        raise SystemExit("登录失败: %s" % res.get("msg"))
    return {"Lucky-Login-Session": sid, "Lucky-Admin-Token": res.get("token") or ""}


def get_rules(auth):
    st, raw = http("GET", "/api/stunrulelist", headers=auth)
    if st != 200:
        return []
    try:
        return json.loads(raw).get("list") or []
    except Exception:
        return []


def main():
    auth = login()
    print("[+] 登录成功")
    print()

    rules = get_rules(auth)
    target = None
    for r in rules:
        if r.get("Name") == RULE_NAME:
            target = r
            break

    if not target:
        print("[X] 没找到规则「%s」" % RULE_NAME)
        return 1

    key = target.get("Key")
    print("[0] 现有规则状态")
    print("    Key           = %s" % key)
    print("    本地监听      = %s" % target.get("StunLocalAddr"))
    print("    公网地址      = %s" % target.get("PublicAddr"))
    print()

    # ---- 1. 用固定端口重建规则 ----
    print("[1] 改为固定端口 %d，重建规则..." % FIXED_PORT)

    # 先删掉旧的
    st, raw = http("DELETE", "/api/stunrule?key=%s" % key, headers=auth)
    print("    删除旧规则 HTTP %s" % st)
    time.sleep(3)

    rule = {
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
        "ListenPort": FIXED_PORT,
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

    st, raw = http("POST", "/api/stunrule", data=rule, headers=auth)
    res = json.loads(raw)
    print("    创建新规则 HTTP %s, ret=%s" % (st, res.get("ret")))
    if res.get("ret") != 0:
        print("    [X] %s" % res.get("msg"))
        return 1
    new_key = res.get("key")
    print("    新 Key = %s" % new_key)
    print()

    # ---- 2. 观察公网端口 ----
    print("[2] 等待 STUN 打洞，观察公网端口是否等于 %d ..." % FIXED_PORT)
    print()
    results = []
    for i in range(10):
        time.sleep(3)
        for r in get_rules(auth):
            if r.get("Name") == RULE_NAME:
                local = r.get("StunLocalAddr") or ""
                pub = r.get("PublicAddr") or ""
                print("    [%2d] 本地=%-12s 公网=%s" % (i + 1, local, pub or "(打洞中)"))
                if pub:
                    results.append((local, pub))
                break

    print()
    print("=" * 60)
    print(" 结论")
    print("=" * 60)
    if results:
        local_ports = set(x[0].split(":")[-1] for x in results)
        pub_ports = set(x[1].split(":")[-1] for x in results)
        print(" 本地端口集合: %s" % sorted(local_ports))
        print(" 公网端口集合: %s" % sorted(pub_ports))
        print()
        if len(pub_ports) == 1:
            p = list(pub_ports)[0]
            print(" [+] 公网端口稳定 = %s" % p)
            if p == str(FIXED_PORT):
                print(" [+] 且与设定端口一致 -> **端口保持型 NAT 确认**")
                print()
                print(" 固定访问地址: http://203.0.113.1:%s/" % p)
            else:
                print(" [!] 但和设定的 %d 不同（NAT 做了端口转换）" % FIXED_PORT)
                print("     虽然稳定，但实际端口是 %s" % p)
        else:
            print(" [-] 公网端口不固定: %s" % sorted(pub_ports))
            print("     说明 NAT 对固定本地端口也做随机映射")
    else:
        print(" [!] 没拿到公网地址，看上面日志")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())