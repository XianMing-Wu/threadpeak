// Editorial research only. Real Zhihu provider; no product database or user account writes.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {serverEnvironment,http} from '../server/durable/bootstrap.ts'
import {resolveProviderConfig} from '../server/config.ts'
import {createAgentZhihuProvider} from '../server/agent-runtime/zhihu-provider.ts'

export const queries=[
 ['attention-shapes','Transformer Attention Q K V 矩阵 维度 理解'],
 ['attention-dot','Attention 点积 查询 键 相似度 为什么'],
 ['attention-scale','Attention 为什么 除以 根号 dk 方差'],
 ['attention-softmax','Attention softmax 权重 加权求和 V'],
 ['attention-heads','多头注意力 拼接 线性变换 单头 区别'],
 ['scene-camera','Three.js 入门 场景 相机 渲染器'],
 ['geometry-material','Three.js 立方体 BoxGeometry Mesh 材质'],
 ['object-transform','Three.js 物体 旋转 坐标系 动画'],
 ['orbit-controls','Three.js OrbitControls 鼠标 旋转 相机 自适应'],
 ['array-shape','NumPy 数组 shape axis 数据分析 入门'],
 ['array-index','NumPy 布尔索引 缺失值 筛选 数据'],
 ['array-broadcast','NumPy 广播 向量化 循环'],
 ['array-aggregate','NumPy axis mean sum 统计 数据分析'],
 ['money-cashflow','家庭 理财 现金流 预算 记账'],
 ['money-liquidity','家庭 应急金 流动性 理财 期限'],
 ['money-risk','理财 风险 收益 回撤 风险承受能力'],
 ['money-diversify','基金 分散投资 相关性 费用 长期'],
 ['money-compare','如何读懂 理财产品说明书 费用 风险 流动性'],
 ['money-drawdown','最大回撤 历史 不代表 未来 风险'],
 ['llm-contract','大模型 API 结构化输出 JSON schema 应用开发'],
 ['rag-evidence','RAG 文档 切分 检索 引用 来源'],
 ['rag-evaluation','RAG 评估 检索 召回率 回答 忠实性'],
 ['tool-boundary','大模型 Agent Function Calling 工具调用 权限'],
 ['llm-delivery','大模型 应用 部署 监控 成本 延迟 评估'],
]
const directory='qa/evidence/showcase/raw'
await mkdir(directory,{recursive:true})
const config=resolveProviderConfig(serverEnvironment())
if(!config.ok)throw new Error('Real provider configuration required')
const provider=createAgentZhihuProvider({config:config.config,http,clock:{now:()=>new Date(),unixSeconds:()=>Math.floor(Date.now()/1000)}})
let cursor=0,failed=0
const selected=process.argv.slice(2)
const pending=queries.filter(([id])=>!selected.length||selected.includes(id))
async function worker(){while(cursor<pending.length){
 const [id,query]=pending[cursor++]
 try{const old=JSON.parse(await readFile(`${directory}/${id}.json`,'utf8'));if(old.result.kind==='hits'&&old.query===query){console.log(id,'cached');continue}}catch{}
 let result
 for(let attempt=0;attempt<4;attempt++){
  result=await provider.search(query,5)
  if(result.kind!=='failed')break
  console.log(id,'retry',attempt+1,result.code??'network')
  await new Promise(resolve=>setTimeout(resolve,Math.min(15000,2000*2**attempt)))
 }
 await writeFile(`${directory}/${id}.json`,JSON.stringify({id,query,requestedAt:new Date().toISOString(),provider:'zhihu-search',result},null,2)+'\n')
 console.log(id,result.kind,result.items?.length??0)
 if(result.kind!=='hits')failed++
}}
await Promise.allSettled([worker(),worker()]).then(results=>{for(const r of results)if(r.status==='rejected')throw r.reason})
if(failed)process.exitCode=1
