'use strict';
'require rpc';
'require dom';
'require ui';
'require view';

// ---------------------------------------------------------------------
// RPC 声明
// ---------------------------------------------------------------------

var callStatusQuick = rpc.declare({
	object: 'luci.cfddns',
	method: 'status_quick',
	expect: {}
});

var callStatus = rpc.declare({
	object: 'luci.cfddns',
	method: 'status',
	params: [ 'force' ],
	expect: {}
});

var callProbe = rpc.declare({
	object: 'luci.cfddns',
	method: 'probe',
	params: [ 'force' ],
	expect: {}
});

var callRun = rpc.declare({
	object: 'luci.cfddns',
	method: 'run_now',
	expect: {}
});

var callSet = rpc.declare({
	object: 'luci.cfddns',
	method: 'set_interval',
	params: [ 'enabled', 'minutes' ],
	expect: {}
});

var callSetEnabled = rpc.declare({
	object: 'luci.cfddns',
	method: 'set_enabled',
	params: [ 'enabled' ],
	expect: {}
});

var callSetParkIp = rpc.declare({
	object: 'luci.cfddns',
	method: 'set_park_ip',
	params: [ 'ip' ],
	expect: {}
});

var callGetConfig = rpc.declare({
	object: 'luci.cfddns',
	method: 'get_config',
	expect: {}
});

var callSaveToken = rpc.declare({
	object: 'luci.cfddns',
	method: 'save_token',
	params: [ 'token' ],
	expect: {}
});

var callListZones = rpc.declare({
	object: 'luci.cfddns',
	method: 'list_zones',
	params: [ 'force' ],
	expect: {}
});

var callListRecords = rpc.declare({
	object: 'luci.cfddns',
	method: 'list_records',
	params: [ 'zone_id' ],
	expect: {}
});

var callAddRecord = rpc.declare({
	object: 'luci.cfddns',
	method: 'add_record',
	params: [ 'zone_id', 'zone_name', 'type', 'name', 'content', 'ttl', 'proxied', 'set_target' ],
	expect: {}
});

var callDelRecord = rpc.declare({
	object: 'luci.cfddns',
	method: 'del_record',
	params: [ 'zone_id', 'rec_id' ],
	expect: {}
});

var callSetTarget = rpc.declare({
	object: 'luci.cfddns',
	method: 'set_target',
	params: [ 'zone_id', 'zone_name', 'domain', 'record_type' ],
	expect: {}
});

// ---------------------------------------------------------------------
// 移动优先样式：宽度全部 flex/百分比，禁止固定 px 宽度
// ---------------------------------------------------------------------

