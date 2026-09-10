// Disposable browser fixture using the real graph. No provider calls or user storage.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {KnowledgeGraph} from '../src/learning-v2/Graph'
import {LearningData} from '../src/learning-v2/data'
import type {GraphNode} from '../src/learning-v2/model'
import '../src/styles.css'
import '../src/learning-v2/learning.css'
const initial:GraphNode[]=[
 {id:'root',type:'root',title:'审查交互',text:'合成数据，仅验收',parents:[],sources:[]},
 {id:'a',type:'article',title:'验收资料',text:'这是一份用于核对展开状态和定位的合成资料。'.repeat(30),parents:['root'],sources:[]},
 {id:'b',type:'answer',title:'等待任务的依据',text:'合成教学卡片，用于提问和任务恢复的交互验收。',parents:['a'],sources:[]},
]
function Lab(){
 const [active,setActive]=useState(true),[nodes,setNodes]=useState(initial),[selected,setSelected]=useState<string[]>(['b']),[waiting,setWaiting]=useState(true),[result,setResult]=useState('等待恢复')
 return <main className="lp-workspace" style={{height:'100dvh'}}>
  <header style={{padding:12,display:'flex',gap:12,flexWrap:'wrap'}}><strong>审查交互回归 · 合成数据</strong><button onClick={()=>setActive(!active)}>{active?'研究视图':'画布视图'}</button><button onClick={()=>{setWaiting(true);setResult('等待恢复')}}>模拟等待任务</button><span role="status">{result}</span></header>
  {!active&&<p style={{padding:16}}>研究视图：切回后保留图的位置、展开和文档状态。</p>}
  <LearningData.Provider value={{articles:[],concept:'审查交互',example:true}}><section style={{position:'relative',display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
   <KnowledgeGraph active={active} nodes={nodes} selected={selected} onSelect={id=>setSelected([id])} onSelection={setSelected} onChange={setNodes} depth="fast" onDepth={()=>{}} onCopy={()=>{}}
    busy={waiting} onStop={()=>{setWaiting(false);setResult('已停止')}} onResume={()=>{setWaiting(false);setResult('已继续')}}
    pending={waiting?[{id:'waiting',parents:['b'],mode:'ai',question:'测试问题',text:'',status:'需要手动继续',waiting:true,recoverable:true}]:[]}
    onPromptSubmit={async(q,mode)=>{setResult(`${mode==='ai'?'AI':'博主'}已接收：${q}`);return true}}/>
  </section></LearningData.Provider>
 </main>
}
createRoot(document.getElementById('root')!).render(<Lab/> )
