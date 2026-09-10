import type {Article,Paragraph} from './learning-v2.ts'

const label=(text:string)=>text.replace(/([\\\[\]])/g,'\\$1').replace(/[\r\n]+/g,' ')
/** Source links come from resolved evidence, never from generated prose. */
export function paragraphsMarkdown(paragraphs:readonly Paragraph[],articles:readonly Article[]):string {
  return paragraphs.map(p=>{
    const sources=p.author?[{title:p.title,url:p.author.url}]:p.sources.flatMap(id=>{
      const article=articles.find(a=>a.id===id)
      return article?[article]:[]
    })
    const citations=sources.map(s=>s.url?`[${label(s.title)}](<${s.url.replace(/>/g,'%3E')}>)`:label(s.title)).join('、')
    const match=p.author?.matchReason?`${p.author.matchReason}${p.author.coverageLimit?`\n\n适用边界：${p.author.coverageLimit}`:''}\n\n`:''
    return `## ${p.title.replace(/[\r\n]+/g,' ')}\n\n${match}${p.text}\n\n${citations?`参考来源：${citations}`:'依据：当前所选卡片。'}`
  }).join('\n\n')
}
