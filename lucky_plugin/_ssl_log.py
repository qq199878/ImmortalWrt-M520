# -*- coding: utf-8 -*-
import base64,json,secrets,sys,urllib.request,urllib.error
BASE="http://192.168.1.1:16603"
KEY="BEUL9vKDPNaR45Ax"
def http(m,p,d=None,h=None,t=60):
    hd={"Accept":"application/json"}
    if h: hd.update(h)
    b=None
    if d is not None:
        b=json.dumps(d).encode(); hd["Content-Type"]="application/json"
    r=urllib.request.Request(BASE+p,data=b,headers=hd,method=m)
    try:
        with urllib.request.urlopen(r,timeout=t) as x: return x.status,x.read()
    except urllib.error.HTTPError as e: return e.code,e.read()
    except Exception as e: return 0,str(e).encode()
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
sid=secrets.token_hex(32); hd={"Lucky-Login-Session":sid}
st,raw=http("GET","/api/login/challenge",h=hd); ch=json.loads(raw)
pl={"account":"YOUR_ACCOUNT","password":"YOUR_PASSWORD","twoFA":"","challengeId":ch["challengeId"],"nonce":ch["nonce"]}
k=serialization.load_pem_public_key(ch["publicKey"].encode())
ci=base64.b64encode(k.encrypt(json.dumps(pl,separators=(",",":")).encode(),padding.PKCS1v15())).decode()
st,raw=http("POST","/api/login",{"challengeId":ch["challengeId"],"cipherText":ci},h=hd)
res=json.loads(raw)
auth={"Lucky-Login-Session":sid,"Lucky-Admin-Token":res.get("token") or ""}
print("=== 完整任务详情 ===")
st,raw=http("GET","/api/ssl/"+KEY,h=auth)
d=json.loads(raw)
print(json.dumps(d,ensure_ascii=False,indent=1)[:2500])
print()
print("=== 任务日志 ===")
st,raw=http("GET","/api/ssl/logs?key=%s&pageSize=30&page=0"%KEY,h=auth)
print(raw.decode("utf-8","replace")[:2000])
print()
print("=== lastlogs ===")
st,raw=http("GET","/api/ssl/lastlogs?key=%s"%KEY,h=auth)
print(raw.decode("utf-8","replace")[:2000])
