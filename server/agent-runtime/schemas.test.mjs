import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseAgentJson,
  parseAgentOutput,
  isR2ExplorationObject,
  salvageR4Route,
} from './schemas.ts'

const r1Valid = {
  queries: [
    { id: 'q1', text: '线性映射怎么入门', angle: 'normal_learning' },
    { id: 'q2', text: '线性映射常见理解路径', angle: 'normal_learning' },
    { id: 'q3', text: '线性映射容易踩的坑', angle: 'pitfall_or_dispute' },
    { id: 'q4', text: '线性映射有哪些误导学法', angle: 'pitfall_or_dispute' },
  ],
}

const r2Valid = {
  线性代数: {
    线性映射: { 争议: true },
    矩阵表示: { 争议: false },
  },
}

const r4Valid = {
  version: '1.0',
  routeId: 'route-1',
  title: '线性映射入门',
  carriers: [
    { id: 'c1', title: '线性代数', description: '向量空间基础' },
    { id: 'c2', title: '矩阵', description: '矩阵表示' },
  ],
  concepts: [
    { id: 'n1', carrierId: 'c1', title: '向量空间', hasDispute: false, detailedDescription: '先建立对象', attachmentSourceIds: [] },
    { id: 'n2', carrierId: 'c1', title: '线性映射', hasDispute: true, detailedDescription: '讲清保运算', attachmentSourceIds: ['att-1'] },
    { id: 'n3', carrierId: 'c2', title: '矩阵表示', hasDispute: false, detailedDescription: '同一映射的坐标', attachmentSourceIds: [] },
  ],
  carrierEdges: [{ id: 'ce1', fromCarrierId: 'c1', toCarrierId: 'c2', reason: '从对象到表示' }],
  conceptEdges: [
    { id: 'ee1', fromConceptId: 'n1', toConceptId: 'n2', reason: '有了空间才能谈映射' },
    { id: 'ee2', fromConceptId: 'n2', toConceptId: 'n3', reason: '理解映射后再看矩阵' },
    { id: 'ee3', fromConceptId: 'n1', toConceptId: 'n3', reason: '也可以先看坐标表示' },
  ],
  entryConceptIds: ['n1'],
  terminalConceptIds: ['n3'],
}

test('R1 accepts 4–5 unique queries covering both angles and extracts extra keys', () => {
  assert.equal(parseAgentOutput('R1', r1Valid).ok, true)
  assert.equal(parseAgentOutput('R1', { ...r1Valid, extra: true }).ok, true)
  assert.equal(parseAgentOutput('R1', { queries: r1Valid.queries.slice(0, 3) }).ok, false)
  assert.equal(parseAgentOutput('R1', {
    queries: [...r1Valid.queries, { id: 'q5', text: '五', angle: 'normal_learning' }, { id: 'q6', text: '六', angle: 'pitfall_or_dispute' }],
  }).ok, false)
  assert.equal(parseAgentOutput('R1', {
    queries: r1Valid.queries.map((item, index) => ({ ...item, angle: 'normal_learning', text: `t${index}` })),
  }).ok, false)
})

test('R2 exploration object is not a valid R4 route', () => {
  assert.equal(isR2ExplorationObject(r2Valid), true)
  assert.equal(parseAgentOutput('R2', r2Valid).ok, true)
  assert.equal(parseAgentOutput('R2', { 线性代数: { 线性映射: { 争议: true, extra: 1 } } }).ok, true)
  assert.equal(parseAgentOutput('R2', { 线性代数: { 线性映射: { hasDispute: true } } }).ok, true)
  assert.equal(parseAgentOutput('R4', r2Valid).ok, false)
  assert.equal(parseAgentOutput('R4', r4Valid, { attachmentSourceIds: ['att-1'] }).ok, true)
})

