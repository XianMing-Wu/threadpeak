import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {App} from '../../src/App'
import {EntryLink} from '../../src/introduction/ShowcaseControls'
import {goalTypingAt} from '../../src/introduction/goal-typing'
import {GoalSearchIllustration} from '../../src/introduction/GoalSearchIllustration'

const auth=vi.hoisted(()=>({ensure:vi.fn(async()=>{}),guest:vi.fn(async()=>{})}))
vi.mock('../../src/learning-v2/client',()=>({ensureSession:auth.ensure}))
vi.mock('../../src/runtime/request-auth-session',()=>({requestGuestSession:auth.guest,requestAuthLogout:vi.fn(),oauthNotice:()=> '授权已完成'}))
vi.mock('../../src/pages/AuthLanding',()=>({AuthLanding:({onAuthorize}:{onAuthorize:()=>void})=><main aria-label="登录页"><button onClick={onAuthorize}>游客登录</button><button>知乎账号登录</button></main>}))
vi.mock('../../src/pages/Home',()=>({HomePage:()=> <h1>学习首页</h1>}))
vi.mock('../../src/components/Shell',()=>({WideShell:({children}:{children:React.ReactNode})=><div>{children}</div>}))

beforeEach(()=>{history.replaceState(null,'','/');auth.ensure.mockClear();auth.guest.mockClear()})
afterEach(()=>{cleanup();history.replaceState(null,'','/')})

test('root shows the introduction without a session request, then explicit login keeps both entrances',async()=>{
 render(<App/>);
 expect(screen.getByTitle('问山产品介绍').getAttribute('src')).toBe('/introduction.html');
 expect(auth.ensure).not.toHaveBeenCalled();
 act(()=>{location.hash='#login';window.dispatchEvent(new HashChangeEvent('hashchange'))});
 expect(await screen.findByRole('button',{name:'知乎账号登录'})).toBeTruthy();
 await waitFor(()=>expect(auth.ensure).toHaveBeenCalledOnce());
 // Even an existing session must not bypass the requested login screen.
 expect(screen.queryByRole('heading',{name:'学习首页'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'游客登录'}));
 expect(await screen.findByRole('heading',{name:'学习首页'})).toBeTruthy();
 expect(location.hash).toBe('#home');expect(auth.guest).toHaveBeenCalledOnce();
})

test('OAuth callback bypasses the introduction and preserves its notice before opening the workspace',async()=>{
 history.replaceState(null,'','/?oauth=success');render(<App/>);
 expect(await screen.findByRole('heading',{name:'学习首页'})).toBeTruthy();
 expect(screen.getByRole('alert').textContent).toContain('授权已完成');
 expect(location.search).toBe('');expect(location.hash).toBe('#home');
})

test('both illustrated entrance links leave the introduction frame for the real login route',()=>{
 render(<><EntryLink>登录问山</EntryLink><EntryLink>开始我的学习</EntryLink></>);
 for(const link of screen.getAllByRole('link')){expect(link.getAttribute('href')).toBe('/#login');expect(link.getAttribute('target')).toBe('_top')}
})

test('goal-only illustration switches the goal and all three corresponding steps together',()=>{
 const view=render(<GoalSearchIllustration example={0}/>);
 expect(screen.getByRole('img').getAttribute('aria-label')).toContain('接入资料');
 view.rerender(<GoalSearchIllustration example={1}/>);
 expect(screen.getByRole('img').getAttribute('aria-label')).toContain('用 Python 自动整理每周报表');
 expect(screen.getByText('读取表格')).toBeTruthy();expect(screen.getByText('生成报表')).toBeTruthy();
 expect(screen.queryByText('接入资料')).toBeNull();
})


test('typing completes whole characters before submission and results, with a long readable hold',()=>{
 const length=17;
 for(let time=0;time<4;time+=.01){const frame=goalTypingAt(time,length);expect(Number.isInteger(frame.count)).toBe(true);expect(frame.count).toBeGreaterThanOrEqual(0);expect(frame.count).toBeLessThanOrEqual(length);if(frame.results>0||frame.press>0)expect(frame.count).toBe(length)}
 expect(goalTypingAt(4,length).phase).toBe('complete');expect(goalTypingAt(6,length).phase).toBe('complete');
 expect(goalTypingAt(0,length,true)).toMatchObject({count:length,results:1,caret:false,phase:'complete'});
});
