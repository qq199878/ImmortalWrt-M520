# -*- coding: utf-8 -*-
import io, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MOBILE_CSS = """
@media (max-width: 768px) {
	/* ---------- 1. 根治 Argon 伪元素标题冲突 ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row::before,
	[id^="cbi-firewall-"] tr.cbi-section-table-row::after {
		display: none !important;
		content: none !important;
	}
	/* ---------- 2. 隐藏桌面端表头、表尾与过滤器 ---------- */
	[id^="cbi-firewall-"] thead,
	[id^="cbi-firewall-"] tfoot,
	[id^="cbi-firewall-"] tr.cbi-section-table-titles,
	[id^="cbi-firewall-"] tr.cbi-section-table-descr,
	[id^="cbi-firewall-"] tr.cbi-section-table-filter {
		display: none !important;
	}
	/* ---------- 3. 表格与容器重置 ---------- */
	[id^="cbi-firewall-"] table,
	[id^="cbi-firewall-"] .table,
	[id^="cbi-firewall-"] tbody,
	[id^="cbi-firewall-"] .tbody {
		display: block !important;
		width: 100% !important;
		border: none !important;
		background: transparent !important;
		padding: 0 !important;
		margin: 0 !important;
	}

	/* ---------- 4. 卡片核心结构：致密紧凑两列网格 ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row {
		display: grid !important;
		grid-template-columns: 1fr auto !important;
		width: 100% !important;
		box-sizing: border-box !important;
		background: #ffffff !important;
		border-radius: 10px !important;
		border: 1px solid #e2e8f0 !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
		margin: 0 0 10px 0 !important;
		padding: 12px 12px 10px 12px !important;
		position: relative !important;
	}

	/* ---------- 5. 第一行左侧：规则名称 ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-table-titles {
		grid-column: 1 / 2 !important;
		grid-row: 1 !important;
		display: flex !important;
		align-items: center !important;
		align-self: center !important;
		padding: 0 8px 0 0 !important;
		margin: 0 0 10px 0 !important;
		background: transparent !important;
		border: none !important;
		color: #0f172a !important;
		font-size: 15px !important;
		font-weight: 700 !important;
		line-height: 1.3 !important;
		text-align: left !important;
		cursor: pointer !important;
		min-width: 0 !important;
		overflow: hidden !important;
		text-overflow: ellipsis !important;
		white-space: nowrap !important;
	}
	/* 装饰蓝条 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-table-titles::before {
		content: "" !important;
		display: inline-block !important;
		width: 3.5px !important;
		height: 14px !important;
		background: #3b82f6 !important;
		border-radius: 2px !important;
		margin-right: 7px !important;
		flex-shrink: 0 !important;
	}

	/* ---------- 6. 第一行右侧：启用开关 (横排、水平垂直对齐、留白整洁) ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="enabled"] {
		grid-column: 2 / 3 !important;
		grid-row: 1 !important;
		display: flex !important;
		flex-direction: row !important;
		align-items: center !important;
		align-self: center !important;
		justify-content: flex-end !important;
		white-space: nowrap !important;
		padding: 0 !important;
		margin: 0 0 10px 0 !important;
		background: transparent !important;
		border: none !important;
		gap: 6px !important;
		flex-shrink: 0 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="enabled"]::before {
		content: "启用" !important;
		display: inline-block !important;
		white-space: nowrap !important;
		font-size: 13px !important;
		font-weight: 600 !important;
		color: #475569 !important;
		line-height: 1 !important;
		background: transparent !important;
		margin: 0 !important;
		padding: 0 !important;
		border: none !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="enabled"] input[type="checkbox"] {
		width: 18px !important;
		height: 18px !important;
		margin: 0 !important;
		cursor: pointer !important;
		accent-color: #3b82f6 !important;
		flex-shrink: 0 !important;
		vertical-align: middle !important;
	}

	/* ---------- 7. 信息面板：浅灰底微型规格槽 ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_match"],
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_dest"],
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_target"] {
		grid-column: 1 / 3 !important;
		display: block !important;
		box-sizing: border-box !important;
		width: 100% !important;
		background: #f8fafc !important;
		border: 1px solid #f1f5f9 !important;
		border-radius: 6px !important;
		padding: 8px 10px 9px 10px !important;
		margin: 0 0 8px 0 !important;
		text-align: left !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_match"] {
		grid-row: 2 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_dest"],
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_target"] {
		grid-row: 3 !important;
	}

	/* 微型胶囊徽标 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_match"]::before {
		content: "匹配条件" !important;
		display: inline-block !important;
		font-size: 10.5px !important;
		font-weight: 700 !important;
		color: #0369a1 !important;
		background: #e0f2fe !important;
		border-radius: 3px !important;
		padding: 1px 5px !important;
		margin-bottom: 5px !important;
		letter-spacing: 0.2px !important;
		line-height: 1.2 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_dest"]::before {
		content: "转发目标" !important;
		display: inline-block !important;
		font-size: 10.5px !important;
		font-weight: 700 !important;
		color: #047857 !important;
		background: #d1fae5 !important;
		border-radius: 3px !important;
		padding: 1px 5px !important;
		margin-bottom: 5px !important;
		letter-spacing: 0.2px !important;
		line-height: 1.2 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_target"]::before {
		content: "执行动作" !important;
		display: inline-block !important;
		font-size: 10.5px !important;
		font-weight: 700 !important;
		color: #6d28d9 !important;
		background: #ede9fe !important;
		border-radius: 3px !important;
		padding: 1px 5px !important;
		margin-bottom: 5px !important;
		letter-spacing: 0.2px !important;
		line-height: 1.2 !important;
	}

	/* 核心修复：大幅提升行距 (1.95)，彻底隔开上下色块，根治重叠 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_match"] small,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_dest"] small,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_target"] small,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_target"] {
		font-size: 12.5px !important;
		line-height: 1.95 !important;
		color: #334155 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_match"] small {
		display: block !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td[data-name="_dest"] small {
		display: block !important;
		font-weight: 500 !important;
		color: #1e293b !important;
	}

	/* 区域徽标与色块：精准控高 (20px) 并在内部垂直居中，彻底消除上下粘连 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row .zonebadge {
		display: inline-flex !important;
		align-items: center !important;
		justify-content: center !important;
		height: 20px !important;
		line-height: 20px !important;
		padding: 0 6px !important;
		margin: 1px 4px !important;
		border-radius: 4px !important;
		font-size: 11px !important;
		font-weight: 600 !important;
		vertical-align: middle !important;
		box-sizing: border-box !important;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row .zonebadge > em,
	[id^="cbi-firewall-"] tr.cbi-section-table-row .zonebadge > strong {
		display: inline !important;
		margin: 0 !important;
		font-style: normal !important;
		line-height: 1 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row var {
		font-style: normal !important;
		font-weight: 600 !important;
		color: #0369a1 !important;
	}

	/* ---------- 8. 底部操作栏 ---------- */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions {
		grid-column: 1 / 3 !important;
		grid-row: 4 !important;
		display: block !important;
		width: 100% !important;
		box-sizing: border-box !important;
		padding: 8px 0 0 0 !important;
		margin: 3px 0 0 0 !important;
		background: transparent !important;
		border: none !important;
		border-top: 1px dashed #e2e8f0 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions > div {
		display: flex !important;
		flex-direction: row !important;
		align-items: center !important;
		justify-content: space-between !important;
		gap: 6px !important;
		width: 100% !important;
		box-sizing: border-box !important;
		margin: 0 !important;
		padding: 0 !important;
	}
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .btn,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions button {
		height: 31px !important;
		line-height: 29px !important;
		padding: 0 8px !important;
		font-size: 12px !important;
		font-weight: 600 !important;
		border-radius: 5px !important;
		flex: 1 1 0 !important;
		text-align: center !important;
		white-space: nowrap !important;
		box-sizing: border-box !important;
		box-shadow: none !important;
		margin: 0 !important;
	}
	/* 拖动手柄 ☰ */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-drag {
		flex: 0 0 32px !important;
		width: 32px !important;
		height: 31px !important;
		padding: 0 !important;
		background: #f1f5f9 !important;
		border: 1px solid #cbd5e1 !important;
		color: #64748b !important;
		border-radius: 5px !important;
		font-size: 14px !important;
	}
	/* 编辑按钮 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-edit {
		background: #3b82f6 !important;
		border: 1px solid #2563eb !important;
		color: #ffffff !important;
	}
	/* 克隆按钮 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-neutral,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-clone {
		background: #ffffff !important;
		border: 1px solid #cbd5e1 !important;
		color: #334155 !important;
	}
	/* 删除按钮 */
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-negative,
	[id^="cbi-firewall-"] tr.cbi-section-table-row > td.cbi-section-actions .cbi-button-remove {
		background: #fef2f2 !important;
		border: 1px solid #fecaca !important;
		color: #ef4444 !important;
	}

	/* 添加规则大按钮 */
	[id^="cbi-firewall-"] .cbi-section-create {
		margin-top: 10px !important;
		width: 100% !important;
	}
	[id^="cbi-firewall-"] .cbi-section-create .cbi-button-add {
		width: 100% !important;
		height: 36px !important;
		font-size: 13.5px !important;
		font-weight: 600 !important;
		border-radius: 7px !important;
		background: #3b82f6 !important;
		color: #ffffff !important;
		border: none !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		box-shadow: 0 2px 5px rgba(59, 130, 246, 0.25) !important;
	}
}
"""

