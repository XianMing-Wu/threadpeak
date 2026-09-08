// These choices and reading notes were made by reading the real search responses.
// Running the script only packages those choices; it does not rank or invent sources.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const selections={
 'attention-shapes':['attention-shapes',2,'代码明确给出模型维度与头维度关系，适合用尺寸检查阅读论文。','只取维度与投影的解释；代码摘录不是可独立运行的完整实现。'],
 'attention-dot':['attention-dot',1,'按点积、缩放、归一化、加权求和拆解论文，可把直觉回到运算。','接口摘要缺少部分公式；本例的完整公式另按论文核对，不声称恢复了作者原式。'],
 'attention-scale':['attention-scale',2,'给出常数缩放时方差除以常数平方的解释，直接对应平方根难点。','方差推导必须补写独立、零均值和单位方差前提；缩放不保证均匀权重，也不保证训练稳定。'],
 'attention-softmax':['attention-softmax',3,'说明每个查询的归一化权重如何作用于值向量。','权重不是答案置信度，语义关系只是直觉；数字维度按论文公式核对。'],
 'attention-heads':['attention-heads',2,'区分独立投影、并行计算与拼接，并指出头数并非越多越好。','不把每个头的分工当成预定标签，不把计算量近似说成零额外成本。'],
 'scene-camera':['scene-camera',0,'摄影棚类比能帮助首次接触 Three.js 的人理解三种对象职责。','Scene 不必是黑色；Mesh 不是全部对象类型。示例代码统一采用同一依赖的模块导入。'],
 'geometry-material':['geometry-material',1,'直接说明 BoxGeometry 与材质如何组成 Mesh，适合当前立方体目标。','只取立方体部分；本例改用无需灯光的 Normal 材质，其他几何体参数不作为当前课程。'],
 'object-transform':['object-transform',3,'同时解释世界、局部坐标和对象变换，能区分改物体与改观察位置。','position 与 rotation 相对于父对象；不能把嵌套场景的局部值直接视为世界值。'],
 'orbit-controls':['orbit-controls',3,'使用 three/addons 模块入口和 controls.update，适合接入当前作品。','汽车建模不属于目标；只读轨道控制器部分，窗口适配用同版本 API 补齐。'],
 'array-shape':['array-shape',2,'使用成绩表解释 shape 与 axis，可作为四篇选集共同的学习入口。','文章未返回完整成绩代码；这里另写一组固定练习数据，不冒充作者原例。'],
 'array-index':['array-index',0,'列出缺失、异常与不同处理方法，并提醒结合业务判断。','不采纳一律删除或填补；本练习明确只分析两科均有效的行，保留原数组。'],
 'array-broadcast':['array-broadcast',1,'给出末轴对齐与长度兼容规则，恰好解释逐列调整。','“拉伸”是概念模型，不一定实际复制内存；移除与本例无关的药物研发内容。'],
 'array-aggregate':['array-aggregate',2,'用数组形状与具体结果解释求和方向，可核对聚合输出。','原摘要 a.sum(1) 后的“垂直”注释有误；它沿 axis=1 规约。本例用输出形状验证。'],
 'money-cashflow':['money-cashflow',1,'从收入、必需与非必需支出组织预算，符合先理解收支的目标。','把学生零用钱场景迁为家庭练习，不给统一储蓄比例，不把内部转账记成收入。'],
 'money-liquidity':['money-liquidity',3,'解释收入中断与意外支出为何需要可用储备，适合讨论资金用途。','文中的 3–6 个月与储蓄率不是人人必须遵守的标准；按情况估算，另外核对实际到账条款。'],
 'money-risk':['money-drawdown',1,'明确区分已观察到的回撤与未来潜在风险，避免把历史当上限。','不采纳基金经理能择时保护本金的暗示；本例只教授指标边界与风险核对。'],
 'money-compare':['money-compare',1,'列出说明书中费用、赎回、投向与风险字段，可编成条款核对清单。','这是厂商应用案例；不推荐其服务，也不采信 AI 评分或“适合谁买”的自动结论。'],
 'llm-contract':['llm-contract',1,'区分解析、校验和有限重试，并明确格式正确不等于事实正确。','不照搬日志保存原始敏感输出的做法；作品只记录必要的脱敏信息。'],
 'rag-evidence':['rag-evidence',1,'有解析、切分、检索与引用的具体故障场景，便于建立作品基线。','作者样本分数不外推；低 temperature 与提示词不保证消除幻觉，另做引用与评测。'],
 'rag-evaluation':['rag-evaluation',3,'分层检查检索、引用、拒答和成本，说明不能用一个平均分代替发布判断。','指标依赖标注、数据集和样本量；本文示例分数不是我们产品的实测结果。'],
 'tool-boundary':['tool-boundary',4,'清楚区分模型的结构化请求与应用实际执行，适合展示权限边界。','本例仅使用只读工具；不声称模型可以绕过宿主直接执行外部动作。'],
 'llm-delivery':['llm-delivery',4,'区分负载测试、延迟和吞吐，为作品交付建立可观察指标。','不采用固定汉字与 token 比例，也不把小样本演示视作生产负载验收。'],
}
const canonical=url=>{const u=new URL(url);u.search='';u.hash='';return u.href}
const digest=value=>createHash('sha256').update(value).digest('hex')
const rejectionReasons={
 'attention-shapes':'排除把 softmax([80,40]) 说成约 98%/2% 的错误算例；其他候选以比喻或推理优化为主。',
 'attention-scale':'排除能量守恒类比与“保证熵合理”的过强结论；通用面试长文不如缩放专文聚焦。',
 'attention-heads':'排除“几乎零额外成本”的无条件描述；完整模型实现与当前公式阅读范围不符。',
 'scene-camera':'排除旧全局脚本入口、整车项目，以及“一场景只能一台相机”的错误概括。',
 'orbit-controls':'排除机器人坐标变换、地图与完整模型查看器；只保留控制器的直接例子。',
 'array-shape':'排除把数组维数、矩阵秩与方阵大小混淆的解释；其他候选与聚合篇重复较多。',
 'array-index':'排除 Pandas 多表合并与当前 NumPy 任务不符的结果。',
 'array-broadcast':'排除量化交易与考勤源码，其业务范围超出本例；不把“全面底层基石”列为必要前置。',
 'money-cashflow':'排除固定储蓄比例、理财产品延伸与期权对冲内容；先选较窄的预算入门。',
 'money-liquidity':'排除把 R1 等同于立即到账的产品配置建议与推广性收益描述。',
 'money-risk':'排除个人择时、固定买入比例和以过往回撤筛选未来损失的建议；保留历史与未来的明确区别。',
 'money-compare':'排除具体利率、分配比例与过时产品案例；仅取说明书字段，不推荐厂商工具。',
 'llm-contract':'排除框架接口清单与受限解码保证绝对正确的表述。',
 'rag-evidence':'排除 GraphRAG、通用 Agent 概念堆叠；先完成可回查的普通 RAG。',
 'rag-evaluation':'排除混淆指标数量的面试题与单纯 LLM 打分方案，保留可复验的分层判断。',
 'tool-boundary':'排除“能精准回答所有问题”的过度描述与依赖特定工程内部规则的内容。',
 'llm-delivery':'排除供应商选型与产品推广，先掌握可观测的指标及交付边界。',
}
const sources={},audit=[]
for(const [conceptId,[queryId,index,why,caveat]] of Object.entries(selections)){
 const raw=await readFile(`qa/evidence/showcase/raw/${queryId}.json`,'utf8'),run=JSON.parse(raw)
 if(run.result.kind!=='hits')throw new Error(`No real evidence: ${queryId}`)
 const hit=run.result.items[index]
 if(!hit?.summary||!hit.url||!hit.evidenceId)throw new Error(`Incomplete evidence: ${conceptId}`)
 const article={id:`zhihu-${hit.evidenceId}`,title:hit.title,summary:hit.summary,author:hit.authorName??'知乎用户',authorId:hit.authorId??null,authorUrl:hit.authorUrl??null,url:canonical(hit.url),likes:hit.likes??null,topic:'知乎文章',sourceKind:'zhihu',curation:{why,readingGuide:why,caveat,reviewedAt:run.requestedAt}}
 for(const key of ['avatar','badge','badgeIcon','editedAt','contentType','comments'])if(hit[key]!==undefined)article[key]=hit[key]
 sources[conceptId]=[article]
 audit.push({conceptId,query:run.query,queryId,requestedAt:run.requestedAt,provider:run.provider,responseSha256:digest(raw),selected:[{id:article.id,title:hit.title,url:article.url,author:article.author,summarySha256:digest(hit.summary),why,caveat}],candidates:run.result.items.map((item,i)=>({id:item.evidenceId,title:item.title,url:canonical(item.url),selected:i===index})),rejectionReason:rejectionReasons[conceptId]??'其余候选偏完整课程、范围更宽或重复解释；保留最直接服务本概念的这篇，不按点赞或认证替代内容判断。'})
}
await mkdir('src/showcase',{recursive:true})
await writeFile('src/showcase/sources.json',JSON.stringify(sources,null,2)+'\n')
await writeFile('qa/evidence/showcase/source-review.json',JSON.stringify({version:1,reviewMethod:'逐条审阅真实搜索返回的摘要，显式指定选择位置；不代表逐篇核验原文全文或作者认可本产品。',conceptCount:audit.length,entries:audit},null,2)+'\n')
const inventory=[]
for(const file of (await readdir('qa/evidence/showcase/raw')).filter(f=>f.endsWith('.json')).sort()){const raw=await readFile(`qa/evidence/showcase/raw/${file}`,'utf8'),run=JSON.parse(raw);inventory.push({id:run.id,query:run.query,observedAt:run.requestedAt,provider:run.provider,status:run.result.kind,candidateCount:run.result.items?.length??0,responseSha256:digest(raw),selectedFor:audit.filter(e=>e.queryId===run.id).map(e=>e.conceptId)})}
await writeFile('qa/evidence/showcase/search-inventory.json',JSON.stringify(inventory,null,2)+'\n')
console.log(`Packaged ${audit.length} reviewed concepts; original API summaries preserved.`)
