#!/usr/bin/env ucode

'use strict';

import { readfile, writefile, stat } from 'fs';

const CONF      = '/etc/cfddns.conf';
const SCRIPT    = '/etc/ddns-cf.sh';
const CRONFILE  = '/etc/crontabs/root';
const MARK      = 'ddns-cf';
const CF_API    = 'https://api.cloudflare.com/client/v4';
const RC_FILE   = '/tmp/cfddns.rc';

// 关闭插件时把维护记录指向的地址（可在页面上修改）
// 默认 127.0.0.1：关闭后域名解析到本机回环，外部无法访问。
// 说明：取值为 IPv4；也可填 IPv6（记录类型需为 AAAA 才生效）。
const PARK_IP_DEFAULT = '127.0.0.1';

// 缓存文件
const CACHE_PROBE = '/tmp/cfddns.cache.probe';
const CACHE_CF    = '/tmp/cfddns.cache.cf';
const CACHE_ZONES = '/tmp/cfddns.cache.zones';

// 缓存有效期（秒）
const TTL_PROBE = 25;
const TTL_CF    = 30;
const TTL_ZONES = 120;

// 唯一临时文件序号（同进程内递增，防并发互相覆盖）
let _seq = 0;

function tmppath(prefix) {
	_seq++;
	return sprintf('/tmp/%s.%d.%d', prefix, time(), _seq);
}

// ---------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------

// 执行命令并返回 stdout。每次用唯一临时文件，避免并发调用互相覆盖。
function sh(cmd) {
	let f = tmppath('cfddns.out');
	system(cmd + ' > ' + f + ' 2>&1');
	let out = '';
	try {
		out = readfile(f) || '';
	} catch (e) {}
	system('rm -f ' + f + ' >/dev/null 2>&1');
	return trim(out);
}

// ---------------------------------------------------------------------
// 缓存
// ---------------------------------------------------------------------

function cache_get(path, ttl) {
	let raw = '';
	try {
		raw = readfile(path) || '';
	} catch (e) {
		return null;
	}

	let nl = index(raw, '\n');
	if (nl <= 0)
		return null;

	let ts = int(substr(raw, 0, nl)) || 0;
	if (ts <= 0)
		return null;
	if (time() - ts > ttl)
		return null;

	let body = substr(raw, nl + 1);
	if (length(body) == 0)
		return null;

	let v = null;
	try {
		v = json(body);
	} catch (e) {
		return null;
	}
	return v;
}

function cache_set(path, val) {
	let s = '';
	try {
		s = sprintf('%J', val);
	} catch (e) {
		return;
	}
	try {
		writefile(path, sprintf('%d\n%s', time(), s));
	} catch (e) {}
}

function cache_del(path) {
	system('rm -f ' + path + ' >/dev/null 2>&1');
}

// ---------------------------------------------------------------------
// 配置读写
// ---------------------------------------------------------------------

// 解析 key='value' 形式的配置文件（不 eval，纯字符串处理）
function load_conf() {
	let cfg = {};
	let raw = '';
	try {
		raw = readfile(CONF) || '';
	} catch (e) {
		return cfg;
	}

	let lines = split(raw, '\n');
	for (let i = 0; i < length(lines); i++) {
		let line = trim(lines[i]);
		if (length(line) == 0 || substr(line, 0, 1) == '#')
			continue;

		let eq = index(line, '=');
		if (eq <= 0)
			continue;

		let k = trim(substr(line, 0, eq));
		let v = trim(substr(line, eq + 1));

		// 去掉两端单/双引号
		let n = length(v);
		if (n >= 2) {
			let c1 = substr(v, 0, 1);
			let c2 = substr(v, n - 1, 1);
			if ((c1 == "'" && c2 == "'") || (c1 == '"' && c2 == '"'))
				v = substr(v, 1, n - 2);
		}
		cfg[k] = v;
	}
	return cfg;
}

