import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareMarkdown } from './markdown-source.ts'

test('list item with inline math stays one markdown list', () => {
  const { markdown, math } = prepareMarkdown('1. 状态 $S_t \\in S$。\n2. 动作')
  assert.equal(math.length, 1)
  assert.equal(math[0].tex, 'S_t \\in S')
  assert.equal(math[0].display, false)
  assert.equal(markdown, '1. 状态 $S_t \\in S$。\n2. 动作')
})

test('short single-line display dollars render as inline', () => {
  const { markdown, math } = prepareMarkdown('因此 $$S_t \\in S$$ 成立。')
  assert.equal(math.length, 1)
  assert.equal(math[0].display, false)
  assert.equal(markdown, '因此 $S_t \\in S$ 成立。')
})

test('multiline display math stays display and fences keep raw latex', () => {
  const { markdown, math } = prepareMarkdown('$$\nE = mc^2\n$$\n\n```\n$keep$\n```')
  assert.equal(math.length, 1)
  assert.equal(math[0].display, true)
  assert.match(markdown, /```\n\$keep\$\n```/)
})

test('a Chinese period is not left as its own block before a numbered heading', () => {
  const { markdown } = prepareMarkdown('先记住这件事。1. 第一条')
  assert.equal(markdown, '先记住这件事。\n\n1. 第一条')
})

test('bare latex commands and braced subscripts become inline math', () => {
  const { markdown, math } = prepareMarkdown('执行误差），{P_{sa}^{s\'}} 能够描述。· \\gamma\\in[0, 1] 是折扣因子。R:S\\times A\\rightarrow \\mathbb{R} 是奖励函数。')
  assert.deepEqual(math.map((item) => item.tex), [
    'P_{sa}^{s\'}',
    '\\gamma\\in[0, 1]',
    'S\\times A\\rightarrow \\mathbb{R}',
  ])
  assert.equal(math.every((item) => item.display === false), true)
  assert.match(markdown, /\$P_\{sa\}\^\{s'\}\$/)
  assert.match(markdown, /\$\\gamma\\in\[0, 1\]\$/)
  assert.doesNotMatch(markdown, /%%TPMATH/)
})

test('bare identifier subscripts without wrapping dollars become inline math', () => {
  const { markdown, math } = prepareMarkdown('转移概率写成 P_{sa}^{s\'}e 就能描述不确定性。')
  assert.equal(math.length, 1)
  assert.equal(math[0].tex, 'P_{sa}^{s\'}e')
  assert.equal(markdown, '转移概率写成 $P_{sa}^{s\'}e$ 就能描述不确定性。')
})

test('placeholder indices must not leak into a probability formula', () => {
  const source = '数学表示为：P(s_{t+1}|s_t, a_t, s_{t-1}, a_{t-1}, ...)=P(s_{t+1}|s_t, a_t)'
  const { markdown, math } = prepareMarkdown(source)
  assert.equal(math.some((item) => item.tex.includes('P(') && item.tex.includes('s_{t+1}')), true)
  assert.doesNotMatch(markdown, /P\(\d/)
  assert.doesNotMatch(markdown, /%%TPMATH/)
  assert.doesNotMatch(markdown, /\uFFF0|\uFFF1/)
})

test('left-right probability does not leak math slots', async () => {
  const { default: katex } = await import('katex')
  const source = '数学表示为：P\\left(s_{t+1}|s_t, a_t, s_{t-1}, a_{t-1}, ...\\right)=P\\left(s_{t+1}|s_t, a_t\\right)'
  const { markdown, math } = prepareMarkdown(source)
  assert.doesNotMatch(markdown, /%%TPMATH/)
  assert.doesNotMatch(markdown, /P\(\d/)
  assert.equal(math.some((item) => item.tex.includes('s_{t+1}') && item.tex.includes('s_t')), true)
  for (const item of math) {
    katex.renderToString(item.tex, { throwOnError: true, strict: 'ignore' })
  }
})

test('xrightarrow without braces stays one transition chain', () => {
  const { markdown, math } = prepareMarkdown('可以概括为：s_o\\xrightarrow a_0 s_1\\xrightarrow a_1 s_2\\xrightarrow a_2 s_3\\xrightarrow a_3...')
  assert.equal(math.length, 1)
  assert.match(math[0].tex, /\\xrightarrow\{a_0\}/)
  assert.match(math[0].tex, /s_o/)
  assert.match(markdown, /\$s_o/)
  assert.doesNotMatch(markdown, /\\xrightarrow a_/)
})

test('adjacent bare fragments stay one formula and never emit $$', async () => {
  const { default: katex } = await import('katex')
  const samples = [
    '{P_{sa}^{s\'}}\\in[0,1] 描述在状态',
    'P_{sa}^{s\'}\\in[0,1] 描述',
    '\\gamma\\in\\left[o,1\\right] 是折扣因子',
    '可以概括为：s_o\\xrightarrow{a_o}s_1\\xrightarrow{a_1}s_2\\xrightarrow{a_2}...',
    '到达状态 s{\'} 的概率',
    '数学表示为：P(s_{t+1}|s_t, a_t, s_{t-1}, a_{t-1}, ...)=P(s_{t+1}|s_t, a_t)',
    '式中： · P(·|·) 为条件概率； · s_{t+1} 为状态',
  ]
  for (const source of samples) {
    const { markdown, math } = prepareMarkdown(source)
    assert.doesNotMatch(markdown, /\$\$[^\n]/, source)
    assert.doesNotMatch(markdown, /P\(\d/, source)
    assert.doesNotMatch(markdown, /%%TPMATH/, source)
    for (const item of math) {
      katex.renderToString(item.tex, { throwOnError: true, strict: 'ignore' })
    }
  }
  const glued = prepareMarkdown('{P_{sa}^{s\'}}\\in[0,1]')
  assert.equal(glued.math.length, 1)
  assert.equal(glued.math[0].tex, 'P_{sa}^{s\'}\\in[0,1]')
  const gamma = prepareMarkdown('\\gamma\\in\\left[o,1\\right]')
  assert.equal(gamma.math.length, 1)
  assert.match(gamma.math[0].tex, /\\gamma\\in\\left\[o,1\\right\]/)
  const prime = prepareMarkdown('到达状态 s{\'} 的概率')
  assert.equal(prime.math.some((item) => item.tex === 's\''), true)
  const listed = prepareMarkdown('式中： · P(·|·) 为条件概率； · s_{t+1} 为状态')
  assert.match(listed.markdown, /式中：\n- /)
  assert.match(listed.markdown, /；\n- /)
})
