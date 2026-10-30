#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""查询 Lucky STUN 规则实际状态（调试用）"""
import base64
import json
import secrets
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
    print("[+] 登录成功\n")

    print("=" * 60)
    print("GET /api/stunrulelist 原始返回（前 3000 字符）")
    print("=" * 60)
    st, raw = http("GET", "/api/stunrulelist", headers=auth)
    print("HTTP %s, 长度 %d" % (st, len(raw)))
    txt = raw.decode("utf-8", errors="replace")
    try:
        obj = json.loads(txt)
        print(json.dumps(obj, ensure_ascii=False, indent=2)[:3000])
    except Exception:
        print(txt[:3000])

    print()
    print("=" * 60)
    print("GET /api/stunrulelist_lite 原始返回")
    print("=" * 60)
    st, raw = http("GET", "/api/stunrulelist_lite", headers=auth)
    print("HTTP %s, 长度 %d" % (st, len(raw)))
    txt = raw.decode("utf-8", errors="replace")
    try:
        obj = json.loads(txt)
        print(json.dumps(obj, ensure_ascii=False, indent=2)[:2500])
    except Exception:
        print(txt[:2500])

    print()
    print("=" * 60)
    print("GET /api/stun/w6kBidHg6p3uKZHv 单条详情")
    print("=" * 60)
    st, raw = http("GET", "/api/stun/w6kBidHg6p3uKZHv", headers=auth)
    print("HTTP %s" % st)
    txt = raw.decode("utf-8", errors="replace")
    try:
        obj = json.loads(txt)
        print(json.dumps(obj, ensure_ascii=False, indent=2)[:2500])
    except Exception:
        print(txt[:2500])


if __name__ == "__main__":
    main()