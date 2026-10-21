#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 604 补丁：NSS drv 内 BUG_ON 改为"打印 + 安全返回"（防 panic 无限重启）

设计说明
--------
C 函数返回类型靠正则猜极不可靠（星号位置、多行签名、注释干扰都会出错，
猜错就会生成 `return;` 但函数返回非 void，直接编译失败）。

因此本脚本采用**显式映射表**：每一处 BUG_ON 的返回语句都人工确认后写死。
这样虽然不"智能"，但绝对可靠 —— 25 处改动，每处都可追溯。

映射依据（已逐个 grep 函数签名确认）：

  nss_dynamic_interface.c L43   static void  nss_dynamic_interface_handler      -> return;
  nss_shaper.c L57/86           void *       nss_shaper_register_shaper_bounce_interface -> return NULL;
  nss_shaper.c L118/130         void         nss_shaper_unregister_shaper_bounce_interface -> return;
  nss_shaper.c L162/191         void *       nss_shaper_register_shaper_bounce_bridge -> return NULL;
  nss_shaper.c L224/236         void         nss_shaper_unregister_shaper_bounce_bridge -> return;
  nss_shaper.c L277             nss_tx_status_t nss_shaper_bounce_interface_packet -> return NSS_TX_FAILURE_BAD_PARAM;
  nss_shaper.c L321             nss_tx_status_t nss_shaper_bounce_bridge_packet    -> return NSS_TX_FAILURE_BAD_PARAM;
  nss_l2tpv2.c L85              static void  nss_l2tpv2_handler                     -> return;
  nss_trustsec_tx.c L42         static void  nss_trustsec_tx_handler                -> return;
  nss_ipsec.c L143              static void  nss_ipsec_msg_handler                  -> return;
  nss_ipsec_cmn.c L499          struct nss_ctx_instance * nss_ipsec_cmn_notify_register -> return NULL;
  nss_wifili.c L50              static void  nss_wifili_handler                     -> return;
  nss_pppoe.c L145              static void  nss_pppoe_handler                      -> return;
  nss_dtls_cmn.c L353           struct nss_ctx_instance * nss_dtls_cmn_notify_register -> return NULL;
  nss_dtls_cmn.c L376           void         nss_dtls_cmn_notify_unregister        -> return;
  nss_wifi.c L42                static void  nss_wifi_handler                       -> return;
  nss_wifi_vdev.c L29           static void  nss_wifi_vdev_handler                  -> return;
  nss_wifi_vdev.c L202          nss_tx_status_t nss_wifi_vdev_tx_buf               -> return NSS_TX_FAILURE_BAD_PARAM;
  nss_ipv6.c L80                static void  nss_ipv6_rx_msg_handler                -> return;
  nss_n2h.c L70                 static void  nss_n2h_interface_handler              -> return;
  nss_n2h.c L1198               nss_tx_status_t nss_n2h_buf_pool_cfg                -> return NSS_TX_FAILURE_BAD_PARAM;

注意 nss_tx_status_t 的 0 是 NSS_TX_SUCCESS，不能 return 0（会误报成功），
必须返回 NSS_TX_FAILURE_BAD_PARAM。

BUG_ON(false) 处理：
  nss_shaper.c 里的 BUG_ON(false) 位于"非法 if_num"的错误分支内，
  原意是"到此必炸"。改为无条件打印 + 返回，不能写成 if (false)
  （条件永不成立 = 错误处理被彻底删除，会带着非法参数继续跑）。

用法
----
    python3 gen_nss_patch_604.py <nss_drv_build_dir> [--dry]

产物
----
    604-nss-bugon-no-panic.patch
