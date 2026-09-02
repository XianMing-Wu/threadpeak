import { createHash } from "node:crypto";
import { z } from "zod";
import {
  EvidenceRecordSchema,
  sharedEventEnvelopeFields,
  SharedEventEnvelopeSchema,
  TraceIdSchema,
  UuidSchema,
} from "@threadpeak/contracts";
import type { LearningPathDocument } from "../../src/vendor/learning-path-3d/index.js";
import { validateRendererDocument } from "../../src/path-3d/validate-renderer-document.ts";

export {
  EvidenceRecordSchema,
  sharedEventEnvelopeFields,
  SharedEventEnvelopeSchema,
  TraceIdSchema,
  UuidSchema,
};


export function validateLearningPathDocument(input: unknown) {
  const result = validateRendererDocument(input)
  if (result.ok) return { ok: true as const, document: result.document, issues: [] as const }
  return {
    ok: false as const,
    issues: result.issues.map((path) => ({ code: 'invalid_document' as const, path, message: path })),
  }
}


export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type SharedEventEnvelope = z.infer<typeof SharedEventEnvelopeSchema>;

export interface ContractIssue {
  path: Array<string | number>;
  code: "invalid_reference" | "duplicate" | "invalid_graph" | "invalid_state" | "limit";
  message: string;
}

export const RESERVED_PRESENTATION_PREFIXES = [
  "pg-",
  "pc-",
  "pf-",
  "ps-",
  "psc-",
  "psf-",
] as const;

export const hasReservedPresentationPrefix = (id: string) =>
  RESERVED_PRESENTATION_PREFIXES.some((prefix) => id.startsWith(prefix));

export const SearchQueryIdSchema = z.enum([
  "route",
  "practice",
  "pitfalls",
  "prerequisites",
  "depth",
]);
export type SearchQueryId = z.infer<typeof SearchQueryIdSchema>;

export const RendererEvidenceUrlSchema = z.string().max(2_048).superRefine((value, ctx) => {
  if (value.trim() !== value || /[\u0000-\u001F\u007F]/u.test(value)) {
    ctx.addIssue({ code: "custom", message: "evidence URL must not contain surrounding whitespace or controls" });
    return;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "evidence URL must be absolute" });
    return;
  }
  const isZhihuHost = url.hostname === "zhihu.com" || url.hostname.endsWith(".zhihu.com");
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || !isZhihuHost) {
    ctx.addIssue({ code: "custom", message: "renderer evidence URL must be credential-free Zhihu HTTPS" });
  }
});

export const SourceOriginSchema = z.enum(["zhihu", "mixed", "modelSupplement"]);
export type SourceOrigin = z.infer<typeof SourceOriginSchema>;

export const CoverageFacetSchema = z.enum([
  "coreWorkflow",
  "prerequisites",
  "practice",
  "pitfalls",
  "verification",
  "optionalDepth",
]);
export type CoverageFacet = z.infer<typeof CoverageFacetSchema>;

export const DecisionDimensionSchema = z.enum([
  "outcome",
  "scope",
  "depth",
  "pace",
  "theoryPractice",
  "sourcePreference",
  "safetyBoundary",
  "priorKnowledge",
  "deliveryFormat",
  "other",
]);
export type DecisionDimension = z.infer<typeof DecisionDimensionSchema>;

export const DegradationReasonSchema = z.enum([
  "partialZhihuEvidence",
  "noZhihuEvidence",
  "primarySchemaInvalid",
  "primaryQualityRejected",
]);
export type DegradationReason = z.infer<typeof DegradationReasonSchema>;

export const PATH_HTTP_BODY_LIMIT_BYTES = 65_536;
export const GoalTextSchema = z.string().trim().min(1).max(2_000);
export const EffectiveGoalTextSchema = z.string().trim().min(1).max(20_000);
export const ContextTextSchema = z.string().trim().min(1).max(20_000);
export const UserMessageSchema = z.string().trim().min(1).max(5_000);

const hasLoneUtf16Surrogate = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
};

const vendorTextSchema = (maxCodeUnits: number) =>
  z
    .string()
    .min(1)
    .max(maxCodeUnits)
    .superRefine((value, ctx) => {
      if (
        value.trim() !== value
        || /[\u0000-\u001F\u007F]/u.test(value)
        || hasLoneUtf16Surrogate(value)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "vendor text must be trimmed, control-free, and valid UTF-16",
        });
      }
    });

export const VendorShortTextSchema = vendorTextSchema(160);
export const VendorSummarySchema = vendorTextSchema(500);
export const VendorBodySchema = vendorTextSchema(4_000);

const requestIdFields = { requestId: UuidSchema };
const existingSessionFields = {
  ...requestIdFields,
  sessionId: UuidSchema,
  expectedRevision: z.number().int().nonnegative(),
};

export const PathGenerationRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...requestIdFields,
      kind: z.literal("start"),
      sessionId: UuidSchema,
      goal: GoalTextSchema,
      contextText: ContextTextSchema.optional(),
      currentPathId: UuidSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...existingSessionFields,
      kind: z.literal("answer"),
      questionId: UuidSchema,
      optionId: UuidSchema,
    })
    .strict(),
  z
    .object({
      ...existingSessionFields,
      kind: z.literal("reviseAnswer"),
      questionId: UuidSchema,
      optionId: UuidSchema,
    })
    .strict(),
  z
    .object({
      ...existingSessionFields,
      kind: z.literal("message"),
      message: UserMessageSchema,
      intent: z.enum(["ask", "supplementGoal"]),
    })
    .strict(),
]);
export type PathGenerationRequest = z.infer<typeof PathGenerationRequestSchema>;

export const PathKnowledgeHandoffSchema = z
  .object({
    planInstanceId: UuidSchema,
    conceptId: UuidSchema,
    pathRevision: z.number().int().nonnegative().optional(),
  })
  .strict();
export type PathKnowledgeHandoff = z.infer<typeof PathKnowledgeHandoffSchema>;

export const PathKnowledgeHandoffResolutionSchema = z
  .object({
    planInstanceId: UuidSchema,
    conceptId: UuidSchema,
    pathRevision: z.number().int().nonnegative(),
  })
  .strict();
export type PathKnowledgeHandoffResolution = z.infer<typeof PathKnowledgeHandoffResolutionSchema>;

export const ActorContextSchema = z
  .object({
    tenantId: UuidSchema,
    principalId: UuidSchema,
    traceId: TraceIdSchema,
  })
  .strict();
export type ActorContext = z.infer<typeof ActorContextSchema>;

export const SourceAttributionSchema = z.discriminatedUnion("origin", [
  z
    .object({
      origin: z.literal("zhihu"),
      evidenceIds: z.array(UuidSchema).min(1),
    })
    .strict(),
  z
    .object({
      origin: z.literal("mixed"),
      evidenceIds: z.array(UuidSchema).min(1),
      modelNote: z.string().trim().min(1).max(2_000),
    })
    .strict(),
  z
    .object({
      origin: z.literal("modelSupplement"),
      evidenceIds: z.array(UuidSchema).length(0),
      modelNote: z.string().trim().min(1).max(2_000),
    })
    .strict(),
]);
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

