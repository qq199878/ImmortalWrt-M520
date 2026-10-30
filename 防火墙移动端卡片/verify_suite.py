# -*- coding: utf-8 -*-
import io, re, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PAIRS = [
    ('forwards_orig.js', 'forwards.js'),
    ('rules_orig.js', 'rules.js'),
    ('snats_orig.js', 'snats.js')
]

for orig_name, new_name in PAIRS:
    orig_path = os.path.join(BASE_DIR, orig_name)
    new_path = os.path.join(BASE_DIR, new_name)

    orig = io.open(orig_path, encoding='utf-8').read()
    new = io.open(new_path, encoding='utf-8').read()

    print(f"=== VERIFYING {new_name} ===")
    
    # 1. 检查头部 require 是否位于第 1 行
    req_anchor = "'require tools.widgets as widgets';"
    assert new.startswith("'use strict';'require view';"), "Must start with strict & require!"
    assert req_anchor in new[:250], "Require header must be at top!"
    print("  [OK] Directive Prologue require header intact and at the very top")

    # 2. 检查 options 匹配度
    pattern = r"s\.(?:option|taboption)\([^;]+\);"
    orig_opts = re.findall(pattern, orig)
    new_opts = re.findall(pattern, new)
    print(f"  [COUNT] orig options: {len(orig_opts)}, new options: {len(new_opts)}")
    assert len(orig_opts) == len(new_opts), f"Option count mismatch! {len(orig_opts)} vs {len(new_opts)}"
    
    for i in range(len(orig_opts)):
        assert orig_opts[i] == new_opts[i], f"Option #{i} changed!\nOrig: {orig_opts[i]}\nNew:  {new_opts[i]}"
    print("  [OK] All options 100% bit-exact match with original!")

    # 3. 检查关键标志
    assert 's.addremove' in new and 's.anonymous' in new and 's.sortable' in new
    assert 'return m.render().then(function(node){enhance(node,s);return node;});' in new
    print("  [OK] Render promise enhance hook correctly attached\n")

print("=== ALL 3 FIREWALL VIEWS PASSED 100% VERIFICATION ===")