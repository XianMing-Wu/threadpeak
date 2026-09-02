import { createHash } from "node:crypto";
import type { LearningPathDocument } from "../../src/vendor/learning-path-3d/index.js";
import {
  hasReservedPresentationPrefix,
  RendererEvidenceUrlSchema,
  validateLearningPathDocument,
  VendorBodySchema,
  type FinalLearningPath,
} from "./contracts.ts";


export const PRESENTATION_START_CARD = Object.freeze({
  eyebrow: "路线起点",
  title: "从这里出发",
  summary: "沿着已生成的学习载体依次前进。",
});

export function presentationStartIds(digest: string) {
  if (!/^[a-f0-9]{48}$/.test(digest)) {
    throw new Error("presentation start digest must be 48 lowercase hex characters");
  }
  return Object.freeze({
    subjectId: `ps-${digest}`,
    cardId: `psc-${digest}`,
    flowId: `psf-${digest}`,
  });
}

export function entrySubjectOwnsConcepts(document: LearningPathDocument): boolean {
  return document.structure.concepts.some(
    (concept) => concept.subjectId === document.structure.entrySubjectId,
  );
}

const collectDocumentIds = (document: LearningPathDocument) => {
  const ids = new Set<string>([
    document.id,
    document.structure.entrySubjectId,
    ...document.structure.goalSubjectIds,
  ]);
  for (const subject of document.structure.subjects) {
    ids.add(subject.id);
    ids.add(subject.cardRef);
  }
  for (const concept of document.structure.concepts) {
    ids.add(concept.id);
    ids.add(concept.subjectId);
    ids.add(concept.cardRef);
    ids.add(concept.actionRef);
  }
  for (const edge of document.structure.flow) {
    ids.add(edge.id);
    ids.add(edge.fromSubjectId);
    ids.add(edge.toSubjectId);
  }
  for (const group of document.structure.flowGroups) {
    ids.add(group.id);
    ids.add(group.anchorSubjectId);
  }
  for (const card of document.data.cards) ids.add(card.id);
  for (const action of document.data.actions) {
    ids.add(action.id);
    ids.add(action.resourceId);
  }
  for (const resource of document.data.resources) ids.add(resource.id);
  return ids;
};

export function withPresentationStart(
  document: LearningPathDocument,
  digest: string,
): LearningPathDocument {
  const ids = presentationStartIds(digest);
  const used = collectDocumentIds(document);
  for (const id of Object.values(ids)) {
    if (used.has(id)) {
      throw new Error(`presentation start id ${id} collided`);
    }
  }
  return {
    ...document,
    structure: {
      ...document.structure,
      entrySubjectId: ids.subjectId,
      subjects: [
        { id: ids.subjectId, cardRef: ids.cardId },
        ...document.structure.subjects,
      ],
      flow: [
        {
          id: ids.flowId,
          fromSubjectId: ids.subjectId,
          toSubjectId: document.structure.entrySubjectId,
        },
        ...document.structure.flow,
      ],
    },
    data: {
      ...document.data,
      cards: [
        { id: ids.cardId, ...PRESENTATION_START_CARD },
        ...document.data.cards,
      ],
    },
  };
}

export async function ensureRuntimeEntrySubject(
  document: LearningPathDocument,
): Promise<LearningPathDocument> {
  if (!entrySubjectOwnsConcepts(document)) return document;
  const digest = await sha256Hex48(document.id);
  return withPresentationStart(document, digest);
}

const sha256Hex48 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
};

export const MODEL_SUPPLEMENT_CARD_BODY = VendorBodySchema.parse(
  "模型补充，未由本次知乎材料验证。",
);

export class RendererInvalidError extends Error {
  readonly code = "RENDERER_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "RendererInvalidError";
  }
}

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const WIRE_ID = /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/;

const assertWireId = (value: string, label: string) => {
  if (value.length < 1 || value.length > 64 || !WIRE_ID.test(value)) {
    throw new RendererInvalidError(`${label} ${value} is not a vendor wire id`);
  }
};

