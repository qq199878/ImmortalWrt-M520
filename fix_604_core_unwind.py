#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正 604 补丁中 nss_core.c 的描述符泄漏问题

问题
----
nss_core_send_buffer_nr_frags() 的逻辑：

    nss_core_write_one_descriptor(desc, ...);   // 已写入第 1 个描述符到 ring
    NSS_CORE_DMA_CACHE_MAINT(...);
    nr_frags = skb_shinfo(nbuf)->nr_frags;
    if (unlikely(nr_frags > MAX_SKB_FRAGS)) {
        return -1;                              // ← 描述符已写，但没回滚！
    }
    for (i = 0; i < nr_frags; i++) {
        buffer = skb_frag_dma_map(...);
        if (unlikely(dma_mapping_error(...))) {
            nss_core_send_unwind_dma(..., i + 1, ...);   // ← 这里正确回滚了
            return -(i + 1);
        }
    }

原代码是 BUG_ON，panic 了不会走到泄漏。
改成 return -1 后，描述符 ring 里留了一个脏描述符，
NSS 固件会去处理它 → DMA 读到非法地址 → 数据面异常或崩溃。

修法：照抄下面分支的做法，先回滚已写的描述符再返回。
"""
import os
import sys

PATCH = "package/qca/qca-nss-drv/patches/604-nss-bugon-no-panic.patch"

OLD = (
    '+\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: nr_frags > MAX_SKB_FRAGS\\n", __FUNCTION__, __LINE__);\n'
    '+\t\treturn -1;'
)

NEW = (
    '+\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: nr_frags > MAX_SKB_FRAGS\\n", __FUNCTION__, __LINE__);\n'
    '+\t\tnss_core_send_unwind_dma(nss_ctx->dev, desc_if, hlos_index, 1, is_fraglist);\n'
    '+\t\treturn -1;'
)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "/root/m520"
    p = os.path.join(root, PATCH)

    if not os.path.isfile(p):
        print("not found: %s" % p, file=sys.stderr)
        return 1

    with open(p, 'r', encoding='utf-8') as f:
        s = f.read()

    if 'nr_frags > MAX_SKB_FRAGS' in s and 'unwind_dma(nss_ctx->dev, desc_if, hlos_index, 1' in s:
        print("already fixed")
        return 0

    if OLD not in s:
        print("pattern not found", file=sys.stderr)
        idx = s.find('nr_frags > MAX_SKB_FRAGS')
        if idx > 0:
            print("context:\n%r" % s[max(0, idx - 120):idx + 320], file=sys.stderr)
        return 1

    s = s.replace(OLD, NEW, 1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    print("fixed: nss_core.c nr_frags -> unwind descriptor before return")
    return 0


if __name__ == "__main__":
    sys.exit(main())