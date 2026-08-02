/* ========== 数据看板 & 漏斗 & 业绩 ========== */
const Dashboard = {
  render(){
    const st=Store.stats();
    const openOpps=Store.opportunities().filter(o=>o.status==='open');
    const todaySch=Store.schedulesByDate(Utils.today()).filter(s=>!s.done);
    const upcoming=Store.upcomingSchedules(7);
    return `
    <div class="page-head">
      <div><div class="page-title"><span class="page-mark">▦</span>数据看板</div><div class="page-desc">业绩概览 · 核心指标 · 商机动态 · 调用数据底座实时计算</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="App.navigate('ai')">智能分析</button></div>
    </div>
    <div class="expert-entry-card" onclick="App.openExpertsEntry()">
      <div class="expert-entry-card-icon">冠</div>
      <div class="expert-entry-card-body">
        <div class="expert-entry-card-title">不知道从哪里开始？让10个销售专家先帮你看一遍</div>
        <div class="expert-entry-card-desc">客户洞察、商机判断、拜访准备、赢单策略、销售SOP，一次进入都能问。</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.openExpertsEntry()">进入10个专家</button>
    </div>
    <!-- 核心指标 -->
    <div class="stat-grid">
      <div class="stat-card" style="cursor:pointer" onclick="Dashboard.drillCustomer('my')" title="点击查看客户明细"><div class="stat-label">客户总数 <span style="font-size:10px;color:var(--text-3);float:right">🔍 点击穿透</span></div><div class="stat-value">${st.customerTotal}</div><div class="stat-sub">我的 ${st.myCustomerTotal} · 公海 ${st.poolTotal}</div><div class="stat-icon">🏢</div></div>
      <div class="stat-card gold" style="cursor:pointer" onclick="Dashboard.drillContact()" title="点击查看联系人明细"><div class="stat-label">联系人 <span style="font-size:10px;color:var(--text-3);float:right">🔍 点击穿透</span></div><div class="stat-value">${st.contactTotal}</div><div class="stat-sub">关键人 ${Store.contacts().filter(c=>c.isKey).length}</div><div class="stat-icon">👤</div></div>
      <div class="stat-card green" style="cursor:pointer" onclick="Dashboard.drillOpp('open')" title="点击查看商机明细"><div class="stat-label">进行中商机 <span style="font-size:10px;color:var(--text-3);float:right">🔍 点击穿透</span></div><div class="stat-value">${st.openOppTotal}</div><div class="stat-sub">金额 ${Utils.fmtMoney(st.openAmount)}</div><div class="stat-icon">🎯</div></div>
      <div class="stat-card orange"><div class="stat-label">加权预测金额</div><div class="stat-value" style="font-size:22px">${Utils.fmtMoney(st.weightedAmount)}</div><div class="stat-sub">按赢单概率折算</div><div class="stat-icon">📈</div></div>
      <div class="stat-card green" style="cursor:pointer" onclick="Dashboard.drillOpp('won')" title="点击查看赢单明细"><div class="stat-label">已赢单金额 <span style="font-size:10px;color:var(--text-3);float:right">🔍 点击穿透</span></div><div class="stat-value" style="font-size:22px">${Utils.fmtMoney(st.wonAmount)}</div><div class="stat-sub">赢单 ${st.wonOppTotal} 个</div><div class="stat-icon">🏆</div></div>
    </div>

    <!-- 预警快报 -->
    ${(()=>{
      const alerts=Store.alerts();
      if(!alerts.length) return '';
      const high=alerts.filter(a=>a.severity==='high').length;
      return `<div class="card" style="border-left:4px solid ${high>0?'#dc2626':'#ea7c1c'};cursor:pointer" onclick="App.navigate('alerts')">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">${high>0?'🚨':'⚠️'}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">智能预警快报</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">
              ${high>0?`<span style="color:#dc2626;font-weight:600">${high}个高风险</span> · `:''}${alerts.length}条预警待处理 — 点击查看详情
            </div>
          </div>
          <span style="font-size:20px;color:var(--text-3)">→</span>
        </div>
      </div>`;
    })()}

    <!-- 趋势分析 -->
    <div class="card">
      <div class="card-title">📈 近6个月营收趋势 <button class="btn btn-ghost btn-sm" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='趋势分析';AI.send();},300)">AI解读</button></div>
      ${Dashboard.trendChart()}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- 客户与商机增长趋势 -->
      <div class="card">
        <div class="card-title">🏢 客户与商机增长趋势</div>
        ${Dashboard.growthTrendChart()}
      </div>
      <!-- 跟进活跃度趋势 -->
      <div class="card">
        <div class="card-title">📞 跟进活跃度趋势</div>
        ${Dashboard.followupTrendChart()}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- 商机阶段分布 -->
      <div class="card">
        <div class="card-title">🎯 商机阶段分布</div>
        ${Dashboard.stageChart()}
      </div>
      <!-- 竞争形势分布 -->
      <div class="card">
        <div class="card-title">⚔️ 竞争形势分布</div>
        ${Dashboard.competitionChart()}
      </div>
    </div>

    <!-- 商机健康度矩阵 -->
    <div class="card">
      <div class="card-title">🩺 商机健康度矩阵 <span class="badge badge-blue">${Store.healthMatrix().length}个进行中</span> <button class="btn btn-ghost btn-sm" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='商机健康度';AI.send();},300)">AI解读</button></div>
      ${Dashboard.healthMatrixChart()}
    </div>

    <!-- 赢输归因分析 -->
    <div class="card">
      <div class="card-title">📊 赢/输单归因分析 <button class="btn btn-ghost btn-sm" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='赢输归因分析';AI.send();},300)">AI解读</button></div>
      ${Dashboard.winLossChart()}
    </div>

    <!-- 销售行为效能 -->
    <div class="card">
      <div class="card-title">⚡ 销售行为效能分析 <button class="btn btn-ghost btn-sm" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='销售效能分析';AI.send();},300)">AI解读</button></div>
      ${Dashboard.salesPerformanceChart()}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- 今日待办 -->
      <div class="card">
        <div class="card-title">📅 今日待办 <span class="badge badge-orange">${todaySch.length}</span></div>
        ${todaySch.length?todaySch.map(s=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-weight:500">${Utils.esc(s.title)}</div><div class="text-sm text-gray">${Utils.fmtDateTime(s.startAt).slice(11)}</div></div>
          <button class="btn btn-blue btn-sm" onclick="Schedule.openForm('${s.id}')">查看</button>
        </div>`).join(''):'<div class="empty">今日无待办</div>'}
      </div>
      <!-- 即将到来 -->
      <div class="card">
        <div class="card-title">🔔 未来7天日程 <span class="badge badge-blue">${upcoming.length}</span></div>
        ${upcoming.length?upcoming.slice(0,6).map(s=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-weight:500">${Utils.esc(s.title)}</div><div class="text-sm text-gray">${Utils.fmtDate(s.startAt)}</div></div>
          <span class="badge ${DICT.cls('priority',s.priority)}">${DICT.label('priority',s.priority)}</span>
        </div>`).join(''):'<div class="empty">暂无日程</div>'}
      </div>
    </div>

    <!-- 最近商机动态 -->
    <div class="card">
      <div class="card-title">🔄 最近商机动态 <button class="btn btn-ghost btn-sm" onclick="App.navigate('opportunity')">查看全部</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>商机</th><th>客户</th><th>金额</th><th>阶段</th><th>竞争</th><th>赢单率</th><th>更新</th></tr></thead>
        <tbody>${Store.opportunities().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,6).map(o=>{
          const c=Store.customer(o.customerId);const st=DICT.opportunityStage.find(s=>s.value===o.stage)||{};const ss=DICT.opportunityStatus.find(s=>s.value===o.status)||{};const cp=DICT.competition.find(x=>x.value===o.competition)||{};
          return `<tr onclick="Opportunity.openDetail('${o.id}')"><td class="row-name">${Utils.esc(o.name)}</td><td>${Utils.esc(c?c.shortName:'')}</td><td>${Utils.fmtMoney(o.amount)}</td><td><span class="badge badge-blue">${st.label}</span></td><td><span class="badge ${cp.cls}">${cp.label}</span></td><td><b style="color:${(o.winProbability||0)>=60?'var(--green)':(o.winProbability||0)>=40?'var(--orange)':'var(--red)'}">${o.winProbability||0}%</b></td><td class="text-sm text-gray">${Utils.relativeTime(o.updatedAt)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    `;
  },

  // 营收趋势折线图（SVG）
  trendChart(){
    const data=Store.trendData(6);
    const W=560, H=200, PAD=40;
    const maxAmt=Math.max(...data.map(d=>d.wonAmount), 100000);
    const maxNew=Math.max(...data.map(d=>d.newOppAmount), 100000);
    const useMax=Math.max(maxAmt, maxNew);
    const xStep=(W-PAD*2)/(data.length-1);
    const yScale=(v)=>H-PAD-(v/useMax*(H-PAD*2));

    // 赢单金额折线
    const wonPoints=data.map((d,i)=>`${PAD+i*xStep},${yScale(d.wonAmount)}`).join(' ');
    // 新增商机金额折线
    const newPoints=data.map((d,i)=>`${PAD+i*xStep},${yScale(d.newOppAmount)}`).join(' ');

    // Y轴刻度
    const yTicks=[0, 0.25, 0.5, 0.75, 1].map(p=>{
      const v=Math.round(useMax*p);
      const y=H-PAD-(p*(H-PAD*2));
      return `<line x1="${PAD}" y1="${y}" x2="${W-PAD}" y2="${y}" stroke="#e8eaed" stroke-width="1" stroke-dasharray="3,3"/><text x="${PAD-6}" y="${y+4}" text-anchor="end" font-size="10" fill="#98a2b8">${Utils.fmtMoney(v).replace('万','')}</text>`;
    }).join('');

    // X轴标签
    const xLabels=data.map((d,i)=>`<text x="${PAD+i*xStep}" y="${H-PAD+16}" text-anchor="middle" font-size="11" fill="#475467">${d.label}</text>`).join('');

    // 数据点标签
    const wonLabels=data.map((d,i)=>{
      if(d.wonAmount===0) return '';
      return `<circle cx="${PAD+i*xStep}" cy="${yScale(d.wonAmount)}" r="4" fill="#16a34a"/><text x="${PAD+i*xStep}" y="${yScale(d.wonAmount)-8}" text-anchor="middle" font-size="10" fill="#16a34a" font-weight="600">${d.wonOpps}单</text>`;
    }).join('');
    const newLabels=data.map((d,i)=>{
      if(d.newOppAmount===0) return '';
      return `<circle cx="${PAD+i*xStep}" cy="${yScale(d.newOppAmount)}" r="4" fill="#2563eb"/><text x="${PAD+i*xStep}" y="${yScale(d.newOppAmount)+16}" text-anchor="middle" font-size="10" fill="#2563eb" font-weight="600">${d.newOpps}个</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
      ${yTicks}
      <polyline points="${wonPoints}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linejoin="round"/>
      <polyline points="${newPoints}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="5,3"/>
      ${wonLabels}
      ${newLabels}
      ${xLabels}
      <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#d0d5dd" stroke-width="1.5"/>
    </svg>
    <div style="display:flex;gap:20px;margin-top:8px;font-size:12px;color:var(--text-2)">
      <span><span style="display:inline-block;width:16px;height:3px;background:#16a34a;vertical-align:middle;margin-right:4px"></span>赢单金额（${data.reduce((a,d)=>a+d.wonOpps,0)}单 / ${Utils.fmtMoney(data.reduce((a,d)=>a+d.wonAmount,0))}）</span>
      <span><span style="display:inline-block;width:16px;height:3px;background:#2563eb;vertical-align:middle;margin-right:4px;border-top:2px dashed #2563eb"></span>新增商机金额（${data.reduce((a,d)=>a+d.newOpps,0)}个 / ${Utils.fmtMoney(data.reduce((a,d)=>a+d.newOppAmount,0))}）</span>
    </div>`;
  },

  // 客户与商机增长趋势（柱状图）
  growthTrendChart(){
    const data=Store.trendData(6);
    const maxVal=Math.max(...data.map(d=>Math.max(d.newCustomers, d.newOpps)), 1);
    return `<div style="display:flex;align-items:flex-end;gap:12px;height:140px;padding:10px 0">
      ${data.map(d=>`
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="display:flex;gap:4px;align-items:flex-end;height:100px">
            <div style="width:14px;height:${Math.max(2,d.newCustomers/maxVal*90)}px;background:#1a3a6b;border-radius:3px 3px 0 0;transition:.4s" title="新增客户${d.newCustomers}"></div>
            <div style="width:14px;height:${Math.max(2,d.newOpps/maxVal*90)}px;background:#c89b2c;border-radius:3px 3px 0 0;transition:.4s" title="新增商机${d.newOpps}"></div>
          </div>
          <div style="font-size:11px;color:var(--text-2)">${d.label}</div>
          <div style="font-size:10px;color:var(--text-3)">${d.newCustomers}客/${d.newOpps}机</div>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--text-2)">
      <span><span style="display:inline-block;width:12px;height:12px;background:#1a3a6b;border-radius:2px;vertical-align:middle;margin-right:4px"></span>新增客户</span>
      <span><span style="display:inline-block;width:12px;height:12px;background:#c89b2c;border-radius:2px;vertical-align:middle;margin-right:4px"></span>新增商机</span>
    </div>`;
  },

  // 跟进活跃度趋势（面积图）
  followupTrendChart(){
    const data=Store.trendData(6);
    const maxVal=Math.max(...data.map(d=>d.followups), 1);
    const W=280, H=140, PAD=30;
    const xStep=(W-PAD*2)/(data.length-1);
    const points=data.map((d,i)=>`${PAD+i*xStep},${H-PAD-(d.followups/maxVal*(H-PAD*2-10))}`);
    const areaPoints=`${PAD},${H-PAD} ${points.join(' ')} ${PAD+(data.length-1)*xStep},${H-PAD}`;
    const xLabels=data.map((d,i)=>`<text x="${PAD+i*xStep}" y="${H-PAD+14}" text-anchor="middle" font-size="10" fill="#475467">${d.label}</text>`).join('');
    const dots=data.map((d,i)=>{
      const x=PAD+i*xStep;
      const y=H-PAD-(d.followups/maxVal*(H-PAD*2-10));
      return `<circle cx="${x}" cy="${y}" r="3" fill="#ea7c1c"/><text x="${x}" y="${y-6}" text-anchor="middle" font-size="10" fill="#ea7c1c" font-weight="600">${d.followups}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
      <polygon points="${areaPoints}" fill="#ea7c1c" opacity="0.12"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="#ea7c1c" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
      <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#d0d5dd" stroke-width="1"/>
    </svg>
    <div style="font-size:12px;color:var(--text-2);margin-top:6px">
      6个月累计跟进 <b style="color:#ea7c1c">${data.reduce((a,d)=>a+d.followups,0)}</b> 次 ｜ 月均 <b>${Math.round(data.reduce((a,d)=>a+d.followups,0)/6)}</b> 次
    </div>`;
  },

  // 阶段分布柱状图（SVG）
  stageChart(){
    const open=Store.opportunities().filter(o=>o.status==='open');
    const max=Math.max(...DICT.opportunityStage.map(s=>Utils.sum(open.filter(o=>o.stage===s.value),'amount')),1);
    return `<div style="display:flex;align-items:flex-end;gap:16px;height:180px;padding:10px 0">
      ${DICT.opportunityStage.map(s=>{
        const arr=open.filter(o=>o.stage===s.value);
        const amt=Utils.sum(arr,'amount');
        const h=Math.max(4,amt/max*140);
        return `<div style="flex:1;text-align:center;cursor:pointer" onclick="Dashboard.drillOpp('stage','${s.value}')" title="点击查看${s.label}阶段商机明细">
          <div style="font-size:12px;margin-bottom:4px">${Utils.fmtMoney(amt)}</div>
          <div style="height:${h}px;background:${s.color};border-radius:5px 5px 0 0;transition:.4s;min-height:4px;position:relative"></div>
          <div style="font-size:12px;margin-top:6px;font-weight:600">${s.label}<span style="font-size:10px;color:var(--text-3);display:block">🔍 点击穿透</span></div>
          <div style="font-size:11px;color:var(--text-3)">${arr.length}个</div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // 竞争形势饼图（SVG）
  competitionChart(){
    const open=Store.opportunities().filter(o=>o.status==='open');
    const total=open.length||1;
    const colors=['#16a34a','#2563eb','#ea7c1c','#dc2626'];
    let html='<div style="display:flex;align-items:center;gap:20px">';
    // 环形图
    let offset=0;
    const r=60,circumference=2*Math.PI*r;
    html+=`<svg width="160" height="160" viewBox="0 0 160 160"><g transform="translate(80,80)">`;
    html+=`<circle r="${r}" fill="none" stroke="#f0f2f6" stroke-width="22"/>`;
    DICT.competition.forEach((d,i)=>{
      const cnt=open.filter(o=>o.competition===d.value).length;
      const pct=cnt/total;
      if(pct>0){
        const dash=pct*circumference;
        html+=`<circle r="${r}" fill="none" stroke="${colors[i]}" stroke-width="22" stroke-dasharray="${dash} ${circumference-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90)"/>`;
        offset+=dash;
      }
    });
    html+=`<text text-anchor="middle" dy="-4" style="font-size:22px;font-weight:700" fill="#1f2a44">${open.length}</text><text text-anchor="middle" dy="16" style="font-size:11px" fill="#98a2b8">进行中</text></g></svg>`;
    // 图例
    html+=`<div style="flex:1">`;
    DICT.competition.forEach((d,i)=>{
      const cnt=open.filter(o=>o.competition===d.value).length;
      const amt=Utils.sum(open.filter(o=>o.competition===d.value),'amount');
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;border-radius:4px" onclick="${cnt>0?`Dashboard.drillOpp('competition','${d.value}')`:''}" title="${cnt>0?`点击查看${d.label}商机明细`:'暂无数据'}">
        <span style="width:12px;height:12px;border-radius:3px;background:${colors[i]}"></span>
        <span style="flex:1">${d.label}</span>
        <span style="font-weight:600;color:${cnt>0?colors[i]:'var(--text-3)'}">${cnt}</span>
        <span class="text-sm text-gray">${Utils.fmtMoney(amt)}</span>
        ${cnt>0?`<span style="font-size:10px;color:var(--text-3)">🔍</span>`:''}
      </div>`;
    });
    html+=`</div></div>`;
    return html;
  },

  // 销售漏斗（增强版：阶段流速+瓶颈+流失归因）
  renderFunnel(){
    const fa=Store.funnelDeepAnalysis();
    const open=Store.opportunities().filter(o=>o.status==='open');
    const maxAmt=Math.max(...DICT.opportunityStage.map(s=>Utils.sum(open.filter(o=>o.stage===s.value),'amount')),1);
    let html=`
    <div class="page-head">
      <div><div class="page-title">🔻 销售漏斗 <span class="badge badge-gold">深度分析</span></div><div class="page-desc">阶段流速 · 瓶颈识别 · 流失归因 · 转化率分析</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='漏斗深度分析';AI.send();},300)">智能解读</button></div>
    </div>

    <!-- 深度分析摘要卡片 -->
    <div class="stat-grid">
      <div class="stat-card orange"><div class="stat-label">🔍 瓶颈阶段</div><div class="stat-value" style="font-size:20px">${fa.bottleneck?fa.bottleneck.stage.label:'—'}</div><div class="stat-sub">转化率 ${fa.bottleneck?fa.bottleneck.rate+'%':'—'}</div><div class="stat-icon">⚠️</div></div>
      <div class="stat-card red"><div class="stat-label">💀 流失热点</div><div class="stat-value" style="font-size:20px">${fa.lossHotspot&&fa.lossHotspot.count>0?fa.lossHotspot.stage.label:'无丢单'}</div><div class="stat-sub">${fa.lossHotspot&&fa.lossHotspot.count>0?fa.lossHotspot.count+'个商机在此阶段流失':'暂无丢单记录'}</div><div class="stat-icon">📉</div></div>
      <div class="stat-card"><div class="stat-label">⏱️ 平均成单周期</div><div class="stat-value">${Store.stats().avgDealCycle}<span style="font-size:14px">天</span></div><div class="stat-sub">赢单 ${fa.totalWon} 个 ｜ 丢单 ${fa.totalLost} 个</div><div class="stat-icon">⏰</div></div>
      <div class="stat-card green"><div class="stat-label">📊 整体转化率</div><div class="stat-value">${(fa.totalWon+fa.totalLost)>0?Math.round(fa.totalWon/(fa.totalWon+fa.totalLost)*100):0}<span style="font-size:14px">%</span></div><div class="stat-sub">赢单/总结束商机</div><div class="stat-icon">🏆</div></div>
    </div>

    <!-- 漏斗可视化 -->
    <div class="card">
      <div class="card-title">🔻 漏斗视图</div>
      <div class="funnel">
        ${DICT.opportunityStage.map((s,i)=>{
          const arr=open.filter(o=>o.stage===s.value);
          const amt=Utils.sum(arr,'amount');
          const width=50+amt/maxAmt*45;
          const colors=['#94a3b8','#60a5fa','#f59e0b','#16a34a'];
          return `<div class="funnel-stage" style="width:${width}%;background:${colors[i]};opacity:${1-i*0.12}">
            ${s.label}阶段 · ${Utils.fmtMoney(amt)}<span class="fs-count">${arr.length}个</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- 阶段流速分析 -->
    <div class="card">
      <div class="card-title">⏱️ 阶段流速分析（平均停留天数）</div>
      <div style="display:flex;align-items:flex-end;gap:16px;height:160px;padding:10px 0">
        ${fa.stages.map((sd,i)=>{
          const maxDwell=Math.max(...fa.stages.map(x=>x.dwellDays), 1);
          const h=Math.max(8, sd.dwellDays/maxDwell*120);
          const isBottleneck=fa.bottleneck&&fa.bottleneck.index===i;
          const color=isBottleneck?'#dc2626':sd.stage.color;
          return `<div style="flex:1;text-align:center">
            <div style="font-size:12px;margin-bottom:4px;font-weight:600;color:${color}">${sd.dwellDays}天</div>
            <div style="height:${h}px;background:${color};border-radius:5px 5px 0 0;transition:.4s;min-height:8px;position:relative">
              ${sd.overdue>0?`<div style="position:absolute;top:-2px;right:-4px;width:10px;height:10px;background:#dc2626;border-radius:50%;border:2px solid #fff" title="${sd.overdue}个超30天未推进"></div>`:''}
            </div>
            <div style="font-size:12px;margin-top:6px;font-weight:600">${sd.stage.label}</div>
            <div style="font-size:11px;color:var(--text-3)">${sd.openCount}个进行中</div>
            ${isBottleneck?'<div style="font-size:10px;color:#dc2626;font-weight:600">⚠️ 瓶颈</div>':''}
            ${sd.overdue>0?`<div style="font-size:10px;color:#dc2626">${sd.overdue}个超期</div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-3)">
        <span style="display:inline-block;width:10px;height:10px;background:#dc2626;border-radius:50%;vertical-align:middle;margin-right:4px"></span>红点 = 超30天未推进的商机 ｜
        红色柱 = 转化率瓶颈阶段
      </div>
    </div>

    <!-- 阶段明细表 -->
    <div class="card">
      <div class="card-title">📋 阶段转化明细</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>阶段</th><th>进行中</th><th>金额</th><th>平均停留</th><th>赢单数</th><th>丢单数</th><th>转化率</th><th>超期预警</th></tr></thead>
        <tbody>${fa.stages.map(sd=>{
          const isBN=fa.bottleneck&&fa.bottleneck.index===sd.index;
          return `<tr>
            <td><span class="badge" style="background:${sd.stage.color};color:#fff">${sd.stage.label}</span>${isBN?' <span style="color:#dc2626;font-size:11px">⚠️瓶颈</span>':''}</td>
            <td><b>${sd.openCount}</b></td>
            <td>${Utils.fmtMoney(sd.openAmount)}</td>
            <td style="color:${sd.dwellDays>45?'#dc2626':sd.dwellDays>30?'#ea7c1c':'inherit'}">${sd.dwellDays}天</td>
            <td style="color:var(--green)">${sd.wonCount}</td>
            <td style="color:var(--red)">${sd.lostCount}</td>
            <td><b>${sd.convRate}</b>${sd.convDen>0?` <span style="font-size:11px;color:var(--text-3)">(${sd.convNum}/${sd.convDen})</span>`:''}</td>
            <td>${sd.overdue>0?`<span class="badge badge-red">${sd.overdue}个</span>`:'<span style="color:var(--text-3)">—</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>

    <!-- 流失归因分析 -->
    <div class="card">
      <div class="card-title">💀 流失归因分析（丢单商机在各阶段分布）</div>
      ${fa.totalLost>0?`
      <div style="display:flex;align-items:flex-end;gap:16px;height:120px;padding:10px 0">
        ${fa.lossByStage.map(l=>{
          const maxLoss=Math.max(...fa.lossByStage.map(x=>x.count),1);
          const h=Math.max(4, l.count/maxLoss*90);
          const isHot=fa.lossHotspot&&fa.lossHotspot.stage.value===l.stage.value;
          return `<div style="flex:1;text-align:center">
            <div style="font-size:12px;margin-bottom:4px;font-weight:600;color:${isHot?'#dc2626':'inherit'}">${l.count}个</div>
            <div style="height:${h}px;background:${isHot?'#dc2626':'#f0f2f6'};border:1px solid ${isHot?'#dc2626':'#d0d5dd'};border-radius:5px 5px 0 0;transition:.4s;min-height:4px"></div>
            <div style="font-size:12px;margin-top:6px;font-weight:600">${l.stage.label}</div>
            ${isHot?'<div style="font-size:10px;color:#dc2626;font-weight:600">⚠️ 流失热点</div>':''}
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;padding:10px;background:#fef2f2;border-radius:8px;font-size:13px;color:#991b1b">
        💡 <b>洞察</b>：${fa.lossHotspot&&fa.lossHotspot.count>0
          ? `丢单集中在「${fa.lossHotspot.stage.label}」阶段，共${fa.lossHotspot.count}个商机在此流失。建议加强该阶段的关系维护与方案竞争力，避免在关键环节失手。`
          : '当前无丢单记录，赢单表现良好。'}
      </div>
      `:'<div class="empty">暂无丢单记录 ✅</div>'}
    </div>

    <!-- 瓶颈分析建议 -->
    ${fa.bottleneck?`
    <div class="card" style="border-left:4px solid #dc2626">
      <div class="card-title">⚠️ 瓶颈分析：${fa.bottleneck.stage.label}阶段</div>
      <div style="padding:8px 0;font-size:13px;line-height:1.8;color:var(--text-2)">
        <b style="color:#dc2626">${fa.bottleneck.stage.label}</b> 是当前漏斗中转化率最低的阶段（${fa.bottleneck.rate}%），意味着进入此阶段的商机有 ${(100-fa.bottleneck.rate)}% 未能成功推进到下一阶段。
        <br><br>
        <b>建议措施：</b>
        <ul style="margin:6px 0 0 20px;padding:0">
          <li>检查该阶段商机是否有明确的关键决策人支持</li>
          <li>评估竞争对手在该阶段的干扰程度</li>
          <li>加强该阶段方案/报价的专业性与针对性</li>
          <li>对停留超过30天的商机发起专项复盘</li>
        </ul>
      </div>
    </div>
    `:''}
    `;
    return html;
  },

  // 商机健康度矩阵散点图
  healthMatrixChart(){
    const data=Store.healthMatrix();
    if(!data.length) return '<div class="empty">暂无进行中商机</div>';
    const W=580, H=280, PAD=45;
    const maxAmt=Math.max(...data.map(d=>d.amount), 1000000);
    // 散点
    const dots=data.map(d=>{
      const x=PAD+(d.amount/maxAmt)*(W-PAD*2);
      const y=H-PAD-((d.health/100)*(H-PAD*2));
      const r=d.amount>3000000?8:d.amount>1000000?6:5;
      const color=d.risk==='high'?'#dc2626':d.risk==='mid'?'#ea7c1c':'#16a34a';
      const label=`${d.name}（${d.customer}）| 金额:${Utils.fmtMoney(d.amount)} | 健康度:${d.health}`;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" opacity="0.85" stroke="#fff" stroke-width="1.5" style="cursor:pointer" onclick="Opportunity.openDetail('${d.id}')" title="${Utils.esc(label)}"><title>${Utils.esc(label)}</title></circle>`;
    }).join('');
    // 四象限分割线
    const midX=PAD+(W-PAD*2)*0.5;
    const midY=H-PAD-0.5*(H-PAD*2);
    // Y轴刻度
    const yTicks=[0,25,50,75,100].map(p=>{
      const y=H-PAD-(p/100)*(H-PAD*2);
      return `<line x1="${PAD}" y1="${y}" x2="${W-PAD}" y2="${y}" stroke="#e8eaed" stroke-width="1" stroke-dasharray="${p===50?'5,3':'3,3'}"/><text x="${PAD-6}" y="${y+4}" text-anchor="end" font-size="10" fill="#98a2b8">${p}</text>`;
    }).join('');
    // X轴刻度
    const xTicks=[0,0.25,0.5,0.75,1].map(p=>{
      const v=Math.round(maxAmt*p);
      const x=PAD+p*(W-PAD*2);
      return `<text x="${x}" y="${H-PAD+16}" text-anchor="middle" font-size="10" fill="#98a2b8">${Utils.fmtMoney(v).replace('¥','')}</text>`;
    }).join('');
    // 象限标签
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
      ${yTicks}
      <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#d0d5dd" stroke-width="1.5"/>
      <line x1="${PAD}" y1="${H-PAD}" x2="${PAD}" y2="${PAD}" stroke="#d0d5dd" stroke-width="1.5"/>
      ${dots}
      ${xTicks}
      <text x="${W-PAD-5}" y="${H-PAD+30}" text-anchor="end" font-size="11" fill="#475467">商机金额 →</text>
      <text x="${PAD-30}" y="${PAD+5}" text-anchor="end" font-size="11" fill="#475467" transform="rotate(-90 ${PAD-30} ${PAD+5})">健康度 ↑</text>
    </svg>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--text-2);flex-wrap:wrap">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;vertical-align:middle;margin-right:4px"></span>高风险（&lt;45分）${data.filter(d=>d.risk==='high').length}个</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ea7c1c;vertical-align:middle;margin-right:4px"></span>一般（45-70分）${data.filter(d=>d.risk==='mid').length}个</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#16a34a;vertical-align:middle;margin-right:4px"></span>健康（&gt;70分）${data.filter(d=>d.risk==='low').length}个</span>
      <span style="margin-left:auto;color:var(--text-3)">💡 点击圆点查看商机详情</span>
    </div>`;
  },

  // 赢/输单归因分析图表
  winLossChart(){
    const data=Store.winLossAnalysis();
    if(data.wonCount===0 && data.lostCount===0) return '<div class="empty">暂无已结束商机</div>';
    let html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';
    // 赢单原因分布
    html+='<div>';
    html+=`<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--green)">✅ 赢单原因分布（${data.wonCount}个）</div>`;
    if(data.wonCount>0){
      const winItems=Object.entries(data.winReasons).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      if(winItems.length){
        const maxWin=Math.max(...winItems.map(x=>x[1]),1);
        winItems.forEach(([k,v])=>{
          const reason=DICT.winReason.find(r=>r.value===k);
          const pct=Math.round(v/data.wonCount*100);
          html+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:80px;font-size:12px">${reason?reason.icon:''} ${reason?reason.label:k}</span><div style="flex:1;height:18px;background:var(--gray-bg);border-radius:4px;overflow:hidden"><div style="height:100%;width:${v/maxWin*100}%;background:var(--green);border-radius:4px;transition:.4s"></div></div><span style="font-size:12px;font-weight:600;min-width:36px">${v}个 ${pct}%</span></div>`;
        });
      } else {
        html+='<div class="text-sm text-gray" style="padding:8px 0">赢单商机尚未记录原因，请在商机状态管理中选择赢单原因</div>';
      }
    } else {
      html+='<div class="text-sm text-gray" style="padding:8px 0">暂无赢单</div>';
    }
    html+='</div>';
    // 丢单原因分布
    html+='<div>';
    html+=`<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--red)">❌ 丢单原因分布（${data.lostCount}个）</div>`;
    if(data.lostCount>0){
      const lossItems=Object.entries(data.lossReasons).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      if(lossItems.length){
        const maxLoss=Math.max(...lossItems.map(x=>x[1]),1);
        lossItems.forEach(([k,v])=>{
          const reason=DICT.lossReason.find(r=>r.value===k);
          const pct=Math.round(v/data.lostCount*100);
          html+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:80px;font-size:12px">${reason?reason.icon:''} ${reason?reason.label:k}</span><div style="flex:1;height:18px;background:var(--gray-bg);border-radius:4px;overflow:hidden"><div style="height:100%;width:${v/maxLoss*100}%;background:var(--red);border-radius:4px;transition:.4s"></div></div><span style="font-size:12px;font-weight:600;min-width:36px">${v}个 ${pct}%</span></div>`;
        });
      } else {
        html+='<div class="text-sm text-gray" style="padding:8px 0">丢单商机尚未记录原因，请在商机状态管理中选择丢单原因</div>';
      }
    } else {
      html+='<div class="text-sm text-gray" style="padding:8px 0">暂无丢单 ✅</div>';
    }
    html+='</div>';
    html+='</div>';

    // 按金额段分布
    html+='<div style="margin-top:16px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">💰 按金额段赢输分布</div><div style="display:flex;gap:12px">';
    Object.entries(data.byAmountRange).forEach(([range,v])=>{
      const total=v.won+v.lost;
      const rate=total>0?Math.round(v.won/total*100):0;
      html+=`<div style="flex:1;text-align:center;padding:10px;background:var(--gray-bg);border-radius:8px">
        <div style="font-size:12px;color:var(--text-3)">${range}</div>
        <div style="margin:6px 0"><span style="color:var(--green);font-weight:600">${v.won}</span> / <span style="color:var(--red);font-weight:600">${v.lost}</span></div>
        <div style="font-size:11px;color:var(--text-2)">赢单率 ${rate}%</div>
      </div>`;
    });
    html+='</div></div>';
    return html;
  },

  // 销售行为效能分析图表
  salesPerformanceChart(){
    const data=Store.salesPerformance();
    let html='';
    // 1. 跟进方式转化率
    html+='<div style="font-size:13px;font-weight:600;margin-bottom:10px">📞 跟进方式转化率（赢单率）</div>';
    if(data.methodStats.length){
      const maxRate=Math.max(...data.methodStats.map(m=>m.winRate),1);
      html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
      data.methodStats.forEach(m=>{
        const color=m.winRate>=60?'var(--green)':m.winRate>=30?'var(--orange)':'var(--red)';
        html+=`<div style="flex:1;min-width:120px;padding:10px;background:var(--gray-bg);border-radius:8px;text-align:center">
          <div style="font-size:20px">${m.icon}</div>
          <div style="font-size:12px;font-weight:600;margin:4px 0">${m.label}</div>
          <div style="font-size:22px;font-weight:700;color:${color}">${m.winRate}%</div>
          <div style="font-size:11px;color:var(--text-3)">${m.totalFollowups}次 · ${m.oppCount}商机</div>
        </div>`;
      });
      html+='</div>';
    } else {
      html+='<div class="text-sm text-gray" style="margin-bottom:16px">暂无跟进数据</div>';
    }

    // 2. 跟进频率与赢单率
    html+='<div style="font-size:13px;font-weight:600;margin-bottom:10px">📊 跟进频率与赢单率关联</div>';
    html+='<div style="display:flex;align-items:flex-end;gap:16px;height:140px;padding:10px 0;margin-bottom:16px">';
    const maxFreq=Math.max(...data.freqBuckets.map(b=>b.total),1);
    data.freqBuckets.forEach(b=>{
      const h=b.total/maxFreq*100;
      const color=b.winRate>=60?'#16a34a':b.winRate>=30?'#ea7c1c':'#dc2626';
      html+=`<div style="flex:1;text-align:center">
        <div style="font-size:12px;margin-bottom:4px;font-weight:600;color:${color}">${b.winRate}%</div>
        <div style="height:${Math.max(8,h)}px;background:${color};border-radius:5px 5px 0 0;transition:.4s;min-height:8px;opacity:0.85"></div>
        <div style="font-size:12px;margin-top:6px;font-weight:600">${b.label}</div>
        <div style="font-size:11px;color:var(--text-3)">${b.won}赢/${b.lost}输</div>
      </div>`;
    });
    html+='</div>';

    // 3. 销售活动漏斗
    html+='<div style="font-size:13px;font-weight:600;margin-bottom:10px">🔻 销售活动漏斗</div>';
    const maxFunnel=Math.max(...data.activityFunnel.map(a=>a.count),1);
    html+='<div style="display:flex;flex-direction:column;gap:6px">';
    data.activityFunnel.forEach((a,i)=>{
      const width=40+a.count/maxFunnel*55;
      const colors=['#94a3b8','#60a5fa','#818cf8','#a78bfa','#f59e0b','#16a34a'];
      const conv=i>0&&data.activityFunnel[i-1].count>0?Math.round(a.count/data.activityFunnel[i-1].count*100):100;
      html+=`<div style="display:flex;align-items:center;gap:10px">
        <span style="width:80px;font-size:12px;text-align:right">${a.icon} ${a.label}</span>
        <div style="flex:1;height:28px;background:var(--gray-bg);border-radius:6px;overflow:hidden;position:relative">
          <div style="height:100%;width:${width}%;background:${colors[i]};border-radius:6px;transition:.4s;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;color:#fff;font-size:12px;font-weight:600">${a.count}个</div>
        </div>
        <span style="width:50px;font-size:11px;color:var(--text-3)">${i>0?'→ '+conv+'%':'起点'}</span>
      </div>`;
    });
    html+='</div>';

    // 汇总
    html+=`<div style="margin-top:12px;padding:10px;background:var(--primary-bg);border-radius:8px;font-size:13px;color:var(--text-2)">
      📊 累计跟进 <b style="color:var(--primary)">${data.totalFollowups}</b> 次 ｜ 平均每商机 <b style="color:var(--primary)">${data.avgFollowupPerOpp}</b> 次跟进
    </div>`;
    return html;
  },

  // 业绩管理
  renderPerformance(){
    const st=Store.stats();
    const target=Store.db.settings.quarterTarget;
    const won=st.wonAmount;
    const weighted=st.weightedAmount;
    const rate=(won/target*100).toFixed(1);
    const predRate=((won+weighted)/target*100).toFixed(1);
    return `
    <div class="page-head">
      <div><div class="page-title">📈 业绩管理</div><div class="page-desc">业绩目标、达成情况与预测</div></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card green"><div class="stat-label">已签约金额</div><div class="stat-value">${Utils.fmtMoney(won)}</div><div class="stat-sub">完成率 ${rate}%</div></div>
      <div class="stat-card orange"><div class="stat-label">加权预测</div><div class="stat-value">${Utils.fmtMoney(weighted)}</div><div class="stat-sub">预测达成 ${predRate}%</div></div>
      <div class="stat-card"><div class="stat-label">季度目标</div><div class="stat-value">${Utils.fmtMoney(target)}</div><div class="stat-sub">${Store.db.settings.fiscalYear}财年</div></div>
      <div class="stat-card gold"><div class="stat-label">赢单数 / 赢单率</div><div class="stat-value">${st.wonOppTotal} / ${st.winRate}%</div><div class="stat-sub">平均成单周期 ${st.avgDealCycle}天</div></div>
    </div>
    <div class="card">
      <div class="card-title">🎯 业绩达成进度</div>
      <div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>已签约 ${Utils.fmtMoney(won)}</span><span>目标 ${Utils.fmtMoney(target)}</span></div>
        <div style="height:24px;background:var(--gray-bg);border-radius:12px;overflow:hidden;position:relative">
          <div style="height:100%;width:${Math.min(100,rate)}%;background:linear-gradient(90deg,var(--green),#22c55e);border-radius:12px;transition:.5s;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;color:#fff;font-size:12px;font-weight:600">${rate}%</div>
        </div>
      </div>
      <div style="margin:14px 0">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>预测合计 ${Utils.fmtMoney(won+weighted)}</span><span>目标 ${Utils.fmtMoney(target)}</span></div>
        <div style="height:24px;background:var(--gray-bg);border-radius:12px;overflow:hidden;position:relative">
          <div style="height:100%;width:${Math.min(100,predRate)}%;background:linear-gradient(90deg,var(--orange),#fbbf24);border-radius:12px;transition:.5s;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;color:#fff;font-size:12px;font-weight:600">${predRate}%</div>
        </div>
      </div>
      ${target-won-weighted>0?`<div class="badge badge-red" style="padding:8px 12px">⚠️ 预测缺口 ${Utils.fmtMoney(target-won-weighted)}，需补充新商机</div>`:`<div class="badge badge-green" style="padding:8px 12px">✅ 预测可达成目标</div>`}
    </div>
    <div class="card">
      <div class="card-title">🏆 赢单明细</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>商机</th><th>客户</th><th>签约金额</th><th>签约日期</th><th>成单周期</th></tr></thead>
        <tbody>${Store.opportunities().filter(o=>o.status==='won').map(o=>{
          const c=Store.customer(o.customerId);const cycle=o.winDate&&o.createdAt?Math.round((new Date(o.winDate)-new Date(o.createdAt))/86400000):'—';
          return `<tr onclick="Opportunity.openDetail('${o.id}')"><td class="row-name">${Utils.esc(o.name)}</td><td>${Utils.esc(c?c.shortName:'')}</td><td><b>${Utils.fmtMoney(o.amount)}</b></td><td>${Utils.fmtDate(o.winDate)}</td><td>${cycle}天</td></tr>`;
        }).join('')||'<tr><td colspan="5"><div class="empty">暂无赢单</div></td></tr>'}</tbody>
      </table></div>
    </div>
    `;
  },

  // ===== 预警中心 =====
  renderAlerts(){
    const alerts=Store.alerts();
    const high=alerts.filter(a=>a.severity==='high');
    const mid=alerts.filter(a=>a.severity==='mid');
    const low=alerts.filter(a=>a.severity==='low');

    // 按类型分组
    const typeMap={
      'opp-stagnant':{label:'商机停滞',icon:'⚠️',cls:'badge-orange'},
      'customer-churn':{label:'跟进滞后',icon:'访',cls:'badge-red'},
      'customer-first-followup':{label:'首次跟进',icon:'访',cls:'badge-orange'},
      'sign-overdue':{label:'签约逾期',icon:'📅',cls:'badge-red'},
      'schedule-overdue':{label:'日程逾期',icon:'🔔',cls:'badge-orange'},
      'protect-expire':{label:'保护期到期',icon:'🛡️',cls:'badge-orange'},
    };

    const navToEntity=(a)=>{
      if(a.entityType==='opportunity') return `Opportunity.openDetail('${a.entityId}')`;
      if(a.entityType==='customer') return `Customer.openDetail('${a.entityId}')`;
      if(a.entityType==='schedule') return `Schedule.openForm('${a.entityId}')`;
      return '';
    };

    let html=`
    <div class="page-head">
      <div><div class="page-title">🚨 智能预警中心 <span class="badge badge-red">${alerts.length}</span></div>
      <div class="page-desc">商机停滞 · 客户流失 · 签约逾期 · 日程逾期 · 保护期到期 — 实时监控，点击直达详情</div></div>
      <div class="toolbar"><button class="btn btn-primary" onclick="App.navigate('ai');setTimeout(()=>{document.getElementById('aiInput').value='预警分析';AI.send();},300)">智能解读</button></div>
    </div>

    <!-- 预警概览卡片 -->
    <div class="stat-grid">
      <div class="stat-card red"><div class="stat-label">🔴 高风险</div><div class="stat-value">${high.length}</div><div class="stat-sub">需立即处理</div><div class="stat-icon">🚨</div></div>
      <div class="stat-card orange"><div class="stat-label">🟡 中风险</div><div class="stat-value">${mid.length}</div><div class="stat-sub">需尽快关注</div><div class="stat-icon">⚠️</div></div>
      <div class="stat-card"><div class="stat-label">🟢 低风险</div><div class="stat-value">${low.length}</div><div class="stat-sub">持续观察</div><div class="stat-icon">📋</div></div>
      <div class="stat-card ${alerts.length>0?'gold':'green'}"><div class="stat-label">📊 总预警</div><div class="stat-value">${alerts.length}</div><div class="stat-sub">${alerts.length===0?'系统状态良好 ✅':'建议优先处理高风险项'}</div><div class="stat-icon">📊</div></div>
    </div>
    `;

    if(!alerts.length){
      html+=`<div class="card"><div class="empty"><div class="empty-icon">✅</div>当前无任何预警，系统运行良好</div></div>`;
      return html;
    }

    // 按类型筛选标签
    html+=`<div class="filter-bar">
      <button class="btn btn-primary btn-sm" onclick="Dashboard._filterAlert('')">全部 (${alerts.length})</button>
      ${Object.entries(typeMap).map(([k,v])=>{
        const cnt=alerts.filter(a=>a.type===k).length;
        return cnt?`<button class="btn btn-ghost btn-sm" onclick="Dashboard._filterAlert('${k}')">${v.icon} ${v.label} (${cnt})</button>`:'';
      }).join('')}
    </div>`;

    // 预警列表
    html+=`<div class="card" style="padding:0"><div id="alertList">`;
    alerts.forEach(a=>{
      const ti=typeMap[a.type]||{label:a.type,icon:'📌',cls:'badge-gray'};
      const sevColor=a.severity==='high'?'#dc2626':a.severity==='mid'?'#ea7c1c':'#6b7280';
      const sevLabel=a.severity==='high'?'高风险':a.severity==='mid'?'中风险':'低风险';
      const nav=navToEntity(a);
      html+=`<div class="alert-item" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);border-left:4px solid ${sevColor};cursor:${nav?'pointer':'default'}" ${nav?`onclick="${nav}"`:''}>
        <div style="font-size:24px">${a.icon}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;font-size:14px">${Utils.esc(a.title)}</span>
            <span class="badge ${a.cls}" style="font-size:10px">${ti.label}</span>
            <span class="badge" style="background:${sevColor}20;color:${sevColor};font-size:10px">${sevLabel}</span>
          </div>
          <div style="font-size:12px;color:var(--text-3)">${Utils.esc(a.desc)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:700;color:${sevColor}">${Math.abs(a.days)}</div>
          <div style="font-size:10px;color:var(--text-3)">${a.metricLabel || (a.days<0?'天前':'天后')}</div>
        </div>
      </div>`;
    });
    html+=`</div></div>`;

    return html;
  },

  // 预警筛选
  _filterAlert(type){
    const items=document.querySelectorAll('#alertList>div');
    items.forEach(el=>{
      el.style.display=type?'none':'';
    });
    if(type){
      // 通过onclick中的类型文本匹配
      const typeMap={'opp-stagnant':'商机停滞','customer-churn':'客户流失','sign-overdue':'签约逾期','schedule-overdue':'日程逾期','protect-expire':'保护期到期'};
      items.forEach(el=>{
        const badge=el.querySelector('.badge');
        if(badge && badge.textContent.includes(typeMap[type])) el.style.display='';
      });
    }
  },

  // ========== 明细钻取弹窗 ==========
  /** 通用明细弹窗 */
  showDrilldown(title, list, columns, rowClick){
    const html = `
    <div class="drilldown-overlay" onclick="if(event.target===this)Dashboard.closeDrilldown()">
      <div class="drilldown-panel">
        <div class="drilldown-header">
          <span class="drilldown-title" title="${title}">${title}</span>
          <div style="display:flex;align-items:center;gap:14px">
            <span class="drilldown-count">共 <b>${list.length}</b> 条记录</span>
            <button class="drilldown-close" onclick="Dashboard.closeDrilldown()" title="关闭">✕</button>
          </div>
        </div>
        <div class="drilldown-body">
          <table class="data-table">
            <thead><tr>${columns.map(c=>`<th${c.cls?` class="${c.cls}"`:''}>${c.label}</th>`).join('')}</tr></thead>
            <tbody>${list.length ? list.map(item => {
              const cells = columns.map(c => {
                const val = (c.render ? c.render(item) : (item[c.key]!==undefined?item[c.key]:''));
                return `<td>${val!==undefined?val:'—'}</td>`;
              }).join('');
              const onclick = rowClick ? `onclick="Dashboard.closeDrilldown();${rowClick(item)}"` : '';
              return `<tr ${onclick} style="cursor:pointer">${cells}</tr>`;
            }).join('') : `<tr><td colspan="${columns.length}"><div class="empty"><div class="empty-icon">📂</div>暂无数据</div></td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;
    let el = document.getElementById('drilldown-modal');
    if(!el){ el=document.createElement('div'); el.id='drilldown-modal'; document.body.appendChild(el); }
    el.innerHTML = html;
    el.style.display = 'block';
  },

  /** 关闭弹窗 */
  closeDrilldown(){
    const el = document.getElementById('drilldown-modal');
    if(el) el.innerHTML = '';
  },

  /** 客户明细 */
  drillCustomer(type){
    const list = type==='pool' ? Store.customers().filter(c=>c.inPool) : Store.myCustomers();
    const columns = [
      {key:'name', label:'客户名称', render:c=>`<div class="row-name">${Utils.esc(c.name)}</div><div class="row-sub">${Utils.esc(c.region||'')} · ${Utils.esc(c.shortName||'')}</div>`},
      {key:'industry', label:'行业'},
      {key:'level', label:'级别', render:c=>`<span class="badge ${DICT.cls('customerLevel',c.level)}">${c.level}级</span>`},
      {key:'status', label:'状态', render:c=>{const s=DICT.customerStatus.find(x=>x.value===c.status)||{};return `<span class="badge" style="background:${s.color};color:#fff">${s.label}</span>`;}},
      {key:'oppCount', label:'商机数', render:c=>Store.oppsByCustomer(c.id).length},
      {key:'oppAmount', label:'商机金额', render:c=>Utils.fmtMoney(Utils.sum(Store.oppsByCustomer(c.id),'amount'))},
      {key:'owner', label:'负责人'},
    ];
    Dashboard.showDrilldown(`🏢 ${type==='pool'?'公海客户':'我的客户'}明细`, list, columns, (item)=>`Customer.openDetail('${item.id}')`);
  },

  /** 联系人明细 */
  drillContact(){
    const list = Store.contacts();
    const columns = [
      {key:'name', label:'姓名', render:ct=>`<b>${Utils.esc(ct.name)}</b>`},
      {key:'customerId', label:'所属客户', render:ct=>{const c=Store.customer(ct.customerId);return Utils.esc(c?c.shortName||c.name:'—');}},
      {key:'title', label:'职务'},
      {key:'rank', label:'层级', render:ct=>`<span class="badge ${DICT.cls('contactRank',ct.rank)}">${DICT.label('contactRank',ct.rank)}</span>`},
      {key:'role', label:'决策角色'},
      {key:'attitude', label:'态度', render:ct=>`<span class="badge" style="background:${ct.attitude==='支持'?'var(--green)':ct.attitude==='中立'?'var(--orange)':'var(--gray)'};color:#fff">${ct.attitude||'—'}</span>`},
      {key:'mobile', label:'手机'},
      {key:'email', label:'邮箱'},
    ];
    Dashboard.showDrilldown('👤 联系人明细', list, columns, (item)=>`Contact.openDetail('${item.id}')`);
  },

  /** 商机明细（通用：可按状态/阶段/竞争形势过滤） */
  drillOpp(type, filterVal){
    let list = Store.opportunities();
    let title = '商机明细';
    if(type==='open'){ list=list.filter(o=>o.status==='open'); title='进行中商机明细'; }
    else if(type==='won'){ list=list.filter(o=>o.status==='won'); title='已赢单商机明细'; }
    else if(type==='stage'){ const sv=Number(filterVal); list=list.filter(o=>(o.status==='open')&&o.stage===sv); const st=DICT.opportunityStage.find(s=>s.value===sv)||{}; title=`🎯 ${st.label}阶段商机明细`; }
    else if(type==='competition'){ list=list.filter(o=>(o.status==='open')&&o.competition===filterVal); const cp=DICT.competition.find(x=>x.value===filterVal)||{}; title=`⚔️ ${cp.label}商机明细`; }
    const columns = [
      {key:'name', label:'商机名称', render:o=>`<div class="row-name">${Utils.esc(o.name)}</div><div class="row-sub">${Utils.esc(o.product||'')}</div>`},
      {key:'customerId', label:'客户', render:o=>{const c=Store.customer(o.customerId);return Utils.esc(c?c.shortName||c.name:'—');}},
      {key:'amount', label:'金额', render:o=>Utils.fmtMoney(o.amount)},
      {key:'stage', label:'阶段', render:o=>{const s=DICT.opportunityStage.find(x=>x.value===o.stage)||{};return `<span class="badge" style="background:${s.color};color:#fff">${s.label}</span>`;}},
      {key:'competition', label:'竞争', render:o=>{const cp=DICT.competition.find(x=>x.value===o.competition)||{};return `<span class="badge ${cp.cls}">${cp.label}</span>`;}},
      {key:'status', label:'状态', render:o=>{const ss=DICT.opportunityStatus.find(x=>x.value===o.status)||{};return `<span class="badge ${ss.cls}">${ss.label}</span>`;}},
      {key:'winProbability', label:'赢单率', render:o=>`<b style="color:${(o.winProbability||0)>=60?'var(--green)':(o.winProbability||0)>=40?'var(--orange)':'var(--red)'}">${o.winProbability||0}%</b>`},
      {key:'expectedSignDate', label:'预计签约', render:o=>Utils.fmtDate(o.expectedSignDate)},
    ];
    Dashboard.showDrilldown(title, list, columns, (item)=>`Opportunity.openDetail('${item.id}')`);
  },
};
