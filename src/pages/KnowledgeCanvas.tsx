import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnnotatedMarkdown, AnnotatedText } from '../components/AnnotatedText'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AskAuthorsPrompt } from '../components/AskAuthorsPrompt'
import { BasisVisual } from '../components/BasisVisual'
import type { AssistantMode } from '../assistant-mode'
import { Composer } from '../components/Composer'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { CanvasConversationAction } from '../knowledge-canvas/canvas-conversation-action'
import {
  estimateNodeHeight,
  flowBranchLabel,
  type CanvasEdge,
  type CanvasNode,
} from '../knowledge-canvas/content'
import { conceptCarrier, conceptTitle } from '../workspace/catalog'
import { closeConceptKnowledge, readActiveConversationId, readActiveKnowledgeId, readCanvasReturn, readKnowledgeConceptId } from '../workspace/nav'
import { appendFollowUpTurn, blueprintOf, ensureLearningConversation, getConceptGraph, getConversation, getKnowledge, getLesson, saveConversationDraft, useWorkspaceTick } from '../workspace/store'
import { conversationGraphView, growKindLabel } from '../knowledge-canvas/generate'
import { AgentStatus } from '../components/AgentStatus'
import {
  CARD_W,
  DEFAULT_SIZE,
  bezierLR,
  bottomHandle,
  dashedTB,
  layoutPositions,
  sourceHandle,
  targetHandle,
  topHandle,
  worldSize,
  type Size,
  type XY,
} from '../knowledge-canvas/layout'
import {
  readLearningSession,
} from '../learningSession'
import { annotationScopeId, readSelectionAnchor, type SelectionAnchor } from '../session/ask-authors'
import { useAnnotations } from '../session/useAnnotations'
import { requestFollowUp } from '../session/request-follow-up'
import { buildFollowUpMessages, buildFollowUpNeighborhood, followUpQuoteForG2 } from '../session/build-follow-up-context'
import { readLearningThinking, subscribeLearningThinking, writeLearningThinking } from '../session/learning-thinking'
import { resolveFollowUpHost } from '../session/resolve-follow-up-host'
import { MarkdownMath } from '../lib/MarkdownMath'

const NODE_PANEL_W = CARD_W
const NODE_PANEL_GAP = 8

const initialView = { zoom: 0.72, pan: { x: 12, y: 20 } }
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('textarea,input,[contenteditable="true"],.canvas-composer'))
}

type PanDrag = {
  kind: 'pan'
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
  moved: boolean
}
type NodeDrag = {
  kind: 'node'
  pointerId: number
  id: string
  startX: number
  startY: number
  origin: XY
  moved: boolean
}
type DragState = PanDrag | NodeDrag | null

function graphSignature(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]) {
  return JSON.stringify({
    nodes: nodes.map((node) => [node.id, node.title, node.turns.length]),
    edges: edges.map((edge) => [edge.id, edge.from, edge.to, edge.kind]),
  })
}

