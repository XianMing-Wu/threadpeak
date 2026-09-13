import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthLanding } from '../../src/pages/AuthLanding'
import { SettingsPage } from '../../src/pages/Settings'
import { publishWorkspaceSession } from '../../src/runtime/workspace-session'
import { requestAuthStart } from '../../src/runtime/request-auth-session'
import { openDatabase, migrate } from '../../server/durable/database'
import { DurableStore } from '../../server/durable/store'
import { DurableWorker } from '../../server/durable/worker'
import { createProductApp } from '../../server/durable/http'
import { ZhihuLogin, loginConfig } from '../../server/durable/zhihu-oauth'

// Canvas animation has no bearing on identity. Auth and HTTP routes remain real.
vi.mock('../../src/components/OrbitField',()=>({OrbitField:()=>null}))
afterEach(()=>{cleanup();publishWorkspaceSession(null);vi.unstubAllGlobals();history.replaceState(null,'','/')})

test('actual login config and start HTTP routes expose real OAuth without app keys or demo UI',async()=>{
  const db=await openDatabase();await migrate(db)
  const config=loginConfig({ZHIHU_OAUTH_APP_ID:'test-ui-app',ZHIHU_OAUTH_APP_KEY:'test-ui-secret',ZHIHU_OAUTH_REDIRECT_URI:'http://localhost:3000/api/auth/zhihu/callback',THREADPEAK_TOKEN_SECRET:'test-ui-encryption-secret-32-characters'})!
  const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
  const login=new ZhihuLogin(db,config,async()=>{throw Error('Authorization requires the user')})
  const app=await createProductApp({store,worker,identity:{production:false},providersReady:true,zhihuLogin:login})
  const requests:string[]=[]
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    requests.push(url)
    const response=await app.inject({url})
    return new Response(response.body,{status:response.statusCode,headers:{'content-type':'application/json'}})
  }))
  try{
    render(<AuthLanding theme="light" onThemeChange={()=>{}} onAuthorize={async()=>{}}/>)
    await waitFor(()=>expect(requests).toContain('/api/auth/config'))
    expect(screen.getByRole('button',{name:'知乎账号登录'}).hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText('演示')).toBeNull()
    const result=await requestAuthStart()
    expect(result.kind).toBe('redirect')
    if(result.kind==='redirect'){
      const url=new URL(result.authorizeUrl)
      expect(url.origin).toBe('https://openapi.zhihu.com')
      expect(url.searchParams.get('app_id')).toBe('test-ui-app')
      expect(url.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/)
      expect(result.authorizeUrl).not.toContain('test-ui-secret')
    }
  }finally{await app.close();await db.close()}
})

test.each([
  ['cancelled','已取消知乎授权'],['busy','知乎暂时繁忙'],['failed','知乎登录未完成'],
])('callback %s displays a safe login notice and leaves guest entry available',async(status,text)=>{
  history.replaceState(null,'','/?oauth='+status+'&error_description=do-not-display')
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({zhihuAvailable:true,zhihuMode:'real'}))))
  const guest=vi.fn(async()=>{})
  render(<AuthLanding theme="light" onThemeChange={()=>{}} onAuthorize={guest}/>)
  expect(screen.getByRole('alert').textContent).toContain(text)
  expect(screen.queryByText('do-not-display')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'游客登录'}))
  await waitFor(()=>expect(guest).toHaveBeenCalledOnce())
})

test('expired OAuth account can reconnect from settings; guest sees no OAuth entry',async()=>{
  publishWorkspaceSession({kind:'authenticated',provider:'zhihu',workspaceId:'test-owned-workspace',capabilities:{zhihuMaterials:true},profile:{name:'测试用户'},authorization:{status:'expired',expiresAt:0}})
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({code:'ZHIHU_NOT_CONFIGURED',message:'暂时无法连接知乎，请稍后重试。'}),{status:503}))
  vi.stubGlobal('fetch',fetcher)
  const view=render(<SettingsPage theme="light" onThemeChange={()=>{}} onLogout={()=>{}}/>)
  expect(screen.getByText('知乎授权已到期')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'重新连接'}))
  await screen.findByText('暂时无法连接知乎，请稍后重试。')
  expect(fetcher).toHaveBeenCalledWith('/api/auth/zhihu/start',expect.anything())
  view.unmount()
  publishWorkspaceSession({kind:'guest',provider:null,workspaceId:'test-guest-workspace',capabilities:{zhihuMaterials:false}})
  render(<SettingsPage theme="light" onThemeChange={()=>{}} onLogout={()=>{}}/>)
  expect(screen.queryByRole('button',{name:'重新连接'})).toBeNull()
})
