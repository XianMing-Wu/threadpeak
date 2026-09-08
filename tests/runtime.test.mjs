import test from 'node:test'
import assert from 'node:assert/strict'
import {pollResource} from '../src/learning-v2/poll.ts'
import {mergeLearningSnapshot} from '../src/learning-v2/snapshot.ts'

test('resource reconnects back off, stop after bounded failures, and preserve cancellation',async()=>{
 const waits=[],errors=[];let calls=0
 await pollResource(async()=>{calls++;throw Error('offline')},{signal:new AbortController().signal,wait:async ms=>{waits.push(ms)},onError:(_e,stopped)=>errors.push(stopped)})
 assert.equal(calls,6);assert.deepEqual(waits,[1000,2000,4000,8000,16000]);assert.equal(errors.at(-1),true)
 const abort=new AbortController();abort.abort();await pollResource(async()=>assert.fail('unmounted fetch'),{signal:abort.signal})
})
test('server snapshot application is monotonic and never mutates a validated payload',()=>{
 const old={id:'s',revision:2,data:{nodes:[],articles:[],conversations:[]}},next={...old,revision:3,data:{nodes:[],articles:[],conversations:[]}}
 Object.freeze(next);Object.freeze(next.data)
 assert.equal(mergeLearningSnapshot(old,{...next,revision:1}),old)
 const applied=mergeLearningSnapshot(old,next)
 assert.equal(applied.revision,3);assert.equal(applied.data.nodes,old.data.nodes);assert.notEqual(applied,next)
 assert.notEqual(next.data.nodes,old.data.nodes)
})
