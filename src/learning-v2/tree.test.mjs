import test from 'node:test'
import assert from 'node:assert/strict'
import {validateTree} from '@threadpeak/contracts/learning-v2'
import {layoutTree,descendants,documentOrder,childrenByParent,offsetTree} from './tree.ts'
const card=(id,parent)=>({id,type:id==='root'?'root':'custom',title:id,text:'',parents:parent?[parent]:[],sources:[]})
test('a 20,000-card chain validates, lays out and orders without recursion',()=>{
 const nodes=Array.from({length:20_000},(_,i)=>card(i?`n${i}`:'root',i?i===1?'root':`n${i-1}`:null))
 validateTree(nodes);const layout=layoutTree(nodes,[],[])
 assert.equal(Object.keys(layout).length,nodes.length);assert.ok(layout.n19999.x>layout.n19998.x)
 assert.equal(descendants(nodes,'root').length,nodes.length)
 const {rows}=documentOrder(nodes);assert.equal(rows.length,nodes.length-1);assert.equal(rows.at(-1).depth,19998)
 const invalid=structuredClone(nodes);invalid[1].parents=['n19999'];assert.throws(()=>validateTree(invalid),/TREE_CYCLE/)
})
test('parallel children preserve placement, collapsing and cumulative drag offsets',()=>{
 const nodes=[card('root'),card('a','root'),card('b','root'),card('c','a')],base=layoutTree(nodes,[],[])
 assert.equal(base.a.x,base.b.x);assert.ok(base.a.y<base.b.y);assert.ok(base.c.x>base.a.x)
 assert.equal(layoutTree(nodes,['a'],[]).c,undefined)
 assert.deepEqual(documentOrder(nodes).rows.map(r=>r.node.id),['a','c','b'])
 assert.deepEqual(documentOrder(nodes,['a']).rows.map(r=>r.node.id),['a','b'])
 const placed=offsetTree(base,childrenByParent(nodes),{a:{x:10,y:20},c:{x:5,y:2}})
 assert.equal(placed.c.x,base.c.x+15);assert.equal(placed.c.y,base.c.y+22);assert.deepEqual(placed.b,base.b)
})
