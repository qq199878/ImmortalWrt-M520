'use strict';'require view';'require ui';'require form';'require rpc';'require uci';'require fs';'require poll';'require tools.widgets as widgets';const startupConf=[[form.Flag,'stdout',_('Log stdout')],[form.Flag,'stderr',_('Log stderr')],[widgets.UserSelect,'user',_('Run daemon as user')],[widgets.GroupSelect,'group',_('Run daemon as group')],[form.Flag,'respawn',_('Respawn when crashed')],[form.DynamicList,'env',_('Environment variable'),_('OS environments pass to frp for config file template, see %s.'.format('<a href="https://github.com/fatedier/frp#configuration-file-template">frp README</a>')),{placeholder:'ENV_NAME=value'}],[form.DynamicList,'conf_inc',_('Additional configs'),_('Config files include in temporary config file'),{placeholder:'/etc/frp/frpc.d/frpc_full.ini'}]];const commonConf=[[form.Value,'server_addr',_('Server address'),_('ServerAddr specifies the address of the server to connect to.<br />By default, this value is "127.0.0.1".'),{datatype:'host'}],[form.Value,'server_port',_('Server port'),_('ServerPort specifies the port to connect to the server on.<br />By default, this value is 7000.'),{datatype:'port'}],[form.Value,'token',_('Token'),_('Token specifies the authorization token used to create keys to be sent to the server. The server must have a matching token for authorization to succeed. <br />By default, this value is "".')],[form.Flag,'tcp_mux',_('TCP mux'),_('TcpMux toggles TCP stream multiplexing. This allows multiple requests from a client to share a single TCP connection. If this value is true, the server must have TCP multiplexing enabled as well.<br />By default, this value is true.'),{datatype:'bool',default:'true'}],[form.ListValue,'protocol',_('Protocol'),_('Protocol specifies the protocol to use when interacting with the server. Valid values are "tcp", "kcp", "quic" and "websocket".<br />By default, this value is "tcp".'),{values:['tcp','kcp','quic','websocket']}],[form.Flag,'tls_enable',_('TLS'),_('TLS Enable specifies whether or not TLS should be used when communicating with the server.'),{datatype:'bool'}],[form.Value,'http_proxy',_('HTTP proxy'),_('HttpProxy specifies a proxy address to connect to the server through. If this value is "", the server will be connected to directly.<br />By default, this value is read from the "http_proxy" environment variable.')],[form.Value,'log_file',_('Log file'),_('LogFile specifies a file where logs will be written to. This value will only be used if LogWay is set appropriately.<br />By default, this value is "console".')],[form.ListValue,'log_level',_('Log level'),_('LogLevel specifies the minimum log level. Valid values are "trace", "debug", "info", "warn", and "error".<br />By default, this value is "info".'),{values:['trace','debug','info','warn','error']}],[form.Value,'log_max_days',_('Log max days'),_('LogMaxDays specifies the maximum number of days to store log information before deletion. This is only used if LogWay == "file".<br />By default, this value is 0.'),{datatype:'uinteger'}],[form.Flag,'disable_log_color',_('Disable log color'),_('DisableLogColor disables log colors when LogWay == "console" when set to true.'),{datatype:'bool',default:'false'}],[form.Value,'admin_addr',_('Admin address'),_('AdminAddr specifies the address that the admin server binds to.<br />By default, this value is "0.0.0.0".'),{datatype:'ipaddr'}],[form.Value,'admin_port',_('Admin port'),_('AdminPort specifies the port for the admin server to listen on. If this value is 0, the admin server will not be started.<br />By default, this value is 0.'),{datatype:'port'}],[form.Value,'admin_user',_('Admin user'),_('AdminUser specifies the username that the admin server will use for login.<br />By default, this value is "admin".')],[form.Value,'admin_pwd',_('Admin password'),_('AdminPwd specifies the password that the admin server will use for login.<br />By default, this value is "admin".'),{password:true}],[form.Value,'assets_dir',_('Assets dir'),_('AssetsDir specifies the local directory that the admin server will load resources from. If this value is "", assets will be loaded from the bundled executable using statik.<br />By default, this value is "".')],[form.Value,'user',_('User'),_('User specifies a prefix for proxy names to distinguish them from other clients. If this value is not "", proxy names will automatically be changed to "{user}.{proxy_name}".<br />By default, this value is "".')],[form.Flag,'login_fail_exit',_('Exit when login fail'),_('LoginFailExit controls whether or not the client should exit after a failed login attempt. If false, the client will retry until a login attempt succeeds.<br />By default, this value is true.'),{datatype:'bool',default:'true'}],[form.Value,'heartbeat_interval',_('Heartbeat interval'),_('HeartBeatInterval specifies at what interval heartbeats are sent to the server, in seconds. It is not recommended to change this value.<br />By default, this value is 30.'),{datatype:'uinteger'}],[form.Value,'heartbeat_timeout',_('Heartbeat timeout'),_('HeartBeatTimeout specifies the maximum allowed heartbeat response delay before the connection is terminated, in seconds. It is not recommended to change this value.<br />By default, this value is 90.'),{datatype:'uinteger'}],[form.DynamicList,'_',_('Additional settings'),_('This list can be used to specify some additional parameters which have not been included in this LuCI.'),{placeholder:'Key-A=Value-A'}]];
const baseProxyConf=[
    [form.Value,'remark',_('备注名称'),_('自定义备注，如：客厅摄像头、群晖NAS、网页'),{optional:true}],
    [form.Value,'name',_('代理名称'),_('英文标识，全局唯一，如 router、nas_ssh'),{rmempty:false,optional:false,placeholder:'例如: router、nas_ssh'}],
    [form.ListValue,'type',_('代理类型'),undefined,{values:['tcp','udp','http','https','stcp','xtcp']}],
    [form.Value,'local_ip',_('本地 IP'),_('内网目标设备 IP，可直接下拉选择扫描到的局域网设备'),{datatype:'host'}],
    [form.Value,'local_port',_('本地端口'),_('内网目标服务监听端口（1-65535）'),{datatype:'port'}],
    [form.Value,'remote_port',_('远程端口'),_('公网映射访问端口（填 0 由服务端自动分配）'),{datatype:'port',depends:[{type:'tcp'},{type:'udp'}]}],
    [form.Flag,'use_encryption',_('数据加密'),_('开启后通信数据将加密传输'),{datatype:'bool'}],
    [form.Flag,'use_compression',_('数据压缩'),_('开启后通信数据将压缩传输'),{datatype:'bool'}],
];
const bindInfoConf=[];
const domainConf=[
    [form.Value,'custom_domains',_('自定义域名'),_('绑定已解析到服务器的域名')],
    [form.Value,'subdomain',_('二级子域名')],
];
const httpProxyConf=[
    [form.Value,'locations',_('URL 路由路径')],
    [form.Value,'http_user',_('HTTP 认证账号')],
    [form.Value,'http_pwd',_('HTTP 认证密码')],
    [form.Value,'host_header_rewrite',_('重写 Host 头')],
];
const stcpProxyConf=[
    [form.ListValue,'role',_('角色'),undefined,{values:['server','visitor']}],
    [form.Value,'server_name',_('服务名称'),undefined,{depends:[{role:'visitor'}]}],
    [form.Value,'bind_addr',_('绑定地址'),undefined,{depends:[{role:'visitor'}]}],
    [form.Value,'bind_port',_('绑定端口'),undefined,{depends:[{role:'visitor'}]}],
    [form.Value,'sk',_('访问密钥')],
];
const pluginConf=[
    [form.ListValue,'plugin',_('插件类型'),undefined,{values:['','http_proxy','socks5','unix_domain_socket'],rmempty:true}],
    [form.Value,'plugin_http_user',_('HTTP 代理账号'),undefined,{depends:{plugin:'http_proxy'}}],
    [form.Value,'plugin_http_passwd',_('HTTP 代理密码'),undefined,{depends:{plugin:'http_proxy'}}],
    [form.Value,'plugin_user',_('SOCKS5 代理账号'),undefined,{depends:{plugin:'socks5'}}],
    [form.Value,'plugin_passwd',_('SOCKS5 代理密码'),undefined,{depends:{plugin:'socks5'}}],
    [form.Value,'plugin_unix_path',_('Unix 域套接字路径'),undefined,{depends:{plugin:'unix_domain_socket'},optional:true,rmempty:true,datatype:'file',placeholder:'/var/run/docker.sock',default:'/var/run/docker.sock'}],
];
function setParams(o,params){if(!params)return;for(let key in params){let val=params[key];if(key==='values'){for(let v of val){let args=v;if(!Array.isArray(args))
args=[args];o.value.apply(o,args);}}else if(key==='depends'){if(!Array.isArray(val))
val=[val];const deps=[];for(let v of val){const d={};for(let vkey in v)
d[vkey]=v[vkey];for(let od of o.deps){for(let dkey in od){d[dkey]=od[dkey];}}
deps.push(d);}
o.deps=deps;}else{o[key]=params[key];}}
if(params['datatype']==='bool'){o.enabled='true';o.disabled='false';}}
function defTabOpts(s,t,opts,params){for(let opt of opts){const o=s.taboption(t,opt[0],opt[1],opt[2],opt[3]);setParams(o,opt[4]);setParams(o,params);}}
function defOpts(s,opts,params){for(let opt of opts){const o=s.option(opt[0],opt[1],opt[2],opt[3]);setParams(o,opt[4]);setParams(o,params);}}
const callServiceList=rpc.declare({object:'service',method:'list',params:['name'],expect:{'':{}}});
const callLuciHostHints=rpc.declare({object:'luci-rpc',method:'getHostHints',expect:{'':{}}});
const callLuciDHCPLeases=rpc.declare({object:'luci-rpc',method:'getDHCPLeases',expect:{'':{}}});

