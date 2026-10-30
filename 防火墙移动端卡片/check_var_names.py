import io, re

for name in ['forwards_orig.js', 'rules_orig.js', 'snats_orig.js']:
    t = io.open('/storage/emulated/0/Download/路由器520/lucky_plugin/_fw_forwards/' + name, encoding='utf-8').read()
    m = re.search(r'([a-zA-Z0-9_]+)\s*=\s*m\.section\(\s*form\.GridSection', t)
    if m:
        print(name, 'GridSection var name is:', m.group(1))
    else:
        print(name, 'Not found var = m.section(form.GridSection')