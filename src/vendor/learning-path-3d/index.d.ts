export type LearningEntityId = string;
export type SubjectProgressStatus = "locked" | "available" | "completed";
export type ConceptProgressStatus = "locked" | "available" | "in-progress" | "completed";
export type LearningNodeProgressStatus = SubjectProgressStatus | ConceptProgressStatus;

export interface LearningPathDocument {
  readonly protocol: "learning-path";
  readonly version: "1.0";
  readonly id: string;
  readonly metadata: {
    readonly title: string;
    readonly description?: string;
    readonly locale: string;
  };
  readonly structure: {
    readonly entrySubjectId: string;
    readonly goalSubjectIds: readonly string[];
    readonly subjects: readonly {
      readonly id: string;
      readonly cardRef: string;
      readonly orderHint?: number;
    }[];
    readonly concepts: readonly {
      readonly id: string;
      readonly subjectId: string;
      readonly cardRef: string;
      readonly actionRef: string;
      readonly orderHint?: number;
    }[];
    readonly flow: readonly {
      readonly id: string;
      readonly fromSubjectId: string;
      readonly toSubjectId: string;
      readonly semantics?: {
        readonly splitGroupId?: string;
        readonly joinGroupId?: string;
      };
    }[];
    readonly flowGroups: readonly (
      | { readonly id: string; readonly type: "split"; readonly anchorSubjectId: string; readonly policy: "parallel" }
      | { readonly id: string; readonly type: "join"; readonly anchorSubjectId: string; readonly policy: "all-required" }
    )[];
  };
  readonly data: {
    readonly cards: readonly {
      readonly id: string;
      readonly eyebrow?: string;
      readonly title: string;
      readonly summary: string;
      readonly body?: string;
      readonly tags?: readonly string[];
      readonly imageUrl?: string;
    }[];
    readonly resources: readonly { readonly id: string; readonly href: string }[];
    readonly actions: readonly {
      readonly id: string;
      readonly kind: "open-resource";
      readonly label: string;
      readonly resourceId: string;
      readonly target?: "self" | "blank";
    }[];
  };
  readonly presentation: {
    readonly layout: {
      readonly direction: "top-to-bottom";
      readonly subjectGap?: number;
      readonly layerGap?: number;
      readonly conceptGap?: number;
      readonly conceptColumnGap?: number;
    };
  };
}

export interface ResourceBinding {
  readonly nodeId: string;
  readonly actionId: string;
  readonly resourceId: string;
  readonly href: string;
  readonly target: "self" | "blank";
}

export type LearningResourceLaunchIntent = "start" | "continue" | "review";

export interface LearningResourceLaunchRequest {
  readonly binding: ResourceBinding;
  readonly intent: LearningResourceLaunchIntent;
  readonly launchId: string;
  readonly sessionRevision: number;
}

export interface LearningResourceNavigationResult {
  readonly status: "accepted" | "popup-blocked" | "invalid-url" | "failed";
  readonly resolvedHref?: string;
  readonly message?: string;
}

export interface LearningResourceNavigatorPort {
  navigate(
    request: LearningResourceLaunchRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ): LearningResourceNavigationResult | Promise<LearningResourceNavigationResult>;
}

export interface LearningProgressStoragePort {
  read(
    request: Readonly<{ key: string }>,
    options: Readonly<{ signal: AbortSignal }>,
  ): string | null | Promise<string | null>;
  write(
    request: Readonly<{ key: string; value: string }>,
    options: Readonly<{ signal: AbortSignal }>,
  ): void | Promise<void>;
}

export interface CharacterAssetUrls {
  readonly run: string;
  readonly runStop: string;
  readonly idle: string;
  readonly turn: string;
}

export type NodeSemanticBadgeIcon =
  | "carrier"
  | "concept"
  | "start"
  | "foundation"
  | "vector"
  | "transform"
  | "structure"
  | "kernel"
  | "eigen"
  | "data"
  | "variance"
  | "matrix"
  | "application"
  | "pca"
  | "projection"
  | "goal";

export interface LearningProgressViewSnapshot {
  readonly currentNodeId: string;
  readonly nodeStatusById: Readonly<Record<string, LearningNodeProgressStatus>>;
  readonly nodeLearningStateById: Readonly<Record<string, Readonly<{
    kind: "subject" | "goal" | "concept";
    status: LearningNodeProgressStatus;
  }>>>;
  readonly subjectStatusById: Readonly<Record<string, SubjectProgressStatus>>;
  readonly conceptStatusById: Readonly<Record<string, ConceptProgressStatus>>;
  readonly celebration: Readonly<{ seen: boolean; count: number }>;
  readonly lastNavigationDecision: unknown | null;
  readonly lastCatchUpResult: unknown | null;
  readonly lastConceptAction: unknown | null;
  readonly pendingLearningIntent: unknown | null;
  readonly lastLearningLaunch: unknown | null;
  readonly pendingUnlockCommit: unknown | null;
  readonly lastMovementCancellation: unknown | null;
  readonly lastRejection: unknown | null;
}

