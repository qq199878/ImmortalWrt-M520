import io
import re

s = io.open('argon_cascade.css', encoding='utf-8', errors='replace').read()

# 提取 @media max-width:768px 的完整块（含嵌套大括号匹配）
key = '@media screen and (max-width:768px)'
i = s.find(key)
if i < 0:
    print('not found')
else:
    # 从 i 开始找第一个 {
    j = s.find('{', i)
    depth = 0
    k = j
    while k < len(s):
        if s[k] == '{':
            depth += 1
        elif s[k] == '}':
            depth -= 1
            if depth == 0:
                break
        k += 1
    block = s[i:k + 1]
    print('=== 768px 块长度:', len(block))
    print()
    # 只打印含 tr / td / table 的规则
    for m in re.finditer(r'[^{}]{0,200}\{[^{}]{0,500}\}', block):
        seg = m.group(0)
        if re.search(r'\b(tr|td|table|tbody|thead)\b', seg):
            print(seg[:600])
            print('---')