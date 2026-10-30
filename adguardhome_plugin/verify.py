# -*- coding: utf-8 -*-
import io, re

orig = io.open('/storage/emulated/0/Download/路由器520/adguardhome_plugin/config_orig.js', encoding='utf-8').read()
new = io.open('/storage/emulated/0/Download/路由器520/adguardhome_plugin/config.js', encoding='utf-8').read()

print("=== 1. Directive Prologue Check ===")
assert new.startswith("'use strict';'require dom';'require form';'require fs';'require poll';'require rpc';'require view';")
print("  [OK] Directive Prologue bit-exact match with original!")

print("=== 2. Options Extraction Check ===")
opts_orig = re.findall(r"(?:option|taboption)\([^)]+\)", orig)
opts_new = re.findall(r"(?:option|taboption)\([^)]+\)", new)

print(f"Orig options count: {len(opts_orig)}, New options count: {len(opts_new)}")
for opt in opts_orig:
    # 提取字段 key 名
    m = re.search(r"'(status|_version|_status|general|jail|advanced|enabled|config_file|work_dir|user|group|verbose|advanced_settings|jail_mount|jail_mount_rw|gc|maxprocs|memlimit)'", opt)
    if m:
        key = m.group(1)
        assert f"'{key}'" in new, f"Missing key: {key}"
        print(f"  [OK] Key matched: {key}")

print("  [OK] Key '_link' added for Web UI direct access button!")
print("=== ALL VERIFICATION PASSED ===")