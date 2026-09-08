import {isMockZhihuOwner,isMockZhihuUrl} from './zhihu-oauth-mock.ts'
import type { AuthorNetwork, AuthorSource, AuthorTopic, NetworkAuthor, SourceUse } from '@threadpeak/contracts/authors'
import type { GraphNode, LearningState } from '@threadpeak/contracts/learning-v2'
import { isLiuKanshanName } from '../ports.ts'
import type { Sql } from './database.ts'
import { digest, type Resource } from './store.ts'

export const learningTopic=(id:string)=>`learning:${id}`
export function safeZhihuUrl(raw:unknown,allowDemo=false):string|undefined{
  if(typeof raw!=='string')return
  if(allowDemo&&isMockZhihuUrl(raw))return raw
  try{const u=new URL(raw);if(u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='zhihu.com'||u.hostname.endsWith('.zhihu.com')))return u.href}catch{}
}
export function canonicalContentUrl(url:string){const u=new URL(url);u.search='';u.hash='';return u.href}
/** Only an exact published-content match can resolve a search result's missing author ID. */
export function knownSourceIdentity<T extends {url:string;authorId:string|null;authorName?:string|null;authorUrl?:string|null}>(source:T,network:AuthorNetwork):T{
  if(!source.authorId?.startsWith('author-ev-'))return source
  const authors=network.authors.filter(a=>a.identity==='platform'&&a.evidence.some(e=>canonicalContentUrl(e.url)===canonicalContentUrl(source.url)))
  if(authors.length!==1)return source
  return {...source,authorId:authors[0]!.id,authorName:authors[0]!.name,authorUrl:authors[0]!.authorUrl}
}
function validSource(raw:any,allowDemo=false):AuthorSource|undefined{
  if(raw?.sourceKind==='web')return
  if(!raw?.evidenceId||!raw.authorId||!raw.authorName||isLiuKanshanName(raw.authorName)||!safeZhihuUrl(raw.url,allowDemo))return
  return {...Object.fromEntries(['avatar','badge','badgeIcon','likes','commentCount','editedAt','contentType','contentId','authorityLevel','rankingScore','comments','sourceKind','site'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]])),evidenceId:raw.evidenceId,authorId:raw.authorId,authorName:raw.authorName,title:raw.title||'知乎文章',summary:raw.summary??'',url:raw.url,authorUrl:safeZhihuUrl(raw.authorUrl,allowDemo)}
}
/** One immutable-state lookup, with path compression; never cache across edits. */
export function sourceLookup(state:LearningState,allowDemo=false){
  const byId=new Map(state.nodes.map(n=>[n.id,n])),articles=new Map(state.articles.map(a=>[a.id,a]))
  const originals=new Map(state.conversations.flatMap(c=>c.messages.flatMap(m=>m.paragraphs??[])).map(p=>[p.id,p]))
  const cache=new Map<string,AuthorSource|undefined>()
  return (id:string):AuthorSource|undefined=>{
    const path:string[]=[],seen=new Set<string>();let node=byId.get(id),source:AuthorSource|undefined
    while(node&&!seen.has(node.id)){
      if(cache.has(node.id)){source=cache.get(node.id);break}
      seen.add(node.id);path.push(node.id)
      if(node.type==='custom'||node.type==='root')break
      if(node.type==='article'){
        const article=articles.get(node.id);source=article?validSource({...article,evidenceId:article.id,authorName:article.author},allowDemo):undefined;break
      }
      if(node.type==='author'&&node.author){
        const original=originals.get(node.id)
        source=validSource({evidenceId:node.author.evidenceId,authorId:node.author.id,authorName:node.author.name,title:original?.title??node.title,summary:original?.text??node.text,url:node.author.url,authorUrl:node.author.authorUrl,avatar:node.author.avatar,badge:node.author.badge},allowDemo);break
      }
      node=byId.get(node.parents[0]??'')
    }
    for(const key of path)cache.set(key,source)
    return source
  }
}
export function sourceForNode(state:LearningState,id:string,allowDemo=false):AuthorSource|undefined{return sourceLookup(state,allowDemo)(id)}

type Preference={author_id:string;topic_id:string;evidence_id:string;kind:'helpful'|'pinned'|'hidden';value:boolean}
type Usage={author_id:string;topic_id:string;amount:number;created_at:number}

