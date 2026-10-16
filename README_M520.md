# ImmortalWrt for Ruijie RG-MTFi-M520

基于 [ImmortalWrt](https://github.com/immortalwrt/immortalwrt)（GPL-2.0-only）的锐捷 RG-MTFi-M520 定制固件源码。

- 目标平台：`ipq806x/generic`
- 设备：`DEVICE_ruijie_rg-mtfi-m520`
- 内核：Linux 6.12

## 本仓库内容

- 完整 ImmortalWrt 源码树 + 本机对 M520 的适配改动
- `configs/m520.config`：编译配置
- `.github/workflows/build.yml`：GitHub Actions 云编译
- `SOURCE_CHANGES_M520.md`：改动说明

## 云编译（GitHub Actions）

1. 打开仓库 **Actions** 标签页
2. 选择 **Build ImmortalWrt for Ruijie M520**
3. 点 **Run workflow** → 等待编译完成（约 2~4 小时）
4. 在 **Artifacts** 下载 `immortalwrt-m520-firmware`

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
