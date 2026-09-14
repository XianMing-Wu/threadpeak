import {fromMarkdown} from 'mdast-util-from-markdown'

type Fraction={n:bigint;d:bigint}
const gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a<0n?-a:a
function fraction(n:bigint,d=1n):Fraction{
 if(!d)throw Error('zero denominator')
 if(n.toString().length+d.toString().length>2000)throw Error('numeric budget')
 const g=gcd(n,d),sign=d<0n?-1n:1n;return {n:n/g*sign,d:d/g*sign}
}
function number(value:unknown):Fraction{
 if(typeof value!=='number'&&typeof value!=='string')throw Error('number required')
 const raw=String(value).trim();if(raw.endsWith('%'))return divide(number(raw.slice(0,-1)),fraction(100n));
 const s=raw;if(s.length>80||!/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(s))throw Error('finite decimal required')
 const [mantissa,exp='0']=s.toLowerCase().split('e'),exponent=Number(exp)
 if(!Number.isInteger(exponent)||Math.abs(exponent)>30)throw Error('exponent budget')
 const places=mantissa!.split('.')[1]?.length??0,n=BigInt(mantissa!.replace('.','')),scale=places-exponent
 return scale>=0?fraction(n,10n**BigInt(scale)):fraction(n*10n**BigInt(-scale))
}
const add=(a:Fraction,b:Fraction)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d)
const multiply=(a:Fraction,b:Fraction)=>fraction(a.n*b.n,a.d*b.d)
const divide=(a:Fraction,b:Fraction)=>fraction(a.n*b.d,a.d*b.n)
const tex=(a:Fraction)=>a.d===1n?String(a.n):`\\frac{${a.n}}{${a.d}}`
const display=(a:Fraction)=>{
 let d=a.d;while(d%2n===0n)d/=2n;while(d%5n===0n)d/=5n
 if(d!==1n)return tex(a)
 const sign=a.n<0n?'-':'',n=a.n<0n?-a.n:a.n,whole=n/a.d;let rest=n%a.d,digits=''
 while(rest&&digits.length<40){rest*=10n;digits+=String(rest/a.d);rest%=a.d}
 return rest?tex(a):sign+whole+(digits?'.'+digits:'')
}
const wrap=(a:Fraction)=>a.n<0n?`(${display(a)})`:display(a)
const vector=(value:unknown):Fraction[]=>{
 if(!Array.isArray(value)||!value.length||value.length>32)throw Error('vector size')
 return value.map(number)
}
const matrix=(value:unknown):Fraction[][]=>{
 if(!Array.isArray(value)||!value.length||value.length>12)throw Error('matrix size')
 const rows=value.map(vector);if(rows[0]!.length>12||rows.some(row=>row.length!==rows[0]!.length))throw Error('matrix shape')
 return rows
}
const dot=(a:Fraction[],b:Fraction[])=>{
 if(a.length!==b.length)throw Error('dimension mismatch')
 return a.reduce((sum,x,i)=>add(sum,multiply(x,b[i]!)),fraction(0n))
}
const matrixTex=(m:Fraction[][])=>`\\begin{bmatrix}${m.map(row=>row.map(display).join('&')).join('\\\\')}\\end{bmatrix}`
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}

/** Declarative data only: no code, eval, external tools or model-computed result.
 * Decimal operands are exact rationals. A malformed calculation cannot publish
 * a guessed number; the rest of the lesson remains readable. */
