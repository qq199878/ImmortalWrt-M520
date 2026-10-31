'use strict';
'require rpc';
'require dom';
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

var callVerifyToken = rpc.declare({
	object: 'luci.cfddns',
	method: 'verify_token',
	params: [ 'token' ],
	expect: {}
});
var callListTokens = rpc.declare({
	object: 'luci.cfddns',
	method: 'list_tokens',
	expect: {}
});
var callAddToken = rpc.declare({
	object: 'luci.cfddns',
	method: 'add_token',
	params: [ 'token' ],
	expect: {}
});
var callDelToken = rpc.declare({
	object: 'luci.cfddns',
	method: 'del_token',
	params: [ 'idx' ],
	expect: {}
});
var callSelectToken = rpc.declare({
	object: 'luci.cfddns',
	method: 'select_token',
	params: [ 'idx' ],
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

var callUpdateRecord = rpc.declare({
object: 'luci.cfddns',
method: 'update_record',
params: [ 'zone_id', 'zone_name', 'rec_id', 'type', 'name', 'content', 'ttl', 'proxied' ],
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
	// 覆盖 LuCI 自带 .cbi-map 的 display:flex + gap:14px（否则与卡片 margin 叠加）
	'#cfdWrap { display: block !important; gap: 0 !important; }',
	'.cfd-wrap * { box-sizing: border-box; }',

	'.cfd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;',
	'  padding: 12px 14px; margin-bottom: 10px; }',
	'.cfd-card > h3 { margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1e293b;',
	'  padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }',
	// 卡片折叠头（点击展开/收起）
	'.cfd-card-fold { display: flex; align-items: center; gap: 8px; width: 100%;',
	'  padding: 0 0 6px 0; margin: 0; background: none; border: 0; cursor: pointer;',
	'  border-bottom: 1px solid #f1f5f9; font-size: 15px; font-weight: 600;',
	'  color: #1e293b; text-align: left; font-family: inherit; }',
	'.cfd-card-fold:hover { color: #2563eb; }',
	'.cfd-card-fold.open { margin-bottom: 8px; }',
	'.cfd-card-arrow { flex: 0 0 auto; font-size: 11px; color: #64748b; }',
	'.cfd-card-fold.open .cfd-card-arrow { color: #2563eb; }',
	'.cfd-card-title { flex: 1 1 auto; min-width: 0; }',

	'.cfd-row { display: flex; flex-wrap: wrap; gap: 3px 10px; padding: 4px 0;',
	'  border-bottom: 1px dashed #f1f5f9; font-size: 13px; }',
	'.cfd-row:last-child { border-bottom: 0; }',
	'.cfd-natbox { margin-top: 8px; }',
	'.cfd-natbox:empty { margin-top: 0; display: none; }',
	'.cfd-natbox .cfd-alert { margin-bottom: 0; }',
	'.cfd-k { flex: 0 0 auto; min-width: 88px; color: #64748b; font-weight: 600; }',
	'.cfd-v { flex: 1 1 160px; min-width: 0; color: #1e293b; overflow-wrap: break-word;',
	'  word-break: break-all; }',
	'.cfd-note { flex: 1 1 100%; font-size: 12px; color: #94a3b8; padding-left: 0;',
	'  line-height: 1.4; margin-top: -1px; }',

	'.cfd-code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;',
	'  background: #f8fafc; padding: 1px 5px; border-radius: 3px; color: #0f172a;',
	'  overflow-wrap: break-word; word-break: break-all; }',
	// 行内文字操作：避免 LuCI 原生实心按钮破坏状态行的视觉节奏
	'.cfd-wrap button.cfd-text-action { appearance: none; display: inline;',
	'  width: auto !important; min-width: 0 !important; height: auto !important;',
	'  min-height: 0 !important; max-height: none !important; margin: 0 0 0 10px !important;',
	'  padding: 2px 0 !important; border: 0 !important; border-radius: 0 !important;',
	'  background: transparent !important; background-image: none !important;',
	'  box-shadow: none !important; text-shadow: none !important; color: #64748b !important;',
	'  font: inherit; font-size: 12px !important; font-weight: 400 !important;',
	'  line-height: 1.5 !important; text-decoration: underline; text-underline-offset: 3px;',
	'  text-decoration-color: #cbd5e1; cursor: pointer; vertical-align: baseline; }',
	'.cfd-wrap button.cfd-text-action:hover { color: #2563eb !important;',
	'  text-decoration-color: #93c5fd; }',
	'.cfd-wrap button.cfd-text-action:focus-visible { outline: 2px solid #93c5fd;',
	'  outline-offset: 3px; border-radius: 2px !important; }',

	'.cfd-field { margin-bottom: 10px; }',
	'.cfd-field > label { display: block; font-size: 13px; font-weight: 600;',
	'  color: #334155; margin-bottom: 4px; }',
	'.cfd-hint { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 4px; }',

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
	'  color: #1d4ed8; font-weight: 700; overflow-wrap: break-word; word-break: break-all;',
	'  background: #e0edff; border: 1px solid #bfdbfe; border-radius: 5px;',
	'  padding: 2px 7px; line-height: 1.5; }',
	'.cfd-suffix.cfd-suffix-none { color: #64748b; font-weight: 400; background: #f1f5f9;',
	'  border-color: #e2e8f0; }',
	'.cfd-suffix-tag { font-family: -apple-system, system-ui, sans-serif; font-size: 10px;',
	'  font-weight: 400; color: #64748b; margin-right: 5px; }',
	'@media (max-width: 480px) { .cfd-suffix { flex: 0 0 auto; align-self: flex-start;',
	'  max-width: 100%; padding: 3px 7px; } }',

	'.cfd-toklist { display: flex; flex-direction: column; gap: 0;',
	'  border: 0; border-radius: 0; background: transparent; }',
	// 每个 Token 单行排列，行间以完整横线分隔，不加外框
	'.cfd-tok-item { display: flex; align-items: center; gap: 8px; min-width: 0;',
	'  border: 0; border-radius: 0; padding: 11px 0; background: transparent; }',
	'.cfd-tok-item + .cfd-tok-item { border-top: 1px solid #cbd5e1; }',
	// 条目与下方说明之间留出呼吸空间
	'.cfd-toklist + .cfd-hint { margin-top: 12px; }',
	// 说明为空时不占位
	'.cfd-toklist + .cfd-hint:empty { display: none; margin-top: 0; }',
	'.cfd-tok-item.cfd-tok-on .cfd-tok-mask { color: #1d4ed8; font-weight: 600; }',
	'.cfd-tok-pick { display: flex; align-items: center; gap: 7px;',
	'  flex: 1 1 auto; min-width: 0; cursor: pointer; margin: 0;',
	'  min-height: 28px; line-height: 28px; }',
	// 生效标记：单行内的小号文字标记，不占额外行
	'.cfd-tok-on-tag { flex: 0 0 auto; font-size: 11px; line-height: 18px;',
	'  color: #2563eb; font-weight: 600; white-space: nowrap; }',
	'.cfd-tok-radio { flex: 0 0 auto; width: 16px !important; height: 16px !important;',
	'  min-height: 0 !important; max-height: 16px !important; margin: 0 !important; padding: 0 !important;',
	'  position: static !important; top: auto !important; left: auto !important;',
	'  align-self: center; vertical-align: middle; appearance: auto !important; }',
	// 序号：多 Token 时便于按位置指认
	'.cfd-tok-no { flex: 0 0 auto; min-width: 13px; font-size: 11px; font-weight: 700;',
	'  color: #94a3b8; text-align: right; }',
	'.cfd-tok-item.cfd-tok-on .cfd-tok-no { color: #2563eb; }',
	'.cfd-tok-mask { font-size: 12px; color: #334155; overflow: hidden;',
	'  text-overflow: ellipsis; white-space: nowrap; }',
	// 统一删除按钮：白底红字描边小按钮，替代 LuCI 原生大红实心块，风格更轻
	'.cfd-del { background: #fff !important; color: #dc2626 !important;',
	'  border: 1px solid #fca5a5 !important; border-radius: 6px !important;',
	'  font-weight: 600; box-shadow: none !important;',
	'  text-shadow: none !important; background-image: none !important; }',
	'.cfd-del:hover:not(:disabled) { background: #fef2f2 !important; border-color: #ef4444 !important; }',
	'.cfd-del:disabled { opacity: .45; }',
	// Token 行删除：圆形图标按钮（浅红描边 + 垃圾桶图标），悬停变实心红
	'.cfd-tok-del { flex: 0 0 auto; width: 28px !important; height: 28px !important;',
	'  min-width: 28px !important; max-width: 28px !important;',
	'  min-height: 0 !important; max-height: 28px !important; padding: 0 !important;',
	'  margin: 0 !important; border-radius: 50% !important; display: inline-flex;',
	'  align-items: center; justify-content: center; line-height: 1 !important;',
	'  box-sizing: border-box !important;',
	'  background: #fff !important; color: #dc2626 !important;',
	'  border: 1px solid #fca5a5 !important; box-shadow: none !important;',
	'  text-shadow: none !important; background-image: none !important;',
	'  cursor: pointer; transition: background .15s ease, border-color .15s ease; }',
	'.cfd-tok-del:hover:not(:disabled) { background: #fee2e2 !important;',
	'  border-color: #ef4444 !important; }',
	'.cfd-tok-del:disabled { opacity: .45; cursor: default; }',
	'.cfd-tok-del svg { width: 14px; height: 14px; flex: 0 0 auto; display: block;',
	'  pointer-events: none; }',
	'.cfd-tok-empty { font-size: 13px; color: #94a3b8; padding: 6px 2px; }',
	'.cfd-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }',
	'.cfd-btns .btn, .cfd-btns button { flex: 1 1 auto; min-width: 104px;',
	'  margin: 0 !important; white-space: nowrap; }',
	'@media (min-width: 600px) { .cfd-btns .btn, .cfd-btns button { flex: 0 0 auto; } }',

	'.cfd-rec { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;',
	'  margin-bottom: 8px; background: #fff; }',
	'.cfd-rec.cur { border-color: #10b981; background: #f0fdf4; }',
	'.cfd-rec-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center;',
	'  margin-bottom: 6px; }',
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
	// 复选框行：勾选框与文字垂直居中对齐
	'.cfd-chkrow { display: flex; flex-wrap: wrap; align-items: center;',
	'  gap: 6px 18px; margin-top: 10px; font-size: 13px; }',
	'.cfd-chkrow label { display: flex !important; align-items: center; gap: 6px;',
	'  font-weight: 400; margin: 0 !important; min-height: 22px; cursor: pointer;',
	'  width: fit-content; }',
	'.cfd-chkrow label span { display: inline-block; line-height: 22px; }',
	'.cfd-chkrow input[type=checkbox] { width: 16px !important; height: 16px !important;',
	'  margin: 0 !important; flex: 0 0 auto; appearance: auto !important;',
	'  position: static !important; top: auto !important; transform: none !important;',
	'  vertical-align: middle; }',
	// 记录名分段：主机名深色 + 域名后缀胶囊高亮，便于一眼区分
	'.cfd-rn-host { color: #0f172a; font-weight: 700; }',
	'.cfd-rn-at { color: #64748b; font-weight: 700; }',
	'.cfd-rn-dom { display: inline-block; font-size: 11px; font-weight: 700; line-height: 1.6;',
	'  color: #1d4ed8; background: #e0edff; border: 1px solid #bfdbfe; border-radius: 4px;',
	'  padding: 0 5px; margin-left: 3px; vertical-align: 1px; word-break: break-all; }',
	'.cfd-rec-val { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;',
	'  color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 4px;',
	'  overflow-wrap: break-word; word-break: break-all; margin-bottom: 8px; }',
	'.cfd-rec-meta { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }',
	'.cfd-rec-acts { display: flex; flex-wrap: wrap; gap: 8px; }',
	'.cfd-rec-acts .btn, .cfd-rec-acts button { flex: 1 1 auto; min-width: 96px;',
	'  font-size: 12px !important; padding: 5px 10px !important; margin: 0 !important; }',

	'.cfd-alert { border-radius: 6px; padding: 8px 10px; font-size: 12px;',
	'  line-height: 1.55; margin-bottom: 10px; overflow-wrap: break-word; }',
	'.cfd-alert.warn { background: #fffbeb; border-left: 3px solid #f59e0b; color: #78350f; }',
	'.cfd-alert.info { background: #eff6ff; border-left: 3px solid #3b82f6; color: #1e40af; }',
	'.cfd-alert.err  { background: #fef2f2; border-left: 3px solid #ef4444; color: #991b1b; }',
	'.cfd-alert b { font-weight: 700; }',
	'.cfd-preview { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;',
	'  color: #475569; margin-top: 6px; padding: 5px 8px; background: #f8fafc;',
	'  border-left: 3px solid #3b82f6; border-radius: 4px; word-break: break-all; }',
	'.cfd-preview b { color: #1d4ed8; font-weight: 700; }',
	'.cfd-preview-tag { color: #64748b; margin-right: 4px; }',
	'.cfd-busy { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);',
	'  z-index: 9999; display: flex; align-items: center; gap: 10px; max-width: 92vw;',
	'  padding: 12px 16px; background: #1e293b; color: #f8fafc; font-size: 14px;',
	'  border-radius: 10px; box-shadow: 0 6px 24px rgba(15,23,42,.35);',
	'  animation: cfd-busy-in .18s ease-out; }',
	'@keyframes cfd-busy-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); }',
	'  to { opacity: 1; transform: translateX(-50%) translateY(0); } }',
	'.cfd-busy-dot { width: 9px; height: 9px; border-radius: 50%; background: #38bdf8;',
	'  flex: 0 0 auto; animation: cfd-busy-pulse 1s infinite ease-in-out; }',
	'@keyframes cfd-busy-pulse { 0%,100% { opacity: 1; transform: scale(1); }',
	'  50% { opacity: .35; transform: scale(.7); } }',
	'.cfd-busy-x { margin-left: 4px; border: 0; background: rgba(248,250,252,.14);',
	'  color: #f8fafc; width: 22px; height: 22px; border-radius: 50%; font-size: 15px;',
	'  line-height: 1; cursor: pointer; padding: 0; flex: 0 0 auto; }',
	'.cfd-busy-x:hover { background: rgba(248,250,252,.28); }',
	// 轻量 toast：与 cfd-busy 同风格，用于成功/失败等终态提示，自动消失
	'.cfd-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);',
	'  z-index: 9999; display: flex; align-items: center; gap: 8px; max-width: 92vw;',
	'  padding: 10px 16px; background: #1e293b; color: #f8fafc; font-size: 13px;',
	'  border-radius: 9px; box-shadow: 0 6px 24px rgba(15,23,42,.35);',
	'  animation: cfd-busy-in .18s ease-out; pointer-events: none; }',
	'.cfd-toast.ok .cfd-toast-dot { background: #34d399; }',
	'.cfd-toast.warn .cfd-toast-dot { background: #fbbf24; }',
	'.cfd-toast.err .cfd-toast-dot { background: #f87171; }',
	'.cfd-toast-dot { width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; flex: 0 0 auto; }',
	'.cfd-toast.cfd-out { opacity: 0; transform: translateX(-50%) translateY(6px); transition: opacity .25s, transform .25s; }',
	// --- 折叠区标题 ---
	'.cfd-fold { display: flex; align-items: center; gap: 8px; width: 100%;',
	'  padding: 8px 10px; margin: 0 0 8px; background: #f1f5f9; border: 1px solid #e2e8f0;',
	'  border-radius: 8px; font-size: 13px; font-weight: 600; color: #334155;',
	'  cursor: pointer; text-align: left; transition: background .15s ease; }',
	'.cfd-fold:hover { background: #e8eef5; }',
	'.cfd-fold.open { background: #e0eaf7; border-color: #c7d9f0; }',
	'.cfd-fold-arrow { display: inline-block; font-size: 11px; color: #64748b;',
	'  transition: transform .2s ease; transform: rotate(0deg); }',
	'.cfd-fold.open .cfd-fold-arrow { transform: rotate(90deg); color: #2563eb; }',
	'.cfd-fold-label { flex: 1 1 auto; }',
	'.cfd-fold-count { flex: 0 0 auto; min-width: 22px; height: 20px; padding: 0 7px;',
	'  display: inline-flex; align-items: center; justify-content: center;',
	'  background: #2563eb; color: #fff; font-size: 11px; font-weight: 700;',
	'  border-radius: 10px; }',
	'.cfd-fold.open .cfd-fold-count { background: #1d4ed8; }',
	// --- 发牌动画 ---
	'@keyframes cfd-deal {',
	'  0%   { opacity: 0; transform: translateY(-28px) rotateX(-22deg) scale(.96); }',
	'  60%  { opacity: 1; }',
	'  100% { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }',
	'}',
	'.cfd-deal-wrap { perspective: 900px; }',
	'.cfd-deal-wrap > .cfd-rec { animation: cfd-deal .55s cubic-bezier(.34,1.2,.64,1) backwards;',
	'  transform-origin: top center; }',
	// --- 编辑表单 ---
	'.cfd-edit { margin-top: 8px; padding: 10px; background: #f8fafc;',
	'  border: 1px solid #dbe4ef; border-radius: 8px; }',
	'.cfd-edit-title { font-size: 12px; font-weight: 700; color: #2563eb; margin-bottom: 8px; }',
	'.cfd-add { margin-top: 4px; }',
	'.cfd-add-body { padding-top: 4px; }',
	// --- 记录操作按钮等宽平分 ---
	'.cfd-rec-acts { display: flex !important; gap: 8px; }',
	'.cfd-rec-acts > .btn { flex: 1 1 0; min-width: 0; text-align: center; }',

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
	'.cfd-modal-f .btn, .cfd-modal-f button { min-width: 88px; margin: 0 !important; }',

	// ------------------------------------------------------------------
	// 移动端紧凑布局（必须放在最后，否则同优先级会被上面的基础样式覆盖）
	// ------------------------------------------------------------------
	'@media (max-width: 599px) {',
	// 状态行：主值 + 副文本同排，不换行，副文本单行省略
	'  .cfd-row { gap: 1px 6px; padding: 3px 0; align-items: baseline; flex-wrap: wrap; }',
	'  .cfd-k { min-width: 68px; flex: 0 0 auto; font-size: 12px; }',
	'  .cfd-v { flex: 1 1 0; min-width: 0; font-size: 12px; white-space: normal;',
	'    word-break: break-all; line-height: 1.35; }',
	// 副文本独占第二行（不再挤占主值宽度导致 IP 换行）
	'  .cfd-note { flex: 1 1 100%; font-size: 11px; line-height: 1.3;',
	'    margin-top: 0; white-space: normal; word-break: break-all; }',
	'  .cfd-row .cfd-code { font-size: 11px; }',
	// 输入框、字段、提示行收紧
	'  .cfd-wrap input[type=text], .cfd-wrap input[type=password],',
	'  .cfd-wrap input[type=number], .cfd-wrap select { height: 34px; font-size: 13px; }',
	'  .cfd-hint { font-size: 11px; line-height: 1.45; margin-top: 3px; }',
	'  .cfd-field { margin-bottom: 8px; }',
	'  .cfd-field > label { font-size: 12px; margin-bottom: 3px; }',
	'  .cfd-btns { margin-top: 4px; }',
	'  .cfd-card-fold.open { margin-bottom: 6px; }',
	'  .cfd-tok-item { padding: 10px 0; }',
	// 按钮高度收紧（LuCI 默认按钮 40px 偏高）
	'  .cfd-wrap .btn, .cfd-wrap button.btn { min-height: 0 !important; height: auto !important;',
	'    padding: 6px 10px !important; font-size: 13px !important; line-height: 1.4 !important; }',
	'  .cfd-wrap .cfd-btns .btn, .cfd-wrap .cfd-btns button { padding: 6px 10px !important;',
	'    font-size: 13px !important; }',
	// 行内小按钮（如「设置」）不参与上面的高度
	'  .cfd-row .btn, .cfd-row button { padding: 1px 7px !important; font-size: 11px !important;',
	'    min-height: 0 !important; line-height: 1.35 !important; }',
	'  .cfd-v { line-height: 1.4; }',
	'  .cfd-tok-del { width: 26px !important; height: 26px !important;',
	'    min-width: 26px !important; max-width: 26px !important; max-height: 26px !important; }',
	'  .cfd-tok-del svg { width: 13px; height: 13px; }',
	// 快捷操作：4 个按钮同排均分，避免换行成两行
	'  .cfd-btns { flex-wrap: nowrap; }',
	'  .cfd-btns .btn, .cfd-btns button { flex: 1 1 0 !important; min-width: 0 !important;',
	'    padding: 6px 3px !important; font-size: 12px !important;',
	'    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
	'  .cfd-wrap .cfd-btns .btn, .cfd-wrap .cfd-btns button { flex: 1 1 0 !important;',
	'    min-width: 0 !important; padding: 6px 3px !important; font-size: 12px !important;',
	'    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
	'  .cfd-btns > div { flex: 1 1 0 !important; min-width: 0 !important; }',
	'  .cfd-btns > div .btn, .cfd-btns > div button { width: 100% !important;',
	'    min-width: 0 !important; padding: 6px 4px !important; font-size: 12px !important; }',
	// 解析记录 / 手动添加 折叠条收紧
	'  .cfd-fold { padding: 6px 9px; margin: 0 0 6px; font-size: 12px; }',
	'  .cfd-fold-count { height: 18px; min-width: 20px; font-size: 10px; }',
	'  .cfd-add { margin-top: 2px; }',
	'  .cfd-add-body { padding-top: 2px; }',
	'  .cfd-rec { padding: 7px 9px; margin-bottom: 6px; }',
	'  .cfd-rec-head { margin-bottom: 5px; gap: 4px; }',
	'  .cfd-rec-name { font-size: 12px; }',
	'  .cfd-rec-val { padding: 4px 7px; margin-bottom: 5px; font-size: 11px; }',
	'  .cfd-rec-meta { margin-bottom: 5px; font-size: 10px; }',
	'  .cfd-rec-acts { gap: 5px; }',
	// 三按钮：等宽均分 + 文字居中，且禁止文字顶出按钮边界（防溢出重叠）
	// 选择器必须带 .cfd-wrap .cfd-rec 前缀，否则特异性低于 .cfd-wrap button.btn 会被覆盖
	'  .cfd-wrap .cfd-rec .cfd-rec-acts > .btn,',
	'  .cfd-wrap .cfd-rec .cfd-rec-acts > button { flex: 1 1 0 !important; min-width: 0 !important;',
	'    padding: 4px 2px !important; font-size: 11px !important; text-align: center;',
	'    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
	'  .cfd-edit { margin-top: 6px; padding: 8px; }',
	'  .cfd-edit-title { margin-bottom: 6px; }',
	'  .cfd-alert { padding: 7px 9px; font-size: 11px; line-height: 1.5; }',
	'}'
].join('\n');

// ---------------------------------------------------------------------
// 内联图标（SVG，避免额外资源请求；currentColor 跟随按钮文字色）
// ---------------------------------------------------------------------

// 垃圾桶：圆形删除按钮用
var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
	'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<path d="M3 6h18"/><path d="M8 6V4h8v2"/>' +
	'<path d="M19 6l-1 14H6L5 6"/>' +
	'<path d="M10 11v6"/><path d="M14 11v6"/></svg>';

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

// 自动消失的轻量通知：插件统一深色 toast 风格，与 cfd-busy 一致
// 成功 2 秒 / 警告 3 秒 / 错误 4 秒自动淡出，也可用 ms 显式指定
function notifyTemp(msg, level, ms) {
	var cls = 'cfd-toast';
	if (level === 'info') cls += ' ok';
	else if (level === 'warning') cls += ' warn';
	else if (level === 'danger' || level === 'error') cls += ' err';
	var life = (typeof ms === 'number' && ms > 0) ? ms
		: (level === 'info' ? 2000 : (level === 'warning' ? 3000 : 4000));
	// 单例：新提示出现前先清掉上一条，避免多条叠在底部互相遮挡
	var olds = document.querySelectorAll('body > .cfd-toast');
	for (var i = 0; i < olds.length; i++) {
		if (olds[i].parentNode)
			olds[i].parentNode.removeChild(olds[i]);
	}
	var node = E('div', { 'class': cls }, [
		E('span', { 'class': 'cfd-toast-dot' }),
		E('span', {}, msg)
	]);
	document.body.appendChild(node);
	window.setTimeout(function() {
		node.classList.add('cfd-out');
		window.setTimeout(function() {
			if (node && node.parentNode)
				node.parentNode.removeChild(node);
		}, 280);
	}, life);
	return node;
}
// 同步进行中的浮层：单例，可手动关闭，任务结束由调用方移除
var busyNode = null;
// 立即同步的轮询定时器句柄。声明在顶层，供 busyHide 在用户手动关闭浮层时一并清理，
// 避免浮层已消失但轮询仍在后台空跑（最多 40 次 × 1.5s）。
var runPollTimer = null;
function busyShow(msg) {
	busyHide();
	busyNode = E('div', { 'class': 'cfd-busy' }, [
		E('span', { 'class': 'cfd-busy-dot' }),
		E('span', {}, msg),
		E('button', {
			'class': 'cfd-busy-x',
			'type': 'button',
			'aria-label': '关闭'
		}, '×')
	]);
	busyNode.lastElementChild.addEventListener('click', function(ev) {
		ev.preventDefault();
		busyHide();
	});
	document.body.appendChild(busyNode);
}
function busyUpdate(msg) {
	if (busyNode)
		busyNode.children[1].textContent = msg;
}
function busyHide() {
	// 关闭浮层即视为用户主动结束本次同步等待，一并将轮询定时器停掉，
	// 否则浮层已消失但 poll 仍会每 1.5s 跑一次，直到 40 次上限才停。
	if (runPollTimer) {
		clearTimeout(runPollTimer);
		runPollTimer = null;
	}
	if (busyNode && busyNode.parentNode) {
		busyNode.parentNode.removeChild(busyNode);
	}
	busyNode = null;
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

// 卡片：可选折叠。foldKey 传入时启用折叠，折叠态存 S[foldKey]（默认收起）
// 卡片折叠状态（模块级：card() 在 render 之外定义，不能引用内部的 S）
var CARD_FOLD = {};
function card(title, children, id, foldKey, badge) {
	var attrs = { 'class': 'cfd-card' };
	if (id)
		attrs.id = id;
	if (!foldKey)
		return E('div', attrs, [ E('h3', {}, title) ].concat(children || []));
	// 折叠版：标题变成可点按钮，箭头 + 可选数量徽章
	var box = E('div', attrs);
	function paint() {
		var open = !!CARD_FOLD[foldKey];
		var head = E('button', {
			'class': 'cfd-card-fold' + (open ? ' open' : ''),
			'type': 'button',
			'aria-expanded': open ? 'true' : 'false'
		}, [
			E('span', { 'class': 'cfd-card-arrow' }, open ? '\u25be' : '\u25b8'),
			E('span', { 'class': 'cfd-card-title' }, title),
			badge ? E('span', { 'class': 'cfd-fold-count' }, badge) : null
		].filter(function(x) { return x != null; }));
		head.addEventListener('click', function(ev) {
			ev.preventDefault();
			CARD_FOLD[foldKey] = !CARD_FOLD[foldKey];
			paint();
		});
		dom.content(box, [ head ].concat(open ? (children || []) : []));
	}
	paint();
	return box;
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
			zonesLoading: false,
			recOpen: false,      // 解析记录区是否展开
			addOpen: false,      // 手动添加解析区是否展开
			editingId: '',       // 正在编辑的记录 ID
			tokens: (cfg.tokens || []),   // 已保存的 Token（脱敏）
			tokSel: (typeof cfg.token_sel === 'number' ? cfg.token_sel : -1), // 当前生效索引
			tokBusy: false,      // Token 新增/切换/删除进行中，防并发操作错乱
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
					notifyTemp((want ? '启用' : '关闭') + '失败：' + errText(r), 'danger');
					return;
				}
				st.enabled = !!want;
				isOn = !!want;
				if (!want && r.old_ip)
					st.parked_ip = r.park_ip || parkIp;
				if (r.park_ip)
					parkIp = r.park_ip;
				notifyTemp(want ? '插件已启用' : '插件已关闭，域名解析已停止', want ? 'info' : 'warning');
				paintSwitch(!!want, { old_ip: r.old_ip });
				// 状态卡跟着刷新
				refreshFull(true);
			}).catch(function(e) {
				notifyTemp('操作出错：' + (e.message || e), 'danger');
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
		var natBox = E('div', { 'class': 'cfd-natbox' });

		var lastNode = E('span', {}, code(st.last));

		// 定时任务状态节点（setCron 会局部更新它）
		var cronNode = E('span', { 'class': cron.enabled ? 'cfd-ok' : 'cfd-mute' },
			cron.enabled ? ('已启用 · 每 ' + (cron.minutes || 1) + ' 分钟') : '已停用');

		// ---- 停靠地址（关闭插件时域名指向的 IP）----
		var parkTextNode = E('span', {}, code(parkIp));
		var parkEditBtn = E('button', {
			'type': 'button',
			'class': 'cfd-text-action',
			'title': '设置停靠地址'
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
						notifyTemp('已设为 ' + r.ip + '，线上记录已同步', 'info');
						refreshFull(true);
					} else if (r.note) {
						notifyTemp(r.note, 'warning');
					} else {
						notifyTemp('已设为 ' + r.ip + '（下次关闭时生效）', 'info');
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
			kvRow('上次执行', lastNode),
			natBox
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
		// -------------------------------------------------------------
		// 多 Token：列表单选切换 / 新增 / 删除
		// CF_TOKEN 始终只存「当前生效」那一个，ddns-cf.sh 直接 source 使用
		// -------------------------------------------------------------
		var tokenInput = E('input', {
			'type': 'password',
			'class': 'cfd-mono',
			'placeholder': '粘贴 Cloudflare API Token',
			'autocomplete': 'new-password',
			'spellcheck': 'false'
		});
		var tokStateNode = E('span', { 'class': cfg.has_token ? 'cfd-ok' : 'cfd-bad' },
			cfg.has_token ? ('✓ ' + (cfg.token_mask || '已配置')) : '✗ 未配置');
		var tokListBox = E('div', { 'class': 'cfd-toklist' });
		var tokHintBox = E('div', { 'style': 'display:none;' });

		function paintTokState() {
			var cur = (S.tokSel >= 0 && S.tokens[S.tokSel]) ? S.tokens[S.tokSel].mask : '';
			if (cur) {
				tokStateNode.className = 'cfd-ok';
				dom.content(tokStateNode, '✓ ' + cur);
			}
			else if (S.tokens.length) {
				tokStateNode.className = 'cfd-warn';
				dom.content(tokStateNode, '⚠ 未选择生效 Token');
			}
			else {
				tokStateNode.className = 'cfd-bad';
				dom.content(tokStateNode, '✗ 未配置');
			}
		}

		function renderTokenList() {
			while (tokListBox.firstChild)
				tokListBox.removeChild(tokListBox.firstChild);
			paintTokState();
			if (!S.tokens.length) {
				tokListBox.appendChild(E('div', { 'class': 'cfd-tok-empty' },
					'暂无 Token，请在下方新增。'));
				dom.content(tokHintBox, cfg.has_token
					? '配置文件里已有 Token（旧格式），但未纳入列表管理。新增一个 Token 后即切换为列表管理，原值会被覆盖。'
					: '还没有配置 Token。需要一个具备 Zone → DNS → Edit 与 Zone → Zone → Read 权限的 API Token。');
				tokHintBox.style.display = '';
				return;
			}
			// 已有 Token 时不再显示切换说明，保持列表区简洁
			dom.content(tokHintBox, '');
			tokHintBox.style.display = 'none';
			S.tokens.forEach(function(it, i) {
				var isCur = (i === S.tokSel);
				var radio = E('input', {
					'type': 'radio',
					'name': 'cfdTokRadio',
					'class': 'cfd-tok-radio'
				});
				radio.checked = isCur;
				radio.addEventListener('change', function() {
					if (i === S.tokSel) {
						radio.checked = true;
						return;
					}
					// 并发保护：上一次 Token 操作未完成时，恢复原选中项
					if (S.tokBusy) {
						notifyTemp('上一个操作还在进行，请稍候…', 'warning');
						renderTokenList();
						return;
					}
					S.tokBusy = true;
					radio.disabled = true;
					busyShow('正在切换 Token…');
					callSelectToken(i).then(function(r) {
						busyHide();
						if (!r || !r.ok) {
							S.tokBusy = false;
							notifyTemp('切换失败：' + errText(r), 'danger');
							renderTokenList();
							return;
						}
						S.tokSel = i;
						S.tokBusy = false;
						renderTokenList();
						notifyTemp('已切换生效 Token：' + (it.mask || ''), 'info');
						autoLoadZones();
					}).catch(function(e) {
						busyHide();
						S.tokBusy = false;
						notifyTemp('切换出错：' + (e.message || e), 'danger');
						renderTokenList();
					});
				});
				// 删除按钮：圆形图标按钮（垃圾桶），替代文字按钮，避免多 Token 时按钮抢眼
				var delBtn = E('button', {
					'class': 'btn cbi-button cfd-tok-del cfd-del',
					'type': 'button',
					'title': '删除这个 Token',
					'aria-label': '删除 Token ' + (i + 1)
				});
				delBtn.innerHTML = ICON_TRASH;
				delBtn.addEventListener('click', function(ev) {
					ev.preventDefault();
					var msg = '删除这个 Token？\n\n' + (it.mask || '') +
						(isCur ? '\n\n它是当前生效的 Token，删除后将自动切换到列表中的第一个；若列表删空则清空配置。' : '');
					if (!window.confirm(msg))
						return;
					// 并发保护：删除与切换不能同时进行，避免后端索引错位
					if (S.tokBusy) {
						notifyTemp('上一个操作还在进行，请稍候…', 'warning');
						return;
					}
					S.tokBusy = true;
					delBtn.disabled = true;
					busyShow('正在删除…');
					callDelToken(i).then(function(r) {
						busyHide();
						S.tokBusy = false;
						if (!r || !r.ok) {
							notifyTemp('删除失败：' + errText(r), 'danger');
							delBtn.disabled = false;
							return;
						}
						if (r.was_current)
							notifyTemp(r.remain
								? '已删除，并切换到：' + (r.new_current || '')
								: '已删除最后一个 Token，配置已清空', 'warning');
						else
							notifyTemp('已删除', 'info');
						refreshTokens().then(function() {
							if (r.was_current)
								autoLoadZones();
						});
					}).catch(function(e) {
						busyHide();
						S.tokBusy = false;
						notifyTemp('删除出错：' + (e.message || e), 'danger');
						delBtn.disabled = false;
					});
				});
				tokListBox.appendChild(E('div', {
					'class': 'cfd-tok-item' + (isCur ? ' cfd-tok-on' : '')
				}, [
					E('label', { 'class': 'cfd-tok-pick' }, [
						radio,
						E('span', { 'class': 'cfd-tok-no' }, String(i + 1)),
						E('span', { 'class': 'cfd-tok-mask cfd-mono', 'title': it.mask || '' }, it.mask || '')
					]),
					isCur ? E('span', { 'class': 'cfd-tok-on-tag' }, '生效') : '',
					delBtn
				]));
			});
		}

		function refreshTokens() {
			return callListTokens().then(function(r) {
				if (r && r.ok) {
					S.tokens = r.tokens || [];
					S.tokSel = (typeof r.selected === 'number' && r.selected >= 0) ? r.selected : -1;
					renderTokenList();
				}
				return r;
			}).catch(function() { return null; });
		}

		var addTokenBtn = okBtn('新增 Token', 'apply', function(btn) {
			if (S.tokBusy) {
				notifyTemp('上一个 Token 操作还在进行，请稍候…', 'warning');
				btn.disabled = false;
				return;
			}
			var v = (tokenInput.value || '').trim();
			if (!v.length) {
				notifyTemp('请先粘贴 Token', 'warning');
				btn.disabled = false;
				return;
			}
			// 与后端规则一致，明显错误的输入不再发起远程校验
			if (v.length < 20) {
				notifyTemp('Token 长度异常，请检查是否完整复制', 'warning');
				btn.disabled = false;
				return;
			}
			if (!/^[A-Za-z0-9_-]+$/.test(v)) {
				notifyTemp('Token 含非法字符，只允许字母、数字、- 和 _', 'warning');
				btn.disabled = false;
				return;
			}

			S.tokBusy = true;
			btn.disabled = true;
			busyShow('正在校验 Token…');
			callVerifyToken(v).then(function(vr) {
				var verified = !!(vr && vr.ok);
				if (!verified) {
					busyHide();
					// 只有“根本没拿到云端应答”才算情况不明，此时才允许用户确认后强制添加；
					// 其余情况（含格式类拒绝、Cloudflare 明确报错）一律直接拒绝，避免无效 Token 入库
					var eMsg = (vr && vr.err) ? String(vr.err) : '';
					var noReply = !(vr && vr.err_code) && (
						eMsg.indexOf('无响应') >= 0 ||
						eMsg.indexOf('解析失败') >= 0 ||
						eMsg.indexOf('网络') >= 0 ||
						eMsg === ''
					);
					if (noReply) {
						var msg = '⚠ 无法连接到 Cloudflare\n\n' +
							(errText(vr) || '未知原因') +
							'\n\n可能是网络暂时不通，或 Token 有效但此刻无法校验。\n仍要添加吗？\n' +
							'（添加后定时同步会持续失败，直到换成有效 Token）';
						if (!window.confirm(msg)) {
							notifyTemp('已取消添加', 'info');
							return;
						}
						busyShow('正在添加 Token…');
					}
					else {
						notifyTemp('Token 无效，已拒绝添加：' + errText(vr), 'danger', 6000);
						return;
					}
				}
				else
					busyUpdate('校验通过，正在添加 Token…');

				return callAddToken(v).then(function(r) {
					if (!(r && r.ok)) {
						notifyTemp('添加失败：' + errText(r), 'danger');
						return;
					}
					return refreshTokens().then(function(listResult) {
						if (!listResult || !listResult.ok) {
							notifyTemp('Token 已保存，但列表刷新失败，请重新打开页面确认', 'warning', 5000);
							return;
						}
						tokenInput.value = '';
						if (verified)
							notifyTemp('✓ Token 已添加' + (r.activated ? '并生效' : ''), 'info');
						else
							notifyTemp('⚠ Token 已添加，但未能完成校验，请稍后自行确认有效性', 'warning', 6000);
						if (r.activated)
							autoLoadZones();
					});
				});
			}).catch(function(e) {
				notifyTemp('新增 Token 出错：' + (e.message || e), 'danger');
			}).then(function() {
				busyHide();
				S.tokBusy = false;
				btn.disabled = false;
			});
		});
		var zonesBtn = okBtn('验证并列出域名', 'action', function(btn) {
			// force=true 跳过缓存，这个按钮的语义就是“重新验证”
			callListZones(true).then(function(r) {
				btn.disabled = false;
				if (!r || !r.ok) {
					notifyTemp('获取域名失败：' + errText(r), 'danger');
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

				notifyTemp(S.zones.length
					? 'Token 有效，共 ' + S.zones.length + ' 个域名'
					: 'Token 有效，但账号下没有域名', S.zones.length ? 'info' : 'warning');

				renderZones();
				if (S.selZone)
					loadRecords(S.selZone.id);
			}).catch(function(e) {
				btn.disabled = false;
				notifyTemp('请求出错：' + (e.message || e), 'danger');
			});
		});

		var tokenCard = card('API 凭据', [
			kvRow('当前生效', tokStateNode),
			field('已保存的 Token', tokListBox, tokHintBox),
			field('新增 Token', tokenInput, [
				E('div', {}, '需要权限：Zone → DNS → Edit、Zone → Zone → Read'),
				E('div', {}, 'Token 存在 /etc/cfddns.conf（600），页面只显示脱敏值')
			]),
			E('div', { 'class': 'cfd-btns' }, [ addTokenBtn, zonesBtn ])
		], 'cfdLockToken', 'credOpen');
		renderTokenList();

		// =============================================================
		// 三、域名与解析
		// 注意：表单节点只创建一次并持久复用，重绘时只替换记录列表，
		//       否则用户填了一半的内容会被清空。
		// =============================================================

		var zonesBox = E('div', {});
		var zonesCard = card('域名与解析', [ zonesBox ], 'cfdLockZones', 'zoneCardOpen');

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
		var proxiedLabel = E('label', {}, [ proxiedChk, E('span', {}, '橙云代理') ]);

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
					notifyTemp('已填入 ' + r.ip + (r.cached ? '（缓存）' : ''), 'info');
				} else {
					notifyTemp('探测失败', 'danger');
				}
			}).catch(function(e) {
				fillIpBtn.disabled = false;
				notifyTemp('出错：' + (e.message || e), 'danger');
			});
		});

		// 域名后缀显示节点（随选中 zone 更新）
		var suffixNode = E('div', { 'class': 'cfd-suffix cfd-suffix-none' }, [
			E('span', { 'class': 'cfd-suffix-tag' }, '域名后缀'), '（先选域名）'
		]);
		// 完整域名预览节点（选中域名后实时显示 主机名.域名）
		var previewNode = E('div', { 'class': 'cfd-preview', 'style': 'display:none;' }, '');
		nameInput.addEventListener('input', function() { updatePreview(); });
		nameInput.addEventListener('change', function() { updatePreview(); });

		var addBtn = okBtn('添加解析', 'action', function(btn) {
			if (!S.selZone) {
				notifyTemp('请先选择域名', 'warning');
				btn.disabled = false;
				return;
			}
			var nm = (nameInput.value || '').trim();
			var ct = (contentInput.value || '').trim();
			if (!nm.length) {
				notifyTemp('请填写主机名（根域名填 @）', 'warning');
				btn.disabled = false;
				return;
			}
			if (!ct.length) {
				notifyTemp('请填写记录内容', 'warning');
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
					notifyTemp('添加失败：' + errText(r), 'danger');
					return;
				}
				var msg = '已添加 ' + r.type + '：' + r.name;
				if (r.target_set)
					msg += '（已接管维护）';
				notifyTemp(msg, 'info');

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
				notifyTemp('出错：' + (e.message || e), 'danger');
			});
		});

		// 表单 DOM（一次构建）
		var addBody = E('div', { 'class': 'cfd-add-body' }, [
			E('div', { 'class': 'cfd-field' }, [
				E('label', {}, '类型 / 主机名'),
				E('div', { 'class': 'cfd-inline' }, [
					E('div', { 'class': 'cfd-fix' }, typeSel),
					E('div', { 'class': 'cfd-grow' }, nameInput),
					suffixNode
				]),
				previewNode
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
				E('div', { 'class': 'cfd-chkrow' }, [
					proxiedLabel,
					E('label', {}, [ setTargetChk, E('span', {}, '同时接管维护') ])
				])
			]),
			E('div', { 'class': 'cfd-btns' }, [ addBtn ]),
			E('div', { 'class': 'cfd-hint' }, [
				E('div', {}, '主机名填 @ 表示根域名，填 home 会补成 home.<域名>'),
				E('div', {}, '勾选「同时接管维护」后，定时任务改为维护这条记录')
			])
		]);
		// 手动添加解析：折叠容器
		var addForm = E('div', { 'class': 'cfd-add' });
		function renderAddForm() {
			var head = foldHead('手动添加解析', S.addOpen, function() {
				S.addOpen = !S.addOpen;
				renderAddForm();
			});
			dom.content(addForm, [ head, S.addOpen ? addBody : null ]
				.filter(function(x) { return x != null; }));
		}
		renderAddForm();
		// --- 记录列表区域（会被重绘）---
		var recBox = E('div', { 'style': 'margin-bottom:14px;' });
		var zoneSelBox = E('div', {});
		var loadBtnBox = E('div', {});

		function updateSuffix() {
			if (!S.selZone) {
				suffixNode.className = 'cfd-suffix cfd-suffix-none';
				dom.content(suffixNode, [ E('span', { 'class': 'cfd-suffix-tag' }, '域名后缀'), '（先选域名）' ]);
				dom.content(previewNode, '');
				previewNode.style.display = 'none';
				return;
			}
			suffixNode.className = 'cfd-suffix';
			dom.content(suffixNode, [ E('span', { 'class': 'cfd-suffix-tag' }, '域名后缀'), '. ' + S.selZone.name ]);
			previewNode.style.display = '';
			// 完整域名预览：随主机名输入实时更新
			updatePreview();
		}
		// 生成完整域名：@ 或空 = 根域名，其它 = 主机名.域名
		function fullDomainOf(host) {
			var z = S.selZone ? S.selZone.name : '';
			if (!z)
				return '';
			var h = (host || '').trim();
			if (!h.length || h === '@')
				return z;
			if (h.slice(-1) === '.')
				h = h.slice(0, -1);
			// 已填完整域名则不重复拼接
			if (h === z || h.slice(-(z.length + 1)) === '.' + z)
				return h;
			return h + '.' + z;
		}
		function updatePreview() {
			if (!S.selZone) {
				dom.content(previewNode, '');
				previewNode.style.display = 'none';
				return;
			}
			previewNode.style.display = '';
			var h = (nameInput.value || '').trim();
			var fd = fullDomainOf(h);
			if (!fd) {
				dom.content(previewNode, '');
				previewNode.style.display = 'none';
				return;
			}
			// 根域名（未填 / @）额外标注，避免误以为漏填
			var isRoot = (!h.length || h === '@');
			var domName = S.selZone.name;
			var hostPart = '';
			if (!isRoot) {
				// 拆出主机名部分，域名后缀单独高亮
				if (fd === domName)
					hostPart = '';
				else if (fd.slice(-(domName.length + 1)) === '.' + domName)
					hostPart = fd.slice(0, fd.length - domName.length - 1) + '.';
				else
					hostPart = fd;
			}
			dom.content(previewNode, [
				E('span', { 'class': 'cfd-preview-tag' }, '将创建：'),
				isRoot ? E('span', { 'class': 'cfd-rn-at' }, '@ ') : null,
				hostPart ? E('span', { 'class': 'cfd-rn-host' }, hostPart) : null,
				E('b', { 'class': 'cfd-rn-dom', 'style': 'margin-left:0;' }, domName),
				isRoot ? E('span', { 'class': 'cfd-preview-tag', 'style': 'margin-left:5px;' }, '（根域名）') : null
			].filter(function(x) { return x != null; }));
		}

		function renderRecBox(noDeal) {
			if (!S.selZone) {
				dom.content(recBox, '');
				return;
			}
			var n = S.records.length;
			var head = foldHead('解析记录', S.recOpen, function() {
				S.recOpen = !S.recOpen;
				renderRecBox();          // 折叠头点击：重建列表，重播发牌动画
			}, E('span', { 'class': 'cfd-fold-count' }, String(n)));
			// noDeal=true（编辑展开等原地重绘）不播动画，避免整列闪烁
			var body = S.recOpen ? buildRecords(noDeal) : null;
			dom.content(recBox, [ head, body ].filter(function(x) { return x != null; }));
		}

		// 记录请求序号：快速切换域名时，只认最后一次请求，防止旧域名记录覆盖新域名
		var recSeq = 0;
		function loadRecords(zid) {
			var seq = ++recSeq;
			dom.content(recBox, E('div', { 'class': 'cfd-alert info' }, [
				loading(), ' 正在读取解析记录…'
			]));
			callListRecords(zid).then(function(r) {
				if (seq !== recSeq)
					return;
				if (!r || !r.ok) {
					dom.content(recBox, E('div', { 'class': 'cfd-alert err' },
						'加载记录失败：' + errText(r)));
					return;
				}
				S.records = r.records || [];
				renderRecBox();
			}).catch(function(e) {
				if (seq !== recSeq)
					return;
				dom.content(recBox, E('div', { 'class': 'cfd-alert err' },
					'加载记录出错：' + (e.message || e)));
			});
		}

		// 只重绘“域名选择器 + 按钮 + 记录列表”，表单节点不动
		function renderZones() {
			updateSuffix();

			// 始终渲染「选择域名」控件：加载中 / 失败 / 空 都保留下拉框位置，
			// 避免首屏出现「看不到选择域名」的空白期
			var sel = E('select', {});

			if (!S.zonesLoaded) {
				sel.disabled = true;
				sel.appendChild(E('option', { 'value': '' },
					(S.zonesLoading || cfg.has_token)
						? '正在加载域名列表…'
						: '— 未配置 Token —'));
				dom.content(zoneSelBox, field('选择域名', sel));
				dom.content(loadBtnBox, '');
				dom.content(recBox, '');
				return;
			}

			if (!S.zones.length) {
				sel.disabled = true;
				sel.appendChild(E('option', { 'value': '' }, '— 该 Token 下没有可用域名 —'));
				dom.content(zoneSelBox, field('选择域名', sel,
					'请检查 Token 权限是否含 Zone → Zone → Read'));
				dom.content(loadBtnBox, '');
				dom.content(recBox, '');
				return;
			}
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
					notifyTemp('请先选择域名', 'warning');
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

		// 折叠区标题按钮（带箭头，点击切换）
		function foldHead(label, open, onToggle, extra) {
			var btn = E('button', {
				'class': 'cfd-fold' + (open ? ' open' : ''),
				'type': 'button',
				'aria-expanded': open ? 'true' : 'false'
			}, [
				E('span', { 'class': 'cfd-fold-arrow' }, '▸'),
				E('span', { 'class': 'cfd-fold-label' }, label),
				extra || null
			].filter(function(n) { return n != null; }));
			btn.addEventListener('click', function(ev) {
				ev.preventDefault();
				onToggle();
			});
			return btn;
		}
		// 记录名分段渲染：主机名深色加粗 + 域名后缀胶囊高亮，便于一眼认出域名
		function buildRecName(fullName) {
			var zname = S.selZone ? S.selZone.name : '';
			var host = '';
			var dom = fullName || '';
			if (zname && dom === zname) {
				host = '@';
				dom = zname;
			} else if (zname && dom.length > zname.length + 1 &&
				dom.slice(-(zname.length + 1)) === '.' + zname) {
				host = dom.slice(0, dom.length - zname.length - 1);
				dom = zname;
			}
			var parts = [];
			if (host)
				parts.push(E('span', { 'class': host === '@' ? 'cfd-rn-at' : 'cfd-rn-host' },
					host === '@' ? '@' : host + '.'));
			parts.push(E('span', { 'class': 'cfd-rn-dom', 'style': 'margin-left:0;' }, dom));
			return E('div', { 'class': 'cfd-rec-name' }, parts);
		}

		function buildRecords(noDeal) {
			var wrap = E('div', { 'class': 'cfd-deal-wrap' });
			if (!S.records.length) {
				wrap.appendChild(E('div', { 'class': 'cfd-alert info' },
					'暂无记录（或尚未加载）。展开下方「手动添加解析」添加第一条。'));
				return wrap;
			}
			for (var i = 0; i < S.records.length; i++) {
				var item = buildRecordItem(S.records[i]);
				// 发牌延迟：每条错开 0.10s，最多累计到第 10 条
				// noDeal=true（编辑展开等重绘场景）时不播动画，避免闪烁
				if (!noDeal) {
					var d = (i < 10 ? i : 10) * 0.10;
					item.style.animationDelay = d.toFixed(2) + 's';
				} else {
					item.style.animation = 'none';
				}
				wrap.appendChild(item);
			}
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
			}, isTarget ? '维护中' : '设为维护');
			if (isTarget)
				setBtn.disabled = true;
			setBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				setBtn.disabled = true;
				callSetTarget(S.selZone.id, S.selZone.name, rec.name, rec.type).then(function(r) {
					if (r && r.ok) {
						notifyTemp('已把 ' + rec.name + ' 设为维护', 'info');
						// 局部刷新：重载记录 + 重拉完整状态，不整页重载
						loadRecords(S.selZone.id);
						refreshFull(true);
					} else {
						notifyTemp('失败：' + errText(r), 'danger');
						setBtn.disabled = false;
					}
				}).catch(function(e) {
					notifyTemp('出错：' + (e.message || e), 'danger');
					setBtn.disabled = false;
				});
			});

			var delBtn = E('button', {
				'class': 'btn cbi-button cfd-del'
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
							notifyTemp('已删除。注意：它原先是维护目标，定时任务会重建，建议先切到别的记录', 'warning');
						else
							notifyTemp('已删除 ' + rec.name, 'info');
					} else {
						notifyTemp('删除失败：' + errText(r), 'danger');
						delBtn.disabled = false;
					}
				}).catch(function(e) {
					notifyTemp('出错：' + (e.message || e), 'danger');
					delBtn.disabled = false;
				});
			});

			var editBtn = E('button', {
				'class': 'btn cbi-button cbi-button-action'
			}, S.editingId === rec.id ? '收起' : '编辑');
			editBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				S.editingId = (S.editingId === rec.id) ? '' : rec.id;
				renderRecBox(true);      // 编辑原地展开，不播发牌动画
			});
			var node = E('div', { 'class': 'cfd-rec' + (isTarget ? ' cur' : '') }, [
				head,
				buildRecName(rec.name),
				E('div', { 'class': 'cfd-rec-val' }, rec.content),
				E('div', { 'class': 'cfd-rec-acts' }, [ setBtn, editBtn, delBtn ])
			]);
			if (S.editingId === rec.id)
				node.appendChild(buildEditForm(rec));
			return node;
		}
		// 编辑表单：原地展开，只改这一条
		function buildEditForm(rec) {
			var zname = S.selZone ? S.selZone.name : '';
			// 主机名回填：去掉 zone 后缀，根域名显示 @
			var host = rec.name || '';
			if (zname && host == zname)
				host = '@';
			else if (zname && host.length > zname.length + 1 &&
				host.slice(-(zname.length + 1)) == '.' + zname)
				host = host.slice(0, -(zname.length + 1));

			var tSel = E('select', { 'class': 'cfd-narrow' });
			[ 'A', 'AAAA', 'CNAME', 'TXT' ].forEach(function(t) {
				var o = E('option', { 'value': t }, t);
				if (t === rec.type)
					o.selected = true;
				tSel.appendChild(o);
			});
			var nIn = E('input', {
				'type': 'text', 'class': 'cfd-mono', 'value': host,
				'placeholder': 'home 或 @', 'spellcheck': 'false'
			});
			var cIn = E('input', {
				'type': 'text', 'class': 'cfd-mono', 'value': rec.content || '',
				'placeholder': 'IP 或目标域名', 'spellcheck': 'false'
			});
			var tIn = E('input', {
				'type': 'number', 'value': String(rec.ttl || 120),
				'min': '60', 'max': '86400', 'class': 'cfd-narrow'
			});
			var pChk = E('input', { 'type': 'checkbox' });
			if (rec.proxied)
				pChk.checked = true;
			var pLabel = E('label', {}, [ pChk, E('span', {}, '橙云代理') ]);
			// TXT 不支持橙云
			function syncProxy() {
				var t = tSel.value;
				var can = (t === 'A' || t === 'AAAA' || t === 'CNAME');
				pChk.disabled = !can;
				if (!can)
					pChk.checked = false;
				pLabel.style.opacity = can ? '1' : '.45';
			}
			tSel.addEventListener('change', syncProxy);
			syncProxy();

			var saveB = E('button', {
				'class': 'btn cbi-button cbi-button-apply'
			}, '保存');
			var cancelB = E('button', {
				'class': 'btn cbi-button cbi-button-neutral'
			}, '取消');
			cancelB.addEventListener('click', function(ev) {
				ev.preventDefault();
				S.editingId = '';
				renderRecBox();
			});
			saveB.addEventListener('click', function(ev) {
				ev.preventDefault();
				saveB.disabled = true;
				callUpdateRecord(
					S.selZone.id, S.selZone.name, rec.id,
					tSel.value, (nIn.value || '').trim(), (cIn.value || '').trim(),
					parseInt(tIn.value, 10) || 120, pChk.checked
				).then(function(r) {
					saveB.disabled = false;
					if (!r || !r.ok) {
						notifyTemp('保存失败：' + errText(r), 'danger');
						return;
					}
					var msg = '已更新 ' + r.type + '  ' + r.name;
					if (r.target_updated)
						msg += '（同步更新了维护目标）';
					notifyTemp(msg, 'info');
					S.editingId = '';
					loadRecords(S.selZone.id);
					if (r.target_updated)
						refreshFull(true);
				}).catch(function(e) {
					saveB.disabled = false;
					notifyTemp('保存出错：' + (e.message || e), 'danger');
				});
			});
			return E('div', { 'class': 'cfd-edit' }, [
				E('div', { 'class': 'cfd-edit-title' }, '编辑解析记录'),
				E('div', { 'class': 'cfd-field' }, [
					E('label', {}, '类型 / 主机名'),
					E('div', { 'class': 'cfd-inline' }, [
						E('div', { 'class': 'cfd-fix' }, tSel),
						E('div', { 'class': 'cfd-grow' }, nIn),
						E('div', { 'class': 'cfd-suffix' }, '. ' + zname)
					])
				]),
				E('div', { 'class': 'cfd-field' }, [
					E('label', {}, '记录内容'),
					cIn
				]),
				E('div', { 'class': 'cfd-field' }, [
					E('label', {}, 'TTL'),
					tIn,
					E('div', { 'class': 'cfd-chkrow', 'style': 'margin-top:10px;' }, [ pLabel ])
				]),
				E('div', { 'class': 'cfd-btns' }, [ saveB, cancelB ])
			]);
		}

		// 域名卡骨架：选择器区 + 按钮区 + 记录区 + 表单（表单常驻）
		dom.content(zonesBox, [ zoneSelBox, loadBtnBox, recBox, addForm ]);
		renderZones();   // 首屏先占位渲染「选择域名」下拉框，避免空白期

		// =============================================================
		// 四、异步加载完整状态 / 域名
		// =============================================================

		// 请求序号：并发/连点刷新时，只认最后一次请求的结果，避免旧响应覆盖新数据
		var fullSeq = 0;
		function refreshFull(force) {
			var seq = ++fullSeq;
			callStatus(force ? true : false).then(function(f) {
				if (seq !== fullSeq)
					return;
				applyFull(f);
			}).catch(function() {
				if (seq !== fullSeq)
					return;
				dom.content(matchNode, E('span', { 'class': 'cfd-bad' }, '✗ 状态获取失败'));
				dom.content(wanIpNode, E('span', { 'class': 'cfd-mute' }, '-'));
				dom.content(cfIpNode, E('span', { 'class': 'cfd-mute' }, '-'));
			});
		}

		// 保存 Token 后自动拉取域名（force=true 强制刷新，跳过缓存）
		function autoLoadZones() {
			S.zonesLoading = true;
			S.zonesLoaded = false;
			renderZones();
			return callListZones(true).then(function(r) {
				S.zonesLoading = false;
				if (!r || !r.ok) {
					S.zonesLoaded = false;
					renderZones();
					notifyTemp('获取域名失败：' + errText(r), 'danger');
					return;
				}
				S.zones = r.zones || [];
				S.zonesLoaded = true;
				S.selZone = null;
				for (var i = 0; i < S.zones.length; i++) {
					if (st.domain && st.domain.indexOf(S.zones[i].name) >= 0) {
						S.selZone = S.zones[i];
						break;
					}
				}
				if (!S.selZone && S.zones.length === 1)
					S.selZone = S.zones[0];
				notifyTemp(S.zones.length
					? 'Token 有效，共 ' + S.zones.length + ' 个域名，请选择'
					: 'Token 有效，但账号下没有域名', S.zones.length ? 'info' : 'warning');
				renderZones();
				if (S.selZone)
					loadRecords(S.selZone.id);
			}).catch(function(e) {
				S.zonesLoading = false;
				renderZones();
				notifyTemp('获取域名出错：' + (e.message || e), 'danger');
			});
		}
		// 已有 token 时自动加载域名（命中缓存，快到几乎无感）
		function initZones() {
			if (!cfg.has_token)
				return;
			// 首屏立即进入「加载中」态，让「选择域名」下拉框先占位
			S.zonesLoading = true;
			S.zonesLoaded = false;
			renderZones();
			callListZones(false).then(function(r) {
				S.zonesLoading = false;
				if (!r || !r.ok) {
					// 失败必须复位，否则下拉框永远停在「正在加载域名列表…」
					S.zonesLoaded = false;
					renderZones();
					return;
				}
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
			}).catch(function() {
				S.zonesLoading = false;
				S.zonesLoaded = false;
				renderZones();
			});
		}

		// render 返回后立刻发起异步请求（不阻塞首屏绘制）
		setTimeout(function() {
			refreshFull(false);
			initZones();
		}, 0);

		// =============================================================
		// 五、操作与设置
		// =============================================================

		// 同步执行结果码 -> 文案
		function runCodeText(c) {
			if (c === 0) return '同步成功';
			if (c === 1) return '探测公网 IP 失败';
			if (c === 2) return 'CF 查询失败';
			if (c === 3) return 'CF 写入失败';
			if (c === 4) return '配置文件缺失';
			if (c === 5) return '已有任务运行中，跳过';
			return '执行完成（' + c + '）';
		}
		// 异步执行同步任务：先记录基线 last，再轮询 status_quick 等它变化
		// 目的：run_now 在 rpcd 里是同步阻塞的，遇上 cron 撞锁会超过 rpcd 的 30s 超时
		//       改成轮询后，页面永远不卡，且能看到最终结果
		// 注：runPollTimer 已在文件顶层声明，此处不再重复声明，避免遮蔽。
		function startRun(btn) {
			if (runPollTimer) {
				notifyTemp('已有同步任务在进行中，请稍候…', 'warning', 4000);
				btn.disabled = false;
				return;
			}
			busyShow('正在同步，请稍候…');
			// 结算标志：正常返回与轮询兜底可能都会走到终点，只允许提示一次
			var settled = false;
			function finishRun(c, detail) {
				if (settled)
					return false;
				settled = true;
				if (runPollTimer) {
					clearTimeout(runPollTimer);
					runPollTimer = null;
				}
				busyHide();
				var txt = runCodeText(c);
				if (detail)
					txt += '（' + detail + '）';
				notifyTemp(txt, c === 0 ? 'info' : 'warning', c === 0 ? 2000 : 4000);
				btn.disabled = false;
				refreshFull(true);
				if (S.selZone)
					loadRecords(S.selZone.id);
				return true;
			}
			// 取基线：当前 last 内容，用来判断任务是否已完成
			callStatusQuick().then(function(q0) {
				var baseLast = (q0 && q0.last) ? q0.last : '';
				var ticks = 0;
				var MAX_TICKS = 40;      // 40 次 × 1.5s = 60 秒上限
				// 先把任务提交出去（不等待返回，避免阻塞）
				callRun().then(function(res) {
					// 正常返回：直接出结果（若轮询已先结算则跳过，避免重复提示）
					var c = res ? res.code : -1;
					finishRun(c);
				}).catch(function(e) {
					// rpcd 超时/断开：转入轮询兜底，浮层保留并更新文案
					if (settled)
						return;
					busyUpdate('后台仍在执行，正在等待结果…');
					poll();
				});
				function poll() {
					if (!runPollTimer || settled)
						return;
					ticks++;
					callStatusQuick().then(function(q) {
						if (!runPollTimer || settled)
							return;
						var nowLast = (q && q.last) ? q.last : '';
						if (nowLast && nowLast !== baseLast) {
							// last 变了 = 任务完成
							var m = nowLast.match(/exit=(\d+)/);
							var c = m ? parseInt(m[1], 10) : -1;
							finishRun(c, nowLast);
							return;
						}
						if (ticks >= MAX_TICKS) {
							if (settled)
								return;
							settled = true;
							clearTimeout(runPollTimer);
							runPollTimer = null;
							busyHide();
							notifyTemp('等待超时，请稍后刷新页面查看结果', 'warning', 5000);
							btn.disabled = false;
							return;
						}
						runPollTimer = setTimeout(poll, 1500);
					}).catch(function() {
						if (settled)
							return;
						if (ticks >= MAX_TICKS) {
							settled = true;
							runPollTimer = null;
							busyHide();
							btn.disabled = false;
							return;
						}
						runPollTimer = setTimeout(poll, 1500);
					});
				}
				// 起轮询（延迟 1.5s 首次，给任务一点启动时间）
				runPollTimer = setTimeout(poll, 1500);
			}).catch(function(e) {
				if (settled)
					return;
				settled = true;
				busyHide();
				notifyTemp('提交失败：' + (e.message || e), 'danger', 5000);
				btn.disabled = false;
			});
		}
		var runBtn = okBtn('立即同步', 'action', function(btn) {
			startRun(btn);
		});

		var probeBtn = okBtn('测试探测', 'neutral', function(btn) {
			callProbe(true).then(function(res) {
				if (res && res.ip) {
					var txt = '公网 IP：' + res.ip;
					if (res.agree >= 2)
						txt += '（' + res.agree + ' 源一致）';
					notifyTemp(txt, 'info');
				} else {
					notifyTemp('探测失败：所有源无响应', 'danger');
				}
				btn.disabled = false;
				refreshFull(false);
			}).catch(function(e) {
				notifyTemp('探测出错：' + (e.message || e), 'danger');
				btn.disabled = false;
			});
		});

		function setCron(enabled, minutes, btn) {
			return callSet(enabled, minutes).then(function(r) {
				var c2 = (r && r.enabled != null) ? r : null;
				var on = c2 ? c2.enabled : enabled;
				var mi = c2 ? (c2.minutes || 1) : minutes;
				notifyTemp(on ? ('已启用，每 ' + mi + ' 分钟') : '已停用', 'info');
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
				notifyTemp('失败：' + (e.message || e), 'danger');
				if (btn)
					btn.disabled = false;
			});
		}

		function buildToggleBtn() {
			return okBtn(cron.enabled ? '停用' : '启用',
				cron.enabled ? 'reset' : 'apply', function(btn) {
				setCron(!cron.enabled, cron.minutes || 1, btn);
			});
		}

		var toggleNode = E('div', {});
		dom.content(toggleNode, buildToggleBtn());

		var refreshBtn = okBtn('刷新', 'neutral', function(btn) {
			btn.disabled = false;
			// 状态与记录并行请求，避免串行等待（原先状态回来才发记录请求）
			refreshFull(true);
			if (S.selZone)
				loadRecords(S.selZone.id);
			notifyTemp('已刷新', 'info');
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
		], 'cfdLockCtrl', 'ctrlOpen');

		// =============================================================
		// 六、说明
		// =============================================================

		var helpCard = card('说明', [
			E('div', { 'class': 'cfd-hint', 'style': 'margin-top:0;line-height:1.55;' }, [
				E('div', {}, '维护的是一条指定解析记录，内容为路由器真实公网出口 IPv4。'),
				E('div', {}, 'PPPoE 拿到的是运营商 NAT 内网地址，本地查不到真实出口，故用外部服务多源探测并交叉验证。'),
				E('div', {}, '配置：/etc/cfddns.conf（改完即时生效，无需重启）'),
				E('div', {}, '日志：/tmp/cfddns.log（重启清空）'),
				E('div', { 'style': 'color:#94a3b8;font-size:11px;margin-top:6px;' }, 'UI 版本：v5-notifytemp')
			])
		]);

		// =============================================================
		// 组装
		// =============================================================

		return E('div', { 'class': 'cbi-map cfd-wrap' + (onNow ? '' : ' cfd-off'), 'id': 'cfdWrap' }, [
			E('style', {}, CSS),
			E('h2', { 'name': 'content', 'style': 'font-size:18px;margin:0 0 2px 0;' },
				'Cloudflare 动态域名'),
			E('div', { 'style': 'font-size:12px;color:#94a3b8;margin-bottom:10px;' },
				'自动同步公网出口 IPv4 到 Cloudflare DNS'),
			switchCard,
			statusCard,
			tokenCard,
			zonesCard,
			controlCard,
			helpCard
		]);
	}
});