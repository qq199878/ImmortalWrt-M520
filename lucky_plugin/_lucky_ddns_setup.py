#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lucky 自带 DDNS 配置：home.example.com -> 公网 IPv4

字段结构来自逆向 lucky_taskFormDefaults-hQXB-AFB.js：
  Records[] 每个元素 = {SyncRecordData: {type, remark, fullDomainName, ttl, ipv4Address}}
  DNS = {Name: "cloudflare", ID: "", Secret: <Token>, ...}
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

CF_TOKEN = "YOUR_CF_TOKEN"
DOMAIN = "home.example.com"
TASK_NAME = "家里路由器"


def http(method, path, data=None, headers=None, timeout=30):
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


def build_task():
    """按 Lucky 前端默认结构构造任务"""
    return {
        "TaskName": TASK_NAME,
        "TaskKey": "",
        "TaskType": "IPv4",
        "Enable": True,
        "Expanded": True,
        "IPSectionExpanded": True,
        "DiaglogShowMode": "simple",
        "FirstCheckDelay": 16,
        "Intervals": 36,
        "HttpClientTimeout": 15,
        "InsecureSkipVerify": False,
        "DNS": {
            "Name": "cloudflare",
            "ID": "",
            "Secret": CF_TOKEN,
            "ForceInterval": 3600,
            "ResolverDoaminCheck": True,
            "HttpClientProxyType": "",
            "HttpClientProxyAddr": "",
            "HttpClientProxyUser": "",
            "HttpClientProxyPassword": "",
            "CallAPINetwork": "",
            "Callback": {
                "URL": "", "Method": "get", "Headers": [""],
                "RequestBody": "", "Server": "other",
                "DisableCallbackSuccessContentCheck": False,
                "CallbackSuccessContent": [],
            },
        },
        "GlobalWebhook": False,
        "WebhookEnable": False,
        "IngoreWebhookVariablesNotFound": False,
        "IngoreWebhookVariablesNotFoundList": "",
        "WebhookURL": "",
        "WebhookMethod": "get",
        "WebhookNetworkType": "",
        "WebhookHeaders": [],
        "WebhookRequestBody": "",
        "WebhookDisableCallbackSuccessContentCheck": False,
        "WebhookSuccessContent": [],
        "WebhookProxy": "",
        "WebhookProxyAddr": "",
        "WebhookProxyUser": "",
        "WebhookProxyPassword": "",
        "RetryCount": 0,
        "RetryInterval": 500,
        "TTL": "0",
        # ---- IPv6 关闭 ----
        "V6QueryIPEnable": False,
        "V6QueryIPType": "url",
        "V6QueryUrl": "https://api6.ipify.org",
        "V6NetInterface": "",
        "V6NetInterfaceIPReg": "",
        "V6NetInterfaceSmart": False,
        "V6NetInterfacePreference": "stable",
        "V6NetInterfaceVerify": True,
        "V6NetInterfaceProbeTargets": "www.qq.com:443",
        "V6GetIPScript": "",
        "V6DUID": "",
        # ---- IPv4 开启，用 URL 探测公网 IP ----
        "V4QueryIPEnable": True,
        "V4QueryIPType": "url",
        "V4QueryUrl": "https://ip.3322.net",
        "V4NetInterface": "",
        "V4NetInterfaceIPReg": "",
        "V4GetIPScript": "",
        # ---- 域名记录 ----
        "Records": [
            {
                "SyncRecordData": {
                    "type": "A",
                    "remark": "家里路由器公网IP",
                    "fullDomainName": DOMAIN,
                    "ttl": 0,
                    "ipv4Address": "{ipv4Addr}",
                }
            }
        ],
    }


def list_tasks(auth):
    st, raw = http("GET", "/api/ddnstasklist", headers=auth)
    try:
        return json.loads(raw).get("data") or []
    except Exception:
        return []


def main():
    auth = login()
    print("[+] 登录成功")
    print()

    tasks = list_tasks(auth)
    print("[0] 现有任务数: %d" % len(tasks))
    for t in tasks:
        print("    %s  key=%s" % (t.get("TaskName"), t.get("TaskKey")))
    print()

    task = build_task()

    print("[1] 创建 DDNS 任务")
    print("    域名   = %s" % DOMAIN)
    print("    服务商 = cloudflare")
    print("    类型   = A (IPv4)")
    print("    探测源 = https://ip.3322.net")
    print()

    st, raw = http("POST", "/api/ddns", data=task, headers=auth)
    txt = raw.decode("utf-8", "replace")
    print("    HTTP %s" % st)
    print("    返回: %s" % txt[:500])
    print()

    if '"ret":0' not in txt and '"ret": 0' not in txt:
        print("[X] 创建失败")
        return 1

    print("[2] 等待首次同步（首次延迟 16s）...")
    for i in range(12):
        time.sleep(5)
        tasks = list_tasks(auth)
        for t in tasks:
            if t.get("TaskName") == TASK_NAME:
                key = t.get("TaskKey") or t.get("Key")
                print("    [%2d] key=%s enable=%s" % (i + 1, key, t.get("Enable")))
                break

    print()
    print("[3] 查询任务详情")
    tasks = list_tasks(auth)
    for t in tasks:
        if t.get("TaskName") == TASK_NAME:
            key = t.get("TaskKey") or t.get("Key")
            st, raw = http("GET", "/api/ddns/task/%s" % key, headers=auth)
            try:
                d = json.loads(raw)
                print(json.dumps(d, ensure_ascii=False, indent=1)[:3000])
            except Exception:
                print(raw[:800])
            break

    return 0


if __name__ == "__main__":
    sys.exit(main())