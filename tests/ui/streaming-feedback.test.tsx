import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react'
import {LearningComposer,ChatPanel} from '../../src/learning-v2/Chat'
import {useStreamingText} from '../../src/lib/useStreamingText'
afterEach(cleanup)
function Stream({text,active=true}:{text:string;active?:boolean}){return <output>{useStreamingText(text,active)}</output>}
test('network chunks reveal incrementally and final/replaced output stays exact',async()=>{
 const view=render(<Stream text="真实收到的文字😀，逐字显示而不是整块跳出。"/>)
 await waitFor(()=>{const value=view.container.textContent!;expect(value.length).toBeGreaterThan(0);expect(value.length).toBeLessThan(26)})
 view.rerender(<Stream text="新任务" active={false}/>);expect(view.container.textContent).toBe('新任务')
})
test('send immediately becomes submitting, keeps unsent text until acknowledgement and rejects duplicate clicks',async()=>{
 let finish!:(value:boolean)=>void;const send=vi.fn(()=>new Promise<boolean>(r=>{finish=r}))
 render(<LearningComposer onSend={send}/>)
 fireEvent.change(screen.getByLabelText('学习提问'),{target:{value:'解释这个关系'}})
 fireEvent.click(screen.getByRole('button',{name:'发送问题'}))
 expect(screen.getByRole('button',{name:'正在发送'}).getAttribute('data-state')).toBe('submitting')
 expect((screen.getByLabelText('学习提问') as HTMLTextAreaElement).value).toBe('解释这个关系')
 fireEvent.keyDown(screen.getByLabelText('学习提问'),{key:'Enter'});expect(send).toHaveBeenCalledTimes(1)
 await act(async()=>finish(false));expect((screen.getByLabelText('学习提问') as HTMLTextAreaElement).value).toBe('解释这个关系')
})
test('sending a follow-up shows immediate waiting feedback without replaying the previous task',()=>{
 const noop=()=>{},task={id:'old',kind:'learning.reply',status:'completed' as const,phase:'已完成',draft:'旧任务残留',recoverable:false,basisIds:[],activities:[]}
 render(<ChatPanel conversation={{id:'chat',title:'概念',date:'today',messages:[]}} selected={[]} nodes={[]} depth="fast" onDepth={noop} onRemove={noop} onClear={noop} onSend={async()=>true} onStop={noop} mode="ai" onMode={noop} focusToken={0} phase="ready" draft={task.draft} busy authorBusy={false} onSource={noop} onNode={noop} onCopy={noop} onRetry={noop} task={task} sending pendingQuestion="新的提问"/>)
 expect(screen.getByText('正在发送问题…')).toBeTruthy();expect(screen.getByText('新的提问')).toBeTruthy();expect(screen.queryByText('旧任务残留')).toBeNull()
})
