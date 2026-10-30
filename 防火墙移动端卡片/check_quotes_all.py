import io, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

for name in ['forwards.js', 'rules.js', 'snats.js']:
    t = io.open(os.path.join(BASE_DIR, name), encoding='utf-8').read()
    if 'Match any helper except "' in t:
        print(f"[WARN] {name} has unescaped helper quote!")
    else:
        print(f"[OK] {name} quote clean")