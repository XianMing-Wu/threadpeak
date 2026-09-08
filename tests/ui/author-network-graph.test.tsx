import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthorNetworkGraph } from '../../src/components/AuthorNetworkGraph'
import type { AuthorNetworkEdge, AuthorNetworkNode } from '../../src/session/project-author-network'

const nodes: AuthorNetworkNode[] = [
  { id: 'topic', kind: 'concept', label: '学习主题', detail: '正在学习的概念' },
  { id: 'author:one', kind: 'author', label: '第一位作者', detail: '主题的来源作者' },
  { id: 'author:two', kind: 'author', label: '第二位作者', detail: '另一个来源作者' },
]
const edges: AuthorNetworkEdge[] = [
  { id: 'one-topic', source: 'author:one', target: 'topic', kind: 'authored-at' },
  { id: 'two-topic', source: 'author:two', target: 'topic', kind: 'authored-at' },
]
let frames: Map<number, FrameRequestCallback>
let disconnect: ReturnType<typeof vi.fn>

beforeEach(() => {
  frames = new Map()
  let nextFrame = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++nextFrame, callback); return nextFrame })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function canvas() { return screen.getByRole('group', { name: '博主与知识的关系图' }) as unknown as SVGSVGElement }
function transform(svg = canvas()) { return svg.querySelector('g')!.getAttribute('transform') }
function pointerCapture(svg: SVGSVGElement) {
  const captured = new Set<number>()
  Object.defineProperties(svg, {
    setPointerCapture: { configurable: true, value: (id: number) => { captured.add(id) } },
    hasPointerCapture: { configurable: true, value: (id: number) => captured.has(id) },
    releasePointerCapture: { configurable: true, value: (id: number) => { captured.delete(id) } },
  })
  return captured
}

test('keyboard users can select every node and access the existing author list', () => {
  const select = vi.fn()
  render(<><AuthorNetworkGraph nodes={nodes} edges={edges} describedBy="source-authors" onSelect={select}/><aside id="source-authors">可阅读的来源作者列表</aside></>)
  const svg = canvas()
  expect(svg.getAttribute('tabindex')).toBe('0')
  const descriptions = svg.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent)
  expect(descriptions.some((text) => text?.includes('方向键平移'))).toBe(true)
  expect(descriptions).toContain('可阅读的来源作者列表')
  const first = screen.getByRole('button', { name: '博主：第一位作者' })
  expect(first.querySelector('title')?.textContent).toContain('主题的来源作者')
  act(() => { first.focus() })
  fireEvent.keyDown(first, { key: 'Enter' })
  expect(select).toHaveBeenLastCalledWith(nodes[1])
  expect(first.getAttribute('aria-pressed')).toBe('true')
  const second = screen.getByRole('button', { name: '博主：第二位作者' })
  act(() => { second.focus() })
  const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
  fireEvent(second, space)
  expect(space.defaultPrevented).toBe(true)
  expect(select).toHaveBeenLastCalledWith(nodes[2])
  expect(second.getAttribute('aria-pressed')).toBe('true')
  expect(first.getAttribute('aria-pressed')).toBe('false')
  expect(select).toHaveBeenCalledTimes(2)
  fireEvent.keyDown(second, { key: ' ', repeat: true })
  expect(select).toHaveBeenCalledTimes(2)
  // Assistive technology may activate an SVG button with a synthesized click.
  fireEvent.click(first, { detail: 0 })
  expect(select).toHaveBeenLastCalledWith(nodes[1])
})

