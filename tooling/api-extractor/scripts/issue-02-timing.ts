import { Effect } from "effect";
import { createRequire } from "node:module";
import { join } from "node:path";

import {
  extractModuleWithTiming,
  InternalProjectExtractorTiming,
  timedProjectExtractorLayer,
} from "../src/internal/timing.ts";
import type { TimedExtraction } from "../src/internal/timing.ts";
import { writeArtifactBatch } from "./artifact-batch-writer.ts";
import { checkBoundary } from "./check-boundary.ts";
import {
  assertFixtureOracle,
  assertReactDivergenceEvidence,
  assertSupplementalFixture,
  fixtureDirectory,
  fixtureInputPath,
  issue02SupplementalFixtures,
  issue02TimingFixtures,
  readGoNoGoArtifact,
  readTimingReport,
  validateGoNoGoFixtureMatrix,
} from "./fixture-evidence.ts";
import type { GoNoGoArtifact, TimingReport } from "./fixture-evidence.ts";

type BoundaryStatuses = {
  readonly backendLeakage: "clear" | "triggered";
  readonly durableContractLeakage: "clear" | "triggered";
};

const reportPath = join(fixtureDirectory, "issue-02-timing.json");
const goNoGoPath = join(fixtureDirectory, "issue-02-go-no-go.json");
const tsconfigPath = join(fixtureDirectory, "issue-02-tsconfig.json");
const maxAggregateRoundTripMs = 1_000;
const expectedFixtureOrder = issue02TimingFixtures.map((fixture) => fixture.fixture);

function isTransportByteObservation(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

const stopConditionEvidence = {
  backendLeakage:
    "check-boundary.ts scans package source and declarations; unstable TypeScript imports are limited to src/backend/ts7/**",
  durableContractLeakage:
    "package-owned backend contracts, parser, model, warnings, errors, provenance, and ProjectExtractor expose no compiler objects",
  unacceptableIpcGrowth:
    "aggregate roundTripMs is measured across all four sequential boundary fixtures and compared with the 1000ms stop threshold",
} as const;

function packageVersion(packageName: string): string {
  const require = createRequire(import.meta.url);
  // SAFETY: package.json is loaded from the installed dependency's package boundary.
  const metadata = require(packageName + "/package.json") as { readonly version: string };
  return metadata.version;
}

function boundaryStatuses(): BoundaryStatuses {
  try {
    checkBoundary();
    return { backendLeakage: "clear", durableContractLeakage: "clear" };
  } catch {
    return { backendLeakage: "triggered", durableContractLeakage: "triggered" };
  }
}

function timedExtraction(inputPath: string): Promise<TimedExtraction> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const timing = yield* InternalProjectExtractorTiming;
        return yield* extractModuleWithTiming(timing, inputPath);
      }).pipe(Effect.provide(timedProjectExtractorLayer({ tsconfigPath })))
    )
  );
}

async function verifySupplementalFixtures(): Promise<void> {
  for (const definition of issue02SupplementalFixtures) {
    const extraction = await timedExtraction(fixtureInputPath(definition));
    assertSupplementalFixture(definition, extraction.result);
  }
}

async function collectSamples(): Promise<TimingReport["samples"]> {
  const result: Array<TimingReport["samples"][number]> = [];
  for (const definition of issue02TimingFixtures) {
    const extraction = await timedExtraction(fixtureInputPath(definition));
    assertFixtureOracle(definition, extraction.result);
    result.push({
      fixture: definition.fixture,
      enabled: extraction.timing.enabled,
      totals: extraction.timing.totals,
    });
  }
  await verifySupplementalFixtures();
  return result;
}

function reportFrom(samples: TimingReport["samples"]): TimingReport {
  const { backendLeakage: backend, durableContractLeakage: durable } = boundaryStatuses();
  const measuredAggregateRoundTripMs = samples.reduce(
    (total, sample) => total + sample.totals.roundTripMs,
    0
  );
  const ipcStatus = measuredAggregateRoundTripMs <= maxAggregateRoundTripMs ? "not-triggered" : "triggered";
  return {
    issue: "02-prove-compiler-boundary",
    command: "fnm exec --using 24.13.0 -- node scripts/issue-02-timing.ts --check",
    runtime: {
      node: process.versions.node,
      compiler: "typescript@" + packageVersion("typescript"),
    },
    samples,
    stopConditions: {
      backendLeakage: { status: backend, evidence: stopConditionEvidence.backendLeakage },
      durableContractLeakage: { status: durable, evidence: stopConditionEvidence.durableContractLeakage },
      unacceptableIpcGrowth: {
        maxAggregateRoundTripMs,
        measuredAggregateRoundTripMs,
        status: ipcStatus,
        evidence: stopConditionEvidence.unacceptableIpcGrowth,
      },
    },
    decision: backend === "clear" && durable === "clear" && ipcStatus === "not-triggered" ? "go" : "no-go",
  };
}