function getLocalIPChoices(hosts, leases) {
    const choices = {};
    const order = [];

    function addChoice(ip, desc) {
        if (!ip || choices[ip]) return;
        choices[ip] = desc ? (ip + ' (' + desc + ')') : ip;
        order.push(ip);
    }

    // 1. 本机与网关
    addChoice('127.0.0.1', _('Localhost / Router'));
    addChoice('192.168.1.1', 'ImmortalWrt');

    // 2. 从已有穿透规则提取已配过的 local_ip 及其中文备注
    try {
        if (typeof uci !== 'undefined' && uci.sections) {
            const sections = uci.sections('frpc', 'conf');
            for (let sec of sections) {
                const lip = sec.local_ip;
                const rmk = sec.remark || sec.name;
                if (lip && !choices[lip]) {
                    addChoice(lip, rmk ? rmk : _('Existing proxy'));
                }
            }
        }
    } catch(e) {}

    // 3. 从 DHCP 租约提取在线设备
    if (Array.isArray(leases)) {
        for (let l of leases) {
            const ip = l.ipaddr;
            const name = l.hostname;
            if (ip && !choices[ip]) {
                addChoice(ip, name || null);
            }
        }
    }

    // 4. 从 HostHints 提取已知局域网设备
    if (hosts && typeof hosts === 'object') {
        for (let mac in hosts) {
            const h = hosts[mac];
            const name = (h.name || '').replace(/\.lan$/, '');
            const ipaddrs = Array.isArray(h.ipaddrs) ? h.ipaddrs : (h.ipv4 ? [h.ipv4] : []);
            for (let ip of ipaddrs) {
                if (ip && !choices[ip]) {
                    addChoice(ip, name || null);
                }
            }
        }
    }

    // 5. 按 IP 自然升序排序 (127.0.0.1 与 192.168.1.1 固定置顶)
    order.sort(function(a, b) {
        if (a === '127.0.0.1') return -1;
        if (b === '127.0.0.1') return 1;
        if (a === '192.168.1.1') return -1;
        if (b === '192.168.1.1') return 1;
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    return { choices: choices, order: order };
}function getServiceStatus(){return L.resolveDefault(callServiceList('frpc'),{}).then(function(res){let isRunning=false;try{isRunning=res['frpc']['instances']['instance1']['running'];}catch(e){}
return isRunning;});}
function renderStatus(isRunning){
    if (isRunning) {
        return '<span class="frpc-status-badge frpc-status-running">' +
               '<span class="frpc-status-dot"></span>' +
               '<span class="frpc-status-text">' + _('RUNNING') + '</span>' +
               '</span>';
    } else {
        return '<span class="frpc-status-badge frpc-status-stopped">' +
               '<span class="frpc-status-dot"></span>' +
               '<span class="frpc-status-text">' + _('NOT RUNNING') + '</span>' +
               '</span>';
    }
}
return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(callLuciHostHints(), {}),
            L.resolveDefault(callLuciDHCPLeases(), {}),
            uci.load('frpc')
        ]);
    },
    render: function(data) {
        const hosts = (data && data[0]) ? data[0] : {};
        const leases = (data && data[1] && data[1].dhcp_leases) ? data[1].dhcp_leases : [];
        const ipData = getLocalIPChoices(hosts, leases);

        let m,s,o;
        m=new form.Map('frpc',_('frp Client'));
var s_common=m.section(form.NamedSection,'common','conf');s_common.dynamic=true;s_common.tab('common',_('Common Settings'));s_common.tab('init',_('Startup Settings'));defTabOpts(s_common,'common',commonConf,{optional:true});o=s_common.taboption('init',form.SectionValue,'init',form.TypedSection,'init',_('Startup Settings'));var s_init=o.subsection;s_init.anonymous=true;s_init.dynamic=true;defOpts(s_init,startupConf);s=s_common;s=m.section(form.GridSection,'conf',_('Proxy Settings'));s.anonymous=true;s.addremove=true;s.sortable=true;s.addbtntitle=_('Add new proxy...');s.filter=function(s){return s!=='common';};s.tab('general',_('General Settings'));s.tab('http',_('HTTP Settings'));s.tab('plugin',_('Plugin Settings'));var o_name=s.option(form.Value,'name',_('Proxy name'));o_name.modalonly=false;o_name.textvalue=function(sid){var n=this.cfgvalue(sid)||sid,r=null;try{if(typeof uci!=='undefined'&&uci.get){r=uci.get('frpc',sid,'remark');}else if(this.section&&this.section.map&&this.section.map.data){r=this.section.map.data.get('frpc',sid,'remark');}}catch(e){}if(r&&String(r).trim()!==''){return E('span',{'class':'frpc-name-composite'},[E('span',{'class':'frpc-remark-title'},r),E('span',{'class':'frpc-name-sub'},' ('+n+')')]);}return n;};s.option(form.Value,'type',_('Proxy type')).modalonly=false;s.option(form.Value,'local_ip',_('Local IP')).modalonly=false;s.option(form.Value,'local_port',_('Local port')).modalonly=false;o=s.option(form.Value,'remote_port',_('Remote port'));o.modalonly=false;o.depends('type','tcp');o.depends('type','udp');o.cfgvalue=function(){const v=this.super('cfgvalue',arguments);return v&&v!='0'?v:'#';};defTabOpts(s,'general',baseProxyConf,{modalonly:true});
        for (let opt of s.children) {
            if (opt.option === 'local_ip') {
                for (let ip of ipData.order) {
                    opt.value(ip, ipData.choices[ip]);
                }
            }
        }defTabOpts(s,'general',bindInfoConf,{optional:true,modalonly:true,depends:[{type:'tcp'},{type:'udp'}]});defTabOpts(s,'http',domainConf,{optional:true,modalonly:true,depends:[{type:'http'},{type:'https'}]});defTabOpts(s,'http',httpProxyConf,{optional:true,modalonly:true,depends:{type:'http'}});defTabOpts(s,'general',stcpProxyConf,{optional:true,modalonly:true,depends:[{type:'stcp'},{type:'xtcp'}]});defTabOpts(s,'plugin',pluginConf,{optional:true,modalonly:true});return m.render().then(function(node) {
    var style = E('style', { type: 'text/css' }, `
        /* 顶部标题与状态指示同行并列 */
        .cbi-map > h2[name="content"],
        .frpc-main-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 12px 18px !important;
            margin: 0 0 12px 0 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03) !important;
            box-sizing: border-box !important;
            min-height: 52px !important;
        }
        [data-theme="dark"] .cbi-map > h2[name="content"],
        [data-theme="dark"] .frpc-main-header {
            background: #1e222d !important;
            color: #f1f5f9 !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25) !important;
        }
        .frpc-header-title-text {
            font-size: 1.25rem !important;
            font-weight: 700 !important;
            color: #172b4d !important;
            line-height: 1.2 !important;
            letter-spacing: -0.2px !important;
        }
        [data-theme="dark"] .frpc-header-title-text {
            color: #f1f5f9 !important;
        }
        .frpc-header-status {
            display: inline-flex !important;
            align-items: center !important;
            margin-left: auto !important;
        }
        /* 状态胶囊徽章 */
        .frpc-status-badge {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 4px 12px !important;
            border-radius: 20px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            line-height: 1 !important;
            letter-spacing: 0.3px !important;
            transition: all 0.3s ease !important;
            user-select: none !important;
        }
        .frpc-status-badge.frpc-status-running {
            background: rgba(45, 206, 137, 0.12) !important;
            color: #2dce89 !important;
            border: 1px solid rgba(45, 206, 137, 0.3) !important;
        }
        .frpc-status-badge.frpc-status-stopped {
            background: rgba(245, 54, 92, 0.12) !important;
            color: #f5365c !important;
            border: 1px solid rgba(245, 54, 92, 0.3) !important;
        }
        .frpc-status-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            display: inline-block !important;
            flex-shrink: 0 !important;
        }
        .frpc-status-running .frpc-status-dot {
            background: #2dce89 !important;
            box-shadow: 0 0 6px #2dce89 !important;
            animation: frpcPulse 2s infinite ease-in-out !important;
        }
        .frpc-status-stopped .frpc-status-dot {
            background: #f5365c !important;
        }
        @keyframes frpcPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.28); opacity: 0.75; }
        }
        .frpc-name-composite {
            display: inline-flex !important;
            align-items: baseline !important;
            gap: 4px !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        .frpc-remark-title {
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
        }
        [data-theme="dark"] .frpc-remark-title,
        .dark-theme .frpc-remark-title {
            color: #f8fafc !important;
        }
        .frpc-name-sub {
            font-size: 11px !important;
            font-weight: 500 !important;
            color: #94a3b8 !important;
        }

        /* 移动端排版深度自适应 (宽度 <= 992px) - 紧凑矮版精调 */
        @media screen and (max-width: 992px) {
            .cbi-section-node {
                overflow-x: visible !important;
                padding: 0 !important;
            }
            .cbi-section-table thead,
            .cbi-section-table .thead,
            .cbi-section-table .tr.table-titles,
            .cbi-section-table .tr.cbi-section-table-titles {
                display: none !important;
            }
            .cbi-section-table tbody,
            .cbi-section-table .tbody {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                width: 100% !important;
                padding: 2px 0 !important;
            }

            /* 每条规则卡片化容器 - 鲜明立体分割与左侧边界条 */
            .cbi-section-table-row {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                grid-template-areas:
                    "name    type"
                    "ip      port"
                    "remote  remote"
                    "actions actions" !important;
                row-gap: 6px !important;
                column-gap: 6px !important;
                align-items: center !important;
                background: #ffffff !important;
                border: 1px solid #cbd5e1 !important;
                border-left: 4px solid #5e72e4 !important;
                border-radius: 10px !important;
                padding: 8px 12px !important;
                box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04) !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                position: relative !important;
            }
            [data-theme="dark"] .cbi-section-table-row,
            .dark-theme .cbi-section-table-row {
                background: #232733 !important;
                border-color: #3b4252 !important;
                border-left: 4px solid #5e72e4 !important;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
            }

            /* 1. 代理名称 (name) - 高度紧凑 */
            .cbi-section-table-row > .cbi-value-field[data-name="name"] {
                grid-area: name !important;
                display: flex !important;
                align-items: center !important;
                font-size: 15px !important;
                font-weight: 700 !important;
                color: #0f172a !important;
                line-height: 1.2 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                text-align: left !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="name"] {
                color: #f8fafc !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="name"]::before {
                display: none !important;
                content: none !important;
            }

            /* 2. 协议类型 (type) - 精致微胶囊 */
            .cbi-section-table-row > .cbi-value-field[data-name="type"] {
                grid-area: type !important;
                justify-self: end !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 10px !important;
                font-weight: 700 !important;
                letter-spacing: 0.5px !important;
                text-transform: uppercase !important;
                color: #4f46e5 !important;
                background: rgba(79, 70, 229, 0.1) !important;
                border: 1px solid rgba(79, 70, 229, 0.2) !important;
                border-radius: 12px !important;
                padding: 1px 8px !important;
                height: 19px !important;
                line-height: 1 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                border-style: solid !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="type"] {
                color: #818cf8 !important;
                background: rgba(129, 140, 248, 0.15) !important;
                border-color: rgba(129, 140, 248, 0.25) !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="type"]::before {
                display: none !important;
                content: none !important;
            }

            /* 3. 本地 IP 与 本地端口 - 矮平卡槽 */
            .cbi-section-table-row > .cbi-value-field[data-name="local_ip"],
            .cbi-section-table-row > .cbi-value-field[data-name="local_port"] {
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                background: #f8fafc !important;
                border: 1px solid rgba(226, 232, 240, 0.8) !important;
                border-radius: 8px !important;
                padding: 5px 10px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #334155 !important;
                text-align: left !important;
                line-height: 1.2 !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="local_ip"] {
                grid-area: ip !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="local_port"] {
                grid-area: port !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="local_ip"],
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="local_port"] {
                background: rgba(255, 255, 255, 0.03) !important;
                border-color: rgba(255, 255, 255, 0.08) !important;
                color: #e2e8f0 !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="local_ip"]::before {
                content: "本地 IP" !important;
                display: block !important;
                font-size: 10px !important;
                font-weight: 500 !important;
                color: #94a3b8 !important;
                margin-bottom: 2px !important;
                letter-spacing: 0.3px !important;
                line-height: 1 !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="local_port"]::before {
                content: "本地端口" !important;
                display: block !important;
                font-size: 10px !important;
                font-weight: 500 !important;
                color: #94a3b8 !important;
                margin-bottom: 2px !important;
                letter-spacing: 0.3px !important;
                line-height: 1 !important;
            }

            /* 4. 远程映射端口 (remote_port) - 矮槽横条 */
            .cbi-section-table-row > .cbi-value-field[data-name="remote_port"] {
                grid-area: remote !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: rgba(16, 185, 129, 0.07) !important;
                border: 1px solid rgba(16, 185, 129, 0.25) !important;
                border-radius: 8px !important;
                padding: 5px 10px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                color: #059669 !important;
                text-align: right !important;
                line-height: 1.2 !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="remote_port"],
            .dark-theme .cbi-section-table-row > .cbi-value-field[data-name="remote_port"] {
                background: rgba(16, 185, 129, 0.12) !important;
                border-color: rgba(16, 185, 129, 0.3) !important;
                color: #34d399 !important;
            }
            .cbi-section-table-row > .cbi-value-field[data-name="remote_port"]::before {
                content: "➔  远程映射端口" !important;
                display: inline-block !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: #047857 !important;
                letter-spacing: 0.2px !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-value-field[data-name="remote_port"]::before {
                color: #6ee7b7 !important;
            }

            /* 5. 操作栏 (actions) - 矮按钮与紧凑边距 */
            .cbi-section-table-row .drag-handle,
            .cbi-section-table-row .cbi-button-up,
            .cbi-section-table-row .cbi-button-down {
                display: none !important;
            }
            .cbi-section-table-row > .cbi-section-table-cell.cbi-section-actions,
            .cbi-section-table-row > td:last-child {
                grid-area: actions !important;
                display: flex !important;
                justify-content: flex-end !important;
                align-items: center !important;
                gap: 8px !important;
                padding: 6px 0 0 0 !important;
                margin-top: 2px !important;
                border-top: 1px solid rgba(226, 232, 240, 0.7) !important;
                border-bottom: none !important;
                text-align: right !important;
                box-sizing: border-box !important;
            }
            [data-theme="dark"] .cbi-section-table-row > .cbi-section-table-cell.cbi-section-actions,
            [data-theme="dark"] .cbi-section-table-row > td:last-child {
                border-top-color: rgba(255, 255, 255, 0.08) !important;
            }
            .cbi-section-table-row .cbi-button {
                height: 26px !important;
                line-height: 26px !important;
                padding: 0 12px !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                border-radius: 6px !important;
                margin: 0 !important;
                box-shadow: none !important;
            }
            .cbi-section-table-row .cbi-button-neutral {
                background: #f1f5f9 !important;
                color: #334155 !important;
                border: 1px solid rgba(203, 213, 225, 0.8) !important;
            }
            [data-theme="dark"] .cbi-section-table-row .cbi-button-neutral {
                background: #334155 !important;
                color: #f1f5f9 !important;
                border-color: rgba(255, 255, 255, 0.1) !important;
            }
            .cbi-section-table-row .cbi-button-remove {
                background: rgba(239, 68, 68, 0.1) !important;
                color: #ef4444 !important;
                border: 1px solid rgba(239, 68, 68, 0.2) !important;
            }
            [data-theme="dark"] .cbi-section-table-row .cbi-button-remove {
                background: rgba(239, 68, 68, 0.15) !important;
                color: #f87171 !important;
                border-color: rgba(239, 68, 68, 0.3) !important;
            }
        }
    
        /* 常规、启动与运行日志 Tab 栏容器（支持再次点击折叠收起） */
        .frpc-common-section {
            margin-bottom: 16px !important;
            transition: margin-bottom 0.25s ease;
        }
        .frpc-common-section.frpc-section-collapsed {
            margin-bottom: 6px !important;
        }
        .frpc-common-section .cbi-tabmenu {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 4px 2px 10px 2px !important;
            background: transparent !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
            overflow-x: auto !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        [data-theme="dark"] .frpc-common-section .cbi-tabmenu {
            border-bottom-color: rgba(255, 255, 255, 0.08) !important;
        }
        .frpc-common-section .cbi-tabmenu li,
        .frpc-common-section.frpc-section-collapsed .cbi-tabmenu li {
            flex-shrink: 0 !important;
            list-style: none !important;
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .frpc-common-section .cbi-tabmenu li > a {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 20px !important;
            padding: 5px 16px !important;
            font-size: 13px !important;
            text-decoration: none !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
            border: 1px solid transparent !important;
            -webkit-tap-highlight-color: transparent !important;
            user-select: none !important;
        }
        /* 激活选中的 Tab 胶囊（无论展开还是收起，始终纯净亮蓝高光） */
        .frpc-common-section .cbi-tabmenu li.cbi-tab > a,
        .frpc-common-section.frpc-section-collapsed .cbi-tabmenu li.cbi-tab > a {
            background: #5e72e4 !important;
            color: #ffffff !important;
            font-weight: 600 !important;
            border-color: #5e72e4 !important;
            box-shadow: 0 2px 6px rgba(94, 114, 228, 0.35) !important;
        }
        /* 未激活的 Tab 胶囊 */
        .frpc-common-section .cbi-tabmenu li.cbi-tab-disabled > a {
            background: rgba(0, 0, 0, 0.04) !important;
            color: #64748b !important;
            font-weight: 500 !important;
            border-color: rgba(0, 0, 0, 0.06) !important;
        }
        .frpc-common-section .cbi-tabmenu li.cbi-tab-disabled > a:hover {
            background: rgba(94, 114, 228, 0.08) !important;
            color: #5e72e4 !important;
        }
        [data-theme="dark"] .frpc-common-section .cbi-tabmenu li.cbi-tab-disabled > a {
            background: rgba(255, 255, 255, 0.06) !important;
            color: #94a3b8 !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
        }
        [data-theme="dark"] .frpc-common-section .cbi-tabmenu li.cbi-tab-disabled > a:hover {
            background: rgba(94, 114, 228, 0.15) !important;
            color: #a3b2f9 !important;
        }

        /* 内容区折叠 */
        #cbi-frpc-common.frpc-content-collapsed {
            display: none !important;
        }

        /* 运行日志面板（Log Pane）样式 */
        .frpc-log-pane {
            display: none !important;
            margin-top: 8px;
            border-radius: 12px;
            background: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
            overflow: hidden;
        }
        .frpc-log-pane[data-tab-active="true"] {
            display: block !important;
        }
        [data-theme="dark"] .frpc-log-pane {
            background: #1e2433;
            border-color: rgba(255, 255, 255, 0.08);
        }
        .frpc-log-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: #f8fafc;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            flex-wrap: wrap;
            gap: 8px;
        }
        [data-theme="dark"] .frpc-log-header {
            background: #181d2a;
            border-bottom-color: rgba(255, 255, 255, 0.06);
        }
        .frpc-log-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #334155;
        }
        [data-theme="dark"] .frpc-log-header-left {
            color: #e2e8f0;
        }
        .frpc-log-counter {
            font-size: 12px;
            color: #94a3b8;
            font-weight: normal;
        }
        .frpc-log-header-right {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .frpc-log-auto-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #64748b;
            margin-right: 4px;
            cursor: pointer;
            user-select: none;
        }
        [data-theme="dark"] .frpc-log-auto-label {
            color: #94a3b8;
        }
        .frpc-log-btn {
            padding: 4px 10px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            line-height: 1.4 !important;
            height: auto !important;
            min-height: unset !important;
            margin: 0 !important;
        }
        .frpc-log-body {
            padding: 0;
            background: #0f172a;
        }
        .frpc-log-output {
            margin: 0;
            padding: 12px 14px;
            min-height: 260px;
            max-height: 480px;
            overflow-y: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            font-size: 11.5px !important;
            line-height: 1.6 !important;
            color: #cbd5e1;
            background: #0f172a;
            border: none;
            border-radius: 0;
            white-space: pre-wrap;
            word-break: break-all;
            box-sizing: border-box;
        }
        .frpc-log-line {
            padding: 1px 0;
        }
        .frpc-log-line.frpc-log-err {
            color: #f87171 !important;
            font-weight: 500;
        }
        .frpc-log-line.frpc-log-ok {
            color: #4ade80 !important;
        }
        .frpc-log-line.frpc-log-warn {
            color: #facc15 !important;
        }
        .frpc-log-line.frpc-log-dim {
            color: #64748b !important;
            font-style: italic;
        }

        /* ================= 移动端编辑弹窗 (Modal) 精细化排版与轻量美化 ================= */
        @media screen and (max-width: 992px) {
                    /* ===== 核心修复：防止表单验证提示 (Tooltip) 飞出屏幕或被平移移出弹窗 ===== */
        .cbi-tooltip {
            transform: translateY(4px) !important; /* 彻底去除 Argon 原生 translate(-50%, 10%) 导致的左偏出屏幕 Bug */
            max-width: calc(100vw - 32px) !important;
            white-space: normal !important;
            word-break: break-word !important;
            border-radius: 6px !important;
            box-shadow: 0 4px 16px rgba(15, 23, 42, 0.16) !important;
            z-index: 100005 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            padding: 4px 9px !important;
            margin-left: 0 !important;
        }
        .cbi-tooltip.error {
            background: #fff5f5 !important;
            color: #e53e3e !important;
            border: 1px solid #feb2b2 !important;
        }
        [data-theme="dark"] .cbi-tooltip,
        .dark-theme .cbi-tooltip {
            background: #232733 !important;
            color: #f1f5f9 !important;
            border: 1px solid #3b4252 !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
        }
        [data-theme="dark"] .cbi-tooltip.error,
        .dark-theme .cbi-tooltip.error {
            background: #2d1d24 !important;
            color: #fc8181 !important;
            border-color: #742a2a !important;
        }

        /* 1. 弹窗容器外框优化：居中悬浮卡片感，舒适内边距与大圆角 */
            .modal.cbi-modal {
                width: 94% !important;
                max-width: 580px !important;
                margin: 16px auto !important;
                padding: 10px 14px !important;
                border-radius: 14px !important;
                background: #ffffff !important;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22) !important;
                border: 1px solid rgba(226, 232, 240, 0.9) !important;
                box-sizing: border-box !important;
            }
            [data-theme="dark"] .modal.cbi-modal,
            .dark-theme .modal.cbi-modal {
                background: #1e222d !important;
                border-color: #333a4d !important;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6) !important;
            }

            /* 2. 弹窗标题 (h4)：圆润顶部、清晰分割线 */
            .modal.cbi-modal > h4 {
                font-size: 14px !important;
                font-weight: 700 !important;
                color: #172b4d !important;
                background: #f8fafc !important;
                padding: 8px 14px !important;
                margin: -10px -14px 6px -14px !important;
                border-bottom: 1px solid #edf2f9 !important;
                border-radius: 14px 14px 0 0 !important;
                line-height: 1.2 !important;
                box-shadow: none !important;
            }
            [data-theme="dark"] .modal.cbi-modal > h4,
            .dark-theme .modal.cbi-modal > h4 {
                background: #232733 !important;
                color: #f1f5f9 !important;
                border-bottom-color: #333a4d !important;
            }

            /* 3. 弹窗内部彻底扁平化：杜绝主页面 .cbi-map > .cbi-section 卡片样式击穿弹窗，彻底清除外层包裹大框 */
            .modal.cbi-modal .cbi-map,
            .modal.cbi-modal .cbi-map > .cbi-section,
            .modal.cbi-modal .cbi-section,
            .modal.cbi-modal .cbi-section-node {
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
            }
            /* 弹窗内的 Tab 标签栏 (常规/插件)：彻底去除外层灰色槽底与描边边框，回归独立纯净胶囊形态 */
            .modal.cbi-modal .cbi-tabmenu {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 0 0 4px 0 !important;
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                border-bottom: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                margin: 0 0 2px 0 !important;
                overflow-x: auto !important;
                white-space: nowrap !important;
                box-sizing: border-box !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-tabmenu,
            .dark-theme .modal.cbi-modal .cbi-tabmenu {
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }
            /* 强力清空 Argon 原生 li 的所有边框与背景 */
            .modal.cbi-modal .cbi-tabmenu li,
            .modal.cbi-modal .cbi-tabmenu li:hover,
            .modal.cbi-modal .cbi-tabmenu li[class~="cbi-tab"],
            .modal.cbi-modal .cbi-tabmenu li.cbi-tab,
            .modal.cbi-modal .cbi-tabmenu li.cbi-tab-disabled {
                flex: 1 1 0 !important;
                text-align: center !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                border-bottom: none !important;
                border-radius: 20px !important;
                list-style: none !important;
                box-shadow: none !important;
            }
            /* 独立纯净胶囊按钮：直接由 a 呈现独立质感，外无包裹框 */
            .modal.cbi-modal .cbi-tabmenu li a,
            .modal.cbi-modal .cbi-tabmenu li:hover a {
                display: block !important;
                width: 100% !important;
                padding: 5px 12px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                color: #64748b !important;
                text-decoration: none !important;
                border-radius: 20px !important;
                border: 1px solid #e2e8f0 !important;
                background: #f8fafc !important;
                box-sizing: border-box !important;
                transition: all 0.2s ease !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            .modal.cbi-modal .cbi-tabmenu li.cbi-tab a,
            .modal.cbi-modal .cbi-tabmenu li[class~="cbi-tab"] a {
                background: #5e72e4 !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                border-color: #5e72e4 !important;
                box-shadow: 0 2px 8px rgba(94, 114, 228, 0.3) !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-tabmenu li a,
            [data-theme="dark"] .modal.cbi-modal .cbi-tabmenu li:hover a {
                background: #232733 !important;
                border-color: #333a4d !important;
                color: #94a3b8 !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-tabmenu li.cbi-tab a,
            .dark-theme .modal.cbi-modal .cbi-tabmenu li.cbi-tab a,
            [data-theme="dark"] .modal.cbi-modal .cbi-tabmenu li[class~="cbi-tab"] a,
            .dark-theme .modal.cbi-modal .cbi-tabmenu li[class~="cbi-tab"] a {
                background: #5e72e4 !important;
                color: #ffffff !important;
                border-color: #5e72e4 !important;
                box-shadow: 0 2px 8px rgba(94, 114, 228, 0.4) !important;
            }

            /* 4. 每个配置项 (cbi-value) 消除错位与拥挤，紧凑规整 */
            .modal.cbi-modal .cbi-value {
                display: block !important;
                width: 100% !important;
                padding: 2px 0 3px 0 !important;
                margin: 0 !important;
                border-bottom: 1px solid rgba(241, 245, 249, 0.7) !important;
                line-height: normal !important;
                box-sizing: border-box !important;
            }
            /* 核心：确保 LuCI 依赖不满足时的隐藏类名 (.hidden) 拥有最高优先级，绝不被 block 强行击穿展示 */
            .modal.cbi-modal .cbi-value.hidden,
            .modal.cbi-modal .cbi-value[data-depends].hidden,
            .modal.cbi-modal .hidden,
            .modal.cbi-modal [data-field].hidden {
                display: none !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-value,
            .dark-theme .modal.cbi-modal .cbi-value {
                border-bottom-color: #262c3a !important;
            }

            /* 配置项标题 (label) */
            .modal.cbi-modal .cbi-value-title {
                display: block !important;
                float: none !important;
                width: 100% !important;
                text-align: left !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                padding: 0 0 1px 0 !important;
                margin: 0 !important;
                line-height: 1.2 !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-value-title,
            .dark-theme .modal.cbi-modal .cbi-value-title {
                color: #f1f5f9 !important;
            }

            /* 字段输入控件容器与本体：全宽 100% 自适应 */
            .modal.cbi-modal .cbi-value-field {
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .modal.cbi-modal .cbi-value-field input[type="text"],
            .modal.cbi-modal .cbi-value-field input[type="password"],
            .modal.cbi-modal .cbi-value-field select {
                width: 100% !important;
                min-width: 0 !important;
                max-width: 100% !important;
                height: 34px !important;
                line-height: 34px !important;
                border-radius: 6px !important;
                border: 1px solid #cbd5e1 !important;
                background: #ffffff !important;
                font-size: 13px !important;
                color: #0f172a !important;
                box-sizing: border-box !important;
                padding: 0 10px !important;
                box-shadow: none !important;
            }
            .modal.cbi-modal .cbi-value-field input:focus,
            .modal.cbi-modal .cbi-value-field select:focus,
            .modal.cbi-modal .cbi-value-field .cbi-dropdown.open {
                border-color: #5e72e4 !important;
                box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.15) !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-value-field input[type="text"],
            [data-theme="dark"] .modal.cbi-modal .cbi-value-field input[type="password"],
            [data-theme="dark"] .modal.cbi-modal .cbi-value-field select,
            [data-theme="dark"] .modal.cbi-modal .cbi-value-field .cbi-dropdown {
                background: #232733 !important;
                border-color: #3b4252 !important;
                color: #f1f5f9 !important;
            }

            /* 5. 冗长说明文字降噪精简 (cbi-value-description) */
            .modal.cbi-modal .cbi-value-description {
                display: block !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                color: #64748b !important;
                opacity: 0.9 !important;
                padding: 1px 0 0 0 !important;
                margin: 0 !important;
            }
            .modal.cbi-modal .cbi-value-description:empty {
                display: none !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-value-description,
            .dark-theme .modal.cbi-modal .cbi-value-description {
                color: #94a3b8 !important;
            }

            /* 6. 复选框项（加密、压缩）左右分栏排版 */
            .modal.cbi-modal .cbi-value:has(input[type="checkbox"]),
            .modal.cbi-modal .cbi-value:has(.cbi-input-checkbox) {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 5px 0 !important;
            }
            .modal.cbi-modal .cbi-value:has(input[type="checkbox"]) .cbi-value-title,
            .modal.cbi-modal .cbi-value:has(.cbi-input-checkbox) .cbi-value-title {
                width: auto !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .modal.cbi-modal .cbi-value:has(input[type="checkbox"]) .cbi-value-field,
            .modal.cbi-modal .cbi-value:has(.cbi-input-checkbox) .cbi-value-field {
                width: auto !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .modal.cbi-modal .cbi-value:has(input[type="checkbox"]) .cbi-value-description,
            .modal.cbi-modal .cbi-value:has(.cbi-input-checkbox) .cbi-value-description {
                flex-basis: 100% !important;
                width: 100% !important;
                padding-top: 4px !important;
            }
            .modal.cbi-modal .cbi-value-field input[type="checkbox"],
            .modal.cbi-modal .cbi-value-field .cbi-input-checkbox {
                width: 20px !important;
                height: 20px !important;
                cursor: pointer !important;
                margin: 0 !important;
                accent-color: #5e72e4 !important;
            }

            /* 7. 下拉框与本地IP Combobox 统一标准外观 */
            .modal.cbi-modal .cbi-value-field .cbi-dropdown {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                position: relative !important;
                width: 100% !important;
                min-width: 0 !important;
                max-width: 100% !important;
                height: 34px !important;
                line-height: 32px !important;
                border-radius: 6px !important;
                border: 1px solid #cbd5e1 !important;
                background: #ffffff !important;
                font-size: 14px !important;
                color: #0f172a !important;
                box-sizing: border-box !important;
                padding: 0 8px 0 10px !important;
                box-shadow: none !important;
                cursor: pointer !important;
            }
            .modal.cbi-modal .cbi-value-field .cbi-dropdown:focus,
            .modal.cbi-modal .cbi-value-field .cbi-dropdown.open {
                border-color: #5e72e4 !important;
                box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.15) !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-value-field .cbi-dropdown {
                background: #232733 !important;
                border-color: #3b4252 !important;
                color: #f1f5f9 !important;
            }

            /* 未展开时的内置项目列表容器：彻底扁平化、无多余边框阴影背景，文字与普通input一致 */
            .modal.cbi-modal .cbi-dropdown > ul:not(.dropdown) {
                display: flex !important;
                align-items: center !important;
                flex: 1 1 auto !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                background: transparent !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                list-style: none !important;
                overflow: hidden !important;
            }
            /* 未展开时所有待选项一律隐藏，仅显示当前配置生效的一项 (带有 [display] 属性) */
            .modal.cbi-modal .cbi-dropdown > ul:not(.dropdown) > li {
                display: none !important;
            }
            .modal.cbi-modal .cbi-dropdown > ul:not(.dropdown) > li[display] {
                display: block !important;
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                font-size: 13px !important;
                color: #0f172a !important;
                line-height: 32px !important;
                white-space: nowrap !important;
                text-overflow: ellipsis !important;
                overflow: hidden !important;
                width: 100% !important;
            }
            .modal.cbi-modal .cbi-dropdown[empty] > ul:not(.dropdown) > li[placeholder] {
                display: block !important;
                color: #94a3b8 !important;
                font-style: normal !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-dropdown > ul:not(.dropdown) > li[display] {
                color: #f1f5f9 !important;
            }

            /* 右侧下拉箭头 ▾ 样式对齐 */
            .modal.cbi-modal .cbi-dropdown > .open {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 0 0 auto !important;
                width: 20px !important;
                height: 20px !important;
                padding: 0 !important;
                margin: 0 0 0 4px !important;
                color: #94a3b8 !important;
                font-size: 12px !important;
                cursor: pointer !important;
            }
            .modal.cbi-modal .cbi-dropdown > .more {
                display: none !important;
            }

            /* 仅在展开时弹出的下拉选择浮层：ul.dropdown */
            .modal.cbi-modal .cbi-dropdown > ul.dropdown {
                position: absolute !important;
                top: 100% !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                border-radius: 8px !important;
                border: 1px solid #cbd5e1 !important;
                box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18) !important;
                max-height: 220px !important;
                padding: 4px !important;
                background: #ffffff !important;
                z-index: 1000 !important;
                margin-top: 4px !important;
                list-style: none !important;
                box-sizing: border-box !important;
                overflow-y: auto !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-dropdown > ul.dropdown,
            .dark-theme .modal.cbi-modal .cbi-dropdown > ul.dropdown {
                background: #232733 !important;
                border-color: #3b4252 !important;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6) !important;
            }
            .modal.cbi-modal .cbi-dropdown > ul.dropdown > li {
                padding: 9px 12px !important;
                font-size: 13px !important;
                border-radius: 6px !important;
                color: #334155 !important;
                cursor: pointer !important;
                line-height: 1.4 !important;
                margin-bottom: 2px !important;
            }
            [data-theme="dark"] .modal.cbi-modal .cbi-dropdown > ul.dropdown > li {
                color: #e2e8f0 !important;
            }
            .modal.cbi-modal .cbi-dropdown > ul.dropdown > li:hover,
            .modal.cbi-modal .cbi-dropdown > ul.dropdown > li[selected] {
                background: rgba(94, 114, 228, 0.1) !important;
                color: #5e72e4 !important;
            }

            /* 8. 弹窗底部操作按钮 (button-row) 加粗好按 */
            .modal.cbi-modal > .button-row {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
                gap: 8px !important;
                padding: 8px 0 2px 0 !important;
                margin: 6px 0 0 0 !important;
                border-top: 1px solid #edf2f9 !important;
                width: 100% !important;
            }
            [data-theme="dark"] .modal.cbi-modal > .button-row,
            .dark-theme .modal.cbi-modal > .button-row {
                border-top-color: #333a4d !important;
            }
            .modal.cbi-modal > .button-row > .btn,
            .modal.cbi-modal > .button-row > button {
                height: 36px !important;
                line-height: 36px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                border-radius: 6px !important;
                margin: 0 !important;
                padding: 0 18px !important;
                text-align: center !important;
                cursor: pointer !important;
            }
            /* 取消按钮 */
            .modal.cbi-modal > .button-row > .btn:not(.cbi-button-positive) {
                background: #f1f5f9 !important;
                color: #475569 !important;
                border: 1px solid #cbd5e1 !important;
            }
            [data-theme="dark"] .modal.cbi-modal > .button-row > .btn:not(.cbi-button-positive) {
                background: #2b3142 !important;
                color: #cbd5e1 !important;
                border-color: #3b4252 !important;
            }
            /* 保存按钮 (主操作高亮) */
            .modal.cbi-modal > .button-row > .btn.cbi-button-positive,
            .modal.cbi-modal > .button-row > .btn.important {
                background: #5e72e4 !important;
                color: #ffffff !important;
                border: none !important;
                font-weight: 700 !important;
                box-shadow: 0 3px 8px rgba(94, 114, 228, 0.3) !important;
            }
        }


        /* ================= 全局页面风格统一化设计系统 (Unified Design System) ================= */
        /* 1. 全局与主容器外框：现代卡片化、圆角与微质感阴影 */
        .cbi-map > .cbi-section {
            background: #ffffff !important;
            border-radius: 10px !important;
            border: 1px solid #f1f5f9 !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02) !important;
            padding: 16px 18px !important;
            margin: 0 0 16px 0 !important;
            box-sizing: border-box !important;
        }
        [data-theme="dark"] .cbi-map > .cbi-section,
        .dark-theme .cbi-map > .cbi-section {
            background: #1e222d !important;
            border-color: #262c3a !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25) !important;
        }

        /* 2. 区块标题 (h3)：左侧主题色竖条指示，无原生生硬边框 */
        .cbi-map > .cbi-section > h3 {
            display: flex !important;
            align-items: center !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            padding: 0 0 10px 0 !important;
            margin: 0 0 12px 0 !important;
            border-bottom: 1px solid #f1f5f9 !important;
            line-height: 1.4 !important;
            letter-spacing: -0.2px !important;
        }
        .cbi-map > .cbi-section > h3::before {
            content: "" !important;
            display: inline-block !important;
            width: 3.5px !important;
            height: 15px !important;
            background: #5e72e4 !important;
            border-radius: 2px !important;
            margin-right: 8px !important;
        }
        [data-theme="dark"] .cbi-map > .cbi-section > h3,
        .dark-theme .cbi-map > .cbi-section > h3 {
            color: #f1f5f9 !important;
            border-bottom-color: #262c3a !important;
        }

        /* 3. 主页面 Tab 标签栏单层胶囊化（彻底消灭原生双层与灰底下划线） */
        .cbi-map > .cbi-section > .cbi-tabmenu {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 0 0 12px 0 !important;
            margin: 0 0 12px 0 !important;
            border-bottom: 1px solid #f1f5f9 !important;
            background: transparent !important;
        }
        [data-theme="dark"] .cbi-map > .cbi-section > .cbi-tabmenu,
        .dark-theme .cbi-map > .cbi-section > .cbi-tabmenu {
            border-bottom-color: #262c3a !important;
        }
        .cbi-map > .cbi-section > .cbi-tabmenu > li {
            display: inline-flex !important;
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .cbi-map > .cbi-section > .cbi-tabmenu > li > a {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 6px 14px !important;
            border-radius: 20px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            color: #64748b !important;
            background: #f1f5f9 !important;
            border: 1px solid transparent !important;
            text-decoration: none !important;
            transition: all 0.2s ease !important;
            line-height: 1.2 !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        .cbi-map > .cbi-section > .cbi-tabmenu > li.cbi-tab > a {
            background: #5e72e4 !important;
            color: #ffffff !important;
            border-color: #5e72e4 !important;
            box-shadow: 0 2px 6px rgba(94, 114, 228, 0.3) !important;
        }
        [data-theme="dark"] .cbi-map > .cbi-section > .cbi-tabmenu > li > a,
        .dark-theme .cbi-map > .cbi-section > .cbi-tabmenu > li > a {
            background: #232733 !important;
            color: #94a3b8 !important;
        }
        [data-theme="dark"] .cbi-map > .cbi-section > .cbi-tabmenu > li.cbi-tab > a,
        .dark-theme .cbi-map > .cbi-section > .cbi-tabmenu > li.cbi-tab > a {
            background: #5e72e4 !important;
            color: #ffffff !important;
            border-color: #5e72e4 !important;
        }

        /* 4. 主页面专属表单控件（严格限定 #maincontent，绝不穿透污染弹窗） */
        #maincontent .cbi-map > .cbi-section .cbi-value {
            padding: 8px 0 !important;
            margin: 0 !important;
            border-bottom: 1px solid #f8fafc !important;
        }
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value,
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value {
            border-bottom-color: #232733 !important;
        }
        #maincontent .cbi-map > .cbi-section .cbi-value-title {
            font-size: 13px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            padding: 0 0 3px 0 !important;
            line-height: 1.3 !important;
        }
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value-title,
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value-title {
            color: #f1f5f9 !important;
        }
        #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="text"],
        #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="password"],
        #maincontent .cbi-map > .cbi-section .cbi-value-field select {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            height: 34px !important;
            line-height: 34px !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            font-size: 13px !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
            padding: 0 10px !important;
            box-shadow: none !important;
            transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        #maincontent .cbi-map > .cbi-section .cbi-value-field input:focus,
        #maincontent .cbi-map > .cbi-section .cbi-value-field select:focus {
            border-color: #5e72e4 !important;
            box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.15) !important;
        }
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="text"],
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="password"],
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value-field select,
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="text"],
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value-field input[type="password"],
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value-field select {
            background: #232733 !important;
            border-color: #3b4252 !important;
            color: #f1f5f9 !important;
        }
        /* 主页面描述说明文字降噪精简 */
        #maincontent .cbi-map > .cbi-section .cbi-value-description {
            font-size: 11px !important;
            line-height: 1.35 !important;
            color: #64748b !important;
            opacity: 0.9 !important;
            padding: 2px 0 0 0 !important;
            margin: 0 !important;
        }
        [data-theme="dark"] #maincontent .cbi-map > .cbi-section .cbi-value-description,
        .dark-theme #maincontent .cbi-map > .cbi-section .cbi-value-description {
            color: #94a3b8 !important;
        }
        /* 主页面复选框优化 */
        .cbi-map > .cbi-section .cbi-value:has(input[type="checkbox"]),
        .cbi-map > .cbi-section .cbi-value:has(.cbi-input-checkbox) {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 10px 0 !important;
        }
        .cbi-map > .cbi-section .cbi-value:has(input[type="checkbox"]) .cbi-value-title,
        .cbi-map > .cbi-section .cbi-value:has(.cbi-input-checkbox) .cbi-value-title {
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .cbi-map > .cbi-section .cbi-value:has(input[type="checkbox"]) .cbi-value-field,
        .cbi-map > .cbi-section .cbi-value:has(.cbi-input-checkbox) .cbi-value-field {
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .cbi-map > .cbi-section .cbi-value-field input[type="checkbox"],
        .cbi-map > .cbi-section .cbi-value-field .cbi-input-checkbox {
            width: 20px !important;
            height: 20px !important;
            cursor: pointer !important;
            margin: 0 !important;
            accent-color: #5e72e4 !important;
        }

        /* 5. 添加新规则按钮 (cbi-button-add) 卡片化高质感重塑 (满宽撑开+紧凑间隙) */
        .cbi-section-create {
            display: flex !important;
            width: 100% !important;
            margin: 8px 0 0 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
        }
        .cbi-section-create .cbi-button-add,
        .cbi-map .cbi-button-add {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            width: 100% !important;
            height: 38px !important;
            background: rgba(94, 114, 228, 0.06) !important;
            border: 1.5px dashed rgba(94, 114, 228, 0.35) !important;
            border-radius: 8px !important;
            color: #5e72e4 !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }
        .cbi-section-create .cbi-button-add:hover,
        .cbi-section-create .cbi-button-add:active,
        .cbi-map .cbi-button-add:hover,
        .cbi-map .cbi-button-add:active {
            background: rgba(94, 114, 228, 0.12) !important;
            border-color: #5e72e4 !important;
            transform: scale(0.99) !important;
        }
        [data-theme="dark"] .cbi-section-create .cbi-button-add,
        .dark-theme .cbi-section-create .cbi-button-add {
            background: rgba(94, 114, 228, 0.1) !important;
            border-color: rgba(94, 114, 228, 0.4) !important;
            color: #8292ed !important;
        }

        /* 6. 卡片操作按钮 (编辑 / 删除) 微调精致化 */
        .cbi-section-table-row .cbi-button {
            border-radius: 6px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            height: 30px !important;
            line-height: 28px !important;
            padding: 0 10px !important;
            box-shadow: none !important;
            transition: all 0.15s ease !important;
        }
        .cbi-section-table-row .cbi-button-edit {
            background: rgba(94, 114, 228, 0.08) !important;
            color: #5e72e4 !important;
            border: 1px solid rgba(94, 114, 228, 0.25) !important;
        }
        .cbi-section-table-row .cbi-button-remove {
            background: rgba(245, 54, 92, 0.08) !important;
            color: #f5365c !important;
            border: 1px solid rgba(245, 54, 92, 0.25) !important;
        }

        /* 7. 底部全局操作栏 (cbi-page-actions) 现代微卡片化单行精致排版 */
        .cbi-page-actions {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 8px 12px !important;
            margin: 10px 0 4px 0 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            border: 1px solid #f1f5f9 !important;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02) !important;
            box-sizing: border-box !important;
        }
        [data-theme="dark"] .cbi-page-actions,
        .dark-theme .cbi-page-actions {
            background: #1e222d !important;
            border-color: #262c3a !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25) !important;
        }
        /* 彻底隐藏多余且引发白底白字的空白保存按钮，杜绝多余空框与空间挤占 */
        .cbi-page-actions .cbi-button-save,
        .cbi-page-actions button[name="save"] {
            display: none !important;
        }
        .cbi-page-actions .cbi-button,
        .cbi-page-actions .cbi-dropdown {
            height: 36px !important;
            line-height: 34px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            margin: 0 !important;
        }
        /* 保存并应用组合按钮：主操作占据左侧主要宽度，圆角融合，下拉小箭头协调嵌入 */
        .cbi-page-actions .cbi-dropdown.cbi-button-apply {
            display: inline-flex !important;
            flex: 1 1 auto !important;
            align-items: stretch !important;
            padding: 0 !important;
            background: #5e72e4 !important;
            color: #ffffff !important;
            border: 1px solid #5e72e4 !important;
            box-shadow: 0 2px 8px rgba(94, 114, 228, 0.25) !important;
            overflow: hidden !important;
        }
        .cbi-page-actions .cbi-dropdown.cbi-button-apply > ul {
            flex: 1 1 auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 8px !important;
            margin: 0 !important;
        }
        .cbi-page-actions .cbi-dropdown.cbi-button-apply > ul > li {
            color: #ffffff !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            text-align: center !important;
        }
        .cbi-page-actions .cbi-dropdown.cbi-button-apply > .open {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 28px !important;
            background-color: rgba(255, 255, 255, 0.2) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.25) !important;
            padding: 0 !important;
        }
        /* 复位按钮：紧凑辅助操作按钮，右侧紧贴对齐 */
        .cbi-page-actions .cbi-button-reset {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 0 0 auto !important;
            min-width: 72px !important;
            padding: 0 14px !important;
            background: #f1f5f9 !important;
            color: #64748b !important;
            border: 1px solid #cbd5e1 !important;
        }
        [data-theme="dark"] .cbi-page-actions .cbi-button-reset,
        .dark-theme .cbi-page-actions .cbi-button-reset {
            background: #232733 !important;
            color: #94a3b8 !important;
            border-color: #3b4252 !important;
        }


        /* ================= 解决主页面“内镶再内镶/占比过小”深度重构 ================= */
        /* 1. 彻底击碎内层嵌套容器的所有背景、边框、阴影与累加内边距，实现纯净单层卡片 */
        .cbi-map .cbi-section-node,
        .cbi-map .cbi-section-node-tabbed,
        .cbi-map .cbi-section-node > div[data-tab],
        .cbi-map div[data-tab],
        .cbi-map .cbi-section > .cbi-section-node,
        .cbi-map .cbi-section-node .cbi-section {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        /* 2. 移动端大幅提升有效内容占比 (大开大合，杜绝层层内缩) */
        @media screen and (max-width: 992px) {
            .cbi-map > .cbi-section {
                padding: 12px 10px !important;
                margin: 0 0 12px 0 !important;
                border-radius: 8px !important;
            }
            /* 规则列表容器完全扁平化，绝不给卡片列表外层再套一层大白框（杜绝大框嵌小框） */
            .cbi-map > .cbi-section[id*="conf"],
            .cbi-map > .cbi-section:has(.cbi-section-table) {
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 0 6px 0 !important;
            }
            .cbi-map > .cbi-section[id*="conf"] > h3,
            .cbi-map > .cbi-section:has(.cbi-section-table) > h3 {
                padding: 0 4px 8px 4px !important;
            }
            /* 输入框全宽延展，饱满大占比 */
            .cbi-map > .cbi-section .cbi-value-field input[type="text"],
            .cbi-map > .cbi-section .cbi-value-field input[type="password"],
            .cbi-map > .cbi-section .cbi-value-field select {
                width: 100% !important;
                max-width: 100% !important;
            }
            /* 底部操作栏移动端单行高质感对齐 (彻底杜绝多余折行与留白) */
            .cbi-page-actions {
                padding: 8px 10px !important;
                margin: 8px 0 4px 0 !important;
                gap: 8px !important;
            }
            .cbi-page-actions .cbi-dropdown.cbi-button-apply {
                flex: 1 1 auto !important;
            }
            .cbi-page-actions .cbi-button-reset {
                flex: 0 0 72px !important;
                padding: 0 10px !important;
            }
        }
        
        /* ================= 弹窗全域极限紧凑覆盖（终极高权重，彻底消除字段间大空隙） ================= */
        body .modal.cbi-modal .cbi-value,
        .modal.cbi-modal .cbi-value {
            display: block !important;
            width: 100% !important;
            padding: 1px 0 2px 0 !important;
            margin: 0 !important;
            border-bottom: 1px solid rgba(241, 245, 249, 0.6) !important;
            line-height: normal !important;
            box-sizing: border-box !important;
        }
        body .modal.cbi-modal .cbi-value-title,
        .modal.cbi-modal .cbi-value-title {
            display: block !important;
            float: none !important;
            width: 100% !important;
            text-align: left !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            padding: 0 0 1px 0 !important;
            margin: 0 !important;
            line-height: 1.2 !important;
        }
        body .modal.cbi-modal .cbi-value-field input[type="text"],
        body .modal.cbi-modal .cbi-value-field input[type="password"],
        body .modal.cbi-modal .cbi-value-field select,
        .modal.cbi-modal .cbi-value-field input,
        .modal.cbi-modal .cbi-value-field select {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            height: 31px !important;
            line-height: 31px !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            font-size: 13px !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
            padding: 0 8px !important;
            box-shadow: none !important;
        }
        body .modal.cbi-modal .cbi-value-field .cbi-dropdown,
        .modal.cbi-modal .cbi-value-field .cbi-dropdown {
            height: 31px !important;
            line-height: 29px !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
            padding: 0 8px !important;
            box-sizing: border-box !important;
        }
        body .modal.cbi-modal .cbi-dropdown > ul:not(.dropdown) > li[display] {
            line-height: 29px !important;
            font-size: 13px !important;
        }
        body .modal.cbi-modal .cbi-value-description,
        .modal.cbi-modal .cbi-value-description {
            display: block !important;
            font-size: 10.5px !important;
            line-height: 1.25 !important;
            color: #94a3b8 !important;
            opacity: 0.9 !important;
            padding: 1px 0 0 0 !important;
            margin: 0 !important;
        }

        /* 空 Tab 自动隐藏：当前代理类型无任何适用字段时，收起该 Tab 标签 */
        .modal.cbi-modal ul.cbi-tabmenu > li.frpc-tab-empty {
            display: none !important;
            flex: 0 0 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
        }
`);
    node.prepend(style);

    // ===== 弹窗空 Tab 自动收起 =====
    if (!window.__frpcEmptyTabFix) {
        window.__frpcEmptyTabFix = true;
        (function() {
            function getPane(group, name) {
                if (!group || !group.children) return null;
                for (var i = 0; i < group.children.length; i++) {
                    var c = group.children[i];
                    if (c.getAttribute && c.getAttribute('data-tab') === name) return c;
                }
                return null;
            }
            function paneIsEmpty(pane) {
                if (!pane) return true;
                var fields = pane.querySelectorAll('.cbi-value, [data-field]');
                if (!fields.length) return true;
                for (var i = 0; i < fields.length; i++) {
                    if (!fields[i].classList.contains('hidden')) return false;
                }
                return true;
            }
            function refresh(modal) {
                if (!modal || !modal.querySelectorAll) return;
                var menus = modal.querySelectorAll('ul.cbi-tabmenu');
                for (var mi = 0; mi < menus.length; mi++) {
                    var menu = menus[mi];
                    var group = menu.nextElementSibling;
                    if (!group) continue;
                    var lis = menu.querySelectorAll('li[data-tab]');
                    var activeHidden = false;
                    for (var i = 0; i < lis.length; i++) {
                        var li = lis[i];
                        var name = li.getAttribute('data-tab');
                        if (!name) continue;
                        var empty = paneIsEmpty(getPane(group, name));
                        if (empty) {
                            li.classList.add('frpc-tab-empty');
                            if (li.classList.contains('cbi-tab')) activeHidden = true;
                        } else {
                            li.classList.remove('frpc-tab-empty');
                        }
                    }
                    if (activeHidden) {
                        for (var j = 0; j < lis.length; j++) {
                            if (!lis[j].classList.contains('frpc-tab-empty')) {
                                var a = lis[j].querySelector('a');
                                if (a) a.click();
                                break;
                            }
                        }
                    }
                }
            }
            function setup(modal) {
                if (!modal || modal.__frpcTabReady) return;
                modal.__frpcTabReady = true;
                refresh(modal);
                modal.addEventListener('change', function() {
                    setTimeout(function() { refresh(modal); }, 60);
                });
                modal.addEventListener('click', function() {
                    setTimeout(function() { refresh(modal); }, 60);
                });
                setTimeout(function() { refresh(modal); }, 80);
            }
            function scanAll() {
                var ms = document.querySelectorAll('.modal.cbi-modal');
                for (var i = 0; i < ms.length; i++) setup(ms[i]);
            }
            window.__frpcScanTabs = scanAll;
            if (typeof MutationObserver !== 'undefined') {
                new MutationObserver(function(muts) {
                    for (var i = 0; i < muts.length; i++) {
                        var add = muts[i].addedNodes;
                        for (var j = 0; j < add.length; j++) {
                            var n = add[j];
                            if (!n || n.nodeType !== 1) continue;
                            if (n.classList && n.classList.contains('cbi-modal')) setup(n);
                            if (n.querySelectorAll) {
                                var inner = n.querySelectorAll('.modal.cbi-modal');
                                for (var k = 0; k < inner.length; k++) setup(inner[k]);
                            }
                        }
                    }
                }).observe(document.body, { childList: true, subtree: true });
            }
            document.addEventListener('click', function(ev) {
                var t = ev.target;
                if (!t || !t.closest) return;
                if (t.closest('.cbi-button-edit, .cbi-button-add, .cbi-button-action, .btn')) {
                    setTimeout(scanAll, 120);
                    setTimeout(scanAll, 400);
                }
            }, true);
        })();
    }
    try {
        var h2 = node.querySelector('h2[name="content"]');
        if (h2) {
            h2.classList.add('frpc-main-header');
            var rawTitle = h2.textContent ? h2.textContent.trim() : _('frp Client');
            h2.innerHTML = '';
            var titleSpan = E('span', { 'class': 'frpc-header-title-text' }, rawTitle);
            var statusSpan = E('span', { 'id': 'service_status_header', 'class': 'frpc-header-status' }, [
                E('span', { 'class': 'frpc-status-badge frpc-status-running' }, [
                    E('span', { 'class': 'frpc-status-dot' }),
                    E('span', { 'class': 'frpc-status-text' }, _('RUNNING'))
                ])
            ]);
            h2.appendChild(titleSpan);
            h2.appendChild(statusSpan);

            getServiceStatus().then(function(res) {
                var el = document.getElementById('service_status_header') || statusSpan;
                if (el) el.innerHTML = renderStatus(res);
            });
        }
    } catch(e) {
        console.error('frpc header status init error:', e);
    }

    L.Poll.add(function() {
        return L.resolveDefault(getServiceStatus()).then(function(res) {
            var view = document.getElementById('service_status_header');
            if (view) {
                view.innerHTML = renderStatus(res);
            }
        });
    });

    try {
        var commonSecNode = node.querySelector('#cbi-frpc-common');
        if (commonSecNode) {
            var commonSection = commonSecNode.closest('.cbi-section');
            if (commonSection) {
                commonSection.classList.add('frpc-common-section');
            }
            var tabMenu = commonSecNode.parentNode ? commonSecNode.parentNode.querySelector('ul.cbi-tabmenu') : null;
            if (tabMenu) {
                // 1. 追加运行日志 Tab 胶囊
                var logLi = E('li', { 'class': 'cbi-tab-disabled', 'data-tab': 'log' },
                    E('a', { 'href': '#' }, _('运行日志'))
                );
                tabMenu.appendChild(logLi);

                // 2. 在 commonSecNode 内部构建日志 Pane
                var logTextarea = E('pre', {
                    'id': 'frpc_log_output',
                    'class': 'frpc-log-output'
                }, [_('正在加载 FRPC 运行日志...')]);

                var logStatusSpan = E('span', { 'class': 'frpc-log-counter' }, '');
                var autoRefreshCheckbox = E('input', {
                    'type': 'checkbox',
                    'id': 'frpc_log_auto_refresh',
                    'checked': 'checked'
                });

                var btnRefresh = E('button', {
                    'type': 'button',
                    'class': 'cbi-button cbi-button-action frpc-log-btn'
                }, [ '🔄 ', _('刷新') ]);

                var btnCopy = E('button', {
                    'type': 'button',
                    'class': 'cbi-button cbi-button-neutral frpc-log-btn'
                }, [ '📋 ', _('复制') ]);

                var btnClear = E('button', {
                    'type': 'button',
                    'class': 'cbi-button cbi-button-neutral frpc-log-btn'
                }, [ '🗑️ ', _('清屏') ]);

                var logHeader = E('div', { 'class': 'frpc-log-header' }, [
                    E('div', { 'class': 'frpc-log-header-left' }, [
                        E('strong', {}, _('FRPC 运行日志')),
                        logStatusSpan
                    ]),
                    E('div', { 'class': 'frpc-log-header-right' }, [
                        E('label', { 'class': 'frpc-log-auto-label' }, [
                            autoRefreshCheckbox,
                            E('span', {}, _('自动刷新'))
                        ]),
                        btnRefresh,
                        btnCopy,
                        btnClear
                    ])
                ]);

                var logPane = E('div', {
                    'data-tab': 'log',
                    'data-tab-title': _('运行日志'),
                    'class': 'frpc-log-pane'
                }, [
                    logHeader,
                    E('div', { 'class': 'frpc-log-body' }, logTextarea)
                ]);

                commonSecNode.appendChild(logPane);

                // 3. 日志拉取与格式化渲染函数
                var rawLogLines = [];
                var isFetching = false;

                function renderLogLines(lines) {
                    rawLogLines = lines;
                    if (!lines || lines.length === 0) {
                        logTextarea.innerHTML = '<span class="frpc-log-line frpc-log-dim">' + _('暂无 FRPC 运行日志数据') + '</span>';
                        logStatusSpan.textContent = '(0 条)';
                        return;
                    }
                    logStatusSpan.textContent = '(' + lines.length + ' 条)';

                    var displayLines = lines.slice(-150);
                    var fragment = document.createDocumentFragment();

                    displayLines.forEach(function(line) {
                        var lineEl = document.createElement('div');
                        lineEl.className = 'frpc-log-line';

                        if (/(\\[E\\]|error:|failed|connect: no route)/i.test(line)) {
                            lineEl.classList.add('frpc-log-err');
                        } else if (/(\\[I\\]|success|start proxy success|login to server success)/i.test(line)) {
                            lineEl.classList.add('frpc-log-ok');
                        } else if (/(\\[W\\]|warn|warning)/i.test(line)) {
                            lineEl.classList.add('frpc-log-warn');
                        } else {
                            lineEl.classList.add('frpc-log-info');
                        }

                        lineEl.textContent = line;
                        fragment.appendChild(lineEl);
                    });

                    logTextarea.innerHTML = '';
                    logTextarea.appendChild(fragment);
                    logTextarea.scrollTop = logTextarea.scrollHeight;
                }

                function fetchLogData() {
                    if (isFetching) return Promise.resolve();
                    isFetching = true;
                    return fs.exec_direct('/usr/libexec/syslog-wrapper').then(function(res) {
                        isFetching = false;
                        var text = (typeof res === 'string') ? res : '';
                        var list = text.trim().split('\n').filter(function(l) {
                            return /frpc/i.test(l);
                        });
                        renderLogLines(list);
                    }).catch(function(err) {
                        return fs.read('/overlay/log/messages').then(function(fres) {
                            isFetching = false;
                            var ftext = (fres && fres.data) ? fres.data : '';
                            var list = ftext.trim().split('\n').filter(function(l) {
                                return /frpc/i.test(l);
                            });
                            renderLogLines(list);
                        }).catch(function(err2) {
                            isFetching = false;
                            logTextarea.textContent = _('获取日志失败: ') + (err2.message || err.message);
                        });
                    });
                }

                btnRefresh.addEventListener('click', function(e) {
                    e.preventDefault();
                    btnRefresh.classList.add('spinning');
                    fetchLogData().finally(function() {
                        setTimeout(function() { btnRefresh.classList.remove('spinning'); }, 400);
                    });
                });

                btnClear.addEventListener('click', function(e) {
                    e.preventDefault();
                    logTextarea.innerHTML = '<span class="frpc-log-line frpc-log-dim">' + _('日志已清屏') + '</span>';
                    logStatusSpan.textContent = '(已清屏)';
                });

                function fallbackCopy(text) {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                        document.execCommand('copy');
                        var originalText = btnCopy.textContent;
                        btnCopy.textContent = '✓ ' + _('已复制');
                        setTimeout(function() { btnCopy.textContent = originalText; }, 1500);
                    } catch(ex) {
                        console.error('Copy fallback failed:', ex);
                    }
                    document.body.removeChild(ta);
                }

                btnCopy.addEventListener('click', function(e) {
                    e.preventDefault();
                    var textToCopy = rawLogLines.join('\n');
                    if (!textToCopy) return;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(textToCopy).then(function() {
                            var originalText = btnCopy.textContent;
                            btnCopy.textContent = '✓ ' + _('已复制');
                            setTimeout(function() { btnCopy.textContent = originalText; }, 1500);
                        }).catch(function() {
                            fallbackCopy(textToCopy);
                        });
                    } else {
                        fallbackCopy(textToCopy);
                    }
                });

                // 4. 定时轮询
                poll.add(function() {
                    if (currentActiveTab === 'log' && autoRefreshCheckbox && autoRefreshCheckbox.checked) {
                        return fetchLogData();
                    }
                    return Promise.resolve();
                });

                // 5. 三颗 Tab 按钮直接支持“再点击一次折叠收起”
                var isCollapsed = false;
                var currentActiveTab = 'common';

                function setCollapse(collapsed) {
                    isCollapsed = collapsed;
                    if (isCollapsed) {
                        commonSecNode.classList.add('frpc-content-collapsed');
                        if (commonSection) commonSection.classList.add('frpc-section-collapsed');
                    } else {
                        commonSecNode.classList.remove('frpc-content-collapsed');
                        if (commonSection) commonSection.classList.remove('frpc-section-collapsed');
                    }
                }

                function switchActivePane(targetTabName) {
                    var panes = commonSecNode.childNodes;
                    panes.forEach(function(pane) {
                        if (pane.nodeType === 1 && pane.getAttribute('data-tab')) {
                            var isMatch = (pane.getAttribute('data-tab') === targetTabName);
                            if (isMatch) {
                                pane.setAttribute('data-tab-active', 'true');
                                pane.dispatchEvent(new CustomEvent('cbi-tab-active', { detail: { tab: targetTabName } }));
                            } else {
                                pane.removeAttribute('data-tab-active');
                            }
                        }
                    });
                    tabMenu.querySelectorAll('li[data-tab]').forEach(function(item) {
                        var isMatch = (item.getAttribute('data-tab') === targetTabName);
                        item.classList.remove('cbi-tab', 'cbi-tab-disabled');
                        item.classList.add(isMatch ? 'cbi-tab' : 'cbi-tab-disabled');
                    });
                    currentActiveTab = targetTabName;

                    if (targetTabName === 'log') {
                        fetchLogData();
                    }
                }

                // 初始状态：展示常规设置
                switchActivePane('common');
                setCollapse(false);

                // 统一监听 tabMenu 点击
                tabMenu.addEventListener('click', function(ev) {
                    var a = ev.target.closest('a');
                    if (!a) return;
                    var li = a.parentNode;
                    if (!li) return;
                    var clickedTab = li.getAttribute('data-tab');
                    if (clickedTab) {
                        ev.preventDefault();
                        ev.stopPropagation();

                        if (clickedTab === currentActiveTab) {
                            // 点击的是当前已激活的同一个 Tab 按钮：展开/收起切换（再点击一次就折叠收起！）
                            setCollapse(!isCollapsed);
                        } else {
                            // 点击的是另一个 Tab 按钮：切换到该 Tab，并确保展开！
                            switchActivePane(clickedTab);
                            setCollapse(false);
                        }
                    }
                });
            }
        }} catch(err) {
        console.error('frpc tab & log init error:', err);
    }

    return node;
});}});
