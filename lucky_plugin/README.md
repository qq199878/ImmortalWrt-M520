# lucky_plugin（Lucky 大吉）

Lucky 一体化插件（端口转发 / 内网穿透 / DDNS / SSL 证书），含中文汉化。

## 用途

- 端口转发、反向代理、内网穿透（STUN）
- 动态 DNS、SSL/TLS 证书自动申请（ACME）

## AI 魔改点

- 中文汉化：`cbi_lucky_zh.lua` + `lucky_status_zh.htm`
- `lucky_ctrl_cache.lua`：状态缓存，减少页面加载延迟（7.6s → 0.2s）
- `_` 开头的 python 脚本：自动化配置辅助（登录、DDNS 任务、SSL 申请、STUN 探测）

---

## 部署（2026-10 实测定稿版）

> 本节为实际验证通过的部署方案，**不使用 ipk**，直接部署二进制与脚本。
> 旧版 `opkg install luci-app-lucky_2.2.2-r1_all.ipk` 方案已废弃。

### 前提条件

| 项目 | 要求 |
|---|---|
| 固件 | ImmortalWrt SNAPSHOT，armv7l，**ucode 版 LuCI** |
| 依赖 | `luci-compat`、`luci-lua-runtime`（均已预装） |
| 空间 | overlay 至少 20 MB 可用 |

### 一、准备二进制

从 GitHub 官方 Release 下载 v3.5.0 armv7 静态编译版：`lucky_3.5.0_Linux_armv7.tar.gz`

| 校验项 | 值 |
|---|---|
| MD5 (tar.gz) | `080b0cfc25c683cd115e6af78a979140` |
| MD5 (解包 lucky) | `c9edfc2e932bde43c9e78925bf6084a5` |
| 大小 | 14,125,797 B |
| 架构 | ELF 32-bit LSB, ARM, EABI5, **静态链接** |

运行验证：

```sh
/usr/bin/lucky -info
# 期望输出 Version:3.5.0, ARCH:armv7
```

### 二、文件部署清单

| 源文件 | 目标路径 | 权限 |
|---|---|---|
| `lucky`（二进制） | `/usr/bin/lucky` | 755 root:root |
| `_lucky.init` | `/etc/init.d/lucky` | 755 root:root |
| `lucky-cache-warm` | `/etc/init.d/lucky-cache-warm` | 755 root:root |
| `lucky-info-cache.sh` | `/usr/bin/lucky-info-cache.sh` | 755 root:root |
| `luckyarch`（取自官方 ipk） | `/usr/bin/luckyarch` | 755 root:root |
| `lucky_ctrl_cache.lua` | `/usr/lib/lua/luci/controller/lucky.lua` | 644 root:root |
| `cbi_lucky_zh.lua` | `/usr/lib/lua/luci/model/cbi/lucky/lucky.lua` | 644 root:root |
| `lucky_status_zh.htm` | `/usr/lib/lua/luci/view/lucky/lucky_status.htm` | 644 root:root |
| （新建，见下节） | `/etc/config/lucky` | 644 root:root |

另需创建配置目录：`mkdir -p /etc/lucky`

### 三、`/etc/config/lucky`（必须手工创建）

```
config lucky 'lucky'
	option enabled '0'
	option configdir '/etc/lucky'
```

> **关键**：控制器 `index()` 首行有 `nixio.fs.access("/etc/config/lucky")` 检查，
> 文件不存在则**整个菜单不注册**，页面根本不会出现。

### 四、端口语义（易踩坑）

| 端口 | 协议 | 说明 |
|---|---|---|
| **16603** | HTTP | 管理面板（`AdminWebListenPort`） |
| **16601** | HTTPS | 自签证书 |

- 面板地址必须用 `http://IP:16603`
- `http://IP:16601` **打不开**（16601 是 HTTPS）

若页面显示 `http://IP:16601` 打不开 = 缓存抓到旧值，处理：

```sh
rm -f /tmp/lucky_info_cache.json /tmp/lucky_info_cache.lock
/usr/bin/lucky-info-cache.sh
```

> lucky 3.5.0 官方默认 HTTP 端口是 16601，与本方案（-port 16603）不同，
> 首次启动时曾出现缓存记录 16601 的情况，故须注意。

### 五、不要安装的东西

| 文件 | 原因 |
|---|---|
| ❌ `menu.d` / `acl.d` | 控制器已用 `entry()` 注册同路径，共存会冲突；root 用户不受 ACL 限制 |
| ❌ `ubus-guard` | `rm -f $SOCK` 逻辑有隐患，已废弃（见下节） |

### 六、`ubus-guard` 已废弃

原设计为 ubusd 守护脚本（S11），实测发现逻辑缺陷：

```sh
rm -f $SOCK          # 先删 socket
# 若 ubusd 仍在运行则不再启动 → 磁盘 socket 与监听 inode 不一致
```

这会**加剧** ubus 故障（孤儿 socket），而非修复。已从部署清单移除。
本目录保留该文件仅作历史存档，**请勿部署**。

### 七、自启配置

```sh
uci set lucky.@lucky[0].enabled=1
uci commit lucky
/etc/init.d/lucky enable              # → S99lucky / K10lucky
/etc/init.d/lucky-cache-warm enable   # → S95lucky-cache-warm / K05lucky-cache-warm
```

### 八、缓存预热机制

`lucky-cache-warm`（S95）在开机后 `sleep 20` 再后台生成缓存：

- 启动命令 **0.02 秒立即返回**，不阻塞开机
- 缓存文件：`/tmp/lucky_info_cache.json`
- 生成耗时约 **7.9 秒**（三个 lucky 命令串行）
- TTL **60 秒**，过期后由控制器后台异步刷新
- 并发保护：8 秒锁文件，避免重复刷新

### 九、部署后验证清单

```sh
# 1. 进程与端口
ps w | grep "[u]sr/bin/lucky"
netstat -lntp | grep -E "16601|16603"

# 2. HTTP 探活
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:16603/

# 3. 缓存内容
grep -oE 'AdminWebListenPort":[0-9]+' /tmp/lucky_info_cache.json

# 4. 自启链
ls /etc/rc.d/ | grep lucky

# 5. 服务日志
logread | grep lucky | tail -20
```

期望结果：

| 检查项 | 期望值 |
|---|---|
| 监听端口 | 16601 + 16603 |
| HTTP 16603 | 200 |
| 缓存端口 | `16603` |
| 自启链 | S99lucky / S95lucky-cache-warm / K10lucky / K05lucky-cache-warm |
| 日志 | `开机预热完成` + `缓存更新成功` |

### 十、实测记录

| 项目 | 结果 |
|---|---|
| 部署日期 | 2026-10-31 |
| 重启后自动启动 | ✅ 成功 |
| 缓存自动预热 | ✅ 成功（09:00:14 日志） |
| 面板访问 | ✅ `http://192.168.1.1:16603` 正常 |
| 默认账号密码 | `666` / `666` |