// 配置值清洗：去掉换行制表符，剔除单引号
// 注：load_conf 只按两端引号剥离、不处理转义，所以值里绝不能留单引号，
//     否则回读会错位。配置项（Token/域名/接口名）本身也不需要单引号。
// 注：replace 不带 g 只替换首个匹配，必须加 g。
function sh_quote(v) {
	v = replace('' + v, /[\r\n\t]/g, '');
	return replace(v, /'/g, '');
}

// 按 key 就地改写配置，保留原有注释和顺序；新 key 追加到末尾
function save_conf(patch) {
	let raw = '';
	try {
		raw = readfile(CONF) || '';
	} catch (e) {}

	let lines = (length(raw) > 0) ? split(raw, '\n') : [];
	let seen = {};

	for (let i = 0; i < length(lines); i++) {
		let t = trim(lines[i]);
		if (length(t) == 0 || substr(t, 0, 1) == '#')
			continue;
		let eq = index(t, '=');
		if (eq <= 0)
			continue;
		let k = trim(substr(t, 0, eq));
		if (patch[k] != null) {
			lines[i] = k + "='" + sh_quote(patch[k]) + "'";
			seen[k] = true;
		}
	}

	for (let k in patch) {
		if (!seen[k])
			push(lines, k + "='" + sh_quote(patch[k]) + "'");
	}

	try {
		writefile(CONF, join('\n', lines) + '\n');
	} catch (e) {
		return false;
	}

	system('chmod 600 ' + CONF + ' >/dev/null 2>&1');
	return true;
}

// Token 脱敏显示
function mask_token(tk) {
	let n = length(tk || '');
	if (n == 0)
		return '';
	if (n < 16)
		return '****';
	return substr(tk, 0, 8) + '…' + substr(tk, n - 4, 4);
}

// 主机名 → 完整域名
function to_fqdn(name, zone) {
	name = trim(name || '');
	zone = trim(zone || '');
	if (length(name) == 0)
		return '';
	if (name == '@')
		return zone;
	if (length(zone) == 0)
		return name;
	if (name == zone)
		return name;

	// 已经带上了 zone 后缀就直接用（ucode 没有 ends_with，手工比对）
	let suffix = '.' + zone;
	let nl = length(name), sl = length(suffix);
	if (nl > sl && substr(name, nl - sl, sl) == suffix)
		return name;

	return name + '.' + zone;
}

// ---------------------------------------------------------------------
// Cloudflare API
// ---------------------------------------------------------------------

// 通用 Cloudflare API 调用
// 返回 { ok: true, data: ... } 或 { ok: false, err: '...', err_code: n }
function cf_call(method, path, body) {
	let cfg = load_conf();
	let tk = cfg.CF_TOKEN || '';
	if (length(tk) == 0)
		return { ok: false, err: '未配置 API Token，请先在页面上方填写并保存' };

	// Token 只允许字母数字和 - _ ，防止命令注入
	if (!match(tk, /^[A-Za-z0-9_-]+$/))
		return { ok: false, err: 'Token 含非法字符，请检查是否复制完整' };

	let cmd = 'curl -s --max-time 20 -X ' + method + ' "' + CF_API + path + '"' +
	          ' -H "Authorization: Bearer ' + tk + '"' +
	          ' -H "Content-Type: application/json"';

	let bf = null;
	if (body != null) {
		bf = tmppath('cfddns_body');
		try {
			writefile(bf, body);
			cmd += ' --data @' + bf;
		} catch (e) {
			return { ok: false, err: '构造请求体失败' };
		}
	}

	let raw = sh(cmd);
	if (bf != null)
		system('rm -f ' + bf + ' >/dev/null 2>&1');

	if (length(raw) == 0)
		return { ok: false, err: 'Cloudflare 无响应（网络不通或 Token 无效）' };

	let r = json(raw);
	if (r == null)
		return { ok: false, err: 'Cloudflare 响应解析失败' };

	if (!r.success) {
		let msg = 'API 调用失败';
		let code = 0;
		if (r.errors != null && length(r.errors) > 0) {
			if (r.errors[0].message != null)
				msg = r.errors[0].message;
			if (r.errors[0].code != null)
				code = r.errors[0].code;
		}
		return { ok: false, err: msg, err_code: code };
	}

	return { ok: true, data: r.result };
}

// ---------------------------------------------------------------------
// 状态采集
// ---------------------------------------------------------------------

// 读 WAN 接口上的本地 IPv4（注意：本机是运营商 NAT 内网地址）
function get_iface_ip(iface) {
	if (!iface || length(iface) == 0)
		return '';
	let out = sh('ip -4 addr show dev ' + sh_quote(iface) + ' 2>/dev/null');
	let m = match(out, /inet ([0-9.]+)/);
	return m ? m[1] : '';
}

// 只探测，不写 CF（带缓存，force=true 强制刷新）
function probe_ip(force) {
	if (!force) {
		let c = cache_get(CACHE_PROBE, TTL_PROBE);
		if (c != null && c.ip != null) {
			c.cached = true;
			return c;
		}
	}

	let out = sh(SCRIPT + ' --probe 2>/dev/null');
	let ip = '', src = '', agree = 0;
	let lines = split(out, '\n');
	for (let i = 0; i < length(lines); i++) {
		let l = lines[i];
		let eq = index(l, '=');
		if (eq <= 0)
			continue;
		let k = substr(l, 0, eq);
		let v = substr(l, eq + 1);
		if (k == 'IP')    ip = v;
		if (k == 'SRC')   src = v;
		if (k == 'AGREE') agree = int(v) || 0;
	}

	let res = { ip: ip, src: src, agree: agree, cached: false };
	// 只有探测成功才缓存，失败不缓存（避免缓存住坏结果）
	if (length(ip) > 0)
		cache_set(CACHE_PROBE, res);
	return res;
}

// 读 Cloudflare 侧记录（带缓存，force=true 强制刷新）
function get_cf_state(force) {
	if (!force) {
		let c = cache_get(CACHE_CF, TTL_CF);
		if (c != null && c.ok != null) {
			c.cached = true;
			return c;
		}
	}

	let out = sh(SCRIPT + ' --status 2>/dev/null');
	let st = { ok: false, ip: '', rec_id: '' };
	let lines = split(out, '\n');
	for (let i = 0; i < length(lines); i++) {
		let l = lines[i];
		let eq = index(l, '=');
		if (eq <= 0)
			continue;
		let k = substr(l, 0, eq);
		let v = substr(l, eq + 1);
		if (k == 'CF_OK')   st.ok = (v == 'true');
		if (k == 'CF_IP')   st.ip = v;
		if (k == 'REC_ID')  st.rec_id = v;
	}

	if (st.ok)
		cache_set(CACHE_CF, st);
	return st;
}

function get_last() {
	let s = '';
	try {
		s = trim(readfile('/tmp/cfddns.last') || '');
	} catch (e) {}
	return s;
}

// ---------------------------------------------------------------------
// cron 管理
// ---------------------------------------------------------------------

function get_minutes(l) {
	if (index(l, '* * * * *') > -1)
		return 1;
	let p = index(l, '*/');
	if (p < 0)
		return 0;
	let rest = substr(l, p + 2);
	let num = '';
	for (let i = 0; i < length(rest); i++) {
		let ch = substr(rest, i, 1);
		if (ch >= '0' && ch <= '9')
			num += ch;
		else
			break;
	}
	return length(num) > 0 ? int(num) : 0;
}

function get_cron_state() {
	let raw = sh('cat ' + CRONFILE + ' 2>/dev/null');
	let lines = split(raw, '\n');
	for (let i = 0; i < length(lines); i++) {
		let l = lines[i];
		if (length(l) > 0 && index(l, MARK) > -1) {
			let enabled = !(index(l, '#') == 0);
			return { enabled: enabled, minutes: get_minutes(l), line: l };
		}
	}
	return { enabled: false, minutes: 0, line: '' };
}

function set_cron(enabled, minutes) {
	if (minutes < 1)  minutes = 1;
	if (minutes > 60) minutes = 60;

	let sch = (minutes == 1) ? '*' : ('*/' + minutes);
	let line = sch + ' * * * * ' + SCRIPT;
	if (!enabled)
		line = '#' + line;

	// 先删旧行再追加，避免重复
	system('sed -i \'/' + MARK + '/d\' ' + CRONFILE + ' 2>/dev/null');
	system('echo \'' + line + '\' >> ' + CRONFILE);
	system('/etc/init.d/cron reload >/dev/null 2>&1');
	return get_cron_state();
}

// ---------------------------------------------------------------------
// 插件总开关
// ---------------------------------------------------------------------

// 开关状态：配置文件没有 ENABLED 字段时按「启用」处理（向后兼容老配置）
function is_enabled() {
	let cfg = load_conf();
	return (cfg.ENABLED == 'false') ? false : true;
}

// 校验 IPv4（逐段 <= 255）
function is_ipv4(s) {
	s = trim(s || '');
	if (!match(s, /^([0-9]{1,3}\.){3}[0-9]{1,3}$/))
		return false;
	let p = split(s, '.');
	for (let i = 0; i < length(p); i++) {
		if (int(p[i]) > 255)
			return false;
	}
	return true;
}

// 当前生效的停靠地址：配置里有就用，没有/非法则回默认值
function get_park_ip() {
	let cfg = load_conf();
	let v = trim(cfg.PARKED_IP || cfg.PARK_IP || '');
	if (is_ipv4(v))
		return v;
	return PARK_IP_DEFAULT;
}

// 查维护目标当前在 CF 上的记录（不走缓存，必须拿实时值）
function fetch_target_record() {
	let cfg = load_conf();
	let zid = trim(cfg.ZONE_ID || '');
	let dom = trim(cfg.DOMAIN || '');
	let typ = trim(cfg.RECORD_TYPE || 'A');

	if (!match(zid, /^[0-9a-fA-F]{32}$/))
		return { ok: false, err: '配置里没有有效的域名 ID（ZONE_ID）' };
	if (length(dom) == 0)
		return { ok: false, err: '配置里没有维护域名（DOMAIN）' };

	let path = '/zones/' + zid + '/dns_records?type=' + typ +
	           '&name=' + dom + '&per_page=1&page=1';
	let r = cf_call('GET', path, null);
	if (!r.ok)
		return { ok: false, err: r.err, err_code: r.err_code || 0 };

	if (r.data == null || length(r.data) == 0)
		return { ok: true, found: false, zone_id: zid, domain: dom, type: typ };

	return {
		ok:      true,
		found:   true,
		zone_id: zid,
		domain:  dom,
		type:    typ,
		rec_id:  r.data[0].id || '',
		content: r.data[0].content || '',
		ttl:     int(r.data[0].ttl) || 120,
		proxied: r.data[0].proxied ? true : false
	};
}

// 关闭插件：停 cron → 把记录改指黑洞地址 → 写 ENABLED=false
// 顺序不能颠倒：cron 还在跑的话 ddns-cf.sh 会把记录 PUT 回真实 IP。
// 任一步失败都回滚，绝不留下「说关了其实还在跑」的错位状态。
function plugin_disable() {
	if (!is_enabled())
		return { ok: true, enabled: false, already: true };

	let prev = get_cron_state();
	let parkIp = get_park_ip();

	// ① 先停 cron
	let c1 = set_cron(false, prev.minutes || 10);
	if (c1.enabled)
		return { ok: false, err: '停用定时任务失败，已中止（未改动 DNS 记录）' };

	// ② 把维护记录改指向黑洞地址
	let t = fetch_target_record();
	if (!t.ok) {
		set_cron(prev.enabled, prev.minutes || 10);
		return { ok: false, err: '查询 DNS 记录失败：' + t.err + '，已恢复定时任务' };
	}

	let parked = false;
	if (t.found) {
		let body = sprintf(
			'{"type":"%s","name":"%s","content":"%s","ttl":%d,"proxied":%s}',
			t.type, t.domain, parkIp, t.ttl, (t.proxied ? 'true' : 'false'));
		let r = cf_call('PUT', '/zones/' + t.zone_id + '/dns_records/' + t.rec_id, body);
		if (!r.ok) {
			set_cron(prev.enabled, prev.minutes || 10);
			return { ok: false, err: '修改 DNS 记录失败：' + r.err + '，已恢复定时任务', err_code: r.err_code || 0 };
		}
		parked = true;
	}

	// ③ 落盘开关状态
	let ok = save_conf({
		ENABLED:           'false',
		PARKED_IP:         parkIp,
		ENABLED_PREV_CRON: prev.enabled ? 'true' : 'false',
		ENABLED_PREV_MINS: sprintf('%d', prev.minutes || 10)
	});
	if (!ok) {
		// 配置写不进去 → 把记录和 cron 都恢复
		if (parked) {
			let rb = sprintf(
				'{"type":"%s","name":"%s","content":"%s","ttl":%d,"proxied":%s}',
				t.type, t.domain, t.content, t.ttl, (t.proxied ? 'true' : 'false'));
			cf_call('PUT', '/zones/' + t.zone_id + '/dns_records/' + t.rec_id, rb);
		}
		set_cron(prev.enabled, prev.minutes || 10);
		return { ok: false, err: '写入配置失败，已回滚' };
	}

	cache_del(CACHE_CF);
	return {
		ok:      true,
		enabled: false,
		domain:  t.domain,
		old_ip:  t.found ? t.content : '',
		park_ip: parkIp,
		had_record: t.found
	};
}

// 开启插件：写 ENABLED=true → 立即同步一次 → 按关闭前的状态恢复 cron
function plugin_enable() {
	if (is_enabled())
		return { ok: true, enabled: true, already: true };

	let cfg = load_conf();
	let prevOn = (cfg.ENABLED_PREV_CRON == 'true');
	let prevMin = int(cfg.ENABLED_PREV_MINS) || 10;
	if (prevMin < 1)  prevMin = 1;
	if (prevMin > 60) prevMin = 60;

	// ① 先落盘启用标志，否则 ddns-cf.sh 会以「插件已关闭」拒绝执行
	let ok = save_conf({ ENABLED: 'true' });
	if (!ok)
		return { ok: false, err: '写入配置失败' };

	// ② 立即同步一次（记录当前是黑洞地址，会被改回真实 IP）
	system('rm -f ' + RC_FILE + ' >/dev/null 2>&1');
	system(SCRIPT + ' >/dev/null 2>&1; echo $? > ' + RC_FILE);
	let code = 0;
	try {
		code = int(trim(readfile(RC_FILE) || '0'));
	} catch (e) {}

	cache_del(CACHE_CF);
	cache_del(CACHE_PROBE);

	// ③ 恢复关闭前的 cron 状态（关之前就没开的话，打开后也不自动开）
	let c = get_cron_state();
	if (prevOn && !c.enabled)
		c = set_cron(true, prevMin);

	return {
		ok:        true,
		enabled:   true,
		sync_code: code,
		last:      get_last(),
		cron:      c
	};
}

// ---------------------------------------------------------------------
// RPC 方法
// ---------------------------------------------------------------------

const methods = {
	// 快速状态：只读本地文件，毫秒级返回。页面首屏用这个。
	status_quick: {
		call: function(request) {
			let cfg = load_conf();
			let iface = cfg.WAN_IFACE || 'pppoe-wan';

			return {
				quick:         true,
				enabled:       is_enabled(),
				parked_ip:     cfg.PARKED_IP || '',
				park_ip:       get_park_ip(),
				domain:        cfg.DOMAIN || '',
				record_type:   cfg.RECORD_TYPE || 'A',
				iface:         iface,
				iface_ip:      get_iface_ip(iface),
				has_token:     length(cfg.CF_TOKEN || '') > 0,
				script_exists: stat(SCRIPT) != null,
				conf_exists:   stat(CONF) != null,
				cron:          get_cron_state(),
				last:          get_last()
			};
		}
	},

	// 完整状态：探测公网 + 查 CF（带缓存，force=true 强制刷新）
	status: {
		args: { force: false },
		call: function(request) {
			let force = (request.args && request.args.force) ? true : false;

			let cfg = load_conf();
			let cf  = get_cf_state(force);
			let p   = probe_ip(force);
			let iface = cfg.WAN_IFACE || 'pppoe-wan';

			let match_ip = (length(p.ip) > 0 && length(cf.ip) > 0 && p.ip == cf.ip);

			return {
				quick:         false,
				enabled:       is_enabled(),
				parked_ip:     cfg.PARKED_IP || '',
				park_ip:       get_park_ip(),
				domain:        cfg.DOMAIN || '',
				record_type:   cfg.RECORD_TYPE || 'A',
				iface:         iface,
				iface_ip:      get_iface_ip(iface),
				wan_ip:        p.ip,
				probe_src:     p.src,
				probe_agree:   p.agree,
				probe_cached:  p.cached ? true : false,
				cf_ip:         cf.ip,
				cf_ok:         cf.ok,
				cf_cached:     cf.cached ? true : false,
				rec_id:        cf.rec_id,
				match:         match_ip,
				script_exists: stat(SCRIPT) != null,
				conf_exists:   stat(CONF) != null,
				cron:          get_cron_state(),
				last:          get_last()
			};
		}
	},

	// 只探测，不写 CF —— 给页面「测试探测」按钮用
	probe: {
		args: { force: false },
		call: function(request) {
			let force = (request.args && request.args.force) ? true : false;
			let cfg = load_conf();
			let p = probe_ip(force);
			let iface = cfg.WAN_IFACE || 'pppoe-wan';
			return {
				ip:       p.ip,
				src:      p.src,
				agree:    p.agree,
				cached:   p.cached ? true : false,
				iface:    iface,
				iface_ip: get_iface_ip(iface)
			};
		}
	},

	run_now: {
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			system('rm -f ' + RC_FILE + ' >/dev/null 2>&1');
			system(SCRIPT + ' >/dev/null 2>&1; echo $? > ' + RC_FILE);
			let code = 0;
			try {
				code = int(trim(readfile(RC_FILE) || '0'));
			} catch (e) {}
			// CF 侧记录可能变了，清掉 CF 缓存；探测缓存保留（刚跑过，25 秒内有效）
			cache_del(CACHE_CF);
			return { code: code, last: get_last() };
		}
	},

	set_interval: {
		args: { enabled: false, minutes: 1 },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let enabled = (request.args && request.args.enabled) ? true : false;
			let minutes = (request.args && request.args.minutes) ? int(request.args.minutes) : 1;
			return set_cron(enabled, minutes);
		}
	},

	// 插件总开关
	// 关：停 cron → 记录改指停靠地址 → ENABLED=false
	// 开：ENABLED=true → 立即同步一次（记录自动恢复到真实 IP）→ 恢复 cron
	set_enabled: {
		args: { enabled: true },
		call: function(request) {
			let want = (request.args && request.args.enabled != null)
				? (request.args.enabled ? true : false)
				: true;
			return want ? plugin_enable() : plugin_disable();
		}
	},

	// 设置关闭插件时使用的停靠地址（默认 127.0.0.1）
	// 若当前已处于关闭态，会同时把线上记录改成新地址，做到「改完立即生效」
	set_park_ip: {
		args: { ip: '' },
		call: function(request) {
			let ip = trim((request.args && request.args.ip) || '');
			if (!is_ipv4(ip))
				return { ok: false, err: '不是合法的 IPv4 地址（每段 0-255）' };

			let ok = save_conf({ PARKED_IP: ip });
			if (!ok)
				return { ok: false, err: '写入 /etc/cfddns.conf 失败' };

			// 关闭态下立刻同步到 Cloudflare，否则设置要等到下次关闭才生效
			let applied = false;
			let note = '';
			if (!is_enabled()) {
				let t = fetch_target_record();
				if (!t.ok) {
					note = '已保存，但查询 DNS 记录失败：' + t.err;
				}
				else if (!t.found) {
					note = '已保存（当前没有可更新的解析记录）';
				}
				else if (trim(t.content) == ip) {
					// 线上记录已经就是这个地址，不用再打一次 Cloudflare API
					// （省配额，也避免同值 PUT 把记录 updated_on 刷成新时间）
					applied = true;
				}
				else {
					let body = sprintf(
						'{"type":"%s","name":"%s","content":"%s","ttl":%d,"proxied":%s}',
						t.type, t.domain, ip, t.ttl, (t.proxied ? 'true' : 'false'));
					let r = cf_call('PUT', '/zones/' + t.zone_id + '/dns_records/' + t.rec_id, body);
					if (r.ok) {
						applied = true;
						cache_del(CACHE_CF);
					} else {
						note = '已保存，但更新线上记录失败：' + r.err;
					}
				}
			}

			return { ok: true, ip: ip, applied: applied, note: note };
		}
	},

	// ---------------- 配置读写 ----------------

	// 读当前配置（token 脱敏）
	get_config: {
		call: function(request) {
			let cfg = load_conf();
			return {
				has_token:   length(cfg.CF_TOKEN || '') > 0,
				token_mask:  mask_token(cfg.CF_TOKEN || ''),
				zone_id:     cfg.ZONE_ID || '',
				domain:      cfg.DOMAIN || '',
				record_type: cfg.RECORD_TYPE || 'A',
				ttl:         int(cfg.TTL || 120),
				proxied:     (cfg.PROXIED == 'true'),
				iface:       cfg.WAN_IFACE || 'pppoe-wan',
				sources:     cfg.IP_SOURCES || ''
			};
		}
	},

	// 只保存 Token
	save_token: {
		args: { token: '' },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let tk = trim((request.args && request.args.token) || '');
			if (length(tk) == 0)
				return { ok: false, err: 'Token 不能为空' };
			if (length(tk) < 20)
				return { ok: false, err: 'Token 长度异常（' + length(tk) + ' 字符），请检查是否完整复制' };
			// Cloudflare API Token 只由字母、数字、下划线、连字符组成
			if (!match(tk, /^[A-Za-z0-9_-]+$/))
				return { ok: false, err: 'Token 含非法字符（只允许字母、数字、- 和 _），请重新复制' };

			let ok = save_conf({ CF_TOKEN: tk });
			// 换 Token 后旧缓存全部作废
			cache_del(CACHE_CF);
			cache_del(CACHE_ZONES);
			return { ok: ok, err: ok ? '' : '写入 /etc/cfddns.conf 失败' };
		}
	},

	// 保存其它配置项（不含 token）
	save_config: {
		args: { zone_id: '', domain: '', record_type: '', ttl: 0, proxied: false, iface: '', sources: '' },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let a = request.args || {};
			let patch = {};

			if (a.zone_id != null && length(trim(a.zone_id)) > 0)
				patch.ZONE_ID = trim(a.zone_id);
			if (a.domain != null && length(trim(a.domain)) > 0)
				patch.DOMAIN = trim(a.domain);
			if (a.record_type != null && length(trim(a.record_type)) > 0)
				patch.RECORD_TYPE = trim(a.record_type);
			if (a.ttl != null && int(a.ttl) > 0)
				patch.TTL = sprintf('%d', int(a.ttl));
			if (a.proxied != null)
				patch.PROXIED = a.proxied ? 'true' : 'false';
			if (a.iface != null && length(trim(a.iface)) > 0)
				patch.WAN_IFACE = trim(a.iface);
			if (a.sources != null && length(trim(a.sources)) > 0)
				patch.IP_SOURCES = trim(a.sources);

			if (length(patch) == 0)
				return { ok: false, err: '没有需要保存的字段' };

			let ok = save_conf(patch);
			if (ok)
				cache_del(CACHE_CF);
			return { ok: ok, err: ok ? '' : '写入 /etc/cfddns.conf 失败' };
		}
	},

	// ---------------- Cloudflare 域名与记录 ----------------

	// 列出账号下所有域名（Zone），带缓存
	list_zones: {
		args: { force: false },
		call: function(request) {
			let force = (request.args && request.args.force) ? true : false;

			if (!force) {
				let c = cache_get(CACHE_ZONES, TTL_ZONES);
				if (c != null && c.zones != null) {
					c.cached = true;
					return c;
				}
			}

			let r = cf_call('GET', '/zones?per_page=50&page=1', null);
			if (!r.ok)
				return { ok: false, err: r.err, err_code: r.err_code || 0 };

			let out = [];
			for (let i = 0; i < length(r.data); i++) {
				let z = r.data[i];
				push(out, {
					id:     z.id || '',
					name:   z.name || '',
					status: z.status || ''
				});
			}

			let res = { ok: true, zones: out, cached: false };
			cache_set(CACHE_ZONES, res);
			return res;
		}
	},

	// 列出指定域名下的解析记录
	list_records: {
		args: { zone_id: '' },
		call: function(request) {
			let zid = trim((request.args && request.args.zone_id) || '');
			if (!match(zid, /^[0-9a-fA-F]{32}$/))
				return { ok: false, err: '域名 ID 格式不正确' };

			let r = cf_call('GET', '/zones/' + zid + '/dns_records?per_page=100&page=1', null);
			if (!r.ok)
				return { ok: false, err: r.err, err_code: r.err_code || 0 };

			let out = [];
			for (let i = 0; i < length(r.data); i++) {
				let d = r.data[i];
				push(out, {
					id:      d.id || '',
					type:    d.type || '',
					name:    d.name || '',
					content: d.content || '',
					ttl:     d.ttl || 0,
					proxied: d.proxied ? true : false
				});
			}
			return { ok: true, records: out };
		}
	},

	// 手动添加解析
	add_record: {
		args: { zone_id: '', zone_name: '', type: 'A', name: '', content: '', ttl: 120, proxied: false, set_target: false },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let a = request.args || {};
			let zid   = trim(a.zone_id || '');
			let zname = trim(a.zone_name || '');
			let type  = trim(a.type || 'A');
			let name  = trim(a.name || '');
			let content = trim(a.content || '');

			if (!match(zid, /^[0-9a-fA-F]{32}$/))
				return { ok: false, err: '请先选择域名（Zone）' };
			if (length(name) == 0)
				return { ok: false, err: '请填写主机名（可填 @ 表示根域名）' };
			if (length(content) == 0)
				return { ok: false, err: '请填写记录内容' };

			// 类型白名单
			if (type != 'A' && type != 'AAAA' && type != 'CNAME' && type != 'TXT')
				return { ok: false, err: '不支持的记录类型：' + type };

			// 内容格式校验
			if (type == 'A') {
				if (!match(content, /^([0-9]{1,3}\.){3}[0-9]{1,3}$/))
					return { ok: false, err: 'A 记录内容必须是 IPv4 地址' };
				let parts = split(content, '.');
				for (let i = 0; i < length(parts); i++) {
					if (int(parts[i]) > 255)
						return { ok: false, err: 'IPv4 每段不能超过 255' };
				}
			}
			else if (type == 'AAAA') {
				if (!match(content, /^[0-9a-fA-F:]+$/))
					return { ok: false, err: 'AAAA 记录内容必须是 IPv6 地址' };
				if (index(content, ':') < 0)
					return { ok: false, err: 'AAAA 记录内容必须是 IPv6 地址' };
				if (index(content, ':::') > -1)
					return { ok: false, err: 'IPv6 地址格式错误（出现 :::）' };
			}

			let ttl = int(a.ttl) || 120;
			if (ttl != 1 && (ttl < 60 || ttl > 86400))
				ttl = 120;

			// Cloudflare 只允许 A/AAAA/CNAME 开橙云，其它类型传 true 会被拒（9004）
			let px = a.proxied ? true : false;
			if (type != 'A' && type != 'AAAA' && type != 'CNAME')
				px = false;

			let fq = to_fqdn(name, zname);
			let body = sprintf(
				'{"type":"%s","name":"%s","content":"%s","ttl":%d,"proxied":%s}',
				type, fq, content, ttl, (px ? 'true' : 'false'));

			let r = cf_call('POST', '/zones/' + zid + '/dns_records', body);
			if (!r.ok)
				return { ok: false, err: r.err, err_code: r.err_code || 0 };

			// 顺手设为 DDNS 维护目标
			let target_set = false;
			if (a.set_target) {
				target_set = save_conf({
					ZONE_ID:     zid,
					DOMAIN:      fq,
					RECORD_TYPE: type,
					TTL:         sprintf('%d', ttl),
					PROXIED:     px ? 'true' : 'false'
				});
				if (target_set)
					cache_del(CACHE_CF);
			}

			return {
				ok: true,
				id: (r.data && r.data.id) ? r.data.id : '',
				name: fq,
				type: type,
				proxied: px,
				target_set: target_set
			};
		}
	},

	// 删除记录
	del_record: {
		args: { zone_id: '', rec_id: '' },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let zid = trim((request.args && request.args.zone_id) || '');
			let rid = trim((request.args && request.args.rec_id) || '');
			if (!match(zid, /^[0-9a-fA-F]{32}$/) || !match(rid, /^[0-9a-fA-F]{32}$/))
				return { ok: false, err: '参数格式不正确' };

			// 判断这条是不是当前 DDNS 维护目标（删了定时任务会重建，前端要提示）
			let cfg = load_conf();
			let is_target = false;
			let c = get_cf_state(false);
			if (c.ok && c.rec_id == rid)
				is_target = true;

			let r = cf_call('DELETE', '/zones/' + zid + '/dns_records/' + rid, null);
			if (!r.ok)
				return { ok: false, err: r.err, err_code: r.err_code || 0 };

			cache_del(CACHE_CF);
			cache_del(CACHE_ZONES);
			return { ok: true, is_target: is_target, domain: cfg.DOMAIN || '' };
		}
	},

	// 把某条记录设为 DDNS 维护目标
	set_target: {
		args: { zone_id: '', zone_name: '', domain: '', record_type: 'A' },
		call: function(request) {
			if (!is_enabled())
				return { ok: false, err: '插件已关闭，请先启用', disabled: true };
			let a = request.args || {};
			let zid    = trim(a.zone_id || '');
			let domain = trim(a.domain || '');
			let type   = trim(a.record_type || 'A');

			if (!match(zid, /^[0-9a-fA-F]{32}$/) || length(domain) == 0)
				return { ok: false, err: '参数不完整' };

			let ok = save_conf({
				ZONE_ID:     zid,
				DOMAIN:      domain,
				RECORD_TYPE: type
			});
			if (ok)
				cache_del(CACHE_CF);
			return { ok: ok, err: ok ? '' : '写入 /etc/cfddns.conf 失败' };
		}
	}
};

return { 'luci.cfddns': methods };