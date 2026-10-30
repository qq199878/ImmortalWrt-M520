# -*- coding: utf-8 -*-
import base64,json,secrets,sys,time,urllib.request,urllib.error
BASE="http://192.168.1.1:16603"
KEY=sys.argv[1] if len(sys.argv)>1 else "BEUL9vKDPNaR45Ax"
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
for i in range(1,41):
    st,raw=http("GET","/api/ssl/"+KEY,h=auth)
    try:
        d=json.loads(raw)
    except:
        print("[%2d] parse fail %s"%(i,raw[:120])); time.sleep(6); continue
    it=d.get("info") or {}
    ci2=it.get("CertsInfo") or {}
    doms=ci2.get("Domains") or []
    print("[%2d] ACMEing=%s err=%r domains=%s endtime=%s" % (
        i, it.get("ACMEing"), (it.get("ACMEErrMsg") or "")[:80], doms, ci2.get("EndTime") or ci2.get("NotAfter")))
    if doms and not it.get("ACMEing"):
        print("\n[✓] 证书已签发")
        print(json.dumps(ci2,ensure_ascii=False,indent=1)[:1200])
        break
    if it.get("ACMEErrMsg"):
        print("\n[!] 出错，停止")
        break
    time.sleep(6)
