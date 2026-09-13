import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceStream} from './streaming-text.ts'
test('large provider chunks reveal smoothly, preserving Unicode and catching up without stalls',()=>{
 const text='你好😀，这是实际接收到的回答。'.repeat(50);let shown=0,ticks=0
 while(shown<text.length&&ticks<200){const next=advanceStream(text,shown,34);assert.ok(next>shown);assert.ok(next-shown<text.length/5);assert.ok(!/[\uD800-\uDBFF]$/.test(text.slice(0,next)));shown=next;ticks++}
 assert.equal(shown,text.length);assert.ok(ticks>10&&ticks<80)
 assert.equal(advanceStream(text,text.length,34),text.length)
})
