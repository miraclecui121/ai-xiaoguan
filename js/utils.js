/* ========== 工具函数 ========== */
const Utils = {
  uid(prefix='id'){
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  },
  fmtMoney(n){
    n = Number(n)||0;
    if(n>=100000000) return '¥'+(n/100000000).toFixed(2)+'亿';
    if(n>=10000) return '¥'+(n/10000).toFixed(2)+'万';
    return '¥'+n.toLocaleString();
  },
  fmtMoneyPlain(n){ return '¥'+(Number(n)||0).toLocaleString(); },
  fmtDate(d){
    if(!d) return '—';
    const dt = new Date(d);
    if(isNaN(dt)) return d;
    return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  },
  fmtDateTime(d){
    if(!d) return '—';
    const dt = new Date(d);
    if(isNaN(dt)) return d;
    return Utils.fmtDate(d)+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  },
  daysSince(d){
    if(!d) return null;
    return Math.floor((Date.now()-new Date(d).getTime())/86400000);
  },
  relativeTime(d){
    const days = Utils.daysSince(d);
    if(days===null) return '—';
    if(days===0) return '今天';
    if(days===1) return '昨天';
    if(days<7) return days+'天前';
    if(days<30) return Math.floor(days/7)+'周前';
    if(days<365) return Math.floor(days/30)+'个月前';
    return Math.floor(days/365)+'年前';
  },
  today(){ return new Date().toISOString().slice(0,10); },
  now(){ return new Date().toISOString(); },
  esc(s){
    if(s===null||s===undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  // 下拉选项生成
  options(arr, selected, placeholder){
    let html = placeholder?`<option value="">${placeholder}</option>`:'';
    arr.forEach(o=>{
      const v = typeof o==='object'?o.value:o;
      const t = typeof o==='object'?o.label:o;
      html += `<option value="${Utils.esc(v)}"${v==selected?' selected':''}>${Utils.esc(t)}</option>`;
    });
    return html;
  },
  avg(arr){ if(!arr.length) return 0; return arr.reduce((a,b)=>a+Number(b||0),0)/arr.length; },
  sum(arr,key){ return arr.reduce((a,b)=>a+Number(key?b[key]:b||0),0); },
  weekNum(d){
    const dt = new Date(d);
    const onejan = new Date(dt.getFullYear(),0,1);
    return Math.ceil((((dt-onejan)/86400000)+onejan.getDay()+1)/7);
  },
  percent(n,total){
    if(!total) return '0%';
    return ((n/total)*100).toFixed(1)+'%';
  },
  // ===== 数据导出 =====
  Export: {
    /** 将对象数组转为CSV字符串（含BOM，Excel可直接打开中文） */
    toCSV(columns, rows){
      const BOM='\uFEFF';
      const escapeCSV=v=>{
        if(v===null||v===undefined)return'';
        const s=String(v).replace(/"/g,'""');
        return /[",\n\r]/.test(s)?`"${s}"`:s;
      };
      const header=columns.map(c=>escapeCSV(c.label)).join(',');
      const body=rows.map(row=>columns.map(c=>escapeCSV(row[c.key])).join(',')).join('\n');
      return BOM+header+'\n'+body;
    },
    /** 触发浏览器下载文件 */
    download(filename, content, mime='text/csv;charset=utf-8'){
      const blob=new Blob([content],{type:mime});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
};

/* ========== @选人组件 & 消息通知工具 ========== */
Utils.Mention = {
  /** 生成 @选人组件 HTML，嵌入表单中使用
   *  @param {string} pickerId - 唯一标识（如 'customerForm'）
   *  @param {string[]} selectedIds - 已选用户ID数组 */
  pickerHTML(pickerId, selectedIds){
    const users = Store.users().filter(u=>u.id!==Store.session.userId && u.status==='active');
    const selSet = new Set(selectedIds||[]);
    let userItems = '';
    users.forEach(u=>{
      const checked = selSet.has(u.id) ? ' checked' : '';
      userItems += `<label class="mu-item"><input type="checkbox" value="${Utils.esc(u.id)}"${checked} onchange="Utils.Mention.onChange('${pickerId}')"><span>${Utils.esc(u.name)}</span><span class="mu-dept">${Utils.esc(u.title||'')}</span></label>`;
    });
    if(!users.length) userItems = '<div class="mu-empty">暂无其他可通知人员</div>';
    const summary = selSet.size ? `${selSet.size}人` : '未选择';
    let chips = '';
    users.filter(u=>selSet.has(u.id)).forEach(u=>{
      chips += `<span class="mu-chip" title="${Utils.esc(u.title||'')}">${Utils.esc(u.name)}<i onclick="Utils.Mention.removeOne('${pickerId}','${u.id}')">×</i></span>`;
    });

    return `<div class="mention-picker" id="mp_${pickerId}">
      <div class="mu-label">📢 协同通知</div>
      <div class="mu-trigger" onclick="Utils.Mention.toggle('${pickerId}')">
        <span>👥 @ 选择需通知的人员</span>
        <span class="mu-summary" id="mus_${pickerId}">${summary}</span>
        <span class="mu-arrow" id="mua_${pickerId}">▾</span>
      </div>
      <div class="mu-dropdown" id="mud_${pickerId}" style="display:none" onclick="event.stopPropagation()">
        <input class="mu-search" id="musearch_${pickerId}" placeholder="🔍 搜索人员..." oninput="Utils.Mention.filter('${pickerId}',this.value)">
        <div class="mu-list" id="mul_${pickerId}">${userItems}</div>
        <div class="mu-actions">
          <button type="button" class="btn btn-ghost btn-sm" onclick="Utils.Mention.selectAll('${pickerId}')">全选</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Utils.Mention.clearAll('${pickerId}')">清空</button>
        </div>
      </div>
      <div class="mu-chips" id="muc_${pickerId}">${chips}</div>
      <input type="hidden" id="mui_${pickerId}" value='${JSON.stringify(selectedIds||[])}'>
    </div>`;
  },

  /** 从 DOM 读取已选用户ID */
  getSelected(pickerId){
    const el = document.getElementById('mui_'+pickerId);
    if(!el) return [];
    try{ return JSON.parse(el.value); }catch(e){ return []; }
  },

  /** 切换下拉 */
  toggle(pickerId){
    const dd = document.getElementById('mud_'+pickerId);
    const arrow = document.getElementById('mua_'+pickerId);
    const isOpen = dd.style.display==='block';
    // 关闭所有其他下拉
    document.querySelectorAll('.mu-dropdown').forEach(d=>d.style.display='none');
    document.querySelectorAll('.mu-arrow').forEach(a=>a.textContent='▾');
    if(!isOpen){
      dd.style.display='block';
      if(arrow) arrow.textContent='▴';
      const search = document.getElementById('musearch_'+pickerId);
      if(search){ setTimeout(()=>search.focus(),50); }
    }
  },

  /** 勾选变更 */
  onChange(pickerId){
    const cbs = document.querySelectorAll('#mul_'+pickerId+' input[type=checkbox]');
    const ids = [];
    cbs.forEach(cb=>{ if(cb.checked) ids.push(cb.value); });
    const inputEl = document.getElementById('mui_'+pickerId);
    if(inputEl) inputEl.value = JSON.stringify(ids);
    this._refreshUI(pickerId, ids);
  },

  /** 移除单个 */
  removeOne(pickerId, uid){
    const cb = document.querySelector('#mul_'+pickerId+' input[value="'+uid+'"]');
    if(cb) cb.checked = false;
    this.onChange(pickerId);
  },

  /** 搜索过滤 */
  filter(pickerId, kw){
    const items = document.querySelectorAll('#mul_'+pickerId+' .mu-item');
    const q = (kw||'').toLowerCase();
    items.forEach(item=>{
      const name = (item.textContent||'').toLowerCase();
      item.style.display = !q || name.includes(q) ? '' : 'none';
    });
  },

  /** 全选 */
  selectAll(pickerId){
    document.querySelectorAll('#mul_'+pickerId+' input[type=checkbox]').forEach(cb=>{ cb.checked=true; });
    this.onChange(pickerId);
  },

  /** 清空 */
  clearAll(pickerId){
    document.querySelectorAll('#mul_'+pickerId+' input[type=checkbox]').forEach(cb=>{ cb.checked=false; });
    this.onChange(pickerId);
  },

  /** 刷新UI */
  _refreshUI(pickerId, ids){
    const users = Store.users();
    const summary = document.getElementById('mus_'+pickerId);
    const chips = document.getElementById('muc_'+pickerId);
    if(summary) summary.textContent = ids.length ? ids.length+'人' : '未选择';
    if(chips){
      let html = '';
      users.filter(u=>ids.includes(u.id)).forEach(u=>{
        html += `<span class="mu-chip" title="${Utils.esc(u.title||'')}">${Utils.esc(u.name)}<i onclick="Utils.Mention.removeOne('${pickerId}','${u.id}')">×</i></span>`;
      });
      chips.innerHTML = html;
    }
  },

  /** 关闭所有下拉（全局点击时调用） */
  closeAll(){
    document.querySelectorAll('.mu-dropdown').forEach(d=>d.style.display='none');
    document.querySelectorAll('.mu-arrow').forEach(a=>a.textContent='▾');
  }
};

/** 创建消息通知（给指定用户列表发送通知）
 *  @param {object} opts - { type, refType, refId, title, message, toUserIds }
 *  toUserIds 为字符串数组（用户ID） */
Utils.createNotification = function(opts){
  const fromUser = Store.currentUser();
  const fromName = fromUser ? fromUser.name : '系统';
  (opts.toUserIds||[]).forEach(uid=>{
    if(uid===Store.session.userId) return; // 不给自己发
    Store.addNotification({
      type: opts.type,
      refType: opts.refType,
      refId: opts.refId,
      title: opts.title,
      message: `👤 ${fromName} · ${opts.message}`,
      fromUserId: Store.session.userId,
      toUserId: uid,
      isRead: false,
      createdAt: Utils.now()
    });
  });
};

/* ========== Modal 弹窗 ========== */
const Modal = {
  ensure(){
    const root = document.getElementById('modalRoot');
    if(!root) return null;
    if(!document.getElementById('modalMask')){
      root.innerHTML = `
        <div class="modal-mask" id="modalMask" onclick="if(event.target===this)Modal.close()">
          <div class="modal" id="modalBox" onclick="event.stopPropagation()">
            <div class="modal-header" id="modalHeader"></div>
            <div class="modal-body" id="modalBody"></div>
            <div class="modal-footer" id="modalFooter"></div>
          </div>
        </div>`;
    }
    return document.getElementById('modalMask');
  },
  open({title, body, footer, size=''}){
    Modal.ensure();
    document.getElementById('modalHeader').innerHTML = `<span>${title||''}</span><span class="modal-close" onclick="Modal.close()">×</span>`;
    document.getElementById('modalBody').innerHTML = body||'';
    document.getElementById('modalFooter').innerHTML = footer||'';
    const mask = document.getElementById('modalMask');
    const box = document.getElementById('modalBox');
    box.className = 'modal '+size;
    mask.classList.add('show');
  },
  close(){ const mask=document.getElementById('modalMask'); if(mask) mask.classList.remove('show'); },
  confirm(title, msg, onOk, okText='确定'){
    Modal.open({
      title, size:'sm',
      body:`<p style="font-size:14px;line-height:1.7">${msg}</p>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" id="modalOkBtn">${okText}</button>`
    });
    document.getElementById('modalOkBtn').onclick = ()=>{ Modal.close(); onOk&&onOk(); };
  }
};

/* ========== Toast ========== */
const Toast = {
  show(msg, type='success'){
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast '+type;
    const icon = type==='success'?'✅':type==='error'?'❌':type==='warn'?'⚠️':'ℹ️';
    el.innerHTML = `<span>${icon}</span><span>${Utils.esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(40px)'; setTimeout(()=>el.remove(),250); }, 2600);
  }
};

/* ========== 全局配置（数据字典） ========== */
/* DICT 为可变对象，支持运行时通过 DICT.applyCustom() 覆盖默认值 */
var DICT = {
  // 客户来源
  customerSource: ['主动开发','客户转介绍','招标平台','展会活动','线上咨询','合作伙伴','老客户复购','其他'],
  // 客户行业
  industry: ['政府机关','事业单位','国企央企','教育','医疗','金融','交通','能源','制造','科技互联网','其他'],
  // 客户级别
  customerLevel: [
    {value:'S',label:'S级(战略)'},
    {value:'A',label:'A级(重要)'},
    {value:'B',label:'B级(一般)'},
    {value:'C',label:'C级(普通)'}
  ],
  // 客户状态
  customerStatus: [
    {value:'active',label:'跟进中'},
    {value:'idle',label:'停滞'},
    {value:'signed',label:'已签约'},
    {value:'lost',label:'已流失'}
  ],
  // 联系人职务层级
  contactRank: [
    {value:'决策层',label:'决策层(一把手)'},
    {value:'高管',label:'高管(分管领导)'},
    {value:'中层',label:'中层(部门负责人)'},
    {value:'执行层',label:'执行层(业务骨干)'},
    {value:'其他',label:'其他'}
  ],
  // 联系人决策角色
  contactRole: ['最终决策者','技术决策者','业务决策者','关键影响者','使用者','采购经办','其他'],
  // 商机阶段
  opportunityStage: [
    {value:1,label:'意向',color:'#cbd5e1'},
    {value:2,label:'方案',color:'#60a5fa'},
    {value:3,label:'商务',color:'#f59e0b'},
    {value:4,label:'成交',color:'#16a34a'}
  ],
  // 商机竞争形势
  competition: [
    {value:'single',label:'单一来源',cls:'badge-green'},
    {value:'leading',label:'领先',cls:'badge-blue'},
    {value:'even',label:'平手',cls:'badge-orange'},
    {value:'behind',label:'落后',cls:'badge-red'}
  ],
  // 商机状态
  opportunityStatus: [
    {value:'open',label:'进行中',cls:'badge-blue'},
    {value:'delay',label:'延缓',cls:'badge-orange'},
    {value:'won',label:'赢单',cls:'badge-green'},
    {value:'lost',label:'丢单',cls:'badge-red'},
    {value:'closed',label:'关闭',cls:'badge-gray'}
  ],
  // 采购方式
  purchaseMode: ['公开招标','邀请招标','竞争性谈判','单一来源','询价','框架协议','直接采购'],
  // 跟进方式
  followupType: [
    {value:'visit',label:'上门拜访',icon:'🚶'},
    {value:'call',label:'电话沟通',icon:'📞'},
    {value:'meeting',label:'会议沟通',icon:'👥'},
    {value:'wechat',label:'微信/即时通讯',icon:'💬'},
    {value:'email',label:'邮件',icon:'✉️'},
    {value:'demo',label:'演示/POC',icon:'🖥️'},
    {value:'proposal',label:'方案提交',icon:'📄'},
    {value:'quote',label:'报价/商务',icon:'💰'},
    {value:'other',label:'其他',icon:'📌'}
  ],
  // 日程类型
  scheduleType: ['拜访客户','内部会议','方案演示','投标','商务谈判','培训','其他'],
  // 日程优先级
  priority: [
    {value:'high',label:'高',cls:'badge-red'},
    {value:'mid',label:'中',cls:'badge-orange'},
    {value:'low',label:'低',cls:'badge-gray'}
  ],
  // 产品方案
  products: ['智慧政务平台','数据中台','AI智能客服','协同办公系统','政务大屏可视化','信创适配方案','运维服务','定制开发'],
  // 资源类型
  resourceType: ['售前架构师','解决方案专家','POC工程师','演示讲师','技术专家'],
  // 用户角色
  userRole: [
    {value:'superadmin',label:'平台超管',cls:'badge-red',desc:'管理所有企业，平台运维'},
    {value:'admin',label:'企业管理员',cls:'badge-gold',desc:'管理本企业信息/组织/用户'},
    {value:'manager',label:'销售经理',cls:'badge-blue',desc:'查看团队数据，管理下属'},
    {value:'sales',label:'销售专员',cls:'badge-green',desc:'管理自己的客户和商机'},
  ],
  // 企业版本
  enterpriseLicense: [
    {value:'enterprise',label:'企业版',cls:'badge-gold'},
    {value:'professional',label:'专业版',cls:'badge-blue'},
    {value:'standard',label:'标准版',cls:'badge-green'},
    {value:'trial',label:'试用版',cls:'badge-gray'},
  ],
  // 企业状态
  enterpriseStatus: [
    {value:'active',label:'正常',cls:'badge-green'},
    {value:'suspended',label:'已暂停',cls:'badge-orange'},
    {value:'expired',label:'已到期',cls:'badge-red'},
  ],
  // 用户状态
  userStatus: [
    {value:'active',label:'正常',cls:'badge-green'},
    {value:'disabled',label:'已禁用',cls:'badge-red'},
  ],
  // 赢单原因（结构化）
  winReason: [
    {value:'product',label:'方案/产品优势',icon:'💡'},
    {value:'relationship',label:'客户关系到位',icon:'🤝'},
    {value:'price',label:'价格竞争力',icon:'💰'},
    {value:'brand',label:'品牌/案例背书',icon:'🏆'},
    {value:'service',label:'服务/交付能力',icon:'🛠️'},
    {value:'timing',label:'时机/政策利好',icon:'⏰'},
    {value:'single',label:'单一来源/无竞争',icon:'🎯'},
    {value:'other',label:'其他',icon:'📌'},
  ],
  // 丢单原因（结构化）
  lossReason: [
    {value:'price',label:'价格过高',icon:'💸'},
    {value:'competitor',label:'竞品获胜',icon:'⚔️'},
    {value:'relationship',label:'客户关系不足',icon:'🙅'},
    {value:'solution',label:'方案不匹配',icon:'❌'},
    {value:'budget',label:'预算取消/缩减',icon:'📉'},
    {value:'timing',label:'时机不对/项目搁置',icon:'⏸️'},
    {value:'procurement',label:'采购流程失利',icon:'📋'},
    {value:'other',label:'其他',icon:'📌'},
  ],
};

// 根据字典 value 找 label
DICT.label = function(dictName, value){
  const d = DICT[dictName];
  if(!d) return value;
  const found = d.find(x=>(typeof x==='object'?x.value:x)===value);
  return found ? (typeof found==='object'?found.label:found) : value;
};
DICT.cls = function(dictName, value){
  const d = DICT[dictName];
  if(!d) return '';
  const found = d.find(x=>x.value===value);
  return found&&found.cls ? found.cls : '';
};

/* ----- 数据字典元数据（描述每个字典的结构，用于编辑器渲染） ----- */
/* type: 'simple'=纯字符串数组, 'object'=对象数组 */
/* fields: object类型的字段定义 [{key,label,type}] */
/* system: true=系统级字典不可编辑 */
DICT.META = {
  customerSource:   { label:'客户来源',     type:'simple' },
  industry:         { label:'客户行业',     type:'simple' },
  customerLevel:    { label:'客户级别',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'}] },
  customerStatus:   { label:'客户状态',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式',type:'select',options:['badge-green','badge-blue','badge-orange','badge-red','badge-gray','badge-gold']}] },
  contactRank:      { label:'联系人职务层级',type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'}] },
  contactRole:      { label:'联系人决策角色',type:'simple' },
  opportunityStage: { label:'商机阶段',     type:'object', fields:[{key:'value',label:'值',type:'number'},{key:'label',label:'显示名'},{key:'color',label:'颜色',type:'color'}] },
  competition:      { label:'竞争形势',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式',type:'select',options:['badge-green','badge-blue','badge-orange','badge-red','badge-gray','badge-gold']}] },
  opportunityStatus:{ label:'商机状态',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式',type:'select',options:['badge-green','badge-blue','badge-orange','badge-red','badge-gray','badge-gold']}] },
  purchaseMode:     { label:'采购方式',     type:'simple' },
  followupType:     { label:'跟进方式',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'icon',label:'图标'}] },
  scheduleType:     { label:'日程类型',     type:'simple' },
  priority:         { label:'日程优先级',   type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式',type:'select',options:['badge-green','badge-blue','badge-orange','badge-red','badge-gray','badge-gold']}] },
  products:         { label:'产品方案',     type:'simple' },
  resourceType:     { label:'资源类型',     type:'simple' },
  winReason:        { label:'赢单原因',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'icon',label:'图标'}] },
  lossReason:       { label:'丢单原因',     type:'object', fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'icon',label:'图标'}] },
  userRole:         { label:'用户角色',     type:'object', system:true, fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式'},{key:'desc',label:'描述'}] },
  enterpriseLicense:{ label:'企业版本',     type:'object', system:true, fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式'}] },
  enterpriseStatus: { label:'企业状态',     type:'object', system:true, fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式'}] },
  userStatus:       { label:'用户状态',     type:'object', system:true, fields:[{key:'value',label:'值'},{key:'label',label:'显示名'},{key:'cls',label:'徽章样式'}] },
};

/* 深拷贝当前 DICT 作为默认值（排除函数和 META） */
DICT.DEFAULTS = {};
(function(){
  for(var k in DICT){
    if(k==='META'||k==='DEFAULTS'||k==='applyCustom'||k==='label'||k==='cls') continue;
    DICT.DEFAULTS[k] = JSON.parse(JSON.stringify(DICT[k]));
  }
})();

/* 应用自定义字典配置：customDict 中的 key 覆盖默认值 */
DICT.applyCustom = function(customDict){
  if(!customDict || typeof customDict!=='object') return;
  for(var key in customDict){
    if(DICT.META[key] && !DICT.META[key].system){
      DICT[key] = JSON.parse(JSON.stringify(customDict[key]));
    }
  }
};

/* 获取当前可编辑字典的完整配置（用于保存） */
DICT.getCustom = function(){
  var result = {};
  for(var key in DICT.META){
    if(DICT.META[key].system) continue;
    result[key] = JSON.parse(JSON.stringify(DICT[key]));
  }
  return result;
};

/* 重置单个字典为默认值 */
DICT.reset = function(key){
  if(DICT.DEFAULTS[key]) DICT[key] = JSON.parse(JSON.stringify(DICT.DEFAULTS[key]));
};

/* 重置所有可编辑字典为默认值 */
DICT.resetAll = function(){
  for(var key in DICT.META){
    if(DICT.META[key].system) continue;
    if(DICT.DEFAULTS[key]) DICT[key] = JSON.parse(JSON.stringify(DICT.DEFAULTS[key]));
  }
};

/* ========== 统一社会信用代码 (USCC) 校验引擎 ========== */
// 符合 GB 32100-2015 标准
Utils.USCC = {
  // 合法字符集（不含 I/O/Z/S/V）
  CHARS: '0123456789ABCDEFGHJKLMNPQRTUWXY',
  // 前17位加权因子
  WEIGHT: [1,3,9,27,19,26,16,17,20,29,25,13,8,24,10,30,28],

  // 字符 → 数值映射
  _charVal(c){
    const i = this.CHARS.indexOf(c);
    return i>=0 ? i : -1;
  },
  // 数值 → 字符映射
  _valChar(v){
    return this.CHARS[v] || '';
  },

  /** 校验统一社会信用代码
   *  @return {{valid:boolean, msg:string, formatted:string}} */
  validate(code){
    if(!code||!code.trim()) return {valid:false, msg:'请输入统一社会信用代码', formatted:''};
    const raw = code.toUpperCase().replace(/[\s\-_]/g,'');
    if(raw.length !== 18) return {valid:false, msg:`统一社会信用代码应为18位（当前${raw.length}位）`, formatted:raw};
    // 逐位校验字符合法性 & 映射数值
    const vals = [];
    for(let i=0; i<18; i++){
      const v = this._charVal(raw[i]);
      if(v<0) return {valid:false, msg:`第${i+1}位「${raw[i]}」为非法字符（不含I/O/Z/S/V）`, formatted:raw};
      vals.push(v);
    }
    // 校验码计算
    let sum = 0;
    for(let i=0; i<17; i++) sum += vals[i] * this.WEIGHT[i];
    const expectedIdx = (31 - (sum % 31)) % 31;
    if(vals[17] !== expectedIdx){
      return {valid:false, msg:`校验码不正确，第18位应为「${this._valChar(expectedIdx)}」`, formatted:raw};
    }
    return {valid:true, msg:'统一社会信用代码格式校验通过 ✓', formatted:raw};
  },

  /** 根据前17位计算校验码（用于生成合法编码） */
  computeCheck(pre17){
    if(!pre17||pre17.length!==17) return '';
    const upper = pre17.toUpperCase();
    let sum = 0;
    for(let i=0; i<17; i++){
      const v = this._charVal(upper[i]);
      if(v<0) return '';
      sum += v * this.WEIGHT[i];
    }
    return this._valChar((31 - (sum % 31)) % 31);
  },

  /** 生成完整的18位USCC */
  makeFull(pre17){
    const chk = this.computeCheck(pre17);
    return chk ? pre17.toUpperCase()+chk : '';
  }
};

/* ========== 人员选择器组件（带模糊搜索） ========== */
const UserPicker = {
  // 当前选中的用户ID（用于排除自己）
  _excludeId: null,

  // 获取可选人员列表（排除自己和非活跃用户）
  _getUsers(){
    const cur = Store.currentUser();
    const myId = cur ? cur.id : null;
    return Store.users().filter(u=>u.status==='active' && u.id!==myId);
  },

  // 获取用户所属部门名
  _orgName(u){
    if(!u.orgUnitId) return '';
    const org = Store.orgUnit(u.orgUnitId);
    return org ? org.name : '';
  },

  // 渲染单个用户项
  _itemHTML(u){
    const orgName = UserPicker._orgName(u);
    const sub = [u.title, orgName].filter(Boolean).join(' · ');
    const avatar = u.avatar || (u.name||'?')[0];
    return `<div class="user-picker-item" onclick="UserPicker.select('${Utils.esc(u.name)}','${u.id}')">
      <div class="user-picker-avatar">${Utils.esc(avatar)}</div>
      <div class="user-picker-info">
        <div class="user-picker-name">${Utils.esc(u.name)}</div>
        <div class="user-picker-sub">${Utils.esc(sub)}</div>
      </div>
    </div>`;
  },

  // 渲染整个选择器HTML（inputId: 输入框ID，用于表单读取值）
  render(inputId, initialValue){
    UserPicker._excludeId = Store.currentUser()?.id || null;
    const val = initialValue ? Utils.esc(initialValue) : '';
    return `<div class="user-picker-wrap">
      <input class="form-input" id="${inputId}" value="${val}" placeholder="输入姓名搜索，或点击选择人员…" autocomplete="off" oninput="UserPicker.filter(this.value)" onfocus="UserPicker.show()" onblur="setTimeout(()=>UserPicker.hide(),200)">
      <div class="user-picker-dropdown" id="userPickerDropdown"></div>
    </div>`;
  },

  // 过滤并显示列表
  filter(query){
    const q = (query||'').toLowerCase().trim();
    let users = UserPicker._getUsers();
    if(q){
      users = users.filter(u=>{
        const name = (u.name||'').toLowerCase();
        const title = (u.title||'').toLowerCase();
        const org = UserPicker._orgName(u).toLowerCase();
        return name.includes(q) || title.includes(q) || org.includes(q);
      });
    }
    const dropdown = document.getElementById('userPickerDropdown');
    if(!dropdown) return;
    if(!users.length){
      dropdown.innerHTML = '<div class="user-picker-empty">未找到匹配的人员</div>';
    } else {
      dropdown.innerHTML = users.map(u=>UserPicker._itemHTML(u)).join('');
    }
    dropdown.style.display = 'block';
  },

  // 显示列表（focus时）
  show(){
    const dropdown = document.getElementById('userPickerDropdown');
    if(!dropdown) return;
    const input = document.getElementById('tr_owner');
    const q = input ? input.value.toLowerCase().trim() : '';
    UserPicker.filter(q);
  },

  // 选中某个用户
  select(name, id){
    const input = document.getElementById('tr_owner');
    if(input) input.value = name;
    const dropdown = document.getElementById('userPickerDropdown');
    if(dropdown) dropdown.style.display = 'none';
  },

  // 关闭下拉（外部点击时）
  hide(){
    const dropdown = document.getElementById('userPickerDropdown');
    if(dropdown) dropdown.style.display = 'none';
  },
};

/* ========== 表格排序+列筛选通用组件 ========== */
/*
 * 用法:
 *   模块内定义 _sf = { sortCol:null, sortDir:null, filters:{} }
 *   模块内定义 _columns() 返回列定义数组
 *   renderList 中表头用 TableSF.renderHead(Module._columns(), Module._sf, 'Module')
 *   renderTable 中用 TableSF.apply(list, Module._columns(), Module._sf) 过滤+排序
 *   新增 onSort(key) 和 onColFilter(key,val) 方法
 *
 * 列定义格式:
 *   { key, label, sort:true/false, filter:'select'/'text'/null, type:'number'/'date'/null,
 *     opts:[{v,l}] (filter='select'时), get:(row)=>值 (可选，默认取row[key]) }
 */
const TableSF = {
  // 渲染表头（含排序图标+列筛选控件）
  renderHead(columns, sf, moduleName){
    return columns.map(col=>{
      let sortIcon = '';
      if(col.sort){
        if(sf.sortCol===col.key){
          sortIcon = sf.sortDir==='asc' ? '<span class="sf-icon sf-active">▲</span>' : '<span class="sf-icon sf-active">▼</span>';
        } else {
          sortIcon = '<span class="sf-icon">⇅</span>';
        }
      }
      let filterHtml = '';
      if(col.filter==='select' && col.opts){
        const cur = sf.filters[col.key] || '';
        filterHtml = `<div class="sf-filter" onclick="event.stopPropagation()">
          <select class="sf-select" onchange="${moduleName}.onColFilter('${col.key}',this.value)">
            <option value="">全部</option>${col.opts.map(o=>`<option value="${Utils.esc(o.v)}" ${cur===String(o.v)?'selected':''}>${Utils.esc(o.l)}</option>`).join('')}
          </select></div>`;
      } else if(col.filter==='text'){
        const cur = sf.filters[col.key] || '';
        filterHtml = `<div class="sf-filter" onclick="event.stopPropagation()">
          <input class="sf-input" placeholder="筛选…" value="${Utils.esc(cur)}" oninput="${moduleName}.onColFilter('${col.key}',this.value)">
        </div>`;
      }
      const click = col.sort ? ` onclick="${moduleName}.onSort('${col.key}')"` : '';
      const cls = col.sort ? ' th-sortable' : '';
      return `<th class="th-sf${cls}"${click}><div class="th-sf-label">${col.label}${sortIcon}</div>${filterHtml}</th>`;
    }).join('');
  },

  // 应用列筛选 + 排序
  apply(list, columns, sf){
    let result = list.slice();
    // 列筛选
    columns.forEach(col=>{
      const f = sf.filters[col.key];
      if(f){
        const getter = col.get || ((row)=>row[col.key]);
        if(col.filter==='select'){
          result = result.filter(row=>String(getter(row))===String(f));
        } else if(col.filter==='text'){
          result = result.filter(row=>String(getter(row)||'').toLowerCase().includes(f.toLowerCase()));
        }
      }
    });
    // 排序
    if(sf.sortCol && sf.sortDir){
      const col = columns.find(c=>c.key===sf.sortCol);
      if(col){
        const getter = col.get || ((row)=>row[col.key]);
        const dir = sf.sortDir==='asc' ? 1 : -1;
        result.sort((a,b)=>{
          let va = getter(a), vb = getter(b);
          if(col.type==='number'){
            va = Number(va)||0; vb = Number(vb)||0;
            return (va-vb)*dir;
          }
          if(col.type==='date'){
            va = va?new Date(va).getTime():0; vb = vb?new Date(vb).getTime():0;
            return (va-vb)*dir;
          }
          // 字符串比较（支持中文）
          return String(va||'').localeCompare(String(vb||''), 'zh')*dir;
        });
      }
    }
    return result;
  },

  // 处理排序点击（3态：null→asc→desc→null）
  onSort(key, sf){
    if(sf.sortCol===key){
      if(sf.sortDir==='asc') sf.sortDir='desc';
      else if(sf.sortDir==='desc'){ sf.sortCol=null; sf.sortDir=null; }
      else sf.sortDir='asc';
    } else {
      sf.sortCol = key;
      sf.sortDir = 'asc';
    }
  },

  // 处理列筛选变化
  onColFilter(key, val, sf){
    if(val) sf.filters[key] = val;
    else delete sf.filters[key];
  },
};
