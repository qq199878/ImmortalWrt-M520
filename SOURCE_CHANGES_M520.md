# M520 当前源码修改说明

本文按当前工作区源码状态整理 Ruijie RG-MTFi-M520 的本地修改。旧版文档中的中间尝试、已撤回方案和重复说明已清理；以下内容以当前源码为准。

## 1. 当前目标

设备和目标：

- 设备：Ruijie RG-MTFi-M520，`ipq806x/generic`。
- 内核：ImmortalWrt Linux 6.12.91。
- 主要问题：启动到 LAN/WAN/WiFi 基本起来后约 100 秒偶发 watchdog/瞬时复位，日志无 panic/Oops/call trace，pstore 暂未抓到有效 panic。
- WiFi 当前判断：不是 hostapd 配置错误；日志方向更像 `ath10k-ct` 触发 `SWBA overrun`、`Cannot communicate with firmware`、`Hardware restart` 一类固件/驱动稳定性问题。
- 当前处理方向：M520 优先测试主线 `ath10k` + 主线 `qca988x` firmware，并降低默认 WiFi 压力。

本轮约束：

- 不再新增或回退 ath10k 校准逻辑。
- 不再改 WiFi caldata offset/length。
- 不默认启用复杂 WiFi 特性，先保证基础 AP 稳定启动和长时间运行。
- 保留 IPv6 获取能力，不禁用 `wan6`。
- 保留 USB 网卡和蜂窝/QMI 驱动兼容性。
- 不为消日志盲目添加 dummy regulator。

## 2. 当前修改文件

核心源码和默认配置：

```text
package/boot/uboot-tools/uboot-envtools/files/ipq806x
package/network/config/firewall4/patches/001-firewall4-add-support-for-fullcone-nat.patch
package/network/services/dnsmasq/files/dhcp.conf
package/network/services/ppp/files/ppp.sh
target/linux/ipq806x/base-files/etc/board.d/01_leds
target/linux/ipq806x/base-files/etc/board.d/02_network
target/linux/ipq806x/base-files/etc/hotplug.d/ieee80211/09_fix_wifi_mac
target/linux/ipq806x/base-files/etc/hotplug.d/net/20-m520-usb-net-debounce
target/linux/ipq806x/base-files/etc/uci-defaults/90_m520_network_runtime_defaults
target/linux/ipq806x/config-6.12
target/linux/ipq806x/dts/qcom-ipq8064-rg-mtfi-m520.dts
target/linux/ipq806x/image/generic.mk
feeds/packages/net/hcxdumptool/Makefile
feeds/packages/net/hcxtools/Makefile
```

当前仍存在的补丁文件：

```text
target/linux/generic/pending-6.12/711-05-net-dsa-qca8k-make-FDB-delete-idempotent.patch
target/linux/generic/pending-6.12/711-06-net-stmmac-demote-missing-optional-irq-logs.patch
target/linux/generic/pending-6.18/711-05-net-dsa-qca8k-make-FDB-delete-idempotent.patch
target/linux/generic/pending-6.18/711-06-net-stmmac-demote-missing-optional-irq-logs.patch
target/linux/ipq806x/patches-6.12/125-thermal-qcom-tsens-increase-read-timeout.patch
target/linux/ipq806x/patches-6.12/126-ARM-dts-qcom-ipq8064-align-tsens-qfprom-cells.patch
```

当前仍存在但本轮不再继续调整的 ath10k 相关旧补丁：

```text
package/kernel/ath10k-ct/patches/989-ath10k-ct-ignore-unsupported-board-id-for-pre-cal.patch
package/kernel/ath10k-ct/patches/990-ath10k-ct-ignore-otp-result-for-pre-cal.patch
package/kernel/ath10k-ct/patches/991-ath10k-ct-demote-unsupported-pdev-param-log.patch
package/kernel/mac80211/patches/ath10k/986-ath10k-ignore-unsupported-board-id-for-pre-cal.patch
package/kernel/mac80211/patches/ath10k/987-ath10k-ignore-otp-result-for-pre-cal.patch
```

当前新增的主线 ath10k 修复补丁：

```text
package/kernel/mac80211/patches/ath10k/989-ath10k-use-direct-requests-for-optional-firmware.patch
```

说明：旧 ath10k 补丁已在工作区存在，本文只记录当前状态。本轮 WiFi 稳定性测试优先切换到主线 `kmod-ath10k` 和主线 `ath10k-firmware-qca988x`。新增 `989` 补丁用于修复缺失可选 firmware 文件触发 userspace fallback 导致的启动延迟。

## 3. M520 DTS 当前状态

文件：

```text
target/linux/ipq806x/dts/qcom-ipq8064-rg-mtfi-m520.dts
```

当前包含：

- `ramoops@42100000`，大小 `0x40000`，用于 pstore/ramoops。
- `bootargs` 中设置 `usbcore.autosuspend=-1`。
- `thermal-zones` 显式定义 `sensor0-thermal` 的 sensor、trips 和 CPU cooling-map：

```dts
sensor0-thermal {
	polling-delay-passive = <250>;
	polling-delay = <1000>;
	thermal-sensors = <&tsens 0>;

	trips {
		cpu-critical {
			temperature = <105000>;
			hysteresis = <2000>;
			type = "critical";
		};

		cpu-hot {
			temperature = <95000>;
			hysteresis = <2000>;
			type = "hot";
		};

		cpu_passive: cpu-passive {
			temperature = <90000>;
			hysteresis = <2000>;
			type = "passive";
		};
	};

	cooling-maps {
		map0 {
			trip = <&cpu_passive>;
			cooling-device = <&cpu0 0 10>;
		};

		map1 {
			trip = <&cpu_passive>;
			cooling-device = <&cpu1 0 10>;
		};
	};
};
```

- 保留基于 LM75 的 `board-thermal`，并添加静态 trips，避免 LM75 `temperature-sensor id=0` 注册时没有 trip points：

