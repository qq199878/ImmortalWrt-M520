#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lucky STUN 当前状态体检 + 外网连通性测试"""
import base64
import json
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE = "http://192.168.1.1:16603"
ACCOUNT = "YOUR_ACCOUNT"
PASSWORD = "YOUR_PASSWORD"


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


def main():
    auth = login()
    print("[+] 登录成功")
    print()

    st, raw = http("GET", "/api/stunrulelist", headers=auth)
    data = json.loads(raw)
    print("ModuleEnable = %s" % data.get("ModuleEnable"))
    print()

    for it in data.get("list") or []:
        print("=" * 56)
        print(" Name          = %s" % it.get("Name"))
        print(" Key           = %s" % it.get("Key"))
        print(" Enable        = %s" % it.get("Enable"))
        print(" StunType      = %s" % it.get("StunType"))
        print(" ListenPort    = %s" % it.get("ListenPort"))
        print(" StunLocalAddr = %s" % it.get("StunLocalAddr"))
        print(" PublicAddr    = %s" % it.get("PublicAddr"))
        print(" Target        = %s:%s" % (
            it.get("TargetAddressList"), it.get("TargetPort")))
        print(" DisableFwd    = %s" % it.get("DisablePortForward"))
        print(" AutoFirewall  = %s" % it.get("AutoOptionsFirewall"))
        print(" StunServers   = %s" % (it.get("StunServerList") or []))
        stt = it.get("Statistics") or {}
        print(" ForwardingActive = %s" % stt.get("ForwardingActive"))
        print(" PublicAddrHistroy = %s" % (it.get("PublicAddrHistroy") or [])[-3:])
        print("=" * 56)
        pub = it.get("PublicAddr") or ""
        if pub:
            print()
            print("[*] 外网连通性实测 %s" % pub)
            for scheme in ("http", "https"):
                url = "%s://%s/" % (scheme, pub)
                cmd = ("curl -sk -o /dev/null -w 'http=%{http_code} time=%{time_total}s' "
                       "--max-time 12 '%s'" % url)
                r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                print("    %-6s -> %s" % (scheme.upper(), (r.stdout or r.stderr).strip()))
    return 0


if __name__ == "__main__":
    sys.exit(main())