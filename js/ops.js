(function(){
  const EXPERT_NAMES = {
    "industry-assess":"行业评估",
    "industry-insight":"行业洞察",
    "customer-insight":"客户洞察",
    "lead-dev":"线索开发",
    "lead-judgment":"意向判断",
    "sales-visit":"客户拜访",
    "solution":"解决方案",
    "value-marketing":"价值营销",
    "win-strategy":"赢单策略",
    "customer-mgmt":"客户经营",
    "sop-design":"销售SOP",
  };
  const EVENT_LABELS = {
    wechat_oauth_login_success:"微信内授权登录",
    wechat_qr_login_success:"PC扫码登录",
    wechat_oauth_session_restored:"会话恢复",
    wechat_demo_login_success:"本机微信模拟登录",
    login_success:"备用账号登录",
    invite_code_created:"邀请码创建",
    invite_code_validated:"邀请码校验",
    invite_code_issued:"邀请码发放",
    invite_code_activated:"邀请码激活",
    invite_ledger_imported:"邀请码导入",
    invite_ledger_codes_viewed:"查看邀请码台账",
    ai_chat:"AI对话",
    platform_chat:"AI对话",
    platform_search:"联网检索",
    ai_answer_feedback:"回答反馈",
    admin_usage_detail_viewed:"运营日志查询",
  };
  const STATUS_LABELS = {
    active:"未发放",
    issued:"已发放",
    activated:"已激活",
    disabled:"已停用",
    success:"成功",
    found:"已找到",
    not_found:"不存在",
    error:"失败",
  };

  const state = {
    detail:null,
    tab:"overview",
  };

  function $(id){ return document.getElementById(id); }
  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, (m)=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;",
    }[m]));
  }
  function fmtTime(ts){
    if(!ts) return "";
    try{ return new Date(ts).toLocaleString("zh-CN", { hour12:false }); }
    catch{ return String(ts); }
  }
  function expertName(id){
    if(!id || id === "(none)") return "未指定";
    return EXPERT_NAMES[id] || id;
  }
  function eventLabel(event){
    return EVENT_LABELS[event] || event || "事件";
  }
  function statusLabel(status){
    return STATUS_LABELS[status] || status || "—";
  }
  function inviteLink(row){
    const code = String(row?.code || "").trim();
    if(!code) return "";
    const params = new URLSearchParams();
    params.set("invite", code);
    if(row.sourceChannel || row.user?.sourceChannel) params.set("src", row.sourceChannel || row.user.sourceChannel);
    if(row.campaignName || row.user?.campaignName) params.set("campaign", row.campaignName || row.user.campaignName);
    return `${location.origin}/?${params.toString()}`;
  }
  function setStatus(text, cls){
    const box = $("opsStatus");
    if(!box) return;
    box.className = `ops-status ${cls || ""}`.trim();
    box.querySelector("span:last-child").textContent = text;
  }
  function table(headers, rows, emptyText){
    return `<div class="ops-table-wrap"><table class="ops-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="ops-empty-cell">${esc(emptyText || "暂无记录")}</td></tr>`}</tbody></table></div>`;
  }
  function stat(label, value){
    return `<div class="ops-stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  }
  function render(){
    const root = $("opsResult");
    if(!root) return;
    if(!state.detail){
      root.innerHTML = `<div class="ops-empty">输入查询口令后开始查看用户使用质量。</div>`;
      return;
    }
    const tabs = [
      ["overview","概览"],
      ["logins","登录"],
      ["invites","邀请码"],
      ["feedbacks","反馈"],
      ["questions","问题"],
      ["experts","专家/联网"],
      ["entities","实体识别"],
    ];
    root.innerHTML = `
      <div class="ops-meta">生成时间：${esc(fmtTime(state.detail.generatedAt))} · 存储：${esc(state.detail.storage?.type || "")} · 范围：近 ${Number(state.detail.days || 0)} 天</div>
      <div class="ops-tabs">
        ${tabs.map(([id,label])=>`<button type="button" data-tab="${id}" class="${state.tab===id?"active":""}">${label}</button>`).join("")}
      </div>
      <div class="ops-tab-panel">${renderTab(state.detail, state.tab)}</div>
    `;
    root.querySelectorAll("[data-tab]").forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        state.tab = btn.dataset.tab || "overview";
        render();
      });
    });
    root.querySelectorAll("[data-copy-invite]").forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        const index = Number(btn.dataset.copyInvite || -1);
        copyInviteLink(index);
      });
    });
  }
  function renderTab(detail, tab){
    if(tab === "logins") return renderLogins(detail);
    if(tab === "invites") return renderInvites(detail);
    if(tab === "feedbacks") return renderFeedbacks(detail);
    if(tab === "questions") return renderQuestions(detail);
    if(tab === "experts") return renderExperts(detail);
    if(tab === "entities") return renderEntities(detail);
    return renderOverview(detail);
  }
  function renderOverview(detail){
    const c = detail.counts || {};
    const stats = [
      ["登录事件", c.logins || 0],
      ["问题记录", c.questions || 0],
      ["回答反馈", c.feedbacks || 0],
      ["有帮助/不准", `${Number(c.helpfulFeedbacks || 0)}/${Number(c.unhelpfulFeedbacks || 0)}`],
      ["AI调用", c.aiCalls || 0],
      ["联网检索", c.searches || 0],
      ["活跃用户", c.users || 0],
      ["客户", c.customers || 0],
      ["公司", c.companies || 0],
      ["地区/产品", `${Number(c.regions || 0)}/${Number(c.products || 0)}`],
    ].map(([label,value])=>stat(label,value)).join("");
    const users = (detail.users || []).slice(0, 30).map(row=>`
      <tr>
        <td>${esc(row.user?.userName || "未知")}<small>${esc(row.user?.account || "")}</small></td>
        <td>${esc(row.user?.enterpriseName || "—")}<small>${esc(row.user?.workspaceType || "")}${row.inviteCode ? ` · ${esc(row.inviteCode)}` : ""}</small></td>
        <td>${Number(row.logins || 0)}</td>
        <td>${Number(row.questions || 0)}</td>
        <td>${Number(row.aiCalls || 0)} / ${Number(row.searches || 0)}</td>
        <td>${Number(row.tokens || 0).toLocaleString()}</td>
        <td>${esc(fmtTime(row.lastAt))}</td>
      </tr>`).join("");
    const workspaces = (detail.workspaceUsers || []).slice(0, 30).map(row=>`
      <tr>
        <td>${esc(row.nickname || "微信用户")}<small>${esc(row.externalId || "")}</small></td>
        <td>${esc(row.inviteCode || "—")}<small>${esc(row.sourceChannel || "")} ${esc(row.campaignName || "")}</small></td>
        <td>${Number(row.workspaceVersion || 0)}</td>
        <td>${esc(fmtTime(row.updatedAt))}</td>
      </tr>`).join("");
    return `
      <div class="ops-stats">${stats}</div>
      <div class="ops-grid">
        <div class="ops-panel">
          <h3>用户使用质量</h3>
          ${table(["用户","空间","登录","问题","AI/联网","Token","最近"], users, "暂无用户记录")}
        </div>
        <div class="ops-panel">
          <h3>已同步个人空间</h3>
          ${table(["微信身份","邀请码/来源","版本","最近同步"], workspaces, "暂无云端个人空间")}
        </div>
      </div>`;
  }
  function renderLogins(detail){
    const rows = (detail.logins || []).map(row=>`
      <tr>
        <td>${esc(fmtTime(row.ts))}</td>
        <td>${esc(eventLabel(row.event))}<small>${esc(row.result || row.action || "")}</small></td>
        <td>${esc(row.user?.userName || "未知")}<small>${esc(row.user?.account || "")}</small></td>
        <td>${esc(row.user?.enterpriseName || "—")}<small>${esc(row.user?.workspaceType || "")}</small></td>
        <td>${esc(row.inviteCode || row.user?.inviteCode || "—")}<small>${esc(row.sourceChannel || "")} ${esc(row.campaignName || "")}</small></td>
      </tr>`).join("");
    return `<div class="ops-panel">${table(["时间","事件","用户","空间","来源/邀请码"], rows, "暂无登录记录")}</div>`;
  }
  function renderInvites(detail){
    const rows = (detail.invites || []).map((row, index)=>{
      const link = inviteLink(row);
      const canCopy = Boolean(row.code && link);
      const sourceMeta = [
        row.campaignName || row.user?.campaignName || "",
        row.expiresAt ? `到期 ${row.expiresAt}` : "",
        row.issuedBy ? `发放人 ${row.issuedBy}` : "",
      ].filter(Boolean).join(" · ");
      return `
      <tr>
        <td>${esc(fmtTime(row.ts || row.lastUsedAt || row.issuedAt))}</td>
        <td><code class="ops-code">${esc(row.code || "—")}</code><small>${esc(statusLabel(row.status || row.result))}</small></td>
        <td>${esc(eventLabel(row.event))}<small>${esc(row.planName || "")}</small></td>
        <td>${esc(row.lastUsedBy || row.user?.userName || "—")}<small>${esc(row.lastUsedAccount || row.user?.account || "")}</small></td>
        <td>${Number(row.usedCount || 0)} / ${Number(row.maxUses || 0) || "不限"}<small>AI ${Number(row.aiCallQuota || 0)} · 联网 ${Number(row.searchQuota || 0)} · 客户 ${Number(row.customerLimit || 0)}</small></td>
        <td>${esc(row.sourceChannel || row.user?.sourceChannel || "—")}<small>${esc(sourceMeta)}</small></td>
        <td>${canCopy ? `<button class="btn btn-ghost btn-sm ops-copy-btn" type="button" data-copy-invite="${index}">复制链接</button>` : "—"}</td>
      </tr>`;
    }).join("");
    return `<div class="ops-panel">${table(["时间","邀请码","事件","用户","权益/用量","来源","操作"], rows, "暂无邀请码记录")}</div>`;
  }
  function feedbackLabel(result){
    return ({
      helpful:"有帮助",
      not_helpful:"不够准",
    })[result] || result || "—";
  }
  function feedbackReason(reason){
    return ({
      not_accurate:"不够准",
    })[reason] || reason || "";
  }
  function renderFeedbacks(detail){
    const rows = (detail.feedbacks || []).map(row=>`
      <tr>
        <td>${esc(fmtTime(row.ts))}</td>
        <td>${esc(row.user?.userName || "未知")}<small>${esc(row.user?.account || "")}</small></td>
        <td><span class="ops-badge ${row.result === "helpful" ? "green" : "orange"}">${esc(feedbackLabel(row.result))}</span><small>${esc(feedbackReason(row.reason))}</small></td>
        <td>${esc(expertName(row.expertId))}<small>${esc(row.customerName || (row.customerNames || []).join("、") || "未识别客户")}</small></td>
        <td class="ops-question">${esc(row.question || "")}</td>
        <td class="ops-question">${esc(row.message || "")}</td>
      </tr>`).join("");
    return `<div class="ops-panel">${table(["时间","用户","反馈","专家/客户","问题","回答片段"], rows, "暂无回答反馈")}</div>`;
  }
  function renderQuestions(detail){
    const rows = (detail.questions || []).map(q=>`
      <tr>
        <td>${esc(fmtTime(q.ts))}<small>${esc(q.kind || "")}${q.success === false ? " · 失败" : ""}</small></td>
        <td>${esc(q.user?.userName || "未知")}<small>${esc(q.user?.account || "")}</small></td>
        <td>${esc(expertName(q.expertId))}<small>${esc(q.customerName || "未识别客户")}</small></td>
        <td>${q.kind === "search" ? '<span class="ops-badge green">联网</span>' : '<span class="ops-badge gray">对话</span>'}</td>
        <td class="ops-question">${esc(q.question || "")}<small>${esc(q.model || q.error || "")}${q.tokens ? ` · ${Number(q.tokens).toLocaleString()} tokens` : ""}</small></td>
      </tr>`).join("");
    return `<div class="ops-panel">${table(["时间","用户","专家/客户","类型","问题"], rows, "暂无问题记录")}</div>`;
  }
  function renderExperts(detail){
    const experts = (detail.experts || []).map(row=>`
      <tr>
        <td>${esc(expertName(row.expertId))}<small>${esc(row.expertId || "")}</small></td>
        <td>${Number(row.calls || 0)}</td>
        <td>${Number(row.questions || 0)}</td>
        <td>${Number(row.searches || 0)}</td>
        <td>${Number(row.users || 0)}</td>
        <td>${Number(row.tokens || 0).toLocaleString()}</td>
        <td>${esc(fmtTime(row.lastAt))}</td>
      </tr>`).join("");
    const calls = (detail.aiCalls || []).slice(0, 160).map(row=>`
      <tr>
        <td>${esc(fmtTime(row.ts))}</td>
        <td>${row.kind === "search" ? '<span class="ops-badge green">联网检索</span>' : '<span class="ops-badge gray">模型对话</span>'}<small>${row.success ? "成功" : "失败"}</small></td>
        <td>${esc(row.user?.userName || "未知")}<small>${esc(row.user?.account || "")}</small></td>
        <td>${esc(expertName(row.expertId))}<small>${esc(row.customerName || "")}</small></td>
        <td>${Number(row.tokens || 0).toLocaleString()}<small>${row.resultCount ? `来源 ${Number(row.resultCount)} 条` : ""}${row.durationMs ? ` · ${Number(row.durationMs)}ms` : ""}</small></td>
      </tr>`).join("");
    return `
      <div class="ops-panel">
        <h3>专家调用汇总</h3>
        ${table(["专家","调用","问题","联网","用户","Token","最近"], experts, "暂无专家调用")}
      </div>
      <div class="ops-panel" style="margin-top:16px">
        <h3>AI/联网明细</h3>
        ${table(["时间","类型","用户","专家/客户","额度"], calls, "暂无调用明细")}
      </div>`;
  }
  function renderEntities(detail){
    const e = detail.entities || {};
    const block = (title, rows, emptyText)=>`
      <div class="ops-panel">
        <h3>${esc(title)}</h3>
        ${table(["名称","提及","用户","专家","最近问题"], (rows || []).slice(0, 40).map(row=>`
          <tr>
            <td>${esc(row.name || "")}<small>${esc(fmtTime(row.lastAt))}</small></td>
            <td>${Number(row.mentions || 0)}</td>
            <td>${Number(row.users || 0)}</td>
            <td>${(row.experts || []).map(id=>`<code class="ops-code">${esc(expertName(id))}</code>`).join(" ") || "—"}</td>
            <td class="ops-question">${esc(row.lastQuestion || "")}</td>
          </tr>`).join(""), emptyText)}
      </div>`;
    return `<div class="ops-grid">
      ${block("客户", e.customers, "暂无客户识别")}
      ${block("公司/组织", e.companies, "暂无公司识别")}
      ${block("地区", e.regions, "暂无地区识别")}
      ${block("产品/方案", e.products, "暂无产品识别")}
    </div>`;
  }

  async function load(){
    const token = $("opsToken")?.value || "";
    const days = Number($("opsDays")?.value || 7);
    const query = $("opsQuery")?.value || "";
    if(!token.trim()){
      setStatus("请输入查询口令", "error");
      return;
    }
    localStorage.setItem("aixg_admin_log_token", token);
    document.body.classList.add("ops-loading");
    setStatus("正在查询", "");
    try{
      const resp = await fetch("/api/admin/usage-detail", {
        method:"POST",
        credentials:"include",
        headers:{
          "Content-Type":"application/json",
          "X-Admin-Log-Token":token,
        },
        body:JSON.stringify({ days, limit:500, query }),
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.error === "admin_log_token_not_configured"
          ? "服务端尚未配置 ADMIN_LOG_TOKEN"
          : data?.error === "unauthorized"
            ? "查询口令不正确"
            : (data?.message || data?.error || `查询失败 HTTP ${resp.status}`);
        throw new Error(msg);
      }
      state.detail = data.data;
      render();
      setStatus("已加载", "ok");
    }catch(err){
      setStatus(err.message || "查询失败", "error");
    }finally{
      document.body.classList.remove("ops-loading");
    }
  }
  async function copyInviteLink(index){
    const row = state.detail?.invites?.[index];
    const token = $("opsToken")?.value || localStorage.getItem("aixg_admin_log_token") || "";
    const link = inviteLink(row);
    if(!row?.code || !link){
      setStatus("邀请码无效", "error");
      return;
    }
    if(!token.trim()){
      setStatus("请输入查询口令后再复制", "error");
      return;
    }
    setStatus("正在标记发放", "");
    try{
      const resp = await fetch("/api/invite-ledger/issue", {
        method:"POST",
        credentials:"include",
        headers:{
          "Content-Type":"application/json",
          "X-Admin-Log-Token":token,
        },
        body:JSON.stringify({
          code: row.code,
          inviteLink: link,
          issuedBy: "运营后台",
        }),
      });
      const data = await resp.json().catch(()=>null);
      if(!resp.ok || !data?.success){
        const msg = data?.error === "unauthorized"
          ? "查询口令不正确，无法记录发放"
          : (data?.message || data?.error || `发放记录失败 HTTP ${resp.status}`);
        throw new Error(msg);
      }
      await navigator.clipboard.writeText(link);
      row.status = "issued";
      row.event = "invite_code_issued";
      row.issuedAt = row.issuedAt || new Date().toISOString();
      row.ts = row.issuedAt;
      render();
      setStatus("链接已复制，已标记为已发放", "ok");
    }catch(err){
      setStatus(err.message || "复制失败", "error");
    }
  }
  function clear(){
    state.detail = null;
    localStorage.removeItem("aixg_admin_log_token");
    if($("opsToken")) $("opsToken").value = "";
    if($("opsQuery")) $("opsQuery").value = "";
    setStatus("等待查询", "");
    render();
  }
  function init(){
    const saved = localStorage.getItem("aixg_admin_log_token") || "";
    if($("opsToken")) $("opsToken").value = saved;
    $("opsLoadBtn")?.addEventListener("click", load);
    $("opsClearBtn")?.addEventListener("click", clear);
    ["opsToken","opsQuery"].forEach((id)=>{
      $(id)?.addEventListener("keydown", (event)=>{
        if(event.key === "Enter") load();
      });
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
