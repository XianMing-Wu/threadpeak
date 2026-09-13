import {expect,test,vi,afterEach} from 'vitest'
import {act,cleanup,render,screen} from '@testing-library/react'
const gate=vi.hoisted(()=>{let release!:()=>void;const ready=new Promise<void>(r=>{release=r});return {ready,release}})
vi.mock('../../src/learning-v2/client',()=>({ensureSession:async()=>{}}))
vi.mock('../../src/components/Shell',()=>({WideShell:({children}:{children:React.ReactNode})=><main data-testid="shell"><nav>固定导航</nav>{children}</main>}))
vi.mock('../../src/pages/ProductIntroduction',()=>({ProductIntroduction:()=>null}))
vi.mock('../../src/pages/AuthLanding',()=>({AuthLanding:()=> <main>知乎账号登录 / 游客登录</main>}))
vi.mock('../../src/pages/Home',()=>({HomePage:()=> <div>当前首页</div>}))
vi.mock('../../src/learning-v2/Authors',async()=>{await gate.ready;return {DurableAuthorsPage:()=> <div>博主网络内容</div>}})
import {App} from '../../src/App'
afterEach(cleanup)
test('a cold lazy navigation keeps the shell and previous page until the next module is ready',async()=>{
 window.location.hash='home';render(<App/>);await screen.findByText('当前首页');const shell=screen.getByTestId('shell')
 await act(async()=>{window.location.hash='authors';window.dispatchEvent(new HashChangeEvent('hashchange'))})
 expect(screen.getByTestId('shell')).toBe(shell);expect(screen.getByText('当前首页')).toBeTruthy();expect(screen.queryByText('正在打开页面…')).toBeNull()
 // A login click must interrupt a suspended page transition without waiting for its chunk.
 await act(async()=>{window.location.hash='login';window.dispatchEvent(new HashChangeEvent('hashchange'))})
 expect(screen.getByText('知乎账号登录 / 游客登录')).toBeTruthy();expect(screen.queryByTestId('shell')).toBeNull()
 await act(async()=>{window.location.hash='authors';window.dispatchEvent(new HashChangeEvent('hashchange'))})
 await act(async()=>gate.release());await screen.findByText('博主网络内容');expect(screen.getByTestId('shell')).toBeTruthy();expect(screen.queryByText('当前首页')).toBeNull()
})
