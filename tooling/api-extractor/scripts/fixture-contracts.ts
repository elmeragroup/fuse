/**
 * What one fixture's evidence is, independent of how the catalog finds it.
 *
 * The derivation module reads the fixture tree; these are the records it
 * produces and the hand-maintained budgets it merges in. They live apart so
 * the derivation stays a page of rules and the contract stays readable on its
 * own.
 */

export const issue14TypeScript7Compiler = "typescript@7.0.2" as const;

export type OracleDisposition = "immutable-upstream" | "reviewed-divergence" | "generated" | "not-applicable";
export type ConformanceDisposition = "unchanged" | "reviewed-ts7";
export type TypecheckStrategy = "direct-input" | "virtual-upstream-dependency" | "not-applicable";
export type TimingPlan = "externalSelection" | "issue02" | "issue14";
export type IssueFixtureOracle = "immutable-upstream" | "reviewed-ts7";

export type TimingMetadata =
  | {
      readonly plan: "issue02";
      readonly order: number;
      readonly maxFetchedToMaterializedRatio: number;
      readonly maxRequestCount: number;
      readonly maxBytesReceived: number;
      readonly bytesReceivedPathLengthHeadroom?: number;
    }
  | { readonly plan: "issue14"; readonly order: number }
  | {
      readonly plan: "externalSelection";
      readonly order: number;
      readonly maxRequestCount: number;
      readonly maxBytesReceived: number;
    };

export type Issue02TimingMetadata = Extract<TimingMetadata, { readonly plan: "issue02" }>;
export type Issue14TimingMetadata = Extract<TimingMetadata, { readonly plan: "issue14" }>;
export type ExternalSelectionTimingMetadata = Extract<TimingMetadata, { readonly plan: "externalSelection" }>;

export type FixtureEvidenceRecord = {
  readonly id: string;
  readonly input: { readonly id: string; readonly file: string };
  readonly conformance: { readonly evidenceId: string; readonly disposition: ConformanceDisposition } | false;
  readonly typecheck: { readonly strategy: TypecheckStrategy };
  readonly timing: readonly TimingMetadata[];
  readonly warnings: {
    readonly oracleFile: "warnings.tsgo.json" | null;
    readonly codes: readonly string[];
  };
  readonly oracle: {
    readonly disposition: OracleDisposition;
    readonly upstreamFile: "output.json" | null;
    readonly selectedFile: "output.json" | "output.tsgo.json" | null;
    readonly divergenceRecord: "ts7-oracle.json" | null;
  };
  readonly evidence: {
    readonly id: string;
    readonly origin: "pinned-upstream" | "local-regression";
    readonly compiler: typeof issue14TypeScript7Compiler;
  };
};

/** Path-length slack for small Issue 02 bytes-received budgets. */
export const issue02BytesReceivedPathLengthHeadroom = 32_768;

type Issue02Budget = Omit<Issue02TimingMetadata, "plan" | "order"> & { readonly fixture: string };
type ExternalSelectionBudget = Omit<ExternalSelectionTimingMetadata, "plan" | "order"> & {
  readonly fixture: string;
};

export type FixtureBudgets = {
  readonly timing: {
    readonly issue02: readonly Issue02Budget[];
    readonly externalSelection: readonly ExternalSelectionBudget[];
  };
  readonly virtualUpstreamDependency: readonly string[];
  readonly locallyGeneratedOracles: readonly string[];
  readonly excludedTypecheckProjects: readonly string[];
};
