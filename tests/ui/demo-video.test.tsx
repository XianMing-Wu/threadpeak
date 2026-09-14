import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,test,vi} from 'vitest'
import {DemoVideo} from '../../src/demo-video/DemoVideo'
import {ShowcaseNavigation} from '../../src/introduction/ShowcaseNavigation'
import type {ScrollTransition} from '../../src/introduction/scroll-transition'

afterEach(cleanup)

test('the public video entry leaves the introduction iframe and does not create an account',()=>{
  render(<ShowcaseNavigation transition={{current:{progress:0} as ScrollTransition}}/> )
  const link=screen.getByRole('link',{name:'演示视频'})
  expect(link.getAttribute('href')).toBe('/video.html')
  expect(link.getAttribute('target')).toBe('_top')
})

test('video playback stays native and opt-in, with a shared static URL and recoverable media error',()=>{
  render(<DemoVideo/> )
  const video=screen.getByLabelText('项目介绍 · 完整画面') as HTMLVideoElement
  expect(video.controls).toBe(true)
  expect(video.autoplay).toBe(false)
  expect(video.preload).toBe('none')
  expect(video.getAttribute('src')).toBe('/media/project-demo-e2c6800cdc4d.mp4')
  expect(video.hasAttribute('playsinline')).toBe(true)
  fireEvent.error(video)
  expect(screen.getByRole('alert').textContent).toContain('视频暂时未能加载')
  const load=vi.spyOn(video,'load').mockImplementation(()=>{})
  fireEvent.click(screen.getByRole('button',{name:'重新加载'}))
  expect(load).toHaveBeenCalledOnce()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('link',{name:'返回介绍'}).getAttribute('href')).toBe('/#intro')
})
