#!/bin/sh
# ============================================================
# NSS 包强制重新打包脚本
# 用法：sh fix_nss_repack.sh [包名...]
#   不传包名 = 处理 drv + ecm 两个
# 作用：解决 "APK 里永远是旧模块" 问题
# ============================================================
# 注意：本脚本不使用 set -e，避免中断整个流程看不到诊断信息

SRC=/root/m520
ARCH=arm_cortex-a15_neon-vfpv4
TGT=target-arm_cortex-a15+neon-vfpv4_musl_eabi
LIN=linux-ipq806x_generic
OUT=bin/targets/ipq806x/generic/packages
LOG=.build_logs

cd "$SRC" || { echo "FATAL: $SRC 不存在"; exit 1; }
mkdir -p "$LOG"

# 待处理包列表：目录名|包名|模块文件名
if [ $# -gt 0 ]; then
    LIST="$*"
else
    LIST="qca-nss-drv qca-nss-ecm-standard"
fi

echo "=============================================="
echo " NSS 强制重打包  $(date '+%F %T')"
echo "=============================================="

for ITEM in $LIST; do
    case "$ITEM" in
        qca-nss-drv)          MOD=qca-nss-drv.ko ;;
        qca-nss-ecm-standard) MOD=ecm.ko ;;
        qca-nss-gmac)         MOD=qca-nss-gmac.ko ;;
        *)                    MOD="$ITEM.ko" ;;
    esac

    echo ""
    echo "########## $ITEM (模块 $MOD) ##########"

    BD=$(ls -d build_dir/$TGT/$LIN/$ITEM* 2>/dev/null | head -1)
    if [ -z "$BD" ]; then
        echo "  [SKIP] 找不到 build_dir/$TGT/$LIN/$ITEM*"
        continue
    fi
    echo "  build_dir : $BD"

    # ---------- 1. 记录当前三方状态 ----------
    echo "  --- 修复前状态 ---"
    PKG_KO=$(find "$BD/.pkgdir" -name "$MOD" 2>/dev/null | head -1)
    IPKG_KO=$(find "$BD"/ipkg-* -name "$MOD" 2>/dev/null | head -1)
    APK=$(ls "$OUT"/kmod-${ITEM}"-"*.apk 2>/dev/null | head -1)

    if [ -n "$PKG_KO" ]; then
        echo "  .pkgdir : $(stat -c %s "$PKG_KO")  $(sha256sum "$PKG_KO" | cut -c1-16)"
    else
        echo "  .pkgdir : (无)"
    fi
    if [ -n "$IPKG_KO" ]; then
        echo "  ipkg-*  : $(stat -c %s "$IPKG_KO")  $(sha256sum "$IPKG_KO" | cut -c1-16)"
    else
        echo "  ipkg-*  : (无)"
    fi
    if [ -n "$APK" ]; then
        echo "  APK     : $(stat -c %s "$APK")  $APK"
    else
        echo "  APK     : (无)"
    fi

    # ---------- 2. 清理污染源 ----------
    # 关键：.installed 是 OpenWrt 的"已安装到 ipkg"标记
    #       只删 .built 不会触发重建 ipkg-*，必须删 .installed
    echo "  --- 清理 ---"
    rm -f  "$BD/.installed"
    rm -rf "$BD"/ipkg-*
    rm -f  "$OUT"/kmod-${ITEM}-*.apk
    echo "  已删: .installed / ipkg-* / 旧 APK"

    # ---------- 3. 重新编译打包 ----------
    echo "  --- 编译中（日志 $LOG/repack_$ITEM.log）---"
    make -j2 V=s "package/qca/$ITEM/compile" > "$LOG/repack_$ITEM.log" 2>&1
    RC=$?
    echo "  make RC=$RC"

    if [ $RC -ne 0 ]; then
        echo "  [FAIL] 编译失败，最后 15 行："
        tail -n 15 "$LOG/repack_$ITEM.log"
        continue
    fi

    # ---------- 4. 三方核验 ----------
    echo "  --- 修复后核验 ---"
    PKG_KO=$(find "$BD/.pkgdir" -name "$MOD" 2>/dev/null | head -1)
    IPKG_KO=$(find "$BD"/ipkg-* -name "$MOD" 2>/dev/null | head -1)
    APK=$(ls "$OUT"/kmod-${ITEM}"-"*.apk 2>/dev/null | head -1)

    H_PKG="-"; H_IPKG="-"; H_APK="-"

    [ -n "$PKG_KO" ] && H_PKG=$(sha256sum "$PKG_KO" | cut -d' ' -f1)
    [ -n "$IPKG_KO" ] && H_IPKG=$(sha256sum "$IPKG_KO" | cut -d' ' -f1)

    if [ -n "$APK" ]; then
        H_APK=$(python3 /root/m520/apk_ko_hash.py "$APK" "$MOD" 2>/dev/null | awk '{print $1}')
        [ -z "$H_APK" ] && H_APK="-"
    fi

    echo "  .pkgdir : $H_PKG"
    echo "  ipkg-*  : $H_IPKG"
    echo "  APK     : $H_APK"

    if [ "$H_PKG" = "$H_IPKG" ] && [ "$H_IPKG" = "$H_APK" ] && [ "$H_PKG" != "-" ]; then
        echo "  [OK] 三方一致，打包正确"
        if [ -n "$APK" ]; then
            echo "  APK_SIZE=$(stat -c %s "$APK")"
            echo "  APK_SHA256=$(sha256sum "$APK" | cut -d' ' -f1)"
        fi
    else
        echo "  [BAD] 哈希不一致！仍会装到旧模块"
        echo "        可能原因：Build/Install 未执行，需检查 $LOG/repack_$ITEM.log"
    fi
done

echo ""
echo "=============================================="
echo " 完成 $(date '+%F %T')"
echo "=============================================="
