# ImmortalWrt for Ruijie RG-MTFi-M520 (NSS 硬件加速版)

基于 [ImmortalWrt](https://github.com/immortalwrt/immortalwrt)（GPL-2.0-only）的锐捷 RG-MTFi-M520 车载/工业级路由器定制固件源码，完整打通高通 IPQ8064 NSS 协处理器芯片级硬件加速。

- **目标平台**：`ipq806x/generic`
- **目标设备**：`DEVICE_ruijie_rg-mtfi-m520` (Ruijie RG-MTFi-M520)
- **内核底座**：Linux 6.12 (SNAPSHOT)
- **网络架构**：WAN (`eth0`) + LAN (`eth1`) 物理双网口直通 + 双频 Wi-Fi 硬件直通

---

## 🌟 NSS 硬件加速移植与出处致谢 (Credits)

本项目针对高通 IPQ8064 芯片架构在现代 Linux 6.12 内核底座上实现了满血 NSS 硬件加速，核心加速框架、底层驱动补丁与参考出处如下：

1. **核心移植参考树**：
   * 参考自 **[gyimesibalazs/openwrt-ipq806x-nss-25.12](https://github.com/gyimesibalazs/openwrt-ipq806x-nss-25.12)**（分支 `ipq806x-nss-25.12.6`）；
   * 吸收并参考了其在现代 OpenWrt 源码树中移植 `qca-nss-drv`、`qca-nss-gmac` 与 `qca-nss-ecm` 的架构规范。

2. **上游驱动包与补丁源**：
   * 参考自 **[ACwifidude/nss-packages](https://github.com/ACwifidude/nss-packages)**（分支 `NSS-11.2-K5.15`）；
   * 参考其高通原厂 NSS 11.2 驱动在现代内核下的基础封装、ECM 分流模块与网络接口适配经验。

3. **Linux 6.12 内核适配参考**：
   * 参考自 **[Karin-Laboratory/wg2600hp-openwrt-nss](https://github.com/Karin-Laboratory/wg2600hp-openwrt-nss)**；
   * 参考其针对 IPQ8064 平台在 Linux 6.12 内核环境下的驱动编译与运行时适配经验。

4. **NSS 协处理器固件**：
   * 采用高通原厂 QSDK 零售版微码固件 **`qca-nss0-retail.bin`**（MD5: `b0ee1555d990bc4ccd36cb67f0269a83`），直接集成于驱动包内开箱即用。

---

## 🛠️ M520 本地专属适配与重构改动

针对锐捷 RG-MTFi-M520 特殊的车载工业级无独立交换机硬件拓扑，本项目完成了以下关键攻坚改动：

1. **GMAC 网络驱动空指针修复**：
   * 修复了 `qca-nss-gmac` 在 Linux 6.12 下 `nss_gmac_ctrl.c` 的 `SET_NETDEV_DEV` 空指针崩溃问题，彻底解决了 WiFi 丢失与内核重启循环。
2. **物理双网口无 VLAN 干净直通**：
   * 针对 M520 仅有两个独立物理网口（无交换机芯片）的拓扑，修复 `02_network` 与 `/etc/board.json` 消除 switch/vlan 虚假配置，物理 `eth0` 直绑 WAN、物理 `eth1` 直绑 LAN，打通满载千兆线速 NSS 直连（满载主 CPU 空闲 80%）。
3. **双频 Wi-Fi 芯片级硬件加速**：
   * 在 `mac80211` 注入 `MAC80211_NSS_SUPPORT` 硬件分流开关；
   * 纠正 PCIe 通道与频段物理映射（`1b500000` 锁定 5G / `1b700000` 锁定 2.4G），实现双频无线 NSS 硬件加速。
4. **固件升级兼容性防护**：
   * 在 `generic.mk` 中将 `DEVICE_COMPAT_VERSION` 升级至 `1.1`，消除 Web 升级时 `(1.1->1.0)` 的虚假拦截。
5. **集成自主研发 NSS 实时监控插件**：
   * 原生内置 **`luci-app-nss-status`**（位于 LuCI「网络 → NSS 硬件加速」），后端基于 ucode 直接采集 NSS DebugFS，前端 2 秒无感轮询展示硬件加速状态、流表命中、吞吐量及协处理器负载。

---

## 本仓库内容
- 完整 ImmortalWrt 源码树 + 本机对 M520 的适配改动
- `configs/m520.config`：编译配置
- `.github/workflows/build.yml`：GitHub Actions 云编译
- `SOURCE_CHANGES_M520.md`：详细改动说明

## 云编译（GitHub Actions）
1. 打开仓库 **Actions** 标签页
2. 选择 **Build ImmortalWrt for Ruijie M520**
3. 点 **Run workflow** → 等待编译完成
4. 在 **Artifacts** 下载固件包

## 本地编译
```bash
./scripts/feeds update -a
./scripts/feeds install -a
cp configs/m520.config .config
make defconfig
make -j$(nproc)
```

## 同步上游
```bash
git fetch upstream
git merge upstream/master
```

## 许可证
本项目遵循 GPL-2.0-only。`package/bully/` 为独立包，遵循 GPL-3.0。
