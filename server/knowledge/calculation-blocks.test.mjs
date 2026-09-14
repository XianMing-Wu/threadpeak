import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateBlock,renderCalculationSlots} from './calculation-blocks.ts'
import {normalizeComposition} from './answer-normalization.ts'
import {execFileSync} from 'node:child_process'
test('decimal, percentage, vector and matrix results are calculated by the program',()=>{
 assert.equal(calculateBlock({operation:'sum',operands:['0.1','0.2']}),'$$0.1+0.2=0.3$$')
 assert.equal(calculateBlock({operation:'relative_change',operands:['0.1','0.06'],format:'percent'}),'$$0.1\\times(1+0.06)=0.106=10.6\\%$$')
 assert.equal(calculateBlock({operation:'quotient',operands:[2,3]}),'$$\\frac{2}{3}=\\frac{2}{3}$$')
 assert.match(calculateBlock({operation:'dot',operands:[[2,3],[4,1]],result:99}),/=11\$\$/)
 const m=calculateBlock({operation:'matrix_product',operands:[[[2,3],[4,1]],[[4,1],[2,3]]]})
 assert.match(m,/14&11\\\\18&7/);assert.match(m,/结果为 2×2/)
 for(let a=-15;a<=15;a++)for(let b=-15;b<=15;b++)assert.equal(calculateBlock({operation:'product',operands:[a,b]}).split('=').at(-1),`${a*b}$$`)
})
test('invalid operations, dimensions and missing data never synthesize a numeric result',()=>{
 for(const c of [{operation:'quotient',operands:[1,0]},{operation:'matrix_product',operands:[[[1,2]],[[3,4]]]},{operation:'dot',operands:[[1],[1,2]]},{operation:'sum',operands:['process.exit()']},{operation:'power',operands:[2,1000000]},{operation:'sum',operands:['1e999']},{operation:'exec',operands:[1,2]}]){
  assert.throws(()=>calculateBlock(c));assert.match(renderCalculationSlots('说明\n\n{{K1}}',[{id:'K1',...c}]),/暂不写入数值结论/)
 }
})
test('calculation slots are local, duplicate IDs are ambiguous, and code remains literal',()=>{
 const calc={id:'K1',operation:'sum',operands:[1,2]}
 assert.equal(renderCalculationSlots('`{{K1}}`\n\n{{K1}}',[calc]),'`{{K1}}`\n\n$$1+2=3$$')
 assert.match(renderCalculationSlots('{{K1}}',[calc,{...calc,operands:[4,5]}]),/暂不写入数值结论/)
 assert.match(renderCalculationSlots('{{K99}}',[calc]),/暂不写入数值结论/)
 const normalized=normalizeComposition({calculations:[calc],sections:[{after:'C1',title:'加法',text:'同一对象\n\n{{K1}}'}]})
 assert.equal(normalized.sections[0].text,'同一对象\n\n$$1+2=3$$');assert.equal(normalized.calculations,undefined)
})

test('local typed blocks preserve operands and percent scale without cross-section IDs',()=>{
 const value=normalizeComposition({sections:[{after:'C1',title:'口径',blocks:[{kind:'text',text:'先计算比例之差。'},{kind:'calculation',operation:'difference',operands:['2%','1%'],format:'percentage_points'},{kind:'text',text:'再以旧值为基数计算变化率。'},{kind:'calculation',operation:'change_rate',operands:['2%','1%'],format:'percent'}]}]})
 assert.match(value.sections[0].text,/0\.02-0\.01=0\.01/);assert.match(value.sections[0].text,/1\\text\{个百分点\}/);assert.match(value.sections[0].text,/-50\\%/)
 const broken=normalizeComposition({sections:[{after:'C1',title:'不足',blocks:[{kind:'calculation',operation:'difference',operands:[2,1],format:'percent'},{kind:'text',text:'不应保留未经核对的百分比结论。'}]}]})
 assert.ok(!broken.sections[0].text.includes('不应保留'));assert.match(broken.sections[0].text,/暂不写入数值结论/)
})

test('shape derivations replace conflicting model explanations while keeping the actual operands',()=>{
 const value=normalizeComposition({sections:[{after:'C1',title:'行列',blocks:[{kind:'text',text:'右矩阵每列只有一个数。'},{kind:'calculation',operation:'matrix_product',operands:[[[2,3]],[[4],[1]]]},{kind:'text',text:'结果为2行。'}]}]})
 assert.doesNotMatch(value.sections[0].text,/每列只有一个数|结果为2行/)
 assert.match(value.sections[0].text,/左矩阵为 1×2，右矩阵为 2×1/)
 assert.match(value.sections[0].text,/结果为 1×1/)
})

test('generated Python literal examples execute with correct lengths and exact regex matching',()=>{
 for(const value of ['C:\\tmp\\a.txt','a.b+[x]?(y)','中文🙂','a\n\t"\'\\','```\n# comment','\0','e\u0301']){
  const rendered=calculateBlock({operation:'python_string',operands:[value]})
  const code=/(`{3,})python\n([\s\S]*?)\n\1/.exec(rendered)[2]
  assert.equal(execFileSync('python3',['-c',code],{encoding:'utf8'}).trim(),String([...value].length))
 }
})
