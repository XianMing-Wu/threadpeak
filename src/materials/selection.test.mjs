import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeScope, selectedMaterials, materialsReady } from './selection.ts'
import { SearchScopeSchema } from '@threadpeak/contracts/search-scope'
const file={sourceId:'file-1',fileName:'notes.md',content:'学习笔记',status:'ready',origin:'upload'}
const first={sourceId:'folder-1',folderId:'101',fileName:'线性代数',content:'第一份收藏',status:'ready',origin:'collection'}
const second={...first,sourceId:'folder-2',folderId:'102',fileName:'机器学习'}

test('deselected or late imported folders never enter a route, while files stay available',()=>{
  const cached={'101':first,'102':second}
  assert.deepEqual(selectedMaterials([file],cached,{kind:'collections',folderIds:['102']}).map(a=>a.sourceId),['file-1','folder-2'])
  for(const kind of ['zhihu','web']) assert.deepEqual(selectedMaterials([file],cached,{kind}).map(a=>a.sourceId),['file-1'])
  assert.deepEqual(selectedMaterials([file,first],cached,{kind:'web'}),[file])
})
test('collections wait for every selected folder and forbid an empty selection',()=>{
  assert.equal(materialsReady([file],{}, {kind:'collections',folderIds:[]}),false)
  assert.equal(SearchScopeSchema.safeParse({kind:'collections',folderIds:[]}).success,false)
  const scope={kind:'collections',folderIds:['101','102']}
  assert.equal(materialsReady([file],{'101':first},scope),false)
  assert.equal(materialsReady([file],{'101':first,'102':{...second,status:'processing'}},scope),false)
  assert.equal(materialsReady([file],{'101':first,'102':second},scope),true)
  assert.equal(materialsReady([{...file,status:'processing'}],{}, {kind:'web'}),false)
})
test('draft restoration deduplicates valid folder IDs and rejects arbitrary scope fields',()=>{
  assert.deepEqual(normalizeScope({kind:'collections',folderIds:['101','101','',null,'mock-collection-2']}),{kind:'collections',folderIds:['101','mock-collection-2']})
  assert.deepEqual(normalizeScope({kind:'web',folderIds:['101']}),{kind:'web'})
  assert.deepEqual(normalizeScope({kind:'unexpected'}),{kind:'zhihu'})
})
