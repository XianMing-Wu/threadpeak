/** Lexical retrieval over the user's enrolled evidence. No invented semantic matches. */
export function retrieveNetwork<T extends {weight:string;body:{question:string;evidence:{authorId?:string|null;authorName?:string|null;title:string;summary:string}}}>(rows:T[],question:string):T[]{
  const terms=(text:string)=>new Set([...new Intl.Segmenter('zh',{granularity:'word'}).segment(text.toLowerCase())].filter(x=>x.isWordLike&&x.segment.length>1&&!['这个','什么','如何','哪些','怎么','一个','可以','请问','理解','问题','需要'].includes(x.segment)).map(x=>x.segment))
  const query=terms(question)
  const ranked=rows.map(row=>{
    if(row.body.question.trim()===question.trim())return {row,score:1}
    const text=terms(`${row.body.question} ${row.body.evidence.title}`)
    const overlap=[...query].filter(word=>text.has(word)).length
    return {row,score:query.size?overlap/query.size:0}
  }).filter(x=>x.score>=.5).sort((a,b)=>(a.row.weight==='high'?0:1)-(b.row.weight==='high'?0:1)||b.score-a.score)
  const ids=new Set(),names=new Set()
  return ranked.flatMap(({row})=>{
    const e=row.body.evidence
    if(!e.authorId||!e.authorName||ids.has(e.authorId)||names.has(e.authorName))return []
    ids.add(e.authorId);names.add(e.authorName);return [row]
  }).slice(0,3)
}
