import {afterEach,expect,test,vi} from 'vitest'
import * as catalog from '../../src/workspace/store'
import {projectLibraryReadModel} from '../../src/runtime/library-read-model'
import {mergeLearningSnapshot} from '../../src/learning-v2/snapshot'
import {readLearning,type LearningSnapshot} from '../../src/learning-v2/client'
afterEach(()=>vi.restoreAllMocks())
test('renamed or absent showcase concepts do not crash the home projection',()=>{
 const card={id:'knowledge-attention-paper',routeId:'example',owner:'example' as const,title:'example',description:'description',icon:'book' as const,sources:1,type:'example'}
 vi.spyOn(catalog,'listExampleKnowledge').mockReturnValue([card])
 const concepts=vi.spyOn(catalog,'listReadOnlyConceptCards').mockReturnValue([{...card,id:'renamed-concept',knowledgeId:card.id}])
 expect(projectLibraryReadModel().recommendedKnowledge[0]?.conceptId).toBe('renamed-concept')
 concepts.mockReturnValue([]);expect(projectLibraryReadModel().recommendedKnowledge).toEqual([])
 expect(projectLibraryReadModel()).not.toHaveProperty('knowledge.mine')
})
test('progress shares the existing body by server data revision; edits preserve only unchanged collections',()=>{
 const old={id:'learning',kind:'learning',revision:2,dataRevision:1,data:{nodes:[{id:'root',title:'old'}],articles:[],conversations:[]},job:null} as unknown as LearningSnapshot
 const progress={...structuredClone(old),revision:3}
 const stringify=vi.spyOn(JSON,'stringify')
 expect(mergeLearningSnapshot(old,progress).data).toBe(old.data)
 const edited={...structuredClone(old),revision:4,dataRevision:4};edited.data.nodes[0]!.title='new'
 const merged=mergeLearningSnapshot(old,edited)
 expect(merged.data.nodes).toBe(edited.data.nodes);expect(merged.data.articles).toBe(old.data.articles);expect(old.data.nodes[0]!.title).toBe('old')
 expect(mergeLearningSnapshot(merged,progress)).toBe(merged);expect(stringify).not.toHaveBeenCalled()
 expect(()=>readLearning({...edited,dataRevision:5})).toThrow('版本')
})
