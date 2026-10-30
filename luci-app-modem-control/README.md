# luci-app-modem-control

4G/5G 模块控制插件，用于锐捷 M520 的内置蜂窝模块管理。

## 用途

- 通过 AT 指令查询模块状态、信号、网络注册情况
- 模块电源管理（上电/下电/复位）
- 短信收发

## AI 魔改点

- `modem_control.js`：LuCI 前端界面，状态展示 + 操作按钮
- `modem_power.init`：模块电源管理 procd 服务脚本
- `at_probe.lua`：AT 指令探测后端

## 部署

```sh
# 将文件复制到路由器
scp -r luci-app-modem-control/* root@192.168.1.1:/usr/lib/lua/luci/
```
