# 防火墙移动端卡片

防火墙（Firewall）页面移动端适配。

## 用途

将 LuCI 防火墙的规则 / 端口转发 / SNAT 页面改造成手机友好的卡片式布局。

## AI 魔改点

- `form.js`：CBI 表单渲染重构
- `rules.js` / `forwards.js` / `snats.js`：三张页面的移动端卡片版
- `argon_cascade.css`：Argon 主题级联样式适配
- `build_mobile_v3.py` / `build_mobile_v4.py` / `build_firewall_suite.py`：构建脚本

## 部署

```sh
scp deploy.sh root@192.168.1.1:/tmp/ && ssh root@192.168.1.1 'sh /tmp/deploy.sh'
```
