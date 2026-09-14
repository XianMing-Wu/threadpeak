import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {ExampleWorkspace} from '../../src/learning-v2/ExampleWorkspace'
import {showcaseRoutes} from '../../src/showcase/content'
import {listReadOnlyConceptCards,getRoute} from '../../src/workspace/store'
import {projectLibraryReadModel} from '../../src/runtime/library-read-model'

vi.mock('../../src/learning-v2/Workspace',()=>({LearningWorkspace:({conceptId}:{conceptId:string})=><div data-testid="prepared-learning">{conceptId}</div>}))
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

test('library exposes the first three prepared concepts per route while retaining complete routes',()=>{
 const library=projectLibraryReadModel()
 for(const route of showcaseRoutes){
  const prepared=route.concepts.slice(0,3).map(c=>c.id)
  expect(listReadOnlyConceptCards('knowledge-'+route.id).map(c=>c.id)).toEqual(prepared)
  expect(library.recommendedKnowledge.find(k=>k.routeId===route.id)?.conceptId).toBe(prepared[0])
  expect(getRoute(route.id)).toBeDefined()
 }
})

test.each(showcaseRoutes)('$id: unprepared route nodes show scope without creating personal jobs',route=>{
 const request=vi.fn(),back=vi.fn();vi.stubGlobal('fetch',request)
 const view=render(<ExampleWorkspace knowledgeId={'knowledge-'+route.id} conceptId={route.concepts[3].id} onBack={back}/>)
 expect(screen.getByRole('heading',{name:route.concepts[3].title})).toBeDefined()
 expect(screen.getByRole('link',{name:'开始我的学习'}).getAttribute('href')).toBe('#home')
 fireEvent.click(screen.getByRole('button',{name:'返回路线'}));expect(back).toHaveBeenCalledOnce()
 view.rerender(<ExampleWorkspace knowledgeId={'knowledge-'+route.id} conceptId={route.concepts[0].id} onBack={back}/>)
 expect(screen.getByTestId('prepared-learning').textContent).toBe(route.concepts[0].id)
 expect(request).not.toHaveBeenCalled()
})
