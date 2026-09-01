export type RouteRecord = { id: string; owner: 'mine' | 'default'; title: string; summary: string; outcome: string; duration: string; carriers: number; concepts: number; tags: string[] }

export const routes: RouteRecord[] = [
  { id: 'linear-algebra', owner: 'mine', title: '从线性代数走向机器学习', summary: '从向量空间出发，经线性变换与特征值，最终理解 PCA 的几何直觉。', outcome: '能用几何语言解释 PCA，并完成一次二维数据降维', duration: '约 5 周', carriers: 4, concepts: 8, tags: ['数学基础', '机器学习', '含 PDF'] },
  { id: 'critical-thinking', owner: 'default', title: '批判性思维：从观点到论证', summary: '辨认论点、证据、反例与隐含前提，建立可复用的论证分析框架。', outcome: '能拆解一篇长回答的论证结构并指出证据缺口', duration: '约 3 周', carriers: 3, concepts: 6, tags: ['通识', '思维方法'] },
  { id: 'frontend-architecture', owner: 'default', title: '现代前端架构的关键路径', summary: '从浏览器运行机制出发，连接组件、状态、数据流与工程化决策。', outcome: '能解释一个中型 React 项目的分层与性能边界', duration: '约 4 周', carriers: 4, concepts: 9, tags: ['前端', '工程实践'] },
]

export const knowledge = [
  { id: 'vector-space', icon: 'layers', title: '向量空间', description: '从几何向量到抽象空间：线性组合、张成、基与维数之间的关系。', sources: 4, type: '知乎回答 · PDF' },
  { id: 'linear-transform', icon: 'function', title: '线性变换', description: '把矩阵理解成空间中的动作，而不只是数字表格。', sources: 3, type: '知乎回答' },
  { id: 'kernel-image-rank', icon: 'network', title: '核、像与秩', description: '辨认被压缩到零的方向、能够到达的空间，以及二者与自由度的关系。', sources: 3, type: '知乎回答 · PDF' },
  { id: 'eigen', icon: 'compass', title: '特征值与特征向量', description: '在变换中保持方向的向量，以及对应缩放因子的几何意义。', sources: 4, type: '知乎回答 · PDF' },
  { id: 'variance', icon: 'image', title: '方差与协方差', description: '从单变量离散程度走向两个变量共同变化的方向和强度。', sources: 3, type: '知乎回答' },
  { id: 'covariance-matrix', icon: 'layers', title: '协方差矩阵', description: '把多维变量之间的共同变化组织成可进行特征分解的结构。', sources: 3, type: '知乎回答 · PDF' },
  { id: 'pca', icon: 'brain', title: '主成分分析 PCA', description: '由方差最大化与低维投影连接到实际数据降维。', sources: 2, type: '知乎回答' },
  { id: 'projection', icon: 'route', title: '二维数据投影', description: '把真实二维样本投向主轴，观察信息保留与重构误差。', sources: 2, type: '知乎回答' },
  { id: 'fourier', icon: 'image', title: '傅里叶变换的频域直觉', description: '把复杂信号拆成不同频率成分，并理解频谱的可视化。', sources: 3, type: '知乎回答' },
  { id: 'argument', icon: 'network', title: '论证结构', description: '识别结论、理由、反例和隐含假设的阅读框架。', sources: 2, type: '知乎回答' },
] as const

export const sourceItems = [
  { id: 's1', type: '知乎', author: '马同学', date: '07-19', title: '为什么矩阵可以被理解为线性变换？', summary: '从基向量的去向解释矩阵每一列的几何含义。' },
  { id: 's2', type: '知乎', author: '李永乐老师', date: '07-17', title: '如何直观理解向量空间和基？', summary: '用坐标系和积木类比张成空间与基的选择。' },
  { id: 's3', type: 'PDF', author: '你上传的资料', date: '第 12 页', title: 'linear-algebra-notes.pdf', summary: '课程讲义中关于线性映射、核与像的定义。' },
  { id: 's4', type: '知乎', author: '陈希孺', date: '03-16', title: '特征向量究竟“特征”在哪里？', summary: '解释不改变方向的变换轴及其稳定结构。' },
]

