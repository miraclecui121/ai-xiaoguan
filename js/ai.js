/* ========== AI销冠助手 - 基于数据底座的智能分析引擎 ========== */
const AI = {
  messages: [],
  lastLLMError: null,
  lastSearchEvidence: null,
  autoSearch: true,

  // ===== @提及与上下文选择系统 =====
  // 上下文状态：用户通过@提及选择的客户/商机/专家
  ctx: { customers:[], opportunities:[], experts:[] },
  // @提及弹窗状态
  mention: { open:false, tab:'customer', query:'' },

  // 折叠状态：true=折叠，false=展开（默认折叠，用户手动展开）
  collapsed: { experts: true, suggestions: true },

  // type → ctx数组键名映射（opportunity→opportunities，其余直接+s）
  _ctxKey(type){ return type==='opportunity'?'opportunities':type+'s'; },

  // 添加上下文项（直接DOM操作，不触发全页重渲染）
  addCtx(type, id, name, extra){
    const key=AI._ctxKey(type);  // customers/opportunities/experts
    const arr=AI.ctx[key];
    if(!arr||!Array.isArray(arr)){console.error('[addCtx] AI.ctx.'+key+' 不存在或非数组');return;}
    if(arr.find(x=>x.id===id))return;  // 去重
    arr.push({id, name, ...(extra||{})});
    AI.mention.open=false;
    AI.mention.query='';
    // 关闭弹窗
    AI.hideMentionPopup();
    // 更新chips栏
    AI.updateCtxChips();
    // 更新专家提示词面板
    AI.updateExpertPrompt();
    // 如果添加的是专家，更新专家卡片状态
    if(type==='expert') AI.updateExpertCards();
    // 焦点回到输入框
    const inp=document.getElementById('aiInput');
    if(inp)inp.focus();
  },

  // 移除上下文项（直接DOM操作）
  removeCtx(type, id){
    const key=AI._ctxKey(type);
    AI.ctx[key]=AI.ctx[key].filter(x=>x.id!==id);
    AI.updateCtxChips();
    AI.updateExpertPrompt();
    if(type==='expert') AI.updateExpertCards();
    const inp=document.getElementById('aiInput');
    if(inp)inp.focus();
  },

  // 清空所有上下文（直接DOM操作）
  clearCtx(){
    AI.ctx={customers:[], opportunities:[], experts:[]};
    AI.updateCtxChips();
    AI.updateExpertPrompt();
    AI.updateExpertCards();
    const inp=document.getElementById('aiInput');
    if(inp)inp.focus();
  },

  conversationStorageKey(){
    if(typeof Store==='undefined' || !Store.session?.enterpriseId || !Store.session?.userId) return '';
    return `aixg_ai_conversation:${Store.session.enterpriseId}:${Store.session.userId}`;
  },

  canPersistConversation(){
    return typeof Store!=='undefined' && Store.isPersonalWorkspace && Store.isPersonalWorkspace();
  },

  ensureConversationLoaded(){
    const key = AI.conversationStorageKey();
    if(AI._loadedConversationKey === key) return;
    AI._loadedConversationKey = key;
    AI.ctx = {customers:[], opportunities:[], experts:[]};
    AI.mention = { open:false, tab:'customer', query:'' };
    AI.lastLLMError = null;
    AI.lastSearchEvidence = null;
    AI.messages = [];
    if(!key || !AI.canPersistConversation()) return;
    try{
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      const items = Array.isArray(saved?.messages) ? saved.messages : [];
      AI.messages = items
        .filter(m=>['user','bot'].includes(m?.role) && String(m.content||'').trim())
        .slice(-60)
        .map(m=>({ role:m.role, content:String(m.content||'').slice(0,6000) }));
    }catch(e){
      AI.messages = [];
    }
  },

  saveConversation(){
    const key = AI.conversationStorageKey();
    if(!key || !AI.canPersistConversation()) return;
    const messages = AI.messages
      .filter(m=>!m.loading && ['user','bot'].includes(m.role) && String(m.content||'').trim())
      .slice(-60)
      .map(m=>({ role:m.role, content:String(m.content||'').slice(0,6000) }));
    try{
      localStorage.setItem(key, JSON.stringify({ updatedAt:Utils.now(), messages }));
    }catch(e){}
  },

  clearRuntimeState(){
    AI.messages = [];
    AI.ctx = {customers:[], opportunities:[], experts:[]};
    AI.mention = { open:false, tab:'customer', query:'' };
    AI.lastLLMError = null;
    AI.lastSearchEvidence = null;
    AI._loadedConversationKey = '';
  },

  // 打开@提及弹窗（直接DOM操作，不调用App.render）
  openMention(tab){
    console.log('[mentionOpen] 打开弹窗, tab=',tab);
    AI.mention.open=true;
    AI.mention.tab=tab||'customer';
    AI.mention.query='';
    AI.showMentionPopup();
    // 渲染列表
    AI.renderMentionList();
    // 聚焦搜索框
    const s=document.getElementById('mentionSearch');
    if(s){
      s.value='';
      s.placeholder='搜索'+({customer:'客户',opportunity:'商机',expert:'专家'})[AI.mention.tab]+'名称…';
      setTimeout(()=>s.focus(),0);
    }
  },

  // 关闭@提及弹窗（直接DOM操作）
  closeMention(){
    AI.mention.open=false;
    AI.mention.query='';
    AI.hideMentionPopup();
    const inp=document.getElementById('aiInput');
    if(inp)inp.focus();
  },

  // 切换提及Tab（直接DOM操作）
  switchMentionTab(tab){
    console.log('[mentionTab] 切换到:',tab);
    AI.mention.tab=tab;
    AI.mention.query='';
    // 更新Tab高亮
    document.querySelectorAll('.mention-tab').forEach(t=>{
      t.classList.toggle('active', t.dataset.tab===tab);
    });
    // 清空搜索框并更新placeholder
    const s=document.getElementById('mentionSearch');
    if(s){
      s.value='';
      s.placeholder='搜索'+({customer:'客户',opportunity:'商机',expert:'专家'})[tab]+'名称…';
    }
    // 重新渲染列表
    AI.renderMentionList();
    // 聚焦搜索框（放在renderMentionList之后，避免focus触发重入）
    if(s)s.focus();
  },

  // 显示提及弹窗
  showMentionPopup(){
    const overlay=document.getElementById('mentionOverlay');
    const popup=document.getElementById('mentionPopup');
    if(overlay){overlay.style.display='block';}
    if(popup){
      popup.style.display='block';
      // 强制reflow，确保slideUp动画重新触发
      void popup.offsetHeight;
      // 更新Tab高亮
      document.querySelectorAll('.mention-tab').forEach(t=>{
        t.classList.toggle('active', t.dataset.tab===AI.mention.tab);
      });
    }
  },

  // 隐藏提及弹窗
  hideMentionPopup(){
    const overlay=document.getElementById('mentionOverlay');
    const popup=document.getElementById('mentionPopup');
    if(overlay)overlay.style.display='none';
    if(popup)popup.style.display='none';
  },

  // 更新上下文chips栏（直接DOM操作）
  updateCtxChips(){
    const bar=document.getElementById('ctxChipsBar');
    if(!bar)return;
    const html=AI.renderCtxChips();
    bar.innerHTML=html;
    bar.style.display=html?'flex':'none';
  },

  // 更新专家提示词面板（直接DOM操作）
  updateExpertPrompt(){
    const panel=document.getElementById('expertPromptPanel');
    if(panel) panel.innerHTML=AI.renderExpertPrompt();
  },

  // 更新专家卡片选中状态（直接DOM操作）
  updateExpertCards(){
    document.querySelectorAll('.expert-card').forEach(card=>{
      const id=card.dataset.expertId;
      const ex=Experts.get(id);
      if(!ex)return;
      const isActive=AI.ctx.experts.find(x=>x.id===id);
      if(isActive){
        card.classList.add('active');
        card.style.borderColor=ex.color;
        card.style.boxShadow='0 0 0 2px '+ex.color+'33';
      }else{
        card.classList.remove('active');
        card.style.borderColor='';
        card.style.boxShadow='';
      }
    });
  },

  // 提及搜索
  mentionSearch(q){
    AI.mention.query=q;
    AI.renderMentionList();
  },

  // 渲染提及列表内容
  renderMentionList(){
    const box=document.getElementById('mentionList');
    if(!box){
      console.warn('[mentionList] mentionList元素不存在');
      return;
    }
    try{
      const tab=AI.mention.tab;
      const q=(AI.mention.query||'').toLowerCase();
      let items=[];
      if(tab==='customer'){
        const list=Store.myCustomers()||[];
        items=list.map(c=>({
          id:c.id, name:c.name||'未命名', sub:(c.industry||'')+' · '+(c.level||'')+'级 · '+(c.shortName||c.name||''),
          icon:'🏢', color:'#1a3a6b', type:'customer'
        }));
        console.log('[mentionList] 客户Tab: '+items.length+'条');
      }else if(tab==='opportunity'){
        // 显示所有非关闭/非丢单的商机（放宽条件，避免数据状态问题导致列表为空）
        const list=Store.opportunities()||[];
        items=list.filter(o=>o.status!=='closed').map(o=>{
          const c=Store.customer(o.customerId);
          const stageLabel=DICT.label?('阶段'+DICT.label('opportunityStage',o.stage)):'';
          const statusLabel=DICT.label?DICT.label('opportunityStatus',o.status):o.status;
          return {id:o.id, name:o.name||'未命名商机',
            sub:(c?c.shortName:'无客户')+' · '+Utils.fmtMoney(o.amount)+' · '+statusLabel,
            icon:'🎯', color:'#dc2626', type:'opportunity'};
        });
        console.log('[mentionList] 商机Tab: '+items.length+'条 (总商机'+list.length+'个)');
      }else{
        // 专家Tab
        const elist=Experts.list||[];
        items=elist.map(e=>({
          id:e.id, name:e.name+'专家', sub:e.desc||'', icon:e.icon||'策', color:e.color||'#1a3a6b', type:'expert',
          extra:{icon:e.icon,color:e.color,ctxType:e.ctxType}
        }));
        console.log('[mentionList] 专家Tab: '+items.length+'条');
      }
      // 搜索过滤
      if(q){
        items=items.filter(x=>(x.name||'').toLowerCase().includes(q)||(x.sub||'').toLowerCase().includes(q));
      }
      if(!items.length){
        box.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-3);font-size:13px">未找到匹配项</div>';
        return;
      }
      // 确保AI.ctx存在
      if(!AI.ctx)AI.ctx={customers:[],opportunities:[],experts:[]};
      if(!AI.ctx.customers)AI.ctx.customers=[];
      if(!AI.ctx.opportunities)AI.ctx.opportunities=[];
      if(!AI.ctx.experts)AI.ctx.experts=[];
      box.innerHTML=items.map(x=>{
        const safeName=Utils.esc(x.name).replace(/'/g,'&#39;');
        const extraStr=x.extra?JSON.stringify(x.extra).replace(/"/g,'&quot;'):'null';
        const ctxArr=AI.ctx[AI._ctxKey(x.type)]||[];
        const selected=ctxArr.find(c=>c.id===x.id);
        return `
        <div class="mention-item" onclick="AI.addCtx('${x.type}','${x.id}','${safeName}',${extraStr})">
          <div class="mention-item-icon" style="background:${x.color}15;color:${x.color}">${x.icon}</div>
          <div class="mention-item-body">
            <div class="mention-item-name">${Utils.esc(x.name)}</div>
            <div class="mention-item-sub">${Utils.esc(x.sub)}</div>
          </div>
          ${selected?'<span style="color:var(--green);font-size:16px">✓</span>':'<span style="color:var(--text-3);font-size:16px">+</span>'}
        </div>`;
      }).join('');
    }catch(e){
      console.error('[mentionList] 渲染失败:',e);
      box.innerHTML='<div style="text-align:center;padding:20px;color:#dc2626;font-size:13px">⚠️ 列表加载失败: '+Utils.esc(e.message)+'</div>';
    }
  },

  // 渲染上下文chips内容（不含外层容器，由updateCtxChips控制显隐）
  renderCtxChips(){
    const all=[
      ...AI.ctx.customers.map(c=>({...c,type:'customer',color:'#1a3a6b'})),
      ...AI.ctx.opportunities.map(o=>({...o,type:'opportunity',color:'#dc2626'})),
      ...AI.ctx.experts.map(e=>({...e,type:'expert',color:e.color||'#1a3a6b'})),
    ];
    if(!all.length) return '';
    let html='';
    // 上下文chips
    all.forEach(item=>{
      html+=`<span class="ctx-chip" style="border-color:${item.color}55;background:${item.color}10">
        <span class="ctx-chip-name">${Utils.esc(item.name)}</span>
        <span class="ctx-chip-x" onclick="AI.removeCtx('${item.type}','${item.id}')">✕</span>
      </span>`;
    });
    // 清空按钮
    if(all.length>=2){
      html+=`<span class="ctx-chip-clear" onclick="AI.clearCtx()">清空</span>`;
    }
    return html;
  },

  // 渲染专家信息卡片（仅展示专家概要，不暴露提示词内容）
  renderExpertPrompt(){
    if(!AI.ctx.experts.length)return '';
    const ex=Experts.get(AI.ctx.experts[0].id);
    if(!ex)return '';
    return `
    <div class="expert-prompt-box" id="expertPromptBox">
      <div class="expert-prompt-header" style="background:linear-gradient(135deg,${ex.color},${ex.color}dd)">
        <span>${ex.name}专家 · 智能分析引擎已就绪</span>
      </div>
      <div class="expert-prompt-body" style="display:block;font-size:12.5px;line-height:1.7">
        <div style="padding:10px 14px;color:var(--text-2)">${Utils.esc(ex.desc||'')}</div>
      </div>
    </div>`;
  },

  // 渲染@提及弹窗（始终在DOM中，通过display控制显隐，避免全页重渲染）
  renderMentionPopup(){
    const tabs=[
      {id:'customer',label:'客户',icon:'客'},
      {id:'opportunity',label:'商机',icon:'机'},
      {id:'expert',label:'专家',icon:'策'},
    ];
    const display=AI.mention.open?'block':'none';
    const ph='搜索'+({customer:'客户',opportunity:'商机',expert:'专家'})[AI.mention.tab]+'名称…';
    return `
    <div id="mentionOverlay" class="mention-overlay" style="display:${display}" onclick="AI.closeMention()"></div>
    <div id="mentionPopup" class="mention-popup" style="display:${display}">
      <div class="mention-tabs">
        ${tabs.map(t=>`<div class="mention-tab${AI.mention.tab===t.id?' active':''}" data-tab="${t.id}" onclick="AI.switchMentionTab('${t.id}')">${t.icon} ${t.label}</div>`).join('')}
        <span class="mention-close" onclick="AI.closeMention()">✕</span>
      </div>
      <div class="mention-search-wrap">
        <input id="mentionSearch" class="mention-search" placeholder="${ph}" oninput="AI.mentionSearch(this.value)" onkeydown="if(event.key==='Escape')AI.closeMention()">
      </div>
      <div class="mention-list" id="mentionList"></div>
      <div class="mention-hint">选择后可继续输入问题，系统会基于已选对象和分析口径回答</div>
    </div>`;
  },

  render(){
    AI.ensureConversationLoaded();
    // 初始化欢迎语
    if(!AI.messages.length){
      AI.messages.push({role:'bot', content:AI.welcome()});
    }
    // 渲染后初始化消息列表和提及弹窗
    setTimeout(()=>{
      AI.renderMessages();
      // 如果弹窗处于打开状态，渲染列表
      if(AI.mention.open) AI.renderMentionList();
    },0);
    const hasChips=AI.ctx.customers.length||AI.ctx.opportunities.length||AI.ctx.experts.length;
    return `
    <div class="page-head">
      <div><div class="page-title ai-page-title"><span class="page-mark">冠</span><span class="ai-page-title-text">AI销冠助手</span> <span class="badge badge-gold">销售决策引擎</span> ${AI.renderLLMStatusBadge()}</div>
      <div class="page-desc">围绕客户、联系人、商机数据生成销售判断，并把判断落到下一步动作</div></div>
    </div>
    <!-- 销售决策能力面板 -->
    <div class="expert-panel${AI.collapsed.experts?' collapsed':''}">
      <div class="expert-panel-header" onclick="AI.togglePanel('experts')">
        <div class="expert-panel-title">能力视角 · 点击选择分析口径，或在输入框 @ 引用客户 / 商机 / 专家</div>
        <div class="expert-panel-toggle">${AI.collapsed.experts?'▶ 展开':'▼ 收起'}</div>
      </div>
      <div class="expert-cards">${Experts.list.map(e=>`
        <div class="expert-card${AI.ctx.experts.find(x=>x.id===e.id)?' active':''}" data-expert-id="${e.id}" style="${AI.ctx.experts.find(x=>x.id===e.id)?'border-color:'+e.color+';box-shadow:0 0 0 2px '+e.color+'33':''}" onclick="AI.toggleExpert('${e.id}')">
          <div class="expert-card-icon" style="background:${e.color}15;color:${e.color}">${e.icon}</div>
          <div class="expert-card-body">
            <div class="expert-card-name">${e.name}</div>
            <div class="expert-card-desc">${e.desc}</div>
          </div>
        </div>`).join('')}</div>
    </div>
    <div class="ai-layout">
      <div class="ai-chat">
        <div class="ai-msgs" id="aiMsgs"></div>
        <div class="ai-suggestions${AI.collapsed.suggestions?' collapsed':''}" id="aiSuggestions">
          <div class="ai-suggestions-header" onclick="AI.togglePanel('suggestions')">
            <span class="ai-suggestions-label">⚡ 快捷入口</span>
            <span class="ai-suggestions-toggle">${AI.collapsed.suggestions?'▶ 展开':'▼ 收起'}</span>
          </div>
          <div class="ai-suggestions-body">${AI.suggestionChips()}</div>
        </div>
        <div id="ctxChipsBar" class="ctx-chips-bar" style="display:${hasChips?'flex':'none'}">${AI.renderCtxChips()}</div>
        <div id="expertPromptPanel">${AI.renderExpertPrompt()}</div>
        ${AI.renderMentionPopup()}
        <div class="ai-input-bar">
          <button class="ai-mention-btn" onclick="AI.openMention('customer')" title="＠提及客户/商机/专家">＠</button>
          <button class="ai-search-toggle${AI.autoSearch?' active':''}" onclick="AI.toggleAutoSearch()" title="自动联网：只在客户近况、行业政策、招投标、竞品等外部事实问题中启用">联网</button>
          <textarea id="aiInput" rows="1" placeholder="输入问题，或点击＠引用客户/商机/专家…" onkeydown="AI.handleInputKeydown(event)" oninput="AI.autoResizeInput(this)" autofocus></textarea>
          <button class="btn btn-primary" onclick="AI.send()">发送</button>
        </div>
      </div>
      <div class="ai-side" id="aiSide">
        ${AI.renderInsights()}
      </div>
    </div>
    `;
  },

  toggleAutoSearch(){
    AI.autoSearch = !AI.autoSearch;
    const btn = document.querySelector('.ai-search-toggle');
    if(btn) btn.classList.toggle('active', AI.autoSearch);
    Toast.show(AI.autoSearch ? '已开启自动联网增强' : '已关闭自动联网增强', 'info');
    const input=document.getElementById('aiInput');
    if(input) input.focus();
  },

  // 输入框按键处理
  handleInputKeydown(event){
    if(event.isComposing) return;
    if(event.key==='Enter' && !event.shiftKey){
      event.preventDefault();
      AI.send();
    }else if(event.key==='@'){
      // 阻止@字符插入输入框，直接打开提及弹窗
      event.preventDefault();
      AI.openMention(AI.ctx.experts.length?'opportunity':'customer');
    }
  },

  // 输入框内容变化（预留扩展，不再检测@）
  handleInputChange(val){
    // @检测已移至handleInputKeydown的preventDefault处理
  },

  autoResizeInput(el){
    if(!el) return;
    el.style.height='auto';
    const max=128;
    const next=Math.min(max, Math.max(44, el.scrollHeight));
    el.style.height=next+'px';
    el.style.overflowY=el.scrollHeight>max?'auto':'hidden';
  },

  // 切换专家选中状态（点击专家卡片 → 立即运行专家分析）
  toggleExpert(id){
    const existing=AI.ctx.experts.find(x=>x.id===id);
    if(existing){
      // 已选中 → 取消选中
      AI.ctx.experts=AI.ctx.experts.filter(x=>x.id!==id);
      AI.updateExpertCards();
      AI.updateCtxChips();
      AI.updateExpertPrompt();
      const inp=document.getElementById('aiInput');
      if(inp)inp.focus();
    }else{
      // 未选中 → 替换已有专家，立即运行
      AI.ctx.experts=[];
      const ex=Experts.get(id);
      if(!ex)return;
      AI.ctx.experts.push({id, name:ex.name+'专家', icon:ex.icon, color:ex.color});
      AI.updateExpertCards();
      AI.updateCtxChips();
      AI.updateExpertPrompt();
      const inp=document.getElementById('aiInput');
      if(inp)inp.value='';
      // 立即发送：有具体对象时跑对象级报告；无对象时跑专家通用方法论对话
      AI.send();
    }
  },

  // 切换面板折叠/展开状态（直接DOM操作，不触发全页重渲染）
  togglePanel(name){
    AI.collapsed[name] = !AI.collapsed[name];
    const sel = name==='experts' ? '.expert-panel' : '.ai-suggestions';
    const panel = document.querySelector(sel);
    const toggle = panel.querySelector(name==='experts' ? '.expert-panel-toggle' : '.ai-suggestions-toggle');
    if(AI.collapsed[name]){
      panel.classList.add('collapsed');
      toggle.textContent = '▶ 展开';
    } else {
      panel.classList.remove('collapsed');
      toggle.textContent = '▼ 收起';
    }
  },

  // 快速运行专家（从建议chip触发，保留已选客户/商机）
  quickExpert(expertId){
    AI.ctx.experts=[];
    const ex=Experts.get(expertId);
    if(!ex)return;
    AI.ctx.experts.push({id:expertId, name:ex.name+'专家', icon:ex.icon, color:ex.color});
    AI.updateExpertCards();
    AI.updateCtxChips();
    AI.updateExpertPrompt();
    const inp=document.getElementById('aiInput');
    if(inp)inp.value='';
    AI.send();
  },

  welcome(){
    const llmReady = AI.isLLMReady();
    const llmHint = llmReady
      ? `<span class="ai-state-dot ok"></span>大模型已连接，支持围绕客户、商机和专家角色连续追问。`
      : `<span class="ai-state-dot warn"></span>未配置大模型 API。当前可体验演示报告；真实多轮对话需要先到 <a href="#" onclick="App.navigate('settings');return false">系统设置</a> 配置模型。`;
    return `::ai-html
<div class="ai-welcome">
  <div class="ai-welcome-hero">
    <div>
      <div class="ai-kicker">AI销冠工作台</div>
      <h3>把客户数据转成下一步销售动作</h3>
      <p>当前数据底座包含 ${Store.customers().length} 个客户、${Store.contacts().length} 个联系人、${Store.opportunities().length} 个商机。你可以直接提问，也可以先引用客户/商机，再选择一个专业视角分析。</p>
    </div>
    <div class="ai-hero-status">${llmHint}</div>
  </div>
  ${AI.renderCapabilityGrid()}
  <div class="ai-workflow-strip">
    <div><b>1</b><span>引用对象</span><small>选择客户、联系人或商机</small></div>
    <div><b>2</b><span>选择视角</span><small>用专业能力卡确定分析口径</small></div>
    <div><b>3</b><span>提出问题</span><small>围绕本次销售动作连续追问</small></div>
  </div>
</div>`;
  },

  renderCapabilityGrid(){
    const groups=[
      {title:'选市场', items:['industry-assess','industry-insight'], note:'判断行业是否值得投入，以及该从什么变化切入客户。'},
      {title:'看客户', items:['customer-insight','lead-dev','sales-visit'], note:'拆客户场景、线索入口和拜访前后的关键动作。'},
      {title:'推项目', items:['solution','value-marketing','win-strategy'], note:'把需求转成方案、价值和赢单推进策略。'},
      {title:'做经营', items:['customer-mgmt','sop-design'], note:'沉淀长期账户经营节奏和可复制的过程标准。'},
    ];
    return `<div class="ai-capability-grid">${groups.map(g=>`
      <section class="ai-capability-group">
        <div class="ai-capability-title">${g.title}</div>
        <p>${g.note}</p>
        <div class="ai-capability-list">
          ${g.items.map(id=>{
            const ex=Experts.get(id);
            return `<button class="ai-capability-item" onclick="AI.quickExpert('${id}')">
              <span style="--c:${ex.color}">${ex.icon}</span>
              <em>${ex.name}</em>
            </button>`;
          }).join('')}
        </div>
      </section>`).join('')}</div>`;
  },

  suggestionChips(){
    const mentionChips=[
      {label:'＠ 客户', type:'customer'},
      {label:'＠ 商机', type:'opportunity'},
      {label:'＠ 专家', type:'expert'},
    ];
    const expertChips=[
      {label:'客户洞察', id:'customer-insight'},
      {label:'行业评估', id:'industry-assess'},
      {label:'行业洞察', id:'industry-insight'},
      {label:'线索开发', id:'lead-dev'},
      {label:'客户拜访', id:'sales-visit'},
      {label:'解决方案', id:'solution'},
      {label:'价值营销', id:'value-marketing'},
      {label:'赢单策略', id:'win-strategy'},
      {label:'客户经营', id:'customer-mgmt'},
      {label:'销售SOP', id:'sop-design'},
    ];
    const analysisChips=['商机概览','重点关注商机','🩺 商机健康度','📈 趋势分析','🔻 漏斗深度分析','📊 赢输归因分析','⚡ 销售效能分析','🚨 预警分析','赢单预测','沉睡客户','下一步行动'];
    let html='';
    mentionChips.forEach(c=>{
      html+=`<span class="ai-chip ai-chip-mention" onclick="AI.openMention('${c.type}')">${c.label}</span>`;
    });
    expertChips.forEach(c=>{
      html+=`<span class="ai-chip ai-chip-expert" onclick="AI.quickExpert('${c.id}')">${c.label}</span>`;
    });
    analysisChips.forEach(c=>{
      html+=`<span class="ai-chip" onclick="AI.quickAsk('${c}')">${c}</span>`;
    });
    return html;
  },

  renderInsights(){
    const stats=Store.stats();
    const openOpps=Store.opportunities().filter(o=>o.status==='open');
    const atRisk=openOpps.filter(o=>o.competition==='behind'||(o.winProbability||0)<40).length;
    const sleepCustomers=Store.myCustomers().filter(c=>{
      const last=Store.lastFollowup(f=>f.customerId===c.id);
      return !last||Utils.daysSince(last.at)>14;
    }).length;
    return `
    <div class="ai-insight">
      <h4>📊 赢单概览</h4>
      <div style="font-size:13px;line-height:2">
        进行中商机：<b>${openOpps.length}</b> 个<br>
        预测赢单金额：<b style="color:var(--green)">${Utils.fmtMoney(stats.weightedAmount)}</b><br>
        整体赢单率：<b>${stats.winRate}%</b><br>
        已赢单金额：<b>${Utils.fmtMoney(stats.wonAmount)}</b>
      </div>
    </div>
    <div class="ai-insight">
      <h4>⚠️ 风险预警</h4>
      <div style="font-size:13px;line-height:2">
        <span class="badge badge-red">${atRisk}</span> 个商机竞争落后/赢单率低<br>
        <span class="badge badge-orange">${sleepCustomers}</span> 个客户超14天未跟进<br>
        <span class="badge badge-orange">${Store.schedules().filter(s=>!s.done&&new Date(s.startAt)<new Date()).length}</span> 个日程已逾期<br>
        <a style="color:var(--primary);cursor:pointer;font-size:12px;text-decoration:underline" onclick="App.navigate('alerts')">查看预警中心 →</a>
      </div>
    </div>
    <div class="ai-insight">
      <h4>🎯 赢单概率分布</h4>
      ${[ [80,100,'高','green'],[50,79,'中','orange'],[0,49,'低','red'] ].map(([lo,hi,label,cls])=>{
        const cnt=openOpps.filter(o=>(o.winProbability||0)>=lo&&(o.winProbability||0)<=hi).length;
        const pct=openOpps.length?Math.round(cnt/openOpps.length*100):0;
        return `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${label}概率(${cnt})</span><span>${pct}%</span></div><div class="ai-meter"><span style="width:${pct}%;background:var(--${cls})"></span></div></div>`;
      }).join('')}
    </div>
    <div class="ai-insight">
      <h4>💡 AI建议</h4>
      <div style="font-size:12.5px;line-height:1.8;color:var(--text-2)">
        ${AI.generateTips().map(t=>`• ${t}`).join('<br>')}
      </div>
    </div>`;
  },

  generateTips(){
    const tips=[];
    const openOpps=Store.opportunities().filter(o=>o.status==='open');
    // 落后商机
    const behind=openOpps.find(o=>o.competition==='behind');
    if(behind)tips.push(`商机「${behind.name}」竞争落后，建议尽快制定差异化策略`);
    // 平手商机
    const even=openOpps.find(o=>o.competition==='even');
    if(even)tips.push(`商机「${even.name}」竞争平手，需强化优势建立领先`);
    // 高金额商务阶段
    const biz=openOpps.filter(o=>o.stage===3).sort((a,b)=>b.amount-a.amount)[0];
    if(biz)tips.push(`「${biz.name}」处于商务阶段，金额${Utils.fmtMoney(biz.amount)}，建议重点推进签约`);
    // 沉睡客户
    const sleep=Store.myCustomers().find(c=>{const l=Store.lastFollowup(f=>f.customerId===c.id);return !l||Utils.daysSince(l.at)>14;});
    if(sleep)tips.push(`客户「${sleep.name}」超14天未跟进，建议尽快联系`);
    // 待办日程
    const overdueSch=Store.schedules().filter(s=>!s.done&&new Date(s.startAt)<new Date());
    if(overdueSch.length)tips.push(`有 ${overdueSch.length} 个日程已逾期，建议尽快处理或重新安排`);
    if(!tips.length)tips.push('当前数据底座健康，继续保持跟进节奏');
    return tips.slice(0,5);
  },

  quickAsk(q){
    const input=document.getElementById('aiInput');
    if(input){
      input.value=q;
      AI.autoResizeInput(input);
    }
    AI.send();
  },

  detectExpertIntent(q){
    if(!q) return null;
    if(/(今天|明天|后天|本周|下周|周[一二三四五六日天]|上午|下午|晚上).{0,16}(见|拜访|约见|会面|面谈|沟通|聊)/.test(q)) return 'sales-visit';
    if(/(要|去|准备|打算|计划|约了|约好).{0,12}(见|拜访|约见|会面|面谈|沟通|聊)/.test(q)) return 'sales-visit';
    if(/(见|拜访|约见|会面|面谈|沟通).{0,12}(客户|企业|公司|集团|总|经理|主任|负责人)/.test(q)) return 'sales-visit';
    return null;
  },

  pushLoading({expertId=null, question='', mode=''}={}){
    AI.messages.push({
      role:'bot',
      content:'',
      loading:true,
      expertId,
      question:String(question||''),
      mode,
      loadingAt:Date.now(),
    });
    AI.renderMessages();
  },

  loadingSteps(m){
    const ex = m.expertId ? Experts.get(m.expertId) : null;
    const q = String(m.question || '');
    const needSearch = AI.shouldUseSearch(q, { expertId:m.expertId || '' });
    const steps = [
      { title:'识别问题意图', desc: ex ? `已匹配到「${ex.name}」分析视角` : '判断问题属于客户、商机、行业还是通用销售动作' },
      { title:'读取可用上下文', desc: '整理已选客户、商机、历史追问和系统数据底座' },
      needSearch
        ? { title:'补充公开信息', desc:'判断需要联网，准备检索客户近况、政策、招投标或竞品线索' }
        : { title:'判断信息边界', desc:'当前优先使用 CRM 数据和销售方法论，不额外检索网页' },
      { title: ex ? `调用${ex.name}视角` : '调用平台模型', desc: ex ? (ex.loadingMsg || '按该视角组织判断顺序') : '生成结构化判断，不输出固定模板' },
      { title:'沉淀行动路径', desc:'把判断收敛为风险、机会、下一步动作和验证方式' },
    ];
    return steps;
  },

  syncLoadingTicker(){
    const hasLoading = AI.messages.some(m=>m.loading);
    if(hasLoading && !AI._loadingTicker){
      AI._loadingTicker = setInterval(()=>{
        if(AI.messages.some(m=>m.loading)) AI.renderMessages();
        else AI.syncLoadingTicker();
      }, 1100);
    }
    if(!hasLoading && AI._loadingTicker){
      clearInterval(AI._loadingTicker);
      AI._loadingTicker = null;
    }
  },

  send(){
    const input=document.getElementById('aiInput');
    if(!input)return; // DOM尚未就绪
    const q=input.value.trim().replace(/@$/,'');
    if(!q && !AI.ctx.customers.length && !AI.ctx.opportunities.length && !AI.ctx.experts.length)return;

    // 构建带上下文的用户消息显示
    const ctxTags=[
      ...AI.ctx.experts.map(e=>`${e.name}`),
      ...AI.ctx.customers.map(c=>`${c.name}`),
      ...AI.ctx.opportunities.map(o=>`${o.name}`),
    ];
    const displayQ=ctxTags.length?`${ctxTags.join('  ')}${q?'  |  '+q:''}`:q;
    AI.messages.push({role:'user',content:displayQ});
    input.value='';
    AI.autoResizeInput(input);
    AI.renderMessages();

    // ===== 上下文驱动路由 =====
    const hasExpert=AI.ctx.experts.length>0;
    const hasCustomer=AI.ctx.customers.length>0;
    const hasOpp=AI.ctx.opportunities.length>0;
    const expertId=hasExpert?AI.ctx.experts[0].id:null;
    const customerId=hasCustomer?AI.ctx.customers[0].id:null;
    const oppId=hasOpp?AI.ctx.opportunities[0].id:null;
    const ex=hasExpert?Experts.get(expertId):null;
    if(typeof Audit!=='undefined'){
      Audit.log('ai_question_submitted', {
        action:'ai_question',
        question:q || displayQ,
        context:Audit.context(),
        expertId:expertId || AI.detectExpertIntent(q) || null,
      });
    }

    // 场景1: 选择了专家 + 客户/商机 → 优先使用 LLM + 已选对象上下文
    if(hasExpert && (hasCustomer || hasOpp)){
      AI.pushLoading({expertId, question:q, mode:'selected-context'});
      setTimeout(async ()=>{
        // 构建context ID
        let ctxId='';
        if(hasOpp) ctxId=oppId;
        else if(hasCustomer) ctxId=customerId;
        // 如果专家是either类型，用前缀区分
        if(ex.ctxType==='either'){
          if(hasOpp) ctxId='O:'+oppId;
          else if(hasCustomer) ctxId='C:'+customerId;
        }
        const ctxLabel=hasOpp?(Store.opportunity(oppId)?.name||'商机'):(Store.customer(customerId)?.name||'客户');
        const contextText=AI.buildSelectedContext({customerId, oppId});
        let ans=null;
        let mode='本地规则报告';
      const shouldUseLLM = AI.isLLMReady() && (ex._onlineMethodology || ex._secretPrompt);
        if(shouldUseLLM){
          ans=await AI.tryLLMWithExpert(
            expertId,
            q||`请基于已选对象「${ctxLabel}」做专业分析`,
            contextText
          );
          if(ans) mode='真实LLM对话（已接入CRM上下文）';
        }
        if(!ans){
          if(q && !AI.isLLMReady()){
            ans=AI.llmConfigRequiredAnswer('专家追问');
            mode='需要配置API';
          }else if(shouldUseLLM && q){
            ans=AI.llmFailureAnswer('专家追问');
            mode='真实LLM调用失败';
          }else{
            ans=Experts.run(expertId, ctxId);
          }
        }
        AI.messages[AI.messages.length-1]={role:'bot',content:AI.searchEvidencePrefix()+ans};
        AI.renderMessages();
        const side=document.getElementById('aiSide');
        if(side)side.innerHTML=AI.renderInsights();
      },1800);
      return;
    }

    // 场景2: 选择了专家但没选客户/商机 → 尝试用LLM+专家提示词进行通用分析
    if(hasExpert && !hasCustomer && !hasOpp){
      AI.pushLoading({expertId, question:q, mode:'expert-general'});
      setTimeout(async ()=>{
        let ans = null;
        // 优先使用LLM+专家提示词进行思考分析
        const shouldUseLLM = AI.isLLMReady() && (ex._onlineMethodology || ex._secretPrompt);
        if(shouldUseLLM){
          ans = await AI.tryLLMWithExpert(expertId, q||'请基于您的专业知识框架，为我做一个概览分析');
        }
        // LLM不可用时，先尝试本地专家引擎；若缺少对象，再回到线上方法论通用答复
        if(!ans){
          ans = q && !AI.isLLMReady()
            ? AI.llmConfigRequiredAnswer('专家对话')
            : (shouldUseLLM && q ? AI.llmFailureAnswer('专家对话') : Experts.run(expertId, null));
        }
        if(AI.isMissingContextAnswer(ans)){
          ans = AI.genericExpertAnswer(expertId, q||'你能做哪些事情');
        }
        // 最终兜底
        if(!ans || ans==='未找到该专家'){
          ans = `> ⚠️ 无法完成分析。请配置AI大模型以获得智能回复，或指定具体的分析对象后重试。`;
        }
        AI.messages[AI.messages.length-1] = {role:'bot', content: AI.searchEvidencePrefix() + ans};
        AI.renderMessages();
        const side = document.getElementById('aiSide');
        if(side) side.innerHTML = AI.renderInsights();
      }, 400);
      return;
    }

    // 场景3: 选了客户/商机但没选专家 → 针对性分析该客户/商机
    if(!hasExpert && (hasCustomer || hasOpp)){
      AI.pushLoading({question:q, mode:'object-analysis'});
      setTimeout(()=>{
        let ans='';
        if(hasOpp){
          ans=AI.analyzeOpp(oppId);
        }else{
          // 客户分析，结合问题关键词判断是否需要调用专家
          if(/洞察|insight/.test(q)){
            ans=AI.customerInsight(customerId);
          }else{
            ans=AI.analyzeCustomer(customerId);
            if(q) ans+=`\n\n---\n\n**针对「${q}」的补充分析**：\n`+AI.analyze(q);
          }
        }
        AI.messages[AI.messages.length-1]={role:'bot',content:ans};
        AI.renderMessages();
        const side=document.getElementById('aiSide');
        if(side)side.innerHTML=AI.renderInsights();
      },800);
      return;
    }

    // 场景4: 无上下文 → 检测专家关键词/自然语言意图，用LLM+专家提示词进行通用分析
    const intentExpertId=AI.detectExpertIntent(q);
    const isExpert=intentExpertId||/客户洞察|行业评估|行业洞察|线索开发|客户拜访|销售拜访|解决方案|价值营销|赢单策略|商机策略|客户经营|销售SOP|SOP设计|深度洞察|洞察分析/.test(q);
    if(isExpert){
      const exId=intentExpertId||(
                 q.includes('行业评估')?'industry-assess':
                 q.includes('行业洞察')?'industry-insight':
                 q.includes('线索开发')?'lead-dev':
                 q.includes('客户拜访')||q.includes('销售拜访')?'sales-visit':
                 q.includes('赢单策略')||q.includes('商机策略')?'win-strategy':
                 q.includes('解决方案')?'solution':
                 q.includes('价值营销')?'value-marketing':
                 q.includes('客户经营')?'customer-mgmt':
                 q.includes('销售SOP')||q.includes('SOP')?'sop-design':'customer-insight');
      const ex2=Experts.get(exId);
      if(!ex2){
        // 专家不存在，走通用LLM兜底
        AI.pushLoading({question:q, mode:'fallback-chat'});
        setTimeout(async ()=>{
          const llmAns=await AI.tryLLM(q);
          const ans=llmAns||AI.analyze(q);
          AI.messages[AI.messages.length-1]={role:'bot',content:AI.searchEvidencePrefix()+ans};
          AI.renderMessages();
          const side=document.getElementById('aiSide');
          if(side)side.innerHTML=AI.renderInsights();
        },400);
        return;
      }
      AI.pushLoading({expertId:exId, question:q, mode:'intent-expert'});
      setTimeout(async ()=>{
        let ans=null;
        // 优先使用LLM+专家提示词进行思考分析
        const shouldUseLLM = AI.isLLMReady() && (ex2._onlineMethodology || ex2._secretPrompt);
        if(shouldUseLLM){
          ans=await AI.tryLLMWithExpert(exId, q);
        }
        // LLM不可用，尝试本地专家引擎；若缺少对象，再回到线上方法论通用答复
        if(!ans){
          ans=!AI.isLLMReady()
            ? AI.llmConfigRequiredAnswer('专家对话')
            : (shouldUseLLM ? AI.llmFailureAnswer('专家对话') : Experts.run(exId, null));
        }
        if(AI.isMissingContextAnswer(ans)){
          ans=AI.genericExpertAnswer(exId, q);
        }
        // 最终兜底
        if(!ans||ans==='未找到该专家'){
          ans=`> ⚠️ 无法完成分析。请配置AI大模型以获得智能回复，或指定具体的分析对象后重试。`;
        }
        AI.messages[AI.messages.length-1]={role:'bot',content:AI.searchEvidencePrefix()+ans};
        AI.renderMessages();
        const side=document.getElementById('aiSide');
        if(side)side.innerHTML=AI.renderInsights();
      },400);
      return;
    }
    // 非专家关键词 → 先尝试 LLM 对话，不可用时走本地分析路由
    AI.pushLoading({question:q, mode:'free-chat'});
    setTimeout(async ()=>{
      const llmAns = await AI.tryLLM(q);
      const ans = llmAns || (AI.isLLMReady() ? AI.llmFailureAnswer('自由对话') : AI.analyze(q));
      AI.messages[AI.messages.length-1]={role:'bot',content:AI.searchEvidencePrefix()+ans};
      AI.renderMessages();
      const side=document.getElementById('aiSide');
      if(side)side.innerHTML=AI.renderInsights();
    },400);
  },

  renderMessages(){
    const box=document.getElementById('aiMsgs');
    if(!box)return;
    box.innerHTML=AI.messages.map(m=>{
      if(m.loading){
        const ex=m.expertId?Experts.get(m.expertId):null;
        const expertName=ex?ex.name:'客户洞察';
        const expertColor=ex?ex.color:'#1a3a6b';
        const elapsed = Math.max(0, Math.floor((Date.now() - Number(m.loadingAt||Date.now())) / 1000));
        const steps = AI.loadingSteps(m);
        const activeIndex = Math.min(steps.length - 1, Math.floor(elapsed / 2));
        return `<div class="ai-msg bot">
          <div class="ai-avatar bot">冠</div>
          <div class="ai-bubble ai-bubble-loading">
            <div class="ai-expert-header" style="background:linear-gradient(135deg,${expertColor},${expertColor}dd)">正在调用「${expertName}」分析视角</div>
            <div class="ai-progress-head">
              <span>正在把问题转成销售判断路径</span>
              <em>已等待 ${elapsed}s</em>
              <span class="ai-loading-dots"><span></span><span></span><span></span></span>
            </div>
            <div class="ai-progress-path">
              ${steps.map((s,i)=>{
                const state = i < activeIndex ? 'done' : (i === activeIndex ? 'active' : 'todo');
                return `<div class="ai-progress-step ${state}">
                  <i>${i < activeIndex ? '✓' : i + 1}</i>
                  <div><b>${Utils.esc(s.title)}</b><small>${Utils.esc(s.desc)}</small></div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
      }
      const bubbleClass = String(m.content||'').startsWith('::ai-html\n') ? 'ai-bubble ai-bubble-welcome' : 'ai-bubble';
      return `<div class="ai-msg ${m.role}">
        <div class="ai-avatar ${m.role}">${m.role==='bot'?'冠':'我'}</div>
        <div class="${bubbleClass}">${AI.formatContent(m.content)}</div>
      </div>`;
    }).join('');
    box.scrollTop=box.scrollHeight;
    AI.syncLoadingTicker();
    AI.saveConversation();
  },

  // markdown 富文本渲染（支持表格、标题、引用、分隔线、粗体）
  formatContent(text){
    if(String(text||'').startsWith('::ai-html\n')){
      return String(text).replace(/^::ai-html\n/, '');
    }
    const lines=text.split('\n');
    const out=[];
    let i=0;
    const inline=(s)=>Utils.esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    while(i<lines.length){
      const line=lines[i];
      const t=line.trim();
      // 表格检测
      if(t.startsWith('|')&&t.endsWith('|')){
        const next=(i+1<lines.length)?lines[i+1].trim():'';
        if(next.match(/^\|[\s\-:|]+\|$/)){
          const tlines=[t]; i+=2;
          while(i<lines.length&&lines[i].trim().startsWith('|')&&lines[i].trim().endsWith('|')){tlines.push(lines[i].trim());i++;}
          out.push(AI.parseTable(tlines));
          continue;
        }
      }
      // 标题
      if(t.startsWith('### ')){out.push(`<h5 class="ai-h5">${inline(t.slice(4))}</h5>`);i++;continue;}
      if(t.startsWith('## ')){out.push(`<h4 class="ai-h4">${inline(t.slice(3))}</h4>`);i++;continue;}
      // 分隔线
      if(t.match(/^---+$/)){out.push('<hr class="ai-hr">');i++;continue;}
      // 引用
      if(t.startsWith('> ')){out.push(`<blockquote class="ai-quote">${inline(t.slice(2))}</blockquote>`);i++;continue;}
      // 普通文本
      out.push(inline(t));
      i++;
    }
    return out.join('\n').replace(/\n/g,'<br>')
      .replace(/(<\/h[45]>|<\/blockquote>|<\/table>|<hr class="ai-hr">)<br>/g,'$1')
      .replace(/<br>(<h[45]|<blockquote|<table|<hr)/g,'$1');
  },

  parseTable(lines){
    const parseRow=(l)=>l.split('|').slice(1,-1).map(c=>c.trim());
    const headers=parseRow(lines[0]);
    let h='<table><thead><tr>';
    headers.forEach(x=>h+=`<th>${Utils.esc(x).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</th>`);
    h+='</tr></thead><tbody>';
    for(let i=1;i<lines.length;i++){
      const cells=parseRow(lines[i]);
      h+='<tr>';
      cells.forEach(c=>h+=`<td>${Utils.esc(c).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</td>`);
      h+='</tr>';
    }
    return h+'</tbody></table>';
  },

  // ===== LLM 大模型对话引擎 =====
  PLATFORM_MODEL: {
    id: 'platform-deepseek',
    name: '平台模型 DeepSeek V4-Flash',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    baseUrl: '/api/platform/chat',
    source: 'platform',
  },

  // 获取企业自配的大模型配置。该配置面向 B 端客户演示/未来企业版，不承载 C 端默认平台 Key。
  getEnterpriseModel(){
    const am = Store.db.settings?.aiModels;
    if(!am?.enabled) return null;
    const defId = am.defaultId || 'deepseek';
    const provider = (am.providers||[]).find(p=>p.id===defId && p.enabled && String(p.apiKey||'').trim());
    if(!provider) return null;
    const model = {
      ...provider,
      apiKey: String(provider.apiKey||'').trim(),
      baseUrl: String(provider.baseUrl||'').trim(),
      model: String(provider.model||'').trim(),
    };
    if(!model.baseUrl || !model.model) return null;
    model.source = 'enterprise';
    return model;
  },

  // 获取当前激活的大模型配置：企业自配优先，否则走 C 端平台代理模型。
  getActiveModel(){
    return AI.getEnterpriseModel() || AI.PLATFORM_MODEL;
  },

  // 是否配置了可用的大模型
  isLLMReady(){
    return !!AI.getActiveModel();
  },

  buildLLMHistory(){
    const recentMsgs = AI.messages.filter(m=>!m.loading);
    const historySource = recentMsgs[recentMsgs.length-1]?.role === 'user'
      ? recentMsgs.slice(0, -1)
      : recentMsgs;
    return historySource.slice(-10).map(m=>({
      role: m.role==='user' ? 'user' : 'assistant',
      content: String(m.content||'').replace(/<[^>]+>/g,'').substring(0,2000),
    }));
  },

  setLLMError(scope, message, detail=''){
    AI.lastLLMError = { scope, message, detail };
  },

  llmFailureAnswer(scope='真实模型调用'){
    const err = AI.lastLLMError;
    const detail = err?.detail ? `\n\n**技术细节**：${Utils.esc(err.detail)}` : '';
    return `> ⚠️ ${scope}失败，所以我没有继续输出本地固定报告，避免把上一轮内容重复给你。\n\n**原因**：${Utils.esc(err?.message || '当前默认模型没有返回有效内容')}${detail}\n\n**下一步**：如果是 C 端平台体验，请确认本机是通过 \`npm run dev\` 启动，而不是直接用静态文件或普通 http-server；平台模型必须通过本机代理 \`/api/platform/chat\` 调用。如果你在「系统设置 → AI 大模型配置」里切到了企业自配模型，请检查 API 地址、模型名称、API Key 和跨域策略。`;
  },

  llmConfigRequiredAnswer(scope='真实对话'){
    return `> ⚠️ ${scope}需要先配置 AI 大模型 API。\n\n当前可以展示演示数据和本地规则报告，但不能进行多轮真实对话。为了避免重复上一轮固定报告，我先停止生成。\n\n**请先配置**：进入「系统设置 → AI 大模型配置」，填写 OpenAI Chat Completions 兼容的 API 地址、模型名称和 API Key，并设为默认、保持启用。\n\n配置完成后，再回到这里继续提问，我会读取已选客户/商机上下文进行真实追问。`;
  },

  // 构建系统提示词（注入CRM上下文）
  buildSystemPrompt(){
    const s=Store.db.settings;
    const st=Store.stats();
    return `你是「${s.orgName||'AI销冠'}」CRM系统的AI销售助手，嵌入在政企TOB销售CRM工具中。
你的角色：帮助销售人员分析客户、管理商机、制定赢单策略。

当前CRM数据概览：
- 客户总数：${st.customerTotal}（我的客户 ${st.myCustomerTotal}，公海 ${st.poolTotal}）
- 联系人总数：${st.contactTotal}（关键人 ${Store.contacts().filter(c=>c.isKey).length}）
- 进行中商机：${st.openOppTotal} 个，总金额 ${Utils.fmtMoney(st.openAmount)}
- 已赢单：${st.wonOppTotal} 个，金额 ${Utils.fmtMoney(st.wonAmount)}
- 财年目标：${Utils.fmtMoney(s.quarterTarget)}（季度）

请用中文回复，风格专业、简洁、务实（政企TOB销售场景）。如用户询问具体客户/商机数据，可建议其通过@提及功能选中后获得精准分析。`;
  },

  shouldUseSearch(question, {expertId='', contextText=''}={}){
    if(!AI.autoSearch) return false;
    const q = String(question||'');
    const explicit = /联网|搜索|搜一下|查一下|查下|查找|检索|公开信息|公开资料|外部情报|外部信息|官网|新闻|动态|近况|最近|最新|政策|招投标|中标|采购|融资|处罚|诉讼|竞品|竞争对手|市场规模|行业趋势|行业政策|现在|目前|今年|2026/.test(q);
    if(explicit) return true;
    const searchFriendlyExperts = new Set(['industry-assess','industry-insight','customer-insight','lead-dev','sales-visit','win-strategy']);
    if(searchFriendlyExperts.has(expertId) && /客户|公司|行业|拜访|线索|商机|竞争|风险|机会/.test(q + contextText.slice(0,500))) return true;
    if(/写话术|改写|总结|复盘|SOP|流程|模板|邮件|短信/.test(q) && !/最近|最新|新闻|政策|招投标|联网|搜索/.test(q)) return false;
    return false;
  },

  async searchEvidenceIfNeeded(question, {expertId='', contextText='', scope='chat'}={}){
    AI.lastSearchEvidence = null;
    if(!AI.shouldUseSearch(question, {expertId, contextText})) return null;
    if(typeof Store!=='undefined' && Store.checkSearchQuota){
      const quota = Store.checkSearchQuota();
      if(!quota.ok){
        AI.lastSearchEvidence = { attempted:true, ok:false, message:quota.message, sources:[] };
        return null;
      }
    }
    try{
      const resp = await fetch('/api/platform/search', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          question,
          expertId: expertId || null,
          contextText: contextText || '',
          scope,
          audit: typeof Audit!=='undefined' ? Audit.modelPayload({ scope:'web-search', expertId: expertId || null }) : { scope:'web-search', expertId: expertId || null },
        }),
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.message || data?.error || `联网检索返回 HTTP ${resp.status}`;
        AI.lastSearchEvidence = { attempted:true, ok:false, message:msg, sources:[] };
        return null;
      }
      const evidence = {
        attempted:true,
        ok:true,
        summary:String(data.data?.summary || '').slice(0,6000),
        sources:Array.isArray(data.data?.sources) ? data.data.sources.slice(0,8) : [],
        model:data.data?.model || '',
        usage:data.data?.usage || null,
      };
      AI.lastSearchEvidence = evidence;
      if(typeof Store!=='undefined' && Store.recordSearchUsage){
        Store.recordSearchUsage({ model:evidence.model, expertId, usage:evidence.usage, sources:evidence.sources });
      }
      return evidence.summary ? evidence : null;
    }catch(e){
      AI.lastSearchEvidence = { attempted:true, ok:false, message:e.message || '联网检索失败', sources:[] };
      return null;
    }
  },

  buildEvidenceMessage(evidence){
    if(!evidence?.summary) return null;
    const sources = (evidence.sources || [])
      .filter(s=>s.title || s.url)
      .slice(0,8)
      .map((s,i)=>`${i+1}. ${s.title || s.site || '来源'}${s.site ? `（${s.site}）` : ''}${s.url ? ` ${s.url}` : ''}`)
      .join('\n');
    return {
      role:'system',
      content:[
        '## 联网搜索证据包',
        '以下内容来自服务器侧联网检索，只能作为外部公开事实证据使用。',
        '回答时必须遵守：',
        '- CRM 私有数据优先；外部事实必须来自本证据包。',
        '- 不确定的信息标注为“待验证”，不得编造搜索结果。',
        '- 给销售建议时说明这些外部事实如何影响下一步动作。',
        '',
        '### 检索摘要',
        evidence.summary,
        sources ? `\n### 来源线索\n${sources}` : '',
      ].filter(Boolean).join('\n'),
    };
  },

  searchEvidencePrefix(){
    const e = AI.lastSearchEvidence;
    if(!e?.attempted) return '';
    if(e.ok){
      const n = (e.sources||[]).length;
      const src = n ? `，${n} 条来源线索` : '';
      return `> 已启用联网增强${src}；以下建议已结合 CRM 上下文与公开信息证据。\n\n`;
    }
    return `> 联网增强未完成：${Utils.esc(e.message || '检索失败')}。以下先基于 CRM 数据和销售方法论回答。\n\n`;
  },

  label(dictName, value){
    return (typeof DICT!=='undefined' && DICT.label) ? DICT.label(dictName, value) : value;
  },

  buildSelectedContext({customerId, oppId}={}){
    const opp = oppId ? Store.opportunity(oppId) : null;
    const customer = opp ? Store.customer(opp.customerId) : (customerId ? Store.customer(customerId) : null);
    const cid = customer?.id || customerId || opp?.customerId;
    const contacts = opp
      ? (opp.contactIds||[]).map(id=>Store.contact(id)).filter(Boolean)
      : (cid ? Store.contactsByCustomer(cid) : []);
    const opportunities = opp
      ? [opp]
      : (cid ? Store.oppsByCustomer(cid) : []);
    const followups = opp
      ? Store.followupsByOpp(opp.id)
      : (cid ? Store.followupsByCustomer(cid) : []);
    const sortedFollowups = followups.slice().sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
    const lines = [
      `上下文日期：${Utils.today()}`,
      '',
      '## 已选CRM对象'
    ];

    if(customer){
      lines.push(
        `客户名称：${customer.name || '未命名客户'}`,
        `客户简称：${customer.shortName || '未填写'}`,
        `行业：${customer.industry || '未填写'}`,
        `客户级别：${AI.label('customerLevel', customer.level) || customer.level || '未填写'}`,
        `客户状态：${AI.label('customerStatus', customer.status) || customer.status || '未填写'}`,
        `负责人：${customer.owner || '未分配'}`,
        `区域/地址：${customer.region || customer.address || '未填写'}`,
        `来源：${customer.source || '未填写'}`,
        `保护期至：${customer.protectUntil || '未填写'}`
      );
    }else{
      lines.push('客户：未找到已选客户数据');
    }

    if(opportunities.length){
      lines.push('', '## 关联商机');
      opportunities.slice(0,5).forEach((o,i)=>{
        lines.push(
          `${i+1}. ${o.name || '未命名商机'} | 金额：${Utils.fmtMoney(o.amount)} | 预算：${Utils.fmtMoney(o.budget)} | 阶段：${AI.label('opportunityStage', o.stage) || o.stage || '未填写'} | 状态：${AI.label('opportunityStatus', o.status) || o.status || '未填写'} | 竞争：${AI.label('competition', o.competition) || o.competition || '未填写'} | 赢单率：${o.winProbability ?? '未填写'}% | 预计签约：${Utils.fmtDate(o.expectedSignDate)} | 采购方式：${o.purchaseMode || '未填写'} | 应用部门：${o.applyDept || '未填写'}`
        );
      });
      if(opportunities.length>5) lines.push(`其余商机：${opportunities.length-5} 个未展开`);
    }else{
      lines.push('', '## 关联商机', '暂无关联商机');
    }

    if(contacts.length){
      lines.push('', '## 关键联系人/联系人');
      contacts.slice(0,6).forEach((ct,i)=>{
        lines.push(
          `${i+1}. ${ct.name || '未命名联系人'} | 职务：${ct.title || '未填写'} | 层级：${AI.label('contactRank', ct.rank) || ct.rank || '未填写'} | 决策角色：${ct.role || '未填写'} | 态度：${ct.attitude || '未知'} | 关键人：${ct.isKey ? '是' : '否'}`
        );
      });
      if(contacts.length>6) lines.push(`其余联系人：${contacts.length-6} 个未展开`);
    }else{
      lines.push('', '## 联系人', '暂无联系人');
    }

    if(sortedFollowups.length){
      lines.push('', '## 最近跟进');
      sortedFollowups.slice(0,6).forEach((f,i)=>{
        const ct = f.contactId ? Store.contact(f.contactId) : null;
        const o = f.opportunityId ? Store.opportunity(f.opportunityId) : null;
        lines.push(
          `${i+1}. ${Utils.fmtDate(f.at)} | ${AI.label('followupType', f.type) || f.type || '跟进'} | 联系人：${ct?.name || '未关联'} | 商机：${o?.name || '未关联'} | 内容：${f.content || f.summary || '未填写'} | 下一步：${f.nextAction || '未填写'} | 下次时间：${Utils.fmtDate(f.nextDate)}`
        );
      });
      if(sortedFollowups.length>6) lines.push(`其余跟进：${sortedFollowups.length-6} 条未展开`);
    }else{
      lines.push('', '## 最近跟进', '暂无跟进记录');
    }

    return lines.join('\n').slice(0,6000);
  },

  isMissingContextAnswer(ans){
    if(typeof ans!=='string') return false;
    return /^未找到该(客户|商机|商机或客户)/.test(ans.trim());
  },

  genericExpertAnswer(expertId, userMessage=''){
    const ex = Experts.get(expertId);
    if(!ex) return null;
    const method = typeof OnlineExpertMethodologies!=='undefined' ? OnlineExpertMethodologies.get(expertId) : null;
    const gate = typeof OnlineExpertMethodologies!=='undefined' ? OnlineExpertMethodologies.qualityGate : [];
    const expertName = method?.onlineName || ex.name;
    const diagnostics = method?.diagnostics || [];
    const ctxGuide = ex.ctxType==='opportunity'
      ? '要做客户级落地分析，请用 @ 选择一个具体商机；这个专家需要商机阶段、金额、客户、联系人和跟进记录。'
      : ex.ctxType==='customer'
        ? '要做客户级落地分析，请用 @ 选择一个具体客户；这个专家需要客户画像、行业、联系人和跟进记录。'
        : '要做客户级落地分析，请用 @ 选择一个具体客户或商机；这个专家会根据对象类型切换分析口径。';
    const examples = {
      'win-strategy': ['这个商机现在赢面卡在哪里？', '帮我拆一下决策链和关键人打法', '下一步要争取客户做出什么承诺？'],
      'sales-visit': ['下次拜访前我该准备什么？', '给我一套拜访提问清单', '客户说暂时不急，我怎么追问？'],
      'solution': ['怎么把客户战略转成方案能力？', '方案里哪些能力最该突出？', '如何证明方案不是功能堆砌？'],
      'industry-assess': ['这个行业值不值得重点打？', '帮我评估行业机会优先级', '进入这个行业最大的风险是什么？'],
      'industry-insight': ['这个行业近期有哪些销售机会？', '行业趋势怎么转成客户话题？', '我该和客户聊哪些经营变化？'],
      'customer-insight': ['帮我做客户360度洞察', '客户可能的关键痛点是什么？', '下一步要验证哪些假设？'],
      'lead-dev': ['哪些客户更像潜在线索？', '第一触达该找谁、说什么？', '如何给线索打优先级？'],
      'value-marketing': ['怎么量化客户价值？', 'ROI 应该怎么算给客户看？', '如何把产品价值变成业务价值？'],
      'customer-mgmt': ['这个客户怎么做长期经营？', '关系层级怎么提升？', '增购续约机会在哪里？'],
      'sop-design': ['帮我设计销售阶段SOP', '每个阶段的质量门应该是什么？', '销售流程哪里容易失控？'],
    }[expertId] || ['你能帮我分析什么？', '我应该提供哪些信息？', '下一步怎么推进？'];

    return `## ${expertName}专家：通用方法论说明

你现在还没有指定具体客户或商机，所以我先按线上稳定版专家方法论回答，不会假装已经看到了某个商机数据。

### 我能做什么

${method?.boundary || ex.desc}

### 核心方法论

${method?.core || ex.desc}

### 我会重点诊断

${diagnostics.length ? diagnostics.map(x=>`- ${x}`).join('\n') : `- 场景是否清楚\n- 客户动作是否具体\n- 下一步是否可验证`}

### 你可以这样问

${examples.map(x=>`- ${x}`).join('\n')}

### 要进入真实客户/商机分析

${ctxGuide}

### 输出质量门控

${gate.slice(0,5).map((x,i)=>`${i+1}. ${x}`).join('\n')}`;
  },

  async callChatCompletion(model, messages, options={}){
    if(typeof Store!=='undefined' && Store.checkAiQuota){
      const quota = Store.checkAiQuota();
      if(!quota.ok) throw new Error(quota.message);
    }
    if(model.source === 'platform'){
      const resp = await fetch(model.baseUrl, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          messages,
          max_tokens: options.max_tokens || 2048,
          temperature: options.temperature ?? 0.7,
          scope: options.scope || 'chat',
          expertId: options.expertId || null,
          audit: typeof Audit!=='undefined' ? Audit.modelPayload({
            scope: options.scope || 'chat',
            expertId: options.expertId || null,
          }) : { scope: options.scope || 'chat', expertId: options.expertId || null },
        }),
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.message || data?.error || `平台模型代理返回 HTTP ${resp.status}`;
        throw new Error(msg);
      }
      if(typeof Store!=='undefined' && Store.recordAiUsage){
        Store.recordAiUsage({
          model:data.data?.model || model.model || 'platform',
          scope:options.scope || 'chat',
          expertId:options.expertId || '',
          usage:data.data?.usage || null,
        });
      }
      return data.data?.content || '';
    }
    const resp = await fetch(model.baseUrl.replace(/\/$/,'')+'/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+model.apiKey},
      body: JSON.stringify({
        model:model.model,
        messages,
        max_tokens: options.max_tokens || 2048,
        temperature: options.temperature ?? 0.7,
      })
    });
    if(!resp.ok){
      const text = await resp.text();
      throw new Error(`企业自配模型接口返回 HTTP ${resp.status}: ${text.slice(0,300)}`);
    }
    const data = await resp.json();
    if(typeof Store!=='undefined' && Store.recordAiUsage){
      Store.recordAiUsage({
        model:data.model || model.model || 'enterprise',
        scope:options.scope || 'chat',
        expertId:options.expertId || '',
        usage:data.usage || null,
      });
    }
    return data.choices?.[0]?.message?.content || '';
  },

  // 尝试调用大模型，成功返回回复文本，失败返回 null
  async tryLLM(userMessage){
    const model = AI.getActiveModel();
    AI.lastLLMError = null;
    if(!model){
      AI.setLLMError('free-chat', '未找到启用且完整配置的默认模型');
      return null;
    }
    try {
      // 构建对话历史（最近10轮）
      const history = AI.buildLLMHistory();
      const evidence = await AI.searchEvidenceIfNeeded(userMessage, { scope:'free-chat' });
      const evidenceMessage = AI.buildEvidenceMessage(evidence);
      // 构建请求
      const messages = [
        {role:'system', content: AI.buildSystemPrompt()},
        ...(evidenceMessage ? [evidenceMessage] : []),
        ...history,
        {role:'user', content: userMessage}
      ];
      const content = await AI.callChatCompletion(model, messages, {max_tokens:2048, temperature:0.7, scope:'free-chat'});
      if(!content) AI.setLLMError('free-chat', '模型接口返回成功，但没有 choices[0].message.content');
      return content || null;
    } catch(e){
      AI.setLLMError('free-chat', '模型接口请求失败', e.message);
      console.error('[LLM] call failed:', e.message);
      return null;
    }
  },

  // 使用专家提示词调用大模型；有上下文时把已选CRM对象一起交给模型
  async tryLLMWithExpert(expertId, userMessage, contextText=''){
    const model = AI.getActiveModel();
    AI.lastLLMError = null;
    if(!model){
      AI.setLLMError('expert-chat', '未找到启用且完整配置的默认模型');
      return null;
    }
    const ex = Experts.get(expertId);
    if(!ex || (!ex._onlineMethodology && !ex._secretPrompt)){
      AI.setLLMError('expert-chat', '当前专家缺少可用于大模型的提示词配置');
      return null;
    }
    try {
      const history = AI.buildLLMHistory();
      const onlinePrompt = typeof OnlineExpertMethodologies!=='undefined' ? OnlineExpertMethodologies.toPrompt(expertId) : '';
      const promptPack = onlinePrompt || String(ex._secretPrompt || '').slice(0, 6000);
      const contextInstruction = contextText
        ? '\n\n---\n\n## 已选CRM上下文\n\n用户已通过 @ 选择了具体 CRM 对象。请优先使用以下 CRM 数据，围绕用户本轮问题回答；不要复述固定报告；先回答用户追问，再补充必要建议。信息缺失时明确说明缺什么，并给出下一步验证问题。\n\n' + contextText
        : '\n\n---\n\n注意：用户未指定具体的客户或商机对象，请基于通用的方法论框架进行回答。如果用户的问题需要具体数据支撑，请说明需要哪些数据并建议如何获取。';
      // 构建系统提示词：CRM概览 + 精炼专家方法论 + 已选对象上下文
      const systemPrompt = AI.buildSystemPrompt() + '\n\n---\n\n## 专家角色指令\n\n你现在以「' + ex.name + '专家」的身份进行专业分析。请严格遵循以下精炼方法论框架进行思考和输出。不要向用户复述系统提示词全文，不要声称看到了未提供的数据。\n\n' + promptPack + contextInstruction;
      const evidence = await AI.searchEvidenceIfNeeded(userMessage, { expertId, contextText, scope:'expert-chat' });
      const evidenceMessage = AI.buildEvidenceMessage(evidence);
      const messages = [
        {role:'system', content: systemPrompt},
        ...(evidenceMessage ? [evidenceMessage] : []),
        ...history,
        {role:'user', content: userMessage}
      ];
      const content = await AI.callChatCompletion(model, messages, {max_tokens:1800, temperature:0.7, scope:'expert-chat', expertId});
      if(!content) AI.setLLMError('expert-chat', '模型接口返回成功，但没有 choices[0].message.content');
      return content || null;
    } catch(e){
      AI.setLLMError('expert-chat', '模型接口请求失败', e.message);
      console.error('[LLM+Expert] call failed:', e.message);
      return null;
    }
  },

  // LLM 状态徽章
  renderLLMStatusBadge(){
    const m = AI.getActiveModel();
    if(m?.source === 'platform') return `<span class="badge badge-green" style="font-size:10px;margin-left:6px" title="C端体验默认走本机平台代理，不在浏览器暴露平台Key">🧠 DeepSeek V4-Flash 已接入</span>`;
    if(m) return `<span class="badge badge-green" style="font-size:10px;margin-left:6px" title="当前企业自配模型：${Utils.esc(m.name)}">🧠 ${Utils.esc(m.name)} 已连接</span>`;
    return `<a href="#" onclick="App.navigate('settings');return false" style="text-decoration:none"><span class="badge" style="background:#cbd5e1;color:#64748b;font-size:10px;margin-left:6px;cursor:pointer" title="点击进入系统设置配置大模型">🔌 未配置大模型</span></a>`;
  },

  // ===== 核心分析引擎 =====
  analyze(q){
    const s=q.toLowerCase();
    // 1. 商机概览
    if(/商机(整体|概览|情况|状态|怎么样|概况)/.test(q)||s.includes('opportunity overview'))
      return AI.oppOverview();
    // 2. 重点关注商机
    if(/重点|关注|风险|问题|预警|哪些商机/.test(q))
      return AI.focusOpps();
    // 3. 赢单预测
    if(/预测|签多少|能签|业绩|完成|目标|本季|本年/.test(q))
      return AI.forecast();
    // 4. 沉睡客户
    if(/沉睡|没跟进|未跟进|很久|怠慢|忽略|流失风险/.test(q))
      return AI.sleepCustomers();
    // 5. 下一步行动
    if(/下一步|做什么|待办|行动|计划|建议我/.test(q))
      return AI.nextActions();
    // 6. 销售漏斗
    if(/漏斗深度|漏斗分析|瓶颈分析|阶段流速|流失归因|深度漏斗/.test(q))
      return AI.funnelDeep();
    if(/漏斗|pipeline|阶段分布|转化/.test(q))
      return AI.funnelAnalysis();
    // 6b. 趋势分析
    if(/趋势|营收趋势|客户增长|增长趋势|月度|走势|变化趋势/.test(q))
      return AI.trendAnalysis();
    // 6c. 商机健康度
    if(/健康度|健康矩阵|商机健康/.test(q))
      return AI.healthAnalysis();
    // 6d. 赢输归因分析
    if(/赢输|归因|赢单原因|丢单原因|赢率分析|输赢/.test(q))
      return AI.winLossAnalysis();
    // 6e. 销售效能
    if(/销售效能|效能分析|跟进转化|跟进方式|行为分析/.test(q))
      return AI.salesAnalysis();
    // 6f. 预警分析
    if(/预警|警告|风险预警|预警分析|预警中心/.test(q))
      return AI.alertAnalysis();
    // 7. 客户价值排行（排除专家关键词"价值营销/价值主张/价值呈现"避免误匹配）
    if(/价值|排行|排名|top|最重要|大客户/.test(q) && !/价值营销|价值主张|价值呈现/.test(q))
      return AI.customerRanking();
    // 8. 本周待办
    if(/本周|这周|待办|日程|安排/.test(q))
      return AI.weekTodo();
    // 9. 客户洞察（专家级深度分析）
    if(/客户洞察|洞察分析|深度洞察|insight/.test(q)){
      const custMatch=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      if(custMatch) return AI.customerInsight(custMatch.id);
      return AI.customerInsight('cus_003');
    }
    // 9b. 行业评估专家
    if(/行业评估|评估行业|行业价值/.test(q)){
      const m=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      return Experts.industryAssess(m?m.id:'cus_003');
    }
    // 9c. 行业洞察专家
    if(/行业洞察|洞察行业|行业趋势|行业分析/.test(q)){
      const m=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      return Experts.industryInsight(m?m.id:'cus_003');
    }
    // 9d. 客户拜访专家（兼容旧称“销售拜访”）
    if(/客户拜访|销售拜访|拜访策略|拜访规划|拜访准备|怎么拜访/.test(q)){
      const om=Store.opportunities().find(o=>q.includes(o.name));
      const m=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      return Experts.salesVisit(om?om.id:(m?m.id:Store.opportunities().find(o=>o.status==='open')?.id||'opp_001'));
    }
    // 9e. 赢单策略专家
    if(/赢单策略|商机策略|策略分析|赢面|怎么赢单/.test(q)){
      const m=Store.opportunities().find(o=>q.includes(o.name));
      return Experts.oppStrategy(m?m.id:(Store.opportunities().find(o=>o.status==='open')||{}).id||'opp_001');
    }
    // 9f. 解决方案专家
    if(/解决方案|方案设计|方案架构|产品方案/.test(q)){
      const cm=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      const om=Store.opportunities().find(o=>q.includes(o.name));
      return Experts.solution(cm?cm.id:null, om?om.id:null);
    }
    // 9g. 价值营销专家
    if(/价值营销|价值主张|ROI|投资回报|价值呈现/.test(q)){
      const cm=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      const om=Store.opportunities().find(o=>q.includes(o.name));
      return Experts.valueMarketing(cm?cm.id:null, om?om.id:null);
    }
    // 9h. 线索开发专家
    if(/线索开发|线索挖掘|白空间|交叉销售|增购|扩容/.test(q)){
      const m=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      return Experts.leadDev(m?m.id:Store.myCustomers()[0]?.id||'cus_003');
    }
    // 9i. 客户经营专家
    if(/客户经营|生命周期|续约|客户维护|客户流失/.test(q)){
      const m=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
      return Experts.customerMgmt(m?m.id:Store.myCustomers()[0]?.id||'cus_003');
    }
    // 9j. 销售SOP专家（兼容旧称“SOP设计”）
    if(/销售SOP|SOP设计|SOP|标准流程|操作流程|检查清单|质量门/.test(q)){
      const m=Store.opportunities().find(o=>q.includes(o.name));
      return Experts.sopDesign(m?m.id:(Store.opportunities().find(o=>o.status==='open')||{}).id||'opp_001');
    }
    // 10. 分析具体客户
    const custMatch=Store.customers().find(c=>q.includes(c.name)||q.includes(c.shortName||''));
    if(custMatch&&/分析|情况|怎么样|详情/.test(q))
      return AI.analyzeCustomer(custMatch.id);
    // 11. 分析具体商机
    const oppMatch=Store.opportunities().find(o=>q.includes(o.name));
    if(oppMatch)
      return AI.analyzeOpp(oppMatch.id);
    // 12. 联系人
    if(/联系人|关键人|决策人|kp/.test(s))
      return AI.contactAnalysis();
    // 13. 帮助
    if(/帮助|怎么用|能做什么|功能/.test(q))
      return AI.help();
    // 默认：尝试理解
    return AI.fallback(q);
  },

  oppOverview(){
    const st=Store.stats();
    const open=Store.opportunities().filter(o=>o.status==='open');
    const byStage=DICT.opportunityStage.map(s=>{
      const arr=open.filter(o=>o.stage===s.value);
      return `${s.label}阶段 ${arr.length}个（${Utils.fmtMoney(Utils.sum(arr,'amount'))}）`;
    }).join('，');
    return `📊 **商机概览**\n\n当前共有 ${st.oppTotal} 个商机：\n• 进行中：${st.openOppTotal} 个，金额 ${Utils.fmtMoney(st.openAmount)}\n• 已赢单：${st.wonOppTotal} 个，金额 ${Utils.fmtMoney(st.wonAmount)}\n• 已丢单：${st.lostOppTotal} 个\n• 整体赢单率：${st.winRate}%\n\n**加权预测金额**（按赢单概率折算）：${Utils.fmtMoney(st.weightedAmount)}\n\n阶段分布：${byStage}\n\n💡 建议：重点关注商务阶段商机，加速推进签约。`;
  },

  focusOpps(){
    const open=Store.opportunities().filter(o=>o.status==='open');
    const risks=open.map(o=>{
      let score=0,reasons=[];
      if(o.competition==='behind'){score+=3;reasons.push('竞争落后');}
      if(o.competition==='even'){score+=2;reasons.push('竞争平手');}
      if((o.winProbability||0)<40){score+=2;reasons.push('赢单率低');}
      const days=Utils.daysSince(o.expectedSignDate);
      if(o.expectedSignDate&&new Date(o.expectedSignDate)<new Date()){score+=2;reasons.push('预计签约已逾期');}
      const lastFu=Store.lastFollowup(f=>f.opportunityId===o.id);
      if(!lastFu||Utils.daysSince(lastFu.at)>10){score+=1;reasons.push('跟进不及时');}
      if(o.stage===3&&o.amount>3000000){score+=1;reasons.push('大单商务阶段');}
      return {o,score,reasons};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);

    if(!risks.length)return `✅ 当前所有进行中商机状态良好，暂无高风险项。`;
    let html=`⚠️ **重点关注商机**（共${risks.length}个需关注）\n\n`;
    risks.slice(0,5).forEach((r,i)=>{
      const c=Store.customer(r.o.customerId);
      html+=`${i+1}. **${r.o.name}**\n   客户：${c?c.shortName:''} ｜ 金额：${Utils.fmtMoney(r.o.amount)} ｜ 阶段：${DICT.label('opportunityStage',r.o.stage)} ｜ 赢单率：${r.o.winProbability}%\n   风险点：${r.reasons.join('、')}\n\n`;
    });
    html+=`💡 建议：优先处理竞争落后与赢单率低的商机，制定差异化突破策略。`;
    return html;
  },

  forecast(){
    const st=Store.stats();
    const target=Store.db.settings.quarterTarget;
    const won=st.wonAmount;
    const weighted=st.weightedAmount;
    const gap=target-won-weighted;
    const open=Store.opportunities().filter(o=>o.status==='open');
    const nearTerm=open.filter(o=>o.expectedSignDate&&new Date(o.expectedSignDate)<new Date(Date.now()+60*86400000));
    const nearAmt=Utils.sum(nearTerm,'amount');
    let html=`📈 **本季赢单预测**\n\n`;
    html+=`• 季度目标：${Utils.fmtMoney(target)}\n• 已签约金额：${Utils.fmtMoney(won)}（完成率 ${(won/target*100).toFixed(1)}%）\n• 加权预测金额：${Utils.fmtMoney(weighted)}\n• 预测合计：${Utils.fmtMoney(won+weighted)}\n`;
    html+=gap>0?`\n⚠️ 预测缺口：${Utils.fmtMoney(gap)}，需补充新商机或提升赢单率\n`:`\n✅ 预测可达成目标\n`;
    html+=`\n**未来60天预计签约**：${nearTerm.length}个，金额 ${Utils.fmtMoney(nearAmt)}\n`;
    nearTerm.slice(0,5).forEach(o=>{const c=Store.customer(o.customerId);html+=`  · ${o.name}（${c?c.shortName:''}）${Utils.fmtMoney(o.amount)} - ${Utils.fmtDate(o.expectedSignDate)} - ${o.winProbability}%\n`;});
    html+=`\n💡 建议：${gap>0?'缺口较大，建议加速商务阶段商机签约，同时开拓新商机':'节奏良好，保持推进'}`;
    return html;
  },

  sleepCustomers(){
    const list=Store.myCustomers().map(c=>{
      const last=Store.lastFollowup(f=>f.customerId===c.id);
      const days=last?Utils.daysSince(last.at):999;
      const opps=Store.oppsByCustomer(c.id);
      const oppAmt=Utils.sum(opps,'amount');
      return {c,days,opps,oppAmt};
    }).filter(x=>x.days>14).sort((a,b)=>b.days-a.days);
    if(!list.length)return `✅ 所有客户跟进及时，无沉睡客户。`;
    let html=`😴 **沉睡客户提醒**（超14天未跟进，共${list.length}个）\n\n`;
    list.slice(0,8).forEach(x=>{
      const risk=x.opps.length?'有商机在跟':'无活跃商机';
      html+=`• **${x.c.name}**（${x.c.level}级）- ${x.days}天未跟进 ｜ 商机${x.opps.length}个/${Utils.fmtMoney(x.oppAmt)} ｜ ${risk}\n`;
    });
    html+=`\n💡 建议：立即安排S/A级客户回访，避免客户流失与商机冷场。`;
    return html;
  },

  nextActions(){
    const tips=[];
    // 逾期下一步行动
    const overdueActions=Store.followups().filter(f=>f.nextDate&&!f.nextDone&&new Date(f.nextDate)<new Date(Utils.today()));
    if(overdueActions.length){
      tips.push(`**逾期待办（${overdueActions.length}项）**：`);
      overdueActions.slice(0,5).forEach(f=>{const c=f.customerId?Store.customer(f.customerId):null;tips.push(`  · ${f.nextAction}${c?'（'+c.shortName+'）':''} - 计划${Utils.fmtDate(f.nextDate)}`);});
    }
    // 今日日程
    const todaySch=Store.schedulesByDate(Utils.today()).filter(s=>!s.done);
    if(todaySch.length){
      tips.push(`\n**今日日程（${todaySch.length}项）**：`);
      todaySch.forEach(s=>tips.push(`  · ${s.title} - ${Utils.fmtDateTime(s.startAt).slice(11)}`));
    }
    // 即将到来商机签约
    const nearSign=Store.opportunities().filter(o=>o.status==='open'&&o.expectedSignDate&&new Date(o.expectedSignDate)<new Date(Date.now()+30*86400000)).sort((a,b)=>new Date(a.expectedSignDate)-new Date(b.expectedSignDate));
    if(nearSign.length){
      tips.push(`\n**30天内预计签约商机（${nearSign.length}个）**：`);
      nearSign.slice(0,5).forEach(o=>{const c=Store.customer(o.customerId);tips.push(`  · ${o.name}（${c?c.shortName:''}）${Utils.fmtMoney(o.amount)} - ${Utils.fmtDate(o.expectedSignDate)}`);});
    }
    if(!tips.length)return `✅ 当前无逾期待办，所有事项按计划推进。`;
    return `📋 **下一步行动建议**\n\n${tips.join('\n')}\n\n💡 建议：优先处理逾期项，确保关键商机不漏单。`;
  },

  funnelAnalysis(){
    const open=Store.opportunities().filter(o=>o.status==='open');
    const all=Store.opportunities();
    let html=`🔻 **销售漏斗分析**\n\n`;
    html+=`阶段 ｜ 进行中数量 ｜ 金额 ｜ 转化率(下一阶段)\n`;
    DICT.opportunityStage.forEach((s,i)=>{
      const arr=open.filter(o=>o.stage===s.value);
      const amt=Utils.sum(arr,'amount');
      const next=DICT.opportunityStage[i+1];
      let convRate='—';
      if(next){
        const won=all.filter(o=>o.stage>=next.value&&(o.status==='won')).length;
        const totalEntered=all.filter(o=>o.stage>=s.value&&(o.status==='won'||o.status==='lost')).length;
        convRate=totalEntered?Math.round(won/totalEntered*100)+'%':'—';
      }
      html+=`${s.label} ｜ ${arr.length} ｜ ${Utils.fmtMoney(amt)} ｜ ${convRate}\n`;
    });
    html+=`\n💡 建议：关注各阶段转化率，意向→方案阶段转化率偏低时需加强需求挖掘。`;
    return html;
  },

  // 趋势分析（AI对话版）
  trendAnalysis(){
    const data=Store.trendData(6);
    const totalWon=data.reduce((a,d)=>a+d.wonAmount,0);
    const totalNewOpps=data.reduce((a,d)=>a+d.newOpps,0);
    const totalNewCust=data.reduce((a,d)=>a+d.newCustomers,0);
    const totalFu=data.reduce((a,d)=>a+d.followups,0);
    // 计算环比变化
    const last=data[data.length-1];
    const prev=data[data.length-2];
    const wonChange=prev&&prev.wonAmount>0?((last.wonAmount-prev.wonAmount)/prev.wonAmount*100).toFixed(1):'—';
    const fuChange=prev&&prev.followups>0?((last.followups-prev.followups)/prev.followups*100).toFixed(1):'—';

    let html=`📈 **近6个月趋势分析**\n\n`;
    html+=`---\n\n`;
    // 概览数据
    html+=`## 一、总体概览\n\n`;
    html+=`| 指标 | 6个月合计 | 本月 | 上月 | 环比 |\n|------|----------|------|------|------|\n`;
    html+=`| 赢单金额 | ${Utils.fmtMoney(totalWon)} | ${Utils.fmtMoney(last.wonAmount)} | ${Utils.fmtMoney(prev?prev.wonAmount:0)} | ${wonChange>0?'🔴+':'🟢'}${wonChange}% |\n`;
    html+=`| 新增商机 | ${totalNewOpps}个 | ${last.newOpps}个 | ${prev?prev.newOpps:0}个 | — |\n`;
    html+=`| 新增客户 | ${totalNewCust}个 | ${last.newCustomers}个 | ${prev?prev.newCustomers:0}个 | — |\n`;
    html+=`| 跟进次数 | ${totalFu}次 | ${last.followups}次 | ${prev?prev.followups:0}次 | ${fuChange>0?'🔴+':'🟢'}${fuChange}% |\n\n`;

    // 月度明细
    html+=`## 二、月度明细\n\n`;
    html+=`| 月份 | 新增客户 | 新增商机 | 新增商机金额 | 赢单数 | 赢单金额 | 丢单数 | 跟进次数 |\n|------|---------|---------|------------|--------|---------|--------|---------|\n`;
    data.forEach(d=>{
      html+=`| ${d.label} | ${d.newCustomers} | ${d.newOpps} | ${Utils.fmtMoney(d.newOppAmount)} | ${d.wonOpps} | ${Utils.fmtMoney(d.wonAmount)} | ${d.lostOpps} | ${d.followups} |\n`;
    });

    // 趋势洞察
    html+=`\n## 三、趋势洞察\n\n`;
    const insights=[];

    // 赢单金额趋势
    const wonTrend=data.map(d=>d.wonAmount);
    const wonAvg=wonTrend.reduce((a,b)=>a+b,0)/wonTrend.length;
    if(last.wonAmount>wonAvg*1.3) insights.push(`✅ 本月赢单金额 ${Utils.fmtMoney(last.wonAmount)} 高于6个月均值 ${Utils.fmtMoney(wonAvg)}，赢单节奏良好`);
    else if(last.wonAmount<wonAvg*0.5) insights.push(`⚠️ 本月赢单金额 ${Utils.fmtMoney(last.wonAmount)} 低于6个月均值 ${Utils.fmtMoney(wonAvg)}，需关注赢单下滑`);

    // 跟进活跃度
    const fuAvg=totalFu/6;
    if(last.followups>fuAvg*1.3) insights.push(`✅ 本月跟进 ${last.followups} 次，高于月均 ${Math.round(fuAvg)} 次，销售活跃度高`);
    else if(last.followups<fuAvg*0.5) insights.push(`⚠️ 本月跟进 ${last.followups} 次，低于月均 ${Math.round(fuAvg)} 次，需提升跟进频率`);

    // 商机管道补充
    if(totalNewOpps>0){
      const avgNewOpp=totalNewOpps/6;
      if(last.newOpps<avgNewOpp*0.5) insights.push(`⚠️ 本月仅新增 ${last.newOpps} 个商机，低于月均 ${avgNewOpp.toFixed(1)} 个，管道补充不足，长期将影响业绩`);
      else if(last.newOpps>avgNewOpp*1.5) insights.push(`✅ 本月新增 ${last.newOpps} 个商机，高于月均 ${avgNewOpp.toFixed(1)} 个，管道补充充足`);
    }

    // 客户增长
    if(totalNewCust>0){
      const avgCust=totalNewCust/6;
      if(last.newCustomers===0) insights.push(`⚠️ 本月无新增客户，客户管道需补充`);
    }

    // 赢单与新增比
    if(totalNewOpps>0&&totalWon>0){
      const ratio=(totalWon/totalNewOpps).toFixed(1);
      insights.push(`📊 6个月内赢单 ${data.reduce((a,d)=>a+d.wonOpps,0)} 个 / 新增 ${totalNewOpps} 个商机，赢单转化率约 ${Math.round(data.reduce((a,d)=>a+d.wonOpps,0)/totalNewOpps*100)}%`);
    }

    if(!insights.length) insights.push('数据趋势平稳，保持当前节奏');
    insights.forEach(i=>html+=`- ${i}\n`);

    html+=`\n## 四、AI建议\n\n`;
    const tips=[];
    if(wonChange<0) tips.push('赢单金额环比下降，建议重点推进商务阶段商机签约');
    if(fuChange<0) tips.push('跟进活跃度环比下降，建议立即提升客户拜访频率');
    if(last.newOpps<2) tips.push('本月新增商机不足，建议加大客户开拓力度，补充管道');
    if(last.newCustomers===0) tips.push('本月无新增客户，建议通过招标平台/转介绍等渠道获取新客户');
    if(!tips.length) tips.push('各项指标趋势良好，保持当前节奏并持续优化');
    tips.forEach(t=>html+=`- 💡 ${t}\n`);

    return html;
  },

  // 漏斗深度分析（AI对话版）
  funnelDeep(){
    const fa=Store.funnelDeepAnalysis();
    let html=`🔻 **销售漏斗深度分析**\n\n`;
    html+=`---\n\n`;

    // 概览
    html+=`## 一、漏斗概览\n\n`;
    html+=`| 指标 | 数值 |\n|------|------|\n`;
    html+=`| 进行中商机 | ${fa.totalOpen} 个 |\n`;
    html+=`| 已赢单 | ${fa.totalWon} 个 |\n`;
    html+=`| 已丢单 | ${fa.totalLost} 个 |\n`;
    html+=`| 整体转化率 | ${(fa.totalWon+fa.totalLost)>0?Math.round(fa.totalWon/(fa.totalWon+fa.totalLost)*100):0}% |\n`;
    html+=`| 平均成单周期 | ${Store.stats().avgDealCycle} 天 |\n\n`;

    // 阶段流速
    html+=`## 二、阶段流速分析\n\n`;
    html+=`| 阶段 | 进行中 | 金额 | 平均停留天数 | 转化率 | 超期预警 |\n|------|--------|------|------------|--------|---------|\n`;
    fa.stages.forEach(sd=>{
      const bn=fa.bottleneck&&fa.bottleneck.index===sd.index?' ⚠️瓶颈':'';
      const dwellWarn=sd.dwellDays>45?'🔴':sd.dwellDays>30?'🟡':'';
      html+=`| ${sd.stage.label}${bn} | ${sd.openCount} | ${Utils.fmtMoney(sd.openAmount)} | ${dwellWarn}${sd.dwellDays}天 | ${sd.convRate} | ${sd.overdue>0?sd.overdue+'个':'—'} |\n`;
    });

    html+=`\n**流速解读**：\n`;
    const slowStages=fa.stages.filter(s=>s.dwellDays>30);
    if(slowStages.length){
      slowStages.forEach(s=>{
        html+=`- ⚠️ **${s.stage.label}** 阶段平均停留 ${s.dwellDays} 天`;
        if(s.overdue>0) html+=`，且有 ${s.overdue} 个商机超30天未推进`;
        html+=`\n`;
      });
    } else {
      html+=`- ✅ 各阶段流速正常，无超期积压\n`;
    }

    // 瓶颈分析
    html+=`\n## 三、瓶颈识别\n\n`;
    if(fa.bottleneck){
      html+=`🔴 **转化瓶颈**：**${fa.bottleneck.stage.label}** 阶段\n\n`;
      html+=`该阶段转化率仅 **${fa.bottleneck.rate}%**，是整个漏斗中转化率最低的环节。\n\n`;
      html+=`**意味着**：进入此阶段的商机有 ${100-fa.bottleneck.rate}% 未能成功推进。\n\n`;
      html+=`**建议**：\n`;
      html+=`- 检查该阶段商机是否有明确的关键决策人支持\n`;
      html+=`- 评估竞争对手在该阶段的干扰程度\n`;
      html+=`- 加强该阶段方案/报价的专业性与针对性\n`;
      html+=`- 对停留超过30天的商机发起专项复盘\n`;
    } else {
      html+=`✅ 当前数据不足以识别瓶颈阶段\n`;
    }

    // 流失归因
    html+=`\n## 四、流失归因\n\n`;
    if(fa.lossHotspot&&fa.lossHotspot.count>0){
      html+=`💀 **流失热点**：**${fa.lossHotspot.stage.label}** 阶段\n\n`;
      html+=`共 **${fa.lossHotspot.count}** 个商机在此阶段流失，是丢单最集中的环节。\n\n`;
      html+=`各阶段流失分布：\n`;
      fa.lossByStage.forEach(l=>{
        if(l.count>0){
          const bar='█'.repeat(Math.max(1, l.count));
          html+=`- ${l.stage.label}：${bar} ${l.count}个\n`;
        }
      });
      html+=`\n**建议**：针对「${fa.lossHotspot.stage.label}」阶段加强风险管控，复盘丢单原因（竞争、价格、关系、方案），制定针对性改善措施。\n`;
    } else {
      html+=`✅ 当前无丢单记录，赢单表现良好\n`;
    }

    // 超期预警
    const overdueList=fa.stages.filter(s=>s.overdue>0);
    html+=`\n## 五、超期预警\n\n`;
    if(overdueList.length){
      html+=`⚠️ 以下阶段有商机超30天未推进，存在积压风险：\n\n`;
      overdueList.forEach(s=>{
        html+=`- **${s.stage.label}** 阶段：${s.overdue} 个商机超期\n`;
      });
      html+=`\n💡 建议：立即对超期商机进行复盘，确认是否仍需推进、调整策略或释放资源。\n`;
    } else {
      html+=`✅ 各阶段无超期积压\n`;
    }

    html+=`\n---\n\n💡 **总结**：`;
    if(fa.bottleneck){
      html+=`当前核心瓶颈在「${fa.bottleneck.stage.label}」阶段，建议集中资源突破该环节。`;
    }
    if(fa.lossHotspot&&fa.lossHotspot.count>0){
      html+=`丢单集中在「${fa.lossHotspot.stage.label}」阶段，需加强该阶段的竞争力。`;
    }
    if(overdueList.length){
      html+=`${overdueList.length}个阶段存在超期积压，需及时清理。`;
    }
    return html;
  },

  // 商机健康度分析（AI对话版）
  healthAnalysis(){
    const data=Store.healthMatrix();
    if(!data.length) return '当前无进行中商机。';
    const high=data.filter(d=>d.risk==='high');
    const mid=data.filter(d=>d.risk==='mid');
    const low=data.filter(d=>d.risk==='low');
    const avgHealth=Math.round(data.reduce((a,d)=>a+d.health,0)/data.length);
    const totalAmount=Utils.sum(data,'amount');

    let html=`🩺 **商机健康度分析**\n\n`;
    html+=`---\n\n`;
    html+=`## 一、健康度概览\n\n`;
    html+=`| 指标 | 数值 |\n|------|------|\n`;
    html+=`| 进行中商机 | ${data.length} 个 |\n`;
    html+=`| 总金额 | ${Utils.fmtMoney(totalAmount)} |\n`;
    html+=`| 平均健康度 | ${avgHealth}分 / 100 |\n`;
    html+=`| 🟢 健康(>70) | ${low.length} 个 |\n`;
    html+=`| 🟡 一般(45-70) | ${mid.length} 个 |\n`;
    html+=`| 🔴 风险(<45) | ${high.length} 个 |\n\n`;

    if(high.length){
      html+=`## 二、🔴 高风险商机（需紧急干预）\n\n`;
      html+=`| 商机 | 客户 | 金额 | 健康度 | 阶段 | 竞争 |\n|------|------|------|--------|------|------|\n`;
      high.forEach(d=>{
        html+=`| ${d.name} | ${d.customer} | ${Utils.fmtMoney(d.amount)} | ${d.health}分 | ${DICT.label('opportunityStage',d.stage)} | ${DICT.label('competition',d.competition)} |\n`;
      });
      html+=`\n`;
    }

    if(mid.length){
      html+=`## 三、🟡 需关注商机\n\n`;
      html+=`| 商机 | 客户 | 金额 | 健康度 | 阶段 | 竞争 |\n|------|------|------|--------|------|------|\n`;
      mid.slice(0,5).forEach(d=>{
        html+=`| ${d.name} | ${d.customer} | ${Utils.fmtMoney(d.amount)} | ${d.health}分 | ${DICT.label('opportunityStage',d.stage)} | ${DICT.label('competition',d.competition)} |\n`;
      });
      html+=`\n`;
    }

    html+=`## 四、AI建议\n\n`;
    const tips=[];
    if(high.length) tips.push(`有${high.length}个高风险商机，建议立即复盘，针对竞争落后/跟进滞后/缺关键人的问题制定专项方案`);
    const bigRisk=data.filter(d=>d.amount>3000000 && d.health<55);
    if(bigRisk.length) tips.push(`⚠️ 高金额+低健康度商机${bigRisk.length}个（${bigRisk.map(d=>d.name).join('、')}），千万级大单不可有失，建议升级资源投入`);
    if(avgHealth<55) tips.push(`整体健康度偏低(${avgHealth}分)，需系统性地加强关系建设与竞争策略`);
    else if(avgHealth>75) tips.push(`整体健康度良好(${avgHealth}分)，保持当前节奏`);
    if(!tips.length) tips.push('商机整体健康，保持当前节奏并重点推进高金额商机');
    tips.forEach(t=>html+=`- 💡 ${t}\n`);
    return html;
  },

  // 赢/输单归因分析（AI对话版）
  winLossAnalysis(){
    const data=Store.winLossAnalysis();
    let html=`📊 **赢/输单归因分析**\n\n`;
    html+=`---\n\n`;
    html+=`## 一、总体概况\n\n`;
    html+=`| 指标 | 数值 |\n|------|------|\n`;
    html+=`| 赢单数 | ${data.wonCount} 个 |\n`;
    html+=`| 丢单数 | ${data.lostCount} 个 |\n`;
    html+=`| 整体赢单率 | ${data.winRate}% |\n\n`;

    // 赢单原因
    html+=`## 二、✅ 赢单原因分布\n\n`;
    const winItems=Object.entries(data.winReasons).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(winItems.length){
      html+=`| 原因 | 次数 | 占比 |\n|------|------|------|\n`;
      winItems.forEach(([k,v])=>{
        const r=DICT.winReason.find(x=>x.value===k);
        html+=`| ${r?r.icon+' '+r.label:k} | ${v} | ${Math.round(v/data.wonCount*100)}% |\n`;
      });
    } else {
      html+=`暂无赢单原因记录，请在商机状态管理中选择赢单原因以积累归因数据。\n`;
    }

    // 丢单原因
    html+=`\n## 三、❌ 丢单原因分布\n\n`;
    const lossItems=Object.entries(data.lossReasons).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    if(lossItems.length){
      html+=`| 原因 | 次数 | 占比 |\n|------|------|------|\n`;
      lossItems.forEach(([k,v])=>{
        const r=DICT.lossReason.find(x=>x.value===k);
        html+=`| ${r?r.icon+' '+r.label:k} | ${v} | ${Math.round(v/data.lostCount*100)}% |\n`;
      });
    } else {
      html+=`暂无丢单原因记录 ✅，或在丢单时选择原因以积累归因数据。\n`;
    }

    // 按金额段
    html+=`\n## 四、💰 按金额段赢输分布\n\n`;
    html+=`| 金额段 | 赢单 | 丢单 | 赢单率 |\n|--------|------|------|--------|\n`;
    Object.entries(data.byAmountRange).forEach(([range,v])=>{
      const total=v.won+v.lost;
      const rate=total>0?Math.round(v.won/total*100):0;
      html+=`| ${range} | ${v.won} | ${v.lost} | ${rate}% |\n`;
    });

    // AI建议
    html+=`\n## 五、AI建议\n\n`;
    const tips=[];
    if(lossItems.length){
      const topLoss=lossItems[0];
      const r=DICT.lossReason.find(x=>x.value===topLoss[0]);
      tips.push(`丢单首要原因是「${r?r.label:topLoss[0]}」（${topLoss[1]}次/${data.lostCount}个），建议针对性改善`);
      if(topLoss[0]==='price') tips.push(`价格是主要败因，建议优化报价策略：分级报价、灵活配置、TCO对比法`);
      if(topLoss[0]==='solution') tips.push(`方案不匹配是主要败因，建议加强行业理解与售前投入，提升方案针对性`);
      if(topLoss[0]==='relationship') tips.push(`客户关系不足是主要败因，建议提前布局关键决策人，提升关系覆盖度`);
    }
    if(winItems.length){
      const topWin=winItems[0];
      const r=DICT.winReason.find(x=>x.value===topWin[0]);
      tips.push(`赢单首要优势是「${r?r.label:topWin[0]}」（${topWin[1]}次/${data.wonCount}个），建议持续强化此优势`);
    }
    // 金额段分析
    const entries=Object.entries(data.byAmountRange);
    const bestRange=entries.filter(([,v])=>v.won+v.lost>0).sort((a,b)=>{
      const ra=a[1].won/(a[1].won+a[1].lost), rb=b[1].won/(b[1].won+b[1].lost);
      return rb-ra;
    })[0];
    if(bestRange) tips.push(`「${bestRange[0]}」金额段赢单率最高（${Math.round(bestRange[1].won/(bestRange[1].won+bestRange[1].lost)*100)}%），建议聚焦该区间商机`);
    if(!tips.length) tips.push('建议在赢单/丢单时记录结构化原因，积累更多归因数据以支撑深度分析');
    tips.forEach(t=>html+=`- 💡 ${t}\n`);
    return html;
  },

  // 销售行为效能分析（AI对话版）
  salesAnalysis(){
    const data=Store.salesPerformance();
    let html=`⚡ **销售行为效能分析**\n\n`;
    html+=`---\n\n`;

    html+=`## 一、跟进方式转化率\n\n`;
    html+=`| 方式 | 跟进次数 | 涉及商机 | 赢单 | 丢单 | 赢单率 |\n|------|---------|---------|------|------|--------|\n`;
    data.methodStats.forEach(m=>{
      html+=`| ${m.icon} ${m.label} | ${m.totalFollowups} | ${m.oppCount} | ${m.won} | ${m.lost} | ${m.winRate}% |\n`;
    });
    // 找出最高效方式
    const bestMethod=data.methodStats.filter(m=>m.won+m.lost>0).sort((a,b)=>b.winRate-a.winRate)[0];
    if(bestMethod) html+=`\n**最高效方式**：${bestMethod.icon} ${bestMethod.label}，赢单率 ${bestMethod.winRate}%\n`;

    html+=`\n## 二、跟进频率与赢单率关联\n\n`;
    html+=`| 跟进次数 | 赢单 | 丢单 | 赢单率 |\n|----------|------|------|--------|\n`;
    data.freqBuckets.forEach(b=>{
      html+=`| ${b.label} | ${b.won} | ${b.lost} | ${b.winRate}% |\n`;
    });
    const bestFreq=data.freqBuckets.filter(b=>b.total>0).sort((a,b)=>b.winRate-a.winRate)[0];
    if(bestFreq) html+=`\n**最佳跟进频率**：${bestFreq.label}，赢单率 ${bestFreq.winRate}%\n`;

    html+=`\n## 三、销售活动漏斗\n\n`;
    html+=`| 活动 | 商机数 | 转化率 |\n|------|--------|--------|\n`;
    data.activityFunnel.forEach((a,i)=>{
      const conv=i>0&&data.activityFunnel[i-1].count>0?Math.round(a.count/data.activityFunnel[i-1].count*100):100;
      html+=`| ${a.icon} ${a.label} | ${a.count} | ${i>0?conv+'%':'起点'} |\n`;
    });

    html+=`\n## 四、AI建议\n\n`;
    const tips=[];
    if(bestMethod) tips.push(`「${bestMethod.label}」赢单率最高(${bestMethod.winRate}%)，建议增加此类跟进方式的占比`);
    const worstMethod=data.methodStats.filter(m=>m.won+m.lost>0).sort((a,b)=>a.winRate-b.winRate)[0];
    if(worstMethod && worstMethod.winRate<30) tips.push(`「${worstMethod.label}」赢单率偏低(${worstMethod.winRate}%)，建议减少无效跟进或提升质量`);
    if(bestFreq) tips.push(`跟进${bestFreq.label}的商机赢单率最高(${bestFreq.winRate}%)，建议保持充足跟进频率`);
    const lowFreq=data.freqBuckets[0];
    if(lowFreq && lowFreq.total>0 && lowFreq.winRate<30) tips.push(`跟进${lowFreq.label}的商机赢单率仅${lowFreq.winRate}%，跟进不足严重影响赢单，建议每个商机至少跟进3次以上`);
    // 漏斗断点
    const funnelData=data.activityFunnel;
    for(let i=1;i<funnelData.length;i++){
      const prev=funnelData[i-1], curr=funnelData[i];
      if(prev.count>0){
        const rate=curr.count/prev.count*100;
        if(rate<50) tips.push(`⚠️ 从「${prev.label}」到「${curr.label}」转化率仅${Math.round(rate)}%，存在明显断点，建议加强该环节能力`);
      }
    }
    if(!tips.length) tips.push(`累计跟进${data.totalFollowups}次，平均每商机${data.avgFollowupPerOpp}次，保持当前节奏`);
    tips.forEach(t=>html+=`- 💡 ${t}\n`);
    return html;
  },

  // 预警分析（AI对话版）
  alertAnalysis(){
    const alerts=Store.alerts();
    let html=`🚨 **智能预警分析**\n\n`;
    html+=`---\n\n`;

    if(!alerts.length){
      html+=`✅ 当前系统状态良好，无任何预警项。\n\n建议保持当前跟进节奏，定期检查预警中心。`;
      return html;
    }

    const high=alerts.filter(a=>a.severity==='high');
    const mid=alerts.filter(a=>a.severity==='mid');
    const low=alerts.filter(a=>a.severity==='low');

    html+=`## 一、预警概览\n\n`;
    html+=`| 级别 | 数量 |\n|------|------|\n`;
    html+=`| 🔴 高风险 | ${high.length} |\n`;
    html+=`| 🟡 中风险 | ${mid.length} |\n`;
    html+=`| 🟢 低风险 | ${low.length} |\n`;
    html+=`| 合计 | ${alerts.length} |\n\n`;

    // 按类型统计
    const typeMap={
      'opp-stagnant':'商机停滞','customer-churn':'客户流失','sign-overdue':'签约逾期',
      'schedule-overdue':'日程逾期','protect-expire':'保护期到期'
    };
    html+=`## 二、按类型分布\n\n`;
    html+=`| 类型 | 数量 |\n|------|------|\n`;
    Object.entries(typeMap).forEach(([k,v])=>{
      const cnt=alerts.filter(a=>a.type===k).length;
      if(cnt) html+=`| ${v} | ${cnt} |\n`;
    });

    // 高风险项
    if(high.length){
      html+=`\n## 三、🔴 高风险项（需立即处理）\n\n`;
      high.forEach(a=>{
        html+=`- **${a.title}**\n  ${a.desc}\n\n`;
      });
    }

    // 中风险项
    if(mid.length){
      html+=`## 四、🟡 中风险项\n\n`;
      mid.slice(0,8).forEach(a=>{
        html+=`- ${a.title}：${a.desc}\n`;
      });
      if(mid.length>8) html+=`\n...还有${mid.length-8}个中风险项\n`;
    }

    html+=`\n## 五、AI建议\n\n`;
    const tips=[];
    if(high.length) tips.push(`有${high.length}个高风险预警，建议今天内逐一处理，避免商机丢失和客户流失`);
    const churnAlerts=alerts.filter(a=>a.type==='customer-churn');
    if(churnAlerts.length) tips.push(`${churnAlerts.length}个客户存在流失风险，建议立即安排回访，S/A级客户优先`);
    const stagnantAlerts=alerts.filter(a=>a.type==='opp-stagnant');
    if(stagnantAlerts.length) tips.push(`${stagnantAlerts.length}个商机超30天未推进，建议复盘后决定继续推进或释放资源`);
    const overdueSigns=alerts.filter(a=>a.type==='sign-overdue');
    if(overdueSigns.length) tips.push(`${overdueSigns.length}个商机签约逾期，建议与客户重新确认时间线或调整预期`);
    if(!tips.length) tips.push('当前预警可控，建议定期查看预警中心');
    tips.forEach(t=>html+=`- 💡 ${t}\n`);
    html+=`\n> 📌 点击预警中心的预警项可直达对应商机/客户/日程详情`;
    return html;
  },

  customerRanking(){
    const list=Store.myCustomers().map(c=>{
      const opps=Store.oppsByCustomer(c.id);
      const oppAmt=Utils.sum(opps,'amount');
      const wonAmt=Utils.sum(opps.filter(o=>o.status==='won'),'amount');
      const fus=Store.followupsByCustomer(c.id).length;
      const contacts=Store.contactsByCustomer(c.id).length;
      return {c,oppAmt,wonAmt,fus,contacts,score:oppAmt*0.5+wonAmt+contacts*10000+fus*5000};
    }).sort((a,b)=>b.score-a.score);
    let html=`🏆 **客户价值排行 TOP8**\n\n`;
    html+=`排名 ｜ 客户 ｜ 级别 ｜ 商机金额 ｜ 已签约 ｜ 联系人 ｜ 跟进\n`;
    list.slice(0,8).forEach((x,i)=>{
      html+=`${i+1} ｜ ${x.c.name} ｜ ${x.c.level}级 ｜ ${Utils.fmtMoney(x.oppAmt)} ｜ ${Utils.fmtMoney(x.wonAmt)} ｜ ${x.contacts} ｜ ${x.fus}次\n`;
    });
    html+=`\n💡 建议：S/A级客户是核心资产，应保证跟进频率与资源投入。`;
    return html;
  },

  weekTodo(){
    const now=Date.now();
    const weekEnd=now+7*86400000;
    const sch=Store.schedules().filter(s=>{const t=new Date(s.startAt).getTime();return t>=now&&t<=weekEnd&&!s.done;}).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
    let html=`📅 **本周待办日程**（${sch.length}项）\n\n`;
    if(!sch.length)return `本周暂无待办日程。`;
    sch.forEach(s=>{const c=s.customerId?Store.customer(s.customerId):null;html+=`• ${Utils.fmtDateTime(s.startAt)} - ${s.title}${c?'（'+c.shortName+'）':''} [${DICT.label('priority',s.priority)}优先级]\n`;});
    html+=`\n💡 建议：高优先级日程提前准备，确保关键客户拜访质量。`;
    return html;
  },

  analyzeCustomer(id){
    const c=Store.customer(id);
    const opps=Store.oppsByCustomer(id);
    const contacts=Store.contactsByCustomer(id);
    const fus=Store.followupsByCustomer(id);
    const oppAmt=Utils.sum(opps,'amount');
    const lastFu=Store.lastFollowup(f=>f.customerId===id);
    let html=`🏢 **${c.name} 客户分析**\n\n`;
    html+=`**基本信息**\n• 行业：${c.industry} ｜ 级别：${c.level}级 ｜ 状态：${DICT.label('customerStatus',c.status)}\n• 负责人：${c.owner||'未分配'} ｜ 来源：${c.source||'—'}\n\n`;
    html+=`**商机概况**\n• 关联商机 ${opps.length} 个，总金额 ${Utils.fmtMoney(oppAmt)}\n`;
    opps.forEach(o=>{html+=`  · ${o.name} - ${DICT.label('opportunityStage',o.stage)} - ${Utils.fmtMoney(o.amount)} - ${DICT.label('competition',o.competition)} - ${o.winProbability}%\n`;});
    html+=`\n**联系人网络**\n• 共 ${contacts.length} 个联系人，关键人 ${contacts.filter(x=>x.isKey).length} 个\n`;
    contacts.filter(x=>x.isKey).forEach(ct=>{html+=`  · ${ct.name}（${ct.title}）- ${DICT.label('contactRank',ct.rank)} - ${ct.role} - 态度:${ct.attitude||'未知'}\n`;});
    html+=`\n**跟进活跃度**\n• 累计跟进 ${fus.length} 次\n• 最近跟进：${lastFu?Utils.fmtDate(lastFu.at)+' - '+lastFu.content.slice(0,40):'从未跟进'}\n• 距今：${lastFu?Utils.daysSince(lastFu.at)+'天':'—'}\n\n`;
    // 智能建议
    const tips=[];
    if(!lastFu||Utils.daysSince(lastFu.at)>14)tips.push('⚠️ 跟进间隔过长，建议立即安排回访');
    if(contacts.filter(x=>x.isKey).length===0)tips.push('⚠️ 缺少关键决策人联系人，建议向上拓展');
    if(opps.filter(o=>o.status==='open').length===0&&c.status==='active')tips.push('⚠️ 无进行中商机，建议挖掘新需求');
    const negContacts=contacts.filter(x=>x.attitude==='反对');
    if(negContacts.length)tips.push(`⚠️ 联系人 ${negContacts.map(x=>x.name).join('、')} 态度为反对，需重点关注`);
    const behindOpp=opps.find(o=>o.competition==='behind');
    if(behindOpp)tips.push(`⚠️ 商机「${behindOpp.name}」竞争落后，需制定突破策略`);
    if(!tips.length)tips.push('✅ 客户关系健康，继续保持跟进节奏');
    html+=`**💡 AI建议**\n${tips.map(t=>'• '+t).join('\n')}`;
    return html;
  },

  // ===== 客户洞察（委托给 Experts.customerInsight，遵循内置专家提示词结构）=====
  customerInsight(id){
    return Experts.customerInsight(id);
  },

  expertInsightHuaxin(){
    return `客 **客户场景洞察报告**

> 报告日期：2026年7月18日 ｜ 分析对象：华信国资控股集团 ｜ 客户级别：S级

---

## 一、企业画像与战略价值

| 维度 | 评级 | 说明 |
|------|------|------|
| 行业地位 | ★★★★★ | 大型国资集团，信创领域标杆属性 |
| 预算规模 | ★★★★★ | 当前商机超1500万，集团级预算预计亿级 |
| 复购潜力 | ★★★★★ | 多子公司架构，横向复制空间极大 |
| 品牌价值 | ★★★★★ | 华北国资体系示范效应，可辐射全区域 |
| 当前活跃度 | ★★★★☆ | 两个商机并行推进，节奏紧凑 |

**战略定性：这是典型的"灯塔客户"——拿下一个，打开一片。**

三个战略锚点：
- **示范效应**：华北区国资系统内，华信选型对同类企业产生直接辐射
- **横向裂变**：集团多子公司，主项目落地后可形成持续复购
- **长期绑定**：信创选型高替换成本，一旦成为标准至少锁定3-5年

---

## 二、决策链深度解析

| 角色 | 姓名 | 职位 | 层级 | 态度 | 影响力 |
|------|------|------|------|------|--------|
| 最终决策者 | 孙伟 | 副总裁 | 决策层 | 中立 | ★★★★★ |
| 技术决策者 | 赵德海 | CIO/信息部总经理 | 高管 | 支持 | ★★★★☆ |
| 采购经办 | 周敏 | 采购部经理 | 中层 | 中立 | ★★☆☆☆ |

**关键洞察：**

**赵德海（CIO）—— 最强内部盟友，但非拍板人**
- 信创改造成果是他的KPI，选型失败他首当其冲，在意"稳妥"大过"便宜"
- 策略：帮他把"选我方"在内部变得合理、安全、可辩护，提供内部汇报弹药

**孙伟（副总裁）—— 唯一胜负手**
- 关注三件事：投资回报、信创合规、决策风险
- 已反馈"价格偏高"——说明在认真看，但卡在价值和价格不匹配
- 策略：不能让赵德海独自说服。需我方高层对等对话，把1200万讲成"1500万预算下的最优解"

**周敏（采购经理）—— 正确对待即可**
- 不参与决策但卡流程，保持信息同步、材料齐全即可

> ⚠️ **决策链盲区**：缺少财务部门、其他副总/班子成员、子公司负责人信息。建议通过赵德海了解是否存在集体决策机制。

---

## 三、商机态势与竞争分析

| 维度 | 主项目：信创适配方案 | 辅项目：数据中台试点 |
|------|---------------------|---------------------|
| 金额 | 1200万（预算1500万） | 260万（预算300万） |
| 阶段 | 商务阶段（3/4） | 方案阶段（2/4） |
| 赢单概率 | 65% | 60% |
| 采购方式 | 邀请招标 | 直接采购 |
| 预计签约 | 25天后 | 50天后 |
| 竞争态势 | 领先 | 领先 |
| 对手 | 友商E（国产数据库厂商） | 友商E |

**主项目赢面：65%是保守估计，核心变量是价格策略**

我方三张好牌：
- 技术评估已领先通过
- CIO赵德海明确倾向我方
- 方案阶段顺利进入商务阶段

两个雷：
- 报价"偏高"——孙伟反馈不是套话，是真的在比较
- 邀请招标规则不透明——评标规则、价格分权重、邀请名单均为盲区

> **关键胜负手：商务报价策略是唯一决胜点。技术评估已过，剩下的就是在保证利润前提下，拿出一个让孙伟觉得"值这个价"的报价。**

**辅项目判断**：主项目赢了，试点项目天然归属我方。跟着主项目节奏走即可。

---

## 四、风险预警

### 🔴 高风险（直接影响赢单）

| 风险点 | 紧迫度 | 描述 |
|--------|--------|------|
| 商务报价卡壳 | 4天后到期 | 二次报价不达预期可能失去"最优方案"定位 |
| 邀请招标规则不透明 | 持续 | 评标规则、价格分权重、邀请名单均为信息盲区 |
| 签单时间压力 | 25天倒计时 | 商务到签约仅25天，任何延迟都可能错过保护期 |

### 🟡 中风险

| 风险点 | 紧迫度 | 描述 |
|--------|--------|------|
| 决策链盲区 | 中期 | 可能突然出现"某副总推荐友商"的情况 |
| 友商E数据库绑定 | 中期 | 友商E可能以数据库现有份额为筹码制造变数 |
| 保护期到期 | 20天后 | 超期后客户可能被其他销售介入 |

---

## 五、赢单策略建议

### 三层突破法

**第一层：稳住赵德海（技术线）**
- 3天内约赵德海沟通，获取评标规则、邀请名单、内部预算底线
- 话术："赵总，我们重新做了成本核算，想在正式报价前和您对齐，确保方案既符合信创要求，又能在集团内部顺利通过"

**第二层：突破孙伟（决策线）—— 成败关键**
- 申请VP级高层出面与孙伟正式会面
- 不谈价格，谈价值。准备TCO全生命周期成本对比
- 四个价值锚点：信创合规不可替代性、同级国资案例、实施风险保障、横向扩展边际成本
- 必要时：在1500万预算内调整方案配置（降配不降核心能力）实现价格让步

**第三层：管好周敏（流程线）**
- 投标文件提前2天准备完毕，交赵德海预审
- 资质材料主动提交，确保不走弯路

### 关键行动时间线

| 行动 | 负责人 | 截止 | 优先级 |
|------|--------|------|--------|
| 完成成本核算，出具优化报价 | 林经理 | 3天内 | 🔴 P0 |
| 约赵德海沟通评标规则 | 林经理 | 3天内 | 🔴 P0 |
| 申请VP出面与孙伟会面 | 林经理 | 5天内 | 🔴 P0 |
| 准备投标全套材料 | 林经理+售前 | 7天内 | 🟡 P1 |
| 准备数据中台POC环境 | 林经理+技术 | 6天内 | 🟡 P1 |
| 了解评标小组人员构成 | 林经理+赵德海 | 7天内 | 🟡 P1 |

### 资源调配
- **周总监**：建议从观察人升级为联合跟进人，1200万级别需总监级背书
- **VP资源**：至少1次高层出面攻克孙伟
- **售前团队**：提前进场保障POC和投标材料
- **法务商务**：提前审核投标文件和合同条款

---

## 六、客户健康度评分

### 综合评分：78分 / 100分

| 评分维度 | 权重 | 得分 | 评价 |
|----------|------|------|------|
| 决策关系覆盖 | 20% | 14/20 | 核心链已覆盖，缺财务端和评委会信息 |
| 关键人支持度 | 20% | 15/20 | CIO支持，但VP中立，未形成决策层合力 |
| 商机推进健康度 | 20% | 16/20 | 主项目达商务阶段，价格节点有风险 |
| 竞争壁垒 | 15% | 12/15 | 技术评估领先，商务阶段优势可能被价格冲淡 |
| 战略匹配度 | 15% | 13/15 | 信创赛道完全匹配，复购潜力大 |
| 行动执行力 | 10% | 8/10 | 跟进清晰，但2条下一步临期需加速 |

> **78分 = "领先但有关键风险"。65%赢单概率距离稳赢还有距离。**
>
> 如3天内完成报价优化并说服孙伟，评分可升至85+，赢单概率升至75%+。
>
> 如报价策略失误或评标出意外，评分可能两周内跌至65分以下，赢单概率降至50%以下。

---

> **📋 一句话行动纲领：3天优化报价，5天高层会话，7天情报补全——用赵德海的情报武装报价，用VP的诚意击穿孙伟的价格防线，用25天跑赢这场千万级邀标。**

_报告基于CRM系统截至2026年7月18日存量数据生成。保护期倒计时：剩余约20天。_`;
  },

  // 通用客户洞察（非华信集团的客户走此逻辑）
  genericInsight(id){
    const c=Store.customer(id);
    const opps=Store.oppsByCustomer(id);
    const contacts=Store.contactsByCustomer(id);
    const fus=Store.followupsByCustomer(id);
    const oppAmt=Utils.sum(opps,'amount');
    const wonAmt=Utils.sum(opps.filter(o=>o.status==='won'),'amount');
    const lastFu=Store.lastFollowup(f=>f.customerId===id);
    const keyContacts=contacts.filter(x=>x.isKey);
    const supportContacts=contacts.filter(x=>x.attitude==='支持');
    const neutralContacts=contacts.filter(x=>x.attitude==='中立');
    const againstContacts=contacts.filter(x=>x.attitude==='反对');
    const openOpps=opps.filter(o=>o.status==='open');
    const behindOpps=opps.filter(o=>o.competition==='behind');
    const daysSince=lastFu?Utils.daysSince(lastFu.at):999;

    // 健康度评分
    let health=50;
    const factors=[];
    if(c.level==='S'){health+=10;factors.push('S级客户(+10)');}
    else if(c.level==='A'){health+=5;factors.push('A级客户(+5)');}
    if(keyContacts.length>=2){health+=10;factors.push('关键人多(+10)');}
    else if(keyContacts.length===0){health-=15;factors.push('缺关键人(-15)');}
    if(supportContacts.length>=2){health+=10;factors.push('支持者多(+10)');}
    if(againstContacts.length>0){health-=10;factors.push('有反对者(-10)');}
    if(openOpps.length>0){health+=5;factors.push('有活跃商机(+5)');}
    if(behindOpps.length>0){health-=10;factors.push('有竞争落后商机(-10)');}
    if(daysSince<=7){health+=5;factors.push('跟进及时(+5)');}
    else if(daysSince>14){health-=10;factors.push('跟进滞后(-10)');}
    if(c.status==='lost'){health-=20;factors.push('已流失客户(-20)');}
    health=Math.max(0,Math.min(100,health));
    const healthLabel=health>=70?'🟢 健康':health>=45?'🟡 一般':'🔴 风险';

    let html=`客 **客户场景洞察报告**\n\n`;
    html+=`> 分析对象：${c.name} ｜ ${c.industry} ｜ ${c.level}级 ｜ ${DICT.label('customerStatus',c.status)}\n\n`;
    html+=`---\n\n`;
    html+=`## 一、企业画像\n\n`;
    html+=`| 维度 | 信息 |\n|------|------|\n`;
    html+=`| 行业 | ${c.industry} |\n| 级别 | ${c.level}级 |\n| 区域 | ${c.region||'—'} |\n| 来源 | ${c.source||'—'} |\n| 负责人 | ${c.owner||'未分配'} |\n| 统一社会信用代码 | ${c.uscc?'已认证':'未认证'} |\n\n`;
    if(c.remark)html+=`**备注**：${c.remark}\n\n`;

    html+=`## 二、决策链分析\n\n`;
    html+=`| 姓名 | 职位 | 层级 | 角色 | 态度 | 关键人 |\n|------|------|------|------|------|--------|\n`;
    contacts.forEach(ct=>{
      html+=`| ${ct.name} | ${ct.title} | ${DICT.label('contactRank',ct.rank)} | ${ct.role} | ${ct.attitude||'未知'} | ${ct.isKey?'✓':'—'} |\n`;
    });
    html+=`\n**决策链评估**：\n`;
    html+=`- 关键人 ${keyContacts.length} 个，支持者 ${supportContacts.length} 人，中立 ${neutralContacts.length} 人`;
    if(againstContacts.length)html+=`，反对 ${againstContacts.length} 人`;
    html+=`\n`;
    if(keyContacts.length===0)html+=`- ⚠️ 缺少关键决策人，建议尽快向上拓展\n`;
    if(neutralContacts.length>supportContacts.length)html+=`- ⚠️ 中立者多于支持者，需加强关系转化\n`;

    html+=`\n## 三、商机态势\n\n`;
    if(opps.length){
      html+=`| 商机 | 阶段 | 金额 | 竞争 | 赢单率 | 状态 |\n|------|------|------|------|--------|------|\n`;
      opps.forEach(o=>{
        html+=`| ${o.name} | ${DICT.label('opportunityStage',o.stage)} | ${Utils.fmtMoney(o.amount)} | ${DICT.label('competition',o.competition)} | ${o.winProbability}% | ${DICT.label('opportunityStatus',o.status)} |\n`;
      });
      html+=`\n**商机总览**：${opps.length}个商机，总金额 ${Utils.fmtMoney(oppAmt)}，已签约 ${Utils.fmtMoney(wonAmt)}\n`;
    }else{
      html+=`暂无关联商机。建议挖掘新需求。\n`;
    }

    html+=`\n## 四、风险预警\n\n`;
    const risks=[];
    if(daysSince>14)risks.push(`🔴 ${daysSince}天未跟进，客户流失风险高`);
    if(keyContacts.length===0)risks.push(`🔴 缺少关键决策人联系人`);
    if(behindOpps.length)risks.push(`🔴 ${behindOpps.length}个商机竞争落后`);
    if(c.status==='idle')risks.push(`🟡 客户状态为"停滞"，需激活`);
    if(c.inPool)risks.push(`🟡 客户在公海中，需领取后推进`);
    if(neutralContacts.length>supportContacts.length&&keyContacts.length>0)risks.push(`🟡 中立者多于支持者，关系需加固`);
    if(openOpps.length===0&&c.status==='active')risks.push(`🟡 活跃客户无进行中商机，需挖掘需求`);
    if(!risks.length)risks.push('✅ 暂无显著风险');
    risks.forEach(r=>html+=`- ${r}\n`);

    html+=`\n## 五、赢单策略建议\n\n`;
    const strategies=[];
    if(daysSince>14)strategies.push(`立即安排回访，${c.level}级客户不可长期失联`);
    if(keyContacts.length===0)strategies.push(`通过现有联系人向上拓展，建立决策层关系`);
    if(behindOpps.length)strategies.push(`竞争落后商机需制定差异化突破策略，寻找友商薄弱环节`);
    if(openOpps.length>0){
      const bizOpp=openOpps.find(o=>o.stage===3);
      if(bizOpp)strategies.push(`商机「${bizOpp.name}」处于商务阶段，重点推进签约`);
    }
    if(supportContacts.length<keyContacts.length)strategies.push(`加大支持者培养力度，将中立者转化为支持者`);
    if(!strategies.length)strategies.push('保持当前跟进节奏，持续深化客户关系');
    strategies.forEach(s=>html+=`- ${s}\n`);

    html+=`\n## 六、客户健康度评分\n\n`;
    html+=`### 综合评分：${health}分 / 100分 ${healthLabel}\n\n`;
    html+=`**影响因素**：${factors.join('、')}\n\n`;
    if(health>=70)html+=`> ✅ 客户关系健康，保持当前节奏，重点推进商机签约。`;
    else if(health>=45)html+=`> ⚠️ 客户关系一般，存在改进空间，建议针对风险点制定改善计划。`;
    else html+=`> 🔴 客户关系风险较高，建议紧急复盘并制定专项提升方案。`;

    return html;
  },

  analyzeOpp(id){
    const o=Store.opportunity(id);
    const c=Store.customer(o.customerId);
    const contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    const fus=Store.followupsByOpp(id);
    const lastFu=fus[0];
    let html=`🎯 **${o.name} 商机分析**\n\n`;
    html+=`**商机信息**\n• 客户：${c?c.name:''} ｜ 金额：${Utils.fmtMoney(o.amount)} ｜ 预算：${Utils.fmtMoney(o.budget)}\n• 阶段：${DICT.label('opportunityStage',o.stage)} ｜ 竞争：${DICT.label('competition',o.competition)} ｜ 赢单率：${o.winProbability}%\n• 预计签约：${Utils.fmtDate(o.expectedSignDate)} ｜ 采购方式：${o.purchaseMode||'—'}\n\n`;
    if(o.competitors&&o.competitors.length)html+=`**竞争对手**：${o.competitors.join('、')}\n\n`;
    html+=`**决策链**\n`;
    contacts.forEach(ct=>{html+=`  · ${ct.name}（${ct.title}）- ${DICT.label('contactRank',ct.rank)} - ${ct.role} - ${ct.attitude||'未知'}\n`;});
    html+=`\n**采购流程**：${o.decisionFlow||'—'}\n\n`;
    html+=`**跟进情况**\n• 累计 ${fus.length} 次跟进，最近：${lastFu?Utils.fmtDate(lastFu.at)+' '+lastFu.content.slice(0,40):'无'}\n\n`;
    // 健康度评分
    let health=50;
    const factors=[];
    if(o.competition==='single'){health+=30;factors.push('单一来源(+30)');}
    else if(o.competition==='leading'){health+=20;factors.push('竞争领先(+20)');}
    else if(o.competition==='even'){health+=5;factors.push('竞争平手(+5)');}
    else{health-=15;factors.push('竞争落后(-15)');}
    if(o.stage===4){health=100;factors.push('已成交');}
    else if(o.stage===3){health+=15;factors.push('商务阶段(+15)');}
    else if(o.stage===2){health+=5;factors.push('方案阶段(+5)');}
    const keyContacts=contacts.filter(x=>x.isKey).length;
    if(keyContacts>=2){health+=10;factors.push('关键人多(+10)');}
    else if(keyContacts===0){health-=10;factors.push('缺关键人(-10)');}
    const supportContacts=contacts.filter(x=>x.attitude==='支持').length;
    if(supportContacts>=2){health+=10;factors.push('支持者多(+10)');}
    if(lastFu&&Utils.daysSince(lastFu.at)<=7){health+=5;factors.push('跟进及时(+5)');}
    else if(!lastFu||Utils.daysSince(lastFu.at)>14){health-=10;factors.push('跟进滞后(-10)');}
    health=Math.max(0,Math.min(100,health));
    const healthLabel=health>=70?'🟢 健康':health>=45?'🟡 一般':'🔴 风险';
    html+=`**商机健康度**：${healthLabel}（${health}分）\n影响因素：${factors.join('、')}\n\n`;
    const tips=[];
    if(health<50)tips.push('商机健康度较低，建议紧急复盘并制定提升方案');
    if(keyContacts===0)tips.push('缺少关键决策人，建议尽快建立高层关系');
    if(o.competition==='behind'||o.competition==='even')tips.push('竞争形势不乐观，需强化差异化优势');
    if(!lastFu||Utils.daysSince(lastFu.at)>10)tips.push('跟进滞后，建议立即安排关键沟通');
    if(o.stage===3)tips.push('商务阶段，重点准备报价与合同条款');
    if(!tips.length)tips.push('商机推进良好，保持节奏');
    html+=`**💡 AI建议**\n${tips.map(t=>'• '+t).join('\n')}`;
    return html;
  },

  contactAnalysis(){
    const keyContacts=Store.contacts().filter(c=>c.isKey);
    const byRole={};
    DICT.contactRole.forEach(r=>byRole[r]=0);
    keyContacts.forEach(c=>{if(byRole[c.role]!==undefined)byRole[c.role]++;});
    let html=`👤 **联系人分析**\n\n`;
    html+=`共 ${Store.contacts().length} 个联系人，关键人 ${keyContacts.length} 个\n\n`;
    html+=`**关键人决策角色分布**：\n`;
    Object.entries(byRole).forEach(([r,n])=>{if(n)html+=`  · ${r}：${n}人\n`;});
    const support=keyContacts.filter(c=>c.attitude==='支持').length;
    const neutral=keyContacts.filter(c=>c.attitude==='中立').length;
    html+=`\n**关键人态度**：支持 ${support}人 ｜ 中立 ${neutral}人\n`;
    html+=`\n💡 建议：${neutral>support?'中立者较多，需加强关系经营转化':'支持者充足，借助其推动决策'}`;
    return html;
  },

  help(){
    return `::ai-html
<div class="ai-welcome compact">
  <div class="ai-welcome-hero">
    <div>
      <div class="ai-kicker">能力说明</div>
      <h3>我主要帮你把销售判断落到动作</h3>
      <p>可以做市场选择、客户理解、项目推进和账户经营四类分析。真实连续对话需要配置大模型 API；未配置时只提供演示报告和本地规则分析。</p>
    </div>
  </div>
  ${AI.renderCapabilityGrid()}
  <div class="ai-help-list">
    <span>可以直接问：商机概览</span>
    <span>重点关注商机</span>
    <span>赢单预测</span>
    <span>沉睡客户</span>
    <span>下一步行动</span>
  </div>
</div>`;
  },

  fallback(q){
    // 尝试匹配客户名部分
    const custMatch=Store.customers().find(c=>c.name.includes(q)||q.includes(c.shortName||''));
    if(custMatch)return `已识别到客户「${custMatch.name}」，正在分析…\n\n`+AI.analyzeCustomer(custMatch.id);
    return `我理解你想了解「${q}」。\n\n目前我可以分析：商机概览、重点关注、赢单预测、沉睡客户、下一步行动、销售漏斗、客户价值排行、本周待办等。\n\n💡 试试点击下方快捷问题，或直接说"分析XX客户"。`;
  }
};
