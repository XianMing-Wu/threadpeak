import assert from 'node:assert/strict'
import test from 'node:test'
import {prepareMarkdown} from './markdown-source.ts'
import {renderMath,normalizeTex} from '@threadpeak/contracts/math-normalize'
import {hasMissingSourceExcerptMath} from '@threadpeak/contracts/source-image'
const samples=[
  ['standard inline',String.raw`关系为 $E=mc^2$。`],
  ['display',String.raw`$$\frac{1}{2}+x^2$$`],
  ['bracket display',String.raw`\[\sum_{i=1}^{n}i=\frac{n(n+1)}{2}\]`],
  ['bracket inline',String.raw`结果 \(x_i^2=1\)。`],
  ['missing delimiters',String.raw`公式：\frac{a}{b}+x^2=1。`],
  ['missing close',String.raw`$\frac{a}{b}+x^2`],
  ['double escaped',String.raw`公式：\\frac{a}{b}+x^2。`],
  ['unicode slash',String.raw`公式：\u005cfrac{a}{b}。`],
  ['html slash',String.raw`公式：&#92;frac{a}{b}。`],
  ['encoded latex','公式：%5Cfrac%7Ba%7D%7Bb%7D。'],
  ['nested groups',String.raw`公式：\frac{1}{1+\frac{a}{b}}。`],
  ['matrix without delimiters',String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`],
  ['matrix with delimiters',String.raw`$$\begin{pmatrix}1&2\\3&4\end{pmatrix}$$`],
  ['aligned',String.raw`\begin{align}a&=b\\c&=d\end{align}`],
  ['Chinese text in formula',String.raw`式子：\text{速度}=\frac{\text{路程}}{\text{时间}}。`],
  ['math fence','```latex\n\\frac{a}{b}\n```'],
  ['missing group close',String.raw`$\frac{a}{b$`],
  ['missing size pair',String.raw`$\left(x+1)$`],
  ['JSON control escape','$\frac{a}{b}$'],
  ['English prose',String.raw`We use x^2 = y here`],
]
for(const [name,source] of samples)test(`math recovery: ${name}`,()=>{
  const p=prepareMarkdown(source)
  assert.equal(p.math.length,1,JSON.stringify(p))
  const rendered=renderMath(p.math[0].tex,p.math[0].display)
  assert.equal(rendered.kind,'rendered',JSON.stringify(p))
  assert.match(rendered.html,/class="katex/)
  assert.doesNotMatch(p.markdown,/%%TPMATH|\$\$\$/)
  if(name==='English prose')assert.equal(p.markdown,'We use $x^2 = y$ here')
})
test('code, links, paths and currency are not interpreted as formulas',()=>{
  for(const source of [String.raw`价格 $5 and $10`,String.raw`预算 \$5 和 \$10`,String.raw`https://example.com/a_b?x=1`,String.raw`[公式](https://example.com/x_y)`, '`x_i = 3`', '```js\nconst x_i=3\n```',String.raw`C:\temp\file_name`])assert.equal(prepareMarkdown(source).math.length,0,source)
})
test('unsupported or missing operands retain source and cannot execute HTML',()=>{
  for(const tex of [String.raw`\frac`,String.raw`\unknownMacro{x}`,String.raw`\def\a{\a}\a`])assert.equal(renderMath(tex).kind,'unresolved')
  for(const tex of [String.raw`\href{javascript:alert(1)}{x}`,String.raw`\htmlClass{evil}{x}`]){const result=renderMath(tex);if(result.kind==='rendered')assert.doesNotMatch(result.html,/<a\b|class="evil"|href="javascript:/)}
  assert.equal(renderMath('x'.repeat(30001)).kind,'unresolved')
})
test('recovering encoding keeps matrix row breaks and never invents missing operands',()=>{
  assert.equal(normalizeTex(String.raw`\begin{matrix}a&b\\c&d\end{matrix}`),String.raw`\begin{matrix}a&b\\c&d\end{matrix}`)
  assert.equal(renderMath(String.raw`\frac{a}`).kind,'unresolved')
})

test('actual Markdown AST agrees with normalization and matrices cannot swallow following prose',async()=>{
  const {unified}=await import('unified'),{default:remarkParse}=await import('remark-parse'),{default:remarkMath}=await import('remark-math')
  const sources=[...samples.map(s=>s[1]),String.raw`零向量 \mathbf{0} = \begin{pmatrix} 0 \\ 0 \end{pmatrix}（一个点）。`+'\n这里是后续正文。',String.raw`c_1 \mathbf{v}_1 + c_2 \mathbf{v}_2 \\`+'\n这里是后续正文。', '$$\n\\begin{matrix}a_i & b_i \\\\\nc_i & d_i\\end{matrix}\n$$']
  for(const source of sources){const p=prepareMarkdown(source),ast=unified().use(remarkParse).use(remarkMath).parse(p.markdown),math=[],texts=[];const walk=n=>{if(n.type==='math'||n.type==='inlineMath')math.push(n);else if(n.type==='text')texts.push(n.value);n.children?.forEach(walk)};walk(ast);assert.equal(math.length,p.math.length,JSON.stringify(p));for(const n of math)assert.equal(renderMath(n.value,n.type==='math').kind,'rendered',n.value);if(source.includes('后续正文'))assert.ok(texts.join('').includes('这里是后续正文。'))}
})

test('an inline coordinate equation keeps its left hand side, equals and matrix together',()=>{
  const source=String.raw`取 f_1=\begin{pmatrix}1\\1\end{pmatrix}，再取 f_2=\begin{pmatrix}0\\1\end{pmatrix}，于是 P=\begin{pmatrix}1&0\\1&1\end{pmatrix}。新坐标是 [v]_F=$P^{-1}[v]_E$=\begin{pmatrix}2\\1\end{pmatrix}。`
  const prepared=prepareMarkdown(source)
  assert.equal(prepared.math.length,4)
  for(const [i,lhs] of ['f_1=','f_2=','P=','[v]_F=P^{-1}[v]_E='].entries()){
    assert.ok(prepared.math[i].tex.startsWith(lhs),prepared.math[i].tex)
    assert.equal(prepared.math[i].display,false)
    assert.equal(renderMath(prepared.math[i].tex).kind,'rendered')
  }
  assert.doesNotMatch(prepared.markdown,/\[\$v/)
})
test('a matrix accidentally delimited as display after an equals rejoins its equation; standalone aligned math stays display',()=>{
  const p=prepareMarkdown(String.raw`取 $f_1=$ \[\begin{pmatrix}1\\1\end{pmatrix}\]，继续。`)
  assert.equal(p.math.length,1);assert.equal(p.math[0].display,false);assert.match(p.math[0].tex,/^f_1=/)
  const aligned=prepareMarkdown(String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`)
  assert.equal(aligned.math[0].display,true)
})

test('Zhihu numbered arrays and matrix products keep their outer delimiters and tags',()=>{
  const samples=[String.raw`不妨设 \left\{ \begin{array}{c} \varphi(e_1)=a_{11}f_1+a_{12}f_2,\\ \varphi(e_2)=a_{21}f_1+a_{22}f_2.\\ \end{array} \right.\tag{1} 因为`,String.raw`坐标为 \left(\begin{matrix}\mu_1\\\mu_2\end{matrix}\right)=\left(\begin{matrix}a&b\\c&d\end{matrix}\right) \left(\begin{matrix}x\\y\end{matrix}\right).\tag{2}`]
  for(const source of samples){const p=prepareMarkdown(source);assert.equal(p.math.length,1,JSON.stringify(p));assert.equal(p.math[0].display,true);assert.equal(renderMath(p.math[0].tex,true).kind,'rendered');assert.match(p.math[0].tex,/\\left/);assert.match(p.math[0].tex,/\\tag/)}
})

// The real 2026-09-06 ContentText for 矩阵基础知识点总结 already omits these operands.
// Rendering must not fabricate them or call that upstream loss an image decode failure.
test('an upstream summary with missing equations is preserved without invented math',()=>{
  const source='矩阵加法满足交换律  和结合律 。主对角线上的元素都是1、其余都是0的方阵叫单位矩阵，记作 。'
  const p=prepareMarkdown(source)
  assert.equal(p.markdown,source);assert.deepEqual(p.math,[])
})

test('HTML equation images recover alt, data-eeimg, entities and encoded equation URLs',()=>{
  const cases=[
    [String.raw`式<img class="eeimg" alt="A^{T}A=I" src="https://pic1.zhimg.com/formula.png">。`,'A^{T}A=I'],
    [String.raw`式<img data-eeimg="&#92;frac{a}{b}" src="https://pic1.zhimg.com/formula.png">。`,String.raw`\frac{a}{b}`],
    [String.raw`式<img data-eeimg="%5Cfrac%7Ba%7D%7Bb%7D" src="https://pic1.zhimg.com/formula.png">。`,String.raw`\frac{a}{b}`],
    [String.raw`式<img data-latex='x &lt; y' src='https://pic1.zhimg.com/formula.png'>。`,'x < y'],
    [String.raw`式<img data-eeimg="true" alt="A" class="ztext-math" src="https://pic1.zhimg.com/formula.png">。`,'A'],
    ['式 ![公式](https://www.zhihu.com/equation?tex=A%5E%7BT%7DA%3DI) 。','A^{T}A=I'],
  ]
  for(const [source,tex] of cases){const p=prepareMarkdown(source);assert.equal(p.math.length,1,JSON.stringify(p));assert.equal(p.math[0].tex,tex);assert.equal(renderMath(p.math[0].tex).kind,'rendered');assert.doesNotMatch(p.markdown,/<img/)}
})

test('an HTML matrix image remains in the same inline equation as its left hand side',()=>{
  const p=prepareMarkdown(String.raw`取 f_1=<img class="eeimg" data-eeimg="true" alt="\begin{pmatrix}1\\1\end{pmatrix}" src="https://pic1.zhimg.com/equation.png">，继续正文。`)
  assert.equal(p.math.length,1);assert.equal(p.math[0].display,false)
  assert.equal(p.math[0].tex,String.raw`f_1=\begin{pmatrix}1\\1\end{pmatrix}`)
  assert.match(p.markdown,/继续正文。/)
})

test('strict image URL validation rejects privileged schemes, local targets and URL ambiguity',async()=>{
  const {safeSourceImageUrl}=await import('@threadpeak/contracts/source-image')
  for(const url of ['javascript:alert(1)','data:image/svg+xml;base64,AAA','file:///etc/passwd','blob:https://example.com/id','http://example.com/img.png','//example.com/img.png','https://example.com@localhost/a','https://u:p@example.com/a','https://127.0.0.1/a','https://0x7f000001/a','https://2130706433/a','https://[::1]/a','https://internal/a','https://router.local/a','https://example.com:4304/a','https:\\example.com/a','https://example.com/a\nb','https://example.com/%zz'])assert.equal(safeSourceImageUrl(url),undefined,url)
  for(const url of ['https://pic1.zhimg.com/v2-a_b.png','https://www.zhihu.com/equation?tex=x%5E2%3D1','https://cdn.example.com/a(b).png?sig=abc%2B12&size=2'])assert.ok(safeSourceImageUrl(url),url)
})

test('ordinary images, reference-style images, nested URLs and reference links keep their content',()=>{
  const source='[![几何图](https://cdn.example.com/a(b)_c.png)](https://www.zhihu.com/answer/123?utm_source=test)\n\n![补充图][figure]\n\n[figure]: https://cdn.example.com/figure.png "来源图"\n\n[文章来源1](https://www.zhihu.com/answer/123?utm_source=test)'
  const p=prepareMarkdown(source)
  assert.equal(p.math.length,0);assert.match(p.markdown,/!\[几何图\]/);assert.match(p.markdown,/https:\/\/cdn.example.com\/a\(b\)_c.png/)
  assert.match(p.markdown,/!\[补充图\]/);assert.ok(p.markdown.endsWith('[文章来源1](https://www.zhihu.com/answer/123?utm_source=test)'))
})

test('HTML images in Markdown code and HTML code remain literal, with no math or image request',()=>{
  for(const source of ['`<img alt="x^2=1" src="https://cdn.example.com/code.png">`','`` <img alt="x_i=2" src="https://cdn.example.com/code.png"> ` ``','````md\n```latex\nx^2=1\n```\n<img alt="x_i=2" src="https://cdn.example.com/code.png">\n````']){
    const p=prepareMarkdown(source);assert.equal(p.markdown,source);assert.equal(p.math.length,0)
  }
  for(const source of ['text <code><img alt="x_i=2" src="https://cdn.example.com/code.png"></code> end','<pre><code>&lt;img alt="x_i=2" src="https://cdn.example.com/code.png"&gt;</code></pre>']){
    const p=prepareMarkdown(source);assert.equal(p.math.length,0);assert.match(p.markdown,/`/);assert.match(p.markdown,/code.png/)
  }
})

test('inert HTML containers and image attributes cannot become active markup or image requests',()=>{
  for(const tag of ['script','style','iframe','object','svg','math','template','textarea','noscript']){
    const p=prepareMarkdown(`前文<${tag}>![隐蔽图片](https://cdn.example.com/tracker.png)<img src="https://cdn.example.com/tracker.png"></${tag}>后文`)
    assert.match(p.markdown,/前文/);assert.match(p.markdown,/后文/);assert.doesNotMatch(p.markdown,/tracker.png/)
  }
  const p=prepareMarkdown('<p>正文<img src="https://cdn.example.com/ok.png" onerror="alert(1)" style="position:fixed" alt="图示">尾文</p>')
  assert.doesNotMatch(p.markdown,/onerror|position:fixed|alert\(1\)/);assert.match(p.markdown,/ok.png/);assert.match(p.markdown,/尾文/)
})

let ssrServer,ssrModule
const renderActual=async(source,extra={})=>{
  if(!ssrServer){const {createServer}=await import('vite');ssrServer=await createServer({configFile:false,cacheDir:`/tmp/threadpeak-math-ssr-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[],entries:[]},server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'});ssrModule=await ssrServer.ssrLoadModule('/src/lib/MarkdownMath.tsx')}
  const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
  return renderToStaticMarkup(createElement(ssrModule.MarkdownMath,{source,...extra}))
}
const {after}=await import('node:test')
after(async()=>{await ssrServer?.close()})

test('actual MarkdownMath SSR renders recovered equations, original images and untouched source links',async()=>{
  const html=await renderActual(String.raw`<p>取 f_1=<img class="eeimg" alt="\begin{pmatrix}1\\1\end{pmatrix}" src="https://pic1.zhimg.com/equation.png">，尾文。</p>`+'\n\n![示意图](https://cdn.example.com/diagram.png)\n\n[文章来源1](https://www.zhihu.com/answer/123)')
  assert.equal((html.match(/class="tp-math is-inline"/g)||[]).length,1)
  assert.match(html,/encoding="application\/x-tex">f_1=/);assert.doesNotMatch(html,/tp-math is-display/)
  assert.match(html,/<img class="tp-source-image" src="https:\/\/cdn.example.com\/diagram.png"/)
  assert.match(html,/referrerPolicy="no-referrer"/);assert.match(html,/<a href="https:\/\/www.zhihu.com\/answer\/123">文章来源1<\/a>/)
  assert.match(html,/尾文/);assert.doesNotMatch(html,/tp-math-unresolved/)
})

test('actual SSR shows unsafe/missing image fallback and retains an unsupported formula image',async()=>{
  const html=await renderActual(String.raw`<img alt="原始示意图" src="javascript:alert(1)"> <img class="eeimg" alt="\unsupported{x}" src="https://pic1.zhimg.com/formula.png"> <img>`)
  assert.equal((html.match(/class="tp-source-image-fallback"/g)||[]).length,2)
  assert.match(html,/原始示意图/);assert.match(html,/图片未能加载/);assert.match(html,/资料图片/)
  assert.match(html,/<img class="tp-source-image is-formula"/);assert.match(html,/unsupported/)
  assert.doesNotMatch(html,/javascript:|onerror=|<script/)
})

test('actual SSR keeps code escaped, drops scripts and ignores hostile alt markup and handlers',async()=>{
  const html=await renderActual('前文<script>![隐藏](https://cdn.example.com/tracker.png)</script>后文\n\n`<img src="https://cdn.example.com/code.png">`\n\n<img src="https://cdn.example.com/ok.png" alt="&lt;svg onload=alert(1)&gt;" onerror="alert(1)">')
  assert.doesNotMatch(html,/tracker.png|<script|<svg|onerror=/)
  assert.match(html,/<code>&lt;img/);assert.match(html,/前文后文/)
  assert.equal((html.match(/<img /g)||[]).length,1)
})

test('passive card rendering still shows equations and images while keeping source links passive',async()=>{
  const html=await renderActual('![公式](https://www.zhihu.com/equation?tex=x%5E2%3D1) ![图](https://cdn.example.com/diagram.png) [来源](https://www.zhihu.com/answer/123)',{passive:true})
  assert.match(html,/class="katex"/);assert.match(html,/<img /);assert.doesNotMatch(html,/<a /)
})

test('a diagram caption mentioning math does not replace the diagram with its alt text',async()=>{
  for(const alt of ['函数 y=x^2 的图象','A diagram of x^2=1','<svg onload=alert(1)>']){
    const html=await renderActual(`![${alt}](https://cdn.example.com/diagram.png)`)
    assert.match(html,/<img class="tp-source-image"/);assert.doesNotMatch(html,/class="katex"/)
  }
})

test('lazy HTML image URLs, unquoted metadata and quoted greater-than signs remain correctly bound',async()=>{
  const html=await renderActual('<p>图<img src="data:image/gif;base64,AAAA" data-actualsrc="https://cdn.example.com/lazy.png" alt="矩阵 > 变换" onerror="evil()">式<img data-latex=x^2=1 src=https://pic1.zhimg.com/formula.png></p>')
  assert.match(html,/<img class="tp-source-image" src="https:\/\/cdn.example.com\/lazy.png"/)
  assert.doesNotMatch(html,/data:image|onerror=|evil\(\)/)
  assert.match(html,/encoding="application\/x-tex">x\^2=1<\/annotation>/)
})

test('source-excerpt detection recognizes two observed operand-gap patterns without changing source',()=>{
  for(const source of ['即使 和 都有意义，通常 。','矩阵加法满足交换律  和结合律 。','矩阵加法满足交换律\u00a0\u00a0和结合律。','满足交换律&nbsp;&nbsp;和结合律']){
    assert.equal(hasMissingSourceExcerptMath(source),true,source)
    assert.deepEqual(prepareMarkdown(source).math,[],source)
  }
})

test('ordinary prose, complete operands and ordinary spacing do not imply missing source formulas',()=>{
  for(const source of ['','讨论交换律和结合律。','加法满足交换律和结合律。','加法满足交换律 和结合律。','即使失败，努力和尝试都有意义。','即使 AB 和 BA 都有意义，也未必相等。','这里  和那里都能看到内容。','交换律\n\n和结合律是两种性质。']){
    assert.equal(hasMissingSourceExcerptMath(source),false,source)
  }
})

test('code, HTML metadata, math, images and links cannot fabricate an excerpt gap',()=>{
  const gap='即使 和 都有意义；满足交换律  和结合律'
  const cases=[`\`${gap}\``,`\`\`\`txt\n${gap}\n\`\`\``,`    ${gap}`,
    `<pre><code>${gap}</code></pre>`,`正文 <code>${gap}</code> 后文`,`正文<script>${gap}</script>后文`,`<img alt="${gap}" src="https://example.com/a.png">`,
    `$\\text{${gap}}$`,`\\(\\text{${gap}}\\)`,`$$\n\\text{${gap}}\n$$`,
    `[${gap}](https://example.com/source)`,
    '即使 `AB` 和 `BA` 都有意义。',
    '满足交换律 ![表达式](https://example.com/math.png) 和结合律。',
    '即使 $AB$ 和 $BA$ 都有意义。',
  ]
  for(const source of cases)assert.equal(hasMissingSourceExcerptMath(source),false,source)
  assert.equal(hasMissingSourceExcerptMath('公式 $AB=BA$ 与 `代码示例` 保留。即使 和 都有意义。'),true)
})

test('actual MarkdownMath SSR displays the neutral hint only when the raw-excerpt prop is enabled',async()=>{
  const source='即使 和 都有意义。满足交换律  和结合律。\n\n[阅读原文](https://www.zhihu.com/answer/123)'
  const ordinary=await renderActual(source),excerpt=await renderActual(source,{sourceExcerpt:true})
  assert.doesNotMatch(ordinary,/tp-source-excerpt-note|搜索摘要未包含/)
  assert.equal((excerpt.match(/搜索摘要缺少部分公式，下方保留原始内容。请阅读原文核对完整表达式。/g)||[]).length,1)
  assert.match(excerpt,/role="note"/)
  assert.match(excerpt,/即使 和 都有意义。满足交换律  和结合律。/)
  assert.match(excerpt,/<a href="https:\/\/www.zhihu.com\/answer\/123">阅读原文<\/a>/)
  assert.doesNotMatch(excerpt,/class="katex"/)
})

test('enabling sourceExcerpt does not show a notice for intact math or code examples',async()=>{
  for(const source of ['即使 $AB$ 和 $BA$ 都有意义，也未必相等。','加法满足交换律和结合律。','`满足交换律  和结合律`']){
    const html=await renderActual(source,{sourceExcerpt:true})
    assert.doesNotMatch(html,/tp-source-excerpt-note|搜索摘要未包含/)
  }
})

const shenyuanMatrixChain=String.raw` C= \begin{pmatrix} 1&0\\ 0&1 \end{pmatrix},qquad D= \begin{pmatrix} 1&1\\ 0&1 \end{pmatrix}. `
const shenyuanKernelChain=String.raw` D-I= \begin{pmatrix} 0&1\\ 0&0 \end{pmatrix},qquad \dim\ker(D-I)=1. `

test('observed Zhihu qquad omissions keep both matrices and the kernel expression intact',()=>{
  for(const source of [shenyuanMatrixChain,shenyuanKernelChain]){
    const p=prepareMarkdown(source)
    assert.equal(p.math.length,1,JSON.stringify(p))
    assert.equal(p.math[0].tex,source.trim().replace(',qquad',String.raw`,\qquad`))
    assert.equal(p.math[0].display,false)
    assert.equal(renderMath(p.math[0].tex).kind,'rendered')
  }
})

test('known quad spacing in a connected math expression is recovered, with valid commands unchanged',()=>{
  for(const name of ['quad','qquad']){
    const missing=shenyuanKernelChain.replace('qquad',name)
    const correct=missing.replace(`,${name}`,`,\\${name}`)
    const a=prepareMarkdown(missing),b=prepareMarkdown(correct)
    assert.deepEqual(a.math,b.math)
    assert.equal(a.math.length,1)
    assert.ok(a.math[0].tex.includes(String.raw`\dim\ker(D-I)=1`))
  }
  const delimited=prepareMarkdown(String.raw`$a=b,qquad c=d$`)
  assert.equal(delimited.math[0].tex,String.raw`a=b,\qquad c=d`)
})

test('spacing recovery never rewrites ordinary words, source links, code or literal math text',()=>{
  for(const source of ['a quad bike is outside.','解释 qquad 与 quad 的区别。','[qquad](https://example.com/qquad)',`\`${shenyuanMatrixChain}\``,`\`\`\`latex-example\n${shenyuanKernelChain}\n\`\`\``])assert.equal(prepareMarkdown(source).markdown,source)
  for(const tex of [String.raw`\text{a=b,qquad c=d},\qquad x=1`,String.raw`\text{a{b}c,quad d=e},\quad x=1`,String.raw`\operatorname{f,qquad g=h}(x)=1`,String.raw`qquad=2`]){
    const p=prepareMarkdown(`$${tex}$`)
    assert.equal(p.math[0].tex,tex)
  }
})

test('actual SSR has no visible qquad artifacts and no false missing-excerpt notice for these complete equations',async()=>{
  const source=`两矩阵：\n${shenyuanMatrixChain}\n核空间：\n${shenyuanKernelChain}\n后续正文。`
  const html=await renderActual(source,{sourceExcerpt:true})
  const visible=html.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,'')
  assert.doesNotMatch(visible,/qquad|quad/)
  assert.equal((html.match(/class="tp-math is-inline"/g)||[]).length,2)
  assert.match(html,/\\dim\\ker\(D-I\)=1/)
  assert.match(html,/后续正文。/)
  assert.doesNotMatch(html,/tp-math-unresolved|tp-source-excerpt-note/)
})

const numpyExcerpt=`遵循线性代数规则：第一个矩阵的列数 = 第二个矩阵的行数
import numpy as np

# 定义两个矩阵
A = np.array([[1,2],
             [3,4]]) # 2行2列

B = np.array([[5,6],
             [7,8]]) # 2行2列

这里开始解释矩阵乘法。`
test('observed unfenced NumPy arrays remain complete code, including indentation and comments',async()=>{
  const p=prepareMarkdown(numpyExcerpt)
  assert.equal(p.math.length,0,JSON.stringify(p))
  const html=await renderActual(numpyExcerpt)
  assert.match(html,/<pre><code class="language-python">import numpy as np/)
  assert.match(html,/A = np.array\(\[\[1,2\],\n             \[3,4\]\]\) # 2行2列/)
  assert.match(html,/B = np.array\(\[\[5,6\],\n             \[7,8\]\]\) # 2行2列/)
  assert.match(html,/<\/code><\/pre>[\s\S]*<p>这里开始解释矩阵乘法。<\/p>/)
  assert.doesNotMatch(html,/class="katex"/)
})
test('code restoration protects existing fences and does not swallow prose after a truncated array',()=>{
  const existing='```python\n'+numpyExcerpt+'\n```'
  assert.equal(prepareMarkdown(existing).markdown,existing)
  const partial=prepareMarkdown('A = np.array([[1,2],\n这里的数组在搜索摘要里被截断。\n公式 $x^2=1$。')
  assert.equal(partial.math.length,1)
  assert.equal(partial.math[0].tex,'x^2=1')
  assert.match(partial.markdown,/```\n\n这里的数组/)
  assert.equal(prepareMarkdown('矩阵 $A=B+C$，结果如下。').math.length,1)
})
const lostMatrixExcerpt='矩阵乘法：设 ，，则\n其中：\n注意：A 的列数必须等于 B 的行数。\n满足结合律： 满足分配律：，重要注意：'
test('missing-math detection covers observed blank definitions and matrix laws without false positives on intact sources',()=>{
  for(const source of [lostMatrixExcerpt,'矩阵乘法。设，，则\n其中：','矩阵计算。・ ・ ・：注意与前面不同。','矩阵的性质：满足结合律： 满足分配律：，','设 是 矩阵，是 矩阵。'])assert.equal(hasMissingSourceExcerptMath(source),true,source)
  for(const source of [String.raw`矩阵乘法：设 $A$，$B$，则 $C=AB$。`,String.raw`矩阵满足结合律：$A(BC)=(AB)C$。`, '矩阵满足结合律。', '`'+lostMatrixExcerpt.replaceAll('\n',' ')+'`','```python\n'+lostMatrixExcerpt+'\n```'])assert.equal(hasMissingSourceExcerptMath(source),false,source)
})

test('actual GFM tables retain determinant, norm, conditional and array-border formulas in their own cells',async()=>{
  const table=String.raw`| 结论 | 说明 |
| --- | --- |
| $|AB|=|A||B|$ | 行列式乘法 |
| $|kA|=k^n|A|$ | 数乘行列式 |
| $\|v\|=\sqrt{x^2+y^2}$ | 范数 |
| $P(A|B)$ | 条件概率 |
| $\left|\begin{array}{c|c}1&0\\0&1\end{array}\right|$ | 带分隔线的矩阵 |
`
  const html=await renderActual(table),p=prepareMarkdown(table)
  assert.equal(p.math.length,5)
  assert.equal((html.match(/<td>/g)||[]).length,10)
  assert.equal((html.match(/class="katex"/g)||[]).length,5)
  assert.match(html,/<annotation[^>]*>\|AB\|=\|A\|\|B\|<\/annotation>/)
  assert.match(html,/\\begin\{array\}\{c\|c\}/)
  assert.doesNotMatch(html,/tp-math-unresolved|&#124;/)
  assert.equal(prepareMarkdown('```python\na | b\n```').markdown,'```python\na | b\n```')
  assert.equal(prepareMarkdown('左 | 右').markdown,'左 | 右')
})


test('NumPy block assignments and print calls stay code after comments and blank lines',async()=>{
 const source=`import numpy as np

# 定义矩阵
A = np.array([[1, 2],
              [3, 4]])
B = np.array([[5, 6],
              [7, 8]])
# 矩阵乘法
result = A @ B
# 等价写法：result = np.dot(A, B)
print(result)

# 矩阵加法
C = A + B
print(C)

这里讨论矩阵的运算规则。`
 const html=await renderActual(source)
 assert.equal(prepareMarkdown(source).math.length,0)
 assert.match(html,/<pre><code class="language-python">[\s\S]*result = A @ B[\s\S]*C = A \+ B\nprint\(C\)[\s\S]*<\/code><\/pre>/)
 assert.match(html,/<p>这里讨论矩阵的运算规则。<\/p>/)
 assert.equal(prepareMarkdown('公式：C = A + B。').math.length,1)
})

const {readingCorpus}=await import('@threadpeak/contracts/reading-corpus')
const {prepareReading}=await import('@threadpeak/contracts/reading-policy')
for(const sample of readingCorpus)test(`reading corpus ${sample.id}: ${sample.label}`,async()=>{
 const reading=prepareReading(sample.source,true),html=await renderActual(sample.source,{sourceExcerpt:true})
 if(sample.math!==undefined)assert.equal(reading.math.length,sample.math,JSON.stringify(reading))
 if(sample.incomplete!==undefined)assert.equal(reading.incompleteSource,sample.incomplete,JSON.stringify(reading))
 if(sample.unresolved)assert.match(html,/tp-math-unresolved/)
 if(sample.code){
  const encoded=sample.code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
  assert.ok([...html.matchAll(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)].some(m=>m[1].includes(encoded)),html)
 }
 if(sample.incomplete)assert.ok(html.indexOf('role="note"')<html.indexOf('<ul>')||!html.includes('<ul>'),'notice must precede incomplete prose')
})