ENHANCE_JS = r"""
const MOBILE_CSS = """ + repr(MOBILE_CSS) + r""";

function enhance(root, sectionObj) {
	if (!document.getElementById('fw-mobile-card-style')) {
		const st = document.createElement('style');
		st.id = 'fw-mobile-card-style';
		st.textContent = MOBILE_CSS;
		document.head.appendChild(st);
	}
	const rows = root.querySelectorAll('tr.cbi-section-table-row:not(.placeholder)');
	for (let i = 0; i < rows.length; i++) {
		const tr = rows[i];
		const sid = tr.getAttribute('data-sid');

		tr.removeAttribute('data-title');
		const tds = tr.querySelectorAll('td');
		for (let j = 0; j < tds.length; j++) {
			tds[j].removeAttribute('data-title');
		}

		const titleTd = tr.querySelector('.cbi-section-table-titles');
		if (titleTd && sid && !titleTd._hasEditHandler && sectionObj && typeof sectionObj.renderMoreOptionsModal === 'function') {
			titleTd._hasEditHandler = true;
			titleTd.addEventListener('click', function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				sectionObj.renderMoreOptionsModal(sid);
			});
		}

		const actionsTd = tr.querySelector('.cbi-section-actions');
		if (actionsTd && sid) {
			const btnContainer = actionsTd.querySelector('div');
			if (btnContainer && !btnContainer.querySelector('.cbi-button-edit') && sectionObj && typeof sectionObj.renderMoreOptionsModal === 'function') {
				const editBtn = document.createElement('button');
				editBtn.className = 'btn cbi-button cbi-button-action cbi-button-edit';
				editBtn.textContent = '编辑';
				editBtn.title = '编辑规则';
				editBtn.type = 'button';
				editBtn.addEventListener('click', function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					sectionObj.renderMoreOptionsModal(sid);
				});

				const cloneBtn = btnContainer.querySelector('.cbi-button-neutral') || btnContainer.querySelector('.cbi-button-clone');
				const dragBtn = btnContainer.querySelector('.cbi-button-drag');
				if (cloneBtn) {
					btnContainer.insertBefore(editBtn, cloneBtn);
				} else if (dragBtn && dragBtn.nextSibling) {
					btnContainer.insertBefore(editBtn, dragBtn.nextSibling);
				} else {
					btnContainer.appendChild(editBtn);
				}
			}
		}
	}
}
"""

