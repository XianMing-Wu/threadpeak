import { z } from 'zod'
export const TaskActivitySchema=z.object({
  id:z.string(),kind:z.enum(['read','search','write','edit']),title:z.string(),detail:z.string().optional(),
  status:z.enum(['running','done','waiting']),startedAt:z.number(),updatedAt:z.number(),finishedAt:z.number().optional(),
})
export type TaskActivity=z.infer<typeof TaskActivitySchema>
