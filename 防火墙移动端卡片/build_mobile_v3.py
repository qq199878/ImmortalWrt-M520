# -*- coding: utf-8 -*-
import io

orig_code = io.open('/storage/emulated/0/Download/路由器520/lucky_plugin/_fw_forwards/forwards_orig.js', encoding='utf-8').read()

# 官方原版最后几行是：
# 		if (!L.hasSystemFeature('firewall4')) {
# 			o = s.taboption('advanced', form.Value, 'extra', _('Extra arguments'),
# 				_('Passes additional arguments to iptables. Use with care!'));
# 			o.modalonly = true;
# 			o.rmempty = true;
# 		}
# 		return m.render();
# 	}
# });

# 我们要替换的是最后的 return m.render(); 这一小段

MOBILE_CSS = """
@media (max-width: 768px) {
	/* ---------- 1. 根治 Argon ::before 伪元素标题冲突 ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row::before,
	#cbi-firewall-redirect tr.cbi-section-table-row::after {
		display: none !important;
		content: none !important;
	}

	/* ---------- 2. 隐藏不需要的桌面端表格头脚与过滤器 ---------- */
	#cbi-firewall-redirect thead,
	#cbi-firewall-redirect tfoot,
	#cbi-firewall-redirect tr.cbi-section-table-titles,
	#cbi-firewall-redirect tr.cbi-section-table-descr,
	#cbi-firewall-redirect tr.cbi-section-table-filter {
		display: none !important;
	}

	/* ---------- 3. 表格与容器重置 ---------- */
	#cbi-firewall-redirect table,
	#cbi-firewall-redirect .table,
	#cbi-firewall-redirect tbody,
	#cbi-firewall-redirect .tbody {
		display: block !important;
		width: 100% !important;
		border: none !important;
		background: transparent !important;
		padding: 0 !important;
		margin: 0 !important;
	}

	/* ---------- 4. 卡片核心结构：CSS Grid 现代两列网格 ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row {
		display: grid !important;
		grid-template-columns: 1fr auto !important;
		width: 100% !important;
		box-sizing: border-box !important;
		background: #ffffff !important;
		border-radius: 12px !important;
		border: 1px solid #e2e8f0 !important;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
		margin: 0 0 16px 0 !important;
		padding: 0 !important;
		overflow: hidden !important;
		position: relative !important;
	}

	/* ---------- 5. 第一行左侧：规则名称 (Header Left) ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-table-titles {
		grid-column: 1 / 2 !important;
		grid-row: 1 !important;
		display: flex !important;
		align-items: center !important;
		padding: 14px 12px 10px 16px !important;
		background: transparent !important;
		border: none !important;
		color: #1e293b !important;
		font-size: 16px !important;
		font-weight: 700 !important;
		line-height: 1.3 !important;
		text-align: left !important;
		cursor: pointer !important;
	}

	/* 规则名称左侧装饰蓝条 */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-table-titles::before {
		content: "" !important;
		display: inline-block !important;
		width: 4px !important;
		height: 16px !important;
		background: #5e72e4 !important;
		border-radius: 2px !important;
		margin-right: 8px !important;
		flex-shrink: 0 !important;
	}

	/* ---------- 6. 第一行右侧：启用开关 (Header Right) ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="enabled"] {
		grid-column: 2 / 3 !important;
		grid-row: 1 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: flex-end !important;
		padding: 14px 16px 10px 0 !important;
		background: transparent !important;
		border: none !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="enabled"]::before {
		content: "启用" !important;
		display: inline-block !important;
		font-size: 13px !important;
		font-weight: 600 !important;
		color: #64748b !important;
		margin-right: 6px !important;
		background: transparent !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="enabled"] input[type="checkbox"] {
		width: 20px !important;
		height: 20px !important;
		margin: 0 !important;
		cursor: pointer !important;
	}

	/* ---------- 7. 第二行：入站匹配规则 (Body: Match) ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_match"] {
		grid-column: 1 / 3 !important;
		grid-row: 2 !important;
		display: block !important;
		box-sizing: border-box !important;
		padding: 6px 16px 8px 16px !important;
		border: none !important;
		background: transparent !important;
		text-align: left !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_match"]::before {
		content: "📥 入站匹配" !important;
		display: block !important;
		font-size: 11px !important;
		font-weight: 700 !important;
		color: #94a3b8 !important;
		letter-spacing: .5px;
		margin-bottom: 4px !important;
		background: transparent !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_match"] small {
		display: block !important;
		font-size: 13px !important;
		line-height: 1.6 !important;
		color: #334155 !important;
	}

	/* ---------- 8. 第三行：转发目标动作 (Body: Dest) ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_dest"] {
		grid-column: 1 / 3 !important;
		grid-row: 3 !important;
		display: block !important;
		box-sizing: border-box !important;
		padding: 4px 16px 12px 16px !important;
		border: none !important;
		background: transparent !important;
		text-align: left !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_dest"]::before {
		content: "📤 目标设备" !important;
		display: block !important;
		font-size: 11px !important;
		font-weight: 700 !important;
		color: #94a3b8 !important;
		letter-spacing: .5px;
		margin-bottom: 4px !important;
		background: transparent !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row > td[data-name="_dest"] small {
		display: block !important;
		font-size: 13px !important;
		line-height: 1.6 !important;
		color: #1e293b !important;
		font-weight: 500 !important;
	}

	/* 区域徽章美化 */
	#cbi-firewall-redirect tr.cbi-section-table-row .zonebadge {
		display: inline-block !important;
		margin: 0 3px !important;
		padding: 1px 7px !important;
		border-radius: 4px !important;
		font-size: 12px !important;
		font-weight: 600 !important;
		line-height: 1.4 !important;
	}

	/* ---------- 9. 第四行：底部操作栏 (Footer Actions) ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions {
		grid-column: 1 / 3 !important;
		grid-row: 4 !important;
		display: block !important;
		width: 100% !important;
		box-sizing: border-box !important;
		padding: 10px 14px 12px 14px !important;
		background: #f8fafc !important;
		border-top: 1px solid #f1f5f9 !important;
		margin: 0 !important;
	}

	/* 核心修复：操作栏外层 div 弹性横排，绝不写死宽度！ */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions > div {
		display: flex !important;
		flex-direction: row !important;
		align-items: center !important;
		justify-content: space-between !important;
		gap: 8px !important;
		width: 100% !important;
		box-sizing: border-box !important;
		margin: 0 !important;
		padding: 0 !important;
	}

	/* 按钮统一基准高度与圆角 */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions button,
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions .btn {
		height: 36px !important;
		line-height: 36px !important;
		border-radius: 6px !important;
		font-size: 13px !important;
		font-weight: 600 !important;
		box-sizing: border-box !important;
		margin: 0 !important;
		cursor: pointer !important;
		transition: all .15s ease !important;
		text-align: center !important;
	}

	/* 1. 拖动排序把手（左侧小方块） */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions .drag-handle {
		flex: 0 0 36px !important;
		width: 36px !important;
		padding: 0 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		background: #e2e8f0 !important;
		color: #475569 !important;
		border: 1px solid #cbd5e1 !important;
		font-size: 16px !important;
	}

	/* 2. 修改按钮（蓝色主按钮） */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-edit {
		flex: 1 1 0 !important;
		min-width: 0 !important;
		background: #5e72e4 !important;
		color: #ffffff !important;
		border: 1px solid #5e72e4 !important;
		padding: 0 6px !important;
	}

	/* 3. 克隆按钮（中性灰按钮） */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-neutral {
		flex: 1 1 0 !important;
		min-width: 0 !important;
		background: #f1f5f9 !important;
		color: #334155 !important;
		border: 1px solid #cbd5e1 !important;
		padding: 0 6px !important;
	}

	/* 4. 删除按钮（警告红按钮） */
	#cbi-firewall-redirect tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-remove {
		flex: 1 1 0 !important;
		min-width: 0 !important;
		background: #fee2e2 !important;
		color: #dc2626 !important;
		border: 1px solid #fecaca !important;
		padding: 0 6px !important;
	}

	/* ---------- 10. “添加”按钮全宽美化 ---------- */
	#cbi-firewall-redirect .cbi-section-create,
	#cbi-firewall-redirect .cbi-tblsection-create {
		display: block !important;
		width: 100% !important;
		margin: 8px 0 16px 0 !important;
		padding: 0 !important;
	}

	#cbi-firewall-redirect .cbi-section-create > .btn,
	#cbi-firewall-redirect .cbi-tblsection-create > .btn {
		display: block !important;
		width: 100% !important;
		box-sizing: border-box !important;
		padding: 12px !important;
		height: auto !important;
		line-height: 1.4 !important;
		font-size: 15px !important;
		font-weight: 600 !important;
		border-radius: 8px !important;
		background: #5e72e4 !important;
		color: #fff !important;
		border: none !important;
		box-shadow: 0 3px 8px rgba(94, 114, 228, 0.25) !important;
	}

	/* ---------- 11. 空列表样式 ---------- */
	#cbi-firewall-redirect tr.cbi-section-table-row.placeholder {
		display: block !important;
		box-shadow: none !important;
		border: 2px dashed #cbd5e1 !important;
		background: #f8fafc !important;
		border-radius: 10px !important;
		padding: 24px 16px !important;
		text-align: center !important;
	}

	#cbi-firewall-redirect tr.cbi-section-table-row.placeholder > td {
		display: block !important;
		border: none !important;
		color: #64748b !important;
		font-size: 14px !important;
		padding: 0 !important;
	}
}
"""

