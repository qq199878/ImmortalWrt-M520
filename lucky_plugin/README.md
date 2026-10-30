# lucky_plugin（Lucky 大吉）

Lucky 一体化插件（端口转发 / 内网穿透 / DDNS / SSL 证书），含中文汉化。

## 用途

- 端口转发、反向代理、内网穿透（STUN）
- 动态 DNS、SSL/TLS 证书自动申请（ACME）

## AI 魔改点

- 中文汉化：`lucky.zh-cn.lmo` + `cbi_lucky_zh.lua` + `lucky_status_zh.htm`
- `lucky_ctrl_cache.lua`：状态缓存，减少页面加载延迟
- `_` 开头的 python 脚本：自动化配置辅助（登录、DDNS 任务、SSL 申请、STUN 探测）

## 部署

```sh
opkg install luci-app-lucky_2.2.2-r1_all.ipk
```