test('keyboard panning, bounded zoom, reset and canvas Enter use the actual viewport', () => {
  const select = vi.fn()
  render(<AuthorNetworkGraph nodes={nodes} edges={edges} onSelect={select}/>)
  const svg = canvas()
  expect(transform()).toBe('translate(0 0) scale(1)')
  fireEvent.keyDown(svg, { key: 'ArrowRight' })
  fireEvent.keyDown(svg, { key: 'ArrowDown', shiftKey: true })
  expect(transform()).toBe('translate(40 80) scale(1)')
  fireEvent.keyDown(svg, { key: '+' })
  expect(transform()).toContain('scale(1.12)')
  for (let i = 0; i < 30; i += 1) fireEvent.keyDown(svg, { key: '+' })
  expect(transform()).toContain('scale(2.6)')
  for (let i = 0; i < 50; i += 1) fireEvent.keyDown(svg, { key: '-' })
  expect(transform()).toContain('scale(0.35)')
  fireEvent.keyDown(svg, { key: '0' })
  expect(transform()).toBe('translate(0 0) scale(1)')
  fireEvent.keyDown(svg, { key: 'ArrowLeft', ctrlKey: true })
  expect(transform()).toBe('translate(0 0) scale(1)')
  fireEvent.keyDown(svg, { key: 'Enter' })
  expect(select).toHaveBeenLastCalledWith(nodes[0])
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '概念：学习主题' }))
})

test('simulation and graph updates retain the same focused DOM node and selection', () => {
  const select = vi.fn()
  const view = render(<AuthorNetworkGraph nodes={nodes} edges={edges} onSelect={select}/>)
  const first = screen.getByRole('button', { name: '博主：第一位作者' })
  act(() => { first.focus() })
  fireEvent.keyDown(first, { key: 'Enter' })
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  act(() => {
    const [id, frame] = [...frames.entries()][0]
    frames.delete(id)
    frame(16)
  })
  expect(document.activeElement).toBe(first)
  view.rerender(<AuthorNetworkGraph nodes={nodes.map((node) => ({ ...node, detail: `${node.detail}，已更新` }))} edges={[...edges]} onSelect={select}/>)
  expect(screen.getByRole('button', { name: '博主：第一位作者' })).toBe(first)
  expect(document.activeElement).toBe(first)
  expect(first.getAttribute('aria-pressed')).toBe('true')
  expect(first.querySelector('title')?.textContent).toContain('已更新')
  expect(transform()).toBe('translate(40 0) scale(1)')
  expect(screen.getAllByRole('button')).toHaveLength(3)
  view.rerender(<AuthorNetworkGraph nodes={nodes.filter((node) => node.id !== nodes[1].id)} edges={edges.slice(1)} onSelect={select}/>)
  expect(document.activeElement).toBe(canvas())
  expect(view.container.querySelector('.author-network-tooltip')).toBeNull()
})

test('pointer selection, node dragging, background panning and wheel behavior remain usable', () => {
  const select = vi.fn()
  render(<AuthorNetworkGraph nodes={nodes} edges={edges} onSelect={select}/>)
  const svg = canvas()
  const captured = pointerCapture(svg)
  const first = screen.getByRole('button', { name: '博主：第一位作者' })
  const x = Number(first.getAttribute('cx')), y = Number(first.getAttribute('cy'))
  fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: x, clientY: y })
  expect(select).toHaveBeenCalledTimes(1)
  expect(select.mock.calls[0][0].id).toBe(nodes[1].id)
  expect(first.getAttribute('aria-pressed')).toBe('true')
  expect(captured.size).toBe(0)
  fireEvent.pointerDown(first, { button: 0, pointerId: 2, clientX: x, clientY: y })
  fireEvent.pointerMove(svg, { pointerId: 2, clientX: x + 25, clientY: y + 15 })
  fireEvent.pointerUp(svg, { pointerId: 2, clientX: x + 25, clientY: y + 15 })
  expect(Number(first.getAttribute('cx'))).toBeCloseTo(x + 25)
  expect(select).toHaveBeenCalledTimes(1)
  fireEvent.pointerDown(svg, { button: 0, pointerId: 3, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(svg, { pointerId: 3, clientX: 35, clientY: 20 })
  fireEvent.pointerUp(svg, { pointerId: 3, clientX: 35, clientY: 20 })
  expect(transform()).toBe('translate(35 20) scale(1)')
  const ordinaryWheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
  fireEvent(svg, ordinaryWheel)
  expect(ordinaryWheel.defaultPrevented).toBe(false)
  expect(transform()).toBe('translate(35 20) scale(1)')
  const zoomWheel = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true })
  fireEvent(svg, zoomWheel)
  expect(zoomWheel.defaultPrevented).toBe(true)
  expect(transform()).toContain('scale(1.12)')
})