export const GenerationRunMetadataSchema = z
  .object({
    generationMode: z.enum(["primary", "regenerated"]),
    degradationReasons: z.array(DegradationReasonSchema).max(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    const reasons = new Set(value.degradationReasons);
    if (reasons.size !== value.degradationReasons.length) {
      ctx.addIssue({ code: "custom", message: "degradation reasons must be unique" });
    }
    const rejectionCount =
      Number(reasons.has("primarySchemaInvalid")) + Number(reasons.has("primaryQualityRejected"));
    if (value.generationMode === "primary" && rejectionCount !== 0) {
      ctx.addIssue({ code: "custom", message: "primary output cannot claim a rejected primary" });
    }
    if (value.generationMode === "regenerated" && rejectionCount !== 1) {
      ctx.addIssue({ code: "custom", message: "regenerated output needs exactly one primary rejection reason" });
    }
    if (reasons.has("noZhihuEvidence") && reasons.has("partialZhihuEvidence")) {
      ctx.addIssue({ code: "custom", message: "no and partial Zhihu evidence are mutually exclusive" });
    }
  });
export type GenerationRunMetadata = z.infer<typeof GenerationRunMetadataSchema>;

const NonnegativeIntSchema = z.number().int().nonnegative();
const SemanticKeySchema = z.string().regex(/^[a-z][a-zA-Z0-9._-]{0,127}$/);
const uniqueUuidArray = (max: number) =>
  z.array(UuidSchema).max(max).refine((ids) => new Set(ids).size === ids.length, "IDs must be unique");

export const GoalRevisionSchema = z
  .object({
    revision: NonnegativeIntSchema,
    originalGoal: GoalTextSchema,
    effectiveGoal: EffectiveGoalTextSchema,
    contextText: ContextTextSchema.optional(),
    goalIsClear: z.boolean(),
    requiresGlobalSequence: z.boolean(),
    boundaryNotes: z.array(VendorSummarySchema).max(16),
  })
  .strict();
export type GoalRevision = z.infer<typeof GoalRevisionSchema>;

export const CarrierCandidateSchema = z
  .object({
    id: UuidSchema,
    semanticKey: SemanticKeySchema,
    kind: z.enum(["course", "book", "articleSeries", "documentation", "project", "practiceSet", "topic"]),
    title: VendorShortTextSchema,
    summary: VendorSummarySchema,
    defaultIncluded: z.boolean(),
    facets: z.array(CoverageFacetSchema).min(1).max(CoverageFacetSchema.options.length),
    source: SourceAttributionSchema,
    disputeIds: uniqueUuidArray(256),
  })
  .strict();
export type CarrierCandidate = z.infer<typeof CarrierCandidateSchema>;

export const ConceptCandidateSchema = z
  .object({
    id: UuidSchema,
    semanticKey: SemanticKeySchema,
    carrierId: UuidSchema,
    title: VendorShortTextSchema,
    summary: VendorSummarySchema,
    orderHint: z.number().int().positive().max(32),
    defaultIncluded: z.boolean(),
    facets: z.array(CoverageFacetSchema).min(1).max(CoverageFacetSchema.options.length),
    source: SourceAttributionSchema,
    disputeIds: uniqueUuidArray(256),
  })
  .strict();
export type ConceptCandidate = z.infer<typeof ConceptCandidateSchema>;

export const CarrierEdgeSchema = z
  .object({
    id: UuidSchema,
    fromCarrierId: UuidSchema,
    toCarrierId: UuidSchema,
    splitGroupId: UuidSchema.optional(),
    joinGroupId: UuidSchema.optional(),
  })
  .strict();
export type CarrierEdge = z.infer<typeof CarrierEdgeSchema>;

export const CarrierFlowGroupSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: UuidSchema,
      type: z.literal("split"),
      anchorCarrierId: UuidSchema,
      policy: z.literal("parallel"),
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      type: z.literal("join"),
      anchorCarrierId: UuidSchema,
      policy: z.literal("allRequired"),
    })
    .strict(),
]);
export type CarrierFlowGroup = z.infer<typeof CarrierFlowGroupSchema>;

export const CarrierFlowGroupListSchema = z.array(CarrierFlowGroupSchema).max(256);
export type CarrierFlowGroupList = z.infer<typeof CarrierFlowGroupListSchema>;

export const DisputeSchema = z
  .object({
    id: UuidSchema,
    scope: z.enum(["carrier", "concept"]),
    candidateIds: uniqueUuidArray(1_024).refine((ids) => ids.length > 0),
    dimension: DecisionDimensionSchema,
    plainSummary: VendorSummarySchema,
    underlyingGoalDifference: VendorSummarySchema,
    source: SourceAttributionSchema,
  })
  .strict();
export type Dispute = z.infer<typeof DisputeSchema>;

export const ChoiceEffectSchema = z
  .object({
    includeCarrierIds: uniqueUuidArray(64),
    excludeCarrierIds: uniqueUuidArray(64),
    includeConceptIds: uniqueUuidArray(1_024),
    excludeConceptIds: uniqueUuidArray(1_024),
  })
  .strict();
export type ChoiceEffect = z.infer<typeof ChoiceEffectSchema>;

export const ChoiceOptionSchema = z
  .object({
    id: UuidSchema,
    label: VendorShortTextSchema,
    description: VendorSummarySchema,
    effect: ChoiceEffectSchema,
  })
  .strict();
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

export const VisibilityConditionSchema = z
  .object({
    questionId: UuidSchema,
    optionIds: uniqueUuidArray(4).refine((ids) => ids.length > 0),
  })
  .strict();
export type VisibilityCondition = z.infer<typeof VisibilityConditionSchema>;

export const ChoiceQuestionSchema = z
  .object({
    id: UuidSchema,
    order: z.number().int().min(1).max(3),
    prompt: VendorSummarySchema,
    reason: VendorSummarySchema,
    disputeIds: uniqueUuidArray(256).refine((ids) => ids.length > 0),
    options: z.array(ChoiceOptionSchema).min(2).max(4),
    visibleWhen: z.array(VisibilityConditionSchema).max(2),
  })
  .strict();
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>;

const issue = (
  path: Array<string | number>,
  code: ContractIssue["code"],
  message: string,
): ContractIssue => ({ path, code, message });

const uniqueIds = (
  ids: readonly string[],
  path: Array<string | number>,
  label: string,
): ContractIssue[] => {
  const seen = new Set<string>();
  const issues: ContractIssue[] = [];
  for (const [index, id] of ids.entries()) {
    if (seen.has(id)) {
      issues.push(issue([...path, index], "duplicate", `${label} ${id} is duplicated`));
    }
    seen.add(id);
  }
  return issues;
};

const hasReservedPrefix = hasReservedPresentationPrefix;

const topologicalOrder = (
  carriers: readonly { id: string }[],
  edges: readonly { fromCarrierId: string; toCarrierId: string }[],
): string[] | null => {
  const ids = carriers.map((carrier) => carrier.id);
  const idSet = new Set(ids);
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (!idSet.has(edge.fromCarrierId) || !idSet.has(edge.toCarrierId)) continue;
    outgoing.get(edge.fromCarrierId)?.push(edge.toCarrierId);
    incoming.set(edge.toCarrierId, (incoming.get(edge.toCarrierId) ?? 0) + 1);
  }
  const ready = ids.filter((id) => incoming.get(id) === 0).sort((left, right) => left.localeCompare(right));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const nextIncoming = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, nextIncoming);
      if (nextIncoming === 0) {
        ready.push(next);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }
  return ordered.length === ids.length ? ordered : null;
};

const reachableFrom = (
  starts: readonly string[],
  edges: readonly { fromCarrierId: string; toCarrierId: string }[],
): Set<string> => {
  const seen = new Set<string>(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of edges) {
      if (edge.fromCarrierId === current && !seen.has(edge.toCarrierId)) {
        seen.add(edge.toCarrierId);
        queue.push(edge.toCarrierId);
      }
    }
  }
  return seen;
};

