import { z } from 'zod'

const text = z.string().trim().min(1).max(1200)
const statements = z.array(text).max(12)
/** The handoff from route planning to teaching; never inferred from a title. */
export const ConceptLearningSummarySchema=z.object({
  focus:text,
  boundary:text,
  routeConnection:text,
  materialConnection:text,
}).strict()
/** A model's interpretation, never a replacement for the user's actual statements. */
export const LearningGoalSchema = z.object({
  outcome: text,
  motivation: z.string().max(1200),
  successCriteria: statements.min(1),
  startingPoint: z.string().max(1200),
  constraints: statements,
  nonGoals: statements,
  assumptions: statements,
  openQuestions: statements,
}).strict()
export const MaterialAnchorSchema = z.object({
  sourceId: z.string().min(1),
  quote: text,
  role: z.enum(['direct', 'prerequisite']),
  connection: text,
  // Assigned by the server against the exact material view; never chosen by the model.
  evidenceKind: z.enum(['material', 'context_summary']),
}).strict()
export const ConceptAlignmentSchema = z.object({
  purpose: text,
  depth: text,
  successCheck: text,
  materialAnchors: z.array(MaterialAnchorSchema).max(8),
}).strict()
export const GoalContextSchema = z.object({
  rawGoal: z.string().min(1),
  interpretation: LearningGoalSchema.optional(),
  // Ordered actual statements and answers, including superseded rounds. No inferred effects.
  userStatements: z.array(z.object({id:z.string(),question:z.string().optional(),text:z.string()})),
  conceptAlignment: ConceptAlignmentSchema.optional(),
  // Server-owned route position, not a claim that preceding concepts were mastered.
  routeContext: z.object({
    title:z.string(),
    carrier:z.object({title:z.string(),description:z.string()}),
    previous:z.array(z.object({title:z.string(),summary:z.string()})),
    next:z.array(z.object({title:z.string(),summary:z.string()})),
  }).strict().optional(),
}).strict()
export type GoalContext = z.infer<typeof GoalContextSchema>
export type LearningGoal = z.infer<typeof LearningGoalSchema>