export type ConstellationAuthor = {
  id:string; name:string; short:string; carrierId:string; x:number; y:number; size:number;
  role:string; work:string; description:string;
}
export type ConstellationConcept = { id:string; title:string; authors:string[]; label:{x:number;y:number} }
export type AuthorSky = {
  id:string; title:string; subtitle:string; essay:string;
  carriers:{id:string;title:string;x:number;color:string}[];
  authors:ConstellationAuthor[]; concepts:ConstellationConcept[];
}

export type ConsultationRecommendation = {
  authorId:string
  match:number
  trust:number
  evidence:number
  reason:string
  history:string
  suggestedQuestion:string
}

export type ConsultationContext = {
  goalId:string
  path:string
  concept:string
  question:string
  recommendations:ConsultationRecommendation[]
}

export const consultationContexts:ConsultationContext[] = [
  {
    goalId:'goal-pca',
    path:'从线性代数走向机器学习',
    concept:'主成分分析 PCA',
    question:'为什么最大方差方向能够保留最多信息？',
    recommendations:[
      {authorId:'sujianlin',match:96,trust:86,evidence:4,reason:'同时覆盖线性变换、协方差与 PCA 推导，与你的当前问题跨度最接近。',history:'你曾基于他的内容追问 2 次，并访问过 1 次原文。',suggestedQuestion:'能否从协方差矩阵的特征方向解释最大方差准则？'},
      {authorId:'wangshuyi',match:92,trust:79,evidence:3,reason:'擅长把统计原理转换成数据可视化和实际分析过程。',history:'你曾采纳过 1 次他的数据解释。',suggestedQuestion:'怎样用一个二维数据例子看出 PCA 保留了什么？'},
      {authorId:'xixiaoyao',match:89,trust:72,evidence:2,reason:'表达清晰，适合先建立 PCA 为什么有效的整体理解。',history:'你点击过她的相关原文 2 次。',suggestedQuestion:'可以不用复杂公式解释 PCA 为什么能保留主要信息吗？'},
    ],
  },
  {
    goalId:'goal-system',
    path:'形成可持续的个人学习系统',
    concept:'反馈循环',
    question:'怎样把零散输入变成可以长期迭代的学习系统？',
    recommendations:[
      {authorId:'liuweipeng',match:95,trust:84,evidence:4,reason:'同时覆盖学习策略、知识组织和写作输出，是两个载体之间的关键连接者。',history:'你曾基于他的内容追问 3 次，并采纳过 2 次。',suggestedQuestion:'如何把暗时间中的零散思考沉淀成稳定的知识结构？'},
      {authorId:'liufei',match:91,trust:76,evidence:3,reason:'擅长把复杂信息组织成可行动的产品结构。',history:'你曾访问过 2 次他的相关内容。',suggestedQuestion:'怎样把学习流程设计成能持续反馈的产品闭环？'},
      {authorId:'zhangkejun',match:87,trust:70,evidence:3,reason:'能够连接视觉表达、系统结构和前端落地。',history:'你曾在知识可视化节点采纳过 1 次相关建议。',suggestedQuestion:'如何让知识结构既清晰可视，又不会变成难以维护的复杂图？'},
    ],
  },
]

