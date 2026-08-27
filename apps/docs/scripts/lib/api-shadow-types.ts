import type { ApiPart } from "../../src/lib/docs-model.ts";

/** The complete component shell inventory used by the production docs generator. */
export const DOCS_SHADOW_SLUGS = [
  "accordion",
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "calendar",
  "card",
  "checkbox",
  "checkbox-card",
  "code",
  "collapsible",
  "confirm-button",
  "date-field",
  "date-picker",
  "date-range-picker",
  "description-list",
  "dialog",
  "dropdown-menu",
  "emoji",
  "empty",
  "field",
  "frame",
  "heading",
  "input",
  "input-group",
  "item",
  "link",
  "loader",
  "meter",
  "number-field",
  "pagination",
  "popover",
  "radio-group",
  "range-calendar",
  "scroll-area",
  "search-field",
  "select",
  "selection-item",
  "separator",
  "sheet",
  "show",
  "skeleton",
  "span",
  "switch",
  "table",
  "tabs",
  "text",
  "text-field",
  "textarea",
  "textarea-field",
  "timeline-list",
  "toggle",
  "tooltip",
  "ui-providers",
] as const;

export type DocsShadowSlug = (typeof DOCS_SHADOW_SLUGS)[number];

/** Component input shared by production extraction and the closed shadow inventory. */
export type DocsApiComponent = {
  readonly slug: string;
  readonly entryFile: string;
  /** Primary page export, used for the page's source and display identity. */
  readonly exportName: string;
  /** Exact public exports consumed by the production API generator. */
  readonly exportNames: readonly string[];
  readonly sourceFile: string;
};

export type DocsShadowComponent = Omit<DocsApiComponent, "slug"> & {
  readonly slug: DocsShadowSlug;
};

/** One diagnostic from either extractor or from the docs-owned adapter. */
export type ShadowProblem = {
  readonly component: string;
  readonly source: "current-docs" | "effect-extractor" | "docs-adapter";
  readonly code: string;
  readonly message: string;
};

/** Independent bytes supplied to one shadow extractor invocation. */
export type ShadowInputCapture = {
  readonly entryFile: string;
  readonly entrySha256: string;
  readonly sourceFile: string;
  readonly sourceSha256: string;
};

/** One leaf difference in the consumer-visible API model or evidence sidecar. */
export type ApiShadowDifference = {
  readonly component: string;
  readonly path: string;
  readonly current: unknown;
  readonly effect: unknown;
};

/** One missing member in the complete problem-log multiset. */
export type ProblemShadowDifference = {
  readonly component: string;
  readonly key: string;
  readonly current?: ShadowProblem;
  readonly effect?: ShadowProblem;
};

/** Provenance facts retained for review but deliberately absent from ApiProp. */
export type ShadowPropEvidence = {
  readonly name: string;
  readonly declarationPaths: readonly string[];
  readonly ownership: "library" | "external" | "synthesized";
  readonly synthesized: boolean;
};

/** Declaration facts for one part and provenance for its consumer-visible props. */
export type ShadowPartEvidence = {
  readonly name: string;
  readonly declarationPaths: readonly string[];
  readonly synthesized: boolean;
  readonly propOrder: readonly string[];
  readonly props: readonly ShadowPropEvidence[];
};

export type ProtectedBytes = {
  readonly generator: { readonly path: string; readonly sha256: string };
  readonly generated: readonly { readonly path: string; readonly sha256: string }[];
  readonly markdown: readonly { readonly path: string; readonly sha256: string }[];
  readonly llms: { readonly path: string; readonly sha256: string };
};

export type DocsShadowComponentResult = {
  readonly inventory: DocsShadowComponent;
  readonly current: readonly ApiPart[];
  readonly effect: readonly ApiPart[];
  readonly currentProblems: readonly ShadowProblem[];
  readonly effectProblems: readonly ShadowProblem[];
  readonly currentEvidence: readonly ShadowPartEvidence[];
  readonly effectEvidence: readonly ShadowPartEvidence[];
};

export type ParityDecisionKind = "api" | "problem";

/**
 * A checked-in adjudication for a measured difference.
 *
 * `paths` are exact leaf paths (or exact problem keys), never prefixes or globs.
 * `differenceSha256` fingerprints the measured values covered by this decision;
 * changing the source inputs or the extractor output therefore invalidates it.
 */
export type ParityDecision = {
  readonly id: string;
  readonly kind: ParityDecisionKind;
  readonly component: string;
  readonly paths: readonly string[];
  readonly differenceSha256: string;
  readonly rationale: string;
  readonly evidence: string;
};

export type DocsShadowSummary = {
  readonly componentCount: number;
  readonly currentPartCount: number;
  readonly effectPartCount: number;
  readonly currentPropCount: number;
  readonly effectPropCount: number;
  readonly currentProblemCount: number;
  readonly effectProblemCount: number;
  readonly apiDifferenceCount: number;
  readonly problemDifferenceCount: number;
  readonly reviewedApiDifferenceCount: number;
  readonly reviewedProblemDifferenceCount: number;
  readonly unexplainedApiDifferenceCount: number;
  readonly unexplainedProblemDifferenceCount: number;
};

export type DocsShadowReport = {
  readonly inventory: readonly DocsShadowComponent[];
  /** Both implementations are fed this exact ordered list of public entry files. */
  readonly extractionInputs: readonly string[];
  readonly currentInputs: readonly string[];
  readonly effectInputs: readonly string[];
  /** Captured independently by each side, including the implementation source bytes. */
  readonly currentInputHashes: readonly ShadowInputCapture[];
  readonly effectInputHashes: readonly ShadowInputCapture[];
  readonly components: readonly DocsShadowComponentResult[];
  readonly apiDifferences: readonly ApiShadowDifference[];
  readonly problemDifferences: readonly ProblemShadowDifference[];
  readonly decisions: readonly ParityDecision[];
  readonly unexplainedApiDifferences: readonly ApiShadowDifference[];
  readonly unexplainedProblemDifferences: readonly ProblemShadowDifference[];
  readonly summary: DocsShadowSummary;
  readonly protectedBytesBefore: ProtectedBytes;
  readonly protectedBytesAfter: ProtectedBytes;
};