test('pointer hover takes precedence over an earlier focus and keyboard input restores focus highlighting', () => {
  const view = render(<AuthorNetworkGraph nodes={nodes} edges={edges}/>)
  const svg = canvas()
  pointerCapture(svg)
  const first = screen.getByRole('button', { name: '博主：第一位作者' })
  const second = screen.getByRole('button', { name: '博主：第二位作者' })
  const lines = svg.querySelectorAll('line')
  const firstX = Number(first.getAttribute('cx')), firstY = Number(first.getAttribute('cy'))
  fireEvent.pointerDown(first, { button: 0, pointerId: 7, clientX: firstX, clientY: firstY })
  fireEvent.pointerUp(svg, { pointerId: 7, clientX: firstX, clientY: firstY })
  expect(document.activeElement).toBe(first)
  const secondX = Number(second.getAttribute('cx')), secondY = Number(second.getAttribute('cy'))
  fireEvent.pointerMove(svg, { pointerId: 7, clientX: secondX, clientY: secondY })
  expect(lines[0].getAttribute('opacity')).toBe('0.12')
  expect(lines[1].getAttribute('opacity')).toBe('0.88')
  expect(view.container.querySelector('.author-network-tooltip b')?.textContent).toBe('第二位作者')
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(lines[0].getAttribute('opacity')).toBe('0.88')
  expect(lines[1].getAttribute('opacity')).toBe('0.12')
  expect(view.container.querySelector('.author-network-tooltip b')?.textContent).toBe('第一位作者')
  fireEvent.pointerMove(svg, { pointerId: 7, clientX: secondX + 40, clientY: secondY })
  expect(lines[1].getAttribute('opacity')).toBe('0.88')
  fireEvent.pointerLeave(svg)
  expect(lines[0].getAttribute('opacity')).toBe('0.88')
  expect(view.container.querySelector('.author-network-tooltip b')?.textContent).toBe('第一位作者')
})

test('StrictMode remount and unmount release simulation, observer and pointer listeners', () => {
  const select = vi.fn()
  const view = render(<StrictMode><AuthorNetworkGraph nodes={nodes} edges={edges} onSelect={select}/></StrictMode>)
  const svg = canvas()
  const captured = pointerCapture(svg)
  const first = screen.getByRole('button', { name: '博主：第一位作者' })
  const x = Number(first.getAttribute('cx')), y = Number(first.getAttribute('cy'))
  fireEvent.pointerDown(first, { button: 0, pointerId: 4, clientX: x, clientY: y })
  expect(captured.has(4)).toBe(true)
  view.unmount()
  expect(captured.size).toBe(0)
  expect(frames.size).toBe(0)
  expect(disconnect).toHaveBeenCalledTimes(2)
  fireEvent.pointerUp(svg, { pointerId: 4, clientX: x, clientY: y })
  const wheel = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true })
  fireEvent(svg, wheel)
  expect(wheel.defaultPrevented).toBe(false)
  expect(select).not.toHaveBeenCalled()
  expect(frames.size).toBe(0)
})

test('reduced motion stops automatic simulation without blocking navigation and responds to preference changes', () => {
  let onChange: (() => void) | undefined
  const removeEventListener = vi.fn()
  const query = {
    matches: true, media: '(prefers-reduced-motion: reduce)', onchange: null,
    addListener() {}, removeListener() {}, dispatchEvent: () => true,
    addEventListener: vi.fn((_type: string, listener: () => void) => { onChange = listener }),
    removeEventListener,
  }
  vi.spyOn(window, 'matchMedia').mockReturnValue(query)
  const view = render(<AuthorNetworkGraph nodes={nodes} edges={edges}/>)
  expect(frames.size).toBe(0)
  fireEvent.keyDown(canvas(), { key: 'ArrowRight' })
  expect(transform()).toBe('translate(40 0) scale(1)')
  query.matches = false
  act(() => { onChange?.() })
  expect(frames.size).toBe(1)
  query.matches = true
  act(() => { onChange?.() })
  expect(frames.size).toBe(0)
  view.unmount()
  expect(removeEventListener).toHaveBeenCalledWith('change', onChange)
})
