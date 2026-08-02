/* ========== 审计日志客户端 ========== */
const Audit = {
  endpoint: '/api/audit/log',

  actor(){
    const user = Store.currentUser ? Store.currentUser() : null;
    const ent = Store.currentEnterprise ? Store.currentEnterprise() : null;
    return {
      userId: user?.id || null,
      userName: user?.name || null,
      account: user?.account || null,
      enterpriseId: ent?.id || Store.session?.enterpriseId || null,
      enterpriseName: ent?.name || null,
      workspaceType: ent?.workspaceType || (ent?.isDemo ? 'demo' : null),
      role: user?.role || null,
      inviteCode: ent?.inviteCode || user?.inviteCode || null,
      sourceChannel: ent?.sourceChannel || user?.sourceChannel || null,
      campaignName: ent?.campaignName || user?.campaignName || null,
    };
  },

  context(){
    const ctx = (typeof AI !== 'undefined' && AI.ctx) ? AI.ctx : {};
    return {
      customerIds: (ctx.customers || []).map(x => x.id),
      customerNames: (ctx.customers || []).map(x => x.name).filter(Boolean),
      opportunityIds: (ctx.opportunities || []).map(x => x.id),
      opportunityNames: (ctx.opportunities || []).map(x => x.name).filter(Boolean),
      expertIds: (ctx.experts || []).map(x => x.id),
    };
  },

  log(event, payload = {}){
    const body = {
      type: payload.type || 'audit',
      event,
      route: (typeof App !== 'undefined' && App.currentRoute) ? App.currentRoute : '',
      user: Audit.actor(),
      ...payload,
    };
    if(body.question) body.question = Audit.redact(body.question);
    try{
      fetch(Audit.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(()=>{});
    }catch(e){}
  },

  modelPayload(extra = {}){
    return {
      route: (typeof App !== 'undefined' && App.currentRoute) ? App.currentRoute : '',
      user: Audit.actor(),
      context: Audit.context(),
      ...extra,
    };
  },

  redact(text){
    return String(text || '')
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '[PHONE]')
      .replace(/\b\d{15,18}[0-9Xx]\b/g, '[ID_CARD]')
      .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_OR_LONG_NUMBER]')
      .slice(0, 4000);
  },
};
