import {
  assertLearningPathDocument,
  compileValidatedLearningPathDocument,
  type LearningPathDocument,
} from "../content";
import {
  type GenerationFailure,
  type PageGenerationServices,
} from "../statecharts/page";
import {
  createLearningPathApplicationActor,
  selectActiveSessionRevision,
  selectApplicationCompletionCelebrationView,
  selectCompletionCelebrationActor,
  selectJourneyActor,
  selectLearningPathApplicationPhase,
  selectNodeCardActor,
  selectPathOrchestrationActor,
  selectProgressActor,
  selectSceneSessionActor,
  type LearningPathLaunchMode,
} from "../application/learning-path";
import { bindSceneSessionLifecycle } from "../application/scene-session";
import { subscribeActorSelector } from "../application/shared/subscribeActorSelector";
import { createBrowserLearningResourceNavigator } from "../infrastructure/browser/LearningResourceNavigator";
import { BrowserLearningProgressStorage } from "../infrastructure/browser/BrowserLearningProgressStorage";
import type { PreparedLearningPathCharacter } from "../infrastructure/three/character";
import {
  createDefaultLearningPathTemplateUrl,
  loadLearningPathTemplate,
} from "../host/learning-path/templateLoader";
import { readLearningPathWindowHostConfig } from "../host/learning-path/windowConfig";
import type { LearningPathBootstrapOptions } from "../host/learning-path/contracts";
import type { PersistedLearningPathChoice } from "../host/learning-path/templatePool";
import { createLearningPathXStateInspector } from "../diagnostics/LearningPathXStateInspector";
import {
  selectLearningProgressView,
  type LearningIntentKind,
  type LearningProgressEvent,
  type LearningProgressViewSnapshot,
} from "../progression";
import {
  NodeLearningPatchProjector,
  areNodeLearningProjectionsEqual,
  selectNodeLearningProjection,
  type NodeLearningProjection,
} from "../progression/presentation";
import type { JourneyEvent, JourneyIntent } from "../workflows/journey";
import type { CompletionCelebrationEvent } from "../workflows/completion-celebration";
import {
  LearningPathPageShell,
  type LearningPathPageViewModel,
} from "../ui/LearningPathPageShell";
import { resolveStandaloneLearningPathDom } from "../ui/LearningPathDom";
import {
  NodeCardPlacementController,
  createNodeCardViewModel,
  isNodeCardActionId,
  selectNodeCardInstance,
  type NodeCardActionId,
  type NodeCardInstanceReference,
} from "../ui/node-card";
import type {
  SceneRuntimeGatewayCommand,
} from "../runtime/gateway";
import {
  compileLearningPathRuntime,
  type CompiledLearningPathRuntime,
} from "./compileLearningPathRuntime";
import type {
  LearningPathSession,
  LearningPathSessionSnapshot,
} from "./LearningPathSession";
import { PageGenerationPresenter } from "./PageGenerationPresenter";
import type {
  LearningPathModuleError,
  LearningPathPageRuntimeHandle,
  LearningPathPageRuntimeOptions,
  LearningPathPublicPhase,
  LearningPathPublicSnapshot,
} from "./LearningPathPageRuntimeContracts";

type LearningPathSessionModule = typeof import("./LearningPathSession");
let learningPathSessionModulePromise: Promise<LearningPathSessionModule> | null = null;

type LearningPathCharacterModule = typeof import("../infrastructure/three/character/prepareLearningPathCharacter");
let learningPathCharacterModulePromise: Promise<LearningPathCharacterModule> | null = null;

function preloadLearningPathSessionModule(): Promise<LearningPathSessionModule> {
  learningPathSessionModulePromise ??= import("./LearningPathSession").catch((error) => {
    learningPathSessionModulePromise = null;
    throw error;
  });
  return learningPathSessionModulePromise;
}

function preloadLearningPathCharacterModule(): Promise<LearningPathCharacterModule> {
  learningPathCharacterModulePromise ??= import(
    "../infrastructure/three/character/prepareLearningPathCharacter"
  ).catch((error) => {
    learningPathCharacterModulePromise = null;
    throw error;
  });
  return learningPathCharacterModulePromise;
}

declare global {
  interface Window {
    __LEARNING_PATH_EXPERIENCE__?: Readonly<{
      getState(): unknown;
      selectNode(nodeId: string): boolean;
      dismissCard(): void;
    }>;
  }
}

/**
 * Overlay lifetime follows the page lifecycle, not transient interaction
 * locks. Movement and bridge animation may disable actions, but cannot unpin
 * an XState-owned card.
 */
export function shouldRenderLearningPathOverlays(input: Readonly<{
  pagePhase: string | undefined;
  hasSnapshot: boolean;
  hasRuntime: boolean;
  hasProgress: boolean;
}>): boolean {
  return input.pagePhase === "ready"
    && input.hasSnapshot
    && input.hasRuntime
    && input.hasProgress;
}