```dts
board-thermal {
	polling-delay-passive = <0>;
	polling-delay = <10000>;
	thermal-sensors = <&lm75_temp>;

	trips {
		board-critical {
			temperature = <95000>;
			hysteresis = <2000>;
			type = "critical";
		};

		board-hot {
			temperature = <80000>;
			hysteresis = <2000>;
			type = "hot";
		};
	};
};
```
- 板载 SYS LED 使用 TCA9539 GPIO 扩展器：

```dts
label = "green:sys";
gpios = <&gpio_ext 15 GPIO_ACTIVE_LOW>;
```

- LM75 使用标准 compatible，并接入专用 3.3V fixed regulator：

```dts
compatible = "national,lm75", "lm75";
vs-supply = <&vdd_3v3_lm75>;
```

- SPI fixed-partitions 中存在 `APPSBLENV@160000`，label 为 `APPSBLENV`。
- USB PHY 和 USB3 控制器启用。
- 仍存在旧的 ath10k NVMEM pre-calibration DTS 绑定：

```dts
precal_ART_1000: precal@1000 { ... };
precal_ART_5000: precal@5000 { ... };
nvmem-cell-names = "pre-calibration";
```

注意：

- 当前文档把 WiFi 稳定性问题优先按 `ath10k-ct` 路径处理；整机 watchdog/瞬时复位仍需结合 pstore 和持久日志继续区分。
- 不再继续修改 ath10k caldata offset/length。
- LM75 的 fixed regulator 是对真实板载 LM75 供电描述的补全，不是为消除其它 dummy regulator 日志而添加的虚假 supply。

刷机后验证：

```sh
dmesg | grep -Ei 'ramoops|pstore|thermal|lm75|tca953|pca953|green:sys|usbcore'
ls /sys/class/leds
for z in /sys/class/thermal/thermal_zone*; do echo "$z"; cat "$z/type"; cat "$z/temp"; done
```

## 4. U-Boot envtools

文件：

```text
package/boot/uboot-tools/uboot-envtools/files/ipq806x
target/linux/ipq806x/image/generic.mk
```

当前状态：

- M520 默认镜像包含 `uboot-envtools`。
- `ruijie,rg-mtfi-m520` 使用 `/proc/mtd` 中的 MTD label `APPSBLENV` 查找分区。
- 环境大小固定为 `0x10000`，匹配实机日志：

```text
0x000000160000-0x000000170000 : "APPSBLENV"
```

- 不硬编码 mtd 序号。
- 不在启动脚本中自动 `fw_setenv` 或 `saveenv`。
- 不再创建空的 `/etc/fw_env.config` 兜底文件。

刷机后验证：

```sh
cat /etc/fw_env.config
fw_printenv
dmesg | grep -Ei 'fw_env|NVMEM device|APPSBLENV'
```

预期：

- `/etc/fw_env.config` 指向 APPSBLENV 对应的 `/dev/mtdX`。
- 不再出现 `Cannot parse config file '/etc/fw_env.config'`。

## 4.1. M520 WiFi 驱动和固件默认包

文件：

```text
target/linux/ipq806x/image/generic.mk
.config
```

当前处理：

- M520 镜像 profile 不再使用默认 `kmod-ath10k-ct`。
- M520 镜像 profile 显式移除 ct 驱动并加入主线驱动：

```make
DEVICE_PACKAGES := -kmod-ath10k-ct kmod-ath10k ath10k-firmware-qca988x \
	kmod-hwmon-lm75 kmod-rtc-pcf8563 kmod-ramoops uboot-envtools \
	kmod-fs-f2fs losetup mkf2fs
```

- 当前 `.config` 已同步为：

```text
CONFIG_DEFAULT_ath10k-firmware-qca988x=y
CONFIG_DEFAULT_kmod-ath10k=y
CONFIG_PACKAGE_ath10k-firmware-qca988x=y
# CONFIG_PACKAGE_ath10k-firmware-qca988x-ct is not set
CONFIG_PACKAGE_kmod-ath10k=y
# CONFIG_PACKAGE_kmod-ath10k-ct is not set
```

原因：

- M520 WiFi 当前不是 hostapd 配置错误。
- 问题日志集中在 `ath10k-ct` 的 firmware 通信和硬件重启路径。
- 优先用主线 `kmod-ath10k` + `ath10k-firmware-qca988x` 验证是否消除 `SWBA overrun`、`Cannot communicate with firmware`、`Hardware restart`。

刷机后验证：

```sh
apk list --installed | grep -E 'ath10k|qca988x'
lsmod | grep ath10k
dmesg | grep -Ei 'ath10k|firmware|SWBA|Hardware restart|Cannot communicate'
```

## 5. M520 首启运行时默认配置

文件：

```text
target/linux/ipq806x/base-files/etc/uci-defaults/90_m520_network_runtime_defaults
```

当前设置：

```text
network.wan.ipv6='1'
network.wan6='interface'
network.wan6.device='@wan'
network.wan6.proto='dhcpv6'
network.wan6.reqaddress='try'
network.wan6.reqprefix='auto'
network.wan6.norelease='1'

dhcp.lan.ra='server'
dhcp.lan.dhcpv6='server'
dhcp.lan.ra_slaac='1'
dhcp.lan.ra_flags='managed-config other-config'

system.@system[0].log_file='/overlay/log/messages'
system.@system[0].log_size='512'
system.@system[0].watchdog='1'
system.@system[0].watchdog_timeout='60'
system.m520_usb_net_debounce.enabled='1'
system.m520_usb_net_debounce.delay='10'

wireless.radio0.band='5g'
wireless.radio0.channel='36'
wireless.radio0.htmode='VHT80'
wireless.radio1.band='2g'
wireless.radio1.channel='11'
wireless.radio1.htmode='HT20'
```

WiFi 默认策略：

