/* ========== 跟进记录模块 ========== */
const Followup = {
  renderList(){
    setTimeout(()=>Followup.renderTable(),0);
    return `
    <div class="page-head">
      <div><div class="page-title">📝 跟进记录</div><div class="page-desc">所有客户/联系人/商机的跟进动态，调用数据底座关联</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="Followup.openForm()">＋ 新建跟进</button></div>
    </div>
    <div class="filter-bar">
      <select id="fuType" onchange="Followup.renderTable()"><option value="">全部方式</option>${DICT.followupType.map(d=>`<option value="${d.value}">${d.label}</option>`).join('')}</select>
      <select id="fuCustomer" onchange="Followup.renderTable()"><option value="">全部客户</option>${Store.customers().map(c=>`<option value="${c.id}">${Utils.esc(c.shortName||c.name)}</option>`).join('')}</select>
      <input id="fuKw" placeholder="搜索跟进内容…" oninput="Followup.renderTable()" style="width:200px">
    </div>
    <div class="card">
      <div id="fuTimeline"></div>
    </div>
    <div id="fuCount" class="foot-note"></div>
    `;
  },

  renderTable(){
    const tp=document.getElementById('fuType')?.value||'';
    const cu=document.getElementById('fuCustomer')?.value||'';
    const kw=(document.getElementById('fuKw')?.value||'').trim();
    let list=Store.followups();
    if(tp)list=list.filter(f=>f.type===tp);
    if(cu)list=list.filter(f=>f.customerId===cu);
    if(kw)list=list.filter(f=>f.content.includes(kw));
    list=list.sort((a,b)=>new Date(b.at)-new Date(a.at));
    const box=document.getElementById('fuTimeline');
    if(!list.length){box.innerHTML='<div class="empty"><div class="empty-icon">📝</div>暂无跟进记录</div>';}
    else{
      box.innerHTML=`<div class="timeline">${list.map(f=>{
        const ti=DICT.followupType.find(t=>t.value===f.type)||{};
        const c=f.customerId?Store.customer(f.customerId):null;
        const ct=f.contactId?Store.contact(f.contactId):null;
        const o=f.opportunityId?Store.opportunity(f.opportunityId):null;
        const overdue=f.nextDate&&!f.nextDone&&new Date(f.nextDate)<new Date(Utils.today());
        return `<div class="tl-item ${f.type==='visit'?'':''}">
          <div class="tl-time">${Utils.fmtDateTime(f.at)} · ${Utils.esc(f.by||'')}</div>
          <div class="tl-type">${ti.icon||'📌'} ${ti.label||f.type}
            ${c?` · <span class="link" onclick="Customer.openDetail('${c.id}')">${Utils.esc(c.shortName||c.name)}</span>`:''}
            ${ct?` · <span class="link" onclick="Contact.openDetail('${ct.id}')">${Utils.esc(ct.name)}</span>`:''}
            ${o?` · <span class="link" onclick="Opportunity.openDetail('${o.id}')">${Utils.esc(o.name)}</span>`:''}
          </div>
          <div>${Utils.esc(f.content)}</div>
          ${f.nextAction?`<div class="tl-content">📋 下一步：${Utils.esc(f.nextAction)} ${f.nextDate?`（${Utils.fmtDate(f.nextDate)}）`:''} ${overdue?'<span class="badge badge-red">已逾期</span>':''}</div>`:''}
        </div>`;
      }).join('')}</div>`;
    }
    document.getElementById('fuCount').textContent=`共 ${list.length} 条跟进记录`;
  },

  openForm(id,preset){
    const f=id?Store.followup(id):{};
    const preCust=preset?.customerId||f.customerId||'';
    const preCt=preset?.contactId||f.contactId||'';
    const preOpp=preset?.opportunityId||f.opportunityId||'';
    Modal.open({
      title:id?'编辑跟进记录':'新建跟进记录',size:'lg',
      body:`
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">跟进方式 <span class="req">*</span></label>
          <select class="form-select" id="f_type">${Utils.options(DICT.followupType,f.type||'call')}</select></div>
        <div class="form-row"><label class="form-label">跟进时间</label><input class="form-input" id="f_at" type="datetime-local" value="${f.at?f.at.slice(0,16):Utils.now().slice(0,16)}"></div>
      </div>
      <div class="form-grid-3">
        <div class="form-row"><label class="form-label">关联客户</label>
          <select class="form-select" id="f_customerId" onchange="Followup.onCustChange()"><option value="">不关联</option>${Utils.options(Store.customers().map(c=>({value:c.id,label:c.shortName||c.name})),preCust)}</select></div>
        <div class="form-row"><label class="form-label">关联联系人</label>
          <select class="form-select" id="f_contactId"><option value="">不关联</option>${preCust?Utils.options(Store.contactsByCustomer(preCust).map(c=>({value:c.id,label:c.name+' - '+(c.title||'')})),preCt):''}</select></div>
        <div class="form-row"><label class="form-label">关联商机</label>
          <select class="form-select" id="f_opportunityId"><option value="">不关联</option>${preCust?Utils.options(Store.oppsByCustomer(preCust).map(o=>({value:o.id,label:o.name})),preOpp):''}</select></div>
      </div>
      <div class="form-row"><label class="form-label">跟进内容 <span class="req">*</span></label><textarea class="form-textarea" id="f_content" style="min-height:90px" placeholder="详细记录沟通内容、客户反馈、关键信息…">${Utils.esc(f.content||'')}</textarea></div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">下一步行动</label><input class="form-input" id="f_nextAction" value="${Utils.esc(f.nextAction||'')}" placeholder="如：提交方案、再次拜访"></div>
        <div class="form-row"><label class="form-label">计划日期</label><input class="form-input" id="f_nextDate" type="date" value="${f.nextDate||''}"></div>
      </div>
    <div class="form-row"><label class="form-label">跟进人</label><input class="form-input" id="f_by" value="${Utils.esc(f.by||Store.db.settings.owner)}"></div>
    ${Utils.Mention.pickerHTML('followupForm', [])}
    `,
      footer:`<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Followup.save('${id||''}')">保存</button>`
    });
  },
  onCustChange(){
    const cid=document.getElementById('f_customerId').value;
    const ctSel=document.getElementById('f_contactId');
    const oSel=document.getElementById('f_opportunityId');
    ctSel.innerHTML='<option value="">不关联</option>'+Utils.options(Store.contactsByCustomer(cid).map(c=>({value:c.id,label:c.name+' - '+(c.title||'')})),'');
    oSel.innerHTML='<option value="">不关联</option>'+Utils.options(Store.oppsByCustomer(cid).map(o=>({value:o.id,label:o.name})),'');
  },
  save(id){
    const content=val('f_content');
    if(!content){Toast.show('请填写跟进内容','error');return;}
    const data={
      type:val('f_type'),at:val('f_at')?document.getElementById('f_at').value:Utils.now(),
      customerId:val('f_customerId'),contactId:val('f_contactId'),opportunityId:val('f_opportunityId'),
      content,nextAction:val('f_nextAction'),nextDate:val('f_nextDate'),by:val('f_by')||Store.db.settings.owner
    };
    if(id){Store.updateFollowup(id,data);Toast.show('跟进已更新','success');}
    else{const newFu=Store.addFollowup(data);data.id=newFu.id;
      // 自动更新客户/商机的updatedAt
      if(data.customerId)Store.updateCustomer(data.customerId,{}); // touch
      Toast.show('跟进记录已添加','success');
    }
    // 发送协同通知
    const mentionedIds = Utils.Mention.getSelected('followupForm');
    if(mentionedIds.length){
      const cus = data.customerId ? Store.customer(data.customerId) : null;
      const opp = data.opportunityId ? Store.opportunity(data.opportunityId) : null;
      let extra = cus?'（'+cus.shortName+'）':'';
      if(opp) extra += ' · 商机：'+opp.name;
      Utils.createNotification({
        type:'followup',refType:'followup',refId:data.id||id,
        title:(id?'更新':'新建')+'跟进记录'+(cus?'：'+cus.shortName:''),
        message:(id?'更新了':'添加了')+'跟进记录'+extra+'：'+content.slice(0,50)+(content.length>50?'…':''),
        toUserIds:mentionedIds
      });
    }
    Modal.close();
    if(App.currentRoute==='followup')Followup.renderTable();
    function val(x){return document.getElementById(x).value.trim();}
  }
};
