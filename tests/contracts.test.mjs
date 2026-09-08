import test from 'node:test'
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {resolveSpecifier} from '../scripts/check-architecture.mjs'
import {ProductLibrarySchema} from '@threadpeak/contracts/product-library'
import {buildPathDocument} from '../src/pathDocument.ts'

test('contract boundary rejects relative deep imports and exposes supported subpaths',()=>{
 const file=resolve('src/consumer.ts')
 assert.throws(()=>resolveSpecifier(file,'../packages/contracts/src/learning-v2.ts'),/public contracts/)
 assert.throws(()=>resolveSpecifier(file,'@threadpeak/contracts/src/learning-v2.ts'),/public contracts/)
 assert.throws(()=>resolveSpecifier(file,'@threadpeak/contracts/unexported'),/public contracts/)
 assert.equal(resolveSpecifier(file,'@threadpeak/contracts/learning-v2'),resolve('packages/contracts/src/learning-v2.ts'))
})
test('library validates all collections and document fields before projection',()=>{
 const document=buildPathDocument({id:'published',title:'title',description:'goal',goalTitle:'goal',goalSummary:'summary',startSummary:'start',carriers:[{id:'carrier',title:'part',summary:'part',concepts:[['c','concept','description']]}]})
 const valid={paths:[{id:'resource',goal:'goal',document,updatedAt:1}],knowledge:[],conversations:[]}
 assert.equal(ProductLibrarySchema.parse(valid).paths[0].id,'resource')
 for(const bad of [{...valid,paths:[{}]},{...valid,paths:[{...valid.paths[0],document:{id:'broken'}}]},{...valid,conversations:[{}]}])assert.equal(ProductLibrarySchema.safeParse(bad).success,false)
})
