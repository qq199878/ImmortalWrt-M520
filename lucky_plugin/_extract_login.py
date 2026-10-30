#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 lucky_main.js 提取登录加密逻辑"""
import re
import sys

path = "/storage/emulated/0/Download/路由器520/cfddns_plugin/_lm.js"
with open(path, "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

print("文件长度: %d" % len(js))
print()

# 1. 找 Co 函数（构造明文）
print("=" * 60)
print("1. 找 Co 函数（明文构造）")
print("=" * 60)
for m in re.finditer(r"Co\s*[=:]\s*", js):
    start = m.start()
    seg = js[start:start + 400]
    if "Account" in seg or "Password" in seg or "nonce" in seg:
        print("[@%d] %s" % (start, seg[:400]))
        print()

# 2. 找 challengeId/nonce/publicKey 校验那段完整代码
print("=" * 60)
print("2. 登录加密流程完整片段")
print("=" * 60)
idx = js.find("Login challenge is invalid")
if idx > 0:
    print(js[max(0, idx - 500):idx + 900])
else:
    print("未找到")

print()
print("=" * 60)
print("3. 找 Ro / Ls 加密函数")
print("=" * 60)
for name in ["Ro", "Ls", "Wu", "Gu", "Qu"]:
    for m in re.finditer(r"function\s+%s\s*\(" % name, js):
        start = m.start()
        print("[%s @%d] %s" % (name, start, js[start:start + 350]))
        print()

# 4. 找 PKCS1 / RSA 相关
print("=" * 60)
print("4. RSA 加密实现线索")
print("=" * 60)
for kw in ["setPublicKey", "encrypt", "PKCS1", "pkcs1", "RSAES"]:
    idxs = [m.start() for m in re.finditer(re.escape(kw), js)][:3]
    for i in idxs:
        print("[%s @%d] ...%s..." % (kw, i, js[max(0, i - 120):i + 180].replace("\n", " ")))
        print()