// Curated public article authors. Never writes author-search results or user networks.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const choices = [
  ['attention-shapes', '注意力机制'], ['attention-dot', '论文与代码'],
  ['attention-scale', '数学推导'], ['attention-softmax', '深度学习'],
  ['scene-camera', 'Three.js'], ['geometry-material', '三维图形'],
  ['orbit-controls', '交互开发'], ['array-shape', 'NumPy'],
  ['array-index', '数据分析'], ['llm-delivery', '大模型应用'],
  ['attention-heads', '多头注意力'], ['array-broadcast', '矩阵与广播'],
]
const sources = JSON.parse(await readFile('src/showcase/sources.json', 'utf8'))
const rows = [], evidence = []
await mkdir('public/art/authors', { recursive: true })
await mkdir('qa/evidence/ux-ui-2026-09-08/author-hero', { recursive: true })
for (const [key, topic] of choices) {
  const source = sources[key][0]
  const rawPath = `qa/evidence/showcase/raw/${key}.json`
  const raw = await readFile(rawPath, 'utf8'), run = JSON.parse(raw)
  const hit = run.result.items.find(item => `zhihu-${item.evidenceId}` === source.id)
  assert.equal(run.provider, 'zhihu-search'); assert.equal(run.result.kind, 'hits')
  assert.equal(hit.authorName, source.author); assert.equal(hit.avatar, source.avatar)
  assert.ok(!['刘看山', '知乎用户'].includes(source.author))
  const remote = new URL(source.avatar)
  assert.ok(remote.protocol === 'https:' && remote.hostname.endsWith('.zhimg.com'))
  const response = await fetch(remote, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0' } })
  assert.ok(response.ok, `Avatar unavailable: ${source.author} ${response.status}`)
  assert.match(response.headers.get('content-type') || '', /^image\//)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.ok(bytes.length > 100)
  const file = `${key}.jpg`
  await writeFile(`public/art/authors/${file}`, bytes)
  rows.push({ id: source.id, name: source.author, topic, avatar: `/art/authors/${file}`, sourceUrl: source.url, articleTitle: source.title.replace(/\s*-\s*知乎$/, '') })
  evidence.push({ id: source.id, name: source.author, sourceUrl: source.url, avatarUrl: source.avatar, originalEvidence: rawPath, provider: run.provider, retrievedAt: run.requestedAt, packagedAt: new Date().toISOString(), rawSha256: createHash('sha256').update(raw).digest('hex'), avatarSha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
  console.log('Collected', source.author, bytes.length)
}
await writeFile('src/learning-v2/author-hero-data.json', JSON.stringify(rows, null, 2) + '\n')
await writeFile('qa/evidence/ux-ui-2026-09-08/author-hero/sources.json', JSON.stringify(evidence, null, 2) + '\n')
