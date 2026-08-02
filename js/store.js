/* ========== 数据存储层 Store ========== */
/* 数据底座：企业 / 组织 / 用户 / 客户 / 联系人 / 商机 / 跟进 / 日程 / 设置
   多租户架构：所有业务数据按 enterpriseId 隔离
   双模式：API 模式（后端 MySQL）或本地模式（localStorage）
   - API 模式：init 时从后端拉取全量数据缓存到内存 Store.db，
     写操作乐观更新内存 + 异步调 API（失败仅 toast 提示）
   - 本地模式：原有 localStorage 持久化逻辑（API.BASE 为空时自动启用）*/
const Store = {
  KEY: 'aiwin_crm_db_v2',
  SESSION_KEY: 'aiwin_crm_session',
  ACQ_KEY: 'aixg_acquisition',
  DEMO_TRIAL_DAYS: 3,
  PERSONAL_TRIAL_INVITE_DAYS: 15,
  PERSONAL_TRIAL_AI_QUOTA: 50,
  PERSONAL_TRIAL_SEARCH_QUOTA: 30,
  PERSONAL_TRIAL_CUSTOMER_LIMIT: 10,
  db: null,
  session: { enterpriseId: null, userId: null, loginAt: null },
  // 当前模式：'api' 或 'local'，由 init() 检测后设定
  mode: 'local',
  cloud: { enabled:false, externalId:'', restored:false, syncTimer:null, syncing:false },
  _applyingCloud: false,

  // 集合名 → API 路径映射（API 模式下 CRUD 自动调用）
  API_PATHS: {
    customers: '/api/customers',
    contacts: '/api/contacts',
    opportunities: '/api/opportunities',
    followups: '/api/followups',
    schedules: '/api/schedules',
    notifications: '/api/notifications',
    users: '/api/users',
    orgUnits: '/api/org-units',
    enterprises: '/api/enterprises',
  },
  OWN_DATA_COLLECTIONS: ['customers','contacts','opportunities','followups','schedules'],

  // ===== 初始化（异步：检测 API 可用性，拉取数据）=====
  async init(){
    // 检测后端 API 是否可用
    const apiAvailable = await API.ping();
    Store.mode = apiAvailable ? 'api' : 'local';

    if(Store.mode === 'api'){
      // API 模式：检查是否有 token
      const token = API.getToken();
      if(token){
        try{
          // 验证 token 并获取会话信息
          const sessionData = await API.get('/api/auth/session');
          Store.session = {
            enterpriseId: sessionData.enterprise?.id || sessionData.user?.enterpriseId,
            userId: sessionData.user?.id,
            loginAt: Utils.now(),
          };
          // 拉取全量数据到内存
          Store.db = await API.fetchAll();
        }catch(e){
          // Token 无效，清除并使用种子数据（供登录页展示）
          API.clearToken();
          Store.clearSession();
          Store.db = Seed.build();
        }
      }else{
        // 未登录，使用种子数据（供登录页展示企业列表）
        Store.db = Seed.build();
      }
    }else{
      // 本地模式（原有逻辑）
      const saved = localStorage.getItem(Store.KEY);
      if(saved){
        try{
          Store.db = JSON.parse(saved);
          if(!Store.db.enterprises || !Store.db.enterprises.length || !Store.db.users || !Store.db.users.length){
            Store.db = Seed.build();
          }
        }catch(e){ Store.db = Seed.build(); }
      }else{
        Store.db = Seed.build();
      }
      Store.save();
      Store.migrateV1();
    }
    Store.captureAcquisition();
    // 应用自定义数据字典配置（双模式统一）
    if(Store.db.settings && Store.db.settings.dict){
      DICT.applyCustom(Store.db.settings.dict);
    }
    // 确保 aiModels 配置存在（兼容已有用户数据迁移）
    if(Store.db.settings && !Store.db.settings.aiModels){
      Store.db.settings.aiModels = { enabled:true, defaultId:'deepseek', providers:[
        { id:'deepseek', name:'企业自配 DeepSeek V4-Flash', provider:'deepseek', apiKey:'', baseUrl:'https://api.deepseek.com/v1', model:'deepseek-v4-flash', enabled:true, isDefault:true },
        { id:'qwen', name:'通义千问 Qwen-Max', provider:'qwen', apiKey:'', baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'qwen-max', enabled:false, isDefault:false },
        { id:'openai', name:'OpenAI GPT-4o', provider:'openai', apiKey:'', baseUrl:'https://api.openai.com/v1', model:'gpt-4o', enabled:false, isDefault:false }
      ]};
      Store.save();
    }
    // 确保 subscription 配置存在（SaaS订阅与积分）
    if(Store.db.settings && !Store.db.settings.subscription){
      Store.db.settings.subscription = {
        plan:'professional', planName:'专业版', startDate:'2026-07-01', endDate:'2027-06-30',
        autoRenew:true, status:'active',
        tokensTotal:1000000, tokensUsed:125430,
        prepaidAmount:5000, consumedAmount:627.15, pricePerToken:0.005,
        billingRecords:[], consumptionRecords:[]
      };
      Store.save();
    }
    // 确保 notifications 集合存在（消息通知系统）
    if(!Store.db.notifications){
      Store.db.notifications = [];
      Store.save();
    }
    Store.ensureWorkspaceDefaults();
    await Store.syncInviteCodesFromServer();
  },

  ensureWorkspaceDefaults(){
    if(!Store.db || !Store.db.settings) return;
    Store.applyBrandMigration();
    Store.normalizeDemoEnterprises();
    Store.db.enterprises = Store.db.enterprises || [];
    Store.db.enterprises.forEach(e=>{
      if(!e.workspaceType){
        e.workspaceType = (e.id==='ent_001' || e.id==='ent_002') ? 'demo' : 'enterprise';
      }
      if(e.workspaceType==='demo') e.isDemo = true;
    });
    if(!Store.db.settings.inviteCodes){
      Store.db.settings.inviteCodes = [
        { code:'WIN-DEMO-2026', type:'gift', plan:'personal_trial', planName:'个人体验版', sourceChannel:'社群内测', campaignName:'默认演示', maxUses:20, usedCount:0, aiCallQuota:Store.PERSONAL_TRIAL_AI_QUOTA, searchQuota:Store.PERSONAL_TRIAL_SEARCH_QUOTA, customerLimit:Store.PERSONAL_TRIAL_CUSTOMER_LIMIT, expiresAt:'', status:'active', remark:'内测赠送码；发放后15天内有效', createdAt:Utils.now(), createdBy:'system' },
        { code:'WIN-STD-2026', type:'paid', plan:'personal_standard', planName:'个人标准版', sourceChannel:'付费开通', campaignName:'标准版', maxUses:100, usedCount:0, aiCallQuota:1000, customerLimit:500, expiresAt:'2026-12-31', status:'active', remark:'标准开通码', createdAt:Utils.now(), createdBy:'system' },
        { code:'CXN-INTERNAL', type:'internal', plan:'personal_unlimited', planName:'内部测试版', sourceChannel:'内部测试', campaignName:'内部', maxUses:999, usedCount:0, aiCallQuota:999999, customerLimit:99999, expiresAt:'2027-12-31', status:'active', remark:'内部测试', createdAt:Utils.now(), createdBy:'system' },
      ];
    }
    Store.db.settings.inviteActivations = Store.db.settings.inviteActivations || [];
    Store.db.settings.aiUsageEvents = Store.db.settings.aiUsageEvents || [];
    Store.db.settings.searchUsageEvents = Store.db.settings.searchUsageEvents || [];
    Store.db.settings.inviteCodes.forEach(c=>{
      c.sourceChannel = c.sourceChannel || (c.type==='paid' ? '付费开通' : c.type==='internal' ? '内部测试' : '社群内测');
      c.campaignName = c.campaignName || c.remark || '默认活动';
      c.createdAt = c.createdAt || Utils.now();
      c.createdBy = c.createdBy || 'system';
      c.status = c.status || 'active';
      if(c.searchQuota === undefined) c.searchQuota = c.type==='internal' ? 99999 : (c.type==='paid' ? 300 : 50);
    });
    Store.normalizePersonalTrialBenefits();
    const deepseek = Store.db.settings.aiModels?.providers?.find(p=>p.id==='deepseek');
    if(deepseek && (deepseek.name==='DeepSeek V3' || deepseek.model==='deepseek-chat')){
      deepseek.name = '企业自配 DeepSeek V4-Flash';
      deepseek.model = 'deepseek-v4-flash';
      deepseek.baseUrl = deepseek.baseUrl || 'https://api.deepseek.com/v1';
    }
    Store.save();
  },

  captureAcquisition(){
    try{
      const params = new URLSearchParams(location.search || '');
      const acq = {
        sourceChannel: params.get('src') || params.get('source') || params.get('channel') || '',
        campaignName: params.get('campaign') || params.get('campaign_id') || '',
        inviteCode: (params.get('invite') || params.get('code') || '').toUpperCase(),
        expertEntry: params.get('expert') || '',
        landingPath: location.pathname + location.search,
        capturedAt: Utils.now(),
      };
      if(acq.sourceChannel || acq.campaignName || acq.inviteCode || acq.expertEntry){
        localStorage.setItem(Store.ACQ_KEY, JSON.stringify(acq));
      }
    }catch(e){}
  },
  getAcquisition(){
    try{ return JSON.parse(localStorage.getItem(Store.ACQ_KEY) || '{}'); }catch(e){ return {}; }
  },

  dateOnlyAfterDays(base, days){
    const d = new Date(base || Utils.now());
    const valid = Number.isNaN(d.getTime()) ? new Date() : d;
    valid.setDate(valid.getDate() + Number(days||0));
    return valid.toISOString().slice(0,10);
  },

  inviteExpiresAtFromIssue(item={}){
    return Store.dateOnlyAfterDays(item.issuedAt || item.createdAt || Utils.now(), Store.PERSONAL_TRIAL_INVITE_DAYS);
  },

  cloudExternalId(){
    const user = Store.currentUser();
    return user?.identityProvider === 'wechat_oauth' && user.externalId ? user.externalId : (Store.cloud.externalId || '');
  },
  canCloudSync(){
    const user = Store.currentUser();
    return Store.cloud.enabled &&
      user?.identityProvider === 'wechat_oauth' &&
      !!user.externalId &&
      Store.isPersonalWorkspace();
  },
  cloudConversationThreadKey(){
    const ent = Store.currentEnterprise();
    const type = ent?.workspaceType || 'workspace';
    return `${type}:${Store.session.enterpriseId || 'default'}`;
  },
  async restoreCloudWorkspace(profile={}){
    const externalId = String(profile.externalId || '').trim();
    if(!externalId || typeof fetch==='undefined') return { ok:false, reason:'missing_external_id' };
    Store.cloud.enabled = true;
    Store.cloud.externalId = externalId;
    try{
      const resp = await fetch('/api/cloud/workspace', { credentials:'include', cache:'no-store' });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success) return { ok:false, reason:data?.error || `http_${resp.status}` };
      if(data.data?.exists && data.data.workspaceData){
        Store.applyCloudWorkspace(data.data.workspaceData, profile);
        Store.cloud.restored = true;
        return { ok:true, restored:true, updatedAt:data.data.updatedAt || '' };
      }
      Store.cloud.restored = true;
      Store.queueCloudSync('init-empty-cloud');
      return { ok:true, restored:false };
    }catch(e){
      console.warn('[cloud] restore failed:', e.message);
      return { ok:false, reason:e.message || 'restore_failed' };
    }
  },
  applyCloudWorkspace(workspaceData, profile={}){
    const base = Seed.build();
    const localSettings = Store.db?.settings || {};
    const cloud = workspaceData && typeof workspaceData==='object' ? workspaceData : {};
    Store._applyingCloud = true;
    try{
      Store.db = base;
      ['enterprises','orgUnits','users','customers','contacts','opportunities','followups','schedules','notifications'].forEach(name=>{
        if(Array.isArray(cloud[name])) Store.db[name] = cloud[name];
      });
      Store.db.settings = {
        ...base.settings,
        ...(cloud.settings || {}),
        inviteCodes: localSettings.inviteCodes || base.settings.inviteCodes || [],
        inviteActivations: localSettings.inviteActivations || [],
      };
      Store.ensureWorkspaceDefaults();
      const externalId = String(profile.externalId || Store.cloud.externalId || '').trim();
      const candidates = Store.collection('users').filter(u=>u.identityProvider==='wechat_oauth' && u.externalId===externalId);
      const personal = candidates.find(u=>Store.get('enterprises', u.enterpriseId)?.workspaceType==='personal');
      const target = personal || candidates.find(u=>u.enterpriseId==='ent_001') || candidates[0];
      if(target){
        Store.session = {
          enterpriseId: target.enterpriseId,
          userId: target.id,
          loginAt: Utils.now(),
          authProvider:'wechat_oauth',
        };
        Store.saveSession();
      }
      localStorage.setItem(Store.KEY, JSON.stringify(Store.db));
    }finally{
      Store._applyingCloud = false;
    }
  },
  cloudWorkspaceSnapshot(){
    const clone = JSON.parse(JSON.stringify(Store.db || {}));
    const scrub = (value)=>{
      if(Array.isArray(value)) return value.map(scrub);
      if(value && typeof value==='object'){
        Object.keys(value).forEach(key=>{
          if(/apiKey|password|token|secret|authorization|cookie/i.test(key)){
            value[key] = '';
          }else{
            value[key] = scrub(value[key]);
          }
        });
      }
      return value;
    };
    scrub(clone);
    if(clone.settings){
      delete clone.settings.inviteCodes;
      delete clone.settings.inviteActivations;
      if(clone.settings.aiModels?.providers){
        clone.settings.aiModels.providers.forEach(p=>{ p.apiKey=''; });
      }
    }
    return clone;
  },
  queueCloudSync(reason='change'){
    if(Store._applyingCloud || !Store.canCloudSync()) return;
    clearTimeout(Store.cloud.syncTimer);
    Store.cloud.syncTimer = setTimeout(()=>Store.flushCloudWorkspace(reason), 1200);
  },
  async flushCloudWorkspace(reason='change'){
    if(Store.cloud.syncing || !Store.canCloudSync()) return { ok:false, reason:'not_ready' };
    Store.cloud.syncing = true;
    try{
      const resp = await fetch('/api/cloud/workspace', {
        method:'PUT',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          workspaceVersion: Date.now(),
          reason,
          workspaceData: Store.cloudWorkspaceSnapshot(),
        }),
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success) throw new Error(data?.error || `http_${resp.status}`);
      return { ok:true };
    }catch(e){
      console.warn('[cloud] workspace sync failed:', e.message);
      return { ok:false, reason:e.message || 'sync_failed' };
    }finally{
      Store.cloud.syncing = false;
    }
  },

  normalizePersonalTrialBenefits(){
    if(!Store.db?.enterprises) return;
    const inviteMap = new Map((Store.db.settings?.inviteCodes||[]).map(c=>[String(c.code||'').toUpperCase(), c]));
    Store.db.enterprises.forEach(ent=>{
      if(ent.workspaceType!=='personal' || ent.license!=='personal_trial') return;
      const invite = inviteMap.get(String(ent.inviteCode||'').toUpperCase());
      ent.aiCallQuota = Number(invite?.aiCallQuota || Store.PERSONAL_TRIAL_AI_QUOTA);
      ent.searchQuota = Number(invite?.searchQuota || Store.PERSONAL_TRIAL_SEARCH_QUOTA);
      ent.customerLimit = Number(invite?.customerLimit || Store.PERSONAL_TRIAL_CUSTOMER_LIMIT);
      ent.expireDate = invite?.expiresAt || ent.expireDate || Store.dateOnlyAfterDays(ent.createdAt || Utils.now(), Store.PERSONAL_TRIAL_INVITE_DAYS);
    });
  },

  isWechatExperienceUser(user=Store.currentUser()){
    return ['wechat_mock','wechat_oauth'].includes(user?.identityProvider);
  },

  ensureDemoTrial(user){
    if(!user || !Store.isWechatExperienceUser(user)) return user;
    const now = Utils.now();
    const startedAt = user.trialStartedAt || user.createdAt || now;
    const startDate = new Date(startedAt);
    const validStart = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
    const expires = new Date(validStart.getTime());
    expires.setDate(expires.getDate() + Store.DEMO_TRIAL_DAYS);
    user.trialStartedAt = startedAt;
    user.trialDays = Store.DEMO_TRIAL_DAYS;
    user.trialExpiresAt = user.trialExpiresAt || expires.toISOString();
    return user;
  },

  demoTrialState(user=Store.currentUser()){
    const ent = Store.currentEnterprise();
    if(!user || !ent || ent.workspaceType!=='demo' || !Store.isWechatExperienceUser(user)) return { applies:false, ok:true };
    Store.ensureDemoTrial(user);
    const expiresAt = new Date(user.trialExpiresAt);
    if(Number.isNaN(expiresAt.getTime())) return { applies:true, ok:true, daysLeft:Store.DEMO_TRIAL_DAYS, expiresAt:'' };
    const now = new Date();
    const msLeft = expiresAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    return {
      applies:true,
      ok: msLeft > 0,
      daysLeft,
      expiresAt: expiresAt.toISOString().slice(0,10),
      message: msLeft > 0
        ? `演示体验还剩 ${daysLeft} 天`
        : '3天演示体验期已结束。使用邀请码开通个人空间后，可继续导入客户并调用 AI 销售分析。',
    };
  },

  personalWorkspaceExpiryState(ent=Store.currentEnterprise()){
    if(!ent || ent.workspaceType!=='personal' || ent.license!=='personal_trial') return { applies:false, ok:true };
    if(!ent.expireDate) return { applies:true, ok:true, daysLeft:null };
    const expiresAt = new Date(ent.expireDate + 'T23:59:59');
    if(Number.isNaN(expiresAt.getTime())) return { applies:true, ok:true, daysLeft:null };
    const msLeft = expiresAt.getTime() - Date.now();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(ent.expireDate + 'T00:00:00');
    const daysLeft = Math.max(0, Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      applies:true,
      ok: msLeft >= 0,
      daysLeft,
      expiresAt: ent.expireDate,
      message: msLeft >= 0
        ? `个人体验版还剩 ${daysLeft} 天`
        : '个人体验版使用期限已结束。请联系发放邀请码的人续期或升级权益。',
    };
  },

  applyBrandMigration(){
    const replaceText = (s)=>{
      return String(s)
        .replaceAll('AI赢单', 'AI销冠')
        .replaceAll('AI 赢单', 'AI销冠')
        .replaceAll('销售罗盘', 'AI销冠')
        .replaceAll('夏智科技有限公司', '星瀚增长科技有限公司')
        .replaceAll('夏智科技', '星瀚增长')
        .replaceAll('云腾信息技术有限公司', '北辰数智科技有限公司')
        .replaceAll('云腾信息', '北辰数智')
        .replaceAll('xiazhi', 'xinghan')
        .replaceAll('yunteng', 'beichen')
        .replaceAll('夏经理', '林经理')
        .replaceAll('李助理', '陈顾问')
        .replaceAll('王总监', '周总监')
        .replaceAll('赵架构师', '许架构师')
        .replaceAll('刘总', '赵总');
    };
    const rewrite = (value)=>{
      if(typeof value === 'string') return replaceText(value);
      if(Array.isArray(value)) return value.map(rewrite);
      if(value && typeof value === 'object'){
        Object.keys(value).forEach(k=>{ value[k] = rewrite(value[k]); });
      }
      return value;
    };
    const demoIds = new Set(['ent_001','ent_002']);
    if(Store.db.settings){
      ['orgName','owner'].forEach(k=>{
        if(typeof Store.db.settings[k]==='string') Store.db.settings[k] = replaceText(Store.db.settings[k]);
      });
    }
    (Store.db.enterprises||[]).forEach(e=>{
      if(demoIds.has(e.id) || /夏智|云腾|xiazhi|yunteng/.test(JSON.stringify(e))) rewrite(e);
    });
    ['orgUnits','users','customers','contacts','opportunities','followups','schedules','notifications'].forEach(name=>{
      (Store.db[name]||[]).forEach(item=>{
        if(demoIds.has(item.enterpriseId)) rewrite(item);
      });
    });
  },

  normalizeDemoEnterprises(){
    if(!Store.db) return;
    Store.db.enterprises = Store.db.enterprises || [];
    const patches = {
      ent_001: {
        name:'星瀚增长科技有限公司',
        shortName:'星瀚增长',
        contactName:'林经理',
        contactEmail:'admin@xinghan.com',
        workspaceType:'demo',
        isDemo:true,
      },
      ent_002: {
        name:'北辰数智科技有限公司',
        shortName:'北辰数智',
        contactName:'赵总',
        contactEmail:'admin@beichen.com',
        workspaceType:'demo',
        isDemo:true,
      },
    };
    Object.entries(patches).forEach(([id, patch])=>{
      const ent = Store.get('enterprises', id);
      if(ent) Object.assign(ent, patch);
    });
  },

  // 兼容 v1 数据（无 enterpriseId 的旧数据自动关联 ent_001）
  migrateV1(){
    const collections = ['customers','contacts','opportunities','followups','schedules'];
    let dirty = false;
    collections.forEach(name=>{
      const arr = Store.db[name];
      if(arr && arr.length && !arr[0].enterpriseId){
        arr.forEach(item=>{ if(!item.enterpriseId){ item.enterpriseId='ent_001'; dirty=true; } });
      }
    });
    if(dirty) Store.save();
  },

  // 持久化（本地模式 = localStorage；API 模式 = no-op，数据通过各 CRUD 方法同步）
  save(){
    if(Store.mode === 'local'){
      localStorage.setItem(Store.KEY, JSON.stringify(Store.db));
      Store.queueCloudSync('store-save');
    }
  },

  reset(){
    if(Store.mode === 'api'){
      // API 模式下不重置（需后端管理），仅重新拉取
      API.fetchAll().then(data=>{ Store.db = data; App.render(); }).catch(()=>{});
      Toast.show('已从服务器刷新数据','success');
      return;
    }
    Store.db = Seed.build();
    Store.save();
  },

  // ===== 会话管理 =====
  initSession(){
    const saved = localStorage.getItem(Store.SESSION_KEY);
    if(saved){
      try{ Store.session = JSON.parse(saved); }catch(e){}
    }
  },
  saveSession(){
    localStorage.setItem(Store.SESSION_KEY, JSON.stringify(Store.session));
  },
  clearSession(){
    Store.session = { enterpriseId: null, userId: null, loginAt: null };
    localStorage.removeItem(Store.SESSION_KEY);
  },
  isLoggedIn(){
    return !!(Store.session.enterpriseId && Store.session.userId);
  },
  currentUser(){
    return Store.session.userId ? Store.get('users', Store.session.userId) : null;
  },
  currentEnterprise(){
    return Store.session.enterpriseId ? Store.get('enterprises', Store.session.enterpriseId) : null;
  },
  currentEnterpriseId(){
    return Store.session.enterpriseId;
  },
  currentWorkspaceType(){
    const ent = Store.currentEnterprise();
    return ent?.workspaceType || (ent?.isDemo ? 'demo' : 'enterprise');
  },
  isDemoWorkspace(){
    return Store.currentWorkspaceType()==='demo';
  },
  isPersonalWorkspace(){
    return Store.currentWorkspaceType()==='personal';
  },
  canUseOwnData(){
    return !Store.isDemoWorkspace();
  },
  currentOwnerName(){
    return Store.currentUser()?.name || Store.db.settings.owner || '';
  },
  isAdmin(){
    const u = Store.currentUser();
    return u && (u.role==='admin' || u.role==='superadmin');
  },

  inviteCodes(){
    Store.ensureWorkspaceDefaults();
    return Store.db.settings.inviteCodes || [];
  },
  async syncInviteCodesFromServer(){
    if(typeof fetch==='undefined') return { ok:false, count:0, error:'当前浏览器不支持联网同步邀请码台账' };
    try{
      let resp = await fetch('/api/invite-ledger/codes', { cache:'no-store' });
      let data = await resp.json().catch(()=>null);
      if(!resp.ok || !Array.isArray(data?.data?.codes)){
        resp = await fetch('data/invite-ledger.json', { cache:'no-store' });
        data = await resp.json().catch(()=>null);
        if(Array.isArray(data?.codes)) data = { data:{ codes:data.codes } };
      }
      const incoming = Array.isArray(data?.data?.codes) ? data.data.codes : [];
      if(!resp.ok || !incoming.length) return { ok:false, count:0, error:'没有从后端台账读取到邀请码' };
      Store.ensureWorkspaceDefaults();
      const existing = new Map(Store.db.settings.inviteCodes.map(c=>[String(c.code||'').toUpperCase(), c]));
      let changed = false;
      incoming.forEach(raw=>{
        const code = String(raw.code||'').toUpperCase();
        if(!code) return;
        const item = {
          code,
          type: raw.type || 'gift',
          plan: raw.plan || 'personal_trial',
          planName: raw.planName || '个人体验版',
          sourceChannel: raw.sourceChannel || '社群内测',
          campaignName: raw.campaignName || '首批体验',
          maxUses: Number(raw.maxUses||1),
          usedCount: Number(raw.usedCount||0),
          aiCallQuota: Number(raw.aiCallQuota||Store.PERSONAL_TRIAL_AI_QUOTA),
          searchQuota: Number(raw.searchQuota||Store.PERSONAL_TRIAL_SEARCH_QUOTA),
          customerLimit: Number(raw.customerLimit||Store.PERSONAL_TRIAL_CUSTOMER_LIMIT),
          expiresAt: raw.expiresAt || (raw.issuedAt ? Store.inviteExpiresAtFromIssue(raw) : ''),
          status: ['disabled','issued','activated'].includes(raw.status) ? raw.status : 'active',
          remark: raw.remark || 'Excel台账批量码',
          createdAt: raw.createdAt || Utils.now(),
          createdBy: raw.createdBy || 'invite-ledger',
          issuedAt: raw.issuedAt || '',
          activatedAt: raw.activatedAt || '',
        };
        if(existing.has(code)){
          const old = existing.get(code);
          const before = JSON.stringify({
            usedCount:old.usedCount,maxUses:old.maxUses,aiCallQuota:old.aiCallQuota,searchQuota:old.searchQuota,
            customerLimit:old.customerLimit,expiresAt:old.expiresAt,sourceChannel:old.sourceChannel,campaignName:old.campaignName,
            planName:old.planName,remark:old.remark
          });
          old.usedCount = Math.max(Number(old.usedCount||0), item.usedCount);
          old.maxUses = item.maxUses;
          old.aiCallQuota = item.aiCallQuota;
          old.searchQuota = item.searchQuota;
          old.customerLimit = item.customerLimit;
          old.expiresAt = item.expiresAt;
          old.sourceChannel = item.sourceChannel;
          old.campaignName = item.campaignName;
          old.planName = item.planName;
          old.remark = item.remark;
          const after = JSON.stringify({
            usedCount:old.usedCount,maxUses:old.maxUses,aiCallQuota:old.aiCallQuota,searchQuota:old.searchQuota,
            customerLimit:old.customerLimit,expiresAt:old.expiresAt,sourceChannel:old.sourceChannel,campaignName:old.campaignName,
            planName:old.planName,remark:old.remark
          });
          if(before !== after) changed = true;
        }else{
          Store.db.settings.inviteCodes.push(item);
          changed = true;
        }
      });
      if(changed) Store.save();
      return { ok:true, count:incoming.length, changed };
    }catch(e){
      return { ok:false, count:0, error:e.message || '同步邀请码台账失败' };
    }
  },
  inviteActivations(){
    Store.ensureWorkspaceDefaults();
    return Store.db.settings.inviteActivations || [];
  },
  findInviteCode(code){
    const normalized = String(code||'').trim().toUpperCase();
    return Store.inviteCodes().find(c=>String(c.code).toUpperCase()===normalized) || null;
  },
  validateInviteCode(code){
    const item = Store.findInviteCode(code);
    if(!item) return { ok:false, message:'邀请码不存在' };
    if(item.status === 'disabled') return { ok:false, message:'邀请码已停用' };
    const expiresAt = item.expiresAt || (item.issuedAt ? Store.inviteExpiresAtFromIssue(item) : '');
    if(expiresAt && new Date(expiresAt+'T23:59:59') < new Date()) return { ok:false, message:'邀请码已过期' };
    if(Number(item.maxUses||0)>0 && Number(item.usedCount||0)>=Number(item.maxUses||0)) return { ok:false, message:'邀请码使用次数已用完' };
    return { ok:true, item };
  },
  generateInviteCodes({ prefix='AIXG', count=1, type='gift', plan='personal_trial', planName='个人体验版', sourceChannel='社群内测', campaignName='体验活动', maxUses=1, aiCallQuota=Store.PERSONAL_TRIAL_AI_QUOTA, searchQuota=Store.PERSONAL_TRIAL_SEARCH_QUOTA, customerLimit=Store.PERSONAL_TRIAL_CUSTOMER_LIMIT, expiresAt='', remark='' }={}){
    Store.ensureWorkspaceDefaults();
    const codes = [];
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeOne = ()=>{
      let body = '';
      for(let i=0;i<8;i++) body += alphabet[Math.floor(Math.random()*alphabet.length)];
      return `${String(prefix||'AIXG').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'AIXG'}-${body.slice(0,4)}-${body.slice(4)}`;
    };
    for(let i=0;i<Number(count||1);i++){
      let code = makeOne();
      while(Store.findInviteCode(code)) code = makeOne();
      const item = {
        code, type, plan, planName, sourceChannel, campaignName,
        maxUses:Number(maxUses||1), usedCount:0,
        aiCallQuota:Number(aiCallQuota||0), searchQuota:Number(searchQuota||0), customerLimit:Number(customerLimit||0),
        expiresAt, status:'active', remark: remark || '个人体验版：发放后15天内有效',
        createdAt:Utils.now(), createdBy:Store.currentUser()?.name || 'local-admin',
      };
      Store.db.settings.inviteCodes.push(item);
      codes.push(item);
    }
    Store.save();
    Store.reportInviteCodesGenerated(codes);
    return codes;
  },
  inviteUsageSummary(){
    const activations = Store.inviteActivations();
    const usageEvents = Store.db.settings.aiUsageEvents || [];
    const searchEvents = Store.db.settings.searchUsageEvents || [];
    return Store.inviteCodes().map(code=>{
      const acts = activations.filter(a=>a.code===code.code);
      const userIds = new Set(acts.map(a=>a.userId));
      const enterpriseIds = new Set(acts.map(a=>a.enterpriseId));
      const aiCalls = usageEvents.filter(e=>userIds.has(e.userId) || enterpriseIds.has(e.enterpriseId));
      const searches = searchEvents.filter(e=>userIds.has(e.userId) || enterpriseIds.has(e.enterpriseId));
      const customers = Store.collection('customers').filter(c=>enterpriseIds.has(c.enterpriseId));
      return { code, activations:acts, aiCalls, searches, customers };
    });
  },
  activatePersonalWorkspace({ code, name, account, password, phone, sourceChannel, campaignName }){
    if(Store.mode==='api') throw new Error('云端模式请调用后端邀请码接口开通');
    const check = Store.validateInviteCode(code);
    if(!check.ok) throw new Error(check.message);
    name = String(name||'').trim();
    account = String(account||'').trim();
    password = String(password||'').trim();
    phone = String(phone||'').trim();
    if(!name) throw new Error('请填写姓名');
    if(!account) throw new Error('请填写登录账号');
    if(!password || password.length<4) throw new Error('登录密码至少4位');

    const invite = check.item;
    const acq = Store.getAcquisition();
    const entId = Utils.uid('per');
    const orgId = Utils.uid('org');
    const userId = Utils.uid('usr');
    const planName = invite.planName || '个人版';
    const expiresAt = invite.expiresAt || (invite.issuedAt ? Store.inviteExpiresAtFromIssue(invite) : Store.dateOnlyAfterDays(Utils.now(), Store.PERSONAL_TRIAL_INVITE_DAYS));

    Store.addEnterprise({
      id: entId,
      name: `${name}的个人销售空间`,
      shortName: `${name}个人版`,
      industry: '其他',
      contactName: name,
      contactPhone: phone,
      contactEmail: '',
      address: '',
      status: 'active',
      workspaceType: 'personal',
      license: invite.plan || 'personal_trial',
      planName,
      maxUsers: 1,
      expireDate: expiresAt,
      inviteCode: invite.code,
      sourceChannel: sourceChannel || invite.sourceChannel || acq.sourceChannel || '',
      campaignName: campaignName || invite.campaignName || acq.campaignName || '',
      aiCallQuota: Number(invite.aiCallQuota||0),
      aiCallUsed: 0,
      searchQuota: Number(invite.searchQuota||0),
      searchUsed: 0,
      customerLimit: Number(invite.customerLimit||0),
      remark: `邀请码开通：${invite.type || 'gift'}`
    });
    Store.addOrgUnit({
      id: orgId,
      enterpriseId: entId,
      name: '个人销售空间',
      parentId: null,
      leaderId: userId,
      sort: 1,
      desc: '个人版默认空间',
    });
    Store.insert('users', {
      id: userId,
      enterpriseId: entId,
      name,
      account,
      password,
      phone,
      email: '',
      role: 'admin',
      orgUnitId: orgId,
      title: '个人用户',
      status: 'active',
      avatar: name.charAt(0),
      identityProvider: Store.currentUser()?.identityProvider || 'account',
      externalId: Store.currentUser()?.externalId || '',
      inviteCode: invite.code,
      sourceChannel: sourceChannel || invite.sourceChannel || acq.sourceChannel || '',
      campaignName: campaignName || invite.campaignName || acq.campaignName || '',
      lastLoginAt: Utils.now(),
    });
    invite.usedCount = Number(invite.usedCount||0) + 1;
    if(Number(invite.maxUses||0)>0 && Number(invite.usedCount||0)>=Number(invite.maxUses||0)) invite.status = 'activated';
    invite.lastUsedAt = Utils.now();
    invite.lastUsedBy = name;
    const activation = {
      id:Utils.uid('act'),
      code:invite.code,
      type:invite.type || '',
      plan:invite.plan || '',
      planName,
      sourceChannel:sourceChannel || invite.sourceChannel || acq.sourceChannel || '',
      campaignName:campaignName || invite.campaignName || acq.campaignName || '',
      enterpriseId:entId,
      userId,
      userName:name,
      account,
      phone,
      activatedAt:Utils.now(),
    };
    Store.db.settings.inviteActivations.push(activation);
    Store.session = { enterpriseId: entId, userId, loginAt: Utils.now() };
    Store.saveSession();
    Store.save();
    Store.reportInviteActivation(invite, activation);
    return { enterprise: Store.enterprise(entId), user: Store.user(userId), invite };
  },
  reportInviteCodesGenerated(codes){
    if(typeof fetch==='undefined' || !Array.isArray(codes) || !codes.length) return;
    try{
      fetch('/api/invite-ledger/import', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ codes }),
        keepalive:true,
      }).catch(()=>{});
    }catch(e){}
  },
  reportInviteIssued(code, inviteLink='', issuedTo=''){
    const normalized = String(code||'').toUpperCase();
    if(!normalized || typeof fetch==='undefined') return;
    const item = Store.findInviteCode(normalized);
    if(item){
      item.issuedAt = item.issuedAt || Utils.now();
      item.expiresAt = item.expiresAt || Store.inviteExpiresAtFromIssue(item);
      item.issuedBy = Store.currentUser()?.name || '';
      item.issuedTo = issuedTo || item.issuedTo || '';
      if(item.status === 'active') item.status = 'issued';
      Store.save();
    }
    try{
      fetch('/api/invite-ledger/issue', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          code: normalized,
          inviteLink,
          issuedBy: Store.currentUser()?.name || 'local-admin',
          issuedTo,
        }),
        keepalive:true,
      }).catch(()=>{});
    }catch(e){}
  },
  reportInviteActivation(invite, activation){
    if(!invite?.code || typeof fetch==='undefined') return;
    try{
      fetch('/api/invite-ledger/activate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          code: invite.code,
          usedCount: invite.usedCount,
          userName: activation.userName,
          account: activation.account,
          enterpriseId: activation.enterpriseId,
          userId: activation.userId,
          activatedAt: activation.activatedAt,
        }),
        keepalive:true,
      }).catch(()=>{});
    }catch(e){}
  },

  loginWithWechatDemo(){
    if(Store.mode==='api') throw new Error('云端模式请接入微信OAuth后端接口');
    Store.ensureWorkspaceDefaults();
    const acq = Store.getAcquisition();
    let externalId = localStorage.getItem('aixg_mock_wechat_openid');
      if(!externalId){
      externalId = 'mock_openid_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
      localStorage.setItem('aixg_mock_wechat_openid', externalId);
    }
    let user = Store.collection('users').find(u=>u.identityProvider==='wechat_mock' && u.externalId===externalId && u.enterpriseId==='ent_001');
    if(!user){
      user = Store.insert('users', {
        id:Utils.uid('usr'),
        enterpriseId:'ent_001',
        name:'微信体验用户',
        account:'wx_'+externalId.slice(-8),
        password:'',
        phone:'',
        email:'',
        role:'sales',
        orgUnitId:'org_002',
        title:'社群体验用户',
        status:'active',
        avatar:'微',
        identityProvider:'wechat_mock',
        externalId,
        sourceChannel:acq.sourceChannel || '社群体验',
        campaignName:acq.campaignName || '',
        inviteCode:acq.inviteCode || '',
        aiCallQuota:20,
        aiCallUsed:0,
        searchQuota:5,
        searchUsed:0,
        lastLoginAt:Utils.now(),
        createdAt:Utils.now(),
      });
      Store.ensureDemoTrial(user);
    }else{
      Store.ensureDemoTrial(user);
      Store.update('users', user.id, { lastLoginAt:Utils.now(), sourceChannel:user.sourceChannel || acq.sourceChannel || '社群体验', campaignName:user.campaignName || acq.campaignName || '' });
    }
    Store.session = { enterpriseId:'ent_001', userId:user.id, loginAt:Utils.now(), authProvider:'wechat_mock' };
    Store.saveSession();
    Store.save();
    return Store.user(user.id);
  },

  loginWithWechatOAuth(profile={}){
    Store.ensureWorkspaceDefaults();
    const acq = Store.getAcquisition();
    const externalId = String(profile.externalId || profile.unionidHash || profile.openidHash || '').trim();
    if(!externalId) throw new Error('微信授权信息缺少用户标识');
    const sourceChannel = profile.sourceChannel || acq.sourceChannel || '微信授权';
    const campaignName = profile.campaignName || acq.campaignName || '';
    const inviteCode = profile.inviteCode || acq.inviteCode || '';
    let user = Store.collection('users').find(u=>
      u.identityProvider==='wechat_oauth' &&
      u.externalId===externalId &&
      u.enterpriseId==='ent_001'
    );
    if(!user){
      const name = String(profile.nickname || '微信用户').trim().slice(0,30) || '微信用户';
      user = Store.insert('users', {
        id:Utils.uid('usr'),
        enterpriseId:'ent_001',
        name,
        account:'wx_'+externalId.replace(/[^A-Za-z0-9]/g,'').slice(-10),
        password:'',
        phone:'',
        email:'',
        role:'sales',
        orgUnitId:'org_002',
        title:'微信体验用户',
        status:'active',
        avatar:'微',
        identityProvider:'wechat_oauth',
        externalId,
        sourceChannel,
        campaignName,
        inviteCode,
        aiCallQuota:20,
        aiCallUsed:0,
        searchQuota:5,
        searchUsed:0,
        lastLoginAt:Utils.now(),
        createdAt:Utils.now(),
      });
      Store.ensureDemoTrial(user);
    }else{
      Store.ensureDemoTrial(user);
      Store.update('users', user.id, {
        name:String(profile.nickname || user.name || '微信用户').trim().slice(0,30) || user.name,
        lastLoginAt:Utils.now(),
        sourceChannel:user.sourceChannel || sourceChannel,
        campaignName:user.campaignName || campaignName,
        inviteCode:user.inviteCode || inviteCode,
      });
    }
    Store.session = { enterpriseId:'ent_001', userId:user.id, loginAt:Utils.now(), authProvider:'wechat_oauth' };
    Store.saveSession();
    Store.save();
    return Store.user(user.id);
  },

  switchToDemoWorkspace(){
    const user = Store.currentUser();
    let target = Store.collection('users').find(u=>u.enterpriseId==='ent_001' && u.identityProvider===user?.identityProvider && u.externalId && u.externalId===user.externalId);
    if(!target) target = Store.collection('users').find(u=>u.enterpriseId==='ent_001' && u.account==='sales1');
    Store.session = { enterpriseId:'ent_001', userId:target.id, loginAt:Utils.now(), authProvider:target.identityProvider || 'account' };
    Store.saveSession();
    return target;
  },

  checkAiQuota(){
    const user = Store.currentUser();
    const ent = Store.currentEnterprise();
    if(!user || !ent) return { ok:true };
    if(ent.workspaceType==='personal'){
      const expiry = Store.personalWorkspaceExpiryState(ent);
      if(!expiry.ok) return { ok:false, message:expiry.message };
      const quota = Number(ent.aiCallQuota || 0);
      const used = Number(ent.aiCallUsed || 0);
      if(quota > 0 && used >= quota){
        return { ok:false, message:'当前个人空间 AI 调用额度已用完，请联系发放邀请码的人升级额度。' };
      }
    }
    if(ent.workspaceType==='demo' && Store.isWechatExperienceUser(user)){
      const trial = Store.demoTrialState(user);
      if(!trial.ok) return { ok:false, message:trial.message };
      const quota = Number(user.aiCallQuota || 0);
      const used = Number(user.aiCallUsed || 0);
      if(quota > 0 && used >= quota){
        return { ok:false, message:'演示体验 AI 调用额度已用完。使用邀请码开通个人空间后，可继续导入客户并调用 AI 销售分析。' };
      }
    }
    return { ok:true };
  },

  checkSearchQuota(){
    const user = Store.currentUser();
    const ent = Store.currentEnterprise();
    if(!user || !ent) return { ok:true };
    if(ent.workspaceType==='personal'){
      const expiry = Store.personalWorkspaceExpiryState(ent);
      if(!expiry.ok) return { ok:false, message:expiry.message };
      const quota = Number(ent.searchQuota || 0);
      const used = Number(ent.searchUsed || 0);
      if(quota > 0 && used >= quota){
        return { ok:false, message:'当前个人空间联网检索额度已用完，请联系发放邀请码的人升级额度。' };
      }
    }
    if(ent.workspaceType==='demo' && Store.isWechatExperienceUser(user)){
      const trial = Store.demoTrialState(user);
      if(!trial.ok) return { ok:false, message:trial.message };
      const quota = Number(user.searchQuota || 0);
      const used = Number(user.searchUsed || 0);
      if(quota > 0 && used >= quota){
        return { ok:false, message:'演示体验联网检索额度已用完。使用邀请码开通个人空间后，可继续使用客户外部情报检索。' };
      }
    }
    return { ok:true };
  },

  checkCustomerCapacity(extra=1){
    const ent = Store.currentEnterprise();
    if(!ent || ent.workspaceType!=='personal') return { ok:true };
    const limit = Number(ent.customerLimit || 0);
    if(limit > 0 && Store.customers().length + Number(extra||1) > limit){
      return { ok:false, message:`当前个人版客户容量为 ${limit} 个，已达到上限。请联系发放邀请码的人升级容量。` };
    }
    return { ok:true };
  },

  recordAiUsage({ model='', scope='', expertId='', usage=null }={}){
    if(!Store.db?.settings) return;
    const user = Store.currentUser();
    const ent = Store.currentEnterprise();
    const totalTokens = Number(usage?.total_tokens || 0);
    Store.db.settings.aiUsageEvents = Store.db.settings.aiUsageEvents || [];
    Store.db.settings.aiUsageEvents.push({
      id:Utils.uid('use'),
      at:Utils.now(),
      userId:user?.id || '',
      userName:user?.name || '',
      enterpriseId:ent?.id || '',
      workspaceType:ent?.workspaceType || '',
      inviteCode:ent?.inviteCode || user?.inviteCode || '',
      sourceChannel:ent?.sourceChannel || user?.sourceChannel || '',
      campaignName:ent?.campaignName || user?.campaignName || '',
      model, scope, expertId,
      tokens:totalTokens,
    });
    if(ent && ent.workspaceType==='personal'){
      ent.aiCallUsed = Number(ent.aiCallUsed||0) + 1;
    }
    if(ent && ent.workspaceType==='demo' && Store.isWechatExperienceUser(user)){
      user.aiCallUsed = Number(user.aiCallUsed||0) + 1;
    }
    Store.save();
  },

  recordSearchUsage({ model='', expertId='', usage=null, sources=[] }={}){
    if(!Store.db?.settings) return;
    const user = Store.currentUser();
    const ent = Store.currentEnterprise();
    Store.db.settings.searchUsageEvents = Store.db.settings.searchUsageEvents || [];
    Store.db.settings.searchUsageEvents.push({
      id:Utils.uid('srch'),
      at:Utils.now(),
      userId:user?.id || '',
      userName:user?.name || '',
      enterpriseId:ent?.id || '',
      workspaceType:ent?.workspaceType || '',
      inviteCode:ent?.inviteCode || user?.inviteCode || '',
      sourceChannel:ent?.sourceChannel || user?.sourceChannel || '',
      campaignName:ent?.campaignName || user?.campaignName || '',
      model, expertId,
      tokens:Number(usage?.total_tokens || 0),
      webSearch:Number(usage?.web_search || usage?.search_count || 1),
      resultCount:Number(usage?.result_count || (sources||[]).length || 0),
      sourceDomains:(sources||[]).map(s=>s.site || '').filter(Boolean).slice(0,8),
    });
    if(ent && ent.workspaceType==='personal'){
      ent.searchUsed = Number(ent.searchUsed||0) + 1;
    }
    if(ent && ent.workspaceType==='demo' && Store.isWechatExperienceUser(user)){
      user.searchUsed = Number(user.searchUsed||0) + 1;
    }
    Store.save();
  },

  // ===== 企业 =====
  enterprises(){ return Store.collection('enterprises'); },
  enterprise(id){ return Store.get('enterprises', id); },
  addEnterprise(e){ return Store.insert('enterprises', e); },
  updateEnterprise(id, patch){ return Store.update('enterprises', id, patch); },
  findEnterpriseByName(name){
    return Store.enterprises().find(e=>e.name===name);
  },

  // ===== 组织架构（按企业隔离）=====
  orgUnits(){ return Store.collection('orgUnits').filter(o=>!Store.session.enterpriseId || o.enterpriseId===Store.session.enterpriseId); },
  orgUnit(id){ return Store.get('orgUnits', id); },
  addOrgUnit(o){ if(!o.enterpriseId) o.enterpriseId=Store.session.enterpriseId; return Store.insert('orgUnits', o); },
  updateOrgUnit(id, patch){ return Store.update('orgUnits', id, patch); },
  deleteOrgUnit(id){
    const unit = Store.orgUnit(id);
    const parentId = unit ? unit.parentId : null;
    Store.collection('orgUnits').filter(o=>o.parentId===id).forEach(o=>{ o.parentId=parentId; });
    Store.collection('users').filter(u=>u.orgUnitId===id).forEach(u=>{ u.orgUnitId=parentId; });
    Store.remove('orgUnits', id);
    // API 模式下级联更新
    if(Store.mode==='api'){
      Store.collection('orgUnits').filter(o=>o.parentId===parentId && o.id!==id).forEach(o=>{
        API.put('/api/org-units/'+o.id, { parentId }).catch(()=>{});
      });
      Store.collection('users').filter(u=>u.orgUnitId===parentId).forEach(u=>{
        API.put('/api/users/'+u.id, { orgUnitId: parentId }).catch(()=>{});
      });
    }
    return true;
  },
  orgUnitChildren(parentId){
    return Store.orgUnits().filter(o=>o.parentId===parentId).sort((a,b)=>(a.sort||0)-(b.sort||0));
  },
  orgUnitUsers(orgUnitId){
    return Store.users().filter(u=>u.orgUnitId===orgUnitId);
  },
  orgTree(){
    const roots = Store.orgUnits().filter(o=>!o.parentId).sort((a,b)=>(a.sort||0)-(b.sort||0));
    const build = (unit)=>{
      const children = Store.orgUnitChildren(unit.id);
      return {
        ...unit,
        users: Store.orgUnitUsers(unit.id),
        children: children.map(build),
      };
    };
    return roots.map(build);
  },

  // ===== 用户管理（按企业隔离）=====
  users(){ return Store.collection('users').filter(u=>!Store.session.enterpriseId || u.enterpriseId===Store.session.enterpriseId); },
  user(id){ return Store.get('users', id); },
  addUser(u){ if(!u.enterpriseId) u.enterpriseId=Store.session.enterpriseId; return Store.insert('users', u); },
  updateUser(id, patch){ return Store.update('users', id, patch); },
  deleteUser(id){ return Store.remove('users', id); },
  findUserByAccount(account, enterpriseId){
    return Store.collection('users').find(u=>u.account===account && u.enterpriseId===(enterpriseId||Store.session.enterpriseId));
  },

  // 登录（异步：API 模式调用后端验证）
  async login(account, password, enterpriseId){
    if(Store.mode === 'api'){
      try{
        const result = await API.post('/api/auth/login', { account, password, enterpriseId });
        API.setToken(result.token);
        Store.session = {
          enterpriseId: result.user.enterpriseId,
          userId: result.user.id,
          loginAt: Utils.now(),
        };
        Store.saveSession();
        // 拉取全量数据
        Store.db = await API.fetchAll();
        return result.user;
      }catch(e){
        return null;
      }
    }else{
      // 本地模式（原有逻辑）
      const user = Store.collection('users').find(u=>
        u.account===account && u.password===password && u.enterpriseId===enterpriseId && u.status==='active'
      );
      if(!user) return null;
      Store.session = { enterpriseId, userId: user.id, loginAt: Utils.now() };
      Store.saveSession();
      Store.update('users', user.id, { lastLoginAt: Utils.now() });
      return user;
    }
  },

  // 注销
  logout(){
    if(Store.mode === 'api'){
      API.del('/api/auth/logout').catch(()=>{});
      API.clearToken();
    }
    Store.clearSession();
  },

  // 企业注册（异步：API 模式调用后端注册）
  async register(data){
    if(Store.mode === 'api'){
      const result = await API.post('/api/auth/register', data);
      API.setToken(result.token);
      Store.session = {
        enterpriseId: result.enterprise.id,
        userId: result.user.id,
        loginAt: Utils.now(),
      };
      Store.saveSession();
      Store.db = await API.fetchAll();
      return result;
    }
    // 本地模式注册由 Auth.doRegister 处理
    return null;
  },

  // 通用集合操作
  collection(name){ return Store.db[name] || (Store.db[name]=[]); },

  // ---- 通用 CRUD（双模式：内存优先 + API 异步同步）----
  list(name, filterFn){
    let arr = Store.collection(name);
    if(filterFn) arr = arr.filter(filterFn);
    return arr;
  },
  get(name, id){ return Store.collection(name).find(x=>x.id===id); },
  ensureWritable(name){
    if(Store.mode==='local' && Store.OWN_DATA_COLLECTIONS.includes(name) && Store.isDemoWorkspace()){
      if(typeof Personal!=='undefined') Personal.openActivation('开通后维护自己的客户数据');
      else if(typeof Toast!=='undefined') Toast.show('演示空间不保存自有数据，请先开通个人空间','warn');
      return false;
    }
    return true;
  },
  insert(name, obj){
    if(!Store.ensureWritable(name)) return null;
    obj.id = obj.id || Utils.uid(name.slice(0,3));
    obj.createdAt = obj.createdAt || Utils.now();
    obj.updatedAt = Utils.now();
    Store.collection(name).unshift(obj);
    Store._sync(name, 'post', obj);
    return obj;
  },
  update(name, id, patch){
    if(!Store.ensureWritable(name)) return null;
    const obj = Store.get(name, id);
    if(!obj) return null;
    Object.assign(obj, patch, {updatedAt: Utils.now()});
    Store._sync(name, 'put', { id, ...patch });
    return obj;
  },
  remove(name, id){
    if(!Store.ensureWritable(name)) return false;
    const arr = Store.collection(name);
    const i = arr.findIndex(x=>x.id===id);
    if(i>=0){
      arr.splice(i,1);
      Store._sync(name, 'del', { id });
      return true;
    }
    return false;
  },

  // 内部：API 模式下异步同步到后端（乐观更新，失败仅 toast）
  _sync(name, action, payload){
    if(Store.mode !== 'api') { Store.save(); Store.queueCloudSync(`${name}:${action}`); return; }
    const path = Store.API_PATHS[name];
    if(!path) { Store.save(); return; }
    // 异步调用，不阻塞 UI
    const p = action==='post' ? API.post(path, payload)
            : action==='put'  ? API.put(path+'/'+payload.id, payload)
            : action==='del'  ? API.del(path+'/'+payload.id)
            : null;
    if(p){
      p.catch(err=>{
        console.error(`[Store] API ${action} ${name} failed:`, err.message);
        Toast.show('数据同步失败: '+err.message, 'error');
      });
    }
  },

  // ===== 客户（按企业隔离）=====
  customers(){ return Store.collection('customers').filter(c=>!Store.session.enterpriseId || c.enterpriseId===Store.session.enterpriseId); },
  customer(id){ return Store.get('customers', id); },
  addCustomer(c){ if(!c.enterpriseId) c.enterpriseId=Store.session.enterpriseId; return Store.insert('customers', c); },
  updateCustomer(id, patch){ return Store.update('customers', id, patch); },
  deleteCustomer(id){
    Store.remove('customers', id);
    return true;
  },
  findDupCustomers(name, excludeId, uscc){
    if(!name&&!uscc) return [];
    return Store.customers().filter(c=>{
      if(c.id===excludeId) return false;
      if(uscc && c.uscc===uscc) return true;
      if(name && c.name.includes(name.trim())) return true;
      return false;
    });
  },
  findCustomerByUSCC(uscc, excludeId){
    if(!uscc) return null;
    return Store.customers().find(c=>c.uscc===uscc && c.id!==excludeId) || null;
  },
  poolCustomers(){ return Store.customers().filter(c=>c.inPool); },
  myCustomers(){ return Store.customers().filter(c=>!c.inPool); },

  // ===== 联系人（按企业隔离）=====
  contacts(){ return Store.collection('contacts').filter(c=>!Store.session.enterpriseId || c.enterpriseId===Store.session.enterpriseId); },
  contact(id){ return Store.get('contacts', id); },
  addContact(c){ if(!c.enterpriseId) c.enterpriseId=Store.session.enterpriseId; return Store.insert('contacts', c); },
  updateContact(id, patch){ return Store.update('contacts', id, patch); },
  deleteContact(id){ return Store.remove('contacts', id); },
  contactsByCustomer(customerId){ return Store.contacts().filter(c=>c.customerId===customerId); },
  findDupContacts(name, mobile, excludeId){
    return Store.contacts().filter(c=>c.id!==excludeId && (
      (name && c.name.includes(name.trim())) || (mobile && c.mobile===mobile)
    ));
  },

  // ===== 商机（按企业隔离）=====
  opportunities(){ return Store.collection('opportunities').filter(o=>!Store.session.enterpriseId || o.enterpriseId===Store.session.enterpriseId); },
  opportunity(id){ return Store.get('opportunities', id); },
  addOpp(o){ if(!o.enterpriseId) o.enterpriseId=Store.session.enterpriseId; return Store.insert('opportunities', o); },
  updateOpp(id, patch){ return Store.update('opportunities', id, patch); },
  deleteOpp(id){ return Store.remove('opportunities', id); },
  oppsByCustomer(customerId){ return Store.opportunities().filter(o=>o.customerId===customerId); },
  oppsByContact(contactId){ return Store.opportunities().filter(o=>(o.contactIds||[]).includes(contactId)); },
  advanceOpp(id, toStage){
    const o = Store.opportunity(id);
    if(!o) return null;
    const patch = {stage: toStage};
    if(toStage===4){ patch.status='won'; patch.winDate=Utils.today(); }
    return Store.update('opportunities', id, patch);
  },
  setOppStatus(id, status){
    const patch = {status};
    if(status==='won') patch.winDate=Utils.today();
    if(status==='lost') patch.lostDate=Utils.today();
    return Store.update('opportunities', id, patch);
  },

  // ===== 跟进记录（按企业隔离）=====
  followups(){ return Store.collection('followups').filter(f=>!Store.session.enterpriseId || f.enterpriseId===Store.session.enterpriseId); },
  followup(id){ return Store.get('followups', id); },
  addFollowup(f){ if(!f.enterpriseId) f.enterpriseId=Store.session.enterpriseId; return Store.insert('followups', f); },
  updateFollowup(id, patch){ return Store.update('followups', id, patch); },
  deleteFollowup(id){ return Store.remove('followups', id); },
  followupsByCustomer(cid){ return Store.followups().filter(f=>f.customerId===cid); },
  followupsByContact(cid){ return Store.followups().filter(f=>f.contactId===cid); },
  followupsByOpp(oid){ return Store.followups().filter(f=>f.opportunityId===oid); },
  lastFollowup(filterFn){
    const arr = Store.followups().filter(filterFn||(()=>true));
    return arr.length?arr[0]:null;
  },

  // ===== 日程（按企业隔离）=====
  schedules(){ return Store.collection('schedules').filter(s=>!Store.session.enterpriseId || s.enterpriseId===Store.session.enterpriseId); },
  schedule(id){ return Store.get('schedules', id); },
  addSchedule(s){ if(!s.enterpriseId) s.enterpriseId=Store.session.enterpriseId; return Store.insert('schedules', s); },
  updateSchedule(id, patch){ return Store.update('schedules', id, patch); },
  deleteSchedule(id){ return Store.remove('schedules', id); },
  schedulesByDate(date){ return Store.schedules().filter(s=>s.startAt && s.startAt.slice(0,10)===date); },
  upcomingSchedules(days=7){
    const now = Date.now();
    return Store.schedules().filter(s=>{
      if(s.done) return false;
      const t = new Date(s.startAt).getTime();
      return t>=now && t<=now+days*86400000;
    }).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  },

  // ===== 通知消息（按企业+用户隔离）=====
  notifications(){ 
    const uid = Store.session.userId;
    return Store.collection('notifications').filter(n=>
      (!Store.session.enterpriseId || n.enterpriseId===Store.session.enterpriseId) &&
      n.toUserId===uid
    ).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },
  notification(id){ return Store.get('notifications', id); },
  addNotification(n){ 
    if(!n.enterpriseId) n.enterpriseId=Store.session.enterpriseId; 
    if(!n.isRead) n.isRead=false;
    return Store.insert('notifications', n); 
  },
  // 用户未读通知数量
  unreadNotificationCount(){
    const uid = Store.session.userId;
    return Store.collection('notifications').filter(n=>
      n.toUserId===uid && !n.isRead &&
      (!Store.session.enterpriseId || n.enterpriseId===Store.session.enterpriseId)
    ).length;
  },
  // 标记单条已读
  markNotificationRead(id){
    return Store.update('notifications', id, { isRead: true });
  },
  // 全部标记已读
  markAllNotificationsRead(){
    const uid = Store.session.userId;
    Store.collection('notifications').forEach(n=>{
      if(n.toUserId===uid && !n.isRead) n.isRead=true;
    });
    Store.save();
  },

  // ===== 统计 =====
  stats(){
    const customers = Store.customers();
    const contacts = Store.contacts();
    const opps = Store.opportunities();
    const myCustomers = customers.filter(c=>!c.inPool);
    const openOpps = opps.filter(o=>o.status==='open');
    const wonOpps = opps.filter(o=>o.status==='won');
    const lostOpps = opps.filter(o=>o.status==='lost');
    const wonAmount = Utils.sum(wonOpps, 'amount');
    const openAmount = Utils.sum(openOpps, 'amount');
    const weightedAmount = openOpps.reduce((a,o)=>a+Number(o.amount||0)*(o.winProbability||0)/100,0);
    return {
      customerTotal: customers.length,
      myCustomerTotal: myCustomers.length,
      poolTotal: customers.filter(c=>c.inPool).length,
      contactTotal: contacts.length,
      oppTotal: opps.length,
      openOppTotal: openOpps.length,
      wonOppTotal: wonOpps.length,
      lostOppTotal: lostOpps.length,
      wonAmount,
      openAmount,
      weightedAmount,
      avgDealCycle: wonOpps.length ? Math.round(Utils.avg(wonOpps.map(o=>{
        if(o.winDate&&o.createdAt) return (new Date(o.winDate)-new Date(o.createdAt))/86400000;
        return 0;
      }))) : 0,
      winRate: opps.filter(o=>o.status==='won'||o.status==='lost').length ?
        (wonOpps.length/(wonOpps.length+lostOpps.length)*100).toFixed(1) : 0
    };
  },

  // ===== 商机健康度评分 =====
  oppHealthScore(id){
    const o=Store.opportunity(id);
    if(!o) return 0;
    if(o.status==='won') return 100;
    if(o.status==='lost'||o.status==='closed') return 0;
    const contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    const fus=Store.followupsByOpp(id);
    const lastFu=fus.length?fus[0]:null;
    let score=50;
    if(o.competition==='single') score+=30;
    else if(o.competition==='leading') score+=20;
    else if(o.competition==='even') score+=5;
    else score-=15;
    if(o.stage===3) score+=15;
    else if(o.stage===2) score+=5;
    const keyN=contacts.filter(x=>x.isKey).length;
    if(keyN>=2) score+=10;
    else if(keyN===0) score-=10;
    const supN=contacts.filter(x=>x.attitude==='支持').length;
    if(supN>=2) score+=10;
    if(lastFu && Utils.daysSince(lastFu.at)<=7) score+=5;
    else if(!lastFu||Utils.daysSince(lastFu.at)>14) score-=10;
    if(o.expectedSignDate && new Date(o.expectedSignDate)<new Date()) score-=10;
    return Math.max(0,Math.min(100,Math.round(score)));
  },

  healthMatrix(){
    const open=Store.opportunities().filter(o=>o.status==='open');
    return open.map(o=>{
      const health=Store.oppHealthScore(o.id);
      const c=Store.customer(o.customerId);
      return {
        id:o.id, name:o.name, customer:c?c.shortName||c.name:'', amount:Number(o.amount||0),
        health, stage:o.stage, competition:o.competition, winProbability:o.winProbability||0,
        risk: health<45 ? 'high' : health<70 ? 'mid' : 'low',
      };
    }).sort((a,b)=>b.amount-a.amount);
  },

  // ===== 趋势分析：按月分桶统计 =====
  trendData(months){
    months = months || 6;
    const now = new Date();
    const buckets = [];
    for(let i=months-1; i>=0; i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      buckets.push({
        key: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),
        year: d.getFullYear(),
        month: d.getMonth()+1,
        label: (d.getMonth()+1)+'月',
        newCustomers: 0, newOpps: 0, newOppAmount: 0,
        wonOpps: 0, wonAmount: 0, lostOpps: 0, followups: 0,
      });
    }
    const inRange = (dateStr, key) => {
      if(!dateStr) return false;
      const d = new Date(dateStr);
      const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      return k === key;
    };
    buckets.forEach(b=>{
      b.newCustomers = Store.customers().filter(c=>inRange(c.createdAt, b.key)).length;
      const newOpps = Store.opportunities().filter(o=>inRange(o.createdAt, b.key));
      b.newOpps = newOpps.length;
      b.newOppAmount = Utils.sum(newOpps, 'amount');
      const wonOpps = Store.opportunities().filter(o=>o.status==='won'&&inRange(o.winDate||o.updatedAt, b.key));
      b.wonOpps = wonOpps.length;
      b.wonAmount = Utils.sum(wonOpps, 'amount');
      b.lostOpps = Store.opportunities().filter(o=>o.status==='lost'&&inRange(o.lostDate||o.updatedAt, b.key)).length;
      b.followups = Store.followups().filter(f=>inRange(f.at, b.key)).length;
    });
    return buckets;
  },

  // ===== 漏斗深度分析 =====
  funnelDeepAnalysis(){
    const all = Store.opportunities();
    const open = all.filter(o=>o.status==='open');
    const won = all.filter(o=>o.status==='won');
    const lost = all.filter(o=>o.status==='lost');
    const stages = DICT.opportunityStage;

    const stageData = stages.map((s, i)=>{
      const arrOpen = open.filter(o=>o.stage===s.value);
      const arrWon = won.filter(o=>o.stage===s.value || (i===stages.length-1));
      const arrLost = lost.filter(o=>o.stage===s.value);
      const amt = Utils.sum(arrOpen, 'amount');

      let dwellDays = 0;
      const dwellSamples = [];
      all.filter(o=>o.stage>=s.value).forEach(o=>{
        const created = new Date(o.createdAt);
        let endRef;
        if(o.stage===s.value && (o.status==='open')){
          endRef = new Date();
        } else if(o.winDate){
          endRef = new Date(o.winDate);
        } else if(o.lostDate){
          endRef = new Date(o.lostDate);
        } else {
          endRef = new Date(o.updatedAt);
        }
        const days = Math.round((endRef - created) / 86400000);
        if(days>=0) dwellSamples.push(days);
      });
      if(dwellSamples.length){
        dwellDays = Math.round(dwellSamples.reduce((a,b)=>a+b,0) / dwellSamples.length);
      }

      let convRate = '—';
      let convNum = 0, convDen = 0;
      const nextStage = stages[i+1];
      if(nextStage){
        convDen = all.filter(o=>o.stage>=s.value).length;
        convNum = all.filter(o=>o.stage>=nextStage.value).length;
        convRate = convDen ? Math.round(convNum/convDen*100)+'%' : '—';
      } else {
        convDen = all.filter(o=>o.stage>=s.value).length;
        convNum = won.length;
        convRate = convDen ? Math.round(won.length/convDen*100)+'%' : '—';
      }

      const overdue = arrOpen.filter(o=>{
        const lastUpdate = new Date(o.updatedAt);
        return (Date.now() - lastUpdate.getTime()) > 30*86400000;
      });

      return {
        stage: s, index: i,
        openCount: arrOpen.length, openAmount: amt,
        wonCount: arrWon.length, lostCount: arrLost.length,
        dwellDays, convRate, convNum, convDen,
        overdue: overdue.length,
      };
    });

    let bottleneck = null;
    stageData.forEach(s=>{
      if(s.convRate!=='—'){
        const rate = parseInt(s.convRate);
        if(!bottleneck || rate < bottleneck.rate){
          bottleneck = {stage: s.stage, rate, index: s.index};
        }
      }
    });

    const lossByStage = stages.map(s=>({
      stage: s,
      count: lost.filter(o=>o.stage===s.value).length,
    }));
    let lossHotspot = null;
    lossByStage.forEach(l=>{
      if(!lossHotspot || l.count > lossHotspot.count){
        lossHotspot = l;
      }
    });

    return {
      stages: stageData, bottleneck, lossByStage, lossHotspot,
      totalWon: won.length, totalLost: lost.length, totalOpen: open.length,
    };
  },

  // ===== 智能预警中心 =====
  alerts(){
    const alerts=[];
    const now=Date.now();
    const DAY=86400000;

    Store.opportunities().filter(o=>o.status==='open').forEach(o=>{
      const days=Utils.daysSince(o.updatedAt);
      if(days>30){
        alerts.push({
          type:'opp-stagnant', severity: days>60?'high':'mid',
          title:`商机停滞：${o.name}`,
          desc:`已${days}天未推进（上次更新${Utils.fmtDate(o.updatedAt)}）`,
          days, entityType:'opportunity', entityId:o.id,
          icon:'⚠️', cls:'badge-orange',
        });
      }
    });

    Store.myCustomers().forEach(c=>{
      const lastFu=Store.lastFollowup(f=>f.customerId===c.id);
      const days=lastFu?Utils.daysSince(lastFu.at):999;
      if(days>14){
        const opps=Store.oppsByCustomer(c.id).filter(o=>o.status==='open');
        alerts.push({
          type:'customer-churn', severity: days>30?'high':days>21?'mid':'low',
          title:`客户流失风险：${c.name}`,
          desc:`${days}天未跟进${opps.length?`，有${opps.length}个进行中商机`:''}`,
          days, entityType:'customer', entityId:c.id,
          icon:'😴', cls:days>30?'badge-red':'badge-orange',
        });
      }
    });

    Store.opportunities().filter(o=>o.status==='open').forEach(o=>{
      if(o.expectedSignDate && new Date(o.expectedSignDate)<new Date()){
        const days=Math.round((now-new Date(o.expectedSignDate))/DAY);
        alerts.push({
          type:'sign-overdue', severity: days>30?'high':'mid',
          title:`签约逾期：${o.name}`,
          desc:`预计签约日${Utils.fmtDate(o.expectedSignDate)}已过${days}天`,
          days, entityType:'opportunity', entityId:o.id,
          icon:'📅', cls:'badge-red',
        });
      }
    });

    Store.schedules().filter(s=>!s.done && new Date(s.startAt)<new Date()).forEach(s=>{
      const days=Math.round((now-new Date(s.startAt))/DAY);
      alerts.push({
        type:'schedule-overdue', severity: days>7?'high':days>3?'mid':'low',
        title:`日程逾期：${s.title}`,
        desc:`计划于${Utils.fmtDateTime(s.startAt)}，已逾期${days}天`,
        days, entityType:'schedule', entityId:s.id,
        icon:'🔔', cls:days>3?'badge-red':'badge-orange',
      });
    });

    Store.myCustomers().forEach(c=>{
      if(c.protectDays>0){
        const created=new Date(c.createdAt);
        const expireTime=created.getTime()+c.protectDays*DAY;
        const daysLeft=Math.round((expireTime-now)/DAY);
        if(daysLeft<=7 && daysLeft>=-30){
          alerts.push({
            type:'protect-expire', severity: daysLeft<0?'high':'mid',
            title:`保护期${daysLeft<0?'已到期':'即将到期'}：${c.name}`,
            desc:daysLeft<0?`保护期已过${-daysLeft}天，客户可能被其他销售介入`:`保护期剩余${daysLeft}天`,
            days:daysLeft, entityType:'customer', entityId:c.id,
            icon:'🛡️', cls:daysLeft<0?'badge-red':'badge-orange',
          });
        }
      }
    });

    const order={high:0,mid:1,low:2};
    alerts.sort((a,b)=>(order[a.severity]||2)-(order[b.severity]||2) || (b.days||0)-(a.days||0));
    return alerts;
  },

  // ===== 赢/输单归因分析 =====
  winLossAnalysis(){
    const won=Store.opportunities().filter(o=>o.status==='won');
    const lost=Store.opportunities().filter(o=>o.status==='lost');
    const winReasons={};
    const lossReasons={};
    DICT.winReason.forEach(r=>winReasons[r.value]=0);
    DICT.lossReason.forEach(r=>lossReasons[r.value]=0);
    won.forEach(o=>{ if(o.winReason) winReasons[o.winReason]=(winReasons[o.winReason]||0)+1; });
    lost.forEach(o=>{ if(o.lossReason) lossReasons[o.lossReason]=(lossReasons[o.lossReason]||0)+1; });

    const byIndustry={};
    [...won,...lost].forEach(o=>{
      const c=Store.customer(o.customerId);
      const ind=c?c.industry:'未知';
      if(!byIndustry[ind]) byIndustry[ind]={won:0,lost:0,amount:0};
      if(o.status==='won'){byIndustry[ind].won++;byIndustry[ind].amount+=Number(o.amount||0);}
      else byIndustry[ind].lost++;
    });

    const byAmountRange={
      '100万以下':{won:0,lost:0},
      '100-500万':{won:0,lost:0},
      '500-1000万':{won:0,lost:0},
      '1000万以上':{won:0,lost:0},
    };
    [...won,...lost].forEach(o=>{
      const amt=Number(o.amount||0);
      let range;
      if(amt<1000000) range='100万以下';
      else if(amt<5000000) range='100-500万';
      else if(amt<10000000) range='500-1000万';
      else range='1000万以上';
      if(o.status==='won') byAmountRange[range].won++;
      else byAmountRange[range].lost++;
    });

    return {
      wonCount:won.length, lostCount:lost.length,
      winReasons, lossReasons, byIndustry, byAmountRange,
      winRate: (won.length+lost.length)>0?Math.round(won.length/(won.length+lost.length)*100):0,
    };
  },

  // ===== 销售行为效能分析 =====
  salesPerformance(){
    const allOpps=Store.opportunities();
    const allFus=Store.followups();

    const methodStats=DICT.followupType.map(t=>{
      const oppIds=new Set();
      allFus.filter(f=>f.type===t.value && f.opportunityId).forEach(f=>oppIds.add(f.opportunityId));
      const opps=[...oppIds].map(id=>Store.opportunity(id)).filter(Boolean);
      const won=opps.filter(o=>o.status==='won').length;
      const lost=opps.filter(o=>o.status==='lost').length;
      const open=opps.filter(o=>o.status==='open').length;
      const closed=won+lost;
      return {
        type:t.value, label:t.label, icon:t.icon,
        totalFollowups:allFus.filter(f=>f.type===t.value).length,
        oppCount:opps.length, won, lost, open,
        winRate: closed>0?Math.round(won/closed*100):0,
      };
    }).filter(m=>m.totalFollowups>0);

    const closedOpps=allOpps.filter(o=>o.status==='won'||o.status==='lost');
    const freqBuckets=[
      {label:'1-2次',range:[0,2],won:0,lost:0},
      {label:'3-5次',range:[3,5],won:0,lost:0},
      {label:'6-10次',range:[6,10],won:0,lost:0},
      {label:'10次以上',range:[11,9999],won:0,lost:0},
    ];
    closedOpps.forEach(o=>{
      const cnt=Store.followupsByOpp(o.id).length;
      const bucket=freqBuckets.find(b=>cnt>=b.range[0]&&cnt<=b.range[1]);
      if(bucket){ if(o.status==='won')bucket.won++; else bucket.lost++; }
    });
    freqBuckets.forEach(b=>{
      const total=b.won+b.lost;
      b.winRate=total>0?Math.round(b.won/total*100):0;
      b.total=total;
    });

    const activityFunnel=[
      {label:'上门拜访',count:0,icon:'🚶'},
      {label:'会议沟通',count:0,icon:'👥'},
      {label:'演示/POC',count:0,icon:'🖥️'},
      {label:'方案提交',count:0,icon:'📄'},
      {label:'报价/商务',count:0,icon:'💰'},
      {label:'签约成交',count:0,icon:'✍️'},
    ];
    const typeMap={visit:0,meeting:1,demo:2,proposal:3,quote:4};
    allOpps.forEach(o=>{
      const fus=Store.followupsByOpp(o.id);
      const types=new Set(fus.map(f=>f.type));
      Object.entries(typeMap).forEach(([t,i])=>{
        if(types.has(t)) activityFunnel[i].count++;
      });
      if(o.status==='won') activityFunnel[5].count++;
    });

    return {
      methodStats, freqBuckets, activityFunnel,
      totalFollowups: allFus.length,
      avgFollowupPerOpp: allOpps.length?Math.round(allFus.length/allOpps.length*10)/10:0,
    };
  }
};