const documentId = (pathId: string) => `lp-${pathId}`;
const subjectId = (carrierId: string) => `s-${carrierId}`;
const conceptId = (id: string) => `c-${id}`;
const flowId = (edgeId: string) => `f-${edgeId}`;
const flowGroupId = (groupId: string) => `g-${groupId}`;
const subjectCardId = (carrierId: string) => `cs-${carrierId}`;
const conceptCardId = (id: string) => `cc-${id}`;
const actionId = (id: string) => `a-${id}`;
const resourceId = (evidenceId: string) => `r-${evidenceId}`;
const modelResourceId = (id: string) => `rm-${id}`;

const terminalDigest = (pathId: string, terminalCarrierId: string) =>
  sha256Hex(`${pathId}\0${terminalCarrierId}`).slice(0, 48);

const presentationGoalId = (digest: string) => `pg-${digest}`;
const presentationCardId = (digest: string) => `pc-${digest}`;
const presentationFlowId = (digest: string) => `pf-${digest}`;
const presentationStartDigest = (pathId: string) => sha256Hex(pathId).slice(0, 48);

const topologicalCarrierIds = (path: FinalLearningPath): string[] => {
  const incoming = new Map(path.carriers.map((carrier) => [carrier.id, 0]));
  const outgoing = new Map(path.carriers.map((carrier) => [carrier.id, [] as string[]]));
  for (const edge of path.edges) {
    outgoing.get(edge.fromCarrierId)?.push(edge.toCarrierId);
    incoming.set(edge.toCarrierId, (incoming.get(edge.toCarrierId) ?? 0) + 1);
  }
  const ready = path.carriers
    .map((carrier) => carrier.id)
    .filter((id) => incoming.get(id) === 0)
    .sort((left, right) => left.localeCompare(right));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const nextIncoming = (incoming.get(next) ?? 1) - 1;
      incoming.set(next, nextIncoming);
      if (nextIncoming === 0) {
        ready.push(next);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }
  if (ordered.length !== path.carriers.length) {
    throw new RendererInvalidError("carrier graph is not a DAG");
  }
  return ordered;
};

const modelSearchHref = (title: string) => {
  const href = `https://www.zhihu.com/search?q=${encodeURIComponent(title)}`;
  return RendererEvidenceUrlSchema.parse(href);
};

const evidenceById = (path: FinalLearningPath) =>
  new Map(path.evidenceCatalog.map((record) => [record.id, record]));