"""
import os
import sys
import shutil
import subprocess

PATCH_NAME = "604-nss-bugon-no-panic.patch"

# (文件名, 行号, 返回语句)
# 行号以"原始未打补丁"源码为准
MAP = [
    ("nss_dynamic_interface.c", 43,   "return;"),
    ("nss_shaper.c",            57,   "return NULL;"),
    ("nss_shaper.c",            86,   "return NULL;"),
    ("nss_shaper.c",            118,  "return;"),
    ("nss_shaper.c",            130,  "return;"),
    ("nss_shaper.c",            162,  "return NULL;"),
    ("nss_shaper.c",            191,  "return NULL;"),
    ("nss_shaper.c",            224,  "return;"),
    ("nss_shaper.c",            236,  "return;"),
    ("nss_shaper.c",            277,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_shaper.c",            321,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_l2tpv2.c",            85,   "return;"),
    ("nss_trustsec_tx.c",       42,   "return;"),
    ("nss_ipsec.c",             143,  "return;"),
    ("nss_ipsec_cmn.c",         499,  "return NULL;"),
    ("nss_wifili.c",            50,   "return;"),
    ("nss_pppoe.c",             145,  "return;"),
    ("nss_dtls_cmn.c",          353,  "return NULL;"),
    ("nss_dtls_cmn.c",          376,  "return;"),
    ("nss_wifi.c",              42,   "return;"),
    ("nss_wifi_vdev.c",         29,   "return;"),
    ("nss_wifi_vdev.c",         202,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_ipv6.c",              80,   "return;"),
    ("nss_n2h.c",               70,   "return;"),
    ("nss_n2h.c",               1198, "return NSS_TX_FAILURE_BAD_PARAM;"),

    # ---- 第二批：其余 51 处（2026-10-22 补全）----
    # nss_ipv4.c 是 IPv4 接收主路径，最关键
    ("nss_ipv4.c",              81,   "return;"),
    ("nss_ipv4_reasm.c",        33,   "return;"),
    ("nss_ipv6_reasm.c",        32,   "return;"),
    ("nss_lag.c",               155,  "return;"),
    ("nss_gre.c",               90,   "return;"),
    ("nss_gre_tunnel.c",        66,   "return;"),
    ("nss_gre_tunnel.c",        180,  "return 0;"),
    ("nss_gre_tunnel.c",        199,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_gre_tunnel.c",        227,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_gre_tunnel.c",        319,  "return NULL;"),
    ("nss_gre_tunnel.c",        364,  "return;"),
    ("nss_gre_redir.c",         175,  "return;"),
    ("nss_gre_redir_lag_ds.c",  129,  "return;"),
    ("nss_gre_redir_lag_us.c",  201,  "return;"),
    ("nss_portid.c",            52,   "return;"),
    ("nss_ppe.c",               248,  "return;"),
    ("nss_bridge.c",            42,   "return;"),
    ("nss_capwap.c",            285,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_capwap.c",            286,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_capwap.c",            287,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_capwap.c",            324,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_dtls.c",              160,  "return;"),
    ("nss_dtls.c",              261,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_dtls.c",              279,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_dtls.c",              353,  "return NULL;"),
    ("nss_dtls.c",              397,  "return;"),
    ("nss_pvxlan.c",            172,  "return;"),
    ("nss_pvxlan.c",            291,  "return NSS_TX_FAILURE_BAD_PARAM;"),
    ("nss_tunipip6.c",          49,   "return;"),
    ("nss_tun6rd.c",            31,   "return;"),
    ("nss_map_t.c",             156,  "return;"),
    ("nss_pptp.c",              175,  "return;"),
    ("nss_sjack.c",             32,   "return;"),
    ("nss_tstamp.c",            144,  "return;"),
    ("nss_tstamp.c",            152,  "return;"),
    ("nss_log.c",               158,  "return 0;"),
    ("nss_log.c",               328,  "return;"),
    ("nss_meminfo.c",           363,  "return false;"),
    ("nss_meminfo.c",           370,  "return false;"),
    ("nss_freq.c",              78,   "return false;"),
    ("nss_core.c",              228,  "return;"),
    ("nss_core.c",              235,  "return;"),
    ("nss_core.c",              260,  "return;"),
    ("nss_core.c",              267,  "return;"),
    ("nss_core.c",              289,  "return;"),
    ("nss_core.c",              2574, "return -1;"),
    ("nss_core.c",              2745, "return -1;"),
    ("nss_init.c",              174,  "return 0;"),
    ("nss_hal/ipq806x/nss_hal_pvt.c", 371, "return 0;"),
]


def build_block(indent, expr, ret):
    """生成替换代码块

    对带资源清理的函数（信号量/互斥锁/描述符/DMA 内存），
    返回值不能直接 return，必须先释放资源再返回。
    """
    if expr in ('false', '0'):
        # 不可达分支：无条件打印 + 返回
        return (
            '%spr_err("NSS_BUGON_NOPANIC %%s[%%d]: unreachable branch\\n", __FUNCTION__, __LINE__);\n'
            '%s%s'
        ) % (indent, indent, ret)

    safe = expr.replace('"', "'")
    body = (
        '%sif (unlikely(%s)) {\n'
        '%s\tpr_err("NSS_BUGON_NOPANIC %%s[%%d]: %s\\n", __FUNCTION__, __LINE__);\n'
    ) % (indent, expr, indent, safe)

    # ---- 带资源清理的特殊场景 ----
    # 1) nss_n2h.c: down(&sem) 之后失败 → 必须走 failure 标签释放信号量
    if '!page_count' in expr:
        body += '%s\tgoto failure;\n' % indent
    # 2) nss_log.c: mutex_lock 之后失败 → 必须先 unlock 并 kfree
    elif 'ref_cnt < 0' in expr:
        body += '%s\tmutex_unlock(&nss_log_mutex);\n' % indent
        body += '%s\tkfree(data);\n' % indent
        body += '%s\treturn 0;\n' % indent
    # 3) nss_meminfo.c: 已有 cleanup 标签 → 必须走 cleanup 释放 DMA 内存
    elif 'NSS_MEMINFO_MEMTYPE_UTCM_SHARED' in expr:
        body += '%s\tgoto cleanup;\n' % indent
    # 4) nss_core.c nr_frags: 描述符已写入 ring → 必须先回滚 DMA
    elif 'nr_frags > MAX_SKB_FRAGS' in expr:
        body += '%s\tnss_core_send_unwind_dma(nss_ctx->dev, desc_if, hlos_index, 1, is_fraglist);\n' % indent
        body += '%s\treturn -1;\n' % indent
    else:
        body += '%s\t%s\n' % (indent, ret)

    body += '%s}' % indent
    return body


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv

    if not args:
        print("usage: gen_nss_patch_604.py <nss_drv_build_dir> [--dry]", file=sys.stderr)
        return 2

    bd = args[0].rstrip('/')
    if not os.path.isdir(bd):
        print("not a dir: %s" % bd, file=sys.stderr)
        return 1

    # 按文件分组
    byfile = {}
    for name, lineno, ret in MAP:
        byfile.setdefault(name, []).append((lineno, ret))

    ok = 0
    bad = []
    changed_files = []

    for name, items in byfile.items():
        p = os.path.join(bd, name)
        if not os.path.isfile(p):
            print("missing file: %s" % name, file=sys.stderr)
            bad.append((name, 0, 'file missing'))
            continue

        with open(p, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.read().split('\n')

        # 从大到小替换，避免行号偏移
        for lineno, ret in sorted(items, key=lambda x: -x[0]):
            i = lineno - 1
            if i < 0 or i >= len(lines):
                bad.append((name, lineno, 'line out of range'))
                continue

            ln = lines[i]
            if 'BUG_ON' not in ln or 'BUILD_BUG_ON' in ln or 'NSS_BUGON' in ln:
                bad.append((name, lineno, 'not a BUG_ON line: %s' % ln.strip()[:50]))
                continue

            # 提取缩进
            indent = ln[:len(ln) - len(ln.lstrip())]
            s = ln.strip()

            # ---- 处理跨行 BUG_ON ----
            # 形如：
            #   BUG_ON(((a) || (b)) &&
            #           c);
            # 判断依据：去掉缩进后以 '(' 开头但整行没有 ';'
            span = 1
            if not s.endswith(';'):
                buf = s
                j = i + 1
                while j < len(lines) and j < i + 6:
                    nxt = lines[j].strip()
                    buf = buf + ' ' + nxt
                    span += 1
                    if ';' in nxt:
                        break
                    j += 1
                s = buf

            # 现在 s 应形如 BUG_ON(EXPR);
            if not (s.startswith('BUG_ON(') and s.endswith(');')):
                bad.append((name, lineno, 'unparsable: %s' % s[:60]))
                continue

            expr = s[len('BUG_ON('):-2].strip()

            block = build_block(indent, expr, ret)
            # 用 block 替换 i..i+span-1 这几行
            lines[i:i + span] = [block]
            ok += 1
            print("%s L%-5d %-42s -> %s%s" % (
                name, lineno, expr[:42], ret, ' [跨%d行]' % span if span > 1 else ''))

        if not dry:
            bak = p + '.orig604'
            if not os.path.exists(bak):
                shutil.copy2(p, bak)
            with open(p, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            changed_files.append(name)

    print("\n成功 %d 处，失败 %d 处" % (ok, len(bad)))
    for name, lineno, why in bad:
        print("  [FAIL] %s L%d: %s" % (name, lineno, why))

    if dry:
        print("(--dry，未写文件)")
        return 0

    if ok == 0:
        return 1

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), PATCH_NAME)
    chunks = []
    for name in changed_files:
        cur = os.path.join(bd, name)
        bak = cur + '.orig604'
        r = subprocess.run(['diff', '-u', bak, cur], capture_output=True, text=True)
        if not r.stdout:
            continue
        body = r.stdout.replace(bak, 'a/' + name, 1)
        body = body.replace(cur, 'b/' + name, 1)
        chunks.append(body)

    if not chunks:
        print("无差异", file=sys.stderr)
        return 1

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(''.join(chunks))
    print("补丁已生成: %s (%d 字节)" % (out_path, os.path.getsize(out_path)))
    return 0


if __name__ == "__main__":
    sys.exit(main())