ENHANCE_JS = """
function enhance(root, sectionObj) {
	if (!document.getElementById('fw-forwards-mobile-style')) {
		const st = document.createElement('style');
		st.id = 'fw-forwards-mobile-style';
		st.textContent = MOBILE_CSS;
		document.head.appendChild(st);
	}

	const rows = root.querySelectorAll('tr.cbi-section-table-row:not(.placeholder)');

	for (let i = 0; i < rows.length; i++) {
		const tr = rows[i];
		const sid = tr.getAttribute('data-sid');

		/* 1. 彻底清除 tr 上的 data-title，切断 Argon 主题生成伪元素标题的源头 */
		tr.removeAttribute('data-title');

		/* 2. 清除子 td 上的 data-title，杜绝任何残余 ::before 文本 */
		const tds = tr.querySelectorAll('td');
		for (let j = 0; j < tds.length; j++) {
			tds[j].removeAttribute('data-title');
		}

		/* 3. 点击标题行直接打开修改弹窗 */
		const titleTd = tr.querySelector('.cbi-section-table-titles');
		if (titleTd && sid && !titleTd._hasEditHandler) {
			titleTd._hasEditHandler = true;
			titleTd.addEventListener('click', function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				sectionObj.renderMoreOptionsModal(sid);
			});
		}

		/* 4. 在操作栏补齐“修改”按钮，并规范按钮顺序 */
		const actionsTd = tr.querySelector('.cbi-section-actions');
		if (actionsTd && sid) {
			const btnContainer = actionsTd.querySelector('div') || actionsTd;
			let editBtn = btnContainer.querySelector('.cbi-button-edit');

			if (!editBtn) {
				editBtn = E('button', {
					'class': 'btn cbi-button cbi-button-action cbi-button-edit',
					'title': _('Edit'),
					'click': function(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						sectionObj.renderMoreOptionsModal(sid);
					}
				}, [ _('修改') ]);

				const cloneBtn = btnContainer.querySelector('.cbi-button-neutral');
				if (cloneBtn) {
					btnContainer.insertBefore(editBtn, cloneBtn);
				} else {
					btnContainer.appendChild(editBtn);
				}
			}
		}
	}
}
"""

# 在 orig_code 中定位 return m.render(); 并替换
idx = orig_code.rfind("return m.render();")
if idx == -1:
    print("ERROR: return m.render(); not found!")
    exit(1)

part1 = orig_code[:idx]

patch_code = """
		return m.render().then(function(node) {
			try {
				enhance(node, s);
			} catch (e) {
				console.error('forwards mobile enhance failed:', e);
			}
			return node;
		});
	}
});
"""

final_code = "const MOBILE_CSS = " + repr(MOBILE_CSS) + ";\n" + ENHANCE_JS + "\n" + part1 + patch_code

out_path = '/storage/emulated/0/Download/路由器520/lucky_plugin/_fw_forwards/forwards_mobile.js'
io.open(out_path, 'w', encoding='utf-8').write(final_code)
print("build success! length:", len(final_code))