TARGETS = [
	('forwards_orig.js', 'forwards.js'),
	('rules_orig.js', 'rules.js'),
	('snats_orig.js', 'snats.js')
]

for src_name, dst_name in TARGETS:
	src_path = os.path.join(BASE_DIR, src_name)
	dst_path = os.path.join(BASE_DIR, dst_name)
	orig_code = io.open(src_path, encoding='utf-8').read()

	req_anchor = "'require tools.widgets as widgets';"
	idx_req = orig_code.find(req_anchor)
	if idx_req == -1:
		print("ERROR: require tools.widgets as widgets not found in", src_name)
		continue
	req_end = idx_req + len(req_anchor)
	header_requires = orig_code[:req_end]
	rest_of_orig = orig_code[req_end:]

	render_anchor = "return m.render();"
	idx_render = rest_of_orig.rfind(render_anchor)
	if idx_render == -1:
		print("ERROR: return m.render(); not found in", src_name)
		continue

	part_middle = rest_of_orig[:idx_render]
	part_tail = rest_of_orig[idx_render + len(render_anchor):]

	patch_code = "return m.render().then(function(node){enhance(node,s);return node;});" + part_tail

	final_code = header_requires + "\n" + ENHANCE_JS + "\n" + part_middle + patch_code

	io.open(dst_path, 'w', encoding='utf-8').write(final_code)
	print("[BUILD SUCCESS]", dst_name, "length:", len(final_code))