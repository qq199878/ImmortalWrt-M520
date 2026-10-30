'use strict';
'require view';
'require ui';
'require rpc';
'require uci';

// ============ rpcd 方法声明 ============
var callStatus = rpc.declare({
	object: 'luci.sms-manager',
	method: 'status',
	expect: {}
});

var callProbe = rpc.declare({
	object: 'luci.sms-manager',
	method: 'probe',
	expect: {}
});

var callList = rpc.declare({
	object: 'luci.sms-manager',
	method: 'list',
	params: [ 'filter', 'limit' ],
	expect: {}
});

var callRead = rpc.declare({
	object: 'luci.sms-manager',
	method: 'read',
	params: [ 'index' ],
	expect: {}
});

var callDelete = rpc.declare({
	object: 'luci.sms-manager',
	method: 'delete',
	params: [ 'index' ],
	expect: {}
});

var callDeleteAll = rpc.declare({
	object: 'luci.sms-manager',
	method: 'delete_all',
	expect: {}
});

var callDeleteBatch = rpc.declare({
	object: 'luci.sms-manager',
	method: 'delete_batch',
	params: [ 'indexes' ],
	expect: {}
});

var callSend = rpc.declare({
	object: 'luci.sms-manager',
	method: 'send',
	params: [ 'number', 'text' ],
	expect: {}
});

var callGetConfig = rpc.declare({
	object: 'luci.sms-manager',
	method: 'get_config',
	expect: {}
});

var callSetConfig = rpc.declare({
	object: 'luci.sms-manager',
	method: 'set_config',
	params: [ 'port', 'storage', 'charset', 'mode' ],
	expect: {}
});

