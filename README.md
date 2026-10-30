# ImmortalWrt-M520 路由器插件合集

本仓库分支 `plugins` 存放锐捷 RG-MTFi-M520（ImmortalWrt / OpenWrt）定制路由器的一系列 LuCI 插件与配套脚本。

## 插件清单

| 目录 | 插件名 | 用途 |
|---|---|---|
| `adguardhome_plugin` | DNS 五件套 | AdGuardHome 去广告 + chinadns-ng 分流 + SmartDNS 优选 + PassWall 感知自愈 |
| `cfddns_plugin` | Cloudflare DDNS | 公网出口 IPv4 同步到 Cloudflare A 记录 |
| `lucky_plugin` | Lucky 大吉 | 端口转发/内网穿透/DDNS/SSL 证书一体化（含中文汉化） |
| `luci-app-modem-control` | 4G/5G 模块控制 | AT 指令、模块电源、短信 |
| `luci-app-sms-manager` | 短信管理 | 收发短信、转发 |
| `luci-app-nss-status` | NSS 状态面板 | 显示 NSS 硬件加速引擎工作状态 |
| `防火墙移动端卡片` | 防火墙移动端 | 规则/转发/SNAT 页面手机适配 |

## 说明

- 各插件目录内均有独立 README.md，说明用途、AI 魔改点、安装/使用方法。
- 所有文件已脱敏：Token/密码/域名/IP 等敏感值已替换为占位符（`YOUR_*`）。
- 部署目标固件：ImmortalWrt（基于 OpenWrt 23.05+），设备锐捷 M520。