test('R4 rejects cycles, dangling edges, invented attachment ids and missing reachability', () => {
  assert.equal(parseAgentOutput('R4', {
    ...r4Valid,
    conceptEdges: [...r4Valid.conceptEdges, { id: 'loop', fromConceptId: 'n3', toConceptId: 'n1', reason: '环' }],
  }, { attachmentSourceIds: ['att-1'] }).ok, false)

  assert.equal(parseAgentOutput('R4', {
    ...r4Valid,
    conceptEdges: [{ id: 'bad', fromConceptId: 'n1', toConceptId: 'missing', reason: '悬空' }],
  }, { attachmentSourceIds: ['att-1'] }).ok, false)

  assert.equal(parseAgentOutput('R4', {
    ...r4Valid,
    concepts: r4Valid.concepts.map((item) => (
      item.id === 'n2' ? { ...item, attachmentSourceIds: ['invented'] } : item
    )),
  }, { attachmentSourceIds: ['att-1'] }).ok, false)

  assert.equal(parseAgentOutput('R4', {
    ...r4Valid,
    concepts: [
      ...r4Valid.concepts,
      { id: 'island', carrierId: 'c1', title: '孤岛', hasDispute: false, detailedDescription: '不可达', attachmentSourceIds: [] },
    ],
  }, { attachmentSourceIds: ['att-1'] }).ok, false)
})

test('salvageR4Route repairs cycles, dangling edges, islands and invented attachments', () => {
  const cyclic = salvageR4Route({
    ...r4Valid,
    conceptEdges: [...r4Valid.conceptEdges, { id: 'loop', fromConceptId: 'n3', toConceptId: 'n1', reason: '环' }],
  }, ['att-1'])
  assert.equal(parseAgentOutput('R4', cyclic, { attachmentSourceIds: ['att-1'] }).ok, true)

  const dangling = salvageR4Route({
    ...r4Valid,
    conceptEdges: [{ id: 'bad', fromConceptId: 'n1', toConceptId: 'missing', reason: '悬空' }],
  }, ['att-1'])
  assert.equal(parseAgentOutput('R4', dangling, { attachmentSourceIds: ['att-1'] }).ok, true)

  const invented = salvageR4Route({
    ...r4Valid,
    concepts: r4Valid.concepts.map((item) => (
      item.id === 'n2' ? { ...item, attachmentSourceIds: ['invented'] } : item
    )),
  }, ['att-1'])
  const inventedParsed = parseAgentOutput('R4', invented, { attachmentSourceIds: ['att-1'] })
  assert.equal(inventedParsed.ok, true)
  assert.deepEqual(inventedParsed.value.concepts.find((item) => item.id === 'n2').attachmentSourceIds, [])

  const island = salvageR4Route({
    ...r4Valid,
    concepts: [
      ...r4Valid.concepts,
      { id: 'island', carrierId: 'c1', title: '孤岛', hasDispute: false, detailedDescription: '不可达', attachmentSourceIds: [] },
    ],
  }, ['att-1'])
  assert.equal(parseAgentOutput('R4', island, { attachmentSourceIds: ['att-1'] }).ok, true)
})

test('R4 extracts version 1 and string hasDispute without inventing nodes', () => {
  const coerced = parseAgentOutput('R4', {
    ...r4Valid,
    version: 1,
    concepts: r4Valid.concepts.map((item) => (
      item.id === 'n2'
        ? { ...item, hasDispute: 'true', 争议: 'true' }
        : { ...item, hasDispute: 'false' }
    )),
  }, { attachmentSourceIds: ['att-1'] })
  assert.equal(coerced.ok, true)
  assert.equal(coerced.value.version, '1.0')
  assert.equal(coerced.value.concepts.find((item) => item.id === 'n2').hasDispute, true)
})

test('R3/R3b enforce question counts, unique ids and the 3-round replace rule', () => {
  const questions = [{
    id: 'qq1',
    prompt: '更想先看理论还是例子？',
    options: [
      { id: 'o1', label: '理论', routeEffect: '先放定义' },
      { id: 'o2', label: '例子', routeEffect: '先放例子' },
    ],
  }]
  assert.equal(parseAgentOutput('R3', { round: 1, status: 'active', questions }).ok, true)
  assert.equal(parseAgentOutput('R3', { round: 1, status: 'active', questions: [] }).ok, false)
  assert.equal(parseAgentOutput('R3b', {
    kind: 'continue_current',
    message: '先把当前题答完。',
    activeRound: 2,
  }, { activeRound: 2 }).ok, true)
  assert.equal(parseAgentOutput('R3b', {
    kind: 'replace_questions',
    message: '根据你的追问换成新题。',
    round: 2,
    status: 'active',
    questions,
  }, { activeRound: 1 }).ok, true)
  assert.equal(parseAgentOutput('R3b', {
    kind: 'replace_questions',
    message: '不能再换。',
    round: 4,
    status: 'active',
    questions,
  }, { activeRound: 3 }).ok, false)
  assert.equal(parseAgentOutput('R3b', {
    kind: 'replace_questions',
    message: '轮次错误',
    round: 3,
    status: 'active',
    questions,
  }, { activeRound: 1 }).ok, false)
})

