import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { integer, jsonb, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { readApplicationDatabaseUrl } from "./config.ts";
import {
  CandidateSetSchema,
  EffectiveGoalTextSchema,
  FinalLearningPathSchema,
  PATH_ERROR_POLICY,
  PathGenerationRequestSchema,
  PathGenerationSessionSchema,
  PathKnowledgeHandoffResolutionSchema,
  PathKnowledgeHandoffSchema,
  PathStreamEventSchema,
  PublishedPathSnapshotSchema,
  SearchQueryIdSchema,
  computeSourceSummary,
  createSearchQueryHash,
  derivePathRunSummary,
  isQuestionVisible,
  listReferencedEvidenceIds,
  pruneCandidateSet,
  type ActorContext,
  type CandidateSet,
  type ChoiceAnswer,
  type ChoiceQuestion,
  type DegradationReason,
  type EvidenceRecord,
  type FailedPathRunSummary,
  type FinalLearningPath,
  type GoalRevision,
  type PathGenerationRequest,
  type PathGenerationSession,
  type PathGenerationStage,
  type PathKnowledgeHandoffResolution,
  type PathSessionStore,
  type PathStoreCommit,
  type PathStreamEvent,
  type PrunedGraph,
  type PathStreamFailureCode,
  type PublishedPathSnapshot,
  type SearchLedgerEntry,
  type SearchQueryId,
  type SupersededChoiceSet,
} from "./contracts.ts";
import {
  PATH_BUDGETS_MS,
  PROVIDER_LIMITS,
  SEARCH_SUFFICIENCY,
  SEARCH_WINDOWS_DAYS,
} from "./config.ts";
import {
  ProviderRequestError,
  type EvidenceSearchProvider,
  type StructuredPathModelProvider,
} from "./providers.ts";
import {
  RendererInvalidError,
  toLearningPathDocument,
  validateLearningPathProjection,
} from "./renderer.ts";
import { createLearningPathDocumentDigest } from "./renderer.ts";

export const mergeSupplementGoal = (previousEffectiveGoal: string, message: string) =>
  EffectiveGoalTextSchema.parse(`${previousEffectiveGoal}\n\n补充目标：${message}`);

export interface SearchQueryPlanItem {
  queryId: SearchQueryId;
  query: string;
  queryHash: string;
}

const SEARCH_QUERY_SUFFIX = {
  route: "学习路线 学习顺序",
  practice: "如何做出 如何实践",
  pitfalls: "常见卡点 踩坑",
  prerequisites: "前置知识 哪些可以跳过",
  depth: "完整体系 进阶",
} as const satisfies Record<SearchQueryId, string>;

export function buildSearchQueryPlan(goal: GoalRevision): SearchQueryPlanItem[] {
  return SearchQueryIdSchema.options.map((queryId) => {
    const query = `${goal.effectiveGoal} ${SEARCH_QUERY_SUFFIX[queryId]}`;
    return { queryId, query, queryHash: createSearchQueryHash({ goal, queryId, query }) };
  });
}

export type EvidenceWindow = "recent" | "expanded" | "undated" | "outside";

export function classifyEvidenceWindow(input: {
  now: Date;
  publishedAt: string | null;
}): EvidenceWindow {
  if (input.publishedAt === null) return "undated";
  const instant = new Date(input.publishedAt).getTime();
  const now = input.now.getTime();
  const dayMs = 24 * 60 * 60 * 1_000;
  if (!Number.isFinite(instant) || instant > now) return "outside";
  if (instant >= now - SEARCH_WINDOWS_DAYS.recent * dayMs) return "recent";
  if (instant >= now - SEARCH_WINDOWS_DAYS.expanded * dayMs) return "expanded";
  return "outside";
}

const excerptCodePoints = (value: string) => Array.from(value.trim()).length;

const vendorSafeText = (value: string, max: number, fallback: string) => {
  const compact = value.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim();
  const clipped = compact.slice(0, max).trim();
  return clipped.length > 0 ? clipped : fallback;
};

const vendorTitle = (goal: string) => vendorSafeText(goal, 160, "学习路径");
const vendorDescription = (goal: string) => vendorSafeText(goal, 500, "根据当前目标生成的学习路径");

export type PathCallLedger = {
  recentSearchBatches: number;
  expandedSearchBatches: number;
  recentSearchRequests: number;
  expandedSearchRequests: number;
  modelPrimaryCalls: number;
  modelFallbackCalls: number;
  rendererCalls: number;
  httpAttempts: { zhihu: number; deepseek: number };
  store: { createAttempts: number; casAttempts: number; successfulWrites: number };
  deliveryAbortedAfterCommit: number;
};

export const emptyCallLedger = (): PathCallLedger => ({
  recentSearchBatches: 0,
  expandedSearchBatches: 0,
  recentSearchRequests: 0,
  expandedSearchRequests: 0,
  modelPrimaryCalls: 0,
  modelFallbackCalls: 0,
  rendererCalls: 0,
  httpAttempts: { zhihu: 0, deepseek: 0 },
  store: { createAttempts: 0, casAttempts: 0, successfulWrites: 0 },
  deliveryAbortedAfterCommit: 0,
});

export class PathPreStreamError extends Error {
  readonly code: "INVALID_REQUEST" | "SESSION_NOT_FOUND" | "REVISION_CONFLICT" | "INTERNAL_ERROR";
  readonly requestId: string;

  constructor(
    code: PathPreStreamError["code"],
    requestId: string,
    message = PATH_ERROR_POLICY[code].publicMessage,
  ) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.name = "PathPreStreamError";
  }
}

const ownerKey = (actor: ActorContext, sessionId: string) =>
  `${actor.tenantId}:${actor.principalId}:${sessionId}`;

const snapshotKey = (actor: ActorContext, planInstanceId: string, revision: number) =>
  `${actor.tenantId}:${actor.principalId}:${planInstanceId}:${revision}`;

