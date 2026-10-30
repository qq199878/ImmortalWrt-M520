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
st,raw=http("GET","/api/ssl/"+KEY,h=auth)
d=json.loads(raw)["info"]
cb=d.get("CertBase64") or ""
kb=d.get("KeyBase64") or ""
ic=d.get("IssuerCertificate") or ""
print("CertBase64 len:",len(cb))
print("KeyBase64  len:",len(kb))
print("Issuer     len:",len(ic))
# 解码
cert=base64.b64decode(cb).decode("utf-8","replace") if cb else ""
key=base64.b64decode(kb).decode("utf-8","replace") if kb else ""
iss=base64.b64decode(ic).decode("utf-8","replace") if ic else ""
open("/tmp/fullchain.pem","w").write(cert+("\n"+iss if iss and iss not in cert else ""))
open("/tmp/privkey.pem","w").write(key)
print("\ncert head:", cert[:80].replace(chr(10)," "))
print("key  head:", key[:60].replace(chr(10)," "))
ci2=d.get("CertsInfo") or {}
print("\n=== CertsInfo ===")
print(json.dumps(ci2,ensure_ascii=False,indent=1)[:1200])