- 首启时如果 `/etc/config/wireless` 为空，先调用 `/sbin/wifi config` 生成 mac80211 默认 radio/iface。
- `radio0` 固定为 5G 默认配置，`VHT80`，channel 使用 `36`。
- `radio1` 固定为 2.4G 默认配置，`HT20`，channel 使用 `11`。
- 2.4G 默认不使用 `auto`，如现场干扰需要再手动测试 `6` 或 `1`。
- 不再把 2.4G `radio1` 写成 `VHT20`。
- 对默认 AP，如果已有 `key`，将 `encryption` 规范为 `psk2+ccmp`，避免 `psk-mixed/tkip` 影响 11n/ac 速率。
- 如果默认 AP 没有密码，不强行写 `psk2+ccmp`，避免空 key 导致 hostapd 启动失败。
- 对默认 AP 清理以下高级 WiFi 特性配置，避免首启默认压力过高：
  - `ieee80211r`
  - `ieee80211k`
  - `bss_transition`
  - `wnm_sleep_mode`
  - `ieee80211w`
  - `ocv`
  - `airtime_bss_weight`
  - `multicast_to_unicast`

WiFi MAC 默认策略：

- 从 `PRODUCTINFO` 分区读取 `ethaddr` 作为 base MAC。
- `radio0/default_radio0` 使用 `base+2`。
- `radio1/default_radio1` 使用 `base+3`。
- 之所以不用 `base+1` 给 WiFi，是因为当前 `board.d/02_network` 已经将 LAN 设置为 `base+1`；使用 `base+2/base+3` 可避免和 LAN/WAN 重复，并与现有 ath10k caldata MAC 派生保持一致。

USB/QMI/CDC-ether 默认策略：

- 对默认配置中非 `lan`、`wan`、`wan6` 的接口，如果匹配以下条件，设置 `auto=0`：
  - `proto=qmi`
  - `proto=mbim`
  - `proto=ncm`
  - `device=wwan*`
- 不再按固定接口名匹配 USB 网卡。

M520 USB 网卡 hotplug debounce 默认策略：

- 默认启用 M520 专用 USB netdev 去抖：

```text
system.m520_usb_net_debounce='m520_usb_net_debounce'
system.m520_usb_net_debounce.enabled='1'
system.m520_usb_net_debounce.delay='10'
```

- 该机制只负责推迟 USB 网卡对应 network interface 的 `ifup`，不能阻止硬件层面的 USB disconnect/reconnect。

mwan3 nftables 版本和本地 bypass 规则策略：

- 当前源码已将旧 iptables/ipset 版 mwan3 替换为 dl12345 的 nftables 版 mwan3。
- 当前 mwan3 默认配置包含 `wan`、`wan6`、`wanb`、`wanb6`、多个 `member`/`policy` 模板，以及 `default_rule_v4`/`default_rule_v6` 模板；这些默认接口和默认规则均为 `enabled '0'`。
- M520 不额外创建或启用 mwan3 负载均衡、failover 或默认出口策略。
- M520 的 uci-defaults 保留新版 mwan3 默认 disabled 模板，只在已有 `/etc/config/mwan3` 上添加本地 bypass 规则，不新建 mwan3 `interface`、`member`、`policy`。
- 如果系统未安装 mwan3，或 `/etc/config/mwan3` 不存在，则直接跳过 mwan3 配置，不新建 `/etc/config/mwan3`。
- 如果 `/etc/config/mwan3` 已存在，首启时从当前 `/etc/config/network` 读取：

```sh
uci -q get network.lan.ipaddr
uci -q get network.lan.netmask
```

- LAN CIDR 计算同时支持两种格式：
  - `network.lan.ipaddr='192.168.1.1'` + `network.lan.netmask='255.255.255.0'`：使用 `/bin/ipcalc.sh "$lan_ipaddr" "$lan_netmask"`。
  - `network.lan.ipaddr='192.168.1.1/24'` 且没有 `network.lan.netmask`：直接使用 `/bin/ipcalc.sh "$lan_ipaddr"`，不要求 `lan_netmask` 存在。
- 成功计算后使用 `NETWORK/PREFIX` 形式的 CIDR 以及 `BROADCAST`。
- 不再硬编码 `192.168.1.0/24` 作为 LAN bypass 网段。
- 首启时删除并重建以下命名 bypass 规则，确保规则顺序可控：
  - `mwan3.lan_local`
  - `mwan3.lan_broadcast`
  - `mwan3.usb_modem_local`
- `mwan3.default_rule_v4` 和 `mwan3.default_rule_v6` 保持新版 mwan3 默认模板状态；默认 `enabled '0'`，不会接管默认出口流量。
- 如果成功算出 LAN CIDR，创建 `lan_local`：

```text
mwan3.lan_local='rule'
mwan3.lan_local.dest_ip='<自动计算的 LAN_CIDR>'
mwan3.lan_local.use_policy='default'
mwan3.lan_local.family='ipv4'
```

- 如果成功算出 LAN broadcast，创建 `lan_broadcast`：

```text
mwan3.lan_broadcast='rule'
mwan3.lan_broadcast.dest_ip='<自动计算的 LAN_BROADCAST>'
mwan3.lan_broadcast.use_policy='default'
mwan3.lan_broadcast.family='ipv4'
```

- 创建 USB modem 管理网段 bypass：

```text
mwan3.usb_modem_local='rule'
mwan3.usb_modem_local.dest_ip='192.168.0.0/24'
mwan3.usb_modem_local.use_policy='default'
mwan3.usb_modem_local.family='ipv4'
```

- 通过 `uci reorder` 将 `lan_local`、`lan_broadcast`、`usb_modem_local` 放到 mwan3 rules 最前面。
- 该逻辑只在 uci-defaults 首次启动阶段执行，不会在用户后续手动修改配置后反复覆盖。

高风险插件默认策略：

- 首启时如果存在以下 init 脚本，则执行 disable：
  - `passwall`
  - `passwall_server`
  - `mosdns`
  - `xray`
  - `chinadns-ng`
  - `sing-box`
- 如果存在对应 UCI 配置，则把各配置中的 `enabled` 写为 `0`。

注意：

- 当前没有 USB/QMI 延迟启动脚本；该方案已撤回。
- 当前没有禁用 `wan6`。
- 这些 uci-defaults 对保留配置 sysupgrade 不会强行覆盖已有用户配置。

刷机后验证：

