import { LearningSchema, validateTree, type LearningState, type GraphNode, type Paragraph } from '../../packages/contracts/src/learning-v2.ts'

// Catalog notes are examples, never a replacement for a provider result or a real author.
export function exampleLearning(input:{id:string;routeId:string;conceptId:string;title:string;notes:{title:string;paragraphs:readonly string[]}[]}):LearningState {
  const articles=input.notes.map((note,i)=>({id:`example-source-${i}`,title:`${note.title} · 示例笔记`,summary:note.paragraphs.join('\n\n'),author:'示例资料',authorId:null,likes:null,topic:input.title}))
  const paragraphs:Paragraph[]=input.notes.flatMap((note,i)=>note.paragraphs.map((text,j)=>({id:`example-answer-${i}-${j}`,title:j===0?note.title:`${note.title} · ${j+1}`,text,sources:[articles[i]!.id],parents:[articles[i]!.id],basisId:articles[i]!.id,origin:'articles' as const})))
  const nodes:GraphNode[]=[{id:'root',type:'root',title:input.title,text:'示例知识脉络',parents:[],sources:[]},...articles.map(a=>({id:a.id,type:'article' as const,title:a.title,text:a.summary,parents:['root'],sources:[a.id]})),...paragraphs.map(p=>({...p,type:'answer' as const}))]
  validateTree(nodes)
  return LearningSchema.parse({version:2,routeId:input.routeId,conceptId:input.conceptId,title:input.title,description:'示例资料 · 可体验卡片编辑与文档',hasDispute:false,articles,nodes,conversations:[{id:`${input.id}:conversation`,title:input.title,date:'示例',messages:[{id:'example-message',role:'assistant',paragraphs}]}],active:`${input.id}:conversation`,initialized:true,phase:'ready'})
}
