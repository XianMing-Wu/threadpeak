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
export type SourceUse={key:string;topicId:string;topic:string;question:string;resourceId?:string;searchId?:string;carrierId?:string;carrier?:string;nodeIds:string[];nodeTitles?:Record<string,string>;nodeKinds?:Record<string,'root'|'article'|'answer'|'author'|'custom'>;questionKind?:'initial'|'follow_up';origin:'learning'|'author-card'|'conversation'|'search'|'collection'|'creation';discoveredAt:number;helpful:boolean}
export type NetworkEvidence=AuthorSource & {uses:SourceUse[]}
export type AuthorTopic={id:string;title:string;uses:number;helpful:number;score:number;pinned:boolean;hidden:boolean}
export type NetworkAuthor={id:string;name:string;identity:'platform'|'evidence';authorUrl?:string|null;evidence:NetworkEvidence[];topics:AuthorTopic[]}
export type AuthorNetwork={version:3;authors:NetworkAuthor[]}
export type AuthorMatch=AuthorSource & {
  fit:'direct'|'related';reason:string;canHelpWith:string;limitation:string;question:string;quote:string;quoteSummarized:boolean;
  known:boolean;topic:AuthorTopic;history:SourceUse[];messageBody?:string;
}
export type AuthorSearchState={version:3;brief:AuthorBrief;question:string;topic:string;topicId:string;needs:string[];candidates:AuthorMatch[];results:AuthorMatch[];unresolved:string;discoveredAt:number}
export const AuthorFeedbackSchema=z.object({authorId:Id,topicId:Id,evidenceId:Id.optional(),kind:z.enum(['helpful','pinned','hidden']),value:z.boolean()})

/** Relevance is a hard tier. Preference and exploration can only reorder within it. */
export function rankAuthorMatches(candidates:AuthorMatch[],useNetwork:boolean,newOnly=false):AuthorMatch[]{
  const pool=candidates.filter(c=>!c.topic.hidden&&(!newOnly||!c.known))
  const ordered=pool.map((c,index)=>({c,index})).sort((a,b)=>
    Number(a.c.fit!=='direct')-Number(b.c.fit!=='direct') ||
    (useNetwork?Number(b.c.topic.pinned)-Number(a.c.topic.pinned)||b.c.topic.score-a.c.topic.score:0)||a.index-b.index).map(x=>x.c)
  const ids=new Set<string>()
  const ranked=ordered.filter(c=>{
    if(ids.has(c.authorId))return false
    ids.add(c.authorId);return true
  })
  const selected=ranked.slice(0,3)
  const fresh=ranked.find(c=>!c.known)
  if(useNetwork&&!newOnly&&selected.length===3&&selected.every(c=>c.known)&&fresh&&fresh.fit===selected[2]!.fit)selected[2]=fresh
  return selected
}
export function consultationDraft(brief:AuthorBrief,author:Pick<AuthorMatch,'authorName'|'title'|'url'|'question'|'messageBody'>):string{
  const body=author.messageBody?.trim()||[
    brief.background&&`先说一下我的情况：${brief.background}`,
    brief.attempted&&`我已尝试：${brief.attempted}`,
    author.question||brief.question,
    brief.desiredOutcome&&`这次我希望：${brief.desiredOutcome}`,
  ].filter(Boolean).join('\n\n')
  return [
    `${author.authorName}，你好！看到你写过《${author.title}》，想向你请教一个相关问题。`,
    body,
    brief.purpose==='consult'?'想问问你是否开放咨询，方便帮我看看这个问题？如果合适，也想了解一下咨询方式、费用，以及我需要提前准备什么。谢谢！':'如果你对这个问题有研究或实践经验，想邀请你在知乎分享一下看法。不知道你是否方便？谢谢！',
    `相关内容：${author.url}`,
  ].join('\n\n')
}
export function authorLearningHref(resourceId:string,nodeId?:string){return `#knowledge-detail?resource=${encodeURIComponent(resourceId)}${nodeId?`&node=${encodeURIComponent(nodeId)}`:''}`}
