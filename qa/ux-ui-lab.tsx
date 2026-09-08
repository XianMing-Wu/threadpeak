// Browser-only synthetic graph: imports the actual product component; never contacts providers.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthorNetworkGraph } from '../src/components/AuthorNetworkGraph'
import type { AuthorNetworkNode, AuthorNetworkEdge } from '../src/session/project-author-network'
import '../src/styles.css'
import '../src/ui/flowith-home.css'
import '../src/ui/flowith-market.css'
import '../src/ui/flowith-product.css'

const nodes: AuthorNetworkNode[] = [
  { id: 'carrier:qa', kind: 'carrier', label: '验收路线', detail: '仅用于本地浏览器验收' },
  { id: 'concept:qa', kind: 'concept', label: '验收概念', detail: '合成概念节点' },
  { id: 'question:qa', kind: 'question', label: '验收问题', detail: '合成问题节点' },
  { id: 'author:qa', kind: 'author', label: '验收作者', detail: '合成身份，不是真实博主' },
]
const edges: AuthorNetworkEdge[] = [
  { id: 'edge:1', source: nodes[0].id, target: nodes[1].id, kind: 'has-concept' },
  { id: 'edge:2', source: nodes[1].id, target: nodes[2].id, kind: 'has-question' },
  { id: 'edge:3', source: nodes[3].id, target: nodes[2].id, kind: 'authored-at' },
]
function Lab() {
  const [selected, setSelected] = useState('尚未选择')
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 16, background: 'var(--surface-1)', color: 'var(--ink-1)' }}>
    <h1>作者图键盘验收</h1>
    <p id="qa-authors-list">合成验收作者。此页使用真实 AuthorNetworkGraph，数据只用于测试。</p>
    <div style={{ position: 'relative', height: 'min(60dvh, 500px)', minHeight: 280, border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
      <AuthorNetworkGraph nodes={nodes} edges={edges} describedBy="qa-authors-list" onSelect={node => setSelected(node.id)} />
    </div>
    <p role="status" id="qa-selected">{selected}</p>
  </main>
}
createRoot(document.getElementById('root')!).render(<Lab />)
