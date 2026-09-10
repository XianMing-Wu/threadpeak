import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {AuthLanding} from '../../src/pages/AuthLanding'
import {MaterialScope} from '../../src/materials/Materials'
import {SettingsPage} from '../../src/pages/Settings'
import {publishWorkspaceSession} from '../../src/runtime/workspace-session'
import type {MaterialsModel} from '../../src/materials/use-materials'
vi.mock('../../src/components/OrbitField',()=>({OrbitField:()=>null}))
afterEach(()=>{cleanup();publishWorkspaceSession(null);vi.unstubAllGlobals();vi.restoreAllMocks();history.replaceState(null,'','/')})
const identity=(zhihu=false)=>publishWorkspaceSession({kind:zhihu?'authenticated':'guest',provider:zhihu?'zhihu':null,workspaceId:'isolated',capabilities:{zhihuMaterials:zhihu}})
const config=()=>{const stub=vi.fn(async()=>new Response(JSON.stringify({zhihuAvailable:true,zhihuMode:'mock'})));vi.stubGlobal('fetch',stub);return stub}
function model(){return {loaded:true,searchScope:{kind:'zhihu'},folders:[],foldersStatus:'ready',imports:{},loadFolders:vi.fn(),setKind:vi.fn(),setLibraryOpen:vi.fn()} as unknown as MaterialsModel}

test('guest scope has public search and files, without requesting OAuth or folders',async()=>{
 identity();const fetch=config(),m=model();render(<MaterialScope model={m}/>);fireEvent.click(screen.getByRole('button',{name:'搜索范围：全知乎'}))
 expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);expect(screen.getByText('已保存的文件')).toBeTruthy()
 expect(screen.queryByText('仅知乎收藏夹')).toBeNull();expect(m.loadFolders).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('menuitemradio',{name:'全网'}));expect(m.setKind).toHaveBeenCalledWith('web')
})
test('Zhihu account retains its favorites selector',async()=>{
 identity(true);config();const m=model();render(<MaterialScope model={m}/>);fireEvent.click(screen.getByRole('button',{name:'搜索范围：全知乎'}))
 expect(screen.getByText('仅知乎收藏夹')).toBeTruthy();expect(m.loadFolders).toHaveBeenCalledOnce()
 await waitFor(()=>expect(fetch).toHaveBeenCalledOnce())
})
test('guest settings contain no OAuth, connection or favorites entry',()=>{
 identity();const fetch=config();render(<SettingsPage theme="light" onThemeChange={vi.fn()} onLogout={vi.fn()}/>);
 expect(screen.getByText('游客')).toBeTruthy();expect(screen.getByText('学习文件')).toBeTruthy();expect(screen.getByRole('switch',{name:'夜间模式'})).toBeTruthy()
 expect(document.querySelector('.settings-page')?.textContent).not.toMatch(/OAuth|授权|收藏|连接知乎/);expect(fetch).not.toHaveBeenCalled()
})
test('login makes both choices explicit, disables repeat submissions, and allows retry after failure',async()=>{
 config();let reject!:(error:Error)=>void;const onAuthorize=vi.fn(()=>new Promise<void>((_,bad)=>{reject=bad}))
 render(<AuthLanding theme="light" onThemeChange={vi.fn()} onAuthorize={onAuthorize}/>);
 const guest=screen.getByRole('button',{name:'游客登录'});fireEvent.click(guest)
 expect((screen.getByRole('button',{name:'正在进入…'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:/知乎账号登录/}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(guest);expect(onAuthorize).toHaveBeenCalledOnce();reject(new Error('连接暂时中断，请重试。'))
 await screen.findByRole('alert');expect((screen.getByRole('button',{name:'游客登录'}) as HTMLButtonElement).disabled).toBe(false)
 expect(screen.getByText('连接暂时中断，请重试。')).toBeTruthy()
})
test('missing Zhihu configuration never silently logs in as a guest',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({zhihuAvailable:false}))));const onAuthorize=vi.fn(async()=>{})
 render(<AuthLanding theme="light" onThemeChange={vi.fn()} onAuthorize={onAuthorize}/>);
 fireEvent.click(screen.getByRole('button',{name:/知乎账号登录/}));await screen.findByText('知乎账号登录暂未开放，可先以游客身份开始学习。')
 expect(onAuthorize).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'游客登录'}));await waitFor(()=>expect(onAuthorize).toHaveBeenCalledOnce())
})
