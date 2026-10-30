# luci-app-sms-manager

短信管理插件。

## 用途

- 收发短信
- 短信转发

## AI 魔改点

- `sms_manager.js`：LuCI 前端（4.3 万字节，完整短信管理界面）
- `luci.sms-manager`：rpcd 后端方法

## 部署

```sh
scp -r luci-app-sms-manager/* root@192.168.1.1:/usr/lib/lua/luci/
```
