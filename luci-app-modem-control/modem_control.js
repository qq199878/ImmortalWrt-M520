'use strict';
'require fs';
'require ui';
'require view';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/modem_power', ['status_json'], 'json'), {
				exists: 1,
				authorized: 0,
				tty_count: 0,
				wwan_exist: 0,
				product: 'LONGSUNG U9300C SXNC',
				vendor: '1c9e:9b3c'
			})
		]);
	},

	render: function(data) {
		var status = data[0] || {};
		var isAuthorized = (status.authorized === 1 || status.authorized === '1');

		var styleNode = E('style', {}, [
			'.modem-main-container { max-width: 860px; margin: 10px auto 30px auto; padding: 0 10px; }',
			'.modem-card { border-radius: 16px; padding: 24px; background: var(--card-bg, #ffffff); box-shadow: 0 6px 20px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06); margin-bottom: 20px; transition: all 0.3s ease; }',
			'[data-theme="dark"] .modem-card, .dark-theme .modem-card { background: #1e222d !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: none !important; }',
			'.modem-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding-bottom: 18px; border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 20px; }',
			'[data-theme="dark"] .modem-header, .dark-theme .modem-header { border-bottom-color: rgba(255,255,255,0.08) !important; }',
			'.modem-title-area { display: flex; align-items: center; gap: 12px; }',
			'.modem-icon-wrap { width: 44px; height: 44px; border-radius: 12px; background: rgba(94, 114, 228, 0.1); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }',
			'.modem-title { font-size: 19px; font-weight: 700; margin: 0 0 4px 0; color: #1e293b; }',
			'[data-theme="dark"] .modem-title, .dark-theme .modem-title { color: #f1f5f9 !important; }',
			'.modem-subtitle { font-size: 13px; color: #64748b; margin: 0; }',
			'.modem-badge { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 30px; font-size: 13px; font-weight: 600; }',
			'.modem-badge-on { background: rgba(46, 204, 113, 0.15); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.3); }',
			'.modem-badge-off { background: rgba(100, 116, 139, 0.15); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.3); }',
			'.modem-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }',
			'.modem-dot-on { background: #2ecc71; box-shadow: 0 0 10px #2ecc71; }',
			'.modem-dot-off { background: #94a3b8; }',
			'.modem-switch-section { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 14px; background: rgba(94, 114, 228, 0.04); border: 1px solid rgba(94, 114, 228, 0.1); margin-bottom: 22px; flex-wrap: wrap; }',
			'[data-theme="dark"] .modem-switch-section, .dark-theme .modem-switch-section { background: rgba(94, 114, 228, 0.08) !important; border-color: rgba(94, 114, 228, 0.2) !important; }',
			'.modem-switch-text { flex: 1; min-width: 220px; }',
			'.modem-switch-label { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }',
			'[data-theme="dark"] .modem-switch-label, .dark-theme .modem-switch-label { color: #f8fafc !important; }',
			'.modem-switch-desc { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; }',
			'[data-theme="dark"] .modem-switch-desc, .dark-theme .modem-switch-desc { color: #94a3b8 !important; }',
			'.cbi-switch-wrap { position: relative; display: inline-block; width: 64px; height: 34px; flex-shrink: 0; }',
			'.cbi-switch-wrap input { opacity: 0; width: 0; height: 0; }',
			'.cbi-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 34px; }',
			'.cbi-switch-slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }',
			'input:checked + .cbi-switch-slider { background-color: #5e72e4; }',
			'input:checked + .cbi-switch-slider:before { transform: translateX(30px); }',
			'.modem-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }',
			'.modem-grid-item { background: rgba(0,0,0,0.02); border-radius: 10px; padding: 12px 14px; border: 1px solid rgba(0,0,0,0.04); }',
			'[data-theme="dark"] .modem-grid-item, .dark-theme .modem-grid-item { background: rgba(255,255,255,0.03) !important; border-color: rgba(255,255,255,0.05) !important; }',
			'.modem-grid-lbl { font-size: 12px; color: #64748b; margin-bottom: 5px; }',
			'.modem-grid-val { font-size: 14px; font-weight: 600; color: #334155; word-break: break-all; }',
			'[data-theme="dark"] .modem-grid-val, .dark-theme .modem-grid-val { color: #cbd5e1 !important; }',
			'.modem-tip-box { font-size: 13px; line-height: 1.6; padding: 12px 16px; border-radius: 10px; background: rgba(94, 114, 228, 0.05); border-left: 4px solid #5e72e4; color: #475569; }',
			'[data-theme="dark"] .modem-tip-box, .dark-theme .modem-tip-box { background: rgba(94, 114, 228, 0.1) !important; color: #94a3b8 !important; }'
		]);

		var switchInput = E('input', {
			'type': 'checkbox',
			'id': 'modem-power-toggle'
		});
		if (isAuthorized) {
			switchInput.checked = true;
		}

		var badgeContainer = E('div', { 'id': 'modem-badge-box' });
		var statusDescEl = E('p', { 'class': 'modem-switch-desc', 'id': 'modem-desc-el' });
		var portsValEl = E('div', { 'class': 'modem-grid-val', 'id': 'modem-ports-val' });

		function applyStatusUI(auth, stat) {
			var curStat = stat || status;
			if (auth) {
				badgeContainer.innerHTML = '<span class="modem-badge modem-badge-on"><span class="modem-dot modem-dot-on"></span>已授权 运行中</span>';
				statusDescEl.textContent = _('模组已通过 USB 授权并完成枚举，串口与网络接口正常挂载。开机将自动保持开启。');
				portsValEl.textContent = 'ttyUSB×' + (curStat.tty_count || 3) + ' / ' + (curStat.wwan_exist ? 'wwan0' : '无') + ' (正常挂载)';
			} else {
				badgeContainer.innerHTML = '<span class="modem-badge modem-badge-off"><span class="modem-dot modem-dot-off"></span>已去授权 深度挂起 (省电)</span>';
				statusDescEl.textContent = _('模组已被系统撤销 USB 授权，内核不再与其通信，串口与网络接口全部注销，射频静默。供电仍保留，模组进入深度挂起。开机将自动保持关闭。');
				portsValEl.textContent = '接口已全部注销 (无占用)';
			}
		}

		applyStatusUI(isAuthorized, status);

		switchInput.addEventListener('change', function(ev) {
			var willEnable = ev.target.checked;
			switchInput.disabled = true;

			var actionMsg = willEnable ? _('正在恢复 USB 授权，唤醒 4G 模组...') : _('正在撤销 USB 授权，挂起 4G 模组...');
			ui.showIndicator('modem-toggle', actionMsg);

			var cmd = willEnable ? 'power_on' : 'power_off';

			fs.exec_direct('/etc/init.d/modem_power', [cmd]).then(function() {
				// 获取实时最新状态核验
				return fs.exec_direct('/etc/init.d/modem_power', ['status_json'], 'json');
			}).then(function(newStat) {
				ui.hideIndicator('modem-toggle');
				switchInput.disabled = false;
				var realAuth = (newStat && (newStat.authorized === 1 || newStat.authorized === '1'));
				switchInput.checked = realAuth;
				applyStatusUI(realAuth, newStat);

				var toastMsg = realAuth ?
					_('4G 模组已恢复 USB 授权并完成枚举，开机启动策略已同步保存！') :
					_('4G 模组已撤销 USB 授权并深度挂起，开机启动策略已同步保存！射频已静默。');
				ui.addNotification(null, E('p', {}, toastMsg), 'info');
			}).catch(function(err) {
				ui.hideIndicator('modem-toggle');
				switchInput.disabled = false;
				switchInput.checked = !willEnable;
				applyStatusUI(!willEnable, status);
				ui.addNotification(null, E('p', {}, _('操作失败: ') + err), 'error');
			});
		});

		var viewNode = E('div', { 'class': 'modem-main-container' }, [
			styleNode,
			E('div', { 'class': 'modem-card' }, [
				E('div', { 'class': 'modem-header' }, [
					E('div', { 'class': 'modem-title-area' }, [
						E('div', { 'class': 'modem-icon-wrap' }, '📶'),
						E('div', {}, [
							E('h2', { 'class': 'modem-title' }, _('4G 龙尚模组电源管理')),
							E('p', { 'class': 'modem-subtitle' }, _('LONGSUNG U9300C SXNC 全网通 4G Cat.4 模块'))
						])
					]),
					badgeContainer
				]),

				// 核心一体化滑动开关行
				E('div', { 'class': 'modem-switch-section' }, [
					E('div', { 'class': 'modem-switch-text' }, [
						E('div', { 'class': 'modem-switch-label' }, [
							_('4G 模组主电源'),
							E('span', { 'style': 'font-size:12px; font-weight:normal; color:#64748b;' }, _('(即点即生效 + 自动保存)'))
						]),
						statusDescEl
					]),
					E('label', { 'class': 'cbi-switch-wrap' }, [
						switchInput,
						E('span', { 'class': 'cbi-switch-slider' })
					])
				]),

				// 硬件参数面板
				E('div', { 'class': 'modem-grid' }, [
					E('div', { 'class': 'modem-grid-item' }, [
						E('div', { 'class': 'modem-grid-lbl' }, _('设备型号')),
						E('div', { 'class': 'modem-grid-val' }, status.product || 'LONGSUNG U9300C SXNC')
					]),
					E('div', { 'class': 'modem-grid-item' }, [
						E('div', { 'class': 'modem-grid-lbl' }, _('硬件识别码 (VID:PID)')),
						E('div', { 'class': 'modem-grid-val' }, status.vendor || '1c9e:9b3c')
					]),
					E('div', { 'class': 'modem-grid-item' }, [
						E('div', { 'class': 'modem-grid-lbl' }, _('USB 挂载总线')),
						E('div', { 'class': 'modem-grid-val' }, 'USB 1-1 (xHCI Host)')
					]),
					E('div', { 'class': 'modem-grid-item' }, [
						E('div', { 'class': 'modem-grid-lbl' }, _('通道与接口状态')),
						portsValEl
					])
				]),

				// 底部温馨提示
				E('div', { 'class': 'modem-tip-box' }, [
					E('strong', {}, _('💡 省电与机制说明：')),
					_('关闭主开关即撤销模组在 USB 总线上的授权（authorized=0）。内核随即销毁全部串口与网络接口，不再向模组发送任何请求，模组按 USB 规范进入深度挂起，射频停止发射，待机功耗下降、发热减轻。需注意：本机主板未设计可软件控制的模组供电开关，金手指 3.3V 仍带电，属逻辑关断而非物理断电。每次开关都会自动记住设置，开机自启策略保持同步。')
				])
			])
		]);

		return viewNode;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});