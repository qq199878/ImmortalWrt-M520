#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lucky STUN 修复：穿透目标 80 -> 443
原因：80 是 nginx 的 redirect2ssl 端口，只返回 302 跳转（且丢端口）
      443 才是 LuCI 真正的 HTTPS 服务端口
"""
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

RULE_NAME = "LuCI管理页"
TARGET_ADDR = "192.168.1.1"
NEW_TARGET_PORT = 443      # 关键：改成 443


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


def get_rule(auth, name):
    st, raw = http("GET", "/api/stunrulelist_lite", headers=auth)
    for it in (json.loads(raw).get("list") or []):
        if it.get("Name") == name:
            key = it.get("Key")
            st2, raw2 = http("GET", "/api/stun/%s" % key, headers=auth)
            return json.loads(raw2).get("rule")
    return None


def main():
    auth = login()
    print("[+] 登录成功")

    rule = get_rule(auth, RULE_NAME)
    if not rule:
        raise SystemExit("[X] 找不到规则 %s" % RULE_NAME)

    print("[0] 修改前")
    print("    Key          = %s" % rule.get("Key"))
    print("    ListenPort   = %s" % rule.get("ListenPort"))
    print("    TargetAddr   = %s" % rule.get("TargetAddressList"))
    print("    TargetPort   = %s" % rule.get("TargetPort"))
    print()

    # 只改目标端口
    rule["TargetAddressList"] = [TARGET_ADDR]
    rule["TargetPort"] = NEW_TARGET_PORT

    print("[1] PUT 更新 -> 目标 %s:%d" % (TARGET_ADDR, NEW_TARGET_PORT))
    st, raw = http("PUT", "/api/stunrule", data=rule, headers=auth)
    try:
        res = json.loads(raw)
    except Exception:
        res = {"raw": raw[:200].decode("utf-8", "replace")}
    print("    HTTP %s  ret=%s  msg=%s" % (st, res.get("ret"), res.get("msg")))
    if res.get("ret") != 0:
        print("    原始: %s" % res)
        return 1
    print()

    print("[2] 等待重新打洞...")
    pub = ""
    for i in range(10):
        time.sleep(3)
        r = get_rule(auth, RULE_NAME)
        if not r:
            continue
        pub = r.get("PublicAddr") or ""
        stt = r.get("Statistics") or {}
        print("    [%2d] 本地=%s 公网=%s 转发=%s" % (
            i + 1, r.get("StunLocalAddr"), pub or "(打洞中)",
            stt.get("ForwardingActive")))
        if pub:
            break

    if not pub:
        print("[X] 没拿到公网地址")
        return 1

    print()
    print("[3] 外网实测")
    for scheme in ("http", "https"):
        url = "%s://%s/" % (scheme, pub)
        cmd = "curl -sk -o /dev/null -w '%%{http_code} %%{time_total}s' --max-time 15 '%s'" % url
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        print("    %-5s %s -> %s" % (scheme.upper(), url, (r.stdout or r.stderr).strip()))

    print()
    print("=" * 60)
    print(" 访问地址: https://%s/" % pub)
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())