export function validateCarrierTopology(
  carriers: readonly z.input<typeof CarrierCandidateSchema>[],
  edges: readonly z.input<typeof CarrierEdgeSchema>[],
  groups: readonly z.input<typeof CarrierFlowGroupSchema>[],
  mode: "candidate" | "final",
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const carrierIds = carriers.map((carrier) => String(carrier.id).toLowerCase());
  issues.push(...uniqueIds(carrierIds, ["carriers"], "carrier"));
  issues.push(...uniqueIds(edges.map((edge) => String(edge.id).toLowerCase()), ["edges"], "edge"));
  issues.push(...uniqueIds(groups.map((group) => String(group.id).toLowerCase()), ["flowGroups"], "flow group"));
  const carrierSet = new Set(carrierIds);
  for (const [index, carrier] of carriers.entries()) {
    if (hasReservedPrefix(String(carrier.id))) {
      issues.push(issue(["carriers", index, "id"], "invalid_reference", "carrier id uses a reserved presentation prefix"));
    }
  }
  for (const [index, edge] of edges.entries()) {
    const from = String(edge.fromCarrierId).toLowerCase();
    const to = String(edge.toCarrierId).toLowerCase();
    if (from === to) {
      issues.push(issue(["edges", index], "invalid_graph", "self-loop is not allowed"));
    }
    if (!carrierSet.has(from)) {
      issues.push(issue(["edges", index, "fromCarrierId"], "invalid_reference", `unknown from carrier ${from}`));
    }
    if (!carrierSet.has(to)) {
      issues.push(issue(["edges", index, "toCarrierId"], "invalid_reference", `unknown to carrier ${to}`));
    }
  }
  const order = topologicalOrder(
    carrierIds.map((id) => ({ id })),
    edges.map((edge) => ({
      fromCarrierId: String(edge.fromCarrierId).toLowerCase(),
      toCarrierId: String(edge.toCarrierId).toLowerCase(),
    })),
  );
  if (order === null) {
    issues.push(issue(["edges"], "invalid_graph", "carrier graph contains a cycle"));
  }
  const incoming = new Map<string, number>(carrierIds.map((id) => [id, 0]));
  const outgoing = new Map<string, number>(carrierIds.map((id) => [id, 0]));
  for (const edge of edges) {
    const from = String(edge.fromCarrierId).toLowerCase();
    const to = String(edge.toCarrierId).toLowerCase();
    if (!carrierSet.has(from) || !carrierSet.has(to)) continue;
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1);
  }
  const entries = carrierIds.filter((id) => incoming.get(id) === 0);
  if (mode === "candidate" && entries.length < 1) {
    issues.push(issue(["carriers"], "invalid_graph", "candidate graph needs at least one entry"));
  }
  if (mode === "final" && entries.length !== 1) {
    issues.push(issue(["carriers"], "invalid_graph", "final path must have exactly one entry"));
  }
  const reachable = reachableFrom(
    entries,
    edges.map((edge) => ({
      fromCarrierId: String(edge.fromCarrierId).toLowerCase(),
      toCarrierId: String(edge.toCarrierId).toLowerCase(),
    })),
  );
  for (const id of carrierIds) {
    if (!reachable.has(id)) {
      issues.push(issue(["carriers"], "invalid_graph", `carrier ${id} is not reachable from an entry`));
    }
  }
  const groupById = new Map(groups.map((group) => [String(group.id).toLowerCase(), group]));
  const splitAnchors = new Map<string, string>();
  const joinAnchors = new Map<string, string>();
  for (const [index, group] of groups.entries()) {
    const groupId = String(group.id).toLowerCase();
    const anchor = String(group.anchorCarrierId).toLowerCase();
    if (!carrierSet.has(anchor)) {
      issues.push(issue(["flowGroups", index, "anchorCarrierId"], "invalid_reference", `unknown anchor ${anchor}`));
    }
    if (group.type === "split") {
      if (group.policy !== "parallel") {
        issues.push(issue(["flowGroups", index, "policy"], "invalid_graph", "split policy must be parallel"));
      }
      if (splitAnchors.has(anchor)) {
        issues.push(issue(["flowGroups", index], "invalid_graph", `anchor ${anchor} already has a split group`));
      }
      splitAnchors.set(anchor, groupId);
      const members = edges.filter((edge) => String(edge.splitGroupId ?? "").toLowerCase() === groupId);
      if (members.length < 2) {
        issues.push(issue(["flowGroups", index], "invalid_graph", "split group needs at least two edges"));
      }
      for (const edge of members) {
        if (String(edge.fromCarrierId).toLowerCase() !== anchor) {
          issues.push(issue(["flowGroups", index], "invalid_graph", "split edges must leave the anchor"));
        }
      }
    } else {
      if (group.policy !== "allRequired") {
        issues.push(issue(["flowGroups", index, "policy"], "invalid_graph", "join policy must be allRequired"));
      }
      if (joinAnchors.has(anchor)) {
        issues.push(issue(["flowGroups", index], "invalid_graph", `anchor ${anchor} already has a join group`));
      }
      joinAnchors.set(anchor, groupId);
      const members = edges.filter((edge) => String(edge.joinGroupId ?? "").toLowerCase() === groupId);
      if (members.length < 2) {
        issues.push(issue(["flowGroups", index], "invalid_graph", "join group needs at least two edges"));
      }
      for (const edge of members) {
        if (String(edge.toCarrierId).toLowerCase() !== anchor) {
          issues.push(issue(["flowGroups", index], "invalid_graph", "join edges must enter the anchor"));
        }
      }
    }
  }
  for (const [index, edge] of edges.entries()) {
    if (edge.splitGroupId !== undefined && !groupById.has(String(edge.splitGroupId).toLowerCase())) {
      issues.push(issue(["edges", index, "splitGroupId"], "invalid_reference", "unknown split group"));
    }
    if (edge.joinGroupId !== undefined && !groupById.has(String(edge.joinGroupId).toLowerCase())) {
      issues.push(issue(["edges", index, "joinGroupId"], "invalid_reference", "unknown join group"));
    }
  }
  return issues;
}

type PruneAnswer = { questionId: string; optionId: string };

export type PrunedGraph = {
  carriers: CarrierCandidate[];
  concepts: ConceptCandidate[];
  edges: CarrierEdge[];
  flowGroups: CarrierFlowGroup[];
  disputes: Dispute[];
  executionSequence?: Array<{ index: number; carrierId: string; conceptId: string }>;
};

const omitUndefined = <T extends Record<string, unknown>>(value: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = item;
  }
  return result as T;
};

