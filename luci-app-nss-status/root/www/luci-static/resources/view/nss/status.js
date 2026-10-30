'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

const callNssStats = rpc.declare({
	object: 'luci.nss',
	method: 'getStats',
	expect: {}
});

function formatBytes(bytes) {
	if (bytes == null || isNaN(bytes) || bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatPkts(pkts) {
	if (pkts == null || isNaN(pkts)) return '0';
	return Number(pkts).toLocaleString();
}

return view.extend({
	load: function() {
		return L.resolveDefault(callNssStats(), {});
	},

	render: function(stats) {
		const self = this;

		const view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('NSS 硬件加速监控')),
			E('div', { 'class': 'cbi-map-descr' }, _('实时监控高通 IPQ8064 NSS 双核协处理器及 ECM 网络连接管理器的芯片级硬件卸载状态。')),

			// 1. ECM 加速状态卡片
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('ECM 硬件加速状态 (Flow Offloading)')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'table', 'id': 'nss_ecm_table' }, [
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left', 'style': 'width:33%' }, _('硬件加速状态')),
							E('div', { 'class': 'td left', 'id': 'ecm_status_badge' })
						]),
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left' }, _('当前硬件加速连接数')),
							E('div', { 'class': 'td left', 'id': 'ecm_accel_conns' })
						]),
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left' }, _('协议分流统计')),
							E('div', { 'class': 'td left', 'id': 'ecm_proto_split' })
						]),
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td left' }, _('硬件卸载率')),
							E('div', { 'class': 'td left', 'id': 'ecm_offload_bar' })
						])
					])
				])
			]),

			// 2. NSS 核心负载
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('NSS 协处理器核心负载 (NSS Cores CPU Load)')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'table', 'id': 'nss_core_table' })
				])
			]),

			// 3. 硬件数据面吞吐
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('硬件数据面吞吐统计 (NSS Data Path Throughput)')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('引擎模块')),
							E('th', { 'class': 'th' }, _('硬件接收 (RX)')),
							E('th', { 'class': 'th' }, _('硬件发送 (TX)')),
							E('th', { 'class': 'th' }, _('流表操作 / 备注'))
						]),
						E('tbody', { 'id': 'nss_throughput_body' })
					])
				])
			]),

			// 4. 无线与虚拟接口加速统计
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('无线与虚拟接口统计 (Virt IF Stats)')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('虚接口编号 (IF Num)')),
							E('th', { 'class': 'th' }, _('硬件接收 (RX)')),
							E('th', { 'class': 'th' }, _('硬件发送 (TX)')),
							E('th', { 'class': 'th' }, _('丢包 (Dropped)'))
						]),
						E('tbody', { 'id': 'nss_virtif_body' })
					])
				])
			]),

			// 5. 驱动与硬件队列健康
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('NSS 驱动与队列健康 (Driver & Queue Health)')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'table', 'id': 'nss_health_table' })
				])
			])
		]);

		// 更新 DOM 数据函数
		function updateData(data) {
			if (!data || !data.supported) {
				const badge = document.getElementById('ecm_status_badge');
				if (badge) badge.innerHTML = '<span class="badge warning">' + (data?.message || 'NSS 未激活') + '</span>';
				return;
			}

			// 1. ECM 状态
			const badge = document.getElementById('ecm_status_badge');
			const accelConns = document.getElementById('ecm_accel_conns');
			const protoSplit = document.getElementById('ecm_proto_split');
			const offloadBar = document.getElementById('ecm_offload_bar');

			const total = data.ecm?.total_conns || 0;
			const accel = data.ecm?.accelerated || 0;
			const tcp = data.ecm?.tcp_accelerated || 0;
			const udp = data.ecm?.udp_accelerated || 0;
			const nonPorted = data.ecm?.non_ported_accelerated || 0;
			const pending = data.ecm?.pending || 0;
			const pct = total > 0 ? Math.min(100, Math.round((accel / total) * 100)) : 0;

			if (badge) {
				badge.innerHTML = accel > 0
					? '<span class="badge" style="background:#28a745;color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold;">● 满血加速中 (ACTIVE)</span>'
					: '<span class="badge" style="background:#ffc107;color:#000;padding:3px 8px;border-radius:4px;">○ 待机就绪 (STANDBY)</span>';
			}

			if (accelConns) {
				accelConns.innerHTML = '<strong>' + accel + '</strong> / ' + total + ' 条活跃连接 (等待加速: ' + pending + ')';
			}

			if (protoSplit) {
				protoSplit.innerHTML = 'TCP 加速: <strong>' + tcp + '</strong> | UDP 加速: <strong>' + udp + '</strong>' + (nonPorted > 0 ? (' | 其它: <strong>' + nonPorted + '</strong>') : '');
			}

			if (offloadBar) {
				offloadBar.innerHTML = '<div style="background:#e9ecef;border-radius:4px;height:20px;overflow:hidden;position:relative;width:240px;display:inline-block;vertical-align:middle;margin-right:10px;">' +
					'<div style="background:#17a2b8;height:100%;width:' + pct + '%;transition:width 0.4s ease;"></div>' +
					'<span style="position:absolute;left:0;top:0;width:100%;text-align:center;font-size:12px;line-height:20px;font-weight:bold;color:#333;">' + pct + '%</span>' +
					'</div>';
			}

			// 2. NSS 核心负载
			const coreTable = document.getElementById('nss_core_table');
			if (coreTable) {
				let coreHtml = '';
				const cores = data.cpu_load || [];
				if (cores.length === 0) {
					coreHtml = '<div class="tr"><div class="td left">暂无核心负载数据</div></div>';
				} else {
					for (let i = 0; i < cores.length; i++) {
						const c = cores[i];
						coreHtml += '<div class="tr">' +
							'<div class="td left" style="width:25%">NSS Core ' + c.core + ' 负载</div>' +
							'<div class="td left">' +
							'当前均值: <strong>' + c.avg + '%</strong> (最低: ' + c.min + '%, 峰值: ' + c.max + '%) ' +
							'<div style="background:#e9ecef;border-radius:4px;height:14px;overflow:hidden;width:180px;display:inline-block;vertical-align:middle;margin-left:10px;">' +
							'<div style="background:' + (c.avg > 80 ? '#dc3545' : (c.avg > 50 ? '#ffc107' : '#28a745')) + ';height:100%;width:' + c.avg + '%;"></div>' +
							'</div>' +
							'</div></div>';
					}
				}
				coreTable.innerHTML = coreHtml;
			}

			// 3. 数据面吞吐
			const tpBody = document.getElementById('nss_throughput_body');
			if (tpBody) {
				const ip4 = data.ipv4 || {};
				const ip6 = data.ipv6 || {};
				const eth = data.eth_rx || {};

				let tpHtml = '';
				// IPv4
				tpHtml += '<tr class="tr">' +
					'<td class="td left"><strong>NSS IPv4 加速引擎</strong></td>' +
					'<td class="td left">' + formatBytes(ip4.rx_bytes) + ' <br><small class="text-muted">' + formatPkts(ip4.rx_packets) + ' pkts</small></td>' +
					'<td class="td left">' + formatBytes(ip4.tx_bytes) + ' <br><small class="text-muted">' + formatPkts(ip4.tx_packets) + ' pkts</small></td>' +
					'<td class="td left">建流请求: ' + (ip4.create_requests || 0) + ' <br><small class="text-muted">拆流: ' + (ip4.destroy_requests || 0) + '</small></td>' +
					'</tr>';

				// IPv6
				tpHtml += '<tr class="tr">' +
					'<td class="td left"><strong>NSS IPv6 加速引擎</strong></td>' +
					'<td class="td left">' + formatBytes(ip6.rx_bytes) + ' <br><small class="text-muted">' + formatPkts(ip6.rx_packets) + ' pkts</small></td>' +
					'<td class="td left">' + formatBytes(ip6.tx_bytes) + ' <br><small class="text-muted">' + formatPkts(ip6.tx_packets) + ' pkts</small></td>' +
					'<td class="td left">双栈加速支持</td>' +
					'</tr>';

				// GMAC / 以太网物理层
				tpHtml += '<tr class="tr">' +
					'<td class="td left"><strong>GMAC / 物理网络直通</strong></td>' +
					'<td class="td left">' + formatBytes(eth.rx_bytes) + ' <br><small class="text-muted">' + formatPkts(eth.rx_packets) + ' pkts</small></td>' +
					'<td class="td left">' + formatBytes(eth.tx_bytes) + ' <br><small class="text-muted">' + formatPkts(eth.tx_packets) + ' pkts</small></td>' +
					'<td class="td left">物理网卡硬件 DMA 直通</td>' +
					'</tr>';

				tpBody.innerHTML = tpHtml;
			}

			// 4. 虚接口
			const vifBody = document.getElementById('nss_virtif_body');
			if (vifBody) {
				const vifs = data.virt_if || [];
				let vifHtml = '';
				if (vifs.length === 0) {
					vifHtml = '<tr class="tr"><td colspan="4" class="td center"><em>暂无活动的虚接口</em></td></tr>';
				} else {
					for (let i = 0; i < vifs.length; i++) {
						const v = vifs[i];
						vifHtml += '<tr class="tr">' +
							'<td class="td left"><strong>virt_if #' + v.if_num + '</strong></td>' +
							'<td class="td left">' + formatBytes(v.rx_bytes) + ' <small class="text-muted">(' + formatPkts(v.rx_packets) + ' pkts)</small></td>' +
							'<td class="td left">' + formatBytes(v.tx_bytes) + ' <small class="text-muted">(' + formatPkts(v.tx_packets) + ' pkts)</small></td>' +
							'<td class="td left">' + (v.rx_dropped || 0) + '</td>' +
							'</tr>';
					}
				}
				vifBody.innerHTML = vifHtml;
			}

			// 5. 驱动健康
			const healthTable = document.getElementById('nss_health_table');
			if (healthTable) {
				const drv = data.drv || {};
				const bufErr = drv.nbuf_alloc_errors || 0;
				const pageErr = drv.paged_buf_alloc_errors || 0;
				const q0 = drv.tx_queue_full_0 || 0;
				const q1 = drv.tx_queue_full_1 || 0;

				healthTable.innerHTML = '<div class="tr">' +
					'<div class="td left" style="width:25%">虚拟接收缓冲数</div>' +
					'<div class="td left">' + (drv.virtual_rx_buffers || 0) + '</div>' +
					'</div>' +
					'<div class="tr">' +
					'<div class="td left">缓冲区分配错误 (Errors)</div>' +
					'<div class="td left">' + (bufErr === 0 && pageErr === 0
						? '<span style="color:#28a745;font-weight:bold;">✔ 0 (完全健康)</span>'
						: '<span style="color:#dc3545;font-weight:bold;">✖ ' + (bufErr + pageErr) + '</span>') +
					'</div></div>' +
					'<div class="tr">' +
					'<div class="td left">发送队列满阻塞 (Queue Full)</div>' +
					'<div class="td left">' + (q0 === 0 && q1 === 0
						? '<span style="color:#28a745;font-weight:bold;">✔ 0 (无丢包拥塞)</span>'
						: '<span style="color:#ffc107;font-weight:bold;">Core0: ' + q0 + ' | Core1: ' + q1 + '</span>') +
					'</div></div>';
			}
		}

		// 初始填充
		updateData(stats);

		// 启动 2 秒轮询自动刷新
		poll.add(function() {
			return callNssStats().then(function(res) {
				updateData(res);
			});
		}, 2);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
