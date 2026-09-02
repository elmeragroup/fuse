import { join } from "node:path";

import { writeArtifactBatchOrThrow } from "../artifact-batch-writer.ts";
import { assertNodeMajor, issue02TimingCommand } from "../files.ts";
import {
  assertBytesReceivedBudget,
  assertFetchedToMaterializedRatioBudget,
  assertFetchedToMaterializedRatioEvidence,
  assertFixtureOracle,
  assertReactDivergenceEvidence,
  assertRequestCountBudget,
  assertSupplementalFixture,
  fetchedToMaterializedRatio,
  fixtureDirectory,
  fixtureInputPath,
  issue02SupplementalFixtures,
  issue02TimingBudget,
  issue02TimingFixtures,
  isWithinIpcBudget,
  packageVersion,
  readGoNoGoArtifact,
  readTimingReport,
  validateGoNoGoFixtureMatrix,
} from "../fixture-evidence.ts";
import type { GoNoGoArtifact, TimingReport } from "../fixture-evidence.ts";
import { boundaryStatuses, timedExtraction } from "./shared.ts";

const reportPath = join(fixtureDirectory, "issue-02-timing.json");
const goNoGoPath = join(fixtureDirectory, "issue-02-go-no-go.json");
const tsconfigPath = join(fixtureDirectory, "issue-02-tsconfig.json");
/** The go/no-go artifact names the deterministic IPC gate; wall-clock fields are recorded observations only. */
const issue02IpcThreshold = "each fixture's requestCount and bytesReceived <= its catalog ceiling";
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
    "all four sequential boundary fixtures must keep requestCount and bytesReceived within their catalog ceilings; roundTripMs is recorded as an observation only",
} as const;

async function verifySupplementalFixtures(): Promise<void> {
  for (const definition of issue02SupplementalFixtures) {
    const extraction = await timedExtraction(tsconfigPath, fixtureInputPath(definition));
    assertSupplementalFixture(definition, extraction.result);
  }
}

async function collectSamples(): Promise<TimingReport["samples"]> {
  // This function measures the live budget decision. The checked-in report is
  // intentionally a separate, immutable baseline consumed by Issue 14.
  const result: Array<TimingReport["samples"][number]> = [];
  for (const definition of issue02TimingFixtures) {
    const extraction = await timedExtraction(tsconfigPath, fixtureInputPath(definition));
    assertFixtureOracle(definition, extraction.result);
    result.push({
      fixture: definition.fixture,
      enabled: extraction.timing.enabled,
      totals: extraction.timing.totals,
      fetchedToMaterializedRatio: fetchedToMaterializedRatio(extraction.timing.totals),
      budget: issue02TimingBudget(definition),
    });
  }
  await verifySupplementalFixtures();
  return result;
}

function reportFrom(samples: TimingReport["samples"]): TimingReport {
  for (const sample of samples) assertFetchedToMaterializedRatioEvidence(sample);
  const { backendLeakage: backend, durableContractLeakage: durable } = boundaryStatuses();
  const ipcStatus = samples.every(isWithinIpcBudget) ? "not-triggered" : "triggered";
  return {
    issue: "02-prove-compiler-boundary",
    command: issue02TimingCommand,
    runtime: {
      node: process.versions.node,
      compiler: "typescript@" + packageVersion("typescript"),
    },
    samples,
    stopConditions: {
      backendLeakage: { status: backend, evidence: stopConditionEvidence.backendLeakage },
      durableContractLeakage: { status: durable, evidence: stopConditionEvidence.durableContractLeakage },
      unacceptableIpcGrowth: {
        status: ipcStatus,
        evidence: stopConditionEvidence.unacceptableIpcGrowth,
      },
    },
    decision: backend === "clear" && durable === "clear" && ipcStatus === "not-triggered" ? "go" : "no-go",
  };
}