// ============ 样式 ============
var STYLE = [
	/* 外层容器：移动端优先，防溢出 */
	'.sms-wrap { max-width: 960px; margin: 0 auto; padding: 0; box-sizing: border-box; width: 100%; overflow-x: hidden; }',
	'.sms-wrap *, .sms-wrap *::before, .sms-wrap *::after { box-sizing: border-box; }',

	/* 状态卡片头部（可折叠） */
	'.sms-status-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; user-select: none; }',
	'.sms-status-head-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }',
	'.sms-status-title { font-size: 14px; font-weight: 600; color: #1e293b; white-space: nowrap; }',
	'[data-theme="dark"] .sms-status-title, .dark-theme .sms-status-title { color: #f1f5f9 !important; }',
	'.sms-status-toggle { font-size: 12px; color: #94a3b8; transition: transform .25s ease; flex-shrink: 0; display: inline-block; }',
	'.sms-status-toggle.collapsed { transform: rotate(-90deg); }',
	'.sms-status-body { overflow: hidden; transition: max-height .3s ease, opacity .25s ease, margin .25s ease; max-height: 800px; opacity: 1; margin-top: 12px; }',
	'.sms-status-body.collapsed { max-height: 0 !important; opacity: 0; margin-top: 0 !important; pointer-events: none; }',
	'.sms-status-summary { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
	'[data-theme="dark"] .sms-status-summary, .dark-theme .sms-status-summary { color: #94a3b8 !important; }',

	/* 状态卡片 */
	'.sms-status-card { border-radius: 14px; padding: 14px 16px; background: var(--card-bg, #fff); border: 1px solid rgba(0,0,0,0.07); box-shadow: 0 2px 12px rgba(0,0,0,0.05); margin-bottom: 14px; width: 100%; overflow: hidden; }',
	'[data-theme="dark"] .sms-status-card, .dark-theme .sms-status-card { background: #1e222d !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: none !important; }',
	'.sms-status-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; width: 100%; }',
	'.sms-status-item { display: flex; flex-direction: column; gap: 2px; flex: 0 1 auto; min-width: 0; max-width: 100%; }',
	'.sms-status-lbl { font-size: 11px; color: #94a3b8; letter-spacing: .3px; white-space: nowrap; }',
	'.sms-status-val { font-size: 13px; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }',
	'[data-theme="dark"] .sms-status-val, .dark-theme .sms-status-val { color: #e2e8f0 !important; }',
	'.sms-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }',
	'.sms-badge-ok { background: rgba(46,204,113,.14); color: #27ae60; border: 1px solid rgba(46,204,113,.3); }',
	'.sms-badge-err { background: rgba(231,76,60,.14); color: #e74c3c; border: 1px solid rgba(231,76,60,.3); }',
	'.sms-badge-warn { background: rgba(243,156,18,.14); color: #d68910; border: 1px solid rgba(243,156,18,.3); }',
	'.sms-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: currentColor; flex-shrink: 0; }',
	'.sms-refresh-btn { margin-left: auto; flex-shrink: 0; }',

	/* Tab 胶囊：可横向滚动，不溢出 */
	'.sms-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; width: 100%; }',
	'.sms-tabs::-webkit-scrollbar { display: none; }',
	'.sms-tab { flex: 0 0 auto; padding: 8px 16px; border-radius: 22px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid rgba(0,0,0,0.08); background: rgba(0,0,0,0.02); color: #64748b; transition: all .2s; user-select: none; white-space: nowrap; }',
	'[data-theme="dark"] .sms-tab, .dark-theme .sms-tab { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; color: #94a3b8 !important; }',
	'.sms-tab:hover { background: rgba(94,114,228,.08); color: #5e72e4; }',
	'.sms-tab.active { background: #5e72e4; color: #fff; border-color: #5e72e4; box-shadow: 0 3px 10px rgba(94,114,228,.3); }',

	/* 卡片容器 */
	'.sms-card { border-radius: 14px; background: var(--card-bg, #fff); border: 1px solid rgba(0,0,0,0.07); box-shadow: 0 2px 12px rgba(0,0,0,0.05); overflow: hidden; width: 100%; }',
	'[data-theme="dark"] .sms-card, .dark-theme .sms-card { background: #1e222d !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: none !important; }',
	'.sms-card-head { padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }',
	'[data-theme="dark"] .sms-card-head, .dark-theme .sms-card-head { border-bottom-color: rgba(255,255,255,0.08) !important; }',
	'.sms-card-title { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0; }',
	'[data-theme="dark"] .sms-card-title, .dark-theme .sms-card-title { color: #f1f5f9 !important; }',
	'.sms-card-body { padding: 0; }',
	'.sms-card-foot { padding: 12px 14px; border-top: 1px solid rgba(0,0,0,0.06); }',
	'[data-theme="dark"] .sms-card-foot, .dark-theme .sms-card-foot { border-top-color: rgba(255,255,255,0.08) !important; }',
	'.sms-card-actions { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }',

	/* 短信列表：卡片式分隔（block 布局，避免 flex 压缩卡片） */
	'.sms-list { padding: 10px; max-height: 62vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }',
	'.sms-msg { border-radius: 12px; background: #fff; border: 1px solid rgba(0,0,0,0.07); padding: 12px 13px; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; position: relative; overflow: hidden; margin-bottom: 9px; }',
	'.sms-msg:last-child { margin-bottom: 0; }',
	'[data-theme="dark"] .sms-msg, .dark-theme .sms-msg { background: #252a36 !important; border-color: rgba(255,255,255,0.08) !important; }',
	'.sms-msg:hover { border-color: rgba(94,114,228,.35); box-shadow: 0 2px 10px rgba(94,114,228,.1); }',
	'.sms-msg.unread { border-left: 3px solid #5e72e4; background: rgba(94,114,228,.04); }',
	'[data-theme="dark"] .sms-msg.unread, .dark-theme .sms-msg.unread { background: rgba(94,114,228,.12) !important; }',
	'.sms-msg.selected { border-color: #5e72e4 !important; background: rgba(94,114,228,.1) !important; box-shadow: 0 0 0 2px rgba(94,114,228,.18); }',
	'.sms-msg-top { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }',
	'.sms-check { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #cbd5e1; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all .18s ease; background: #fff; cursor: pointer; }',
	'[data-theme="dark"] .sms-check, .dark-theme .sms-check { background: #1e222d !important; border-color: #475569 !important; }',
	'.sms-check.on { background: #5e72e4 !important; border-color: #5e72e4 !important; }',
	'.sms-check.on::after { content: ""; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }',
	'.sms-msg-sender { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
	'[data-theme="dark"] .sms-msg-sender, .dark-theme .sms-msg-sender { color: #f1f5f9 !important; }',
	'.sms-msg-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: #5e72e4; color: #fff; flex-shrink: 0; }',
	'.sms-msg-time { font-size: 11px; color: #94a3b8; flex-shrink: 0; white-space: nowrap; }',
	'.sms-msg-text { font-size: 13px; color: #64748b; line-height: 1.55; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; max-height: 2.9em; }',
	'[data-theme="dark"] .sms-msg-text, .dark-theme .sms-msg-text { color: #94a3b8 !important; }',
	'.sms-msg.expanded .sms-msg-text { display: block; -webkit-line-clamp: unset; white-space: pre-wrap; overflow-wrap: anywhere; max-height: none !important; overflow: visible !important; }',
	'.sms-msg.expanded { overflow: visible; }',
	'.sms-msg-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }',

	/* 多选操作条 */
	'.sms-selbar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; background: rgba(94,114,228,.08); border: 1px solid rgba(94,114,228,.2); margin-bottom: 10px; flex-wrap: wrap; }',
	'[data-theme="dark"] .sms-selbar, .dark-theme .sms-selbar { background: rgba(94,114,228,.16) !important; border-color: rgba(94,114,228,.35) !important; }',
	'.sms-selbar-text { font-size: 13px; font-weight: 600; color: #5e72e4; flex: 1; min-width: 100px; }',
	'.sms-selall { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #475569; cursor: pointer; user-select: none; white-space: nowrap; }',
	'[data-theme="dark"] .sms-selall, .dark-theme .sms-selall { color: #cbd5e1 !important; }',

	/* 按钮 */
	'.sms-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all .18s; white-space: nowrap; }',
	'.sms-btn:disabled { opacity: .55; cursor: not-allowed; }',
	'.sms-btn-primary { background: #5e72e4; color: #fff; }',
	'.sms-btn-primary:hover:not(:disabled) { background: #4c5fd7; }',
	'.sms-btn-default { background: rgba(0,0,0,0.04); color: #475569; border-color: rgba(0,0,0,0.08); }',
	'.sms-btn-default:hover:not(:disabled) { background: rgba(0,0,0,0.08); }',
	'[data-theme="dark"] .sms-btn-default, .dark-theme .sms-btn-default { background: rgba(255,255,255,0.06) !important; color: #cbd5e1 !important; border-color: rgba(255,255,255,0.1) !important; }',
	'.sms-btn-danger { background: rgba(231,76,60,.1); color: #e74c3c; border-color: rgba(231,76,60,.25); }',
	'.sms-btn-danger:hover:not(:disabled) { background: rgba(231,76,60,.2); }',
	'.sms-btn-sm { padding: 5px 11px; font-size: 12px; }',

	/* 表单 */
	'.sms-field { margin-bottom: 16px; width: 100%; }',
	'.sms-label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }',
	'[data-theme="dark"] .sms-label, .dark-theme .sms-label { color: #cbd5e1 !important; }',
	'.sms-input, .sms-textarea, .sms-select { width: 100%; max-width: 100%; box-sizing: border-box; padding: 10px 13px; border-radius: 9px; border: 1px solid rgba(0,0,0,0.12); background: #fff; font-size: 14px; color: #1e293b; font-family: inherit; transition: border-color .18s, box-shadow .18s; }',
	'.sms-input:focus, .sms-textarea:focus, .sms-select:focus { outline: none; border-color: #5e72e4; box-shadow: 0 0 0 3px rgba(94,114,228,.12); }',
	'[data-theme="dark"] .sms-input, [data-theme="dark"] .sms-textarea, [data-theme="dark"] .sms-select, .dark-theme .sms-input, .dark-theme .sms-textarea, .dark-theme .sms-select { background: #252a36 !important; border-color: rgba(255,255,255,0.12) !important; color: #e2e8f0 !important; }',
	'.sms-textarea { min-height: 110px; resize: vertical; line-height: 1.6; }',
	'.sms-hint { font-size: 12px; color: #94a3b8; margin-top: 5px; line-height: 1.5; word-break: break-word; }',
	'.sms-counter { font-size: 12px; color: #94a3b8; text-align: right; margin-top: 4px; }',
	'.sms-counter.over { color: #e74c3c; font-weight: 600; }',

	/* 空状态 / 加载 */
	'.sms-empty { padding: 40px 16px; text-align: center; color: #94a3b8; font-size: 14px; }',
	'.sms-empty-icon { font-size: 36px; margin-bottom: 10px; opacity: .5; }',
	'.sms-loading { padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 14px; }',

	/* 设置分组 */
	'.sms-settings-group { padding: 16px 14px; }',
	'.sms-settings-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; }',

	/* ===== 移动端适配（关键修复）===== */
	'@media screen and (max-width: 768px) {',
	'  .sms-wrap { padding: 0; max-width: 100%; }',
	'  .sms-status-card { padding: 12px 13px; border-radius: 12px; margin-bottom: 12px; }',
	'  .sms-status-row { gap: 10px 12px; }',
	'  .sms-status-item { flex: 1 1 calc(50% - 12px); min-width: 0; }',
	'  .sms-status-val { font-size: 12px; }',
	'  .sms-refresh-btn { flex: 1 1 100%; margin-left: 0; margin-top: 4px; }',
	'  .sms-refresh-btn .sms-btn { width: 100%; }',
	'  .sms-tab { padding: 7px 14px; font-size: 12.5px; }',
	'  .sms-card-head { padding: 11px 12px; }',
	'  .sms-card-title { font-size: 14px; }',
	'  .sms-card-foot { padding: 11px 12px; }',
	'  .sms-list { padding: 9px; max-height: 58vh; }',
	'  .sms-msg { padding: 11px 12px; border-radius: 11px; margin-bottom: 8px; }',
	'  .sms-msg:last-child { margin-bottom: 0; }',
	'  .sms-msg-sender { font-size: 13.5px; }',
	'  .sms-msg-text { font-size: 12.5px; }',
	'  .sms-msg-top { gap: 8px; margin-bottom: 6px; }',
	'  .sms-selbar { padding: 8px 10px; }',
	'  .sms-selbar-text { font-size: 12.5px; }',
	'  .sms-settings-group { padding: 14px 12px; }',
	'  .sms-settings-row { grid-template-columns: 1fr; gap: 12px; }',
	'  .sms-textarea { min-height: 100px; }',
	'  .sms-btn { padding: 7px 12px; font-size: 12.5px; }',
	'  .sms-btn-sm { padding: 5px 10px; font-size: 11.5px; }',
	'  .sms-card-actions { width: 100%; }',
	'  .sms-card-actions .sms-btn { flex: 1; }',
	'}',

	/* ===== 覆盖 Argon 主题 .main-card 的固定 padding（防横向溢出）===== */
	'body[data-page^="admin-services-sms-manager"] .main-card, body[data-page*="sms-manager"] .main-card { padding: 0 !important; overflow-x: hidden !important; }',
	'body[data-page^="admin-services-sms-manager"] .main-cards-container, body[data-page*="sms-manager"] .main-cards-container { padding: 0 !important; margin: 0 !important; }',
	'body[data-page^="admin-services-sms-manager"] .main-right, body[data-page*="sms-manager"] .main-right { overflow-x: hidden !important; }',

	/* 超小屏（≤400px）进一步压缩 */
	'@media screen and (max-width: 400px) {',
	'  .sms-status-item { flex: 1 1 100%; }',
	'  .sms-tab { padding: 6px 12px; font-size: 12px; }',
	'  .sms-card-head { padding: 10px 11px; }',
	'  .sms-list { padding: 8px; }',
	'  .sms-msg { padding: 10px 11px; margin-bottom: 7px; }',
	'  .sms-msg:last-child { margin-bottom: 0; }',
	'}'
].join('\n');

