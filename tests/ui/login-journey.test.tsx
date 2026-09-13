import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthLanding } from '../../src/pages/AuthLanding'
import { LoginJourney } from '../../src/pages/LoginJourney'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('login artwork can be paused without changing the two authentication actions', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ zhihuAvailable: true }))))
  const authorize = vi.fn(async () => {})
  const { container } = render(<AuthLanding theme="light" onThemeChange={() => {}} onAuthorize={authorize}/>)
  await act(async () => {})
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: '暂停插画动画' }))
  const picture = container.querySelector('.login-journey')!
  const pose = picture.getAttribute('data-chapter')
  act(() => vi.advanceTimersByTime(16000))
  expect(picture.getAttribute('data-chapter')).toBe(pose)
  expect(picture.getAttribute('data-running')).toBe('false')
  expect(screen.getByRole('button', { name: '知乎账号登录' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '游客登录' })).toBeTruthy()
  expect(authorize).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '播放插画动画' }))
  act(() => vi.advanceTimersByTime(5500))
  expect(picture.getAttribute('data-chapter')).not.toBe(pose)
})

test('reduced motion and a hidden document stop the decorative timeline', () => {
  vi.useFakeTimers()
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList)
  const { container, unmount } = render(<LoginJourney paused={false}/>)
  const picture = container.querySelector('.login-journey')!
  act(() => vi.advanceTimersByTime(20000))
  expect(picture.getAttribute('data-chapter')).toBe('0')
  expect(picture.getAttribute('data-running')).toBe('false')
  media.matches = false
  act(() => media.addEventListener.mock.calls[0][1]())
  expect(picture.getAttribute('data-running')).toBe('true')
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  const pose = picture.getAttribute('data-chapter')
  act(() => vi.advanceTimersByTime(20000))
  expect(picture.getAttribute('data-chapter')).toBe(pose)
  expect(picture.getAttribute('data-running')).toBe('false')
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(media.removeEventListener).toHaveBeenCalledOnce()
})
