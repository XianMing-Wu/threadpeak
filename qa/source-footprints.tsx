import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import type {NetworkEvidence} from '@threadpeak/contracts/authors'
import {SourceFootprints} from '../src/learning-v2/SourceFootprints'
import {Composer} from '../src/components/Composer'
import {LearningComposer} from '../src/learning-v2/Chat'
import {NodePrompt} from '../src/learning-v2/NodePrompt'
import '../src/styles.css'
import '../src/ui/flowith-home.css'
import '../src/learning-v2/learning.css'
import '../src/learning-v2/authors.css'
import './source-footprints.css'
const topic='Transformer 整体结构与数据流',title='Transformer 那张图，我盯了半年才看懂 - 知乎'
const nodeTitles={source:title,encoder:'编码器的一层：四步流水线',decoder:'解码器：在编码器基础上多两步'}
const use={topicId:'topic-example',topic,resourceId:'qa-learning',carrier:'建立 Transformer 整体直觉',question:'',nodeIds:Object.keys(nodeTitles),nodeTitles,nodeKinds:{source:'article' as const,encoder:'answer' as const,decoder:'answer' as const},origin:'learning' as const,discoveredAt:1,helpful:false}
const sample:NetworkEvidence={evidenceId:'source',authorId:'qa-author',authorName:'验收资料作者',title,summary:'仅供界面测试的资料，不提交生成任务。',url:'https://www.zhihu.com/',uses:[{...use,key:'source'},{...use,key:'initial',origin:'conversation',questionKind:'initial',question:topic,nodeIds:['encoder','decoder']},{...use,key:'follow',origin:'conversation',questionKind:'follow_up',question:'为什么解码器不能提前看到后面的词？',nodeIds:['decoder']}]}
const node={id:'source',type:'article' as const,title:'当前资料卡',text:'验收文字',parents:['root'],sources:['source']}
function Review({initialEvidence=sample}:{initialEvidence?:NetworkEvidence}){
 const [evidence,setEvidence]=useState(initialEvidence),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[dark,setDark]=useState(false)
 const run=()=>{setBusy(true);setNotice('验收：正在生成状态，无外部调用')},stop=()=>{setBusy(false);setNotice('验收：已停止')}
 const feedback=async(authorId:string,topicId:string,_kind:string,helpful:boolean,evidenceId?:string)=>{setEvidence(e=>({...e,uses:e.uses.map(u=>u.topicId===topicId?{...u,helpful}:u)}));setNotice(`反馈指向 ${authorId} / ${topicId} / ${evidenceId}：${helpful}`)}
 return <main className="review"><header className="review-head"><div><h1>学习足迹与输入操作</h1><p>独立验收页 · 使用正式组件和合成关系，不调用模型或写入用户数据。</p></div><div><button onClick={()=>{setDark(!dark);document.documentElement.dataset.theme=dark?'light':'dark'}}>切换明暗</button><button onClick={busy?stop:run}>{busy?'结束生成状态':'查看生成中状态'}</button></div></header><div className="review-grid"><section className="review-source"><p className="review-kicker">学习足迹 · 资料</p><h2>{title}</h2><p className="review-intro">这篇资料用于哪个概念，以及沿它展开的讲解与提问。</p><SourceFootprints evidence={evidence} authorId={evidence.authorId} onFeedback={feedback} busy={false} onClose={()=>{setNotice('已选择具体学习位置')}}/></section><section className="review-inputs"><h2>所有输入框采用相同操作</h2><section><h3>首页、普通对话、找博主</h3><Composer value={value} onChange={setValue} onSend={run} onStop={stop} busy={busy} showAttachment={false}/></section><section><h3>概念学习</h3><LearningComposer nodes={[node]} busy={busy} onSend={async()=>{run();return true}} onStop={stop}/></section><section className="review-node"><h3>卡片 · 询问 AI</h3><NodePrompt mode="ai" nodes={[node]} depth="fast" onDepth={()=>{}} busy={busy} onSubmit={async()=>{run();return true}} onStop={stop} onClose={()=>{setNotice('关闭输入框')}}/></section><section className="review-node"><h3>卡片 · 问博主</h3><NodePrompt mode="author" nodes={[node]} depth="fast" onDepth={()=>{}} busy={busy} onSubmit={async()=>{run();return true}} onStop={stop} onClose={()=>{setNotice('关闭输入框')}}/></section></section></div><output className="review-notice" aria-live="polite">{notice}</output></main>
}
const root=createRoot(document.getElementById('root')!)
export function mountEvidence(evidence:NetworkEvidence){root.render(<Review key={evidence.evidenceId} initialEvidence={evidence}/>)}
root.render(<Review/>)
