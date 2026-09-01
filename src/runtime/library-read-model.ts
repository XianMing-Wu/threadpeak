import {
  listKnowledge,
  listRoutes,
} from '../workspace/store'
import type { KnowledgeCard, Owner, RouteCard } from '../workspace/types'

export type LibraryReadModel = {
  knowledge: Record<Owner, KnowledgeCard[]>
  routes: Record<Owner, RouteCard[]>
  recommendedKnowledge: KnowledgeCard[]
  recommendedRoutes: RouteCard[]
}

export function projectLibraryReadModel(): LibraryReadModel {
  const knowledge = {
    mine: listKnowledge('mine'),
    example: listKnowledge('example'),
  }
  const routes = {
    mine: listRoutes('mine'),
    example: listRoutes('example'),
  }
  return {
    knowledge,
    routes,
    recommendedKnowledge: knowledge.example.slice(0, 2),
    recommendedRoutes: routes.example.slice(0, 2),
  }
}

export function selectKnowledgeCards(owner: Owner) {
  return (view: LibraryReadModel) => view.knowledge[owner]
}

export function selectRouteCards(owner: Owner) {
  return (view: LibraryReadModel) => view.routes[owner]
}

export function selectRecommendedKnowledge(view: LibraryReadModel) {
  return view.recommendedKnowledge
}

export function selectRecommendedRoutes(view: LibraryReadModel) {
  return view.recommendedRoutes
}
