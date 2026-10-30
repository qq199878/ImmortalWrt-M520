# -*- coding: utf-8 -*-
import io, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CODE = r"""'use strict';'require dom';'require form';'require fs';'require poll';'require rpc';'require view';

const DEFAULT_CONFIG_FILE = '/etc/adguardhome/adguardhome.yaml';
const DEFAULT_WORK_DIR = '/var/lib/adguardhome';
const DEFAULT_USER = 'adguardhome';
const DEFAULT_GROUP = DEFAULT_USER;
const DEFAULT_GOGC = '0';
const DEFAULT_GOMAXPROCS = '0';
const DEFAULT_GOMEMLIMIT = '0';
const PATH_REGEX = new RegExp('^/etc(/[^/]+)?/?$');
const POLL_INTERVAL = 5;

const RUNNING_SPAN = '<span style="color: var(--success-color-high); font-weight: bold">运行中</span>';
const NOT_RUNNING_SPAN = '<span style="color: var(--error-color-high); font-weight: bold">未运行</span>';
const STORAGE_KEY = 'luci-app-adguardhome';

function getServiceInfo(name) {
	const fn = rpc.declare({
		object: 'service',
		method: 'list',
		params: ['name'],
		expect: { [name]: { instances: { [name]: {} } } },
	});
	return () => fn(name);
}

const getAGHServiceInfo = getServiceInfo('adguardhome');

async function getStatus() {
	try {
		const res = await getAGHServiceInfo();
		const isRunning = res?.instances?.adguardhome?.running;
		return isRunning ?? false;
	} catch (e) {
		console.error(e);
		return false;
	}
}

function getStatusValue(isRunning) {
	return isRunning ? RUNNING_SPAN : NOT_RUNNING_SPAN;
}

async function getVersion() {
	try {
		const res = await fs.exec('/usr/bin/AdGuardHome', ['--version']);
		const version = res.stdout ? (res.stdout.match(/version\s+(.*)/) || [null, res.stdout.trim()])[1] : '';
		return version;
	} catch (e) {
		console.error(e);
		return '未知版本';
	}
}

function updateStatus(node) {
	const output = node?.querySelector('output');
	return output ? async () => {
		const isRunning = await getStatus();
		dom.content(output, getStatusValue(isRunning));
	} : () => {};
}

function validateConfigFile(_unused, value) {
	if (value == null || value === '') {
		return true;
	}
	if (!value.startsWith('/')) {
		return '路径必须为绝对路径。';
	}
	if (value.endsWith('/')) {
		return '路径不能以斜杠结尾。';
	}
	if (PATH_REGEX.test(value)) {
		return '配置文件必须存放在独立的子目录中，不能直接存放在 /etc 根目录下。';
	}
	return true;
}

function validateWorkDir(_unused, value) {
	if (value == null || value === '') {
		return true;
	}
	if (!value.startsWith('/')) {
		return '路径必须为绝对路径。';
	}
	return true;
}

return view.extend({
	load() {
		return Promise.all([
			getStatus(),
			getVersion(),
		]);
	},

	async render([isRunning, version]) {
		const map = new form.Map('adguardhome', 'AdGuard Home',
			'AdGuard Home 是全网广告与跟踪拦截程序。通过在本地拦截 DNS 解析请求，有效屏蔽恶意广告并加速网络访问。');

		/* ---------- 状态信息面板 ---------- */
		const statusSect = map.section(form.TypedSection, 'status');
		statusSect.anonymous = true;
		statusSect.cfgsections = () => ['status_section'];

		/* 1. 版本号 */
		const versionOpt = statusSect.option(form.DummyValue, '_version', '程序版本');
		versionOpt.cfgvalue = () => version;

		/* 2. 运行状态 */
		const statusOpt = statusSect.option(form.DummyValue, '_status', '服务状态');
		statusOpt.rawhtml = true;
		statusOpt.cfgvalue = () => getStatusValue(isRunning);

		/* 3. 管理界面地址（严格沿用 LuCI 原生行样式：左标题 + 右值，不额外造卡片/按钮） */
		const linkOpt = statusSect.option(form.DummyValue, '_link', '管理界面');
		linkOpt.rawhtml = true;
		linkOpt.cfgvalue = () => {
			const host = window.location.hostname || '192.168.1.1';
			const url = `http://${host}:3000`;
			return `<style>
				#cbi-adguardhome-status div[data-name="_link"] > .cbi-value-field {
					max-width: 100% !important;
					box-sizing: border-box !important;
					overflow: hidden !important;
				}
				#cbi-adguardhome-status div[data-name="_link"] .agh-inline {
					display: flex;
					flex-wrap: wrap;
					align-items: baseline;
					gap: 2px 8px;
					line-height: 1.55;
					padding: 3px 0;
					min-width: 0;
				}
				#cbi-adguardhome-status div[data-name="_link"] .agh-inline a {
					color: #3b82f6;
					font-weight: 600;
					text-decoration: none;
					word-break: break-all;
					min-width: 0;
				}
				#cbi-adguardhome-status div[data-name="_link"] .agh-inline a:hover {
					text-decoration: underline;
				}
				#cbi-adguardhome-status div[data-name="_link"] .agh-inline .agh-note {
					font-size: 12px;
					color: #94a3b8;
					white-space: nowrap;
				}
			</style>
			<div class="agh-inline">
				<a href="${url}" target="_blank" rel="noopener">${url} ↗</a>
				<span class="agh-note">账号 admin</span>
			</div>`;
		};

		/* ---------- 主设置面板 ---------- */
		const mainSect = map.section(form.TypedSection, 'adguardhome');
		mainSect.anonymous = true;

		mainSect.tab('general', '常规设置');
		mainSect.tab('jail', '沙箱目录权限 (Jail)',
			'设置 AdGuard Home 在沙箱隔离运行环境下允许访问的只读或读写文件路径。');
		mainSect.tab('advanced', '高级性能调优',
			'配置 Go 运行时底层环境变量，用于微调内存管理与垃圾回收行为。如无特殊需求请保持默认。');

		/* 常规设置项 */
		const enabledOpt = mainSect.taboption('general', form.Flag, 'enabled', '启用服务');

		const configFileOpt = mainSect.taboption('general', form.Value, 'config_file',
			'配置文件路径',
			'配置文件必须存放在独立的子目录中，不能直接存放在 /etc 根目录下。<br />' +
			'其父目录的拥有者将自动归属于服务运行用户。<br />' +
			`留空时默认为 '${DEFAULT_CONFIG_FILE}'。`);
		configFileOpt.placeholder = DEFAULT_CONFIG_FILE;
		configFileOpt.validate = validateConfigFile;

		const workDirOpt = mainSect.taboption('general', form.Value, 'work_dir',
			'工作数据目录',
			'用于存放规则规则库、查询日志与统计历史数据。<br />' +
			'该目录将归属于服务运行用户。<br />' +
			`留空时默认为 '${DEFAULT_WORK_DIR}'。`);
		workDirOpt.placeholder = DEFAULT_WORK_DIR;
		workDirOpt.validate = validateWorkDir;

		const userOpt = mainSect.taboption('general', form.Value, 'user',
			'运行用户',
			`服务进程运行所在的系统用户名。留空时默认为 '${DEFAULT_USER}'。`);
		userOpt.placeholder = DEFAULT_USER;

		const groupOpt = mainSect.taboption('general', form.Value, 'group',
			'运行用户组',
			`服务进程运行所在的系统用户组。留空时默认为 '${DEFAULT_GROUP}'。`);
		groupOpt.placeholder = DEFAULT_GROUP;

		const verboseOpt = mainSect.taboption('general', form.Flag, 'verbose', '详细调试日志');
		verboseOpt.default = '0';

		const advSettingsOpt = mainSect.taboption('general', form.Flag, 'advanced_settings', '展开高级调优选项');
		advSettingsOpt.default = '0';
		advSettingsOpt.rmempty = false;
		advSettingsOpt.load = () => sessionStorage.getItem(STORAGE_KEY) || '0';
		advSettingsOpt.remove = () => {};
		advSettingsOpt.write = (_, value) => sessionStorage.setItem(STORAGE_KEY, value);

		/* 沙箱目录权限 (Jail) */
		mainSect.taboption('jail', form.DynamicList, 'jail_mount', '只读访问路径 (Read-only)');
		mainSect.taboption('jail', form.DynamicList, 'jail_mount_rw', '读写访问路径 (Read-write)');

		/* 高级调优 (Go 环境变量) */
		const gcOpt = mainSect.taboption('advanced', form.Value, 'gc', 'GOGC',
			'设置触发下一次垃圾回收前允许堆内存增长的百分比，以此调节 GC 的激进程度。<br />' +
			'留空时默认为未设置 (100)。',
			'<a href="https://go.dev/doc/gc-guide#GOGC" target="_blank">官方文档: https://go.dev/doc/gc-guide#GOGC</a>');
		gcOpt.datatype = 'uinteger';
		gcOpt.depends('advanced_settings', '1');
		gcOpt.placeholder = DEFAULT_GOGC;
		gcOpt.retain = true;

		const maxProcsOpt = mainSect.taboption('advanced', form.Value, 'maxprocs', 'GOMAXPROCS',
			'可同时执行用户级 Go 代码的最大操作系统线程数。<br />' +
			'留空时默认为未设置 (自动匹配 CPU 核心数)。');
		maxProcsOpt.datatype = 'uinteger';
		maxProcsOpt.depends('advanced_settings', '1');
		maxProcsOpt.placeholder = DEFAULT_GOMAXPROCS;
		maxProcsOpt.retain = true;

		const memLimitOpt = mainSect.taboption('advanced', form.Value, 'memlimit', 'GOMEMLIMIT',
			'Go 运行时的软内存上限，当内存占用接近上限时更频繁地执行 GC，防止被系统 OOM 查杀。<br />' +
			'留空时默认为未设置。');
		memLimitOpt.datatype = 'uinteger';
		memLimitOpt.depends('advanced_settings', '1');
		memLimitOpt.placeholder = DEFAULT_GOMEMLIMIT;
		memLimitOpt.retain = true;

		const rendered = await map.render();
		const statusNode = map.findElement('data-field', statusOpt.cbid('status_section'));
		poll.add(updateStatus(statusNode), POLL_INTERVAL);
		return rendered;
	},
});
"""

out_path = os.path.join(BASE_DIR, 'config.js')
io.open(out_path, 'w', encoding='utf-8').write(CODE)
print("SUCCESS: written to", out_path, "length:", len(CODE))