// ============ 工具函数 ============
function fmtTime(ts) {
	if (!ts) return '—';
	// 格式 "21/02/17,18:49:58+32" -> "2021-02-17 18:49"
	var m = ts.match(/^(\d{2})(\d{2})(\d{2}),(\d{2}):(\d{2})/);
	if (m) {
		var yy = parseInt(m[1], 10);
		var year = yy >= 90 ? 1900 + yy : 2000 + yy;
		return year + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
	}
	return ts;
}

function isUnread(stat) {
	return stat && stat.indexOf('UNREAD') >= 0;
}

function statLabel(stat) {
	if (!stat) return '未知';
	if (stat.indexOf('UNREAD') >= 0) return '未读';
	if (stat.indexOf('READ') >= 0) return '已读';
	if (stat.indexOf('UNSENT') >= 0) return '未发送';
	if (stat.indexOf('SENT') >= 0) return '已发送';
	return stat;
}

function simLabel(s) {
	var map = {
		'ready': '就绪',
		'absent': '未插卡',
		'pin_required': '需要 PIN',
		'puk_required': '需要 PUK',
		'failure': '读取失败',
		'unknown': '未知'
	};
	return map[s] || s || '未知';
}

function signalLabel(rssi) {
	if (rssi == null || rssi === 99) return '无信号';
	if (rssi >= 20) return '极佳';
	if (rssi >= 15) return '良好';
	if (rssi >= 10) return '一般';
	if (rssi >= 5) return '较弱';
	return '极弱';
}