function checkGoNoGoArtifact(artifact: GoNoGoArtifact, measured: TimingReport): void {
  assertReactDivergenceEvidence();
  if (artifact.runtime.node !== "24.13.0") {
    throw new Error("The Issue 02 go/no-go artifact must target Node 24.13.0.");
  }
  if (artifact.runtime.compiler !== measured.runtime.compiler) {
    throw new Error("The Issue 02 go/no-go compiler pin is stale: " + artifact.runtime.compiler);
  }
  if (artifact.runtime.upstreamOracleCommit !== "e14535030957e29ce6e5d870e4ab71740175a0d4") {
    throw new Error("The Issue 02 go/no-go artifact has the wrong upstream oracle commit.");
  }
  validateGoNoGoFixtureMatrix(artifact.fixtureMatrix);
  const backend = measured.stopConditions.backendLeakage.status;
  const durable = measured.stopConditions.durableContractLeakage.status;
  if (artifact.stopConditions.backendLeakage.status !== backend) {
    throw new Error("The Issue 02 go/no-go backend boundary status is stale.");
  }
  const backendEvidence = artifact.stopConditions.backendLeakage.evidence;
  if (!backendEvidence.includes("src/backend/ts7/**") || backendEvidence.includes("src/backend/tsgo.ts")) {
    throw new Error("The Issue 02 go/no-go backend evidence path is stale.");
  }
  if (artifact.stopConditions.durableContractLeakage.status !== durable) {
    throw new Error("The Issue 02 go/no-go durable contract status is stale.");
  }
  if (
    artifact.stopConditions.unacceptableIpcGrowth.status !==
    measured.stopConditions.unacceptableIpcGrowth.status
  ) {
    throw new Error("The Issue 02 go/no-go timing stop status is stale.");
  }
  if (artifact.stopConditions.unacceptableIpcGrowth.threshold !== "aggregate roundTripMs <= 1000") {
    throw new Error("The Issue 02 go/no-go timing threshold is stale.");
  }
  if (
    artifact.verification.fixtureTypecheck !== "pass" ||
    artifact.verification.publicSeamConformance !== "pass" ||
    artifact.verification.timingEvidence !== "checked" ||
    artifact.verification.upstreamOraclePreserved !== true
  ) {
    throw new Error("The Issue 02 go/no-go verification evidence is incomplete.");
  }
  if (artifact.decision !== measured.decision) {
    throw new Error(
      "The Issue 02 go/no-go decision is stale: " + artifact.decision + " != " + measured.decision
    );
  }
  if (
    !artifact.decisionRationale.includes("explicit generic alias and mapped-alias coverage") ||
    !artifact.decisionRationale.includes("type-operator policy remains configurable") ||
    /\bno\s+(?:generic|type.?operator)\s+work\b/iu.test(artifact.decisionRationale)
  ) {
    throw new Error("The Issue 02 go/no-go rationale makes an unsupported resolver-scope claim.");
  }
  const expectedScopeEvidence = {
    generic: "boundary-covered: explicit generic arguments and two-hop mapped aliases",
    typeOperator:
      "policy-preserved: resolved and syntax-only modes remain available; broader conformance is deferred",
    react: "boundary-covered: compound component transform with a reviewed TS7 external-graph divergence",
  };
  if (JSON.stringify(artifact.scopeEvidence) !== JSON.stringify(expectedScopeEvidence)) {
    throw new Error("The Issue 02 go/no-go scope evidence is stale or incomplete.");
  }
}

