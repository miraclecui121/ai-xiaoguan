/* ========== 个人版体验闭环 ========== */
const Personal = {
  renderWorkspaceBanner(){
    if(!Store.isLoggedIn()) return '';
    const ent = Store.currentEnterprise();
    if(!ent) return '';
    if(Store.isDemoWorkspace()){
      const user = Store.currentUser();
      const trial = Store.demoTrialState ? Store.demoTrialState(user) : { applies:false };
      const trialText = trial.applies
        ? (trial.ok ? `体验期：剩余 ${trial.daysLeft} 天，到期后停止调用。` : `体验期已结束。`)
        : '';
      const demoQuota = Store.isWechatExperienceUser?.(user) && Number(user.aiCallQuota||0)
        ? `AI 额度：${Number(user.aiCallUsed||0)}/${Number(user.aiCallQuota||0)} 次；联网：${Number(user.searchUsed||0)}/${Number(user.searchQuota||0)} 次。`
        : '';
      return `
      <div class="workspace-banner workspace-banner-demo">
        <div>
          <div class="workspace-banner-title">当前为演示数据空间</div>
          <div class="workspace-banner-desc">可以体验 11 个销售分析视角；演示数据不会进入你的正式空间。${trialText}${demoQuota}要导入或录入自己的客户数据，需要使用邀请码开通个人正式空间。</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Personal.openActivation('创建我的个人空间')">邀请码开通</button>
      </div>`;
    }
    if(Store.isPersonalWorkspace()){
      const quota = Number(ent.aiCallQuota||0);
      const used = Number(ent.aiCallUsed||0);
      const searchQuota = Number(ent.searchQuota||0);
      const searchUsed = Number(ent.searchUsed||0);
      const customerLimit = Number(ent.customerLimit||0);
      const expiry = Store.personalWorkspaceExpiryState ? Store.personalWorkspaceExpiryState(ent) : { applies:false };
      const expiryText = expiry.applies
        ? (expiry.ok ? `使用期限：剩余 ${expiry.daysLeft} 天；` : `使用期限已结束；`)
        : '';
      return `
      <div class="workspace-banner workspace-banner-personal">
        <div>
          <div class="workspace-banner-title">${Utils.esc(ent.shortName||ent.name)} · 已开通个人版</div>
          <div class="workspace-banner-desc">个人数据与演示数据已隔离。${expiryText}AI额度：${quota ? `${used}/${quota} 次` : '未限制'}；联网检索：${searchQuota ? `${searchUsed}/${searchQuota} 次` : '未限制'}；客户容量：${customerLimit ? `${Store.customers().length}/${customerLimit}` : '未限制'}。</div>
        </div>
        <div class="workspace-banner-actions">
          <button class="btn btn-ghost btn-sm" onclick="Personal.switchToDemo()">看演示案例</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('customer')">导入/录入客户</button>
        </div>
      </div>`;
    }
    return '';
  },

  openActivation(reason='开通完整功能'){
    const hasLogin = Store.isLoggedIn();
    const acq = Store.getAcquisition ? Store.getAcquisition() : {};
    const currentUser = Store.currentUser ? Store.currentUser() : null;
    const isWechat = ['wechat_mock','wechat_oauth'].includes(currentUser?.identityProvider);
    if(!hasLogin || !isWechat){
      Modal.open({
        title: '先微信授权登录',
        size: 'sm',
        body: `
        <div class="activation-panel">
          <div class="activation-note">
            <div class="activation-note-title">个人体验版需要绑定微信身份</div>
            <div class="activation-note-desc">这样你在手机微信端和 PC 端都能进入同一个销售空间，对话记录和客户数据后续也能按同一身份沉淀。</div>
          </div>
        </div>`,
        footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Modal.close();Auth.loginWithWechat()">微信授权登录</button>`
      });
      return;
    }
    const defaultName = isWechat ? (currentUser.name || '微信体验用户') : '';
    const defaultAccount = isWechat ? (currentUser.account || '') : '';
    const passwordField = `<div class="activation-note-inline">当前已绑定微信身份，后续使用同一微信登录；无需再设置登录密码。</div>`;
    Modal.open({
      title: '邀请码开通个人版',
      size: 'md',
      body: `
      <div class="activation-panel">
          <div class="activation-note">
          <div class="activation-note-title">开通后你会获得一个独立的个人销售空间</div>
          <div class="activation-note-desc">演示数据会保留用于体验；你的客户、联系人、商机、跟进记录会进入个人空间，AI专家将优先读取你的真实数据。个人空间会绑定当前微信身份，PC 和手机端都使用同一空间。</div>
        </div>
        <div class="form-row"><label class="form-label">开通原因</label><input class="form-input" value="${Utils.esc(reason)}" disabled></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">姓名 <span class="req">*</span></label><input class="form-input" id="actName" value="${Utils.esc(defaultName)}" placeholder="如：崔相年"></div>
          <div class="form-row"><label class="form-label">手机号/账号 <span class="req">*</span></label><input class="form-input" id="actAccount" value="${Utils.esc(defaultAccount)}" placeholder="用于后续登录"></div>
        </div>
        <div class="form-grid-2">
          ${passwordField}
          <div class="form-row"><label class="form-label">邀请码 <span class="req">*</span></label><input class="form-input" id="actCode" value="${Utils.esc(acq.inviteCode||'')}" placeholder="输入你拿到的邀请码，如 AIXG0802-XXXX-XXXX" style="text-transform:uppercase"></div>
        </div>
        <div id="actError" class="login-error" style="display:none"></div>
        <div class="activation-footnote">可以直接输入邀请码开通；邀请链接只是帮你自动填码和记录来源。每个邀请码会绑定权益包和 AI 调用额度。</div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Personal.activate(${hasLogin?'true':'false'})">开通并进入</button>`
    });
    setTimeout(()=>document.getElementById('actName')?.focus(), 50);
  },

  async activate(fromLoggedIn){
    const err = document.getElementById('actError');
    const name = document.getElementById('actName')?.value.trim();
    const account = document.getElementById('actAccount')?.value.trim();
    const currentUser = Store.currentUser ? Store.currentUser() : null;
    const isWechat = ['wechat_mock','wechat_oauth'].includes(currentUser?.identityProvider);
    if(!Store.isLoggedIn() || !isWechat){
      if(err){
        err.textContent = '请先使用微信授权登录，再输入邀请码开通个人体验版。';
        err.style.display = 'block';
      }else{
        Toast.show('请先使用微信授权登录，再输入邀请码开通个人体验版。', 'error');
      }
      return;
    }
    const password = document.getElementById('actPassword')?.value.trim() || (isWechat ? 'wechat_auth' : '');
    const code = document.getElementById('actCode')?.value.trim();
    if(err) err.style.display = 'none';
    const btn = Array.from(document.querySelectorAll('.modal-footer .btn-primary')).find(b=>b.textContent.includes('开通'));
    if(btn){ btn.disabled = true; btn.textContent = '校验邀请码...'; }
    try{
      const existedBefore = Store.findInviteCode(code);
      const syncResult = !existedBefore && Store.fetchInviteCodeFromServer
        ? await Store.fetchInviteCodeFromServer(code)
        : { ok:!!existedBefore };
      const existedAfter = Store.findInviteCode(code);
      if(!existedBefore && !existedAfter){
        const normalized = String(code||'').trim().toUpperCase();
        if(/^AIXG0802-/.test(normalized)){
          throw new Error(syncResult?.ok
            ? '邀请码台账已同步，但没有找到这个码。请检查是否输入错字符，或换一个未使用的邀请码。'
            : `没有找到这个邀请码。请检查是否输入错字符，或联系发放邀请码的人确认。${syncResult?.error ? '原因：'+syncResult.error : ''}`);
        }
      }
      if(btn) btn.textContent = '开通中...';
      const result = Store.activatePersonalWorkspace({ code, name, account, password, phone: account });
      Modal.close();
      Auth.showApp();
      Auth.updateTopbar();
      App.navigate('customer');
      Toast.show(`已开通${result.invite.planName || '个人版'}，可以导入自己的客户数据`, 'success');
    }catch(e){
      if(err){
        err.textContent = e.message || '开通失败';
        err.style.display = 'block';
      }else{
        Toast.show(e.message || '开通失败', 'error');
      }
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = '开通并进入'; }
    }
  },

  requirePersonal(reason){
    if(!Store.isDemoWorkspace()) return true;
    Personal.openActivation(reason);
    return false;
  },

  switchToDemo(){
    try{
      const user = Store.switchToDemoWorkspace();
      if(typeof Audit!=='undefined') Audit.log('switch_to_demo_workspace', { action:'switch_workspace', result:'success' });
      Auth.updateTopbar();
      App.navigate('ai');
      Toast.show(`已切回演示空间，${user.name}`, 'success');
    }catch(e){
      Toast.show(e.message || '切换失败', 'error');
    }
  },
};