// ============ 主视图 ============
return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callGetConfig(), {})
		]);
	},

	render: function(data) {
		var self = this;
		var status = data[0] || {};
		var cfgResp = data[1] || {};
		var config = cfgResp.config || {};

		// 状态
		var state = {
			status: status,
			config: config,
			messages: [],
			loaded: false,
			loading: false,
			loadingMore: false,
			activeTab: 'inbox',
			expandedIndex: null,
			unreadCount: 0,
			pageSize: 20,      // 每次加载条数
			loadedCount: 0,    // 已加载条数
			totalCount: 0,     // 模组内总条数
			statusCollapsed: true,  // 状态卡片默认折叠
			selected: {}       // 多选集合 { index: true }
		};

		// ============ DOM 引用 ============
		var statusBarEl = E('div', { 'class': 'sms-status-card' });
		var tabBarEl = E('div', { 'class': 'sms-tabs' });
		var contentEl = E('div', { 'class': 'sms-content' });

		// ============ 状态栏渲染（可折叠）============
		function renderStatusBar() {
			var st = state.status || {};
			var ok = st.ok !== false && st.sim_status === 'ready';

			var badgeClass = ok ? 'sms-badge-ok' : (st.sim_status === 'absent' ? 'sms-badge-warn' : 'sms-badge-err');
			var badgeText = ok ? '模组就绪' : simLabel(st.sim_status);

			// 折叠态摘要文本
			var summaryParts = [];
			if (ok) summaryParts.push('就绪');
			if (st.model) summaryParts.push(st.model);
			if (st.operator) summaryParts.push(st.operator);
			if (st.used != null && st.total) summaryParts.push(st.used + '/' + st.total);
			var summaryText = summaryParts.join(' · ') || '点击展开';

			// ---- 折叠头部 ----
			var toggleIcon = E('span', {
				'class': 'sms-status-toggle' + (state.statusCollapsed ? ' collapsed' : '')
			}, '▼');

			var summaryEl = E('span', {
				'class': 'sms-status-summary',
				'style': state.statusCollapsed ? '' : 'display:none;'
			}, summaryText);

			var badgeEl = E('span', {
				'class': 'sms-badge ' + badgeClass,
				'style': state.statusCollapsed ? '' : 'display:none;'
			}, [
				E('span', { 'class': 'sms-dot' }),
				badgeText
			]);

			var headEl = E('div', {
				'class': 'sms-status-head',
				'click': function() {
					state.statusCollapsed = !state.statusCollapsed;
					renderStatusBar();
				}
			}, [
				E('div', { 'class': 'sms-status-head-left' }, [
					toggleIcon,
					E('span', { 'class': 'sms-status-title' }, _('模组状态')),
					summaryEl,
					badgeEl
				])
			]);

			// ---- 展开体（原有状态项）----
			var items = [
				E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('状态')),
					E('span', { 'class': 'sms-badge ' + badgeClass }, [
						E('span', { 'class': 'sms-dot' }),
						badgeText
					])
				])
			];

			if (st.model) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('模组')),
					E('span', { 'class': 'sms-status-val' }, st.model)
				]));
			}

			if (st.operator) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('运营商')),
					E('span', { 'class': 'sms-status-val' }, st.operator)
				]));
			}

			if (st.rssi != null) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('信号')),
					E('span', { 'class': 'sms-status-val' }, st.rssi + ' (' + signalLabel(st.rssi) + ')')
				]));
			}

			if (st.total) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('短信容量')),
					E('span', { 'class': 'sms-status-val' }, (st.used || 0) + ' / ' + st.total)
				]));
			}

			if (st.port) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('AT 端口')),
					E('span', { 'class': 'sms-status-val' }, st.port)
				]));
			}

			if (st.storage) {
				items.push(E('div', { 'class': 'sms-status-item' }, [
					E('span', { 'class': 'sms-status-lbl' }, _('存储')),
					E('span', { 'class': 'sms-status-val' }, st.storage)
				]));
			}

			// 重新检测按钮
			items.push(E('div', { 'class': 'sms-refresh-btn' }, [
				E('button', {
					'class': 'sms-btn sms-btn-default sms-btn-sm',
					'click': function(ev) {
						ev.stopPropagation();
						var btn = ev.currentTarget;
						btn.disabled = true;
						btn.textContent = _('检测中...');
						callProbe().then(function(res) {
							if (res && res.ok) {
								state.status = res;
								renderStatusBar();
								ui.addNotification(null, E('p', {}, _('模组检测完成')), 'info');
							} else {
								state.status = res || {};
								renderStatusBar();
								ui.addNotification(null, E('p', {}, _('检测失败：') + ((res && res.error) || '未知错误')), 'error');
							}
						}).catch(function(e) {
							ui.addNotification(null, E('p', {}, _('检测出错：') + e), 'error');
						}).then(function() {
							btn.disabled = false;
							btn.textContent = _('重新检测');
						});
					}
				}, _('重新检测'))
			]));

			var bodyEl = E('div', {
				'class': 'sms-status-body' + (state.statusCollapsed ? ' collapsed' : '')
			}, [
				E('div', { 'class': 'sms-status-row' }, items)
			]);

			statusBarEl.innerHTML = '';
			statusBarEl.appendChild(headEl);
			statusBarEl.appendChild(bodyEl);
		}

		// ============ Tab 栏渲染 ============
		function renderTabs() {
			var tabs = [
				{ id: 'inbox', label: '收件箱', icon: '📥' },
				{ id: 'send', label: '发送短信', icon: '✉️' },
				{ id: 'settings', label: '高级设置', icon: '⚙️' }
			];

			tabBarEl.innerHTML = '';
			tabs.forEach(function(t) {
				var label = t.icon + ' ' + t.label;
				if (t.id === 'inbox' && state.unreadCount > 0) {
					label += ' (' + state.unreadCount + ')';
				}
				var el = E('div', {
					'class': 'sms-tab' + (state.activeTab === t.id ? ' active' : ''),
					'click': function() {
						if (state.activeTab === t.id) return;
						state.activeTab = t.id;
						renderTabs();
						renderContent();
					}
				}, label);
				tabBarEl.appendChild(el);
			});
		}

		// ============ 收件箱（卡片式 + 多选）============
		function renderInbox() {
			var bodyEl = E('div', { 'class': 'sms-card-body' });
			var listEl = E('div', { 'class': 'sms-list' });

			var selectedCount = Object.keys(state.selected).length;
			var allSelected = state.messages.length > 0 &&
				state.messages.every(function(m) { return state.selected[m.index]; });

			var headEl = E('div', { 'class': 'sms-card-head' }, [
				E('h3', { 'class': 'sms-card-title' }, _('短信列表') + (state.messages.length ? ' (' + state.messages.length + ')' : '')),
				E('div', { 'class': 'sms-card-actions' }, [
					E('button', {
						'class': 'sms-btn sms-btn-default sms-btn-sm',
						'click': function(ev) {
							loadMessages(ev.currentTarget);
						}
					}, _('刷新')),
					E('button', {
						'class': 'sms-btn sms-btn-danger sms-btn-sm',
						'click': function() {
							if (!confirm(_('确定要删除全部短信吗？此操作不可恢复！'))) return;
							ui.showIndicator('sms-del-all', _('正在删除全部短信...'));
							callDeleteAll().then(function(res) {
								ui.hideIndicator('sms-del-all');
								if (res && res.ok) {
									state.selected = {};
									ui.addNotification(null, E('p', {}, _('全部短信已删除')), 'info');
									loadMessages();
								} else {
									ui.addNotification(null, E('p', {}, _('删除失败：') + ((res && res.error) || '未知错误')), 'error');
								}
							}).catch(function(e) {
								ui.hideIndicator('sms-del-all');
								ui.addNotification(null, E('p', {}, _('删除出错：') + e), 'error');
							});
						}
					}, _('清空全部'))
				])
			]);

			// ---- 多选操作条（有选中时显示）----
			var selBarEl = null;
			if (selectedCount > 0) {
				selBarEl = E('div', { 'class': 'sms-selbar' }, [
					E('span', { 'class': 'sms-selbar-text' }, _('已选 ') + selectedCount + _(' 条')),
					E('label', { 'class': 'sms-selall' }, [
						E('span', {
							'class': 'sms-check' + (allSelected ? ' on' : ''),
							'click': function(ev) {
								ev.stopPropagation();
								if (allSelected) {
									state.selected = {};
								} else {
									state.messages.forEach(function(m) {
										state.selected[m.index] = true;
									});
								}
								renderContent();
							}
						}),
						_('全选本页')
					]),
					E('button', {
						'class': 'sms-btn sms-btn-default sms-btn-sm',
						'click': function() {
							state.selected = {};
							renderContent();
						}
					}, _('取消选择')),
					E('button', {
						'class': 'sms-btn sms-btn-danger sms-btn-sm',
						'click': function() {
							// 展开选中项：长短信需删除全部分片索引
							var idxSet = {};
							Object.keys(state.selected).forEach(function(k) {
								var key = parseInt(k, 10);
								var found = null;
								for (var i = 0; i < state.messages.length; i++) {
									if (state.messages[i].index === key) { found = state.messages[i]; break; }
								}
								if (found && found.part_indexes && found.part_indexes.length) {
									found.part_indexes.forEach(function(pi) { idxSet[pi] = true; });
								} else {
									idxSet[key] = true;
								}
							});
							var idxs = Object.keys(idxSet).map(function(k) { return parseInt(k, 10); });
							if (idxs.length === 0) return;
							if (!confirm(_('确定删除选中的短信吗？') + '（' + idxs.length + _(' 条）'))) return;

							ui.showIndicator('sms-del-batch', _('正在删除 ') + idxs.length + _(' 条短信...'));
							callDeleteBatch(idxs.join(',')).then(function(res) {
								ui.hideIndicator('sms-del-batch');
								if (res && res.ok) {
									var msg = _('成功删除 ') + (res.ok_count || 0) + _(' 条');
									if (res.fail_count > 0) {
										msg += _('，失败 ') + res.fail_count + _(' 条');
									}
									ui.addNotification(null, E('p', {}, msg), res.fail_count > 0 ? 'warning' : 'info');
									state.selected = {};
									loadMessages();
								} else {
									ui.addNotification(null, E('p', {}, _('删除失败：') + ((res && res.error) || '未知错误')), 'error');
								}
							}).catch(function(e) {
								ui.hideIndicator('sms-del-batch');
								ui.addNotification(null, E('p', {}, _('删除出错：') + e), 'error');
							});
						}
					}, _('删除选中'))
				]);
			}

			if (state.loading) {
				listEl.appendChild(E('div', { 'class': 'sms-loading' }, _('正在读取短信...')));
			} else if (!state.loaded) {
				listEl.appendChild(E('div', { 'class': 'sms-empty' }, [
					E('div', { 'class': 'sms-empty-icon' }, '📥'),
					E('div', {}, _('点击下方按钮读取短信'))
				]));
			} else if (state.messages.length === 0) {
				listEl.appendChild(E('div', { 'class': 'sms-empty' }, [
					E('div', { 'class': 'sms-empty-icon' }, '📭'),
					E('div', {}, _('暂无短信'))
				]));
			} else {
				state.messages.forEach(function(msg) {
					var unread = isUnread(msg.stat);
					var expanded = state.expandedIndex === msg.index;
					var checked = !!state.selected[msg.index];

					var cls = 'sms-msg';
					if (unread) cls += ' unread';
					if (checked) cls += ' selected';
					if (expanded) cls += ' expanded';

					var cardEl = E('div', {
						'class': cls,
						'click': function(ev) {
							if (ev.target.closest('.sms-check') || ev.target.closest('.sms-msg-actions')) return;
							state.expandedIndex = expanded ? null : msg.index;
							renderContent();
						}
					}, [
						E('div', { 'class': 'sms-msg-top' }, [
							E('span', {
								'class': 'sms-check' + (checked ? ' on' : ''),
								'click': function(ev) {
									ev.stopPropagation();
									if (checked) {
										delete state.selected[msg.index];
									} else {
										state.selected[msg.index] = true;
									}
									renderContent();
								}
							}),
							E('span', { 'class': 'sms-msg-sender' }, msg.sender || _('未知号码')),
							unread ? E('span', { 'class': 'sms-msg-badge' }, _('未读')) : '',
							E('span', { 'class': 'sms-msg-time' }, fmtTime(msg.timestamp))
						]),
						E('div', { 'class': 'sms-msg-text' }, msg.text || _('(无内容)'))
					]);

					if (expanded) {
						cardEl.appendChild(E('div', { 'class': 'sms-msg-actions' }, [
							E('button', {
								'class': 'sms-btn sms-btn-default sms-btn-sm',
								'click': function(ev) {
									ev.stopPropagation();
									if (navigator.clipboard && navigator.clipboard.writeText) {
										navigator.clipboard.writeText(msg.text || '').then(function() {
											ui.addNotification(null, E('p', {}, _('已复制到剪贴板')), 'info');
										}).catch(function() {
											ui.addNotification(null, E('p', {}, _('复制失败')), 'warning');
										});
									} else {
										ui.addNotification(null, E('p', {}, _('当前浏览器不支持复制')), 'warning');
									}
								}
							}, _('复制内容')),
							E('button', {
								'class': 'sms-btn sms-btn-danger sms-btn-sm',
								'click': function(ev) {
									ev.stopPropagation();
									if (!confirm(_('确定删除这条短信吗？'))) return;
									// 长短信：删除全部分片索引
									var delIdxs = (msg.part_indexes && msg.part_indexes.length)
										? msg.part_indexes : [ msg.index ];
									var p;
									if (delIdxs.length > 1) {
										p = callDeleteBatch(delIdxs.join(','));
									} else {
										p = callDelete(delIdxs[0]);
									}
									p.then(function(res) {
										if (res && res.ok) {
											delete state.selected[msg.index];
											ui.addNotification(null, E('p', {}, _('短信已删除')), 'info');
											loadMessages();
										} else {
											ui.addNotification(null, E('p', {}, _('删除失败：') + ((res && res.error) || '未知错误')), 'error');
										}
									}).catch(function(e) {
										ui.addNotification(null, E('p', {}, _('删除出错：') + e), 'error');
									});
								}
							}, _('删除'))
						]));
					}

					listEl.appendChild(cardEl);
				});
			}

			bodyEl.appendChild(listEl);

			// 底部：加载更多 + 刷新
			var footChildren = [];

			if (state.loaded && state.loadedCount > 0 && state.loadedCount < state.totalCount) {
				var remaining = state.totalCount - state.loadedCount;
				footChildren.push(E('button', {
					'class': 'sms-btn sms-btn-primary',
					'style': 'margin-right: 8px;',
					'disabled': state.loadingMore ? true : null,
					'click': function(ev) {
						loadMessages(ev.currentTarget, true);
					}
				}, state.loadingMore ? _('加载中...') : (_('加载更多') + ' (' + _('还有 ') + remaining + _(' 条') + ')')));
			}

			footChildren.push(E('button', {
				'class': 'sms-btn sms-btn-default',
				'click': function(ev) {
					loadMessages(ev.currentTarget, false);
				}
			}, state.loaded ? _('重新读取') : _('读取短信')));

			if (state.loaded && state.loadedCount > 0) {
				footChildren.push(E('div', {
					'style': 'font-size: 12px; color: #94a3b8; margin-top: 8px;'
				}, _('已加载 ') + state.loadedCount + ' / ' + state.totalCount + ' 条'));
			}

			var footEl = E('div', { 'class': 'sms-card-foot', 'style': 'text-align:center;' }, footChildren);

			var cardChildren = [ headEl ];
			if (selBarEl) cardChildren.push(E('div', { 'style': 'padding: 0 10px;' }, [ selBarEl ]));
			cardChildren.push(bodyEl);
			cardChildren.push(footEl);

			return E('div', { 'class': 'sms-card' }, cardChildren);
		}

		// ============ 发送短信 ============
		function renderSend() {
			var numberInput = E('input', {
				'class': 'sms-input',
				'type': 'tel',
				'placeholder': _('例如：10010 或 +8613800138000')
			});

			var textArea = E('textarea', {
				'class': 'sms-textarea',
				'placeholder': _('请输入短信内容（支持中文，自动按 UCS2 编码）')
			});

			var counterEl = E('div', { 'class': 'sms-counter' }, '0 / 70');

			textArea.addEventListener('input', function() {
				var len = textArea.value.length;
				// 中文按 UCS2 计算：70 字符/条
				var isAscii = /^[\x00-\x7F]*$/.test(textArea.value);
				var perSms = isAscii ? 160 : 70;
				var segments = Math.max(1, Math.ceil(len / perSms));
				counterEl.textContent = len + ' / ' + perSms + (segments > 1 ? '  (' + segments + ' 条)' : '');
				counterEl.className = 'sms-counter' + (len > perSms * 6 ? ' over' : '');
			});

			var sendBtn = E('button', {
				'class': 'sms-btn sms-btn-primary',
				'click': function() {
					var number = (numberInput.value || '').trim();
					var text = (textArea.value || '').trim();

					if (!number) {
						ui.addNotification(null, E('p', {}, _('请输入收件人号码')), 'warning');
						numberInput.focus();
						return;
					}
					if (!/^\+?\d{3,20}$/.test(number)) {
						ui.addNotification(null, E('p', {}, _('号码格式不正确（仅允许数字，可带 + 前缀）')), 'warning');
						numberInput.focus();
						return;
					}
					if (!text) {
						ui.addNotification(null, E('p', {}, _('请输入短信内容')), 'warning');
						textArea.focus();
						return;
					}

					sendBtn.disabled = true;
					sendBtn.textContent = _('发送中...');
					ui.showIndicator('sms-send', _('正在发送短信，请稍候...'));

					callSend(number, text).then(function(res) {
						ui.hideIndicator('sms-send');
						sendBtn.disabled = false;
						sendBtn.textContent = _('发送短信');

						if (res && res.ok) {
							ui.addNotification(null, E('p', {}, _('短信发送成功！')), 'info');
							textArea.value = '';
							counterEl.textContent = '0 / 70';
							counterEl.className = 'sms-counter';
						} else {
							ui.addNotification(null, E('p', {}, _('发送失败：') + ((res && res.error) || '未知错误')), 'error');
						}
					}).catch(function(e) {
						ui.hideIndicator('sms-send');
						sendBtn.disabled = false;
						sendBtn.textContent = _('发送短信');
						ui.addNotification(null, E('p', {}, _('发送出错：') + e), 'error');
					});
				}
			}, _('发送短信'));

			return E('div', { 'class': 'sms-card' }, [
				E('div', { 'class': 'sms-card-head' }, [
					E('h3', { 'class': 'sms-card-title' }, _('发送新短信'))
				]),
				E('div', { 'class': 'sms-card-body', 'style': 'padding: 18px;' }, [
					E('div', { 'class': 'sms-field' }, [
						E('label', { 'class': 'sms-label' }, _('收件人号码')),
						numberInput,
						E('div', { 'class': 'sms-hint' }, _('支持手机号、服务号（如 10010），国际号码请加 + 前缀'))
					]),
					E('div', { 'class': 'sms-field' }, [
						E('label', { 'class': 'sms-label' }, _('短信内容')),
						textArea,
						counterEl,
						E('div', { 'class': 'sms-hint' }, _('纯英文 160 字符/条，含中文 70 字符/条，超长自动分段'))
					])
				]),
				E('div', { 'class': 'sms-card-foot', 'style': 'text-align:right;' }, [ sendBtn ])
			]);
		}

		// ============ 高级设置 ============
		function renderSettings() {
			var cfg = state.config || {};

			function makeSelect(name, label, options, hint) {
				var sel = E('select', { 'class': 'sms-select' });
				options.forEach(function(opt) {
					var o = E('option', { 'value': opt.value }, opt.label);
					if ((cfg[name] || 'auto') === opt.value) o.selected = true;
					sel.appendChild(o);
				});
				return E('div', { 'class': 'sms-field' }, [
					E('label', { 'class': 'sms-label' }, label),
					sel,
					hint ? E('div', { 'class': 'sms-hint' }, hint) : ''
				]);
			}

			var portSel = makeSelect('port', _('AT 串口'), [
				{ value: 'auto', label: _('自动探测（推荐）') },
				{ value: '/dev/ttyUSB0', label: '/dev/ttyUSB0' },
				{ value: '/dev/ttyUSB1', label: '/dev/ttyUSB1' },
				{ value: '/dev/ttyUSB2', label: '/dev/ttyUSB2' },
				{ value: '/dev/ttyUSB3', label: '/dev/ttyUSB3' }
			], _('自动探测会依次尝试 ttyUSB1 → ttyUSB2 → ttyUSB3 → ttyUSB0'));

			var storageSel = makeSelect('storage', _('短信存储位置'), [
				{ value: 'auto', label: _('自动选择（推荐）') },
				{ value: 'ME', label: 'ME（模组内存，容量大）' },
				{ value: 'SM', label: 'SM（SIM 卡，容量小）' },
				{ value: 'MT', label: 'MT（两者合并）' }
			], _('自动优先选择 ME，其次 SM，最后 MT'));

			var charsetSel = makeSelect('charset', _('字符编码'), [
				{ value: 'auto', label: _('自动（推荐）') },
				{ value: 'IRA', label: 'IRA（国际参考字母表）' },
				{ value: 'UCS2', label: 'UCS2（16 位 Unicode）' },
				{ value: 'GSM', label: 'GSM（7 位默认字母表）' },
				{ value: '8859-1', label: '8859-1（拉丁-1）' }
			], _('中文短信通常使用 UCS2，自动模式会根据内容智能判断'));

			var modeSel = makeSelect('mode', _('短信模式'), [
				{ value: 'auto', label: _('自动（优先文本模式）') },
				{ value: 'text', label: _('文本模式（CMGF=1）') },
				{ value: 'pdu', label: _('PDU 模式（CMGF=0）') }
			], _('文本模式易读，PDU 模式兼容性更强（部分老模块只支持 PDU）'));

			var saveBtn = E('button', {
				'class': 'sms-btn sms-btn-primary',
				'click': function() {
					saveBtn.disabled = true;
					saveBtn.textContent = _('保存中...');
					ui.showIndicator('sms-cfg', _('正在保存配置...'));

					callSetConfig(portSel.querySelector('select').value,
						storageSel.querySelector('select').value,
						charsetSel.querySelector('select').value,
						modeSel.querySelector('select').value
					).then(function(res) {
						ui.hideIndicator('sms-cfg');
						saveBtn.disabled = false;
						saveBtn.textContent = _('保存设置');

						if (res && res.ok) {
							state.config = res.config || {};
							ui.addNotification(null, E('p', {}, _('配置已保存')), 'info');
							// 重新探测
							return callProbe().then(function(p) {
								if (p) {
									state.status = p;
									renderStatusBar();
								}
							});
						} else {
							ui.addNotification(null, E('p', {}, _('保存失败：') + ((res && res.error) || '未知错误')), 'error');
						}
					}).catch(function(e) {
						ui.hideIndicator('sms-cfg');
						saveBtn.disabled = false;
						saveBtn.textContent = _('保存设置');
						ui.addNotification(null, E('p', {}, _('保存出错：') + e), 'error');
					});
				}
			}, _('保存设置'));

			return E('div', { 'class': 'sms-card' }, [
				E('div', { 'class': 'sms-card-head' }, [
					E('h3', { 'class': 'sms-card-title' }, _('高级设置')),
					E('span', { 'class': 'sms-hint', 'style': 'margin:0;' }, _('更换 SIM 卡或 4G 模块时可在此调整'))
				]),
				E('div', { 'class': 'sms-card-body' }, [
					E('div', { 'class': 'sms-settings-group' }, [
						E('div', { 'class': 'sms-settings-row' }, [ portSel, storageSel ]),
						E('div', { 'class': 'sms-settings-row' }, [ charsetSel, modeSel ]),
						E('div', { 'class': 'sms-hint', 'style': 'margin-top: 8px; padding: 10px 12px; border-radius: 8px; background: rgba(94,114,228,.06); border-left: 3px solid #5e72e4;' }, [
							_('提示：') + ' ' + _('若更换了 SIM 卡后无法识别，请先在此页面点击【重新检测】；若仍失败，请在【网络 → 4G 模组管理】中关闭再开启模组电源（冷启动），然后重新检测。')
						])
					])
				]),
				E('div', { 'class': 'sms-card-foot', 'style': 'text-align:right;' }, [ saveBtn ])
			]);
		}

		// ============ 内容渲染 ============
		function renderContent() {
			contentEl.innerHTML = '';
			if (state.activeTab === 'inbox') {
				contentEl.appendChild(renderInbox());
			} else if (state.activeTab === 'send') {
				contentEl.appendChild(renderSend());
			} else {
				contentEl.appendChild(renderSettings());
			}
		}

		// ============ 加载短信（分页优化版）============
		function loadMessages(btn, isLoadMore) {
			if (isLoadMore) {
				state.loadingMore = true;
			} else {
				state.loading = true;
			}
			if (btn) {
				btn.disabled = true;
				btn.textContent = _('读取中...');
			}
			renderContent();

			// 分页：首次加载 pageSize 条，加载更多时递增
			var limit = isLoadMore ? (state.loadedCount + state.pageSize) : state.pageSize;

			callList('ALL', limit).then(function(res) {
				state.loading = false;
				state.loadingMore = false;
				if (btn) {
					btn.disabled = false;
				}

				if (res && res.ok) {
					state.messages = res.messages || [];
					state.loaded = true;
					state.loadedCount = state.messages.length;
					state.unreadCount = state.messages.filter(function(m) {
						return isUnread(m.stat);
					}).length;

					// 清理已不存在的选中项（删除后刷新时）
					if (!isLoadMore) {
						var validIdx = {};
						state.messages.forEach(function(m) { validIdx[m.index] = true; });
						var newSel = {};
						Object.keys(state.selected).forEach(function(k) {
							if (validIdx[k]) newSel[k] = true;
						});
						state.selected = newSel;
					}

					// 更新状态栏信息
					if (res.info) {
						// 分页总数用「合并后条数」，否则长短信分片会导致"还有 N 条"算错
						state.totalCount = res.info.merged_total != null
							? res.info.merged_total
							: (res.info.used || 0);
						state.status = Object.assign({}, state.status, {
							ok: true,
							sim_status: res.info.sim_status || 'ready',
							model: res.info.model || state.status.model,
							port: res.info.port || state.status.port,
							storage: res.info.storage || state.status.storage,
							operator: res.info.operator || state.status.operator,
							rssi: res.info.rssi != null ? res.info.rssi : state.status.rssi,
							used: res.info.used,
							total: res.info.total
						});
						renderStatusBar();
					}

					renderTabs();
					renderContent();
				} else {
					state.loaded = true;
					state.messages = [];
					ui.addNotification(null, E('p', {}, _('读取短信失败：') + ((res && res.error) || '未知错误')), 'error');
					renderContent();
				}
			}).catch(function(e) {
				state.loading = false;
				state.loadingMore = false;
				state.loaded = true;
				if (btn) {
					btn.disabled = false;
				}
				ui.addNotification(null, E('p', {}, _('读取出错：') + e), 'error');
				renderContent();
			});
		}

		// ============ 组装 ============
		renderStatusBar();
		renderTabs();
		renderContent();

		var rootEl = E('div', { 'class': 'sms-wrap' }, [
			E('style', {}, STYLE),
			statusBarEl,
			tabBarEl,
			contentEl
		]);

		// 自动加载短信
		setTimeout(function() {
			if (state.status && state.status.ok && state.status.sim_status === 'ready') {
				loadMessages();
			}
		}, 100);

		return rootEl;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});