var CSS = [
	'.cfd-wrap { max-width: 100%; overflow-wrap: break-word; word-break: break-word; }',
	'.cfd-wrap * { box-sizing: border-box; }',

	'.cfd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;',
	'  padding: 14px 16px; margin-bottom: 14px; }',
	'.cfd-card > h3 { margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #1e293b;',
	'  padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }',

	'.cfd-row { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 7px 0;',
	'  border-bottom: 1px dashed #f1f5f9; font-size: 13px; }',
	'.cfd-row:last-child { border-bottom: 0; }',
	'.cfd-k { flex: 0 0 auto; min-width: 88px; color: #64748b; font-weight: 600; }',
	'.cfd-v { flex: 1 1 160px; min-width: 0; color: #1e293b; overflow-wrap: break-word;',
	'  word-break: break-all; }',
	'.cfd-note { flex: 1 1 100%; font-size: 12px; color: #94a3b8; padding-left: 0; }',
	'@media (min-width: 600px) { .cfd-note { flex: 0 0 auto; padding-left: 8px; } }',

	'.cfd-code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;',
	'  background: #f8fafc; padding: 1px 5px; border-radius: 3px; color: #0f172a;',
	'  overflow-wrap: break-word; word-break: break-all; }',

	'.cfd-field { margin-bottom: 14px; }',
	'.cfd-field > label { display: block; font-size: 13px; font-weight: 600;',
	'  color: #334155; margin-bottom: 6px; }',
	'.cfd-hint { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-top: 6px; }',

	'.cfd-wrap input[type=text], .cfd-wrap input[type=password],',
	'.cfd-wrap input[type=number], .cfd-wrap select {',
	'  width: 100% !important; max-width: 100% !important; min-width: 0 !important;',
	'  height: 38px; padding: 0 10px; font-size: 14px; border: 1px solid #cbd5e1;',
	'  border-radius: 6px; background: #fff; }',
	'.cfd-wrap input:focus, .cfd-wrap select:focus {',
	'  outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }',
	'.cfd-mono { font-family: ui-monospace, Menlo, Consolas, monospace !important; }',

	'.cfd-inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }',
	'.cfd-inline > .cfd-grow { flex: 1 1 140px; min-width: 0; }',
	'.cfd-inline > .cfd-fix { flex: 0 1 auto; min-width: 0; }',
	'.cfd-wrap .cfd-fix > input, .cfd-wrap .cfd-fix > select {',
	'  width: auto !important; min-width: 82px !important; max-width: 100% !important; }',
	'.cfd-wrap .cfd-narrow { max-width: 130px !important; }',
	'.cfd-suffix { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px;',
	'  color: #475569; overflow-wrap: break-word; word-break: break-all; }',
	'@media (max-width: 480px) { .cfd-suffix { flex: 1 1 100%; padding: 2px 0 0 2px; } }',

	'.cfd-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }',
	'.cfd-btns .btn, .cfd-btns button { flex: 1 1 auto; min-width: 104px;',
	'  margin: 0 !important; white-space: nowrap; }',
	'@media (min-width: 600px) { .cfd-btns .btn, .cfd-btns button { flex: 0 0 auto; } }',

	'.cfd-rec { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;',
	'  margin-bottom: 10px; background: #fff; }',
	'.cfd-rec.cur { border-color: #10b981; background: #f0fdf4; }',
	'.cfd-rec-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center;',
	'  margin-bottom: 8px; }',
	'.cfd-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 7px;',
	'  border-radius: 4px; background: #e2e8f0; color: #334155; }',
	'.cfd-badge.a { background: #dbeafe; color: #1d4ed8; }',
	'.cfd-badge.aaaa { background: #ede9fe; color: #6d28d9; }',
	'.cfd-badge.cname { background: #fef3c7; color: #b45309; }',
	'.cfd-badge.txt { background: #f1f5f9; color: #475569; }',
	'.cfd-badge.mx { background: #ffe4e6; color: #be123c; }',
	'.cfd-badge.on { background: #d1fae5; color: #047857; }',
	'.cfd-rec-name { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px;',
	'  font-weight: 600; color: #0f172a; overflow-wrap: break-word; word-break: break-all;',
	'  flex: 1 1 100%; }',
	'.cfd-rec-val { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;',
	'  color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 4px;',
	'  overflow-wrap: break-word; word-break: break-all; margin-bottom: 8px; }',
	'.cfd-rec-meta { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }',
	'.cfd-rec-acts { display: flex; flex-wrap: wrap; gap: 8px; }',
	'.cfd-rec-acts .btn, .cfd-rec-acts button { flex: 1 1 auto; min-width: 96px;',
	'  font-size: 12px !important; padding: 5px 10px !important; margin: 0 !important; }',

	'.cfd-alert { border-radius: 6px; padding: 10px 12px; font-size: 12px;',
	'  line-height: 1.8; margin-bottom: 12px; overflow-wrap: break-word; }',
	'.cfd-alert.warn { background: #fffbeb; border-left: 3px solid #f59e0b; color: #78350f; }',
	'.cfd-alert.info { background: #eff6ff; border-left: 3px solid #3b82f6; color: #1e40af; }',
	'.cfd-alert.err  { background: #fef2f2; border-left: 3px solid #ef4444; color: #991b1b; }',
	'.cfd-alert b { font-weight: 700; }',

	'.cfd-ok { color: #059669; font-weight: 700; }',
	'.cfd-bad { color: #dc2626; font-weight: 700; }',
	'.cfd-warn { color: #d97706; font-weight: 700; }',
	'.cfd-mute { color: #94a3b8; }',

	// 异步加载占位动画
	'.cfd-loading { display: inline-block; color: #94a3b8; font-weight: 400; }',
	'.cfd-loading::after { content: "…"; animation: cfdBlink 1.2s steps(4) infinite; }',
	'@keyframes cfdBlink { 0%,100% { opacity: .25; } 50% { opacity: 1; } }',

	// 总开关
	'.cfd-switch { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }',
	'.cfd-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%;',
	'  margin-right: 7px; vertical-align: middle; }',
	'.cfd-dot.on { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.18); }',
	'.cfd-dot.off { background: #94a3b8; box-shadow: 0 0 0 3px rgba(148,163,184,.18); }',
	'.cfd-switch-txt { flex: 1 1 160px; min-width: 0; font-size: 13px; color: #1e293b;',
	'  font-weight: 600; }',
	// 关闭态：只锁定「写操作」相关卡片，运行状态卡保持可用
	// （停靠地址设置按钮在运行状态卡里，关闭态下必须还能点）
	'.cfd-off #cfdLockToken, .cfd-off #cfdLockZones, .cfd-off #cfdLockCtrl {',
	'  opacity: .5; pointer-events: none; filter: grayscale(.5); }',
	'.cfd-card-off { border-color: #cbd5e1; background: #f8fafc; }',

	// 停靠地址弹窗
	'.cfd-modal-mask { position: fixed; inset: 0; background: rgba(15,23,42,.5);',
	'  z-index: 9998; display: flex; align-items: center; justify-content: center;',
	'  padding: 16px; }',
	'.cfd-modal { background: #fff; border-radius: 10px; width: 100%; max-width: 420px;',
	'  box-shadow: 0 12px 32px rgba(15,23,42,.28); overflow: hidden; z-index: 9999; }',
	'.cfd-modal-h { padding: 14px 16px; font-size: 15px; font-weight: 600;',
	'  color: #1e293b; border-bottom: 1px solid #f1f5f9; }',
	'.cfd-modal-b { padding: 16px; }',
	'.cfd-modal-b input { width: 100% !important; height: 40px; padding: 0 12px;',
	'  font-size: 15px; font-family: ui-monospace, Menlo, Consolas, monospace;',
	'  border: 1px solid #cbd5e1; border-radius: 6px; }',
	'.cfd-modal-b input:focus { outline: none; border-color: #3b82f6;',
	'  box-shadow: 0 0 0 3px rgba(59,130,246,.12); }',
	'.cfd-modal-tip { font-size: 12px; color: #64748b; line-height: 1.8; margin-top: 10px; }',
	'.cfd-modal-err { font-size: 12px; color: #dc2626; margin-top: 8px; min-height: 16px; }',
	'.cfd-modal-f { padding: 12px 16px; display: flex; gap: 10px; justify-content: flex-end;',
	'  border-top: 1px solid #f1f5f9; background: #f8fafc; }',
	'.cfd-modal-f .btn, .cfd-modal-f button { min-width: 88px; margin: 0 !important; }'
].join('\n');

// ---------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------

function okBtn(text, cls, handler) {
	var btn = E('button', {
		'class': 'btn cbi-button cbi-button-' + cls
	}, text);
	btn.addEventListener('click', function(ev) {
		ev.preventDefault();
		btn.disabled = true;
		handler(btn);
	});
	return btn;
}

function notify(msg, level) {
	ui.addNotification(null, E('p', {}, msg), level || 'info');
}

function errText(r) {
	if (!r)
		return '未知错误';
	var s = r.err || '操作失败';
	if (r.err_code)
		s += '（错误码 ' + r.err_code + '）';
	return s;
}

function code(v) {
	return E('span', { 'class': 'cfd-code' }, (v && String(v).length) ? String(v) : '-');
}

function loading() {
	return E('span', { 'class': 'cfd-loading' }, '加载中');
}

function kvRow(k, vNode, note) {
	var nodes = [
		E('div', { 'class': 'cfd-k' }, k),
		E('div', { 'class': 'cfd-v' }, vNode)
	];
	if (note)
		nodes.push(E('div', { 'class': 'cfd-note' }, note));
	return E('div', { 'class': 'cfd-row' }, nodes);
}

