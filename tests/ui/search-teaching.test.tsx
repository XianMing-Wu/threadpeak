import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,expect,test,vi} from 'vitest'
import {AnswerMessage} from '../../src/learning-v2/Chat'
import {KnowledgeGraph} from '../../src/learning-v2/Graph'
import {LearningData} from '../../src/learning-v2/data'
import type {Article,GraphNode,Message,Paragraph} from '../../src/learning-v2/model'

afterEach(cleanup)
const articles:Article[]=[{id:'source',title:'缩放的解释',summary:'材料正文',author:'来源作者',authorId:'source-author',url:'https://zhuanlan.zhihu.com/p/123',likes:null,topic:'数学'}]
const paragraph:Paragraph={id:'lesson',title:'用同一组分数比较',text:'先看 $2+2=4$，再比较结果。',sources:['source'],basisId:'source',parents:['source']}

test('the lesson renders H2 blocks with source actions and copies complete Markdown references',()=>{
 const copy=vi.fn(),source=vi.fn()
 render(<LearningData.Provider value={{articles,concept:'缩放'}}><AnswerMessage message={{id:'m',role:'assistant',paragraphs:[paragraph]}} onCopy={copy} onSource={source}/></LearningData.Provider>)
 expect(screen.getByRole('heading',{level:2,name:paragraph.title})).toBeTruthy()
 expect(document.querySelector('.katex-error')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'复制回答'}))
 expect(copy.mock.calls[0][0]).toContain('## 用同一组分数比较')
 expect(copy.mock.calls[0][0]).toContain('[缩放的解释](<https://zhuanlan.zhihu.com/p/123>)')
})

test('each selected blogger has a separate chat section and graph card with its own source and fit limits',()=>{
 const paragraphs:Paragraph[]=Array.from({length:3},(_,i)=>({...paragraph,id:`author-${i}`,title:`作者文章${i}`,text:`来源原始内容${i}`,author:{id:`person-${i}`,evidenceId:`e-${i}`,name:`博主${i}`,expertise:'文章作者',url:`https://zhuanlan.zhihu.com/p/${i+1}`,matchReason:`解释问题${i}`,coverageLimit:`尚未覆盖${i}`}}))
 const message:Message={id:'m',role:'assistant',kind:'author',paragraphs}
 const {container}=render(<AnswerMessage message={message}/>)
 const sections=container.querySelectorAll('[data-answer-node]')
 expect(sections).toHaveLength(3)
 for(const [i,section] of Array.from(sections).entries()){
  expect(within(section as HTMLElement).getByText(`博主${i}`)).toBeTruthy()
  expect(section.textContent).toContain(`来源原始内容${i}`)
  expect(section.textContent).toContain(`适用边界：尚未覆盖${i}`)
  expect(section.querySelector('a')?.href).toBe(`https://zhuanlan.zhihu.com/p/${i+1}`)
 }
 cleanup()
 const nodes:GraphNode[]=[{id:'root',type:'root',title:'所选材料',text:'材料',parents:[],sources:[]},{id:'source',type:'article',title:'当前文章',text:'原始资料',parents:['root'],sources:[]},...paragraphs.map(p=>({id:p.id,type:'author' as const,title:p.title,text:p.text,author:p.author,parents:['source'],sources:p.sources}))]
 render(<KnowledgeGraph nodes={nodes} selected={[]} onSelect={()=>{}} onSelection={()=>{}} onPromptSubmit={async()=>true} depth="fast" onDepth={()=>{}} onStop={()=>{}} onCopy={()=>{}}/>)
 expect(screen.getAllByRole('group').filter(el=>el.getAttribute('aria-label')?.includes('作者文章'))).toHaveLength(3)
})
