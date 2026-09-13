import type {LearningGoal} from '@threadpeak/contracts/learning-goal'
import {StagedPlanSchema,compileStagedPlan,type StagedPlan} from './staged-plan.ts'
import {projectRouteToDocument} from './project-document.ts'

type RecordValue=Record<string,unknown>
const object=(v:unknown):RecordValue=>v&&typeof v==='object'&&!Array.isArray(v)?v as RecordValue:{}
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const text=(v:unknown,max=1200)=>typeof v==='string'?v.trim().slice(0,max):''
const first=(v:RecordValue,...keys:string[])=>keys.map(k=>v[k]).find(x=>x!==undefined)
const title=(v:unknown)=>typeof v==='string'?text(v,160):text(first(object(v),'title','name','label','标题','名称'),160)
const normalize=(s:string)=>s.normalize('NFC').replace(/\s+/gu,'')

/** Bounded, data-only recovery. No eval; strings and completed members survive EOF.
 * This parser is exclusive to route recovery, never used for commands or identity. */
export function readDamagedPlan(source:string):unknown[] {
  const input=source.slice(0,1_000_000),roots:unknown[]=[]
  let i=0,operations=0
  const skip=()=>{while(i<input.length&&/\s/.test(input[i]!))i++}
  function string(){
    const quote=input[i++]!,start=i-1
    let value=''
    while(i<input.length){
      const c=input[i++]!
      if(c===quote){
        if(quote==='"'){try{return JSON.parse(input.slice(start,i)) as string}catch{/* Retain readable text below. */}}
        return value
      }
      if(c==='\\'&&i<input.length){
        const next=input[i++]!
        const escape:Record<string,string>={n:'\n',r:'\r',t:'\t','"':'"',"'":"'",'\\':'\\','/':'/'}
        value+=escape[next]??`\\${next}`
      }else value+=c
    }
    return value
  }
  function value(depth=0):unknown {
    skip()
    if(depth>80||++operations>100000){i=input.length;return undefined}
    const c=input[i]
    if(c==='"'||c==="'")return string()
    if(c==='{'||c==='['){
      i++;const list=c==='[',out:unknown[]=[],record:RecordValue=Object.create(null),close=list?']':'}'
      while(i<input.length){
        skip();if(input[i]===close){i++;break}
        if(input[i]===','||input[i]===';'){i++;continue}
        // A missing closing bracket must not consume the enclosing container.
        if(input[i]===']'||input[i]==='}')break
        const start=i
        if(list){const item=value(depth+1);if(item!==undefined)out.push(item)}
        else{
          let key:string
          if(input[i]==='"'||input[i]==="'")key=string()
          else{const from=i;while(i<input.length&&!/[:\s,{}\[\]]/.test(input[i]!))i++;key=input.slice(from,i)}
          skip()
          if(input[i]!==':'){if(i===start)i++;continue}
          i++;const item=value(depth+1)
          if(key&&item!==undefined)record[key]=item
        }
        if(i===start)i++
      }
      return list?out:record
    }
    const start=i
    while(i<input.length&&!/[,}\]\n]/.test(input[i]!))i++
    const raw=input.slice(start,i).trim()
    if(raw==='true')return true
    if(raw==='false')return false
    if(raw==='null')return null
    if(/^-?\d+(?:\.\d+)?$/.test(raw))return Number(raw)
    return raw||undefined
  }
  while(i<input.length&&roots.length<64){
    if(input[i]==='{'||input[i]==='['){const start=i;roots.push(value());if(i===start)i++}else i++
  }
  return roots
}

export type RecoveryInput={goal?:unknown;goalContext?:unknown;attachments?:{ref:string;sourceId:string;fileName:string;content:string}[]}
type Carrier=StagedPlan['stages'][number][number]
type Concept=Carrier['concepts'][number]

/** Size repair stays inside each carrier; it must not erase confirmed branches. */
function compactStageConcepts(stages:Carrier[][]):Carrier[][]{
  const carriers=stages.flat(),limits=carriers.map(c=>Math.min(12,c.concepts.length))
  while(limits.reduce((a,b)=>a+b,0)>64){
    const index=limits.indexOf(Math.max(...limits));limits[index]!--
  }
  let index=0
  return stages.map(stage=>stage.map(c=>{
    const limit=limits[index++]!
    if(c.concepts.length<=limit)return c
    const concepts:Concept[]=[]
    for(let n=0;n<limit;n++){
      const group=c.concepts.slice(Math.floor(n*c.concepts.length/limit),Math.floor((n+1)*c.concepts.length/limit)),head=group[0]!
      concepts.push(group.length===1?head:{...head,title:group.map(v=>v.title).join(' · ').slice(0,160),description:group.map(v=>`${v.title}\n${v.description}`).join('\n\n').slice(0,6000)})
    }
    return {...c,concepts}
  }))
}

