#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正 604 补丁中 nss_meminfo.c 的内存泄漏问题

问题
----
nss_meminfo_init_block_lists() 有统一清理标签：

    cleanup:
        nss_meminfo_free_block_lists(nss_ctx);
        return false;

函数体里已经 alloc 了 IMEM/SDRAM/UTCM 内存并挂到 block_lists 链表上。
我原来的补丁在两处校验失败时直接 `return false`，绕过了 cleanup，
已分配的内存不会释放 → 每次初始化失败都泄漏一批 DMA 内存。

修法：改成 goto cleanup。
"""
import os
import sys

PATCH = "package/qca/qca-nss-drv/patches/604-nss-bugon-no-panic.patch"

# 两处 return false 都要改（mtype == NSS_MEMINFO_MEMTYPE_UTCM_SHARED）
OLD1 = (
    '+\t\t\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: mtype == NSS_MEMINFO_MEMTYPE_UTCM_SHARED\\n", __FUNCTION__, __LINE__);\n'
    '+\t\t\t\treturn false;'
)

NEW1 = (
    '+\t\t\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: mtype == NSS_MEMINFO_MEMTYPE_UTCM_SHARED\\n", __FUNCTION__, __LINE__);\n'
    '+\t\t\t\tgoto cleanup;'
)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "/root/m520"
    p = os.path.join(root, PATCH)

    if not os.path.isfile(p):
        print("not found: %s" % p, file=sys.stderr)
        return 1

    with open(p, 'r', encoding='utf-8') as f:
        s = f.read()

    n = s.count(OLD1)
    if n == 0:
        if 'NSS_MEMINFO_MEMTYPE_UTCM_SHARED' in s and 'goto cleanup;' in s:
            print("already fixed")
            return 0
        print("pattern not found", file=sys.stderr)
        idx = s.find('NSS_MEMINFO_MEMTYPE_UTCM_SHARED')
        if idx > 0:
            print("context:\n%r" % s[max(0, idx - 100):idx + 400], file=sys.stderr)
        return 1

    s = s.replace(OLD1, NEW1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    print("fixed: nss_meminfo.c %d 处 return false -> goto cleanup (avoid DMA mem leak)" % n)
    return 0


if __name__ == "__main__":
    sys.exit(main())