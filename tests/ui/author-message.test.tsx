import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {PrepareAuthor} from '../../src/learning-v2/AuthorPanels'
import {restoreAuthorDraft} from '../../src/learning-v2/author-draft'
import {AuthorBriefSchema,consultationDraft,type AuthorMatch} from '@threadpeak/contracts/authors'
vi.mock('../../src/learning-v2/SourcePresentation',()=>({useSourcePresentation:()=>({value:undefined}),SourceReading:()=>null}))
const brief=AuthorBriefSchema.parse({question:'找个博主问问解码器细节',background:'希望用一个短句理解',attempted:'试着画过结构图'})
const author:AuthorMatch={authorId:'a',authorName:'验收作者甲',evidenceId:'e',title:'解码器的细节',url:'https://zhuanlan.zhihu.com/p/1',summary:'公开摘要',question:'能否用一个短句说明？',messageBody:'我想请教解码器怎样逐步生成一个短句。我试着画过结构图，想请你帮忙看看各部分怎样配合。',fit:'direct',reason:'相关',canHelpWith:'解码器',limitation:'需确认',quote:'摘要',quoteSummarized:false,known:false,topic:{id:'t',title:'解码器',uses:0,helpful:0,score:0,pinned:false,hidden:false},history:[]}
beforeEach(()=>{sessionStorage.clear();Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.open=true}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.open=false}})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})

test('copy contains the reviewed private message, not a briefing; errors are visible and retryable',async()=>{
 const write=vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:write}})
 render(<PrepareAuthor brief={brief} author={author} searchId="search" onClose={()=>{}}/>)
 expect(screen.getByRole('heading',{name:'准备私聊内容'})).toBeTruthy()
 const input=screen.getByRole('textbox',{name:'私聊内容草稿'})
 expect((input as HTMLTextAreaElement).value).toBe(consultationDraft(brief,author))
 expect((input as HTMLTextAreaElement).value).not.toContain('请教简报')
 fireEvent.change(input,{target:{value:'你好，我想请教解码器中掩码具体怎么计算。'}})
 fireEvent.click(screen.getByRole('button',{name:'复制私聊内容'}))
 expect(await screen.findByRole('status')).toHaveProperty('textContent','未能自动复制，请选中上面的文字复制。')
 fireEvent.click(screen.getByRole('button',{name:'复制私聊内容'}))
 await screen.findByRole('button',{name:'已复制私聊内容'})
 expect(write).toHaveBeenLastCalledWith('你好，我想请教解码器中掩码具体怎么计算。')
})

test('drafts stay scoped to search and author through rerenders, close/reopen and legacy upgrade',()=>{
 const props={brief,author,searchId:'one',onClose:()=>{}}
 const view=render(<PrepareAuthor {...props}/>)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'我的修改，必须保留'}})
 view.rerender(<PrepareAuthor {...props} author={{...author,authorId:'b',authorName:'验收作者乙'}}/>)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('验收作者乙，你好！')
 view.rerender(<PrepareAuthor {...props}/>)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('我的修改，必须保留')
 view.unmount();render(<PrepareAuthor {...props}/>)
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('我的修改，必须保留')
 expect(restoreAuthorDraft('',brief,author)).toBe('')
 expect(restoreAuthorDraft('用户保留的请教简报',brief,author)).toBe('用户保留的请教简报')
 const plain=AuthorBriefSchema.parse({question:'细节'})
 const legacy=`请教简报\n\n细节\n\n想请教 ${author.authorName}：\n我读到了你的《${author.title}》（${author.url}）。\n${author.question}\n\n想先确认这个问题是否在你的咨询范围内，以及是否开放咨询、所需材料和费用。`
 expect(restoreAuthorDraft(legacy,plain,author)).toBe(consultationDraft(plain,author))
})

test('an earlier clipboard completion cannot claim the edited message was copied',async()=>{
 let resolve!:()=>void
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise<void>(r=>{resolve=r})}})
 render(<PrepareAuthor brief={brief} author={author} searchId="pending" onClose={()=>{}}/>)
 fireEvent.click(screen.getByRole('button',{name:'复制私聊内容'}))
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'复制过程中修改'}})
 resolve()
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('修改前的内容'))
 expect(screen.getByRole('button',{name:'复制私聊内容'})).toBeTruthy()
})