export function calculateBlock(input:unknown):string{
 const c=object(input),args=c.operands
 if(!Array.isArray(args)||!args.length||args.length>32)throw Error('operands required')
 if(c.operation==='python_string'){
  if(args.length!==1||typeof args[0]!=='string'||args[0].length>4000||/[\uD800-\uDFFF]/u.test(args[0]))throw Error('literal string required')
  const literal=JSON.stringify(args[0]),size=[...args[0]].length
  const fence='`'.repeat(Math.max(3,...(literal.match(/`+/g)??[]).map(s=>s.length+1)))
  return `普通字符串先得到字符内容，正则表达式再解释这些字符。匹配任意字面文本时，可用标准库 re.escape 处理正则层，不靠手数反斜杠。\n\n${fence}python\nimport re\nvalue = ${literal}\nprint(len(value)) # ${size}\npattern = re.compile(re.escape(value))\nassert pattern.fullmatch(value) is not None\n${fence}\n\n这段字面值按 Unicode 码点计数共有 ${size} 个字符；组合字符或表情的显示宽度与这个数量可能不同。re.escape 接收字符串的实际字符内容，返回用于字面匹配的模式；fullmatch 检查整个文本。`
 }
 if(c.operation==='matrix_product'){
  if(args.length!==2)throw Error('arity')
  const a=matrix(args[0]),b=matrix(args[1]);if(a[0]!.length!==b.length)throw Error('dimension mismatch')
  const result=a.map(row=>b[0]!.map((_,j)=>dot(row,b.map(r=>r[j]!))))
  const steps=result.length*result[0]!.length<=16?result.flatMap((row,i)=>row.map((cell,j)=>`第 ${i+1} 行、第 ${j+1} 列：左边第 ${i+1} 行与右边第 ${j+1} 列对应相乘后求和，$${a[i]!.map((x,k)=>`${wrap(x)}\\times${wrap(b[k]![j]!)}`).join('+')}=${display(cell)}$。`)).join('\n\n'):''
  return `左矩阵为 ${a.length}×${a[0]!.length}，右矩阵为 ${b.length}×${b[0]!.length}；内侧维度相同，结果为 ${result.length}×${result[0]!.length}。\n\n$$${matrixTex(a)}${matrixTex(b)}=${matrixTex(result)}$$${steps?'\n\n'+steps:''}`
 }
 if(c.operation==='dot'){
  if(args.length!==2)throw Error('arity')
  const a=vector(args[0]),b=vector(args[1]),value=dot(a,b)
  return `两个向量都有 ${a.length} 个分量；只配对相同位置，逐项相乘后求和，结果是一个数。\n\n$$(${a.map(display).join(',')})\\cdot(${b.map(display).join(',')})=${a.map((x,i)=>`${wrap(x)}\\times${wrap(b[i]!)}`).join('+')}=${display(value)}$$`
 }
 const values=args.map(number),a=values[0]!,b=values[1]!,two=()=>{if(values.length!==2)throw Error('arity')}
 let expression:string,result:Fraction
 switch(c.operation){
  case 'sum':expression=values.map(wrap).join('+');result=values.reduce(add,fraction(0n));break
  case 'product':expression=values.map(wrap).join('\\times');result=values.reduce(multiply,fraction(1n));break
  case 'difference':two();expression=`${wrap(a)}-${wrap(b)}`;result=add(a,fraction(-b.n,b.d));break
  case 'quotient':two();expression=`\\frac{${display(a)}}{${display(b)}}`;result=divide(a,b);break
  case 'power':two();if(b.d!==1n||b.n<0n||b.n>20n||a.n===0n&&b.n===0n)throw Error('power range');expression=`${wrap(a)}^{${b.n}}`;result=fraction(a.n**b.n,a.d**b.n);break
  case 'change_rate':two();result=divide(add(b,fraction(-a.n,a.d)),a);expression=`\\frac{${wrap(b)}-${wrap(a)}}{${display(a)}}`;break
  case 'apply_rate':
  case 'relative_change':two();expression=`${wrap(a)}\\times(1+${wrap(b)})`;result=multiply(a,add(fraction(1n),b));break
  default:throw Error('unknown operation')
 }
 if(['percent','percentage_points'].includes(String(c.format))&&['sum','difference'].includes(String(c.operation))&&args.some(v=>(typeof v==='number'||typeof v==='string'&&!v.includes('%'))&&Math.abs(Number(v))>=1))throw Error('ambiguous percentage scale')
 return `$$${expression}=${display(result)}${c.format==='percentage_points'?`\\quad(${display(multiply(result,fraction(100n)))}\\text{个百分点})`:c.format==='percent'?`=${display(multiply(result,fraction(100n)))}\\%`:''}$$`
}
const unavailable='这里的运算尚缺可确定的操作数或成立条件，因此暂不写入数值结论；可对照原有材料核对条件后继续。'

/** Replace slots outside code/math/quotes. Duplicate IDs are ambiguous; never
 * choose one arbitrarily or execute a payload embedded in source text. */
export function renderCalculationSlots(text:string,calculations:unknown):string{
 const map=new Map<string,string>(),seen=new Set<string>()
 if(Array.isArray(calculations))for(const value of calculations.slice(0,32)){
  const c=object(value),id=typeof c.id==='string'?c.id.trim().toUpperCase():''
  if(!/^K[1-9]\d*$/.test(id))continue
  if(seen.has(id)){map.set(id,unavailable);continue}seen.add(id)
  try{map.set(id,calculateBlock(c))}catch{map.set(id,unavailable)}
 }
 const edits:{start:number;end:number;value:string}[]=[]
 const visit=(node:any)=>{
  if(['code','inlineCode','blockquote','link','image'].includes(node.type))return
  if(node.type==='text'&&node.position){
   const start=node.position.start.offset!,end=node.position.end.offset!,raw=text.slice(start,end)
   const value=raw.replace(/\{\{\s*(K[1-9]\d*)\s*\}\}/gi,(_,id:string)=>map.get(id.toUpperCase())??unavailable)
   if(value!==raw)edits.push({start,end,value})
  }else if(node.children)for(const child of node.children)visit(child)
 }
 visit(fromMarkdown(text))
 for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.value+text.slice(e.end)
 return text
}

/** A calculation belongs to its own position in the section. No second table
 * of IDs can accidentally substitute a different vector or different result. */
export function renderTeachingBlocks(blocks:unknown):string{
 if(!Array.isArray(blocks))return ''
 const rendered:string[]=[],hasCalculation=blocks.some(v=>object(v).kind==='calculation'),hasShape=blocks.some(v=>object(v).kind==='calculation'&&['dot','matrix_product','python_string'].includes(String(object(v).operation)));let reachedCalculation=false
 for(const value of blocks.slice(0,40)){
  const block=object(value)
  // Preserve the stated inputs and hypothetical conditions before an operation.
  // Removing numeric prose here would turn an illustrative premise into a claim
  // about the real source. The program supplies result interpretation itself.
  // Vector/matrix operands fully specify their local example and dimensions.
  // The generated derivation replaces prose that could contradict that shape.
  if(block.kind==='text'){if(!hasShape&&typeof block.text==='string'&&block.text.trim()&&(!hasCalculation||!reachedCalculation))rendered.push(block.text.trim());continue}
  if(block.kind==='calculation'){reachedCalculation=true;try{const result=calculateBlock(block);if(!rendered.includes(result))rendered.push(result)}catch{return unavailable}}
 }
 return rendered.join('\n\n')
}

export const CALCULATION_OUTPUT_RULE='正文使用sections[{after,title,blocks}]。blocks按阅读顺序交错两种对象：{kind:"text",text:"讲解"}或{kind:"calculation",operation,operands,format?}。每个运算就地携带自己的操作数，不使用跨段计算编号，不自行填写结果；程序生成公式和结果。纯文字问题也用text块。operation为sum/product/difference/quotient/power/change_rate/apply_rate/dot/matrix_product：change_rate输入[旧值,新值]，程序计算(新-旧)/旧；apply_rate输入[基数,有符号相对变化率]，程序计算基数*(1+变化率)。百分数操作数必须写成带%字符串或小数比例；不能把2%写成裸数2。format为percent表示比例百分数，percentage_points表示两个比例之差的百分点数。dot输入两个等长数值向量，matrix_product输入两个二维矩阵。其他操作数是数值或十进制字符串；difference/quotient/power/change_rate/apply_rate均恰好两项。计算所在段落由程序根据操作数生成逐步说明；本段text只在运算前说明目的与条件，不放数字、公式或对结果位置的解读；运算后不再追加text。需要其他概念解释时另开不含运算的新段，并且不重新解读或改写计算位置。文字块不抄数值结果、不重写计算公式，不用另一组数解释当前运算。需要中间运算时再就地插入一个计算块。矩阵相乘用一次matrix_product携带两个完整矩阵，程序自动逐格解释；不要拆成若干sum或dot导致漏格、错配位置。字面字符串使用完整例子对象，不用单个符号代替用户要比较的完整路径。最小算例足够就结束，不另造更大的例子和额外计算。没有完整操作数或成立条件时只讲已知内容与缺口，不能填入猜测参数。Python字面字符串、长度或正则字面匹配示例，使用operation=python_string，operands=[实际字符串内容]，由程序生成转义、字符计数和re.escape自检代码；不要在text里手写转义示例、猜测print结果或重复计数。其他代码示例仍用text中的带语言围栏，未实际执行的代码不标注猜测的输出；不输出可执行计算脚本。'
