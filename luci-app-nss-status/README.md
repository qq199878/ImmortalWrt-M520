# luci-app-nss-status

NSS（Network Subsystem / 网络子系统）硬件加速状态面板。

## 用途

显示 Qualcomm NSS 引擎（qca-nss-drv）的工作状态、端口统计、加速命中情况。

## AI 魔改点

- 标准 LuCI 插件结构（Makefile + root/usr + root/www）
- 页面读取 NSS 引擎统计信息并展示

## 部署

标准 OpenWrt 软件包，可用 SDK 编译为 .ipk 安装，或手动复制 root 下文件到对应路径。