test('G1/A2/N2 keep relation enums and author-evidence bindings', () => {
  assert.equal(parseAgentOutput('G1', {
    relation: 'parallel',
    title: '一个例子',
    edgeExplanation: '理解之后可以用例子对照。',
  }).ok, true)
  assert.equal(parseAgentOutput('G1', {
    relation: 'par',
    title: '错枚举',
    edgeExplanation: '旧字段',
  }).ok, false)

  const candidates = [{
    authorId: 'https://www.zhihu.com/people/real',
    authorName: '真实作者',
    evidence: [{
      evidenceId: 'ev1',
      summary: '公开总结',
      url: 'https://www.zhihu.com/question/1',
    }],
  }]
  assert.equal(parseAgentOutput('A2', {
    status: 'selected',
    normalizedQuestion: '线性映射为什么要保加法？',
    selections: [{
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      evidenceId: 'ev1',
      evidenceSummary: '公开总结',
      evidenceUrl: 'https://www.zhihu.com/question/1',
    }],
  }, { candidates }).ok, true)
  assert.equal(parseAgentOutput('A2', {
    status: 'selected',
    normalizedQuestion: '线性映射为什么要保加法？',
    selections: [{
      authorId: 'invented',
      authorName: '真实作者',
      evidenceId: 'ev1',
      evidenceSummary: '公开总结',
      evidenceUrl: 'https://www.zhihu.com/question/1',
    }],
  }, { candidates }).ok, false)
  assert.equal(parseAgentOutput('A2', {
    status: 'selected',
    normalizedQuestion: '线性映射为什么要保加法？',
    selections: [{
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '刘看山',
      evidenceId: 'ev1',
      evidenceSummary: '公开总结',
      evidenceUrl: 'https://www.zhihu.com/question/1',
    }],
  }, { candidates }).ok, false)
  assert.equal(parseAgentOutput('A2', {
    status: 'no_suitable_author',
    normalizedQuestion: '线性映射为什么要保加法？',
    selections: [],
  }, { candidates }).ok, true)

  assert.equal(parseAgentOutput('N2', {
    selections: [{
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      evidenceId: 'ev1',
    }],
  }, { candidates, remainingSlots: 2, excludedAuthorIds: [] }).ok, true)
  assert.equal(parseAgentOutput('N2', {
    selections: [{
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      evidenceId: 'ev1',
    }, {
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      evidenceId: 'ev1',
    }],
  }, { candidates, remainingSlots: 1, excludedAuthorIds: [] }).ok, false)
  assert.equal(parseAgentOutput('N2', {
    selections: [{
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      evidenceId: 'ev1',
    }],
  }, { candidates, remainingSlots: 2, excludedAuthorIds: ['https://www.zhihu.com/people/real'] }).ok, false)
})

test('text agents reject empty bodies and L0b only allows content', () => {
  assert.equal(parseAgentOutput('L0a', '具体讲解正文', {}, 'concrete_explanation').ok, true)
  assert.equal(parseAgentOutput('G2', '   ').ok, false)
  assert.equal(parseAgentOutput('L0b', { content: '首轮正文' }).ok, true)
  assert.equal(parseAgentOutput('L0b', { content: '首轮正文', title: '另起根标题' }).ok, true)
})

test('JSON extract recovers fences, surrounding prose and trailing commas', () => {
  const json = JSON.stringify(r1Valid)
  const wrapped = `说明如下：\n\`\`\`json\n${json.slice(0, -1)},}\n\`\`\`\n以上。`
  const parsed = parseAgentJson(wrapped)
  assert.equal(parsed.ok, true)
  assert.equal(parseAgentOutput('R1', parsed.value).ok, true)
  const smart = parseAgentJson(`{“queries”:${JSON.stringify(r1Valid.queries)}}`)
  assert.equal(smart.ok, true)
})
