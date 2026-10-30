import io

for name in ['forwards_orig.js', 'rules_orig.js', 'snats_orig.js']:
    t = io.open('/storage/emulated/0/Download/路由器520/lucky_plugin/_fw_forwards/' + name, encoding='utf-8').read()
    anchor = "return m.render();"
    idx = t.rfind(anchor)
    print(name, 'render anchor index:', idx)
    if idx != -1:
        print('  Tail:', repr(t[idx:]))