export function toLearningPathDocument(path: FinalLearningPath): LearningPathDocument {
  for (const carrier of path.carriers) {
    if (hasReservedPresentationPrefix(carrier.id)) {
      throw new RendererInvalidError("carrier id uses a reserved presentation prefix");
    }
  }
  for (const concept of path.concepts) {
    if (hasReservedPresentationPrefix(concept.id)) {
      throw new RendererInvalidError("concept id uses a reserved presentation prefix");
    }
  }

  const catalog = evidenceById(path);
  const order = topologicalCarrierIds(path);
  const orderHint = new Map(order.map((id, index) => [id, index + 1]));
  const incoming = new Map(path.carriers.map((carrier) => [carrier.id, 0]));
  const outgoing = new Map(path.carriers.map((carrier) => [carrier.id, 0]));
  for (const edge of path.edges) {
    incoming.set(edge.toCarrierId, (incoming.get(edge.toCarrierId) ?? 0) + 1);
    outgoing.set(edge.fromCarrierId, (outgoing.get(edge.fromCarrierId) ?? 0) + 1);
  }
  const entries = path.carriers.filter((carrier) => incoming.get(carrier.id) === 0);
  if (entries.length !== 1 || entries[0] === undefined) {
    throw new RendererInvalidError("final path must have exactly one entry");
  }
  const terminals = path.carriers.filter((carrier) => outgoing.get(carrier.id) === 0);
  if (terminals.length === 0) {
    throw new RendererInvalidError("final path needs at least one terminal carrier");
  }

  const usedIds = new Set<string>();
  const claim = (id: string, label: string) => {
    assertWireId(id, label);
    if (usedIds.has(id)) throw new RendererInvalidError(`${label} ${id} collided`);
    usedIds.add(id);
  };

  claim(documentId(path.id), "document");
  for (const carrier of path.carriers) {
    claim(subjectId(carrier.id), "subject");
    claim(subjectCardId(carrier.id), "subject card");
  }
  for (const concept of path.concepts) {
    claim(conceptId(concept.id), "concept");
    claim(conceptCardId(concept.id), "concept card");
    claim(actionId(concept.id), "action");
    if (concept.source.origin === "modelSupplement") {
      claim(modelResourceId(concept.id), "model resource");
    }
  }
  for (const edge of path.edges) claim(flowId(edge.id), "flow");
  for (const group of path.flowGroups) claim(flowGroupId(group.id), "flow group");
  for (const record of path.evidenceCatalog) claim(resourceId(record.id), "resource");

  const presentation = terminals.map((carrier) => {
    const digest = terminalDigest(path.id, carrier.id);
    const ids = {
      subjectId: presentationGoalId(digest),
      cardId: presentationCardId(digest),
      flowId: presentationFlowId(digest),
      fromCarrierId: carrier.id,
    };
    claim(ids.subjectId, "presentation goal");
    claim(ids.cardId, "presentation card");
    claim(ids.flowId, "presentation flow");
    return ids;
  });

  const startDigest = presentationStartDigest(path.id);
  const startIds = presentationStartIds(startDigest);
  claim(startIds.subjectId, "presentation start");
  claim(startIds.cardId, "presentation start card");
  claim(startIds.flowId, "presentation start flow");

  const subjects = [
    ...path.carriers.map((carrier) => ({
      id: subjectId(carrier.id),
      cardRef: subjectCardId(carrier.id),
      orderHint: orderHint.get(carrier.id) ?? 0,
    })),
    ...presentation.map((item) => ({
      id: item.subjectId,
      cardRef: item.cardId,
    })),
  ];

  const concepts = path.concepts.map((concept) => ({
    id: conceptId(concept.id),
    subjectId: subjectId(concept.carrierId),
    cardRef: conceptCardId(concept.id),
    actionRef: actionId(concept.id),
    orderHint: concept.orderHint,
  }));

  const flow = [
    ...path.edges.map((edge) => {
      const semantics = {
        ...(edge.splitGroupId !== undefined ? { splitGroupId: flowGroupId(edge.splitGroupId) } : {}),
        ...(edge.joinGroupId !== undefined ? { joinGroupId: flowGroupId(edge.joinGroupId) } : {}),
      };
      return {
        id: flowId(edge.id),
        fromSubjectId: subjectId(edge.fromCarrierId),
        toSubjectId: subjectId(edge.toCarrierId),
        ...(Object.keys(semantics).length > 0 ? { semantics } : {}),
      };
    }),
    ...presentation.map((item) => ({
      id: item.flowId,
      fromSubjectId: subjectId(item.fromCarrierId),
      toSubjectId: item.subjectId,
    })),
  ];

  const flowGroups = path.flowGroups.map((group) =>
    group.type === "split"
      ? {
          id: flowGroupId(group.id),
          type: "split" as const,
          anchorSubjectId: subjectId(group.anchorCarrierId),
          policy: "parallel" as const,
        }
      : {
          id: flowGroupId(group.id),
          type: "join" as const,
          anchorSubjectId: subjectId(group.anchorCarrierId),
          policy: "all-required" as const,
        },
  );

  const cards = [
    ...path.carriers.map((carrier) => ({
      id: subjectCardId(carrier.id),
      eyebrow: "学习载体",
      title: carrier.title,
      summary: carrier.summary,
    })),
    ...path.concepts.map((concept) => ({
      id: conceptCardId(concept.id),
      eyebrow: "概念",
      title: concept.title,
      summary: concept.summary,
      ...(concept.source.origin === "modelSupplement"
        ? { body: MODEL_SUPPLEMENT_CARD_BODY }
        : {}),
    })),
    ...presentation.map((item) => ({
      id: item.cardId,
      eyebrow: "学习目标",
      title: path.title,
      summary: "完成这条学习路径",
    })),
  ];

  const resources: Array<{ id: string; href: string }> = [];
  const resourceSeen = new Set<string>();
  const actions = path.concepts.map((concept) => {
    if (concept.source.origin === "modelSupplement") {
      const id = modelResourceId(concept.id);
      resources.push({ id, href: modelSearchHref(concept.title) });
      return {
        id: actionId(concept.id),
        kind: "open-resource" as const,
        label: "继续搜索（非引用）",
        resourceId: id,
        target: "blank" as const,
      };
    }
    const evidenceId = [...concept.source.evidenceIds].sort((left, right) => left.localeCompare(right))[0];
    if (evidenceId === undefined) {
      throw new RendererInvalidError(`concept ${concept.id} is missing evidence`);
    }
    const record = catalog.get(evidenceId);
    if (record === undefined) {
      throw new RendererInvalidError(`concept ${concept.id} references missing evidence`);
    }
    const id = resourceId(evidenceId);
    if (!resourceSeen.has(id)) {
      resourceSeen.add(id);
      resources.push({ id, href: RendererEvidenceUrlSchema.parse(record.sourceUrl) });
    }
    return {
      id: actionId(concept.id),
      kind: "open-resource" as const,
      label: "查看知乎来源",
      resourceId: id,
      target: "blank" as const,
    };
  });

  const document: LearningPathDocument = {
    protocol: "learning-path",
    version: "1.0",
    id: documentId(path.id),
    metadata: {
      title: path.title,
      description: path.description,
      locale: "zh-CN",
    },
    structure: {
      entrySubjectId: subjectId(entries[0].id),
      goalSubjectIds: presentation.map((item) => item.subjectId),
      subjects,
      concepts,
      flow,
      flowGroups,
    },
    data: {
      cards,
      resources,
      actions,
    },
    presentation: {
      layout: {
        direction: "top-to-bottom",
      },
    },
  };

  let started: LearningPathDocument
  try {
    started = withPresentationStart(document, startDigest);
  } catch (error) {
    throw new RendererInvalidError(
      error instanceof Error ? error.message : "presentation start is invalid",
    );
  }
  const validated = validateLearningPathDocument(started);
  if (!validated.ok) {
    throw new RendererInvalidError(validated.issues[0]?.message ?? "vendor document is invalid");
  }
  return validated.document;
}