export function pruneCandidateSet(
  candidateSet: {
    carriers: CarrierCandidate[];
    concepts: ConceptCandidate[];
    edges: CarrierEdge[];
    flowGroups: CarrierFlowGroup[];
    disputes: Dispute[];
    questions: ChoiceQuestion[];
    goal: Pick<GoalRevision, "requiresGlobalSequence">;
  },
  answers: readonly PruneAnswer[],
): { ok: true; value: PrunedGraph } | { ok: false; issues: ContractIssue[] } {
  const issues: ContractIssue[] = [];
  const carrierIds = new Set(candidateSet.carriers.map((carrier) => carrier.id));
  const conceptIds = new Set(candidateSet.concepts.map((concept) => concept.id));
  const includedCarriers = new Set(
    candidateSet.carriers.filter((carrier) => carrier.defaultIncluded).map((carrier) => carrier.id),
  );
  const includedConcepts = new Set(
    candidateSet.concepts.filter((concept) => concept.defaultIncluded).map((concept) => concept.id),
  );
  const includeCarrier = new Set<string>();
  const excludeCarrier = new Set<string>();
  const includeConcept = new Set<string>();
  const excludeConcept = new Set<string>();
  const questionById = new Map(candidateSet.questions.map((question) => [question.id, question]));
  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    const option = question?.options.find((item) => item.id === answer.optionId);
    if (question === undefined || option === undefined) {
      issues.push(issue(["answers"], "invalid_reference", "answer references an unknown question or option"));
      continue;
    }
    for (const id of option.effect.includeCarrierIds) includeCarrier.add(id);
    for (const id of option.effect.excludeCarrierIds) excludeCarrier.add(id);
    for (const id of option.effect.includeConceptIds) includeConcept.add(id);
    for (const id of option.effect.excludeConceptIds) excludeConcept.add(id);
  }
  for (const id of includeCarrier) {
    if (excludeCarrier.has(id)) {
      issues.push(issue(["choiceEffect"], "invalid_state", `carrier ${id} is both included and excluded`));
    }
    if (!carrierIds.has(id)) {
      issues.push(issue(["choiceEffect"], "invalid_reference", `include carrier ${id} does not exist`));
    }
    includedCarriers.add(id);
  }
  for (const id of excludeCarrier) includedCarriers.delete(id);
  for (const id of includeConcept) {
    if (excludeConcept.has(id)) {
      issues.push(issue(["choiceEffect"], "invalid_state", `concept ${id} is both included and excluded`));
    }
    if (!conceptIds.has(id)) {
      issues.push(issue(["choiceEffect"], "invalid_reference", `include concept ${id} does not exist`));
    }
    includedConcepts.add(id);
  }
  for (const id of excludeConcept) includedConcepts.delete(id);
  for (const concept of candidateSet.concepts) {
    if (!includedCarriers.has(concept.carrierId)) includedConcepts.delete(concept.id);
  }
  if (issues.length > 0) return { ok: false, issues };

  const carriers = candidateSet.carriers.filter((carrier) => includedCarriers.has(carrier.id));
  const concepts = candidateSet.concepts.filter((concept) => includedConcepts.has(concept.id));
  const remainingCarrierIds = new Set(carriers.map((carrier) => carrier.id));
  for (const carrier of carriers) {
    const originalPreds = candidateSet.edges
      .filter((edge) => edge.toCarrierId === carrier.id)
      .map((edge) => edge.fromCarrierId);
    for (const pred of originalPreds) {
      if (carrierIds.has(pred) && !remainingCarrierIds.has(pred)) {
        issues.push(issue(["edges"], "invalid_graph", `downstream ${carrier.id} kept after dropping predecessor ${pred}`));
      }
    }
  }
  let edges = candidateSet.edges.filter(
    (edge) => remainingCarrierIds.has(edge.fromCarrierId) && remainingCarrierIds.has(edge.toCarrierId),
  );
  const remainingGroupIds = new Set<string>();
  const flowGroups: CarrierFlowGroup[] = [];
  for (const group of candidateSet.flowGroups) {
    const related = edges.filter((edge) =>
      group.type === "split" ? edge.splitGroupId === group.id : edge.joinGroupId === group.id,
    );
    if (related.length <= 1) {
      edges = edges.map((edge) => {
        if (group.type === "split" && edge.splitGroupId === group.id) {
          return omitUndefined({ ...edge, splitGroupId: undefined });
        }
        if (group.type === "join" && edge.joinGroupId === group.id) {
          return omitUndefined({ ...edge, joinGroupId: undefined });
        }
        return edge;
      });
      continue;
    }
    remainingGroupIds.add(group.id);
    flowGroups.push(group);
  }
  const keptConceptIds = new Set(concepts.map((concept) => concept.id));
  const disputes = candidateSet.disputes
    .map((dispute) => ({
      ...dispute,
      candidateIds: dispute.candidateIds.filter((id) =>
        dispute.scope === "carrier" ? remainingCarrierIds.has(id) : keptConceptIds.has(id),
      ),
    }))
    .filter((dispute) => dispute.candidateIds.length > 0);
  const disputeIds = new Set(disputes.map((dispute) => dispute.id));
  const carriersClosed = carriers.map((carrier) => ({
    ...carrier,
    disputeIds: carrier.disputeIds.filter((id) => disputeIds.has(id)),
  }));
  const conceptsClosed = [...concepts]
    .sort((left, right) => {
      if (left.carrierId !== right.carrierId) return left.carrierId.localeCompare(right.carrierId);
      return left.orderHint - right.orderHint;
    })
    .reduce<ConceptCandidate[]>((acc, concept) => {
      const count = acc.filter((item) => item.carrierId === concept.carrierId).length;
      acc.push({
        ...concept,
        orderHint: count + 1,
        disputeIds: concept.disputeIds.filter((id) => disputeIds.has(id)),
      });
      return acc;
    }, []);
  if (carriersClosed.length === 0 || conceptsClosed.length === 0) {
    issues.push(issue([], "invalid_graph", "pruned graph is empty"));
  }
  issues.push(...validateCarrierTopology(carriersClosed, edges, flowGroups, "final"));
  const conceptsByCarrier = new Map<string, ConceptCandidate[]>();
  for (const concept of conceptsClosed) {
    const list = conceptsByCarrier.get(concept.carrierId) ?? [];
    list.push(concept);
    conceptsByCarrier.set(concept.carrierId, list);
  }
  for (const carrier of carriersClosed) {
    const owned = conceptsByCarrier.get(carrier.id) ?? [];
    if (owned.length === 0) {
      issues.push(issue(["concepts"], "invalid_state", `carrier ${carrier.id} has no remaining concepts`));
    }
  }
  if (carriersClosed.length + 1 > 128) {
    issues.push(issue(["carriers"], "limit", "carrier plus terminal goal capacity exceeded"));
  }
  if (edges.length + 1 > 2048) {
    issues.push(issue(["edges"], "limit", "edge plus terminal flow capacity exceeded"));
  }
  let executionSequence: PrunedGraph["executionSequence"];
  if (candidateSet.goal.requiresGlobalSequence) {
    const order = topologicalOrder(carriersClosed, edges);
    if (order === null) {
      issues.push(issue(["executionSequence"], "invalid_graph", "cannot order carriers for execution sequence"));
    } else {
      const steps: NonNullable<PrunedGraph["executionSequence"]> = [];
      let index = 1;
      for (const carrierId of order) {
        for (const concept of conceptsClosed.filter((item) => item.carrierId === carrierId)) {
          steps.push({ index, carrierId, conceptId: concept.id });
          index += 1;
        }
      }
      executionSequence = steps;
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  const value: PrunedGraph = {
    carriers: carriersClosed,
    concepts: conceptsClosed,
    edges,
    flowGroups,
    disputes,
    ...(executionSequence !== undefined ? { executionSequence } : {}),
  };
  return { ok: true, value };
}

const questionVisible = (
  question: ChoiceQuestion,
  answers: ReadonlyMap<string, string>,
): boolean => {
  if (question.visibleWhen.length === 0) return true;
  return question.visibleWhen.every((condition) => {
    const selected = answers.get(condition.questionId);
    return selected !== undefined && condition.optionIds.includes(selected);
  });
};

const enumerateAnswerCombinations = (
  questions: readonly ChoiceQuestion[],
): Array<Array<{ questionId: string; optionId: string }>> => {
  const ordered = [...questions].sort((left, right) => left.order - right.order);
  const combinations: Array<Array<{ questionId: string; optionId: string }>> = [];
  const walk = (answers: Array<{ questionId: string; optionId: string }>) => {
    const answered = new Map(answers.map((item) => [item.questionId, item.optionId]));
    const next = ordered.find((question) =>
      !answered.has(question.id) && questionVisible(question, answered),
    );
    if (next === undefined) {
      combinations.push(answers);
      return;
    }
    for (const option of next.options) {
      walk([...answers, { questionId: next.id, optionId: option.id }]);
    }
  };
  walk([]);
  return combinations;
};

const retainedIdKey = (graph: PrunedGraph) =>
  [
    ...graph.carriers.map((carrier) => carrier.id).sort(),
    ...graph.concepts.map((concept) => concept.id).sort(),
  ].join(",");

const validateSources = (
  items: readonly { source: SourceAttribution }[],
  path: string,
): ContractIssue[] => {
  const issues: ContractIssue[] = [];
  for (const [index, item] of items.entries()) {
    if (item.source.origin === "modelSupplement" && item.source.evidenceIds.length !== 0) {
      issues.push(issue([path, index, "source"], "invalid_state", "modelSupplement cannot carry evidence"));
    }
    if (item.source.origin !== "modelSupplement" && item.source.evidenceIds.length === 0) {
      issues.push(issue([path, index, "source"], "invalid_reference", "sourced item needs evidence"));
    }
  }
  return issues;
};

const validateLayerContents = (
  layer: {
    generationMode: "primary" | "regenerated";
    degradationReasons: DegradationReason[];
    carriers: CarrierCandidate[];
    concepts: ConceptCandidate[];
    edges: CarrierEdge[];
    flowGroups: CarrierFlowGroup[];
    disputes: Dispute[];
  },
  mode: "candidate" | "final",
): ContractIssue[] => {
  const issues: ContractIssue[] = [];
  issues.push(...uniqueIds(layer.carriers.map((item) => item.id), ["carriers"], "carrier"));
  issues.push(...uniqueIds(layer.concepts.map((item) => item.id), ["concepts"], "concept"));
  issues.push(...uniqueIds(layer.disputes.map((item) => item.id), ["disputes"], "dispute"));
  const carrierIds = new Set(layer.carriers.map((item) => item.id));
  const conceptIds = new Set(layer.concepts.map((item) => item.id));
  for (const id of carrierIds) {
    if (conceptIds.has(id)) {
      issues.push(issue(["concepts"], "duplicate", `id ${id} is used by both a carrier and a concept`));
    }
    if (hasReservedPrefix(id)) {
      issues.push(issue(["carriers"], "invalid_reference", `carrier ${id} uses a reserved prefix`));
    }
  }
  for (const id of conceptIds) {
    if (hasReservedPrefix(id)) {
      issues.push(issue(["concepts"], "invalid_reference", `concept ${id} uses a reserved prefix`));
    }
  }
  const carrierKeys = new Set<string>();
  for (const [index, carrier] of layer.carriers.entries()) {
    if (carrierKeys.has(carrier.semanticKey)) {
      issues.push(issue(["carriers", index, "semanticKey"], "duplicate", "carrier semantic key is duplicated"));
    }
    carrierKeys.add(carrier.semanticKey);
    if (new Set(carrier.facets).size !== carrier.facets.length) {
      issues.push(issue(["carriers", index, "facets"], "duplicate", "facets must be unique"));
    }
  }
  const conceptsByCarrier = new Map<string, ConceptCandidate[]>();
  const conceptKeysByCarrier = new Map<string, Set<string>>();
  for (const [index, concept] of layer.concepts.entries()) {
    if (!carrierIds.has(concept.carrierId)) {
      issues.push(issue(["concepts", index, "carrierId"], "invalid_reference", "concept carrier does not exist"));
    }
    const owned = conceptsByCarrier.get(concept.carrierId) ?? [];
    owned.push(concept);
    conceptsByCarrier.set(concept.carrierId, owned);
    const keys = conceptKeysByCarrier.get(concept.carrierId) ?? new Set<string>();
    if (keys.has(concept.semanticKey)) {
      issues.push(issue(["concepts", index, "semanticKey"], "duplicate", "concept semantic key is duplicated in carrier"));
    }
    keys.add(concept.semanticKey);
    conceptKeysByCarrier.set(concept.carrierId, keys);
    if (new Set(concept.facets).size !== concept.facets.length) {
      issues.push(issue(["concepts", index, "facets"], "duplicate", "facets must be unique"));
    }
  }
  for (const [index, carrier] of layer.carriers.entries()) {
    const owned = conceptsByCarrier.get(carrier.id) ?? [];
    if (owned.length === 0) {
      issues.push(issue(["carriers", index], "invalid_state", "carrier needs at least one concept"));
    }
    const hints = owned.map((item) => item.orderHint).sort((left, right) => left - right);
    const expected = owned.map((_, hintIndex) => hintIndex + 1);
    if (hints.some((hint, hintIndex) => hint !== expected[hintIndex])) {
      issues.push(issue(["concepts"], "invalid_state", `concepts for ${carrier.id} must be ordered 1..N`));
    }
  }
  issues.push(...validateSources(layer.carriers, "carriers"));
  issues.push(...validateSources(layer.concepts, "concepts"));
  issues.push(...validateSources(layer.disputes, "disputes"));
  const disputeIds = new Set(layer.disputes.map((item) => item.id));
  for (const [index, dispute] of layer.disputes.entries()) {
    for (const candidateId of dispute.candidateIds) {
      const known = dispute.scope === "carrier" ? carrierIds.has(candidateId) : conceptIds.has(candidateId);
      if (!known) {
        issues.push(issue(["disputes", index, "candidateIds"], "invalid_reference", "dispute candidate does not exist"));
      }
    }
  }
  for (const [index, carrier] of layer.carriers.entries()) {
    for (const disputeId of carrier.disputeIds) {
      if (!disputeIds.has(disputeId)) {
        issues.push(issue(["carriers", index, "disputeIds"], "invalid_reference", "unknown dispute"));
      }
    }
  }
  for (const [index, concept] of layer.concepts.entries()) {
    for (const disputeId of concept.disputeIds) {
      if (!disputeIds.has(disputeId)) {
        issues.push(issue(["concepts", index, "disputeIds"], "invalid_reference", "unknown dispute"));
      }
    }
  }
  issues.push(...validateCarrierTopology(layer.carriers, layer.edges, layer.flowGroups, mode));
  const metadata = GenerationRunMetadataSchema.safeParse({
    generationMode: layer.generationMode,
    degradationReasons: layer.degradationReasons,
  });
  if (!metadata.success) {
    issues.push(issue(["generationMode"], "invalid_state", "run metadata is inconsistent"));
  }
  if (
    layer.degradationReasons.includes("noZhihuEvidence")
    && [...layer.carriers, ...layer.concepts, ...layer.disputes].some(
      (item) => item.source.origin !== "modelSupplement",
    )
  ) {
    issues.push(issue(["degradationReasons"], "invalid_state", "noZhihuEvidence requires every item to be modelSupplement"));
  }
  return issues;
};

export function validateCandidateSet(value: unknown): ContractIssue[] {
  if (typeof value !== "object" || value === null) {
    return [issue([], "invalid_state", "candidate set must be an object")];
  }
  const candidate = value as CandidateSet;
  const issues = validateLayerContents(candidate, "candidate");
  issues.push(...uniqueIds(candidate.questions.map((item) => item.id), ["questions"], "question"));
  const carrierIds = new Set(candidate.carriers.map((item) => item.id));
  const conceptIds = new Set(candidate.concepts.map((item) => item.id));
  const disputeIds = new Set(candidate.disputes.map((item) => item.id));
  const questionCount = candidate.questions.length;
  if (!(questionCount === 0 || (questionCount >= 2 && questionCount <= 3))) {
    issues.push(issue(["questions"], "invalid_state", "question count must be 0 or 2-3"));
  }
  if (candidate.goal.goalIsClear !== (questionCount === 0)) {
    issues.push(issue(["goal", "goalIsClear"], "invalid_state", "goalIsClear must match question count"));
  }
  const orders = candidate.questions.map((question) => question.order).sort((left, right) => left - right);
  if (orders.some((order, index) => order !== index + 1)) {
    issues.push(issue(["questions"], "invalid_state", "question order must be 1..N"));
  }
  const questionById = new Map(candidate.questions.map((question) => [question.id, question]));
  for (const [index, question] of candidate.questions.entries()) {
    issues.push(...uniqueIds(question.options.map((option) => option.id), ["questions", index, "options"], "option"));
    for (const disputeId of question.disputeIds) {
      if (!disputeIds.has(disputeId)) {
        issues.push(issue(["questions", index, "disputeIds"], "invalid_reference", "unknown dispute"));
      }
    }
    for (const [condIndex, condition] of question.visibleWhen.entries()) {
      const referenced = questionById.get(condition.questionId);
      if (referenced === undefined || referenced.order >= question.order) {
        issues.push(issue(["questions", index, "visibleWhen", condIndex], "invalid_reference", "visibleWhen must reference an earlier question"));
        continue;
      }
      const optionIds = new Set(referenced.options.map((option) => option.id));
      for (const optionId of condition.optionIds) {
        if (!optionIds.has(optionId)) {
          issues.push(issue(["questions", index, "visibleWhen", condIndex], "invalid_reference", "visibleWhen option does not exist"));
        }
      }
    }
    const emptyEffect = question.options.every((option) =>
      option.effect.includeCarrierIds.length
        + option.effect.excludeCarrierIds.length
        + option.effect.includeConceptIds.length
        + option.effect.excludeConceptIds.length === 0,
    );
    if (emptyEffect) {
      issues.push(issue(["questions", index], "invalid_state", "question does not change any candidate"));
    }
  }
  const combinations = enumerateAnswerCombinations(candidate.questions);
  if (combinations.length > 64) {
    issues.push(issue(["questions"], "limit", "reachable answer combinations exceed 64"));
  }
  for (const combination of combinations) {
    if (questionCount === 0 && combination.length !== 0) {
      issues.push(issue(["questions"], "invalid_state", "clear goals cannot require answers"));
    }
    if (questionCount > 0 && (combination.length < 2 || combination.length > 3)) {
      issues.push(issue(["questions"], "invalid_state", "every reachable branch must answer 2-3 questions"));
    }
    const pruned = pruneCandidateSet(candidate, combination);
    if (!pruned.ok) {
      issues.push(...pruned.issues.map((item) => ({
        ...item,
        message: `answer combination failed: ${item.message}`,
      })));
    }
  }
  for (const question of candidate.questions) {
    const prefixes = combinations.filter((combination) =>
      combination.some((answer) => answer.questionId === question.id),
    );
    const grouped = new Map<string, string[]>();
    for (const combination of prefixes) {
      const prefix = combination
        .filter((answer) => answer.questionId !== question.id)
        .map((answer) => `${answer.questionId}:${answer.optionId}`)
        .join("|");
      const selected = combination.find((answer) => answer.questionId === question.id);
      if (selected === undefined) continue;
      const keys = grouped.get(prefix) ?? [];
      const pruned = pruneCandidateSet(candidate, combination);
      keys.push(`${selected.optionId}:${pruned.ok ? retainedIdKey(pruned.value) : "invalid"}`);
      grouped.set(prefix, keys);
    }
    for (const keys of grouped.values()) {
      const retained = keys.map((key) => key.slice(key.indexOf(":") + 1));
      if (new Set(retained).size !== retained.length && retained.length > 1) {
        const uniqueOptions = new Set(keys.map((key) => key.slice(0, key.indexOf(":"))));
        if (uniqueOptions.size > 1 && new Set(retained).size < uniqueOptions.size) {
          issues.push(issue(["questions"], "invalid_state", `options of ${question.id} do not produce distinct retained sets`));
        }
      }
    }
  }
  return issues;
}

const sourceSummaryFrom = (
  carriers: readonly CarrierCandidate[],
  concepts: readonly ConceptCandidate[],
  disputes: readonly Dispute[],
) => {
  const origins = [...carriers, ...concepts, ...disputes].map((item) => item.source.origin);
  return {
    zhihuCount: origins.filter((origin) => origin === "zhihu").length,
    mixedCount: origins.filter((origin) => origin === "mixed").length,
    modelSupplementCount: origins.filter((origin) => origin === "modelSupplement").length,
  };
};

const referencedEvidenceIds = (
  carriers: readonly CarrierCandidate[],
  concepts: readonly ConceptCandidate[],
  disputes: readonly Dispute[],
) => {
  const ids = new Set<string>();
  for (const item of [...carriers, ...concepts, ...disputes]) {
    for (const evidenceId of item.source.evidenceIds) ids.add(evidenceId);
  }
  return ids;
};

export function validateFinalLearningPath(value: unknown): ContractIssue[] {
  if (typeof value !== "object" || value === null) {
    return [issue([], "invalid_state", "final path must be an object")];
  }
  const path = value as FinalLearningPath;
  const issues = validateLayerContents(path, "final");
  const expectedSummary = sourceSummaryFrom(path.carriers, path.concepts, path.disputes);
  if (
    path.sourceSummary.zhihuCount !== expectedSummary.zhihuCount
    || path.sourceSummary.mixedCount !== expectedSummary.mixedCount
    || path.sourceSummary.modelSupplementCount !== expectedSummary.modelSupplementCount
  ) {
    issues.push(issue(["sourceSummary"], "invalid_state", "sourceSummary does not match item origins"));
  }
  const referenced = referencedEvidenceIds(path.carriers, path.concepts, path.disputes);
  const catalogIds = new Set(path.evidenceCatalog.map((item) => item.id));
  issues.push(...uniqueIds([...catalogIds], ["evidenceCatalog"], "evidence"));
  for (const id of referenced) {
    if (!catalogIds.has(id)) {
      issues.push(issue(["evidenceCatalog"], "invalid_reference", `referenced evidence ${id} is missing`));
    }
  }
  for (const record of path.evidenceCatalog) {
    if (!referenced.has(record.id)) {
      issues.push(issue(["evidenceCatalog"], "invalid_state", `catalog record ${record.id} is unused`));
    }
    const url = RendererEvidenceUrlSchema.safeParse(record.sourceUrl);
    if (!url.success) {
      issues.push(issue(["evidenceCatalog"], "invalid_reference", `evidence ${record.id} URL is not renderer-safe`));
    }
  }
  if (path.goal.requiresGlobalSequence) {
    if (path.executionSequence === undefined) {
      issues.push(issue(["executionSequence"], "invalid_state", "global sequence is required"));
    } else {
      const expected = new Set(path.concepts.map((concept) => concept.id));
      const seen = new Set<string>();
      const byCarrier = new Map<string, number>();
      for (const [index, step] of path.executionSequence.entries()) {
        if (step.index !== index + 1) {
          issues.push(issue(["executionSequence", index, "index"], "invalid_state", "execution index must be 1..N"));
        }
        if (seen.has(step.conceptId) || !expected.has(step.conceptId)) {
          issues.push(issue(["executionSequence", index], "invalid_state", "execution sequence must contain each concept once"));
        }
        seen.add(step.conceptId);
        const concept = path.concepts.find((item) => item.id === step.conceptId);
        if (concept === undefined || concept.carrierId !== step.carrierId) {
          issues.push(issue(["executionSequence", index], "invalid_reference", "execution step carrier/concept mismatch"));
          continue;
        }
        const previous = byCarrier.get(step.carrierId);
        if (previous !== undefined && concept.orderHint <= previous) {
          issues.push(issue(["executionSequence", index], "invalid_state", "execution sequence breaks in-carrier order"));
        }
        byCarrier.set(step.carrierId, concept.orderHint);
      }
      if (seen.size !== expected.size) {
        issues.push(issue(["executionSequence"], "invalid_state", "execution sequence is missing concepts"));
      }
      const position = new Map(path.executionSequence.map((step, index) => [step.conceptId, index]));
      for (const edge of path.edges) {
        const fromConcepts = path.concepts.filter((concept) => concept.carrierId === edge.fromCarrierId);
        const toConcepts = path.concepts.filter((concept) => concept.carrierId === edge.toCarrierId);
        const fromMax = Math.max(...fromConcepts.map((concept) => position.get(concept.id) ?? -1));
        const toMin = Math.min(...toConcepts.map((concept) => position.get(concept.id) ?? Number.MAX_SAFE_INTEGER));
        if (fromMax >= toMin) {
          issues.push(issue(["executionSequence"], "invalid_graph", "execution sequence violates carrier edge order"));
        }
      }
    }
  } else if (path.executionSequence !== undefined) {
    issues.push(issue(["executionSequence"], "invalid_state", "execution sequence is only allowed when requested"));
  }
  if (path.carriers.length + 1 > 128) {
    issues.push(issue(["carriers"], "limit", "carrier plus terminal goal capacity exceeded"));
  }
  if (path.edges.length + 1 > 2048) {
    issues.push(issue(["edges"], "limit", "edge plus terminal flow capacity exceeded"));
  }
  return issues;
}

const searchLedgerBase = {
  queryId: SearchQueryIdSchema,
  queryHash: z.string().regex(/^[a-f0-9]{64}$/),
  window: z.enum(["recentYear", "expandedToThreeYears"]),
};

export const SearchLedgerEntrySchema = z.union([
  z
    .object({
      ...searchLedgerBase,
      origin: z.literal("fetched"),
      status: z.literal("success"),
      evidenceIds: z.array(UuidSchema),
    })
    .strict(),
  z
    .object({
      ...searchLedgerBase,
      origin: z.literal("fetched"),
      status: z.literal("failed"),
      evidenceIds: z.array(UuidSchema).length(0),
      errorCode: z.enum(["timeout", "rateLimited", "invalidJson", "unavailable"]),
    })
    .strict(),
]);
export type SearchLedgerEntry = z.infer<typeof SearchLedgerEntrySchema>;

export const ChoiceAnswerSchema = z
  .object({
    questionId: UuidSchema,
    optionId: UuidSchema,
    revision: NonnegativeIntSchema,
    status: z.enum(["active", "superseded"]),
  })
  .strict();
export type ChoiceAnswer = z.infer<typeof ChoiceAnswerSchema>;

export const SupersededChoiceQuestionSchema = z
  .object({
    id: UuidSchema,
    order: z.number().int().min(1).max(3),
    prompt: VendorSummarySchema,
    reason: VendorSummarySchema,
    options: z.array(ChoiceOptionSchema.pick({ id: true, label: true, description: true })).min(2).max(4),
  })
  .strict();
export type SupersededChoiceQuestion = z.infer<typeof SupersededChoiceQuestionSchema>;

export const SupersededChoiceSetSchema = z
  .object({
    goal: GoalRevisionSchema,
    questions: z.array(SupersededChoiceQuestionSchema).min(2).max(3),
    choiceAnswers: z.array(ChoiceAnswerSchema),
    supersededAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type SupersededChoiceSet = z.infer<typeof SupersededChoiceSetSchema>;

export const ExecutionStepSchema = z
  .object({
    index: z.number().int().positive(),
    carrierId: UuidSchema,
    conceptId: UuidSchema,
  })
  .strict();
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;

export const SourceSummarySchema = z
  .object({
    zhihuCount: NonnegativeIntSchema,
    mixedCount: NonnegativeIntSchema,
    modelSupplementCount: NonnegativeIntSchema,
  })
  .strict();
export type SourceSummary = z.infer<typeof SourceSummarySchema>;

function appendIssues(ctx: z.RefinementCtx, issues: readonly ContractIssue[]): void {
  for (const item of issues) {
    ctx.addIssue({ code: "custom", path: item.path, message: `${item.code}: ${item.message}` });
  }
}

export const CandidateSetSchema = z
  .object({
    goal: GoalRevisionSchema,
    generationMode: z.enum(["primary", "regenerated"]),
    degradationReasons: z.array(DegradationReasonSchema).max(4),
    carriers: z.array(CarrierCandidateSchema).min(1).max(64),
    concepts: z.array(ConceptCandidateSchema).min(1).max(1_024),
    edges: z.array(CarrierEdgeSchema).max(1_024),
    flowGroups: CarrierFlowGroupListSchema,
    disputes: z.array(DisputeSchema).max(256),
    questions: z.array(ChoiceQuestionSchema).max(3),
  })
  .strict()
  .superRefine((value, ctx) => appendIssues(ctx, validateCandidateSet(value)));
export type CandidateSet = z.infer<typeof CandidateSetSchema>;

export const FinalLearningPathSchema = z
  .object({
    id: UuidSchema,
    planInstanceId: UuidSchema,
    revision: NonnegativeIntSchema,
    title: VendorShortTextSchema,
    description: VendorSummarySchema,
    goal: GoalRevisionSchema,
    generationMode: z.enum(["primary", "regenerated"]),
    degradationReasons: z.array(DegradationReasonSchema).max(4),
    carriers: z.array(CarrierCandidateSchema).min(1).max(64),
    concepts: z.array(ConceptCandidateSchema).min(1).max(1_024),
    edges: z.array(CarrierEdgeSchema).max(1_024),
    flowGroups: CarrierFlowGroupListSchema,
    disputes: z.array(DisputeSchema).max(256),
    executionSequence: z.array(ExecutionStepSchema).max(1_024).optional(),
    evidenceCatalog: z.array(EvidenceRecordSchema).max(1_024),
    sourceSummary: SourceSummarySchema,
  })
  .strict()
  .superRefine((value, ctx) => appendIssues(ctx, validateFinalLearningPath(value)));
export type FinalLearningPath = z.infer<typeof FinalLearningPathSchema>;

const sessionBase = {
  id: UuidSchema,
  tenantId: UuidSchema,
  principalId: UuidSchema,
  revision: NonnegativeIntSchema,
  candidateSet: CandidateSetSchema,
  evidenceCatalog: z.array(EvidenceRecordSchema).max(1_024),
  searchLedger: z.array(SearchLedgerEntrySchema).max(SearchQueryIdSchema.options.length * 2),
  choiceAnswers: z.array(ChoiceAnswerSchema).max(64),
  supersededChoiceSets: z.array(SupersededChoiceSetSchema).max(32),
};

export function validatePathGenerationSession(value: unknown): ContractIssue[] {
  if (typeof value !== "object" || value === null) {
    return [issue([], "invalid_state", "session must be an object")];
  }
  const session = value as PathGenerationSession;
  const issues: ContractIssue[] = [];
  const questionById = new Map(session.candidateSet.questions.map((question) => [question.id, question]));
  const catalogIds = new Set(session.evidenceCatalog.map((item) => item.id));
  issues.push(...uniqueIds(session.evidenceCatalog.map((item) => item.id), ["evidenceCatalog"], "evidence"));
  const ledgerKeys = new Set<string>();
  const successfulEvidence = new Set<string>();
  for (const [index, entry] of session.searchLedger.entries()) {
    const key = `${entry.queryId}:${entry.window}`;
    if (ledgerKeys.has(key)) {
      issues.push(issue(["searchLedger", index], "duplicate", "each queryId/window can appear once"));
    }
    ledgerKeys.add(key);
    if (entry.status === "failed" && entry.evidenceIds.length > 0) {
      issues.push(issue(["searchLedger", index], "invalid_state", "failed ledger cannot carry evidence"));
    }
    if (entry.status === "success") {
      for (const evidenceId of entry.evidenceIds) {
        if (!catalogIds.has(evidenceId)) {
          issues.push(issue(["searchLedger", index, "evidenceIds"], "invalid_reference", "ledger evidence missing from catalog"));
        }
        successfulEvidence.add(evidenceId);
      }
    }
  }
  for (const item of [...session.candidateSet.carriers, ...session.candidateSet.concepts, ...session.candidateSet.disputes]) {
    for (const evidenceId of item.source.evidenceIds) {
      if (!catalogIds.has(evidenceId) || !successfulEvidence.has(evidenceId)) {
        issues.push(issue(["candidateSet"], "invalid_reference", `evidence ${evidenceId} is not in catalog and successful ledger`));
      }
    }
  }
  for (const record of session.evidenceCatalog) {
    const url = RendererEvidenceUrlSchema.safeParse(record.sourceUrl);
    if (!url.success) {
      issues.push(issue(["evidenceCatalog"], "invalid_reference", "catalog URL is not renderer-safe"));
    }
  }
  const activeAnswers = session.choiceAnswers.filter((answer) => answer.status === "active");
  const activeQuestionIds = new Set<string>();
  for (const [index, answer] of session.choiceAnswers.entries()) {
    const question = questionById.get(answer.questionId);
    if (answer.status === "active") {
      if (question === undefined) {
        issues.push(issue(["choiceAnswers", index], "invalid_reference", "active answer is not in the current question set"));
      } else if (!question.options.some((option) => option.id === answer.optionId)) {
        issues.push(issue(["choiceAnswers", index], "invalid_reference", "active answer option is not on the current question"));
      }
      if (activeQuestionIds.has(answer.questionId)) {
        issues.push(issue(["choiceAnswers", index], "duplicate", "a question can have only one active answer"));
      }
      activeQuestionIds.add(answer.questionId);
    }
  }
  for (const [index, archived] of session.supersededChoiceSets.entries()) {
    const archivedQuestionIds = new Set(archived.questions.map((question) => question.id));
    for (const [answerIndex, answer] of archived.choiceAnswers.entries()) {
      const question = archived.questions.find((item) => item.id === answer.questionId);
      if (question === undefined || !archivedQuestionIds.has(answer.questionId)) {
        issues.push(issue(["supersededChoiceSets", index, "choiceAnswers", answerIndex], "invalid_reference", "archived answer is missing its question"));
      } else if (!question.options.some((option) => option.id === answer.optionId)) {
        issues.push(issue(["supersededChoiceSets", index, "choiceAnswers", answerIndex], "invalid_reference", "archived answer option is missing"));
      }
    }
  }
  if (session.status === "awaitingChoice") {
    if (session.currentQuestionId === null || !questionById.has(session.currentQuestionId)) {
      issues.push(issue(["currentQuestionId"], "invalid_state", "awaitingChoice needs a current question from the candidate set"));
    }
  } else {
    if (session.currentQuestionId !== null) {
      issues.push(issue(["currentQuestionId"], "invalid_state", "ready session cannot have a current question"));
    }
    if (session.publishedPath === null) {
      issues.push(issue(["publishedPath"], "invalid_state", "ready session needs a published path"));
    } else {
      if (session.publishedPath.revision !== session.revision) {
        issues.push(issue(["publishedPath", "revision"], "invalid_state", "published path revision must equal session revision"));
      }
      if (session.publishedPath.goal.revision !== session.candidateSet.goal.revision) {
        issues.push(issue(["publishedPath", "goal", "revision"], "invalid_state", "published path goal revision must equal candidate goal revision"));
      }
    }
  }
  return issues;
}

export const PathGenerationSessionSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        ...sessionBase,
        status: z.literal("awaitingChoice"),
        currentQuestionId: UuidSchema,
        publishedPath: FinalLearningPathSchema.nullable(),
      })
      .strict(),
    z
      .object({
        ...sessionBase,
        status: z.literal("ready"),
        currentQuestionId: z.null(),
        publishedPath: FinalLearningPathSchema,
      })
      .strict(),
  ])
  .superRefine((value, ctx) => appendIssues(ctx, validatePathGenerationSession(value)));
