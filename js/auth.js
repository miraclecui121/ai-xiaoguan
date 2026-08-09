/* ========== 认证系统 Auth ========== */
/* 多租户登录/注销/企业注册/路由守卫
   双模式：API 模式（后端 JWT）或本地模式（localStorage session）*/
const Auth = {
  wechatQrTimer: null,

  // 检查登录状态，未登录则显示登录页
  check(){
    Store.initSession();
    if(!Store.isLoggedIn()){
      Auth.showLogin();
      return false;
    }
    // API 模式下额外验证 token 有效性
    if(Store.mode === 'api'){
      const token = API.getToken();
      if(!token){
        Store.clearSession();
        Auth.showLogin();
        return false;
      }
    }
    Auth.showApp();
    return true;
  },

  // 显示登录页（隐藏主应用）
  showLogin(){
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    Auth.renderLogin();
  },

  // 显示主应用（隐藏登录页）
  showApp(){
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('app').style.display = '';
    Auth.updateTopbar();
  },

  // 更新顶栏企业+用户信息
  updateTopbar(){
    const ent = Store.currentEnterprise();
    const user = Store.currentUser();
    if(ent){
      const entEl = document.getElementById('topbarEntName');
      if(entEl) entEl.textContent = ent.shortName || ent.name;
    }
    if(user){
      const avatarEl = document.getElementById('topbarAvatar');
      const nameEl = document.getElementById('topbarUserName');
      if(avatarEl) avatarEl.textContent = user.avatar || user.name.charAt(0);
      if(nameEl) nameEl.textContent = user.name;
      const entMenu = document.getElementById('entMenuGroup');
      if(entMenu) entMenu.style.display = Store.isAdmin() && !Store.isPersonalWorkspace() ? '' : 'none';
      const opsLogMenu = document.getElementById('opsLogMenuItem');
      if(opsLogMenu) opsLogMenu.style.display = Store.canManageInvites && Store.canManageInvites() ? '' : 'none';
    }
    // 刷新铃铛
    App.refreshNotifBadge();
  },

  // 渲染登录页
  renderLogin(){
    const box = document.getElementById('loginBox');
    const isApi = Store.mode === 'api';
    const showAccountBackup = Auth.isLocalHost();
    if(!isApi){
      Auth.normalizeLoginEnterprises();
    }
    const acq = Store.getAcquisition ? Store.getAcquisition() : {};
    const inviteHint = acq.inviteCode
      ? `<div class="login-acq-hint">已识别邀请码：<code>${Utils.esc(acq.inviteCode)}</code>${acq.sourceChannel ? ` · 来源：${Utils.esc(acq.sourceChannel)}` : ''}</div>`
      : '';
    box.innerHTML = `
      <div class="login-brand">
        <span class="logo-icon">冠</span>
        <span class="logo-text">AI<span class="logo-accent">销冠</span></span>
      </div>
      <div class="login-subtitle">AI销冠助手 · 个人版 / 企业版 ${isApi || !Auth.isLocalHost() ? '<span class="badge badge-green" style="font-size:11px">云端版</span>' : '<span class="badge badge-gray" style="font-size:11px">本地体验版</span>'}</div>

      <div class="login-tabs login-tabs-single">
        <button class="login-tab active" id="loginTabLogin" onclick="Auth.switchTab('login')">登录</button>
      </div>

      <div id="loginFormPanel">
        <div class="wechat-login-card">
          <button class="wechat-login-btn" onclick="Auth.loginWithWechat()" type="button">
            <span class="wechat-login-icon">微</span>
            <span><b>微信授权登录</b><small>${Auth.wechatLoginHint()}</small></span>
          </button>
          ${inviteHint}
        </div>
        <div class="login-demo-hint">
          <div class="login-hint-title">首次登录后进入演示空间</div>
          <div class="login-hint-item"><span class="badge badge-gold">演示体验</span> 默认演示数据 · 可体验 11 个销售专家视角</div>
          <button class="login-hint-item login-demo-account" onclick="Auth.loginWithWechat()" type="button"><span class="badge badge-green">个人版</span> 微信登录后输入邀请码开通 · PC/手机同一空间</button>
          <div class="login-hint-item"><span class="badge badge-gray">切换微信</span> 退出当前身份后，用另一个微信重新授权</div>
        </div>
        ${showAccountBackup ? `
          <div class="login-divider"><span>本机开发备用账号</span></div>
          <div class="login-field">
            <label class="login-label">选择企业</label>
            <select class="login-input" id="loginEntId">
              <option value="">— 请选择企业 —</option>
              ${Auth.renderEnterpriseOptions()}
            </select>
          </div>
          <div class="login-field">
            <label class="login-label">账号</label>
            <input type="text" class="login-input" id="loginAccount" placeholder="输入登录账号" onkeydown="if(event.key==='Enter')document.getElementById('loginPassword').focus()">
          </div>
          <div class="login-field">
            <label class="login-label">密码</label>
            <input type="password" class="login-input" id="loginPassword" placeholder="输入密码" onkeydown="if(event.key==='Enter')Auth.doLogin()">
          </div>
        ` : ''}
        <div id="loginError" class="login-error" style="display:none"></div>
        ${showAccountBackup ? `<button class="login-btn" id="loginBtn" onclick="Auth.doLogin()">备用账号登录</button>` : ''}
      </div>

      <div id="registerFormPanel" style="display:none">
        <div class="login-field">
          <label class="login-label">企业全称 *</label>
          <input type="text" class="login-input" id="regEntName" placeholder="如：XX科技有限公司">
        </div>
        <div class="login-field">
          <label class="login-label">企业简称</label>
          <input type="text" class="login-input" id="regEntShort" placeholder="如：XX科技">
        </div>
        <div class="form-grid-2" style="gap:12px">
          <div class="login-field">
            <label class="login-label">所属行业</label>
            <select class="login-input" id="regEntIndustry">
              ${DICT.industry.map(i=>`<option value="${i}">${i}</option>`).join('')}
            </select>
          </div>
          <div class="login-field">
            <label class="login-label">系统联系人</label>
            <input type="text" class="login-input" id="regContactName" placeholder="联系人姓名">
          </div>
        </div>
        <div class="form-grid-2" style="gap:12px">
          <div class="login-field">
            <label class="login-label">联系电话</label>
            <input type="text" class="login-input" id="regContactPhone" placeholder="手机号">
          </div>
          <div class="login-field">
            <label class="login-label">联系邮箱</label>
            <input type="text" class="login-input" id="regContactEmail" placeholder="邮箱地址">
          </div>
        </div>
        <div class="login-field">
          <label class="login-label">管理员账号 *</label>
          <input type="text" class="login-input" id="regAccount" placeholder="管理员登录账号">
        </div>
        <div class="form-grid-2" style="gap:12px">
          <div class="login-field">
            <label class="login-label">管理员姓名 *</label>
            <input type="text" class="login-input" id="regUserName" placeholder="管理员姓名">
          </div>
          <div class="login-field">
            <label class="login-label">管理员密码 *</label>
            <input type="password" class="login-input" id="regPassword" placeholder="设置登录密码">
          </div>
        </div>
        <div id="regError" class="login-error" style="display:none"></div>
        <button class="login-btn" id="regBtn" onclick="Auth.doRegister()">注册并开通</button>
      </div>
    `;

    // API 模式下异步加载企业列表
    if(isApi){
      Auth.loadEnterpriseOptions();
    }
  },

  // 渲染企业下拉选项（本地模式从 Store 读取）
  renderEnterpriseOptions(){
    if(Store.mode === 'local'){
      Auth.normalizeLoginEnterprises();
    }
    const demoNames = {
      ent_001: '星瀚增长科技有限公司',
      ent_002: '北辰数智科技有限公司',
    };
    return Store.enterprises().filter(e=>e.status==='active').map(e=>{
      const name = demoNames[e.id] || e.name;
      return `<option value="${e.id}">${Utils.esc(name)}（${Utils.esc(e.id)}）</option>`;
    }).join('');
  },

  normalizeLoginEnterprises(){
    if(!Store.db) return;
    if(Store.applyBrandMigration) Store.applyBrandMigration();
    if(Store.normalizeDemoEnterprises) Store.normalizeDemoEnterprises();
    Store.save();
  },

  fillDemoAccount(enterpriseId, account, password){
    const ent = document.getElementById('loginEntId');
    const acc = document.getElementById('loginAccount');
    const pwd = document.getElementById('loginPassword');
    if(ent) ent.value = enterpriseId;
    if(acc) acc.value = account;
    if(pwd) pwd.value = password;
    const err = document.getElementById('loginError');
    if(err) err.style.display = 'none';
  },

  wechatLoginHint(){
    return Auth.isLocalHost() ? '本机未配置时自动使用模拟授权' : '电脑浏览器扫码登录，微信内直接授权';
  },

  isLocalHost(){
    return ['localhost','127.0.0.1','::1'].includes(location.hostname) || location.protocol === 'file:';
  },

  isWechatBrowser(){
    return /MicroMessenger/i.test(navigator.userAgent || '');
  },

  shouldUseWechatQrLogin(){
    if(Auth.isLocalHost()) return false;
    if(Auth.isWechatBrowser()) return false;
    return true;
  },

  async restoreWechatOAuthSession(){
    if(location.search.includes('wechat_error=')){
      const params = new URLSearchParams(location.search);
      const err = params.get('wechat_error') || 'unknown';
      setTimeout(()=>Toast.show(`微信授权失败：${err}`, 'error'), 300);
      history.replaceState(null, '', location.pathname || '/');
      return false;
    }
    try{
      const resp = await fetch('/api/auth/wechat/session', { credentials:'include' });
      if(!resp.ok) return false;
      const data = await resp.json().catch(()=>null);
      const profile = data?.data?.user;
      if(!data?.data?.authenticated || !profile) return false;
      const user = Store.loginWithWechatOAuth(profile);
      if(Store.restoreCloudWorkspace){
        const cloud = await Store.restoreCloudWorkspace(profile);
        if(cloud?.restored && typeof Toast!=='undefined'){
          setTimeout(()=>Toast.show('已同步你的个人空间和历史数据', 'success'), 500);
        }
      }
      if(typeof Audit!=='undefined') Audit.log('wechat_oauth_session_restored', { action:'wechat_oauth_session', result:'success' });
      return !!user;
    }catch(e){
      return false;
    }
  },

  async loginWithWechat(){
    const errEl = document.getElementById('loginError');
    if(errEl) errEl.style.display = 'none';
    try{
      const resp = await fetch('/api/auth/wechat/status', { credentials:'include' });
      const data = await resp.json().catch(()=>null);
      if(data?.data?.configured){
        const acq = Store.getAcquisition ? Store.getAcquisition() : {};
        const returnTo = `${location.pathname || '/'}${location.search || ''}`.replace(/[?&]wechat_error=[^&]+/,'');
        const qs = new URLSearchParams();
        if(acq.inviteCode) qs.set('invite', acq.inviteCode);
        if(acq.sourceChannel) qs.set('src', acq.sourceChannel);
        if(acq.campaignName) qs.set('campaign', acq.campaignName);
        qs.set('return_to', returnTo || '/');
        if(Auth.shouldUseWechatQrLogin()){
          await Auth.openWechatQrLogin(qs);
          return;
        }
        location.href = `/api/auth/wechat/start?${qs.toString()}`;
        return;
      }
      if(Auth.isLocalHost()){
        return Auth.loginWithWechatDemo();
      }
      throw new Error('云端微信 OAuth 尚未配置，请先在 Render 设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
    }catch(e){
      if(Auth.isLocalHost()) return Auth.loginWithWechatDemo();
      if(typeof Audit!=='undefined') Audit.log('wechat_oauth_login_failed', { action:'wechat_oauth_login', result:'error', message:e.message || '登录失败' });
      if(errEl){
        errEl.textContent = e.message || '微信授权登录失败';
        errEl.style.display = 'block';
      }else{
        Toast.show(e.message || '微信授权登录失败', 'error');
      }
    }
  },

  async openWechatQrLogin(qs){
    Auth.cancelWechatQrLogin(false);
    Modal.open({
      title: '微信扫码登录',
      size: 'sm',
      body: `
        <div class="wechat-qr-login">
          <div class="wechat-qr-loading">正在生成登录二维码...</div>
          <div class="wechat-qr-desc">请稍等，生成后使用手机微信扫码授权。</div>
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Auth.cancelWechatQrLogin(true)">取消</button>`
    });
    const resp = await fetch(`/api/auth/wechat/qr/start?${qs.toString()}`, { credentials:'include' });
    const data = await resp.json().catch(()=>null);
    if(!resp.ok || !data?.success || !data?.data?.qrId){
      throw new Error(data?.error || data?.message || '微信扫码登录初始化失败');
    }
    const qr = data.data;
    const bodyEl = document.getElementById('modalBody');
    if(bodyEl){
      bodyEl.innerHTML = `
        <div class="wechat-qr-login" id="wechatQrLoginBox">
          <div class="wechat-qr-img">${qr.qrSvg || ''}</div>
          <div class="wechat-qr-title">请使用手机微信扫码授权</div>
          <div class="wechat-qr-desc">扫码后在手机上确认授权，电脑端会自动登录。二维码约 ${Math.max(1, Math.floor((qr.expiresIn||300)/60))} 分钟内有效。</div>
          <div class="wechat-qr-status" id="wechatQrStatus">等待扫码确认...</div>
        </div>`;
    }
    Auth.wechatQrTimer = setInterval(()=>Auth.pollWechatQrLogin(qr.qrId, qr.pollToken), 1800);
    await Auth.pollWechatQrLogin(qr.qrId, qr.pollToken);
  },

  async pollWechatQrLogin(qrId, pollToken){
    const mask = document.getElementById('modalMask');
    if(mask && !mask.classList.contains('show')){
      Auth.cancelWechatQrLogin(false);
      return;
    }
    const statusEl = document.getElementById('wechatQrStatus');
    try{
      const qs = new URLSearchParams({ qr_id: qrId, poll_token: pollToken });
      const resp = await fetch(`/api/auth/wechat/qr/status?${qs.toString()}`, { credentials:'include' });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success) throw new Error(data?.error || '扫码状态查询失败');
      const status = data.data?.status || 'pending';
      if(status === 'expired'){
        Auth.cancelWechatQrLogin(false);
        if(statusEl) statusEl.textContent = '二维码已过期，请重新点击微信登录。';
        Toast.show('二维码已过期，请重新点击微信登录', 'error');
        return;
      }
      if(status !== 'confirmed'){
        if(statusEl) statusEl.textContent = '等待扫码确认...';
        return;
      }
      Auth.cancelWechatQrLogin(false);
      const profile = data.data?.user;
      if(!profile) throw new Error('微信授权信息缺失');
      const user = Store.loginWithWechatOAuth(profile);
      if(Store.restoreCloudWorkspace){
        const cloud = await Store.restoreCloudWorkspace(profile);
        if(cloud?.restored) Toast.show('已同步你的个人空间和历史数据', 'success');
      }
      if(typeof Audit!=='undefined') Audit.log('wechat_qr_login_success', { action:'wechat_qr_login', result:'success' });
      Modal.close();
      Auth.showApp();
      App.navigate('ai');
      Toast.show(`已通过微信登录，${user.name}`, 'success');
    }catch(e){
      if(statusEl) statusEl.textContent = e.message || '扫码登录失败，请重试。';
    }
  },

  cancelWechatQrLogin(closeModal=true){
    if(Auth.wechatQrTimer){
      clearInterval(Auth.wechatQrTimer);
      Auth.wechatQrTimer = null;
    }
    if(closeModal) Modal.close();
  },

  loginWithWechatDemo(){
    const errEl = document.getElementById('loginError');
    if(errEl) errEl.style.display = 'none';
    try{
      const user = Store.loginWithWechatDemo();
      if(typeof Audit!=='undefined') Audit.log('wechat_demo_login_success', { action:'wechat_demo_login', result:'success' });
      Auth.showApp();
      App.navigate('ai');
      Toast.show(`已进入演示空间，${user.name}`, 'success');
    }catch(e){
      if(typeof Audit!=='undefined') Audit.log('wechat_demo_login_failed', { action:'wechat_demo_login', result:'error', message:e.message || '登录失败' });
      if(errEl){
        errEl.textContent = e.message || '微信授权登录失败';
        errEl.style.display = 'block';
      }else{
        Toast.show(e.message || '微信授权登录失败', 'error');
      }
    }
  },

  // API 模式下异步加载企业列表
  async loadEnterpriseOptions(){
    try{
      const list = await API.listEnterprises();
      const sel = document.getElementById('loginEntId');
      if(sel && list && list.length){
        sel.innerHTML = '<option value="">— 请选择企业 —</option>' +
          list.map(e=>`<option value="${e.id}">${Utils.esc(e.name)}</option>`).join('');
      }
    }catch(e){
      console.error('加载企业列表失败:', e);
    }
  },

  // 切换登录/注册Tab
  switchTab(tab){
    const loginTab = document.getElementById('loginTabLogin');
    const registerTab = document.getElementById('loginTabRegister');
    const loginPanel = document.getElementById('loginFormPanel');
    const registerPanel = document.getElementById('registerFormPanel');
    if(loginTab) loginTab.classList.toggle('active', tab==='login');
    if(registerTab) registerTab.classList.toggle('active', tab==='register');
    if(loginPanel) loginPanel.style.display = tab==='login' ? '' : 'none';
    if(registerPanel) registerPanel.style.display = tab==='register' ? '' : 'none';
  },

  // 执行登录（异步：API 模式调后端验证）
  async doLogin(){
    const entId = document.getElementById('loginEntId').value;
    const account = document.getElementById('loginAccount').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');

    if(!entId){ errEl.textContent='请选择企业'; errEl.style.display='block'; return; }
    if(!account){ errEl.textContent='请输入账号'; errEl.style.display='block'; return; }
    if(!password){ errEl.textContent='请输入密码'; errEl.style.display='block'; return; }

    // 显示加载状态
    const btn = document.getElementById('loginBtn');
    const oldText = btn.textContent;
    btn.textContent = '登录中…';
    btn.disabled = true;
    errEl.style.display='none';

    try{
      const user = await Store.login(account, password, entId);
      if(!user){
        if(typeof Audit!=='undefined') Audit.log('login_failed', { action:'login', result:'invalid_credentials', user:{ account, enterpriseId:entId } });
        errEl.textContent='账号或密码错误，或账号已被禁用';
        errEl.style.display='block';
        btn.textContent = oldText;
        btn.disabled = false;
        return;
      }

      if(typeof Audit!=='undefined') Audit.log('login_success', { action:'login', result:'success' });
      Auth.showApp();
      App.navigate('dashboard');
      Toast.show(`欢迎回来，${user.name}！`, 'success');
    }catch(e){
      if(typeof Audit!=='undefined') Audit.log('login_failed', { action:'login', result:'error', message:e.message || '登录失败', user:{ account, enterpriseId:entId } });
      errEl.textContent = e.message || '登录失败，请重试';
      errEl.style.display='block';
      btn.textContent = oldText;
      btn.disabled = false;
    }
  },

  // 执行企业注册（异步）
  async doRegister(){
    const name = document.getElementById('regEntName').value.trim();
    const shortName = document.getElementById('regEntShort').value.trim();
    const industry = document.getElementById('regEntIndustry').value;
    const contactName = document.getElementById('regContactName').value.trim();
    const contactPhone = document.getElementById('regContactPhone').value.trim();
    const contactEmail = document.getElementById('regContactEmail').value.trim();
    const account = document.getElementById('regAccount').value.trim();
    const userName = document.getElementById('regUserName').value.trim();
    const password = document.getElementById('regPassword').value;
    const errEl = document.getElementById('regError');

    if(!name){ errEl.textContent='请输入企业全称'; errEl.style.display='block'; return; }
    if(!account){ errEl.textContent='请设置管理员账号'; errEl.style.display='block'; return; }
    if(!userName){ errEl.textContent='请输入管理员姓名'; errEl.style.display='block'; return; }
    if(!password || password.length<4){ errEl.textContent='密码至少4位'; errEl.style.display='block'; return; }

    // 显示加载状态
    const btn = document.getElementById('regBtn');
    const oldText = btn.textContent;
    btn.textContent = '注册中…';
    btn.disabled = true;
    errEl.style.display='none';

    try{
      if(Store.mode === 'api'){
        // API 模式：调用后端注册
        const result = await Store.register({
          enterpriseName: name,
          shortName: shortName || name.slice(0,6),
          industry, contactName, contactPhone, contactEmail,
          account, name: userName, password,
        });

        btn.textContent = oldText;
        btn.disabled = false;
        Toast.show('企业注册成功，已自动登录', 'success');
        Auth.showApp();
        App.navigate('dashboard');
        return;
      }

      // 本地模式注册（原有逻辑）
      // 查重：企业名称
      if(Store.findEnterpriseByName(name)){
        errEl.textContent='该企业名称已注册';
        errEl.style.display='block';
        btn.textContent = oldText;
        btn.disabled = false;
        return;
      }
      const newEntId = Utils.uid('ent');
      const existUser = Store.collection('users').find(u=>u.account===account && u.enterpriseId===newEntId);
      if(existUser){
        errEl.textContent='该账号已存在';
        errEl.style.display='block';
        btn.textContent = oldText;
        btn.disabled = false;
        return;
      }

      // 创建企业
      Store.addEnterprise({
        id: newEntId,
        name, shortName: shortName || name.slice(0,6),
        industry, contactName, contactPhone, contactEmail,
        address:'', status:'active',
        license:'trial', maxUsers:5,
        expireDate: (()=>{ const d=new Date(); d.setDate(d.getDate()+30); return d.toISOString().slice(0,10); })(),
        remark:'新注册试用企业',
      });

      // 创建默认组织架构
      const orgId = Utils.uid('org');
      Store.addOrgUnit({
        id: orgId, enterpriseId: newEntId,
        name:'默认部门', parentId:null, leaderId:null, sort:1, desc:'默认部门',
      });

      // 创建管理员用户
      const userId = Utils.uid('usr');
      Store.insert('users', {
        id: userId, enterpriseId: newEntId,
        name: userName, account, password,
        phone: contactPhone, email: contactEmail,
        role:'admin', orgUnitId: orgId,
        title:'管理员', status:'active',
        avatar: userName.charAt(0),
        lastLoginAt: Utils.now(),
      });
      Store.updateOrgUnit(orgId, { leaderId: userId });

      btn.textContent = oldText;
      btn.disabled = false;
      Toast.show('企业注册成功，请登录', 'success');

      // 自动切换到登录Tab并预填
      Auth.switchTab('login');
      const entSelect = document.getElementById('loginEntId');
      entSelect.innerHTML = '<option value="">— 请选择企业 —</option>' +
        Store.enterprises().filter(e=>e.status==='active').map(e=>
          `<option value="${e.id}"${e.id===newEntId?' selected':''}>${Utils.esc(e.name)}</option>`
        ).join('');
      document.getElementById('loginAccount').value = account;
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginPassword').focus();
    }catch(e){
      errEl.textContent = e.message || '注册失败，请重试';
      errEl.style.display='block';
      btn.textContent = oldText;
      btn.disabled = false;
    }
  },

  // 退出
  logout(){
    const ent = Store.currentEnterprise ? Store.currentEnterprise() : null;
    const user = Store.currentUser ? Store.currentUser() : null;
    const isDemoExperience = ent?.workspaceType === 'demo' && ['wechat_mock','wechat_oauth'].includes(user?.identityProvider);
    const isPersonal = ent?.workspaceType === 'personal';
    const msg = isDemoExperience
      ? '当前是演示体验空间，本次对话只用于临时体验，退出后不作为你的个人工作记录长期保留。<br><br>通过邀请码开通个人版后，你导入的客户数据和 AI 对话草稿会保留，下次登录可以继续接着问。'
      : (isPersonal
        ? '确定要退出当前账号吗？你的个人版客户数据和 AI 对话草稿会保留，下次登录可以继续使用。'
        : '确定要退出当前账号吗？');
    Modal.confirm(isDemoExperience ? '退出演示体验' : '确认退出', msg, ()=>{
      if(isPersonal && typeof AI!=='undefined' && AI.saveConversation) AI.saveConversation();
      if(typeof Audit!=='undefined') Audit.log('logout', { action:'logout', result:'confirmed' });
      if(Store.session?.authProvider==='wechat_oauth'){
        fetch('/api/auth/wechat/logout', { method:'POST', credentials:'include' }).catch(()=>{});
      }
      Store.logout();
      if(typeof AI!=='undefined' && AI.clearRuntimeState) AI.clearRuntimeState();
      if(App.resetCollapsedStates) App.resetCollapsedStates();
      Auth.showLogin();
    }, isDemoExperience ? '我知道了，退出' : '确认退出');
  },
};
