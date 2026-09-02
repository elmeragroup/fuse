import type { ApiPart } from "../../src/lib/docs-model.ts";

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

export type DocsShadowComponent = DocsApiComponent;

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

export type DocsShadowComponentResult = {
  readonly inventory: DocsShadowComponent;
  readonly current: readonly ApiPart[];
  readonly effect: readonly ApiPart[];
  readonly currentProblems: readonly ShadowProblem[];
  readonly effectProblems: readonly ShadowProblem[];
  readonly currentEvidence: readonly ShadowPartEvidence[];
  readonly effectEvidence: readonly ShadowPartEvidence[];
};

/**
 * The reviewed steady state of the shadow comparison: every measured difference
 * between the current docs generator and the Effect extractor, as last accepted
 * with `pnpm run shadow:update`. A run must reproduce it exactly; anything
 * measured but absent here is unexplained, anything here but no longer measured
 * is stale, and either fails the shadow suite.
 */
export type DocsShadowSnapshot = {
  readonly summary: DocsShadowSummary;
  readonly apiDifferences: readonly ApiShadowDifference[];
  readonly problemDifferences: readonly ProblemShadowDifference[];
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
  readonly summary: DocsShadowSummary;
};
