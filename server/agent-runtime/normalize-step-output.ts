const record=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
const unique=<T>(values:T[]):T[]=>[...new Map(values.map(value=>[JSON.stringify(value),value])).values()]
const primaryKeys:Record<string,string>={R1:'queries',R2:'carriers',R3:'questions',R3b:'kind','L-search-plan':'queries','L-source-select':'evidenceIds','A-card-plan':'queries','A-card-select':'selections',N1:'queries',N2:'selections'}

/** Shape-only repairs at a generation boundary. No semantic labels, query
 * truncation, inferred answers, copied identities or fabricated evidence. */
export function normalizeStepOutput(name:string,value:unknown):unknown {
 const step=name.split(':')[0]!.replace(/^R2-names$/,'R2'),primary=primaryKeys[step]
 let root=record(value)
 if(!root||!primary)return value
 if(root[primary]===undefined){
  const candidates=['result','data','output'].map(key=>record(root![key])).filter(item=>item?.[primary]!==undefined)
  if(candidates.length===1)root=candidates[0]!
 }
 if(!root)return value
 const out={...root}
 // An omitted optional narrative does not invalidate verified selections.
 if(step==='N2'&&out.unresolved===undefined&&Array.isArray(out.selections))out.unresolved=''
 if(['L-search-plan','A-card-plan','N1'].includes(step)&&Array.isArray(out.queries))out.queries=unique(out.queries.map(q=>typeof q==='string'?q.trim():q))
 if(step==='L-source-select'&&Array.isArray(out.evidenceIds))out.evidenceIds=unique(out.evidenceIds.map(id=>typeof id==='string'?id.trim():id))
 if(['A-card-select','N2'].includes(step)&&Array.isArray(out.selections))out.selections=unique(out.selections)
 if(step==='R1'&&Array.isArray(out.queries)){
  const ids=out.queries.map(q=>record(q)?.id)
  if(ids.some(id=>typeof id!=='string'||!id.trim())||new Set(ids).size!==ids.length)out.queries=out.queries.map((q,i)=>record(q)?{...record(q),id:`Q${i+1}`}:q)
 }
 if((step==='R3'||step==='R3b'&&out.kind==='replace_questions')&&Array.isArray(out.questions)){
  const questions=out.questions,ids=questions.map(q=>record(q)?.id),optionIds=questions.flatMap(q=>Array.isArray(record(q)?.options)?(record(q)!.options as unknown[]).map(o=>record(o)?.id):[])
  const invalid=(values:unknown[])=>values.some(id=>typeof id!=='string'||!id.trim())||new Set(values).size!==values.length
  const round=out.round
  if((round===1||round===2||round===3)&&(invalid(ids)||invalid(optionIds))){
   out.questions=questions.map((q,i)=>{
    const question=record(q)
    if(!question)return q
    return {...question,id:`r${round}-q${i+1}`,options:Array.isArray(question.options)?question.options.map((o,j)=>record(o)?{...record(o),id:`r${round}-q${i+1}-o${j+1}`}:o):question.options}
   })
  }
 }
 return out
}
