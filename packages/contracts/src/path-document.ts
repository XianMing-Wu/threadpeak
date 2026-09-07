// Public learning-path 1.0 wire contract, matching the bundled renderer declaration.
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
