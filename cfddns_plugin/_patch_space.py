#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全页间距压缩补丁
核心问题：#cfdWrap 是 display:flex + gap:14px，同时每张卡片还有 margin-bottom:14px，
两者叠加导致卡片间实际间隙 28px。统一改为只由 margin 控制。
"""
import io
import sys

PATH = 'cfddns.js'

with io.open(PATH, encoding='utf-8') as f:
    src = f.read()

orig = src
applied = []
failed = []


def rep(tag, old, new, count=1):
    global src
    if old not in src:
        failed.append(tag)
        return
    if src.count(old) < count:
        failed.append(tag + '(count)')
        return
    src = src.replace(old, new, count)
    applied.append(tag)


# ---------------------------------------------------------------
# 1. 容器：去掉 flex gap，间隙只由卡片 margin 控制（消除 14+14 双重叠加）
# ---------------------------------------------------------------
rep('wrap-gap',
    "\t'.cfd-wrap { max-width: 100%; overflow-wrap: break-word; word-break: break-word; }',",
    "\t'.cfd-wrap { max-width: 100%; overflow-wrap: break-word; word-break: break-word;',\n"
    "\t'  display: block; }',")

# ---------------------------------------------------------------
# 2. 卡片：内边距 14/16 -> 12/14，底部外边距 14 -> 10
# ---------------------------------------------------------------
rep('card-pad',
    "\t'.cfd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;',\n"
    "\t'  padding: 14px 16px; margin-bottom: 14px; }',",
    "\t'.cfd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;',\n"
    "\t'  padding: 12px 14px; margin-bottom: 10px; }',")

# 3. 卡片标题 h3
rep('card-h3',
    "\t'.cfd-card > h3 { margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #1e293b;',\n"
    "\t'  padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }',",
    "\t'.cfd-card > h3 { margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1e293b;',\n"
    "\t'  padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }',")

# ---------------------------------------------------------------
# 4. 折叠头：下内边距 8 -> 6，展开后下外边距 12 -> 8
# ---------------------------------------------------------------
rep('fold-pad',
    "\t'  padding: 0 0 8px 0; margin: 0; background: none; border: 0; cursor: pointer;',",
    "\t'  padding: 0 0 6px 0; margin: 0; background: none; border: 0; cursor: pointer;',")

rep('fold-open-mb',
    "\t'.cfd-card-fold.open { margin-bottom: 12px; }',",
    "\t'.cfd-card-fold.open { margin-bottom: 8px; }',")

# ---------------------------------------------------------------
# 5. 状态行：上下 padding 7 -> 4，行间距 4 -> 3
# ---------------------------------------------------------------
rep('row-pad',
    "\t'.cfd-row { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 7px 0;',",
    "\t'.cfd-row { display: flex; flex-wrap: wrap; gap: 3px 10px; padding: 4px 0;',")

# ---------------------------------------------------------------
# 6. 表单字段：下外边距 14 -> 10，标签下边距 6 -> 4
# ---------------------------------------------------------------
rep('field-mb',
    "\t'.cfd-field { margin-bottom: 14px; }',",
    "\t'.cfd-field { margin-bottom: 10px; }',")

rep('field-label-mb',
    "\t'  color: #334155; margin-bottom: 6px; }',",
    "\t'  color: #334155; margin-bottom: 4px; }',")

# 7. 提示文字：行高 1.7 -> 1.5，上外边距 6 -> 4
rep('hint',
    "\t'.cfd-hint { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-top: 6px; }',",
    "\t'.cfd-hint { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 4px; }',")

# ---------------------------------------------------------------
# 8. Token 列表：项间距 8 -> 6，项内 padding 8/10 -> 6/9，横向 gap 10 -> 8
# ---------------------------------------------------------------
rep('toklist-gap',
    "\t'.cfd-toklist { display: flex; flex-direction: column; gap: 8px; }',",
    "\t'.cfd-toklist { display: flex; flex-direction: column; gap: 6px; }',")

rep('tok-item',
    "\t'.cfd-tok-item { display: flex; align-items: center; gap: 10px;',\n"
    "\t'  border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #fff; }',",
    "\t'.cfd-tok-item { display: flex; align-items: center; gap: 8px;',\n"
    "\t'  border: 1px solid #e2e8f0; border-radius: 7px; padding: 5px 9px; background: #fff; }',")

rep('tok-pick',
    "\t'.cfd-tok-pick { display: flex; align-items: center; gap: 8px;',",
    "\t'.cfd-tok-pick { display: flex; align-items: center; gap: 7px;',")

# 删除按钮更紧凑
rep('tok-del',
    "\t'  padding: 3px 10px !important; font-size: 12px !important; }',",
    "\t'  padding: 2px 8px !important; font-size: 12px !important; line-height: 1.5 !important; }',")

rep('tok-empty',
    "\t'.cfd-tok-empty { font-size: 13px; color: #94a3b8; padding: 8px 2px; }',",
    "\t'.cfd-tok-empty { font-size: 13px; color: #94a3b8; padding: 6px 2px; }',")

# ---------------------------------------------------------------
# 9. 按钮组：上外边距 4 -> 6（贴合上方字段），gap 8 -> 6
# ---------------------------------------------------------------
rep('btns',
    "\t'.cfd-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }',",
    "\t'.cfd-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }',")

# ---------------------------------------------------------------
# 10. 警告框：padding 10/12 -> 8/10，行高 1.8 -> 1.55，下外边距 12 -> 10
# ---------------------------------------------------------------
rep('alert',
    "\t'.cfd-alert { border-radius: 6px; padding: 10px 12px; font-size: 12px;',\n"
    "\t'  line-height: 1.8; margin-bottom: 12px; overflow-wrap: break-word; }',",
    "\t'.cfd-alert { border-radius: 6px; padding: 8px 10px; font-size: 12px;',\n"
    "\t'  line-height: 1.55; margin-bottom: 10px; overflow-wrap: break-word; }',")

# ---------------------------------------------------------------
# 11. 记录卡片：padding 10/12 -> 8/10，下外边距 10 -> 8
# ---------------------------------------------------------------
rep('rec',
    "\t'.cfd-rec { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;',\n"
    "\t'  margin-bottom: 10px; background: #fff; }',",
    "\t'.cfd-rec { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;',\n"
    "\t'  margin-bottom: 8px; background: #fff; }',")

rep('rec-head',
    "\t'  margin-bottom: 8px; }',",
    "\t'  margin-bottom: 6px; }',")

# 12. 折叠区标题（解析记录/手动添加）
rep('fold-bar',
    "\t'  padding: 10px 12px; margin: 0 0 10px; background: #f1f5f9; border: 1px solid #e2e8f0;',",
    "\t'  padding: 8px 10px; margin: 0 0 8px; background: #f1f5f9; border: 1px solid #e2e8f0;',")

# 13. 编辑表单
rep('edit-box',
    "\t'.cfd-edit { margin-top: 10px; padding: 12px; background: #f8fafc;',",
    "\t'.cfd-edit { margin-top: 8px; padding: 10px; background: #f8fafc;',")

rep('edit-title',
    "\t'.cfd-edit-title { font-size: 12px; font-weight: 700; color: #2563eb; margin-bottom: 10px; }',",
    "\t'.cfd-edit-title { font-size: 12px; font-weight: 700; color: #2563eb; margin-bottom: 8px; }',")

# ---------------------------------------------------------------
# 14. 页面标题与副标题间距
# ---------------------------------------------------------------
rep('h2',
    "\t\t\tE('h2', { 'name': 'content', 'style': 'font-size:18px;margin-bottom:4px;' },\n"
    "\t\t\t\t'Cloudflare 动态域名'),\n"
    "\t\t\tE('div', { 'style': 'font-size:12px;color:#94a3b8;margin-bottom:14px;' },\n"
    "\t\t\t\t'自动同步公网出口 IPv4 到 Cloudflare DNS'),",
    "\t\t\tE('h2', { 'name': 'content', 'style': 'font-size:18px;margin:0 0 2px 0;' },\n"
    "\t\t\t\t'Cloudflare 动态域名'),\n"
    "\t\t\tE('div', { 'style': 'font-size:12px;color:#94a3b8;margin-bottom:10px;' },\n"
    "\t\t\t\t'自动同步公网出口 IPv4 到 Cloudflare DNS'),")

# ---------------------------------------------------------------
# 15. NAT 警告框：从卡片外移到「运行状态」卡片内的最后一行，
#     消除 card0 -> alert -> card1 造成的 143px 大间隔
# ---------------------------------------------------------------
rep('nat-move',
    "\t\t\tkvRow('定时任务', cronNode),\n"
    "\t\t\tkvRow('上次执行', lastNode)\n"
    "\t\t]);",
    "\t\t\tkvRow('定时任务', cronNode),\n"
    "\t\t\tkvRow('上次执行', lastNode),\n"
    "\t\t\tnatBox\n"
    "\t\t]);")

rep('nat-remove-top',
    "\t\t\tswitchCard,\n"
    "\t\t\tnatBox,\n"
    "\t\t\tstatusCard,",
    "\t\t\tswitchCard,\n"
    "\t\t\tstatusCard,")

# natBox 需要在 statusCard 之前定义（原本已如此），但要用块级包装避免 flex 影响
rep('natbox-init',
    "\t\tvar natBox = E('div', {});",
    "\t\tvar natBox = E('div', { 'class': 'cfd-natbox' });")

# 16. 给 natBox 加样式：与上一行留出间距，无内容时不占位
rep('natbox-css',
    "\t'.cfd-row:last-child { border-bottom: 0; }',",
    "\t'.cfd-row:last-child { border-bottom: 0; }',\n"
    "\t'.cfd-natbox { margin-top: 8px; }',\n"
    "\t'.cfd-natbox:empty { margin-top: 0; display: none; }',\n"
    "\t'.cfd-natbox .cfd-alert { margin-bottom: 0; }',")

# ---------------------------------------------------------------
# 17. 说明卡片内的提示行
# ---------------------------------------------------------------
rep('help-hint',
    "\t\t\tE('div', { 'class': 'cfd-hint', 'style': 'margin-top:0;' }, [",
    "\t\t\tE('div', { 'class': 'cfd-hint', 'style': 'margin-top:0;line-height:1.55;' }, [")

# ---------------------------------------------------------------
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)

print('applied %d:' % len(applied))
for a in applied:
    print('  + ' + a)
if failed:
    print('FAILED %d:' % len(failed))
    for x in failed:
        print('  - ' + x)
    sys.exit(1)

print('size: %d -> %d' % (len(orig), len(src)))
print('braces: %d = %d' % (src.count('{'), src.count('}')))