```sh
uci show network.wan
uci show network.wan6
uci show system.@system[0] | grep -E 'log_file|log_size|watchdog'
uci show wireless.radio0
uci show wireless.radio1
uci show wireless.default_radio0
uci show wireless.default_radio1
uci show network | grep -Ei 'usb|wwan|qmi'
uci show mwan3.lan_local
uci show mwan3.lan_broadcast
uci show mwan3.usb_modem_local
uci -q show mwan3.default_rule_v4.enabled
uci -q show mwan3.default_rule_v6.enabled
grep -n "config rule" /etc/config/mwan3
logread | grep -Ei 'wan6|SOLICIT|LLA socket|dhcpv6|odhcp6c|qmi|cdc_ether|wwan|usb|m520-usb-net-debounce|netifd'
```

## 5.1. M520 WiFi MAC hotplug 修正

文件：

```text
target/linux/ipq806x/base-files/etc/hotplug.d/ieee80211/09_fix_wifi_mac
```

当前状态：

- 原 `10_fix_wifi_mac` 已移动为 `09_fix_wifi_mac`。
- 这样可确保 WiFi MAC 修正早于 `package/network/config/wifi-scripts/files/etc/hotplug.d/ieee80211/10-wifi-detect` 执行，避免自动生成 `/etc/config/wireless` 时读到错误 phy MAC。
- M520 分支只在读取到有效 `PRODUCTINFO ethaddr` 时写 `/sys${DEVPATH}/macaddress`。
- 无效 base MAC 会被跳过：空值、`00:00:00:00:00:00`、`ff:ff:ff:ff:ff:ff`。
- `phy0` 写入 `base+2`。
- `phy1` 写入 `base+3`。
- 保留原有 `extreme,ap3935` 逻辑。

未修改：

- 没有改 ath10k OTP、board id 或 pre-cal/ART offset/length 逻辑。
- 没有新增硬编码 `00:03:07:12:34:56`。

刷机后验证：

```sh
cat /sys/class/ieee80211/phy0/macaddress
cat /sys/class/ieee80211/phy1/macaddress
uci show wireless.radio0.macaddr
uci show wireless.radio1.macaddr
uci show wireless.default_radio0.macaddr
uci show wireless.default_radio1.macaddr
iw dev
```

预期：

- 两个 AP BSSID 不再相同。
- 不应再出现 `00:03:07:12:34:56`。
- 5G `phy0-ap0` 使用 `PRODUCTINFO ethaddr + 2`。
- 2.4G `phy1-ap0` 使用 `PRODUCTINFO ethaddr + 3`。
- `wireless.radio1.htmode` 为 `HT20`，不是 `VHT20`。

## 5.2. M520 ath10k 可选 firmware fallback 修正

文件：

```text
package/kernel/mac80211/patches/ath10k/989-ath10k-use-direct-requests-for-optional-firmware.patch
```

背景：

- M520 使用主线 `ath10k` + `ath10k-firmware-qca988x`。
- PCIe 设备可在启动早期完成枚举，但 `ath10k_pci` probe 后到下一条有效 ath10k 日志之间可能出现约 60 秒空白。
- 根因已确认：`CONFIG_FW_LOADER_USER_HELPER_FALLBACK=y` 时，ath10k 对缺失的可选探测文件使用 `firmware_request_nowarn()` / `request_firmware()` 会触发 sysfs/userspace fallback，并等待 `/sys/class/firmware/timeout`，默认 60 秒。
- 将 `/sys/class/firmware/timeout` 临时降到 `1` 后，延迟从约 66 秒降到约 2.5 秒，证明延迟来自 firmware fallback。
- M520 实际缺失的可选探测文件包括：
  - `pre-cal-pci-*`
  - `firmware-6.bin`
  - `board-2.bin`
  - `board-pci-*.bin`
- M520 实际存在并应正常加载的文件包括：
  - `cal-pci-0000:01:00.0.bin`
  - `cal-pci-0001:01:00.0.bin`
  - `firmware-5.bin`
  - `board.bin`

源码路径判断：

- `package/kernel/mac80211` 的主线 ath10k 在 `ath10k_fetch_cal_file()` 中先请求 `pre-cal-<bus>-<id>.bin`，失败后才请求 `cal-<bus>-<id>.bin`。
- QCA988X hw2.0 firmware API 从高到低尝试，当前源码 `ATH10K_FW_API_MAX=6`，因此会先尝试 `firmware-6.bin`，再回退到已有的 `firmware-5.bin`。
- board 文件先尝试 `board-2.bin`，失败后回退到已有的 `board.bin`。
- 当前内核配置启用 `CONFIG_FW_LOADER_USER_HELPER_FALLBACK=y`，缺失 firmware 的 sysfs fallback 会受 `/sys/class/firmware/timeout` 影响。
- OpenWrt 的 `921-ath10k_init_devices_synchronously.patch` 会对非 SDIO ath10k 执行 `flush_workqueue()`，因此 firmware fallback 等待会直接拖慢 ath10k probe。

当前修正：

- 在 mainline ath10k 的 `core.c` 中新增 direct 请求 helper，使用 `request_firmware_direct()` 处理可选探测/降级文件，避免触发 sysfs/userspace fallback。
- `pre-cal-pci-*` 使用 direct 请求；缺失时立即失败并继续回退到现有 `cal-pci-*` 路径。
- firmware API 降级探测从高到低查找本地文件；`firmware-6.bin` 等可选探测文件使用 direct 请求，M520 会快速跳过缺失的 `firmware-6.bin`。
- `firmware-5.bin` 明确保留原 normal request 路径，不使用 direct；如果它真正缺失，仍保留原有错误处理和 userspace fallback 行为。
- `board-2.bin` 和 `board-pci-*.bin` 这类 board 探测文件使用 direct 请求；缺失时立即回退到已有 `board.bin`。
- `board.bin`、`cal-pci-*` 和 `firmware-5.bin` 仍按原有解析和错误处理流程加载。
- 同步更新 `core.h` 和 `testmode.c` 中 `ath10k_core_fetch_firmware_api_n()` 的签名；testmode 保持原 normal request 行为。
- 前面 M520 hotplug 中针对 `pre-cal-pci-*` 的设备专用绕过已撤掉，改由 ath10k 源码统一处理。

