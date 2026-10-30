import io

p = 'forwards_mobile.js'
s = io.open(p, encoding='utf-8').read()

# 用 ASCII 码拼出实体，避开工具链的引号转义
AMP = chr(38) + 'quot;'
Q = chr(34)

bad = 'Match any helper except ' + Q + '%{helper.name}' + Q
good = 'Match any helper except ' + AMP + '%{helper.name}' + AMP

print('bad found:', s.count(bad))
s = s.replace(bad, good)

io.open(p, 'w', encoding='utf-8').write(s)
print('done')

s2 = io.open(p, encoding='utf-8').read()
i = s2.find('Match any helper except')
print('now:', repr(s2[i:i + 70]))