function packLinearCarriers(carriers:Carrier[]):Carrier[][]{
  const all=carriers.flatMap(c=>c.concepts),groupSize=Math.max(1,Math.ceil(all.length/64)),merged:Concept[]=[]
  for(let i=0;i<all.length;i+=groupSize){
    const group=all.slice(i,i+groupSize),head=group[0]!
    merged.push(group.length===1?head:{...head,title:group.map(c=>c.title).join(' · ').slice(0,160),description:group.map(c=>`${c.title}\n${c.description}`).join('\n\n').slice(0,6000)})
  }
  const stages:Carrier[][]=[]
  for(let i=0;i<merged.length;i+=4)stages.push([{title:merged[i]!.title,description:`按当前目标顺序学习本阶段的${merged.slice(i,i+4).length}项内容。`,concepts:merged.slice(i,i+4)}])
  return stages
}

export function recoverPlan(raw:unknown,input:RecoveryInput):{plan:StagedPlan;basis:'extracted'|'goal';linear:boolean}{
  const context=object(input.goalContext),rawGoal=text(context.rawGoal,6000)||text(input.goal,6000)||'整理当前学习目标'
  const statements=[rawGoal,...array(context.userStatements).map(s=>text(object(s).text,6000))].filter(Boolean)
  const roots=typeof raw==='string'?readDamagedPlan(raw):[raw]
  const candidates=[...roots]
  for(const root of roots)for(const key of ['route','plan','path','data','result'])if(object(root)[key])candidates.push(object(root)[key])
  const root=candidates.find(v=>array(object(v).stages).length||array(object(v).carriers).length||array(object(v).concepts).length)||candidates.find(Array.isArray)||candidates[0]
  const record=object(root),files=input.attachments??[]
  const originalGoal=object(record.learningGoal)
  const strings=(v:unknown)=>array(v).map(x=>text(x)).filter(Boolean).slice(0,12)
  const verified=(v:unknown)=>strings(v).filter(s=>statements.some(p=>normalize(p).includes(normalize(s))))
  const goal:LearningGoal={
    outcome:text(originalGoal.outcome)||text(rawGoal),motivation:verified([originalGoal.motivation])[0]??'',
    startingPoint:verified([originalGoal.startingPoint])[0]??'',successCriteria:strings(originalGoal.successCriteria),
    constraints:verified(originalGoal.constraints),nonGoals:verified(originalGoal.nonGoals),assumptions:[],openQuestions:strings(originalGoal.openQuestions),
  }
  if(!goal.successCriteria.length)goal.successCriteria=[`对照目标检查自己的理解或实际结果：${rawGoal}`.slice(0,1200)]
  let missingAnchors=false
  function concept(value:unknown,carrierTitle:string):Concept|undefined {
    const v=object(value),name=title(value)
    if(!name)return undefined
    const description=text(first(v,'description','detailedDescription','summary','说明'),6000)||`围绕“${rawGoal}”学习${name}。`.slice(0,6000)
    const a=object(v.goalAlignment),summary=object(v.learningSummary)
    const anchors:NonNullable<Concept['goalAlignment']>['materialAnchors']=[]
    for(const item of array(a.materialAnchors)){
      const anchor=object(item),ref=text(anchor.ref),quote=text(anchor.quote),connection=text(anchor.connection),file=files.find(f=>f.ref===ref)
      if(file&&quote.length>=4&&connection&&(anchor.role==='direct'||anchor.role==='prerequisite')&&normalize(file.content).includes(normalize(quote)))anchors.push({ref,quote,connection,role:anchor.role})
      if(anchors.length===8)break
    }
    if(files.length&&!anchors.length)missingAnchors=true
    const purpose=text(a.purpose)||`用${name}推进当前目标：${rawGoal}`.slice(0,1200)
    const depth=text(a.depth)||text(description)
    const successCheck=text(a.successCheck)||`结合${name}解释或完成目标中对应的一步，并指出仍需核实的部分。`.slice(0,1200)
    return {title:name,description,hasDispute:v.hasDispute===true,attachmentRefs:[...new Set(anchors.map(a=>a.ref))],
      goalAlignment:{purpose,depth,successCheck,materialAnchors:anchors},
      learningSummary:{focus:text(summary.focus)||text(description),boundary:text(summary.boundary)||depth,
        routeConnection:text(summary.routeConnection)||`在“${carrierTitle}”中按列出的顺序推进，为目标中的相关任务提供支持。`.slice(0,1200),
        materialConnection:anchors.length?(text(summary.materialConnection)||anchors.map(a=>a.connection).join('；').slice(0,1200)):files.length?'已保留本次全部资料，当前概念与具体片段的关系需在学习时核对。':'本次没有上传资料，按用户目标确定学习范围。'}}
  }
  function carrier(value:unknown):Carrier|undefined {
    const v=object(value),name=title(value)
    const global=array(record.concepts).filter(c=>object(c).carrierId!==undefined&&object(c).carrierId===v.id)
    const values=array(first(v,'concepts','nodes','topics','知识点')).length?array(first(v,'concepts','nodes','topics','知识点')):global
    const concepts=values.map(c=>concept(c,name||title(c))).filter((c):c is Concept=>!!c)
    if(!concepts.length){const self=concept(value,name);if(self)concepts.push(self)}
    if(!concepts.length)return undefined
    return {title:name||concepts[0]!.title,description:text(first(v,'description','summary','说明'),500)||`围绕${name||concepts[0]!.title}推进当前学习目标。`.slice(0,500),concepts}
  }
  let stages:Carrier[][]=[],linear=true
  const rawStages=array(record.stages)
  if(rawStages.length){
    for(const stage of rawStages){
      const s=object(stage),items=Array.isArray(stage)?stage:array(s.carriers).length?array(s.carriers):[stage]
      const carriers=items.map(carrier).filter((c):c is Carrier=>!!c)
      const explicitParallel=s.parallel===true||s.parallel===1||typeof s.parallel==='string'&&/^(?:true|parallel|并列|并行)$/i.test(s.parallel.trim())||Array.isArray(stage)
      if(explicitParallel&&carriers.length===2){stages.push(carriers);linear=false}else stages.push(...carriers.map(c=>[c]))
    }
  }else{
    const items=Array.isArray(root)?root:array(record.carriers).length?array(record.carriers):array(record.concepts)
    stages=items.map(carrier).filter((c):c is Carrier=>!!c).map(c=>[c])
  }
  if(!stages.length&&typeof raw==='string'){
    const names=raw.split('\n').map(l=>/^\s*(?:#{1,6}\s+|[-*]\s+|\d+[.、)]\s*)([^{}\[\]]{1,160})$/.exec(l)?.[1]).filter((s):s is string=>!!s)
    stages=names.slice(0,64).map(carrier).filter((c):c is Carrier=>!!c).map(c=>[c])
  }
  const basis=stages.length?'extracted':'goal'
  if(!stages.length)stages=[[carrier({title:text(rawGoal,160),description:rawGoal})!]]
  // A renderer has finite capacity. Merge adjacent overflow, preserving their
  // order and text, rather than dropping a random suffix or inventing dependencies.
  if(stages.length>16||stages.flat().length>24){
    stages=packLinearCarriers(stages.flat())
    linear=true
  }else stages=compactStageConcepts(stages)
  if(missingAnchors&&!goal.openQuestions.includes('部分概念与所选资料的具体片段关系需在学习时核对。'))goal.openQuestions=[...goal.openQuestions.slice(0,11),'部分概念与所选资料的具体片段关系需在学习时核对。']
  const plan=StagedPlanSchema.parse({title:title(record)||text(rawGoal,160),learningGoal:goal,stages})
  return {plan,basis,linear}
}

/** The same projection used at publication is the final structural gate. */
export function compileRecoveredPlan(plan:StagedPlan,scope:string,sourceIds:string[],summarizedRefs:ReadonlySet<string>){
  let route=compileStagedPlan(plan,scope,sourceIds,summarizedRefs)
  if(projectRouteToDocument(route).ok)return route
  const linear={...plan,stages:plan.stages.flat().map(c=>[c])}
  // More than 16 sequential carriers are packed by the same bounded normalizer.
  const normalized=linear.stages.length<=16?linear:{...linear,stages:packLinearCarriers(linear.stages.flat())}
  route=compileStagedPlan(normalized,scope,sourceIds,summarizedRefs)
  return route
}
