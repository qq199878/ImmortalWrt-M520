#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正 604 补丁中 nss_n2h.c 的返回值问题

问题
----
nss_n2h_buf_pool_cfg() 的逻辑：

    do {
        down(&nss_n2h_bufcp[core_num].sem);      // 持有信号量
        for (...) {
            kern_addr = kzalloc(...);
            if (!kern_addr) {
                if (!page_count) {
                    return NSS_TX_FAILURE_BAD_PARAM;   // ← 直接返回，信号量未释放！
                }
                break;
            }
            ...
        }
        ...
        up(&nss_n2h_bufcp[core_num].sem);        // 正常路径释放
    } while (num_pages);
    return NSS_SUCCESS;
failure:
    up(&nss_n2h_bufcp[core_num].sem);            // 失败路径释放
    return NSS_FAILURE;

原代码这里是 BUG_ON，panic 了所以不会走到泄漏。改成 return 后，
信号量不释放 → 后续所有 buf_pool 配置永久阻塞 → NSS 数据面卡死。

修法：改成 goto failure，走已有的释放路径。
"""
import os
import sys

PATCH = "package/qca/qca-nss-drv/patches/604-nss-bugon-no-panic.patch"

OLD = (
    '+\t\t\t\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: !page_count\\n", __FUNCTION__, __LINE__);\n'
    '+\t\t\t\t\treturn NSS_TX_FAILURE_BAD_PARAM;'
)

NEW = (
    '+\t\t\t\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: !page_count\\n", __FUNCTION__, __LINE__);\n'
    '+\t\t\t\t\tgoto failure;'
)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "/root/m520"
    p = os.path.join(root, PATCH)

    if not os.path.isfile(p):
        print("not found: %s" % p, file=sys.stderr)
        return 1

    with open(p, 'r', encoding='utf-8') as f:
        s = f.read()

    if 'goto failure;' in s and '!page_count' in s:
        print("already fixed")
        return 0

    if OLD not in s:
        print("pattern not found", file=sys.stderr)
        # 打印附近内容便于排查
        idx = s.find('!page_count')
        if idx > 0:
            print("context:\n%s" % s[max(0, idx - 200):idx + 300], file=sys.stderr)
        return 1

    s = s.replace(OLD, NEW, 1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    print("fixed: nss_n2h.c !page_count -> goto failure (avoid semaphore leak)")
    return 0


if __name__ == "__main__":
    sys.exit(main())