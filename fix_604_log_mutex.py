#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正 604 补丁中 nss_log.c 的互斥锁泄漏问题

问题
----
nss_log_release() 的逻辑：

    mutex_lock(&nss_log_mutex);                 // 持有互斥锁
    nss_rbe[data->nss_id].ref_cnt--;
    if (unlikely(nss_rbe[data->nss_id].ref_cnt < 0)) {
        return 0;                               // ← 直接返回，锁没释放！
    }
    if (!nss_rbe[data->nss_id].ref_cnt) {
        wake_up(&nss_log_wq);
    }
    mutex_unlock(&nss_log_mutex);               // 正常路径释放
    kfree(data);
    return 0;

原代码是 BUG_ON，panic 了不会走到泄漏。
改成 return 0 后，mutex 永久不释放 →
任何后续 nss_log 的 open/read/release 都会永久阻塞在 mutex_lock，
表现为读取 /sys/kernel/debug/qca-nss-drv/logs 卡死，
甚至整个 NSS debugfs 操作卡住。

修法：先 unlock 再返回。
"""
import os
import sys

PATCH = "package/qca/qca-nss-drv/patches/604-nss-bugon-no-panic.patch"

OLD = (
    '+\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: nss_rbe[data->nss_id].ref_cnt < 0\\n", __FUNCTION__, __LINE__);\n'
    '+\t\treturn 0;'
)

NEW = (
    '+\t\tpr_err("NSS_BUGON_NOPANIC %s[%d]: nss_rbe[data->nss_id].ref_cnt < 0\\n", __FUNCTION__, __LINE__);\n'
    '+\t\tmutex_unlock(&nss_log_mutex);\n'
    '+\t\tkfree(data);\n'
    '+\t\treturn 0;'
)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "/root/m520"
    p = os.path.join(root, PATCH)

    if not os.path.isfile(p):
        print("not found: %s" % p, file=sys.stderr)
        return 1

    with open(p, 'r', encoding='utf-8') as f:
        s = f.read()

    if 'ref_cnt < 0' in s and 'mutex_unlock(&nss_log_mutex);' in s:
        print("already fixed")
        return 0

    if OLD not in s:
        print("pattern not found", file=sys.stderr)
        idx = s.find('ref_cnt < 0')
        if idx > 0:
            print("context:\n%r" % s[max(0, idx - 150):idx + 300], file=sys.stderr)
        return 1

    s = s.replace(OLD, NEW, 1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    print("fixed: nss_log.c ref_cnt<0 -> unlock mutex + kfree before return")
    return 0


if __name__ == "__main__":
    sys.exit(main())