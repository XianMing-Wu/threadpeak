// Synthetic browser fixture. Uses the actual components without API/provider calls.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ArticleDetail} from '../src/learning-v2/Articles'
import {NodePrompt} from '../src/learning-v2/NodePrompt'
import {LearningData} from '../src/learning-v2/data'
import type {Article,GraphNode} from '../src/learning-v2/model'
import '../src/styles.css'
import '../src/learning-v2/learning.css'

const article:Article={id:'qa-article',title:'如何理解模型的能力边界',summary:'这是一段仅用于排版验收的合成正文。',author:'验收作者',authorId:'qa-author',badge:'北京理工大学 信息与通信工程硕士',likes:2,topic:'交互验收'}
const node:GraphNode={id:'qa-node',type:'answer',title:'为什么评测体系是必要的：验证边界是否被正确补上',text:'合成卡片',parents:['root'],sources:[]}
function Lab(){
  const [result,setResult]=useState('尚未操作'),[open,setOpen]=useState(true),[accept,setAccept]=useState(false)
  return <main className="lp-workspace" style={{display:'block',height:'auto',minHeight:'100vh',padding:16}}>
    <h1 style={{fontSize:20}}>学习交互验收</h1><p>合成数据，无外部请求。</p>
    <LearningData.Provider value={{articles:[article],concept:'交互验收',example:true}}><ArticleDetail article={article} onBack={()=>setResult('已返回')} onAuthor={id=>setResult(`已打开作者：${id}`)}/></LearningData.Provider>
    <label><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/>模拟接收成功</label>
    {!open&&<button onClick={()=>setOpen(true)}>打开问博主</button>}
    {open&&<div style={{maxWidth:360,marginTop:16}}><NodePrompt mode="author" nodes={[node]} depth="fast" onDepth={()=>{}} onClose={()=>setOpen(false)} onSubmit={async()=>{if(accept){setResult('问题已接收');setOpen(false);return true}return false}}/></div>}
    <p role="status" id="qa-result">{result}</p>
  </main>
}
createRoot(document.getElementById('root')!).render(<Lab/> )
