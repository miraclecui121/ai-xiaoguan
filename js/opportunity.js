/* ========== 商机管理模块（数据底座核心） ========== */
const Opportunity = {
  viewMode: 'list',  // list | kanban
  _sf: { sortCol:null, sortDir:null, filters:{} },

  _columns(){
    const custOpts = Store.customers().map(c=>({v:c.id,l:c.shortName||c.name}));
    return [
      { key:'name', label:'商机名称', sort:true, filter:'text', get:(o)=>o.name },
      { key:'customerId', label:'客户', sort:true, filter:'select', opts:custOpts, get:(o)=>{ const c=Store.customer(o.customerId); return c?(c.shortName||c.name):''; } },
      { key:'amount', label:'金额', sort:true, type:'number', get:(o)=>o.amount },
      { key:'stage', label:'阶段进度', sort:true, filter:'select', opts:DICT.opportunityStage.map(d=>({v:d.value,l:d.label})), type:'number', get:(o)=>o.stage },
      { key:'competition', label:'竞争形势', sort:true, filter:'select', opts:DICT.competition.map(d=>({v:d.value,l:d.label})), get:(o)=>o.competition },
      { key:'status', label:'状态', sort:true, filter:'select', opts:DICT.opportunityStatus.map(d=>({v:d.value,l:d.label})), get:(o)=>o.status },
      { key:'winProb', label:'赢单率', sort:true, type:'number', get:(o)=>o.winProbability||0 },
      { key:'expectedSign', label:'预计签约', sort:true, type:'date', get:(o)=>o.expectedSignDate||'' },
    ];
  },

  renderList(){
    if(Opportunity.viewMode==='list') setTimeout(()=>Opportunity.renderTable(),0);
    return `
    <div class="page-head">
      <div><div class="page-title">🎯 商机管理 <span class="badge badge-blue">数据底座</span></div>
      <div class="page-desc">商机全生命周期：阶段推进 · 竞争形势 · 状态管理 · 赢单预测</div></div>
      <div class="toolbar">
        <button class="btn ${Opportunity.viewMode==='list'?'btn-primary':'btn-ghost'} btn-sm" onclick="Opportunity.viewMode='list';App.navigate('opportunity')">📋 列表</button>
        <button class="btn ${Opportunity.viewMode==='kanban'?'btn-primary':'btn-ghost'} btn-sm" onclick="Opportunity.viewMode='kanban';App.navigate('opportunity')">🗂️ 看板</button>
        <button class="btn btn-ghost btn-sm" onclick="Opportunity.exportList()">📤 导出</button>
        <button class="btn btn-primary" onclick="Opportunity.openForm()">＋ 新建商机</button>
      </div>
    </div>
    ${Opportunity.viewMode==='kanban'?Opportunity.renderKanban():Opportunity.renderListView()}
    `;
  },

  renderListView(){
    return `
    <div class="filter-bar">
      <input id="oppKw" placeholder="搜索商机名称…" oninput="Opportunity.renderTable()" style="width:240px">
      <span class="sf-tip">点击表头排序 · 列内筛选</span>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap"><table class="data-table">
        <thead><tr id="oppThead">${TableSF.renderHead(Opportunity._columns(), Opportunity._sf, 'Opportunity')}<th>操作</th></tr></thead>
        <tbody id="oppTbody"></tbody>
      </table></div>
    </div>
    <div id="oppCount" class="foot-note"></div>
    `;
  },

  renderTable(){
    const kw=(document.getElementById('oppKw')?.value||'').trim();
    let list=Store.opportunities();
    if(kw)list=list.filter(o=>o.name.includes(kw));
    // 应用列排序+列筛选
    list = TableSF.apply(list, Opportunity._columns(), Opportunity._sf);

    const tb=document.getElementById('oppTbody');
    // 更新表头排序图标
    const thead=document.getElementById('oppThead');
    if(thead) thead.innerHTML = TableSF.renderHead(Opportunity._columns(), Opportunity._sf, 'Opportunity') + '<th>操作</th>';

    if(!list.length){tb.innerHTML='<tr><td colspan="9"><div class="empty"><div class="empty-icon">🎯</div>暂无商机</div></td></tr>';}
    else{
      tb.innerHTML=list.map(o=>{
        const c=Store.customer(o.customerId);
        const stInfo=DICT.opportunityStage.find(s=>s.value===o.stage)||{};
        const ssInfo=DICT.opportunityStatus.find(s=>s.value===o.status)||{};
        const cpInfo=DICT.competition.find(x=>x.value===o.competition)||{};
        const barHtml=Array.from({length:4},(_,i)=>`<span class="stage-${i+1}" style="${i<o.stage?'':'opacity:.25'}"></span>`).join('');
        return `<tr onclick="Opportunity.openDetail('${o.id}')">
          <td><div class="row-name">${Utils.esc(o.name)}</div><div class="row-sub">${Utils.esc(o.product||'')}</div></td>
          <td><span class="link" onclick="event.stopPropagation();Customer.openDetail('${o.customerId}')">${Utils.esc(c?c.shortName||c.name:'—')}</span></td>
          <td><b>${Utils.fmtMoney(o.amount)}</b><div class="row-sub">预算 ${Utils.fmtMoney(o.budget)}</div></td>
          <td><div class="stage-bar">${barHtml}</div><div class="row-sub" style="margin-top:3px">${stInfo.label}</div></td>
          <td><span class="badge ${cpInfo.cls}">${cpInfo.label}</span></td>
          <td><span class="badge ${ssInfo.cls}">${ssInfo.label}</span></td>
          <td><b style="color:${(o.winProbability||0)>=60?'var(--green)':(o.winProbability||0)>=40?'var(--orange)':'var(--red)'}">${o.winProbability||0}%</b></td>
          <td class="text-sm">${Utils.fmtDate(o.expectedSignDate)}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="Opportunity.openForm('${o.id}')">编辑</button>
          </td>
        </tr>`;
      }).join('');
    }
    document.getElementById('oppCount').textContent=`共 ${list.length} 个商机 · 总金额 ${Utils.fmtMoney(Utils.sum(list,'amount'))}`;
  },

  // 排序
  onSort(key){
    TableSF.onSort(key, Opportunity._sf);
    Opportunity.renderTable();
  },
  // 列筛选
  onColFilter(key, val){
    TableSF.onColFilter(key, val, Opportunity._sf);
    Opportunity.renderTable();
  },

  // 看板视图（按阶段分列）
  renderKanban(){
    const stages=DICT.opportunityStage;
    const openOpps=Store.opportunities().filter(o=>o.status==='open');
    return `
    <div class="kanban">
      ${stages.map(s=>{
        const arr=openOpps.filter(o=>o.stage===s.value);
        const amt=Utils.sum(arr,'amount');
        return `<div class="kanban-col">
          <div class="kanban-col-head"><span style="color:${s.color}">● ${s.label}</span><span class="badge badge-gray">${arr.length}</span></div>
          <div style="font-size:11px;color:var(--text-3);padding:0 6px 8px">${Utils.fmtMoney(amt)}</div>
          ${arr.map(o=>{
            const c=Store.customer(o.customerId);
            const cpInfo=DICT.competition.find(x=>x.value===o.competition)||{};
            const borderC=o.stage===4?'var(--green)':o.stage===3?'var(--orange)':o.stage===2?'var(--primary-light)':'var(--gray)';
            return `<div class="kanban-card" style="border-left-color:${borderC}" onclick="Opportunity.openDetail('${o.id}')">
              <div class="kc-title">${Utils.esc(o.name)}</div>
              <div class="kc-meta"><span>${Utils.esc(c?c.shortName:'')}</span><span><b>${Utils.fmtMoney(o.amount)}</b></span></div>
              <div class="kc-meta" style="margin-top:4px"><span class="badge ${cpInfo.cls}" style="font-size:10px">${cpInfo.label}</span><span>${o.winProbability||0}%</span></div>
            </div>`;
          }).join('')||'<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">暂无</div>'}
        </div>`;
      }).join('')}
    </div>`;
  },

  // 详情
  openDetail(id){
    const o=Store.opportunity(id);
    if(!o) return Toast.show('商机不存在','error');
    const c=Store.customer(o.customerId);
    const fus=Store.followupsByOpp(id);
    const contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    const stInfo=DICT.opportunityStage.find(s=>s.value===o.stage)||{};
    const ssInfo=DICT.opportunityStatus.find(s=>s.value===o.status)||{};
    const cpInfo=DICT.competition.find(x=>x.value===o.competition)||{};

    Modal.open({
      title:`<span style="color:var(--green)">🎯</span> ${Utils.esc(o.name)}`,
      size:'lg',
      body:`
      <div class="detail-head">
        <div>
          <div class="detail-name">${Utils.esc(o.name)} <span class="badge ${ssInfo.cls}">${ssInfo.label}</span></div>
          <div class="detail-meta">${Utils.esc(c?c.name:'')} · ${Utils.esc(o.product||'')} · 负责人：${Utils.esc(o.owner||'')} · 创建于 ${Utils.fmtDate(o.createdAt)}</div>
        </div>
        <div class="toolbar">
          ${o.status==='open'||o.status==='delay'?`
          ${o.stage<4?`<button class="btn btn-gold btn-sm" onclick="Opportunity.advance('${id}')">➤ 推进阶段</button>`:''}
          <button class="btn btn-gold btn-sm" onclick="Opportunity.openExperts('${id}')">智能分析</button>
          <button class="btn btn-blue btn-sm" onclick="Opportunity.openForm('${id}')">编辑</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="Opportunity.duplicate('${id}')">复制</button>
          <button class="btn btn-ghost btn-sm" onclick="Opportunity.transfer('${id}')">转移</button>
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat-card gold"><div class="stat-label">商机金额</div><div class="stat-value">${Utils.fmtMoney(o.amount)}</div><div class="stat-sub">预算 ${Utils.fmtMoney(o.budget)}</div></div>
        <div class="stat-card green"><div class="stat-label">当前阶段</div><div class="stat-value" style="font-size:22px">${stInfo.label}</div><div class="stat-sub">阶段 ${o.stage}/4</div></div>
        <div class="stat-card ${cpInfo.label==='领先'||cpInfo.label==='单一来源'?'green':cpInfo.label==='平手'?'orange':'red'}"><div class="stat-label">竞争形势</div><div class="stat-value" style="font-size:20px">${cpInfo.label}</div></div>
        <div class="stat-card ${o.winProbability>=60?'green':o.winProbability>=40?'orange':'red'}"><div class="stat-label">赢单概率</div><div class="stat-value">${o.winProbability||0}%</div><div class="stat-sub">预计签约 ${Utils.fmtDate(o.expectedSignDate)}</div></div>
      </div>
      <!-- 阶段进度条 -->
      <div style="display:flex;align-items:center;margin-bottom:16px;background:var(--gray-bg);border-radius:10px;padding:10px 14px">
        ${DICT.opportunityStage.map((s,i)=>{
          const active=o.stage>=s.value;
          return `<div style="flex:1;text-align:center;position:relative">
            <div style="width:28px;height:28px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;background:${active?s.color:'#c0c8d4'}">${s.value}</div>
            <div style="font-size:12px;color:${active?'var(--text)':'var(--text-3)'}">${s.label}</div>
          </div>${i<3?`<div style="flex:0 0 30px;height:2px;background:${o.stage>s.value?s.color:'#c0c8d4'};align-self:center;margin-top:-14px"></div>`:''}`;
        }).join('')}
      </div>
      <div class="tabs" id="oppTabs">
        <div class="tab active" onclick="Opportunity.tab('${id}','base',this)">基本信息</div>
        <div class="tab" onclick="Opportunity.tab('${id}','contacts',this)">联系人/角色(${contacts.length})</div>
        <div class="tab" onclick="Opportunity.tab('${id}','competition',this)">竞争形势</div>
        <div class="tab" onclick="Opportunity.tab('${id}','followups',this)">跟进记录(${fus.length})</div>
        ${o.status==='open'||o.status==='delay'?`<div class="tab" onclick="Opportunity.tab('${id}','status',this)">状态管理</div>`:''}
      </div>
      <div id="oppTabBody"></div>
      `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">关闭</button>${o.status==='open'||o.status==='delay'?`<button class="btn btn-blue btn-sm" onclick="Followup.openForm(0,{opportunityId:'${id}',customerId:'${o.customerId}'})">＋ 添加跟进</button>`:''}`
    });
    Opportunity.tab(id,'base');
  },

  tab(id,type,el){
    document.querySelectorAll('#oppTabs .tab').forEach(t=>t.classList.remove('active'));
    if(el)el.classList.add('active');
    const o=Store.opportunity(id);
    const box=document.getElementById('oppTabBody');
    if(type==='base'){
      box.innerHTML=`
      <div class="info-grid">
        <div class="info-item"><div class="info-label">商机名称</div><div class="info-value">${Utils.esc(o.name)}</div></div>
        <div class="info-item"><div class="info-label">所属客户</div><div class="info-value"><span class="link" onclick="Customer.openDetail('${o.customerId}')">${Utils.esc(Store.customer(o.customerId)?.name||'')}</span></div></div>
        <div class="info-item"><div class="info-label">产品方案</div><div class="info-value">${Utils.esc(o.product||'—')}</div></div>
        <div class="info-item"><div class="info-label">应用部门</div><div class="info-value">${Utils.esc(o.applyDept||'—')}</div></div>
        <div class="info-item"><div class="info-label">商机金额</div><div class="info-value">${Utils.fmtMoneyPlain(o.amount)}</div></div>
        <div class="info-item"><div class="info-label">预算金额</div><div class="info-value">${Utils.fmtMoneyPlain(o.budget)}</div></div>
        <div class="info-item"><div class="info-label">采购方式</div><div class="info-value">${Utils.esc(o.purchaseMode||'—')}</div></div>
        <div class="info-item"><div class="info-label">预计签约</div><div class="info-value">${Utils.fmtDate(o.expectedSignDate)}</div></div>
        <div class="info-item"><div class="info-label">当前阶段</div><div class="info-value">${DICT.label('opportunityStage',o.stage)}</div></div>
        <div class="info-item"><div class="info-label">竞争形势</div><div class="info-value">${DICT.label('competition',o.competition)}</div></div>
        <div class="info-item"><div class="info-label">赢单概率</div><div class="info-value">${o.winProbability||0}%</div></div>
        <div class="info-item"><div class="info-label">负责人</div><div class="info-value">${Utils.esc(o.owner||'—')}</div></div>
        <div class="info-item"><div class="info-label">观察人</div><div class="info-value">${Utils.esc((o.observers||[]).join('、')||'—')}</div></div>
        <div class="info-item"><div class="info-label">赢单日期</div><div class="info-value">${Utils.fmtDate(o.winDate)||'—'}</div></div>
        <div class="info-item"><div class="info-label">创建时间</div><div class="info-value">${Utils.fmtDate(o.createdAt)}</div></div>
      </div>
      ${o.decisionFlow?`<div class="mt16"><div class="form-label">采购决策流程</div><div style="background:var(--gray-bg);padding:12px;border-radius:8px;font-size:13px">${Utils.esc(o.decisionFlow)}</div></div>`:''}
      ${o.remark?`<div class="mt12"><div class="form-label">备注</div><div style="background:var(--primary-bg);padding:12px;border-radius:8px;font-size:13px">${Utils.esc(o.remark)}</div></div>`:''}
      `;
    } else if(type==='contacts'){
      const list=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
      box.innerHTML=`
      <div class="toolbar mb8"><button class="btn btn-blue btn-sm" onclick="Opportunity.linkContact('${id}')">＋ 关联联系人</button></div>
      ${list.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>姓名</th><th>客户</th><th>职务</th><th>层级</th><th>决策角色</th><th>态度</th><th>操作</th></tr></thead>
      <tbody>${list.map(ct=>{const cu=Store.customer(ct.customerId);const rc=ct.rank==='决策层'?'badge-red':ct.rank==='高管'?'badge-orange':'badge-blue';const ac=ct.attitude==='支持'?'badge-green':ct.attitude==='中立'?'badge-orange':'badge-gray';return `<tr onclick="Contact.openDetail('${ct.id}')"><td class="row-name">${Utils.esc(ct.name)}${ct.isKey?' ⭐':''}</td><td>${Utils.esc(cu?cu.shortName:'')}</td><td>${Utils.esc(ct.title||'')}</td><td><span class="badge ${rc}">${DICT.label('contactRank',ct.rank)}</span></td><td>${Utils.esc(ct.role||'')}</td><td><span class="badge ${ac}">${Utils.esc(ct.attitude||'')}</span></td><td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="Opportunity.unlinkContact('${id}','${ct.id}')">移除</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty">暂未关联联系人</div>'}`;
    } else if(type==='competition'){
      box.innerHTML=`
      <div class="info-grid">
        <div class="info-item"><div class="info-label">竞争形势</div><div class="info-value"><span class="badge ${cpCls(o.competition)}">${DICT.label('competition',o.competition)}</span></div></div>
        <div class="info-item"><div class="info-label">赢单概率</div><div class="info-value">${o.winProbability||0}%</div></div>
      </div>
      <div class="mt16"><div class="form-label">竞争对手</div>
        ${o.competitors&&o.competitors.length?`<div class="tag-list mt8">${o.competitors.map(x=>`<span class="badge badge-red">${Utils.esc(x)}</span>`).join('')}</div>`:'<div class="text-gray text-sm">无竞争对手（单一来源）</div>'}
      </div>
      <div class="mt16"><div class="form-label">形势分析</div><div style="background:var(--gray-bg);padding:12px;border-radius:8px;font-size:13px">${Utils.esc(o.remark||'—')}</div></div>
      <div class="mt16"><div class="form-label">更新竞争形势</div>
        <div class="flex gap8 mt8">
          ${DICT.competition.map(d=>`<button class="btn ${o.competition===d.value?'btn-primary':'btn-ghost'} btn-sm" onclick="Opportunity.setCompetition('${id}','${d.value}',${d.value==='single'?90:d.value==='leading'?70:d.value==='even'?45:25})">${d.label}</button>`).join('')}
        </div>
      </div>`;
      function cpCls(v){return DICT.competition.find(x=>x.value===v)?.cls||'';}
    } else if(type==='followups'){
      const list=Store.followupsByOpp(id).sort((a,b)=>new Date(b.at)-new Date(a.at));
      box.innerHTML=list.length?`<div class="timeline">${list.map(f=>{const ti=DICT.followupType.find(t=>t.value===f.type)||{};return `<div class="tl-item ${f.type==='visit'?'':''}"><div class="tl-time">${Utils.fmtDateTime(f.at)} · ${Utils.esc(f.by||'')}</div><div class="tl-type">${ti.icon||'📌'} ${ti.label||f.type}</div><div>${Utils.esc(f.content)}</div>${f.nextAction?`<div class="tl-content">📋 ${Utils.esc(f.nextAction)} ${f.nextDate?`（${Utils.fmtDate(f.nextDate)}）`:''}</div>`:''}</div>`;}).join('')}</div>`:'<div class="empty">暂无跟进记录</div>';
    } else if(type==='status'){
      box.innerHTML=`
      <div class="card" style="background:var(--gray-bg);box-shadow:none">
        <div class="form-label">当前状态：<span class="badge ${ssCls(o.status)}">${DICT.label('opportunityStatus',o.status)}</span></div>
        <div class="form-label mt12">变更商机状态：</div>
        <div class="flex gap8 mt8" style="flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="Opportunity.setStatus('${id}','open')">进行中</button>
          <button class="btn ${o.status==='delay'?'btn-primary':'btn-ghost'} btn-sm" onclick="Opportunity.setStatus('${id}','delay')">延缓</button>
          <button class="btn btn-gold btn-sm" onclick="Opportunity.setStatus('${id}','won')">✅ 赢单</button>
          <button class="btn btn-danger btn-sm" onclick="Opportunity.setStatus('${id}','lost')">❌ 丢单</button>
          <button class="btn btn-ghost btn-sm" onclick="Opportunity.setStatus('${id}','closed')">关闭</button>
        </div>
        ${(o.status==='won'||o.status==='lost')?`
          <div class="mt16">
            <div class="form-label">${o.status==='won'?'赢单':'丢单'}原因分析 <span style="color:var(--red)">*</span></div>
            <div class="flex gap8 mt8" style="flex-wrap:wrap">
              ${(o.status==='won'?DICT.winReason:DICT.lossReason).map(r=>`
                <button class="btn ${((o.status==='won'?o.winReason:o.lossReason)===r.value)?'btn-primary':'btn-ghost'} btn-sm" onclick="Opportunity.setReason('${id}','${o.status}','${r.value}')">${r.icon} ${r.label}</button>
              `).join('')}
            </div>
            <div class="mt12"><div class="form-label">原因/经验总结</div><textarea class="form-textarea" id="statusNote" placeholder="记录${o.status==='won'?'赢单':'丢单'}关键因素，沉淀经验">${Utils.esc(o.statusNote||(o.status==='won'?o.winNote:o.lossNote)||'')}</textarea><button class="btn btn-primary btn-sm mt8" onclick="Opportunity.saveStatusNote('${id}')">保存</button></div>
          </div>
        `:''}
      </div>`;
      function ssCls(v){return DICT.opportunityStatus.find(x=>x.value===v)?.cls||'';}
    }
    function cpCls(v){return DICT.competition.find(x=>x.value===v)?.cls||'';}
    function ssCls(v){return DICT.opportunityStatus.find(x=>x.value===v)?.cls||'';}
  },

  // 阶段推进
  advance(id){
    const o=Store.opportunity(id);
    if(o.stage>=4) return Toast.show('已在成交阶段','warn');
    const next=o.stage+1;
    const nextLabel=DICT.label('opportunityStage',next);
    Modal.confirm('推进阶段',`确认将商机阶段从「${DICT.label('opportunityStage',o.stage)}」推进到「${nextLabel}」？`,()=>{
      Store.advanceOpp(id,next);
      const probs={1:30,2:50,3:70,4:100};
      Store.updateOpp(id,{winProbability:probs[next]});
      Toast.show('已推进到：'+nextLabel,'success');
      // 通知同企业其他活跃用户
      const otherUsers = Store.users().filter(u=>u.id!==Store.session.userId && u.status==='active');
      if(otherUsers.length){
        Utils.createNotification({
          type:'stage_update',refType:'opportunity',refId:id,
          title:'商机阶段更新：'+o.name,
          message:'将商机「'+o.name+'」阶段从「'+DICT.label('opportunityStage',o.stage)+'」推进至「'+nextLabel+'」',
          toUserIds:otherUsers.map(u=>u.id)
        });
      }
      Opportunity.openDetail(id);
    });
  },

  setCompetition(id,value,prob){
    Store.updateOpp(id,{competition:value,winProbability:prob});
    Toast.show('竞争形势已更新','success');
    Opportunity.openDetail(id);
  },

  setStatus(id,status){
    const labels={open:'进行中',delay:'延缓',won:'赢单',lost:'丢单',closed:'关闭'};
    const o=Store.opportunity(id);
    if(status==='won'||status==='lost'){
      Modal.confirm(labels[status],`确认标记该商机为「${labels[status]}」？此操作将记录${labels[status]}日期。`,()=>{
        Store.setOppStatus(id,status);
        if(status==='won')Store.updateOpp(id,{stage:4,winProbability:100});
        if(status==='lost')Store.updateOpp(id,{winProbability:0});
        Toast.show('已标记为'+labels[status],'success');
        // 通知同企业其他活跃用户
        const otherUsers = Store.users().filter(u=>u.id!==Store.session.userId && u.status==='active');
        if(otherUsers.length){
          Utils.createNotification({
            type:'stage_update',refType:'opportunity',refId:id,
            title:'商机状态变更：'+o.name,
            message:'将商机「'+o.name+'」标记为「'+labels[status]+'」',
            toUserIds:otherUsers.map(u=>u.id)
          });
        }
        Opportunity.openDetail(id);
      });
    } else {
      Store.setOppStatus(id,status);
      Toast.show('状态已更新','success');
      // 通知同企业其他活跃用户
      const otherUsers = Store.users().filter(u=>u.id!==Store.session.userId && u.status==='active');
      if(otherUsers.length){
        Utils.createNotification({
          type:'stage_update',refType:'opportunity',refId:id,
          title:'商机状态变更：'+o.name,
          message:'将商机「'+o.name+'」状态更新为「'+labels[status]+'」',
          toUserIds:otherUsers.map(u=>u.id)
        });
      }
      Opportunity.openDetail(id);
    }
  },

  saveStatusNote(id){
    const note=document.getElementById('statusNote').value;
    const o=Store.opportunity(id);
    const patch={statusNote:note};
    if(o.status==='won') patch.winNote=note;
    if(o.status==='lost') patch.lossNote=note;
    Store.updateOpp(id,patch);
    Toast.show('经验已保存','success');
  },

  // 设置赢单/丢单原因
  setReason(id,status,reason){
    const patch={};
    if(status==='won') patch.winReason=reason;
    else patch.lossReason=reason;
    Store.updateOpp(id,patch);
    Toast.show('原因已记录','success');
    Opportunity.openDetail(id);
    Opportunity.tab(id,'status');
  },

  // 关联/移除联系人
  linkContact(id){
    const o=Store.opportunity(id);
    const existing=o.contactIds||[];
    const available=Store.contactsByCustomer(o.customerId).filter(c=>!existing.includes(c.id));
    if(!available.length)return Toast.show('该客户下联系人已全部关联','warn');
    Modal.open({title:'关联联系人',size:'sm',body:`
      <div class="form-row"><label class="form-label">选择联系人</label>
      <select class="form-select" id="lc_ct">${available.map(c=>`<option value="${c.id}">${Utils.esc(c.name)} - ${Utils.esc(c.title||'')}</option>`).join('')}</select></div>
    `,footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Opportunity.doLink('${id}')">关联</button>`});
  },
  doLink(id){
    const ctId=document.getElementById('lc_ct').value;
    const o=Store.opportunity(id);
    Store.updateOpp(id,{contactIds:[...(o.contactIds||[]),ctId]});
    Toast.show('已关联联系人','success');
    Opportunity.openDetail(id);
  },
  unlinkContact(id,ctId){
    const o=Store.opportunity(id);
    Store.updateOpp(id,{contactIds:(o.contactIds||[]).filter(x=>x!==ctId)});
    Toast.show('已移除','success');
    Opportunity.openDetail(id);
  },

  // 复制
  duplicate(id){
    const o=Store.opportunity(id);
    const copy=JSON.parse(JSON.stringify(o));
    delete copy.id;
    copy.name=o.name+'(副本)';
    copy.status='open';copy.stage=1;copy.winProbability=30;
    Store.addOpp(copy);
    Toast.show('商机已复制','success');
    App.navigate('opportunity');
  },

  // 转移
  transfer(id){
    const o=Store.opportunity(id);
    Modal.open({title:'转移商机',size:'sm',body:`
      <div class="form-row"><label class="form-label">转移给（负责人）</label>${UserPicker.render('tr_owner','')}</div>
    `,footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Opportunity.doTransfer('${id}')">确认转移</button>`});
    setTimeout(()=>UserPicker.show(),150);
  },
  doTransfer(id){
    const owner=document.getElementById('tr_owner').value.trim();
    if(!owner){Toast.show('请填写负责人','error');return;}
    Store.updateOpp(id,{owner});
    Toast.show('商机已转移','success');
    Modal.close();App.navigate('opportunity');
  },

  // 表单
  openForm(id,preset){
    const o=id?Store.opportunity(id):{};
    const preCust=preset?.customerId||o.customerId||'';
    Modal.open({
      title:id?'编辑商机':'新建商机',size:'lg',
      body:`
      <div id="oppForm">
        <div class="form-row"><label class="form-label">商机名称 <span class="req">*</span></label><input class="form-input" id="f_name" value="${Utils.esc(o.name||'')}" placeholder="如：省政务中心智慧政务平台升级项目"></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">所属客户 <span class="req">*</span></label>
            <select class="form-select" id="f_customerId" onchange="Opportunity.onCustomerChange()">${Utils.options(Store.customers().map(c=>({value:c.id,label:c.shortName||c.name})),preCust,'请选择')}</select></div>
          <div class="form-row"><label class="form-label">产品方案</label>
            <input class="form-input" id="f_product" list="productOptions" value="${Utils.esc(o.product||'')}" placeholder="可选择，也可直接输入你的产品/服务">
            <datalist id="productOptions">${(DICT.products||[]).map(p=>`<option value="${Utils.esc(p)}"></option>`).join('')}</datalist>
            <small class="form-hint">常用选项可在 <a href="#" onclick="App.openProductDictSettings();return false">系统设置 → 字段配置 → 产品方案</a> 中维护；直接输入的新方案保存后也会加入常用选项。</small></div>
        </div>
        <div class="form-grid-3">
          <div class="form-row"><label class="form-label">商机金额(元) <span class="req">*</span></label><input class="form-input" id="f_amount" type="number" value="${o.amount||''}" placeholder="如：5800000"></div>
          <div class="form-row"><label class="form-label">预算金额(元)</label><input class="form-input" id="f_budget" type="number" value="${o.budget||''}"></div>
          <div class="form-row"><label class="form-label">应用部门</label><input class="form-input" id="f_applyDept" value="${Utils.esc(o.applyDept||'')}"></div>
        </div>
        <div class="form-grid-4">
          <div class="form-row"><label class="form-label">商机状态</label><select class="form-select" id="f_status">${Utils.options(DICT.opportunityStatus,o.status||'open')}</select></div>
          <div class="form-row"><label class="form-label">当前阶段</label><select class="form-select" id="f_stage">${Utils.options(DICT.opportunityStage,o.stage||1)}</select></div>
          <div class="form-row"><label class="form-label">竞争形势</label><select class="form-select" id="f_competition" onchange="Opportunity.onCompChange()">${Utils.options(DICT.competition,o.competition||'even')}</select></div>
          <div class="form-row"><label class="form-label">赢单概率(%)</label><input class="form-input" id="f_winProbability" type="number" value="${o.winProbability||30}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">采购方式</label><select class="form-select" id="f_purchaseMode">${Utils.options(DICT.purchaseMode,o.purchaseMode,'请选择')}</select></div>
          <div class="form-row"><label class="form-label">预计签约日期</label><input class="form-input" id="f_expectedSignDate" type="date" value="${o.expectedSignDate||''}"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">负责人</label><input class="form-input" id="f_owner" value="${Utils.esc(o.owner||Store.db.settings.owner)}"></div>
          <div class="form-row"><label class="form-label">观察人(逗号分隔)</label><input class="form-input" id="f_observers" value="${Utils.esc((o.observers||[]).join(','))}" placeholder="如：周总监,陈顾问"></div>
        </div>
        <div class="form-row"><label class="form-label">采购决策流程</label><textarea class="form-textarea" id="f_decisionFlow" placeholder="如：立项→需求确认→方案评审→招标→中标→签约">${Utils.esc(o.decisionFlow||'')}</textarea></div>
        <div class="form-row"><label class="form-label">竞争对手(逗号分隔)</label><input class="form-input" id="f_competitors" value="${Utils.esc((o.competitors||[]).join(','))}" placeholder="如：友商A,友商B"></div>
        <div class="form-row"><label class="form-label">备注/形势分析</label><textarea class="form-textarea" id="f_remark">${Utils.esc(o.remark||'')}</textarea></div>
        ${Utils.Mention.pickerHTML('oppForm', [])}
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button>${id?`<button class="btn btn-danger" onclick="Opportunity.remove('${id}')">删除</button>`:''}<button class="btn btn-primary" onclick="Opportunity.save('${id||''}')">保存</button>`
    });
  },
  onCompChange(){
    const v=document.getElementById('f_competition').value;
    const probs={single:90,leading:70,even:45,behind:25};
    document.getElementById('f_winProbability').value=probs[v]||30;
  },
  save(id){
    const name=val('f_name'),customerId=val('f_customerId'),amount=Number(val('f_amount'));
    if(!name){Toast.show('请填写商机名称','error');return;}
    if(!customerId){Toast.show('请选择客户','error');return;}
    if(!amount){Toast.show('请填写金额','error');return;}
    const product = val('f_product');
    if(product) Opportunity.ensureProductOption(product);
    const data={
      name,customerId,product,amount,budget:Number(val('f_budget'))||0,
      status:val('f_status')||'open',
      applyDept:val('f_applyDept'),stage:Number(val('f_stage')),competition:val('f_competition'),
      winProbability:Number(val('f_winProbability'))||0,purchaseMode:val('f_purchaseMode'),
      expectedSignDate:val('f_expectedSignDate'),owner:val('f_owner')||Store.db.settings.owner,
      observers:val('f_observers')?val('f_observers').split(',').map(s=>s.trim()):[],
      decisionFlow:val('f_decisionFlow'),competitors:val('f_competitors')?val('f_competitors').split(',').map(s=>s.trim()):[],
      remark:val('f_remark')
    };
    if(id){
      const oldOpp=Store.opportunity(id);
      const oldStage=oldOpp?oldOpp.stage:null;
      // 状态变为赢单/丢单时自动记录日期
      if(data.status==='won' && oldOpp && oldOpp.status!=='won' && !data.winDate) data.winDate=Utils.today();
      if(data.status==='lost' && oldOpp && oldOpp.status!=='lost' && !data.lostDate) data.lostDate=Utils.today();
      // 状态变为赢单时自动推进到阶段4
      if(data.status==='won' && oldOpp && oldOpp.status!=='won'){ data.stage=4; data.winProbability=100; }
      Store.updateOpp(id,data);Toast.show('商机已更新','success');
      // 阶段变更通知
      const mentionedIds = Utils.Mention.getSelected('oppForm');
      if(mentionedIds.length && oldStage && oldStage!==data.stage){
        const newLabel = DICT.label('opportunityStage',data.stage);
        const oldLabel = DICT.label('opportunityStage',oldStage);
        Utils.createNotification({
          type:'stage_update',refType:'opportunity',refId:id,
          title:'商机阶段更新：'+name,
          message:'将商机「'+name+'」阶段从「'+oldLabel+'」推进至「'+newLabel+'」',
          toUserIds:mentionedIds
        });
      } else if(mentionedIds.length){
        Utils.createNotification({
          type:'opportunity_new',refType:'opportunity',refId:id,
          title:'更新商机：'+name,
          message:'更新了商机「'+name+'」的信息',
          toUserIds:mentionedIds
        });
      }
    } else {
      const newOpp=Store.addOpp(data);data.id=newOpp.id;Toast.show('商机新建成功','success');
      const mentionedIds = Utils.Mention.getSelected('oppForm');
      if(mentionedIds.length){
        const cus=Store.customer(customerId);
        Utils.createNotification({
          type:'opportunity_new',refType:'opportunity',refId:data.id,
          title:'新建商机：'+name,
          message:'新建了商机「'+name+'」'+(cus?'（'+cus.shortName+'）':'')+'，金额 '+Utils.fmtMoney(amount),
          toUserIds:mentionedIds
        });
      }
    }
    Modal.close();App.navigate('opportunity');
    function val(x){return document.getElementById(x).value.trim();}
  },
  ensureProductOption(product){
    const value = String(product||'').trim();
    if(!value) return;
    DICT.products = DICT.products || [];
    if(DICT.products.some(p=>String(p).trim()===value)) return;
    DICT.products.push(value);
    Store.db.settings.dict = DICT.getCustom();
    Store.save();
  },
  remove(id){
    Modal.confirm('删除商机','⚠️ 确认删除该商机？此操作不可撤销。',()=>{
      Store.deleteOpp(id);Toast.show('商机已删除','success');Modal.close();App.navigate('opportunity');
    });
  },

  /** 打开智能分析视角选择弹窗 */
  openExperts(id){
    const o=Store.opportunity(id);
    if(!o) return;
    const c=Store.customer(o.customerId);
    // 仅显示嵌入商机界面的专家：销售拜访、解决方案、价值营销、赢单策略、SOP设计
    const oppExperts=Experts.list.filter(e=>e.embedTo==='opportunity');
    Modal.open({
      title:`智能分析 · ${Utils.esc(o.name)}`,
      size:'md',
      body:`
        <div style="margin-bottom:10px;font-size:13px;color:var(--text-2)">选择一个分析视角，基于商机「${Utils.esc(o.name)}」${c?'（'+Utils.esc(c.shortName||c.name)+'）':''}的数据进行判断：</div>
        <div class="expert-pick-grid">
          ${oppExperts.map(e=>`
            <div class="expert-pick-item" onclick="Opportunity.runExpert('${id}','${e.id}')">
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

  /** 执行专家分析：跳转AI对话，自动形成"商机+专家"提问并输出 */
  runExpert(id, expertId){
    Modal.close();
    const o=Store.opportunity(id);
    const ex=Experts.get(expertId);
    if(!o||!ex)return;
    // 先设置上下文：商机 + 专家（在导航前设置，使渲染时即显示选中状态）
    AI.ctx={customers:[],opportunities:[],experts:[]};
    AI.ctx.opportunities.push({id:id, name:o.name, icon:'🎯', color:'#dc2626'});
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

  // 导出商机列表到 Excel (CSV格式)
  exportList(){
    const list=Store.opportunities();
    if(!list.length){Toast.show('没有可导出的商机数据','warn');return;}
    const columns=[
      {key:'name',label:'商机名称'},
      {key:'customerName',label:'所属客户'},
      {key:'product',label:'产品方案'},
      {key:'amount',label:'商机金额(元)'},
      {key:'budget',label:'预算金额(元)'},
      {key:'stage',label:'阶段进度'},
      {key:'status',label:'状态'},
      {key:'competition',label:'竞争形势'},
      {key:'winProbability',label:'赢单率(%)'},
      {key:'expectedSignDate',label:'预计签约日期'},
      {key:'owner',label:'负责人'},
      {key:'createdAt',label:'创建时间'}
    ];
    const rows=list.map(o=>{
      const c=Store.customer(o.customerId);
      return {
        name:o.name,
        customerName:c?c.shortName||c.name:'—',
        product:o.product||'',
        amount:Utils.fmtMoneyPlain(o.amount),
        budget:Utils.fmtMoneyPlain(o.budget),
        stage:DICT.label('opportunityStage',o.stage),
        status:DICT.label('opportunityStatus',o.status),
        competition:DICT.label('competition',o.competition),
        winProbability:o.winProbability||0,
        expectedSignDate:Utils.fmtDate(o.expectedSignDate),
        owner:o.owner||'',
        createdAt:Utils.fmtDate(o.createdAt)
      };
    });
    const csv=Utils.Export.toCSV(columns,rows);
    const filename=`商机列表_${Utils.today()}.csv`;
    Utils.Export.download(filename,csv);
    Toast.show(`已导出 ${rows.length} 条商机记录`,'success');
  }
};