/** Read model over persisted evidence and current cards. Deleted cards never remain as backlinks. */
export async function readAuthorNetwork(db:Sql,owner:string):Promise<AuthorNetwork>{
  const allowDemo=isMockZhihuOwner(owner)
  const [learning,legacy,prefs,usage,paths,materials]=await Promise.all([
    db.query<Resource<LearningState>>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='learning' ORDER BY updated_at DESC",[owner]),
    db.query<{body:any}>('SELECT body FROM tp_author_network WHERE owner_id=$1 UNION ALL SELECT body FROM tp_author_discoveries WHERE owner_id=$1',[owner]),
    db.query<Preference>('SELECT * FROM tp_author_preferences WHERE owner_id=$1',[owner]),
    db.query<Usage>('SELECT author_id,topic_id,amount,created_at FROM tp_author_usage WHERE owner_id=$1',[owner]),
    db.query<Resource<any>>("SELECT id,jsonb_build_object('document',jsonb_build_object('id',body->'document'->'id'),'route',body->'route') AS body FROM tp_resources WHERE owner_id=$1 AND kind='path'",[owner]),
    db.query<Resource<any>>("SELECT id,created_at,jsonb_build_object('fileName',body->'fileName','origin',body->'origin','entries',body->'entries') AS body FROM tp_resources WHERE owner_id=$1 AND kind='attachment' AND body->>'status'='ready'",[owner]),
  ])
  const authorities=new Map<string,any[]>()
  for(const material of materials)for(const entry of material.body.entries??[])if(entry.authorId&&safeZhihuUrl(entry.url,allowDemo)){const url=canonicalContentUrl(entry.url),list=authorities.get(url)??[];if(!list.some(e=>e.authorId===entry.authorId))list.push(entry);authorities.set(url,list)}
  const aliases=new Map<string,string>(),authors=new Map<string,NetworkAuthor>()
  function add(raw:any,use:Omit<SourceUse,'key'|'helpful'>){
    let source=validSource(raw,allowDemo);if(!source)return
    const identities=authorities.get(canonicalContentUrl(source.url))
    if(source.authorId.startsWith('author-ev-')&&identities?.length===1){const e=identities[0];aliases.set(source.authorId,e.authorId);source={...source,authorId:e.authorId,authorName:e.authorName??source.authorName,authorUrl:e.authorUrl}}
    let author=authors.get(source.authorId)
    if(!author){author={id:source.authorId,name:source.authorName,identity:source.authorId.startsWith('author-ev-')?'evidence':'platform',authorUrl:source.authorUrl,evidence:[],topics:[]};authors.set(author.id,author)}
    if(source.authorUrl)author.authorUrl=source.authorUrl
    let evidence=author.evidence.find(e=>e.evidenceId===source.evidenceId)
    if(!evidence){evidence={...source,uses:[]};author.evidence.push(evidence)}
    const key=digest({topic:use.topicId,evidence:source.evidenceId,origin:use.origin,question:use.question,searchId:use.searchId})
    const old=evidence.uses.find(u=>u.key===key)
    if(old){old.nodeIds=[...new Set([...old.nodeIds,...use.nodeIds])];old.nodeTitles={...old.nodeTitles,...use.nodeTitles};return}
    evidence.uses.push({...use,key,helpful:prefs.some(p=>p.author_id===author.id&&p.topic_id===use.topicId&&p.kind==='helpful'&&p.evidence_id===source.evidenceId&&p.value)})
    if(!author.topics.some(t=>t.id===use.topicId))author.topics.push({id:use.topicId,title:use.topic,uses:0,helpful:0,score:0,pinned:false,hidden:false})
  }
  for(const resource of learning){
    const state=resource.body,topicId=learningTopic(resource.id),lookup=sourceLookup(state,allowDemo),nodesById=new Map(state.nodes.map(n=>[n.id,n]))
    const route=paths.find(p=>p.id===state.routeId||p.body.document?.id===state.routeId||p.body.route?.routeId===state.routeId)?.body.route
    const concept=route?.concepts?.find((c:any)=>c.id===state.conceptId),carrier=route?.carriers?.find((c:any)=>c.id===concept?.carrierId)
    const context={topicId,topic:state.title,resourceId:resource.id,carrierId:carrier?`${state.routeId}:${carrier.id}`:undefined,carrier:carrier?.title,discoveredAt:resource.created_at}
    const titles=(ids:string[])=>Object.fromEntries(ids.map(id=>[id,nodesById.get(id)?.title??'知识卡片']))
    const sources=new Map<string,{source:AuthorSource;nodes:string[]}>()
    for(const node of state.nodes){const source=lookup(node.id);if(!source)continue;const existing=sources.get(source.evidenceId);if(existing)existing.nodes.push(node.id);else sources.set(source.evidenceId,{source,nodes:[node.id]})}
    for(const {source,nodes} of sources.values())add(source,{...context,question:'',nodeIds:nodes,nodeTitles:titles(nodes),origin:state.articles.some(a=>a.id===source.evidenceId)?'learning':'author-card'})
    // Questions are relationships, not preference points. Include archived conversations,
    // but link only cards that still exist in the current tree.
    for(const chat of state.conversations){
      let question=''
      for(const message of chat.messages){
        if(message.role==='user'){question=message.text??'';continue}
        if(!question)continue
        for(const paragraph of message.paragraphs??[]){
          const source=lookup(paragraph.id)
          if(source)add(source,{...context,question,nodeIds:[paragraph.id],nodeTitles:titles([paragraph.id]),origin:'conversation'})
        }
      }
    }
  }
  for(const material of materials)for(const entry of material.body.entries??[]){
    add({evidenceId:`material-${digest({sourceId:material.id,url:entry.url}).slice(0,32)}`,authorId:entry.authorId,authorName:entry.authorName,title:entry.title,summary:entry.summary,url:entry.url,authorUrl:entry.authorUrl},
      {topicId:`material:${material.id}`,topic:material.body.fileName,question:'',nodeIds:[],origin:material.body.origin==='creation'?'creation':'collection',discoveredAt:material.created_at})
  }
  for(const {body} of legacy){
    const linked=body.resourceId?learning.find(r=>r.id===body.resourceId):learning.find(r=>body.conceptId&&r.body.conceptId===body.conceptId&&r.body.routeId===body.routeId)
    // A migrated card relation is represented above, not as a fabricated old positive feedback.
    if(linked&&authors.get(body.evidence?.authorId)?.evidence.some(e=>e.evidenceId===body.evidence.evidenceId))continue
    add(body.evidence,{topicId:body.topicId??`question:${digest(body.question??'')}`,topic:body.topic??body.conceptTitle??body.question??'已发现的资料',question:body.question??'',searchId:body.searchId,nodeIds:[],origin:'search',discoveredAt:body.discoveredAt??0})
  }
  for(const row of [...prefs,...usage])row.author_id=aliases.get(row.author_id)??row.author_id
  for(const author of authors.values())for(const evidence of author.evidence)for(const use of evidence.uses)use.helpful=prefs.some(p=>p.author_id===author.id&&p.topic_id===use.topicId&&p.evidence_id===evidence.evidenceId&&p.kind==='helpful'&&p.value)
  for(const author of authors.values())for(const topic of author.topics){
    const events=usage.filter(u=>u.author_id===author.id&&u.topic_id===topic.id)
    topic.uses=events.length
    const daily=new Map<number,number>();for(const e of events){const day=Math.floor(e.created_at/86400000);daily.set(day,(daily.get(day)??0)+Number(e.amount))}
    topic.helpful=prefs.filter(p=>p.author_id===author.id&&p.topic_id===topic.id&&p.kind==='helpful'&&p.value).length
    topic.score=Math.min(12,[...daily.values()].reduce((s,n)=>s+Math.min(3,n),0))+Math.min(12,topic.helpful*2)
    topic.pinned=prefs.some(p=>p.author_id===author.id&&p.topic_id===topic.id&&p.kind==='pinned'&&p.value)
    topic.hidden=prefs.some(p=>p.author_id===author.id&&p.topic_id===topic.id&&p.kind==='hidden'&&p.value)
  }
  return {version:3,authors:[...authors.values()]}
}
export function matchTopic(author:NetworkAuthor|undefined,topicId:string,title:string):AuthorTopic{
  return author?.topics.find(t=>t.id===topicId)??{id:topicId,title,uses:0,helpful:0,score:0,pinned:false,hidden:false}
}

