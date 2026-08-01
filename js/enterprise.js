/* ========== 企业管理 Enterprise ========== */
/* 企业信息 / 组织架构 / 用户管理（仅企业管理员可访问）*/
const Enterprise = {

  // ===== 企业信息页 =====
  renderInfo(){
    const ent = Store.currentEnterprise();
    if(!ent) return '<div class="empty">未找到企业信息</div>';
    const userCount = Store.users().length;
    const orgCount = Store.orgUnits().length;
    const stats = Store.stats();
    return `
    <div class="page-head">
      <div><div class="page-title">🏢 企业信息</div><div class="page-desc">维护企业基本资料与开通信息</div></div>
    </div>
    <div class="card">
      <div class="card-title">基本信息</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">企业全称 *</label><input class="form-input" id="entName" value="${Utils.esc(ent.name)}"></div>
        <div class="form-row"><label class="form-label">企业简称</label><input class="form-input" id="entShort" value="${Utils.esc(ent.shortName||'')}"></div>
        <div class="form-row"><label class="form-label">所属行业</label>
          <select class="form-input" id="entIndustry">${DICT.industry.map(i=>`<option value="${i}"${i===ent.industry?' selected':''}>${i}</option>`).join('')}</select>
        </div>
        <div class="form-row"><label class="form-label">企业状态</label>
          <span class="badge ${DICT.cls('enterpriseStatus',ent.status)}">${DICT.label('enterpriseStatus',ent.status)}</span>
        </div>
      </div>
      <div class="form-row mt8"><label class="form-label">企业地址</label><input class="form-input" id="entAddress" value="${Utils.esc(ent.address||'')}"></div>
      <button class="btn btn-primary mt8" onclick="Enterprise.saveInfo()">保存基本信息</button>
    </div>

    <div class="card">
      <div class="card-title">系统联系人</div>
      <div class="form-grid-2">
        <div class="form-row"><label class="form-label">联系人姓名</label><input class="form-input" id="entContactName" value="${Utils.esc(ent.contactName||'')}"></div>
        <div class="form-row"><label class="form-label">联系电话</label><input class="form-input" id="entContactPhone" value="${Utils.esc(ent.contactPhone||'')}"></div>
        <div class="form-row"><label class="form-label">联系邮箱</label><input class="form-input" id="entContactEmail" value="${Utils.esc(ent.contactEmail||'')}"></div>
        <div class="form-row"><label class="form-label">备注</label><input class="form-input" id="entRemark" value="${Utils.esc(ent.remark||'')}"></div>
      </div>
      <button class="btn btn-primary mt8" onclick="Enterprise.saveContact()">保存联系人信息</button>
    </div>

    <div class="card">
      <div class="card-title">开通信息</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">授权版本</div><div class="info-value"><span class="badge ${DICT.cls('enterpriseLicense',ent.license)}">${DICT.label('enterpriseLicense',ent.license)}</span></div></div>
        <div class="info-item"><div class="info-label">用户上限</div><div class="info-value">${ent.maxUsers} 人 <span style="color:var(--text-secondary)">（已开通 ${userCount} 人）</span></div></div>
        <div class="info-item"><div class="info-label">到期日期</div><div class="info-value">${Utils.fmtDate(ent.expireDate)}</div></div>
        <div class="info-item"><div class="info-label">组织架构数</div><div class="info-value">${orgCount} 个部门</div></div>
        <div class="info-item"><div class="info-label">客户总数</div><div class="info-value">${stats.customerTotal} 家</div></div>
        <div class="info-item"><div class="info-label">商机总数</div><div class="info-value">${stats.oppTotal} 个</div></div>
        <div class="info-item"><div class="info-label">创建时间</div><div class="info-value">${Utils.fmtDate(ent.createdAt)}</div></div>
        <div class="info-item"><div class="info-label">企业ID</div><div class="info-value" style="font-family:monospace;font-size:12px">${ent.id}</div></div>
      </div>
    </div>
    `;
  },
  saveInfo(){
    const ent = Store.currentEnterprise();
    Store.updateEnterprise(ent.id, {
      name: document.getElementById('entName').value.trim(),
      shortName: document.getElementById('entShort').value.trim(),
      industry: document.getElementById('entIndustry').value,
      address: document.getElementById('entAddress').value.trim(),
    });
    Toast.show('企业基本信息已保存','success');
    Auth.updateTopbar();
    App.navigate('enterprise-info');
  },
  saveContact(){
    const ent = Store.currentEnterprise();
    Store.updateEnterprise(ent.id, {
      contactName: document.getElementById('entContactName').value.trim(),
      contactPhone: document.getElementById('entContactPhone').value.trim(),
      contactEmail: document.getElementById('entContactEmail').value.trim(),
      remark: document.getElementById('entRemark').value.trim(),
    });
    Toast.show('联系人信息已保存','success');
  },

  // ===== 组织架构页 =====
  renderOrg(){
    const tree = Store.orgTree();
    return `
    <div class="page-head">
      <div><div class="page-title">🏢 组织架构</div><div class="page-desc">管理企业部门结构与人员归属</div></div>
      <button class="btn btn-primary" onclick="Enterprise.addOrgUnit(null)">+ 新增部门</button>
    </div>
    <div class="card">
      <div class="org-tree">
        ${tree.length ? tree.map(u=>Enterprise.renderOrgNode(u, 0)).join('') : '<div class="empty">暂无组织架构，请点击右上角新增</div>'}
      </div>
    </div>
    `;
  },
  renderOrgNode(unit, depth){
    const indent = depth * 28;
    const userCnt = unit.users.length;
    const leader = unit.leaderId ? Store.user(unit.leaderId) : null;
    const childrenHtml = (unit.children||[]).map(c=>Enterprise.renderOrgNode(c, depth+1)).join('');
    return `
    <div class="org-node" style="margin-left:${indent}px">
      <div class="org-node-bar" style="margin-left:-${indent}px">
        <div class="org-node-info">
          <span class="org-node-icon">📁</span>
          <span class="org-node-name">${Utils.esc(unit.name)}</span>
          ${leader ? `<span class="badge badge-blue" style="margin-left:8px">负责人: ${Utils.esc(leader.name)}</span>` : ''}
          ${userCnt ? `<span class="badge badge-gray">${userCnt}人</span>` : ''}
          ${unit.desc ? `<span style="font-size:12px;color:var(--text-secondary);margin-left:4px">${Utils.esc(unit.desc)}</span>` : ''}
        </div>
        <div class="org-node-actions">
          <button class="btn btn-ghost btn-sm" onclick="Enterprise.addOrgUnit('${unit.id}')">+ 子部门</button>
          <button class="btn btn-ghost btn-sm" onclick="Enterprise.editOrgUnit('${unit.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="Enterprise.deleteOrgUnit('${unit.id}')">删除</button>
        </div>
      </div>
      ${userCnt ? `
        <div class="org-users">
          ${unit.users.map(u=>`
            <div class="org-user-item">
              <span class="avatar-sm">${Utils.esc(u.avatar||u.name.charAt(0))}</span>
              <span class="org-user-name">${Utils.esc(u.name)}</span>
              <span class="org-user-title">${Utils.esc(u.title||'')}</span>
              <span class="badge ${DICT.cls('userRole',u.role)}">${DICT.label('userRole',u.role)}</span>
              <span class="badge ${DICT.cls('userStatus',u.status)}">${DICT.label('userStatus',u.status)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${childrenHtml}
    </div>
    `;
  },
  addOrgUnit(parentId){
    const parent = parentId ? Store.orgUnit(parentId) : null;
    const allUnits = Store.orgUnits();
    const leaderOptions = Store.users();
    Modal.open({
      title: parent ? `在「${parent.name}」下新增子部门` : '新增顶级部门',
      size: 'sm',
      body: `
        <div class="form-row"><label class="form-label">部门名称 *</label><input class="form-input" id="orgName" placeholder="如：政企销售三部"></div>
        <div class="form-row"><label class="form-label">部门描述</label><input class="form-input" id="orgDesc" placeholder="部门职能描述"></div>
        <div class="form-row"><label class="form-label">部门负责人</label>
          <select class="form-input" id="orgLeader"><option value="">— 暂不指定 —</option>
            ${leaderOptions.map(u=>`<option value="${u.id}">${Utils.esc(u.name)}（${Utils.esc(u.title||'')}）</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">排序权重</label><input class="form-input" id="orgSort" type="number" value="${allUnits.filter(o=>o.parentId===(parentId||null)).length+1}"></div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Enterprise.saveOrgUnit('${parentId||''}')">创建</button>`
    });
  },
  saveOrgUnit(parentId){
    const name = document.getElementById('orgName').value.trim();
    if(!name){ Toast.show('请输入部门名称','error'); return; }
    Store.addOrgUnit({
      name,
      desc: document.getElementById('orgDesc').value.trim(),
      parentId: parentId || null,
      leaderId: document.getElementById('orgLeader').value || null,
      sort: Number(document.getElementById('orgSort').value)||1,
    });
    Modal.close();
    Toast.show('部门已创建','success');
    App.navigate('enterprise-org');
  },
  editOrgUnit(id){
    const unit = Store.orgUnit(id);
    if(!unit) return;
    const users = Store.users();
    Modal.open({
      title: '编辑部门：' + unit.name,
      size: 'sm',
      body: `
        <div class="form-row"><label class="form-label">部门名称 *</label><input class="form-input" id="editOrgName" value="${Utils.esc(unit.name)}"></div>
        <div class="form-row"><label class="form-label">部门描述</label><input class="form-input" id="editOrgDesc" value="${Utils.esc(unit.desc||'')}"></div>
        <div class="form-row"><label class="form-label">部门负责人</label>
          <select class="form-input" id="editOrgLeader"><option value="">— 暂不指定 —</option>
            ${users.map(u=>`<option value="${u.id}"${u.id===unit.leaderId?' selected':''}>${Utils.esc(u.name)}（${Utils.esc(u.title||'')}）</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label class="form-label">排序权重</label><input class="form-input" id="editOrgSort" type="number" value="${unit.sort||1}"></div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Enterprise.updateOrgUnit('${id}')">保存</button>`
    });
  },
  updateOrgUnit(id){
    const name = document.getElementById('editOrgName').value.trim();
    if(!name){ Toast.show('请输入部门名称','error'); return; }
    Store.updateOrgUnit(id, {
      name,
      desc: document.getElementById('editOrgDesc').value.trim(),
      leaderId: document.getElementById('editOrgLeader').value || null,
      sort: Number(document.getElementById('editOrgSort').value)||1,
    });
    Modal.close();
    Toast.show('部门已更新','success');
    App.navigate('enterprise-org');
  },
  deleteOrgUnit(id){
    const unit = Store.orgUnit(id);
    if(!unit) return;
    const childCnt = Store.orgUnitChildren(id).length;
    const userCnt = Store.orgUnitUsers(id).length;
    let warn = `确认删除部门「${unit.name}」？`;
    if(childCnt) warn += `\n⚠️ ${childCnt} 个子部门将移至上级`;
    if(userCnt) warn += `\n⚠️ ${userCnt} 名用户将移至上级部门`;
    Modal.confirm('删除部门', warn, ()=>{
      Store.deleteOrgUnit(id);
      Toast.show('部门已删除','success');
      App.navigate('enterprise-org');
    }, '确认删除');
  },

  // ===== 用户管理页 =====
  renderUsers(){
    const users = Store.users();
    const ent = Store.currentEnterprise();
    return `
    <div class="page-head">
      <div><div class="page-title">👤 用户管理</div><div class="page-desc">管理企业账号与权限（${users.length}/${ent.maxUsers} 人）</div></div>
      ${users.length < ent.maxUsers ? '<button class="btn btn-primary" onclick="Enterprise.addUser()">+ 开通账号</button>' : '<span class="badge badge-orange">已达用户上限</span>'}
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>账号</th>
            <th>角色</th>
            <th>所属部门</th>
            <th>职务</th>
            <th>联系方式</th>
            <th>状态</th>
            <th>最后登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u=>{
            const org = u.orgUnitId ? Store.orgUnit(u.orgUnitId) : null;
            return `
            <tr>
              <td><div class="user-cell"><span class="avatar-sm">${Utils.esc(u.avatar||u.name.charAt(0))}</span><span>${Utils.esc(u.name)}</span></div></td>
              <td><code>${Utils.esc(u.account)}</code></td>
              <td><span class="badge ${DICT.cls('userRole',u.role)}">${DICT.label('userRole',u.role)}</span></td>
              <td>${org?Utils.esc(org.name):'<span style="color:var(--text-secondary)">未分配</span>'}</td>
              <td>${Utils.esc(u.title||'—')}</td>
              <td><div style="font-size:12px">${Utils.esc(u.phone||'—')}</div><div style="font-size:12px;color:var(--text-secondary)">${Utils.esc(u.email||'')}</div></td>
              <td><span class="badge ${DICT.cls('userStatus',u.status)}">${DICT.label('userStatus',u.status)}</span></td>
              <td style="font-size:12px">${u.lastLoginAt?Utils.relativeTime(u.lastLoginAt):'—'}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="Enterprise.editUser('${u.id}')">编辑</button>
                ${u.id===Store.session.userId ? '' : `<button class="btn btn-ghost btn-sm" onclick="Enterprise.toggleUser('${u.id}')">${u.status==='active'?'禁用':'启用'}</button>`}
                ${u.id===Store.session.userId ? '' : `<button class="btn btn-danger btn-sm" onclick="Enterprise.deleteUser('${u.id}')">删除</button>`}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    `;
  },
  addUser(){
    const orgUnits = Store.orgUnits();
    Modal.open({
      title: '开通新账号',
      body: `
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">姓名 *</label><input class="form-input" id="usrName" placeholder="用户真实姓名"></div>
          <div class="form-row"><label class="form-label">账号 *</label><input class="form-input" id="usrAccount" placeholder="登录账号"></div>
          <div class="form-row"><label class="form-label">密码 *</label><input class="form-input" id="usrPassword" type="text" value="123456" placeholder="初始密码"></div>
          <div class="form-row"><label class="form-label">角色 *</label>
            <select class="form-input" id="usrRole">
              ${DICT.userRole.filter(r=>r.value!=='superadmin').map(r=>`<option value="${r.value}">${r.label} — ${r.desc}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label class="form-label">所属部门</label>
            <select class="form-input" id="usrOrg"><option value="">— 未分配 —</option>
              ${orgUnits.map(o=>`<option value="${o.id}">${Utils.esc(o.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label class="form-label">职务</label><input class="form-input" id="usrTitle" placeholder="如：销售专员"></div>
          <div class="form-row"><label class="form-label">手机号</label><input class="form-input" id="usrPhone" placeholder="手机号"></div>
          <div class="form-row"><label class="form-label">邮箱</label><input class="form-input" id="usrEmail" placeholder="邮箱"></div>
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Enterprise.saveNewUser()">开通</button>`
    });
  },
  saveNewUser(){
    const name = document.getElementById('usrName').value.trim();
    const account = document.getElementById('usrAccount').value.trim();
    const password = document.getElementById('usrPassword').value;
    if(!name){ Toast.show('请输入姓名','error'); return; }
    if(!account){ Toast.show('请输入账号','error'); return; }
    if(!password){ Toast.show('请设置密码','error'); return; }
    // 查重
    if(Store.findUserByAccount(account)){
      Toast.show('该账号已存在','error'); return;
    }
    const ent = Store.currentEnterprise();
    if(Store.users().length >= ent.maxUsers){
      Toast.show('已达用户上限，无法开通','error'); return;
    }
    Store.addUser({
      name, account, password,
      role: document.getElementById('usrRole').value,
      orgUnitId: document.getElementById('usrOrg').value || null,
      title: document.getElementById('usrTitle').value.trim(),
      phone: document.getElementById('usrPhone').value.trim(),
      email: document.getElementById('usrEmail').value.trim(),
      status: 'active',
      avatar: name.charAt(0),
      lastLoginAt: null,
    });
    Modal.close();
    Toast.show('账号已开通','success');
    App.navigate('enterprise-users');
  },
  editUser(id){
    const u = Store.user(id);
    if(!u) return;
    const orgUnits = Store.orgUnits();
    Modal.open({
      title: '编辑用户：' + u.name,
      body: `
        <div class="form-grid-2">
          <div class="form-row"><label class="form-label">姓名 *</label><input class="form-input" id="editUsrName" value="${Utils.esc(u.name)}"></div>
          <div class="form-row"><label class="form-label">账号</label><input class="form-input" id="editUsrAccount" value="${Utils.esc(u.account)}" disabled style="opacity:0.6"></div>
          <div class="form-row"><label class="form-label">重置密码</label><input class="form-input" id="editUsrPassword" placeholder="留空则不修改"></div>
          <div class="form-row"><label class="form-label">角色 *</label>
            <select class="form-input" id="editUsrRole">
              ${DICT.userRole.filter(r=>r.value!=='superadmin').map(r=>`<option value="${r.value}"${r.value===u.role?' selected':''}>${r.label} — ${r.desc}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label class="form-label">所属部门</label>
            <select class="form-input" id="editUsrOrg"><option value="">— 未分配 —</option>
              ${orgUnits.map(o=>`<option value="${o.id}"${o.id===u.orgUnitId?' selected':''}>${Utils.esc(o.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label class="form-label">职务</label><input class="form-input" id="editUsrTitle" value="${Utils.esc(u.title||'')}"></div>
          <div class="form-row"><label class="form-label">手机号</label><input class="form-input" id="editUsrPhone" value="${Utils.esc(u.phone||'')}"></div>
          <div class="form-row"><label class="form-label">邮箱</label><input class="form-input" id="editUsrEmail" value="${Utils.esc(u.email||'')}"></div>
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="Enterprise.saveEditUser('${id}')">保存</button>`
    });
  },
  saveEditUser(id){
    const patch = {
      name: document.getElementById('editUsrName').value.trim(),
      role: document.getElementById('editUsrRole').value,
      orgUnitId: document.getElementById('editUsrOrg').value || null,
      title: document.getElementById('editUsrTitle').value.trim(),
      phone: document.getElementById('editUsrPhone').value.trim(),
      email: document.getElementById('editUsrEmail').value.trim(),
    };
    const pwd = document.getElementById('editUsrPassword').value;
    if(pwd) patch.password = pwd;
    Store.updateUser(id, patch);
    Modal.close();
    Toast.show('用户信息已更新','success');
    App.navigate('enterprise-users');
  },
  toggleUser(id){
    const u = Store.user(id);
    if(!u) return;
    const newStatus = u.status==='active' ? 'disabled' : 'active';
    Store.updateUser(id, {status:newStatus});
    Toast.show(newStatus==='active'?'账号已启用':'账号已禁用','success');
    App.navigate('enterprise-users');
  },
  deleteUser(id){
    const u = Store.user(id);
    if(!u) return;
    Modal.confirm('删除用户', `确认删除用户「${u.name}」（${u.account}）？\n该用户关联的客户和商机数据不会被删除，但将变为未分配状态。`, ()=>{
      Store.deleteUser(id);
      Toast.show('用户已删除','success');
      App.navigate('enterprise-users');
    }, '确认删除');
  },
};
