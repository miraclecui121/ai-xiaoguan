/* ========== API 客户端 ========== */
/* 双模式架构：API.BASE 配置后走后端 API，留空则自动使用 localStorage 本地模式
   - 读操作：Store 从内存 Store.db 同步读取（init 时从 API 拉取全量数据缓存）
   - 写操作：乐观更新内存 + 异步调 API（失败仅 toast 提示，不回滚）
   - 认证：JWT Token 存 localStorage，每次请求带 Authorization 头 */
const API = {
  // 后端 API 基础地址。部署时配置，如 'http://localhost:3001' 或 'https://api.yourdomain.com'
  // 留空 = 本地模式（localStorage），配置 = API 模式
  BASE: '',

  TOKEN_KEY: 'aiwin_crm_token',

  // ===== Token 管理 =====
  getToken(){ return localStorage.getItem(API.TOKEN_KEY); },
  setToken(token){ localStorage.setItem(API.TOKEN_KEY, token); },
  clearToken(){ localStorage.removeItem(API.TOKEN_KEY); },

  // ===== 通用请求 =====
  async request(method, path, body){
    if(!API.BASE) throw new Error('API 未配置 BASE 地址');
    const url = API.BASE + path;
    const headers = { 'Content-Type': 'application/json' };
    const token = API.getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 15000);

    try{
      const res = await fetch(url, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // 401: token 过期，清除并跳转登录
      if(res.status === 401){
        API.clearToken();
        if(typeof Store !== 'undefined') Store.clearSession();
        if(typeof Auth !== 'undefined') Auth.showLogin();
        throw new Error('登录已过期，请重新登录');
      }

      const data = await res.json();
      if(!data.success) throw new Error(data.error || data.message || '请求失败');
      return data.data;
    }catch(err){
      clearTimeout(timer);
      if(err.name === 'AbortError') throw new Error('请求超时，请检查网络');
      throw err;
    }
  },

  get(path){ return API.request('GET', path); },
  post(path, body){ return API.request('POST', path, body); },
  put(path, body){ return API.request('PUT', path, body); },
  del(path){ return API.request('DELETE', path); },

  // ===== 连接检测 =====
  async ping(){
    if(!API.BASE) return false;
    try{
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), 3000);
      const res = await fetch(API.BASE + '/api/auth/ping', {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      clearTimeout(timer);
      return res.ok;
    }catch{ return false; }
  },

  // ===== 批量拉取全量数据（登录后/初始化时调用）=====
  // 后端列表接口返回 { rows, total, page, pageSize }，这里统一提取 rows
  _rows(resp){
    if(Array.isArray(resp)) return resp;
    if(resp && Array.isArray(resp.rows)) return resp.rows;
    return [];
  },

  async fetchAll(){
    const [customers, contacts, opportunities, followups, schedules, users, orgUnits, entResp, settingsResp] = await Promise.all([
      API.get('/api/customers?pageSize=10000'),
      API.get('/api/contacts?pageSize=10000'),
      API.get('/api/opportunities?pageSize=10000'),
      API.get('/api/followups?pageSize=10000'),
      API.get('/api/schedules?pageSize=10000'),
      API.get('/api/users'),
      API.get('/api/org-units'),
      API.get('/api/enterprises'),
      API.get('/api/enterprises/settings').catch(()=>null),
    ]);
    const ent = entResp || {};
    const s = settingsResp || {};
    return {
      enterprises: [ent],
      orgUnits: API._rows(orgUnits),
      users: API._rows(users),
      customers: API._rows(customers),
      contacts: API._rows(contacts),
      opportunities: API._rows(opportunities),
      followups: API._rows(followups),
      schedules: API._rows(schedules),
      settings: {
        orgName: s.org_name || s.orgName || ent.shortName || ent.name || '',
        fiscalYear: s.fiscal_year || s.fiscalYear || new Date().getFullYear(),
        owner: s.owner || '',
        quarterTarget: s.quarter_target || s.quarterTarget || 5000000,
        dict: s.dict_config || s.dictConfig || {},
      },
    };
  },

  // ===== 获取企业列表（登录页下拉用，公开接口）=====
  async listEnterprises(keyword){
    const q = keyword ? ('?keyword=' + encodeURIComponent(keyword)) : '';
    return API.get('/api/auth/enterprises' + q);
  },
};
