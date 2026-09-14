import test from 'node:test'
import assert from 'node:assert/strict'
import {validateCodeExamples,hasUnverifiedCalculationBlocks} from './code-example-check.ts'
const code=body=>'```python\n'+body+'\n```'
test('literal length checks decode escapes, raw strings and Unicode without running code',()=>{
 const cases=[['"abc"',3],['r"C:\\tmp\\a.txt"',12],['"C:\\\\tmp\\\\a.txt"',12],['"a\\n\\u4e2d\\U0001f642"',4]]
 for(const [literal,size] of cases){
  assert.doesNotThrow(()=>validateCodeExamples(code(`s = ${literal}\nprint(s) # show the value\nprint(len(s)) # ${size}`)))
  assert.throws(()=>validateCodeExamples(code(`s = ${literal}\nprint(s)\nprint(len(s)) # ${size+1}`)))
 }
})
test('unsupported or mutated expressions are never evaluated or guessed',()=>{
 for(const literal of ['__import__("os").system("false")','f"{secret}"','"hello" + compute()'])assert.doesNotThrow(()=>validateCodeExamples(code(`s = ${literal}\nprint(len(s)) # 99`)))
 assert.doesNotThrow(()=>validateCodeExamples(code('s = "abc"\ns = input()\nprint(len(s)) # 9')))
 assert.doesNotThrow(()=>validateCodeExamples('> ```python\n> s = "abc"\n> print(len(s)) # 9\n> ```'))
})
test('numeric calculations cannot bypass typed operations through text blocks',()=>{
 const wrap=text=>({sections:[{blocks:[{kind:'text',text}]}]})
 for(const text of ['$2\\times4+3\\times1=11$','$1\\times2$','$$\\frac{2}{3}$$'])assert.equal(hasUnverifiedCalculationBlocks(wrap(text)),true)
 for(const text of ['$x^2$','$m\\times n$','给定风险 $2\\%$','`$2+2=5$`','> $2+2=5$'])assert.equal(hasUnverifiedCalculationBlocks(wrap(text)),false)
 assert.equal(hasUnverifiedCalculationBlocks({sections:[{blocks:[{kind:'calculation',operation:'sum',operands:[2,2]}]}]}),false)
})
