import io
import re

s = io.open('argon_cascade.css', encoding='utf-8', errors='replace').read()

# 找出所有含 data-title 或 cbi-section-table 的规则片段
print('=== 含 data-title 的规则 ===')
for m in re.finditer(r'[^{}@]{0,160}\{[^{}]{0,300}data-title[^{}]{0,200}\}', s):
    print(m.group(0)[:400])
    print('---')

print()
print('=== 含 cbi-section-table 的规则 ===')
for m in re.finditer(r'[^{}@]{0,160}\{[^{}]{0,400}cbi-section-table[^{}]{0,300}\}', s):
    print(m.group(0)[:500])
    print('---')

print()
print('=== 所有 @media 块（只看 max-width 条件）===')
for m in re.finditer(r'@media[^{]{0,120}max-width[^{]{0,40}\{', s):
    print(m.group(0))
    print('---')