export type PathGenerationSession = z.infer<typeof PathGenerationSessionSchema>;

export const PublishedPathSnapshotSchema = z
  .object({
    tenantId: UuidSchema,
    principalId: UuidSchema,
    planInstanceId: UuidSchema,
    revision: NonnegativeIntSchema,
    path: FinalLearningPathSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.planInstanceId !== value.path.planInstanceId || value.revision !== value.path.revision) {
      ctx.addIssue({ code: "custom", message: "snapshot identity/revision must match path" });
    }
  });
export type PublishedPathSnapshot = z.infer<typeof PublishedPathSnapshotSchema>;

export const PathGenerationStageSchema = z.enum([
  "validate",
  "planSearch",
  "searchRecentYear",
  "searchExpandedWindow",
  "generateCandidates",
  "fallbackGeneration",
  "prune",
  "projectRenderer",
]);
export type PathGenerationStage = z.infer<typeof PathGenerationStageSchema>;

export const PathErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "SESSION_NOT_FOUND",
  "REVISION_CONFLICT",
  "PROVIDER_UNAVAILABLE",
  "GENERATION_INVALID",
  "RENDERER_INVALID",
  "DEADLINE_EXCEEDED",
  "CANCELLED",
  "INTERNAL_ERROR",
]);
export type PathErrorCode = z.infer<typeof PathErrorCodeSchema>;

