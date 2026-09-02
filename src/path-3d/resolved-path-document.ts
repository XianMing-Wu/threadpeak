import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import { isLearningPathRendererDocument } from './validate-renderer-document.ts'

const EXAMPLE_FIXTURE_DOCUMENT_IDS = new Set([
  'threadpeak-linear-algebra-v1',
  'threadpeak-critical-thinking-v1',
  'threadpeak-frontend-architecture-v1',
])

export type Path3DRouteInput = {
  id: string
  owner: 'mine' | 'example'
  title: string
  document: unknown
}

export type Path3DResolution =
  | {
      kind: 'ready'
      source: 'mine' | 'example'
      routeId: string
      title: string
      document: LearningPathDocument
    }
  | {
      kind: 'unavailable'
      reason: 'missing-route' | 'invalid-mine-document' | 'invalid-example-document'
      title: string
      message: string
    }

export function isLearningPathDocument(value: unknown): value is LearningPathDocument {
  return isLearningPathRendererDocument(value)
}

export function isExampleFixtureDocumentId(id: string): boolean {
  return EXAMPLE_FIXTURE_DOCUMENT_IDS.has(id)
}

export function isRenderableMineRoute(route: { owner: 'mine' | 'example'; document: unknown }): boolean {
  if (route.owner !== 'mine' || !isLearningPathDocument(route.document)) return false
  return !isExampleFixtureDocumentId(route.document.id)
}

export function resolvePath3DView(input: {
  routeId: string
  route?: Path3DRouteInput
}): Path3DResolution {
  const routeId = input.routeId.trim()
  if (!routeId || !input.route) {
    return {
      kind: 'unavailable',
      reason: 'missing-route',
      title: '未选择路线',
      message: '没有可打开的路线。请从我的路线或示例路线进入；不能把内置演示路径当作用户结果。',
    }
  }

  const { route } = input
  if (!isLearningPathDocument(route.document)) {
    return {
      kind: 'unavailable',
      reason: route.owner === 'mine' ? 'invalid-mine-document' : 'invalid-example-document',
      title: route.title,
      message: route.owner === 'mine'
        ? '这条用户路线没有已校验的渲染文档，不能回退到内置演示路径。'
        : '这条示例路线的渲染文档无效。',
    }
  }

  if (route.owner === 'mine' && isExampleFixtureDocumentId(route.document.id)) {
    return {
      kind: 'unavailable',
      reason: 'invalid-mine-document',
      title: route.title,
      message: '用户路线不能使用内置演示文档。请重新生成路线。',
    }
  }

  return {
    kind: 'ready',
    source: route.owner,
    routeId: route.id,
    title: route.title,
    document: route.document,
  }
}
