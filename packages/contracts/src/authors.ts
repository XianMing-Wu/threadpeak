import { z } from 'zod'
import type { SearchMetadata } from './search-scope'

const Id=z.string().min(1).max(240)
export const AuthorBriefSchema=z.object({
  question:z.string().trim().min(1).max(20000), purpose:z.enum(['consult','invite']).default('consult'),
  background:z.string().max(12000).default(''), attempted:z.string().max(12000).default(''), desiredOutcome:z.string().max(12000).default(''),
  useNetwork:z.boolean().default(true), newOnly:z.boolean().default(false), depth:z.enum(['fast','deep']).default('fast'),
  learningId:Id.optional(), selected:z.array(Id).max(200).default([]),
})
export type AuthorBrief=z.infer<typeof AuthorBriefSchema>
export type AuthorSource=SearchMetadata & {evidenceId:string;authorId:string;authorName:string;title:string;summary:string;url:string;authorUrl?:string|null}
export type SourceUse={key:string;topicId:string;topic:string;question:string;resourceId?:string;searchId?:string;carrierId?:string;carrier?:string;nodeIds:string[];nodeTitles?:Record<string,string>;origin:'learning'|'author-card'|'conversation'|'search'|'collection'|'creation';discoveredAt:number;helpful:boolean}
export type NetworkEvidence=AuthorSource & {uses:SourceUse[]}
export type AuthorTopic={id:string;title:string;uses:number;helpful:number;score:number;pinned:boolean;hidden:boolean}
export type NetworkAuthor={id:string;name:string;identity:'platform'|'evidence';authorUrl?:string|null;evidence:NetworkEvidence[];topics:AuthorTopic[]}
export type AuthorNetwork={version:3;authors:NetworkAuthor[]}
export type AuthorMatch=AuthorSource & {
  fit:'direct'|'related';reason:string;canHelpWith:string;limitation:string;question:string;quote:string;quoteSummarized:boolean;
  known:boolean;topic:AuthorTopic;history:SourceUse[];
}
export type AuthorSearchState={version:3;brief:AuthorBrief;question:string;topic:string;topicId:string;needs:string[];candidates:AuthorMatch[];results:AuthorMatch[];unresolved:string;discoveredAt:number}
export const AuthorFeedbackSchema=z.object({authorId:Id,topicId:Id,evidenceId:Id.optional(),kind:z.enum(['helpful','pinned','hidden']),value:z.boolean()})

/** Relevance is a hard tier. Preference and exploration can only reorder within it. */
export function rankAuthorMatches(candidates:AuthorMatch[],useNetwork:boolean,newOnly=false):AuthorMatch[]{
  const pool=candidates.filter(c=>!c.topic.hidden&&(!newOnly||!c.known))
  const ordered=pool.map((c,index)=>({c,index})).sort((a,b)=>
    Number(a.c.fit!=='direct')-Number(b.c.fit!=='direct') ||
    (useNetwork?Number(b.c.topic.pinned)-Number(a.c.topic.pinned)||b.c.topic.score-a.c.topic.score:0)||a.index-b.index).map(x=>x.c)
  const ids=new Set<string>(),names=new Map<string,string>()
  const ranked=ordered.filter(c=>{
    const same=names.get(c.authorName)
    if(ids.has(c.authorId)||same&&(same.startsWith('author-ev-')||c.authorId.startsWith('author-ev-')))return false
    ids.add(c.authorId);names.set(c.authorName,c.authorId);return true
  })
  const selected=ranked.slice(0,3)
  const fresh=ranked.find(c=>!c.known)
  if(useNetwork&&!newOnly&&selected.length===3&&selected.every(c=>c.known)&&fresh&&fresh.fit===selected[2]!.fit)selected[2]=fresh
  return selected
}
export function consultationDraft(brief:AuthorBrief,author:Pick<AuthorMatch,'authorName'|'title'|'url'|'question'>):string{
  return `${brief.purpose==='invite'?'知乎提问 / 邀请回答草稿':'请教简报'}\n\n${brief.question}\n\n${brief.background?`背景：${brief.background}\n\n`:''}${brief.attempted?`我已尝试：${brief.attempted}\n\n`:''}${brief.desiredOutcome?`希望得到：${brief.desiredOutcome}\n\n`:''}想请教 ${author.authorName}：\n我读到了你的《${author.title}》（${author.url}）。\n${author.question}\n\n${brief.purpose==='consult'?'想先确认这个问题是否在你的咨询范围内，以及是否开放咨询、所需材料和费用。':'如果这个问题在你的研究或实践范围内，希望能听到你的看法。'}`
}
export function authorLearningHref(resourceId:string,nodeId?:string){return `#knowledge-detail?resource=${encodeURIComponent(resourceId)}${nodeId?`&node=${encodeURIComponent(nodeId)}`:''}`}
