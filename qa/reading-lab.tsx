import {SourceReading} from '../src/learning-v2/SourcePresentation'
import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import {MarkdownMath} from '../src/lib/MarkdownMath'
import {readingCorpus} from '@threadpeak/contracts/reading-corpus'
import 'katex/dist/katex.min.css'
import '../src/styles.css'
import '../src/ui/flowith-product.css'

function Lab(){
 const [narrow,setNarrow]=useState(false)
 return <main style={{padding:24,maxWidth:1100,margin:'auto',color:'#625970',fontFamily:'system-ui'}}>
  <div id="actual-reading"/>
  <h1 style={{fontSize:22}}>阅读渲染异常样例</h1><p>只运行真实阅读组件；不调用搜索、不写入学习记录。原始样例与预期保留在代码中。</p>
  <label><input type="checkbox" checked={narrow} onChange={e=>setNarrow(e.target.checked)}/>窄卡片（320px）</label>
  <div style={{display:'grid',gap:24,marginTop:24}}>{readingCorpus.map(sample=><section key={sample.id} id={sample.id} style={{maxWidth:narrow?320:780,minWidth:0,padding:20,border:'1px solid #e5dfeb',borderRadius:12,background:'white'}}>
   <h2 style={{fontSize:16}}>{sample.id} · {sample.label}</h2><MarkdownMath source={sample.source} sourceExcerpt/>
   <details style={{marginTop:16,fontSize:12,color:'#95879f'}}><summary>原始输入</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{sample.source}</pre></details>
  </section>)}</div>
 </main>
}
createRoot(document.getElementById('root')!).render(<Lab/> )

export function mountActual(article:{title:string;summary:string;url:string}){
 const root=document.getElementById('actual-reading')!
 createRoot(root).render(<section id="actual-source" style={{maxWidth:780,padding:20,border:'1px solid #dfe1e5',borderRadius:12,background:'white'}}><h1>{article.title}</h1><SourceReading source={article.summary} url={article.url}/></section>)
}

// Use the already-mounted module for replay; importing the page entry again can
// create a second React root and erase the source panel during QA.
declare global { interface Window { mountReadingArticle: typeof mountActual } }
window.mountReadingArticle=mountActual