约束：

- 不切回 `ath10k-ct`。
- 不使用未知来源 firmware。
- 不伪造 `firmware-6.bin`。
- 不伪造 `board-2.bin`。
- 不全局修改 `/sys/class/firmware/timeout`。
- 不修改 M520 的 ART offset/length。
- 不改变现有 `cal-pci-*` 提取逻辑和 MAC patch 逻辑。

风险：

- 该补丁改变的是主线 ath10k 对可选探测文件的请求方式，目标是避免缺失可选文件等待 60 秒。
- 如果某些设备依赖 userspace fallback 动态提供 `pre-cal-*`、`board-2.bin` 或更高 firmware API 文件，direct 请求会跳过这类 userspace 注入路径；OpenWrt 常规镜像中这些文件应来自 `/lib/firmware` 或 hotplug 生成的 `cal-pci-*`。
- 真正缺少 `firmware-5.bin`、`board.bin` 或 `cal-pci-*` 时，代码仍走原 normal request 路径和明确错误处理，不会被 direct 探测静默吞掉。

## 5.3. M520 USB 网卡 hotplug debounce

文件：

```text
target/linux/ipq806x/base-files/etc/hotplug.d/net/20-m520-usb-net-debounce
```

目标：

- 处理 USB 复合设备模式切换或重新枚举时序导致的网络抖动。
- 不阻止 USB 设备重新枚举，不屏蔽 `usb-storage`，不影响 U 盘读取。
- 不新增 USB 网卡驱动；当前 USB 网卡驱动保持不变。
- 不针对具体 VID/PID，不指定固定 USB ID。
- 不针对具体接口名。
- 只作用于 USB 总线上的 netdev，不影响内置 `eth0`/`eth1`、`lan1`、`wan`、`br-lan`、WiFi、PPPoE。

启用条件：

- 脚本只在 `board_name=ruijie,rg-mtfi-m520` 时运行。
- UCI 开关：

```text
system.m520_usb_net_debounce.enabled='1'
system.m520_usb_net_debounce.delay='10'
```

识别方式：

- 从 `/sys/class/net/$DEVICENAME/device` 解析真实 device path。
- 如果 device 的 subsystem 指向 `/sys/bus/usb`，或 device path 包含 USB 设备路径，则判定为 USB netdev。
- 不读取、不匹配、不记录 VID/PID。

处理流程：

- 只处理 net hotplug 的 `add` 和 `change`；`remove` 时删除该 netdev 的 pending token。
- `add/change` 时创建 `/var/run/m520-usb-net-debounce/$DEVICENAME` token。
- 如果该 netdev 能匹配已有 UCI network interface 的 `device` 或 legacy `ifname`，先 `ifdown` 该 network interface，让 DHCP、IPv6、mwan3、firewall、odhcpd 不在设备未稳定时继续推进。
- 后台等待 `delay` 秒，默认 10 秒。
- 等待结束后再次确认：
  - `/sys/class/net/$DEVICENAME` 仍存在；
  - `/sys/class/net/$DEVICENAME/device` 仍可解析；
  - device path 和等待前一致；
  - 该 netdev 仍判定为 USB netdev；
  - token 未被后续 add/change 覆盖，也未被 remove 删除。
- 如果确认稳定，只对已有 UCI network interface 执行 `ifup`。
- 如果找不到对应 UCI network interface，只写日志，不创建 network 配置。
- 脚本自身执行 `ifup` 后会设置短期 marker，避免 `ifup` 引起的后续 netdev `change` 立即再次进入去抖循环。

日志 tag：

```text
m520-usb-net-debounce
```

刷机后验证：

```sh
uci show system.m520_usb_net_debounce
logread -f | grep -Ei 'm520-usb-net-debounce|cdc_ether|usb-storage|netifd|mwan3|odhcpd'
```

## 6. 持久日志和复位后定位

当前默认持久日志：

```text
/overlay/log/messages
```

复位后第一时间取：

```sh
tail -n 300 /overlay/log/messages
grep -Ei 'watchdog|panic|oops|reboot|usb|qmi|cdc_ether|wwan|ath10k|hostapd|netifd|passwall|mosdns|xray|chinadns|sing-box' /overlay/log/messages | tail -n 200
```

同时取 pstore：

```sh
ls -la /sys/fs/pstore
for f in /sys/fs/pstore/*; do
	[ -e "$f" ] || continue
	echo "--- $f"
	head -n 80 "$f"
done
```

判断：

- 如果 pstore 有 panic/Oops/call trace，按 backtrace 继续修内核侧。
- 如果 pstore 为空，`/overlay/log/messages` 也只是突然截断，继续按硬 watchdog、供电瞬断、SoC 卡死方向排查。
- 如果截断前出现某个用户态服务、hotplug 或 USB/QMI 事件，优先隔离该路径。

## 7. 网络和防火墙默认行为

相关文件：

```text
target/linux/ipq806x/base-files/etc/board.d/02_network
package/network/config/firewall4/patches/001-firewall4-add-support-for-fullcone-nat.patch
package/network/services/dnsmasq/files/dhcp.conf
package/network/services/ppp/files/ppp.sh
```

当前状态：

- M520 board.d 只生成基础 `lan1` 和 `wan`：

```sh
ucidef_set_interfaces_lan_wan "lan1" "wan"
ucidef_set_network_device_conduit "lan1" "eth1"
ucidef_set_network_device_conduit "wan" "eth0"
```

- 默认不在 board.d 中生成 USB/QMI/wwan WAN 接口。
- `firewall4` fullcone 默认从 `1` 改为 `0`，优先使用普通 masquerade。
- `dnsmasq` 默认 DNS 劫持关闭。
- `ppp.sh` 对缺省 `syncdial.config.enabled` 做静默 fallback，避免 PPPoE 拨号时 `uci: Entry not found` / `sh: out of range`。

刷机后验证：

