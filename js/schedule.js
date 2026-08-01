/* ========== 协同日程模块 ========== */
const Schedule = {
  render(){
    const upcoming=Store.upcomingSchedules(14);
    const today=Utils.today();
    const todayList=Store.schedulesByDate(today).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
    return `
    <div class="page-head">
      <div><div class="page-title">📅 协同日程</div><div class="page-desc">创建协同日程，关联客户/商机/联系人，提醒与看板</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="Schedule.openForm()">＋ 新建日程</button></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">今日日程</div><div class="stat-value">${todayList.length}</div><div class="stat-sub">待完成 ${todayList.filter(s=>!s.done).length}</div></div>
      <div class="stat-card orange"><div class="stat-label">未来14天</div><div class="stat-value">${upcoming.length}</div><div class="stat-sub">即将到来</div></div>
      <div class="stat-card green"><div class="stat-label">本月已完成</div><div class="stat-value">${Store.schedules().filter(s=>s.done).length}</div></div>
      <div class="stat-card gold"><div class="stat-label">高优先级</div><div class="stat-value">${Store.schedules().filter(s=>!s.done&&s.priority==='high').length}</div></div>
    </div>
    <div class="card">
      <div class="card-title">🔔 今日日程 · ${Utils.fmtDate(today)} <button class="btn btn-ghost btn-sm" onclick="Schedule.openForm({date:'${today}'})">＋ 添加</button></div>
      ${todayList.length?todayList.map(s=>Schedule.itemHtml(s)).join(''):'<div class="empty"><div class="empty-icon">🗓️</div>今日暂无日程安排</div>'}
    </div>
    <div class="card">
      <div class="card-title">📋 即将到来（14天内）</div>
      ${upcoming.length?upcoming.map(s=>Schedule.itemHtml(s)).join(''):'<div class="empty"><div class="empty-icon">📭</div>暂无即将到来的日程</div>'}
    </div>
    <div class="card">
      <div class="card-title">📊 日程看板</div>
      <div class="kanban">
        ${['high','mid','low'].map(p=>{
          const pInfo=DICT.priority.find(x=>x.value===p)||{};
          const arr=Store.schedules().filter(s=>!s.done&&s.priority===p).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
          return `<div class="kanban-col"><div class="kanban-col-head"><span class="badge ${pInfo.cls}">${pInfo.label}优先级</span><span class="badge badge-gray">${arr.length}</span></div>
          ${arr.map(s=>Schedule.kanbanCard(s)).join('')||'<div style="text-align:center;padding:14px;color:var(--text-3);font-size:12px">无</div>'}</div>`;
        }).join('')}
      </div>
    </div>
    `;
  },

  itemHtml(s){
    const c=s.customerId?Store.customer(s.customerId):null;
    const o=s.opportunityId?Store.opportunity(s.opportunityId):null;
    const ct=s.contactId?Store.contact(s.contactId):null;
    const pInfo=DICT.priority.find(x=>x.value===s.priority)||{};
    const overdue=!s.done&&new Date(s.startAt)<new Date();
    return `<div style="display:flex;gap:12px;padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;${s.done?'opacity:.55':''}">
      <div style="width:4px;border-radius:3px;background:${s.priority==='high'?'var(--red)':s.priority==='mid'?'var(--orange)':'var(--gray)'};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:600;${s.done?'text-decoration:line-through':''}">${Utils.esc(s.title)}</span>
          <span class="badge ${pInfo.cls}">${pInfo.label}</span>
          <span class="badge badge-gray">${Utils.esc(s.type)}</span>
          ${s.done?'<span class="badge badge-green">已完成</span>':overdue?'<span class="badge badge-red">已逾期</span>':''}
        </div>
        <div class="text-sm text-gray mt8">
          🕐 ${Utils.fmtDateTime(s.startAt)} - ${Utils.fmtDateTime(s.endAt)}
          ${s.location?` · 📍 ${Utils.esc(s.location)}`:''}
        </div>
        <div class="text-sm mt8">
          ${c?`<span class="link" onclick="Customer.openDetail('${c.id}')">🏢 ${Utils.esc(c.shortName||c.name)}</span> `:''}
          ${o?`<span class="link" onclick="Opportunity.openDetail('${o.id}')">🎯 ${Utils.esc(o.name)}</span> `:''}
          ${ct?`<span class="link" onclick="Contact.openDetail('${ct.id}')">👤 ${Utils.esc(ct.name)}</span> `:''}
          ${s.participants&&s.participants.length?` · 👥 ${Utils.esc(s.participants.join('、'))}`:''}
        </div>
        ${s.desc?`<div class="text-sm text-gray mt8">${Utils.esc(s.desc)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${!s.done?`<button class="btn btn-blue btn-sm" onclick="Schedule.complete('${s.id}')">完成</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="Schedule.openForm('${s.id}')">编辑</button>
        <button class="btn btn-ghost btn-sm" onclick="Schedule.remove('${s.id}')">删除</button>
      </div>
    </div>`;
  },

  kanbanCard(s){
    const c=s.customerId?Store.customer(s.customerId):null;
    return `<div class="kanban-card" style="border-left-color:${s.priority==='high'?'var(--red)':s.priority==='mid'?'var(--orange)':'var(--gray)'}" onclick="Schedule.openForm('${s.id}')">
      <div class="kc-title">${Utils.esc(s.title)}</div>
      <div class="kc-meta"><span>${Utils.fmtDateTime(s.startAt).slice(5,16)}</span><span>${Utils.esc(c?c.shortName:'')}</span></div>
    </div>`;
  },

  openForm(id,preset){
    const s=id?Store.schedule(id):{};
    const preDate=preset?.date||'';
    Modal.open({
      title:id?'编辑日程':'新建日程',size:'lg',
      body:`
      <div class="form-row"><label class="form-label">日程标题 <span class="req">*</span></label><input class="form-input" id="f_title" value="${Utils.esc(s.title||'')}" placeholder="如：省政务中心方案终版提交"></div>
      <div class="form-grid-3">
        <div class="form-row"><label class="form-label">日程类型</label><select class="form-select" id="f_type">${Utils.options(DICT.scheduleType,s.type||'拜访客户')}</select></div>
        <div class="form-row"><label class="form-label">优先级</label><select class="form-select" id="f_priority">${Utils.options(DICT.priority,s.priority||'mid')}</select></div>
        <div class="form-row"><label class="form-label">地点</label><input class="form-input" id="f_location" value="${Utils.esc(s.location||'')}"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">开始时间 <span class="req">*</span></label><input class="form-input" id="f_startAt" type="datetime-local" value="${s.startAt?s.startAt.slice(0,16):(preDate+'T09:00')}"></div>
        <div class="form-row"><label class="form-label">结束时间</label><input class="form-input" id="f_endAt" type="datetime-local" value="${s.endAt?s.endAt.slice(0,16):(preDate+'T10:00')}"></div>
      </div>
      <div class="form-grid-3">
        <div class="form-row"><label class="form-label">关联客户</label><select class="form-select" id="f_customerId" onchange="Schedule.onCustChange()"><option value="">不关联</option>${Utils.options(Store.customers().map(c=>({value:c.id,label:c.shortName||c.name})),s.customerId)}</select></div>
        <div class="form-row"><label class="form-label">关联商机</label><select class="form-select" id="f_opportunityId"><option value="">不关联</option>${s.customerId?Utils.options(Store.oppsByCustomer(s.customerId).map(o=>({value:o.id,label:o.name})),s.opportunityId):''}</select></div>
        <div class="form-row"><label class="form-label">关联联系人</label><select class="form-select" id="f_contactId"><option value="">不关联</option>${s.customerId?Utils.options(Store.contactsByCustomer(s.customerId).map(c=>({value:c.id,label:c.name})),s.contactId):''}</select></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">参与人(逗号分隔)</label><input class="form-input" id="f_participants" value="${Utils.esc((s.participants||[]).join(','))}"></div>
        <div class="form-row"><label class="form-label">知会人(逗号分隔)</label><input class="form-input" id="f_notify" value="${Utils.esc((s.notify||[]).join(','))}"></div>
      </div>
    <div class="form-row"><label class="form-label">日程说明</label><textarea class="form-textarea" id="f_desc">${Utils.esc(s.desc||'')}</textarea></div>
    ${Utils.Mention.pickerHTML('scheduleForm', [])}
    `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Schedule.save('${id||''}')">保存</button>`
    });
  },
  onCustChange(){
    const cid=document.getElementById('f_customerId').value;
    document.getElementById('f_opportunityId').innerHTML='<option value="">不关联</option>'+Utils.options(cid?Store.oppsByCustomer(cid).map(o=>({value:o.id,label:o.name})):[],'');
    document.getElementById('f_contactId').innerHTML='<option value="">不关联</option>'+Utils.options(cid?Store.contactsByCustomer(cid).map(c=>({value:c.id,label:c.name})):[],'');
  },
  save(id){
    const title=val('f_title'),startAt=val('f_startAt');
    if(!title){Toast.show('请填写标题','error');return;}
    if(!startAt){Toast.show('请选择开始时间','error');return;}
    const data={
      title,type:val('f_type'),priority:val('f_priority'),location:val('f_location'),
      startAt,endAt:val('f_endAt')||startAt,customerId:val('f_customerId'),
      opportunityId:val('f_opportunityId'),contactId:val('f_contactId'),
      participants:val('f_participants')?val('f_participants').split(',').map(s=>s.trim()):[],
      notify:val('f_notify')?val('f_notify').split(',').map(s=>s.trim()):[],
      desc:val('f_desc')
    };
    if(id){Store.updateSchedule(id,data);Toast.show('日程已更新','success');}
    else{const newSch=Store.addSchedule(data);data.id=newSch.id;Toast.show('日程已创建','success');}
    // 发送协同通知
    const mentionedIds = Utils.Mention.getSelected('scheduleForm');
    if(mentionedIds.length){
      Utils.createNotification({
        type:'schedule',refType:'schedule',refId:data.id||id,
        title:(id?'更新':'新建')+'协同日程：'+title,
        message:(id?'更新了':'创建了')+'协同日程「'+title+'」('+Utils.fmtDateTime(startAt)+')',
        toUserIds:mentionedIds
      });
    }
    Modal.close();App.navigate('schedule');
    function val(x){return document.getElementById(x).value.trim();}
  },
  complete(id){
    Store.updateSchedule(id,{done:true});
    Toast.show('日程已完成 ✅','success');
    App.navigate('schedule');
  },
  remove(id){
    Modal.confirm('删除日程','确认删除该日程？',()=>{Store.deleteSchedule(id);Toast.show('已删除','success');App.navigate('schedule');});
  }
};
