import {afterEach,expect,test} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {ProcessTrace} from '../../src/components/ProcessTrace'
import {ThinkingActivities} from '../../src/components/ThinkingActivities'
import {Composer} from '../../src/components/Composer'
import {readLearningThinking,writeLearningThinking,resetLearningThinking} from '../../src/session/learning-thinking'
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();resetLearningThinking()})

test('old persisted deep preference cannot change the default; explicit choice lasts until reset',()=>{
 localStorage.setItem('threadpeak-thinking-depth','deep');sessionStorage.setItem('threadpeak-learning-thinking','deep')
 expect(readLearningThinking()).toBe('fast');writeLearningThinking('deep');expect(readLearningThinking()).toBe('deep');expect(localStorage.getItem('threadpeak-thinking-depth')).toBeNull()
 resetLearningThinking();expect(readLearningThinking()).toBe('fast')
 render(<Composer value="目标" onChange={()=>{}} onSend={()=>{}} showAttachment={false}/>);expect(screen.getByRole('combobox',{name:'思考深度'}).textContent).toContain('快速回答')
})

test('real think pill opens while streaming, keeps exact escaped text, collapses when done and can reopen',async()=>{
 const step={id:'reason',kind:'think' as const,status:'running' as const,extra:'安排顺序与并列阶段',thought:'先比较必要前置。\n<script>不执行</script>\n{"示例":1}'}
 const view=render(<ProcessTrace steps={[step]}/>);const details=view.container.querySelector('details')!
 expect(details.open).toBe(true);expect(screen.getByLabelText('模型思考过程').textContent).toBe(step.thought);expect(view.container.querySelector('script')).toBeNull()
 details.open=false;fireEvent(details,new Event('toggle'));view.rerender(<ProcessTrace steps={[{...step,thought:step.thought+'\n再核对顺序。'}]}/>);expect(details.open).toBe(false)
 view.rerender(<ProcessTrace steps={[{...step,status:'done'}]}/>);await waitFor(()=>expect(details.open).toBe(false));expect(screen.getByText('思考完成')).toBeTruthy()
 details.open=true;fireEvent(details,new Event('toggle'));expect(details.open).toBe(true)
 view.rerender(<ProcessTrace steps={[{...step,status:'stopped'}]}/>);expect(screen.getByText('已停止思考')).toBeTruthy()
})

test('learning reasoning uses a separate status surface, failures stay incomplete and completed reasoning remains readable',()=>{
 const activity={id:'think',kind:'think' as const,step:'L-answer:compose-v4',title:'撰写讲解',status:'running' as const,thought:'先读取资料，再说明条件。',startedAt:1,updatedAt:2}
 const view=render(<ThinkingActivities activities={[activity]} waiting/>);expect(screen.getByText('思考未完成')).toBeTruthy();expect(view.container.querySelector('details')!.open).toBe(false)
 view.rerender(<ThinkingActivities activities={[{...activity,status:'done'}]}/>);expect(screen.getByText('思考完成')).toBeTruthy();expect(screen.getByLabelText('模型思考过程').textContent).toBe(activity.thought)
})

test('a recovered association shows the latest successful reasoning and retains interrupted attempts only in its expanded history',()=>{
 const previous={id:'attach:thinking:1:0',kind:'think' as const,step:'L-answer:attach-v4',title:'关联知识卡',status:'waiting' as const,thought:'第一次输出被截断',startedAt:1,updatedAt:100}
 const current={...previous,id:'attach:thinking:2:0',status:'done' as const,thought:'重试后已核对全部依据',startedAt:2,updatedAt:3}
 const view=render(<ThinkingActivities activities={[previous,current]}/>)
 expect(screen.queryByText('思考未完成')).toBeNull();expect(screen.getAllByText('思考完成')).toHaveLength(1)
 expect(view.container.querySelectorAll('details')).toHaveLength(1)
 expect(screen.getByLabelText('模型思考过程').textContent).toContain('先前尝试 1（输出已中断）')
 expect(screen.getByLabelText('模型思考过程').textContent).toContain(current.thought)
 view.rerender(<ThinkingActivities activities={[previous,{...current,status:'running'}]}/>);expect(screen.getByText('思考中')).toBeTruthy()
 view.rerender(<ThinkingActivities activities={[previous,{...current,status:'waiting'}]} waiting/>);expect(screen.getByText('思考未完成')).toBeTruthy()
})

test('generated paragraph headings render inline formulas without raw delimiters or invalid block children',async()=>{
 const {AnswerMessage}=await import('../../src/learning-v2/Chat')
 render(<AnswerMessage message={{id:'formula-title',role:'assistant',paragraphs:[{id:'p',title:'为什么是 $-y$ 和 $x$',text:'正文',basisId:'source',parents:['source'],sources:[]}]}}/>)
 const heading=screen.getByRole('heading',{level:2})
 expect(heading.querySelectorAll('.katex')).toHaveLength(2)
 expect(heading.textContent).not.toContain('$')
 expect(heading.querySelector('div,p,h1,h2,pre')).toBeNull()
})