const sameOwner = (actor: ActorContext, session: PathGenerationSession) =>
  session.tenantId === actor.tenantId && session.principalId === actor.principalId;

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  }
};

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryPathSessionStore implements PathSessionStore {
  readonly sessions = new Map<string, PathGenerationSession>();
  readonly snapshots = new Map<string, PublishedPathSnapshot>();

  async create(
    actor: ActorContext,
    commit: PathStoreCommit,
    signal: AbortSignal,
  ): Promise<"created" | "sessionConflict"> {
    throwIfAborted(signal);
    if (commit.next.tenantId !== actor.tenantId || commit.next.principalId !== actor.principalId) {
      throw new Error("store commit owner mismatch");
    }
    const key = ownerKey(actor, commit.next.id);
    if (this.sessions.has(key)) return "sessionConflict";
    this.writeCommit(actor, commit);
    return "created";
  }

  async get(
    actor: ActorContext,
    sessionId: string,
    signal: AbortSignal,
  ): Promise<PathGenerationSession | null> {
    throwIfAborted(signal);
    const session = this.sessions.get(ownerKey(actor, sessionId));
    return session === undefined || !sameOwner(actor, session) ? null : clone(session);
  }

  async getPublishedPath(
    actor: ActorContext,
    planInstanceId: string,
    pathRevision: number | undefined,
    signal: AbortSignal,
  ): Promise<FinalLearningPath | null> {
    throwIfAborted(signal);
    const matches = [...this.snapshots.values()].filter((snapshot) =>
      snapshot.tenantId === actor.tenantId
      && snapshot.principalId === actor.principalId
      && snapshot.planInstanceId === planInstanceId
      && (pathRevision === undefined || snapshot.revision === pathRevision),
    );
    if (matches.length === 0) return null;
    const selected = matches.sort((left, right) => right.revision - left.revision)[0];
    return selected === undefined ? null : clone(selected.path);
  }

  async compareAndSwap(
    input: {
      actor: ActorContext;
      sessionId: string;
      expectedRevision: number;
      commit: PathStoreCommit;
    },
    signal: AbortSignal,
  ): Promise<"updated" | "revisionConflict"> {
    throwIfAborted(signal);
    const current = this.sessions.get(ownerKey(input.actor, input.sessionId));
    if (current === undefined || current.revision !== input.expectedRevision) {
      return "revisionConflict";
    }
    this.writeCommit(input.actor, input.commit);
    return "updated";
  }

  private writeCommit(actor: ActorContext, commit: PathStoreCommit) {
    this.sessions.set(ownerKey(actor, commit.next.id), clone(commit.next));
    if (commit.newSnapshot !== null) {
      this.snapshots.set(
        snapshotKey(actor, commit.newSnapshot.planInstanceId, commit.newSnapshot.revision),
        clone(commit.newSnapshot),
      );
    }
  }
}

export const createInMemoryPathSessionStore = (
  seed: {
    sessions?: readonly PathGenerationSession[];
    snapshots?: readonly PublishedPathSnapshot[];
    beforeCreate?: () => Promise<void>;
    beforeCompareAndSwap?: () => Promise<void>;
  } = {},
): InMemoryPathSessionStore => {
  const store = new InMemoryPathSessionStore();
  for (const session of seed.sessions ?? []) {
    store.sessions.set(ownerKey({
      tenantId: session.tenantId,
      principalId: session.principalId,
      traceId: "seed",
    }, session.id), clone(session));
  }
  for (const snapshot of seed.snapshots ?? []) {
    store.snapshots.set(snapshotKey({
      tenantId: snapshot.tenantId,
      principalId: snapshot.principalId,
      traceId: "seed",
    }, snapshot.planInstanceId, snapshot.revision), clone(snapshot));
  }
  if (seed.beforeCreate !== undefined) {
    const original = store.create.bind(store);
    store.create = async (actor, commit, signal) => {
      await seed.beforeCreate?.();
      return original(actor, commit, signal);
    };
  }
  if (seed.beforeCompareAndSwap !== undefined) {
    const original = store.compareAndSwap.bind(store);
    store.compareAndSwap = async (input, signal) => {
      await seed.beforeCompareAndSwap?.();
      return original(input, signal);
    };
  }
  return store;
};

export const createSessionConflictThenMissingStore = (): PathSessionStore => ({
  async create() {
    return "sessionConflict";
  },
  async get() {
    return null;
  },
  async getPublishedPath() {
    return null;
  },
  async compareAndSwap() {
    return "revisionConflict";
  },
});

