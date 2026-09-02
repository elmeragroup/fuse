/** Stable identity strings shared by the Issue 14 evidence producers and validators. */
export const issue14ConformanceCommand = "node scripts/issue-14-conformance.ts --check" as const;
export const issue14TimingCommand =
  "fnm exec --using 24.13.0 -- node scripts/issue-14-timing.ts --check" as const;
export const issue14NodeVersion = "24.13.0" as const;
export const issue14CompilerVersion = "typescript@7.0.2" as const;
export const issue14TimingStableContract = "semantic-counters-exact" as const;
export const issue14TimingWallClockContract = "observational" as const;
export const issue14TimingWallClockRationale =
  "wall-clock IPC fields vary with scheduler and process load; transport byte counts vary with checkout paths; both remain observations, while semantic counters stay exact and live/stored aggregates stay below 1000ms" as const;
export const issue14BackendLeakageEvidence =
  "check-boundary.ts verifies unstable TypeScript imports remain inside src/backend/ts7/**" as const;
export const issue14DurableContractLeakageEvidence =
  "package-owned model, warnings, provenance, and ProjectExtractor expose no compiler objects" as const;
export const issue14IpcThreshold = "aggregate roundTripMs <= 1000" as const;
export const issue14IpcEvidence =
  "each fixture runs in a fresh public-seam timing session like the Issue 02 baseline; semantic counters are exact, wall-clock and transport byte fields are observational, and both live and stored aggregates are checked against 1000ms" as const;

export function issue14SelectedOracleFile(definition: Issue14Fixture): "output.json" | "output.tsgo.json" {
  return definition.disposition === "reviewed-ts7" ? "output.tsgo.json" : "output.json";
}

// The typecheck runner owns both the reproducible command string and the
// compiler argv used to execute it. Re-exporting keeps all evidence consumers
// on that single owner without making the contract module another source of
// command drift.
export { issue14TypecheckCommand, issue14TypecheckStrategy } from "./issue-14-typecheck.ts";
import type { Issue14Fixture } from "./fixture-views.ts";
