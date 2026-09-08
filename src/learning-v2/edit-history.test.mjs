import test from 'node:test'
import assert from 'node:assert/strict'
import {editEntry,applyEditEntry} from './edit-history.ts'
import {nodeFieldPatch,mergeNodeFieldPatch} from '@threadpeak/contracts/node-edits'
const card=(id,text='old')=>({id,type:'custom',title:id,text,parents:['root'],sources:[]})
test('one-card patches and undo retain concurrent cards and unrelated fields, with conflict detection',()=>{
 const base=Array.from({length:20000},(_,i)=>card(String(i))),after=base.map(n=>n.id==='12'?{...n,text:'edited'}:n),patch=nodeFieldPatch(base,after)
 assert.equal(patch.nodes.length,1);assert.ok(JSON.stringify(patch).length<1000)
 const current=[...base.map(n=>n.id==='12'?{...n,color:'#123456'}:n),card('server-new')]
 const merged=mergeNodeFieldPatch(patch,current);assert.equal(merged.length,20001);assert.equal(merged[12].text,'edited');assert.equal(merged[12].color,'#123456')
 const history=editEntry(base,after);assert.equal(history.nodes.length,1)
 const undone=applyEditEntry(history,merged,true);assert.equal(undone[12].text,'old');assert.equal(undone[12].color,'#123456');assert.equal(undone.at(-1).id,'server-new')
 const redone=applyEditEntry(history,undone);assert.equal(redone[12].text,'edited')
 assert.throws(()=>applyEditEntry(history,redone.map(n=>n.id==='12'?{...n,text:'concurrent'}:n),true),/NODE_EDIT_CONFLICT/)
 assert.throws(()=>mergeNodeFieldPatch({baseNodes:[card('a')],nodes:[card('b')]},current),/NODE_EDIT_CONFLICT/)
})
test('structural history restores order while retaining independently added cards',()=>{
 const base=[card('a'),card('b')],after=[base[1],base[0],card('new')]
 assert.equal(nodeFieldPatch(base,after),undefined)
 const history=editEntry(base,after),current=[...after,card('concurrent')],undo=applyEditEntry(history,current,true)
 assert.deepEqual(undo.map(n=>n.id),['a','b','concurrent']);assert.deepEqual(applyEditEntry(history,undo).map(n=>n.id),['b','a','new','concurrent'])
})
