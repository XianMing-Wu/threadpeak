import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { KnowledgeGraph } from '../../src/learning-v2/Graph'
import { KnowledgeDocument } from '../../src/learning-v2/Document'
import { SourceComments } from '../../src/learning-v2/SourceComments'
import { SourceReading } from '../../src/learning-v2/SourcePresentation'
import type { GraphNode } from '../../src/learning-v2/model'

const nodes: GraphNode[] = [
  { id: 'root', type: 'root', title: '理解矩阵变换', text: '本次学习目标', parents: [], sources: [] },
  { id: 'article', type: 'article', title: '来源文章', text: '完整来源正文', parents: ['root'], sources: [] },
  { id: 'answer', type: 'answer', title: '先确定坐标', text: '原始解释与公式 $x+y$。', parents: ['article'], sources: ['article'] },
]

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('keyboard selection exposes a separate toolbar and preserves the selected basis for both question modes', async () => {
  const submit = vi.fn().mockResolvedValue(true)
  const change = vi.fn()
  function Workspace() {
    const [selected, setSelected] = useState<string[]>([])
    return <KnowledgeGraph nodes={nodes} selected={selected} onSelect={id => setSelected([id])}
      onSelection={setSelected} onPromptSubmit={submit} depth="fast" onDepth={() => {}}
      onStop={() => {}} onCopy={() => {}} onChange={change}/>
  }
  const { container } = render(<Workspace/>)
  const card = screen.getByRole('group', { name: '回答节点：先确定坐标' })
  fireEvent.keyDown(card, { key: ' ' })
  expect(card.getAttribute('aria-label')).toBe('回答节点：先确定坐标，已选中')
  const ask = screen.getByRole('button', { name: '询问 AI' })
  expect(ask.closest('.lp-node')).toBeNull()
  expect(ask.closest('.lp-map-toolbar')).not.toBeNull()
  expect(container.querySelector('.lp-node[role="button"]')).toBeNull()

  for (const key of ['Tab', 'Enter']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    fireEvent(ask, event)
    expect(event.defaultPrevented).toBe(false)
  }
  expect(change).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('知识脉络文档')).toBeNull()
  fireEvent.click(ask)
  fireEvent.change(screen.getByRole('textbox', { name: '询问 AI 的问题' }), { target: { value: '解释这一步' } })
  fireEvent.click(screen.getByRole('button', { name: '发送询问 AI 问题' }))
  await waitFor(() => expect(submit).toHaveBeenLastCalledWith('解释这一步', 'ai', ['answer']))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '询问 AI' })).toBeNull())

  fireEvent.click(screen.getByRole('button', { name: '问博主' }))
  fireEvent.change(screen.getByRole('textbox', { name: '问博主的问题' }), { target: { value: '还有哪些应用条件？' } })
  fireEvent.click(screen.getByRole('button', { name: '发送问博主问题' }))
  await waitFor(() => expect(submit).toHaveBeenLastCalledWith('还有哪些应用条件？', 'author', ['answer']))
})

test('document editing uses a native action and submits source text while leaving the source node intact', () => {
  const save = vi.fn()
  const { container } = render(<KnowledgeDocument nodes={nodes} selected={[]} focusId={null}
    onSelect={() => {}} onSave={save} renderToolbar={() => null} onScroll={() => {}}/>)
  expect(screen.getByRole('heading', { name: '理解矩阵变换', level: 2 })).toBeTruthy()
  expect(container.querySelector('h3[role="textbox"]')).toBeNull()
  expect(screen.getByRole('textbox', { name: '文档标题：先确定坐标' }).parentElement?.tagName).toBe('H3')
  const action = screen.getByRole('button', { name: '编辑文档内容：先确定坐标' })
  expect(action.tagName).toBe('BUTTON')
  fireEvent.click(action)
  const input = screen.getByRole('textbox', { name: '文档内容：先确定坐标' })
  expect(document.activeElement).toBe(input)
  const source = '修改后的 **解释** 与公式 $x+y$。'
  fireEvent.input(input, { target: { value: source } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(save).toHaveBeenCalledWith('answer', '先确定坐标', source)
  expect(nodes[2].text).toBe('原始解释与公式 $x+y$。')
})


test('example source presentation keeps supplied comments and missing-formula source readable without starting a personal task', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const url = 'https://www.zhihu.com/question/362131975/answer/2182682685'
  const source = '矩阵运算中，设 是矩阵，满足交换律。'
  render(<>
    <SourceComments url={url} allowPresentation={false}/>
    <SourceComments url={url} allowPresentation={false} comments={['第一条完整评论', ' ', '最后一条完整评论']}/>
    <SourceReading url={url} allowPresentation={false} source={source}/>
  </>)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('第一条完整评论')).toBeTruthy()
  expect(screen.getByText('最后一条完整评论')).toBeTruthy()
  expect(screen.getByText('可前往原文查看完整内容。')).toBeTruthy()
  expect(screen.queryByText('正在整理完整的公式讲解…')).toBeNull()
  fireEvent.click(screen.getByText('查看原始摘要'))
  expect(screen.getByText(source)).toBeTruthy()
  await waitFor(() => expect(fetch).not.toHaveBeenCalled())
})
