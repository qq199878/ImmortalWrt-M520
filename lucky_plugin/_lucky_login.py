#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lucky STUN 自动配置工具
用途：通过 API 登录 Lucky 并创建 STUN 内网穿透规则

登录流程（逆向自 lucky_main.js）：
  1. 生成随机 hex 作为 Lucky-Login-Session 请求头
  2. GET /api/login/challenge 拿 challengeId / nonce / publicKey
  3. 明文 = JSON({account, password, twoFA:"", challengeId, nonce})
  4. RSA PKCS1 v1.5 加密明文 -> cipherText
  5. POST /api/login {challengeId, cipherText}
"""
import base64
import json
import os
import secrets
import sys
import urllib.request
import urllib.error

BASE = "http://192.168.1.1:16603"
ACCOUNT = "YOUR_ACCOUNT"
PASSWORD = "YOUR_PASSWORD"


def http(method, path, data=None, headers=None, timeout=15):
    """极简 HTTP 客户端"""
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
            raw = r.read()
            return r.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, str(e).encode()


def rsa_encrypt(public_key_pem, plaintext):
    """RSA PKCS1 v1.5 加密，返回 base64 字符串"""
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    ct = key.encrypt(
        plaintext.encode("utf-8"),
        padding.PKCS1v15(),
    )
    return base64.b64encode(ct).decode("ascii")


def login():
    """登录，返回 (成功?, session_headers, 原始响应)"""
    # 1. 随机会话 ID（hex 字符串）
    sid = secrets.token_hex(32)
    hdrs = {"Lucky-Login-Session": sid}

    # 2. 拿 challenge
    st, raw = http("GET", "/api/login/challenge", headers=hdrs)
    print("[1] GET /api/login/challenge -> HTTP %s" % st)
    if st != 200:
        print("    响应: %s" % raw[:300])
        return False, None, None
    try:
        ch = json.loads(raw)
    except Exception:
        print("    解析失败: %s" % raw[:300])
        return False, None, None

    if ch.get("ret") not in (None, 0) and "challengeId" not in ch:
        print("    挑战获取失败: %s" % raw[:300])
        return False, None, None

    print("    challengeId = %s" % ch.get("challengeId"))
    print("    nonce       = %s" % ch.get("nonce"))
    print("    expiresIn   = %s 秒" % ch.get("expiresIn"))

    # 3. 构造明文（字段顺序必须与前端一致）
    payload = {
        "account": ACCOUNT,
        "password": PASSWORD,
        "twoFA": "",
        "challengeId": ch["challengeId"],
        "nonce": ch["nonce"],
    }
    plaintext = json.dumps(payload, separators=(",", ":"))

    # 4. RSA 加密
    try:
        cipher = rsa_encrypt(ch["publicKey"], plaintext)
    except Exception as e:
        print("    [X] RSA 加密失败: %s" % e)
        return False, None, None
    print("[2] RSA 加密完成，密文长度 %d" % len(cipher))

    # 5. 提交登录
    st2, raw2 = http(
        "POST",
        "/api/login",
        data={"challengeId": ch["challengeId"], "cipherText": cipher},
        headers=hdrs,
    )
    print("[3] POST /api/login -> HTTP %s" % st2)
    try:
        res = json.loads(raw2)
    except Exception:
        print("    响应: %s" % raw2[:300])
        return False, None, None

    print("    返回: %s" % json.dumps(res, ensure_ascii=False)[:300])

    if res.get("ret") == 0:
        # 登录成功，令牌可能在响应体或 Set-Cookie
        token = res.get("token") or res.get("Token") or ""
        print("[+] 登录成功！token=%s" % (token[:40] if token else "(无)"))
        auth = dict(hdrs)
        if token:
            auth["Lucky-Admin-Token"] = token
        return True, auth, res

    print("[-] 登录失败: %s" % res.get("msg"))
    return False, None, res


if __name__ == "__main__":
    ok, auth, res = login()
    print()
    print("结果: %s" % ("成功" if ok else "失败"))
    if auth:
        print("认证头: %s" % json.dumps(auth, ensure_ascii=False))