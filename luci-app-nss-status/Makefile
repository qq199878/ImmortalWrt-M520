include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Qualcomm NSS hardware acceleration status
LUCI_DEPENDS:=+qca-nss-drv +qca-nss-ecm +rpcd-mod-ucode
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-nss-status
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
