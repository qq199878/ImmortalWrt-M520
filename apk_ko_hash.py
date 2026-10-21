#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 OpenWrt .apk (apk-tools v3 / ADB 格式) 中提取指定 .ko 的 sha256

用法:
    python3 apk_ko_hash.py <xxx.apk> [模块名]

输出（每行一个）:
    <sha256>  <size>  <路径>

原理:
    apk v3 文件 = 前部签名/控制块 + gzip 压缩数据
    gzip 解开后是 tar，内含 data.tar.gz（再一层 gzip+tar）
    真正的文件在第二层 tar 里

    不依赖 apk 命令，纯 Python 标准库
"""
import sys
import io
import gzip
import tarfile
import hashlib

GZIP_MAGIC = b'\x1f\x8b\x08'


def iter_ko_from_tar(tf, depth=0):
    """递归遍历 tar，产出 (name, size, sha256)"""
    for m in tf.getmembers():
        if not m.isfile():
            continue
        f = tf.extractfile(m)
        if f is None:
            continue
        data = f.read()

        # 内层还是 gzip+tar（data.tar.gz）
        if m.name.endswith(('.tar.gz', '.tgz')) or data[:3] == GZIP_MAGIC:
            if depth < 3:
                try:
                    inner_raw = gzip.decompress(data)
                    with tarfile.open(fileobj=io.BytesIO(inner_raw)) as inner:
                        for item in iter_ko_from_tar(inner, depth + 1):
                            yield item
                    continue
                except Exception:
                    pass

        if m.name.endswith('.ko'):
            yield (m.name, len(data), hashlib.sha256(data).hexdigest())


def main():
    if len(sys.argv) < 2:
        print("usage: apk_ko_hash.py <apk> [module_name]", file=sys.stderr)
        return 2

    path = sys.argv[1]
    want = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        with open(path, 'rb') as fp:
            blob = fp.read()
    except OSError as e:
        print(f"open failed: {e}", file=sys.stderr)
        return 1

    # 定位第一个 gzip 流（跳过前面的签名块）
    idx = blob.find(GZIP_MAGIC)
    if idx < 0:
        print("no gzip stream found (不是标准 apk v3？)", file=sys.stderr)
        return 1

    found = False
    try:
        raw = gzip.decompress(blob[idx:])
    except Exception as e:
        print(f"gzip decompress failed: {e}", file=sys.stderr)
        return 1

    try:
        with tarfile.open(fileobj=io.BytesIO(raw)) as tf:
            for name, size, sha in iter_ko_from_tar(tf):
                base = name.rsplit('/', 1)[-1]
                if want and base != want:
                    continue
                print(f"{sha}  {size}  {name}")
                found = True
    except Exception as e:
        print(f"tar parse failed: {e}", file=sys.stderr)
        return 1

    if not found:
        print("目标模块未找到", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