```sh
uci show network
fw4 restart
nft list ruleset | grep -E 'srcnat_wan|masquerade|fullcone'
logread | grep -Ei 'ppp|pppoe|syncdial|dnsmasq|Maximum number of concurrent DNS queries'
```

## 8. BBR sysctl 去重

当前保留：

```text
package/kernel/linux/files/sysctl-tcp-bbr.conf
package/kernel/linux/modules/netsupport.mk
```

`kmod-tcp-bbr` 会安装：

```text
/etc/sysctl.d/12-tcp-bbr.conf
```

当前删除：

```text
target/linux/ipq806x/base-files/etc/sysctl.d/99-m520-bbr.conf
```

原因：

- `12-tcp-bbr.conf` 和 `99-m520-bbr.conf` 都设置 `net.ipv4.tcp_congestion_control=bbr`。
- 当前只保留通用包自带的 `12-tcp-bbr.conf`，避免重复 sysctl 和覆盖顺序混乱。

当前仍包含 LuCI BBR 辅助包：

```text
feeds/luci/applications/luci-app-m520-bbr
CONFIG_PACKAGE_luci-app-m520-bbr=y
```

说明：

- `luci-app-m520-bbr` 不再提供额外 `/etc/sysctl.d/*tcp_congestion_control*` 文件。
- 它通过 `/etc/init.d/m520-bbr` 按 UCI 动态应用拥塞控制和队列配置。
- 因此 `/etc/sysctl.d` 中 `tcp_congestion_control` 仍只应由 `12-tcp-bbr.conf` 提供一次。

刷机后验证：

```sh
cat /proc/sys/net/ipv4/tcp_congestion_control
grep -R "tcp_congestion_control" /etc/sysctl.conf /etc/sysctl.d
/etc/init.d/m520-bbr enabled; echo $?
uci show m520_bbr
```

预期：

- `tcp_congestion_control` 为 `bbr`。
- grep 只出现 `/etc/sysctl.d/12-tcp-bbr.conf` 一处。

## 9. USB 驱动保留和精简边界

当前 `.config` 保留 USB 网卡兼容性：

```text
kmod-usb-net-aqc111
kmod-usb-net-asix
kmod-usb-net-asix-ax88179
kmod-usb-net-cdc-eem
kmod-usb-net-cdc-ether
kmod-usb-net-cdc-subset
kmod-usb-net-dm9601-ether
kmod-usb-net-kaweth
kmod-usb-net-lan78xx
kmod-usb-net-mcs7830
kmod-usb-net-pegasus
kmod-usb-net-pl
kmod-usb-net-rndis
kmod-usb-net-rtl8150
kmod-usb-net-rtl8152
kmod-usb-net-smsc75xx
kmod-usb-net-smsc95xx
kmod-usb-net-sr9700
```

说明：

- `mcs7830` 保留，用于 MOSCHIP USB Ethernet。
- `pl` 保留，用于 plusb/PLUSB 类 USB Ethernet。
- `r8152-firmware` 仍保留。

当前 `.config` 保留蜂窝/QMI/随身 WiFi 相关能力：

```text
kmod-usb-net-qmi-wwan
kmod-usb-net-cdc-mbim
kmod-usb-net-cdc-ncm
kmod-usb-net-huawei-cdc-ncm
kmod-usb-net-hso
kmod-usb-net-kalmia
kmod-usb-net-sierrawireless
kmod-usb-wdm
kmod-usb-serial
kmod-usb-serial-option
kmod-usb-serial-qualcomm
kmod-usb-serial-sierrawireless
kmod-usb-serial-wwan
uqmi
luci-proto-qmi
```

当前 `.config` 关闭的老旧或非必要 USB 模块：

```text
kmod-usb-atm
kmod-usb-atm-cxacru
kmod-usb-atm-speedtouch
kmod-usb-atm-ueagle
kmod-usb-cm109
kmod-usb-hid
kmod-usb-hid-cp2112
kmod-usb-hid-mcp2221
kmod-usb-net-ipheth
kmod-usb-printer
kmod-usb-serial-ark3116
kmod-usb-serial-belkin
kmod-usb-serial-cypress-m8
kmod-usb-serial-dmx_usb_module
kmod-usb-serial-edgeport
kmod-usb-serial-garmin
kmod-usb-serial-keyspan
kmod-usb-serial-mct
kmod-usb-serial-mos7720
kmod-usb-serial-mos7840
kmod-usb-serial-oti6858
kmod-usb-serial-simple
kmod-usb-serial-ti-usb
kmod-usb-serial-visor
kmod-usb-storage-extras
kmod-usb-yealink
kmod-usbip
kmod-usbip-client
kmod-usbip-server
```

说明：

- `kmod-usb-storage` 和 `kmod-usb-storage-uas` 保留，仅关闭老式桥接集合 `kmod-usb-storage-extras`。
- `ipheth` 关闭，对应 iPhone tethering。

## 10. 高风险网络插件

当前 `.config` 仍包含：

```text
luci-app-passwall
mosdns
chinadns-ng
sing-box
xray-core
```

当前策略：

- 包仍保留在镜像中。
- 首启默认 disable 服务并写 `enabled=0`。
- 基础网络、DHCP、WiFi、PPPoE 不依赖这些服务。

注意：

- 如果 sysupgrade 保留了旧配置，uci-defaults 不会强制覆盖已有启用状态。
- 如果要最大化降低首启负载，可进一步从 `.config` 移除这些包；当前没有这么做。
- passwall Kconfig/Makefile 冲突已修正，`make defconfig` 当前已通过，见第 14 节。

刷机后验证：

```sh
/etc/init.d/passwall enabled; echo $?
/etc/init.d/mosdns enabled; echo $?
/etc/init.d/xray enabled; echo $?
ps w | grep -Ei 'passwall|mosdns|xray|chinadns|sing-box'
```

## 11. Thermal 当前处理

当前源码包含两类处理：

- M520 DTS 不再删除 `sensor0-thermal`。
- M520 DTS 显式定义 `sensor0-thermal` 的 `thermal-sensors = <&tsens 0>` 和完整 trips，避免依赖 include/overlay 合并顺序：
  - passive：`90000` mC，hysteresis `2000` mC。
  - hot：`95000` mC，hysteresis `2000` mC。
  - critical：`105000` mC，hysteresis `2000` mC。