export const PathStreamFailureCodeSchema = z.enum([
  "REVISION_CONFLICT",
  "PROVIDER_UNAVAILABLE",
  "GENERATION_INVALID",
  "RENDERER_INVALID",
  "DEADLINE_EXCEEDED",
  "INTERNAL_ERROR",
]);
export type PathStreamFailureCode = z.infer<typeof PathStreamFailureCodeSchema>;

export const PathPreStreamErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "SESSION_NOT_FOUND",
  "REVISION_CONFLICT",
  "INTERNAL_ERROR",
]);
export type PathPreStreamErrorCode = z.infer<typeof PathPreStreamErrorCodeSchema>;

export const PATH_ERROR_POLICY = {
  INVALID_REQUEST: { retryable: false, publicMessage: "请求内容不符合路径生成合同。" },
  SESSION_NOT_FOUND: { retryable: false, publicMessage: "路径会话不存在或不可访问。" },
  REVISION_CONFLICT: { retryable: true, publicMessage: "路径状态已更新，请刷新后重试。" },
  PROVIDER_UNAVAILABLE: { retryable: true, publicMessage: "生成服务暂时不可用，请稍后重试。" },
  GENERATION_INVALID: { retryable: true, publicMessage: "本次未能生成合法路径，请重试。" },
  RENDERER_INVALID: { retryable: false, publicMessage: "路径暂时无法安全展示。" },
  DEADLINE_EXCEEDED: { retryable: true, publicMessage: "本次生成超时，请重试。" },
  CANCELLED: { retryable: false, publicMessage: "本次生成已取消。" },
  INTERNAL_ERROR: { retryable: true, publicMessage: "路径生成发生内部错误。" },
} as const satisfies Record<PathErrorCode, { retryable: boolean; publicMessage: string }>;

