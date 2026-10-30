# cfddns_plugin（Cloudflare DDNS）

公网出口 IPv4 同步到 Cloudflare A 记录。

## 用途

- 探测真实公网出口 IP（多源交叉验证）
- 同步到 Cloudflare A 记录（自动创建/更新）
- LuCI 页面管理 Token、域名、记录

## AI 魔改点

- 唯一配置源 `/etc/cfddns.conf`（权限 600），避免 Token 硬编码散落多处
- 多源探测 + 两源一致才采信
- 并发锁（僵死锁自动清理）
- 总开关、停靠地址、三层缓存（探测/CF记录/域名列表）
- Token 页面脱敏显示

## 部署

```sh
scp cfddns.conf root@192.168.1.1:/etc/cfddns.conf
scp ddns-cf.sh root@192.168.1.1:/etc/ddns-cf.sh
scp cfddns.uc root@192.168.1.1:/usr/share/rpcd/ucode/cfddns.uc
# 填写 /etc/cfddns.conf 里的 YOUR_CF_TOKEN / YOUR_ZONE_ID / 域名
```
