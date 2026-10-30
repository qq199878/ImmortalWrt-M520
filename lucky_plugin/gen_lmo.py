# -*- coding: utf-8 -*-
"""生成 LuCI .lmo 翻译文件（GNU gettext MO 格式）"""
import struct

T = [
    ("Main Program Information", "主程序信息"),
    ("Installation Status", "安装状态"),
    ("Lucky Status", "运行状态"),
    ("Lucky Arch", "程序架构"),
    ("Compilation Time", "编译时间"),
    ("Lucky Version", "程序版本"),
    ("Admin Panel Information", "管理面板信息"),
    ("Admin Panel", "管理面板地址"),
    ("Admin Panel Login Info", "面板登录信息"),
    ("Collecting data...", "正在获取数据..."),
    ("Installed", "已安装"),
    ("Not installed", "未安装"),
    ("The Lucky service is running.", "服务运行中"),
    ("The Lucky service is not running.", "服务未运行"),
    ("Start", "启动"),
    ("Stop", "停止"),
    ("Change", "修改"),
    ("Reset", "重置"),
    ("Enable", "开启"),
    ("Disable", "关闭"),
    ("allow", "已允许"),
    ("not allow", "未允许"),
    ("Open AdminURL", "打开管理面板"),
    ("DefaultAuth", "默认账号密码"),
    ("NewHttpPort", "请输入新的端口号"),
    ("portValueError", "端口号格式错误，必须是 1-65535"),
    ("update success", "修改成功"),
    ("update failed", "修改失败"),
    ("get latest version", "获取最新版本"),
    ("Reset 666 as admin account and password?", "确定把管理员账号和密码重置为 666 吗？"),
    ("Are you sure Enalbe Internetaccess?", "确定开启外网访问吗？"),
    ("Are you sure Disable Internetaccess?", "确定关闭外网访问吗？"),
    ("are you sure start lucky service?", "确定启动 Lucky 服务吗？"),
    ("are you sure stop lucky service?", "确定停止 Lucky 服务吗？"),
]

HEADER = (
    "Content-Type: text/plain; charset=UTF-8\n"
    "Language: zh_CN\n"
    "Plural-Forms: nplurals=1; plural=0;\n"
)

def build(entries):
    """标准 GNU gettext MO 格式
    0: magic  4: revision  8: N  12: O(orig tab)  16: T(trans tab)
    20: S(hash size)  24: H(hash tab off)  28: tables start
    """
    n = len(entries)
    orig_tab_off = 28
    trans_tab_off = orig_tab_off + 8 * n
    hash_off = trans_tab_off + 8 * n
    string_off = hash_off

    strings = bytearray()
    orig = []
    for msgid, msgstr in entries:
        o = string_off + len(strings)
        strings += msgid + b"\x00"
        orig.append((len(msgid), o))
    trans = []
    for msgid, msgstr in entries:
        o = string_off + len(strings)
        strings += msgstr + b"\x00"
        trans.append((len(msgstr), o))

    out = bytearray()
    out += struct.pack('<I', 0x950412de)   # magic
    out += struct.pack('<I', 0)            # revision
    out += struct.pack('<I', n)            # number of strings
    out += struct.pack('<I', orig_tab_off)
    out += struct.pack('<I', trans_tab_off)
    out += struct.pack('<I', 0)            # hash table size = 0
    out += struct.pack('<I', hash_off)     # hash table offset
    for l, o in orig:
        out += struct.pack('<II', l, o)
    for l, o in trans:
        out += struct.pack('<II', l, o)
    out += strings
    return bytes(out)

entries = [(b"", HEADER.encode('utf-8'))]
for a, b in T:
    entries.append((a.encode('utf-8'), b.encode('utf-8')))

data = build(entries)
with open('lucky.zh-cn.lmo', 'wb') as f:
    f.write(data)
print("entries=%d bytes=%d" % (len(entries), len(data)))