/* ========== 联系人管理模块 ========== */
const Contact = {
  _sf: { sortCol:null, sortDir:null, filters:{} },

  _columns(){
    const custOpts = Store.customers().map(c=>({v:c.id,l:c.shortName||c.name}));
    return [
      { key:'name', label:'姓名', sort:true, filter:'text', get:(c)=>c.name },
      { key:'customerId', label:'所属客户', sort:true, filter:'select', opts:custOpts, get:(c)=>{ const cu=Store.customer(c.customerId); return cu?(cu.shortName||cu.name):''; } },
      { key:'title', label:'职务', sort:true, filter:'text', get:(c)=>c.title||'' },
      { key:'rank', label:'层级', sort:true, filter:'select', opts:DICT.contactRank.map(d=>({v:d.value,l:d.label})), get:(c)=>c.rank },
      { key:'role', label:'决策角色', sort:true, filter:'select', opts:DICT.contactRole.map(r=>({v:r,l:r})), get:(c)=>c.role||'' },
      { key:'attitude', label:'态度', sort:true, filter:'select', opts:[{v:'支持',l:'支持'},{v:'中立',l:'中立'},{v:'反对',l:'反对'},{v:'未知',l:'未知'}], get:(c)=>c.attitude||'' },
      { key:'mobile', label:'联系方式', sort:false },
      { key:'isKey', label:'关键人', sort:true, filter:'select', opts:[{v:'1',l:'是'},{v:'0',l:'否'}], get:(c)=>c.isKey?'1':'0' },
    ];
  },

  renderList(){
    setTimeout(()=>Contact.renderTable(),0);
    return `
    <div class="page-head">
      <div><div class="page-title">👤 联系人管理 <span class="badge badge-blue">数据底座</span></div>
      <div class="page-desc">管理政企客户关键联系人、决策角色与关系维护</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="Contact.openForm()">＋ 新建联系人</button></div>
    </div>
    <div class="filter-bar">
      <input id="ctKw" placeholder="搜索姓名/职务…" oninput="Contact.renderTable()" style="width:240px">
      <span class="sf-tip">点击表头排序 · 列内筛选</span>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap"><table class="data-table">
        <thead><tr id="ctThead">${TableSF.renderHead(Contact._columns(), Contact._sf, 'Contact')}<th>操作</th></tr></thead>
        <tbody id="ctTbody"></tbody>
      </table></div>
    </div>
    <div id="ctCount" class="foot-note"></div>
    `;
  },

  renderTable(){
    const kw=(document.getElementById('ctKw')?.value||'').trim();
    let list=Store.contacts();
    if(kw) list=list.filter(c=>c.name.includes(kw)||(c.title||'').includes(kw));
    // 应用列排序+列筛选
    list = TableSF.apply(list, Contact._columns(), Contact._sf);

    const tb=document.getElementById('ctTbody');
    // 更新表头排序图标
    const thead=document.getElementById('ctThead');
    if(thead) thead.innerHTML = TableSF.renderHead(Contact._columns(), Contact._sf, 'Contact') + '<th>操作</th>';

    if(!list.length){ tb.innerHTML='<tr><td colspan="9"><div class="empty"><div class="empty-icon">👤</div>暂无联系人</div></td></tr>'; }
    else{
      tb.innerHTML=list.map(ct=>{
        const c=Store.customer(ct.customerId);
        const rankCls=ct.rank==='决策层'?'badge-red':ct.rank==='高管'?'badge-orange':ct.rank==='中层'?'badge-blue':'badge-gray';
        const attCls=ct.attitude==='支持'?'badge-green':ct.attitude==='中立'?'badge-orange':'badge-gray';
        return `<tr onclick="Contact.openDetail('${ct.id}')">
          <td class="row-name">${Utils.esc(ct.name)}</td>
          <td><span class="link" onclick="event.stopPropagation();Customer.openDetail('${ct.customerId}')">${Utils.esc(c?c.shortName||c.name:'—')}</span></td>
          <td>${Utils.esc(ct.title||'—')}</td>
          <td><span class="badge ${rankCls}">${DICT.label('contactRank',ct.rank)}</span></td>
          <td>${Utils.esc(ct.role||'—')}</td>
          <td><span class="badge ${attCls}">${Utils.esc(ct.attitude||'—')}</span></td>
          <td class="text-sm">${Utils.esc(ct.mobile||'')}<br><span class="text-gray">${Utils.esc(ct.email||'')}</span></td>
          <td>${ct.isKey?'<span class="badge badge-gold">⭐</span>':'—'}</td>
          <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="Contact.openForm('${ct.id}')">编辑</button></td>
        </tr>`;
      }).join('');
    }
    document.getElementById('ctCount').textContent=`共 ${list.length} 个联系人`;
  },

  // 排序
  onSort(key){
    TableSF.onSort(key, Contact._sf);
    Contact.renderTable();
  },
  // 列筛选
  onColFilter(key, val){
    TableSF.onColFilter(key, val, Contact._sf);
    Contact.renderTable();
  },

  openDetail(id){
    const ct=Store.contact(id);
    if(!ct) return Toast.show('联系人不存在','error');
    const c=Store.customer(ct.customerId);
    const opps=Store.oppsByContact(id);
    const fus=Store.followupsByContact(id);
    const rankCls=ct.rank==='决策层'?'badge-red':ct.rank==='高管'?'badge-orange':ct.rank==='中层'?'badge-blue':'badge-gray';
    Modal.open({
      title:`<span style="color:var(--gold)">👤</span> ${Utils.esc(ct.name)} ${ct.isKey?'<span class="badge badge-gold">⭐关键人</span>':''}`,
      size:'lg',
      body:`
      <div class="detail-head">
        <div>
          <div class="detail-name">${Utils.esc(ct.name)} <span class="badge ${rankCls}">${DICT.label('contactRank',ct.rank)}</span></div>
          <div class="detail-meta">${Utils.esc(ct.title||'')} · ${Utils.esc(ct.dept||'')} · 所属客户：<span class="link" onclick="Customer.openDetail('${ct.customerId}')">${Utils.esc(c?c.name:'—')}</span></div>
        </div>
        <div class="toolbar">
          <button class="btn btn-blue btn-sm" onclick="Followup.openForm(0,{contactId:'${id}',customerId:'${ct.customerId}'})">＋ 跟进</button>
          <button class="btn btn-ghost btn-sm" onclick="Contact.openForm('${id}')">编辑</button>
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat-card"><div class="stat-label">决策角色</div><div class="stat-value" style="font-size:18px">${Utils.esc(ct.role||'—')}</div></div>
        <div class="stat-card gold"><div class="stat-label">关联商机</div><div class="stat-value">${opps.length}</div></div>
        <div class="stat-card green"><div class="stat-label">跟进次数</div><div class="stat-value">${fus.length}</div></div>
        <div class="stat-card orange"><div class="stat-label">态度</div><div class="stat-value" style="font-size:18px">${Utils.esc(ct.attitude||'—')}</div></div>
      </div>
      <div class="tabs" id="ctTabs">
        <div class="tab active" onclick="Contact.tab('${id}','base',this)">基本信息</div>
        <div class="tab" onclick="Contact.tab('${id}','opps',this)">关联商机(${opps.length})</div>
        <div class="tab" onclick="Contact.tab('${id}','followups',this)">跟进记录(${fus.length})</div>
      </div>
      <div id="ctTabBody"></div>
      `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">关闭</button>`
    });
    Contact.tab(id,'base');
  },

  tab(id,type,el){
    document.querySelectorAll('#ctTabs .tab').forEach(t=>t.classList.remove('active'));
    if(el) el.classList.add('active');
    const ct=Store.contact(id);
    const box=document.getElementById('ctTabBody');
    if(type==='base'){
      box.innerHTML=`
      <div class="info-grid">
        <div class="info-item"><div class="info-label">姓名</div><div class="info-value">${Utils.esc(ct.name)}</div></div>
        <div class="info-item"><div class="info-label">所属客户</div><div class="info-value"><span class="link" onclick="Customer.openDetail('${ct.customerId}')">${Utils.esc(Store.customer(ct.customerId)?.name||'—')}</span></div></div>
        <div class="info-item"><div class="info-label">职务</div><div class="info-value">${Utils.esc(ct.title||'—')}</div></div>
        <div class="info-item"><div class="info-label">所属部门</div><div class="info-value">${Utils.esc(ct.dept||'—')}</div></div>
        <div class="info-item"><div class="info-label">职级层级</div><div class="info-value">${DICT.label('contactRank',ct.rank)}</div></div>
        <div class="info-item"><div class="info-label">决策角色</div><div class="info-value">${Utils.esc(ct.role||'—')}</div></div>
        <div class="info-item"><div class="info-label">手机</div><div class="info-value">${Utils.esc(ct.mobile||'—')}</div></div>
        <div class="info-item"><div class="info-label">邮箱</div><div class="info-value">${Utils.esc(ct.email||'—')}</div></div>
        <div class="info-item"><div class="info-label">态度倾向</div><div class="info-value">${Utils.esc(ct.attitude||'—')}</div></div>
        <div class="info-item"><div class="info-label">关键人</div><div class="info-value">${ct.isKey?'是':'否'}</div></div>
      </div>
      ${ct.remark?`<div class="mt16"><div class="form-label">备注</div><div style="background:var(--gray-bg);padding:12px;border-radius:8px;font-size:13px">${Utils.esc(ct.remark)}</div></div>`:''}
      `;
    } else if(type==='opps'){
      const list=Store.oppsByContact(id);
      box.innerHTML=list.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>商机名称</th><th>客户</th><th>金额</th><th>阶段</th><th>状态</th></tr></thead>
      <tbody>${list.map(o=>{const st=DICT.opportunityStage.find(s=>s.value===o.stage)||{};const ss=DICT.opportunityStatus.find(s=>s.value===o.status)||{};const cu=Store.customer(o.customerId);return `<tr onclick="Opportunity.openDetail('${o.id}')"><td class="row-name">${Utils.esc(o.name)}</td><td>${Utils.esc(cu?cu.shortName:'')}</td><td>${Utils.fmtMoney(o.amount)}</td><td><span class="badge badge-blue">${st.label}</span></td><td><span class="badge ${ss.cls}">${ss.label}</span></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty">暂无关联商机</div>';
    } else if(type==='followups'){
      const list=Store.followupsByContact(id).sort((a,b)=>new Date(b.at)-new Date(a.at));
      box.innerHTML=list.length?`<div class="timeline">${list.map(f=>{const ti=DICT.followupType.find(t=>t.value===f.type)||{};return `<div class="tl-item"><div class="tl-time">${Utils.fmtDateTime(f.at)}</div><div class="tl-type">${ti.icon||'📌'} ${ti.label||f.type}</div><div>${Utils.esc(f.content)}</div>${f.nextAction?`<div class="tl-content">📋 ${Utils.esc(f.nextAction)}</div>`:''}</div>`;}).join('')}</div>`:'<div class="empty">暂无跟进记录</div>';
    }
  },

  openForm(id, preset){
    const ct=id?Store.contact(id):{};
    const preCust = preset?.customerId || ct.customerId || '';
    Modal.open({
      title:id?'编辑联系人':'新建联系人',size:'lg',
      body:`
      <div id="ctForm">
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">姓名 <span class="req">*</span></label><input class="form-input" id="f_name" value="${Utils.esc(ct.name||'')}" oninput="Contact.checkDup()"></div>
          <div class="form-row"><label class="form-label">所属客户 <span class="req">*</span></label>
            <select class="form-select" id="f_customerId">${Utils.options(Store.customers().map(c=>({value:c.id,label:c.shortName||c.name})),preCust,'请选择')}</select></div>
        </div>
        <div id="dupTip2"></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">职务</label><input class="form-input" id="f_title" value="${Utils.esc(ct.title||'')}" placeholder="如：信息化处处长"></div>
          <div class="form-row"><label class="form-label">所属部门</label><input class="form-input" id="f_dept" value="${Utils.esc(ct.dept||'')}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">职级层级</label><select class="form-select" id="f_rank">${Utils.options(DICT.contactRank,ct.rank||'','请选择')}</select></div>
          <div class="form-row"><label class="form-label">决策角色</label><select class="form-select" id="f_role">${Utils.options(DICT.contactRole,ct.role||'','请选择')}</select></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">手机</label><input class="form-input" id="f_mobile" value="${Utils.esc(ct.mobile||'')}" oninput="Contact.checkDup()"></div>
          <div class="form-row"><label class="form-label">邮箱</label><input class="form-input" id="f_email" value="${Utils.esc(ct.email||'')}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">态度倾向</label><select class="form-select" id="f_attitude">${Utils.options(['支持','中立','反对','未知'],ct.attitude||'','请选择')}</select></div>
          <div class="form-row"><label class="form-label">关键联系人</label><select class="form-select" id="f_isKey">${Utils.options([{value:0,label:'否'},{value:1,label:'是 ⭐'}],ct.isKey?1:0)}</select></div>
        </div>
      <div class="form-row"><label class="form-label">备注</label><textarea class="form-textarea" id="f_remark" placeholder="人物关系、影响力、沟通要点…">${Utils.esc(ct.remark||'')}</textarea></div>
    </div>
    ${Utils.Mention.pickerHTML('contactForm', [])}
    `,      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Contact.save('${id||''}')">保存</button>`
    });
  },

  checkDup(){
    const name=document.getElementById('f_name').value.trim();
    const mobile=document.getElementById('f_mobile')?.value.trim()||'';
    const tip=document.getElementById('dupTip2');
    if(!name&&!mobile){tip.innerHTML='';return;}
    const dups=Store.findDupContacts(name,mobile);
    tip.innerHTML = dups.length?`<div class="badge badge-orange mt8" style="padding:6px 10px">⚠️ 疑似重复：${dups.map(d=>Utils.esc(d.name)).join('、')}</div>`:'';
  },

  save(id){
    const name=val('f_name'), customerId=val('f_customerId');
    if(!name){Toast.show('请填写姓名','error');return;}
    if(!customerId){Toast.show('请选择所属客户','error');return;}
    const data={
      name, customerId, title:val('f_title'), dept:val('f_dept'),
      rank:val('f_rank'), role:val('f_role'), mobile:val('f_mobile'), email:val('f_email'),
      attitude:val('f_attitude'), isKey:val('f_isKey')=='1', remark:val('f_remark')
    };
    if(id){Store.updateContact(id,data);Toast.show('联系人已更新','success');}
    else{const newCt=Store.addContact(data);data.id=newCt.id;Toast.show('联系人新建成功','success');}
    // 发送协同通知
    const mentionedIds = Utils.Mention.getSelected('contactForm');
    if(mentionedIds.length){
      const cus = Store.customer(customerId);
      Utils.createNotification({
        type: 'contact_new', refType: 'contact', refId: data.id||id,
        title: (id?'更新':'新建')+'联系人：'+name,
        message: (id?'更新了':'新建了')+'联系人「'+name+'」'+(cus?'（'+cus.shortName+'）':''),
        toUserIds: mentionedIds
      });
    }
    Modal.close();
    if(App.currentRoute==='contact')Contact.renderTable();
    else App.navigate('contact');
    function val(x){return document.getElementById(x).value.trim();}
  }
};
