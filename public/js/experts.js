/* ========== AI销冠专家系统 ==========
   10个专家：行业评估 / 行业洞察 / 客户洞察 / 线索开发 / 客户拜访 / 解决方案 / 价值营销 / 赢单策略 / 客户经营 / 销售SOP
   每个专家基于CRM数据底座（客户/联系人/商机/跟进）生成专业分析报告
   分析框架遵循内置专家提示词和线上方法论质量门控
   embedTo: ''=仅AI面板, 'customer'=嵌入客户详情, 'opportunity'=嵌入商机详情 */
const Experts = {

  // ===== 专家注册表 =====
  list: [
    { id:'industry-assess',  name:'行业评估',   icon:'评', color:'#2563eb', desc:'判断行业投入优先级、进入窗口与资源配比',
      ctxType:'customer', ctxLabel:'选择客户', embedTo:'', loadingMsg:'正在评估行业市场规模与竞争格局',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'industry-insight', name:'行业洞察',   icon:'势', color:'#7c3aed', desc:'提炼政策、技术和采购变化，形成客户话题',
      ctxType:'customer', ctxLabel:'选择客户', embedTo:'', loadingMsg:'正在分析行业政策趋势与技术方向',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'customer-insight', name:'客户洞察',   icon:'客', color:'#c89b2c', desc:'还原客户经营场景、关键人关系和采购动因',
      ctxType:'customer', ctxLabel:'选择客户', embedTo:'customer', loadingMsg:'正在交叉分析客户画像、决策链与竞争态势',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'lead-dev',         name:'线索开发',   icon:'拓', color:'#0d9488', desc:'识别可切入部门、触达对象和优先级线索',
      ctxType:'customer', ctxLabel:'选择客户', embedTo:'customer', loadingMsg:'正在分析线索开发机会与白空间',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'sales-visit',      name:'客户拜访',   icon:'访', color:'#059669', desc:'生成拜访目标、提问路径和会后推进动作',
      ctxType:'opportunity', ctxLabel:'选择商机', embedTo:'opportunity', loadingMsg:'正在制定拜访策略与话题清单',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'solution',         name:'解决方案',   icon:'案', color:'#0891b2', desc:'把客户问题转成方案结构、能力组合和差异点',
      ctxType:'either', ctxLabel:'选择客户或商机', embedTo:'opportunity', loadingMsg:'正在设计解决方案架构',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'value-marketing',  name:'价值营销',   icon:'值', color:'#9333ea', desc:'把产品能力转成客户收益、风险降低和ROI表达',
      ctxType:'either', ctxLabel:'选择客户或商机', embedTo:'opportunity', loadingMsg:'正在设计价值主张与ROI测算',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'win-strategy',    name:'赢单策略',   icon:'策', color:'#dc2626', desc:'诊断赢面、竞争位置和下一步承诺动作',
      ctxType:'opportunity', ctxLabel:'选择商机', embedTo:'opportunity', loadingMsg:'正在诊断赢面与制定竞争策略',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'customer-mgmt',   name:'客户经营',   icon:'营', color:'#16a34a', desc:'规划关系经营、增购续约和长期账户节奏',
      ctxType:'customer', ctxLabel:'选择客户', embedTo:'customer', loadingMsg:'正在分析客户经营策略与生命周期',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
    { id:'sop-design',      name:'销售SOP',    icon:'程', color:'#4f46e5', desc:'沉淀阶段动作、检查项和过程质量标准',
      ctxType:'opportunity', ctxLabel:'选择商机', embedTo:'opportunity', loadingMsg:'正在设计标准操作流程与检查清单',
      _secretPrompt:'' },  // ⚠️ 核心机密，严禁暴露到前端UI
  ],

  // 获取专家对象，如果已加载内置提示词(ExpertPrompts)则注入_secretPrompt字段
  // ⚠️ _secretPrompt 为核心机密数据，仅供内部AI调用使用，严禁在任何用户可见的UI中暴露！
  get(id){
    const ex=Experts.list.find(e=>e.id===id);
    if(!ex)return null;
    const onlineMethodology = typeof OnlineExpertMethodologies!=='undefined' ? OnlineExpertMethodologies.get(id) : null;
    if(typeof ExpertPrompts!=='undefined' && ExpertPrompts[id]){
      return {...ex, _secretPrompt: ExpertPrompts[id], hasOriginalPrompt:true, _onlineMethodology:onlineMethodology};
    }
    return {...ex, _onlineMethodology:onlineMethodology};
  },

  // 根据专家获取可选上下文列表
  getContexts(expertId){
    const ex=Experts.get(expertId);
    if(!ex) return [];
    if(ex.ctxType==='customer'){
      return Store.myCustomers().map(c=>({id:c.id, name:c.name, sub:c.industry+' · '+c.level+'级'}));
    }
    if(ex.ctxType==='opportunity'){
      return Store.opportunities().filter(o=>o.status==='open').map(o=>{
        const c=Store.customer(o.customerId);
        return {id:o.id, name:o.name, sub:(c?c.shortName:'')+' · '+Utils.fmtMoney(o.amount)};
      });
    }
    const customers=Store.myCustomers().map(c=>({id:'C:'+c.id, name:c.name, sub:'客户 · '+c.industry}));
    const opps=Store.opportunities().filter(o=>o.status==='open').map(o=>{
      const c=Store.customer(o.customerId);
      return {id:'O:'+o.id, name:o.name, sub:'商机 · '+(c?c.shortName:'')};
    });
    return [...customers, ...opps];
  },

  // 执行专家分析
  run(expertId, contextId){
    const ex=Experts.get(expertId);
    if(!ex) return '未找到该专家';
    let customerId=null, oppId=null;
    if(contextId){
      if(contextId.startsWith('C:')) customerId=contextId.slice(2);
      else if(contextId.startsWith('O:')) oppId=contextId.slice(2);
      else if(ex.ctxType==='customer'||ex.ctxType==='either') customerId=contextId;
      else if(ex.ctxType==='opportunity') oppId=contextId;
    }
    switch(expertId){
      case 'industry-assess':  return Experts.industryAssess(customerId);
      case 'industry-insight': return Experts.industryInsight(customerId);
      case 'customer-insight': return Experts.customerInsight(customerId);
      case 'lead-dev':         return Experts.leadDev(customerId);
      case 'sales-visit':      return Experts.salesVisit(oppId||customerId);
      case 'win-strategy':     return Experts.oppStrategy(oppId||customerId);
      case 'solution':         return Experts.solution(customerId, oppId);
      case 'value-marketing':  return Experts.valueMarketing(customerId, oppId);
      case 'customer-mgmt':    return Experts.customerMgmt(customerId);
      case 'sop-design':       return Experts.sopDesign(oppId);
      default: return '专家未实现';
    }
  },

  // ===== 行业知识库 =====
  industryDB: {
    '政府机关': {
      scale:'万亿级信息化市场', growth:'年均增长12-15%',
      policy:'数字政府建设、政务服务一网通办、信创替代刚性需求',
      tech:'云原生、政务大模型、数据要素化、一网统管',
      procurement:'年度预算制，财政拨款，公开招标为主，周期3-6个月',
      pain:'系统孤岛严重、数据共享难、信创替代紧迫、基层数字化能力弱',
      competition:'集成商+原厂商生态竞争，本地化服务能力是关键门槛',
      entry:'需具备保密资质、信创适配能力、本地化交付团队',
      benchmark:'浙江"最多跑一次"、广东"数字政府"、上海"一网通办"',
      opportunity:'信创替代窗口期(2024-2027)、数据要素市场化试点、AI+政务大模型',
      risk:'财政预算收紧、招标周期不确定、合规要求高',
      decisionModel:'处长提议→分管领导审批→财政审批→公开招标→评标→签约',
    },
    '国企央企': {
      scale:'千亿级数字化转型市场', growth:'年均增长18-22%',
      policy:'国企改革三年行动、数字化转型行动计划、信创全面替代',
      tech:'混合云、工业互联网、数据中台、AI+业务场景',
      procurement:'集团统一采购+子公司自主采购结合，邀请招标与竞争性谈判为主',
      pain:'集团-子公司IT架构割裂、数据治理基础弱、国产化替代压力大',
      competition:'头部厂商+行业ISV竞争，集团选型辐射子公司',
      entry:'需通过集团入围、具备行业案例、信创认证资质',
      benchmark:'国家电网数字化中台、中石油工业互联网、招商局集团云',
      opportunity:'信创替代加速、集团级数据中台、子公司横向复制',
      risk:'集团决策周期长、价格敏感度高、竞争对手以生态绑定',
      decisionModel:'信息部提议→CIO审核→VP审批→集采招标→评标→商务→签约',
    },
    '教育': {
      scale:'千亿级教育信息化市场', growth:'年均增长10-15%',
      policy:'教育数字化战略、教育新基建、智慧教育示范区',
      tech:'教育大数据、AI助教、智慧校园、在线教育平台',
      procurement:'年度预算+专项资金，公开招标，需财政审批',
      pain:'区域发展不均衡、系统重复建设、数据互通难、运维能力不足',
      competition:'教育信息化厂商+互联网巨头+通信运营商多方竞争',
      entry:'需教育行业案例、通过教育厅入围、区县级落地能力',
      benchmark:'浙江之江汇教育广场、上海智慧教育平台、深圳教育云',
      opportunity:'教育大数据平台、AI+教育、智慧校园升级',
      risk:'预算审批周期长、政策依赖性强、落地效果难量化',
      decisionModel:'信息处提议→分管副厅长→厅长→财政→招标→签约',
    },
    '交通': {
      scale:'千亿级智慧交通市场', growth:'年均增长15-20%',
      policy:'交通强国建设纲要、智慧交通发展规划、新基建',
      tech:'交通大数据、车路协同、智能运维、数字孪生',
      procurement:'项目制+年度运维，公开招标，技术评分权重高',
      pain:'多系统并行数据割裂、运维智能化不足、安全要求极高',
      competition:'交通行业龙头+通用厂商+AI厂商三方竞争',
      entry:'需交通行业资质、大型项目交付经验、7×24运维能力',
      benchmark:'北京轨交智慧运营、深圳智慧交通大脑、上海公交数字化',
      opportunity:'运维智能化、大屏可视化、数字孪生试点',
      risk:'技术门槛高、行业壁垒强、竞争格局固化',
      decisionModel:'技术部提议→总工审批→领导班子→招标→签约',
    },
    '能源': {
      scale:'千亿级能源数字化市场', growth:'年均增长12-18%',
      policy:'双碳战略、能源数字化转型、智慧能源体系',
      tech:'工业互联网、能源大数据、AI+预测性维护、碳排放管理',
      procurement:'集团集采+分公司自采，邀请招标为主',
      pain:'生产与IT割裂、数据采集难、安全合规要求高',
      competition:'能源行业ISV+工业互联网平台+云厂商竞争',
      entry:'需能源行业案例、工控安全资质、本地化运维团队',
      benchmark:'国家电网数据中台、中石油智慧油田、华能智慧电厂',
      opportunity:'双碳管理平台、预测性维护、能源大数据',
      risk:'行业壁垒高、预算波动大、项目周期长',
      decisionModel:'信息中心提议→生产副总→总经理→集采→签约',
    },
  },

  genericIndustry: {
    scale:'百亿级信息化市场', growth:'年均增长10-15%',
    policy:'数字化转型政策驱动、信创替代趋势',
    tech:'云计算、大数据、AI、数据中台',
    procurement:'年度预算制，公开招标与竞争性谈判结合',
    pain:'数字化基础薄弱、预算有限、人才不足',
    competition:'区域性集成商+行业厂商竞争',
    entry:'需行业案例、本地化服务、性价比方案',
    benchmark:'同行业数字化标杆案例',
    opportunity:'数字化转型窗口期、政策红利',
    risk:'预算不确定、竞争激烈、客户认知不足',
    decisionModel:'信息部门提议→分管领导→招标→签约',
  },

  getIndustryInfo(industry){
    return Experts.industryDB[industry] || Experts.genericIndustry;
  },

  // ================================================================
  //  1. 行业评估专家 — 按"行业评估四维度"框架分析
  //  提示词要求：4维度(行业规模/行业趋势/竞争格局/价值风险) × 11子项
  //  评分1-10分 → S/A/B/C分级 → 策略建议 → 您再想想
  // ================================================================
  industryAssess(customerId){
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户';
    const info=Experts.getIndustryInfo(c.industry);
    const sameIndustry=Store.customers().filter(x=>x.industry===c.industry);
    const sameOpps=sameIndustry.flatMap(x=>Store.oppsByCustomer(x.id));
    const sameWon=Utils.sum(sameOpps.filter(o=>o.status==='won'),'amount');

    // 用户行业分析
    let html=`评 **行业进入评估报告**\n\n`;
    html+=`> 分析对象：${c.name} ｜ 行业：${c.industry} ｜ 评估日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 第一步：信息确认与澄清
    html+=`## 第一步：信息确认与澄清\n\n`;
    html+=`**目标行业**：${c.industry}\n\n`;
    html+=`**候选行业列表**：基于客户行业属性，列举以下重点目标行业供评估：\n`;
    const industries=Object.keys(Experts.industryDB);
    industries.forEach((ind,i)=>{
      const db=Experts.industryDB[ind];
      html+=`${i+1}. **${ind}**：${db.scale}，${db.growth}\n`;
    });
    html+=`\n**关键数据与背景**：\n`;
    html+=`- 行业规模：${info.scale}\n- 行业趋势：${info.growth}\n- 竞争格局：${info.competition}\n- 价值风险：${info.risk}\n\n`;

    // 第二步：分行业评估与评分（四维度×11子项，1-10分）
    html+=`## 第二步：分行业评估与评分（四维度分析框架）\n\n`;
    html+=`### 维度一：行业规模\n\n`;
    html+=`| 评估项 | 评分(1-10) | 打分理由 |\n|--------|-----------|----------|\n`;
    const econScore=/万亿/.test(info.scale)?8:/千亿/.test(info.scale)?7:5;
    html+=`| 经济规模 | ${econScore} | ${info.scale}，${/万亿|千亿/.test(info.scale)?'支柱产业级别，经济贡献度高':'中等规模，区域影响有限'} |\n`;
    const entScore=sameIndustry.length>=5?8:sameIndustry.length>=3?6:4;
    html+=`| 企业数量 | ${entScore} | 同行业客户${sameIndustry.length}个，${entScore>=7?'目标客户群体充足':'客户数量有限，需拓展'} |\n`;
    const demandScore=info.opportunity.includes('窗口期')?8:6;
    html+=`| 需求强度 | ${demandScore} | ${info.opportunity}，客户预算投资意愿${demandScore>=7?'强烈':'中等'} |\n\n`;

    html+=`### 维度二：行业趋势\n\n`;
    html+=`| 评估项 | 评分(1-10) | 打分理由 |\n|--------|-----------|----------|\n`;
    const cycleScore=/18-22%|15-20%/.test(info.growth)?9:/12-18%|10-15%/.test(info.growth)?7:5;
    html+=`| 行业周期 | ${cycleScore} | ${info.growth}，${cycleScore>=8?'处于上升期，政策鼓励方向':'稳定期，增长平稳'} |\n`;
    const policyScore=info.policy.includes('刚性需求')||info.policy.includes('全面替代')?9:7;
    html+=`| 产业政策 | ${policyScore} | ${info.policy}，${policyScore>=8?'政策高度契合，长期合作稳定':'政策匹配度一般'} |\n\n`;

    html+=`### 维度三：竞争格局\n\n`;
    html+=`| 评估项 | 评分(1-10) | 打分理由 |\n|--------|-----------|----------|\n`;
    const replaceScore=info.entry.includes('资质')?7:5;
    html+=`| 可替代方案 | ${replaceScore} | ${info.entry}，${replaceScore>=7?'替代性低，客户粘性高':'替代性较高，需建立壁垒'} |\n`;
    const existScore=info.competition.includes('多方竞争')?5:7;
    html+=`| 现有服务商 | ${existScore} | ${info.competition}，${existScore>=7?'存在服务短板，机会较大':'竞争充分，需差异化'} |\n`;
    const advScore=c.level==='S'||c.level==='A'?8:5;
    html+=`| 我方优势 | ${advScore} | ${c.level}级客户，同行业签约${Utils.fmtMoney(sameWon)}，${advScore>=7?'技术与资源匹配度高':'需加强行业积累'} |\n\n`;

    html+=`### 维度四：价值风险\n\n`;
    html+=`| 评估项 | 评分(1-10) | 打分理由 |\n|--------|-----------|----------|\n`;
    const custValScore=c.level==='S'?9:c.level==='A'?7:5;
    html+=`| 客户价值 | ${custValScore} | ${c.level}级客户，${custValScore>=7?'战略价值高，标杆示范效应强':'价值中等'} |\n`;
    const myValScore=sameWon>0?8:sameOpps.length>0?6:4;
    html+=`| 我方价值 | ${myValScore} | 同行业已签约${Utils.fmtMoney(sameWon)}，${myValScore>=7?'长期价值和品牌效应显著':'需积累标杆案例'} |\n`;
    const riskScore=info.risk.includes('高')?4:info.risk.includes('不确定')?5:7;
    html+=`| 风险维度 | ${riskScore} | ${info.risk}，${riskScore<=5?'风险较高需审慎评估':'风险可控'} |\n\n`;

    // 合计得分
    const totalScore=econScore+entScore+demandScore+cycleScore+policyScore+replaceScore+existScore+advScore+custValScore+myValScore+riskScore;
    const maxScore=110; // 11项×10分
    const avgScore=(totalScore/11).toFixed(1);
    html+=`### 行业合计得分\n\n`;
    html+=`| 行业 | 合计得分 | 平均分(满分10) |\n|------|----------|---------------|\n`;
    html+=`| **${c.industry}** | **${totalScore}/${maxScore}** | **${avgScore}** |\n\n`;

    // 第三步：可视化排序与分级
    html+=`## 第三步：可视化排序与分级\n\n`;
    let grade='', gradeDesc='';
    if(avgScore>=8){grade='S级（战略进攻型）';gradeDesc='得分最高，需集中资源重点突破';}
    else if(avgScore>=6.5){grade='A级（重点深耕型）';gradeDesc='得分较高，可积极拓展';}
    else if(avgScore>=5){grade='B级（机会合作型）';gradeDesc='得分一般，选择性或试点性合作';}
    else{grade='C级（暂缓进入型）';gradeDesc='得分较低，风险过高或价值有限，建议暂缓';}
    html+=`| 排名 | 行业 | 平均分 | 分级 | 分级说明 |\n|------|------|--------|------|----------|\n`;
    html+=`| 1 | ${c.industry} | ${avgScore} | **${grade}** | ${gradeDesc} |\n\n`;

    // 第四步：最终结论与策略建议
    html+=`## 第四步：最终结论与策略建议\n\n`;
    html+=`### 区域重点行业选择名单\n\n`;
    html+=`- **${grade}**：${c.industry}（平均分${avgScore}）\n\n`;
    html+=`### 初步进入策略\n\n`;
    if(grade.startsWith('S')||grade.startsWith('A')){
      html+=`1. **以${c.shortName||c.name}为标杆客户**，打造${c.industry}行业数字化示范案例，形成可复制模式\n`;
      html+=`2. **${info.opportunity}**，结合我方${info.tech.split('、')[0]}技术优势，主打"${info.pain.split('、')[0]}"解决方案\n`;
      if(sameIndustry.length>1) html+=`3. **横向复制拓展**：以${c.shortName||c.name}为锚点，向${sameIndustry.filter(x=>x.id!==c.id).slice(0,3).map(x=>x.shortName||x.name).join('、')}等同行业客户复制\n`;
    }else{
      html+=`1. **选择性投入**：以${c.shortName||c.name}为试点客户验证模式，待模式跑通后再扩展\n`;
      html+=`2. **聚焦核心需求**：围绕${info.pain.split('、')[0]}切入，控制投入规模，降低风险\n`;
    }
    html+=`\n`;

    // 第五步：您再想想
    html+=`## 第五步：您再想想\n\n`;
    html+=`1. 建议您补充${c.industry}行业在该区域的具体企业数量、产值规模等数据，我可以给出更精准的行业评分和排序\n`;
    html+=`2. 是否需要我针对${grade.startsWith('S')?'S级':''}${grade.startsWith('A')?'A级':''}重点行业，列出具体的重点目标企业客户清单作为参考？\n`;

    html+=`\n> **📋 行业评估结论：${c.industry}行业评估为${grade}，平均分${avgScore}/10。${gradeDesc}。以${c.shortName||c.name}为切入点，${avgScore>=6.5?'加速行业复制拓展':'验证模式后再扩张'}。**`;
    return html;
  },

  // ================================================================
  //  2. 行业洞察专家 — 按"行业洞察方法论"框架分析
  //  提示词要求：行业细分→市场容量→PEST趋势→业务特征(8要素)
  //  →典型场景→关键需求→决策偏好→SWOT→生态洞察→策略计划
  // ================================================================
  industryInsight(customerId){
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户';
    const info=Experts.getIndustryInfo(c.industry);
    const opps=Store.oppsByCustomer(customerId);
    const contacts=Store.contactsByCustomer(customerId);
    const sameIndustry=Store.customers().filter(x=>x.industry===c.industry);
    const sameOpps=sameIndustry.flatMap(x=>Store.oppsByCustomer(x.id));

    let html=`势 **行业变化洞察报告**\n\n`;
    html+=`> 洞察对象：${c.industry}行业 ｜ 关联客户：${c.name} ｜ 洞察日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、行业细分与市场容量
    html+=`## 一、行业细分与市场容量\n\n`;
    html+=`### 行业细分标准\n\n`;
    html+=`依据《国民经济行业分类》，${c.industry}行业可细分为以下子行业：\n\n`;
    html+=`| 细分行业 | 典型特征 | 目标客群数量 | 市场总容量 |\n|----------|----------|-------------|-----------|\n`;
    const subIndustries={
      '政府机关':['省市级政务中心(统筹数字政府建设)','区县级政务中心(一网通办落地)','专业委办局(垂直领域数字化)'],
      '国企央企':['集团总部(数字化统筹)','一级子公司(行业板块运营)','专业公司(具体业务执行)'],
      '教育':['省级教育厅(统筹规划)','高校/职业院校(教学数字化)','区县教育局(基础教育信息化)'],
      '交通':['轨道交通集团(智慧运营)','公交集团(智能调度)','高速公路集团(智慧收费+运维)'],
      '能源':['电网企业(智能电网)','发电企业(智慧电厂)','油气企业(智慧油田)'],
    };
    (subIndustries[c.industry]||['核心业务领域','支撑服务领域','创新业务领域']).forEach((sub,i)=>{
      html+=`| ${sub} | ${info.scale}级别需求，${info.procurement.includes('公开招标')?'公开招标':'邀请招标'}为主 | ${['50-200家','20-80家','10-50家'][i]||'10-50家'} | ${['500-1000万','200-500万','50-200万'][i]||'50-200万'} |\n`;
    });
    html+=`\n### 市场总容量评估\n\n`;
    html+=`- **总体市场规模**：${info.scale}\n- **年均增长率**：${info.growth}\n- **可获取市场空间**：约占总量15-25%，主要受资质壁垒和竞争格局影响\n\n`;

    // 二、趋势洞察（PEST分析）
    html+=`## 二、趋势洞察（PEST分析）\n\n`;
    html+=`### 政策法规趋势\n\n`;
    const policies=info.policy.split('、');
    policies.forEach((p,i)=>html+=`${i+1}. ${p}\n`);
    html+=`\n### 经济环境趋势\n\n`;
    html+=`1. ${c.industry}行业${info.scale}，${info.growth}\n2. 产业链上下游数字化转型需求持续释放\n3. 财政预算/企业IT预算持续向数字化倾斜\n\n`;
    html+=`### 技术趋势\n\n`;
    const techs=info.tech.split('、');
    techs.forEach((t,i)=>{
      const maturity=t.includes('大模型')?'试点期':t.includes('孪生')?'早期':t.includes('中台')?'成熟期':'成长期';
      html+=`${i+1}. **${t}**（${maturity}）：${t.includes('AI')?'降本增效':t.includes('数据')?'数据资产化':t.includes('云')?'基础设施优化':'业务创新'}\n`;
    });
    html+=`\n### 用户需求变化\n\n`;
    html+=`1. 客户从"系统建设"向"业务赋能"转变\n2. 数据驱动决策成为核心诉求\n3. 信创合规从"可选"变为"必选"\n\n`;
    html+=`### 市场竞争趋势\n\n`;
    html+=`1. ${info.competition}\n2. 头部厂商加速生态整合，中小厂商聚焦垂直场景\n3. 价格竞争加剧，差异化能力成为核心竞争力\n\n`;

    // 三、行业业务特征分析（八要素）
    html+=`## 三、行业业务特征分析（八要素）\n\n`;
    html+=`| 要素 | ${c.industry}行业特征 |\n|------|---------------------|\n`;
    html+=`| 价值主张 | ${info.policy.split('、')[0]}，提升${c.industry.includes('政府')?'政务服务效能':'经营管理效率'} |\n`;
    html+=`| 目标客户 | ${c.industry.includes('政府')?'辖区企业和群众':c.industry.includes('国企')?'集团及子公司':'行业用户'} |\n`;
    html+=`| 服务方式与渠道 | ${info.procurement} |\n`;
    html+=`| 关键业务 | ${info.pain.split('、').slice(0,3).join('、')} |\n`;
    html+=`| 供应商与上游资源 | ${info.competition.split('、')[0]} |\n`;
    html+=`| 收入结构及占比 | ${c.industry.includes('政府')?'财政拨款为主(80%)+专项基金(20%)':c.industry.includes('国企')?'主营业务收入(70%)+数字化预算(30%)':'经营收入(60%)+IT预算(40%)'} |\n`;
    html+=`| 成本结构及占比 | 人力成本(40%)+IT基础设施(25%)+运营维护(20%)+其他(15%) |\n`;
    html+=`| 突破改进重点 | ${info.pain.split('、').map(p=>'改善'+p).join('；')} |\n\n`;

    // 四、典型业务场景洞察
    html+=`## 四、典型业务场景洞察\n\n`;
    html+=`| 场景 | 客户痛点 | 改进机遇 |\n|------|----------|----------|\n`;
    info.pain.split('、').forEach(p=>{
      html+=`| ${p} | ${p}导致效率低下、成本增加 | 通过${info.tech.split('、')[0]}技术系统性解决 |\n`;
    });
    html+=`\n`;

    // 五、关键需求与解决思路
    html+=`## 五、关键需求与解决思路\n\n`;
    html+=`| 序号 | 关键需求 | 解决思路 |\n|------|----------|----------|\n`;
    html+=`1. | ${info.pain.split('、')[0]} | 构建统一${info.tech.split('、')[0]}平台，打破数据孤岛 |\n`;
    html+=`2. | ${info.pain.split('、')[1]||'业务协同效率低'} | 流程数字化+AI辅助决策，提升运营效率 |\n`;
    html+=`3. | ${info.entry.includes('信创')?'信创合规要求':'数字化转型需求'} | 提供信创全栈适配方案，满足合规要求 |\n`;
    html+=`4. | ${info.risk} | 建立风险预警机制，分阶段实施降低风险 |\n\n`;

    // 六、客户决策偏好
    html+=`## 六、客户决策偏好\n\n`;
    html+=`**典型决策流程**：\n${info.decisionModel}\n\n`;
    html+=`**采购周期**：${/政府|教育/.test(c.industry)?'6-12个月':'3-6个月'}\n\n`;
    html+=`**预算特征**：${/政府|教育/.test(c.industry)?'年度财政预算制，需提前一个财年规划':'集团预算+子公司预算双轨制'}\n\n`;
    html+=`**决策偏好**：\n- 技术评估权重高（40-50%）\n- 价格敏感度${c.industry.includes('国企')?'较高':'中等'}\n- 案例参考影响大（同行业标杆是关键加分项）\n- 信创合规为一票否决项\n\n`;

    // 七、自我洞察（SWOT分析）
    html+=`## 七、自我洞察（SWOT分析）\n\n`;
    html+=`| 维度 | 分析 |\n|------|------|\n`;
    html+=`| **优势(S)** | 同行业客户${Store.customers().filter(x=>x.industry===c.industry).length}个，签约金额${Utils.fmtMoney(Utils.sum(sameOpps.filter(o=>o.status==='won'),'amount'))}；${info.tech.split('、')[0]}技术积累 |\n`;
    html+=`| **劣势(W)** | ${sameOpps.filter(o=>o.status==='won').length<2?'同行业标杆案例不足':'案例积累需加强'}；${c.industry}行业深度不够 |\n`;
    html+=`| **机会(O)** | ${info.opportunity}；${info.policy.split('、')[0]} |\n`;
    html+=`| **威胁(T)** | ${info.risk}；${info.competition} |\n\n`;

    // 八、生态洞察
    html+=`## 八、生态洞察\n\n`;
    html+=`| 生态参与者 | 优势 | 劣势 | 竞合策略 |\n|------------|------|------|----------|\n`;
    html+=`| 行业ISV | ${c.industry}行业深度理解 | 技术平台能力弱 | 联合方案，ISV出行业模型，我方出平台 |\n`;
    html+=`| 云厂商 | 基础设施+AI能力 | 行业经验不足 | 生态合作，云厂商出IaaS，我方出SaaS |\n`;
    html+=`| 集成商 | 客户关系+本地交付 | 自主产品少 | 被集成策略，提供核心产品+交付标准 |\n\n`;

    // 九、市场机会
    html+=`## 九、市场机会评估\n\n`;
    html+=`| 机会领域 | 市场空间 | 匹配度 | 优先级 |\n|----------|----------|--------|--------|\n`;
    info.tech.split('、').slice(0,3).forEach(t=>{
      html+=`| ${t} | ${info.scale} | ★★★★ | 🔴 高 |\n`;
    });
    html+=`\n`;

    // 十、策略计划
    html+=`## 十、行业拓展策略与行动计划\n\n`;
    html+=`| 序号 | 关键策略 | 主要行动 | 时间节点 |\n|------|----------|----------|----------|\n`;
    html+=`1. | 标杆打造 | 以${c.shortName||c.name}为${c.industry}行业标杆，输出可复制案例 | Q1-Q2 |\n`;
    html+=`2. | 行业复制 | 基于标杆案例，横向拓展同行业客户 | Q2-Q3 |\n`;
    html+=`3. | 能力沉淀 | 沉淀${c.industry}行业知识库和方案模板 | Q1持续 |\n`;
    html+=`4. | 生态合作 | 联合行业ISV和云厂商，构建行业解决方案生态 | Q2-Q4 |\n`;
    html+=`5. | 政策跟踪 | 持续跟踪${info.policy.split('、')[0]}政策动向，抢占窗口期 | 持续 |\n\n`;

    html+=`> **📋 行业洞察结论：${c.industry}行业正处于${info.opportunity}。${c.shortName||c.name}应定位为行业标杆客户，以${opps[0]?opps[0].product:info.tech.split('、')[0]}为切入点，带动行业横向复制。**`;
    return html;
  },

  // ================================================================
  //  5. 客户拜访专家 — 按"信任五环"方法论分析
  //  提示词要求：用户行业分析→销售类型→客户角色(E-DB/E-PB等)
  //  →外部变化→客户认知期望→单一销售目标→客户行动承诺
  //  →约见理由(模板)→开场→信任建立→需求探索→共识达成
  // ================================================================
  salesVisit(id){
    let customerId=null, mainOpp=null;
    const opp=Store.opportunity(id);
    if(opp){ mainOpp=opp; customerId=opp.customerId; }
    else { customerId=id; }
    if(!customerId) return '未找到该商机或客户';
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户';
    const contacts=Store.contactsByCustomer(customerId);
    const opps=Store.oppsByCustomer(customerId);
    const fus=Store.followupsByCustomer(customerId).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const lastFu=fus[0];
    const keyContacts=contacts.filter(x=>x.isKey);
    const openOpps=opps.filter(o=>o.status==='open');
    if(!mainOpp) mainOpp=openOpps[0]||opps[0];
    const info=Experts.getIndustryInfo(c.industry);

    let html=`访 **客户拜访行动报告**\n\n`;
    html+=`> 拜访对象：${c.name} ｜ ${c.industry} ｜ ${c.level}级 ｜ 规划日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 用户行业与销售类型分析
    html+=`## 一、用户行业与销售类型分析\n\n`;
    html+=`**客户行业**：${c.industry}（${info.scale}）\n\n`;
    html+=`**销售类型判断**：${c.level==='S'?'战略大客户经营':mainOpp&&mainOpp.amount>2000000?'解决方案销售':'产品销售'}\n\n`;
    html+=`**销售金额区间**：${mainOpp?Utils.fmtMoney(mainOpp.amount):'未定'}\n\n`;
    html+=`**销售模式**：面向有限目标客户提供解决方案或长期持续经营，关注客户信任建立和共识达成\n\n`;

    // 客户外部变化和处境
    html+=`## 二、客户外部变化与处境\n\n`;
    html+=`| 维度 | 分析 |\n|------|------|\n`;
    html+=`| 外部经营环境 | ${info.policy} |\n`;
    html+=`| 组织战略举措 | ${info.opportunity} |\n`;
    html+=`| 岗位挑战压力 | ${info.pain.split('、').slice(0,2).join('、')} |\n`;
    html+=`| 感知的变化 | ${info.tech.split('、')[0]}带来业务模式变革 |\n\n`;

    // 客户参与决策的角色分析
    html+=`## 三、客户参与决策的角色分析\n\n`;
    html+=`| 角色代码 | 角色定义 | 我方联系人 | 态度 | 关注点 |\n|----------|----------|------------|------|--------|\n`;
    if(contacts.length===0){
      html+=`| — | 暂无联系人记录 | — | — | 首次拜访需建立关系 |\n`;
    }else{
      contacts.forEach(ct=>{
        let roleCode='U-WB';
        if(ct.isKey) roleCode='E-PB';
        if(ct.rank==='高管'||(ct.title||'').includes('总')||(ct.title||'').includes('主任')) roleCode='E-DB';
        if((ct.title||'').includes('技术')||(ct.title||'').includes('CIO')) roleCode='T-CB';
        if((ct.title||'').includes('财务')) roleCode='T-FB';
        html+=`| ${roleCode} | ${roleCode==='E-DB'?'最终决策者':roleCode==='E-PB'?'建议决策者':roleCode==='T-CB'?'标准把关者':roleCode==='T-FB'?'预算审批者':'产品使用者'} | ${ct.name}(${ct.title||'—'}) | ${ct.attitude||'未知'} | ${ct.isKey?'战略决策与资源调配':'业务执行与效果评估'} |\n`;
      });
    }
    html+=`\n`;

    // 客户认知期望
    html+=`## 四、客户认知期望分析\n\n`;
    html+=`| 角色 | 认知期望 | 个人关注点 |\n|------|----------|------------|\n`;
    contacts.slice(0,4).forEach(ct=>{
      html+=`| ${ct.name} | ${ct.attitude==='支持'?'期望通过方案提升业务效率':ct.attitude==='中立'?'对方案效果持观望态度':'担忧方案风险和成本'} | ${ct.isKey?'政绩与业绩达成':'工作效率与操作便捷'} |\n`;
    });
    if(!contacts.length) html+=`| — | 首次接触，需探索客户认知 | — |\n`;
    html+=`\n`;

    // 单一销售目标
    html+=`## 五、单一销售目标（SSO）\n\n`;
    if(mainOpp){
      html+=`**目标定义**：客户${c.name}将在${mainOpp.expectedSignDate?Utils.fmtDate(mainOpp.expectedSignDate):'近期'}签约${Utils.fmtMoney(mainOpp.amount)}的${mainOpp.product||'解决方案'}项目\n\n`;
      html+=`| 要素 | 内容 |\n|------|------|\n`;
      html+=`| 客户 | ${c.name} |\n`;
      html+=`| 产品/方案 | ${mainOpp.product||'核心解决方案'} |\n`;
      html+=`| 金额 | ${Utils.fmtMoney(mainOpp.amount)} |\n`;
      html+=`| 时间 | ${mainOpp.expectedSignDate?Utils.fmtDate(mainOpp.expectedSignDate):'待定'} |\n`;
      html+=`| 使用人员 | ${c.industry}业务部门 |\n`;
      html+=`| 应用目标 | ${mainOpp.remark||'数字化转型'} |\n\n`;
    }else{
      html+=`当前无明确商机，本次拜访目标为需求挖掘和关系建立。\n\n`;
    }

    // 客户行动承诺
    html+=`## 六、期望的客户行动承诺\n\n`;
    html+=`| 序号 | 行动承诺 | 目的 | 时间 |\n|------|----------|------|------|\n`;
    if(mainOpp&&mainOpp.stage===1){
      html+=`1. | 安排技术交流会议，邀请CIO/信息处长参加 | 推动进入方案阶段 | 本周 |\n`;
      html+=`2. | 提供需求确认书并获客户书面反馈 | 锁定需求方向 | 2周内 |\n`;
    }else if(mainOpp&&mainOpp.stage===2){
      html+=`1. | 安排方案评审会，获取方案确认函 | 推动进入商务阶段 | 本周 |\n`;
      html+=`2. | 同意进行POC/演示验证 | 验证方案可行性 | 2周内 |\n`;
    }else if(mainOpp&&mainOpp.stage===3){
      html+=`1. | 确认采购流程和时间线 | 加速商务谈判 | 本周 |\n`;
      html+=`2. | 推动合同内部审批 | 促成签约 | 2周内 |\n`;
    }else{
      html+=`1. | 同意安排下次深入交流 | 建立信任关系 | 2周内 |\n`;
      html+=`2. | 介绍决策链关键人 | 扩大关系覆盖 | 1月内 |\n`;
    }
    html+=`\n`;

    // 约见理由（模板）
    html+=`## 七、约见理由（预约模板）\n\n`;
    const targetContact=keyContacts[0]||contacts[0]||{name:c.name+'相关负责人',title:'负责人'};
    html+=`> **${targetContact.name}${(targetContact.title||'').includes('总')?'':'总'}，您好！**\n>\n`;
    html+=`> 我们关注到最近${info.policy.split('、')[0]}的政策方向，${c.industry}行业正在加速数字化转型。希望就${mainOpp?mainOpp.product:info.tech.split('、')[0]}方面与您做一次交流，想先了解贵单位目前的${info.pain.split('、')[0]}情况，听听您对如何推进这方面工作有什么考虑和安排，结合您的想法可以共同讨论可以加强的地方，以便协助您更好开展相关工作，也提高我们对您业务的了解、后续能更好支撑。\n>\n`;
    html+=`> 时间想定在本周${['三上午十点','四下午两点','五上午十点'][new Date().getDay()%3]}，您可以吗？\n\n`;

    // 开场自我介绍
    html+=`## 八、开场自我介绍\n\n`;
    html+=`| 步骤 | 内容 |\n|------|------|\n`;
    html+=`| 我是谁 | XX总您好，我是XX公司${c.industry}行业经理XXX，负责${c.industry}行业数字化服务 |\n`;
    html+=`| 经验背书 | 从事${c.industry}行业信息化XX年，服务过${sameIndustryClientNames(c)}等同行业客户 |\n`;
    html+=`| 释放陌生感 | 我们没有见过面，但我很早就关注到贵单位在${c.industry}领域的领先做法 |\n`;
    html+=`| 第三方故事 | 我们服务的一家同行业客户，原先${info.pain.split('、')[0]}，我们帮他们用${info.tech.split('、')[0]}解决了这个问题，效率提升了40% |\n\n`;

    // 信任建立与激发兴趣
    html+=`## 九、信任建立与激发兴趣\n\n`;
    html+=`| 客户可能疑问 | 应对话术 |\n|-------------|----------|\n`;
    html+=`| "你们是做什么的？" | 我们专注${c.industry}行业数字化，服务过${Store.customers().filter(x=>x.industry===c.industry).length}家同行业客户 |\n`;
    html+=`| "你们有什么不同？" | 我们的核心差异是${c.industry}行业深度理解，不是通用方案，而是行业专属能力 |\n`;
    html+=`| "友商也能做" | 确实，但我们在${info.benchmark.split('、')[0]}等标杆案例中验证了效果，可以避免踩坑 |\n`;
    html+=`| "价格怎么样？" | 先不谈价格，我们先看看方案是否匹配您的需求，价值对了价格自然合理 |\n\n`;

    // 需求探索与共识达成
    html+=`## 十、需求探索与共识达成\n\n`;
    html+=`### 探索问题清单\n\n`;
    html+=`1. 贵单位目前在${info.pain.split('、')[0]}方面是怎么做的？遇到哪些挑战？\n`;
    html+=`2. 在${info.policy.split('、')[0]}政策背景下，贵单位有哪些数字化规划？\n`;
    html+=`3. 目前${info.tech.split('、')[0]}的应用情况如何？效果怎么样？\n`;
    if(mainOpp) html+=`4. 关于${mainOpp.name}项目，目前推进到什么阶段？下一步计划是什么？\n`;
    html+=`5. 决策流程大概是什么样的？还需要哪些部门参与？\n\n`;
    html+=`### 共识达成要点\n\n`;
    html+=`- 确认客户认知：复述客户关注的痛点和期望\n- 连接方案价值：将客户痛点与我方方案能力对应\n- 提出下一步：明确行动承诺和时间节点\n\n`;

    // 拜访后行动建议
    html+=`## 十一、拜访后行动建议\n\n`;
    html+=`| 行动项 | 负责人 | 截止时间 |\n|--------|--------|----------|\n`;
    html+=`| 整理拜访纪要并发送客户确认 | 林经理 | 拜访后1天 |\n`;
    if(mainOpp&&mainOpp.stage<3) html+=`| 根据反馈更新方案 | 林经理+售前 | 拜访后3天 |\n`;
    html+=`| 录入跟进记录到CRM | 林经理 | 拜访后1天 |\n`;
    html+=`| 安排下一步行动并设日程 | 林经理 | 拜访后2天 |\n\n`;

    // 差异优势分析
    html+=`## 十二、差异优势分析\n\n`;
    const diffProduct=mainOpp?mainOpp.product:'行业解决方案';
    html+=`### 差异优势清单\n\n`;
    html+=`| 差异优势 | 竞品对比 | 与客户期望的关联 | 证据 |\n|----------|----------|------------------|------|\n`;
    html+=`| ${c.industry}行业深度理解 | 通用厂商缺乏行业know-how | 精准匹配${info.pain.split('、')[0]}痛点 | ${info.benchmark.split('、')[0]}等${Store.customers().filter(x=>x.industry===c.industry).length}家同行业客户验证 |\n`;
    html+=`| 信创全栈适配 | 多数厂商仅部分适配 | 满足合规要求和安全可控期望 | 已完成${c.level==='S'?'50+':'20+'}款国产产品适配认证 |\n`;
    html+=`| ${info.tech.split('、')[0]}成熟方案 | 竞品以概念为主 | 能看见可落地的场景和效果 | ${c.level==='S'?'8':'4'}个AI场景已在${info.benchmark.split('、')[0]}上线运行 |\n`;
    html+=`| 本地化交付服务 | 外地厂商响应慢 | 快速响应，降低沟通和实施成本 | ${c.region||'本地'}驻场团队，${c.level==='S'?'2':'1'}小时到达现场 |\n\n`;

    html+=`### 优势呈现方法（以"${info.tech.split('、')[0]}"为例）\n\n`;
    html+=`**1. 关联需求**：您刚才提到非常关注${info.pain.split('、')[0]}的问题，尤其是如何在不影响现有业务的前提下快速见效。\n\n`;
    html+=`**2. 假设现状场景**：您想像一下，当遇到${info.pain.split('、')[0]}突发情况时，现有的人工处理方式可能需要${c.level==='S'?'30分钟以上':'15分钟以上'}才能响应，期间可能已经造成了影响或损失。\n\n`;
    html+=`**3. 提议做法**：如果我们在现有系统之上，通过${info.tech.split('、')[0]}技术实现智能预警和自动分派——当异常发生时，系统${c.level==='S'?'2':'1'}秒内自动识别、自动匹配处置方案、自动通知相关人员——这样的话…\n\n`;
    html+=`**4. 效果价值**：那么，响应时间将从${c.level==='S'?'30分钟缩短至2分钟':'15分钟缩短至1分钟'}，${info.pain.split('、')[0]}效率提升${c.level==='S'?'60':'50'}%以上，同时减少人工盯盘的负担，让团队可以聚焦更高价值的工作。\n\n`;
    html+=`**5. 验证证明**：这种方式在${info.benchmark.split('、')[0]}已经实现过，他们原先和贵单位情况类似，上线后${info.pain.split('、')[0]}效率提升了${c.level==='S'?'65':'55'}%，获评行业创新应用案例，这是当时的项目总结材料。\n\n`;
    html+=`**6. 征询意见**：您觉得这样的方式，对实现您的想法、解决当前的问题，是否有帮助？\n\n`;

    // 拜访效果评估
    html+=`## 十三、拜访效果评估\n\n`;
    html+=`### 拜访沟通主要内容回顾\n\n`;
    html+=`| 议题 | 主要内容 | 客户反馈 |\n|------|----------|----------|\n`;
    html+=`| ${info.policy.split('、')[0]}政策影响 | 了解客户对政策变化的认知和应对思路 | 待会谈中确认 |\n`;
    html+=`| ${info.pain.split('、')[0]}现状与挑战 | 深入了解客户当前业务痛点及期望改善方向 | 待会谈中确认 |\n`;
    html+=`| ${diffProduct}方案探讨 | 针对客户痛点呈现差异化方案及SAR场景 | 待会谈中确认 |\n`;
    html+=`| 下一步行动安排 | 明确客户行动承诺及后续跟进事项 | 待会谈中确认 |\n\n`;

    html+=`### 拜访效果评估表\n\n`;
    html+=`| 评估维度 | 评分（1-5分） | 说明 |\n|----------|:-----------:|------|\n`;
    html+=`| 客户处境理解深度 | — | 是否准确把握客户外部变化和业务压力 |\n`;
    html+=`| 客户认知期望把握 | — | 是否准确理解客户对问题和目标的真实想法 |\n`;
    html+=`| 优势呈现效果 | — | 客户对差异优势的认可程度 |\n`;
    html+=`| 共识达成程度 | — | 客户对方案方向和价值的认同度 |\n`;
    html+=`| 行动承诺质量 | — | 获得的行动承诺是否推进销售进程 |\n`;
    html+=`| 信任建立程度 | — | 客户是否主动分享信息、询问"如何做" |\n\n`;

    // 信任提升计划
    html+=`## 十四、信任提升计划\n\n`;
    html+=`### 当前信任度评估\n\n`;
    html+=`| 信任信号 | 观察点 | 现状判断 |\n|----------|--------|----------|\n`;
    html+=`| 客户主动分享信息 | 是否提供高个性化数据和内部信息 | 首次拜访，待评估 |\n`;
    html+=`| 客户问"如何"而非"为什么" | 精力放在方案探讨而非质疑 | 首次拜访，待评估 |\n`;
    html+=`| 客户沟通专注度 | 是否全神贯注、主动延展话题 | 首次拜访，待评估 |\n`;
    html+=`| 客户不设防 | 无障碍和抵触情绪 | 首次拜访，待评估 |\n\n`;

    html+=`### 本次拜访信任提升策略\n\n`;
    html+=`| 策略 | 具体做法 | 预期效果 |\n|------|----------|----------|\n`;
    html+=`| 专业亮相 | 着装正式、提前到场、准备充分，展示${c.industry}行业专业形象 | 建立第一印象信任 |\n`;
    html+=`| 经验共鸣 | 分享${sameIndustryClientNames(c)}的数字化转型经历，引起行业共鸣 | 证明我们"懂行" |\n`;
    html+=`| 诚恳坦率 | 不过度承诺，客观说明方案适用边界和实施条件 | 建立可信赖感 |\n`;
    html+=`| 价值共创 | 不急于推销产品，以四季沟通术共创解决方案 | 客户感受到被理解和尊重 |\n`;
    html+=`| 跟进节奏 | 拜访后24小时内发送总结确认，72小时内推进下步行动 | 体现专业和重视 |\n\n`;

    html+=`> **📋 拜访纲领：以${mainOpp?mainOpp.product:'客户需求'}为核心话题，${keyContacts[0]?'重点沟通'+keyContacts[0].name:'先建立关键人关系'}，带着差异优势和SAR场景去呈现，带着效果评估和信任计划去复盘，带着反馈和下一步行动回。**`;

    function sameIndustryClientNames(c){
      const same=Store.customers().filter(x=>x.industry===c.industry&&x.id!==c.id).slice(0,3);
      return same.length?same.map(x=>x.shortName||x.name).join('、'):'多家同行业客户';
    }
    return html;
  },

  // ================================================================
  //  8. 赢单策略专家 — 按"策略销售"方法论分析
  //  提示词要求：用户行业→销售类型→商机背景→SSO→销售机会类型
  //  →销售阶段→紧迫程度→竞争形态→四种角色×九种影响力
  //  →客户反馈态度→支持程度→业务结果→个人赢
  //  →商机现状检查→赢单指数→健康度→行动策略→赢单九问
  // ================================================================
  oppStrategy(id){
    const o=Store.opportunity(id);
    if(!o) return '未找到该商机';
    const c=Store.customer(o.customerId);
    const contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    const fus=Store.followupsByOpp(id).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const lastFu=fus[0];
    const keyContacts=contacts.filter(x=>x.isKey);
    const supportContacts=contacts.filter(x=>x.attitude==='支持');
    const neutralContacts=contacts.filter(x=>x.attitude==='中立');
    const opposeContacts=contacts.filter(x=>x.attitude==='反对');
    const stInfo=DICT.opportunityStage.find(s=>s.value===o.stage)||{};
    const cpInfo=DICT.competition.find(x=>x.value===o.competition)||{};
    const info=c?Experts.getIndustryInfo(c.industry):Experts.genericIndustry;

    let html=`策 **项目赢面策略报告**\n\n`;
    html+=`> 商机：${o.name} ｜ 客户：${c?c.name:''} ｜ 分析日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、用户行业与销售类型分析
    html+=`## 一、用户行业与销售类型分析\n\n`;
    html+=`**客户行业**：${c?c.industry:'—'}（${info.scale}）\n\n`;
    html+=`**销售类型**：${o.amount>2000000?'解决方案销售':'产品销售'}\n\n`;
    html+=`**销售金额区间**：${Utils.fmtMoney(o.amount)}\n\n`;
    html+=`**销售漏斗模型**：${c&&/政府|教育/.test(c.industry)?'政府类销售漏斗（立项申报→资金审批→招标→评标→签约）':o.amount>2000000?'顾问式/解决方案销售漏斗':'标准产品销售漏斗'}\n\n`;

    // 二、客户商机背景
    html+=`## 二、客户商机背景\n\n`;
    html+=`| 维度 | 分析 |\n|------|------|\n`;
    html+=`| 客户经营处境 | ${c?c.industry+'行业，'+info.pain:'—'} |\n`;
    html+=`| 客户战略举措 | ${info.opportunity} |\n`;
    html+=`| 为什么要改变 | ${info.pain.split('、')[0]}亟需解决 |\n`;
    html+=`| 要解决的问题 | ${info.pain} |\n`;
    html+=`| 要构建的能力 | ${info.tech.split('、').slice(0,2).join('、')} |\n`;
    html+=`| 要达到的效果 | 提升效率、降低成本、满足合规 |\n\n`;

    // 三、单一销售目标（SSO）
    html+=`## 三、单一销售目标（SSO）\n\n`;
    html+=`**目标定义**：客户${c?c.name:''}将在${o.expectedSignDate?Utils.fmtDate(o.expectedSignDate):'待定'}签约${Utils.fmtMoney(o.amount)}的${o.product||'解决方案'}项目\n\n`;
    html+=`| 要素 | 内容 | 状态 |\n|------|------|------|\n`;
    html+=`| 客户 | ${c?c.name:''} | ✅ |\n`;
    html+=`| 产品/方案 | ${o.product||'—'} | ${o.product?'✅':'⚠️'} |\n`;
    html+=`| 金额 | ${Utils.fmtMoney(o.amount)} | ✅ |\n`;
    html+=`| 预算 | ${Utils.fmtMoney(o.budget)} | ${o.budget?'✅':'⚠️'} |\n`;
    html+=`| 时间 | ${o.expectedSignDate?Utils.fmtDate(o.expectedSignDate):'未定'} | ${o.expectedSignDate?'✅':'⚠️'} |\n`;
    html+=`| 使用人员 | ${o.applyDept||'—'} | ${o.applyDept?'✅':'⚠️'} |\n\n`;

    // 四、销售机会类型
    html+=`## 四、销售机会类型\n\n`;
    const oppHistory=Store.oppsByCustomer(o.customerId);
    const wonCount=oppHistory.filter(x=>x.status==='won').length;
    let oppType='';
    if(wonCount>0) oppType='老客户复购/交叉销售';
    else if(o.competition==='behind') oppType='竞争对手机会';
    else oppType='新客户新机会';
    html+=`**机会类型**：${oppType}\n\n`;
    html+=`**判断依据**：${wonCount>0?'客户已有'+wonCount+'个签约项目，属于老客户经营':'客户无签约历史，属于新客户开发'}\n\n`;

    // 五、销售阶段与紧迫程度
    html+=`## 五、销售阶段与紧迫程度\n\n`;
    html+=`**当前阶段**：${stInfo.label}（${o.stage}/4）\n\n`;
    html+=`**紧迫程度**：${o.expectedSignDate?(Utils.daysSince(o.expectedSignDate)>0?'🔴 已逾期'+Utils.daysSince(o.expectedSignDate)+'天':Utils.daysSince(o.expectedSignDate)>-30?'🟡 临近（'+(-Utils.daysSince(o.expectedSignDate))+'天后）':'🟢 正常'):'⚠️ 未设签约日期'}\n\n`;

    // 六、竞争形态
    html+=`## 六、竞争形态（客户倾向度）\n\n`;
    html+=`**竞争形势**：${cpInfo.label}\n\n`;
    if(o.competition==='single'){
      html+=`- 我方处于独占地位，核心任务是推动流程\n- 风险：客户可能引入竞争者压价\n- 策略：加快签约节奏，避免夜长梦多\n\n`;
    }else if(o.competition==='leading'){
      html+=`- 我方在技术评估或客户关系上占优\n- 对手：${o.competitors&&o.competitors.length?o.competitors.join('、'):'未知'}\n- 策略：巩固优势，防止对手反超\n\n`;
    }else if(o.competition==='even'){
      html+=`- 我方与对手势均力敌，胜负未分\n- 对手：${o.competitors&&o.competitors.length?o.competitors.join('、'):'未知'}\n- 策略：建立差异化优势，在客户最在意的维度拉开差距\n\n`;
    }else{
      html+=`- 我方处于劣势，需要逆转策略\n- 领先对手：${o.competitors&&o.competitors.length?o.competitors.join('、'):'未知'}\n- 策略：寻找对手薄弱环节，改变采购标准\n\n`;
    }

    // 七、客户参与决策的四种角色与九种影响力
    html+=`## 七、客户参与决策的四种角色与九种影响力\n\n`;
    html+=`| 角色 | 影响力代码 | 联系人 | 态度 | 支持度 | 影响力 |\n|------|-----------|--------|------|--------|--------|\n`;
    if(contacts.length===0){
      html+=`| ⚠️ 无联系人记录，需尽快建立客户关系 |||||\n`;
    }else{
      contacts.forEach(ct=>{
        let role='U-WB', infl='参与者';
        if(ct.isKey&&(ct.rank==='高管'||(ct.title||'').includes('总')||(ct.title||'').includes('主任'))){role='E-DB';infl='最终决策者';}
        else if(ct.isKey){role='E-PB';infl='建议决策者';}
        else if((ct.title||'').includes('技术')||(ct.title||'').includes('CIO')){role='T-CB';infl='标准把关者';}
        else if((ct.title||'').includes('财务')){role='T-FB';infl='预算审批者';}
        const support=ct.attitude==='支持'?'✅支持':ct.attitude==='中立'?'🟡中立':'🔴反对';
        const inflLevel=ct.isKey?'高':ct.rank==='中层'?'中':'低';
        html+=`| ${role} | ${infl} | ${ct.name}(${ct.title||'—'}) | ${ct.attitude||'未知'} | ${support} | ${inflLevel} |\n`;
      });
    }
    html+=`\n`;

    // 八、业务结果与个人赢
    html+=`## 八、业务结果与个人赢分析\n\n`;
    html+=`### 业务结果（可量化的组织价值）\n\n`;
    html+=`| 角色 | 业务目标 | 量化指标 |\n|------|----------|----------|\n`;
    contacts.slice(0,3).forEach(ct=>{
      html+=`| ${ct.name} | ${ct.isKey?'提升管理效率和决策质量':'提高工作效率和操作便捷性'} | ${ct.isKey?'管理效率提升30%+':'工作效率提升40%+'} |\n`;
    });
    if(!contacts.length) html+=`| — | 待探索 | — |\n`;
    html+=`\n### 个人赢（个人动机与诉求）\n\n`;
    html+=`| 角色 | 个人赢分析 |\n|------|------------|\n`;
    contacts.slice(0,3).forEach(ct=>{
      if(ct.isKey) html+=`| ${ct.name} | 政绩达成、获得认可、提升影响力 |\n`;
      else html+=`| ${ct.name} | 工作更轻松、获得技能提升、减少加班 |\n`;
    });
    if(!contacts.length) html+=`| — | 待探索 |\n`;
    html+=`\n`;

    // 九、商机现状分析检查
    html+=`## 九、商机现状分析检查\n\n`;
    html+=`| 检查项 | 现状 | 风险提示 |\n|--------|------|----------|\n`;
    html+=`| 商机金额vs预算 | ${Utils.fmtMoney(o.amount)} vs ${Utils.fmtMoney(o.budget)} | ${o.amount>o.budget?'🔴 金额超预算，需调整方案或追加预算':'✅ 金额在预算范围内'} |\n`;
    html+=`| 决策链覆盖 | ${contacts.length}人，关键人${keyContacts.length}个 | ${keyContacts.length<2?'⚠️ 关键人不足，决策链不完整':'✅ 决策链覆盖充分'} |\n`;
    html+=`| 竞争态势 | ${cpInfo.label} | ${o.competition==='behind'?'🔴 竞争落后，需逆转策略':o.competition==='even'?'⚠️ 竞争平手，需差异化':'✅ 竞争态势良好'} |\n`;
    html+=`| 跟进节奏 | ${fus.length}次跟进，最近${lastFu?Utils.daysSince(lastFu.at)+'天前':'从未'} | ${!lastFu||Utils.daysSince(lastFu.at)>14?'🔴 跟进滞后，可能被对手超越':'✅ 跟进及时'} |\n`;
    html+=`| 签约日期 | ${o.expectedSignDate?Utils.fmtDate(o.expectedSignDate):'未设'} | ${!o.expectedSignDate?'⚠️ 未设签约日期，时间线不明确':''} |\n`;
    html+=`| 采购方式 | ${o.purchaseMode||'未定'} | ${!o.purchaseMode?'⚠️ 采购方式未明确':''} |\n\n`;

    // 十、赢单指数分析
    html+=`## 十、赢单指数分析\n\n`;
    const indices=[
      {name:'客户紧迫度', status:o.expectedSignDate&&(Utils.daysSince(o.expectedSignDate)>-60)?'达标':'未达标', score:o.expectedSignDate?7:3},
      {name:'竞争定位', status:o.competition==='single'||o.competition==='leading'?'达标':o.competition==='even'?'待提升':'未达标', score:o.competition==='single'?9:o.competition==='leading'?7:o.competition==='even'?5:3},
      {name:'决策链覆盖', status:keyContacts.length>=2?'达标':keyContacts.length===1?'待提升':'未达标', score:keyContacts.length>=2?7:keyContacts.length===1?5:2},
      {name:'关键人支持度', status:supportContacts.length>=2?'达标':supportContacts.length===1?'待提升':'未达标', score:supportContacts.length>=2?7:supportContacts.length===1?5:3},
      {name:'业务结果清晰度', status:o.remark?'达标':'待提升', score:o.remark?6:3},
      {name:'个人赢清晰度', status:contacts.length>=2?'待提升':'未达标', score:contacts.length>=2?4:2},
      {name:'跟进节奏', status:lastFu&&Utils.daysSince(lastFu.at)<=7?'达标':lastFu&&Utils.daysSince(lastFu.at)<=14?'待提升':'未达标', score:lastFu&&Utils.daysSince(lastFu.at)<=7?7:lastFu&&Utils.daysSince(lastFu.at)<=14?5:2},
    ];
    html+=`| 赢单指数 | 当前进度 | 状态 | 评分(1-10) |\n|----------|----------|------|-----------|\n`;
    indices.forEach(idx=>{
      const icon=idx.status==='达标'?'✅':idx.status==='待提升'?'🟡':'🔴';
      html+=`| ${idx.name} | ${idx.status} | ${icon} | ${idx.score} |\n`;
    });
    const healthScore=Math.round(indices.reduce((s,i)=>s+i.score,0)/indices.length*10);
    html+=`\n### 商机健康度检查结果\n\n`;
    html+=`**综合健康度**：${healthScore}分/100分 ${healthScore>=70?'🟢 健康':healthScore>=45?'🟡 一般':'🔴 风险'}\n\n`;

    // 十一、行动策略
    html+=`## 十一、行动策略与行动计划\n\n`;
    html+=`### 可采取的行动\n\n`;
    const actions=[];
    if(keyContacts.length<2) actions.push('拓展决策层关系，补充E-DB/E-PB角色覆盖');
    if(supportContacts.length<keyContacts.length) actions.push('转化中立联系人为支持者，提升关键人支持度');
    if(o.competition==='behind'||o.competition==='even') actions.push('制定竞争差异化策略，重新定义采购标准');
    if(!lastFu||Utils.daysSince(lastFu.at)>7) actions.push('立即安排关键客户沟通，恢复跟进节奏');
    if(!o.expectedSignDate) actions.push('确认签约时间线，设定明确的SSO');
    if(o.amount>o.budget) actions.push('调整方案配置适配预算，或推动追加预算');
    if(!actions.length) actions.push('保持优势，加速推进签约流程');
    actions.forEach((a,i)=>html+=`${i+1}. ${a}\n`);

    html+=`\n### 2-3周推进策略与行动计划\n\n`;
    html+=`| 序号 | 行动 | 负责人 | 优先级 | 截止 |\n|------|------|--------|--------|------|\n`;
    let ai=1;
    if(o.stage===1){html+=`| ${ai++} | 深入需求调研，输出需求确认书 | 林经理 | 🔴 P0 | 5天内 |\n`;html+=`| ${ai++} | 安排技术交流会，邀请CIO参加 | 林经理+售前 | 🔴 P0 | 1周内 |\n`;}
    if(o.stage===2){html+=`| ${ai++} | 提交正式方案并推动评审 | 林经理+售前 | 🔴 P0 | 5天内 |\n`;html+=`| ${ai++} | 安排POC演示，验证方案可行性 | 林经理+技术 | 🔴 P0 | 1周内 |\n`;}
    if(o.stage===3){html+=`| ${ai++} | 优化商务报价，准备谈判 | 林经理 | 🔴 P0 | 3天内 |\n`;html+=`| ${ai++} | 推进采购流程，准备合同 | 林经理+法务 | 🔴 P0 | 1周内 |\n`;}
    if(keyContacts.length<2) html+=`| ${ai++} | 拓展决策层关键人关系 | 林经理 | 🟡 P1 | 7天内 |\n`;
    if(!lastFu||Utils.daysSince(lastFu.at)>7) html+=`| ${ai++} | 立即安排关键客户沟通 | 林经理 | 🔴 P0 | 2天内 |\n`;
    if(o.competition!=='single') html+=`| ${ai++} | 收集竞争对手情报 | 林经理 | 🟡 P1 | 5天内 |\n`;
    html+=`\n`;

    // 十二、赢单九问
    html+=`## 十二、赢单九问（自查清单）\n\n`;
    html+=`| 序号 | 问题 | 当前回答 |\n|------|------|----------|\n`;
    html+=`1. | 客户为什么要买？ | ${o.remark||'待明确'} |\n`;
    html+=`2. | 客户为什么要现在买？ | ${o.expectedSignDate?'计划'+Utils.fmtDate(o.expectedSignDate)+'签约':'时间线不明确'} |\n`;
    html+=`3. | 客户为什么要向我们买？ | ${o.competition==='single'?'独家供应商':info.tech.split('、')[0]+'技术优势'} |\n`;
    html+=`4. | 谁是最终决策者？ | ${keyContacts.find(x=>x.rank==='高管')?keyContacts.find(x=>x.rank==='高管').name:'待识别'} |\n`;
    html+=`5. | 决策者的个人赢是什么？ | ${keyContacts[0]?'政绩达成、获得认可':'待探索'} |\n`;
    html+=`6. | 我们的竞争位置如何？ | ${cpInfo.label} |\n`;
    html+=`7. | 客户的行动承诺是什么？ | ${lastFu&&lastFu.nextAction?lastFu.nextAction:'待确认'} |\n`;
    html+=`8. | 下一步关键动作是什么？ | ${actions[0]||'持续推进'} |\n`;
    html+=`9. | 如果输了，最可能的原因是？ | ${keyContacts.length<2?'决策链覆盖不足':o.competition==='behind'?'竞争劣势未逆转':!lastFu||Utils.daysSince(lastFu.at)>14?'跟进节奏滞后':'方案匹配度不足'} |\n\n`;

    html+=`> **📋 策略纲领：${o.name}健康度${healthScore}分${healthScore>=70?'🟢':healthScore>=45?'🟡':'🔴'}。${healthScore>=60?'保持优势，加速推进签约':healthScore>=40?'关键节点需突破，聚焦'+actions[0]:{}}。聚焦${actions[0]||'优势巩固'}，2-3周内完成关键行动。**`;
    return html;
  },

  // ================================================================
  //  5. 解决方案专家 — 按"解决方案设计"方法论分析
  //  提示词要求：用户行业分析→外部趋势(PEST)→企业优势
  //  →战略主张→业务举措→难点分析→能力分析→解决方案设计
  // ================================================================
  solution(customerId, oppId){
    let c, o, opps, contacts;
    if(oppId){
      o=Store.opportunity(oppId);
      c=Store.customer(o.customerId);
      opps=Store.oppsByCustomer(c.id);
      contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    }else{
      c=Store.customer(customerId);
      opps=Store.oppsByCustomer(customerId);
      contacts=Store.contactsByCustomer(customerId);
      o=opps.find(x=>x.status==='open')||opps[0];
    }
    if(!c) return '未找到该客户';
    const info=Experts.getIndustryInfo(c.industry);
    const keyContacts=contacts.filter(x=>x.isKey);

    let html=`案 **解决方案匹配报告**\n\n`;
    html+=`> 方案对象：${o?o.name:c.name+'整体方案'} ｜ 客户：${c.name} ｜ 日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、用户行业与销售属性分析
    html+=`## 一、用户行业与销售属性分析\n\n`;
    html+=`**客户行业**：${c.industry}（${info.scale}）\n\n`;
    html+=`**销售类型**：${o&&o.amount>2000000?'解决方案销售':'产品销售'}\n\n`;
    html+=`**销售金额**：${o?Utils.fmtMoney(o.amount):'待定'}\n\n`;
    html+=`**解决方案定义**：双方对确定的问题一致认可的答案，且能够带来可衡量的改善价值\n\n`;

    // 二、客户背景理解
    html+=`## 二、客户背景理解\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 主营业务 | ${c.industry}行业${c.remark||'核心业务'} |\n`;
    html+=`| 核心产品 | ${o?o.product||'数字化解决方案':'—'} |\n`;
    html+=`| 主要客户群体 | ${c.industry.includes('政府')?'辖区企业和群众':c.industry.includes('国企')?'集团及子公司':'行业用户'} |\n`;
    html+=`| 营业规模 | ${c.level}级客户 |\n`;
    html+=`| 行业地位 | ${c.level==='S'?'行业头部':c.level==='A'?'行业领先':'行业中等'} |\n`;
    html+=`| 发展方向 | ${info.opportunity} |\n\n`;

    // 三、外部趋势分析（PEST）
    html+=`## 三、外部趋势分析（PEST）\n\n`;
    html+=`### 政策法规\n\n`;
    html+=`1. ${info.policy}\n2. 信创替代列为考核指标\n3. ${info.policy.includes('数字')?'数字化转型政策持续加码':'行业规范趋严'}\n\n`;
    html+=`### 经济环境\n\n`;
    html+=`1. ${info.scale}，${info.growth}\n2. 产业链上下游数字化转型需求释放\n3. 客户IT预算持续向数字化倾斜\n\n`;
    html+=`### 技术趋势\n\n`;
    info.tech.split('、').forEach((t,i)=>html+=`${i+1}. ${t}\n`);
    html+=`\n### 用户需求\n\n`;
    html+=`1. 从"系统建设"向"业务赋能"转变\n2. 数据驱动决策成为核心诉求\n3. 信创合规从"可选"变为"必选"\n\n`;
    html+=`### 市场竞争\n\n`;
    html+=`1. ${info.competition}\n2. 价格竞争加剧，差异化能力成为核心\n3. 生态合作模式兴起\n\n`;

    // 四、企业优势分析
    html+=`## 四、企业优势分析\n\n`;
    html+=`| 优势 | 说明 |\n|------|------|\n`;
    html+=`| ${c.industry}行业深度 | 非通用方案，行业知识库内置 |\n`;
    html+=`| 信创全栈兼容 | 国产化全栈适配 |\n`;
    html+=`| 标杆案例 | ${info.benchmark.split('、')[0]}等 |\n`;
    html+=`| 本地化交付 | ${c.region||'本地'}服务团队 |\n\n`;

    // 五、战略主张
    html+=`## 五、战略主张\n\n`;
    html+=`> **以${info.tech.split('、')[0]}驱动${c.name}数字化转型，打造${c.industry}行业标杆**\n\n`;
    html+=`**战略主张特点**：\n- 客户中心：是"客户自己的事"，不是供应商的项目\n- 源于趋势：源于${info.policy.split('、')[0]}政策驱动\n- 客户语言：以${c.industry}行业视角表达\n- 动宾结构：以技术驱动转型，打造标杆\n\n`;

    // 六、业务举措
    html+=`## 六、业务举措\n\n`;
    html+=`| 序号 | 业务举措 | 说明 |\n|------|----------|------|\n`;
    html+=`1. | 构建${info.tech.split('、')[0]}平台 | 打破数据孤岛，实现数据统一管理 |\n`;
    html+=`2. | 推进信创全面替代 | 满足合规要求，保障安全可控 |\n`;
    html+=`3. | 建设AI+业务场景 | 以AI赋能核心业务流程，提升效率 |\n`;
    html+=`4. | 完善数据治理体系 | 建立数据标准，提升数据质量 |\n\n`;

    // 七、难点分析
    html+=`## 七、难点分析（按业务举措逐一分析）\n\n`;
    html+=`### 举措1：构建${info.tech.split('、')[0]}平台\n\n`;
    html+=`- 历史系统分期建设，缺乏统一架构规划，数据标准不一致\n- 各部门数据 ownership 分散，协调难度大\n- 平台建设周期长，短期内难以看到效果\n\n`;
    html+=`### 举措2：推进信创全面替代\n\n`;
    html+=`- 现有系统深度依赖国际厂商产品，迁移兼容性风险高\n- 替换周期长，业务中断风险\n- 国产化产品成熟度参差不齐\n\n`;
    html+=`### 举措3：建设AI+业务场景\n\n`;
    html+=`- AI场景识别不够精准，效果难以量化\n- 数据质量不足影响AI模型训练\n- 业务部门对新技术的接受度有限\n\n`;
    html+=`### 举措4：完善数据治理体系\n\n`;
    html+=`- 数据标准缺失，历史数据质量参差不齐\n- 缺乏专职数据治理团队\n- 数据治理见效慢，难以获得持续投入\n\n`;

    // 八、能力分析
    html+=`## 八、能力分析（与难点一一对应）\n\n`;
    html+=`| 难点 | 所需能力 | 我方产品匹配 |\n|------|----------|-------------|\n`;
    html+=`| 数据标准不一致 | 数据集成与治理能力 | 数据中台+ETL工具 |\n`;
    html+=`| 迁移兼容性风险 | 信创适配与迁移能力 | 信创适配平台+兼容性测试 |\n`;
    html+=`| AI场景不精准 | 行业AI模型与训练能力 | 行业AI引擎+知识库 |\n`;
    html+=`| 数据质量不足 | 数据质量管理能力 | 数据质量管控+元数据管理 |\n\n`;

    // 九、解决方案设计
    html+=`## 九、解决方案设计\n\n`;
    html+=`### 方案分层架构\n\n`;
    html+=`| 层级 | 模块 | 说明 |\n|------|------|------|\n`;
    html+=`| 基础设施层 | 信创云平台 | 国产服务器+操作系统+数据库+中间件 |\n`;
    html+=`| 平台层 | 数据中台+业务中台 | 数据治理+共享能力+API网关 |\n`;
    html+=`| 应用层 | 行业应用+AI赋能 | ${c.industry}行业定制+AI场景应用 |\n`;
    html+=`| 安全层 | 安全合规体系 | 等保2.0+密码评估+安全审计 |\n`;
    html+=`| 运维层 | 智能运维平台 | 统一监控+自动化+服务管理 |\n\n`;
    html+=`### 产品模块匹配\n\n`;
    html+=`| 模块 | 必选/可选 | 预估金额 | 价值 |\n|------|-----------|----------|------|\n`;
    if(o){
      const amt=o.amount;
      html+=`| 核心产品（${o.product||'主方案'}） | 必选 | ${Utils.fmtMoney(Math.round(amt*0.6))} | 解决核心需求 |\n`;
      html+=`| 实施部署服务 | 必选 | ${Utils.fmtMoney(Math.round(amt*0.2))} | 保障落地 |\n`;
      html+=`| 运维服务（3年） | 推荐 | ${Utils.fmtMoney(Math.round(amt*0.15))} | 持续保障 |\n`;
      html+=`| 培训赋能 | 推荐 | ${Utils.fmtMoney(Math.round(amt*0.05))} | 能力转移 |\n`;
    }
    html+=`\n### 实施路径\n\n`;
    html+=`| 阶段 | 周期 | 主要任务 | 里程碑 |\n|------|------|----------|--------|\n`;
    html+=`| 需求确认 | 2-3周 | 需求调研、方案细化 | 方案确认书 |\n`;
    html+=`| 方案设计 | 3-4周 | 详细设计、POC | 设计文档通过 |\n`;
    html+=`| 开发实施 | 8-12周 | 开发部署、数据迁移 | 系统上线 |\n`;
    html+=`| 测试验收 | 2-3周 | 功能测试、UAT | 验收报告 |\n\n`;

    // 十、SAR应用场景呈现
    html+=`## 十、SAR应用场景呈现\n\n`;
    html+=`> 以下应用场景以客户的业务语言、从客户视角描述：应用解决方案之前的现状（Situation），应用解决方案之后的行为方式变化（Action），以及由此带来的结果与价值（Result）。\n\n`;

    html+=`### 场景1：${info.tech.split('、')[0]}驱动的业务协同\n\n`;
    html+=`**S（现状）**：当某业务部门需要跨部门数据支撑决策时，需人工向多个部门发函调取数据，平均耗时${c.level==='S'?'3-5':'2-3'}个工作日，数据口径不一致，经常需要反复沟通确认，影响决策时效。\n\n`;
    html+=`**A（应用）**：通过${info.tech.split('、')[0]}平台建设，各部门数据实现统一汇聚和标准化治理，业务部门可通过自助式数据查询门户，按需获取经过质控的实时数据，系统自动生成数据报告并推送至相关决策人。\n\n`;
    html+=`**R（结果）**：数据获取时间从${c.level==='S'?'3-5天缩短至分钟级':'2-3天缩短至分钟级'}，跨部门协作效率提升${c.level==='S'?'60%':'50%'}以上，决策响应速度大幅提升。请问，这对提升贵单位的决策效率和部门协同，有帮助吗？\n\n`;

    html+=`### 场景2：信创迁移与业务连续性保障\n\n`;
    html+=`**S（现状）**：现有核心业务系统深度依赖国际厂商产品，面临信创替代合规要求。技术团队担心迁移过程中的业务中断风险，以及国产化产品与现有系统的兼容性问题，迁移方案迟迟无法确定。\n\n`;
    html+=`**A（应用）**：采用"先边缘后核心、先非实时后实时"的分步迁移策略，利用信创适配平台进行全量兼容性扫描与自动化测试，建立并行运行期（原系统+国产系统双轨运行），技术团队可通过统一管理平台实时监控迁移进度和系统健康度。\n\n`;
    html+=`**R（结果）**：业务系统实现平滑迁移，零停机切换，全面满足信创合规要求。迁移周期从行业平均${c.level==='S'?'18':'12'}个月压缩至${c.level==='S'?'12':'8'}个月，风险可控、进度可视。请问，这样的分步迁移方案，是否能打消您的顾虑？\n\n`;

    html+=`### 场景3：AI赋能${info.pain.split('、')[0]}业务优化\n\n`;
    html+=`**S（现状）**：目前${info.pain.split('、')[0]}主要依赖人工经验和线下沟通，效率低、覆盖有限，业务高峰期容易出现响应不及时和遗漏的情况。\n\n`;
    html+=`**A（应用）**：引入行业AI引擎，对历史${info.pain.split('、')[0]}数据建模训练，实现智能预警、自动分派和处置建议生成。前台人员收到预警后，系统自动推荐最优处置方案和历史同类案例参考，处置结果实时反馈并更新模型。\n\n`;
    html+=`**R（结果）**：${info.pain.split('、')[0]}处置效率提升40%以上，遗漏率降低70%，业务高峰期也能保持稳定服务质量。请问，通过AI赋能实现业务的智能化升级，是否正是您期望的方向？\n\n`;

    // 十一、标杆案例
    html+=`## 十一、标杆案例\n\n`;
    html+=`> 以下标杆案例选择与${c.name}规模、背景、性质相匹配的行业客户，通过第三方成功实践证明我们在该领域的经验和专业实力。\n\n`;

    html+=`### 标杆案例1：${info.benchmark.split('、')[0]}\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 行业/领域 | ${c.industry}行业 — 数字化转型 |\n`;
    html+=`| 业务问题 | 历史系统孤岛严重，${info.pain.split('、')[0]}问题突出，跨部门数据共享和业务协同困难 |\n`;
    html+=`| 所需能力 | 统一数据治理能力 + 跨系统集成能力 + ${info.tech.split('、')[0]}平台建设能力 |\n`;
    html+=`| 场景应用 | 建设统一数据中台，实现${c.level==='S'?'全':''}业务域数据汇聚与治理，支撑${c.level==='S'?'20+':'10+'}个业务场景的智能化应用 |\n`;
    html+=`| 结果 | 数据共享效率提升${c.level==='S'?'80':'60'}%，年节省人力成本约${c.level==='S'?'800':'300'}万元，获评${c.industry}行业数字化示范单位 |\n\n`;

    html+=`### 标杆案例2：${info.benchmark.split('、')[1]||info.benchmark.split('、')[0]+'（二期）'}\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 行业/领域 | ${c.industry}行业 — 信创替代与AI应用 |\n`;
    html+=`| 业务问题 | 面临信创全面替代合规要求，同时希望借助AI技术提升核心业务效率 |\n`;
    html+=`| 所需能力 | 信创全栈适配与迁移能力 + 行业AI模型训练与部署能力 |\n`;
    html+=`| 场景应用 | 完成${c.level==='S'?'50+':'20+'}套系统的信创替代，同步上线${c.level==='S'?'8':'4'}个AI辅助决策场景 |\n`;
    html+=`| 结果 | 信创替代率达${c.level==='S'?'95':'90'}%以上，AI场景使核心业务效率提升${c.level==='S'?'35':'25'}%，获主管部门通报表扬，方案被列为行业推广标杆 |\n\n`;

    html+=`> **📋 方案纲领：以${o?o.product:c.industry+'数字化'}为核心，基于PEST趋势分析，围绕客户战略主张和四/六条业务举措，通过SAR场景化呈现让客户"看到"方案落地后的真实画面，以两个标杆案例证明能力，${o?Utils.fmtMoney(o.amount)+'预算内最优配置':'预估千万级方案'}。**`;
    return html;
  },

  // ================================================================
  //  6. 价值营销专家 — 按"价值营销方法论"分析
  //  提示词要求：用户销售属性→客户关键目标→不同角色业务目标
  //  →潜在价值锚定→价值计算表→产品方案配置→投资效益
  //  →投资回报→价值方案评审→成功标准→客户兴趣激发→价值共创沟通
  // ================================================================
  valueMarketing(customerId, oppId){
    let c, o;
    if(oppId){
      o=Store.opportunity(oppId);
      c=Store.customer(o.customerId);
    }else{
      c=Store.customer(customerId);
      const opps=Store.oppsByCustomer(customerId);
      o=opps.find(x=>x.status==='open')||opps[0];
    }
    if(!c) return '未找到该客户';
    const info=Experts.getIndustryInfo(c.industry);
    const contacts=o?(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean):Store.contactsByCustomer(customerId);
    const amount=o?o.amount:0;
    const budget=o?o.budget:0;

    let html=`值 **客户价值呈现报告**\n\n`;
    html+=`> 价值对象：${o?o.name:c.name} ｜ 客户：${c.name} ｜ 日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、用户销售属性分析
    html+=`## 一、用户销售属性分析\n\n`;
    html+=`**销售类型**：${amount>2000000?'解决方案价值销售':'产品销售'}\n\n`;
    html+=`**价值营销适配性**：${amount>500000?'✅ 适合价值营销——解决方案涉及业务改善，可量化价值':'⚠️ 金额较小，价值营销效果有限'}\n\n`;
    html+=`**销售金额区间**：${Utils.fmtMoney(amount)}\n\n`;

    // 二、客户关键业务目标分析
    html+=`## 二、客户关键业务目标分析\n\n`;
    html+=`**客户业务目标类型**：\n`;
    html+=`- 企业内部驱动：效率提升、成本降低、收入增长\n- 政策驱动：信创合规、等保2.0、数据安全\n- 市场驱动：数字化转型、产业升级\n\n`;

    // 三、不同角色的业务目标分析
    html+=`## 三、不同角色的业务目标分析\n\n`;
    html+=`| 角色 | 岗位 | 业务目标 | 关键指标 |\n|------|------|----------|----------|\n`;
    const roles=[
      {role:'决策层(E-DB)',title:'主任/总',goal:'提升管理效能',kpi:'管理效率提升30%'},
      {role:'建议决策者(E-PB)',title:'信息处长',goal:'推进数字化建设',kpi:'系统覆盖率90%+'},
      {role:'标准把关者(T-CB)',title:'技术负责人',goal:'确保技术先进性',kpi:'信创兼容100%'},
      {role:'产品使用者(U-WB)',title:'业务人员',goal:'提高工作效率',kpi:'操作效率提升50%'},
      {role:'预算审批者(T-FB)',title:'财务负责人',goal:'控制成本投入',kpi:'ROI>150%'},
    ];
    roles.forEach(r=>html+=`| ${r.role} | ${r.title} | ${r.goal} | ${r.kpi} |\n`);
    html+=`\n`;

    // 四、潜在价值锚定与价值可控度分析
    html+=`## 四、潜在价值锚定与价值可控度分析\n\n`;
    html+=`| 价值领域 | 价值描述 | 价值可控度 | 量化方式 |\n|----------|----------|-----------|----------|\n`;
    html+=`| 人力效率 | 减少30%重复性工作 | ✅ 直接可控 | 人力成本×30%\n`;
    html+=`| 流程效率 | 业务处理时长缩短40-60% | ✅ 直接可控 | 处理时长对比 |\n`;
    html+=`| 决策效率 | 数据获取从天级到秒级 | ✅ 直接可控 | 决策周期对比 |\n`;
    html+=`| 合规价值 | 满足信创/等保合规 | ⚠️ 间接相关 | 风险规避 |\n`;
    html+=`| 创新价值 | 新增AI/数据赋能场景 | ⚠️ 间接相关 | 新增收入 |\n\n`;

    // 五、价值计算表
    html+=`## 五、价值计算表\n\n`;
    html+=`| 角色 | 业务目标(关键指标) | 现状基础 | 改善值 | 量化价值 |\n|------|-------------------|----------|--------|----------|\n`;
    const yr1=amount?Math.round(amount*0.15):500000;
    const yr2=amount?Math.round(amount*0.25):800000;
    const yr3=amount?Math.round(amount*0.35):1200000;
    html+=`| 决策层 | 管理效率 | 基线100% | +30% | ${Utils.fmtMoney(Math.round(yr1*0.3))}/年 |\n`;
    html+=`| 使用者 | 工作效率 | 基线100% | +50% | ${Utils.fmtMoney(Math.round(yr1*0.3))}/年 |\n`;
    html+=`| 财务 | 成本节约 | 基线成本 | -20% | ${Utils.fmtMoney(Math.round(yr1*0.2))}/年 |\n`;
    html+=`| 决策层 | 决策效率 | 天级响应 | 秒级 | ${Utils.fmtMoney(Math.round(yr1*0.2))}/年 |\n\n`;

    // 六、产品方案配置清单
    html+=`## 六、产品方案配置清单\n\n`;
    html+=`| 客户角色目标 | 匹配能力 | 产品模块 | 数量 | 价值 |\n|-------------|----------|----------|------|------|\n`;
    if(o){
      const amt=o.amount;
      html+=`| 管理效率提升 | 数据可视化 | BI平台 | 1套 | ${Utils.fmtMoney(Math.round(amt*0.25))} |\n`;
      html+=`| 业务流程数字化 | 流程引擎 | 业务中台 | 1套 | ${Utils.fmtMoney(Math.round(amt*0.35))} |\n`;
      html+=`| 信创合规 | 信创适配 | 信创平台 | 1套 | ${Utils.fmtMoney(Math.round(amt*0.2))} |\n`;
      html+=`| AI赋能 | AI引擎 | AI模块 | 1套 | ${Utils.fmtMoney(Math.round(amt*0.1))} |\n`;
      html+=`| 持续运营 | 运维服务 | 运维3年 | 1套 | ${Utils.fmtMoney(Math.round(amt*0.1))} |\n`;
      html+=`| **合计** | | | | **${Utils.fmtMoney(amt)}** |\n`;
    }
    html+=`\n`;

    // 七、投资效益分析
    html+=`## 七、投资效益分析\n\n`;
    if(amount>0){
      const total3=yr1+yr2+yr3;
      const roi3=Math.round(total3/amount*100);
      const payback=(amount/yr1*12).toFixed(1);
      const annualMaint=Math.round(amount*0.05);
      html+=`| 项目 | 金额/数据 | 说明 |\n|------|----------|------|\n`;
      html+=`| 一次投入 | ${Utils.fmtMoney(amount)} | 建设投入 |\n`;
      html+=`| 年运维成本 | ${Utils.fmtMoney(annualMaint)} | 5%年运维费 |\n`;
      html+=`| 第1年收益 | ${Utils.fmtMoney(yr1)} | 效率提升+人力节省 |\n`;
      html+=`| 第2年收益 | ${Utils.fmtMoney(yr2)} | 深化应用+规模效应 |\n`;
      html+=`| 第3年收益 | ${Utils.fmtMoney(yr3)} | 数据资产化+业务创新 |\n`;
      html+=`| 3年总收益 | ${Utils.fmtMoney(total3)} | 累计经济效益 |\n`;
      html+=`| 3年净收益 | ${Utils.fmtMoney(total3-amount-annualMaint*3)} | 总收益-投入-运维 |\n`;
      html+=`| 3年ROI | ${roi3}% | 投资回报率 |\n`;
      html+=`| 投资回收期 | ${payback}个月 | 静态回收期 |\n\n`;
    }

    // 八、投资回报分析
    html+=`## 八、投资回报分析\n\n`;
    html+=`- **总体投入**：${Utils.fmtMoney(amount)}\n`;
    html+=`- **回收期**：${amount?(amount/yr1*12).toFixed(0):'—'}个月\n`;
    html+=`- **综合ROI**：${amount?Math.round((yr1+yr2+yr3)/amount*100):75}%（3年）\n`;
    html+=`- **无形收益**：品牌示范效应、管理规范化、数据资产沉淀、合规风险规避\n\n`;

    // 九、价值方案评审
    html+=`## 九、价值方案评审\n\n`;
    html+=`**评审流程**：\n1. 准备价值方案评审材料（ROI报告+案例+TCO对比）\n2. 邀请决策层+技术层+财务层参加评审\n3. 现场呈现价值主张+量化收益+能力验证\n4. 收集反馈，确认成功标准\n\n`;
    html+=`**能力证明清单**：\n- [ ] ROI测算报告（详细版）\n- [ ] 同行业标杆案例集（3-5个）\n- [ ] 客户证言视频/书面推荐\n- [ ] 第三方测评报告/资质认证\n- [ ] TCO对比分析表\n- [ ] 实施保障方案（SLA承诺）\n\n`;

    // 十、成功标准
    html+=`## 十、成功标准\n\n`;
    html+=`| 角色 | 业务目标 | 第1年改善目标 | 第2年改善目标 |\n|------|----------|-------------|-------------|\n`;
    html+=`| 决策层 | 管理效率 | +20% | +30% |\n`;
    html+=`| 使用者 | 工作效率 | +30% | +50% |\n`;
    html+=`| 财务 | 成本节约 | -10% | -20% |\n\n`;

    // 十一、客户兴趣激发
    html+=`## 十一、客户兴趣激发（成功故事模板）\n\n`;
    html+=`**SPAR场景呈现法**：\n`;
    html+=`- **S（Situation）**：${c.industry}行业客户面临${info.pain.split('、')[0]}的挑战\n`;
    html+=`- **P（Problem）**：传统方式效率低下，数据无法互通，决策缺乏依据\n`;
    html+=`- **A（Approach）**：我们提供了${o?o.product:info.tech.split('、')[0]}解决方案\n`;
    html+=`- **R（Result）**：效率提升40%，成本降低20%，成为行业标杆\n\n`;

    // 十二、价值共创沟通流程
    html+=`## 十二、价值共创沟通流程（沟通六宫格）\n\n`;
    html+=`| | 现状 | 理想 |\n|---|------|------|\n`;
    html+=`| **探索** | 了解客户当前${info.pain.split('、')[0]}的处理方式 | 探索理想状态下的工作方式 |\n`;
    html+=`| **诊断** | 诊断现状中的效率瓶颈和成本浪费 | 呈现方案如何解决这些瓶颈 |\n`;
    html+=`| **确认** | 确认客户认同现状问题 | 确认客户认同方案价值和改善效果 |\n\n`;

    html+=`> **📋 价值纲领：${o?o.product:'方案'}的核心价值=经济价值(${amount?'3年ROI '+Math.round((yr1+yr2+yr3)/amount*100)+'%':'ROI 75%+'})+战略价值(${c.industry}标杆)+合规价值(信创/等保)。用数据说服决策层，用案例说服技术层，用TCO说服采购层。**`;
    return html;
  },

  // ================================================================
  //  4. 线索开发专家 — 按"线索开发"方法论分析
  //  提示词要求：客户洞察分析→需求分析与排序→锁定关键人
  //  →生成营销工具话术(EDM模板四段式)
  // ================================================================
  leadDev(customerId){
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户';
    const opps=Store.oppsByCustomer(customerId);
    const contacts=Store.contactsByCustomer(customerId);
    const fus=Store.followupsByCustomer(customerId);
    const info=Experts.getIndustryInfo(c.industry);
    const ownedProducts=[...new Set(opps.map(o=>o.product).filter(Boolean))];
    const allProducts=DICT.products||[];
    const whiteSpace=allProducts.filter(p=>!ownedProducts.includes(p));
    const openOpps=opps.filter(o=>o.status==='open');
    const wonOpps=opps.filter(o=>o.status==='won');
    const totalWon=Utils.sum(wonOpps,'amount');
    const keyContacts=contacts.filter(x=>x.isKey);

    let html=`拓 **线索拓展建议报告**\n\n`;
    html+=`> 分析对象：${c.name} ｜ ${c.industry} ｜ ${c.level}级 ｜ 日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、客户洞察分析
    html+=`## 一、客户洞察分析\n\n`;
    html+=`### 客户背景信息\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 核心业务 | ${c.industry}行业${c.remark||'核心业务'} |\n`;
    html+=`| 服务客群 | ${c.industry.includes('政府')?'辖区企业和群众':c.industry.includes('国企')?'集团及子公司':'行业用户'} |\n`;
    html+=`| 业务特征 | ${info.procurement} |\n`;
    html+=`| 业务规模 | ${c.level}级客户 |\n\n`;

    html+=`### 客户资产盘点\n\n`;
    html+=`| 维度 | 数据 |\n|------|------|\n`;
    html+=`| 累计商机 | ${opps.length}个 |\n`;
    html+=`| 进行中 | ${openOpps.length}个 |\n`;
    html+=`| 已签约 | ${wonOpps.length}个 |\n`;
    html+=`| 已签约金额 | ${Utils.fmtMoney(totalWon)} |\n`;
    html+=`| 联系人 | ${contacts.length}人（关键人${keyContacts.length}） |\n`;
    html+=`| 跟进次数 | ${fus.length}次 |\n`;
    html+=`| 已覆盖产品 | ${ownedProducts.length?ownedProducts.join('、'):'暂无'} |\n\n`;

    // 二、需求分析与排序
    html+=`## 二、需求分析与排序\n\n`;
    html+=`### 白空间分析（未覆盖产品线）\n\n`;
    if(whiteSpace.length){
      html+=`| 未覆盖产品 | 推荐优先级 | 切入理由 |\n|------------|-----------|----------|\n`;
      whiteSpace.forEach(p=>{
        const reason=(info.pain||'').includes(p.substring(0,2))?'与行业痛点直接相关':`${c.industry}行业常见需求`;
        const priority=ownedProducts.length?'🔴 高':'🟡 中';
        html+=`| ${p} | ${priority} | ${reason} |\n`;
      });
    }else{
      html+=`✅ 已覆盖全部产品线，重点转向扩容和续约\n`;
    }
    html+=`\n### 交叉销售机会\n\n`;
    const crossSellMap={
      '信创适配':['信创运维','安全合规','信创咨询'],
      '数据中台':['数据治理','BI可视化','数据安全'],
      'AI智能客服':['知识库建设','AI训练平台','智能外呼'],
      '智慧大屏':['数据中台','物联网平台','3D可视化'],
    };
    const crossOpps=[];
    ownedProducts.forEach(p=>{
      (crossSellMap[p]||[]).forEach(cs=>{ if(!ownedProducts.includes(cs)) crossOpps.push({product:p, suggest:cs}); });
    });
    if(crossOpps.length){
      html+=`| 基于已有产品 | 推荐扩展 | 交叉销售逻辑 |\n|------------|----------|-------------|\n`;
      crossOpps.forEach(co=>{html+=`| ${co.product} → ${co.suggest} | ${co.suggest} | 已有${co.product}基础，自然延伸 |\n`});
    }else{
      html+=`暂无明显交叉销售机会\n`;
    }
    html+=`\n### 潜在需求清单（5-7条）\n\n`;
    html+=`| 序号 | 潜在需求 | 关联关键人 | 优先级 |\n|------|----------|------------|--------|\n`;
    html+=`1. | ${info.pain.split('、')[0]}的系统性解决 | ${keyContacts[0]?keyContacts[0].name:'待识别'} | 🔴 高 |\n`;
    html+=`2. | ${info.pain.split('、')[1]||'业务协同效率低'} | ${keyContacts[1]||keyContacts[0]?(keyContacts[1]||keyContacts[0]).name:'待识别'} | 🔴 高 |\n`;
    html+=`3. | 信创合规替代 | ${keyContacts[0]?keyContacts[0].name:'待识别'} | 🟡 中 |\n`;
    html+=`4. | ${info.tech.split('、')[0]}应用需求 | 待识别 | 🟡 中 |\n`;
    html+=`5. | ${info.opportunity} | 待识别 | 🟡 中 |\n\n`;

    // 三、锁定目标关键人
    html+=`## 三、锁定目标关键人\n\n`;
    html+=`### 关键人触达分析\n\n`;
    html+=`| 触达对象 | 触达主题 | 触达内容 | 触达方式 |\n|----------|----------|----------|----------|\n`;
    const target=keyContacts[0]||contacts[0];
    if(target){
      html+=`| ${target.name}(${target.title||'负责人'}) | ${info.pain.split('、')[0]}解决方案交流 | 传递同行业案例+价值主张 | 邮件/电话 |\n`;
    }else{
      html+=`| 待识别 | 首次接触建立关系 | 传递行业洞察+公司介绍 | 邮件/会议 |\n`;
    }
    html+=`\n### 标杆客户或标杆案例\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 行业/领域 | ${c.industry}行业数字化 |\n`;
    html+=`| 业务问题 | ${info.pain.split('、').slice(0,2).join('、')} |\n`;
    html+=`| 所需能力 | ${info.tech.split('、').slice(0,2).join('、')} |\n`;
    html+=`| 场景应用 | ${info.benchmark.split('、')[0]}等标杆案例 |\n`;
    html+=`| 结果 | 效率提升40%，成本降低20% |\n\n`;

    // 四、营销工具话术（EDM模板四段式）
    html+=`## 四、营销工具话术（EDM营销模板）\n\n`;
    html+=`### 邮件主题\n\n`;
    html+=`**[为您/贵单位量身定制] 关于${info.pain.split('、')[0]}的解决方案，助力${c.industry.includes('政府')?'提升公共服务效率':'实现数字化转型'}**\n\n`;
    html+=`### 四段式邮件模板\n\n`;
    html+=`**第一段：引起注意**\n\n`;
    html+=`> ${target?target.name+'总':'您好'}，您好！我是XX公司${c.industry}行业经理XXX，从事${c.industry}行业信息化服务XX年。关注到贵单位在${info.pain.split('、')[0]}方面可能面临挑战，冒昧与您交流。\n\n`;
    html+=`**第二段：建立价值**\n\n`;
    html+=`> 我们在${c.industry}行业服务过${Store.customers().filter(x=>x.industry===c.industry).length}家客户，发现${info.pain.split('、')[0]}是行业共性问题。通过${info.tech.split('、')[0]}技术，可以帮助贵单位：\n> - 提升业务处理效率30-50%\n> - 降低运维成本20%\n> - 满足信创合规要求\n\n`;
    html+=`**第三段：证明能力**\n\n`;
    html+=`> 我们服务的${info.benchmark.split('、')[0]}等项目，已验证方案效果。同行业客户应用后，效率提升40%，成为${c.industry}行业数字化标杆。\n\n`;
    html+=`**第四段：引导行动**\n\n`;
    html+=`> 建议安排一次30分钟的交流，分享同行业最佳实践，看看是否有参考价值。您看本周${['三','四','五'][new Date().getDay()%3]}方便吗？\n\n`;

    // 五、线索开发评分
    html+=`## 五、线索开发优先级评分\n\n`;
    let score=0;const sf=[];
    if(c.level==='S'){score+=30;sf.push('S级客户(+30)');}
    else if(c.level==='A'){score+=20;sf.push('A级客户(+20)');}
    else{score+=10;sf.push(c.level+'级客户(+10)');}
    if(wonOpps.length>0){score+=20;sf.push('已有签约基础(+20)');}
    if(openOpps.length>0){score+=15;sf.push('有活跃商机(+15)');}
    if(keyContacts.length>=2){score+=15;sf.push('关键人充足(+15)');}
    else if(keyContacts.length===0){score-=10;sf.push('缺关键人(-10)');}
    if(whiteSpace.length>=3){score+=10;sf.push('白空间大(+10)');}
    if(fus.length>=5){score+=10;sf.push('跟进充分(+10)');}
    score=Math.max(0,Math.min(100,score));
    const rating=score>=70?'🔥 高优先级开发':score>=45?'📊 中等优先级':'⚪ 低优先级';
    html+=`**线索开发评分**：${score}/100 — ${rating}\n\n`;
    html+=`**影响因素**：${sf.join('、')}\n\n`;

    // 六、行动建议
    html+=`## 六、线索开发行动建议\n\n`;
    const actions=[];
    if(whiteSpace.length) actions.push(`优先推进白空间产品中的高优先级项：${whiteSpace.slice(0,2).join('、')}`);
    if(crossOpps.length) actions.push(`基于已有产品进行交叉销售：${crossOpps.slice(0,2).map(co=>co.product+'→'+co.suggest).join('；')}`);
    if(wonOpps.length) actions.push(`已签约客户挖掘二期/扩容需求，安排回访`);
    if(keyContacts.length<2) actions.push(`补充关键决策人，扩大联系人覆盖面`);
    actions.push(`使用EDM营销模板触达${target?target.name:'目标关键人'}`);
    actions.push(`定期关注${c.region||''}招标平台，捕捉${c.industry}采购信息`);
    actions.forEach((a,i)=>html+=`${i+1}. ${a}\n`);

    html+=`\n> **📋 线索开发纲领：${c.shortName||c.name}线索开发评分${score}分(${rating})。${whiteSpace.length?'白空间产品'+whiteSpace.length+'个待开发，':''}以EDM营销模板触达关键人，逐步拓展产品覆盖面。**`;
    return html;
  },

  // ================================================================
  //  9. 客户经营专家 — 按"战略大客户经营"方法论分析
  //  提示词要求：用户行业→战略客户选择(评分)→业务领域选择
  //  →合作关系评估→关键参与者→趋势→机遇→我方优势/劣势
  //  →合作宣言→业务目标→关键任务→潜在商机→经营计划
  // ================================================================
  customerMgmt(customerId){
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户';
    const opps=Store.oppsByCustomer(customerId);
    const contacts=Store.contactsByCustomer(customerId);
    const fus=Store.followupsByCustomer(customerId).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const info=Experts.getIndustryInfo(c.industry);
    const wonOpps=opps.filter(o=>o.status==='won');
    const openOpps=opps.filter(o=>o.status==='open');
    const lostOpps=opps.filter(o=>o.status==='lost');
    const totalWon=Utils.sum(wonOpps,'amount');
    const openAmount=Utils.sum(openOpps,'amount');
    const keyContacts=contacts.filter(x=>x.isKey);
    const supportContacts=contacts.filter(x=>x.attitude==='支持');

    let html=`营 **客户经营节奏报告**\n\n`;
    html+=`> 经营对象：${c.name} ｜ ${c.industry} ｜ ${c.level}级 ｜ 日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、用户行业分析
    html+=`## 一、用户行业与业务属性分析\n\n`;
    html+=`**客户行业**：${c.industry}（${info.scale}）\n\n`;
    html+=`**销售类型**：战略大客户经营\n\n`;
    html+=`**经营挑战**：客户决策周期长、竞争激烈、需持续投入、关系维护成本高\n\n`;

    // 二、战略客户选择评分
    html+=`## 二、战略客户选择评分\n\n`;
    html+=`| 评估维度 | 评分(1-10) | 评分理由 |\n|----------|-----------|----------|\n`;
    const scores={
      '战略价值':c.level==='S'?9:c.level==='A'?7:5,
      '收入贡献':totalWon>5000000?9:totalWon>1000000?7:totalWon>0?5:3,
      '增长潜力':openOpps.length>=2?8:openOpps.length===1?6:4,
      '关系基础':keyContacts.length>=2?8:keyContacts.length===1?6:3,
      '行业影响力':c.level==='S'?9:c.level==='A'?7:5,
      '合作意愿':supportContacts.length>=2?8:supportContacts.length===1?6:4,
      '技术匹配':8,
      '竞争地位':openOpps.some(o=>o.competition==='leading')?8:openOpps.some(o=>o.competition==='even')?5:4,
    };
    Object.entries(scores).forEach(([dim,s])=>{
      html+=`| ${dim} | ${s} | ${s>=7?'优势明显':s>=5?'中等水平':'需加强'} |\n`;
    });
    const avgScore=(Object.values(scores).reduce((a,b)=>a+b,0)/Object.keys(scores).length).toFixed(1);
    html+=`| **平均分** | **${avgScore}/10** | ${avgScore>=7?'✅ 适合战略客户经营':avgScore>=5?'🟡 可考虑战略经营':'⚠️ 暂不适合战略经营'} |\n\n`;

    // 三、业务领域选择
    html+=`## 三、业务领域选择\n\n`;
    html+=`| 业务领域 | 评分(1-10) | 选择理由 |\n|----------|-----------|----------|\n`;
    const ownedProducts=[...new Set(opps.map(o=>o.product).filter(Boolean))];
    ownedProducts.forEach(p=>{
      html+=`| ${p} | 8 | 已有商机基础，可深化拓展 |\n`;
    });
    if(!ownedProducts.length) html+=`| 数字化整体方案 | 7 | 客户有数字化转型需求，可切入 |\n`;
    html+=`\n`;

    // 四、合作关系评估
    html+=`## 四、合作关系评估\n\n`;
    let relScore=50;const rf=[];
    const lastFu=fus[0];
    const daysSince=lastFu?Utils.daysSince(lastFu.at):999;
    if(daysSince<=7){relScore+=15;rf.push('跟进及时(+15)');}
    else if(daysSince<=14){relScore+=8;rf.push('跟进正常(+8)');}
    else if(daysSince>30){relScore-=20;rf.push('跟进严重滞后(-20)');}
    else{relScore-=10;rf.push('跟进滞后(-10)');}
    if(keyContacts.length>=2){relScore+=12;rf.push('关键人充足(+12)');}
    else if(keyContacts.length===0){relScore-=15;rf.push('缺关键人(-15)');}
    if(supportContacts.length>=2){relScore+=10;rf.push('支持者多(+10)');}
    if(wonOpps.length>0){relScore+=15;rf.push('已有签约(+15)');}
    relScore=Math.max(0,Math.min(100,relScore));
    const relLabel=relScore>=70?'🟢 战略合作伙伴':relScore>=45?'🟡 业务合作伙伴':'🔴 初步接触阶段';
    html+=`| 评估维度 | 评分 | 说明 |\n|----------|------|------|\n`;
    html+=`| 合作关系层级 | ${relLabel} | ${relScore}/100 |\n`;
    html+=`| 影响因素 | ${rf.join('、')} | |\n\n`;

    // 五、关键参与者
    html+=`## 五、关键参与者\n\n`;
    if(contacts.length){
      html+=`| 姓名 | 职务 | 角色 | 态度 | 经营建议 |\n|------|------|------|------|----------|\n`;
      contacts.forEach(ct=>{
        let advice='';
        if(ct.isKey&&ct.attitude==='支持') advice='巩固关系，请其推动内部决策';
        else if(ct.isKey&&ct.attitude==='中立') advice='重点突破，用数据和案例转化';
        else if(ct.isKey) advice='了解顾虑，降低反对风险';
        else if(ct.attitude==='支持') advice='借助影响力向上拓展';
        else advice='保持信息同步，建立好感';
        html+=`| ${ct.name} | ${ct.title||'—'} | ${ct.isKey?'关键人':'参与者'} | ${ct.attitude||'未知'} | ${advice} |\n`;
      });
    }else{
      html+=`⚠️ 暂无联系人记录，建议尽快建立客户关系\n`;
    }
    html+=`\n`;

    // 六、趋势与机遇
    html+=`## 六、趋势与机遇\n\n`;
    html+=`**外部趋势**：${info.policy}\n\n`;
    html+=`**发展机遇**：${info.opportunity}\n\n`;
    html+=`**我方优势**：${info.tech.split('、')[0]}技术积累，同行业${Store.customers().filter(x=>x.industry===c.industry).length}个客户\n\n`;
    html+=`**我方劣势**：${wonOpps.length<2?'标杆案例不足':'案例需深化'}，${keyContacts.length<2?'决策链覆盖不足':'关系需深化'}\n\n`;

    // 七、合作宣言与业务目标
    html+=`## 七、合作宣言与业务目标\n\n`;
    html+=`### 合作宣言\n\n`;
    html+=`> **以${info.tech.split('、')[0]}驱动${c.name}数字化转型，打造${c.industry}行业标杆，实现业务效率提升与合规保障双赢**\n\n`;
    html+=`### 业务目标\n\n`;
    html+=`> ${c.name}${c.industry}业务领域的关键参与者，视我们为${relLabel}，将通过我们的${info.tech.split('、')[0]}技术优势抓住${info.opportunity}带来的发展机遇，创造${totalWon>0?'持续':''}业务价值。\n\n`;

    // 八、关键任务
    html+=`## 八、关键任务\n\n`;
    html+=`| 序号 | 关键任务 | 负责人 | 时间 | 优先级 |\n|------|----------|--------|------|--------|\n`;
    const tasks=[];
    if(daysSince>14) tasks.push(['安排客户拜访/高层会晤','林经理','本周','🔴 P0']);
    if(keyContacts.length<2) tasks.push(['拓展决策层关键人关系','林经理','2周内','🟡 P1']);
    if(openOpps.length>0) tasks.push(['加速在跟商机推进','林经理','持续','🔴 P0']);
    if(wonOpps.length>0&&openOpps.length===0) tasks.push(['挖掘新需求/二期项目','林经理','1月内','🟡 P1']);
    tasks.push(['制定年度客户经营计划','林经理','1月内','🟢 P2']);
    tasks.forEach((t,i)=>html+=`${i+1}. ${t[0]} | ${t[1]} | ${t[2]} | ${t[3]}\n`);
    html+=`\n`;

    // 九、潜在商机
    html+=`## 九、潜在商机与未来合作收入机会\n\n`;
    html+=`| 商机类型 | 预估金额 | 时间窗口 | 备注 |\n|----------|----------|----------|------|\n`;
    html+=`| 在跟商机 | ${Utils.fmtMoney(openAmount)} | ${openOpps.length?'3-6个月':'—'} | ${openOpps.length+'个进行中'} |\n`;
    if(wonOpps.length) html+=`| 续约/扩容 | ${Utils.fmtMoney(Math.round(totalWon*0.3))} | 6-12个月 | 基于已签约项目 |\n`;
    html+=`| 新领域拓展 | ${Utils.fmtMoney(500000)} | 12个月 | ${info.tech.split('、')[0]}方向 |\n`;
    const totalFuture=openAmount+(wonOpps.length?Math.round(totalWon*0.3):0)+500000;
    html+=`| **合计潜在收入** | **${Utils.fmtMoney(totalFuture)}** | | |\n\n`;

    // 十、经营计划检查与实施建议
    html+=`## 十、经营计划检查与实施建议\n\n`;
    html+=`**经营计划检查**：\n`;
    html+=`- [ ] 客户战略价值评估完成（${avgScore}/10）\n`;
    html+=`- [ ] 关键参与者已识别（${contacts.length}人）\n`;
    html+=`- [ ] 合作关系层级已评估（${relLabel}）\n`;
    html+=`- [ ] 业务目标已制定\n`;
    html+=`- [ ] 关键任务已分解\n\n`;
    html+=`**实施建议**：\n`;
    html+=`1. ${relScore>=60?'保持经营节奏，深化增购续约':relScore>=40?'需加强关系建设和商机推进':'紧急制定客户激活方案，防止流失'}\n`;
    html+=`2. 制定${c.shortName||c.name}年度经营计划，设定签约目标与关键里程碑\n`;
    html+=`3. 定期（月度）复盘客户经营进展，动态调整策略\n`;

    html+=`\n> **📋 经营纲领：${c.shortName||c.name}战略客户评分${avgScore}/10，合作关系${relLabel}（${relScore}分）。潜在收入${Utils.fmtMoney(totalFuture)}。${relScore>=60?'保持经营节奏，深化增购续约':relScore>=40?'需加强关系建设和商机推进':'紧急制定客户激活方案，防止流失'}。**`;
    return html;
  },

  // ================================================================
  //  10. 销售SOP专家 — 按"销售方法论SOP"分析
  //  提示词要求：用户行业→销售类型→漏斗模型选择
  //  →销售阶段定义→采购角色→销售任务行为
  //  →阶段升迁标准→赢率周期→SOP表格输出
  // ================================================================
  sopDesign(oppId){
    const o=Store.opportunity(oppId);
    if(!o) return '未找到该商机';
    const c=Store.customer(o.customerId);
    const contacts=(o.contactIds||[]).map(cid=>Store.contact(cid)).filter(Boolean);
    const fus=Store.followupsByOpp(oppId).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const stInfo=DICT.opportunityStage.find(s=>s.value===o.stage)||{};
    const info=c?Experts.getIndustryInfo(c.industry):Experts.genericIndustry;
    const keyContacts=contacts.filter(x=>x.isKey);

    let html=`程 **销售过程标准报告**\n\n`;
    html+=`> SOP对象：${o.name} ｜ 客户：${c?c.name:''} ｜ 当前阶段：${stInfo.label} ｜ 日期：${Utils.fmtDate(Utils.today())}\n\n---\n\n`;

    // 一、用户行业与销售属性分析
    html+=`## 一、用户行业与销售属性分析\n\n`;
    html+=`**客户行业**：${c?c.industry:'—'}（${info.scale}）\n\n`;
    html+=`**销售类型**：${o.amount>2000000?'解决方案销售':o.amount>200000?'产品大单销售':'产品销售'}\n\n`;
    html+=`**销售金额**：${Utils.fmtMoney(o.amount)}\n\n`;

    // 二、销售漏斗模型选择
    html+=`## 二、销售漏斗模型选择\n\n`;
    let funnelType='';
    if(c&&/政府|教育/.test(c.industry)) funnelType='政府类销售漏斗';
    else if(o.amount>2000000) funnelType='顾问式/解决方案销售漏斗';
    else if(o.amount>200000) funnelType='产品大单销售漏斗';
    else funnelType='标准产品销售漏斗';
    html+=`**适用漏斗模型**：${funnelType}\n\n`;
    html+=`**选择依据**：${c&&/政府|教育/.test(c.industry)?'政府/教育类客户需立项申报和资金审批流程':o.amount>2000000?'大金额解决方案需定制化销售流程':'标准产品流程相对简单'}\n\n`;

    // 三、销售方法论SOP表格
    html+=`## 三、销售方法论SOP表格\n\n`;
    html+=`| 阶段 | 阶段定义 | 客户采购行为 | 销售任务行为 | 升迁标准 | 赢率 | 标准周期 | 当前状态 |\n`;
    html+=`|------|----------|-------------|-------------|----------|------|----------|----------|\n`;

    const sopStages=[
      {
        stage:'1.线索/意向',
        def:'客户有初步需求意向，尚未明确采购计划',
        custBeh:'内部需求酝酿→信息收集→初步了解供应商',
        salesBeh:'需求挖掘→客户画像建立→首次交流→商机立项',
        gate:'客户确认需求方向，同意进行方案设计/POC',
        winRate:'10-20%',
        cycle:'2-4周',
      },
      {
        stage:'2.方案/评估',
        def:'客户明确需求，进入方案评估和技术验证阶段',
        custBeh:'需求确认→方案征集→技术评估→POC验证',
        salesBeh:'方案设计→POC准备→方案评审→获取方案确认',
        gate:'客户确认方案满足需求，同意进入商务谈判',
        winRate:'30-50%',
        cycle:'4-8周',
      },
      {
        stage:'3.商务/谈判',
        def:'方案通过评估，进入商务报价和合同谈判阶段',
        custBeh:'预算审批→招标/比价→商务谈判→合同审批',
        salesBeh:'报价策略→投标准备→商务谈判→合同签署',
        gate:'中标通知/合同签署完成',
        winRate:'60-80%',
        cycle:'3-6周',
      },
      {
        stage:'4.成交/交付',
        def:'合同签署，进入交付实施和客户经营阶段',
        custBeh:'合同签署→项目启动→验收交付→持续运营',
        salesBeh:'启动会→交付管理→满意度回访→案例包装→二期挖掘',
        gate:'验收通过+客户满意+新商机线索',
        winRate:'100%',
        cycle:'8-16周',
      },
    ];

    sopStages.forEach(s=>{
      const isCurrent=s.stage.startsWith(o.stage+'.');
      const isPast=parseInt(s.stage)<o.stage;
      const status=isCurrent?'🔵 当前':isPast?'✅ 已完成':'⚪ 待进入';
      html+=`| ${s.stage} | ${s.def} | ${s.custBeh} | ${s.salesBeh} | ${s.gate} | ${s.winRate} | ${s.cycle} | ${status} |\n`;
    });
    html+=`\n`;

    // 四、各阶段客户采购角色分析
    html+=`## 四、各阶段客户采购角色分析\n\n`;
    html+=`| 阶段 | 主要参与角色 | 关注重点 |\n|------|-------------|----------|\n`;
    html+=`| 线索/意向 | U-WB(使用者)+E-PB(建议者) | 需求是否被理解、方案是否可行 |\n`;
    html+=`| 方案/评估 | T-CB(把关者)+E-PB(建议者)+U-WB(使用者) | 技术先进性、方案匹配度、风险可控性 |\n`;
    html+=`| 商务/谈判 | E-DB(决策者)+T-FB(预算者)+T-AB(流程操作者) | 价格合理性、合规性、交付保障 |\n`;
    html+=`| 成交/交付 | E-DB(决策者)+U-WB(使用者)+C-CA(拥护者) | 交付质量、使用效果、持续服务 |\n\n`;

    // 五、当前阶段SOP详细执行
    html+=`## 五、当前阶段SOP详细执行（${stInfo.label}）\n\n`;
    const currentSop=sopStages[o.stage-1]||sopStages[0];
    html+=`### 阶段定义\n${currentSop.def}\n\n`;
    html+=`### 客户采购行为\n${currentSop.custBeh}\n\n`;
    html+=`### 销售任务行为\n${currentSop.salesBeh}\n\n`;
    html+=`### 升迁标准（质量门控）\n${currentSop.gate}\n\n`;
    html+=`### 赢率：${currentSop.winRate} ｜ 标准周期：${currentSop.cycle}\n\n`;

    // 六、当前阶段检查清单
    html+=`## 六、当前阶段检查清单\n\n`;
    html+=`| 检查项 | 状态 | 说明 |\n|--------|------|------|\n`;
    html+=`| 商机信息完整 | ${o.product&&o.amount&&o.budget?'✅':'⚠️'} | ${o.product?'产品已定':'产品未定'}，${o.budget?'预算已定':'预算未定'} |\n`;
    html+=`| 决策链已梳理 | ${keyContacts.length>0?'✅':'⚠️'} | ${contacts.length}人，关键人${keyContacts.length}个 |\n`;
    html+=`| 竞争形势已评估 | ✅ | ${DICT.label('competition',o.competition)} |\n`;
    html+=`| 签约日期已设 | ${o.expectedSignDate?'✅':'⚠️'} | ${o.expectedSignDate?Utils.fmtDate(o.expectedSignDate):'未设置'} |\n`;
    if(o.stage===1){
      html+=`| 需求确认书 | ⚠️ | 是否已输出并获客户认可 |\n`;
      html+=`| 首次技术交流 | ⚠️ | 是否已安排并完成 |\n`;
    }
    if(o.stage===2){
      html+=`| 技术方案文档 | ⚠️ | 是否已提交客户 |\n`;
      html+=`| POC演示 | ⚠️ | 是否已安排POC |\n`;
      html+=`| 方案确认函 | ⚠️ | 是否已获客户书面认可 |\n`;
    }
    if(o.stage===3){
      html+=`| 报价方案 | ⚠️ | 是否已制定分级报价 |\n`;
      html+=`| 合同草案 | ⚠️ | 是否已起草并法务审核 |\n`;
    }
    html+=`\n`;

    // 七、必备文档清单
    html+=`## 七、必备文档清单\n\n`;
    const docs={
      1:['客户需求调研报告','商机立项单','首次交流会会议纪要','客户组织架构图'],
      2:['技术方案设计书','POC测试方案','POC测试报告','方案评审纪要','方案确认函'],
      3:['报价方案（分级）','投标文件（如招标）','商务谈判纪要','合同草案','法务审核意见'],
      4:['项目启动会纪要','交付计划书','客户满意度报告','标杆案例材料'],
    };
    const currentDocs=docs[o.stage]||docs[1];
    html+=`| 序号 | 文档名称 | 状态 |\n|------|----------|------|\n`;
    currentDocs.forEach((d,i)=>html+=`| ${i+1} | ${d} | ⬜ 待完成 |\n`);
    html+=`\n`;

    // 八、角色与分工（RACI）
    html+=`## 八、角色与分工（RACI矩阵）\n\n`;
    html+=`| 任务 | 负责人(R) | 审批人(A) | 咨询(C) | 知会(I) |\n|------|-----------|-----------|---------|---------|\n`;
    html+=`| 需求调研 | 林经理 | 销售总监 | 售前 | 客户联系人 |\n`;
    html+=`| 方案设计 | 售前架构师 | 林经理 | 技术专家 | 客户CIO |\n`;
    html+=`| POC验证 | 技术工程师 | 售前架构师 | 林经理 | 客户技术团队 |\n`;
    html+=`| 报价/投标 | 林经理 | 销售总监 | 财务/法务 | — |\n`;
    html+=`| 合同签署 | 林经理 | VP/总监 | 法务 | 交付团队 |\n`;
    html+=`| 交付实施 | 交付经理 | 林经理 | 售前 | 客户 |\n\n`;

    // 九、风险检查点与升级机制
    html+=`## 九、风险检查点与升级机制\n\n`;
    html+=`| 风险信号 | 触发条件 | 升级动作 |\n|----------|----------|----------|\n`;
    html+=`| 跟进停滞 | 超10天无客户沟通 | 销售经理 → 销售总监 |\n`;
    html+=`| 竞争加剧 | 友商介入或客户提及友商 | 立即汇报，制定竞争策略 |\n`;
    html+=`| 关键人变动 | 客户方决策人/支持者变更 | 重新梳理决策链，重建关系 |\n`;
    html+=`| 预算风险 | 客户预算被削减/取消 | 调整方案配置适配预算 |\n`;
    html+=`| 时间延期 | 签约日期推迟超30天 | 升级至VP级关注，专项推进 |\n\n`;

    // 十、下一步行动
    html+=`## 十、当前阶段下一步行动\n\n`;
    html+=`| 序号 | 行动 | 负责人 | 截止 | 状态 |\n|------|------|--------|------|------|\n`;
    if(o.stage===1){
      html+=`| 1 | 需求调研，输出需求确认书 | 林经理 | 5个工作日 | ⬜ |\n`;
      html+=`| 2 | 安排技术交流会 | 林经理+售前 | 5个工作日 | ⬜ |\n`;
      html+=`| 3 | 商机立项，明确金额/预算/时间线 | 林经理 | 2个工作日 | ⬜ |\n`;
    }else if(o.stage===2){
      html+=`| 1 | 方案设计，输出技术方案文档 | 售前团队 | 10个工作日 | ⬜ |\n`;
      html+=`| 2 | POC准备与演示 | 技术团队 | 7个工作日 | ⬜ |\n`;
      html+=`| 3 | 方案评审，获取确认函 | 林经理 | 5个工作日 | ⬜ |\n`;
    }else if(o.stage===3){
      html+=`| 1 | 制定分级报价方案 | 林经理 | 3个工作日 | ⬜ |\n`;
      html+=`| 2 | 商务谈判 | 林经理 | 5个工作日 | ⬜ |\n`;
      html+=`| 3 | 合同起草与法务审核 | 林经理+法务 | 5个工作日 | ⬜ |\n`;
    }else{
      html+=`| 1 | 召开项目启动会 | 林经理+交付 | 3个工作日 | ⬜ |\n`;
      html+=`| 2 | 满意度回访 | 林经理 | 30天 | ⬜ |\n`;
      html+=`| 3 | 案例包装与二期挖掘 | 林经理+市场 | 30天 | ⬜ |\n`;
    }
    const lastFu=fus[0];
    if(lastFu&&lastFu.nextAction){
      html+=`| ★ | 待办：${lastFu.nextAction} | 林经理 | ${lastFu.nextDate?Utils.fmtDate(lastFu.nextDate):'尽快'} | ⬜ |\n`;
    }

    html+=`\n> **📋 SOP纲领：${o.name}适用${funnelType}，当前${stInfo.label}（赢率${currentSop.winRate}）。质量门控：${currentSop.gate}。按SOP执行每一步，确保不遗漏关键环节，每步完成即更新检查清单。**`;
    return html;
  },

  // ===== 行业知识库（客户洞察专家使用） =====
  industryKB: {
    '国企央企':{
      mission:'服务国家战略，保障国民经济命脉，发挥行业标杆和引领作用',
      coreBiz:'国有资产运营管理、基础设施建设、产业投资与运营、科技创新与产业化',
      clients:'政府部门、上下游企业、社会公众、子公司及参控股企业',
      bizModel:'国资授权经营模式，以资产运营和产业投资为核心，通过子公司专业化运营创造利润',
      kpi:'国有资产保值增值率、净资产收益率、营业收入、利润总额、研发投入强度、安全环保指标',
      devPlan:'2026-2028年推进数字化转型深化、信创全面替代、ESG治理体系建设，打造世界一流企业',
      scale:'总资产千亿级，大型国资控股集团',
      capacity:'多业务板块并行运营，覆盖基础设施、产业投资、科技创新等领域',
      staff:'集团总部500-1000人，全集团万人规模，含管理人员、科研人员、业务人员',
      policy:'国企改革深化提升行动、数字化转型行动计划、信创全面替代政策、关键核心技术攻关工程',
      techTrend:'云原生、AI大模型、数据要素化、工业互联网、信创技术栈成熟',
      userDemand:'子公司数字化转型需求强烈，集团级数据治理与共享诉求迫切',
      marketSupply:'数字化服务商竞争激烈，信创生态快速成熟，国产替代加速',
      competition:'头部IT厂商、信创厂商、行业解决方案商多方竞争，集团入围门槛高',
      regulator:'国资委、发改委、工信部、财政部',
      upstream:'基础设施提供商、云服务商、信创软硬件厂商',
      downstream:'子公司、参控股企业、社会公众服务对象',
      partners:'数字化转型咨询机构、系统集成商、信创生态伙伴、科研院所',
      initiatives:'推进集团级数字化转型、信创全面替代、数据中台建设、AI赋能业务场景',
      bizGoal:'数字化转型覆盖率达到80%，信创替代率2027年达到100%，数据治理体系全面建立',
      scenes:['集团管控与决策支持','子公司业务协同与数据共享','信创适配与迁移','资产运营与投资管理','安全合规与风险管控','ESG治理与可持续发展'],
      existingProjects:'OA系统、财务管理系统、部分子公司业务系统（部分已完成信创适配）',
      existingVendors:'友商E（数据库）、友商A（OA）、友商C（云服务）等',
      roles:{
        '最终决策者(E-DB)':{duty:'集团战略决策与投资审批',kpi:'集团经营业绩与战略目标达成',pain:'数字化转型效果不及预期，信创替代时间紧迫',goal:'在预算内完成信创替代，同时提升集团管控效率',scene:'集团管控与决策支持'},
        '技术决策者(E-PB)':{duty:'信息化建设规划与技术选型',kpi:'信创替代率、系统稳定性、数据安全合规',pain:'信创适配技术复杂，迁移风险高，技术团队人手不足',goal:'稳妥完成信创迁移，确保业务连续性，建立可复用的技术平台',scene:'信创适配与迁移'},
        '业务使用者(B-UB)':{duty:'业务部门日常运营管理',kpi:'业务处理效率、数据准确性、流程合规性',pain:'系统孤岛严重，数据不互通，手工操作多',goal:'打通数据壁垒，提升业务协同效率',scene:'子公司业务协同与数据共享'},
        'default':{duty:'负责相关业务领域的管理与决策',kpi:'业务运营效率与数字化转型成果',pain:'面临业务转型压力',goal:'提升业务效率，完成年度目标',scene:'集团管控与决策支持'}
      },
      bizGoals:[
        {goal:'完成信创全面替代',metric:'信创替代率2027年达到100%'},
        {goal:'建立集团级数据治理体系',metric:'数据标准覆盖率90%+'},
        {goal:'提升集团管控效能',metric:'决策周期缩短30%'},
        {goal:'推进AI赋能业务',metric:'AI场景应用5个以上'}
      ],
      painPoints:[
        {problem:'系统孤岛严重，数据难以互联互通',scene:'子公司业务协同与数据共享',impact:'🔴 高'},
        {problem:'信创适配迁移风险高、周期长',scene:'信创适配与迁移',impact:'🔴 高'},
        {problem:'集团管控数据不及时、不透明',scene:'集团管控与决策支持',impact:'🟡 中'},
        {problem:'安全合规压力增大',scene:'安全合规与风险管控',impact:'🟡 中'},
        {problem:'子公司数字化能力参差不齐',scene:'子公司业务协同与数据共享',impact:'🟡 中'}
      ],
      potentialNeeds:[
        {need:'集团级数据中台建设',scene:'子公司业务协同与数据共享',priority:1,reason:'打通数据壁垒是所有业务协同的前提'},
        {need:'信创全栈适配方案',scene:'信创适配与迁移',priority:1,reason:'政策刚性要求，时间紧迫'},
        {need:'集团管控决策大屏',scene:'集团管控与决策支持',priority:2,reason:'提升高管决策效率'},
        {need:'AI+业务场景应用',scene:'集团管控与决策支持',priority:2,reason:'降本增效新引擎'},
        {need:'安全合规一体化平台',scene:'安全合规与风险管控',priority:3,reason:'等保2.0与数据安全法要求'},
        {need:'子公司数字化能力赋能平台',scene:'子公司业务协同与数据共享',priority:3,reason:'解决数字化能力不均问题'}
      ],
      keyPositions:[
        {position:'副总裁/副总经理',kpi:'分管领域经营业绩与战略目标达成'},
        {position:'CIO/信息部总经理',kpi:'信创替代率、系统稳定性、数字化覆盖率'},
        {position:'业务部门负责人',kpi:'业务处理效率与流程合规性'},
        {position:'采购部经理',kpi:'采购合规性与成本控制'},
        {position:'安全总监',kpi:'安全合规达标率'}
      ],
      visitReason:'国资委信创替代考核要求与集团数字化转型规划',
      visitTopic:'信创替代与数字化转型的整体规划与实施路径',
      visitQuestions:{
        change:['最近国资委对信创替代有哪些新的考核要求？时间节点是什么？','集团数字化转型最新规划中，有哪些重点方向和举措？'],
        business:['集团目前的核心业务系统中，哪些已经完成信创适配？哪些还在计划中？','子公司之间的业务协同目前是怎么开展的？数据共享方面有哪些痛点？'],
        scene:['集团管控决策目前主要依赖哪些系统和数据？及时性如何？','信创迁移过程中，最大的技术挑战是什么？业务连续性如何保障？'],
        needs:['对于集团级数据中台建设，您有什么考虑和期望？','在AI赋能业务方面，您希望优先在哪些场景落地？']
      }
    },

    '政府机关':{
      mission:'推进数字政府建设，提升政务服务效能，保障数据安全与合规',
      coreBiz:'政务服务办理、行政审批、公共资源交易、社会治理、监管执法',
      clients:'企业和群众办事对象、下级政府部门、平行协同部门',
      bizModel:'行政运行模式，以财政预算为支撑，通过政务服务和社会治理创造社会价值',
      kpi:'政务服务事项网办率、审批时效、群众满意度、数据共享率、安全合规达标率',
      devPlan:'2026-2028年深化一网通办、一网统管、数字政府建设，推进政务大模型应用',
      scale:'省/市/区县级政府部门，管辖服务对象数十万至数百万',
      capacity:'政务服务日办件量数千至数万件，覆盖全部政务服务事项',
      staff:'机关编制人员数百人，含管理人员、业务人员、技术人员',
      policy:'数字政府建设指导意见、政务服务一网通办、数据安全法、个人信息保护法、信创替代',
      techTrend:'政务大模型、一网统管平台、数据要素化、区块链+政务、信创全栈',
      userDemand:'企业和群众对政务服务"掌上办、一次办"诉求强烈，跨部门协同需求高',
      marketSupply:'政务数字化服务商众多，信创生态日趋成熟',
      competition:'头部政务IT厂商、信创厂商、云服务商竞争，需通过政府采购合规流程',
      regulator:'上级政府主管部门、网信办、大数据局',
      upstream:'云服务商、信创软硬件厂商、系统集成商',
      downstream:'下级政府部门、政务服务大厅',
      partners:'数字政府建设咨询机构、科研院所、信创生态伙伴',
      initiatives:'推进一网通办深化、一网统管建设、政务大模型试点、信创全面替代',
      bizGoal:'政务服务网办率达到95%以上，跨部门数据共享率90%以上，信创替代率100%',
      scenes:['政务服务一网通办','跨部门数据共享与协同','一网统管社会治理','政务大模型辅助决策','信创适配与迁移','安全合规与数据保护'],
      existingProjects:'政务服务系统、OA办公系统、部分业务监管系统',
      existingVendors:'友商A（政务云）、友商B（OA）、友商D（大数据平台）等',
      roles:{
        '最终决策者(E-DB)':{duty:'部门整体工作决策与部署',kpi:'政务服务效能、群众满意度、安全合规',pain:'政务服务效能提升压力大，跨部门协同困难',goal:'提升网办率与群众满意度，完成信创替代',scene:'政务服务一网通办'},
        '技术决策者(E-PB)':{duty:'信息化建设规划与技术选型',kpi:'系统稳定性、信创替代率、数据安全',pain:'系统孤岛、数据共享难、信创迁移紧迫',goal:'建设统一数字政府平台，完成信创替代',scene:'跨部门数据共享与协同'},
        'default':{duty:'负责相关业务领域的管理与决策',kpi:'业务办理效率与合规性',pain:'系统操作复杂，跨部门协同效率低',goal:'提升业务办理效率',scene:'政务服务一网通办'}
      },
      bizGoals:[
        {goal:'深化一网通办',metric:'网办率95%+'},
        {goal:'推进一网统管',metric:'社会治理覆盖主要领域'},
        {goal:'完成信创替代',metric:'信创替代率100%'},
        {goal:'试点政务大模型',metric:'3个以上大模型应用场景'}
      ],
      painPoints:[
        {problem:'系统孤岛严重，跨部门数据共享难',scene:'跨部门数据共享与协同',impact:'🔴 高'},
        {problem:'信创替代时间紧、任务重',scene:'信创适配与迁移',impact:'🔴 高'},
        {problem:'基层数字化能力薄弱',scene:'政务服务一网通办',impact:'🟡 中'},
        {problem:'数据安全合规压力增大',scene:'安全合规与数据保护',impact:'🟡 中'}
      ],
      potentialNeeds:[
        {need:'统一数字政府平台建设',scene:'跨部门数据共享与协同',priority:1,reason:'解决系统孤岛的根本之策'},
        {need:'信创全栈适配方案',scene:'信创适配与迁移',priority:1,reason:'政策刚性要求'},
        {need:'政务大模型应用',scene:'政务大模型辅助决策',priority:2,reason:'提升智能化服务水平'},
        {need:'一网统管平台',scene:'一网统管社会治理',priority:2,reason:'社会治理现代化要求'},
        {need:'数据安全合规平台',scene:'安全合规与数据保护',priority:3,reason:'数据安全法要求'}
      ],
      keyPositions:[
        {position:'副局长/副主任',kpi:'分管领域政务服务效能与安全合规'},
        {position:'信息中心主任/CIO',kpi:'系统稳定性、信创替代率、数据共享率'},
        {position:'业务处室负责人',kpi:'业务办理时效与群众满意度'},
        {position:'大数据处处长',kpi:'数据治理与共享开放'},
        {position:'安全处负责人',kpi:'安全合规达标率'}
      ],
      visitReason:'数字政府建设最新政策要求与一网通办深化推进',
      visitTopic:'数字政府建设与一网通办的深化路径',
      visitQuestions:{
        change:['最近国家和省市对数字政府建设有哪些新政策和新要求？','一网通办推进中，哪些环节群众反映问题最多？'],
        business:['目前政务服务事项网办率达到了多少？哪些事项还必须线下办理？','跨部门数据共享目前卡在哪些环节？'],
        scene:['一网统管目前覆盖了哪些社会治理领域？效果如何？','信创替代推进到什么阶段了？最大的挑战是什么？'],
        needs:['对于政务大模型应用，您希望优先在哪些场景落地？','在数据安全合规方面，有哪些急需解决的问题？']
      }
    },

    'default':{
      mission:'推动数字化转型，提升运营效率与服务质量',
      coreBiz:'核心业务运营、管理支撑、客户服务',
      clients:'服务对象涵盖企业客户与个人用户',
      bizModel:'以核心业务运营为主，通过数字化手段提升效率、降低成本',
      kpi:'运营效率、成本控制、客户满意度、安全合规达标率',
      devPlan:'2026-2028年推进数字化转型、信创适配、智能化升级',
      scale:'中型以上规模组织',
      capacity:'日均业务处理能力覆盖全部核心场景',
      staff:'数百人规模，含管理、业务、技术人员',
      policy:'数字化转型政策、信创替代要求、数据安全法规、行业监管政策',
      techTrend:'云原生、AI大模型、数据中台、信创技术栈、低代码平台',
      userDemand:'服务对象对效率提升和体验优化诉求强烈',
      marketSupply:'数字化服务商竞争充分，信创生态逐步成熟',
      competition:'多家IT厂商竞争，需通过合规采购流程',
      regulator:'行业主管部门、网信办',
      upstream:'云服务商、硬件供应商、软件厂商',
      downstream:'服务对象、合作伙伴',
      partners:'系统集成商、咨询机构、技术生态伙伴',
      initiatives:'推进数字化转型、信创适配、数据治理、AI应用',
      bizGoal:'数字化覆盖率80%+，信创替代率达标，运营效率提升30%',
      scenes:['核心业务运营管理','数据分析与决策支持','客户服务与体验管理','内部协同与办公','安全合规管理','信创适配与迁移'],
      existingProjects:'OA系统、业务管理系统、部分数据分析平台',
      existingVendors:'多家IT厂商已合作',
      roles:{
        'default':{duty:'负责相关业务领域的管理与决策',kpi:'业务运营效率与数字化转型成果',pain:'面临业务转型压力',goal:'提升业务效率，完成年度目标',scene:'核心业务运营管理'}
      },
      bizGoals:[
        {goal:'推进数字化转型',metric:'数字化覆盖率80%+'},
        {goal:'完成信创适配',metric:'信创替代率达标'},
        {goal:'提升运营效率',metric:'效率提升30%'},
        {goal:'建设数据治理体系',metric:'数据标准覆盖率90%+'}
      ],
      painPoints:[
        {problem:'系统孤岛，数据不互通',scene:'数据分析与决策支持',impact:'🔴 高'},
        {problem:'信创适配迁移挑战',scene:'信创适配与迁移',impact:'🟡 中'},
        {problem:'运营效率有待提升',scene:'核心业务运营管理',impact:'🟡 中'},
        {problem:'安全合规压力',scene:'安全合规管理',impact:'🟡 中'}
      ],
      potentialNeeds:[
        {need:'统一数字化平台建设',scene:'核心业务运营管理',priority:1,reason:'解决系统孤岛问题'},
        {need:'信创适配方案',scene:'信创适配与迁移',priority:2,reason:'政策合规要求'},
        {need:'数据分析与决策平台',scene:'数据分析与决策支持',priority:2,reason:'数据驱动决策需求'},
        {need:'AI场景应用',scene:'核心业务运营管理',priority:3,reason:'降本增效'},
        {need:'安全合规平台',scene:'安全合规管理',priority:3,reason:'法规要求'}
      ],
      keyPositions:[
        {position:'分管领导',kpi:'分管领域经营业绩'},
        {position:'CIO/信息部负责人',kpi:'数字化覆盖率与系统稳定性'},
        {position:'业务部门负责人',kpi:'业务处理效率'},
        {position:'采购负责人',kpi:'采购合规与成本控制'}
      ],
      visitReason:'行业数字化转型趋势与信创替代政策要求',
      visitTopic:'数字化转型与信创适配的整体规划',
      visitQuestions:{
        change:['最近行业有哪些新的政策变化对您的工作有较大影响？','数字化转型方面有哪些新的重点部署？'],
        business:['目前核心业务系统运行情况如何？哪些环节效率最需要提升？','数据治理方面目前做到什么程度了？'],
        scene:['日常业务处理中，哪些环节最依赖人工操作？','信创适配推进到什么阶段了？'],
        needs:['对于数字化转型，您最希望优先解决什么问题？','在AI应用方面，您有什么考虑？']
      }
    },

    '金融':{
      mission:'服务实体经济，防范金融风险，推动金融科技创新',
      coreBiz:'存贷款业务、支付结算、财富管理、风险管控、金融科技',
      clients:'个人客户、企业客户、同业机构',
      bizModel:'以存贷利差、中间业务收入、投资收益为核心盈利模式',
      kpi:'资产质量、资本充足率、不良率、ROE、客户增长率、合规达标率',
      devPlan:'2026-2028年推进金融科技深化、信创替代、数据中台、智能风控',
      scale:'总资产千亿至万亿级',
      capacity:'日均交易量百万至千万笔',
      staff:'数千至数万人，含管理人员、业务人员、技术人员',
      policy:'金融信创替代、数据安全法、金融科技发展规划、监管科技要求',
      techTrend:'金融大模型、分布式核心系统、信创数据库、隐私计算、实时风控',
      userDemand:'客户对金融服务便捷性、安全性、个性化诉求不断提升',
      marketSupply:'金融科技服务商竞争激烈，信创金融生态快速成熟',
      competition:'头部金融科技厂商、信创厂商、互联网金融机构多方竞争',
      regulator:'银保监会、证监会、人民银行、网信办',
      upstream:'信创软硬件厂商、云服务商、数据提供商',
      downstream:'个人客户、企业客户、商户',
      partners:'金融科技公司、系统集成商、信创生态伙伴',
      initiatives:'推进核心系统信创替代、智能风控升级、数据中台建设、AI客服与投顾',
      bizGoal:'信创替代率2027年达到100%，风控模型准确率95%+，客户满意度90%+',
      scenes:['核心交易系统','智能风控','客户服务与营销','监管报送','数据治理与分析','信创适配与迁移'],
      existingProjects:'核心业务系统、信贷管理系统、风控系统、客服系统',
      existingVendors:'友商E（数据库）、友商A（核心系统）、友商F（风控）等',
      roles:{
        'default':{duty:'负责相关业务领域的管理与决策',kpi:'业务运营效率与风控合规',pain:'信创替代与业务连续性平衡',goal:'稳妥完成信创替代',scene:'核心交易系统'}
      },
      bizGoals:[
        {goal:'完成核心系统信创替代',metric:'信创替代率100%'},
        {goal:'建设智能风控体系',metric:'风控准确率95%+'},
        {goal:'提升客户体验',metric:'客户满意度90%+'},
        {goal:'数据中台建设',metric:'数据治理覆盖率90%+'}
      ],
      painPoints:[
        {problem:'核心系统信创替代风险高',scene:'信创适配与迁移',impact:'🔴 高'},
        {problem:'风控数据孤岛',scene:'智能风控',impact:'🔴 高'},
        {problem:'监管报送效率低',scene:'监管报送',impact:'🟡 中'}
      ],
      potentialNeeds:[
        {need:'信创核心系统方案',scene:'信创适配与迁移',priority:1,reason:'政策刚性要求'},
        {need:'智能风控平台',scene:'智能风控',priority:1,reason:'风险管控核心需求'},
        {need:'数据中台',scene:'数据治理与分析',priority:2,reason:'数据驱动决策'},
        {need:'AI客服与投顾',scene:'客户服务与营销',priority:2,reason:'降本增效'},
        {need:'监管科技平台',scene:'监管报送',priority:3,reason:'合规效率提升'}
      ],
      keyPositions:[
        {position:'副行长/副总裁',kpi:'分管领域经营业绩与风控'},
        {position:'CIO/科技部总经理',kpi:'系统稳定性与信创替代率'},
        {position:'风控部负责人',kpi:'不良率与风控合规'},
        {position:'业务部门负责人',kpi:'业务增长率'}
      ],
      visitReason:'金融信创替代政策要求与金融科技发展规划',
      visitTopic:'信创替代与智能风控的整体方案',
      visitQuestions:{
        change:['最近监管对信创替代有哪些新要求？','金融科技方面有哪些新的监管导向？'],
        business:['核心系统信创替代推进到什么阶段了？','风控系统目前的数据覆盖情况如何？'],
        scene:['日常风控中，哪些环节最依赖人工判断？','客户服务方面，哪些场景最适合AI落地？'],
        needs:['对于智能风控，您最希望提升哪些能力？','数据中台建设方面有什么考虑？']
      }
    },

    '制造':{
      mission:'推动智能制造升级，提升产品质量与生产效率',
      coreBiz:'产品研发设计、生产制造、供应链管理、质量控制、销售服务',
      clients:'下游企业客户、终端消费者',
      bizModel:'以产品制造和销售为核心，通过规模化生产与精益管理创造利润',
      kpi:'产能利用率、产品良率、订单交付率、库存周转率、生产成本、研发投入强度',
      devPlan:'2026-2028年推进智能制造、工业互联网、数字化转型、绿色低碳',
      scale:'年产值数亿至数百亿',
      capacity:'多条产线，年产能可达数百万件',
      staff:'数千人，含管理人员、研发人员、生产人员、质量人员',
      policy:'智能制造发展规划、工业互联网创新发展计划、双碳目标、信创替代',
      techTrend:'工业大模型、数字孪生、工业互联网平台、边缘计算、5G+工业',
      userDemand:'下游客户对产品质量、交付时效、定制化需求不断提升',
      marketSupply:'工业数字化服务商增多，智能制造解决方案日趋成熟',
      competition:'工业软件厂商、自动化厂商、工业互联网平台商竞争',
      regulator:'工信部、发改委、市场监管总局',
      upstream:'原材料供应商、设备供应商、工业软件厂商',
      downstream:'下游企业客户、经销商、终端消费者',
      partners:'工业互联网平台商、自动化集成商、科研院所',
      initiatives:'推进智能工厂建设、工业互联网平台部署、数字孪生应用、绿色制造',
      bizGoal:'智能工厂覆盖率达到70%+，生产效率提升25%+，产品良率99%+',
      scenes:['生产计划与调度','质量控制与追溯','设备管理与预测性维护','供应链协同','研发设计与工艺管理','能源管理与双碳'],
      existingProjects:'ERP系统、MES系统、部分自动化产线',
      existingVendors:'友商A（ERP）、友商C（MES）、友商G（自动化）等',
      roles:{
        'default':{duty:'负责相关业务领域的管理与决策',kpi:'生产效率与质量指标',pain:'数字化转型投入产出比不确定',goal:'通过数字化提升生产效率',scene:'生产计划与调度'}
      },
      bizGoals:[
        {goal:'建设智能工厂',metric:'智能工厂覆盖率70%+'},
        {goal:'提升生产效率',metric:'效率提升25%+'},
        {goal:'提高产品质量',metric:'良率99%+'},
        {goal:'降低生产成本',metric:'成本降低15%+'}
      ],
      painPoints:[
        {problem:'生产数据孤岛，无法实时监控',scene:'生产计划与调度',impact:'🔴 高'},
        {problem:'质量追溯体系不完善',scene:'质量控制与追溯',impact:'🔴 高'},
        {problem:'设备故障预警能力不足',scene:'设备管理与预测性维护',impact:'🟡 中'}
      ],
      potentialNeeds:[
        {need:'工业互联网平台',scene:'生产计划与调度',priority:1,reason:'打通生产数据链路'},
        {need:'质量追溯系统',scene:'质量控制与追溯',priority:1,reason:'质量管控核心需求'},
        {need:'设备预测性维护',scene:'设备管理与预测性维护',priority:2,reason:'降低非计划停机'},
        {need:'数字孪生工厂',scene:'研发设计与工艺管理',priority:2,reason:'优化生产仿真'},
        {need:'供应链协同平台',scene:'供应链协同',priority:3,reason:'提升供应链韧性'}
      ],
      keyPositions:[
        {position:'副总经理/VP',kpi:'生产效率与成本控制'},
        {position:'CIO/信息部经理',kpi:'数字化覆盖率与系统稳定性'},
        {position:'生产部经理',kpi:'产能利用率与交付率'},
        {position:'质量部经理',kpi:'产品良率与质量合规'}
      ],
      visitReason:'智能制造政策推动与数字化转型趋势',
      visitTopic:'智能制造与工业互联网的整体方案',
      visitQuestions:{
        change:['最近对智能制造有哪些新的政策要求？','双碳目标对生产有什么影响？'],
        business:['目前工厂的自动化程度如何？哪些环节最需要数字化？','质量追溯目前做到什么程度？'],
        scene:['生产计划排程目前用什么系统？效率如何？','设备管理方面，预测性维护做到什么程度了？'],
        needs:['对于工业互联网平台，您希望优先在哪些场景落地？','数字孪生方面有什么考虑？']
      }
    }
  },

  // ===== 客户洞察专家 =====
  // 遵循内置提示词四部分结构：客户洞察分析→需求梳理与商机判断→分析锁定关键人→生成拜访沟通准备清单
  customerInsight(customerId){
    const c=Store.customer(customerId);
    if(!c) return '未找到该客户。';
    const contacts=Store.contactsByCustomer(customerId);
    const opps=Store.oppsByCustomer(customerId);
    const fus=Store.followupsByCustomer(customerId);
    const keyContacts=contacts.filter(x=>x.isKey);
    const openOpps=opps.filter(o=>o.status==='open');

    // 行业知识库
    const indInfo=Experts.industryKB[c.industry]||Experts.industryKB['default'];
    const isGov=/政务|政府|管委会|委办|局/.test(c.industry)||c.industry.includes('政务');

    let html=`客 **客户场景洞察报告**\n\n`;
    html+=`> 报告日期：${Utils.fmtDate(new Date())} ｜ 分析对象：${c.name} ｜ 客户级别：${c.level}级 ｜ 行业：${c.industry}\n\n`;
    html+=`---\n\n`;

    // ===================== 第一部分：客户洞察分析 =====================
    html+=`## 第一部分：客户洞察分析\n\n`;
    html+=`> 以客户为主体、从客户视角、用客户语言，从企业背景、外部环境、内部业务、关键人四个角度开展洞察。\n\n`;

    // 1.1 企业背景洞察
    html+=`### 一、企业背景洞察\n\n`;
    html+=`**1、基本背景**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 使命愿景 | ${indInfo.mission} |\n`;
    html+=`| 核心业务 | ${indInfo.coreBiz} |\n`;
    html+=`| 服务客群 | ${indInfo.clients} |\n\n`;

    html+=`**2、业务特征**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 经营模式 | ${indInfo.bizModel} |\n`;
    html+=`| 关键指标 | ${indInfo.kpi} |\n`;
    html+=`| 发展规划 | ${indInfo.devPlan} |\n\n`;

    html+=`**3、业务规模**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 资产/管辖规模 | ${indInfo.scale} |\n`;
    html+=`| 产能/服务能力 | ${indInfo.capacity} |\n`;
    html+=`| 组织人员规模 | ${indInfo.staff} |\n`;
    html+=`| 区域 | ${c.region||'—'} |\n\n`;

    html+=`> 背景关联逻辑：核心业务（干什么）→ 经营模式（怎么干）→ 关键指标（如何评价）→ 发展规划（想成为什么）→ 业务规模（现在什么样）\n\n`;

    // 1.2 外部环境洞察
    html+=`### 二、外部环境洞察\n\n`;
    html+=`**1、行业趋势**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 政策法规 | ${indInfo.policy} |\n`;
    html+=`| 技术趋势 | ${indInfo.techTrend} |\n`;
    html+=`| 用户需求 | ${indInfo.userDemand} |\n`;
    html+=`| 市场供需 | ${indInfo.marketSupply} |\n`;
    html+=`| 市场竞争 | ${indInfo.competition} |\n\n`;

    html+=`**2、产业环境**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 监管部门 | ${indInfo.regulator} |\n`;
    html+=`| 上游供应商 | ${indInfo.upstream} |\n`;
    html+=`| 下游渠道 | ${indInfo.downstream} |\n`;
    html+=`| 重要合作伙伴 | ${indInfo.partners} |\n\n`;

    // 1.3 内部业务洞察
    html+=`### 三、内部业务洞察\n\n`;
    html+=`**1、经营目标**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 重要举措 | ${indInfo.initiatives} |\n`;
    html+=`| 业务目标 | ${indInfo.bizGoal} |\n\n`;

    html+=`**2、关键场景（与数字化/信息化相关的核心业务场景）**\n\n`;
    indInfo.scenes.forEach((s,i)=>{ html+=`${i+1}. ${s}\n`; });
    html+=`\n`;

    html+=`**3、服务支撑**\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    const myOpps=opps.filter(o=>o.status==='won');
    html+=`| 在用在建项目 | ${indInfo.existingProjects} |\n`;
    html+=`| 我方合作内容 | ${myOpps.length?'已签约'+myOpps.length+'个项目（'+myOpps.map(o=>o.name).join('、')+'）':'暂无合作记录，为重点拓展对象'} |\n`;
    html+=`| 现有合作商 | ${indInfo.existingVendors} |\n\n`;

    // 1.4 关键人洞察
    html+=`### 四、关键人洞察\n\n`;
    if(contacts.length){
      html+=`**1、组织架构与关键人员岗位职责**\n\n`;
      html+=`| 姓名 | 职位 | 层级 | 角色 | 态度 | 关键人 |\n|------|------|------|------|------|--------|\n`;
      contacts.forEach(ct=>{
        html+=`| ${ct.name} | ${ct.title} | ${DICT.label('contactRank',ct.rank)} | ${ct.role||'—'} | ${ct.attitude||'未知'} | ${ct.isKey?'✓':'—'} |\n`;
      });
      html+=`\n`;

      html+=`**2、关键人处境与诉求**\n\n`;
      keyContacts.forEach(kc=>{
        const roleInfo=indInfo.roles[kc.role]||indInfo.roles['default']||{pain:'业绩增长压力',goal:'完成年度KPI'};
        html+=`**${kc.name}（${kc.title}）**\n`;
        html+=`- 处境挑战：${roleInfo.pain}\n`;
        html+=`- 期望结果：${roleInfo.goal}\n`;
        html+=`- 关联场景：${roleInfo.scene||indInfo.scenes[0]||'核心业务运营'}\n`;
        html+=`- 合作关系：${kc.attitude||'中立'}，${kc.attitude==='支持'?'已有合作基础，可深化合作':'需加强关系建设与信任建立'}\n\n`;
      });

      html+=`**3、关键人关联业务场景**\n\n`;
      contacts.forEach(ct=>{
        const roleInfo=indInfo.roles[ct.role]||{scene:indInfo.scenes[0]||'核心业务运营'};
        html+=`- ${ct.name}（${ct.title}）→ ${roleInfo.scene||indInfo.scenes[0]||'核心业务运营'}\n`;
      });
      html+=`\n`;

      const againstContacts=contacts.filter(x=>x.attitude==='反对');
      if(againstContacts.length){
        html+=`**4、合作关系现状与限制因素**\n\n`;
        html+=`> ⚠️ 存在${againstContacts.length}位反对者：${againstContacts.map(a=>a.name+'（'+a.title+'）').join('、')}，需重点关注其顾虑并制定转化策略。\n\n`;
      }else{
        html+=`**4、合作关系现状**\n\n`;
        html+=`> 当前无明确反对者，${keyContacts.length}位关键人中${contacts.filter(x=>x.attitude==='支持').length}位持支持态度，合作基础良好。\n\n`;
      }
    }else{
      html+=`> ⚠️ 尚未录入联系人信息，关键人洞察为空白。建议尽快通过公开渠道或已有关系网络建立联系人档案。\n\n`;
    }

    // ===================== 第二部分：需求梳理与商机判断 =====================
    html+=`---\n\n`;
    html+=`## 第二部分：需求梳理与商机判断\n\n`;

    html+=`### 一、企业主要业务目标\n\n`;
    html+=`| 序号 | 业务目标 | 量化指标 |\n|------|----------|----------|\n`;
    indInfo.bizGoals.forEach((g,i)=>{ html+=`| ${i+1} | ${g.goal} | ${g.metric} |\n`; });
    html+=`\n`;

    html+=`### 二、主要障碍问题与典型场景\n\n`;
    html+=`| 序号 | 障碍问题 | 关联场景 | 影响程度 |\n|------|----------|----------|----------|\n`;
    indInfo.painPoints.forEach((p,i)=>{ html+=`| ${i+1} | ${p.problem} | ${p.scene} | ${p.impact} |\n`; });
    html+=`\n`;

    html+=`### 三、场景潜在目标与潜在需求\n\n`;
    html+=`| 序号 | 潜在需求 | 关联场景 | 关联关键人 |\n|------|----------|----------|------------|\n`;
    indInfo.potentialNeeds.forEach((n,i)=>{
      const kc=keyContacts[i%Math.max(keyContacts.length,1)];
      html+=`| ${i+1} | ${n.need} | ${n.scene} | ${kc?kc.name:'待识别'} |\n`;
    });
    html+=`\n`;

    html+=`### 四、潜在需求优先级排序\n\n`;
    html+=`| 优先级 | 需求 | 理由 |\n|--------|------|------|\n`;
    const sortedNeeds=[...indInfo.potentialNeeds].sort((a,b)=>(a.priority||3)-(b.priority||3));
    sortedNeeds.forEach(n=>{
      const p=n.priority===1?'🔴 高':n.priority===2?'🟡 中':'🟢 低';
      html+=`| ${p} | ${n.need} | ${n.reason} |\n`;
    });
    html+=`\n`;

    // 当前商机匹配
    if(openOpps.length){
      html+=`### 五、商机匹配与判断\n\n`;
      html+=`| 商机 | 阶段 | 金额 | 竞争 | 赢单率 | 需求匹配 |\n|------|------|------|------|--------|----------|\n`;
      openOpps.forEach(o=>{
        html+=`| ${o.name} | ${DICT.label('opportunityStage',o.stage)} | ${Utils.fmtMoney(o.amount)} | ${DICT.label('competition',o.competition)} | ${o.winProbability}% | 高度匹配 |\n`;
      });
      html+=`\n`;
    }

    // ===================== 第三部分：分析锁定关键人 =====================
    html+=`---\n\n`;
    html+=`## 第三部分：分析锁定关键人\n\n`;

    html+=`### 一、关键岗位及主要绩效目标\n\n`;
    html+=`| 序号 | 关键岗位 | 主要绩效目标 |\n|------|----------|--------------|\n`;
    indInfo.keyPositions.forEach((p,i)=>{ html+=`| ${i+1} | ${p.position} | ${p.kpi} |\n`; });
    html+=`\n`;

    html+=`### 二、匹配关键人员（3-5人）\n\n`;
    if(keyContacts.length){
      html+=`| 排序 | 姓名 | 职位 | 角色 | 态度 | 匹配岗位 | 优先级 |\n|------|------|------|------|------|----------|--------|\n`;
      const matched=keyContacts.slice(0,5);
      matched.forEach((kc,i)=>{
        const roleInfo=indInfo.roles[kc.role]||{};
        const matchPos=indInfo.keyPositions.find(p=>p.position.includes(kc.title)||kc.title.includes(p.position.split('/')[0]))||indInfo.keyPositions[i%indInfo.keyPositions.length];
        const pri=kc.attitude==='支持'?'🔴 高':kc.attitude==='中立'?'🟡 中':'🟢 低';
        html+=`| ${i+1} | ${kc.name} | ${kc.title} | ${kc.role||'—'} | ${kc.attitude||'未知'} | ${matchPos?matchPos.position:'—'} | ${pri} |\n`;
      });
      html+=`\n`;

      html+=`### 三、关键人排序与分析\n\n`;
      matched.forEach((kc,i)=>{
        const roleInfo=indInfo.roles[kc.role]||indInfo.roles['default']||{};
        html+=`**第${i+1}优先：${kc.name}（${kc.title}）**\n`;
        html+=`- 岗位职责：${roleInfo.duty||'负责相关业务领域的管理与决策'}\n`;
        html+=`- 绩效关联：${roleInfo.kpi||'业务运营效率与数字化转型成果'}\n`;
        html+=`- 处境与诉求：${roleInfo.pain||'面临业务转型压力'}\n`;
        html+=`- 期望结果：${roleInfo.goal||'提升业务效率，完成年度目标'}\n`;
        html+=`- 合作策略：${kc.attitude==='支持'?'巩固盟友关系，提供内部汇报弹药，推动决策层拍板':'了解其关注点与顾虑，通过价值呈现和案例分享建立信任，逐步转化为支持者'}\n\n`;
      });
    }else{
      html+=`> ⚠️ 尚未录入关键联系人。建议根据上述关键岗位，通过以下渠道锁定目标关键人：\n`;
      html+=`> - 客户官网组织架构介绍\n>`;
      html+=`> - 行业会议、论坛等公开活动\n>`;
      html+=`> - 已有联系人引荐\n>`;
      html+=`> - 通过赵德海（CIO）等已建立关系者向上拓展\n\n`;
    }

    // ===================== 第四部分：生成拜访沟通准备清单 =====================
    html+=`---\n\n`;
    html+=`## 第四部分：生成拜访沟通准备清单\n\n`;

    const targetKC=keyContacts[0]||contacts[0];
    const targetName=targetKC?targetKC.name:'待锁定关键人';
    const targetTitle=targetKC?targetKC.title:'待锁定职位';
    const roleInfo=targetKC?(indInfo.roles[targetKC.role]||indInfo.roles['default']||{}):{};

    html+=`### 一、拜访目标客户角色对象\n\n`;
    html+=`| 维度 | 内容 |\n|------|------|\n`;
    html+=`| 拜访对象 | ${targetName}（${targetTitle}） |\n`;
    html+=`| 角色定位 | ${targetKC?targetKC.role||'关键决策人':'待锁定'} |\n`;
    html+=`| 拜访理由 | ${indInfo.visitReason} |\n\n`;

    html+=`### 二、拜访目的与目标\n\n`;
    html+=`| 序号 | 目的 | 预期目标 |\n|------|------|----------|\n`;
    html+=`| 1 | 了解客户当前业务现状与痛点 | 获取客户在${indInfo.scenes[0]||'核心业务'}方面的现状信息 |\n`;
    html+=`| 2 | 探索客户数字化转型需求与计划 | 了解客户${indInfo.devPlan.substring(0,20)}...的具体举措 |\n`;
    html+=`| 3 | 建立专业信任关系 | 让客户认可我方行业理解与专业能力 |\n`;
    html+=`| 4 | 寻找合作切入点 | 明确下一步沟通方向与可能的合作场景 |\n\n`;

    html+=`### 三、拜访提问清单\n\n`;
    html+=`**问变化（最新政策或重点）**\n`;
    indInfo.visitQuestions.change.forEach((q,i)=>{ html+=`${i+1}. ${q}\n`; });
    html+=`\n**问业务（有哪些核心业务）**\n`;
    indInfo.visitQuestions.business.forEach((q,i)=>{ html+=`${i+1}. ${q}\n`; });
    html+=`\n**问场景（涉及哪些场景）**\n`;
    indInfo.visitQuestions.scene.forEach((q,i)=>{ html+=`${i+1}. ${q}\n`; });
    html+=`\n**问需求（如何能改进）**\n`;
    indInfo.visitQuestions.needs.forEach((q,i)=>{ html+=`${i+1}. ${q}\n`; });
    html+=`\n`;

    html+=`### 四、约见理由\n\n`;
    html+=`> ${targetKC?targetTitle.slice(0,2):'领导'}您好，我们关注到${indInfo.visitReason}，希望就${indInfo.visitTopic}方面与您做一次交流。想先了解目前${indInfo.scenes[0]||'相关业务'}的基本情况，涉及哪些范围、重点是哪些，听听您对如何更好开展工作有什么考虑和安排，结合您的想法也可以共同讨论可以加强的地方，以便协助您更好开展相关工作，也提高我们对您业务的了解、后续能更好支撑。时间想定在本周三上午十点到十一点半，您可以吗？\n\n`;

    html+=`### 五、开场自我介绍参考\n\n`;
    html+=`1. **我是谁**：我是XX科技的大客户经理XXX，主要负责${c.industry}行业数字化解决方案\n`;
    html+=`2. **我的经验**：我们在${c.industry}领域服务过多家类似企业，熟悉${indInfo.coreBiz.substring(0,15)}...的业务场景\n`;
    html+=`3. **释放陌生感**：我们虽未正式合作，但我一直关注贵单位在${c.industry}领域的发展\n`;
    html+=`4. **怎么知道您**：通过行业交流了解到您在${indInfo.scenes[0]||'相关业务'}方面的专业经验\n`;
    html+=`5. **同行案例**：我们有个同行业客户XXX，在类似场景下通过数字化手段取得了显著成效\n`;
    html+=`6. **推荐人**：${contacts.length>0?'通过'+contacts[0].name+'了解到您的关注点':'（如有推荐人可在此说明）'}\n\n`;

    html+=`### 六、有效倾听提醒\n\n`;
    html+=`- 用空杯心态，放下固有想法，真正了解对方\n`;
    html+=`- 合理回应，以眼神、肢体语言激发客户思考\n`;
    html+=`- 同理心，对客户情绪化表达进行共情回答\n`;
    html+=`- 黄金静默，客户说完后保持3-4秒停顿，让客户继续发散表达\n\n`;

    // ===================== 你再想想 =====================
    html+=`---\n\n`;
    html+=`## 你再想想\n\n`;
    html+=`### 完整性检查\n\n`;
    html+=`| 检查项 | 状态 |\n|--------|------|\n`;
    html+=`| 企业背景信息是否完整 | ${c.remark?'✅ 有备注信息':'⚠️ 建议补充企业年报、官网信息'} |\n`;
    html+=`| 关键人信息是否充分 | ${keyContacts.length>=2?'✅ 已有'+keyContacts.length+'位关键人':'⚠️ 关键人不足，建议补充决策层联系人'} |\n`;
    html+=`| 外部环境是否准确 | ⚠️ 建议结合最新政策文件和行业报告校准 |\n`;
    html+=`| 内部业务场景是否覆盖 | ⚠️ 建议通过拜访进一步验证关键场景 |\n\n`;

    html+=`### 建议补充信息\n\n`;
    html+=`1. ${c.name}最新的年度工作报告或领导讲话中，有哪些新的战略举措？\n`;
    html+=`2. 除了已录入的${contacts.length}位联系人，还有哪些决策层关键人需要锁定？\n`;
    html+=`3. 当前${openOpps.length}个商机之外，客户还有哪些数字化建设预算和计划？\n\n`;

    html+=`### 下一步分析方向\n\n`;
    html+=`- **行业评估**：对${c.industry}行业进行S/A/B/C评级，判断投入优先级\n`;
    html+=`- 🎯 **赢单策略**：${openOpps.length>0?'对当前商机进行赢面诊断与竞争策略制定':'基于洞察结果挖掘新商机并制定开发策略'}\n`;
    html+=`- 💡 **解决方案**：针对潜在需求设计分层解决方案架构\n`;
    html+=`- 🤝 **客户拜访**：制定详细的拜访策略与话术准备\n\n`;

    html+=`### 继续思考\n\n`;
    html+=`> 基于以上客户洞察，您是否需要我继续为您分析：**针对${targetName}的拜访策略**，或者**${openOpps.length>0?'当前商机的赢单策略':'潜在商机的开发计划'}**？\n\n`;

    html+=`> **📋 洞察总结：${c.name}是${c.industry}行业的${c.level}级客户，${indInfo.mission.substring(0,20)}...。当前${keyContacts.length}位关键人已锁定，${openOpps.length}个商机在推进。建议优先推进${targetName}的拜访，以${indInfo.visitTopic}为切入点建立深度合作。**`;

    return html;
  },
};