- M520 DTS 为 `cpu-passive` 添加 CPU cooling-map：
  - `cpu0` cooling state `0..10`。
  - `cpu1` cooling state `0..10`。
- M520 DTS 为 LM75 `board-thermal` 添加静态 trips，避免 `temperature-sensor id=0` 注册时没有 trip points：
  - board hot：`80000` mC，hysteresis `2000` mC。
  - board critical：`95000` mC，hysteresis `2000` mC。
- `target/linux/ipq806x/patches-6.12/125-thermal-qcom-tsens-increase-read-timeout.patch` 将 qcom tsens ready timeout 从 `100us` 调到 `10000us`。
- `target/linux/ipq806x/patches-6.12/126-ARM-dts-qcom-ipq8064-align-tsens-qfprom-cells.patch` 将 IPQ8064 TSENS qfprom calibration cell 长度从 `0xb` 对齐到 `0xc`。

注意：

- 没有关闭整体 thermal。
- 没有删除 LM75 board thermal。
- 不再删除 sensor 0 thermal zone。
- 不再保留 tripless board thermal zone。
- 当前复位不按 thermal critical shutdown 处理。

刷机后验证：

```sh
for z in /sys/class/thermal/thermal_zone*; do
	echo "$z"
	cat "$z/type"
	cat "$z/temp"
done
dmesg | grep -Ei 'thermal|tsens|cooling|No trip'
```

## 12. LED、温度和 LuCI 辅助

当前包含：

- `target/linux/ipq806x/config-6.12` 内建：

```text
CONFIG_GPIO_PCA953X=y
CONFIG_GPIO_PCA953X_IRQ=y
CONFIG_REGMAP_I2C=y
```

- `target/linux/ipq806x/base-files/etc/board.d/01_leds` 为 M520 设置 `green:sys` 默认 LED。
- `.config` 启用 `autocore`。
- `package/emortal/autocore/files/tempinfo` 改为优先读 SoC/thermal zone，并保留 WiFi 温度输出。

刷机后验证：

```sh
ls /sys/class/leds
dmesg | grep -Ei 'pca953|tca953|leds-gpio|green:sys'
/sbin/tempinfo
```

## 13. sysupgrade 保留配置影响

这些默认策略主要通过 uci-defaults 和包默认配置生效。

如果 sysupgrade 保留配置：

- 已有 `/etc/config/network` 不会被强行改成当前默认 `wan6`。
- 已有 `/etc/config/system` 不会被强行改成当前 watchdog/log_file。
- 已有 passwall/mosdns/xray/chinadns/sing-box 启用状态可能继续保留。
- 旧的错误 `/etc/fw_env.config` 如果作为配置被保留，可能需要手动删除后重新生成或手动修正。

为了验证默认行为，建议使用不保留配置刷机，或刷机后手动核对：

```sh
uci show network.wan
uci show network.wan6
uci show system.@system[0]
uci show network | grep -Ei 'usb|wwan|qmi'
grep -R "tcp_congestion_control" /etc/sysctl.conf /etc/sysctl.d
```

## 14. 当前验证状态

已通过：

```sh
sh -n target/linux/ipq806x/base-files/etc/uci-defaults/90_m520_network_runtime_defaults
sh -n target/linux/ipq806x/base-files/etc/hotplug.d/ieee80211/09_fix_wifi_mac
sh -n package/boot/uboot-tools/uboot-envtools/files/ipq806x
make defconfig
make target/linux/compile V=s -j1
```

`make target/linux/compile V=s -j1` 结果：

- 退出码 0。
- 覆盖内核、模块、通用 Qualcomm dtbs 和 target image compile 阶段。
- `make defconfig` 已通过；passwall Kconfig/Makefile 冲突已修正。
- `make package/kernel/linux/compile V=s -j1` 已通过。
- `make package/install V=s -j1` 已通过，并确认 `kmod-usb-storage-extras` 安装阶段不再因旧 kernel ABI 阻塞。

已核对：

- USB 网卡和 QMI/蜂窝驱动保留项仍为 `=y`。
- 需要精简的老 USB 串口、USB/IP、USB 打印、USB ADSL、iPhone tethering 等项已关闭。
- `99-m520-bbr.conf` 已不存在。
- `tcp_congestion_control` 源码设置只剩 `kmod-tcp-bbr` 包自带 `12-tcp-bbr.conf`。
- M520 WiFi 默认配置中 `radio0.htmode=VHT80`，`radio1.htmode=HT20`。
- M520 WiFi 相关脚本中没有 `00:03:07:12:34:56`。

未通过或未完成：

- 尚未基于清理后的最终状态完整重跑整固件 `make -j...`。
- 尚未刷机验证约 100 秒复位是否消失。
- 尚未刷机验证 M520 两个 AP 的实际 BSSID、协商速率和吞吐。

## 14.1. 无线审计工具包单独更新和编译

本次按单包方式核对并编译以下工具：

```text
reaver
pixiewps
hcxtools
hcxdumptool
```

版本状态：

- `reaver` 官方最新 tag 仍为 `v1.6.6`，本地 OpenWrt 包保持 `1.6.6-r1`，未改 Makefile。
- `pixiewps` 官方最新 tag 仍为 `v1.4.2`，本地 OpenWrt 包保持 `1.4.2-r2`，未改 Makefile。
- `hcxtools` 更新到 `7.1.2-r1`。
- `hcxdumptool` 更新到 `7.1.2-r1`。

源码包 hash：

```text
hcxtools-7.1.2.tar.gz    c726b93df32efd3298874b324f820d93cb08a4dae03d9144b0d5062c003fd77f
hcxdumptool-7.1.2.tar.gz 4d733201bad47be494ce712227c915c668a63b98eebd151d33108a44d08c2efb
```

`hcxtools` 注意事项：

- `7.1.2` 上游 tarball 中的 `meson.build` 仍标 `6.3.2`，且未覆盖 `hcxpottool`。
- OpenWrt 包已改为使用上游 Makefile 编译。
- 安装列表包含：

