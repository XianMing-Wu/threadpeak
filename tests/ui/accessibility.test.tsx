import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StrictMode } from 'react'
import type { ProductLibrary } from '@threadpeak/contracts/product-library'
import { Composer } from '../../src/components/Composer'
import { EmptyStatus } from '../../src/components/EmptyStatus'
import { WideShell } from '../../src/components/Shell'
import { SettingsPage } from '../../src/pages/Settings'
import { NotFoundPage } from '../../src/pages/NotFound'
import { App } from '../../src/App'
import { KnowledgePage } from '../../src/pages/Collections'

const boundary = vi.hoisted(() => ({
  library: undefined as ProductLibrary | undefined,
  error: '',
  reload: vi.fn(async () => {}),
}))
vi.mock('../../src/learning-v2/library', () => ({
  useProductLibrary: () => ({ data: boundary.library, error: boundary.error, reload: boundary.reload }),
  clearProductLibrary: vi.fn(),
}))
vi.mock('../../src/learning-v2/client', () => ({
  productRequest: vi.fn(async () => ({ kind: 'local', provider: null })),
  ensureSession: vi.fn(async () => { throw Error('offline') }),
}))
vi.mock('../../src/runtime/request-auth-session', () => ({
  requestAuthSession: vi.fn(async () => ({ kind: 'unavailable', provider: null })),
  requestAuthStart: vi.fn(async () => ({ kind: 'unavailable', message: '未连接' })),
  requestAuthLogout: vi.fn(async () => {}),
}))

function appearance({dark = false, narrow = false} = {}) {
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()
  const queries = new Map<string, MediaQueryList>()
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    if (!queries.has(query)) {
      const set = new Set<(event: MediaQueryListEvent) => void>()
      listeners.set(query, set)
      queries.set(query, {
        matches: query.includes('prefers-color-scheme') ? dark : narrow,
        media: query,
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => set.add(listener),
        removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => set.delete(listener),
      } as unknown as MediaQueryList)
    }
    return queries.get(query)!
  })
  return (dark: boolean) => {
    const query = '(prefers-color-scheme: dark)'
    const media = queries.get(query)
    if (media) Object.defineProperty(media, 'matches', {value: dark, configurable: true})
    act(() => listeners.get(query)?.forEach(listener => listener({matches: dark} as MediaQueryListEvent)))
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  boundary.library = undefined
  boundary.error = ''
  boundary.reload.mockClear()
  location.hash = ''
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({mode: 'local', zhihuAvailable: false}), {status: 200})))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-theme'); document.documentElement.style.removeProperty('color-scheme') })

test('Composer always exposes a name and preserves a caller-specific label', () => {
  const props = {value: '', onChange: vi.fn(), onSend: vi.fn(), animatedBorder: false}
  const view = render(<Composer {...props}/>)
  expect(screen.getByRole('textbox', {name: '输入你的问题或学习目标'})).toBeTruthy()
  view.rerender(<Composer {...props} inputLabel="向博主提问"/>)
  expect(screen.getByRole('textbox', {name: '向博主提问'})).toBeTruthy()
})

test('empty states inherit an explicit heading level and 404 supplies a page heading', () => {
  const view = render(<EmptyStatus title="暂无内容" headingLevel={3}/>)
  expect(screen.getByRole('heading', {level: 3, name: '暂无内容'})).toBeTruthy()
  view.rerender(<NotFoundPage/>)
  expect(screen.getByRole('heading', {level: 1, name: '页面不存在'})).toBeTruthy()
})

test('clearing local history opens a native modal on Cancel and restores trigger focus after Escape or confirmation', async () => {
  // jsdom has no browser top layer; these spies expose calls to the native modal API.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {configurable: true, value() {}})
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {configurable: true, value() {}})
  const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open') })
  localStorage.setItem('threadpeak-chat-history', '[{"id":"history"}]')
  localStorage.setItem('unrelated-retained-content', 'keep')
  render(<StrictMode><SettingsPage theme="light" onThemeChange={vi.fn()} onLogout={vi.fn()}/></StrictMode>)
  const trigger = screen.getByRole('button', {name: '清空'})
  fireEvent.click(trigger)
  expect(show).toHaveBeenCalledOnce()
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '取消'}))
  fireEvent(screen.getByRole('dialog'), new Event('cancel', {cancelable: true}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(localStorage.getItem('threadpeak-chat-history')).toContain('history')
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', {name: '确认清空'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(localStorage.getItem('threadpeak-chat-history')).toBe('[]')
  expect(localStorage.getItem('unrelated-retained-content')).toBe('keep')
  await screen.findByText('旧版本本机历史索引已清空，服务端对话仍然保留')
})

