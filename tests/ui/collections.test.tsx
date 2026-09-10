import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { KnowledgePage, PathsPage } from '../../src/pages/Collections'
import { buildPathDocument } from '../../src/pathDocument'
import { resetSession } from '../../src/learning-v2/client'
import { clearProductLibrary } from '../../src/learning-v2/library'
import { accountStorageForExport } from '../../src/learning-v2/account-storage'
import { mineRouteFromValidatedDocument } from '../../src/workspace/published-route'
import { LEGACY_WORKSPACE_KEY, readSnapshot } from '../../src/workspace/snapshot-cache'

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); resetSession(); clearProductLibrary(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const document = buildPathDocument({ id: 'current-document', title: '当前服务端路线', description: '当前学习目标', goalTitle: '成果', goalSummary: '完成目标', startSummary: '开始', carriers: [{ id: 'carrier', title: '当前课程', summary: '课程', concepts: [['concept', '当前概念', '说明']] }] })
const library = { paths: [{ id: 'current-path', goal: '当前学习目标', document, updatedAt: 100 }], knowledge: [{ id: 'current-learning', routeId: 'current-path', conceptId: 'concept', title: '当前概念' }], conversations: [] }
function prepare({ empty = false, offline = false, damaged = false } = {}) {
  const oldRoute = mineRouteFromValidatedDocument('旧目标', 'old-chat', document, 1, 'old-route')
  const archive = { version: 1, routes: [{ ...oldRoute, title: '旧路线不能混入当前列表' }], knowledge: [{ id: 'old-knowledge', routeId: 'old-route', owner: 'mine', title: '旧知识不能混入当前列表', description: '', icon: 'book', sources: 0, type: '旧知识', seedConceptId: 'concept', createdAt: 1, updatedAt: 1, graph: { nodes: [], edges: [] } }], conversations: Array.from({ length: 40 }, (_, i) => ({ id: `old-chat-${i}`, kind: 'home-route', title: '重复的旧对话', query: '旧目标', experience: 'route', turns: [{ role: 'user', text: '旧对话原文' }], value: '', quote: '', mode: '', updatedAt: i })), lessons: {} }
  const raw = damaged ? '{unreadable-original' : JSON.stringify(archive)
  localStorage.setItem('tp-server-workspace', 'collections-test')
  localStorage.setItem(LEGACY_WORKSPACE_KEY, raw)
  location.hash = 'paths'
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (offline) throw Error('offline')
    if (url === '/api/v2/session') return Response.json({ workspaceId: 'collections-test', kind: 'guest' })
    if (url === '/api/v2/library') return Response.json(empty ? { paths: [], knowledge: [], conversations: [] } : library)
    throw Error(`Unexpected request: ${url}`)
  }))
  return raw
}
function expectNoArchive() {
  expect(screen.queryByText('旧版内容 · 只读归档')).toBeNull()
  expect(screen.queryByText('旧路线不能混入当前列表')).toBeNull()
  expect(screen.queryByText('旧知识不能混入当前列表')).toBeNull()
  expect(screen.queryByText('重复的旧对话')).toBeNull()
}

test.each(['paths', 'knowledge'])('%s ignores valid legacy records, keeps current resources usable and preserves original bytes', async page => {
  const raw = prepare()
  expect(readSnapshot(LEGACY_WORKSPACE_KEY).conversations).toHaveLength(40)
  const view = render(page === 'paths' ? <PathsPage/> : <KnowledgePage/>)
  await screen.findByRole('heading', { name: '当前服务端路线' })
  expectNoArchive()
  expect(screen.queryByRole('button', { name: '导出本地备份' })).toBeNull()
  expect(view.container.querySelector('.product-workspace')?.children).toHaveLength(1)
  if (page === 'paths') {
    expect(screen.getByText('显示 1 / 1 条学习路线')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: '学习路线' })).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '重复的旧对话' } })
    expect(screen.getByText('没有找到匹配内容')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }))
    fireEvent.click(screen.getByRole('button', { name: '示例路线' }))
    expect(screen.queryByText('当前服务端路线')).toBeNull()
    expectNoArchive()
    fireEvent.click(screen.getByRole('button', { name: '我的路线' }))
    fireEvent.click(screen.getByRole('button', { name: /当前服务端路线/ }))
    expect(location.hash).toBe('#path-3d')
  } else {
    fireEvent.click(screen.getByRole('button', { name: /当前概念/ }))
    expect(location.hash).toBe('#knowledge-detail?resource=current-learning')
  }
  expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe(raw)
  expect((await accountStorageForExport()).local[LEGACY_WORKSPACE_KEY]).toBe(raw)
})

test.each([false, true])('an empty or offline route library never falls back to legacy content (offline=%s)', async offline => {
  const raw = prepare({ empty: true, offline })
  render(<PathsPage/>)
  await screen.findByText(offline ? '暂时无法读取路线' : '还没有自己的路线')
  expectNoArchive()
  expect(screen.queryByRole('button', { name: '导出本地备份' })).toBeNull()
  expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe(raw)
})

test.each(['paths', 'knowledge'])('%s displays only an actual recovery failure inside the scrolling page', async page => {
  const raw = prepare({ damaged: true })
  const view = render(page === 'paths' ? <PathsPage/> : <KnowledgePage/>)
  await screen.findByRole('heading', { name: '当前服务端路线' })
  const notice = screen.getByRole('complementary', { name: '本地数据恢复' })
  expect(notice.closest('main')).toBeTruthy()
  expect(within(notice).getByRole('button', { name: '导出本地备份' })).toBeTruthy()
  expect(view.container.querySelector('.product-workspace')?.children).toHaveLength(1)
  expectNoArchive()
  expect((await accountStorageForExport()).local[LEGACY_WORKSPACE_KEY]).toBe(raw)
  await waitFor(() => expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe(raw))
})
