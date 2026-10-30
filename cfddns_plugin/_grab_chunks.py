#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Lucky 面板批量抓取 JS chunk，找 DDNS 任务字段结构"""
import os
import re
import urllib.request

BASE = "http://192.168.1.1:16603"
OUT = "_chunks"
os.makedirs(OUT, exist_ok=True)


def fetch(path):
    try:
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        return ""


main = open("_lm2.js", encoding="utf-8", errors="replace").read()

# 抓所有 js 文件名
names = set(re.findall(r'lucky_[a-zA-Z0-9_-]+-[A-Za-z0-9_-]+\.js', main))
# 再加上静态目录里所有可能的 chunk（从 main 里的动态 import 映射）
names |= set(re.findall(r'"([a-zA-Z0-9_/-]+\.js)"', main))
print("待抓文件数:", len(names))

hit = []
for n in sorted(names):
    path = n if n.startswith("/") else "/static/js/" + n
    body = fetch(path)
    if not body:
        continue
    fn = os.path.join(OUT, os.path.basename(n))
    with open(fn, "w", encoding="utf-8") as f:
        f.write(body)
    if "cloudflare" in body.lower() or "CloudFlare" in body:
        hit.append((fn, len(body)))

print()
print("=== 含 cloudflare 的文件 ===")
for fn, sz in hit:
    print("  %-50s %d" % (fn, sz))