const sameSet = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false;
  const expected = [...right].sort();
  return [...left].sort().every((value, index) => value === expected[index]);
};

export function validateLearningPathProjection(
  path: FinalLearningPath,
  document: LearningPathDocument,
): void {
  const expected = toLearningPathDocument(path);
  if (document.id !== expected.id || document.id !== `lp-${path.id}`) {
    throw new RendererInvalidError("document id does not match the path");
  }
  if (
    document.metadata.title !== path.title
    || document.metadata.description !== path.description
    || document.metadata.locale !== "zh-CN"
  ) {
    throw new RendererInvalidError("document metadata does not match the path");
  }
  if (!sameSet(document.structure.subjects.map((item) => item.id), expected.structure.subjects.map((item) => item.id))) {
    throw new RendererInvalidError("subject set does not match the path");
  }
  if (!sameSet(document.structure.concepts.map((item) => item.id), expected.structure.concepts.map((item) => item.id))) {
    throw new RendererInvalidError("concept set does not match the path");
  }
  if (!sameSet(document.structure.flow.map((item) => item.id), expected.structure.flow.map((item) => item.id))) {
    throw new RendererInvalidError("flow set does not match the path");
  }
  if (!sameSet(document.structure.flowGroups.map((item) => item.id), expected.structure.flowGroups.map((item) => item.id))) {
    throw new RendererInvalidError("flow group set does not match the path");
  }
  if (!sameSet(document.data.cards.map((item) => item.id), expected.data.cards.map((item) => item.id))) {
    throw new RendererInvalidError("card set does not match the path");
  }
  if (!sameSet(document.data.actions.map((item) => item.id), expected.data.actions.map((item) => item.id))) {
    throw new RendererInvalidError("action set does not match the path");
  }
  if (!sameSet(document.data.resources.map((item) => item.id), expected.data.resources.map((item) => item.id))) {
    throw new RendererInvalidError("resource set does not match the path");
  }
  if (JSON.stringify(document.structure) !== JSON.stringify(expected.structure)) {
    throw new RendererInvalidError("structure mapping does not match the path");
  }
  if (JSON.stringify(document.data) !== JSON.stringify(expected.data)) {
    throw new RendererInvalidError("data mapping does not match the path");
  }
}

export async function createLearningPathDocumentDigest(input: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(input));
}
