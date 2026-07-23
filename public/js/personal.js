/* ========== 个人版体验闭环 ========== */
const Personal = {
  renderWorkspaceBanner(){
    if(!Store.isLoggedIn()) return '';
    const ent = Store.currentEnterprise();
    if(!ent) return '';
    if(Store.isDemoWorkspace()){
      return `
      <div class="workspace-banner workspace-banner-demo">
        <div>
          <div class="workspace-banner-title">当前为演示数据空间</div>
          <div class="workspace-banner-desc">可以体验 10 个销售分析视角；要导入或录入自己的客户数据，需要使用邀请码开通个人正式空间。</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Personal.openActivation('导入自己的客户数据')">邀请码开通</button>
      </div>`;
    }
    if(Store.isPersonalWorkspace()){
      const quota = Number(ent.aiCallQuota||0);
      const used = Number(ent.aiCallUsed||0);
      const customerLimit = Number(ent.customerLimit||0);
      return `
      <div class="workspace-banner workspace-banner-personal">
        <div>
          <div class="workspace-banner-title">${Utils.esc(ent.shortName||ent.name)} · 已开通个人版</div>
          <div class="workspace-banner-desc">个人数据与演示数据已隔离。AI额度：${quota ? `${used}/${quota} 次` : '未限制'}；客户容量：${customerLimit ? `${Store.customers().length}/${customerLimit}` : '未限制'}。</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.navigate('customer')">导入/录入客户</button>
      </div>`;
    }
    return '';
  },

  openActivation(reason='开通完整功能'){
    const hasLogin = Store.isLoggedIn();
    Modal.open({
      title: '邀请码开通个人版',
      size: 'md',
      body: `
      <div class="activation-panel">
        <div class="activation-note">
          <div class="activation-note-title">开通后你会获得一个独立的个人销售空间</div>
          <div class="activation-note-desc">演示数据会保留用于体验；你的客户、联系人、商机、跟进记录会进入个人空间，AI专家将优先读取你的真实数据。</div>
        </div>
        <div class="form-row"><label class="form-label">开通原因</label><input class="form-input" value="${Utils.esc(reason)}" disabled></div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">姓名 <span class="req">*</span></label><input class="form-input" id="actName" placeholder="如：崔相年"></div>
          <div class="form-row"><label class="form-label">手机号/账号 <span class="req">*</span></label><input class="form-input" id="actAccount" placeholder="用于后续登录"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">登录密码 <span class="req">*</span></label><input type="password" class="form-input" id="actPassword" placeholder="至少4位"></div>
          <div class="form-row"><label class="form-label">邀请码 <span class="req">*</span></label><input class="form-input" id="actCode" placeholder="请输入邀请码" style="text-transform:uppercase"></div>
        </div>
        <div id="actError" class="login-error" style="display:none"></div>
        <div class="activation-footnote">内测阶段邀请码可收费、赠送或渠道发放；每个邀请码会绑定权益包和AI调用额度。</div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Personal.activate(${hasLogin?'true':'false'})">开通并进入</button>`
    });
    setTimeout(()=>document.getElementById('actName')?.focus(), 50);
  },

  activate(fromLoggedIn){
    const err = document.getElementById('actError');
    const name = document.getElementById('actName')?.value.trim();
    const account = document.getElementById('actAccount')?.value.trim();
    const password = document.getElementById('actPassword')?.value.trim();
    const code = document.getElementById('actCode')?.value.trim();
    if(err) err.style.display = 'none';
    try{
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
    }
  },

  requirePersonal(reason){
    if(!Store.isDemoWorkspace()) return true;
    Personal.openActivation(reason);
    return false;
  },
};
