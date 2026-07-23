/* ========== 示例数据 Seed ========== */
/* 政企TOB销售场景示例数据，首次加载注入 */
const Seed = {
  build(){
    const now = Utils.now();
    const today = Utils.today();
    const daysAgo = (n)=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
    const daysAfter = (n)=>{ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString(); };

    const db = {
      enterprises: [], orgUnits: [], users: [],
      customers:[], contacts:[], opportunities:[], followups:[], schedules:[],
      settings:{ orgName:'星瀚增长', fiscalYear:2026, quarterTarget: 8000000, owner:'林经理', dict:{}, aiModels:{ enabled:true, defaultId:'deepseek', providers:[ { id:'deepseek', name:'DeepSeek V3', provider:'deepseek', apiKey:'', baseUrl:'https://api.deepseek.com/v1', model:'deepseek-chat', enabled:true, isDefault:true }, { id:'qwen', name:'通义千问 Qwen-Max', provider:'qwen', apiKey:'', baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'qwen-max', enabled:false, isDefault:false }, { id:'openai', name:'OpenAI GPT-4o', provider:'openai', apiKey:'', baseUrl:'https://api.openai.com/v1', model:'gpt-4o', enabled:false, isDefault:false } ] }, subscription:{ plan:'professional', planName:'专业版', startDate:'2026-07-01', endDate:'2027-06-30', autoRenew:true, status:'active', tokensTotal:1000000, tokensUsed:125430, prepaidAmount:5000, consumedAmount:627.15, pricePerToken:0.005, billingRecords:[ { date:'2026-07-15', type:'recharge', amount:3000, tokensAdded:600000, channel:'wechat', remark:'微信支付充值' }, { date:'2026-07-01', type:'recharge', amount:2000, tokensAdded:400000, channel:'alipay', remark:'支付宝充值' } ], consumptionRecords:[ { date:'2026-07-18', model:'deepseek-chat', tokens:4520, cost:22.60, source:'AI助手对话' }, { date:'2026-07-17', model:'deepseek-chat', tokens:12800, cost:64.00, source:'专家分析-行业评估' }, { date:'2026-07-15', model:'deepseek-chat', tokens:3150, cost:15.75, source:'专家分析-客户洞察' }, { date:'2026-07-14', model:'qwen-max', tokens:8900, cost:44.50, source:'AI助手对话' } ] } }
    };

    // ---------- 企业 ----------
    db.enterprises = [
      { id:'ent_001', name:'星瀚增长科技有限公司', shortName:'星瀚增长', industry:'科技互联网',
        contactName:'林经理', contactPhone:'138****0001', contactEmail:'admin@xinghan.com',
        address:'北京市海淀区中关村软件园二期8号楼', status:'active',
        license:'enterprise', maxUsers:50, expireDate:daysAfter(540).slice(0,10),
        remark:'平台主力企业，政企TOB销售CRM全面使用中。' },
      { id:'ent_002', name:'北辰数智科技有限公司', shortName:'北辰数智', industry:'科技互联网',
        contactName:'赵总', contactPhone:'139****0002', contactEmail:'admin@beichen.com',
        address:'上海市浦东新区张江高科技园区博云路2号', status:'active',
        license:'trial', maxUsers:5, expireDate:daysAfter(60).slice(0,10),
        remark:'试用企业，评估中。' },
    ];
    db.enterprises.forEach(e=>{ e.createdAt=daysAgo(200); e.updatedAt=daysAgo(5); });

    // ---------- 组织架构 ----------
    db.orgUnits = [
      // 星瀚增长
      { id:'org_001', enterpriseId:'ent_001', name:'销售中心', parentId:null, leaderId:'usr_001', sort:1, desc:'统筹政企客户销售' },
      { id:'org_002', enterpriseId:'ent_001', name:'政企销售一部', parentId:'org_001', leaderId:'usr_001', sort:1, desc:'负责政府机关/事业单位客户' },
      { id:'org_003', enterpriseId:'ent_001', name:'政企销售二部', parentId:'org_001', leaderId:'usr_003', sort:2, desc:'负责国企央企/行业客户' },
      { id:'org_004', enterpriseId:'ent_001', name:'解决方案部', parentId:'org_001', leaderId:'usr_004', sort:3, desc:'售前方案与技术支持' },
      { id:'org_005', enterpriseId:'ent_001', name:'交付中心', parentId:null, leaderId:null, sort:2, desc:'项目实施与运维交付' },
      { id:'org_006', enterpriseId:'ent_001', name:'实施部', parentId:'org_005', leaderId:null, sort:1, desc:'项目实施' },
      { id:'org_007', enterpriseId:'ent_001', name:'运维部', parentId:'org_005', leaderId:null, sort:2, desc:'运维服务' },
      // 北辰数智
      { id:'org_008', enterpriseId:'ent_002', name:'销售部', parentId:null, leaderId:'usr_005', sort:1, desc:'北辰数智销售部' },
    ];
    db.orgUnits.forEach(o=>{ o.createdAt=daysAgo(180); });

    // ---------- 用户 ----------
    db.users = [
      // 星瀚增长
      { id:'usr_001', enterpriseId:'ent_001', name:'林经理', account:'admin', password:'admin',
        phone:'138****0001', email:'xia@xinghan.com', role:'admin', orgUnitId:'org_002',
        title:'销售总监', status:'active', avatar:'夏', lastLoginAt:daysAgo(0) },
      { id:'usr_002', enterpriseId:'ent_001', name:'陈顾问', account:'sales1', password:'123456',
        phone:'138****0011', email:'li@xinghan.com', role:'sales', orgUnitId:'org_002',
        title:'销售专员', status:'active', avatar:'李', lastLoginAt:daysAgo(2) },
      { id:'usr_003', enterpriseId:'ent_001', name:'周总监', account:'sales2', password:'123456',
        phone:'138****0012', email:'wang@xinghan.com', role:'manager', orgUnitId:'org_003',
        title:'销售经理', status:'active', avatar:'王', lastLoginAt:daysAgo(3) },
      { id:'usr_004', enterpriseId:'ent_001', name:'许架构师', account:'solution1', password:'123456',
        phone:'138****0013', email:'zhao@xinghan.com', role:'sales', orgUnitId:'org_004',
        title:'解决方案架构师', status:'active', avatar:'赵', lastLoginAt:daysAgo(5) },
      // 北辰数智
      { id:'usr_005', enterpriseId:'ent_002', name:'赵总', account:'admin', password:'admin',
        phone:'139****0002', email:'liu@beichen.com', role:'admin', orgUnitId:'org_008',
        title:'总经理', status:'active', avatar:'刘', lastLoginAt:daysAgo(1) },
    ];
    db.users.forEach(u=>{ u.createdAt=daysAgo(180); u.updatedAt=daysAgo(1); });

    // ---------- 客户 ----------
    const C = [
      { id:'cus_001', name:'江南省政务服务中心', shortName:'省政务中心', industry:'政府机关', level:'S', source:'招标平台', status:'active',
        region:'江南省', address:'江南省省会城市政务大厦', owner:'林经理', protectDays:30, inPool:false,
        remark:'省级政务服务数字化重点单位，年度预算充足，信息化建设需求强。多次合作老客户。' },
      { id:'cus_002', name:'东海市卫生健康委员会', shortName:'东海市卫健委', industry:'政府机关', level:'A', source:'展会活动', status:'active',
        region:'东海市', address:'东海市行政中心', owner:'林经理', protectDays:30, inPool:false,
        remark:'区域卫生健康信息化主管部门，正在推进智慧医疗项目。' },
      { id:'cus_003', name:'华信国资控股集团', shortName:'华信集团', industry:'国企央企', level:'S', source:'客户转介绍', status:'active',
        region:'华北区', address:'华北市高新区华信大厦', owner:'林经理', protectDays:45, inPool:false,
        remark:'大型国资集团，下属多个子公司，信创改造需求明确，预算千万级。' },
      { id:'cus_004', name:'西川省教育厅', shortName:'省教育厅', industry:'教育', level:'A', source:'主动开发', status:'active',
        region:'西川省', address:'西川省教育大厦', owner:'林经理', protectDays:30, inPool:false,
        remark:'教育行业信息化，关注教育大数据与协同办公。' },
      { id:'cus_005', name:'明州轨道交通集团', shortName:'明州轨交', industry:'交通', level:'A', source:'招标平台', status:'active',
        region:'明州市', address:'明州市轨交大厦', owner:'林经理', protectDays:30, inPool:false,
        remark:'城市轨道交通运营企业，关注运维智能化与大屏可视化。' },
      { id:'cus_006', name:'中原能源集团', shortName:'中原能源', industry:'能源', level:'B', source:'合作伙伴', status:'idle',
        region:'中原市', address:'中原市能源大厦', owner:'林经理', protectDays:0, inPool:false,
        remark:'项目暂缓，待明年预算恢复后重启。' },
      { id:'cus_007', name:'南方某市大数据管理局', shortName:'市大数据局', industry:'政府机关', level:'A', source:'线上咨询', status:'active',
        region:'南方市', address:'南方市行政中心', owner:'', protectDays:0, inPool:true, poolReason:'公海领取后60天未推进',
        remark:'大数据局，数据中台与政务大屏需求，目前公海待领取。' },
      { id:'cus_008', name:'清源水务集团', shortName:'清源水务', industry:'国企央企', level:'B', source:'主动开发', status:'active',
        region:'清源市', address:'清源市水务大厦', owner:'林经理', protectDays:30, inPool:false,
        remark:'城市水务国企，关注智慧水务与数据中台。' },
      { id:'cus_009', name:'金鹏城投集团', shortName:'金鹏城投', industry:'国企央企', level:'C', source:'招标平台', status:'lost',
        region:'金鹏市', address:'金鹏市城投大厦', owner:'', protectDays:0, inPool:true, poolReason:'已流失客户回收公海',
        remark:'去年投标未中，可后续再跟进。' },
      { id:'cus_010', name:'北疆省公安厅', shortName:'省公安厅', industry:'政府机关', level:'S', source:'客户转介绍', status:'signed',
        region:'北疆省', address:'北疆省公安大厦', owner:'林经理', protectDays:60, inPool:false,
        remark:'已签约老客户，信创适配与运维服务持续合作。' },
    ];
    C.forEach(c=>{ c.enterpriseId='ent_001'; c.createdAt=daysAgo(120-Math.random()*60); c.updatedAt=daysAgo(Math.random()*20); });
    // 补充统一社会信用代码（前17位 + 自动计算校验码）
    const USCC_PRE = {
      cus_001:'12310000MA1FL6NCX', cus_002:'12310200MA1FL6ND8',
      cus_003:'91110108MA01HX6B2', cus_004:'12510100MA6C2K3N5',
      cus_005:'91330200MA2AJ8K3T', cus_006:'91410100MA3X7H2M5',
      cus_007:'12440300MA5D8K3P2', cus_008:'91370200MA3C7K2N8',
      cus_009:'91340100MA2T8K3N5', cus_010:'12150100MA0L2K3N5'
    };
    C.forEach(c=>{ if(USCC_PRE[c.id]) c.uscc = Utils.USCC.makeFull(USCC_PRE[c.id]); });
    db.customers = C;

    // ---------- 联系人 ----------
    const CT = [
      { id:'ct_001', customerId:'cus_001', name:'张明远', title:'信息化处处长', rank:'中层', role:'技术决策者',
        mobile:'138****6201', email:'zhangmy@zwfw.gov.cn', dept:'信息化处', isKey:true,
        attitude:'支持', remark:'技术把关人，认可我方方案，需重点维护。' },
      { id:'ct_002', customerId:'cus_001', name:'李建国', title:'副主任', rank:'决策层', role:'最终决策者',
        mobile:'139****8855', email:'lijg@zwfw.gov.cn', dept:'领导层', isKey:true,
        attitude:'中立', remark:'分管领导，关注性价比与落地效果，需用案例说服。' },
      { id:'ct_003', customerId:'cus_001', name:'王芳', title:'科长', rank:'执行层', role:'使用者',
        mobile:'137****3322', email:'wangf@zwfw.gov.cn', dept:'业务科', isKey:false,
        attitude:'支持', remark:'日常对接人，配合度高。' },
      { id:'ct_004', customerId:'cus_002', name:'陈志强', title:'信息中心主任', rank:'中层', role:'技术决策者',
        mobile:'135****7711', email:'chenzq@wsjkw.gov.cn', dept:'信息中心', isKey:true,
        attitude:'支持', remark:'技术负责人，对我方AI客服方案认可。' },
      { id:'ct_005', customerId:'cus_002', name:'刘玉芬', title:'副主任', rank:'高管', role:'业务决策者',
        mobile:'136****2200', email:'liuyf@wsjkw.gov.cn', dept:'领导层', isKey:true,
        attitude:'中立', remark:'关注政策合规与民生效果。' },
      { id:'ct_006', customerId:'cus_003', name:'赵德海', title:'CIO/信息部总经理', rank:'高管', role:'技术决策者',
        mobile:'138****9988', email:'zhaodh@huaxin.com', dept:'信息部', isKey:true,
        attitude:'支持', remark:'信创改造主导人，与我方多次沟通，倾向我方。' },
      { id:'ct_007', customerId:'cus_003', name:'孙伟', title:'副总裁', rank:'决策层', role:'最终决策者',
        mobile:'139****1100', email:'sunw@huaxin.com', dept:'集团领导', isKey:true,
        attitude:'中立', remark:'最终拍板人，关注投资回报与风险。' },
      { id:'ct_008', customerId:'cus_003', name:'周敏', title:'采购部经理', rank:'中层', role:'采购经办',
        mobile:'137****4456', email:'zhoumin@huaxin.com', dept:'采购部', isKey:false,
        attitude:'中立', remark:'采购流程对接人。' },
      { id:'ct_009', customerId:'cus_004', name:'吴学文', title:'信息处副处长', rank:'中层', role:'技术决策者',
        mobile:'135****6677', email:'wuxw@edu.gov.cn', dept:'信息处', isKey:true,
        attitude:'支持', remark:'教育信息化负责人，认可协同办公方案。' },
      { id:'ct_010', customerId:'cus_005', name:'郑海涛', title:'技术部副部长', rank:'中层', role:'技术决策者',
        mobile:'138****2233', email:'zhenght@metro.com', dept:'技术部', isKey:true,
        attitude:'中立', remark:'关注大屏可视化与运维，对友商方案也在评估。' },
      { id:'ct_011', customerId:'cus_008', name:'黄丽萍', title:'信息科科长', rank:'中层', role:'技术决策者',
        mobile:'136****8899', email:'huanglp@water.com', dept:'信息科', isKey:true,
        attitude:'支持', remark:'水务信息化对接人。' },
      { id:'ct_012', customerId:'cus_010', name:'马国栋', title:'科技信息化总队队长', rank:'中层', role:'业务决策者',
        mobile:'139****7700', email:'magd@gat.gov.cn', dept:'科信总队', isKey:true,
        attitude:'支持', remark:'已合作客户，关系良好，可拓展新需求。' },
    ];
    CT.forEach(c=>{ c.enterpriseId='ent_001'; c.createdAt=daysAgo(100); c.updatedAt=daysAgo(Math.random()*15); });
    db.contacts = CT;

    // ---------- 商机 ----------
    const O = [
      { id:'opp_001', customerId:'cus_001', name:'省政务中心智慧政务平台升级项目', product:'智慧政务平台',
        amount:5800000, budget:6000000, stage:3, status:'open', competition:'leading', winProbability:70,
        purchaseMode:'公开招标', applyDept:'信息化处', expectedSignDate:daysAgo(-40),
        contactIds:['ct_001','ct_002'], owner:'林经理', observers:['陈顾问'],
        decisionFlow:'立项→需求确认→方案评审→招标→中标→签约',
        competitors:['友商A(泛微系)','友商B(本地集成商)'],
        remark:'方案阶段已通过，进入商务谈判，招标在即，我方技术评分领先。', createdAt:daysAgo(75) },
      { id:'opp_002', customerId:'cus_002', name:'东海市卫健委智慧医疗AI客服项目', product:'AI智能客服',
        amount:2200000, budget:2500000, stage:2, status:'open', competition:'even', winProbability:45,
        purchaseMode:'竞争性谈判', applyDept:'信息中心', expectedSignDate:daysAgo(-60),
        contactIds:['ct_004','ct_005'], owner:'林经理', observers:[],
        decisionFlow:'需求调研→方案设计→POC验证→商务谈判→签约',
        competitors:['友商C(AI厂商)','友商D(医疗行业ISV)'],
        remark:'POC阶段，与友商C平手，需在行业理解上拉开差距。', createdAt:daysAgo(50) },
      { id:'opp_003', customerId:'cus_003', name:'华信集团信创适配整体方案项目', product:'信创适配方案',
        amount:12000000, budget:15000000, stage:3, status:'open', competition:'leading', winProbability:65,
        purchaseMode:'邀请招标', applyDept:'信息部', expectedSignDate:daysAgo(-25),
        contactIds:['ct_006','ct_007','ct_008'], owner:'林经理', observers:['周总监'],
        decisionFlow:'内部立项→技术评估→邀标→评标→商务→签约',
        competitors:['友商E(国产数据库厂商)'],
        remark:'千万级大单，技术评估领先，进入商务阶段，价格谈判是关键。', createdAt:daysAgo(95) },
      { id:'opp_004', customerId:'cus_004', name:'省教育厅协同办公与教育大数据平台', product:'协同办公系统',
        amount:3500000, budget:4000000, stage:1, status:'open', competition:'single', winProbability:55,
        purchaseMode:'公开招标', applyDept:'信息处', expectedSignDate:daysAgo(-90),
        contactIds:['ct_009'], owner:'林经理', observers:[],
        decisionFlow:'预算申请→需求确认→招标→签约',
        competitors:[],
        remark:'意向阶段，单一来源倾向，预算尚未正式批复，需推动立项。', createdAt:daysAgo(30) },
      { id:'opp_005', customerId:'cus_005', name:'明州轨交运维智能化与大屏可视化项目', product:'政务大屏可视化',
        amount:4800000, budget:5000000, stage:2, status:'delay', competition:'behind', winProbability:30,
        purchaseMode:'公开招标', applyDept:'技术部', expectedSignDate:daysAgo(-70),
        contactIds:['ct_010'], owner:'林经理', observers:[],
        decisionFlow:'需求调研→方案比选→招标→签约',
        competitors:['友商F(轨交行业龙头)','友商G(可视化厂商)'],
        remark:'方案比选阶段落后于友商F，客户预算延期，项目延缓。需寻找差异化突破口。', createdAt:daysAgo(60) },
      { id:'opp_006', customerId:'cus_010', name:'省公安厅信创运维服务续约项目', product:'运维服务',
        amount:1800000, budget:1800000, stage:4, status:'won', competition:'leading', winProbability:100,
        purchaseMode:'单一来源', applyDept:'科信总队', expectedSignDate:daysAgo(15),
        contactIds:['ct_012'], owner:'林经理', observers:[],
        decisionFlow:'续约申请→审批→签约',
        competitors:[],
        remark:'老客户续约，已签约。可拓展新需求。', winDate:daysAgo(18), createdAt:daysAgo(80),
        winReason:'relationship', winNote:'老客户关系深厚，续约水到渠成，服务口碑好' },
      { id:'opp_007', customerId:'cus_008', name:'清源水务数据中台建设项目', product:'数据中台',
        amount:3200000, budget:3500000, stage:1, status:'open', competition:'even', winProbability:40,
        purchaseMode:'公开招标', applyDept:'信息科', expectedSignDate:daysAgo(-100),
        contactIds:['ct_011'], owner:'林经理', observers:[],
        decisionFlow:'需求调研→方案→招标→签约',
        competitors:['友商H(数据中台厂商)'],
        remark:'意向阶段，与友商H处于同一起跑线，需尽早建立技术优势。', createdAt:daysAgo(20) },
      { id:'opp_008', customerId:'cus_003', name:'华信集团子公司数据中台试点', product:'数据中台',
        amount:2600000, budget:3000000, stage:2, status:'open', competition:'leading', winProbability:60,
        purchaseMode:'直接采购', applyDept:'信息部', expectedSignDate:daysAgo(-50),
        contactIds:['ct_006'], owner:'林经理', observers:[],
        decisionFlow:'试点申请→方案→审批→采购',
        competitors:['友商E'],
        remark:'依托主项目带动，试点机会较大。', createdAt:daysAgo(25) },
      { id:'opp_009', customerId:'cus_009', name:'金鹏城投智慧园区平台项目', product:'智慧政务平台',
        amount:4200000, budget:4500000, stage:2, status:'lost', competition:'behind', winProbability:0,
        purchaseMode:'公开招标', applyDept:'信息部', expectedSignDate:daysAgo(90),
        contactIds:[], owner:'林经理', observers:[],
        decisionFlow:'需求调研→方案→招标→评标',
        competitors:['友商J(本地龙头)','友商K(价格优势)'],
        remark:'方案阶段虽通过但投标价格偏高，友商K以低价中标。', lostDate:daysAgo(85), createdAt:daysAgo(130),
        lossReason:'price', lossNote:'报价高于友商K约15%，客户最终选择低价方案，方案差异不大' },
      { id:'opp_010', customerId:'cus_006', name:'中原能源数据治理平台项目', product:'数据中台',
        amount:3800000, budget:4000000, stage:1, status:'lost', competition:'even', winProbability:0,
        purchaseMode:'竞争性谈判', applyDept:'信息中心', expectedSignDate:daysAgo(120),
        contactIds:[], owner:'林经理', observers:[],
        decisionFlow:'需求调研→方案→谈判',
        competitors:['友商L(能源行业ISV)'],
        remark:'友商L有能源行业深厚积累，行业方案更匹配客户需求。', lostDate:daysAgo(110), createdAt:daysAgo(160),
        lossReason:'solution', lossNote:'友商L能源行业案例丰富，方案更贴合业务场景，我方行业积累不足' },
    ];
    O.forEach(o=>{ o.enterpriseId='ent_001'; if(!o.createdAt) o.createdAt=daysAgo(40); o.updatedAt=daysAgo(Math.random()*10); });
    db.opportunities = O;

    // ---------- 跟进记录 ----------
    const F = [
      { id:'fu_001', customerId:'cus_001', contactId:'ct_001', opportunityId:'opp_001',
        type:'meeting', content:'与张处长进行方案评审会议，确认技术架构与实施计划，对方认可方案完整性，建议补充运维SLA条款。会议纪要已发送。',
        nextAction:'补充运维SLA条款并提交终版方案', nextDate:daysAgo(-3), at:daysAgo(5), by:'林经理' },
      { id:'fu_002', customerId:'cus_001', contactId:'ct_002', opportunityId:'opp_001',
        type:'visit', content:'拜访李建国副主任，汇报项目进展与标杆案例，李主任对性价比提出关注，要求提供ROI测算。',
        nextAction:'准备ROI测算报告并再次汇报', nextDate:daysAgo(-1), at:daysAgo(2), by:'林经理' },
      { id:'fu_003', customerId:'cus_002', contactId:'ct_004', opportunityId:'opp_002',
        type:'demo', content:'AI客服POC演示，展示智能问答与导诊能力，陈主任认可效果但提出需适配本地医保政策知识库。',
        nextAction:'准备医保政策知识库适配方案', nextDate:daysAgo(-5), at:daysAgo(7), by:'林经理' },
      { id:'fu_004', customerId:'cus_003', contactId:'ct_006', opportunityId:'opp_003',
        type:'meeting', content:'与赵总沟通信创适配整体方案，技术评估通过，进入商务阶段。赵总要求集团采购走邀请招标流程，预计3周内发标。',
        nextAction:'跟进发标进度，准备投标材料', nextDate:daysAgo(-7), at:daysAgo(10), by:'林经理' },
      { id:'fu_005', customerId:'cus_003', contactId:'ct_007', opportunityId:'opp_003',
        type:'quote', content:'向孙总提交商务报价初稿，孙总反馈价格偏高，要求在信创合规前提下优化成本，给出更优报价。',
        nextAction:'内部核算成本，优化报价方案', nextDate:daysAgo(-4), at:daysAgo(3), by:'林经理' },
      { id:'fu_006', customerId:'cus_004', contactId:'ct_009', opportunityId:'opp_004',
        type:'call', content:'电话沟通吴处长，了解预算批复进度，目前预算仍在财政厅审批中，预计下月有结果。',
        nextAction:'月底跟进预算批复情况', nextDate:daysAgo(-10), at:daysAgo(12), by:'林经理' },
      { id:'fu_007', customerId:'cus_005', contactId:'ct_010', opportunityId:'opp_005',
        type:'meeting', content:'与郑部长沟通方案比选结果，我方在行业理解上弱于友商F，预算因财政调整延期，项目延缓。',
        nextAction:'梳理轨交行业案例，寻找差异化突破点', nextDate:daysAgo(-15), at:daysAgo(18), by:'林经理' },
      { id:'fu_008', customerId:'cus_010', contactId:'ct_012', opportunityId:'opp_006',
        type:'proposal', content:'提交运维续约方案并完成签约流程，马队长签字确认，合同已归档。',
        nextAction:'启动续约服务交付，挖掘新需求', nextDate:daysAgo(-20), at:daysAgo(18), by:'林经理' },
      { id:'fu_009', customerId:'cus_008', contactId:'ct_011', opportunityId:'opp_007',
        type:'visit', content:'首次拜访清源水务黄科长，了解数据中台建设需求，对方表示正在做前期规划，欢迎我方参与。',
        nextAction:'输出初步方案与案例集', nextDate:daysAgo(-8), at:daysAgo(8), by:'林经理' },
      { id:'fu_010', customerId:'cus_003', contactId:'ct_006', opportunityId:'opp_008',
        type:'proposal', content:'提交数据中台试点方案，赵总认可试点思路，要求与主项目打包推进。',
        nextAction:'准备试点POC环境', nextDate:daysAgo(-6), at:daysAgo(4), by:'林经理' },
    ];
    F.forEach(f=>{ f.enterpriseId='ent_001'; f.createdAt=f.at; });
    db.followups = F;

    // ---------- 日程 ----------
    const S = [
      { id:'sch_001', title:'省政务中心方案终版提交', type:'方案演示', priority:'high',
        startAt:daysAfter(0.5), endAt:daysAfter(0.6), customerId:'cus_001', opportunityId:'opp_001', contactId:'ct_001',
        participants:['林经理','陈顾问'], notify:['周总监'], location:'省政务中心会议室',
        desc:'提交补充运维SLA条款的终版方案，并现场答疑。', done:false },
      { id:'sch_002', title:'华信集团商务报价谈判', type:'商务谈判', priority:'high',
        startAt:daysAfter(1.2), endAt:daysAfter(1.3), customerId:'cus_003', opportunityId:'opp_003', contactId:'ct_007',
        participants:['林经理','周总监'], notify:[], location:'华信大厦',
        desc:'与孙总进行价格谈判，提交优化后的报价方案。', done:false },
      { id:'sch_003', title:'东海市卫健委POC知识库适配', type:'方案演示', priority:'mid',
        startAt:daysAfter(3), endAt:daysAfter(3.1), customerId:'cus_002', opportunityId:'opp_002', contactId:'ct_004',
        participants:['林经理','POC工程师'], notify:[], location:'卫健委信息中心',
        desc:'演示医保政策知识库适配后的AI客服能力。', done:false },
      { id:'sch_004', title:'明州轨交差异化方案梳理', type:'内部会议', priority:'mid',
        startAt:daysAfter(5), endAt:daysAfter(5.1), customerId:'cus_005', opportunityId:'opp_005', contactId:'',
        participants:['林经理','解决方案专家'], notify:[], location:'公司会议室',
        desc:'内部研讨轨交行业差异化突破点。', done:false },
      { id:'sch_005', title:'省教育厅预算跟进电话', type:'拜访客户', priority:'low',
        startAt:daysAfter(7), endAt:daysAfter(7.05), customerId:'cus_004', opportunityId:'opp_004', contactId:'ct_009',
        participants:['林经理'], notify:[], location:'电话',
        desc:'跟进预算批复情况。', done:false },
      { id:'sch_006', title:'上周客户拜访复盘', type:'内部会议', priority:'low',
        startAt:daysAfter(-2), endAt:daysAfter(-1.9), customerId:'', opportunityId:'', contactId:'',
        participants:['林经理','陈顾问'], notify:[], location:'公司',
        desc:'复盘上周客户拜访情况。', done:true },
    ];
    S.forEach(s=>{ s.enterpriseId='ent_001'; });
    db.schedules = S;

    // ---------- 企业2示例数据（北辰数智）----------
    db.customers.push(
      { id:'cus_020', enterpriseId:'ent_002', name:'浦东新区城市运行管理中心', shortName:'浦东城运中心',
        industry:'政府机关', level:'A', source:'招标平台', status:'active',
        region:'上海市', address:'上海市浦东新区', owner:'赵总', protectDays:30, inPool:false,
        uscc:Utils.USCC.makeFull('12310115MA1K9X3P2'),
        remark:'城市运行管理平台升级需求，正在跟进。', createdAt:daysAgo(15), updatedAt:daysAgo(2) },
      { id:'cus_021', enterpriseId:'ent_002', name:'张江高科产业园运营公司', shortName:'张江高科',
        industry:'国企央企', level:'B', source:'主动开发', status:'active',
        region:'上海市', address:'上海市浦东新区张江路', owner:'赵总', protectDays:30, inPool:false,
        uscc:Utils.USCC.makeFull('91310115MA1K8H3M5'),
        remark:'园区智慧化改造需求。', createdAt:daysAgo(20), updatedAt:daysAgo(5) },
    );
    db.contacts.push(
      { id:'ct_020', enterpriseId:'ent_002', customerId:'cus_020', name:'陈主任', title:'城运中心主任',
        rank:'决策层', role:'最终决策者', mobile:'138****2020', email:'chen@pudong.gov.cn',
        dept:'城运中心', isKey:true, attitude:'中立', remark:'需求明确，对方案要求高。',
        createdAt:daysAgo(15), updatedAt:daysAgo(2) },
    );
    db.opportunities.push(
      { id:'opp_020', enterpriseId:'ent_002', customerId:'cus_020', name:'浦东城运中心智慧化升级项目',
        product:'政务大屏可视化', amount:3500000, budget:4000000, stage:2, status:'open',
        competition:'even', winProbability:40, purchaseMode:'公开招标', applyDept:'城运中心',
        expectedSignDate:daysAgo(-45), contactIds:['ct_020'], owner:'赵总', observers:[],
        decisionFlow:'需求调研→方案设计→招标→签约', competitors:['友商M'],
        remark:'方案阶段，竞争激烈。', createdAt:daysAgo(12), updatedAt:daysAgo(2) },
    );

    return db;
  }
};
