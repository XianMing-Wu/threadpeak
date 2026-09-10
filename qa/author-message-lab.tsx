// Real public-search/model sample in an isolated UI harness. Never sends a message.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PrepareAuthor} from '../src/learning-v2/AuthorPanels'
import {AuthorBriefSchema,type AuthorMatch} from '@threadpeak/contracts/authors'
import result from './evidence/author-review-2026-09-09.json'
import '../src/styles.css'
import '../src/learning-v2/authors.css'
const brief=AuthorBriefSchema.parse({question:result.question})
const authors=result.selections.map((item,i)=>({...item,authorId:`qa-${i}`,summary:item.quote,quoteSummarized:false,known:false,topic:{id:'qa',title:'解码器',uses:0,helpful:0,score:0,pinned:false,hidden:false},history:[]} as AuthorMatch))
function Lab(){const [person,setPerson]=useState<number|null>(0);return <main style={{padding:24}}><h1>私聊内容验收</h1><p>真实公开搜索与模型样本；此页仅验收草稿，复制后仍需自行发送。</p>{authors.map((a,i)=><button key={i} onClick={()=>setPerson(i)}>查看{a.authorName}的私聊内容</button>)}{person!==null&&<PrepareAuthor searchId="qa-author-message-20260909" brief={brief} author={authors[person]!} onClose={()=>setPerson(null)}/>}</main>}
createRoot(document.getElementById('root')!).render(<Lab/> )