function card(title, children, id) {
	var attrs = { 'class': 'cfd-card' };
	if (id)
		attrs.id = id;
	return E('div', attrs, [
		E('h3', {}, title)
	].concat(children || []));
}

function field(labelText, inputNode, hintNodes) {
	var nodes = [
		E('label', {}, labelText),
		inputNode
	];
	if (hintNodes)
		nodes.push(E('div', { 'class': 'cfd-hint' }, hintNodes));
	return E('div', { 'class': 'cfd-field' }, nodes);
}

function typeBadge(type) {
	var t = String(type || '').toLowerCase();
	var cls = 'cfd-badge';
	if (t === 'a' || t === 'aaaa' || t === 'cname' || t === 'txt' || t === 'mx')
		cls += ' ' + t;
	return E('span', { 'class': cls }, type || '?');
}

// ---------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------

return view.extend({
	// 首屏只拉本地状态（毫秒级），外网探测放到 render 之后异步补
	load: function() {
		return Promise.all([
			callStatusQuick().catch(function() { return {}; }),
			callGetConfig().catch(function() { return {}; })
		]);
	},

	render: function(data) {
		var st = (data && data[0]) || {};
		var cfg = (data && data[1]) || {};
		var cron = st.cron || {};

		// 页面级共享状态
		var S = {
			zones: [],
			records: [],
			selZone: null,
			zonesLoaded: false,
			// 完整状态（探测 + CF），异步补进来
			full: null
		};

		// =============================================================
		// 零、总开关（放在最上面）
		// =============================================================

		var onNow = (st.enabled !== false);
		var parkIp = st.park_ip || '127.0.0.1';   // 关闭插件时域名指向的地址
		var isOn = onNow;

		var swTxt = E('span', { 'class': 'cfd-switch-txt' });
		var swBtnBox = E('div', { 'class': 'cfd-btns', 'style': 'margin:0;' });
		var swNoteBox = E('div', {});

		function paintSwitch(on, info) {
			dom.content(swTxt, [
				E('span', { 'class': 'cfd-dot ' + (on ? 'on' : 'off') }),
				on ? '插件运行中 · 自动维护域名解析'
				   : '插件已关闭 · 域名解析已停止指向本机'
			]);

			// 说明文字
			if (on) {
				dom.content(swNoteBox, E('div', { 'class': 'cfd-hint', 'style': 'margin-top:10px;' },
					'域名指向真实公网出口 IPv4，IP 变化时自动同步。'));
			} else {
				var pk = (st.park_ip || parkIp || '127.0.0.1');
				dom.content(swNoteBox, E('div', { 'class': 'cfd-alert warn', 'style': 'margin-top:10px;margin-bottom:0;' }, [
					E('b', {}, '域名已停止解析到本机'),
					E('div', { 'style': 'margin-top:4px;' },
						(st.domain || '维护域名') + ' 当前指向 ' + pk + '，外部已无法通过该域名访问。'),
					(info && info.old_ip)
						? E('div', { 'style': 'margin-top:4px;' }, '关闭前指向：' + info.old_ip)
						: null,
					E('div', { 'style': 'margin-top:6px;color:#92400e;' },
						'下方「运行状态」仍可查看，停靠地址可随时修改；其余操作需先启用插件。')
				]));
			}

			// 按钮
			var b = okBtn(on ? '关闭插件' : '启用插件',
				on ? 'reset' : 'apply',
				function(btn) { doSwitch(!on, btn); });
			dom.content(swBtnBox, b);

			// 整页置灰（wrapNode 在组装阶段才赋值，此处用 id 查找）
			var w = document.getElementById('cfdWrap');
			if (w) {
				if (on) w.classList.remove('cfd-off');
				else    w.classList.add('cfd-off');
			}
		}

		function doSwitch(want, btn) {
			var tip;
			if (want) {
				tip = '启用插件？\n\n将立即同步一次，把 ' + (st.domain || '维护域名') +
					' 解析恢复为当前公网出口 IP，并按关闭前的设置恢复定时任务。';
			} else {
				tip = '关闭插件？\n\n将执行：\n' +
					'1. 停止定时任务\n' +
					'2. 把 ' + (st.domain || '维护域名') + ' 的解析改为 ' + (st.park_ip || parkIp || '127.0.0.1') + '\n\n' +
					'⚠ 关闭后外部将立即无法通过该域名访问本机。\n' +
					'记录本身会保留，重新启用时自动恢复。';
			}
			if (!confirm(tip)) {
				btn.disabled = false;
				return;
			}

			callSetEnabled(!!want).then(function(r) {
				btn.disabled = false;
				if (!r || !r.ok) {
					notify((want ? '启用' : '关闭') + '失败：' + errText(r), 'danger');
					return;
				}
				st.enabled = !!want;
				isOn = !!want;
				if (!want && r.old_ip)
					st.parked_ip = r.park_ip || parkIp;
				if (r.park_ip)
					parkIp = r.park_ip;
				notify(want ? '插件已启用' : '插件已关闭，域名解析已停止', want ? 'info' : 'warning');
				paintSwitch(!!want, { old_ip: r.old_ip });
				// 状态卡跟着刷新
				refreshFull(true);
			}).catch(function(e) {
				notify('操作出错：' + (e.message || e), 'danger');
				btn.disabled = false;
			});
		}

		var switchCard = E('div', { 'class': 'cfd-card cfd-card-off' }, [
			E('h3', {}, '插件总开关'),
			E('div', { 'class': 'cfd-switch' }, [ swTxt, swBtnBox ]),
			swNoteBox
		]);

		paintSwitch(onNow, null);

		// =============================================================
		// 一、运行状态（先渲染骨架，再异步填充）
		// =============================================================

		var matchNode = loading();
		var cfIpNode = loading();
		var wanIpNode = loading();
		var wanNoteNode = E('div', { 'class': 'cfd-note' }, '');
		var natBox = E('div', {});

		var lastNode = E('span', {}, code(st.last));

		// 定时任务状态节点（setCron 会局部更新它）
		var cronNode = E('span', { 'class': cron.enabled ? 'cfd-ok' : 'cfd-mute' },
			cron.enabled ? ('已启用 · 每 ' + (cron.minutes || 1) + ' 分钟') : '已停用');

		// ---- 停靠地址（关闭插件时域名指向的 IP）----
		var parkTextNode = E('span', {}, code(parkIp));
		var parkEditBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'font-size:11px;padding:2px 8px;margin:0 0 0 8px;'
		}, '设置');

		function openParkDialog() {
			var input = E('input', {
				'type': 'text',
				'value': parkIp,
				'placeholder': '127.0.0.1',
				'inputmode': 'decimal',
				'autocomplete': 'off',
				'spellcheck': 'false'
			});
			var errNode = E('div', { 'class': 'cfd-modal-err' }, '');

			var cancelBtn = E('button', {
				'class': 'btn cbi-button cbi-button-neutral'
			}, '取消');
			cancelBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				close();
			});

			var saveBtn = E('button', {
				'class': 'btn cbi-button cbi-button-apply'
			}, '保存');
			saveBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				var v = (input.value || '').trim();
				if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
					dom.content(errNode, '格式不对，需要形如 192.168.1.1');
					return;
				}
				var parts = v.split('.');
				for (var i = 0; i < parts.length; i++) {
					if (parseInt(parts[i], 10) > 255) {
						dom.content(errNode, '每段必须在 0-255 之间');
						return;
					}
				}

				saveBtn.disabled = true;
				dom.content(errNode, '');

				callSetParkIp(v).then(function(r) {
					saveBtn.disabled = false;
					if (!r || !r.ok) {
						dom.content(errNode, errText(r));
						return;
					}
					parkIp = r.ip;
					st.park_ip = r.ip;
					dom.content(parkTextNode, code(r.ip));
					// 顶部总开关卡的提示里也写着这个地址，必须一起重绘，
					// 否则会出现「实际指向 192.0.2.1、提示还写着 127.0.0.1」
					if (!isOn)
						paintSwitch(false, null);
					// 关闭态下会立即改写线上记录，状态卡要跟着刷
					if (r.applied) {
						notify('已设为 ' + r.ip + '，线上记录已同步', 'info');
						refreshFull(true);
					} else if (r.note) {
						notify(r.note, 'warning');
					} else {
						notify('已设为 ' + r.ip + '（下次关闭时生效）', 'info');
					}
					close();
				}).catch(function(e) {
					saveBtn.disabled = false;
					dom.content(errNode, '出错：' + (e.message || e));
				});
			});

			var dlg = E('div', { 'class': 'cfd-modal' }, [
				E('div', { 'class': 'cfd-modal-h' }, '设置停靠地址'),
				E('div', { 'class': 'cfd-modal-b' }, [
					input,
					errNode,
					E('div', { 'class': 'cfd-modal-tip' }, [
						E('div', {}, '关闭插件时，把「' + (st.domain || '维护域名') +
							'」的解析记录改成这个地址。'),
						E('div', {}, '默认 127.0.0.1（本机回环），外部无法通过该域名访问。'),
						E('div', {}, '可填任意 IPv4，例如 192.0.2.1（文档保留地址，保证不可达）。'),
						E('div', { 'style': 'margin-top:6px;color:#94a3b8;' },
							'插件当前为' + (isOn ? '运行' : '关闭') +
							'状态' + (isOn ? '，保存后仅记录设置，下次关闭时生效。' : '，保存后立即同步到线上记录。'))
					])
				]),
				E('div', { 'class': 'cfd-modal-f' }, [ cancelBtn, saveBtn ])
			]);

			var mask = E('div', { 'class': 'cfd-modal-mask' }, [ dlg ]);

			function close() {
				if (mask.parentNode)
					mask.parentNode.removeChild(mask);
			}

			// 回车直接保存
			input.addEventListener('keydown', function(ev) {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					saveBtn.click();
				}
			});

			document.body.appendChild(mask);
			setTimeout(function() { input.focus(); input.select(); }, 50);
		}

		parkEditBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			openParkDialog();
		});

		var statusCard = card('运行状态', [
			kvRow('维护域名', code(st.domain), '类型 ' + (st.record_type || 'A')),
			kvRow('公网出口', wanIpNode, wanNoteNode),
			kvRow('CF 记录', cfIpNode),
			kvRow('同步状态', matchNode),
			kvRow('停靠地址', E('span', {}, [ parkTextNode, parkEditBtn ]),
				'关闭插件时域名改为解析到该地址'),
			kvRow('WAN 接口', code(st.iface), '地址 ' + (st.iface_ip || '-')),
			kvRow('定时任务', cronNode),
			kvRow('上次执行', lastNode)
		]);

		// 完整状态回来后刷新状态卡
		function applyFull(f) {
			if (!f)
				return;
			S.full = f;

			// 公网出口
			if (!f.wan_ip)
				dom.content(wanIpNode, E('span', { 'class': 'cfd-bad' }, '✗ 探测失败'));
			else
				dom.content(wanIpNode, code(f.wan_ip));

			var note = '';
			if (f.probe_src) {
				note = '来源 ' + f.probe_src;
				if (f.probe_agree >= 2)
					note += ' · ' + f.probe_agree + ' 源一致';
				else if (f.probe_agree == 1)
					note += ' · 仅 1 源';
				if (f.probe_cached)
					note += ' · 缓存';
			}
			dom.content(wanNoteNode, note);

			// CF 记录
			dom.content(cfIpNode, f.cf_ip
				? code(f.cf_ip)
				: E('span', { 'class': 'cfd-mute' }, '-'));

			// 同步状态
			// 关闭态下记录本来就指向黑洞地址，显示「未同步」会误导，
			// 单独识别成「已关闭」而不是异常。
			var mn;
			var parked = (f.park_ip || parkIp || '127.0.0.1');
			var isOff = (f.enabled === false && f.cf_ip && f.cf_ip === parked);
			if (isOff)
				mn = E('span', { 'class': 'cfd-mute' }, '— 插件已关闭');
			else if (!f.wan_ip)
				mn = E('span', { 'class': 'cfd-bad' }, '✗ 探测失败');
			else if (!f.cf_ok)
				mn = E('span', { 'class': 'cfd-warn' }, '⚠ CF 查询失败');
			else if (f.match)
				mn = E('span', { 'class': 'cfd-ok' }, '✓ 已同步');
			else
				mn = E('span', { 'class': 'cfd-warn' }, '⚠ 未同步');
			dom.content(matchNode, mn);

			// 上次执行
			dom.content(lastNode, code(f.last));

			// NAT 提示
			dom.content(natBox, (f.iface_ip && f.wan_ip && f.iface_ip !== f.wan_ip)
				? E('div', { 'class': 'cfd-alert warn' }, [
					E('b', {}, '运营商 NAT'),
					E('div', { 'style': 'margin-top:4px;' },
						'接口地址 ' + f.iface_ip + ' 是内网地址，真实出口是 ' + f.wan_ip +
						'。DNS 写的是后者。')
				])
				: '');
		}

		// =============================================================
		// 二、API 凭据
		// =============================================================

		var tokenInput = E('input', {
			'type': 'password',
			'class': 'cfd-mono',
			'placeholder': cfg.has_token ? '留空不修改，填新值则覆盖' : '粘贴 Cloudflare API Token',
			'autocomplete': 'new-password',
			'spellcheck': 'false'
		});

		var tokenStateNode = E('span', { 'class': cfg.has_token ? 'cfd-ok' : 'cfd-bad' },
			cfg.has_token ? ('✓ ' + (cfg.token_mask || '已配置')) : '✗ 未配置');

		var saveTokenBtn = okBtn('保存 Token', 'apply', function(btn) {
			var v = (tokenInput.value || '').trim();
			if (!v.length) {
				notify('请先粘贴 Token', 'warning');
				btn.disabled = false;
				return;
			}
			callSaveToken(v).then(function(r) {
				if (r && r.ok) {
					notify('Token 已保存', 'info');
					tokenInput.value = '';
					// 局部刷新：不整页重载
					return callGetConfig().then(function(c2) {
						if (c2 && c2.has_token) {
							tokenStateNode.className = 'cfd-ok';
							dom.content(tokenStateNode, '✓ ' + (c2.token_mask || '已配置'));
						}
					}).catch(function() {});
				}
				notify('保存失败：' + errText(r), 'danger');
				btn.disabled = false;
			}).catch(function(e) {
				notify('保存出错：' + (e.message || e), 'danger');
				btn.disabled = false;
			}).then(function() {
				btn.disabled = false;
			});
		});

		var zonesBtn = okBtn('验证并列出域名', 'action', function(btn) {
			// force=true 跳过缓存，这个按钮的语义就是“重新验证”
			callListZones(true).then(function(r) {
				btn.disabled = false;
				if (!r || !r.ok) {
					notify('获取域名失败：' + errText(r), 'danger');
					return;
				}
				S.zones = r.zones || [];
				S.zonesLoaded = true;

				// 自动选中与当前维护域名匹配的 zone（与首屏逻辑保持一致）
				S.selZone = null;
				for (var i = 0; i < S.zones.length; i++) {
					if (st.domain && st.domain.indexOf(S.zones[i].name) >= 0) {
						S.selZone = S.zones[i];
						break;
					}
				}
				if (!S.selZone && S.zones.length === 1)
					S.selZone = S.zones[0];

				notify(S.zones.length
					? 'Token 有效，共 ' + S.zones.length + ' 个域名'
					: 'Token 有效，但账号下没有域名', S.zones.length ? 'info' : 'warning');

				renderZones();
				if (S.selZone)
					loadRecords(S.selZone.id);
			}).catch(function(e) {
				btn.disabled = false;
				notify('请求出错：' + (e.message || e), 'danger');
			});
		});

		var tokenCard = card('API 凭据', [
			kvRow('当前状态', tokenStateNode),
			field('API Token', tokenInput, [
				E('div', {}, '需要权限：Zone → DNS → Edit、Zone → Zone → Read'),
				E('div', {}, 'Token 存在 /etc/cfddns.conf（600），页面只显示脱敏值')
			]),
			E('div', { 'class': 'cfd-btns' }, [ saveTokenBtn, zonesBtn ])
		], 'cfdLockToken');

		// =============================================================
		// 三、域名与解析
		// 注意：表单节点只创建一次并持久复用，重绘时只替换记录列表，
		//       否则用户填了一半的内容会被清空。
		// =============================================================

		var zonesBox = E('div', {});
		var zonesCard = card('域名与解析', [ zonesBox ], 'cfdLockZones');

		// --- 表单节点（一次创建，永久复用）---
		var typeSel = E('select', { 'class': 'cfd-narrow' });
		[ 'A', 'AAAA', 'CNAME', 'TXT' ].forEach(function(t, i) {
			var o = E('option', { 'value': t }, t);
			if (i === 0)
				o.selected = true;
			typeSel.appendChild(o);
		});

		var nameInput = E('input', {
			'type': 'text', 'class': 'cfd-mono',
			'placeholder': 'home 或 @', 'spellcheck': 'false'
		});

		var contentInput = E('input', {
			'type': 'text', 'class': 'cfd-mono',
			'placeholder': 'IP 或目标域名', 'spellcheck': 'false'
		});

		var ttlInput = E('input', {
			'type': 'number', 'value': '120', 'min': '60', 'max': '86400',
			'class': 'cfd-narrow'
		});

		var proxiedChk = E('input', { 'type': 'checkbox' });
		var setTargetChk = E('input', { 'type': 'checkbox', 'checked': 'checked' });

		// TXT 类型不允许橙云，勾上会误导用户（CF 会拒）
		var proxiedLabel = E('label', {
			'style': 'display:inline-flex;align-items:center;gap:6px;font-weight:400;'
		}, [ proxiedChk, E('span', {}, '橙云代理') ]);

		typeSel.addEventListener('change', function() {
			var t = typeSel.value;
			var canProxy = (t === 'A' || t === 'AAAA' || t === 'CNAME');
			proxiedChk.disabled = !canProxy;
			if (!canProxy)
				proxiedChk.checked = false;
			proxiedLabel.style.opacity = canProxy ? '1' : '.45';
		});

		var fillIpBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral'
		}, '填入当前公网 IP');
		fillIpBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			fillIpBtn.disabled = true;
			callProbe(false).then(function(r) {
				fillIpBtn.disabled = false;
				if (r && r.ip) {
					contentInput.value = r.ip;
					typeSel.value = 'A';
					typeSel.dispatchEvent(new Event('change'));
					notify('已填入 ' + r.ip + (r.cached ? '（缓存）' : ''), 'info');
				} else {
					notify('探测失败', 'danger');
				}
			}).catch(function(e) {
				fillIpBtn.disabled = false;
				notify('出错：' + (e.message || e), 'danger');
			});
		});

		// 域名后缀显示节点（随选中 zone 更新）
		var suffixNode = E('div', { 'class': 'cfd-suffix' }, '. （先选域名）');

		var addBtn = okBtn('添加解析', 'action', function(btn) {
			if (!S.selZone) {
				notify('请先选择域名', 'warning');
				btn.disabled = false;
				return;
			}
			var nm = (nameInput.value || '').trim();
			var ct = (contentInput.value || '').trim();
			if (!nm.length) {
				notify('请填写主机名（根域名填 @）', 'warning');
				btn.disabled = false;
				return;
			}
			if (!ct.length) {
				notify('请填写记录内容', 'warning');
				btn.disabled = false;
				return;
			}

			callAddRecord(
				S.selZone.id, S.selZone.name, typeSel.value,
				nm, ct, parseInt(ttlInput.value, 10) || 120,
				proxiedChk.checked, setTargetChk.checked
			).then(function(r) {
				btn.disabled = false;
				if (!r || !r.ok) {
					notify('添加失败：' + errText(r), 'danger');
					return;
				}
				var msg = '已添加 ' + r.type + '：' + r.name;
				if (r.target_set)
					msg += '（已接管维护）';
				notify(msg, 'info');

				// 清空表单，只重载记录列表
				nameInput.value = '';
				contentInput.value = '';

				if (r.target_set) {
					// 维护目标变了，需要重新拉完整状态
					refreshFull(true);
				}
				loadRecords(S.selZone.id);
			}).catch(function(e) {
				btn.disabled = false;
				notify('出错：' + (e.message || e), 'danger');
			});
		});

		// 表单 DOM（一次构建）
		var addForm = E('div', { 'style': 'border-top:1px solid #e2e8f0;padding-top:14px;' }, [
			E('div', { 'style': 'font-size:13px;font-weight:600;color:#334155;margin-bottom:10px;' },
				'手动添加解析'),
			E('div', { 'class': 'cfd-field' }, [
				E('label', {}, '类型 / 主机名'),
				E('div', { 'class': 'cfd-inline' }, [
					E('div', { 'class': 'cfd-fix' }, typeSel),
					E('div', { 'class': 'cfd-grow' }, nameInput),
					suffixNode
				])
			]),
			E('div', { 'class': 'cfd-field' }, [
				E('label', {}, '记录内容'),
				E('div', { 'class': 'cfd-inline' }, [
					E('div', { 'class': 'cfd-grow' }, contentInput),
					E('div', { 'class': 'cfd-fix' }, fillIpBtn)
				])
			]),
			E('div', { 'class': 'cfd-field' }, [
				E('label', {}, 'TTL'),
				ttlInput,
				E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:13px;' }, [
					proxiedLabel,
					E('label', {
						'style': 'display:inline-flex;align-items:center;gap:6px;font-weight:400;'
					}, [ setTargetChk, E('span', {}, '同时接管维护') ])
				])
			]),
			E('div', { 'class': 'cfd-btns' }, [ addBtn ]),
			E('div', { 'class': 'cfd-hint' }, [
				E('div', {}, '主机名填 @ 表示根域名，填 home 会补成 home.<域名>'),
				E('div', {}, '勾选「同时接管维护」后，定时任务改为维护这条记录')
			])
		]);
		// --- 记录列表区域（会被重绘）---
		var recBox = E('div', { 'style': 'margin-bottom:14px;' });
		var zoneSelBox = E('div', {});
		var loadBtnBox = E('div', {});

		function updateSuffix() {
			dom.content(suffixNode, S.selZone ? '. ' + S.selZone.name : '. （先选域名）');
		}

		function renderRecBox() {
			if (!S.selZone) {
				dom.content(recBox, '');
				return;
			}
			dom.content(recBox, buildRecords());
		}

		function loadRecords(zid) {
			dom.content(recBox, E('div', { 'class': 'cfd-alert info' }, [
				loading(), ' 正在读取解析记录…'
			]));
			callListRecords(zid).then(function(r) {
				if (!r || !r.ok) {
					dom.content(recBox, E('div', { 'class': 'cfd-alert err' },
						'加载记录失败：' + errText(r)));
					return;
				}
				S.records = r.records || [];
				renderRecBox();
			}).catch(function(e) {
				dom.content(recBox, E('div', { 'class': 'cfd-alert err' },
					'加载记录出错：' + (e.message || e)));
			});
		}

		// 只重绘“域名选择器 + 按钮 + 记录列表”，表单节点不动
		function renderZones() {
			updateSuffix();

			if (!S.zonesLoaded) {
				dom.content(zoneSelBox, E('div', { 'class': 'cfd-alert info' },
					'点上方「验证并列出域名」加载域名列表。'));
				dom.content(loadBtnBox, '');
				dom.content(recBox, '');
				return;
			}

			if (!S.zones.length) {
				dom.content(zoneSelBox, E('div', { 'class': 'cfd-alert err' },
					'该 Token 下没有可用域名，请检查权限是否含 Zone → Zone → Read。'));
				dom.content(loadBtnBox, '');
				dom.content(recBox, '');
				return;
			}

			var sel = E('select', {});
			sel.appendChild(E('option', { 'value': '' }, '— 请选择域名 —'));
			for (var i = 0; i < S.zones.length; i++) {
				var z = S.zones[i];
				var o = E('option', { 'value': z.id },
					z.name + (z.status && z.status !== 'active' ? '（' + z.status + '）' : ''));
				if (S.selZone && S.selZone.id === z.id)
					o.selected = true;
				sel.appendChild(o);
			}

			sel.addEventListener('change', function() {
				S.selZone = null;
				S.records = [];
				for (var k = 0; k < S.zones.length; k++) {
					if (S.zones[k].id === sel.value) {
						S.selZone = S.zones[k];
						break;
					}
				}
				updateSuffix();
				if (S.selZone)
					loadRecords(S.selZone.id);
				else
					dom.content(recBox, '');
			});

			dom.content(zoneSelBox, field('选择域名', sel));

			var loadBtn = okBtn('加载解析记录', 'neutral', function(btn) {
				if (!sel.value) {
					notify('请先选择域名', 'warning');
					btn.disabled = false;
					return;
				}
				for (var k = 0; k < S.zones.length; k++) {
					if (S.zones[k].id === sel.value) {
						S.selZone = S.zones[k];
						break;
					}
				}
				btn.disabled = false;
				updateSuffix();
				loadRecords(sel.value);
			});

			dom.content(loadBtnBox, E('div', {
				'class': 'cfd-btns', 'style': 'margin-bottom:14px;'
			}, [ loadBtn ]));

			renderRecBox();
		}

		function buildRecords() {
			if (!S.records.length) {
				return E('div', { 'class': 'cfd-alert info' },
					'暂无记录（或尚未加载）。用下面的表单添加第一条。');
			}

			var wrap = E('div', {}, [
				E('div', {
					'style': 'font-size:13px;font-weight:600;color:#334155;margin-bottom:8px;'
				}, '解析记录（' + S.records.length + '）')
			]);

			for (var i = 0; i < S.records.length; i++)
				wrap.appendChild(buildRecordItem(S.records[i]));

			return wrap;
		}

		function buildRecordItem(rec) {
			var isTarget = (rec.name === st.domain && rec.type === (st.record_type || 'A'));

			var head = E('div', { 'class': 'cfd-rec-head' }, [
				typeBadge(rec.type),
				isTarget ? E('span', { 'class': 'cfd-badge on' }, '✓ 当前维护') : null,
				rec.proxied ? E('span', { 'class': 'cfd-badge' }, '橙云') : null,
				E('span', { 'class': 'cfd-mute', 'style': 'font-size:11px;' },
					rec.ttl == 1 ? 'TTL 自动' : 'TTL ' + rec.ttl)
			].filter(function(n) { return n != null; }));

			var setBtn = E('button', {
				'class': 'btn cbi-button cbi-button-neutral'
			}, isTarget ? '已是目标' : '设为维护目标');
			if (isTarget)
				setBtn.disabled = true;
			setBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				setBtn.disabled = true;
				callSetTarget(S.selZone.id, S.selZone.name, rec.name, rec.type).then(function(r) {
					if (r && r.ok) {
						notify('已把 ' + rec.name + ' 设为维护目标', 'info');
						// 局部刷新：重载记录 + 重拉完整状态，不整页重载
						loadRecords(S.selZone.id);
						refreshFull(true);
					} else {
						notify('失败：' + errText(r), 'danger');
						setBtn.disabled = false;
					}
				}).catch(function(e) {
					notify('出错：' + (e.message || e), 'danger');
					setBtn.disabled = false;
				});
			});

			var delBtn = E('button', {
				'class': 'btn cbi-button cbi-button-reset'
			}, '删除');
			delBtn.addEventListener('click', function(ev) {
				ev.preventDefault();

				var tip = '确定删除这条记录？\n\n' + rec.type + '  ' + rec.name + '\n\n内容：' + rec.content;
				if (isTarget)
					tip += '\n\n⚠ 这是当前 DDNS 维护目标！删除后定时任务会在下次同步时自动重建它。';
				if (!confirm(tip))
					return;

				delBtn.disabled = true;
				callDelRecord(S.selZone.id, rec.id).then(function(r) {
					if (r && r.ok) {
						S.records = S.records.filter(function(x) { return x.id !== rec.id; });
						renderRecBox();
						if (r.is_target)
							notify('已删除。注意：它原先是维护目标，定时任务会重建，建议先切到别的记录', 'warning');
						else
							notify('已删除 ' + rec.name, 'info');
					} else {
						notify('删除失败：' + errText(r), 'danger');
						delBtn.disabled = false;
					}
				}).catch(function(e) {
					notify('出错：' + (e.message || e), 'danger');
					delBtn.disabled = false;
				});
			});

			return E('div', { 'class': 'cfd-rec' + (isTarget ? ' cur' : '') }, [
				head,
				E('div', { 'class': 'cfd-rec-name' }, rec.name),
				E('div', { 'class': 'cfd-rec-val' }, rec.content),
				E('div', { 'class': 'cfd-rec-acts' }, [ setBtn, delBtn ])
			]);
		}

		// 域名卡骨架：选择器区 + 按钮区 + 记录区 + 表单（表单常驻）
		dom.content(zonesBox, [ zoneSelBox, loadBtnBox, recBox, addForm ]);

		// =============================================================
		// 四、异步加载完整状态 / 域名
		// =============================================================

		function refreshFull(force) {
			callStatus(force ? true : false).then(function(f) {
				applyFull(f);
			}).catch(function() {
				dom.content(matchNode, E('span', { 'class': 'cfd-bad' }, '✗ 状态获取失败'));
				dom.content(wanIpNode, E('span', { 'class': 'cfd-mute' }, '-'));
				dom.content(cfIpNode, E('span', { 'class': 'cfd-mute' }, '-'));
			});
		}

		// 已有 token 时自动加载域名（命中缓存，快到几乎无感）
		function initZones() {
			if (!cfg.has_token)
				return;
			callListZones(false).then(function(r) {
				if (!r || !r.ok)
					return;
				S.zones = r.zones || [];
				S.zonesLoaded = true;
				if (S.zones.length) {
					for (var i = 0; i < S.zones.length; i++) {
						if (st.domain && st.domain.indexOf(S.zones[i].name) >= 0) {
							S.selZone = S.zones[i];
							break;
						}
					}
					if (!S.selZone && S.zones.length === 1)
						S.selZone = S.zones[0];
				}
				renderZones();
				if (S.selZone)
					loadRecords(S.selZone.id);
			}).catch(function() {});
		}

		// render 返回后立刻发起异步请求（不阻塞首屏绘制）
		setTimeout(function() {
			refreshFull(false);
			initZones();
		}, 0);

		// =============================================================
		// 五、操作与设置
		// =============================================================

		var runBtn = okBtn('立即更新解析', 'action', function(btn) {
			notify('正在同步，请稍候…', 'info');
			callRun().then(function(res) {
				var code_ = res ? res.code : -1;
				var msg = '执行完成（' + code_ + '）';
				if (code_ === 0)      msg = '同步成功';
				else if (code_ === 1) msg = '探测公网 IP 失败';
				else if (code_ === 2) msg = 'CF 查询失败';
				else if (code_ === 3) msg = 'CF 写入失败';
				else if (code_ === 4) msg = '配置文件缺失';
				else if (code_ === 5) msg = '已有任务运行中，跳过';
				notify(msg, code_ === 0 ? 'info' : 'warning');
				btn.disabled = false;
				refreshFull(true);
				if (S.selZone)
					loadRecords(S.selZone.id);
			}).catch(function(e) {
				notify('执行失败：' + (e.message || e), 'danger');
				btn.disabled = false;
			});
		});

		var probeBtn = okBtn('测试探测', 'neutral', function(btn) {
			callProbe(true).then(function(res) {
				if (res && res.ip) {
					var txt = '公网 IP：' + res.ip;
					if (res.agree >= 2)
						txt += '（' + res.agree + ' 源一致）';
					notify(txt, 'info');
				} else {
					notify('探测失败：所有源无响应', 'danger');
				}
				btn.disabled = false;
				refreshFull(false);
			}).catch(function(e) {
				notify('探测出错：' + (e.message || e), 'danger');
				btn.disabled = false;
			});
		});

		function setCron(enabled, minutes, btn) {
			return callSet(enabled, minutes).then(function(r) {
				var c2 = (r && r.enabled != null) ? r : null;
				var on = c2 ? c2.enabled : enabled;
				var mi = c2 ? (c2.minutes || 1) : minutes;
				notify(on ? ('已启用，每 ' + mi + ' 分钟') : '已停用', 'info');
				// 局部更新按钮和状态
				dom.content(cronNode, on
					? E('span', { 'class': 'cfd-ok' }, '已启用 · 每 ' + mi + ' 分钟')
					: E('span', { 'class': 'cfd-mute' }, '已停用'));
				cron.enabled = on;
				cron.minutes = mi;
				dom.content(toggleNode, '');
				dom.content(toggleNode, buildToggleBtn());
				if (btn)
					btn.disabled = false;
			}).catch(function(e) {
				notify('失败：' + (e.message || e), 'danger');
				if (btn)
					btn.disabled = false;
			});
		}

		function buildToggleBtn() {
			return okBtn(cron.enabled ? '停用定时' : '启用定时',
				cron.enabled ? 'reset' : 'apply', function(btn) {
				setCron(!cron.enabled, cron.minutes || 1, btn);
			});
		}

		var toggleNode = E('div', {});
		dom.content(toggleNode, buildToggleBtn());

		var refreshBtn = okBtn('刷新', 'neutral', function(btn) {
			btn.disabled = false;
			refreshFull(true);
			if (S.selZone)
				loadRecords(S.selZone.id);
			notify('已刷新', 'info');
		});

		var intervalInput = E('input', {
			'type': 'number', 'min': '1', 'max': '60',
			'value': cron.minutes || 1, 'class': 'cfd-narrow'
		});

		var applyBtn = okBtn('保存周期', 'apply', function(btn) {
			var mins = parseInt(intervalInput.value, 10) || 1;
			if (mins < 1) mins = 1;
			if (mins > 60) mins = 60;
			setCron(cron.enabled, mins, btn);
		});

		var controlCard = card('操作与设置', [
			E('div', { 'class': 'cfd-field' }, [
				E('label', {}, '快捷操作'),
				E('div', { 'class': 'cfd-btns' },
					[ runBtn, probeBtn, toggleNode, refreshBtn ])
			]),
			E('div', { 'class': 'cfd-field', 'style': 'margin-bottom:0;' }, [
				E('label', {}, '定时同步周期（分钟，1-60）'),
				intervalInput,
				E('div', { 'class': 'cfd-btns', 'style': 'margin-top:10px;' }, [ applyBtn ]),
				E('div', { 'class': 'cfd-hint' },
					'启用后按间隔自动探测公网出口并同步到当前维护的记录')
			])
		], 'cfdLockCtrl');

		// =============================================================
		// 六、说明
		// =============================================================

		var helpCard = card('说明', [
			E('div', { 'class': 'cfd-hint', 'style': 'margin-top:0;' }, [
				E('div', {}, '维护的是一条指定解析记录，内容为路由器真实公网出口 IPv4。'),
				E('div', {}, 'PPPoE 拿到的是运营商 NAT 内网地址，本地查不到真实出口，故用外部服务多源探测并交叉验证。'),
				E('div', {}, '配置：/etc/cfddns.conf（改完即时生效，无需重启）'),
				E('div', {}, '日志：/tmp/cfddns.log（重启清空）')
			])
		]);

		// =============================================================
		// 组装
		// =============================================================

		return E('div', { 'class': 'cbi-map cfd-wrap' + (onNow ? '' : ' cfd-off'), 'id': 'cfdWrap' }, [
			E('style', {}, CSS),
			E('h2', { 'name': 'content', 'style': 'font-size:18px;margin-bottom:4px;' },
				'Cloudflare 动态域名'),
			E('div', { 'style': 'font-size:12px;color:#94a3b8;margin-bottom:14px;' },
				'自动同步公网出口 IPv4 到 Cloudflare DNS'),
			switchCard,
			natBox,
			statusCard,
			tokenCard,
			zonesCard,
			controlCard,
			helpCard
		]);
	}
});