export function KnowledgeCanvasPage() {
  const returnTo = readCanvasReturn()
  const seed = readLearningSession()
  const knowledgeId = readActiveKnowledgeId()
  const conceptId = readKnowledgeConceptId()
  const workspaceTick = useWorkspaceTick()
  const knowledge = getKnowledge(knowledgeId)
  const graph = knowledge && conceptId ? getConceptGraph(knowledge.id, conceptId) : undefined
  const title = knowledge && conceptId ? conceptTitle(blueprintOf(knowledge.routeId), conceptId) : knowledge?.title ?? '知识脉络'
  const initialNodes = graph?.nodes ?? []
  const initialEdges = graph?.edges ?? []
  const [zoom, setZoom] = useState(initialView.zoom)
  const [pan, setPan] = useState(initialView.pan)
  const [dragging, setDragging] = useState<'pan' | 'node' | false>(false)
  const [reason, setReason] = useState<CanvasEdge | null>(null)
  const [selected, setSelected] = useState('root')
  const [nodes, setNodes] = useState<CanvasNode[]>(() => initialNodes.slice())
  const [edges, setEdges] = useState<CanvasEdge[]>(() => initialEdges.slice())
  const [pins, setPins] = useState<ReadonlyMap<string, XY>>(() => new Map())
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(() =>
    new Map(initialNodes.map((node) => [node.id, { width: CARD_W, height: estimateNodeHeight(node) }])),
  )
  const [quote, setQuote] = useState(seed.quote)
  const [quoteFromId, setQuoteFromId] = useState('')
  const [selection, setSelection] = useState<SelectionAnchor | null>(null)
  const [authorQuestion, setAuthorQuestion] = useState<SelectionAnchor | null>(null)
  const activeConversation = getConversation(readActiveConversationId())
  const sessionConversationId = activeConversation?.kind === 'learning'
    && activeConversation.routeId === knowledge?.routeId
    && activeConversation.conceptId === conceptId
    ? activeConversation.id
    : ''
  const annotations = useAnnotations(annotationScopeId(knowledge?.routeId || knowledgeId || 'knowledge', conceptId || 'canvas'))
  const [mode, setMode] = useState<AssistantMode>(seed.mode)
  const [value, setValue] = useState(seed.value)
  const [turns, setTurns] = useState(seed.turns)
  const [awaiting, setAwaiting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [thinkingDepth, setThinkingDepth] = useState(readLearningThinking)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  const dragRef = useRef<DragState>(null)
  const ignoreClickRef = useRef(false)
  const nodeRefs = useRef(new Map<string, HTMLElement>())
  const canvasRef = useRef<HTMLElement>(null)
  const selectRootRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  const graphRef = useRef({ nodes, edges })
  graphRef.current = { nodes, edges }
  useEffect(() => {
    if (!knowledge || !conceptId) return
    const nextGraph = getConceptGraph(knowledge.id, conceptId)
    if (!nextGraph) return
    if (graphSignature(graphRef.current.nodes, graphRef.current.edges) === graphSignature(nextGraph.nodes, nextGraph.edges)) return
    setNodes(nextGraph.nodes.slice())
    setEdges(nextGraph.edges.slice())
    setPins(new Map())
  }, [conceptId, knowledge?.id, workspaceTick])

  useEffect(() => {
    if (!sessionConversationId) return
    const stored = getConversation(sessionConversationId)?.turns ?? []
    const keyOf = (item: typeof turns[number]) => `${item.role}:${item.text}`
    const storedKeys = new Set(stored.map(keyOf))
    const extras = turns.filter((item) => !storedKeys.has(keyOf(item)))
    saveConversationDraft(sessionConversationId, {
      turns: stored.length || extras.length ? [...stored, ...extras] : turns,
      value,
      quote,
      mode,
    })
  }, [mode, quote, sessionConversationId, turns, value])
  const view = useMemo(
    () => conversationGraphView(nodes, edges),
    [edges, nodes],
  )

  const autoPos = useMemo(
    () => layoutPositions(view.nodes, view.edges, sizes),
    [sizes, view.edges, view.nodes],
  )
  const positions = useMemo(() => {
    const next = new Map<string, XY>()
    for (const node of view.nodes) next.set(node.id, pins.get(node.id) ?? autoPos.get(node.id) ?? { x: 0, y: 0 })
    return next
  }, [autoPos, pins, view.nodes])
  const world = useMemo(() => {
    const base = worldSize(positions, sizes)
    if (!annotations.panelOpen || !annotations.active) return base
    const pos = positions.get(annotations.active.nodeId)
    const size = sizes.get(annotations.active.nodeId) ?? DEFAULT_SIZE
    if (!pos) return base
    return {
      width: Math.max(base.width, pos.x + size.width + NODE_PANEL_GAP + NODE_PANEL_W + 24),
      height: Math.max(base.height, pos.y + size.height + 24),
    }
  }, [annotations.active, annotations.panelOpen, positions, sizes])

  const syncSizes = useCallback(() => {
    const next = new Map<string, Size>()
    for (const [id, el] of nodeRefs.current) {
      next.set(id, { width: el.offsetWidth, height: el.offsetHeight })
    }
    if (!next.size) return
    setSizes((prev) => {
      if (prev.size === next.size && [...next].every(([id, size]) => {
        const old = prev.get(id)
        return old?.width === size.width && old?.height === size.height
      })) return prev
      return next
    })
  }, [])

  useLayoutEffect(syncSizes, [nodes, selected, syncSizes])
  useEffect(() => {
    const observer = new ResizeObserver(syncSizes)
    for (const el of nodeRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [nodes, syncSizes])

  const bindNode = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  const fitView = useCallback(() => {
    const el = canvasRef.current
    if (!el || !world.width || !world.height) {
      setZoom(initialView.zoom)
      setPan(initialView.pan)
      return
    }
    const pad = 48
    const nextZoom = clampZoom(Math.min(
      (el.clientWidth - pad * 2) / world.width,
      (el.clientHeight - pad * 2) / world.height,
    ))
    setZoom(nextZoom)
    setPan({
      x: (el.clientWidth - world.width * nextZoom) / 2,
      y: (el.clientHeight - world.height * nextZoom) / 2,
    })
  }, [world.height, world.width])

  const applyZoomAt = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const el = canvasRef.current
    const current = zoomRef.current
    const clamped = clampZoom(nextZoom)
    if (!el || clamped === current) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const origin = panRef.current
    const worldX = (x - origin.x) / current
    const worldY = (y - origin.y) / current
    setZoom(clamped)
    setPan({ x: x - worldX * clamped, y: y - worldY * clamped })
  }, [])

  const zoomCanvas = useCallback((nextZoom: number) => {
    const el = canvasRef.current
    if (!el) {
      setZoom(clampZoom(nextZoom))
      return
    }
    const rect = el.getBoundingClientRect()
    applyZoomAt(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }, [applyZoomAt])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        applyZoomAt(zoomRef.current * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY)
        return
      }
      if ((event.target as Element).closest('.thread-node,.annotation-panel')) return
      event.preventDefault()
      setPan({
        x: panRef.current.x - event.deltaX,
        y: panRef.current.y - event.deltaY,
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoomAt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isTypingTarget(event.target)) {
        annotations.close()
        setReason(null)
        return
      }
      if (!(event.metaKey || event.ctrlKey) || isTypingTarget(event.target)) return
      if (event.key === '=' || event.key === '+' || event.code === 'NumpadAdd') {
        event.preventDefault()
        zoomCanvas(zoomRef.current + 0.1)
        return
      }
      if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') {
        event.preventDefault()
        zoomCanvas(zoomRef.current - 0.1)
        return
      }
      if (event.key === '0' || event.code === 'Numpad0') {
        event.preventDefault()
        fitView()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fitView, zoomCanvas])

  const resetView = () => fitView()
  const resetLayout = () => {
    setPins(new Map())
    queueMicrotask(fitView)
  }

  const didFit = useRef(false)
  useLayoutEffect(() => {
    if (didFit.current || !canvasRef.current || !world.width) return
    didFit.current = true
    fitView()
  }, [fitView, world.width])

  const capturePointer = (target: HTMLElement, pointerId: number) => {
    try { target.setPointerCapture(pointerId) } catch { /* synthetic / already captured */ }
  }

  const startPan = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('button,[role="button"],.edge-reason,.canvas-composer,.thread-node,.sel-toolbar,.ask-authors-prompt,.annotation-panel,.annotation-ball')) return
    capturePointer(event.currentTarget, event.pointerId)
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    }
    ignoreClickRef.current = false
    setDragging('pan')
  }
  const startNodeDrag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    capturePointer(event.currentTarget, event.pointerId)
    const origin = positions.get(id) ?? { x: 0, y: 0 }
    dragRef.current = {
      kind: 'node',
      pointerId: event.pointerId,
      id,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      moved: false,
    }
    ignoreClickRef.current = false
    setSelected(id)
    setReason(null)
    setDragging('node')
  }
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    if (drag.kind === 'pan') {
      setPan({ x: drag.panX + dx, y: drag.panY + dy })
      return
    }
    const next = new Map(pins)
    next.set(drag.id, {
      x: drag.origin.x + dx / zoom,
      y: drag.origin.y + dy / zoom,
    })
    setPins(next)
  }
  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId === event.pointerId) {
      ignoreClickRef.current = drag.moved
      dragRef.current = null
    }
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch { /* ignore */ }
    setDragging(false)
  }
  const clearReason = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }
    setReason(null)
  }

  useEffect(() => {
    const clear = (event: MouseEvent) => {
      if ((event.target as Element).closest('.sel-toolbar,.ask-authors-prompt,.annotation-panel,.annotation-ball')) return
      setSelection(null)
    }
    document.addEventListener('mousedown', clear)
    return () => document.removeEventListener('mousedown', clear)
  }, [])

  const onSelect = () => {
    if (authorQuestion) return
    setSelection(readSelectionAnchor(selectRootRef.current, (node) => {
      const el = node instanceof Element ? node : node.parentElement
      return el?.closest('.thread-node')?.getAttribute('data-id') || undefined
    }))
  }
  const addToChat = () => {
    if (!selection) return
    setQuote(selection.text)
    setQuoteFromId(selection.nodeId || selected)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }
  const openAskAuthors = () => {
    if (!selection) return
    setAuthorQuestion(selection)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }
  const submitAskAuthors = (question: string) => {
    if (!authorQuestion) return
    const nodeId = authorQuestion.nodeId || selected
    const node = nodes.find((item) => item.id === nodeId)
    const hostContent = node
      ? node.turns.flatMap((turn) => turn.paragraphs).join('\n\n')
      : ''
    const routeId = knowledge?.routeId ?? ''
    annotations.create(authorQuestion.text, question, nodeId, {
      hostContent,
      carrier: conceptCarrier(blueprintOf(routeId), conceptId || ''),
      concept: { id: conceptId || '', title },
      thinkingDepth,
    })
    setAuthorQuestion(null)
  }

  const clearQuote = () => {
    setQuote('')
    setQuoteFromId('')
  }

  const send = () => {
    if (!knowledge?.routeId || !conceptId) return
    const asked = value
    const lesson = getLesson(knowledge.routeId, conceptId)
    const lessonText = lesson?.paragraphs.join('\n\n') || nodes.find((node) => node.id === 'root')?.turns.flatMap((turn) => turn.paragraphs).join('\n\n') || ''
    const resolved = resolveFollowUpHost({
      question: asked,
      quote,
      quoteFromId,
      turns,
      root: { nodeId: 'root', content: lessonText },
    })
    if (!resolved.ok) return
    const neighborhood = buildFollowUpNeighborhood({
      nodes,
      edges,
      hostNodeId: resolved.hostNodeId,
      annotations: annotations.annotations,
    })
    if (!neighborhood) return
    const conversationId = sessionConversationId || ensureLearningConversation(knowledge.routeId, conceptId).id
    const messages = buildFollowUpMessages({ lessonText, turns, annotations: annotations.annotations })
    const g2Quote = followUpQuoteForG2(resolved, messages)
    const cited = resolved.quote.text || ''
    const userText = cited ? `引用「${cited}」\n${asked}` : asked
    setTurns((old) => [...old, { role: 'user', text: userText, quote: cited, quoteFromId: resolved.hostNodeId }])
    setValue('')
    clearQuote()
    setMode('')
    setAwaiting(true)
    setStreamText('')
    void requestFollowUp({
      routeId: knowledge.routeId,
      conceptId,
      conversationId,
      question: asked,
      hostNodeId: resolved.hostNodeId,
      quote: { nodeId: resolved.quote.nodeId, text: resolved.quote.text, messageId: g2Quote.messageId },
      neighborhood,
      messages,
      thinkingDepth,
      onDelta: (text) => { setAwaiting(false); setStreamText(text) },
    }).then((result) => {
      setAwaiting(false)
      setStreamText('')
      if (result.kind !== 'completed') {
        setTurns((old) => [...old, { role: 'assistant', text: result.message, failed: true }])
        return
      }
      const createdId = appendFollowUpTurn(knowledge.routeId, conceptId, conversationId, {
        question: asked,
        quote: cited,
        quoteFromId: resolved.hostNodeId,
        reply: result.text,
        grow: result.grow,
      })
      setTurns((old) => [...old, { role: 'assistant', text: result.text, nodeId: createdId }])
      const nextGraph = getConceptGraph(knowledge.id, conceptId)
      if (nextGraph) {
        setNodes(nextGraph.nodes)
        setEdges(nextGraph.edges)
        setPins(new Map())
      }
    })
  }

  return <ProductWorkspace active="knowledge" page="knowledge-detail">
    <main className="canvas-page has-composer">
      <header className="canvas-header">
        <div>
          <button type="button" aria-label="返回" onClick={() => {
            closeConceptKnowledge()
            location.hash = 'knowledge-detail'
          }}><Icon name="back" size={18}/></button>
          <span><small>{knowledge?.title ?? '知识脉络'}</small><strong>{title}</strong></span>
        </div>
        <CanvasConversationAction returnTo={returnTo} routeId={knowledge?.routeId ?? ''} conceptId={conceptId}/>
      </header>
      <section
        ref={canvasRef}
        className={`thread-canvas has-composer ${dragging ? `is-dragging is-dragging-${dragging}` : ''}`}
        aria-label="只读画布，可拖拽浏览的知识脉络"
        style={{ '--canvas-card-w': `${CARD_W}px` } as React.CSSProperties}
        onClick={(event) => {
          clearReason()
          if ((event.target as Element).closest('.annotation-panel,.annotation-ball,.canvas-tools')) return
          annotations.close()
        }}
        onPointerDown={startPan}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="canvas-tools">
          <button type="button" aria-label="放大画布" onClick={() => zoomCanvas(zoom + 0.1)}><Icon name="zoomIn" size={18}/></button>
          <button type="button" aria-label="缩小画布" onClick={() => zoomCanvas(zoom - 0.1)}><Icon name="zoomOut" size={18}/></button>
          <button type="button" aria-label="重置画布视图" onClick={resetView}><Icon name="target" size={18}/></button>
          <button type="button" className="canvas-relayout" aria-label="清除手动位置并重新排列" onClick={resetLayout}>重新排列{pins.size ? ` · ${pins.size}` : ''}</button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <div
          ref={selectRootRef}
          className="canvas-world"
          style={{
            width: world.width,
            height: world.height,
            transform: `translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`,
          }}
          onMouseUp={onSelect}
        >
          <svg
            className="canvas-wires"
            width={world.width}
            height={world.height}
            viewBox={`0 0 ${world.width} ${world.height}`}
            preserveAspectRatio="xMinYMin meet"
            aria-label="节点逻辑连线"
          >
            {view.edges.map((edge) => {
              const from = positions.get(edge.from)
              const to = positions.get(edge.to)
              const target = view.nodes.find((node) => node.id === edge.to)
              if (!from || !to || !target) return null
              const fromSize = sizes.get(edge.from) ?? DEFAULT_SIZE
              const toSize = sizes.get(edge.to) ?? DEFAULT_SIZE
              if (edge.kind === 'parallel') {
                const hostId = target.hostId || edge.from
                const hostPos = positions.get(hostId) ?? from
                const hostSize = sizes.get(hostId) ?? fromSize
                const start = bottomHandle(hostPos, hostSize)
                const end = topHandle(to, toSize)
                return <g key={edge.id}>
                  <path className="is-parallel" d={dashedTB(start, end)} stroke={target.accent}/>
                </g>
              }
              const start = sourceHandle(from, fromSize)
              const end = targetHandle(to, toSize)
              const mx = (start.x + end.x) / 2
              const my = (start.y + end.y) / 2
              const label = flowBranchLabel(view.edges, edge)
              const open = (event: React.SyntheticEvent) => {
                event.stopPropagation()
                setReason(edge)
              }
              return <g key={edge.id}>
                <path d={bezierLR(start, end)} stroke={target.accent}/>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`查看第 ${label} 条分支的流转依据`}
                  onClick={open}
                  onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' ')open(event)}}
                >
                  <circle cx={mx} cy={my} r="14" fill={target.accent}/>
                  <text x={mx} y={my + 4}>{label}</text>
                </g>
              </g>
            })}
          </svg>
          {view.nodes.map((node) => {
            const position = positions.get(node.id) ?? { x: 0, y: 0 }
            return <div
              key={node.id}
              ref={(el) => bindNode(node.id, el)}
              data-id={node.id}
              className={`thread-node ${node.role === 'parallel' ? 'is-parallel' : ''} ${selected === node.id ? 'is-selected' : ''} ${dragging === 'node' && dragRef.current?.kind === 'node' && dragRef.current.id === node.id ? 'is-dragging' : ''}`}
              style={{ left: position.x, top: position.y, '--accent': node.accent } as React.CSSProperties}
              onPointerDown={(event) => {
                if ((event.target as Element).closest('.node-heading')) startNodeDrag(node.id, event)
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={(event) => {
                event.stopPropagation()
                if (ignoreClickRef.current) {
                  ignoreClickRef.current = false
                  return
                }
                setSelected(node.id)
                setReason(null)
                if (!(event.target as Element).closest('.annotation-ball')) annotations.close()
              }}
            >
              <i className="node-handle is-target" aria-hidden="true"/>
              <i className="node-handle is-parallel-in" aria-hidden="true"/>
              <header className="node-heading" role="button" tabIndex={0} aria-label={`移动节点 ${node.title}`}>
                <strong>{node.title}</strong>
                {node.grow && <em className="node-grow">{growKindLabel(node.grow)}</em>}
              </header>
              {node.turns.map((turn, index) => <section key={`${node.id}-${index}`} className={`node-turn is-${turn.replyKind}`}>
                {turn.title && (index > 0 || turn.title !== node.title) && <h3 className="node-turn-title">{turn.title}</h3>}
                <p className="node-question"><AnnotatedText text={turn.question} annotations={annotations.annotations.filter((item) => item.nodeId === node.id)} activeId={annotations.active?.id} onOpen={annotations.open}/></p>
                <div className="node-reply">
                  <AnnotatedMarkdown source={turn.paragraphs.join('\n\n')} annotations={annotations.annotations.filter((item) => item.nodeId === node.id)} activeId={annotations.active?.id} onOpen={annotations.open}/>
                  {turn.figure && <BasisVisual caption={turn.figure.caption}/>}
                </div>
              </section>)}
              <i className="node-handle is-source" aria-hidden="true"/>
              <i className="node-handle is-parallel-out" aria-hidden="true"/>
            </div>
          })}
          {annotations.panelOpen && annotations.active && positions.get(annotations.active.nodeId) && <AnnotationPanel
            annotation={annotations.active}
            placement="node"
            onClose={annotations.close}
            style={{
              left: (positions.get(annotations.active.nodeId)?.x ?? 0) + (sizes.get(annotations.active.nodeId)?.width ?? CARD_W) + NODE_PANEL_GAP,
              top: positions.get(annotations.active.nodeId)?.y ?? 0,
              width: sizes.get(annotations.active.nodeId)?.width ?? CARD_W,
              height: sizes.get(annotations.active.nodeId)?.height ?? DEFAULT_SIZE.height,
            }}
          />}
          {reason && positions.get(reason.from) && positions.get(reason.to) && <aside
            className="edge-reason"
            style={{
              left: Math.min(world.width - 280, ((positions.get(reason.from)?.x ?? 0) + (positions.get(reason.to)?.x ?? 0)) / 2 + 150),
              top: ((positions.get(reason.from)?.y ?? 0) + (positions.get(reason.to)?.y ?? 0)) / 2 + 82,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header><span>逻辑说明 · 流转依据 · {growKindLabel(reason.grow) || (reason.kind === 'parallel' ? '并列' : '后置')} {flowBranchLabel(edges, reason)}</span><button type="button" onClick={() => setReason(null)}>×</button></header>
            <p>{reason.reason}</p>
          </aside>}
        </div>
      </section>
      <footer className="canvas-composer">
        {(awaiting || streamText) && <div className="canvas-status" role="status" aria-live="polite">
          {awaiting && !streamText && <AgentStatus items={[{ label: '正在回答这次追问', detail: '对话直答和脉络结构同时开始；直答成功后才会展示回复，两路都成功才长出新卡。' }]}/>}
          {streamText && <div className="canvas-stream"><MarkdownMath source={streamText}/></div>}
        </div>}
        <Composer
          compact
          value={value}
          onChange={setValue}
          mode={mode}
          onMode={setMode}
          onSend={send}
          quote={quote}
          onClearQuote={clearQuote}
          showScope={false}
          showReference={false}
          showAttachment={false}
          placeholder={`围绕“${title}”继续提问，或选择上方模式深入理解…`}
          requireQuestion
          thinkingDepth={thinkingDepth}
          onThinkingDepth={(next) => { writeLearningThinking(next); setThinkingDepth(next) }}
        />
      </footer>
      {selection && !authorQuestion && <SelectionToolbar selection={selection} onAddToChat={addToChat} onAskAuthors={openAskAuthors}/>}
      {authorQuestion && <AskAuthorsPrompt selection={authorQuestion} onCancel={() => setAuthorQuestion(null)} onSubmit={submitAskAuthors}/>}
    </main>
  </ProductWorkspace>
}
