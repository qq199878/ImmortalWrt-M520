# adguardhome_plugin（DNS 五件套）

DNS 分流 + 去广告 + 抗污染 + PassWall 感知自愈的完整方案。

## 链路

```
客户端 -> AdGuardHome:53 -> chinadns-ng:6153 -> [国内] SmartDNS:6053
                                            -> [国外] PassWall chinadns-ng:15353(经代理)
```

## AI 魔改点

- `dns-sync.sh`：每分钟自愈脚本（flock 单锁 + SmartDNS 看门狗 + PassWall 端口动态探测 + 污染网段黑名单 + 三域名投票），只认 TCP LISTEN 端口，避免 UDP 出站 socket 误判
- `ipset-init.sh`：chnroute/chnroute6 内存态重建（开机调用）
- `config.js` / `build_config.py`：AdGuardHome 配置生成

## 部署

```sh
scp dns-sync.sh root@192.168.1.1:/etc/chinadns-ng/dns-sync.sh
scp ipset-init.sh root@192.168.1.1:/etc/chinadns-ng/ipset-init.sh
# cron: * * * * * /etc/chinadns-ng/dns-sync.sh
```
