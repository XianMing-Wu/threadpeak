import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {NetworkEvidence} from '@threadpeak/contracts/authors'
import {SourceFootprints} from '../../src/learning-v2/SourceFootprints'
import {Composer} from '../../src/components/Composer'
import {LearningComposer} from '../../src/learning-v2/Chat'
import {NodePrompt} from '../../src/learning-v2/NodePrompt'
import {SendControl} from '../../src/components/SendControl'
const title='Transformer 整体结构与数据流',article='Transformer 那张图，我盯了半年才看懂'
const use={topicId:'t',topic:title,resourceId:'learning/a',question:'',nodeIds:['s','a','b'],nodeTitles:{s:article,a:'编码器的一层：四步流水线',b:'解码器：在编码器基础上多两步'},nodeKinds:{s:'article' as const,a:'answer' as const,b:'answer' as const},origin:'learning' as const,discoveredAt:1,helpful:false}
const evidence:NetworkEvidence={evidenceId:'s',authorId:'author',authorName:'资料作者',title:article,summary:'测试资料',url:'https://www.zhihu.com/question/1/answer/2',uses:[{...use,key:'base'},{...use,key:'initial',questionKind:'initial',question:title,origin:'conversation',nodeIds:['a']},{...use,key:'follow-up',questionKind:'follow_up',question:'为什么解码器不能看后面的词？',origin:'conversation',nodeIds:['b']}]}
afterEach(cleanup)
test('one concept entry distinguishes the original from derived explanations and feedback names both sides',()=>{
 const feedback=vi.fn(),close=vi.fn();render(<SourceFootprints evidence={evidence} authorId="author" onFeedback={feedback} onClose={close} busy={false}/>)
 expect(screen.getAllByRole('heading',{level:4})).toHaveLength(1)
 expect(screen.queryByText('4 张关联卡片')).toBeNull()
 expect(screen.getAllByText('刘看山讲解')).toHaveLength(2)
 const source=screen.getByRole('link',{name:`查看资料卡：${article}`});expect(source.getAttribute('href')).toBe('#knowledge-detail?resource=learning%2Fa&node=s')
 const explanation=screen.getByRole('link',{name:'定位讲解：编码器的一层：四步流水线'});expect(explanation.getAttribute('href')).toContain('&node=a')
 fireEvent.click(explanation);expect(close).toHaveBeenCalledOnce()
 fireEvent.click(screen.getByRole('button',{name:`标记《${article}》对「${title}」有帮助`}))
 expect(feedback).toHaveBeenCalledWith('author','t','helpful',true,'s')
 expect(screen.getByText('为什么解码器不能看后面的词？')).toBeTruthy()
 expect(screen.queryByText(`在「${title}」中发现`)).toBeNull()
})
test('unknown historic node kinds are not relabelled as AI, and helpful toggles stay scoped',()=>{
 render(<SourceFootprints evidence={{...evidence,uses:[{...use,key:'legacy',nodeIds:['s'],nodeKinds:undefined,helpful:true}]}} authorId="author" onFeedback={vi.fn()} onClose={()=>{}} busy={false}/>)
 expect(screen.getByText('知识卡片')).toBeTruthy();expect(screen.queryByText('刘看山讲解')).toBeNull()
 expect(screen.getByRole('button',{name:`取消标记《${article}》对「${title}」有帮助`}).getAttribute('aria-pressed')).toBe('true')
})
test('every question surface shares send, disabled and stop states, including floating AI and author prompts',()=>{
 const send=vi.fn(),stop=vi.fn(),node={id:'s',type:'article' as const,title:'资料',text:'正文',parents:['root'],sources:['s']}
 const props={value:'内容',onChange:()=>{},onSend:send,onStop:stop,showAttachment:false}
 const renderers=[(busy:boolean)=><Composer {...props} busy={busy}/>,(busy:boolean)=><LearningComposer nodes={[node]} busy={busy} onStop={stop} onSend={async()=>true}/>,...(['ai','author'] as const).map(mode=>(busy:boolean)=><NodePrompt mode={mode} nodes={[node]} depth="fast" onDepth={()=>{}} onSubmit={async()=>true} onClose={()=>{}} onStop={stop} busy={busy}/>)]
 for(const element of renderers){const view=render(element(false));const control=view.container.querySelector<HTMLButtonElement>('button.send-control')!;expect(control.dataset.state).toBe('send');view.rerender(element(true));expect(screen.getByRole('button',{name:'停止生成'}).getAttribute('data-state')).toBe('stop');fireEvent.click(screen.getByRole('button',{name:'停止生成'}));view.unmount()}
 expect(stop).toHaveBeenCalledTimes(4);expect(send).not.toHaveBeenCalled()
 const view=render(<SendControl onSend={send} busy disabled onStop={stop}/>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false)
 view.rerender(<SendControl onSend={send} busy submitting onStop={stop}/>);expect((screen.getByRole('button',{name:'正在发送'}) as HTMLButtonElement).disabled).toBe(true)
 view.rerender(<SendControl onSend={send} disabled/>);expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(true)
})
test('learning input preserves edits during acceptance, prevents duplicate sends and does not submit IME confirmation',async()=>{
 let done!:(v:boolean)=>void;const send=vi.fn(()=>new Promise<boolean>(r=>{done=r}))
 render(<LearningComposer onSend={send}/>)
 const input=screen.getByRole('textbox');fireEvent.change(input,{target:{value:'第一个问题'}});fireEvent.keyDown(input,{key:'Enter',isComposing:true});expect(send).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'发送问题'}));fireEvent.keyDown(input,{key:'Enter'});expect(send).toHaveBeenCalledOnce()
 fireEvent.change(input,{target:{value:'下一个草稿'}});done(true);await waitFor(()=>expect((input as HTMLTextAreaElement).value).toBe('下一个草稿'))
})
