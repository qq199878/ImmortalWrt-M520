# cfddns_plugin（Cloudflare DDNS）

公网出口 IPv4 同步到 Cloudflare A 记录。

## 用途

- 探测真实公网出口 IP（多源交叉验证）
- 同步到 Cloudflare A 记录（自动创建/更新）
- LuCI 页面管理 Token、域名、记录

## 文件清单

| 文件 | 安装路径 | 权限 | 说明 |
|---|---|---|---|
| `cfddns.conf` | `/etc/cfddns.conf` | 600 | 唯一配置源（Token / Zone ID / 域名） |
| `ddns-cf.sh` | `/etc/ddns-cf.sh` | 755 | 同步脚本（探测 + 写 CF 记录） |
| `cfddns.uc` | `/usr/share/rpcd/ucode/cfddns.uc` | 644 | rpcd 后端（ubus `luci.cfddns`） |
| `cfddns.js` | `/www/luci-static/resources/view/cfddns.js` | 644 | 前端页面 |
| `cfddns.json` | `/usr/share/luci/menu.d/luci-app-cfddns.json` | 644 | 菜单注册 |
| `luci-app-cfddns.json` | `/usr/share/rpcd/acl.d/luci-app-cfddns.json` | 644 | ACL 权限声明 |
| `install.sh` | — | 755 | 一键安装脚本 |

## AI 魔改点

- 唯一配置源 `/etc/cfddns.conf`（权限 600），避免 Token 硬编码散落多处
- 多源探测 + 两源一致才采信
- 并发锁（僵死锁自动清理）
- 总开关、停靠地址、三层缓存（探测/CF记录/域名列表）
- Token 页面脱敏显示

### 多 Token 管理

- `CF_TOKENS` 存 Token 列表（逗号分隔），`CF_TOKEN` 为当前生效值
- 支持新增 / 删除 / 切换，删除当前生效的会被拒绝
- 新增前先调 CF API 校验有效性（`verify_token`），无效不入库
- 页面只显示脱敏 Token（前 4 位 + 后 4 位）

### ACL 权限补全

早期版本的 `luci-app-cfddns.json` 只声明了 15 个 ubus 方法，多 Token 功能上线后
缺少 `verify_token` / `list_tokens` / `add_token` / `del_token` / `select_token` /
`update_record` 六个，导致页面报 `-32002 Access denied`。
现已补齐至 21 个方法（read / write 各一份）。

> **注意**：rpcd 的 ACL 是**登录时快照**机制。修改 ACL 文件后，已登录的会话
> 不会自动获得新权限，必须重新登录（或销毁旧会话）才生效。

### 探测时间预算

`PROBE_BUDGET`（默认 12 秒）限制探测阶段总耗时。rpcd 以 `-t 30` 运行，
页面点「立即同步」时脚本必须尽快收尾。预算耗尽后若已有可用 IP 就直接采用，
不再尝试后续探测源。

### 前端轮询清理

`busyHide()`（关闭「同步中」浮层）会同时清理 `runPollTimer`，
避免用户点 × 关闭浮层后轮询仍在后台空跑（最长 60 秒）。

## 部署

### 方式一：一键安装

```sh
scp -r cfddns_plugin root@192.168.1.1:/tmp/
ssh root@192.168.1.1
cd /tmp/cfddns_plugin
sh install.sh
```

### 方式二：手动安装

```sh
scp cfddns.conf root@192.168.1.1:/etc/cfddns.conf
scp ddns-cf.sh root@192.168.1.1:/etc/ddns-cf.sh
scp cfddns.uc root@192.168.1.1:/usr/share/rpcd/ucode/cfddns.uc
scp cfddns.js root@192.168.1.1:/www/luci-static/resources/view/cfddns.js
scp cfddns.json root@192.168.1.1:/usr/share/luci/menu.d/luci-app-cfddns.json
scp luci-app-cfddns.json root@192.168.1.1:/usr/share/rpcd/acl.d/luci-app-cfddns.json
```

### 配置

编辑 `/etc/cfddns.conf`，填入真实值：

```sh
CF_TOKEN='YOUR_CF_TOKEN'    # Cloudflare API Token（Zone.DNS 编辑权限）
ZONE_ID='YOUR_ZONE_ID'      # 32 位十六进制 Zone ID
DOMAIN='home.example.com'   # 要维护的完整域名
```

### 定时任务

```sh
# /etc/crontabs/root
* * * * * /etc/ddns-cf.sh >/dev/null 2>&1
```

### 重启服务

```sh
/etc/init.d/rpcd restart
rm -f /tmp/luci-indexcache*
```

## 命令行

```sh
/etc/ddns-cf.sh            # 正常同步
/etc/ddns-cf.sh --probe    # 只探测公网 IP
/etc/ddns-cf.sh --status   # 输出状态（key=value）
```

退出码：`0` 成功 / `1` 探测失败 / `2` CF 查询失败 / `3` 写记录失败 /
`4` 配置缺失 / `5` 并发锁 / `6` 插件已关闭

## 页面

访问路径：**服务 → Cloudflare 动态域名**

- 总开关（关闭时把记录改成停靠地址，默认 `127.0.0.1`）
- 运行状态（公网 IP、CF 当前记录、上次执行结果）
- API 凭据（多 Token 管理）
- 域名与解析记录列表
- 手动添加解析

## 说明

- 本仓库所有文件均已脱敏：Token / Zone ID / 域名 / IP 均为占位符
- 部署目标固件：ImmortalWrt（基于 OpenWrt 23.05+）
- 脚本依赖：`curl`、`jsonfilter`（OpenWrt 默认自带）