```text
usr/bin/hcxeiutool
usr/bin/hcxhash2cap
usr/bin/hcxhashtool
usr/bin/hcxpcapngtool
usr/bin/hcxpmktool
usr/bin/hcxpottool
usr/bin/hcxpsktool
usr/bin/hcxwltool
usr/bin/whoismac
usr/bin/wlancap2wpasec
```

`hcxdumptool` 注意事项：

- `7.1.2` 默认启用 libpcap/BPF 相关代码。
- OpenWrt 包的 `Build/Compile` 已传入 `CPPFLAGS`、`LDFLAGS`，并显式追加 `-lpcap`，否则会在 `pcap_open_dead`、`pcap_compile`、`pcap_freecode`、`bpf_dump` 等符号处链接失败。
- 安装列表包含：

```text
usr/sbin/hcxdumptool
usr/sbin/hcxnmealog
```

单包编译使用临时 Kconfig 变量，不修改 `.config` 中包选择：

```sh
make package/feeds/packages/reaver/compile V=s CONFIG_PACKAGE_reaver=m
make package/feeds/packages/pixiewps/compile V=s CONFIG_PACKAGE_pixiewps=m
make package/feeds/packages/hcxtools/compile V=s CONFIG_PACKAGE_hcxtools=m
make package/feeds/packages/hcxdumptool/compile V=s CONFIG_PACKAGE_hcxdumptool=m
```

已生成产物：

```text
bin/packages/arm_cortex-a15_neon-vfpv4/packages/reaver-1.6.6-r1.apk
bin/packages/arm_cortex-a15_neon-vfpv4/packages/pixiewps-1.4.2-r2.apk
bin/packages/arm_cortex-a15_neon-vfpv4/packages/hcxtools-7.1.2-r1.apk
bin/packages/arm_cortex-a15_neon-vfpv4/packages/hcxdumptool-7.1.2-r1.apk
```

构建日志中仍有当前工作区已有的提示：

- `.config` 与当前 package/kernel 状态不同步，建议后续在全量构建前运行 `make defconfig` 或按需重新整理配置。
- `lxc`、`mwan3`、`onionshare-cli` 等 feed 依赖 warning 仍存在。
- `modules/input.mk` 中 `kmod-input-adc-keys` recipe override warning 仍存在。
- `hcxtools` 编译时有 `LINE_MAX redefined` warning，但单包编译和打包已通过。

这些 warning 未阻塞上述四个 `.apk` 生成；本节只记录单包验证结果，尚未代表整固件全量编译验证。

## 15. 当前仍需决策的点

1. ath10k 旧补丁是否保留

当前工作区仍存在 ath10k/ath10k-ct 相关旧补丁。它们不是本轮 watchdog 定位新增内容，但只要在 patches 目录中，构建对应包时仍可能生效。若要严格做到“不再改 ath10k”，需要单独决定是否移出这些旧补丁。

2. 是否从镜像移除高风险插件

当前只是默认 disable，不从 `.config` 移除 passwall/mosdns/chinadns-ng/sing-box/xray-core。若复位仍出现，建议做一个不包含这些包的对照构建。

3. thermal 两条路径是否都保留

当前同时保留 `sensor0-thermal` passive/cooling-map 修正和 tsens timeout/qfprom 补丁。刷机后如果 thermal 日志已干净，可再决定是否收敛为更小改动。

4. WiFi 实机速率验证

当前源码已修默认 htmode/MAC 生成逻辑，但还需要刷机确认实际 BSSID、2.4G/5G 协商速率和吞吐。

## 16. 刷机后完整验证命令

基础状态：

```sh
uptime
dmesg | grep -Ei 'panic|oops|watchdog|thermal|ath10k|qmi|wwan|cdc_ether|br-lan|hostapd|netifd'
logread | grep -Ei 'watchdog|panic|oops|reboot|usb|qmi|ath10k|hostapd|netifd|passwall|mosdns|xray|chinadns|sing-box'
```

WiFi：

```sh
uci show wireless.radio0
uci show wireless.radio1
uci show wireless.default_radio0
uci show wireless.default_radio1
cat /sys/class/ieee80211/phy0/macaddress
cat /sys/class/ieee80211/phy1/macaddress
iw dev
iw dev phy0-ap0 station dump
iw dev phy1-ap0 station dump
logread | grep -Ei 'hostapd|wlan|phy0|phy1|VHT20|HT20|VHT80|tkip|psk-mixed'
```

U-Boot env：

```sh
cat /etc/fw_env.config
fw_printenv
```

持久日志：

```sh
uci show system.@system[0] | grep -E 'log_file|log_size|watchdog'
ls -l /overlay/log/messages
tail -n 100 /overlay/log/messages
```

IPv6：

```sh
uci show network.wan
uci show network.wan6
ifstatus wan
ifstatus wan6
logread | grep -Ei 'wan6|SOLICIT|LLA socket|dhcpv6|odhcp6c'
```

USB/QMI：

```sh
uci show network | grep -Ei 'usb|wwan|qmi'
logread | grep -Ei 'qmi|cdc_ether|wwan|usb|m520-usb-net-debounce|netifd'
lsmod | grep -Ei 'qmi_wwan|cdc_mbim|cdc_ncm|cdc_ether|r8152|asix|ax88179|aqc111|mcs7830'
```

插件：

```sh
/etc/init.d/passwall enabled; echo $?
/etc/init.d/mosdns enabled; echo $?
/etc/init.d/xray enabled; echo $?
ps w | grep -Ei 'passwall|mosdns|xray|chinadns|sing-box'
```

BBR：

```sh
cat /proc/sys/net/ipv4/tcp_congestion_control
grep -R "tcp_congestion_control" /etc/sysctl.conf /etc/sysctl.d
```

thermal 和 pstore：

```sh
for z in /sys/class/thermal/thermal_zone*; do echo "$z"; cat "$z/type"; cat "$z/temp"; done
dmesg | grep -i thermal
ls -la /sys/fs/pstore
```
