import routeData from './routes.json' with {type:'json'}
import type {LearningState} from '@threadpeak/contracts/learning-v2'
type ConceptLearningSummary=NonNullable<LearningState['learningSummary']>

export const SHOWCASE_VERSION = '2026-09-09.1'
export type ShowcaseConcept = {
  id:string; title:string; purpose:string; depth:string; check:string;
  learningSummary:ConceptLearningSummary; hasDispute:boolean;
  sections:{title:string;text:string}[]; question:string;
}
type Interview={question:string;reason?:string;options:[string,string,string];answer:string}
export type ShowcaseRoute = {
  id:string; title:string; knowledgeTitle:string; prompt:string; startingPoint:string;
  outcome:string; summary:string; why:string; omitted:string; icon:'function'|'brain'|'layers'|'route'|'book';
  interview:Interview;interviews:Interview[];featuredConceptId:string;
  stages:{id:string;title:string;summary:string;conceptIds:string[]}[][];
  concepts:ShowcaseConcept[];
}
export const showcaseRoutes=routeData as ShowcaseRoute[]
export const homeSuggestions=[
 '我想要找到一份agent开发工程师的工作，但是我现在不知道该如何学，请帮我规划',
 '我想要快速理解transformer，请给我规划一下',
 '我想要自己可以使用强化学习对开源模型进行后训练，请给我一个学习路径',
 '我想要从零完整理解二维傅立叶变换和二维卷积之间的关联',
 '我想要学习如何理财，帮我系统规划一下',
 '想要系统的了解明代历史',
].map(prompt=>({label:prompt,prompt}))
export const showcaseRoute=(id:string)=>showcaseRoutes.find(r=>r.id===id)
export const showcaseConcept=(routeId:string,id:string)=>showcaseRoute(routeId)?.concepts.find(c=>c.id===id)