export type LearningPathPublicPhase = "mounting" | "generating" | "ready" | "failed" | "disposed";

export interface LearningPathSessionSnapshot {
  readonly currentNodeId: string;
  readonly selectedNodeId: string;
  readonly targetNodeId: string | null;
  readonly isRunning: boolean;
  readonly visuallyIdle: boolean;
  readonly modelLoaded: boolean;
  readonly interactionEnabled: boolean;
  readonly visibleNodeIds: readonly string[];
  readonly visibleEdgeIds: readonly string[];
}

export interface LearningPathPublicSnapshot {
  readonly instanceId: string;
  readonly phase: LearningPathPublicPhase;
  readonly sessionRevision: number | null;
  readonly session: LearningPathSessionSnapshot | null;
  readonly progress: LearningProgressViewSnapshot | null;
}

export interface LearningPathModuleError {
  readonly phase: "generation" | "runtime" | "host";
  readonly error: unknown;
  readonly message: string;
}

export interface LearningPathCompletionEvent {
  readonly instanceId: string;
  readonly playCount: number;
  readonly snapshot: LearningPathPublicSnapshot;
}

export interface LearningPathModuleCallbacks {
  readonly onReady?: (snapshot: LearningPathPublicSnapshot) => void;
  readonly onProgressChange?: (snapshot: LearningProgressViewSnapshot) => void;
  readonly onComplete?: (event: LearningPathCompletionEvent) => void;
  readonly onError?: (event: LearningPathModuleError) => void;
}

export interface LearningPathModule {
  getSnapshot(): LearningPathPublicSnapshot;
  focusNode(nodeId: string): boolean;
  /** Save the concept return anchor and study bookmark before host navigation. */
  rememberLearningNode(nodeId: string): Promise<boolean>;
  pause(): void;
  resume(): void;
  dispose(): void;
}

interface MountLearningPathCommonOptions extends LearningPathModuleCallbacks {
  readonly mount: HTMLElement;
  readonly instanceId: string;
  readonly navigator: LearningResourceNavigatorPort;
  readonly storage: LearningProgressStoragePort;
  readonly progressKey: string;
  readonly launchMode?: "generate" | "continue" | "reset";
  readonly reducedMotion?: boolean;
  readonly diagnostics?: boolean;
  readonly subjectCardTrigger?: "activate" | "hover" | "activate-dismiss-on-leave";
  readonly progressionMode?: "gated" | "open";
  readonly nodeBadgeIconById?: Readonly<Record<string, NodeSemanticBadgeIcon>>;
  readonly allowedDocumentOrigins?: readonly string[];
  readonly onReady?: (snapshot: LearningPathPublicSnapshot) => void;
  readonly onProgressChange?: (snapshot: LearningProgressViewSnapshot) => void;
  readonly onComplete?: (event: LearningPathCompletionEvent) => void;
  readonly onError?: (event: LearningPathModuleError) => void;
}

export type LearningPathModuleAssetSource =
  | { readonly assetBaseUrl: string; readonly characterAssets?: never }
  | { readonly assetBaseUrl?: never; readonly characterAssets: CharacterAssetUrls };

export type LearningPathModuleSource =
  | { readonly document: unknown; readonly documentUrl?: never; readonly documentProvider?: never }
  | { readonly document?: never; readonly documentUrl: string; readonly documentProvider?: never }
  | {
      readonly document?: never;
      readonly documentUrl?: never;
      readonly documentProvider: (context: Readonly<{ signal: AbortSignal }>) => unknown | Promise<unknown>;
    }
;

export type MountLearningPathOptions = MountLearningPathCommonOptions
  & LearningPathModuleAssetSource
  & LearningPathModuleSource;

export declare function mountLearningPath(options: MountLearningPathOptions): Promise<LearningPathModule>;

/** Checks document, content compilation and physical topology without DOM/WebGL. */
export type LearningPathRuntimeValidation = Readonly<{ok:true}> | Readonly<{ok:false;message:string}>;
export declare function preflightLearningPath(input:unknown):LearningPathRuntimeValidation;
