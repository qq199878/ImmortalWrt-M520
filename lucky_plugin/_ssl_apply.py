# -*- coding: utf-8 -*-
import base64,json,secrets,sys,urllib.request,urllib.error
BASE="http://192.168.1.1:16603"
CF_TOKEN="YOUR_CF_TOKEN"
DOMAIN="home.example.com"

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
print("[+] login ok")

body={
 "Key":"",
 "Remark":"home.example.com - ACME",
 "AddFrom":"acme",
 "Enable":True,
 "MappingToPath":False,
 "MappingPath":"",
 "MappingChangeScript":"",
 "CertBase64":"",
 "KeyBase64":"",
 "IssuerCertificate":"",
 "AllSyncClient":False,
 "SyncClientList":[],
 "ExtParams":{
   "acmeDNSServer":"cloudflare",
   "acmeCADirURL":"",
   "acmeDNSID":"",
   "acmeDNSSecret":CF_TOKEN,
   "acmeCallAPINetwork":"",
   "acmeDomains":[DOMAIN],
   "acmeEmail":"your-email@example.com",
   "acmeKeyType":"2048",
   "acmeProfile":"",
   "acmeKid":"",
   "acmeHMAC":"",
   "acmeProxy":"",
   "acmeProxyAddr":"",
   "acmeProxyUser":"",
   "acmeProxyPassword":"",
   "acmeOnlyUseIPv4":False,
   "acmeDNSForceIPv4":False,
   "acmeDNSOnlyTCP":False,
   "acmeCNAMESupport":False,
   "acmeDisableCompletePropagationRequirement":False,
   "acmeIgnorePropagationChecErrors":False,
   "acmeDisableAuthoritativeNssPropagationRequirement":False,
   "acmeFindZoneUseDNS":False,
   "acmeRotatePrivateKeyPerRequest":False,
   "acmeUseGlobalPrivateKey":False,
   "acmeSequentialSolver":False,
   "acmePropagationTimeout":180,
   "acmeWaitforcertificateTimeout":120,
   "acmeRecursiveNameservers":""
 }
}
print("[*] POST /api/ssl")
st,raw=http("POST","/api/ssl",body,h=auth,t=180)
txt=raw.decode("utf-8","replace")
print("    HTTP",st)
print("   ",txt[:800])
