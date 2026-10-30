import io, re

orig = io.open('forwards_orig.js', encoding='utf-8').read()
mine = io.open('forwards_mobile.js', encoding='utf-8').read()


def norm(s):
    # 去掉所有空白，便于对比实质内容
    return re.sub(r'\s+', '', s)


# 提取官方原版里所有 "o.xxx = " 和 "o = s.xxx" 的调用，核对是否都在我的版本里
pat = re.compile(r"(s\.(?:tab)?option\([^;]{0,120}?\))")
o_set = set(norm(x) for x in pat.findall(orig))
m_set = set(norm(x) for x in pat.findall(mine))

print('=== 官方 option 定义数:', len(o_set))
print('=== 新版 option 定义数:', len(m_set))
print()

missing = o_set - m_set
extra = m_set - o_set

if missing:
    print('!!! 新版缺失的 option 定义:')
    for x in missing:
        print('   -', x[:110])
else:
    print('[OK] 官方所有 option 定义都已保留')

print()

if extra:
    print('新版新增的 option 定义:')
    for x in extra:
        print('   +', x[:110])
else:
    print('[OK] 无新增 option')

print()

# 核对关键属性
keys = [
    'addremove', 'anonymous', 'sortable', 'cloneable', 'filterrow',
    'handleAdd', 'sectiontitle', 'checkLegacySNAT', 'renderMigration',
    'addMarkOption', 'addLimitOption', 'addLimitBurstOption',
    'addMACOption', 'addIPOption', 'addLocalIPOption', 'CBIProtocolSelect',
    'updateHostHints', 'lookupProto', 'map_invert', 'getZoneColorStyle',
    'getColorForName'
]
print('=== 关键调用核对 ===')
for k in keys:
    a = orig.count(k)
    b = mine.count(k)
    flag = 'OK' if b >= a else '!!! MISSING'
    print('  %-24s 官方=%d  新版=%d  %s' % (k, a, b, flag))

print()
print('=== 非弹窗列（会显示在卡片上）核对 ===')
for pat2 in [r"form\.DummyValue,\s*'_match'", r"form\.ListValue,\s*'_dest'", r"form\.Flag,\s*'enabled'"]:
    print('  %-40s 官方=%d 新版=%d' % (pat2, len(re.findall(pat2, orig)), len(re.findall(pat2, mine))))