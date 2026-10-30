#!/usr/bin/env ucode
'use strict';
import { readfile, access } from 'fs';

function to_int(v) {
	let n = int(v);
	return (n != null) ? n : 0;
}

function parse_key_value(content) {
	let res = {};
	if (!content) return res;
	let lines = split(content, '\n');
	for (let i = 0; i < length(lines); i++) {
		let line = trim(lines[i]);
		let c1 = substr(line, 0, 1);
		if (!line || c1 == '#' || c1 == '_' || c1 == '<') continue;
		let eq = index(line, '=');
		if (eq > 0) {
			let k = trim(substr(line, 0, eq));
			let rem = trim(substr(line, eq + 1));
			let space = index(rem, ' ');
			let v_str = (space > 0) ? substr(rem, 0, space) : rem;
			let v_tab = index(v_str, '\t');
			if (v_tab > 0) v_str = substr(v_str, 0, v_tab);
			let n = int(v_str);
			if (n != null) {
				res[k] = n;
			}
		}
	}
	return res;
}

function parse_cpu_load(content) {
	let cores = [];
	if (!content) return cores;
	let lines = split(content, '\n');
	let cur_core = null;
	for (let i = 0; i < length(lines); i++) {
		let line = trim(lines[i]);
		let m_core = match(line, /^Core\s+([0-9]+):/);
		if (m_core) {
			cur_core = { core: to_int(m_core[1]), min: 0, avg: 0, max: 0 };
			continue;
		}
		let m_val = match(line, /^([0-9]+)%\s+([0-9]+)%\s+([0-9]+)%/);
		if (m_val && cur_core) {
			cur_core.min = to_int(m_val[1]);
			cur_core.avg = to_int(m_val[2]);
			cur_core.max = to_int(m_val[3]);
			push(cores, cur_core);
			cur_core = null;
		}
	}
	return cores;
}

function parse_virt_if(content) {
	let list = [];
	if (!content) return list;
	let lines = split(content, '\n');
	let cur = null;
	for (let i = 0; i < length(lines); i++) {
		let s = trim(lines[i]);
		let m_st = match(s, /^if_num\s+([0-9]+)\s+stats\s+start:/);
		if (m_st) {
			cur = { if_num: to_int(m_st[1]) };
			continue;
		}
		let m_end = match(s, /^if_num\s+([0-9]+)\s+stats\s+end:/);
		if (m_end && cur) {
			push(list, cur);
			cur = null;
			continue;
		}
		if (cur) {
			let eq = index(s, '=');
			if (eq > 0) {
				let k = trim(substr(s, 0, eq));
				let rem = trim(substr(s, eq + 1));
				let space = index(rem, ' ');
				let v_str = (space > 0) ? substr(rem, 0, space) : rem;
				let v_tab = index(v_str, '\t');
				if (v_tab > 0) v_str = substr(v_str, 0, v_tab);
				let n = int(v_str);
				if (n != null) {
					cur[k] = n;
				}
			}
		}
	}
	return list;
}

function get_nss_stats() {
	if (!access('/sys/kernel/debug/qca-nss-drv/stats')) {
		return { supported: false, message: 'NSS debugfs stats not available' };
	}

	let cpu_load = parse_cpu_load(readfile('/sys/kernel/debug/qca-nss-drv/stats/cpu_load_ubi'));
	let ipv4_kv = parse_key_value(readfile('/sys/kernel/debug/qca-nss-drv/stats/ipv4'));
	let ipv6_kv = parse_key_value(readfile('/sys/kernel/debug/qca-nss-drv/stats/ipv6'));
	let eth_rx_kv = parse_key_value(readfile('/sys/kernel/debug/qca-nss-drv/stats/eth_rx'));
	let drv_kv = parse_key_value(readfile('/sys/kernel/debug/qca-nss-drv/stats/drv'));
	let virt_list = parse_virt_if(readfile('/sys/kernel/debug/qca-nss-drv/stats/virt_if'));

	let ecm_total_conn = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_db/connection_count') || '0'));
	let ecm_accel = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_nss_ipv4/accelerated_count') || '0'));
	let ecm_tcp = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_nss_ipv4/tcp_accelerated_count') || '0'));
	let ecm_udp = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_nss_ipv4/udp_accelerated_count') || '0'));
	let ecm_non_ported = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_nss_ipv4/non_ported_accelerated_count') || '0'));
	let ecm_pending = to_int(trim(readfile('/sys/kernel/debug/ecm/ecm_nss_ipv4/pending_accel_count') || '0'));

	return {
		supported: true,
		cpu_load: cpu_load,
		ecm: {
			total_conns: ecm_total_conn,
			accelerated: ecm_accel,
			tcp_accelerated: ecm_tcp,
			udp_accelerated: ecm_udp,
			non_ported_accelerated: ecm_non_ported,
			pending: ecm_pending
		},
		ipv4: {
			rx_packets: ipv4_kv.ipv4_rx_pkts,
			rx_bytes: (ipv4_kv.ipv4_rx_byts != null) ? ipv4_kv.ipv4_rx_byts : ipv4_kv.ipv4_rx_bytes,
			tx_packets: ipv4_kv.ipv4_tx_pkts,
			tx_bytes: (ipv4_kv.ipv4_tx_byts != null) ? ipv4_kv.ipv4_tx_byts : ipv4_kv.ipv4_tx_bytes,
			create_requests: ipv4_kv.ipv4_create_requests,
			destroy_requests: ipv4_kv.ipv4_destroy_requests
		},
		ipv6: {
			rx_packets: ipv6_kv.ipv6_rx_pkts,
			rx_bytes: (ipv6_kv.ipv6_rx_byts != null) ? ipv6_kv.ipv6_rx_byts : ipv6_kv.ipv6_rx_bytes,
			tx_packets: ipv6_kv.ipv6_tx_pkts,
			tx_bytes: (ipv6_kv.ipv6_tx_byts != null) ? ipv6_kv.ipv6_tx_byts : ipv6_kv.ipv6_tx_bytes
		},
		eth_rx: {
			rx_packets: eth_rx_kv.eth_rx_rx_pkts,
			rx_bytes: eth_rx_kv.eth_rx_rx_byts,
			tx_packets: eth_rx_kv.eth_rx_tx_pkts,
			tx_bytes: eth_rx_kv.eth_rx_tx_byts
		},
		virt_if: virt_list,
		drv: {
			virtual_rx_buffers: drv_kv.drv_rx_buffers_virtual,
			nbuf_alloc_errors: drv_kv.drv_nbuf_alloc_errors,
			paged_buf_alloc_errors: drv_kv.drv_paged_buf_alloc_errors,
			tx_queue_full_0: drv_kv['drv_tx_queue_full[0]'],
			tx_queue_full_1: drv_kv['drv_tx_queue_full[1]']
		}
	};
}

const methods = {
	getStats: {
		call: function() {
			return get_nss_stats();
		}
	}
};

return { "luci.nss": methods };