const pathEventEnvelopeFields = {
  ...sharedEventEnvelopeFields,
  requestId: UuidSchema,
  sessionId: UuidSchema.nullable(),
  revision: z.number().int().nonnegative().nullable(),
  seq: z.number().int().positive(),
  at: z.string().datetime({ offset: true }),
};

export const PathEventEnvelopeSchema = z
  .object(pathEventEnvelopeFields)
  .strict()
  .superRefine((event, ctx) => {
    if (event.at !== event.occurredAt) {
      ctx.addIssue({ code: "custom", path: ["at"], message: "at must equal occurredAt" });
    }
    if ((event.sessionId === null) !== (event.revision === null)) {
      ctx.addIssue({ code: "custom", message: "sessionId and revision become non-null together" });
    }
  });
export type PathEventEnvelope = z.infer<typeof PathEventEnvelopeSchema>;

export const PathRunSummarySchema = z
  .object({
    generationMode: z.enum(["primary", "regenerated"]),
    degradationReasons: z.array(DegradationReasonSchema).max(4),
    sourceSummary: SourceSummarySchema,
  })
  .strict()
  .superRefine((summary, ctx) => {
    const reasons = new Set(summary.degradationReasons);
    if (reasons.size !== summary.degradationReasons.length) {
      ctx.addIssue({ code: "custom", message: "degradation reasons must be unique" });
    }
    const result = GenerationRunMetadataSchema.safeParse({
      generationMode: summary.generationMode,
      degradationReasons: summary.degradationReasons,
    });
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "run summary metadata is inconsistent" });
    }
    if (
      reasons.has("noZhihuEvidence")
      && (summary.sourceSummary.zhihuCount !== 0 || summary.sourceSummary.mixedCount !== 0)
    ) {
      ctx.addIssue({ code: "custom", message: "noZhihuEvidence conflicts with sourced items" });
    }
    if (
      summary.sourceSummary.zhihuCount
        + summary.sourceSummary.mixedCount
        + summary.sourceSummary.modelSupplementCount === 0
    ) {
      ctx.addIssue({ code: "custom", message: "successful run summary needs attributed items" });
    }
    if (reasons.has("noZhihuEvidence") && reasons.has("partialZhihuEvidence")) {
      ctx.addIssue({ code: "custom", message: "no and partial Zhihu evidence are mutually exclusive" });
    }
    if (
      reasons.has("partialZhihuEvidence")
      && summary.sourceSummary.zhihuCount + summary.sourceSummary.mixedCount === 0
    ) {
      ctx.addIssue({ code: "custom", message: "partial evidence needs at least one sourced item" });
    }
  });
