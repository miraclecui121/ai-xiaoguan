/* ========== 认证系统 Auth ========== */
/* 多租户登录/注销/企业注册/路由守卫
   双模式：API 模式（后端 JWT）或本地模式（localStorage session）*/
const Auth = {
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
      if(entMenu) entMenu.style.display = Store.isAdmin() ? '' : 'none';
    }
    // 刷新铃铛
    App.refreshNotifBadge();
  },

  // 渲染登录页
  renderLogin(){
    const box = document.getElementById('loginBox');
    const isApi = Store.mode === 'api';
    if(!isApi){
      Auth.normalizeLoginEnterprises();
    }
    box.innerHTML = `
      <div class="login-brand">
        <span class="logo-icon">冠</span>
        <span class="logo-text">AI<span class="logo-accent">销冠</span></span>
      </div>
      <div class="login-subtitle">AI销冠助手 · 个人版 / 企业版 ${isApi ? '<span class="badge badge-green" style="font-size:11px">云端版</span>' : '<span class="badge badge-gray" style="font-size:11px">本地体验版</span>'}</div>

      <div class="login-tabs login-tabs-single">
        <button class="login-tab active" id="loginTabLogin" onclick="Auth.switchTab('login')">登录</button>
      </div>

      <div id="loginFormPanel">
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
        <div id="loginError" class="login-error" style="display:none"></div>
        <button class="login-btn" id="loginBtn" onclick="Auth.doLogin()">登 录</button>

        <div class="login-demo-hint">
          ${isApi ? '<div class="login-hint-title">已开通企业账号</div><div class="login-hint-item">选择企业 → 输入账号密码登录</div>' : `
          <div class="login-hint-title">先体验，再用邀请码开通个人空间</div>
          <button class="login-hint-item login-demo-account" onclick="Auth.fillDemoAccount('ent_001','sales1','123456')" type="button"><span class="badge badge-gold">演示体验</span> <code>星瀚增长 / sales1</code> — 默认演示数据</button>
          <button class="login-hint-item login-demo-account" onclick="Personal.openActivation('开通个人正式空间')" type="button"><span class="badge badge-green">个人版</span> 邀请码开通 — 导入自己的客户数据</button>
          <button class="login-hint-item login-demo-account" onclick="Auth.fillDemoAccount('ent_001','admin','admin')" type="button"><span class="badge badge-gray">管理演示</span> <code>admin / admin</code> — 企业管理员</button>
          `}
        </div>
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
        errEl.textContent='账号或密码错误，或账号已被禁用';
        errEl.style.display='block';
        btn.textContent = oldText;
        btn.disabled = false;
        return;
      }

      Auth.showApp();
      App.navigate('dashboard');
      Toast.show(`欢迎回来，${user.name}！`, 'success');
    }catch(e){
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
    Modal.confirm('确认退出', '确定要退出当前账号吗？', ()=>{
      Store.logout();
      if(App.resetCollapsedStates) App.resetCollapsedStates();
      Auth.showLogin();
    }, '确认退出');
  },
};