function checkStoredReport(stored: TimingReport, measured: TimingReport, goNoGo: GoNoGoArtifact): void {
  if (stored.command !== measured.command) {
    throw new Error("The stored Issue 02 timing report identity is stale.");
  }
  if (stored.runtime.node !== "24.13.0") {
    throw new Error("The stored Issue 02 timing report must target Node 24.13.0.");
  }
  if (stored.runtime.compiler !== measured.runtime.compiler) {
    throw new Error("The timing report compiler pin is stale: " + stored.runtime.compiler);
  }
  if (stored.decision !== measured.decision) {
    throw new Error("The timing report decision is stale: " + stored.decision + " != " + measured.decision);
  }
  const storedFixtures = stored.samples.map((sample) => sample.fixture);
  if (JSON.stringify(storedFixtures) !== JSON.stringify(expectedFixtureOrder)) {
    throw new Error("The checked-in Issue 02 timing report has the wrong fixture order.");
  }
  if (stored.stopConditions.unacceptableIpcGrowth.maxAggregateRoundTripMs !== maxAggregateRoundTripMs) {
    throw new Error("The checked-in Issue 02 timing threshold is stale.");
  }
  if (
    stored.stopConditions.backendLeakage.status !== measured.stopConditions.backendLeakage.status ||
    stored.stopConditions.durableContractLeakage.status !==
      measured.stopConditions.durableContractLeakage.status ||
    stored.stopConditions.unacceptableIpcGrowth.status !==
      measured.stopConditions.unacceptableIpcGrowth.status
  ) {
    throw new Error("The checked-in Issue 02 timing stop-condition statuses are stale.");
  }
  const storedAggregate = stored.samples.reduce((total, sample) => total + sample.totals.roundTripMs, 0);
  const storedAggregateDelta = Math.abs(
    stored.stopConditions.unacceptableIpcGrowth.measuredAggregateRoundTripMs - storedAggregate
  );
  if (
    !Number.isFinite(stored.stopConditions.unacceptableIpcGrowth.measuredAggregateRoundTripMs) ||
    !Number.isFinite(storedAggregate) ||
    stored.stopConditions.unacceptableIpcGrowth.measuredAggregateRoundTripMs < 0 ||
    storedAggregateDelta > 0.001 ||
    stored.stopConditions.unacceptableIpcGrowth.status !==
      (storedAggregate <= maxAggregateRoundTripMs ? "not-triggered" : "triggered")
  ) {
    throw new Error("The checked-in Issue 02 timing aggregate evidence is stale.");
  }
  const expectedStoredDecision =
    stored.stopConditions.backendLeakage.status === "clear" &&
    stored.stopConditions.durableContractLeakage.status === "clear" &&
    stored.stopConditions.unacceptableIpcGrowth.status === "not-triggered"
      ? "go"
      : "no-go";
  if (stored.decision !== expectedStoredDecision) {
    throw new Error("The checked-in Issue 02 timing decision does not match its stop conditions.");
  }
  for (const sample of stored.samples) {
    if (
      sample.enabled !== true ||
      sample.totals.requestCount <= 0 ||
      !isTransportByteObservation(sample.totals.bytesSent) ||
      !isTransportByteObservation(sample.totals.bytesReceived) ||
      !Number.isFinite(sample.totals.roundTripMs) ||
      sample.totals.roundTripMs < 0
    ) {
      throw new Error("Invalid stored timing sample for " + sample.fixture);
    }
  }
  for (const sample of measured.samples) {
    if (
      !sample.enabled ||
      sample.totals.requestCount <= 0 ||
      !isTransportByteObservation(sample.totals.bytesSent) ||
      !isTransportByteObservation(sample.totals.bytesReceived)
    ) {
      throw new Error("Invalid live timing sample for " + sample.fixture);
    }
  }
  checkGoNoGoArtifact(goNoGo, measured);
}

if (process.versions.node !== "24.13.0") {
  throw new Error("Issue 02 timing evidence requires Node 24.13.0, got " + process.versions.node);
}
const measured = reportFrom(await collectSamples());
if (process.argv.includes("--write")) {
  const result = await writeArtifactBatch({
    outputRoot: fixtureDirectory,
    artifacts: [
      {
        destination: "issue-02-timing.json",
        content: `${JSON.stringify(measured, null, 2)}\n`,
        evidence: "generated",
      },
    ],
  });
  if (result.status === "failure") {
    throw new Error(
      `Issue 02 timing artifact write failed (${result.error.category}): ${result.error.message}`
    );
  }
} else {
  const stored = readTimingReport(reportPath);
  const goNoGo = readGoNoGoArtifact(goNoGoPath);
  checkStoredReport(stored, measured, goNoGo);
  console.log(
    JSON.stringify(
      {
        decision: measured.decision,
        samples: measured.samples.map((sample) => ({
          fixture: sample.fixture,
          requestCount: sample.totals.requestCount,
          roundTripMs: sample.totals.roundTripMs,
          bytesSent: sample.totals.bytesSent,
          bytesReceived: sample.totals.bytesReceived,
        })),
      },
      null,
      2
    )
  );
}
