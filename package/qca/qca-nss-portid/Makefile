include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=qca-nss-portid
PKG_RELEASE:=1
PKG_BUILD_DIR:=$(KERNEL_BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define KernelPackage/qca-nss-portid
  SECTION:=kernel
  CATEGORY:=Kernel modules
  SUBMENU:=Network Devices
  DEPENDS:=+kmod-qca-nss-drv +kmod-qca-nss-gmac
  TITLE:=NSS PORTID bridge for QCA DSA ports
  FILES:=$(PKG_BUILD_DIR)/qca-nss-portid.ko
  AUTOLOAD:=$(call AutoLoad,33,qca-nss-portid)
endef

define KernelPackage/qca-nss-portid/Description
This package maps selected QCA DSA user ports to NSS PORTID dynamic interfaces.
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	$(INSTALL_DIR) $(PKG_BUILD_DIR)
	$(CP) ./src/Makefile $(PKG_BUILD_DIR)/
	$(CP) ./src/qca-nss-portid.c $(PKG_BUILD_DIR)/
endef

EXTRA_CFLAGS+= -I$(STAGING_DIR)/usr/include/qca-nss-drv

define Build/Compile
	$(MAKE) $(PKG_JOBS) -C "$(LINUX_DIR)" \
		$(KERNEL_MAKE_FLAGS) \
		$(PKG_MAKE_FLAGS) \
		M="$(PKG_BUILD_DIR)" \
		EXTRA_CFLAGS="$(EXTRA_CFLAGS)" \
		modules
endef

$(eval $(call KernelPackage,qca-nss-portid))