function checkGoNoGoArtifact(artifact: GoNoGoArtifact, measured: TimingReport): void {
  assertReactDivergenceEvidence();
  assertNodeMajor(artifact.runtime.node);
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
  if (artifact.stopConditions.unacceptableIpcGrowth.threshold !== issue02IpcThreshold) {
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

function checkLiveSamples(measured: TimingReport): void {
  for (const sample of measured.samples) {
    // Only the fresh measurement is a live budget decision. Issue 14 consumes
    // the same measurement as its exact semantic-counter contract.
    assertFetchedToMaterializedRatioBudget(sample);
    assertRequestCountBudget(sample);
    assertBytesReceivedBudget(sample);
    if (
      !sample.enabled ||
      sample.totals.requestCount <= 0 ||
      !isTransportByteObservation(sample.totals.bytesSent) ||
      !isTransportByteObservation(sample.totals.bytesReceived)
    ) {
      throw new Error("Invalid live timing sample for " + sample.fixture);
    }
  }
}

function checkStoredReport(stored: TimingReport, measured: TimingReport, goNoGo: GoNoGoArtifact): void {
  checkLiveSamples(measured);
  if (measured.command !== issue02TimingCommand) {
    throw new Error("The live Issue 02 timing command identity is stale.");
  }
  assertNodeMajor(stored.runtime.node);
  assertNodeMajor(measured.runtime.node);
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
  if (
    stored.stopConditions.backendLeakage.status !== measured.stopConditions.backendLeakage.status ||
    stored.stopConditions.durableContractLeakage.status !==
      measured.stopConditions.durableContractLeakage.status ||
    stored.stopConditions.unacceptableIpcGrowth.status !==
      measured.stopConditions.unacceptableIpcGrowth.status
  ) {
    throw new Error("The checked-in Issue 02 timing stop-condition statuses are stale.");
  }
  // The stored IPC status is the decision recorded when the pre-optimization
  // baseline was written; today's ceilings are enforced on the live samples
  // above, never recomputed against these historical totals.
  const expectedStoredDecision =
    stored.stopConditions.backendLeakage.status === "clear" &&
    stored.stopConditions.durableContractLeakage.status === "clear" &&
    stored.stopConditions.unacceptableIpcGrowth.status === "not-triggered"
      ? "go"
      : "no-go";
  if (stored.decision !== expectedStoredDecision) {
    throw new Error("The checked-in Issue 02 timing decision does not match its stop conditions.");
  }
  const measuredByFixture = new Map(measured.samples.map((sample) => [sample.fixture, sample]));
  for (const sample of stored.samples) {
    // Issue 02's checked-in samples are an immutable pre-optimization
    // baseline. Validate their recorded ratio and budget metadata, but do not
    // enforce today's live ceilings against those historical totals.
    assertFetchedToMaterializedRatioEvidence(sample);
    const measuredSample = measuredByFixture.get(sample.fixture);
    if (
      measuredSample === undefined ||
      sample.budget.maxFetchedToMaterializedRatio !== measuredSample.budget.maxFetchedToMaterializedRatio ||
      sample.budget.maxRequestCount !== measuredSample.budget.maxRequestCount ||
      sample.budget.maxBytesReceived !== measuredSample.budget.maxBytesReceived ||
      sample.budget.bytesReceivedPathLengthHeadroom !== measuredSample.budget.bytesReceivedPathLengthHeadroom
    ) {
      throw new Error(`The Issue 02 timing budget is stale for ${sample.fixture}.`);
    }
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
  checkGoNoGoArtifact(goNoGo, measured);
}

/** Measures the live Issue 02 report; `--write` stores it, `--check` compares it with the stored evidence. */
export async function runIssue02Timing(mode: "check" | "write"): Promise<void> {
  const measured = reportFrom(await collectSamples());
  if (mode === "write") {
    await writeArtifactBatchOrThrow(
      {
        outputRoot: fixtureDirectory,
        artifacts: [
          {
            destination: "issue-02-timing.json",
            content: `${JSON.stringify(measured, null, 2)}\n`,
            evidence: "generated",
          },
        ],
      },
      "Issue 02 timing artifact write"
    );
    return;
  }
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
          fetchedToMaterializedRatio: sample.fetchedToMaterializedRatio,
          maxFetchedToMaterializedRatio: sample.budget.maxFetchedToMaterializedRatio,
          maxRequestCount: sample.budget.maxRequestCount,
          maxBytesReceived: sample.budget.maxBytesReceived,
        })),
      },
      null,
      2
    )
  );
}