/** Outside a learning concept, only the recalled article's own history can supply
 * a preference. An author's unrelated expertise never supplies a global score. */
export function sourceTopic(author:NetworkAuthor|undefined,evidenceId:string,topicId:string,title:string,explicitConcept=false):AuthorTopic{
  const exact=author?.topics.find(t=>t.id===topicId)
  if(exact||explicitConcept)return exact??matchTopic(undefined,topicId,title)
  const relatedIds=new Set(author?.evidence.find(e=>e.evidenceId===evidenceId)?.uses.map(u=>u.topicId)??[])
  const topics=author?.topics.filter(t=>relatedIds.has(t.id)).sort((a,b)=>Number(a.hidden)-Number(b.hidden)||Number(b.pinned)-Number(a.pinned)||b.score-a.score)??[]
  return topics[0]??matchTopic(undefined,topicId,title)
}

/** Exactly one successful explicitly scoped command, shared across the actual source authors. */
export async function recordAuthorUse(tx:Sql,owner:string,resourceId:string,jobId:string,state:LearningState,selected:string[],paragraphs:{basisId:string}[]){
  if(!selected.length)return
  const used=new Map<string,{evidenceIds:Set<string>;basisIds:Set<string>}>(),lookup=sourceLookup(state,isMockZhihuOwner(owner))
  for(const p of paragraphs){
    if(!selected.includes(p.basisId))continue
    const source=lookup(p.basisId);if(!source)continue
    const item=used.get(source.authorId)??{evidenceIds:new Set<string>(),basisIds:new Set<string>()}
    item.evidenceIds.add(source.evidenceId);item.basisIds.add(p.basisId);used.set(source.authorId,item)
  }
  const question=state.conversations.flatMap(c=>c.messages).find(m=>m.id===`question-${jobId}`)?.text??''
  for(const [authorId,item] of used)await tx.query(`INSERT INTO tp_author_usage(owner_id,event_key,author_id,topic_id,amount,body,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT DO NOTHING`,[owner,jobId,authorId,learningTopic(resourceId),1/used.size,JSON.stringify({resourceId,jobId,question,evidenceIds:[...item.evidenceIds],basisIds:[...item.basisIds]}),Date.now()])
}

/** Group in the existing carrier/concept/question/author visual vocabulary; IDs stay lossless. */
export function nodeSources(state:LearningState,nodes:GraphNode[]){const lookup=sourceLookup(state);return nodes.map(n=>({nodeId:n.id,source:lookup(n.id)})).filter(x=>x.source)}
