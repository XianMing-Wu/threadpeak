import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen,waitFor,fireEvent} from '@testing-library/react'
import {READING_POLICY_VERSION} from '@threadpeak/contracts/reading-policy'
import {SourceReading} from '../../src/learning-v2/SourcePresentation'
import {productRequest} from '../../src/learning-v2/client'
vi.mock('../../src/learning-v2/client',()=>({productRequest:vi.fn()}))
const request=vi.mocked(productRequest)
const missing='一个简单的求导例子是： ，计算  ，假设给定  \n先画出计算图。'
const complete=(content:string)=>({id:'presentation',data:{status:'ready',metadata:{},reading:{kind:'ai-formula',content}},job:{status:'completed'}})
afterEach(()=>{cleanup();request.mockReset()})
test('the reported autograd gap opens an independent reading and retains the original summary',async()=>{
 request.mockResolvedValue(complete('## 独立例子\n\n公式 $y=x^2$。'))
 const view=render(<SourceReading source={missing} url="https://zhuanlan.zhihu.com/p/qa-reading-1"/>)
 await waitFor(()=>expect(screen.getByText('独立例子')).toBeTruthy())
 expect(request).toHaveBeenCalledWith('/api/v2/sources/presentation',expect.objectContaining({method:'POST',body:{url:'https://zhuanlan.zhihu.com/p/qa-reading-1',includeReading:true,readingVersion:READING_POLICY_VERSION},signal:expect.any(AbortSignal)}))
 expect(screen.getByText('根据摘要主题整理，非作者原文')).toBeTruthy()
 expect(view.container.querySelector('details')?.open).toBe(false)
 expect(view.container.querySelector('details')?.textContent).toContain('一个简单的求导例子是：')
 expect(view.container.querySelectorAll('.katex')).toHaveLength(1)
})
test('intact equations do not request a repair',()=>{
 render(<SourceReading source="求导例子是：$y=x^2$，计算 $dy/dx$，假设给定 $x=2$。" url="https://zhuanlan.zhihu.com/p/qa-reading-2"/>)
 expect(request).not.toHaveBeenCalled();expect(screen.queryByText('AI 公式讲解')).toBeNull()
})
test('a failed reading remains recoverable without publishing invented source formulas',async()=>{
 request.mockRejectedValueOnce(new Error('offline'))
 const view=render(<SourceReading source={missing} url="https://zhuanlan.zhihu.com/p/qa-reading-3"/>)
 await waitFor(()=>expect(screen.getByRole('button',{name:'继续整理公式'})).toBeTruthy())
 expect(view.container.querySelectorAll('.katex')).toHaveLength(0)
 request.mockResolvedValueOnce(complete('## 重试成功的独立讲解\n\n$y=x^3$。'))
 fireEvent.click(screen.getByRole('button',{name:'继续整理公式'}))
 await waitFor(()=>expect(screen.getByText('重试成功的独立讲解')).toBeTruthy())
})
test('a changed summary for the same URL cannot reuse the previous reading',async()=>{
 request.mockResolvedValueOnce(complete('第一份讲解 $x^2$'))
 const url='https://zhuanlan.zhihu.com/p/qa-reading-4',view=render(<SourceReading source={missing} url={url}/>)
 await waitFor(()=>expect(screen.getByText(/第一份讲解/)).toBeTruthy())
 request.mockResolvedValueOnce(complete('第二份讲解 $x^3$'))
 view.rerender(<SourceReading source={missing+'\n二阶求导：计算 ，假设给定。'} url={url}/>)
 await waitFor(()=>expect(screen.getByText(/第二份讲解/)).toBeTruthy())
 expect(screen.queryByText(/第一份讲解/)).toBeNull();expect(request).toHaveBeenCalledTimes(2)
})


test('shared readers abort only after the final subscriber leaves, without cancelling the server task',async()=>{
 let signal:AbortSignal|undefined
 request.mockImplementation(async(_url,options)=>await new Promise<unknown>((_resolve,reject)=>{signal=options?.signal;signal?.addEventListener('abort',()=>reject(new DOMException('reader left','AbortError')),{once:true})}) as never)
 const url='https://zhuanlan.zhihu.com/p/qa-reading-refcount'
 const one=render(<SourceReading source={missing} url={url}/>),two=render(<SourceReading source={missing} url={url}/>)
 await waitFor(()=>expect(request).toHaveBeenCalledTimes(1))
 one.unmount();expect(signal?.aborted).toBe(false)
 two.unmount();expect(signal?.aborted).toBe(true)
 expect(request).toHaveBeenCalledTimes(1)
 expect(request.mock.calls.some(([url])=>url.endsWith('/cancel'))).toBe(false)
})
