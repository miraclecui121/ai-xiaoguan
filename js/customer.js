/* ========== 客户管理模块 ========== */
const Customer = {
  _sf: { sortCol:null, sortDir:null, filters:{} },

  // 列定义
  _columns(){
    const owners = Store.customers().map(c=>c.owner).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(o=>({v:o,l:o}));
    return [
      { key:'name', label:'客户名称', sort:true, filter:'text', get:(c)=>c.name },
      { key:'industry', label:'行业', sort:true, filter:'select', opts:DICT.industry.map(i=>({v:i,l:i})), get:(c)=>c.industry },
      { key:'level', label:'级别', sort:true, filter:'select', opts:DICT.customerLevel.map(d=>({v:d.value,l:d.label})), get:(c)=>c.level },
      { key:'status', label:'状态', sort:true, filter:'select', opts:DICT.customerStatus.map(d=>({v:d.value,l:d.label})), get:(c)=>c.status },
      { key:'oppCount', label:'商机数', sort:true, type:'number', get:(c)=>Store.oppsByCustomer(c.id).length },
      { key:'oppAmount', label:'商机金额', sort:true, type:'number', get:(c)=>Utils.sum(Store.oppsByCustomer(c.id),'amount') },
      { key:'owner', label:'负责人', sort:true, filter:'select', opts:owners, get:(c)=>c.owner||'' },
      { key:'lastFu', label:'最近跟进', sort:true, type:'date', get:(c)=>{ const f=Store.lastFollowup(f=>f.customerId===c.id); return f?f.at:''; } },
      { key:'protectLeft', label:'保护期', sort:true, type:'number', get:(c)=>c.protectDays?Math.max(0,c.protectDays-(Utils.daysSince(c.updatedAt)||0)):0 },
    ];
  },

  // 列表
  renderList(){
    setTimeout(()=>Customer.renderTable(),0);
    return `
    <div class="page-head">
      <div><div class="page-title">🏢 客户管理 <span class="badge badge-blue">数据底座</span></div>
      <div class="page-desc">管理政企客户档案、级别、状态与保护期，支撑销售客户资产沉淀</div></div>
      <div class="toolbar">
        <button class="btn btn-ghost" onclick="Customer.openImport()">📥 导入</button>
        <button class="btn btn-ghost" onclick="Customer.exportList()">📤 导出</button>
        <button class="btn btn-primary" onclick="Customer.openForm()">＋ 新建客户</button>
      </div>
    </div>
    <div class="filter-bar">
      <input id="custKw" placeholder="搜索客户名称…" oninput="Customer.renderTable()" style="width:240px">
      <span class="sf-tip">点击表头排序 · 列内筛选</span>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr id="custThead">${TableSF.renderHead(Customer._columns(), Customer._sf, 'Customer')}<th>操作</th></tr></thead>
          <tbody id="custTbody"></tbody>
        </table>
      </div>
    </div>
    <div id="custCount" class="foot-note"></div>
    `;
  },

  renderTable(){
    const kw = (document.getElementById('custKw')?.value||'').trim();
    let list = Store.myCustomers();
    if(kw) list = list.filter(c=>c.name.includes(kw)||c.shortName.includes(kw));
    // 应用列排序+列筛选
    list = TableSF.apply(list, Customer._columns(), Customer._sf);

    const tb = document.getElementById('custTbody');
    // 更新表头排序图标状态
    const thead = document.getElementById('custThead');
    if(thead) thead.innerHTML = TableSF.renderHead(Customer._columns(), Customer._sf, 'Customer') + '<th>操作</th>';

    if(!list.length){ tb.innerHTML = '<tr><td colspan="10"><div class="empty"><div class="empty-icon">📂</div>暂无客户，点击右上角新建</div></td></tr>'; }
    else{
      tb.innerHTML = list.map(c=>{
        const opps = Store.oppsByCustomer(c.id);
        const oppAmt = Utils.sum(opps,'amount');
        const lastFu = Store.lastFollowup(f=>f.customerId===c.id);
        const protectLeft = c.protectDays ? Math.max(0, c.protectDays - (Utils.daysSince(c.updatedAt)||0)) : 0;
        const levelCls = c.level==='S'?'badge-red':c.level==='A'?'badge-orange':c.level==='B'?'badge-blue':'badge-gray';
        const statusInfo = DICT.customerStatus.find(s=>s.value===c.status)||{};
        const statusCls = c.status==='active'?'badge-green':c.status==='signed'?'badge-blue':c.status==='lost'?'badge-red':'badge-gray';
        return `<tr onclick="Customer.openDetail('${c.id}')">
          <td><div class="row-name">${Utils.esc(c.name)}${c.uscc?' <span class="badge badge-green" style="font-size:10px;padding:1px 4px" title="USCC已认证">✓认证</span>':''}</div><div class="row-sub">${Utils.esc(c.region||'')} · ${Utils.esc(c.shortName||'')}</div></td>
          <td>${Utils.esc(c.industry)}</td>
          <td><span class="badge ${levelCls}">${c.level}级</span></td>
          <td><span class="badge ${statusCls}">${statusInfo.label||c.status}</span></td>
          <td>${opps.length}</td>
          <td>${Utils.fmtMoney(oppAmt)}</td>
          <td>${Utils.esc(c.owner||'—')}</td>
          <td><span class="text-sm text-gray">${lastFu?Utils.relativeTime(lastFu.at):'未跟进'}</span></td>
          <td>${c.protectDays?(protectLeft>0?`剩${protectLeft}天`:'<span class="badge badge-red">已过期</span>'):'—'}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="Customer.openForm('${c.id}')">编辑</button>
            <button class="btn btn-ghost btn-sm" onclick="Customer.toPool('${c.id}')">退公海</button>
          </td>
        </tr>`;
      }).join('');
    }
    document.getElementById('custCount').textContent = `共 ${list.length} 个客户`;
  },

  // 排序
  onSort(key){
    TableSF.onSort(key, Customer._sf);
    Customer.renderTable();
  },
  // 列筛选
  onColFilter(key, val){
    TableSF.onColFilter(key, val, Customer._sf);
    Customer.renderTable();
  },

  // 详情
  openDetail(id){
    const c = Store.customer(id);
    if(!c) return Toast.show('客户不存在','error');
    const opps = Store.oppsByCustomer(id);
    const contacts = Store.contactsByCustomer(id);
    const fus = Store.followupsByCustomer(id);
    const oppAmt = Utils.sum(opps,'amount');
    const levelCls = c.level==='S'?'badge-red':c.level==='A'?'badge-orange':c.level==='B'?'badge-blue':'badge-gray';
    const statusInfo = DICT.customerStatus.find(s=>s.value===c.status)||{};
    const lastFu = Store.lastFollowup(f=>f.customerId===id);

    Modal.open({
      title:`<span style="color:var(--primary)">🏢</span> ${Utils.esc(c.name)}`,
      size:'lg',
      body:`
      <div class="detail-head">
        <div>
          <div class="detail-name">${Utils.esc(c.name)} <span class="badge ${levelCls}">${c.level}级</span> <span class="badge badge-gray">${statusInfo.label}</span></div>
          <div class="detail-meta">${Utils.esc(c.industry)} · ${Utils.esc(c.region||'')} · 负责人：${Utils.esc(c.owner||'未分配')} · 创建于 ${Utils.fmtDate(c.createdAt)}</div>
        </div>
        <div class="toolbar">
          <button class="btn btn-blue btn-sm" onclick="Followup.openForm(0,{customerId:'${id}'})">＋ 跟进</button>
          <button class="btn btn-gold btn-sm" onclick="Customer.openExperts('${id}')">智能分析</button>
          <button class="btn btn-ghost btn-sm" onclick="Customer.openForm('${id}')">编辑</button>
          <button class="btn btn-ghost btn-sm" onclick="Customer.transfer('${id}')">转移</button>
          ${c.protectDays?`<button class="btn btn-ghost btn-sm" onclick="Customer.extendProtect('${id}')">续保护</button>`:''}
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat-card"><div class="stat-label">关联商机</div><div class="stat-value">${opps.length}</div><div class="stat-sub">${Utils.fmtMoney(oppAmt)}</div></div>
        <div class="stat-card gold"><div class="stat-label">联系人</div><div class="stat-value">${contacts.length}</div><div class="stat-sub">关键 ${contacts.filter(x=>x.isKey).length}</div></div>
        <div class="stat-card green"><div class="stat-label">跟进次数</div><div class="stat-value">${fus.length}</div><div class="stat-sub">${lastFu?('最近：'+Utils.relativeTime(lastFu.at)):'未跟进'}</div></div>
        <div class="stat-card orange"><div class="stat-label">保护期</div><div class="stat-value" style="font-size:20px">${c.protectDays?c.protectDays+'天':'无'}</div><div class="stat-sub">${c.protectDays?('更新于 '+Utils.relativeTime(c.updatedAt)):''}</div></div>
      </div>
      <div class="tabs" id="custTabs">
        <div class="tab active" onclick="Customer.tab('${id}','base',this)">基本信息</div>
        <div class="tab" onclick="Customer.tab('${id}','contacts',this)">联系人(${contacts.length})</div>
        <div class="tab" onclick="Customer.tab('${id}','opps',this)">商机(${opps.length})</div>
        <div class="tab" onclick="Customer.tab('${id}','followups',this)">跟进记录(${fus.length})</div>
      </div>
      <div id="custTabBody"></div>
      `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">关闭</button>`
    });
    Customer.tab(id,'base');
  },

  tab(id, type, el){
    document.querySelectorAll('#custTabs .tab').forEach(t=>t.classList.remove('active'));
    if(el) el.classList.add('active');
    const c = Store.customer(id);
    const box = document.getElementById('custTabBody');
    if(type==='base'){
      box.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><div class="info-label">客户简称</div><div class="info-value">${Utils.esc(c.shortName||'—')}</div></div>
        <div class="info-item"><div class="info-label">所属行业</div><div class="info-value">${Utils.esc(c.industry)}</div></div>
        <div class="info-item"><div class="info-label">客户级别</div><div class="info-value">${DICT.label('customerLevel',c.level)}</div></div>
        <div class="info-item"><div class="info-label">统一社会信用代码</div><div class="info-value" style="font-family:monospace;letter-spacing:0.5px">${c.uscc?`<span title="已通过格式校验">✅ ${Utils.esc(c.uscc)}</span>`:'<span style="color:var(--text-3)">未填写</span>'}</div></div>
        <div class="info-item"><div class="info-label">客户状态</div><div class="info-value">${DICT.label('customerStatus',c.status)}</div></div>
        <div class="info-item"><div class="info-label">客户来源</div><div class="info-value">${Utils.esc(c.source||'—')}</div></div>
        <div class="info-item"><div class="info-label">所在区域</div><div class="info-value">${Utils.esc(c.region||'—')}</div></div>
        <div class="info-item"><div class="info-label">详细地址</div><div class="info-value">${Utils.esc(c.address||'—')}</div></div>
        <div class="info-item"><div class="info-label">负责人</div><div class="info-value">${Utils.esc(c.owner||'未分配')}</div></div>
        <div class="info-item"><div class="info-label">保护期</div><div class="info-value">${c.protectDays?c.protectDays+'天':'—'}</div></div>
        <div class="info-item"><div class="info-label">创建时间</div><div class="info-value">${Utils.fmtDate(c.createdAt)}</div></div>
      </div>
      ${c.remark?`<div class="mt16"><div class="form-label">备注</div><div style="background:var(--gray-bg);padding:12px;border-radius:8px;font-size:13px">${Utils.esc(c.remark)}</div></div>`:''}
      `;
    } else if(type==='contacts'){
      const list = Store.contactsByCustomer(id);
      box.innerHTML = list.length?`
      <div class="toolbar mb8"><button class="btn btn-blue btn-sm" onclick="Contact.openForm('',{customerId:'${id}'})">＋ 添加联系人</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>姓名</th><th>职务</th><th>层级</th><th>决策角色</th><th>态度</th><th>联系方式</th><th>关键人</th><th>操作</th></tr></thead>
      <tbody>${list.map(ct=>`<tr onclick="Contact.openDetail('${ct.id}')">
        <td class="row-name">${Utils.esc(ct.name)}</td><td>${Utils.esc(ct.title||'—')}</td>
        <td><span class="badge badge-gray">${DICT.label('contactRank',ct.rank)}</span></td>
        <td>${Utils.esc(ct.role||'—')}</td>
        <td>${ct.attitude==='支持'?'<span class="badge badge-green">支持</span>':ct.attitude==='中立'?'<span class="badge badge-orange">中立</span>':ct.attitude?'<span class="badge badge-red">'+Utils.esc(ct.attitude)+'</span>':'—'}</td>
        <td class="text-sm">${Utils.esc(ct.mobile||'')}<br><span class="text-gray">${Utils.esc(ct.email||'')}</span></td>
        <td>${ct.isKey?'<span class="badge badge-gold">⭐关键</span>':'—'}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="Contact.openForm('${ct.id}')">编辑</button></td>
      </tr>`).join('')}</tbody></table></div>
      `:'<div class="empty"><div class="empty-icon">👤</div>暂无联系人</div>';
    } else if(type==='opps'){
      const list = Store.oppsByCustomer(id);
      box.innerHTML = list.length?`
      <div class="toolbar mb8"><button class="btn btn-blue btn-sm" onclick="Opportunity.openForm('',{customerId:'${id}'})">＋ 新建商机</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>商机名称</th><th>金额</th><th>阶段</th><th>竞争</th><th>状态</th><th>预计签约</th><th>赢单率</th></tr></thead>
      <tbody>${list.map(o=>{
        const stInfo=DICT.opportunityStage.find(s=>s.value===o.stage)||{};
        const statusInfo=DICT.opportunityStatus.find(s=>s.value===o.status)||{};
        const compInfo=DICT.competition.find(x=>x.value===o.competition)||{};
        return `<tr onclick="Opportunity.openDetail('${o.id}')">
          <td class="row-name">${Utils.esc(o.name)}</td><td>${Utils.fmtMoney(o.amount)}</td>
          <td><span class="badge badge-blue">${stInfo.label}</span></td>
          <td><span class="badge ${compInfo.cls}">${compInfo.label}</span></td>
          <td><span class="badge ${statusInfo.cls}">${statusInfo.label}</span></td>
          <td>${Utils.fmtDate(o.expectedSignDate)}</td>
          <td>${o.winProbability||0}%</td>
        </tr>`;
      }).join('')}</tbody></table></div>
      `:'<div class="empty"><div class="empty-icon">🎯</div>暂无商机</div>';
    } else if(type==='followups'){
      const list = Store.followupsByCustomer(id).sort((a,b)=>new Date(b.at)-new Date(a.at));
      box.innerHTML = `
      <div class="toolbar mb8"><button class="btn btn-blue btn-sm" onclick="Followup.openForm(0,{customerId:'${id}'})">＋ 添加跟进</button></div>
      ${list.length?`<div class="timeline">${list.map(f=>{
        const ti = DICT.followupType.find(t=>t.value===f.type)||{};
        return `<div class="tl-item ${f.type==='visit'?'':''}">
          <div class="tl-time">${Utils.fmtDateTime(f.at)} · ${Utils.esc(f.by||'')}</div>
          <div class="tl-type">${ti.icon||'📌'} ${ti.label||f.type}</div>
          <div>${Utils.esc(f.content)}</div>
          ${f.nextAction?`<div class="tl-content">📋 下一步：${Utils.esc(f.nextAction)} ${f.nextDate?`（${Utils.fmtDate(f.nextDate)}）`:''}</div>`:''}
        </div>`;
      }).join('')}</div>`:'<div class="empty"><div class="empty-icon">📝</div>暂无跟进记录</div>'}`;
    }
  },

  // 新建/编辑表单
  openForm(id, preset){
    if(!id && typeof Personal!=='undefined' && !Personal.requirePersonal('录入自己的客户数据')) return;
    if(id && Store.isDemoWorkspace && Store.isDemoWorkspace()){
      Personal.openActivation('复制演示能力，开通后维护自己的客户数据');
      return;
    }
    const c = id?Store.customer(id):{};
    const dup = c?[]:[];
    Modal.open({
      title: id?'编辑客户':'新建客户',
      size:'lg',
      body:`
      <div id="custForm">
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">客户名称 <span class="req">*</span></label>
            <input class="form-input" id="f_name" value="${Utils.esc(c.name||'')}" oninput="Customer.checkDup()" placeholder="如：江南省政务服务中心"></div>
          <div class="form-row"><label class="form-label">客户简称</label>
            <input class="form-input" id="f_shortName" value="${Utils.esc(c.shortName||'')}" placeholder="如：省政务中心"></div>
        </div>
        <div id="dupTip"></div>
        <!-- 统一社会信用代码（工商校验） -->
        <div class="form-row"><label class="form-label">统一社会信用代码（18位） <span class="req">*</span></label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input class="form-input" id="f_uscc" value="${Utils.esc(c.uscc||'')}" 
              oninput="Customer.validateUSCCField()" onblur="Customer.validateUSCCField();Customer.checkDup()"
              placeholder="如：91110108MA01HX6B2G" style="flex:1;max-width:320px;font-family:monospace;letter-spacing:1px">
            <span id="usccStatus" style="font-size:13px;white-space:nowrap;min-width:120px"></span>
            <button class="btn btn-ghost btn-sm" onclick="Customer.verifyBusiness()" title="链接工商信息核验" style="white-space:nowrap">🔍 工商核验</button>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">用于客户唯一性校验与工商信息关联，规范客户数据质量</div>
        </div>
        <div class="form-grid-3">
          <div class="form-row"><label class="form-label">行业 <span class="req">*</span></label>
            <select class="form-select" id="f_industry">${Utils.options(DICT.industry,c.industry,'请选择')}</select></div>
          <div class="form-row"><label class="form-label">客户级别</label>
            <select class="form-select" id="f_level">${Utils.options(DICT.customerLevel,c.level||'B','请选择')}</select></div>
          <div class="form-row"><label class="form-label">客户状态</label>
            <select class="form-select" id="f_status">${Utils.options(DICT.customerStatus,c.status||'active','请选择')}</select></div>
        </div>
        <div class="form-grid-3">
          <div class="form-row"><label class="form-label">客户来源</label>
            <select class="form-select" id="f_source">${Utils.options(DICT.customerSource,c.source,'请选择')}</select></div>
          <div class="form-row"><label class="form-label">所在区域</label>
            <input class="form-input" id="f_region" value="${Utils.esc(c.region||'')}" placeholder="如：江南省"></div>
          <div class="form-row"><label class="form-label">负责人</label>
            <input class="form-input" id="f_owner" value="${Utils.esc(c.owner||Store.currentOwnerName())}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">详细地址</label>
            <input class="form-input" id="f_address" value="${Utils.esc(c.address||'')}"></div>
          <div class="form-row"><label class="form-label">保护期(天)</label>
            <input class="form-input" id="f_protectDays" type="number" value="${c.protectDays||30}" placeholder="0=不保护"></div>
        </div>
        <div class="form-row"><label class="form-label">备注</label>
          <textarea class="form-textarea" id="f_remark" placeholder="客户背景、需求、关键信息…">${Utils.esc(c.remark||'')}</textarea></div>
      </div>
      ${Utils.Mention.pickerHTML('custForm', [])}
      `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Customer.save('${id||''}')">保存</button>`
    });
  },

  checkDup(){
    const name = document.getElementById('f_name').value.trim();
    const uscc = document.getElementById('f_uscc')?.value.trim();
    const tip = document.getElementById('dupTip');
    if(!name && !uscc){ tip.innerHTML=''; return; }
    const dups = Store.findDupCustomers(name, undefined, uscc);
    if(dups.length){
      let dupNames = dups.slice(0,3).map(d=>{
        const mark = uscc&&d.uscc===uscc?'<b style="color:var(--red)">[USCC重复!]</b>':'';
        return Utils.esc(d.name)+mark;
      }).join('、');
      tip.innerHTML = `<div class="badge badge-orange mt8" style="padding:6px 10px;white-space:normal">⚠️ 检测到 ${dups.length} 个疑似重复客户：${dupNames}${dups.length>3?'…':''}</div>`;
    } else { tip.innerHTML=''; }
  },

  save(id){
    const name = document.getElementById('f_name').value.trim();
    if(!name){ Toast.show('请填写客户名称','error'); return; }
    // USCC 校验
    const uscc = val('f_uscc');
    if(uscc){
      const vr = Utils.USCC.validate(uscc);
      if(!vr.valid){ Toast.show(vr.msg,'error'); return; }
      // 查重：同一USCC不能对应多个客户
      const dupUscc = Store.findCustomerByUSCC(vr.formatted, id);
      if(dupUscc){ Toast.show('该统一社会信用代码已被客户「'+dupUscc.name+'」使用','error'); return; }
    }
    const data = {
      name, shortName: val('f_shortName'), industry: val('f_industry'),
      level: val('f_level'), status: val('f_status'), source: val('f_source'),
      region: val('f_region'), owner: val('f_owner')||Store.currentOwnerName(),
      address: val('f_address'), protectDays: Number(val('f_protectDays'))||0,
      uscc: uscc?Utils.USCC.validate(uscc).formatted:'', remark: val('f_remark')
    };
    if(id){ Store.updateCustomer(id,data); Toast.show('客户已更新','success'); }
    else {
      const capacity = Store.checkCustomerCapacity ? Store.checkCustomerCapacity(1) : { ok:true };
      if(!capacity.ok){ Toast.show(capacity.message, 'warning'); return; }
      const newC = Store.addCustomer(data); data.id = newC.id; Toast.show('客户新建成功','success');
    }
    // 发送协同通知
    const mentionedIds = Utils.Mention.getSelected('custForm');
    if(mentionedIds.length){
      Utils.createNotification({
        type: 'customer_new', refType: 'customer', refId: data.id||id,
        title: (id?'更新':'新建')+'客户：'+name,
        message: (id?'更新了':'新建了')+'客户「'+name+'」',
        toUserIds: mentionedIds
      });
    }
    Modal.close();
    if(App.currentRoute==='customer') Customer.renderTable();
    else App.navigate('customer');
    function val(vid){ return (document.getElementById(vid)?.value||'').trim(); }
  },

  // 转移
  transfer(id){
    const c = Store.customer(id);
    Modal.open({title:'转移客户',size:'sm',body:`
      <div class="form-row"><label class="form-label">转移给（负责人）</label>${UserPicker.render('tr_owner','')}</div>
      <div class="form-row"><label class="form-label">转移说明</label><textarea class="form-textarea" id="tr_note" placeholder="转移原因/交接事项"></textarea></div>
    `,footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Customer.doTransfer('${id}')">确认转移</button>`});
    setTimeout(()=>UserPicker.show(),150);
  },
  doTransfer(id){
    const owner = document.getElementById('tr_owner').value.trim();
    if(!owner){ Toast.show('请填写新负责人','error'); return; }
    Store.updateCustomer(id,{owner});
    Toast.show('客户已转移给 '+owner,'success');
    Modal.close();
    if(App.currentRoute==='customer') Customer.renderTable();
  },

  extendProtect(id){
    Store.updateCustomer(id,{protectDays:30});
    Toast.show('保护期已续期30天','success');
    Customer.openDetail(id);
  },

  toPool(id){
    Modal.confirm('退回公海','确认将该客户退回公海池？退回后其他销售可领取。',()=>{
      Store.updateCustomer(id,{inPool:true, owner:'', protectDays:0, poolReason:'手动退回公海'});
      Toast.show('已退回公海','success');
      if(App.currentRoute==='customer') Customer.renderTable();
    });
  },

  // 公海
  renderPool(){
    return `
    <div class="page-head">
      <div><div class="page-title">🌊 客户公海</div><div class="page-desc">公海客户领取、退回、分配与保护管理</div></div>
    </div>
    <div class="pool-banner">
      <div><div style="font-size:16px;font-weight:600">公海客户池</div><div style="font-size:13px;opacity:.85;margin-top:3px">闲置与回收的客户资源，销售可主动领取跟进</div></div>
      <div style="font-size:28px;font-weight:700">${Store.poolCustomers().length}</div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>客户名称</th><th>行业</th><th>级别</th><th>原负责人</th><th>进入公海原因</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>${Store.poolCustomers().map(c=>{
          const levelCls=c.level==='S'?'badge-red':c.level==='A'?'badge-orange':'badge-gray';
          return `<tr>
            <td><div class="row-name" onclick="Customer.openDetail('${c.id}')">${Utils.esc(c.name)}</div></td>
            <td>${Utils.esc(c.industry)}</td><td><span class="badge ${levelCls}">${c.level}级</span></td>
            <td>${Utils.esc(c.owner||'—')}</td><td class="text-sm">${Utils.esc(c.poolReason||'—')}</td>
            <td class="text-sm text-gray">${Utils.relativeTime(c.updatedAt)}</td>
            <td><button class="btn btn-blue btn-sm" onclick="Customer.claim('${c.id}')">领取</button>
            <button class="btn btn-ghost btn-sm" onclick="Customer.assign('${c.id}')">分配</button></td>
          </tr>`;
        }).join('')||'<tr><td colspan="7"><div class="empty">公海暂无客户</div></td></tr>'}</tbody>
      </table></div>
    </div>`;
  },
  claim(id){
    const c = Store.customer(id);
    Store.updateCustomer(id,{inPool:false, owner:Store.db.settings.owner, protectDays:30, poolReason:''});
    Toast.show('已领取客户：'+c.name,'success');
    App.navigate('customer-pool');
  },
  assign(id){
    const c = Store.customer(id);
    Modal.open({title:'分配客户',size:'sm',body:`
      <div class="form-row"><label class="form-label">分配给（负责人）</label><input class="form-input" id="as_owner" placeholder="输入负责人姓名"></div>
    `,footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Customer.doAssign('${id}')">确认分配</button>`});
  },
  doAssign(id){
    const owner=document.getElementById('as_owner').value.trim();
    if(!owner){Toast.show('请填写负责人','error');return;}
    Store.updateCustomer(id,{inPool:false,owner,protectDays:30,poolReason:''});
    Toast.show('已分配给 '+owner,'success');
    App.navigate('customer-pool');
  },

  openImport(){
    if(typeof Personal!=='undefined' && !Personal.requirePersonal('导入自己的客户数据')) return;
    Modal.open({title:'导入客户数据',size:'lg',body:`
      <div class="import-panel">
        <div class="import-note">
          <div class="import-note-title">支持 CSV 文件或直接粘贴表格文本</div>
          <div class="import-note-desc">必填字段：客户名称。可选字段：客户简称、行业、级别、状态、所在区域、负责人、备注、统一社会信用代码。</div>
        </div>
        <div class="form-row">
          <label class="form-label">选择 CSV 文件</label>
          <input class="form-input" id="customerImportFile" type="file" accept=".csv,text/csv" onchange="Customer.readImportFile(this.files[0])">
        </div>
        <div class="form-row">
          <label class="form-label">或粘贴 CSV / 表格内容</label>
          <textarea class="form-textarea import-textarea" id="customerImportText" oninput="Customer.previewImport()" placeholder="客户名称,客户简称,行业,级别,状态,所在区域,负责人,备注&#10;郑州诚信志远果业有限公司,诚信志远,其他,A,跟进中,郑州,${Utils.esc(Store.currentOwnerName())},明天计划拜访"></textarea>
        </div>
        <div id="customerImportPreview" class="import-preview"></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Customer.doImport()">导入客户</button>`});
  },

  readImportFile(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e=>{
      const text = e.target.result || '';
      const box = document.getElementById('customerImportText');
      if(box) box.value = text;
      Customer.previewImport();
    };
    reader.readAsText(file, 'utf-8');
  },

  parseCSV(text){
    const rows = [];
    let row = [], cell = '', inQuote = false;
    const pushCell = ()=>{ row.push(cell); cell=''; };
    const pushRow = ()=>{ pushCell(); if(row.some(x=>String(x).trim())) rows.push(row); row=[]; };
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      const next = text[i+1];
      if(ch==='"'){
        if(inQuote && next==='"'){ cell+='"'; i++; }
        else inQuote = !inQuote;
      }else if((ch===',' || ch==='\t') && !inQuote){
        pushCell();
      }else if((ch==='\n' || ch==='\r') && !inQuote){
        if(ch==='\r' && next==='\n') i++;
        pushRow();
      }else{
        cell += ch;
      }
    }
    if(cell || row.length) pushRow();
    return rows;
  },

  normalizeImportRow(headers, row){
    const pick = (...names)=>{
      for(const name of names){
        const idx = headers.findIndex(h=>h===name);
        if(idx>=0) return (row[idx]||'').trim();
      }
      return '';
    };
    const statusRaw = pick('状态','客户状态','status');
    const levelRaw = pick('级别','客户级别','level').replace('级','').slice(0,1).toUpperCase();
    const statusMap = {'跟进中':'active','停滞':'idle','已签约':'signed','已流失':'lost','active':'active','idle':'idle','signed':'signed','lost':'lost'};
    const level = ['S','A','B','C'].includes(levelRaw) ? levelRaw : 'B';
    return {
      name: pick('客户名称','名称','name'),
      shortName: pick('客户简称','简称','shortName'),
      industry: pick('行业','industry') || '其他',
      level,
      status: statusMap[statusRaw] || 'active',
      source: pick('来源','客户来源','source') || '其他',
      region: pick('所在区域','区域','region'),
      owner: pick('负责人','owner') || Store.currentOwnerName(),
      address: pick('地址','详细地址','address'),
      protectDays: 30,
      uscc: pick('统一社会信用代码','信用代码','uscc'),
      remark: pick('备注','remark'),
      inPool: false,
    };
  },

  previewImport(){
    const text = document.getElementById('customerImportText')?.value || '';
    const preview = document.getElementById('customerImportPreview');
    if(!preview) return;
    const rows = Customer.parseCSV(text);
    if(rows.length<2){ preview.innerHTML = '<div class="foot-note">等待导入内容...</div>'; return; }
    const count = rows.length - 1;
    preview.innerHTML = `<div class="badge badge-blue">预计导入 ${count} 条客户</div>`;
  },

  doImport(){
    const text = document.getElementById('customerImportText')?.value || '';
    const rows = Customer.parseCSV(text);
    if(rows.length<2){ Toast.show('请粘贴带表头的CSV/表格内容','error'); return; }
    const headers = rows[0].map(h=>String(h||'').trim());
    let created = 0, skipped = 0, invalid = 0, capacitySkipped = 0;
    rows.slice(1).forEach(row=>{
      const data = Customer.normalizeImportRow(headers, row);
      if(!data.name){ invalid++; return; }
      const dup = Store.findDupCustomers(data.name, null, data.uscc);
      if(dup.length){ skipped++; return; }
      if(data.uscc){
        const vr = Utils.USCC.validate(data.uscc);
        if(vr.valid) data.uscc = vr.formatted;
        else data.uscc = '';
      }
      const capacity = Store.checkCustomerCapacity ? Store.checkCustomerCapacity(1) : { ok:true };
      if(!capacity.ok){ capacitySkipped++; return; }
      Store.addCustomer(data);
      created++;
    });
    Modal.close();
    Toast.show(`导入完成：新增 ${created} 条，跳过重复 ${skipped} 条，无效 ${invalid} 条${capacitySkipped ? `，超出容量 ${capacitySkipped} 条` : ''}`, 'success');
    App.navigate('customer');
  },

  // 导出客户列表到 Excel (CSV格式)
  exportList(){
    const list=Store.myCustomers();
    if(!list.length){Toast.show('没有可导出的客户数据','warn');return;}
    const columns=[
      {key:'name',label:'客户名称'},
      {key:'shortName',label:'客户简称'},
      {key:'industry',label:'行业'},
      {key:'level',label:'客户级别'},
      {key:'status',label:'状态'},
      {key:'region',label:'所在区域'},
      {key:'oppCount',label:'商机数'},
      {key:'oppAmount',label:'商机金额(元)'},
      {key:'owner',label:'负责人'},
      {key:'lastFollowup',label:'最近跟进'},
      {key:'uscc',label:'统一社会信用代码'},
      {key:'createdAt',label:'创建时间'}
    ];
    const rows=list.map(c=>({
      name:c.name,
      shortName:c.shortName||'',
      industry:c.industry||'',
      level:DICT.label('customerLevel',c.level),
      status:DICT.label('customerStatus',c.status),
      region:c.region||'',
      oppCount:Store.oppsByCustomer(c.id).length,
      oppAmount:Utils.fmtMoneyPlain(Utils.sum(Store.oppsByCustomer(c.id),'amount')),
      owner:c.owner||'',
      lastFollowup:(()=>{const f=Store.lastFollowup(x=>x.customerId===c.id);return f?Utils.fmtDate(f.at):'未跟进';})(),
      uscc:c.uscc||'',
      createdAt:Utils.fmtDate(c.createdAt)
    }));
    const csv=Utils.Export.toCSV(columns,rows);
    const filename=`客户列表_${Utils.today()}.csv`;
    Utils.Export.download(filename,csv);
    Toast.show(`已导出 ${rows.length} 条客户记录`,'success');
  },

  // ===== 工商校验 =====
  /** 实时校验USCC输入 */
  validateUSCCField(){
    const input = document.getElementById('f_uscc');
    const status = document.getElementById('usccStatus');
    if(!input||!status) return;
    const val = input.value.trim();
    if(!val){ status.innerHTML=''; return; }
    const vr = Utils.USCC.validate(val);
    if(vr.valid){
      status.innerHTML = '<span style="color:var(--green)">\u2705 格式校验通过</span>';
      Customer.checkDup();
    } else {
      status.innerHTML = `<span style="color:var(--red)" title="${Utils.esc(vr.msg)}">\u274C ${Utils.esc(vr.msg)}</span>`;
    }
  },

  /** 工商核验：跳转国家企业信用信息公示系统查询 */
  verifyBusiness(){
    const input = document.getElementById('f_uscc');
    const uscc = input?.value.trim();
    if(!uscc){ Toast.show('请先输入统一社会信用代码','warn'); return; }
    const vr = Utils.USCC.validate(uscc);
    if(!vr.valid){ Toast.show(vr.msg,'error'); return; }
    window.open('https://www.gsxt.gov.cn/index.html', '_blank', 'noopener');
    Toast.show('已打开国家企业信用信息公示系统，请在页面中查询企业名称或信用代码','success');
  },

  /** 打开智能分析视角选择弹窗 */
  openExperts(id){
    const c=Store.customer(id);
    if(!c) return;
    // 仅显示嵌入客户界面的专家：客户洞察、线索开发、客户经营
    const customerExperts=Experts.list.filter(e=>e.embedTo==='customer');
    Modal.open({
      title:`智能分析 · ${Utils.esc(c.shortName||c.name)}`,
      size:'md',
      body:`
        <div style="margin-bottom:10px;font-size:13px;color:var(--text-2)">选择一个分析视角，基于${Utils.esc(c.name)}的数据进行判断：</div>
        <div class="expert-pick-grid">
          ${customerExperts.map(e=>`
            <div class="expert-pick-item" onclick="Customer.runExpert('${id}','${e.id}')">
              <div class="expert-pick-icon" style="background:${e.color}15;color:${e.color}">${e.icon}</div>
              <div>
                <div style="font-weight:600;font-size:13px">${e.name}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px">${e.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button>`
    });
  },

  /** 执行专家分析：跳转AI对话，自动形成"客户+专家"提问并输出 */
  runExpert(id, expertId){
    Modal.close();
    const c=Store.customer(id);
    const ex=Experts.get(expertId);
    if(!c||!ex)return;
    // 先设置上下文：客户 + 专家（在导航前设置，使渲染时即显示选中状态）
    AI.ctx={customers:[],opportunities:[],experts:[]};
    AI.ctx.customers.push({id:id, name:c.shortName||c.name, icon:'🏢', color:'#1a3a6b'});
    AI.ctx.experts.push({id:expertId, name:ex.name+'专家', icon:ex.icon, color:ex.color});
    // 导航到AI页面
    App.navigate('ai');
    // 等待DOM渲染完成后自动发送
    setTimeout(()=>{
      const inp=document.getElementById('aiInput');
      if(inp)inp.value='';
      AI.send();
    },400);
  },
};
