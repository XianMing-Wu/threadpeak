import {
  listExampleKnowledge,
  listReadOnlyConceptCards,
  listRoutes,
} from '../workspace/store'
import type { KnowledgeCard, Owner, RouteCard } from '../workspace/types'

export type LibraryReadModel = {
  exampleKnowledge: KnowledgeCard[]
  routes: Record<Owner, RouteCard[]>
  recommendedKnowledge: KnowledgeCard[]
  recommendedRoutes: RouteCard[]
}

export function projectLibraryReadModel(): LibraryReadModel {
  const exampleKnowledge = listExampleKnowledge()
  const routes = {
    mine: listRoutes('mine'),
    example: listRoutes('example'),
  }
  return {
    exampleKnowledge,
    routes,
    recommendedKnowledge: exampleKnowledge.flatMap(k=>{
      const cards=listReadOnlyConceptCards(k.id)
      const concept=cards.find(c=>['attention-scale','array-broadcast'].includes(c.id))??cards[0]
      return concept?[{...k,title:concept.title,description:concept.description,conceptId:concept.id}]:[]
    }),
    recommendedRoutes: routes.example,
  }
}

export const selectExampleKnowledge=(view:LibraryReadModel)=>view.exampleKnowledge

export function selectRouteCards(owner: Owner) {
  return (view: LibraryReadModel) => view.routes[owner]
}

export function selectRecommendedKnowledge(view: LibraryReadModel) {
  return view.recommendedKnowledge
}

export function selectRecommendedRoutes(view: LibraryReadModel) {
  return view.recommendedRoutes
}
