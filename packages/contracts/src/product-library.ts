import { z } from 'zod'
import type { LearningPathDocument } from './path-document.ts'

const id=z.string().min(1)
const DocumentProjectionSchema=z.object({
  protocol:z.literal('learning-path'),version:z.literal('1.0'),id,
  metadata:z.object({title:id,locale:id,description:z.string().optional()}).passthrough(),
  structure:z.object({entrySubjectId:id,goalSubjectIds:z.array(id),subjects:z.array(z.object({id,cardRef:id}).passthrough()),concepts:z.array(z.object({id,subjectId:id,cardRef:id,actionRef:id}).passthrough()),flow:z.array(z.object({id,fromSubjectId:id,toSubjectId:id}).passthrough())}).passthrough(),
  data:z.object({cards:z.array(z.object({id,title:z.string().optional()}).passthrough())}).passthrough(),
}).passthrough()
// The publisher performs the complete renderer preflight. This read boundary
// verifies all fields used by the library before accepting a remote projection.
export const LibraryDocumentSchema=z.custom<LearningPathDocument>(value=>DocumentProjectionSchema.safeParse(value).success)
export const ServerHistorySchema=z.object({id,resourceId:id,kind:z.enum(['path','chat','learning']),title:z.string(),query:z.string(),updatedAt:z.number().finite(),routeId:id.optional(),conceptId:id.optional()})
export const ProductLibrarySchema=z.object({paths:z.array(z.object({id,goal:z.string(),document:LibraryDocumentSchema,updatedAt:z.number().finite()})),knowledge:z.array(z.object({id,routeId:id,conceptId:id,title:z.string()})),conversations:z.array(ServerHistorySchema)})
export const ProductLibraryPageSchema=ProductLibrarySchema.extend({nextCursor:z.string().max(1000).optional()})
export type ProductLibrary=z.infer<typeof ProductLibrarySchema>
export type ServerHistory=z.infer<typeof ServerHistorySchema>