export type PathRunSummary = z.infer<typeof PathRunSummarySchema>;

export const FailedPathRunSummarySchema = z
  .object({
    generationMode: z.enum(["primary", "regenerated"]).nullable(),
    degradationReasons: z.array(DegradationReasonSchema).max(4),
    sourceSummary: SourceSummarySchema,
  })
  .strict()
  .superRefine((summary, ctx) => {
    const reasons = new Set(summary.degradationReasons);
    if (reasons.size !== summary.degradationReasons.length) {
      ctx.addIssue({ code: "custom", message: "degradation reasons must be unique" });
    }
    if (
      summary.generationMode !== null
      && !GenerationRunMetadataSchema.safeParse({
        generationMode: summary.generationMode,
        degradationReasons: summary.degradationReasons,
      }).success
    ) {
      ctx.addIssue({ code: "custom", message: "failed run summary metadata is inconsistent" });
    }
    const rejectionCount =
      Number(reasons.has("primarySchemaInvalid")) + Number(reasons.has("primaryQualityRejected"));
    if (summary.generationMode === null && rejectionCount > 1) {
      ctx.addIssue({ code: "custom", message: "a failed run has at most one primary rejection cause" });
    }
    if (reasons.has("noZhihuEvidence") && reasons.has("partialZhihuEvidence")) {
      ctx.addIssue({ code: "custom", message: "no and partial Zhihu evidence are mutually exclusive" });
    }
    if (
      reasons.has("noZhihuEvidence")
      && (summary.sourceSummary.zhihuCount !== 0 || summary.sourceSummary.mixedCount !== 0)
    ) {
      ctx.addIssue({ code: "custom", message: "noZhihuEvidence conflicts with sourced items" });
    }
    if (
      reasons.has("partialZhihuEvidence")
      && summary.sourceSummary.zhihuCount + summary.sourceSummary.mixedCount === 0
    ) {
      ctx.addIssue({ code: "custom", message: "partial evidence needs at least one sourced item" });
    }
  });
export type FailedPathRunSummary = z.infer<typeof FailedPathRunSummarySchema>;

export const LearningPathDocumentSchema = z.custom<LearningPathDocument>(
  (value) => {
    try {
      return validateLearningPathDocument(value).ok;
    } catch {
      return false;
    }
  },
  { message: "invalid learning-path 1.0 document" },
);

type RunSummarySource = Pick<
  CandidateSet,
  "generationMode" | "degradationReasons" | "carriers" | "concepts" | "disputes"
>;

export const derivePathRunSummary = (source: RunSummarySource): PathRunSummary =>
  PathRunSummarySchema.parse({
    generationMode: source.generationMode,
    degradationReasons: source.degradationReasons,
    sourceSummary: sourceSummaryFrom(source.carriers, source.concepts, source.disputes),
  });

export const PathSessionReadResponseSchema = z
  .object({
    session: PathGenerationSessionSchema,
    runSummary: PathRunSummarySchema,
    document: LearningPathDocumentSchema.nullable(),
  })
  .strict()
  .superRefine((response, ctx) => {
    const summarySource = response.session.status === "ready"
      ? response.session.publishedPath
      : response.session.candidateSet;
    const expectedSummary = derivePathRunSummary(summarySource);
    if (JSON.stringify(response.runSummary) !== JSON.stringify(expectedSummary)) {
      ctx.addIssue({ code: "custom", path: ["runSummary"], message: "run summary/session mismatch" });
    }
    const path = response.session.publishedPath;
    if ((path === null) !== (response.document === null)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "document presence must match published path" });
    }
    if (path !== null && response.document !== null && response.document.id !== `lp-${path.id}`) {
      ctx.addIssue({ code: "custom", path: ["document", "id"], message: "document/path identity mismatch" });
    }
  });
export type PathSessionReadResponse = z.infer<typeof PathSessionReadResponseSchema>;

const PathStreamEventUnionSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("stage.started"),
      stage: PathGenerationStageSchema,
    })
    .strict(),
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("stage.completed"),
      stage: PathGenerationStageSchema,
      metrics: z.record(z.string(), z.number().finite()).optional(),
    })
    .strict(),
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("choice.ready"),
      question: ChoiceQuestionSchema,
      runSummary: PathRunSummarySchema,
    })
    .strict(),
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("choice.reminder"),
      question: ChoiceQuestionSchema,
      runSummary: PathRunSummarySchema,
    })
    .strict(),
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("path.ready"),
      path: FinalLearningPathSchema,
      document: LearningPathDocumentSchema,
      runSummary: PathRunSummarySchema,
    })
    .strict(),
  z
    .object({
      ...pathEventEnvelopeFields,
      type: z.literal("request.failed"),
      code: PathStreamFailureCodeSchema,
      message: z.string().trim().min(1).max(500),
      retryable: z.boolean(),
      runSummary: FailedPathRunSummarySchema,
    })
    .strict(),
]);

export const PathStreamEventSchema = PathStreamEventUnionSchema.superRefine((event, ctx) => {
  if (event.at !== event.occurredAt) {
    ctx.addIssue({ code: "custom", path: ["at"], message: "at must equal occurredAt" });
  }
  if ((event.sessionId === null) !== (event.revision === null)) {
    ctx.addIssue({ code: "custom", message: "sessionId and revision become non-null together" });
  }
  if (
    (event.type === "choice.ready" || event.type === "choice.reminder" || event.type === "path.ready")
    && (event.sessionId === null || event.revision === null)
  ) {
    ctx.addIssue({ code: "custom", message: "successful business terminal needs a persisted session" });
  }
  if (event.type === "path.ready") {
    if (event.revision !== event.path.revision) {
      ctx.addIssue({ code: "custom", path: ["revision"], message: "event/path revision mismatch" });
    }
    if (
      event.runSummary.generationMode !== event.path.generationMode
      || JSON.stringify(event.runSummary.degradationReasons) !== JSON.stringify(event.path.degradationReasons)
      || JSON.stringify(event.runSummary.sourceSummary) !== JSON.stringify(event.path.sourceSummary)
    ) {
      ctx.addIssue({ code: "custom", path: ["runSummary"], message: "event/path run summary mismatch" });
    }
    if (event.document.id !== `lp-${event.path.id}`) {
      ctx.addIssue({ code: "custom", path: ["document", "id"], message: "document/path identity mismatch" });
    }
  }
  if (event.type === "request.failed") {
    const policy = PATH_ERROR_POLICY[event.code];
    if (event.retryable !== policy.retryable || event.message !== policy.publicMessage) {
      ctx.addIssue({ code: "custom", message: "failure event must use the public error policy" });
    }
    if (event.code === "REVISION_CONFLICT" && (event.sessionId === null || event.revision === null)) {
      ctx.addIssue({ code: "custom", message: "stream revision conflict needs the base session revision" });
    }
  }
});
export type PathStreamEvent = z.infer<typeof PathStreamEventSchema>;

export const PathHttpErrorSchema = z
  .object({
    requestId: UuidSchema,
    code: PathPreStreamErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
    traceId: TraceIdSchema,
  })
  .strict()
  .superRefine((error, ctx) => {
    const policy = PATH_ERROR_POLICY[error.code];
    if (error.retryable !== policy.retryable || error.message !== policy.publicMessage) {
      ctx.addIssue({ code: "custom", message: "HTTP error must use the public error policy" });
    }
  });
export type PathHttpError = z.infer<typeof PathHttpErrorSchema>;

export function createSearchQueryHash(input: {
  goal: GoalRevision;
  queryId: SearchQueryId;
  query: string;
}): string {
  const canonical = [
    input.goal.effectiveGoal.normalize("NFC"),
    (input.goal.contextText ?? "").normalize("NFC"),
    input.queryId,
    input.query.normalize("NFC"),
  ].join("\0");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export const computeSourceSummary = sourceSummaryFrom;
export const listReferencedEvidenceIds = referencedEvidenceIds;
export const isQuestionVisible = questionVisible;
export const listReachableAnswerCombinations = enumerateAnswerCombinations;

export interface PathStoreCommit {
  next: PathGenerationSession;
  newSnapshot: PublishedPathSnapshot | null;
}

export interface PathSessionStore {
  create(
    actor: ActorContext,
    commit: PathStoreCommit,
    signal: AbortSignal,
  ): Promise<"created" | "sessionConflict">;
  get(
    actor: ActorContext,
    sessionId: string,
    signal: AbortSignal,
  ): Promise<PathGenerationSession | null>;
  getPublishedPath(
    actor: ActorContext,
    planInstanceId: string,
    pathRevision: number | undefined,
    signal: AbortSignal,
  ): Promise<FinalLearningPath | null>;
  compareAndSwap(
    input: {
      actor: ActorContext;
      sessionId: string;
      expectedRevision: number;
      commit: PathStoreCommit;
    },
    signal: AbortSignal,
  ): Promise<"updated" | "revisionConflict">;
}

export type ChoiceItemStatus = "pending" | "current" | "answered" | "superseded";
