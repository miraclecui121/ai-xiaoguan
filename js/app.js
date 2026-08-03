/* ========== 主应用 App ========== */
const App = {
  currentRoute: '',
  routes: {
    dashboard: ()=>Dashboard.render(),
    ai: ()=>AI.render(),
    customer: ()=>Customer.renderList(),
    'customer-pool': ()=>Customer.renderPool(),
    contact: ()=>Contact.renderList(),
    opportunity: ()=>Opportunity.renderList(),
    followup: ()=>Followup.renderList(),
    schedule: ()=>Schedule.render(),
    report: ()=>Report.render(),
    funnel: ()=>Dashboard.renderFunnel(),
    performance: ()=>Dashboard.renderPerformance(),
    alerts: ()=>Dashboard.renderAlerts(),
    'enterprise-info': ()=>Enterprise.renderInfo(),
    'enterprise-org': ()=>Enterprise.renderOrg(),
    'enterprise-users': ()=>Enterprise.renderUsers(),
    settings: ()=>App.renderSettings(),
    'ops-logs': ()=>App.renderOpsLogs()
  },

  async init(){
    // 异步初始化：检测 API 可用性 → 拉取数据或加载本地数据
    await Store.init();
    Store.initSession();
    if(typeof Auth!=='undefined' && Auth.restoreWechatOAuthSession){
      await Auth.restoreWechatOAuthSession();
    }
    // 认证守卫：未登录则显示登录页
    if(!Auth.check()) return;
    App.navigate('dashboard');
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ Modal.close(); App.closeNotifPanel(); Utils.Mention.closeAll(); }
    });
    // 点击页面其他位置关闭消息面板和@选人下拉
    document.addEventListener('click', e=>{
      const panel = document.getElementById('notifPanel');
      const bell = document.getElementById('notifBell');
      if(panel && panel.style.display==='block' && !panel.contains(e.target) && e.target!==bell && !bell.contains(e.target)){
        App.closeNotifPanel();
      }
      // 关闭所有@选人下拉
      const clickedInMention = e.target.closest('.mu-dropdown') || e.target.closest('.mu-trigger');
      if(!clickedInMention) Utils.Mention.closeAll();
    });
  },

  navigate(route){
    // 企业管理页面需要管理员权限
    if(route.startsWith('enterprise-') && !Store.isAdmin()){
      Toast.show('仅企业管理员可访问','error');
      return;
    }
    if(route==='ops-logs' && (!Store.canManageInvites || !Store.canManageInvites())){
      Toast.show('仅平台管理员可访问运营日志','error');
      return;
    }
    App.currentRoute = route;
    if(typeof Audit!=='undefined') Audit.log('page_view', { action:'navigate', route });
    // 菜单高亮
    document.querySelectorAll('.menu-item').forEach(m=>{
      m.classList.toggle('active', m.dataset.route===route);
    });
    const fn = App.routes[route];
    const main = document.getElementById('mainContent');
    if(fn){
      main.innerHTML = '<div class="loading">加载中…</div>';
      try{ main.innerHTML = App.withWorkspaceBanner(fn()); }catch(e){ main.innerHTML = '<div class="empty">渲染出错：'+Utils.esc(e.message)+'</div>'; console.error(e); }
    } else {
      main.innerHTML = '<div class="empty"><div class="empty-icon">🚧</div>该模块开发中…</div>';
    }
    // 滚动到顶
    main.scrollTop = 0;
    // 刷新铃铛
    App.refreshNotifBadge();
    setTimeout(()=>App.maybeShowExpertGuide(), 180);
  },

  // 重新渲染当前页面（不滚动到顶部，不闪烁loading）
  render(){
    const fn = App.routes[App.currentRoute];
    const main = document.getElementById('mainContent');
    if(fn){
      try{ main.innerHTML = App.withWorkspaceBanner(fn()); }catch(e){ main.innerHTML = '<div class="empty">渲染出错：'+Utils.esc(e.message)+'</div>'; console.error(e); }
    }
    // 刷新铃铛未读数量
    App.refreshNotifBadge();
    setTimeout(()=>App.maybeShowExpertGuide(), 180);
  },

  withWorkspaceBanner(html){
    const banner = (typeof Personal!=='undefined' && Personal.renderWorkspaceBanner) ? Personal.renderWorkspaceBanner() : '';
    return banner + html;
  },

  openExpertsEntry(){
    App.dismissExpertGuide();
    if(typeof Audit!=='undefined') Audit.log('expert_entry_click', { action:'open_expert_entry', route:App.currentRoute });
    App.navigate('ai');
  },

  expertGuideKey(){
    const user = Store.currentUser ? Store.currentUser() : null;
    const ent = Store.session?.enterpriseId || 'guest';
    return `aixg_expert_guide_seen:${ent}:${user?.id || 'guest'}`;
  },

  maybeShowExpertGuide(){
    if(App.currentRoute === 'ai') return;
    const btn = document.querySelector('.expert-entry-btn');
    if(!btn || document.getElementById('expertGuideBubble')) return;
    try{ if(localStorage.getItem(App.expertGuideKey()) === '1') return; }catch(e){}
    const bubble = document.createElement('div');
    bubble.id = 'expertGuideBubble';
    bubble.className = 'expert-guide-bubble';
    bubble.innerHTML = `
      <div class="expert-guide-title">10个销售专家在这里</div>
      <div class="expert-guide-text">可以分析客户、商机、拜访、赢单策略，直接给下一步动作。</div>
      <div class="expert-guide-actions">
        <button class="expert-guide-primary" onclick="App.openExpertsEntry()">试一下</button>
        <button class="expert-guide-ghost" onclick="App.dismissExpertGuide()">知道了</button>
      </div>
    `;
    document.body.appendChild(bubble);
    btn.classList.add('attention');
  },

  dismissExpertGuide(){
    try{ localStorage.setItem(App.expertGuideKey(), '1'); }catch(e){}
    const bubble = document.getElementById('expertGuideBubble');
    if(bubble) bubble.remove();
    document.querySelector('.expert-entry-btn')?.classList.remove('attention');
  },

  // ===== 消息通知系统 =====

  /** 刷新铃铛角标 */
  refreshNotifBadge(){
    const badge = document.getElementById('notifBadge');
    if(!badge) return;
    const count = Store.unreadNotificationCount();
    if(count>0){
      badge.textContent = count>99?'99+':count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  /** 切换消息面板 */
  toggleNotifPanel(e){
    e.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if(panel.style.display==='block'){
      App.closeNotifPanel();
    } else {
      App.renderNotifList();
      panel.style.display='block';
    }
  },

  /** 关闭面板 */
  closeNotifPanel(){
    const panel = document.getElementById('notifPanel');
    if(panel) panel.style.display='none';
  },

  /** 渲染消息列表 */
  renderNotifList(){
    const list = document.getElementById('notifList');
    if(!list) return;
    const notifs = Store.notifications();
    if(!notifs.length){
      list.innerHTML = '<div class="mu-empty">暂无消息</div>';
      return;
    }
    let html = '';
    const typeIcons = {
      customer_new: '🏢', contact_new: '👤', opportunity_new: '🎯',
      stage_update: '📊', followup: '📝', schedule: '📅'
    };
    const typeLabels = {
      customer_new: '新建客户', contact_new: '新建联系人', opportunity_new: '新建商机',
      stage_update: '阶段更新', followup: '跟进记录', schedule: '协同日程'
    };
    notifs.forEach(n=>{
      const icon = typeIcons[n.type]||'📌';
      const label = typeLabels[n.type]||n.type;
      const time = Utils.relativeTime(n.createdAt);
      const cls = n.isRead ? '' : ' unread';
      html += `<div class="notif-item${cls}" onclick="App.handleNotifClick('${n.id}')" title="点击查看详情">
        <span class="notif-icon">${icon}</span>
        <div class="notif-body">
          <div class="notif-title">${Utils.esc(n.title)}</div>
          <div class="notif-msg">${Utils.esc(n.message)}</div>
          <div class="notif-meta"><span class="notif-tag">${label}</span><span class="notif-time">${time}</span></div>
        </div>
        ${n.isRead?'':'<span class="notif-dot"></span>'}
      </div>`;
    });
    list.innerHTML = html;
  },

  /** 点击消息 → 跳转到对应记录并标记已读 */
  handleNotifClick(notifId){
    const n = Store.notification(notifId);
    if(!n) return;
    // 标记已读
    Store.markNotificationRead(notifId);
    App.closeNotifPanel();
    App.refreshNotifBadge();
    // 根据 refType 跳转
    const jumpMap = {
      customer: ()=>Customer.openDetail(n.refId),
      contact: ()=>Contact.openDetail(n.refId),
      opportunity: ()=>Opportunity.openDetail(n.refId),
      followup: ()=>{ App.navigate('followup'); setTimeout(()=>Followup.openForm(n.refId), 300); },
      schedule: ()=>{ App.navigate('schedule'); setTimeout(()=>Schedule.openForm(n.refId), 300); }
    };
    const fn = jumpMap[n.refType];
    if(fn) fn();
    else Toast.show('无法定位到对应记录','warn');
  },

  /** 全部标记已读 */
  markAllNotifRead(){
    Store.markAllNotificationsRead();
    App.renderNotifList();
    App.refreshNotifBadge();
    Toast.show('已全部标记为已读','success');
  },

  // 全局搜索
  globalSearch(kw){
    const box = document.getElementById('searchResults');
    if(!kw || kw.trim().length<1){ box.classList.remove('show'); box.innerHTML=''; return; }
    kw = kw.trim();
    const customers = Store.customers().filter(c=>c.name.includes(kw)||c.shortName.includes(kw)).slice(0,4);
    const contacts = Store.contacts().filter(c=>c.name.includes(kw)).slice(0,4);
    const opps = Store.opportunities().filter(o=>o.name.includes(kw)).slice(0,4);
    let html = '';
    if(customers.length){
      html += `<div class="menu-title" style="padding:6px 14px">客户</div>`;
      customers.forEach(c=>html+=`<div class="sr-item" onclick="Customer.openDetail('${c.id}');App.closeSearch()"><span class="sr-tag" style="background:#1a3a6b">客户</span><span>${Utils.esc(c.name)}</span></div>`);
    }
    if(contacts.length){
      html += `<div class="menu-title" style="padding:6px 14px">联系人</div>`;
      contacts.forEach(c=>{
        const cu = Store.customer(c.customerId);
        html+=`<div class="sr-item" onclick="Contact.openDetail('${c.id}');App.closeSearch()"><span class="sr-tag" style="background:#c89b2c">联系人</span><span>${Utils.esc(c.name)} · ${Utils.esc(c.title||'')} · ${Utils.esc(cu?cu.shortName:'')}</span></div>`;
      });
    }
    if(opps.length){
      html += `<div class="menu-title" style="padding:6px 14px">商机</div>`;
      opps.forEach(o=>{
        html+=`<div class="sr-item" onclick="Opportunity.openDetail('${o.id}');App.closeSearch()"><span class="sr-tag" style="background:#16a34a">商机</span><span>${Utils.esc(o.name)}</span></div>`;
      });
    }
    if(!html) html = '<div class="empty" style="padding:20px">未找到匹配结果</div>';
    box.innerHTML = html;
    box.classList.add('show');
  },
  closeSearch(){
    document.getElementById('searchResults').classList.remove('show');
    document.getElementById('globalSearch').value='';
  },

  resetData(){
    Modal.confirm('重置示例数据','⚠️ 此操作将清空当前所有数据并恢复为初始示例数据，确认继续？', ()=>{
      Store.reset();
      // 重置后检查当前会话是否仍然有效
      if(!Store.currentUser()){
        Store.logout();
        Auth.showLogin();
        Auth.renderLogin();
        Toast.show('数据已重置，请重新登录','success');
      } else {
        Toast.show('已恢复示例数据','success');
        App.navigate(App.currentRoute);
      }
    }, '确认重置');
  },

  renderSettings(){
    const s = Store.db.settings;
    const stats = Store.stats();
    const orgTxt = App.orgInfoCollapsed ? '▶ 展开' : '▼ 收起';
    const orgStyle = App.orgInfoCollapsed ? 'display:none' : '';
    const dataTxt = App.dataOverviewCollapsed ? '▶ 展开' : '▼ 收起';
    const dataStyle = App.dataOverviewCollapsed ? 'display:none' : '';
    const aiTxt = App.aiModelCollapsed ? '▶ 展开' : '▼ 收起';
    const aiStyle = App.aiModelCollapsed ? 'display:none' : '';
    const dictTxt = App.dictConfigCollapsed ? '▶ 展开' : '▼ 收起';
    const dictStyle = App.dictConfigCollapsed ? 'display:none' : '';
    const subTxt = App.subscriptionCollapsed ? '▶ 展开' : '▼ 收起';
    const subStyle = App.subscriptionCollapsed ? 'display:none' : '';
    const crmTxt = App.crmIntegrationCollapsed ? '▶ 展开' : '▼ 收起';
    const crmStyle = App.crmIntegrationCollapsed ? 'display:none' : '';
    return `
    <div class="page-head">
      <div><div class="page-title">⚙️ 系统设置</div><div class="page-desc">机构信息、数据底座、AI配置、订阅与积分、字段配置、CRM对接。商机里的“产品方案”在字段配置里自定义。</div></div>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span>🏢 机构信息</span>
          <span class="settings-collapse-toggle" onclick="App.toggleOrgInfo()" id="orgInfoToggle" title="点击收起/展开">${orgTxt}</span>
        </span>
      </div>
      <div id="orgInfoBody" class="settings-collapse-body" style="${orgStyle}">
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">机构名称</label><input class="form-input" id="setOrgName" value="${Utils.esc(s.orgName)}"></div>
        <div class="form-row"><label class="form-label">财年</label><input class="form-input" id="setYear" type="number" value="${s.fiscalYear}"></div>
        <div class="form-row"><label class="form-label">负责人</label><input class="form-input" id="setOwner" value="${Utils.esc(s.owner)}"></div>
        <div class="form-row"><label class="form-label">季度业绩目标(元)</label><input class="form-input" id="setTarget" type="number" value="${s.quarterTarget}"></div>
      </div>
      <button class="btn btn-primary" onclick="App.saveSettings()">保存设置</button>
      </div> <!-- /orgInfoBody -->
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span>📊 数据底座概览</span>
          <span class="settings-collapse-toggle" onclick="App.toggleDataOverview()" id="dataOverviewToggle" title="点击收起/展开">${dataTxt}</span>
        </span>
      </div>
      <div id="dataOverviewBody" class="settings-collapse-body" style="${dataStyle}">
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">客户总数</div><div class="stat-value">${stats.customerTotal}</div><div class="stat-sub">公海 ${stats.poolTotal} · 我的 ${stats.myCustomerTotal}</div></div>
        <div class="stat-card gold"><div class="stat-label">联系人总数</div><div class="stat-value">${stats.contactTotal}</div><div class="stat-sub">关键联系人 ${Store.contacts().filter(c=>c.isKey).length}</div></div>
        <div class="stat-card green"><div class="stat-label">商机总数</div><div class="stat-value">${stats.oppTotal}</div><div class="stat-sub">进行中 ${stats.openOppTotal} · 已赢单 ${stats.wonOppTotal}</div></div>
        <div class="stat-card orange"><div class="stat-label">数据存储</div><div class="stat-value" style="font-size:18px">${Store.mode==='api'?'云端数据库':'本地浏览器'}</div><div class="stat-sub">${Store.mode==='api'?'MySQL · API 同步':'localStorage 持久化'}</div></div>
      </div>
      </div> <!-- /dataOverviewBody -->
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span>AI 大模型配置 <small style="font-weight:500;color:var(--text-3)">个人版默认走平台 DeepSeek V4-Flash；此处供企业自配模型验证</small></span>
          <span class="settings-collapse-toggle" onclick="App.toggleAiModelConfig()" id="aiModelToggle" title="点击收起/展开配置">${aiTxt}</span>
        </span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="App.addAiModel()">+ 添加模型</button>
          <button class="btn btn-primary btn-sm" onclick="App.saveAiModels()">保存模型配置</button>
        </div>
      </div>
      <div id="aiModelConfigBody" class="settings-collapse-body" style="${aiStyle}">
      <div style="margin-bottom:12px;padding:10px 12px;background:#eefaf6;border:1px solid #bfe9dc;border-radius:6px;font-size:13px;color:var(--text-2);line-height:1.7">
        <b>个人版默认体验</b>：AI销冠平台已通过本机代理接入 DeepSeek V4-Flash，C 端用户无需填写 API Key，即可体验 10 个销售分析视角的真实对话。<br>
        <b>B 端自配说明</b>：下方配置区用于证明企业客户可接入自己的 OpenAI Chat Completions 兼容模型。若企业填写并设为默认，将优先使用企业自配模型；未配置时自动回到平台模型。生产环境应由后端加密保存企业 Key，不应下发到浏览器。
      </div>
      <div style="margin-bottom:12px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:13px;color:var(--text-2);line-height:1.7">
        <b>本机日志与隐私</b>：系统会记录登录、页面访问、AI专家调用、脱敏后的提问、耗时、Token和异常拦截，用于调试质量和识别爬取风险；不记录密码、API Key、Cookie、完整客户档案快照和完整模型回复。本机日志保存在服务端 <code>logs/</code> 目录，正式上线后应改为后端审计表并设置保留周期。
      </div>
      <div id="aiModelList" class="ai-model-list">
        ${(s.aiModels?.providers||[]).map((m,i)=>App.renderAiModelRow(m,i)).join('')}
      </div>
      </div>
    </div>
    ${Store.canManageInvites && Store.canManageInvites() ? App.renderInviteAdminCard() + App.renderAdminUsageLogCard() : ''}
    ${App.renderSubscriptionCard(subTxt, subStyle)}
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>📋 字段配置 <small style="font-weight:500;color:var(--text-3)">客户行业、商机阶段、产品方案等选项</small> <button class="btn btn-sm settings-collapse-toggle" onclick="App.toggleDictConfig()" id="dictConfigToggle">${dictTxt}</button></span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="App.dictResetAll()">恢复全部默认</button>
          <button class="btn btn-primary btn-sm" onclick="App.saveDict()">保存字典</button>
        </div>
      </div>
      <div id="dictConfigBody" class="settings-collapse-body" style="${dictStyle}">
      <div class="dict-editor">
        ${Object.keys(DICT.META).filter(k=>!DICT.META[k].system).map(key=>App.renderDictCard(key)).join('')}
      </div>
      </div>
    </div>
    ${App.renderCrmIntegrationCard(crmTxt, crmStyle)}
    `;
  },
  saveSettings(){
    Store.db.settings.orgName = document.getElementById('setOrgName').value;
    Store.db.settings.fiscalYear = Number(document.getElementById('setYear').value);
    Store.db.settings.owner = document.getElementById('setOwner').value;
    Store.db.settings.quarterTarget = Number(document.getElementById('setTarget').value);
    Store.save();
    if(Store.mode==='api'){
      API.put('/api/enterprises/settings', Store.db.settings).catch(err=>{
        Toast.show('设置同步失败: '+err.message, 'error');
      });
    }
    Toast.show('设置已保存','success');
  },

  renderInviteAdminCard(){
    const rows = Store.inviteUsageSummary ? Store.inviteUsageSummary() : [];
    const origin = location.origin || 'http://127.0.0.1:4174';
    const table = rows.length ? rows.map(({code, activations, aiCalls, searches, customers})=>{
      const totalTokens = aiCalls.reduce((sum,e)=>sum+Number(e.tokens||0),0);
      const names = activations.map(a=>a.userName).filter(Boolean).slice(0,3).join('、') || '—';
      const link = `${origin}${location.pathname}?invite=${encodeURIComponent(code.code)}&src=${encodeURIComponent(code.sourceChannel||'')}&campaign=${encodeURIComponent(code.campaignName||'')}`;
      const statusText = code.status==='disabled' ? '停用' : (code.status==='activated' ? '已激活' : (code.status==='issued' ? '已发放' : '启用'));
      const statusCls = code.status==='disabled' ? 'badge-gray' : (code.status==='activated' ? 'badge-green' : (code.status==='issued' ? 'badge-orange' : 'badge-green'));
      return `
        <tr>
          <td><code class="invite-code">${Utils.esc(code.code)}</code></td>
          <td>
            <div>${Utils.esc(code.sourceChannel||'—')}</div>
            <small>${Utils.esc(code.campaignName||'—')}</small>
          </td>
          <td>
            <div>${Utils.esc(code.planName||'个人版')}</div>
            <small>AI ${Number(code.aiCallQuota||0)||'不限'} 次 · 搜索 ${Number(code.searchQuota||0)||'不限'} 次 · 客户 ${Number(code.customerLimit||0)||'不限'} · ${code.expiresAt ? `到期 ${Utils.esc(code.expiresAt)}` : '发放后15天内有效'}</small>
          </td>
          <td>${Number(code.usedCount||0)} / ${Number(code.maxUses||0)||'不限'}</td>
          <td>
            <div>${Utils.esc(names)}</div>
            <small>${activations.length} 个用户 · ${customers.length} 个客户</small>
          </td>
          <td>${aiCalls.length} 次 <small>${totalTokens ? `· ${Utils.fmtMoneyPlain(totalTokens)} tokens` : ''}${searches?.length ? ` · 联网 ${searches.length} 次` : ''}</small></td>
          <td><span class="badge ${statusCls}">${statusText}</span></td>
          <td>
            <button class="btn btn-ghost btn-xs" onclick="App.copyInviteLink('${Utils.esc(link)}')">复制链接</button>
            <button class="btn btn-ghost btn-xs" onclick="App.toggleInviteCode('${Utils.esc(code.code)}')">${code.status==='disabled'?'启用':'停用'}</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="8" class="empty" style="padding:18px">暂无邀请码</td></tr>`;
    return `
    <div class="card invite-admin-card">
      <div class="card-title">
        <span>邀请码与体验追踪</span>
        <span class="badge badge-green">个人版增长闭环</span>
      </div>
      <div class="invite-admin-note">
        用邀请码控制“从演示空间进入个人空间”的开通权限。生成时写入渠道和活动名，用户激活后会追踪到该邀请码下的用户、客户数和 AI 专家调用次数。
      </div>
      <div class="invite-generator">
        <div class="form-grid-4">
          <div class="form-row"><label class="form-label">前缀</label><input class="form-input" id="invPrefix" value="AIXG"></div>
          <div class="form-row"><label class="form-label">数量</label><input class="form-input" id="invCount" type="number" min="1" max="50" value="5"></div>
          <div class="form-row"><label class="form-label">来源渠道</label><input class="form-input" id="invSource" value="社群内测"></div>
          <div class="form-row"><label class="form-label">活动名</label><input class="form-input" id="invCampaign" value="首批体验"></div>
        </div>
        <div class="form-grid-4">
          <div class="form-row"><label class="form-label">权益名称</label><input class="form-input" id="invPlanName" value="个人体验版"></div>
          <div class="form-row"><label class="form-label">每码可用次数</label><input class="form-input" id="invMaxUses" type="number" min="1" value="1"></div>
          <div class="form-row"><label class="form-label">AI 调用额度</label><input class="form-input" id="invAiQuota" type="number" min="0" value="50"></div>
          <div class="form-row"><label class="form-label">联网检索额度</label><input class="form-input" id="invSearchQuota" type="number" min="0" value="30"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">客户容量</label><input class="form-input" id="invCustomerLimit" type="number" min="0" value="10"></div>
          <div class="form-row"><label class="form-label">有效期</label><input class="form-input" id="invExpiresAt" type="date" value=""><small class="form-hint">留空表示从发放日期起 15 天内有效</small></div>
        </div>
        <div class="form-row"><label class="form-label">备注</label><input class="form-input" id="invRemark" placeholder="如：直播间赠送、付费体验、老客户内测"></div>
        <button class="btn btn-primary" onclick="App.generateInviteCodesFromForm()">生成邀请码</button>
      </div>
      <table class="data-table invite-table">
        <thead><tr><th>邀请码</th><th>来源/活动</th><th>权益</th><th>使用</th><th>激活用户</th><th>AI调用</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${table}</tbody>
      </table>
    </div>`;
  },

  renderAdminUsageLogCard(){
    const savedToken = localStorage.getItem('aixg_admin_log_token') || '';
    const summary = App.adminUsageSummary || null;
    const status = summary
      ? `<span class="badge badge-green">已加载 ${Number(summary.counts?.questions||0)} 条问题</span>`
      : `<span class="badge badge-gray">需要查询口令</span>`;
    return `
    <div class="card admin-usage-card">
      <div class="card-title">
        <span>用户使用日志</span>
        ${status}
      </div>
      <div class="invite-admin-note">
        用于上线后查看用户问过什么、围绕哪些客户、调用了哪些专家和模型额度。当前读取服务端日志文件；Render Free 重启或重新部署后可能丢失历史，后续应迁移到数据库。
      </div>
      <div class="admin-log-toolbar">
        <input class="form-input" id="adminLogToken" type="password" value="${Utils.esc(savedToken)}" placeholder="输入 ADMIN_LOG_TOKEN 查询口令">
        <select class="form-input" id="adminLogDays">
          <option value="1">近 1 天</option>
          <option value="7" selected>近 7 天</option>
          <option value="30">近 30 天</option>
        </select>
        <button class="btn btn-primary" onclick="App.loadAdminUsageSummary()">查询日志</button>
        <button class="btn btn-ghost" onclick="App.clearAdminUsageSummary()">清空</button>
      </div>
      <div id="adminUsageSummary">${App.renderAdminUsageSummary(summary)}</div>
    </div>`;
  },

  renderAdminUsageSummary(summary){
    if(!summary){
      return `<div class="admin-log-empty">输入查询口令后，可查看用户、客户、专家和最近问题。查询口令只保存在当前浏览器本地。</div>`;
    }
    const counts = summary.counts || {};
    const userRows = (summary.users || []).slice(0,8).map(row=>`
      <tr>
        <td>${Utils.esc(row.user?.userName || '未知')}<small>${Utils.esc(row.user?.account || '')}</small></td>
        <td>${Utils.esc(row.user?.enterpriseName || '—')}<small>${Utils.esc(row.user?.workspaceType || '')}</small></td>
        <td>${Number(row.calls||0)}</td>
        <td>${Number(row.tokens||0).toLocaleString()}</td>
        <td>${Number(row.fail||0)}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无用户调用</td></tr>`;
    const customerRows = (summary.customers || []).slice(0,8).map(row=>`
      <tr>
        <td>${Utils.esc(row.customerName || '未识别客户')}</td>
        <td>${Number(row.calls||0)}</td>
        <td>${Number(row.users||0)}</td>
        <td>${(row.experts || []).map(x=>`<code>${Utils.esc(x)}</code>`).join(' ') || '—'}</td>
        <td>${Utils.esc(row.lastQuestion || '—')}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无可识别客户</td></tr>`;
    const questionRows = (summary.questions || []).slice(0,30).map(q=>`
      <tr>
        <td>${Utils.esc(App.formatAdminLogTime(q.ts))}<small>${Utils.esc(q.kind || '')}${q.success===false ? ' · 失败' : ''}</small></td>
        <td>${Utils.esc(q.user?.userName || '未知')}<small>${Utils.esc(q.user?.account || '')}</small></td>
        <td>${Utils.esc(q.customerName || '未识别')}<small>${Utils.esc((q.customerNames||[]).join('、') || (q.opportunityNames||[]).join('、') || '')}</small></td>
        <td>${Utils.esc(q.expertId || '—')}</td>
        <td>${Utils.esc(q.question || '')}<small>${Utils.esc(q.error || q.model || '')}${q.tokens ? ` · ${Number(q.tokens).toLocaleString()} tokens` : ''}</small></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无问题</td></tr>`;
    return `
      <div class="admin-log-stats">
        <div><b>${Number(counts.users||0)}</b><span>用户</span></div>
        <div><b>${Number(counts.questions||0)}</b><span>问题</span></div>
        <div><b>${Number(counts.customers||0)}</b><span>客户</span></div>
        <div><b>${Number(counts.aiUsage||0)}</b><span>AI/搜索调用</span></div>
      </div>
      <div class="admin-log-grid">
        <div>
          <h4>活跃用户</h4>
          <table class="data-table compact-table"><thead><tr><th>用户</th><th>空间</th><th>调用</th><th>Token</th><th>失败</th></tr></thead><tbody>${userRows}</tbody></table>
        </div>
        <div>
          <h4>客户热度</h4>
          <table class="data-table compact-table"><thead><tr><th>客户</th><th>次数</th><th>用户</th><th>专家</th><th>最近问题</th></tr></thead><tbody>${customerRows}</tbody></table>
        </div>
      </div>
      <h4 class="admin-log-title">最近问题</h4>
      <table class="data-table compact-table admin-question-table"><thead><tr><th>时间</th><th>用户</th><th>客户</th><th>专家</th><th>问题</th></tr></thead><tbody>${questionRows}</tbody></table>
      <div class="admin-log-empty">生成时间：${Utils.esc(App.formatAdminLogTime(summary.generatedAt))} · 存储：${Utils.esc(summary.storage?.type || '')}</div>
    `;
  },

  async loadAdminUsageSummary(){
    const token = document.getElementById('adminLogToken')?.value || '';
    const days = Number(document.getElementById('adminLogDays')?.value || 7);
    if(!token.trim()){
      Toast.show('请输入日志查询口令', 'warning');
      return;
    }
    localStorage.setItem('aixg_admin_log_token', token);
    try{
      const resp = await fetch('/api/admin/usage-summary', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Admin-Log-Token':token},
        body:JSON.stringify({ days, limit:200 }),
        credentials:'include',
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.error === 'admin_log_token_not_configured'
          ? '服务端尚未配置 ADMIN_LOG_TOKEN'
          : data?.error === 'unauthorized'
            ? '查询口令不正确'
            : (data?.message || data?.error || `查询失败 HTTP ${resp.status}`);
        throw new Error(msg);
      }
      App.adminUsageSummary = data.data;
      const target = document.getElementById('adminUsageSummary');
      if(target) target.innerHTML = App.renderAdminUsageSummary(App.adminUsageSummary);
      Toast.show('日志已加载', 'success');
    }catch(e){
      Toast.show(e.message || '日志查询失败', 'error');
    }
  },

  clearAdminUsageSummary(){
    App.adminUsageSummary = null;
    localStorage.removeItem('aixg_admin_log_token');
    const token = document.getElementById('adminLogToken');
    if(token) token.value = '';
    const target = document.getElementById('adminUsageSummary');
    if(target) target.innerHTML = App.renderAdminUsageSummary(null);
  },

  formatAdminLogTime(ts){
    if(!ts) return '';
    try{
      return new Date(ts).toLocaleString('zh-CN', { hour12:false });
    }catch(e){
      return String(ts);
    }
  },

  opsLogTab: 'overview',
  opsLogDetail: null,

  renderOpsLogs(){
    if(!Store.canManageInvites || !Store.canManageInvites()){
      return `<div class="empty">仅平台管理员可查看运营日志。</div>`;
    }
    const savedToken = localStorage.getItem('aixg_admin_log_token') || '';
    const detail = App.opsLogDetail || null;
    return `
    <div class="page-header">
      <div>
        <h1><span class="page-icon">志</span>运营日志</h1>
        <p>把登录、邀请码、问题、专家调用、联网检索、额度消耗和实体识别分开看，用来判断用户使用质量。</p>
      </div>
      <button class="btn btn-primary" onclick="App.loadOpsUsageDetail()">刷新</button>
    </div>
    <div class="card ops-log-card">
      <div class="admin-log-toolbar ops-log-toolbar">
        <input class="form-input" id="opsLogToken" type="password" value="${Utils.esc(savedToken)}" placeholder="输入 ADMIN_LOG_TOKEN 查询口令">
        <select class="form-input" id="opsLogDays">
          <option value="1">近 1 天</option>
          <option value="7" selected>近 7 天</option>
          <option value="30">近 30 天</option>
        </select>
        <input class="form-input" id="opsLogQuery" value="${Utils.esc(detail?.query || '')}" placeholder="筛选用户/客户/问题/邀请码">
        <button class="btn btn-primary" onclick="App.loadOpsUsageDetail()">查询</button>
        <button class="btn btn-ghost" onclick="App.clearOpsUsageDetail()">清空</button>
      </div>
      <div id="opsLogDetail">${App.renderOpsLogDetail(detail)}</div>
    </div>`;
  },

  renderOpsLogDetail(detail){
    if(!detail){
      return `<div class="admin-log-empty">输入查询口令后，可查看谁登录、谁开通邀请码、问了什么、用了哪个专家、是否联网、消耗多少额度，以及识别出的客户/公司/地区/产品。</div>`;
    }
    const tabs = [
      ['overview','概览'],
      ['logins','登录'],
      ['invites','邀请码'],
      ['questions','问题'],
      ['experts','专家/联网'],
      ['entities','实体识别'],
    ];
    const active = App.opsLogTab || 'overview';
    return `
      <div class="ops-log-meta">生成时间：${Utils.esc(App.formatAdminLogTime(detail.generatedAt))} · 存储：${Utils.esc(detail.storage?.type || '')} · 范围：近 ${Number(detail.days||0)} 天</div>
      <div class="ops-log-tabs">
        ${tabs.map(([id,label])=>`<button class="${active===id?'active':''}" onclick="App.setOpsLogTab('${id}')">${label}</button>`).join('')}
      </div>
      <div class="ops-log-panel">${App.renderOpsLogTab(detail, active)}</div>
    `;
  },

  renderOpsLogTab(detail, tab){
    if(tab==='logins') return App.renderOpsLoginTab(detail);
    if(tab==='invites') return App.renderOpsInviteTab(detail);
    if(tab==='questions') return App.renderOpsQuestionTab(detail);
    if(tab==='experts') return App.renderOpsExpertTab(detail);
    if(tab==='entities') return App.renderOpsEntityTab(detail);
    return App.renderOpsOverviewTab(detail);
  },

  renderOpsOverviewTab(detail){
    const c = detail.counts || {};
    const stat = [
      ['登录事件', c.logins || 0],
      ['问题记录', c.questions || 0],
      ['AI调用', c.aiCalls || 0],
      ['联网检索', c.searches || 0],
      ['活跃用户', c.users || 0],
      ['客户', c.customers || 0],
      ['公司', c.companies || 0],
      ['地区/产品', `${Number(c.regions||0)}/${Number(c.products||0)}`],
    ];
    const userRows = (detail.users || []).slice(0,12).map(row=>`
      <tr>
        <td>${Utils.esc(row.user?.userName || '未知')}<small>${Utils.esc(row.user?.account || '')}</small></td>
        <td>${Utils.esc(row.user?.enterpriseName || '—')}<small>${Utils.esc(row.user?.workspaceType || '')}${row.inviteCode ? ` · ${Utils.esc(row.inviteCode)}` : ''}</small></td>
        <td>${Number(row.logins||0)}</td>
        <td>${Number(row.questions||0)}</td>
        <td>${Number(row.aiCalls||0)} / ${Number(row.searches||0)}</td>
        <td>${Number(row.tokens||0).toLocaleString()}</td>
        <td>${Utils.esc(App.formatAdminLogTime(row.lastAt))}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty">暂无用户记录</td></tr>`;
    const workspaceRows = (detail.workspaceUsers || []).slice(0,8).map(row=>`
      <tr>
        <td>${Utils.esc(row.nickname || '微信用户')}<small>${Utils.esc(row.externalId || '')}</small></td>
        <td>${Utils.esc(row.inviteCode || '—')}<small>${Utils.esc(row.sourceChannel || '')} ${Utils.esc(row.campaignName || '')}</small></td>
        <td>${Number(row.workspaceVersion||0)}</td>
        <td>${Utils.esc(App.formatAdminLogTime(row.updatedAt))}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty">暂无云端个人空间</td></tr>`;
    return `
      <div class="admin-log-stats ops-log-stats">
        ${stat.map(([label,value])=>`<div><b>${Utils.esc(value)}</b><span>${Utils.esc(label)}</span></div>`).join('')}
      </div>
      <div class="admin-log-grid">
        <div>
          <h4>用户使用质量</h4>
          <table class="data-table compact-table"><thead><tr><th>用户</th><th>空间</th><th>登录</th><th>问题</th><th>AI/联网</th><th>Token</th><th>最近</th></tr></thead><tbody>${userRows}</tbody></table>
        </div>
        <div>
          <h4>已同步个人空间</h4>
          <table class="data-table compact-table"><thead><tr><th>微信身份</th><th>邀请码/来源</th><th>版本</th><th>最近同步</th></tr></thead><tbody>${workspaceRows}</tbody></table>
        </div>
      </div>`;
  },

  renderOpsLoginTab(detail){
    const rows = (detail.logins || []).map(row=>`
      <tr>
        <td>${Utils.esc(App.formatAdminLogTime(row.ts))}</td>
        <td>${Utils.esc(App.opsEventLabel(row.event))}<small>${Utils.esc(row.result || row.action || '')}</small></td>
        <td>${Utils.esc(row.user?.userName || '未知')}<small>${Utils.esc(row.user?.account || '')}</small></td>
        <td>${Utils.esc(row.user?.enterpriseName || '—')}<small>${Utils.esc(row.user?.workspaceType || '')}</small></td>
        <td>${Utils.esc(row.inviteCode || row.user?.inviteCode || '—')}<small>${Utils.esc(row.sourceChannel || '')} ${Utils.esc(row.campaignName || '')}</small></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无登录记录</td></tr>`;
    return `<table class="data-table compact-table"><thead><tr><th>时间</th><th>事件</th><th>用户</th><th>空间</th><th>来源/邀请码</th></tr></thead><tbody>${rows}</tbody></table>`;
  },

  renderOpsInviteTab(detail){
    const rows = (detail.invites || []).map(row=>{
      const sourceMeta = [
        row.campaignName || row.user?.campaignName || '',
        row.expiresAt ? `到期 ${row.expiresAt}` : '',
        row.issuedBy ? `发放人 ${row.issuedBy}` : '',
      ].filter(Boolean).join(' · ');
      return `
      <tr>
        <td>${Utils.esc(App.formatAdminLogTime(row.ts || row.lastUsedAt || row.issuedAt))}</td>
        <td><code class="invite-code">${Utils.esc(row.code || '—')}</code><small>${Utils.esc(App.opsStatusLabel(row.status || row.result))}</small></td>
        <td>${Utils.esc(App.opsEventLabel(row.event))}<small>${Utils.esc(row.planName || '')}</small></td>
        <td>${Utils.esc(row.lastUsedBy || row.user?.userName || '—')}<small>${Utils.esc(row.lastUsedAccount || row.user?.account || '')}</small></td>
        <td>${Number(row.usedCount||0)} / ${Number(row.maxUses||0)||'不限'}<small>AI ${Number(row.aiCallQuota||0)} · 联网 ${Number(row.searchQuota||0)} · 客户 ${Number(row.customerLimit||0)}</small></td>
        <td>${Utils.esc(row.sourceChannel || row.user?.sourceChannel || '—')}<small>${Utils.esc(sourceMeta)}</small></td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="empty">暂无邀请码记录</td></tr>`;
    return `<table class="data-table compact-table"><thead><tr><th>时间</th><th>邀请码</th><th>事件</th><th>用户</th><th>权益/用量</th><th>来源</th></tr></thead><tbody>${rows}</tbody></table>`;
  },

  renderOpsQuestionTab(detail){
    const rows = (detail.questions || []).map(q=>`
      <tr>
        <td>${Utils.esc(App.formatAdminLogTime(q.ts))}<small>${Utils.esc(q.kind || '')}${q.success===false ? ' · 失败' : ''}</small></td>
        <td>${Utils.esc(q.user?.userName || '未知')}<small>${Utils.esc(q.user?.account || '')}</small></td>
        <td>${Utils.esc(App.expertName(q.expertId))}<small>${Utils.esc(q.customerName || '未识别客户')}</small></td>
        <td>${q.kind==='search' ? '<span class="badge badge-green">联网</span>' : '<span class="badge badge-gray">对话</span>'}</td>
        <td>${Utils.esc(q.question || '')}<small>${Utils.esc(q.model || q.error || '')}${q.tokens ? ` · ${Number(q.tokens).toLocaleString()} tokens` : ''}</small></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无问题记录</td></tr>`;
    return `<table class="data-table compact-table admin-question-table"><thead><tr><th>时间</th><th>用户</th><th>专家/客户</th><th>类型</th><th>问题</th></tr></thead><tbody>${rows}</tbody></table>`;
  },

  renderOpsExpertTab(detail){
    const expertRows = (detail.experts || []).map(row=>`
      <tr>
        <td>${Utils.esc(App.expertName(row.expertId))}<small>${Utils.esc(row.expertId || '')}</small></td>
        <td>${Number(row.calls||0)}</td>
        <td>${Number(row.questions||0)}</td>
        <td>${Number(row.searches||0)}</td>
        <td>${Number(row.users||0)}</td>
        <td>${Number(row.tokens||0).toLocaleString()}</td>
        <td>${Utils.esc(App.formatAdminLogTime(row.lastAt))}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty">暂无专家调用</td></tr>`;
    const callRows = (detail.aiCalls || []).slice(0,80).map(row=>`
      <tr>
        <td>${Utils.esc(App.formatAdminLogTime(row.ts))}</td>
        <td>${row.kind==='search' ? '<span class="badge badge-green">联网检索</span>' : '<span class="badge badge-gray">模型对话</span>'}<small>${row.success ? '成功' : '失败'}</small></td>
        <td>${Utils.esc(row.user?.userName || '未知')}<small>${Utils.esc(row.user?.account || '')}</small></td>
        <td>${Utils.esc(App.expertName(row.expertId))}<small>${Utils.esc(row.customerName || '')}</small></td>
        <td>${Number(row.tokens||0).toLocaleString()}<small>${row.resultCount ? `来源 ${Number(row.resultCount)} 条` : ''}${row.durationMs ? ` · ${Number(row.durationMs)}ms` : ''}</small></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">暂无调用明细</td></tr>`;
    return `
      <h4>专家调用汇总</h4>
      <table class="data-table compact-table"><thead><tr><th>专家</th><th>调用</th><th>问题</th><th>联网</th><th>用户</th><th>Token</th><th>最近</th></tr></thead><tbody>${expertRows}</tbody></table>
      <h4 class="admin-log-title">AI/联网明细</h4>
      <table class="data-table compact-table"><thead><tr><th>时间</th><th>类型</th><th>用户</th><th>专家/客户</th><th>额度</th></tr></thead><tbody>${callRows}</tbody></table>`;
  },

  renderOpsEntityTab(detail){
    const block = (title, rows, emptyLabel)=>`
      <div>
        <h4>${title}</h4>
        <table class="data-table compact-table"><thead><tr><th>名称</th><th>提及</th><th>用户</th><th>专家</th><th>最近问题</th></tr></thead><tbody>${
          (rows || []).slice(0,20).map(row=>`
            <tr>
              <td>${Utils.esc(row.name || '')}<small>${Utils.esc(App.formatAdminLogTime(row.lastAt))}</small></td>
              <td>${Number(row.mentions||0)}</td>
              <td>${Number(row.users||0)}</td>
              <td>${(row.experts || []).map(id=>`<code>${Utils.esc(App.expertName(id))}</code>`).join(' ') || '—'}</td>
              <td>${Utils.esc(row.lastQuestion || '')}</td>
            </tr>`).join('') || `<tr><td colspan="5" class="empty">${emptyLabel}</td></tr>`
        }</tbody></table>
      </div>`;
    const e = detail.entities || {};
    return `<div class="admin-log-grid ops-entity-grid">
      ${block('客户', e.customers, '暂无客户识别')}
      ${block('公司/组织', e.companies, '暂无公司识别')}
      ${block('地区', e.regions, '暂无地区识别')}
      ${block('产品/方案', e.products, '暂无产品识别')}
    </div>`;
  },

  setOpsLogTab(tab){
    App.opsLogTab = tab || 'overview';
    const target = document.getElementById('opsLogDetail');
    if(target) target.innerHTML = App.renderOpsLogDetail(App.opsLogDetail);
  },

  async loadOpsUsageDetail(){
    const token = document.getElementById('opsLogToken')?.value || document.getElementById('adminLogToken')?.value || localStorage.getItem('aixg_admin_log_token') || '';
    const days = Number(document.getElementById('opsLogDays')?.value || 7);
    const query = document.getElementById('opsLogQuery')?.value || '';
    if(!token.trim()){
      Toast.show('请输入日志查询口令', 'warning');
      return;
    }
    localStorage.setItem('aixg_admin_log_token', token);
    try{
      const resp = await fetch('/api/admin/usage-detail', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Admin-Log-Token':token},
        body:JSON.stringify({ days, limit:500, query }),
        credentials:'include',
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.error === 'admin_log_token_not_configured'
          ? '服务端尚未配置 ADMIN_LOG_TOKEN'
          : data?.error === 'unauthorized'
            ? '查询口令不正确'
            : (data?.message || data?.error || `查询失败 HTTP ${resp.status}`);
        throw new Error(msg);
      }
      App.opsLogDetail = data.data;
      const target = document.getElementById('opsLogDetail');
      if(target) target.innerHTML = App.renderOpsLogDetail(App.opsLogDetail);
      Toast.show('运营日志已加载', 'success');
    }catch(e){
      Toast.show(e.message || '运营日志查询失败', 'error');
    }
  },

  clearOpsUsageDetail(){
    App.opsLogDetail = null;
    const target = document.getElementById('opsLogDetail');
    if(target) target.innerHTML = App.renderOpsLogDetail(null);
  },

  expertName(expertId){
    if(!expertId || expertId==='(none)') return '未指定';
    const ex = typeof Experts!=='undefined' && Experts.get ? Experts.get(expertId) : null;
    return ex?.name || expertId;
  },

  opsEventLabel(event){
    return ({
      wechat_oauth_login_success:'微信内授权登录',
      wechat_qr_login_success:'PC扫码登录',
      wechat_oauth_session_restored:'会话恢复',
      wechat_demo_login_success:'本机微信模拟登录',
      login_success:'备用账号登录',
      wechat_oauth_logout:'微信退出',
      logout:'退出',
      invite_code_created:'邀请码创建',
      invite_code_validated:'邀请码校验',
      invite_code_issued:'邀请码发放',
      invite_code_activated:'邀请码开通',
      invite_ledger_imported:'邀请码导入',
      invite_ledger_codes_viewed:'查看邀请码台账',
    })[event] || event || '事件';
  },
  opsStatusLabel(status){
    return ({
      active:'未发放',
      issued:'已发放',
      activated:'已激活',
      disabled:'已停用',
      success:'成功',
      found:'已找到',
      not_found:'不存在',
      error:'失败',
    })[status] || status || '—';
  },

  generateInviteCodesFromForm(){
    if(!Store.canManageInvites || !Store.canManageInvites()){
      Toast.show('当前账号无权生成邀请码', 'error');
      return;
    }
    try{
      const codes = Store.generateInviteCodes({
        prefix:document.getElementById('invPrefix')?.value || 'AIXG',
        count:Math.min(50, Math.max(1, Number(document.getElementById('invCount')?.value || 1))),
        type:'gift',
        plan:'personal_trial',
        planName:document.getElementById('invPlanName')?.value || '个人体验版',
        sourceChannel:document.getElementById('invSource')?.value || '社群内测',
        campaignName:document.getElementById('invCampaign')?.value || '体验活动',
        maxUses:Number(document.getElementById('invMaxUses')?.value || 1),
        aiCallQuota:Number(document.getElementById('invAiQuota')?.value || 0),
        searchQuota:Number(document.getElementById('invSearchQuota')?.value || 0),
        customerLimit:Number(document.getElementById('invCustomerLimit')?.value || 0),
        expiresAt:document.getElementById('invExpiresAt')?.value || '',
        remark:document.getElementById('invRemark')?.value || '',
      });
      if(typeof Audit!=='undefined') Audit.log('invite_codes_generated', { action:'generate_invite_codes', result:'success', count:codes.length });
      App.render();
      Toast.show(`已生成 ${codes.length} 个邀请码`, 'success');
    }catch(e){
      Toast.show(e.message || '邀请码生成失败', 'error');
    }
  },

  copyInviteLink(link){
    if(!Store.canManageInvites || !Store.canManageInvites()){
      Toast.show('当前账号无权查看邀请码链接', 'error');
      return;
    }
    const text = String(link || '');
    try{
      const u = new URL(text, location.origin);
      const code = (u.searchParams.get('invite') || u.searchParams.get('code') || '').toUpperCase();
      if(code && Store.reportInviteIssued) Store.reportInviteIssued(code, text);
    }catch(e){}
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(text).then(()=>Toast.show('邀请链接已复制','success')).catch(()=>Toast.show(text,'info'));
    }else{
      Toast.show(text, 'info');
    }
  },

  toggleInviteCode(code){
    if(!Store.canManageInvites || !Store.canManageInvites()){
      Toast.show('当前账号无权管理邀请码', 'error');
      return;
    }
    const item = Store.findInviteCode(code);
    if(!item) return Toast.show('邀请码不存在', 'error');
    item.status = item.status==='disabled' ? 'active' : 'disabled';
    Store.save();
    if(typeof Audit!=='undefined') Audit.log('invite_code_status_changed', { action:'toggle_invite_code', code, status:item.status });
    App.render();
  },

  // ===== CRM 系统对接 =====
  crmTarget: '',
  CRM_SYSTEMS: [
    {id:'salesforce', name:'Salesforce', icon:'☁️', auth:'OAuth 2.0', baseUrl:'https://xxx.my.salesforce.com/services/data/v58.0',
      desc:'全球最大的CRM平台，功能全面，生态强大', category:'international'},
    {id:'hubspot', name:'HubSpot', icon:'🟠', auth:'API Key / OAuth', baseUrl:'https://api.hubapi.com',
      desc:'营销+销售一体化，SMB市场领先', category:'international'},
    {id:'dynamics365', name:'Microsoft Dynamics 365', icon:'🔷', auth:'OAuth 2.0 (Azure AD)', baseUrl:'https://org.api.crm.dynamics.com/api/data/v9.2',
      desc:'微软企业级CRM，深度集成Office 365', category:'international'},
    {id:'zoho', name:'Zoho CRM', icon:'🔴', auth:'OAuth 2.0', baseUrl:'https://www.zohoapis.com/crm/v7',
      desc:'印度CRM，API文档完善、性价比高', category:'international'},
    {id:'fxiaoke', name:'纷享销客', icon:'🟢', auth:'AppId + AppSecret', baseUrl:'https://open.fxiaoke.com',
      desc:'国内领先连接型CRM，移动端强', category:'domestic'},
    {id:'xiaoshouyi', name:'销售易', icon:'🔵', auth:'OAuth 2.0', baseUrl:'https://api.xiaoshouyi.com',
      desc:'国内企业级CRM，PaaS平台可定制', category:'domestic'},
    {id:'strategyHub', name:'成交策略中枢', icon:'🧠', auth:'AppKey + AppSecret (Token)', baseUrl:'https://open.strategy-hub.example',
      desc:'聚焦大客户销售赋能，独有的赢率分析算法与决策人画像', category:'domestic', customApi:true},
  ],
  // 字段映射表（本系统 → 目标系统标准字段）
  CRM_FIELD_MAPPINGS: {
    customer: {label:'客户/账户', targetField:'Account / Company',
      fields:[
        {source:'name', target:'Name / AccountName', type:'string', required:true, desc:'客户名称'},
        {source:'shortName', target:'ShortName / Alias', type:'string', required:false, desc:'简称'},
        {source:'industry', target:'Industry', type:'picklist', required:false, desc:'行业分类'},
        {source:'type', target:'Type / CustomerType', type:'picklist', required:false, desc:'客户类型'},
        {source:'owner', target:'OwnerId / Owner', type:'lookup(User)', required:false, desc:'负责人'},
        {source:'scale', target:'NumberOfEmployees / Scale', type:'int', required:false, desc:'人员规模'},
        {source:'address', target:'BillingAddress / Address', type:'textarea', required:false, desc:'地址'},
        {source:'website', target:'Website', type:'url', required:false, desc:'网址'},
        {source:'phone', target:'Phone', type:'phone', required:false, desc:'电话'},
        {source:'uscc', target:'TaxID / USCC', type:'string', required:false, desc:'统一社会信用代码'},
        {source:'remark', target:'Description / Remark', type:'textarea', required:false, desc:'备注'},
      ]},
    contact: {label:'联系人', targetField:'Contact',
      fields:[
        {source:'name', target:'LastName + FirstName', type:'string', required:true, desc:'姓名'},
        {source:'title', target:'Title', type:'string', required:false, desc:'职务'},
        {source:'dept', target:'Department', type:'string', required:false, desc:'部门'},
        {source:'phone', target:'Phone / MobilePhone', type:'phone', required:false, desc:'电话'},
        {source:'email', target:'Email', type:'email', required:false, desc:'邮箱'},
        {source:'wechat', target:'WeChat__c / Custom', type:'string', required:false, desc:'微信'},
        {source:'isKey', target:'IsKeyContact__c / Custom', type:'boolean', required:false, desc:'是否关键联系人'},
        {source:'customerId', target:'AccountId / CompanyId', type:'lookup(Account)', required:true, desc:'关联客户'},
        {source:'remark', target:'Description', type:'textarea', required:false, desc:'备注'},
      ]},
    opportunity: {label:'商机', targetField:'Opportunity / Deal',
      fields:[
        {source:'name', target:'Name / DealName', type:'string', required:true, desc:'商机名称'},
        {source:'customerId', target:'AccountId / CompanyId', type:'lookup(Account)', required:true, desc:'关联客户'},
        {source:'amount', target:'Amount', type:'currency', required:false, desc:'预计金额'},
        {source:'stage', target:'StageName', type:'picklist', required:true, desc:'销售阶段'},
        {source:'status', target:'Status / ForecastCategory', type:'picklist', required:true, desc:'状态'},
        {source:'closeDate', target:'CloseDate', type:'date', required:false, desc:'预计成交日期'},
        {source:'winProbability', target:'Probability', type:'percent', required:false, desc:'赢单概率'},
        {source:'source', target:'LeadSource', type:'picklist', required:false, desc:'线索来源'},
        {source:'owner', target:'OwnerId / Owner', type:'lookup(User)', required:false, desc:'负责人'},
        {source:'remark', target:'Description', type:'textarea', required:false, desc:'备注'},
      ]},
    stageMapping: {label:'商机阶段映射', targetField:'StageName',
      fields:[
        {source:'1', target:'Prospecting / Qualification', desc:'初步接触'},
        {source:'2', target:'Needs Analysis / Discovery', desc:'需求分析'},
        {source:'3', target:'Proposal / Negotiation', desc:'方案/谈判'},
        {source:'4', target:'Closed Won / Closed Lost', desc:'成交/丢单'},
      ]},
  },
  // ===== 成交策略中枢专属 API 端点（基于第三方策略中枢开放平台）=====
  STRATEGY_HUB_API_ENDPOINTS: [
    {op:'获取客户列表（私海）', method:'GET', path:'pp.client.client_private_list', desc:'查询当前用户私海客户列表，支持分页'},
    {op:'获取客户列表（公海）', method:'GET', path:'pp.client.client_international_waters_list', desc:'查询公海客户列表，支持筛选'},
    {op:'添加客户（私海）', method:'POST', path:'pp.client.client_private_add', desc:'创建新客户到私海，需指定负责人'},
    {op:'修改客户（私海）', method:'POST', path:'pp.client.client_private_save', desc:'更新私海客户信息'},
    {op:'客户详情', method:'GET', path:'pp.client.client_id_value', desc:'获取单个客户详细信息'},
    {op:'客户分配/领取/换人', method:'POST', path:'pp.client.allot_client', desc:'客户分配、领取到私海、更换负责人'},
    {op:'获取联系人详情', method:'GET', path:'pp.contact.contact_particulars', desc:'获取联系人详细信息（含客户ID）'},
    {op:'添加联系人', method:'POST', path:'pp.contact.contact_international_waters_add_not_judge', desc:'在客户下直接添加联系人'},
    {op:'客户-联系人关系绑定', method:'POST', path:'pp.clientContact.add_client_contact_ids', desc:'建立客户与联系人的关联关系'},
    {op:'获取项目列表', method:'GET', path:'pp.project.pro_lists', desc:'查询项目（商机）列表，支持按分组筛选'},
    {op:'项目形势分析', method:'GET', path:'pp.project.show_pro_situation', desc:'获取项目形势数据，含赢率分析'},
    {op:'项目状态查询', method:'GET', path:'pp.project.project_status', desc:'返回项目当前状态数据'},
    {op:'项目转移负责人', method:'POST', path:'pp.project.project_change_user', desc:'将项目转移给其他负责人'},
    {op:'角色覆盖分析', method:'GET', path:'pp.logicAnalyse.pro_an_role', desc:'项目分析-决策人角色覆盖度评估'},
    {op:'形势雷达图', method:'GET', path:'pp.logicAnalyse.pro_an_situ', desc:'项目分析-形势雷达图数据（多维度评估）'},
    {op:'目标雷达图', method:'GET', path:'pp.logicAnalyse.pro_an_goal', desc:'项目分析-目标雷达图数据'},
    {op:'保存行动计划', method:'POST', path:'pp.logicAnalyse.save_plan', desc:'策略计划-保存行动计划'},
    {op:'生成拜访', method:'POST', path:'sl.logicAnalyse.visit', desc:'基于分析结果生成拜访建议'},
    {op:'线索列表', method:'GET', path:'pp.clue.index_lists', desc:'线索私海列表查询'},
    {op:'日程添加/修改', method:'POST', path:'pp.schedule.schedule_add_or_save', desc:'协同日程创建与编辑'},
    {op:'部门人员列表', method:'GET', path:'pp.member.dep_member_all_list', desc:'获取公司所有部门和人员信息'},
  ],
  // ===== 成交策略中枢专属字段映射 =====
  STRATEGY_HUB_FIELD_MAPPINGS: {
    customer: {label:'客户', targetField:'Client',
      fields:[
        {source:'name', target:'client_name', type:'string', required:true, desc:'客户名称'},
        {source:'shortName', target:'client_short', type:'string', required:false, desc:'客户简称'},
        {source:'industry', target:'client_industry', type:'picklist', required:false, desc:'行业分类'},
        {source:'type', target:'client_type', type:'picklist', required:false, desc:'客户类型'},
        {source:'owner', target:'client_owner_id', type:'lookup(User)', required:false, desc:'负责人ID'},
        {source:'scale', target:'client_scale', type:'int', required:false, desc:'人员规模'},
        {source:'address', target:'client_address', type:'textarea', required:false, desc:'地址'},
        {source:'website', target:'client_website', type:'url', required:false, desc:'网址'},
        {source:'phone', target:'client_phone', type:'phone', required:false, desc:'电话'},
        {source:'uscc', target:'client_credit_code', type:'string', required:false, desc:'统一社会信用代码'},
        {source:'remark', target:'client_remark', type:'textarea', required:false, desc:'备注'},
      ]},
    contact: {label:'联系人', targetField:'Contact',
      fields:[
        {source:'name', target:'contact_name', type:'string', required:true, desc:'姓名'},
        {source:'title', target:'contact_position', type:'string', required:false, desc:'职务'},
        {source:'dept', target:'contact_department', type:'string', required:false, desc:'部门'},
        {source:'phone', target:'contact_mobile', type:'phone', required:false, desc:'手机号'},
        {source:'email', target:'contact_email', type:'email', required:false, desc:'邮箱'},
        {source:'wechat', target:'contact_wechat', type:'string', required:false, desc:'微信号'},
        {source:'isKey', target:'contact_is_key', type:'boolean', required:false, desc:'是否关键决策人'},
        {source:'customerId', target:'client_id', type:'lookup(Client)', required:true, desc:'关联客户ID'},
        {source:'remark', target:'contact_remark', type:'textarea', required:false, desc:'备注'},
      ]},
    opportunity: {label:'商机/项目', targetField:'Project',
      fields:[
        {source:'name', target:'pro_name', type:'string', required:true, desc:'项目名称'},
        {source:'customerId', target:'client_id', type:'lookup(Client)', required:true, desc:'关联客户ID'},
        {source:'amount', target:'pro_amount', type:'currency', required:false, desc:'项目金额'},
        {source:'stage', target:'pro_step', type:'picklist', required:true, desc:'项目阶段（1-4步）'},
        {source:'status', target:'pro_status', type:'picklist', required:true, desc:'项目状态'},
        {source:'closeDate', target:'pro_expect_date', type:'date', required:false, desc:'预计成交日期'},
        {source:'winProbability', target:'pro_win_rate', type:'percent', required:false, desc:'赢率（系统算法计算）'},
        {source:'source', target:'pro_source', type:'picklist', required:false, desc:'线索来源'},
        {source:'owner', target:'pro_owner_id', type:'lookup(User)', required:false, desc:'负责人ID'},
        {source:'remark', target:'pro_remark', type:'textarea', required:false, desc:'备注/形势分析'},
      ]},
    stageMapping: {label:'商机阶段映射', targetField:'pro_step',
      fields:[
        {source:'1', target:'Step 1 — 初期接触', desc:'初步接触，了解客户背景与需求'},
        {source:'2', target:'Step 2 — 需求确认', desc:'需求分析，关键决策人识别'},
        {source:'3', target:'Step 3 — 方案/谈判', desc:'方案呈现，竞争分析，谈判'},
        {source:'4', target:'Step 4 — 成交/丢单', desc:'赢单或丢单，项目结项'},
      ]},
  },
  renderCrmIntegrationCard(toggleTxt, bodyStyle){
    const selId = App.crmTarget;
    const sel = App.CRM_SYSTEMS.find(s=>s.id===selId);
    let detailHtml = '';
    if(sel){
      // 对接方案
      detailHtml = `
      <div class="crm-integration-detail">
        <div class="crm-alert-tip">
          💡 以下为 ${sel.name} 对接参考方案，包含标准 API 端点、字段映射表和对接建议。
        </div>

        <!-- 认证方式 -->
        <div class="sub-section">
          <div class="sub-section-title">🔐 认证方式</div>
          <div class="crm-info-row">
            <div class="crm-info-item">
              <div class="crm-info-label">认证协议</div>
              <div class="crm-info-val"><span class="badge badge-blue">${sel.auth}</span></div>
            </div>
            <div class="crm-info-item">
              <div class="crm-info-label">API Base URL</div>
              <div class="crm-info-val" style="font-family:monospace;font-size:12px;word-break:break-all">${sel.baseUrl}</div>
            </div>
            <div class="crm-info-item">
              <div class="crm-info-label">所需参数</div>
              <div class="crm-info-val">${sel.auth.includes('OAuth')?'Client ID + Client Secret + Redirect URI':'AppId + AppSecret / API Key'}</div>
            </div>
          </div>
        </div>

        <!-- 核心 API 端点 -->
        <div class="sub-section">
          <div class="sub-section-title">📡 核心 API 端点 ${sel.customApi?'<span style="font-size:12px;color:var(--text-2);font-weight:400">（'+sel.name+' 开放平台）</span>':''}</div>
          <table class="data-table" style="margin:0">
            <thead><tr><th>操作</th><th>方法</th><th>端点路径</th><th>说明</th></tr></thead>
            <tbody>
              ${(sel.customApi ? App.STRATEGY_HUB_API_ENDPOINTS : [
                {op:'获取客户列表', method:'GET', path:'/Account', desc:'分页查询，支持 $filter/$select/$top'},
                {op:'创建客户', method:'POST', path:'/Account', desc:'JSON Body，返回新记录 ID'},
                {op:'更新客户', method:'PATCH', path:'/Account({id})', desc:'部分更新，仅传变更字段'},
                {op:'获取联系人列表', method:'GET', path:'/Contact', desc:'支持关联 Account 查询'},
                {op:'创建联系人', method:'POST', path:'/Contact', desc:'需指定 AccountId 关联'},
                {op:'获取商机列表', method:'GET', path:'/Opportunity', desc:'支持按阶段/状态筛选'},
                {op:'创建商机', method:'POST', path:'/Opportunity', desc:'关联 Account + Contact'},
                {op:'更新商机阶段', method:'PATCH', path:'/Opportunity({id})', desc:'更新 StageName / Probability'},
                {op:'获取用户列表', method:'GET', path:'/User', desc:'用于负责人字段映射'},
                {op:'批量操作', method:'POST', path:'/$batch', desc:'批量创建/更新，提高效率'},
              ]).map(e=>`
                <tr><td>${e.op}</td><td><span class="badge badge-${e.method==='GET'?'green':e.method==='POST'?'blue':'orange'}">${e.method}</span></td><td style="font-family:monospace;font-size:11px">${e.path}</td><td style="font-size:12px;color:var(--text-2)">${e.desc}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 字段映射：客户 -->
        ${App.renderCrmMappingTable('customer', sel.id)}
        <!-- 字段映射：联系人 -->
        ${App.renderCrmMappingTable('contact', sel.id)}
        <!-- 字段映射：商机 -->
        ${App.renderCrmMappingTable('opportunity', sel.id)}
        <!-- 阶段映射 -->
        <div class="sub-section">
          <div class="sub-section-title">🔄 商机阶段映射</div>
          <table class="data-table" style="margin:0">
            <thead><tr><th>本系统阶段</th><th>${sel.name} 阶段</th><th>说明</th></tr></thead>
            <tbody>
              ${((sel.customApi ? App.STRATEGY_HUB_FIELD_MAPPINGS : App.CRM_FIELD_MAPPINGS).stageMapping.fields.map(f=>`
                <tr><td style="font-weight:600">${f.source} — ${DICT.label('opportunityStage', Number(f.source))}</td><td><code>${f.target}</code></td><td>${f.desc}</td></tr>
              `).join(''))}
            </tbody>
          </table>
        </div>

        ${sel.customApi ? `
        <!-- 成交策略中枢独有分析功能 -->
        <div class="sub-section">
          <div class="sub-section-title">🎯 独有分析功能（${sel.name} 核心能力）</div>
          <div class="crm-strategy-grid">
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">📊</div>
              <div class="crm-strategy-content">
                <b>赢率预测算法</b>
                <p>基于 200+ 参数的多维度算法模型，根据不同行业、不同销售场景建立独立模型，动态预测项目赢单概率，远超传统 CRM 的手动概率输入。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">🎯</div>
              <div class="crm-strategy-content">
                <b>决策人画像与角色覆盖</b>
                <p>多维度决策人画像机制（pp.logicAnalyse.pro_an_role），分析客户决策结构、关系图谱，识别关键角色覆盖度，提示未触达的关键决策者。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">📡</div>
              <div class="crm-strategy-content">
                <b>形势雷达图分析</b>
                <p>pp.logicAnalyse.pro_an_situ 接口返回多维度形势雷达图数据，全面、立体、动态地分析项目优劣势、风险点和行动建议。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">🗺️</div>
              <div class="crm-strategy-content">
                <b>策略计划与行动计划</b>
                <p>pp.logicAnalyse.save_plan 保存策略计划，sl.logicAnalyse.visit 自动生成拜访建议，将分析洞察转化为可执行的销售行动。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">🔄</div>
              <div class="crm-strategy-content">
                <b>公海/私海客户流转</b>
                <p>完善的公海（client_international_waters）与私海（client_private）客户管理机制，支持客户分配、领取、退回、转移负责人等操作。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">📅</div>
              <div class="crm-strategy-content">
                <b>协同日程管理</b>
                <p>pp.schedule 系列接口支持协同日程创建、消息通知、同意/拒绝、完成/重新打开等完整日程协作流程。</p>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 对接策略 -->
        <div class="sub-section">
          <div class="sub-section-title">🛠 对接实施建议</div>
          <div class="crm-strategy-grid">
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">1</div>
              <div class="crm-strategy-content">
                <b>数据同步策略</b>
                <p>推荐采用<b>定时轮询 + Webhook 事件驱动</b>混合模式。每 15 分钟全量同步变更记录，同时监听目标 CRM 的 Webhook 实时推送。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">2</div>
              <div class="crm-strategy-content">
                <b>ID 映射管理</b>
                <p>建立 <code>crm_id_mapping</code> 表，存储「本系统 ID ↔ ${sel.name} ID」的双向映射，确保增量同步准确。首次同步前需做全量 ID 匹配。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">3</div>
              <div class="crm-strategy-content">
                <b>冲突解决规则</b>
                <p>建议以<b>最后修改时间（LastModifiedDate）</b>为准：时间戳较新的记录覆盖旧的。关键字段（金额、阶段）设置人工确认流程。</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">4</div>
              <div class="crm-strategy-content">
                <b>错误处理与重试</b>
                <p>API 调用失败时：<br>• 429 限流 → 指数退避重试（1s/2s/4s/8s）<br>• 401/403 → 告警通知重新授权<br>• 5xx → 最多 3 次重试，失败记录死信队列</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">5</div>
              <div class="crm-strategy-content">
                <b>字段清洗与转换</b>
                <p>• 下拉列表值做字典映射（如行业分类）<br>• 金额统一为「分」避免浮点精度丢失<br>• 日期统一为 ISO 8601 格式<br>• 关联字段先查映射表再赋值</p>
              </div>
            </div>
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">6</div>
              <div class="crm-strategy-content">
                <b>实施步骤</b>
                <p>① 获取 API 凭证并测试连通性<br>② 建立字段映射配置表<br>③ 开发数据同步中间件<br>④ 全量初始化同步 + 校验<br>⑤ 开启增量同步 + 监控告警</p>
              </div>
            </div>
            ${sel.customApi ? `
            <div class="crm-strategy-card">
              <div class="crm-strategy-num">7</div>
              <div class="crm-strategy-content">
                <b>赢率分析对接（${sel.name}特色）</b>
                <p>同步商机数据后，调用 <code>pp.logicAnalyse.pro_an_situ</code>（形势雷达）和 <code>pp.logicAnalyse.pro_an_role</code>（角色覆盖）获取 ${sel.name} 独有的算法分析结果，回写本系统的商机健康度评分和赢单概率，增强 AI销冠策略专家的数据底座。</p>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- 对接参数配置 -->
        <div class="sub-section">
          <div class="sub-section-title">⚙️ 对接参数配置</div>
          <div class="form-grid-2">
            <div class="form-row"><label class="form-label">${sel.auth.includes('OAuth')?'Client ID':'AppId'}</label><input class="form-input" id="crmClientId" placeholder="请输入..." type="password"></div>
            <div class="form-row"><label class="form-label">${sel.auth.includes('OAuth')?'Client Secret':'AppSecret'}</label><input class="form-input" id="crmClientSecret" placeholder="请输入..." type="password"></div>
            ${sel.auth.includes('OAuth')?`<div class="form-row"><label class="form-label">Redirect URI</label><input class="form-input" id="crmRedirectUri" placeholder="https://your-domain.com/oauth/callback"></div>`:''}
            <div class="form-row"><label class="form-label">API Base URL</label><input class="form-input" id="crmBaseUrl" value="${sel.baseUrl}"></div>
          </div>
          <div style="margin-top:10px">
            <button class="btn btn-primary btn-sm" onclick="App.testCrmConnection('${sel.id}')">🔗 测试连接</button>
            <button class="btn btn-ghost btn-sm" onclick="App.saveCrmConfig('${sel.id}')">💾 保存配置</button>
            <button class="btn btn-ghost btn-sm" onclick="App.syncCrmData('${sel.id}')">🔄 手动同步</button>
          </div>
        </div>
      </div>`;
    }

    return `
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span>🔗 CRM 系统对接</span>
          <span class="settings-collapse-toggle" onclick="App.toggleCrmIntegration()" id="crmIntegrationToggle" title="点击收起/展开">${toggleTxt}</span>
        </span>
      </div>
      <div id="crmIntegrationBody" class="settings-collapse-body" style="${bodyStyle}">
        <div style="margin-bottom:12px;padding:8px 12px;background:#f0f7ff;border-radius:6px;font-size:13px;color:var(--text-2)">
          💡 选择目标 CRM 系统，查看对接所需的 API 接口、字段映射表和实施方案。支持国内外主流 CRM 平台对接。
        </div>
        <div class="crm-selector">
          ${App.CRM_SYSTEMS.map(c=>`
            <div class="crm-target-card ${selId===c.id?'selected':''}" onclick="App.selectCrmTarget('${c.id}')">
              <div class="crm-target-icon">${c.icon}</div>
              <div class="crm-target-name">${c.name}</div>
              <div class="crm-target-desc">${c.desc}</div>
              <div class="crm-target-auth">认证：${c.auth}</div>
            </div>
          `).join('')}
        </div>
        ${detailHtml}
      </div>
    </div>`;
  },
  selectCrmTarget(id){
    App.crmTarget = App.crmTarget===id ? '' : id;
    App.navigate('settings');
  },
  renderCrmMappingTable(type, targetId){
    const target = App.CRM_SYSTEMS.find(s=>s.id===targetId);
    // 成交策略中枢使用专属字段映射
    const map = (target && target.customApi) ? App.STRATEGY_HUB_FIELD_MAPPINGS[type] : App.CRM_FIELD_MAPPINGS[type];
    if(!map) return '';
    return `
    <div class="sub-section">
      <div class="sub-section-title">📋 字段映射 — ${map.label} → ${map.targetField}</div>
      <table class="data-table" style="margin:0">
        <thead><tr><th>本系统字段</th><th>${target?target.name:'目标系统'} 字段</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
        <tbody>
          ${map.fields.map(f=>`
            <tr>
              <td style="font-weight:600;font-family:monospace;font-size:12px">${f.source}</td>
              <td style="font-family:monospace;font-size:12px;color:var(--primary)">${f.target}</td>
              <td><span class="crm-type-tag">${f.type}</span></td>
              <td>${f.required?'<span class="badge badge-red">必填</span>':'<span class="badge badge-gray">选填</span>'}</td>
              <td style="font-size:12px;color:var(--text-2)">${f.desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  },
  testCrmConnection(crmId){
    const sel = App.CRM_SYSTEMS.find(s=>s.id===crmId);
    if(!sel) return;
    const clientId = document.getElementById('crmClientId')?.value;
    if(!clientId){
      Toast.show(`请先填写 ${sel.auth.includes('OAuth')?'Client ID':'AppId'} 参数`, 'warn');
      return;
    }
    Toast.show(`正在测试 ${sel.name} 连接...`, 'info');
    // 模拟连接测试
    setTimeout(()=>{
      Toast.show(`${sel.name} 连接测试成功 ✓`, 'success');
    }, 1500);
  },
  saveCrmConfig(crmId){
    const config = {
      crmId,
      clientId: document.getElementById('crmClientId')?.value||'',
      clientSecret: document.getElementById('crmClientSecret')?.value||'',
      redirectUri: document.getElementById('crmRedirectUri')?.value||'',
      baseUrl: document.getElementById('crmBaseUrl')?.value||'',
    };
    Store.db.settings.crmConfig = Store.db.settings.crmConfig || {};
    Store.db.settings.crmConfig[crmId] = config;
    Store.save();
    Toast.show('CRM 对接配置已保存', 'success');
  },
  syncCrmData(crmId){
    const config = (Store.db.settings.crmConfig||{})[crmId];
    if(!config?.clientId){
      Toast.show('请先完成对接参数配置', 'warn');
      return;
    }
    Toast.show(`正在从${App.CRM_SYSTEMS.find(s=>s.id===crmId)?.name||crmId}同步数据...`, 'info');
    setTimeout(()=>{
      Toast.show('数据同步完成（演示模式）', 'success');
    }, 2000);
  },

  // ===== 订阅与积分 =====
  renderSubscriptionCard(toggleTxt, bodyStyle){
    const sub = Store.db.settings?.subscription || {};
    const toggleText = toggleTxt || '▼ 收起';
    const bStyle = bodyStyle || '';
    const plan = sub;
    const tokensRemaining = (plan.tokensTotal||0) - (plan.tokensUsed||0);
    const remainingAmount = (plan.prepaidAmount||0) - (plan.consumedAmount||0);
    const daysLeft = plan.endDate ? Math.max(0, Math.ceil((new Date(plan.endDate) - Date.now()) / 86400000)) : 0;
    const planLabels = {free:'免费版',basic:'基础版',professional:'专业版',enterprise:'企业版'};
    const statusLabels = {active:'生效中',expired:'已过期',cancelled:'已取消'};
    const statusCls = plan.status==='active'?'badge-green':plan.status==='expired'?'badge-red':'badge-gray';

    // Token 消耗进度条
    const tokenPct = plan.tokensTotal ? Math.round((plan.tokensUsed||0)/(plan.tokensTotal)*100) : 0;

    // 最近消费记录（最多5条）
    const recentRecords = (plan.consumptionRecords||[]).slice(-5).reverse();

    return `
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span>订阅与积分</span>
          <span class="settings-collapse-toggle" onclick="App.toggleSubscription()" id="subscriptionToggle" title="点击收起/展开">${toggleText}</span>
        </span>
      </div>
      <div id="subscriptionBody" class="settings-collapse-body" style="${bStyle}">
        <!-- 账户套餐信息 -->
        <div class="sub-section">
          <div class="sub-section-title">📦 账户套餐</div>
          <div class="sub-info-grid">
            <div class="sub-info-item">
              <div class="sub-info-label">当前套餐</div>
              <div class="sub-info-value"><span class="badge badge-blue">${planLabels[plan.plan]||plan.planName||'—'}</span></div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">授权状态</div>
              <div class="sub-info-value"><span class="badge ${statusCls}">${statusLabels[plan.status]||plan.status||'—'}</span></div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">开通日期</div>
              <div class="sub-info-value" style="font-weight:600">${Utils.fmtDate(plan.startDate)||'—'}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">到期日期</div>
              <div class="sub-info-value" style="font-weight:600;color:${daysLeft<=30?'var(--danger)':'var(--text-1)'}">${Utils.fmtDate(plan.endDate)||'—'} ${daysLeft>0?`<span style="font-size:12px;color:var(--text-3)">（剩余${daysLeft}天）</span>`:''}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">自动续费</div>
              <div class="sub-info-value">${plan.autoRenew?'<span style="color:var(--success)">✅ 已开启</span>':'<span style="color:var(--text-3)">❌ 未开启</span>'}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">操作</div>
              <div class="sub-info-value">
                <button class="btn btn-ghost btn-sm" onclick="Toast.show('续费功能即将上线，敬请期待','warn')">续费</button>
                <button class="btn btn-ghost btn-sm" onclick="Toast.show('升级套餐功能即将上线','warn')">升级套餐</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Token 消耗统计 -->
        <div class="sub-section">
          <div class="sub-section-title">⚡ Token 消耗统计</div>
          <div class="sub-info-grid">
            <div class="sub-info-item">
              <div class="sub-info-label">Token 总量</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700">${Utils.fmtMoneyPlain(plan.tokensTotal||0)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">已消耗 Token</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700;color:var(--danger)">${Utils.fmtMoneyPlain(plan.tokensUsed||0)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">剩余 Token</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700;color:var(--success)">${Utils.fmtMoneyPlain(tokensRemaining)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">消耗进度</div>
              <div class="sub-info-value">
                <div class="sub-progress-bar">
                  <div class="sub-progress-fill" style="width:${tokenPct}%"></div>
                </div>
                <div style="font-size:12px;color:var(--text-3);margin-top:4px">${tokenPct}%</div>
              </div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">预存金额</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700;color:#c89b2c">¥${Utils.fmtMoneyPlain(plan.prepaidAmount||0)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">已消耗金额</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700;color:var(--danger)">¥${Utils.fmtMoneyPlain(plan.consumedAmount||0)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">剩余金额</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700;color:var(--success)">¥${Utils.fmtMoneyPlain(remainingAmount)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">Token 单价</div>
              <div class="sub-info-value" style="font-size:20px;font-weight:700">¥${(plan.pricePerToken||0).toFixed(4)}/token</div>
            </div>
          </div>
        </div>

        <!-- Token 充值 -->
        <div class="sub-section">
          <div class="sub-section-title">💰 Token 充值</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${[ {tokens:100000,amount:500,label:'10万Token'}, {tokens:200000,amount:980,label:'20万Token',discount:'9.8折'}, {tokens:500000,amount:2250,label:'50万Token',discount:'9折'}, {tokens:1000000,amount:4000,label:'100万Token',discount:'8折'} ].map(p=>`
              <div class="sub-recharge-card" onclick="Toast.show('支付功能即将上线，敬请期待','warn')">
                <div class="sub-recharge-tokens">${p.label}</div>
                <div class="sub-recharge-price">¥${p.amount} ${p.discount?`<span style="font-size:11px;color:var(--danger)">${p.discount}</span>`:''}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px">≈ ¥${(p.amount/p.tokens).toFixed(4)}/token</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:10px;font-size:12px;color:var(--text-3)">💡 充值后将自动增加对应 Token 额度和预存金额，后续对接微信/支付宝支付</div>
        </div>

        <!-- 最近消费记录 -->
        ${recentRecords.length>0?`
        <div class="sub-section">
          <div class="sub-section-title">📋 最近消费记录</div>
          <table class="data-table" style="margin:0">
            <thead><tr><th>日期</th><th>模型</th><th>Token消耗</th><th>费用</th><th>来源</th></tr></thead>
            <tbody>
              ${recentRecords.map(r=>`
                <tr>
                  <td>${Utils.fmtDate(r.date)}</td>
                  <td>${r.model||'—'}</td>
                  <td>${Utils.fmtMoneyPlain(r.tokens)}</td>
                  <td style="color:var(--danger)">¥${(r.cost||0).toFixed(2)}</td>
                  <td><span style="font-size:12px;color:var(--text-2)">${r.source||'—'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`:''}
      </div> <!-- /subscriptionBody -->
    </div>`;
  },

  // ===== 机构信息 折叠/展开 =====
  orgInfoCollapsed: true,
  // 重置所有系统设置卡片的折叠状态为收起（退出登录时调用）
  resetCollapsedStates(){
    App.orgInfoCollapsed = true;
    App.dataOverviewCollapsed = true;
    App.aiModelCollapsed = true;
    App.dictConfigCollapsed = true;
    App.subscriptionCollapsed = true;
    App.crmIntegrationCollapsed = true;
  },
  toggleOrgInfo(){
    App.orgInfoCollapsed = !App.orgInfoCollapsed;
    const body = document.getElementById('orgInfoBody');
    const toggle = document.getElementById('orgInfoToggle');
    if(App.orgInfoCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
      toggle.title = '点击展开';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
      toggle.title = '点击收起';
    }
  },

  // ===== 数据底座概览 折叠/展开 =====
  dataOverviewCollapsed: true,
  toggleDataOverview(){
    App.dataOverviewCollapsed = !App.dataOverviewCollapsed;
    const body = document.getElementById('dataOverviewBody');
    const toggle = document.getElementById('dataOverviewToggle');
    if(App.dataOverviewCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
      toggle.title = '点击展开概览';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
      toggle.title = '点击收起概览';
    }
  },

  // ===== AI 配置区域折叠/展开 =====
  aiModelCollapsed: true,
  toggleAiModelConfig(){
    App.aiModelCollapsed = !App.aiModelCollapsed;
    const body = document.getElementById('aiModelConfigBody');
    const toggle = document.getElementById('aiModelToggle');
    if(App.aiModelCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
      toggle.title = '点击展开配置';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
      toggle.title = '点击收起配置';
    }
  },

  // ===== 数据字典折叠/展开 =====
  dictConfigCollapsed: true,
  toggleDictConfig(){
    App.dictConfigCollapsed = !App.dictConfigCollapsed;
    const body = document.getElementById('dictConfigBody');
    const toggle = document.getElementById('dictConfigToggle');
    if(App.dictConfigCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
    }
  },

  // ===== 订阅与积分 折叠/展开 =====
  subscriptionCollapsed: true,
  toggleSubscription(){
    App.subscriptionCollapsed = !App.subscriptionCollapsed;
    const body = document.getElementById('subscriptionBody');
    const toggle = document.getElementById('subscriptionToggle');
    if(App.subscriptionCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
      toggle.title = '点击展开';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
      toggle.title = '点击收起';
    }
  },

  // ===== CRM 对接 折叠/展开 =====
  crmIntegrationCollapsed: true,
  toggleCrmIntegration(){
    App.crmIntegrationCollapsed = !App.crmIntegrationCollapsed;
    const body = document.getElementById('crmIntegrationBody');
    const toggle = document.getElementById('crmIntegrationToggle');
    if(App.crmIntegrationCollapsed){
      body.style.display = 'none';
      toggle.textContent = '▶ 展开';
      toggle.title = '点击展开';
    } else {
      body.style.display = '';
      toggle.textContent = '▼ 收起';
      toggle.title = '点击收起';
    }
  },

  // ===== AI 大模型配置管理 =====
  getAiModels(){ return Store.db.settings.aiModels||(Store.db.settings.aiModels={enabled:true,defaultId:'deepseek',providers:[]}); },
  getAiModel(id){ return App.getAiModels().providers.find(p=>p.id===id); },
  renderAiModelRow(m, idx){
    const def=App.getAiModels().defaultId===m.id;
    return `<div class="ai-model-card${m.enabled?'':' disabled'}${def?' default':''}" data-idx="${idx}">
      <div class="ai-model-header">
        <span class="ai-model-name">
          ${m.isDefault?'<span class="badge badge-gold" style="font-size:10px">系统默认</span> ':''}
          ${def?'<span class="badge badge-green" style="font-size:10px">当前使用</span> ':''}
          <b>${Utils.esc(m.name)}</b>
        </span>
        <div class="ai-model-actions">
          ${!m.isDefault?`<button class="btn btn-ghost btn-sm" onclick="App.setDefaultAiModel('${m.id}')">${def?'✓ 默认':'设为默认'}</button>`:''}
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
            <input type="checkbox" ${m.enabled?'checked':''} onchange="App.toggleAiModel('${m.id}',this.checked)"> 启用
          </label>
          ${!m.isDefault?`<button class="dict-btn-icon del" onclick="App.removeAiModel('${m.id}')">✕</button>`:''}
        </div>
      </div>
      <div class="ai-model-body">
        <div class="form-grid-3">
          <div class="form-row"><label class="form-label">提供商</label><input class="form-input ai-model-field" data-id="${m.id}" data-field="provider" value="${Utils.esc(m.provider)}" placeholder="如 deepseek/openai/qwen"></div>
          <div class="form-row"><label class="form-label">API 接口地址</label><input class="form-input ai-model-field" data-id="${m.id}" data-field="baseUrl" value="${Utils.esc(m.baseUrl)}" placeholder="https://api.xxx.com/v1"></div>
          <div class="form-row"><label class="form-label">模型名称</label><input class="form-input ai-model-field" data-id="${m.id}" data-field="model" value="${Utils.esc(m.model)}" placeholder="如 deepseek-chat / gpt-4o"></div>
        </div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">API Key ${m.isDefault?'<small style="color:var(--orange)">（仅用于企业自配模型演示；个人版默认走平台代理）</small>':''}</label><input class="form-input ai-model-field" data-id="${m.id}" data-field="apiKey" type="password" value="${Utils.esc(m.apiKey)}" placeholder="输入企业自己的 API Key..."></div>
      </div>
    </div>`;
  },
  addAiModel(){
    const models=App.getAiModels();
    const id='custom_'+Date.now();
    models.providers.push({id,name:'新模型',provider:'custom',apiKey:'',baseUrl:'',model:'',enabled:true,isDefault:false});
    Store.save();
    App.navigate('settings');
  },
  toggleAiModel(id, on){
    const m=App.getAiModel(id); if(m) m.enabled=on;
    Store.save();
  },
  setDefaultAiModel(id){
    const models=App.getAiModels();
    models.defaultId=id;
    Store.save();
    App.navigate('settings');
    Toast.show('已切换默认模型','success');
  },
  removeAiModel(id){
    const models=App.getAiModels();
    const m=App.getAiModel(id);
    if(!m||m.isDefault) return Toast.show('系统默认模型不可删除','warn');
    models.providers=models.providers.filter(p=>p.id!==id);
    if(models.defaultId===id) models.defaultId='deepseek';
    Store.save();
    App.navigate('settings');
    Toast.show('模型已删除','success');
  },
  saveAiModels(){
    const models=App.getAiModels();
    // 从DOM收集编辑后的值
    document.querySelectorAll('.ai-model-field').forEach(el=>{
      const id=el.dataset.id;
      const field=el.dataset.field;
      const m=models.providers.find(p=>p.id===id);
      if(m) m[field]=el.value;
    });
    Store.save();
    if(Store.mode==='api'){
      API.put('/api/enterprises/settings', Store.db.settings).catch(err=>{
        Toast.show('模型配置同步失败: '+err.message, 'error');
      });
    }
    Toast.show('AI模型配置已保存','success');
  },

  // ===== 数据字典编辑器 =====
  openProductDictSettings(){
    Modal.close();
    App.dictConfigCollapsed = false;
    App.navigate('settings');
    setTimeout(()=>{
      const card = document.getElementById('dict-card-products');
      card?.scrollIntoView({ behavior:'smooth', block:'center' });
      card?.classList.add('dict-card-highlight');
      setTimeout(()=>card?.classList.remove('dict-card-highlight'), 1800);
    }, 120);
  },
  renderDictCard(key){
    const meta = DICT.META[key];
    const items = DICT[key];
    let itemsHtml = '';
    if(meta.type === 'simple'){
      items.forEach((val, i)=>{
        itemsHtml += `
          <div class="dict-item" data-dict="${key}" data-idx="${i}">
            <span class="dict-drag">⋮⋮</span>
            <input class="form-input dict-input" value="${Utils.esc(val)}" onchange="App.dictUpdateItem('${key}',${i},this.value)" placeholder="输入选项值">
            <button class="dict-btn-icon" title="上移" onclick="App.dictMoveItem('${key}',${i},-1)">▲</button>
            <button class="dict-btn-icon" title="下移" onclick="App.dictMoveItem('${key}',${i},1)">▼</button>
            <button class="dict-btn-icon del" title="删除" onclick="App.dictRemoveItem('${key}',${i})">✕</button>
          </div>`;
      });
    } else {
      items.forEach((obj, i)=>{
        let fieldsHtml = '';
        meta.fields.forEach(f=>{
          const fv = obj[f.key] !== undefined ? obj[f.key] : '';
          if(f.type === 'select'){
            const opts = f.options.map(o=>`<option value="${o}" ${fv===o?'selected':''}>${o}</option>`).join('');
            fieldsHtml += `<select class="form-input dict-field" onchange="App.dictUpdateField('${key}',${i},'${f.key}',this.value)">${opts}</select>`;
          } else if(f.type === 'color'){
            fieldsHtml += `<input type="color" class="dict-color" value="${fv||'#cbd5e1'}" onchange="App.dictUpdateField('${key}',${i},'${f.key}',this.value)" title="${f.label}">`;
          } else if(f.type === 'number'){
            fieldsHtml += `<input class="form-input dict-field" type="number" value="${fv}" placeholder="${f.label}" onchange="App.dictUpdateField('${key}',${i},'${f.key}',Number(this.value))" style="width:60px">`;
          } else {
            const w = f.key === 'value' ? 'width:80px' : f.key === 'icon' ? 'width:50px' : '';
            fieldsHtml += `<input class="form-input dict-field" value="${Utils.esc(fv)}" placeholder="${f.label}" onchange="App.dictUpdateField('${key}',${i},'${f.key}',this.value)" style="${w}">`;
          }
        });
        itemsHtml += `
          <div class="dict-item" data-dict="${key}" data-idx="${i}">
            <span class="dict-drag">⋮⋮</span>
            ${fieldsHtml}
            <button class="dict-btn-icon" title="上移" onclick="App.dictMoveItem('${key}',${i},-1)">▲</button>
            <button class="dict-btn-icon" title="下移" onclick="App.dictMoveItem('${key}',${i},1)">▼</button>
            <button class="dict-btn-icon del" title="删除" onclick="App.dictRemoveItem('${key}',${i})">✕</button>
          </div>`;
      });
    }
    return `
      <div class="dict-card" id="dict-card-${key}">
        <div class="dict-card-head">
          <span class="dict-card-title">${meta.label}</span>
          <div class="dict-card-actions">
            <button class="btn btn-ghost btn-xs" onclick="App.dictReset('${key}')">恢复默认</button>
            <button class="btn btn-primary btn-xs" onclick="App.dictAddItem('${key}')">+ 添加</button>
          </div>
        </div>
        <div class="dict-card-body">${itemsHtml}</div>
      </div>`;
  },

  dictAddItem(key){
    const meta = DICT.META[key];
    if(meta.type === 'simple'){
      DICT[key].push('新选项');
    } else {
      const newItem = {};
      meta.fields.forEach(f=>{
        if(f.type === 'number') newItem[f.key] = DICT[key].length + 1;
        else if(f.key === 'cls') newItem[f.key] = 'badge-gray';
        else if(f.key === 'color') newItem[f.key] = '#cbd5e1';
        else newItem[f.key] = '';
      });
      DICT[key].push(newItem);
    }
    App.render();
  },

  dictRemoveItem(key, index){
    DICT[key].splice(index, 1);
    App.render();
  },

  dictMoveItem(key, index, dir){
    const arr = DICT[key];
    const newIndex = index + dir;
    if(newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    App.render();
  },

  dictUpdateItem(key, index, value){
    DICT[key][index] = value;
  },

  dictUpdateField(key, index, field, value){
    DICT[key][index][field] = value;
  },

  dictReset(key){
    Modal.confirm('恢复默认', `确定要将「${DICT.META[key].label}」恢复为默认配置吗？`, ()=>{
      DICT.reset(key);
      App.render();
      Toast.show('已恢复默认','success');
    }, '恢复');
  },

  dictResetAll(){
    Modal.confirm('恢复全部默认', '确定要将所有数据字典恢复为默认配置吗？此操作不可撤销。', ()=>{
      DICT.resetAll();
      App.render();
      Toast.show('全部已恢复默认','success');
    }, '全部恢复');
  },

  saveDict(){
    // 收集当前 DICT 可编辑部分，存入 settings.dict
    Store.db.settings.dict = DICT.getCustom();
    Store.save();
    // API 模式下同步到后端
    if(Store.mode === 'api'){
      API.put('/api/enterprises/settings', Store.db.settings).catch(err=>{
        Toast.show('字典同步失败: '+err.message, 'error');
      });
    }
    Toast.show('数据字典已保存','success');
  }
};

// 启动
document.addEventListener('DOMContentLoaded', App.init);