export const authorSkies:AuthorSky[] = [
  {
    id:'goal-pca', title:'理解 PCA', subtitle:'从学科地基到主成分分析',
    essay:'横向位置表示作者最接近的载体，纵向位置表示所处概念在路线中的先后。星是博主，连接他们的金线才是概念。悬停一颗星查看同概念作者；依次点击两颗星，查看他们经过哪些概念才能相遇。',
    carriers:[
      {id:'carrier-math',title:'数学基础',x:330,color:'#e7c477'},
      {id:'carrier-data',title:'数据视角',x:920,color:'#d5b978'},
    ],
    authors:[
      {id:'me',name:'吴贤明',short:'吴',carrierId:'self',x:650,y:62,size:13,role:'当前学习者',work:'正在学习：从线性代数走向机器学习',description:'沿着概念脉络向目标靠近的人，也是这片知识星空中仍在生长的一颗星。'},
      {id:'liyongle',name:'李永乐老师',short:'李',carrierId:'carrier-math',x:170,y:442,size:7,role:'数学科普作者',work:'向量空间与基的直观解释',description:'善于用具象例子解释抽象数学结构。'},
      {id:'matrix67',name:'Matrix67',short:'M',carrierId:'carrier-math',x:285,y:430,size:7,role:'数学与算法作者',work:'线性代数的几何直觉',description:'从算法、几何和计算思维连接数学概念。'},
      {id:'ma',name:'马同学',short:'马',carrierId:'carrier-math',x:410,y:362,size:9,role:'线性代数作者',work:'为什么矩阵可以被理解为线性变换？',description:'从基向量的去向解释矩阵每一列的几何含义。'},
      {id:'liuyian',name:'刘易安',short:'刘',carrierId:'carrier-math',x:274,y:355,size:7,role:'数学学习作者',work:'线性变换的空间语言',description:'把公式重新翻译成空间中的动作。'},
      {id:'chen',name:'陈希孺',short:'陈',carrierId:'carrier-math',x:486,y:330,size:8,role:'概率统计作者',work:'特征向量究竟特征在哪里',description:'从稳定方向解释特征结构。'},
      {id:'lihongyi',name:'李宏毅',short:'宏',carrierId:'carrier-math',x:560,y:286,size:8,role:'机器学习讲师',work:'从线性变换到机器学习',description:'连接数学基础与模型训练中的实际用法。'},
      {id:'liujianping',name:'刘建平',short:'建',carrierId:'bridge',x:610,y:302,size:7,role:'统计学习作者',work:'协方差矩阵的推导与应用',description:'跨过公式推导与数据解释之间的缝隙。'},
      {id:'sujianlin',name:'苏剑林',short:'苏',carrierId:'bridge',x:680,y:192,size:11,role:'机器学习作者',work:'从协方差到主成分分析',description:'同时覆盖线性变换、统计结构与 PCA，是跨载体连接最强的作者之一。'},
      {id:'wangshuyi',name:'王树义',short:'王',carrierId:'bridge',x:792,y:236,size:10,role:'数据科学作者',work:'用可视化理解 PCA',description:'把统计概念连接到数据分析与可视表达。'},
      {id:'qinlu',name:'秦路',short:'秦',carrierId:'carrier-data',x:822,y:334,size:7,role:'数据分析作者',work:'方差、协方差与业务数据',description:'以真实数据场景解释变量共同变化。'},
      {id:'zhangjunlin',name:'张俊林',short:'张',carrierId:'carrier-data',x:972,y:300,size:8,role:'机器学习作者',work:'统计视角下的降维',description:'把数据分布、表示与模型联系起来。'},
      {id:'limu',name:'李沐',short:'沐',carrierId:'carrier-data',x:918,y:202,size:9,role:'深度学习作者',work:'主成分分析与表示学习',description:'从机器学习实践反看线性代数与统计基础。'},
      {id:'xixiaoyao',name:'夕小瑶',short:'夕',carrierId:'carrier-data',x:840,y:136,size:9,role:'AI 科普作者',work:'PCA 为什么能保留主要信息',description:'用清晰的技术叙事解释降维目标。'},
      {id:'zhouzhihua',name:'周志华',short:'周',carrierId:'carrier-data',x:1055,y:126,size:9,role:'机器学习作者',work:'降维与学习理论',description:'从学习理论角度组织 PCA 所处的问题空间。'},
    ],
    concepts:[
      {id:'vector',title:'向量空间',authors:['liyongle','matrix67','ma','liuyian','chen'],label:{x:300,y:474}},
      {id:'linear',title:'线性变换',authors:['liuyian','ma','chen','lihongyi','sujianlin'],label:{x:462,y:382}},
      {id:'variance',title:'方差与协方差',authors:['liujianping','sujianlin','wangshuyi','qinlu','zhangjunlin','limu'],label:{x:796,y:276}},
      {id:'pca',title:'主成分分析',authors:['xixiaoyao','sujianlin','wangshuyi','limu','zhouzhihua','me'],label:{x:835,y:102}},
    ],
  },
  {
    id:'goal-system', title:'形成学习系统', subtitle:'从输入方法到产品化表达',
    essay:'这片天空不与“理解 PCA”并排拼成组织图。它拥有自己的纵向路径：下方是方法地基，上方是系统化表达；跨越学习方法与产品工程的作者，是最值得优先提问的人。',
    carriers:[
      {id:'carrier-method',title:'学习方法',x:330,color:'#e7c477'},
      {id:'carrier-product',title:'产品工程',x:920,color:'#d5b978'},
    ],
    authors:[
      {id:'me',name:'吴贤明',short:'吴',carrierId:'self',x:650,y:62,size:13,role:'当前学习者',work:'正在搭建自己的学习系统',description:'把输入、练习、反馈和表达组织成可复用路径的人。'},
      {id:'lachel',name:'Lachel',short:'L',carrierId:'carrier-method',x:185,y:430,size:9,role:'学习方法作者',work:'检索练习与长期记忆',description:'关注认知策略和可执行的学习习惯。'},
      {id:'caitong',name:'采铜',short:'采',carrierId:'carrier-method',x:305,y:412,size:9,role:'认知成长作者',work:'精进与反馈回路',description:'把学习方法放进长期成长框架。'},
      {id:'knowyourself',name:'KnowYourself',short:'K',carrierId:'carrier-method',x:435,y:440,size:7,role:'心理与成长作者',work:'反馈如何塑造自我认知',description:'从心理机制解释学习和反馈。'},
      {id:'warfalcon',name:'warfalcon',short:'W',carrierId:'carrier-method',x:245,y:310,size:8,role:'行动方法作者',work:'刻意练习与复盘',description:'强调行动、记录和持续改进。'},
      {id:'liuweipeng',name:'刘未鹏',short:'鹏',carrierId:'bridge',x:548,y:340,size:10,role:'思维方法作者',work:'暗时间与知识组织',description:'连接学习策略、写作表达和工程思维。'},
      {id:'liufei',name:'刘飞',short:'飞',carrierId:'bridge',x:740,y:286,size:9,role:'产品作者',work:'产品思维与知识表达',description:'把复杂信息组织成读者可以行动的结构。'},
      {id:'zhangkejun',name:'张克军',short:'克',carrierId:'carrier-product',x:872,y:266,size:9,role:'设计与工程作者',work:'可视化系统的设计方法',description:'连接设计语言、前端工程与可视表达。'},
      {id:'yuxi',name:'尤雨溪',short:'尤',carrierId:'carrier-product',x:830,y:356,size:10,role:'前端工程作者',work:'渐进式系统与工具设计',description:'以清晰边界组织复杂工程系统。'},
      {id:'yuxian',name:'余弦',short:'余',carrierId:'carrier-product',x:956,y:348,size:8,role:'安全与工程作者',work:'系统能力与工程实践',description:'关注工程系统的边界、可靠性和实践方法。'},
      {id:'fenng',name:'Fenng',short:'F',carrierId:'carrier-product',x:1070,y:366,size:7,role:'互联网产品作者',work:'产品判断与技术组织',description:'从长期实践观察技术产品的演进。'},
      {id:'chijianqiang',name:'池建强',short:'池',carrierId:'carrier-product',x:1008,y:204,size:8,role:'产品与写作作者',work:'知识产品与持续创作',description:'把工程经验转化为可持续的内容系统。'},
    ],
    concepts:[
      {id:'retrieval',title:'检索练习',authors:['lachel','caitong','knowyourself','liuweipeng','warfalcon'],label:{x:320,y:468}},
      {id:'feedback',title:'反馈循环',authors:['warfalcon','lachel','caitong','liuweipeng','me'],label:{x:422,y:360}},
      {id:'architecture',title:'系统架构',authors:['liufei','zhangkejun','yuxi','yuxian','fenng'],label:{x:920,y:402}},
      {id:'visual',title:'知识可视化',authors:['liufei','zhangkejun','yuxi','chijianqiang','me'],label:{x:856,y:224}},
    ],
  },
]

export { canvasEdges, canvasNodes } from './knowledge-canvas/content'