const pathGenerationSessions = pgTable("path_generation_sessions", {
  tenantId: uuid("tenant_id").notNull(),
  principalId: uuid("principal_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  revision: integer("revision").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.tenantId, table.principalId, table.sessionId] })]);

const pathPublishedSnapshots = pgTable("path_published_snapshots", {
  tenantId: uuid("tenant_id").notNull(),
  principalId: uuid("principal_id").notNull(),
  planInstanceId: uuid("plan_instance_id").notNull(),
  revision: integer("revision").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({
  columns: [table.tenantId, table.principalId, table.planInstanceId, table.revision],
})]);

const PATH_SESSION_INIT_SQL = `
CREATE TABLE IF NOT EXISTS path_generation_sessions (
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  session_id uuid NOT NULL,
  revision integer NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id, session_id)
);
CREATE TABLE IF NOT EXISTS path_published_snapshots (
  tenant_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  plan_instance_id uuid NOT NULL,
  revision integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id, plan_instance_id, revision)
);
`;

export type ClosablePathSessionStore = PathSessionStore & {
  close: () => Promise<void>;
};

type DurableStoreHooks = {
  beforeTransactionCommit?: () => Promise<void>;
};

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || error.message === "aborted");

const isUniqueViolation = (error: unknown) => {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "23505" || message.includes("unique") || message.includes("UNIQUE");
};

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const assertCommitContract = (
  actor: ActorContext,
  current: PathGenerationSession | null,
  commit: PathStoreCommit,
) => {
  if (commit.next.tenantId !== actor.tenantId || commit.next.principalId !== actor.principalId) {
    throw new Error("store commit owner mismatch");
  }
  if (commit.newSnapshot === null) {
    if (commit.next.publishedPath !== null && current?.publishedPath !== null && current !== null) {
      if (!sameJson(commit.next.publishedPath, current.publishedPath)) {
        throw new Error("awaiting commit cannot replace published path");
      }
    }
    if (commit.next.publishedPath !== null && current === null) {
      throw new Error("create without snapshot cannot carry a published path");
    }
    return;
  }
  const snapshot = PublishedPathSnapshotSchema.parse(commit.newSnapshot);
  if (snapshot.tenantId !== actor.tenantId || snapshot.principalId !== actor.principalId) {
    throw new Error("snapshot owner mismatch");
  }
  if (commit.next.publishedPath === null || !sameJson(snapshot.path, commit.next.publishedPath)) {
    throw new Error("snapshot path must equal next published path");
  }
  if (
    current?.publishedPath !== null
    && current !== null
    && current.publishedPath.planInstanceId === snapshot.planInstanceId
  ) {
    throw new Error("new snapshot must use a new planInstanceId");
  }
};

const applyPathSessionSql = async (execute: (statement: string) => Promise<unknown>) => {
  const statements = PATH_SESSION_INIT_SQL
    .split(/;\s*\n/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  for (const statement of statements) {
    await execute(`${statement};`);
  }
};

type DurableDatabase = ReturnType<typeof drizzlePglite> | ReturnType<typeof drizzlePostgres>;
const asStore = (tx: unknown): DurableDatabase => tx as DurableDatabase;

const createDurablePathSessionStore = (
  db: DurableDatabase,
  hooks: DurableStoreHooks,
  close: () => Promise<void>,
): ClosablePathSessionStore => {
  const loadSession = async (
    tx: DurableDatabase,
    actor: ActorContext,
    sessionId: string,
    lock: boolean,
  ): Promise<PathGenerationSession | null> => {
    const query = tx
      .select()
      .from(pathGenerationSessions)
      .where(and(
        eq(pathGenerationSessions.tenantId, actor.tenantId),
        eq(pathGenerationSessions.principalId, actor.principalId),
        eq(pathGenerationSessions.sessionId, sessionId),
      ));
    const rows = lock ? await query.for("update") : await query;
    const row = rows[0];
    if (row === undefined) return null;
    const parsed = PathGenerationSessionSchema.safeParse(row.payload);
    return parsed.success ? parsed.data : null;
  };

  const insertCommit = async (tx: DurableDatabase, actor: ActorContext, commit: PathStoreCommit) => {
    const now = new Date();
    await tx.insert(pathGenerationSessions).values({
      tenantId: actor.tenantId,
      principalId: actor.principalId,
      sessionId: commit.next.id,
      revision: commit.next.revision,
      payload: commit.next,
      updatedAt: now,
    });
    if (commit.newSnapshot !== null) {
      await tx.insert(pathPublishedSnapshots).values({
        tenantId: actor.tenantId,
        principalId: actor.principalId,
        planInstanceId: commit.newSnapshot.planInstanceId,
        revision: commit.newSnapshot.revision,
        payload: commit.newSnapshot,
        createdAt: now,
      });
    }
  };

  return {
    async create(actor, commit, signal) {
      throwIfAborted(signal);
      try {
        return await db.transaction(async (tx) => {
          throwIfAborted(signal);
          const existing = await loadSession(asStore(tx), actor, commit.next.id, true);
          if (existing !== null) return "sessionConflict" as const;
          assertCommitContract(actor, null, commit);
          await insertCommit(asStore(tx), actor, commit);
          await hooks.beforeTransactionCommit?.();
          throwIfAborted(signal);
          return "created" as const;
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        if (isUniqueViolation(error)) return "sessionConflict";
        throw error;
      }
    },
    async get(actor, sessionId, signal) {
      throwIfAborted(signal);
      return db.transaction(async (tx) => loadSession(asStore(tx), actor, sessionId, false));
    },
    async getPublishedPath(actor, planInstanceId, pathRevision, signal) {
      throwIfAborted(signal);
      return db.transaction(async (tx) => {
        const client = asStore(tx);
        const filters = [
          eq(pathPublishedSnapshots.tenantId, actor.tenantId),
          eq(pathPublishedSnapshots.principalId, actor.principalId),
          eq(pathPublishedSnapshots.planInstanceId, planInstanceId),
        ];
        if (pathRevision !== undefined) {
          filters.push(eq(pathPublishedSnapshots.revision, pathRevision));
        }
        const rows = await client
          .select()
          .from(pathPublishedSnapshots)
          .where(and(...filters))
          .orderBy(desc(pathPublishedSnapshots.revision))
          .limit(1);
        const row = rows[0];
        if (row === undefined) return null;
        const parsed = PublishedPathSnapshotSchema.safeParse(row.payload);
        return parsed.success ? parsed.data.path : null;
      });
    },
    async compareAndSwap(input, signal) {
      throwIfAborted(signal);
      try {
        return await db.transaction(async (tx) => {
          throwIfAborted(signal);
          const client = asStore(tx);
          const current = await loadSession(client, input.actor, input.sessionId, true);
          if (current === null || current.revision !== input.expectedRevision) {
            return "revisionConflict" as const;
          }
          assertCommitContract(input.actor, current, input.commit);
          await client
            .update(pathGenerationSessions)
            .set({
              revision: input.commit.next.revision,
              payload: input.commit.next,
              updatedAt: new Date(),
            })
            .where(and(
              eq(pathGenerationSessions.tenantId, input.actor.tenantId),
              eq(pathGenerationSessions.principalId, input.actor.principalId),
              eq(pathGenerationSessions.sessionId, input.sessionId),
              eq(pathGenerationSessions.revision, input.expectedRevision),
            ));
          if (input.commit.newSnapshot !== null) {
            await client.insert(pathPublishedSnapshots).values({
              tenantId: input.actor.tenantId,
              principalId: input.actor.principalId,
              planInstanceId: input.commit.newSnapshot.planInstanceId,
              revision: input.commit.newSnapshot.revision,
              payload: input.commit.newSnapshot,
              createdAt: new Date(),
            });
          }
          await hooks.beforeTransactionCommit?.();
          throwIfAborted(signal);
          return "updated" as const;
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw error;
      }
    },
    close,
  };
};

export const createPglitePathSessionStore = async (
  options: DurableStoreHooks & { dataDir?: string } = {},
): Promise<ClosablePathSessionStore> => {
  if (options.dataDir !== undefined) {
    mkdirSync(options.dataDir, { recursive: true });
  }
  const client = options.dataDir === undefined ? new PGlite() : new PGlite(options.dataDir);
  await client.waitReady;
  const db = drizzlePglite(client);
  await applyPathSessionSql(async (statement) => {
    await db.execute(sql.raw(statement));
  });
  return createDurablePathSessionStore(
    db,
    options.beforeTransactionCommit === undefined ? {} : { beforeTransactionCommit: options.beforeTransactionCommit },
    async () => {
      await client.close();
    },
  );
};

export const createPostgresPathSessionStore = async (
  options: DurableStoreHooks & { databaseUrl: string },
): Promise<ClosablePathSessionStore> => {
  const client = postgres(options.databaseUrl, { max: 4, idle_timeout: 20 });
  const db = drizzlePostgres(client);
  await applyPathSessionSql(async (statement) => {
    await db.execute(sql.raw(statement));
  });
  return createDurablePathSessionStore(
    db,
    options.beforeTransactionCommit === undefined ? {} : { beforeTransactionCommit: options.beforeTransactionCommit },
    async () => {
      await client.end();
    },
  );
};

export const openPersistentPathSessionStore = async (
  hooks: DurableStoreHooks = {},
): Promise<ClosablePathSessionStore> => {
  const databaseUrl = readApplicationDatabaseUrl();
  if (databaseUrl !== undefined) {
    return createPostgresPathSessionStore({
      databaseUrl,
      ...(hooks.beforeTransactionCommit === undefined ? {} : { beforeTransactionCommit: hooks.beforeTransactionCommit }),
    });
  }
  const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../.data/path-sessions");
  return createPglitePathSessionStore({
    dataDir,
    ...(hooks.beforeTransactionCommit === undefined ? {} : { beforeTransactionCommit: hooks.beforeTransactionCommit }),
  });
};

export async function resolvePathKnowledgeHandoff(
  actor: ActorContext,
  rawHandoff: unknown,
  store: PathSessionStore,
  signal: AbortSignal,
): Promise<PathKnowledgeHandoffResolution | null> {
  const parsed = PathKnowledgeHandoffSchema.safeParse(rawHandoff);
  if (!parsed.success) return null;
  const path = await store.getPublishedPath(
    actor,
    parsed.data.planInstanceId,
    parsed.data.pathRevision,
    signal,
  );
  if (path === null || !path.concepts.some((concept) => concept.id === parsed.data.conceptId)) {
    return null;
  }
  return PathKnowledgeHandoffResolutionSchema.parse({
    planInstanceId: path.planInstanceId,
    conceptId: parsed.data.conceptId,
    pathRevision: path.revision,
  });
}

const firstVisibleUnanswered = (
  questions: readonly ChoiceQuestion[],
  answers: readonly ChoiceAnswer[],
): ChoiceQuestion | null => {
  const active = new Map(
    answers.filter((answer) => answer.status === "active").map((answer) => [answer.questionId, answer.optionId]),
  );
  const ordered = [...questions].sort((left, right) => left.order - right.order);
  return ordered.find((question) =>
    isQuestionVisible(question, active) && !active.has(question.id),
  ) ?? null;
};

const activeAnswers = (answers: readonly ChoiceAnswer[]) =>
  answers.filter((answer) => answer.status === "active");

const archiveChoiceSet = (session: PathGenerationSession, at: string): SupersededChoiceSet => ({
  goal: session.candidateSet.goal,
  questions: session.candidateSet.questions.map((question) => ({
    id: question.id,
    order: question.order,
    prompt: question.prompt,
    reason: question.reason,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
    })),
  })),
  choiceAnswers: session.choiceAnswers.map((answer) => ({ ...answer, status: "superseded" as const })),
  supersededAt: at,
});

const qualityIssues = (candidate: CandidateSet): string[] => {
  const issues: string[] = [];
  const facets = new Set(
    [...candidate.carriers, ...candidate.concepts].flatMap((item) => item.facets),
  );
  if (!facets.has("coreWorkflow") || !facets.has("verification")) {
    issues.push("missing coreWorkflow or verification coverage");
  }
  if (!["prerequisites", "practice", "pitfalls", "optionalDepth"].some((facet) => facets.has(facet as never))) {
    issues.push("missing supporting coverage facet");
  }
  return issues;
};

const sanitizeRejectedExcerpt = (value: unknown): string => {
  const raw = JSON.stringify(value).replace(/[\u0000-\u001F\u007F]/gu, "");
  return raw.slice(0, PROVIDER_LIMITS.rejectedExcerptBytes);
};

const boundIssues = (issues: readonly string[]) =>
  issues.slice(0, PROVIDER_LIMITS.maxIssueCount).map((item) => item.slice(0, PROVIDER_LIMITS.maxIssueCodePoints));

const emptyFailedSummary = (): FailedPathRunSummary => ({
  generationMode: null,
  degradationReasons: [],
  sourceSummary: { zhihuCount: 0, mixedCount: 0, modelSupplementCount: 0 },
});

const dayMs = 24 * 60 * 60 * 1_000;

const acceptEvidence = (
  records: readonly EvidenceRecord[],
  existing: readonly EvidenceRecord[],
): EvidenceRecord[] => {
  const seenUrl = new Set(existing.map((item) => item.sourceUrl));
  const seenHash = new Set(existing.map((item) => item.sourceContentSha256));
  const accepted: EvidenceRecord[] = [];
  for (const record of records) {
    if (seenUrl.has(record.sourceUrl) || seenHash.has(record.sourceContentSha256)) continue;
    seenUrl.add(record.sourceUrl);
    seenHash.add(record.sourceContentSha256);
    accepted.push(record);
  }
  return accepted;
};

const sufficientRecent = (
  plan: readonly SearchQueryPlanItem[],
  ledger: readonly SearchLedgerEntry[],
  catalog: readonly EvidenceRecord[],
  now: Date,
) => {
  const recentSuccess = ledger.filter((entry) => entry.window === "recentYear" && entry.status === "success");
  const covered = new Set<SearchQueryId>();
  const validIds = new Set<string>();
  for (const entry of recentSuccess) {
    const records = catalog.filter((item) => entry.evidenceIds.includes(item.id));
    const valid = records.filter((item) =>
      excerptCodePoints(item.excerpt) >= SEARCH_SUFFICIENCY.minExcerptCodePoints
      && classifyEvidenceWindow({ now, publishedAt: item.publishedAt }) === "recent",
    );
    if (valid.length > 0) covered.add(entry.queryId);
    for (const item of valid) validIds.add(item.id);
  }
  void plan;
  return validIds.size >= SEARCH_SUFFICIENCY.minUniqueValidSources
    && covered.size >= SEARCH_SUFFICIENCY.minCoveredQueryAngles;
};

export type PathServiceDeps = {
  actor: ActorContext;
  store: PathSessionStore;
  search: EvidenceSearchProvider;
  model: StructuredPathModelProvider;
  now?: () => Date;
  randomUUID?: () => string;
  projectDocument?: typeof toLearningPathDocument;
  onMetric?: (name: string, value: number) => void;
};

export type PathServiceResult = {
  events: PathStreamEvent[];
  ledger: PathCallLedger;
  committedSession: PathGenerationSession | null;
  publishedPathBefore: FinalLearningPath | null;
  publishedPathAfter: FinalLearningPath | null;
  newSnapshot: PublishedPathSnapshot | null;
  errorCode: PathStreamFailureCode | "CANCELLED" | "INVALID_REQUEST" | "SESSION_NOT_FOUND" | null;
};

type EventState = {
  seq: number;
  sessionId: string | null;
  revision: number | null;
};

export class PathGenerationService {
  private readonly deps: PathServiceDeps;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly projectDocument: typeof toLearningPathDocument;

  constructor(deps: PathServiceDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    this.uuid = deps.randomUUID ?? randomUUID;
    this.projectDocument = deps.projectDocument ?? toLearningPathDocument;
  }

  async run(
    rawRequest: unknown,
    signal: AbortSignal,
  ): Promise<PathServiceResult> {
    const parsed = PathGenerationRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new PathPreStreamError(
        "INVALID_REQUEST",
        typeof rawRequest === "object" && rawRequest !== null && "requestId" in rawRequest
          && typeof rawRequest.requestId === "string"
          ? rawRequest.requestId
          : this.uuid(),
      );
    }
    return this.execute(parsed.data, signal);
  }

  async execute(
    request: PathGenerationRequest,
    signal: AbortSignal,
    onEvent?: (event: PathStreamEvent) => void,
  ): Promise<PathServiceResult> {
    const events: PathStreamEvent[] = [];
    const ledger = emptyCallLedger();
    const state: EventState = { seq: 0, sessionId: null, revision: null };
    let committedSession: PathGenerationSession | null = null;
    let publishedPathBefore: FinalLearningPath | null = null;
    let publishedPathAfter: FinalLearningPath | null = null;
    let newSnapshot: PublishedPathSnapshot | null = null;
    let errorCode: PathServiceResult["errorCode"] = null;

    const emit = (event: PathStreamEvent) => {
      const parsed = PathStreamEventSchema.parse(event);
      events.push(parsed);
      onEvent?.(parsed);
    };

    const applyCommittedEnvelope = () => {
      if (state.sessionId === null || state.revision === null) return;
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (event === undefined || event.sessionId === null) continue;
        events[index] = PathStreamEventSchema.parse({
          ...event,
          sessionId: state.sessionId,
          revision: state.revision,
        });
      }
    };

    const envelope = () => {
      const at = this.now().toISOString();
      state.seq += 1;
      return {
        eventId: this.uuid().toLowerCase(),
        occurredAt: at,
        traceId: this.deps.actor.traceId,
        schemaVersion: 1 as const,
        requestId: request.requestId,
        sessionId: state.sessionId,
        revision: state.revision,
        seq: state.seq,
        at,
      };
    };

    const emitStage = (type: "stage.started" | "stage.completed", stage: PathGenerationStage) => {
      emit({ ...envelope(), type, stage, sessionId: null, revision: null });
    };

    const fail = (
      code: PathStreamFailureCode,
      runSummary: FailedPathRunSummary = emptyFailedSummary(),
    ) => {
      errorCode = code;
      const policy = PATH_ERROR_POLICY[code];
      emit({
        ...envelope(),
        type: "request.failed",
        code,
        message: policy.publicMessage,
        retryable: policy.retryable,
        runSummary,
      });
    };

    const startedAtMs = Date.now();
    const deadline = AbortSignal.timeout(PATH_BUDGETS_MS.total);
    const combined = AbortSignal.any([signal, deadline]);
    const workSignal = combined;

    try {
      throwIfAborted(workSignal);
      if (request.kind === "start") {
        const existing = await this.deps.store.get(this.deps.actor, request.sessionId, workSignal);
        if (existing !== null) {
          throw new PathPreStreamError("REVISION_CONFLICT", request.requestId);
        }
        emitStage("stage.started", "validate");
        emitStage("stage.completed", "validate");
        const generated = await this.generateFromGoal({
          originalGoal: request.goal,
          effectiveGoal: request.goal,
          ...(request.contextText !== undefined ? { contextText: request.contextText } : {}),
          goalRevision: 0,
          startedAtMs,
          signal: workSignal,
          emitStage,
          ledger,
        });
        if (generated.kind === "failed") {
          fail(generated.code, generated.runSummary);
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        const built = await this.buildTerminalSession({
          sessionId: request.sessionId,
          revision: 0,
          previous: null,
          candidateSet: generated.candidateSet,
          evidenceCatalog: generated.catalog,
          searchLedger: generated.ledger,
          choiceAnswers: [],
          supersededChoiceSets: [],
          ledger,
          signal: workSignal,
          emitStage,
        });
        if (built.kind === "failed") {
          fail(built.code, built.runSummary);
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        throwIfAborted(workSignal);
        ledger.store.createAttempts += 1;
        const created = await this.deps.store.create(this.deps.actor, built.commit, workSignal);
        if (created === "sessionConflict") {
          const winner = await this.deps.store.get(this.deps.actor, request.sessionId, workSignal);
          if (winner === null) {
            state.sessionId = null;
            state.revision = null;
            fail("INTERNAL_ERROR");
          } else {
            state.sessionId = winner.id;
            state.revision = winner.revision;
            fail("REVISION_CONFLICT");
          }
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        ledger.store.successfulWrites += 1;
        committedSession = built.commit.next;
        publishedPathAfter = built.commit.next.publishedPath;
        newSnapshot = built.commit.newSnapshot;
        state.sessionId = built.commit.next.id;
        state.revision = built.commit.next.revision;
        if (signal.aborted) {
          ledger.deliveryAbortedAfterCommit += 1;
          this.deps.onMetric?.("deliveryAbortedAfterCommit", 1);
          errorCode = "CANCELLED";
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        this.emitTerminal(emit, envelope, built);
        applyCommittedEnvelope();
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }

      const session = await this.deps.store.get(this.deps.actor, request.sessionId, workSignal);
      if (session === null) {
        throw new PathPreStreamError("SESSION_NOT_FOUND", request.requestId);
      }
      publishedPathBefore = session.publishedPath;
      publishedPathAfter = session.publishedPath;
      if (session.revision !== request.expectedRevision) {
        throw new PathPreStreamError("REVISION_CONFLICT", request.requestId);
      }
      state.sessionId = session.id;
      state.revision = session.revision;
      const allowed = this.precheckExisting(request, session);
      if (!allowed.ok) {
        throw new PathPreStreamError("INVALID_REQUEST", request.requestId);
      }
      if (request.kind === "message" && request.intent === "ask") {
        const question = session.candidateSet.questions.find((item) => item.id === session.currentQuestionId);
        if (question === undefined) {
          throw new PathPreStreamError("INVALID_REQUEST", request.requestId);
        }
        emitStage("stage.started", "validate");
        emitStage("stage.completed", "validate");
        emit({
          ...envelope(),
          type: "choice.reminder",
          question,
          runSummary: derivePathRunSummary(session.candidateSet),
        });
        committedSession = session;
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }

      if (request.kind === "message" && request.intent === "supplementGoal") {
        emitStage("stage.started", "validate");
        emitStage("stage.completed", "validate");
        const generated = await this.generateFromGoal({
          originalGoal: session.candidateSet.goal.originalGoal,
          effectiveGoal: mergeSupplementGoal(session.candidateSet.goal.effectiveGoal, request.message),
          ...(session.candidateSet.goal.contextText !== undefined
            ? { contextText: session.candidateSet.goal.contextText }
            : {}),
          goalRevision: session.revision + 1,
          startedAtMs,
          signal: workSignal,
          emitStage,
          ledger,
        });
        if (generated.kind === "failed") {
          fail(generated.code, generated.runSummary);
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        const built = await this.buildTerminalSession({
          sessionId: session.id,
          revision: session.revision + 1,
          previous: session,
          candidateSet: generated.candidateSet,
          evidenceCatalog: generated.catalog,
          searchLedger: generated.ledger,
          choiceAnswers: [],
          supersededChoiceSets: [
            ...session.supersededChoiceSets,
            archiveChoiceSet(session, this.now().toISOString()),
          ],
          ledger,
          signal: workSignal,
          emitStage,
        });
        if (built.kind === "failed") {
          fail(built.code, built.runSummary);
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        const swapped = await this.cas(session, built.commit, ledger, workSignal, state);
        if (swapped === "abortedAfterCommit") {
          committedSession = built.commit.next;
          publishedPathAfter = built.commit.next.publishedPath ?? session.publishedPath;
          newSnapshot = built.commit.newSnapshot;
          errorCode = "CANCELLED";
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        if (swapped === "revisionConflict") {
          fail("REVISION_CONFLICT");
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        committedSession = built.commit.next;
        publishedPathAfter = built.commit.next.publishedPath ?? session.publishedPath;
        newSnapshot = built.commit.newSnapshot;
        this.emitTerminal(emit, envelope, built);
        applyCommittedEnvelope();
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }

      if (request.kind !== "answer" && request.kind !== "reviseAnswer") {
        throw new PathPreStreamError("INVALID_REQUEST", request.requestId);
      }
      const advanced = request.kind === "reviseAnswer"
        ? this.reviseAnswers(session, request.questionId, request.optionId)
        : this.answerCurrent(session, request.questionId, request.optionId);
      if (!advanced.ok) {
        throw new PathPreStreamError("INVALID_REQUEST", request.requestId);
      }
      emitStage("stage.started", "validate");
      emitStage("stage.completed", "validate");
      const nextQuestion = firstVisibleUnanswered(session.candidateSet.questions, advanced.answers);
      if (nextQuestion !== null) {
        const next: PathGenerationSession = {
          ...session,
          revision: session.revision + 1,
          status: "awaitingChoice",
          currentQuestionId: nextQuestion.id,
          choiceAnswers: advanced.answers,
        };
        const commit: PathStoreCommit = { next, newSnapshot: null };
        const swapped = await this.cas(session, commit, ledger, workSignal, state);
        if (swapped === "revisionConflict") {
          fail("REVISION_CONFLICT");
          return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
        }
        committedSession = next;
        this.emitTerminal(emit, envelope, {
          kind: "choice",
          commit,
          question: nextQuestion,
        });
        applyCommittedEnvelope();
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      const active = activeAnswers(advanced.answers);
      if (active.length < 2 || active.length > 3) {
        fail("GENERATION_INVALID", {
          generationMode: session.candidateSet.generationMode,
          degradationReasons: session.candidateSet.degradationReasons,
          sourceSummary: computeSourceSummary(
            session.candidateSet.carriers,
            session.candidateSet.concepts,
            session.candidateSet.disputes,
          ),
        });
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      emitStage("stage.started", "prune");
      const pruned = pruneCandidateSet(session.candidateSet, active);
      emitStage("stage.completed", "prune");
      if (!pruned.ok) {
        fail("GENERATION_INVALID");
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      const projected = await this.projectPath({
        revision: session.revision + 1,
        goal: session.candidateSet.goal,
        generationMode: session.candidateSet.generationMode,
        degradationReasons: session.candidateSet.degradationReasons,
        graph: pruned.value,
        catalog: session.evidenceCatalog,
        ledger,
        emitStage,
      });
      if (projected.kind === "failed") {
        fail(projected.code, projected.runSummary);
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      const next: PathGenerationSession = {
        ...session,
        revision: session.revision + 1,
        status: "ready",
        currentQuestionId: null,
        choiceAnswers: advanced.answers,
        publishedPath: projected.path,
      };
      const snapshot = PublishedPathSnapshotSchema.parse({
        tenantId: this.deps.actor.tenantId,
        principalId: this.deps.actor.principalId,
        planInstanceId: projected.path.planInstanceId,
        revision: projected.path.revision,
        path: projected.path,
      });
      const commit: PathStoreCommit = { next, newSnapshot: snapshot };
      const swapped = await this.cas(session, commit, ledger, workSignal, state);
      if (swapped === "abortedAfterCommit") {
        committedSession = next;
        publishedPathAfter = projected.path;
        newSnapshot = snapshot;
        errorCode = "CANCELLED";
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      if (swapped === "revisionConflict") {
        fail("REVISION_CONFLICT");
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      committedSession = next;
      publishedPathAfter = projected.path;
      newSnapshot = snapshot;
        this.emitTerminal(emit, envelope, {
          kind: "path",
          commit,
          document: projected.document,
        });
        applyCommittedEnvelope();
      return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
    } catch (error) {
      if (error instanceof PathPreStreamError) throw error;
      if (signal.aborted) {
        errorCode = "CANCELLED";
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      if (deadline.aborted) {
        fail("DEADLINE_EXCEEDED");
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      if (error instanceof Error && error.name === "AbortError") {
        errorCode = "CANCELLED";
        return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
      }
      fail("INTERNAL_ERROR");
      return { events, ledger, committedSession, publishedPathBefore, publishedPathAfter, newSnapshot, errorCode };
    }
  }

  private precheckExisting(
    request: PathGenerationRequest,
    session: PathGenerationSession,
  ): { ok: boolean } {
    if (request.kind === "message") {
      if (request.intent === "ask") {
        return { ok: session.status === "awaitingChoice" };
      }
      return { ok: true };
    }
    if (session.status !== "awaitingChoice") return { ok: false };
    const current = session.candidateSet.questions.find((question) => question.id === session.currentQuestionId);
    if (request.kind === "answer") {
      return {
        ok: current !== undefined
          && request.questionId === current.id
          && current.options.some((option) => option.id === request.optionId),
      };
    }
    if (request.kind !== "reviseAnswer") return { ok: false };
    const question = session.candidateSet.questions.find((item) => item.id === request.questionId);
    const answered = session.choiceAnswers.some((answer) =>
      answer.status === "active" && answer.questionId === request.questionId,
    );
    return {
      ok: question !== undefined
        && answered
        && current !== undefined
        && question.order < current.order
        && question.options.some((option) => option.id === request.optionId),
    };
  }

  private answerCurrent(
    session: PathGenerationSession,
    questionId: string,
    optionId: string,
  ): { ok: true; answers: ChoiceAnswer[] } | { ok: false } {
    if (session.currentQuestionId !== questionId) return { ok: false };
    const question = session.candidateSet.questions.find((item) => item.id === questionId);
    if (question === undefined || !question.options.some((option) => option.id === optionId)) {
      return { ok: false };
    }
    return {
      ok: true,
      answers: [
        ...session.choiceAnswers,
        {
          questionId,
          optionId,
          revision: session.revision + 1,
          status: "active",
        },
      ],
    };
  }

  private reviseAnswers(
    session: PathGenerationSession,
    questionId: string,
    optionId: string,
  ): { ok: true; answers: ChoiceAnswer[] } | { ok: false } {
    const question = session.candidateSet.questions.find((item) => item.id === questionId);
    if (question === undefined || !question.options.some((option) => option.id === optionId)) {
      return { ok: false };
    }
    const answers = session.choiceAnswers.map((answer) => {
      const answeredQuestion = session.candidateSet.questions.find((item) => item.id === answer.questionId);
      if (answer.questionId === questionId || (answeredQuestion !== undefined && answeredQuestion.order > question.order)) {
        return { ...answer, status: "superseded" as const };
      }
      return answer;
    });
    answers.push({
      questionId,
      optionId,
      revision: session.revision + 1,
      status: "active",
    });
    return { ok: true, answers };
  }

  private async cas(
    session: PathGenerationSession,
    commit: PathStoreCommit,
    ledger: PathCallLedger,
    signal: AbortSignal,
    state: EventState,
  ): Promise<"updated" | "revisionConflict" | "abortedAfterCommit"> {
    throwIfAborted(signal);
    ledger.store.casAttempts += 1;
    const result = await this.deps.store.compareAndSwap({
      actor: this.deps.actor,
      sessionId: session.id,
      expectedRevision: session.revision,
      commit,
    }, signal);
    if (result === "updated") {
      ledger.store.successfulWrites += 1;
      state.sessionId = commit.next.id;
      state.revision = commit.next.revision;
      if (signal.aborted) {
        ledger.deliveryAbortedAfterCommit += 1;
        this.deps.onMetric?.("deliveryAbortedAfterCommit", 1);
        return "abortedAfterCommit";
      }
    }
    return result;
  }

  private emitTerminal(
    emit: (event: PathStreamEvent) => void,
    envelope: () => {
      eventId: string;
      occurredAt: string;
      traceId: string;
      schemaVersion: 1;
      requestId: string;
      sessionId: string | null;
      revision: number | null;
      seq: number;
      at: string;
    },
    built:
      | { kind: "choice"; commit: PathStoreCommit; question: ChoiceQuestion }
      | { kind: "path"; commit: PathStoreCommit; document: ReturnType<typeof toLearningPathDocument> },
  ) {
    if (built.kind === "choice") {
      emit({
        ...envelope(),
        type: "choice.ready",
        question: built.question,
        runSummary: derivePathRunSummary(built.commit.next.candidateSet),
      });
      return;
    }
    const path = built.commit.next.publishedPath;
    if (path === null) throw new Error("path terminal missing published path");
    emit({
      ...envelope(),
      type: "path.ready",
      path,
      document: built.document,
      runSummary: derivePathRunSummary(path),
    });
  }

  private async generateFromGoal(input: {
    originalGoal: string;
    effectiveGoal: string;
    contextText?: string;
    goalRevision: number;
    startedAtMs: number;
    signal: AbortSignal;
    emitStage: (type: "stage.started" | "stage.completed", stage: PathGenerationStage) => void;
    ledger: PathCallLedger;
  }): Promise<
    | {
        kind: "ok";
        candidateSet: CandidateSet;
        catalog: EvidenceRecord[];
        ledger: SearchLedgerEntry[];
      }
    | { kind: "failed"; code: PathStreamFailureCode; runSummary: FailedPathRunSummary }
  > {
    const now = this.now();
    const goal: GoalRevision = {
      revision: input.goalRevision,
      originalGoal: input.originalGoal,
      effectiveGoal: input.effectiveGoal,
      ...(input.contextText !== undefined ? { contextText: input.contextText } : {}),
      goalIsClear: false,
      requiresGlobalSequence: false,
      boundaryNotes: [],
    };
    input.emitStage("stage.started", "planSearch");
    const plan = buildSearchQueryPlan(goal);
    input.emitStage("stage.completed", "planSearch");

    const catalog: EvidenceRecord[] = [];
    const searchLedger: SearchLedgerEntry[] = [];
    const searchWindow = async (
      stage: "searchRecentYear" | "searchExpandedWindow",
      window: "recentYear" | "expandedToThreeYears",
      from: Date,
      to: Date,
      inclusive: boolean,
    ) => {
      input.emitStage("stage.started", stage);
      if (window === "recentYear") input.ledger.recentSearchBatches += 1;
      else input.ledger.expandedSearchBatches += 1;
      const batchSignal = AbortSignal.any([
        input.signal,
        AbortSignal.timeout(window === "recentYear" ? PATH_BUDGETS_MS.recentSearch : PATH_BUDGETS_MS.expandedSearch),
      ]);
      const results = await Promise.allSettled(plan.map(async (item) => {
        if (window === "recentYear") input.ledger.recentSearchRequests += 1;
        else input.ledger.expandedSearchRequests += 1;
        input.ledger.httpAttempts.zhihu += 1;
        try {
          const records = await this.deps.search.search({
            queryId: item.queryId,
            query: item.query,
            publishedFromInclusive: from.toISOString(),
            publishedTo: to.toISOString(),
            publishedToInclusive: inclusive,
            limit: PROVIDER_LIMITS.zhihuResultLimit,
          }, batchSignal);
          return { item, records, error: null as ProviderRequestError | null };
        } catch (error) {
          const mapped = error instanceof ProviderRequestError
            ? error
            : new ProviderRequestError("unavailable", "search failed");
          return { item, records: [] as EvidenceRecord[], error: mapped };
        }
      }));
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { item, records, error } = result.value;
        if (error !== null) {
          searchLedger.push({
            queryId: item.queryId,
            queryHash: item.queryHash,
            window,
            origin: "fetched",
            status: "failed",
            evidenceIds: [],
            errorCode: error.code,
          });
          continue;
        }
        const windowed = records.filter((record) =>
          classifyEvidenceWindow({ now, publishedAt: record.publishedAt }) !== "outside",
        );
        const kept = acceptEvidence(windowed, catalog);
        catalog.push(...kept);
        searchLedger.push({
          queryId: item.queryId,
          queryHash: item.queryHash,
          window,
          origin: "fetched",
          status: "success",
          evidenceIds: kept.map((record) => record.id),
        });
      }
      input.emitStage("stage.completed", stage);
    };

    await searchWindow(
      "searchRecentYear",
      "recentYear",
      new Date(now.getTime() - SEARCH_WINDOWS_DAYS.recent * dayMs),
      now,
      true,
    );
    throwIfAborted(input.signal);
    if (!sufficientRecent(plan, searchLedger, catalog, now)) {
      await searchWindow(
        "searchExpandedWindow",
        "expandedToThreeYears",
        new Date(now.getTime() - SEARCH_WINDOWS_DAYS.expanded * dayMs),
        new Date(now.getTime() - SEARCH_WINDOWS_DAYS.recent * dayMs),
        false,
      );
      throwIfAborted(input.signal);
    }

    const generateOnce = async (fallback?: { rejectedExcerpt: string; issues: string[] }) => {
      input.ledger.httpAttempts.deepseek += 1;
      if (fallback === undefined) input.ledger.modelPrimaryCalls += 1;
      else input.ledger.modelFallbackCalls += 1;
      return this.deps.model.generateCandidateSet({
        goal,
        evidence: catalog,
        ...(fallback !== undefined ? { fallbackContext: fallback } : {}),
      }, input.signal);
    };

    const adopt = (raw: unknown, mode: "primary" | "regenerated", extra: DegradationReason[]) => {
      if (typeof raw !== "object" || raw === null) {
        return { ok: false as const, issues: ["primary output is not an object"] };
      }
      const reasons = [...extra];
      const failedSearch = searchLedger.some((entry) => entry.status === "failed");
      if (catalog.length === 0) reasons.push("noZhihuEvidence");
      else if (failedSearch) reasons.push("partialZhihuEvidence");
      const unique = [...new Set(reasons)];
      const withMeta = {
        ...(raw as Record<string, unknown>),
        generationMode: mode,
        degradationReasons: unique,
        goal: {
          ...((raw as { goal?: object }).goal ?? {}),
          revision: input.goalRevision,
          originalGoal: input.originalGoal,
          effectiveGoal: input.effectiveGoal,
          ...(input.contextText !== undefined ? { contextText: input.contextText } : {}),
        },
      };
      const parsed = CandidateSetSchema.safeParse(withMeta);
      if (!parsed.success) {
        return { ok: false as const, issues: parsed.error.issues.map((item) => item.message).slice(0, 32) };
      }
      const quality = qualityIssues(parsed.data);
      if (quality.length > 0) {
        return { ok: false as const, issues: quality, reason: "primaryQualityRejected" as const };
      }
      return { ok: true as const, value: parsed.data };
    };

    input.emitStage("stage.started", "generateCandidates");
    let primaryRaw: unknown;
    try {
      primaryRaw = await generateOnce();
    } catch (error) {
      input.emitStage("stage.completed", "generateCandidates");
      if (input.signal.aborted) throw error;
      return { kind: "failed", code: "PROVIDER_UNAVAILABLE", runSummary: emptyFailedSummary() };
    }
    const primary = adopt(primaryRaw, "primary", []);
    input.emitStage("stage.completed", "generateCandidates");
    if (primary.ok) {
      return { kind: "ok", candidateSet: primary.value, catalog, ledger: searchLedger };
    }
    const remainingMs = PATH_BUDGETS_MS.total - (Date.now() - input.startedAtMs);
    if (remainingMs < PATH_BUDGETS_MS.fallbackMinRemaining) {
      return {
        kind: "failed",
        code: "GENERATION_INVALID",
        runSummary: {
          generationMode: null,
          degradationReasons: [primary.reason === "primaryQualityRejected" ? "primaryQualityRejected" : "primarySchemaInvalid"],
          sourceSummary: { zhihuCount: 0, mixedCount: 0, modelSupplementCount: 0 },
        },
      };
    }
    input.emitStage("stage.started", "fallbackGeneration");
    let fallbackRaw: unknown;
    try {
      fallbackRaw = await generateOnce({
        rejectedExcerpt: sanitizeRejectedExcerpt(primaryRaw),
        issues: boundIssues(primary.issues),
      });
    } catch (error) {
      input.emitStage("stage.completed", "fallbackGeneration");
      if (input.signal.aborted) throw error;
      return {
        kind: "failed",
        code: "PROVIDER_UNAVAILABLE",
        runSummary: {
          generationMode: null,
          degradationReasons: [primary.reason === "primaryQualityRejected" ? "primaryQualityRejected" : "primarySchemaInvalid"],
          sourceSummary: { zhihuCount: 0, mixedCount: 0, modelSupplementCount: 0 },
        },
      };
    }
    const rejection: DegradationReason = primary.reason === "primaryQualityRejected"
      ? "primaryQualityRejected"
      : "primarySchemaInvalid";
    const fallback = adopt(fallbackRaw, "regenerated", [rejection]);
    input.emitStage("stage.completed", "fallbackGeneration");
    if (!fallback.ok) {
      return {
        kind: "failed",
        code: "GENERATION_INVALID",
        runSummary: {
          generationMode: null,
          degradationReasons: [rejection],
          sourceSummary: { zhihuCount: 0, mixedCount: 0, modelSupplementCount: 0 },
        },
      };
    }
    return { kind: "ok", candidateSet: fallback.value, catalog, ledger: searchLedger };
  }

  private async buildTerminalSession(input: {
    sessionId: string;
    revision: number;
    previous: PathGenerationSession | null;
    candidateSet: CandidateSet;
    evidenceCatalog: EvidenceRecord[];
    searchLedger: SearchLedgerEntry[];
    choiceAnswers: ChoiceAnswer[];
    supersededChoiceSets: SupersededChoiceSet[];
    ledger: PathCallLedger;
    signal: AbortSignal;
    emitStage: (type: "stage.started" | "stage.completed", stage: PathGenerationStage) => void;
  }): Promise<
    | { kind: "choice"; commit: PathStoreCommit; question: ChoiceQuestion }
    | { kind: "path"; commit: PathStoreCommit; document: ReturnType<typeof toLearningPathDocument> }
    | { kind: "failed"; code: PathStreamFailureCode; runSummary: FailedPathRunSummary }
  > {
    const base = {
      id: input.sessionId,
      tenantId: this.deps.actor.tenantId,
      principalId: this.deps.actor.principalId,
      revision: input.revision,
      candidateSet: input.candidateSet,
      evidenceCatalog: input.evidenceCatalog,
      searchLedger: input.searchLedger,
      choiceAnswers: input.choiceAnswers,
      supersededChoiceSets: input.supersededChoiceSets,
    };
    if (input.candidateSet.questions.length > 0) {
      const question = firstVisibleUnanswered(input.candidateSet.questions, input.choiceAnswers);
      if (question === null) {
        return { kind: "failed", code: "GENERATION_INVALID", runSummary: emptyFailedSummary() };
      }
      return {
        kind: "choice",
        question,
        commit: {
          next: {
            ...base,
            status: "awaitingChoice",
            currentQuestionId: question.id,
            publishedPath: input.previous?.publishedPath ?? null,
          },
          newSnapshot: null,
        },
      };
    }
    input.emitStage("stage.started", "prune");
    const pruned = pruneCandidateSet(input.candidateSet, []);
    input.emitStage("stage.completed", "prune");
    if (!pruned.ok) {
      return { kind: "failed", code: "GENERATION_INVALID", runSummary: emptyFailedSummary() };
    }
    const projected = await this.projectPath({
      revision: input.revision,
      goal: input.candidateSet.goal,
      generationMode: input.candidateSet.generationMode,
      degradationReasons: input.candidateSet.degradationReasons,
      graph: pruned.value,
      catalog: input.evidenceCatalog,
      ledger: input.ledger,
      emitStage: input.emitStage,
    });
    if (projected.kind === "failed") return projected;
    const next: PathGenerationSession = {
      ...base,
      status: "ready",
      currentQuestionId: null,
      publishedPath: projected.path,
    };
    return {
      kind: "path",
      document: projected.document,
      commit: {
        next,
        newSnapshot: PublishedPathSnapshotSchema.parse({
          tenantId: this.deps.actor.tenantId,
          principalId: this.deps.actor.principalId,
          planInstanceId: projected.path.planInstanceId,
          revision: projected.path.revision,
          path: projected.path,
        }),
      },
    };
  }

  private async projectPath(input: {
    revision: number;
    goal: GoalRevision;
    generationMode: CandidateSet["generationMode"];
    degradationReasons: DegradationReason[];
    graph: PrunedGraph;
    catalog: EvidenceRecord[];
    ledger: PathCallLedger;
    emitStage: (type: "stage.started" | "stage.completed", stage: PathGenerationStage) => void;
  }): Promise<
    | { kind: "ok"; path: FinalLearningPath; document: ReturnType<typeof toLearningPathDocument> }
    | { kind: "failed"; code: PathStreamFailureCode; runSummary: FailedPathRunSummary }
  > {
    input.emitStage("stage.started", "projectRenderer");
    input.ledger.rendererCalls += 1;
    const referenced = listReferencedEvidenceIds(input.graph.carriers, input.graph.concepts, input.graph.disputes);
    const evidenceCatalog = input.catalog.filter((item) => referenced.has(item.id));
    const pathResult = FinalLearningPathSchema.safeParse({
      id: this.uuid().toLowerCase(),
      planInstanceId: this.uuid().toLowerCase(),
      revision: input.revision,
      title: vendorTitle(input.goal.effectiveGoal),
      description: vendorDescription(input.goal.effectiveGoal),
      goal: input.goal,
      generationMode: input.generationMode,
      degradationReasons: input.degradationReasons,
      carriers: input.graph.carriers,
      concepts: input.graph.concepts,
      edges: input.graph.edges,
      flowGroups: input.graph.flowGroups,
      disputes: input.graph.disputes,
      ...(input.graph.executionSequence !== undefined
        ? { executionSequence: input.graph.executionSequence }
        : {}),
      evidenceCatalog,
      sourceSummary: computeSourceSummary(input.graph.carriers, input.graph.concepts, input.graph.disputes),
    });
    if (!pathResult.success) {
      input.emitStage("stage.completed", "projectRenderer");
      return { kind: "failed", code: "GENERATION_INVALID", runSummary: emptyFailedSummary() };
    }
    try {
      const document = this.projectDocument(pathResult.data);
      validateLearningPathProjection(pathResult.data, document);
      const expected = toLearningPathDocument(pathResult.data);
      const [left, right] = await Promise.all([
        createLearningPathDocumentDigest(document),
        createLearningPathDocumentDigest(expected),
      ]);
      if (left !== right) {
        throw new RendererInvalidError("document digest mismatch");
      }
      input.emitStage("stage.completed", "projectRenderer");
      return { kind: "ok", path: pathResult.data, document };
    } catch {
      input.emitStage("stage.completed", "projectRenderer");
      return {
        kind: "failed",
        code: "RENDERER_INVALID",
        runSummary: derivePathRunSummary(pathResult.data),
      };
    }
  }
}

export type { PathSessionStore } from "./contracts.ts";
export const createPathGenerationService = (deps: PathServiceDeps) => new PathGenerationService(deps);
