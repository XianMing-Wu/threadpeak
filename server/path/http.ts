import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import Fastify from "fastify";
import {
  ActorContextSchema,
  PATH_ERROR_POLICY,
  PATH_HTTP_BODY_LIMIT_BYTES,
  PathGenerationRequestSchema,
  PathHttpErrorSchema,
  PathSessionReadResponseSchema,
  PathStreamEventSchema,
  derivePathRunSummary,
  type ActorContext,
  type PathHttpError,
  type PathPreStreamErrorCode,
} from "./contracts.ts";
import { loadPathRuntimeConfig, loadTestConfig, readApplicationDatabaseUrl, type PathRuntimeConfig } from "./config.ts";
import {
  createDeepSeekProvider,
  createZhihuSearchProvider,
  parseThinkingTier,
  type EvidenceSearchProvider,
  type StructuredPathModelProvider,
} from "./providers.ts";
import {
  InMemoryPathSessionStore,
  PathGenerationService,
  PathPreStreamError,
  openPersistentPathSessionStore,
  type ClosablePathSessionStore,
  type PathSessionStore,
} from "./service.ts";
import {
  toLearningPathDocument,
  validateLearningPathProjection,
} from "./renderer.ts";
import { createLearningPathDocumentDigest } from "./renderer.ts";

export const DEFAULT_LOCAL_ACTOR = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  principalId: "22222222-2222-4222-8222-222222222222",
  traceId: "local-path-trace",
} as const;

type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  raw: {
    on: (event: string, listener: () => void) => void;
    off: (event: string, listener: () => void) => void;
  };
};

type OutgoingReply = {
  status: (code: number) => OutgoingReply;
  type: (value: string) => OutgoingReply;
  header: (name: string, value: string) => OutgoingReply;
  send: (payload: unknown) => unknown;
};

export type PathAppDeps = {
  config?: PathRuntimeConfig;
  store?: PathSessionStore;
  search?: EvidenceSearchProvider;
  model?: StructuredPathModelProvider;
  now?: () => Date;
  actorFromRequest?: (request: IncomingRequest) => ActorContext;
  abortSignal?: AbortSignal;
  projectDocument?: typeof toLearningPathDocument;
  logger?: boolean;
};

const requestIdOf = (body: unknown) => {
  if (
    typeof body === "object"
    && body !== null
    && "requestId" in body
    && typeof body.requestId === "string"
  ) {
    return body.requestId;
  }
  return randomUUID().toLowerCase();
};