test('history groups use calendar days and expose named lists', () => {
  appearance()
  const now = new Date(2026, 8, 8, 1)
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(now)
  boundary.library = {paths: [], knowledge: [], conversations: [
    {id: 'today', resourceId: 'today', kind: 'chat', title: '今天的对话', query: '问题', updatedAt: now.getTime()},
    {id: 'yesterday', resourceId: 'yesterday', kind: 'chat', title: '昨天深夜的对话', query: '问题', updatedAt: new Date(2026, 8, 7, 23).getTime()},
    {id: 'old', resourceId: 'old', kind: 'chat', title: '上个月的对话', query: '问题', updatedAt: new Date(2026, 7, 1).getTime()},
  ]}
  render(<WideShell route="home" theme="light" onThemeChange={vi.fn()} onLogout={vi.fn()}><main><h1>首页</h1></main></WideShell>)
  const today = screen.getByRole('region', {name: '今天'})
  const recent = screen.getByRole('region', {name: '最近'})
  expect(within(today).getAllByRole('listitem')).toHaveLength(1)
  expect(within(today).getByRole('button', {name: '今天的对话'})).toBeTruthy()
  expect(within(recent).getByRole('button', {name: '昨天深夜的对话'})).toBeTruthy()
  expect(screen.getByRole('region', {name: '更早'})).toBeTruthy()
  vi.useRealTimers()
})

test('narrow navigation contains Tab, closes with Escape, and skip link focuses content without changing routes', () => {
  appearance({narrow: true})
  const nativeFocus = HTMLElement.prototype.focus
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options) {
    // jsdom does not implement inert; preserve the native browser focus boundary here.
    if (!this.closest('[inert]')) nativeFocus.call(this, options)
  })
  render(<WideShell route="home" theme="light" onThemeChange={vi.fn()} onLogout={vi.fn()}><main><h1>首页</h1><button>正文操作</button></main></WideShell>)
  fireEvent.click(screen.getByRole('button', {name: '展开侧栏'}))
  const close = screen.getByRole('button', {name: '收起侧栏'})
  const content = document.querySelector('#main-content')!
  expect(content.hasAttribute('inert')).toBe(true)
  expect(document.activeElement).toBe(close)
  screen.getByRole('button', {name: '打开账号菜单'}).focus()
  fireEvent.keyDown(document.activeElement!, {key: 'Tab'})
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '问山首页'}))
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'})
  expect(content.hasAttribute('inert')).toBe(false)
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '展开侧栏'}))
  fireEvent.click(screen.getByRole('button', {name: '展开侧栏'}))
  expect(content.hasAttribute('inert')).toBe(true)
  const before = location.hash
  fireEvent.click(screen.getByRole('link', {name: '跳到主要内容'}))
  expect(location.hash).toBe(before)
  expect(content.hasAttribute('inert')).toBe(false)
  expect(document.activeElement).toBe(content)
  fireEvent.click(screen.getByRole('button', {name: '展开侧栏'}))
  fireEvent.click(screen.getByRole('button', {name: '搜索'}))
  expect(content.hasAttribute('inert')).toBe(false)
  expect(document.activeElement).toBe(content)
})

test('account menu supports first-item focus, arrow navigation and Escape focus restoration', () => {
  appearance()
  render(<WideShell route="home" theme="light" onThemeChange={vi.fn()} onLogout={vi.fn()}><main>内容</main></WideShell>)
  const trigger = screen.getByRole('button', {name: '打开账号菜单'})
  fireEvent.click(trigger)
  expect(document.activeElement).toBe(screen.getByRole('menuitem', {name: '设置'}))
  fireEvent.keyDown(document.activeElement!, {key: 'ArrowDown'})
  expect(document.activeElement).toBe(screen.getByRole('menuitem', {name: '夜间模式'}))
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'})
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test('theme follows system until the user chooses and keeps the explicit choice on system changes', async () => {
  const setSystem = appearance({dark: true})
  render(<App/>)
  await screen.findByRole('button', {name: '切换夜间模式'})
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('threadpeak-theme')).toBeNull()
  setSystem(false)
  expect(document.documentElement.dataset.theme).toBe('light')
  fireEvent.click(screen.getByRole('button', {name: '切换夜间模式'}))
  expect(localStorage.getItem('threadpeak-theme')).toBe('dark')
  setSystem(true)
  setSystem(false)
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('a saved light choice overrides a dark system preference', async () => {
  appearance({dark: true})
  localStorage.setItem('threadpeak-theme', 'light')
  render(<App/>)
  await screen.findByRole('button', {name: '切换夜间模式'})
  expect(document.documentElement.dataset.theme).toBe('light')
})

test('knowledge library failures render a retryable error instead of an endless loading state', async () => {
  boundary.error = 'offline'
  render(<KnowledgePage/>)
  const error = await screen.findByRole('alert')
  expect(within(error).getByRole('heading', {name: '暂时无法读取你的知识脉络'})).toBeTruthy()
  expect(within(error).getByText('下方示例仍可浏览，你的内容读取失败，请重新连接。')).toBeTruthy()
  expect(screen.queryByText('正在读取你的知识脉络…')).toBeNull()
  fireEvent.click(within(error).getByRole('button', {name: '重新连接'}))
  await waitFor(() => expect(boundary.reload).toHaveBeenCalledOnce())
})
