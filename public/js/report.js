/* ========== 周报/周总结模块 ========== */
const Report = {
  render(){
    const report=Report.generate();
    return `
    <div class="page-head">
      <div><div class="page-title">📋 周报总结</div><div class="page-desc">自动汇总本周工作，调用数据底座生成</div></div>
      <div class="toolbar">
        <button class="btn btn-ghost" onclick="Report.copyReport()">📋 复制周报</button>
        <button class="btn btn-primary" onclick="Report.refresh()">🔄 重新生成</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📊 业绩概述</div>
      <div class="stat-grid">
        <div class="stat-card green"><div class="stat-label">本周签约金额</div><div class="stat-value">${Utils.fmtMoney(report.wonAmount)}</div><div class="stat-sub">签约 ${report.wonCount} 单</div></div>
        <div class="stat-card"><div class="stat-label">新增客户</div><div class="stat-value">${report.newCustomers}</div><div class="stat-sub">新增商机 ${report.newOpps}</div></div>
        <div class="stat-card gold"><div class="stat-label">新增跟进</div><div class="stat-value">${report.newFollowups}</div><div class="stat-sub">拜访 ${report.visitCount} 次</div></div>
        <div class="stat-card orange"><div class="stat-label">阶段升迁</div><div class="stat-value">${report.stageAdvance}</div><div class="stat-sub">赢单变化 ${report.statusChange}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📝 本周工作总结</div>
      <div style="background:var(--gray-bg);padding:14px;border-radius:8px;font-size:13px;line-height:1.9;white-space:pre-wrap">${Utils.esc(report.summary)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-title">🎯 本周项目动态</div>
        ${report.oppUpdates.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>商机</th><th>动态</th></tr></thead><tbody>${report.oppUpdates.map(u=>`<tr onclick="Opportunity.openDetail('${u.id}')"><td class="row-name">${Utils.esc(u.name)}</td><td><span class="badge ${u.cls}">${u.text}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">本周无项目动态</div>'}
      </div>
      <div class="card">
        <div class="card-title">📋 本周任务列表</div>
        ${report.tasks.length?report.tasks.map(t=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center"><span class="${t.done?'badge badge-green':'badge badge-gray'}">${t.done?'✓':'○'}</span><span style="${t.done?'text-decoration:line-through;color:var(--text-3)':''}">${Utils.esc(t.text)}</span></div>`).join(''):'<div class="empty">暂无任务</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">📌 下周计划</div>
      <div style="background:var(--primary-bg);padding:14px;border-radius:8px;font-size:13px;line-height:1.9;white-space:pre-wrap">${Utils.esc(report.nextPlan)}</div>
    </div>
    <div class="card">
      <div class="card-title">📈 核心指标</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">拜访数量</div><div class="info-value">${report.visitCount} 次</div></div>
        <div class="info-item"><div class="info-label">电话沟通</div><div class="info-value">${report.callCount} 次</div></div>
        <div class="info-item"><div class="info-label">会议沟通</div><div class="info-value">${report.meetingCount} 次</div></div>
        <div class="info-item"><div class="info-label">方案/演示</div><div class="info-value">${report.demoCount} 次</div></div>
        <div class="info-item"><div class="info-label">阶段转化率</div><div class="info-value">${report.conversionRate}</div></div>
        <div class="info-item"><div class="info-label">客户转化率</div><div class="info-value">${report.customerConvRate}</div></div>
      </div>
    </div>
    `;
  },

  generate(){
    const now=new Date();
    const weekAgo=new Date(now.getTime()-7*86400000);
    const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
    const weekEnd=new Date(weekStart.getTime()+7*86400000);

    const fus=Store.followups().filter(f=>new Date(f.at)>=weekAgo);
    const newCustomers=Store.customers().filter(c=>new Date(c.createdAt)>=weekAgo);
    const newOpps=Store.opportunities().filter(o=>new Date(o.createdAt)>=weekAgo);
    const wonOpps=Store.opportunities().filter(o=>o.status==='won'&&o.winDate&&new Date(o.winDate)>=weekAgo);
    const lostOpps=Store.opportunities().filter(o=>o.status==='lost'&&o.lostDate&&new Date(o.lostDate)>=weekAgo);
    const weekSch=Store.schedules().filter(s=>{const t=new Date(s.startAt);return t>=weekStart&&t<weekEnd;});

    // 项目动态
    const oppUpdates=[];
    Store.opportunities().forEach(o=>{
      if(new Date(o.updatedAt)>=weekAgo){
        if(o.status==='won'&&o.winDate&&new Date(o.winDate)>=weekAgo)oppUpdates.push({id:o.id,name:o.name,text:'赢单',cls:'badge-green'});
        else if(o.status==='lost'&&o.lostDate&&new Date(o.lostDate)>=weekAgo)oppUpdates.push({id:o.id,name:o.name,text:'丢单',cls:'badge-red'});
        else if(new Date(o.createdAt)>=weekAgo)oppUpdates.push({id:o.id,name:o.name,text:'新增商机',cls:'badge-blue'});
        else oppUpdates.push({id:o.id,name:o.name,text:'阶段更新',cls:'badge-gold'});
      }
    });

    const visitCount=fus.filter(f=>f.type==='visit').length;
    const callCount=fus.filter(f=>f.type==='call').length;
    const meetingCount=fus.filter(f=>f.type==='meeting').length;
    const demoCount=fus.filter(f=>f.type==='demo'||f.type==='proposal').length;

    // 任务（本周日程）
    const tasks=weekSch.map(s=>({text:s.title+(s.location?' @'+s.location:''),done:s.done}));

    // 总结
    const summary=[
      `1. 客户拓展：本周新增客户 ${newCustomers.length} 个（${newCustomers.map(c=>c.shortName||c.name).join('、')||'无'}），累计跟进 ${fus.length} 次。`,
      `2. 商机推进：本周新增商机 ${newOpps.length} 个，赢单 ${wonOpps.length} 个（金额 ${Utils.fmtMoney(Utils.sum(wonOpps,'amount'))}），丢单 ${lostOpps.length} 个。`,
      `3. 关键动作：上门拜访 ${visitCount} 次、电话沟通 ${callCount} 次、会议 ${meetingCount} 次、方案/演示 ${demoCount} 次。`,
      `4. 日程执行：本周安排日程 ${weekSch.length} 项，已完成 ${weekSch.filter(s=>s.done).length} 项。`,
      `5. 重点进展：${oppUpdates.slice(0,3).map(u=>u.name+'('+u.text+')').join('、')||'本周无重大项目变动'}。`
    ].join('\n');

    // 下周计划
    const upcomingSch=Store.upcomingSchedules(7);
    const nearSign=Store.opportunities().filter(o=>o.status==='open'&&o.expectedSignDate&&new Date(o.expectedSignDate)<new Date(Date.now()+14*86400000)).sort((a,b)=>new Date(a.expectedSignDate)-new Date(b.expectedSignDate));
    const nextPlan=[
      `1. 日程安排：下周共有 ${upcomingSch.length} 项待办日程。`,
      upcomingSch.length?`2. 重点日程：${upcomingSch.slice(0,3).map(s=>s.title+'('+Utils.fmtDate(s.startAt)+')').join('、')}。`:'2. 暂无待办日程。',
      nearSign.length?`3. 预计签约：${nearSign.slice(0,3).map(o=>o.name+'('+Utils.fmtMoney(o.amount)+')').join('、')}。`:'3. 近期无预计签约商机。',
      `4. 重点推进：${Store.opportunities().filter(o=>o.status==='open'&&o.stage===3).slice(0,3).map(o=>o.name).join('、')||'无商务阶段商机'}，加速签约。`,
      `5. 客户维护：跟进超14天未联系客户 ${Store.myCustomers().filter(c=>{const l=Store.lastFollowup(f=>f.customerId===c.id);return !l||Utils.daysSince(l.at)>14;}).length} 个。`
    ].join('\n');

    // 转化率
    const allOpps=Store.opportunities();
    const stageConv=allOpps.filter(o=>o.status==='won').length+allOpps.filter(o=>o.status==='lost').length;
    const convRate=stageConv?Math.round(allOpps.filter(o=>o.status==='won').length/stageConv*100)+'%':'—';
    const custConv=Store.customers().filter(c=>c.status==='signed').length;
    const custConvRate=Store.customers().length?Math.round(custConv/Store.customers().length*100)+'%':'—';

    return {
      wonAmount:Utils.sum(wonOpps,'amount'),wonCount:wonOpps.length,
      newCustomers:newCustomers.length,newOpps:newOpps.length,newFollowups:fus.length,
      visitCount,callCount,meetingCount,demoCount,
      stageAdvance:oppUpdates.filter(u=>u.text==='阶段更新').length,statusChange:wonOpps.length+lostOpps.length,
      summary,oppUpdates:oppUpdates.slice(0,10),tasks,
      nextPlan,conversionRate:convRate,customerConvRate:custConvRate
    };
  },

  refresh(){ Toast.show('周报已重新生成','success'); App.navigate('report'); },
  copyReport(){
    const r=Report.generate();
    const text=`【周报总结】\n\n一、业绩概述\n签约金额：${Utils.fmtMoney(r.wonAmount)}（${r.wonCount}单）\n新增客户：${r.newCustomers}\n新增商机：${r.newOpps}\n新增跟进：${r.newFollowups}\n\n二、本周工作总结\n${r.summary}\n\n三、下周计划\n${r.nextPlan}`;
    navigator.clipboard.writeText(text).then(()=>Toast.show('周报已复制到剪贴板','success')).catch(()=>Toast.show('复制失败，请手动选择','error'));
  }
};
