import { ProductWorkspace } from '../components/Shell'
import { MarkdownMath } from '../lib/MarkdownMath'
import { getReadOnlyConceptGraph, getReadOnlyKnowledgeByRoute, readWorkspace } from '../workspace/store'

/** Old records are an immutable archive. Opening them performs no requests or writes. */
export function MineGraphCanvasPage({ routeId, conceptId }: {routeId:string;conceptId:string}) {
  const knowledge=getReadOnlyKnowledgeByRoute(routeId)
  const graph=knowledge?getReadOnlyConceptGraph(knowledge.id,conceptId):undefined
  const conversations=readWorkspace().conversations.filter(c=>c.routeId===routeId&&c.conceptId===conceptId)
  return <ProductWorkspace active="knowledge" page="knowledge-detail"><main className="query-chat">
    <header className="query-chat-header"><h1>{knowledge?.title??'旧版知识脉络'} · 只读归档</h1><button onClick={()=>{location.hash='knowledge'}}>返回知识脉络</button></header>
    <section className="query-chat-body"><p>这里保留旧版的卡片与对话。新的学习内容从“我的路线”进入。</p>
      {graph?.nodes.map(node=><article className="chat-answer" key={node.id}><h2>{node.title}</h2>{node.turns.map((turn,index)=><MarkdownMath key={index} source={turn.paragraphs.join('\n\n')}/>)}</article>)}
      {conversations.map(c=><details key={c.id}><summary>{c.title}</summary>{c.turns.map((turn,index)=><article key={index}><strong>{turn.role==='user'?'我':'刘看山'}</strong><MarkdownMath source={turn.text}/></article>)}</details>)}
      {!graph&&!conversations.length&&<p>没有找到这份旧版内容，已保留现有本地记录。</p>}
    </section>
  </main></ProductWorkspace>
}