const header = (request: IncomingRequest, name: string) => {
  const value = request.headers[name];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

const actorFromHeaders = (request: IncomingRequest): ActorContext => {
  const tenantId = header(request, "x-threadpeak-tenant-id") ?? DEFAULT_LOCAL_ACTOR.tenantId;
  const principalId = header(request, "x-threadpeak-principal-id") ?? DEFAULT_LOCAL_ACTOR.principalId;
  const traceId = header(request, "x-threadpeak-trace-id")
    ?? header(request, "x-trace-id")
    ?? DEFAULT_LOCAL_ACTOR.traceId;
  return ActorContextSchema.parse({ tenantId, principalId, traceId });
};

const writeHttpError = (
  reply: OutgoingReply,
  status: number,
  code: PathPreStreamErrorCode,
  requestId: string,
  traceId: string,
) => {
  const policy = PATH_ERROR_POLICY[code];
  const body = PathHttpErrorSchema.parse({
    requestId,
    code,
    message: policy.publicMessage,
    retryable: policy.retryable,
    traceId,
  } satisfies PathHttpError);
  return reply.status(status).type("application/json").send(body);
};

const contentTypeOf = (request: IncomingRequest) =>
  (request.headers["content-type"] ?? "").toString().split(";", 1)[0]?.trim().toLowerCase() ?? "";

const combineSignals = (left: AbortSignal, right?: AbortSignal) => {
  if (right === undefined) return left;
  return AbortSignal.any([left, right]);
};

export const buildPathApp = async (deps: PathAppDeps = {}) => {
  const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
  const config = deps.config ?? (isTest ? loadTestConfig() : loadPathRuntimeConfig());
  let ownedStore: ClosablePathSessionStore | undefined;
  const store = deps.store ?? (isTest || readApplicationDatabaseUrl() === undefined
    ? new InMemoryPathSessionStore()
    : await (async () => {
      ownedStore = await openPersistentPathSessionStore();
      return ownedStore;
    })());
  const search = deps.search ?? createZhihuSearchProvider(config);
  const injectedModel = deps.model;
  const actorFromRequest = deps.actorFromRequest ?? actorFromHeaders;

  const app = Fastify({
    logger: deps.logger ?? false,
    bodyLimit: PATH_HTTP_BODY_LIMIT_BYTES,
    requestTimeout: 90_000,
    connectionTimeout: 90_000,
  });
  app.addHook("onClose", async () => {
    if (ownedStore !== undefined) await ownedStore.close();
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      if (bytes.byteLength > PATH_HTTP_BODY_LIMIT_BYTES) {
        done(Object.assign(new Error("payload too large"), { statusCode: 413 }));
        return;
      }
      if (bytes.byteLength === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(bytes.toString("utf8")));
      } catch {
        done(Object.assign(new Error("malformed json"), { statusCode: 400 }));
      }
    },
  );

  app.setErrorHandler((error, request, reply) => {
    const actor = ActorContextSchema.safeParse(actorFromRequest(request as IncomingRequest));
    const requestId = requestIdOf(request.body);
    const traceId = actor.success ? actor.data.traceId : DEFAULT_LOCAL_ACTOR.traceId;
    if ((error as { statusCode?: number }).statusCode === 413) {
      return writeHttpError(reply as OutgoingReply, 413, "INVALID_REQUEST", requestId, traceId);
    }
    if ((error as { statusCode?: number }).statusCode === 400) {
      return writeHttpError(reply as OutgoingReply, 400, "INVALID_REQUEST", requestId, traceId);
    }
    if ((error as { statusCode?: number }).statusCode === 415) {
      return writeHttpError(reply as OutgoingReply, 415, "INVALID_REQUEST", requestId, traceId);
    }
    return writeHttpError(reply as OutgoingReply, 500, "INTERNAL_ERROR", requestId, traceId);
  });

  app.post("/api/paths/generate/stream", async (request, reply) => {
    const incoming = request as IncomingRequest;
    const outgoing = reply as OutgoingReply;
    const actor = actorFromRequest(incoming);
    const requestId = requestIdOf(request.body);
    if (contentTypeOf(incoming) !== "application/json") {
      return writeHttpError(outgoing, 415, "INVALID_REQUEST", requestId, actor.traceId);
    }
    const parsed = PathGenerationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return writeHttpError(outgoing, 422, "INVALID_REQUEST", requestId, actor.traceId);
    }

    const abort = new AbortController();
    const onClientAbort = () => abort.abort();
    request.raw.on("aborted", onClientAbort);
    const signal = combineSignals(abort.signal, deps.abortSignal);
    const model = injectedModel ?? createDeepSeekProvider(config, fetch, {
      thinkingTier: parseThinkingTier(header(incoming, "x-threadpeak-thinking-mode")),
    });
    const service = new PathGenerationService({
      actor,
      store,
      search,
      model,
      ...(deps.now !== undefined ? { now: deps.now } : {}),
      ...(deps.projectDocument !== undefined ? { projectDocument: deps.projectDocument } : {}),
    });

    const stream = new PassThrough();
    let started = false;
    const startStream = () => {
      if (started) return;
      started = true;
      outgoing
        .status(200)
        .type("application/x-ndjson")
        .header("cache-control", "no-store")
        .header("x-accel-buffering", "no")
        .send(stream);
    };
    const writeEvent = (event: unknown) => {
      startStream();
      stream.write(`${JSON.stringify(PathStreamEventSchema.parse(event))}\n`);
    };

    try {
      await service.execute(parsed.data, signal, writeEvent);
      request.raw.off("aborted", onClientAbort);
      if (!started) {
        return outgoing
          .status(200)
          .type("application/x-ndjson")
          .header("cache-control", "no-store")
          .send("");
      }
      stream.end();
      return outgoing;
    } catch (error) {
      request.raw.off("aborted", onClientAbort);
      if (started) {
        stream.end();
        return outgoing;
      }
      if (error instanceof PathPreStreamError) {
        const status = error.code === "SESSION_NOT_FOUND"
          ? 404
          : error.code === "REVISION_CONFLICT"
            ? 409
            : error.code === "INTERNAL_ERROR"
              ? 500
              : 422;
        return writeHttpError(outgoing, status, error.code, error.requestId, actor.traceId);
      }
      throw error;
    }
  });

  app.get("/api/paths/sessions/:sessionId", async (request, reply) => {
    const incoming = request as IncomingRequest;
    const outgoing = reply as OutgoingReply;
    const actor = actorFromRequest(incoming);
    const params = request.params as { sessionId: string };
    const session = await store.get(actor, params.sessionId, AbortSignal.timeout(1_000));
    if (session === null) {
      return writeHttpError(outgoing, 404, "SESSION_NOT_FOUND", randomUUID().toLowerCase(), actor.traceId);
    }
    try {
      const runSummary = derivePathRunSummary(
        session.status === "ready" && session.publishedPath !== null
          ? session.publishedPath
          : session.candidateSet,
      );
      let document = null;
      if (session.publishedPath !== null) {
        const project = deps.projectDocument ?? toLearningPathDocument;
        document = project(session.publishedPath);
        validateLearningPathProjection(session.publishedPath, document);
        const replayed = toLearningPathDocument(session.publishedPath);
        const [left, right] = await Promise.all([
          createLearningPathDocumentDigest(document),
          createLearningPathDocumentDigest(replayed),
        ]);
        if (left !== right) throw new Error("document digest mismatch");
      }
      return outgoing.status(200).send(PathSessionReadResponseSchema.parse({
        session,
        runSummary,
        document,
      }));
    } catch {
      return writeHttpError(outgoing, 500, "INTERNAL_ERROR", randomUUID().toLowerCase(), actor.traceId);
    }
  });

  return app;
};

export const buildTestApp = buildPathApp;

export const startPathServer = async (deps: PathAppDeps = {}) => {
  const config = deps.config ?? loadPathRuntimeConfig();
  if (!config.allowLiveCalls && deps.search === undefined) {
    throw new Error("live path generation is disabled; set THREADPEAK_ALLOW_LIVE_CALLS=1");
  }
  const app = await buildPathApp({
    ...deps,
    config,
    logger: deps.logger ?? false,
  });
  await app.listen({ host: config.listenHost, port: config.listenPort });
  return app;
};

const isDirectRun = process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
if (isDirectRun) {
  startPathServer().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "path server failed to start"}\n`);
    process.exit(1);
  });
}
