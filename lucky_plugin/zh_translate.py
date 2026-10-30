# -*- coding: utf-8 -*-
"""把 lucky_status.htm 里的 <%:英文%> 直接替换为中文"""
import re
import sys

M = {
    "Main Program Information": "主程序信息",
    "Installation Status": "安装状态",
    "Lucky Status": "运行状态",
    "Lucky Arch": "程序架构",
    "Compilation Time": "编译时间",
    "Lucky Version": "程序版本",
    "Admin Panel Information": "管理面板信息",
    "Admin Panel": "管理面板地址",
    "Admin Panel Login Info": "面板登录信息",
    "Collecting data...": "正在获取数据...",
    "Installed": "已安装",
    "Not installed": "未安装",
    "The Lucky service is running.": "服务运行中",
    "The Lucky service is not running.": "服务未运行",
    "Start": "启动",
    "Stop": "停止",
    "Change": "修改",
    "Reset": "重置",
    "Enable": "开启",
    "Disable": "关闭",
    "allow": "已允许",
    "not allow": "未允许",
    "Open AdminURL": "打开管理面板",
    "DefaultAuth": "默认账号密码",
    "NewHttpPort": "请输入新的端口号",
    "portValueError": "端口号格式错误，必须是 1-65535",
    "update success": "修改成功",
    "update failed": "修改失败",
    "get latest version": "获取最新版本",
    "Reset 666 as admin account and password?": "确定把管理员账号和密码重置为 666 吗？",
    "Are you sure Enalbe Internetaccess?": "确定开启外网访问吗？",
    "Are you sure Disable Internetaccess?": "确定关闭外网访问吗？",
    "are you sure start lucky service?": "确定启动 Lucky 服务吗？",
    "are you sure stop lucky service?": "确定停止 Lucky 服务吗？",
}

def repl(m):
    key = m.group(1)
    if key in M:
        return M[key]
    print("未翻译: %r" % key, file=sys.stderr)
    return m.group(0)

src = open(sys.argv[1], encoding='utf-8').read()
out = re.sub(r'<%:([^%]*)%>', repl, src)
open(sys.argv[1], 'w', encoding='utf-8').write(out)
print("完成，剩余 i18n 标记: %d" % len(re.findall(r'<%:', out)))