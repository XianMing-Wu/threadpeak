import test from 'node:test'
import assert from 'node:assert/strict'
import {evidenceUrlKey} from './evidence-url.ts'
import {packAuthorSearchQueries} from './pack-search.ts'
test('deduplication preserves content query and hash identities while dropping tracking tags',()=>{
 assert.notEqual(evidenceUrlKey('https://example.com/read?id=a'),evidenceUrlKey('https://example.com/read?id=b'))
 assert.notEqual(evidenceUrlKey('https://example.com/#/a'),evidenceUrlKey('https://example.com/#/b'))
 assert.equal(evidenceUrlKey('https://example.com/read?id=a&utm_source=mail&fbclid=tag'),evidenceUrlKey('https://example.com/read?id=a'))
 assert.equal(evidenceUrlKey('https://www.zhihu.com/question/1/answer/2'), 'https://www.zhihu.com/question/1/answer/2')
})
test('author packing validates every phrase and retains all three within two bounded requests',()=>{
 const queries=['甲'.repeat(90),'乙'.repeat(90),'丙'.repeat(90)],packed=packAuthorSearchQueries(queries)
 assert.deepEqual(packed.map(p=>p.query.length),[181,90]);assert.deepEqual(packed.flatMap(p=>p.sourceIds),['0','1','2'])
 assert.deepEqual(packAuthorSearchQueries(queries.slice(0,2)).map(p=>p.query),queries.slice(0,2))
 assert.throws(()=>packAuthorSearchQueries(['甲'.repeat(20),'乙'.repeat(150),'丙'.repeat(150)]),/90/)
})