export function shouldActivateLearningPathSession(input: Readonly<{
  phase: string;
  sessionRevision: number | null;
  activatedSessionRevision: number | null;
  hasSession: boolean;
  hasPathOrchestrationActor: boolean;
}>): boolean {
  return input.phase === "active"
    && input.sessionRevision !== null
    && input.activatedSessionRevision !== input.sessionRevision
    && input.hasSession
    && input.hasPathOrchestrationActor;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatGenerationFailure(failure: GenerationFailure): string {
  switch (failure.kind) {
    case "validation": return `路径数据未通过校验：${failure.message}`;
    case "compilation": return `路径编译失败：${failure.message}`;
    case "compiled-contract": return `生成顺序不完整：${failure.message}`;
    case "presentation-preparation": return `3D 场景准备失败：${failure.message}`;
    case "presentation-timeout": return "路径动画等待超时，请重新生成。";
    case "presentation": return `路径动画失败：${failure.message}`;
    default: return "未找到学习路径模板，请重试。";
  }
}

/** Thin composition root shared by the standalone Demo/QA shell and the formal module API. */
export async function createLearningPathPageRuntime(
  options: LearningPathBootstrapOptions,
  runtimeOptions: LearningPathPageRuntimeOptions,
): Promise<LearningPathPageRuntimeHandle> {
  const elements = runtimeOptions.elements;
  const app = elements.root;
  const canvas = elements.canvas;
  const viewport = elements.viewport;
  const document = app.ownerDocument;
  const window = document.defaultView;
  if (!window) throw new Error("Learning-path runtime requires a browser window.");
  const mode = runtimeOptions.mode;
  const instanceId = runtimeOptions.instanceId;
  // Template selection and start-gate persistence belong exclusively to the
  // temporary standalone Demo/QA shell and stay out of the formal module path.
  const standaloneTemplatePool = runtimeOptions.standaloneTemplatePool ?? null;
  if (mode === "standalone" && !standaloneTemplatePool) {
    throw new Error("Standalone Demo/QA runtime requires its template-pool adapter.");
  }
  const presenter = new PageGenerationPresenter();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const resolveReducedMotion = (): boolean => (
    runtimeOptions?.reducedMotion ?? reducedMotionQuery.matches
  );
  const inspectorSearch = mode === "standalone" || runtimeOptions?.diagnostics
    ? window.location.search
    : "";
  const xstateInspector = await createLearningPathXStateInspector(inspectorSearch)
    .catch((error: unknown) => {
      console.warn("[learning-path] Stately Inspector could not start.", error);
      return null;
    });
  const learningProgressStorage = runtimeOptions?.learningProgressStorage
    ?? new BrowserLearningProgressStorage(() => window.localStorage);
  let persistedPathChoice = mode === "standalone"
    ? standaloneTemplatePool!.readPersistedLearningPathChoice(window.localStorage)
    : null;
  if (mode === "standalone" && persistedPathChoice) {
    try {
      standaloneTemplatePool!.writePersistedLearningPathChoice(
        window.localStorage,
        persistedPathChoice,
      );
    } catch {
      // Storage failures remain non-fatal; the persistence actor reports its
      // own read/write diagnostics once an experience starts.
    }
  }

  let disposed = false;
  let transactionSequence = 0;
  let progressSlotSequence = 0;
  let journeyTransactionSequence = 0;
  let applicationActor: ReturnType<typeof createLearningPathApplicationActor> | null = null;
  let session: LearningPathSession | null = null;
  let compiledRuntime: CompiledLearningPathRuntime | null = null;
  let compiledSourceForPresentation: ReturnType<typeof compileValidatedLearningPathDocument> | null = null;
  let progressSubscription: { unsubscribe(): void } | null = null;
  let progressCallbackSubscription: { unsubscribe(): void } | null = null;
  let celebrationSubscription: { unsubscribe(): void } | null = null;
  let nodeCardSubscription: { unsubscribe(): void } | null = null;
  let sceneSessionLifecycleSubscription: { unsubscribe(): void } | null = null;
  let applicationSubscription: { unsubscribe(): void } | null = null;
  let subscribedSessionRevision: number | null = null;
  let activatedSessionRevision: number | null = null;
  let lastSessionSnapshot: LearningPathSessionSnapshot | null = null;
  let lastCommittedArrivalNodeId: string | null = null;
  let lastHandledLearningLaunchRevision = 0;
  let templateRequest: AbortController | null = null;
  let preparedCharacter: PreparedLearningPathCharacter | null = null;
  let characterPreparationPromise: Promise<PreparedLearningPathCharacter> | null = null;
  let nodeLearningProjector: NodeLearningPatchProjector | null = null;
  let lastCompletionPlayCount = 0;
  let readyNotifiedSessionRevision: number | null = null;
  const applicationDiagnosticsEnabled = runtimeOptions?.diagnostics
    ?? (import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") === "1");
  const applicationDebugOutput = applicationDiagnosticsEnabled
    ? (() => {
        const outputId = `learning-path-${instanceId}-application-qa-debug`;
        const existing = app.querySelector(`#${outputId}`);
        if (existing instanceof HTMLOutputElement) return existing;
        const output = document.createElement("output");
        output.id = outputId;
        output.hidden = true;
        output.setAttribute("aria-hidden", "true");
        app.append(output);
        return output;
      })()
    : null;

  const publishApplicationDiagnostics = (): void => {
    if (!applicationDebugOutput || !applicationActor) return;
    const snapshot = applicationActor.getSnapshot();
    const scene = selectSceneSessionActor(snapshot);
    applicationDebugOutput.textContent = JSON.stringify({
      phase: selectLearningPathApplicationPhase(snapshot),
      stateValue: snapshot.value,
      activeSessionRevision: selectActiveSessionRevision(snapshot),
      ignoredEventCount: snapshot.context.ignoredEventCount,
      lastIgnoredEvent: snapshot.context.lastIgnoredEvent,
      sceneSession: scene
        ? {
            stateValue: scene.getSnapshot().value,
            sessionRevision: scene.getSnapshot().context.sessionRevision,
            gatewayAckSequence: scene.getSnapshot().context.gatewayAckSequence,
            lastGatewayAck: scene.getSnapshot().context.lastGatewayAck,
          }
        : null,
    });
  };

  const prepareCharacterAtGate = (): Promise<PreparedLearningPathCharacter> => {
    if (preparedCharacter) return Promise.resolve(preparedCharacter);
    characterPreparationPromise ??= preloadLearningPathCharacterModule()
      .then((module) => {
        if (disposed) throw new DOMException("Character preload cancelled.", "AbortError");
        const candidate = module.prepareLearningPathCharacter(
          runtimeOptions?.characterAssetUrls,
        );
        if (disposed) {
          candidate.character.dispose();
          throw new DOMException("Character preload cancelled.", "AbortError");
        }
        if (preparedCharacter) {
          candidate.character.dispose();
          return preparedCharacter;
        }
        preparedCharacter = candidate;
        return candidate;
      })
      .catch((error) => {
        characterPreparationPromise = null;
        throw error;
      });
    return characterPreparationPromise;
  };

  // Warm only Three core, GLTFLoader, CharacterRig and the four GLBs while the
  // generation gate is visible. Scene construction stays behind the button.
  void prepareCharacterAtGate().catch(() => {});

  const presentProgressView = (
    view: LearningProgressViewSnapshot,
  ): LearningProgressViewSnapshot => {
    if (runtimeOptions?.progressionMode !== "open") return view;
    const subjectStatusById = Object.freeze(Object.fromEntries(
      Object.keys(view.subjectStatusById).map((nodeId) => [nodeId, "completed"] as const),
    ));
    const conceptStatusById = Object.freeze(Object.fromEntries(
      Object.keys(view.conceptStatusById).map((nodeId) => [nodeId, "in-progress"] as const),
    ));
    const nodeStatusById = Object.freeze({
      ...subjectStatusById,
      ...conceptStatusById,
    });
    const nodeLearningStateById = Object.freeze(Object.fromEntries(
      Object.entries(view.nodeLearningStateById).map(([nodeId, state]) => [
        nodeId,
        Object.freeze({
          kind: state.kind,
          status: state.kind === "concept" ? "in-progress" : "completed",
        }),
      ]),
    )) as LearningProgressViewSnapshot["nodeLearningStateById"];
    return Object.freeze({
      ...view,
      subjectStatusById,
      conceptStatusById,
      nodeStatusById,
      nodeLearningStateById,
    });
  };

  const presentNodeLearningProjection = (
    projection: NodeLearningProjection,
  ): NodeLearningProjection => runtimeOptions?.progressionMode !== "open"
    ? projection
    : Object.freeze({
        goalNodeIds: projection.goalNodeIds,
        subjectStatusById: Object.freeze(Object.fromEntries(
          Object.keys(projection.subjectStatusById).map((nodeId) => [nodeId, "completed"] as const),
        )),
        conceptStatusById: Object.freeze(Object.fromEntries(
          Object.keys(projection.conceptStatusById).map((nodeId) => [nodeId, "in-progress"] as const),
        )),
      });

  const getProgressView = (): LearningProgressViewSnapshot | null => {
    const actor = applicationActor
      ? selectProgressActor(applicationActor.getSnapshot())
      : null;
    return actor
      ? presentProgressView(selectLearningProgressView(actor.getSnapshot().context.model))
      : null;
  };

  const getPublicSnapshot = (): LearningPathPublicSnapshot => {
    const dataPhase = app.dataset.pagePhase;
    const phase: LearningPathPublicPhase = disposed
      ? "disposed"
      : dataPhase === "ready"
        ? "ready"
        : dataPhase === "failed"
          ? "failed"
          : dataPhase === "generating"
            ? "generating"
            : "mounting";
    return Object.freeze({
      instanceId,
      phase,
      sessionRevision: getActiveSessionRevision(),
      session: session?.getSnapshot() ?? null,
      progress: getProgressView(),
    });
  };

  const reportError = (
    phase: LearningPathModuleError["phase"],
    error: unknown,
    message: string,
  ): void => {
    runtimeOptions?.onError?.(Object.freeze({ phase, error, message }));
  };

  const getActiveSessionRevision = (): number | null => (
    applicationActor ? selectActiveSessionRevision(applicationActor.getSnapshot()) : null
  );

  const sendProgress = (event: LearningProgressEvent): void => {
    const sessionRevision = getActiveSessionRevision();
    if (sessionRevision === null) return;
    applicationActor?.send({ type: "APP.PROGRESS.EVENT", sessionRevision, event });
  };

  const getActiveJourneyTransactionId = (): string | null => {
    const root = applicationActor;
    if (!root) return null;
    const journey = selectJourneyActor(root.getSnapshot());
    return journey?.getSnapshot().context.transactionId ?? null;
  };

  const getLatestJourneyTransactionId = (): string | null => {
    const root = applicationActor;
    if (!root) return null;
    const snapshot = selectJourneyActor(root.getSnapshot())?.getSnapshot();
    return snapshot?.context.transactionId
      ?? snapshot?.context.lastOutcome?.transactionId
      ?? null;
  };

  const sendJourney = (event: JourneyEvent): void => {
    const sessionRevision = getActiveSessionRevision();
    if (sessionRevision === null) return;
    applicationActor?.send({ type: "APP.JOURNEY.EVENT", sessionRevision, event });
  };

  const sendCompletionCelebration = (
    event: CompletionCelebrationEvent,
  ): void => {
    const sessionRevision = getActiveSessionRevision();
    if (sessionRevision === null) return;
    applicationActor?.send({
      type: "APP.COMPLETION_CELEBRATION.EVENT",
      sessionRevision,
      event,
    });
  };

  const getCompletionCelebrationView = () => {
    const root = applicationActor;
    return root ? selectApplicationCompletionCelebrationView(root.getSnapshot()) : null;
  };

  const requestJourney = (targetNodeId: string, intent: JourneyIntent): boolean => {
    sendJourney({ type: "REQUESTED", request: { targetNodeId, intent } });
    const root = applicationActor;
    if (!root) return false;
    const journey = selectJourneyActor(root.getSnapshot());
    const snapshot = journey?.getSnapshot();
    const accepted = Boolean(snapshot && (
      snapshot.matches("ready")
      || snapshot.matches("moving")
      || snapshot.matches("settling")
      || (snapshot.matches("idle") && snapshot.context.lastOutcome?.type === "settled")
    ));
    if (accepted && intent === "unlock" && snapshot?.context.plan && snapshot.context.transactionId) {
      sendProgress({
        type: "UNLOCK.COMMIT.REGISTERED",
        commit: {
          targetNodeId: snapshot.context.plan.targetNodeId,
          transactionId: snapshot.context.transactionId,
          requiredCompletionNodeIds: snapshot.context.plan.requiredCompletionNodeIds,
        },
      });
    }
    return accepted;
  };

  const getCardInstance = (): NodeCardInstanceReference | null => {
    const actor = applicationActor
      ? selectNodeCardActor(applicationActor.getSnapshot())
      : null;
    return actor ? selectNodeCardInstance(actor.getSnapshot()) : null;
  };

  const cardInstanceId = (
    sessionRevision: number,
    instance: NodeCardInstanceReference,
  ): string => `node-card-${sessionRevision}-${instance.revision}-${instance.nodeId}`;

  const sendCardAction = (
    actionId: NodeCardActionId,
    enabled = true,
  ): boolean => {
    const sessionRevision = getActiveSessionRevision();
    const instance = getCardInstance();
    if (sessionRevision === null || !instance) return false;
    applicationActor?.send({
      type: "APP.NODE_CARD.EVENT",
      sessionRevision,
      event: { type: "NODE_CARD.ACTION_REQUESTED", instance, actionId, enabled },
    });
    return getCardInstance() === null;
  };

  const dismissCard = (): void => {
    const sessionRevision = getActiveSessionRevision();
    const instance = getCardInstance();
    if (sessionRevision !== null && instance) {
      applicationActor?.send({
        type: "APP.NODE_CARD.EVENT",
        sessionRevision,
        event: { type: "NODE_CARD.DISMISS", instance },
      });
    }
  };

  const settleLearningAtNode = (nodeId: string): void => {
    const runtime = compiledRuntime;
    const sessionRevision = getActiveSessionRevision();
    if (!runtime || sessionRevision === null) return;
    sendProgress({ type: "LEARNING.SETTLED", nodeId });
    const progress = getProgressView();
    if (!progress) return;
    const launch = progress.lastLearningLaunch;
    if (!launch?.accepted || launch.revision <= lastHandledLearningLaunchRevision) return;
    lastHandledLearningLaunchRevision = launch.revision;
    const node = runtime.source.nodeById.get(nodeId);
    if (node?.entityKind !== "concept") return;
    const binding = runtime.actionRegistry.getAction(nodeId);
    if (!binding) return;
    const resourceIntent = launch.kind === "concept-start"
      ? "start"
      : launch.kind === "concept-continue"
        ? "continue"
        : launch.kind === "concept-review"
          ? "review"
          : null;
    if (!resourceIntent) return;
    applicationActor?.send({
      type: "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED",
      sessionRevision,
      event: {
        type: "RESOURCE.LAUNCH.REQUESTED",
        sessionRevision,
        intent: resourceIntent,
        launchId: `resource-${sessionRevision}-${launch.revision}-${binding.action.id}`,
        binding: {
          nodeId,
          actionId: binding.action.id,
          resourceId: binding.resource.id,
          href: binding.resource.href,
          target: binding.action.target ?? "self",
        },
      },
    });
  };

  const shell = new LearningPathPageShell(viewport, {
    onLaunchRequested: (detail) => { void requestGeneration(detail.action); },
    onCardActionRequested: (detail) => {
      const activeSession = session;
      const runtime = compiledRuntime;
      const sessionRevision = getActiveSessionRevision();
      const instance = getCardInstance();
      const current = getProgressView();
      if (!activeSession || !runtime || sessionRevision === null || !instance || !current
        || detail.instanceId !== cardInstanceId(sessionRevision, instance)
        || instance.nodeId !== detail.nodeId) return;
      // A card CTA is a completed UI interaction, independently of whether
      // its following domain request is accepted, rejected, launches a
      // resource or starts movement. Close the XState-owned pinned card before
      // issuing that request so no action branch can accidentally retain the
      // overlay (review/continue and future authored actions included).
      if (!isNodeCardActionId(detail.actionId) || !sendCardAction(detail.actionId)) return;
      if (runtimeOptions?.progressionMode === "open"
        && detail.actionId === "subject:enter") {
        activeSession.goToNode(detail.nodeId, "direct");
        return;
      }
      if (detail.actionId === "unlock:go") {
        sendProgress({ type: "UNLOCK.REQUESTED", nodeId: detail.nodeId });
        const decision = getProgressView()?.lastNavigationDecision;
        if (decision?.accepted) {
          if (!requestJourney(detail.nodeId, "unlock")) {
            const transactionId = getLatestJourneyTransactionId();
            if (transactionId) {
              sendProgress({
                type: "MOVEMENT.CANCELLED",
                safeNodeId: activeSession.getSnapshot().currentNodeId,
                reason: "host-rejected",
                transactionId,
              });
            }
          }
        }
        return;
      }
      if (detail.actionId === "concept:defer") {
        sendProgress({ type: "CONCEPT.DEFERRED", nodeId: detail.nodeId });
        return;
      }
      if (detail.actionId === "concept:complete") {
        sendProgress({ type: "CONCEPT.MARK_COMPLETED", nodeId: detail.nodeId });
        return;
      }
      const intentKind: LearningIntentKind | null = detail.actionId === "subject:enter"
        ? "subject-enter"
        : detail.actionId === "learn:start"
          ? "concept-start"
          : detail.actionId === "learn:continue"
            ? "concept-continue"
            : detail.actionId === "learn:review"
              ? "concept-review"
              : null;
      if (!intentKind) return;
      sendProgress({ type: "LEARNING.REQUESTED", nodeId: detail.nodeId, kind: intentKind });
      const decision = getProgressView()?.lastNavigationDecision;
      if (!decision?.accepted) return;
      const sessionSnapshot = activeSession.getSnapshot();
      const alreadySettled = sessionSnapshot.currentNodeId === detail.nodeId
        && !sessionSnapshot.isRunning
        && sessionSnapshot.visuallyIdle
        && sessionSnapshot.targetNodeId === null;
      if (alreadySettled) {
        if (requestJourney(
          detail.nodeId,
          detail.actionId === "learn:review" ? "review" : "learn",
        )) {
          settleLearningAtNode(detail.nodeId);
        }
      } else if (!requestJourney(
        detail.nodeId,
        detail.actionId === "learn:review" ? "review" : "learn",
      )) {
        const transactionId = getLatestJourneyTransactionId();
        if (transactionId) {
          sendProgress({
            type: "MOVEMENT.CANCELLED",
            safeNodeId: activeSession.getSnapshot().currentNodeId,
            reason: "host-rejected",
            transactionId,
          });
        }
      }
    },
    onCelebrationSettled: (detail) => {
      const celebration = getCompletionCelebrationView();
      if (celebration?.activeCount !== detail.playCount) return;
      sendCompletionCelebration({
        type: "PRESENTATION.ACKNOWLEDGED",
        count: detail.playCount,
      });
      sendCompletionCelebration({
        type: "PRESENTATION.HIDDEN",
        count: detail.playCount,
      });
    },
  });

  const cardPlacementController = new NodeCardPlacementController({
    viewport,
    view: shell,
    resolveContext: (nodeId) => {
      const activeSession = session;
      const runtime = compiledRuntime;
      if (!activeSession || !runtime || !runtime.source.nodeById.has(nodeId)) return null;
      return {
        overlay: activeSession.overlay,
        reducedMotion: resolveReducedMotion(),
      };
    },
  });

  const renderShell = (snapshot: LearningPathSessionSnapshot | null): void => {
    const runtime = compiledRuntime;
    const progress = getProgressView();
    const sessionRevision = getActiveSessionRevision();
    const cardInstance = getCardInstance();
    const completionCelebration = getCompletionCelebrationView();
    // `interactionEnabled` becomes false while the character is moving or a
    // construct is animating. It must not control card existence: XState owns
    // the pinned card and closes it on either an explicit dismissal or any
    // accepted card action. The page phase only suppresses initial overlays.
    const ready = shouldRenderLearningPathOverlays({
      pagePhase: app.dataset.pagePhase,
      hasSnapshot: snapshot !== null,
      hasRuntime: runtime !== null,
      hasProgress: progress !== null,
    });
    const card = ready && runtime && progress && snapshot
      && sessionRevision !== null && cardInstance !== null
      ? createNodeCardViewModel({
          runtime,
          nodeId: cardInstance.nodeId,
          progress,
          session: snapshot,
          instanceId: cardInstanceId(sessionRevision, cardInstance),
          subjectActionLabel: runtimeOptions?.progressionMode === "open"
            ? "走到这"
            : undefined,
        })
      : null;
    const viewModel: LearningPathPageViewModel = {
      generation: { phase: ready ? "hidden" : "generating" },
      card,
      celebration: ready && completionCelebration?.visible
        ? {
            playCount: completionCelebration.activeCount ?? 0,
            title: "完整学习路径已完成！",
            message: "你已经抵达图形学学习路径终点，所有阶段都已连成一条完整知识链。",
            reducedMotion: resolveReducedMotion(),
            visible: true,
          }
        : null,
    };
    shell.setViewModel(viewModel);
    cardPlacementController.setNodeId(card?.nodeId ?? null);
  };

  const syncNodeLearningPresentation = (projection: NodeLearningProjection): void => {
    const activeSession = session;
    if (!activeSession || !nodeLearningProjector) return;
    const update = nodeLearningProjector.project(presentNodeLearningProjection(projection));
    if (update.changes.length === 0) return;
    if (update.type === "replace") {
      activeSession.replaceNodeLearningStates(update.changes);
    } else {
      activeSession.patchNodeLearningStates(update.changes);
    }
    // A pinned card includes the selected node's status. Keep it current when
    // that node changes, but do not wake the overlay DOM for unrelated map
    // progress while no card is mounted.
    if (getCardInstance() !== null) {
      renderShell(lastSessionSnapshot ?? activeSession.getSnapshot());
    }
  };

  const clearSession = (): void => {
    cardPlacementController.setNodeId(null);
    presenter.cancel();
    progressSubscription?.unsubscribe();
    progressCallbackSubscription?.unsubscribe();
    progressSubscription = null;
    progressCallbackSubscription?.unsubscribe();
    progressCallbackSubscription = null;
    celebrationSubscription?.unsubscribe();
    celebrationSubscription = null;
    nodeCardSubscription?.unsubscribe();
    nodeCardSubscription = null;
    sceneSessionLifecycleSubscription?.unsubscribe();
    sceneSessionLifecycleSubscription = null;
    subscribedSessionRevision = null;
    activatedSessionRevision = null;
    session?.dispose();
    session = null;
    compiledRuntime = null;
    compiledSourceForPresentation = null;
    lastSessionSnapshot = null;
    lastCommittedArrivalNodeId = null;
    lastHandledLearningLaunchRevision = 0;
    nodeLearningProjector = null;
    shell.setCardPlacement(null);
    readyNotifiedSessionRevision = null;
    if (runtimeOptions?.exposeGlobalDebug) delete window.__LEARNING_PATH_EXPERIENCE__;
  };

  const pageGenerationServices = {
    createTransactionId: () => `generation-${Date.now()}-${++transactionSequence}`,
    validateTemplate: ({ template, signal }) => {
      if (signal.aborted) throw new DOMException("Validation cancelled.", "AbortError");
      return assertLearningPathDocument(template);
    },
    compilePath: ({ validatedTemplate, signal }) => {
      if (signal.aborted) throw new DOMException("Compilation cancelled.", "AbortError");
      const compiledSource = compileValidatedLearningPathDocument(
        validatedTemplate as LearningPathDocument,
      );
      const nextRuntime = compileLearningPathRuntime(compiledSource);
      compiledSourceForPresentation = compiledSource;
      compiledRuntime = nextRuntime;
      app.dataset.pagePhase = "generating";
      return nextRuntime.page;
    },
    preparePresentation: async ({ revision, signal }) => {
      const compiledSource = compiledSourceForPresentation;
      const nextRuntime = compiledRuntime;
      clearSession();
      if (!compiledSource || !nextRuntime || nextRuntime.page.revision !== revision) {
        throw new Error("Compiled runtime is unavailable for this revision.");
      }
      const [sessionModule, sessionCharacter] = await Promise.all([
        preloadLearningPathSessionModule(),
        prepareCharacterAtGate(),
      ]);
      const { createLearningPathSession } = sessionModule;
      if (preparedCharacter === sessionCharacter) preparedCharacter = null;
      characterPreparationPromise = null;
      if (signal.aborted) {
        sessionCharacter.character.dispose();
        throw new DOMException("Presentation preparation cancelled.", "AbortError");
      }
      compiledRuntime = nextRuntime;
      lastCommittedArrivalNodeId = compiledSource.entryNodeId;
      const usesSubjectHoverCards = runtimeOptions?.subjectCardTrigger === "hover";
      const dismissesActivatedSubjectCardOnLeave = (
        runtimeOptions?.subjectCardTrigger === "activate-dismiss-on-leave"
      );
      const isSubjectNode = (nodeId: string): boolean => (
        compiledSource.nodeById.get(nodeId)?.entityKind === "subject"
      );
      const dismissHoveredSubjectCard = (): void => {
        const sessionRevision = getActiveSessionRevision();
        const instance = getCardInstance();
        if (sessionRevision === null || !instance || !isSubjectNode(instance.nodeId)) return;
        applicationActor?.send({
          type: "APP.NODE_CARD.EVENT",
          sessionRevision,
          event: { type: "SESSION.RESET" },
        });
      };
      session = createLearningPathSession({
        canvas,
        viewport,
        ui: elements,
        instanceId,
        characterAssetUrls: runtimeOptions?.characterAssetUrls,
        reducedMotion: runtimeOptions?.reducedMotion,
        diagnostics: runtimeOptions?.diagnostics,
        exposeGlobalDebug: runtimeOptions?.exposeGlobalDebug ?? mode === "standalone",
        compiledPath: compiledSource,
        runtimeBundle: nextRuntime.runtimeBundle,
        specialZones: nextRuntime.specialZones,
        dynamicBridgeRule: nextRuntime.dynamicBridgeRule,
        introAnimation: true,
        preparedCharacter: sessionCharacter,
        nodeBadgeIconById: runtimeOptions?.nodeBadgeIconById,
        canNavigateToNode: (nodeId, mode) => (
          mode !== "direct"
          || runtimeOptions?.progressionMode === "open"
          || (() => {
            const progress = getProgressView();
            const status = progress?.nodeStatusById[nodeId];
            return status !== undefined && status !== "locked";
          })()
        ),
        onNodeActivated: ({ nodeId }) => {
          if (usesSubjectHoverCards && isSubjectNode(nodeId)) return;
          const sessionRevision = getActiveSessionRevision();
          if (sessionRevision === null) return;
          applicationActor?.send({
            type: "APP.NODE_CARD.EVENT",
            sessionRevision,
            event: { type: "NODE_CARD.PIN", nodeId },
          });
        },
        onNodeHovered: ({ nodeId }) => {
          if (!usesSubjectHoverCards && !dismissesActivatedSubjectCardOnLeave) return;
          if (nodeId && isSubjectNode(nodeId)) {
            if (usesSubjectHoverCards) {
              const sessionRevision = getActiveSessionRevision();
              if (sessionRevision === null) return;
              applicationActor?.send({
                type: "APP.NODE_CARD.EVENT",
                sessionRevision,
                event: { type: "NODE_CARD.PIN", nodeId },
              });
            } else if (getCardInstance()?.nodeId !== nodeId) {
              dismissHoveredSubjectCard();
            }
            return;
          }
          dismissHoveredSubjectCard();
        },
        onNodeTraversed: ({ nodeId }) => {
          const transactionId = getActiveJourneyTransactionId();
          if (transactionId) {
            sendJourney({ type: "NODE_TRAVERSED", transactionId, nodeId });
            const journey = applicationActor
              ? selectJourneyActor(applicationActor.getSnapshot())?.getSnapshot()
              : null;
            if (journey?.matches("moving")
              && journey.context.transactionId === transactionId
              && journey.context.currentNodeId === nodeId
              && journey.context.lastOutcome === null) {
              sendProgress({ type: "NODE.TRAVERSED", nodeId, transactionId });
            }
          }
        },
        onMovementCancelled: ({ safeNodeId, reason }) => {
          const transactionId = getActiveJourneyTransactionId();
          if (transactionId) {
            sendJourney({ type: "CANCELLED", transactionId, safeNodeId, reason });
            const journey = applicationActor
              ? selectJourneyActor(applicationActor.getSnapshot())?.getSnapshot()
              : null;
            if (journey?.matches("cancelled")
              && journey.context.lastOutcome?.type === "cancelled"
              && journey.context.lastOutcome.transactionId === transactionId) {
              sendProgress({ type: "MOVEMENT.CANCELLED", safeNodeId, reason, transactionId });
            }
          }
        },
        onRuntimeError: ({ error, message }) => {
          reportError("runtime", error, message);
        },
        onBackgroundActivated: dismissCard,
        onStateChanged: (snapshot) => {
          if (disposed || session === null) return;
          const previous = lastSessionSnapshot;
          lastSessionSnapshot = snapshot;
          if (snapshot.isRunning && previous?.isRunning !== true) {
            const transactionId = getActiveJourneyTransactionId();
            if (transactionId) {
              sendJourney({ type: "MOVEMENT_STARTED", transactionId });
              const journey = applicationActor
                ? selectJourneyActor(applicationActor.getSnapshot())?.getSnapshot()
                : null;
              if (journey?.matches("moving")
                && journey.context.transactionId === transactionId
                && journey.context.lastOutcome === null
                && getProgressView()?.pendingUnlockCommit?.transactionId === transactionId) {
                sendProgress({ type: "UNLOCK.DEPARTED", transactionId });
              }
            }
          }
          if (snapshot.visuallyIdle
            && !snapshot.isRunning
            && snapshot.targetNodeId === null
            && lastCommittedArrivalNodeId !== snapshot.currentNodeId) {
            lastCommittedArrivalNodeId = snapshot.currentNodeId;
            const transactionId = getActiveJourneyTransactionId();
            if (transactionId) {
              sendJourney({
                type: "NODE_ARRIVED",
                transactionId,
                nodeId: snapshot.currentNodeId,
              });
              const journey = applicationActor
                ? selectJourneyActor(applicationActor.getSnapshot())?.getSnapshot()
                : null;
              if (journey?.matches("settling")
                && journey.context.transactionId === transactionId
                && journey.context.currentNodeId === snapshot.currentNodeId
                && journey.context.lastOutcome === null) {
                sendProgress({
                  type: "NODE.ARRIVED",
                  nodeId: snapshot.currentNodeId,
                  transactionId,
                });
                sendJourney({ type: "VISUAL_SETTLED", transactionId });
              }
            }
          }
          const pendingIntent = getProgressView()?.pendingLearningIntent;
          if (pendingIntent?.nodeId === snapshot.currentNodeId
            && snapshot.visuallyIdle
            && !snapshot.isRunning
            && snapshot.targetNodeId === null) {
            settleLearningAtNode(snapshot.currentNodeId);
          }
          renderShell(snapshot);
        },
      });
      if (runtimeOptions?.exposeGlobalDebug ?? mode === "standalone") {
        window.__LEARNING_PATH_EXPERIENCE__ = Object.freeze({
        getState: () => {
          const progress = getProgressView();
          return Object.freeze({
            progress,
            card: (() => {
              const runtime = compiledRuntime;
              const snapshot = lastSessionSnapshot;
              const activeRevision = getActiveSessionRevision();
              const instance = getCardInstance();
              return progress && runtime && snapshot && activeRevision !== null && instance
                ? createNodeCardViewModel({
                    runtime,
                    nodeId: instance.nodeId,
                    progress,
                    session: snapshot,
                    instanceId: cardInstanceId(activeRevision, instance),
                    subjectActionLabel: runtimeOptions?.progressionMode === "open"
                      ? "走到这"
                      : undefined,
                  })
                : null;
            })(),
            celebration: getCompletionCelebrationView(),
            nodeBadges: session?.getNodeLearningBadgeDebugInfos() ?? [],
          });
        },
        selectNode: (nodeId: string) => {
          return session?.selectNode(nodeId) ?? false;
        },
        dismissCard,
        });
      }
      presenter.installRuntime({
        presentation: session.presentation,
        send: (event) => applicationActor?.send({ type: "APP.PAGE.EVENT", event }),
      });
    },
    executePresentation: presenter.executePresentation,
    onGenerationFailed: (failure) => {
      clearSession();
      app.dataset.pagePhase = mode === "module" ? "failed" : "gate";
      reportError("generation", failure, formatGenerationFailure(failure));
      shell.setViewModel({
        generation: {
          phase: mode === "module" ? "hidden" : "error",
          buttonLabel: "重新生成学习路径",
          canContinue: persistedPathChoice !== null,
          errorMessage: formatGenerationFailure(failure),
        },
        card: null,
        celebration: null,
      });
    },
    onGenerationReady: () => {
      app.dataset.pagePhase = "ready";
    },
  } satisfies PageGenerationServices;

  applicationActor = createLearningPathApplicationActor({
    pageGeneration: pageGenerationServices,
    journey: {
      createTransactionId: () => `journey-${Date.now()}-${++journeyTransactionSequence}`,
      planJourney: ({ currentNodeId, request }) => {
        const progress = getProgressView();
        const decision = progress?.lastNavigationDecision;
        if (!decision?.accepted
          || decision.sourceNodeId !== currentNodeId
          || decision.targetNodeId !== request.targetNodeId) {
          return { accepted: false, reason: decision?.reason ?? "no-progress-navigation-decision" };
        }
        return {
          accepted: true,
          plan: Object.freeze({
            sourceNodeId: currentNodeId,
            targetNodeId: request.targetNodeId,
            routeNodeIds: Object.freeze([...decision.routeNodeIds]),
            requiredCompletionNodeIds: request.intent === "unlock"
              ? Object.freeze([...decision.requiredCompletionNodeIds])
              : Object.freeze([]),
          }),
        };
      },
    },
    learningResource: runtimeOptions?.learningResource
      ?? createBrowserLearningResourceNavigator(window),
    learningProgressStorage,
    resolveCompiledLearningPath: ({ revision }) => {
      const activeRuntime = compiledRuntime;
      if (!activeRuntime || activeRuntime.page.revision !== revision) {
        throw new Error(
          `Learning-path instance "${instanceId}" has no compiled progression model for revision "${revision}".`,
        );
      }
      return activeRuntime.source;
    },
    reconcileRestoredProgress: ({ safeNodeId, signal }) => {
      if (signal.aborted) {
        throw new DOMException("Restored progress reconciliation cancelled.", "AbortError");
      }
      const activeSession = session;
      if (!activeSession?.reconcileRestoredProgress(safeNodeId)) {
        throw new Error(`Cannot reconcile restored safe node "${safeNodeId}".`);
      }
      // Prevent the first activation publication from being mistaken for a
      // newly completed Journey. Hydration never emits movement/progress events.
      lastCommittedArrivalNodeId = safeNodeId;
      lastSessionSnapshot = activeSession.getSnapshot();
    },
    createSceneRuntimeInput: ({ sessionRevision }) => {
      const activeSession = session;
      if (!activeSession) {
        throw new Error("Active learning session is unavailable for scene runtime.");
      }
      activeSession.bindSceneRuntimeGateway(
        sessionRevision,
        (command: SceneRuntimeGatewayCommand) => {
          applicationActor?.send({
            type: "APP.SCENE_RUNTIME.COMMAND",
            sessionRevision,
            command,
          });
        },
      );
      return {
        port: activeSession.getSceneRuntimePort(),
        defaultTimeoutMs: 20_000,
        scheduler: activeSession.getSceneRuntimeGatewayScheduler(),
      };
    },
    createPathOrchestrationBinding: () => {
      if (!session) {
        throw new Error("Active learning session is unavailable for path orchestration.");
      }
      return session.getPathOrchestrationBinding();
    },
  }, {
    input: {
      reducedMotion: resolveReducedMotion(),
      presentationAckTimeoutMs: 20_000,
    },
    ...(xstateInspector ? { inspect: xstateInspector.inspect } : {}),
  });

  const bindActiveChildren = (): void => {
    const root = applicationActor;
    if (!root) return;
    const snapshot = root.getSnapshot();
    publishApplicationDiagnostics();
    const sessionRevision = selectActiveSessionRevision(snapshot);
    const phase = selectLearningPathApplicationPhase(snapshot);
    const pathOrchestration = selectPathOrchestrationActor(snapshot);
    if (phase !== "active" || sessionRevision === null || !pathOrchestration) {
      progressSubscription?.unsubscribe();
      progressSubscription = null;
      progressCallbackSubscription?.unsubscribe();
      progressCallbackSubscription = null;
      celebrationSubscription?.unsubscribe();
      celebrationSubscription = null;
      nodeCardSubscription?.unsubscribe();
      nodeCardSubscription = null;
      sceneSessionLifecycleSubscription?.unsubscribe();
      sceneSessionLifecycleSubscription = null;
      nodeLearningProjector = null;
      subscribedSessionRevision = null;
      return;
    }
    if (subscribedSessionRevision === sessionRevision) return;
    progressSubscription?.unsubscribe();
    progressCallbackSubscription?.unsubscribe();
    celebrationSubscription?.unsubscribe();
    nodeCardSubscription?.unsubscribe();
    sceneSessionLifecycleSubscription?.unsubscribe();
    const progress = selectProgressActor(snapshot);
    const card = selectNodeCardActor(snapshot);
    const completionCelebration = selectCompletionCelebrationActor(snapshot);
    nodeLearningProjector = new NodeLearningPatchProjector();
    progressSubscription = progress
      ? subscribeActorSelector(
          progress,
          selectNodeLearningProjection,
          (projection) => syncNodeLearningPresentation(projection),
          {
            equals: areNodeLearningProjectionsEqual,
            emitInitial: true,
          },
        )
      : null;
    progressCallbackSubscription = progress?.subscribe((progressSnapshot) => {
      runtimeOptions?.onProgressChange?.(
        presentProgressView(selectLearningProgressView(progressSnapshot.context.model)),
      );
    }) ?? null;
    celebrationSubscription = completionCelebration?.subscribe(() => {
      renderShell(lastSessionSnapshot ?? session?.getSnapshot() ?? null);
      const view = getCompletionCelebrationView();
      const playCount = view?.activeCount ?? 0;
      if (view?.visible && playCount > lastCompletionPlayCount) {
        lastCompletionPlayCount = playCount;
        runtimeOptions?.onComplete?.(Object.freeze({
          instanceId,
          playCount,
          snapshot: getPublicSnapshot(),
        }));
      }
    }) ?? null;
    nodeCardSubscription = card?.subscribe(() => renderShell(lastSessionSnapshot)) ?? null;
    const activeSession = session;
    sceneSessionLifecycleSubscription = activeSession
      ? bindSceneSessionLifecycle({
          sessionRevision,
          source: activeSession,
          isCurrentSession: () => (
            !disposed
            && session === activeSession
            && getActiveSessionRevision() === sessionRevision
          ),
          send: (event) => applicationActor?.send({
            type: "APP.SCENE_SESSION.EVENT",
            sessionRevision,
            event,
          }),
        })
      : null;
    subscribedSessionRevision = sessionRevision;
    if (shouldActivateLearningPathSession({
      phase,
      sessionRevision,
      activatedSessionRevision,
      hasSession: activeSession !== null,
      hasPathOrchestrationActor: pathOrchestration !== null,
    }) && activeSession) {
      // The invoked path actor binds itself synchronously in its `start`
      // lifecycle. Activating the Session only after the root has published
      // this active snapshot prevents the first frame from observing an
      // unbound runtime.
      activatedSessionRevision = sessionRevision;
      activeSession.activate();
      lastSessionSnapshot = activeSession.getSnapshot();
      canvas.focus({ preventScroll: true });
      if (readyNotifiedSessionRevision !== sessionRevision) {
        readyNotifiedSessionRevision = sessionRevision;
        runtimeOptions?.onReady?.(getPublicSnapshot());
      }
    }
    if (activeSession) renderShell(activeSession.getSnapshot());
  };
  applicationSubscription = applicationActor.subscribe(bindActiveChildren);
  bindActiveChildren();

  const requestGeneration = async (launchMode: LearningPathLaunchMode): Promise<void> => {
    if (disposed) return;
    // Starting inside the user's button event avoids popup blocking while all
    // actor-creation events buffered since bootstrap are still replayed.
    xstateInspector?.start();
    templateRequest?.abort();
    templateRequest = new AbortController();
    app.dataset.pagePhase = "generating";
    shell.setViewModel({
      generation: {
        phase: "generating",
        canContinue: persistedPathChoice !== null,
      },
    });
    try {
      const injectedOptions = hasOwn(options, "document")
        || hasOwn(options, "documentUrl")
        || hasOwn(options, "documentProvider")
        ? options
        : mode === "standalone"
          ? readLearningPathWindowHostConfig(window) ?? options
          : options;
      const hasInjectedSource = hasOwn(injectedOptions, "document")
        || hasOwn(injectedOptions, "documentUrl")
        || hasOwn(injectedOptions, "documentProvider");
      if (mode === "standalone" && launchMode === "continue" && persistedPathChoice === null) {
        throw new Error("还没有可继续的学习路径，请先生成一条路径。");
      }

      const selectedTemplate = mode === "module" || hasInjectedSource
        ? null
        : launchMode === "generate"
          ? standaloneTemplatePool!.selectNextLearningPathTemplate(
            persistedPathChoice?.templateId ?? null,
          )
          : standaloneTemplatePool!.BUNDLED_LEARNING_PATH_TEMPLATES.find(
            (candidate) => candidate.id === persistedPathChoice?.templateId,
          ) ?? standaloneTemplatePool!.BUNDLED_LEARNING_PATH_TEMPLATES[0]!;
      const templateOptions: LearningPathBootstrapOptions = selectedTemplate
        ? {
          documentUrl: standaloneTemplatePool!.createBundledLearningPathTemplateUrl(
            window.location.href,
            selectedTemplate.fileName,
          ),
        }
        : injectedOptions;
      const template = await loadLearningPathTemplate(templateOptions, {
        signal: templateRequest.signal,
        baseUrl: window.location.href,
        defaultDocumentUrl: createDefaultLearningPathTemplateUrl(window.location.href),
      });
      if (disposed || templateRequest.signal.aborted) return;

      const templateId = selectedTemplate?.id ?? "host-provided";
      const entropy = window.crypto?.randomUUID?.()
        ?? `${Date.now()}-${++progressSlotSequence}`;
      const progressStorageKey = mode === "module"
        ? runtimeOptions?.progressStorageKey
        : launchMode === "continue"
          ? persistedPathChoice!.progressStorageKey
          : standaloneTemplatePool!.createFreshLearningProgressStorageKey(templateId, entropy);
      if (!progressStorageKey?.trim()) {
        throw new Error("正式学习路径模块必须提供非空 progressStorageKey。");
      }
      const nextChoice: PersistedLearningPathChoice = Object.freeze({
        version: 1,
        templateId,
        progressStorageKey,
      });
      if (mode === "standalone" && selectedTemplate) {
        try {
          standaloneTemplatePool!.writePersistedLearningPathChoice(
            window.localStorage,
            nextChoice,
          );
          persistedPathChoice = nextChoice;
        } catch (error) {
          console.warn("[learning-path] Cannot persist the selected path slot.", error);
        }
      }
      applicationActor?.send({
        type: "APP.GENERATE.REQUESTED",
        template,
        reducedMotion: resolveReducedMotion(),
        launchMode,
        progressStorageKey,
      });
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      app.dataset.pagePhase = mode === "module" ? "failed" : "gate";
      const message = `无法读取学习路径模板：${error instanceof Error ? error.message : String(error)}`;
      reportError("host", error, message);
      if (mode === "module") {
        elements.loadingPanel.dataset.state = "error";
        elements.loadingLabel.textContent = message;
      }
      shell.setViewModel({
        generation: {
          phase: mode === "module" ? "hidden" : "error",
          buttonLabel: "重新生成学习路径",
          canContinue: persistedPathChoice !== null,
          errorMessage: message,
        },
      });
    }
  };

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    if (shell.containsCardEventPath(event) || event.target === canvas) return;
    dismissCard();
  };
  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    const eventPath = event.composedPath();
    const activeElement = document.activeElement;
    if (!eventPath.includes(app) && !(activeElement && app.contains(activeElement))) return;
    dismissCard();
    canvas.focus({ preventScroll: true });
  };
  const flushLearningProgress = (): void => {
    const root = applicationActor;
    if (!root) return;
    const sessionRevision = selectActiveSessionRevision(root.getSnapshot());
    if (sessionRevision === null) return;
    root.send({ type: "APP.PERSISTENCE.FLUSH.REQUESTED", sessionRevision });
  };
  const handlePageHide = (): void => {
    flushLearningProgress();
  };
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") flushLearningProgress();
  };
  document.addEventListener("pointerdown", handleDocumentPointerDown, { capture: true });
  document.addEventListener("keydown", handleDocumentKeyDown);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);

  const dispose = (): void => {
    if (disposed) return;
    flushLearningProgress();
    disposed = true;
    window.removeEventListener("beforeunload", dispose);
    window.removeEventListener("pagehide", handlePageHide);
    document.removeEventListener("pointerdown", handleDocumentPointerDown, { capture: true });
    document.removeEventListener("keydown", handleDocumentKeyDown);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    cardPlacementController.dispose();
    templateRequest?.abort();
    applicationSubscription?.unsubscribe();
    applicationSubscription = null;
    applicationActor?.stop();
    applicationActor = null;
    presenter.dispose();
    progressSubscription?.unsubscribe();
    progressCallbackSubscription?.unsubscribe();
    celebrationSubscription?.unsubscribe();
    nodeCardSubscription?.unsubscribe();
    sceneSessionLifecycleSubscription?.unsubscribe();
    session?.dispose();
    preparedCharacter?.character.dispose();
    preparedCharacter = null;
    characterPreparationPromise = null;
    shell.dispose();
    xstateInspector?.stop();
    if (runtimeOptions?.exposeGlobalDebug ?? mode === "standalone") {
      delete window.__LEARNING_PATH_EXPERIENCE__;
    }
    applicationDebugOutput?.remove();
  };
  window.addEventListener("beforeunload", dispose, { once: true });
  if (mode === "module") {
    app.dataset.pagePhase = "generating";
    shell.setViewModel({
      generation: { phase: "hidden" },
      card: null,
      celebration: null,
    });
    await requestGeneration(runtimeOptions?.launchMode ?? "continue");
  } else {
    app.dataset.pagePhase = "gate";
    shell.setViewModel({
      generation: {
        phase: "ready",
        buttonLabel: "生成学习路径",
        canContinue: persistedPathChoice !== null,
      },
      card: null,
      celebration: null,
    });
    shell.focusGenerationAction();
  }

  return Object.freeze({
    getSnapshot: getPublicSnapshot,
    focusNode: (nodeId: string) => session?.selectNode(nodeId) ?? false,
    pause: () => session?.pause(),
    resume: () => session?.resume(),
    dispose,
  });
}

/** Backwards-compatible standalone Demo/QA entry. */
export async function bootstrapLearningPathPage(
  options: LearningPathBootstrapOptions = {},
): Promise<() => void> {
  const document = globalThis.document;
  if (!document) throw new Error("Standalone Demo/QA requires a browser document.");
  const standaloneTemplatePool = await import("../host/learning-path/templatePool");
  const handle = await createLearningPathPageRuntime(options, {
    mode: "standalone",
    instanceId: "standalone",
    elements: resolveStandaloneLearningPathDom(document),
    standaloneTemplatePool,
    exposeGlobalDebug: true,
  });
  return handle.dispose;
}
