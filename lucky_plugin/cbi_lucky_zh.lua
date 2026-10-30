--
local m, s, o
local m = Map("lucky", translate("Lucky"), translate("端口转发、DDNS、反向代理、网络唤醒、物联网等"))
m:section(SimpleSection).template = "lucky/lucky_status"
s = m:section(TypedSection, "lucky", translate("基本设置"))
s.addremove = false
s.anonymous = true
o = s:option(Value, "configdir", translate("配置目录"),
	translate("存放配置文件的路径（只读，防止误改导致服务异常）"))
o.placeholder = "/etc/lucky"
o.readonly = true
o.rmempty = false
m.apply_on_parse = true
m.on_after_apply = function(self, map)
	luci.sys.exec("/etc/init.d/lucky restart")
end
return m