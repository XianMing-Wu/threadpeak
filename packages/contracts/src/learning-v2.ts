import {TaskActivitySchema} from './task-activity.ts'
import { GoalContextSchema,ConceptLearningSummarySchema } from './learning-goal.ts'
import { z } from 'zod'
import {SearchScopeSchema} from './search-scope.ts'

const Id = z.string().min(1).max(240)
const Text = z.string().max(2_000_000)
export const ArticleSchema = z.object({ retainedForHistory:z.boolean().optional(), curation:z.object({why:z.string(),readingGuide:Text,caveat:z.string(),reviewedAt:z.string()}).optional(), id: Id, title: z.string().min(1), summary: Text, author: z.string(), authorId: z.string().nullable(), authorUrl: z.string().url().nullish(), likes: z.number().nonnegative().nullable(), url: z.string().url().optional(), topic: z.string(), avatar:z.string().url().optional(), badge:z.string().optional(), sourceKind:z.enum(['zhihu','web','upload','collection','creation']).optional(), materialId:Id.optional(), site:z.string().optional(),badgeIcon:z.string().url().optional(),commentCount:z.number().nonnegative().optional(),editedAt:z.number().nonnegative().optional(),contentType:z.string().optional(),contentId:z.string().optional(),authorityLevel:z.string().optional(),rankingScore:z.number().optional(),comments:z.array(z.string()).optional(),authorSignature:z.string().optional() })
export const AuthorEvidenceSchema = z.object({ badgeIcon:z.string().url().optional(),likes:z.number().nonnegative().optional(),commentCount:z.number().nonnegative().optional(),editedAt:z.number().nonnegative().optional(),contentType:z.string().optional(),contentId:z.string().optional(),authorityLevel:z.string().optional(),rankingScore:z.number().optional(),comments:z.array(z.string()).optional(),authorSignature:z.string().optional(),sourceKind:z.enum(['zhihu','web']).optional(),site:z.string().optional(), matchReason:z.string().optional(),coverageLimit:z.string().optional(), avatar:z.string().url().optional(),badge:z.string().optional(),id: Id, name: z.string(), expertise: z.string(), authorUrl:z.string().url().nullish(), evidenceId: Id, url: z.string().url().optional() })
export const ParagraphSchema = z.object({ id: Id, title: z.string(), text: Text, sources: z.array(Id), parents: z.array(Id).length(1), origin: z.enum(['articles','direct','author']).optional(), author: AuthorEvidenceSchema.optional(), basisId: Id })
export const NodeSchema = z.object({ id: Id, type: z.enum(['root','article','answer','author','custom']), title: z.string().max(1000), text: Text,
  sources: z.array(Id), parents: z.array(Id).max(1), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), stroke: z.number().int().min(1).max(3).optional(),
  author: AuthorEvidenceSchema.optional(), origin: z.enum(['articles','direct','author']).optional(), basisId: Id.optional(), edited: z.boolean().optional() })
export const MessageSchema = z.object({ activities:z.array(TaskActivitySchema).optional(), id: Id, role: z.enum(['user','assistant']), text: Text.optional(), paragraphs: z.array(ParagraphSchema).optional(), selected: z.array(Id).optional(), kind: z.literal('author').optional(), incomplete: z.boolean().optional() })
export const ConversationSchema = z.object({ id: Id, title: z.string(), messages: z.array(MessageSchema), date: z.string() })
export const LearningSchema = z.object({
  learningSummary:ConceptLearningSummarySchema.optional(), initialMarkdown:Text.optional(), goalContext:GoalContextSchema.optional(), searchScope:SearchScopeSchema.optional(), version: z.literal(2), routeId: Id, conceptId: Id, title: z.string(), description: z.string(), hasDispute: z.boolean(),
  materialSelection:z.object({version:z.number().int(),selectedIds:z.array(Id)}).optional(),
  articles: z.array(ArticleSchema), nodes: z.array(NodeSchema), conversations: z.array(ConversationSchema), active: Id,
  initialized: z.boolean(), phase: z.enum(['searching','direct','organizing','ready','empty']), importResult:z.object({jobId:Id,status:z.enum(['added','already-present','unrelated']),title:z.string()}).optional(), initialAnswer: z.array(ParagraphSchema).optional() })
export type Article = z.infer<typeof ArticleSchema>
export type AuthorEvidence = z.infer<typeof AuthorEvidenceSchema>
export type Paragraph = z.infer<typeof ParagraphSchema>
export type GraphNode = z.infer<typeof NodeSchema>
export type Message = z.infer<typeof MessageSchema>
export type Conversation = z.infer<typeof ConversationSchema>
export type LearningState = z.infer<typeof LearningSchema>
export type Phase = LearningState['phase']|'search-error'|'answer-error'

export function validateTree(nodes: GraphNode[]) {
  if (!nodes.length) return
  const byId = new Map(nodes.map(n => [n.id,n]))
  if (byId.size !== nodes.length) throw new Error('DUPLICATE_NODE')
  const roots = nodes.filter(n => n.type === 'root')
  if (roots.length !== 1 || roots[0]!.parents.length) throw new Error('INVALID_ROOT')
  for (const node of nodes) {
    if (node.type === 'root') continue
    if (node.parents.length !== 1 || !byId.has(node.parents[0]!)) throw new Error('INVALID_PARENT')
    if (node.type === 'article' && node.parents[0] !== roots[0]!.id) throw new Error('ARTICLE_PARENT')
    if (node.basisId && node.basisId !== node.parents[0]) throw new Error('INVALID_BASIS')
  }
  // Mark complete ancestor paths once: linear time even for a long single-parent chain.
  const complete=new Set<string>([roots[0]!.id])
  for(const node of nodes){
    const path:string[]=[],visiting=new Set<string>();let current=node.id
    while(!complete.has(current)){
      if(visiting.has(current))throw new Error('TREE_CYCLE')
      visiting.add(current);path.push(current);current=byId.get(current)!.parents[0]!
    }
    for(const id of path)complete.add(id)
  }
}
export function paragraphNode(p: Paragraph): GraphNode { return { ...p, type: p.origin === 'author' ? 'author' : 'answer' } }
