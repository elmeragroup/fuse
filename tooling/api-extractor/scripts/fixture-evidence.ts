import { Schema } from "effect";
/* oxlint-disable anti-slop/no-runtime-typeof -- Schema.Json is decoded before recursive comparison. */
/* oxlint-disable typescript/no-unsafe-argument -- JSON.parse values are decoded by Schema.Json immediately. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import type { ExtractionResult } from "../src/extractor.ts";
import { ModuleNodeSchema } from "../src/model.ts";
import type { ModuleNode } from "../src/model.ts";
import { ExtractWarningSchema } from "../src/warnings.ts";
import type { ExtractWarning } from "../src/warnings.ts";
import { issue14TypeScript7Compiler } from "./fixture-manifest.ts";

export const fixtureDirectory = resolve(import.meta.dirname, "../test/fixtures");
const packageDirectory = resolve(import.meta.dirname, "..");

export * from "./fixture-registry.ts";
export * from "./fixture-manifest.ts";

import { issue02GoNoGoFixtures } from "./fixture-registry.ts";
import type { Issue02SupplementalFixture, Issue02TimingFixture } from "./fixture-registry.ts";

const TimingTotalsSchema = Schema.Struct({
  requestCount: Schema.Number,
  roundTripMs: Schema.Number,
  bytesSent: Schema.Number,
  bytesReceived: Schema.Number,
  serverTimeMs: Schema.Number,
  transportOverheadMs: Schema.Number,
  nodesMaterialized: Schema.Number,
  sourceFilesFetched: Schema.Number,
  nodesFetched: Schema.Number,
});

const BoundaryStatusSchema = Schema.Literals(["clear", "triggered"] as const);
const DecisionSchema = Schema.Literals(["go", "no-go"] as const);
const TimingStatusSchema = Schema.Literals(["not-triggered", "triggered"] as const);
const EvidenceTextSchema = Schema.String.check(Schema.isPattern(/\S/u));

const TimingReportSampleSchema = Schema.Struct({
  fixture: Schema.String,
  enabled: Schema.Boolean,
  totals: TimingTotalsSchema,
});

const TimingStopConditionEvidenceSchema = Schema.Struct({
  status: BoundaryStatusSchema,
  evidence: EvidenceTextSchema,
});

const TimingIpcStopConditionEvidenceSchema = Schema.Struct({
  maxAggregateRoundTripMs: Schema.Number,
  measuredAggregateRoundTripMs: Schema.Number,
  status: TimingStatusSchema,
  evidence: EvidenceTextSchema,
});

export const TimingReportSchema = Schema.Struct({
  issue: Schema.Literal("02-prove-compiler-boundary"),
  command: Schema.String,
  runtime: Schema.Struct({
    node: Schema.String,
    compiler: Schema.String,
  }),
  samples: Schema.Array(TimingReportSampleSchema),
  stopConditions: Schema.Struct({
    backendLeakage: TimingStopConditionEvidenceSchema,
    durableContractLeakage: TimingStopConditionEvidenceSchema,
    unacceptableIpcGrowth: TimingIpcStopConditionEvidenceSchema,
  }),
  decision: DecisionSchema,
});

/**
 * The checked-in go/no-go artifact is a fixed gate. Keep its seven exact
 * discriminants in the decoder, then validate the complete decoded matrix
 * against issue02GoNoGoFixtures below so metadata cannot silently drift.
 */
const GoNoGoFixtureMatrixSchema = Schema.Tuple([
  Schema.Struct({
    fixture: Schema.Literal("alias-with-explicit-type-args"),
    oracle: Schema.Literal("immutable-upstream"),
    status: Schema.Literal("pass"),
  }),
  Schema.Struct({
    fixture: Schema.Literal("mapped-alias-two-hop"),
    oracle: Schema.Literal("immutable-upstream"),
    status: Schema.Literal("pass"),
  }),
  Schema.Struct({
    fixture: Schema.Literal("module-dts-declarations-and-reexports"),
    oracle: Schema.Literal("immutable-upstream"),
    status: Schema.Literal("pass"),
    notes: Schema.NonEmptyArray(EvidenceTextSchema),
  }),
  Schema.Struct({
    fixture: Schema.Literal("module-dts-type-star"),
    oracle: Schema.Literal("public-seam-regression"),
    status: Schema.Literal("pass"),
    notes: Schema.NonEmptyArray(EvidenceTextSchema),
  }),
  Schema.Struct({
    fixture: Schema.Literal("module-resolution-alias"),
    oracle: Schema.Literal("public-seam-regression"),
    status: Schema.Literal("pass"),
    notes: Schema.NonEmptyArray(EvidenceTextSchema),
  }),
  Schema.Struct({
    fixture: Schema.Literal("module-resolution-package"),
    oracle: Schema.Literal("public-seam-regression"),
    status: Schema.Literal("pass"),
    notes: Schema.NonEmptyArray(EvidenceTextSchema),
  }),
  Schema.Struct({
    fixture: Schema.Literal("base-ui-component"),
    oracle: Schema.Literal("reviewed-ts7-exact"),
    status: Schema.Literal("pass"),
    divergenceRecord: EvidenceTextSchema,
    warningOracle: EvidenceTextSchema,
  }),
]);

export const GoNoGoArtifactSchema = Schema.Struct({
  issue: Schema.Literal("02-prove-compiler-boundary"),
  decision: DecisionSchema,
  decisionRationale: Schema.String,
  runtime: Schema.Struct({
    node: Schema.String,
    compiler: Schema.String,
    upstreamOracleCommit: Schema.String,
  }),
  fixtureMatrix: GoNoGoFixtureMatrixSchema,
  stopConditions: Schema.Struct({
    backendLeakage: Schema.Struct({
      status: BoundaryStatusSchema,
      evidence: EvidenceTextSchema,
    }),
    durableContractLeakage: Schema.Struct({
      status: BoundaryStatusSchema,
      evidence: EvidenceTextSchema,
    }),
    unacceptableIpcGrowth: Schema.Struct({
      status: TimingStatusSchema,
      threshold: Schema.String,
      evidence: EvidenceTextSchema,
    }),
  }),
  verification: Schema.Struct({
    fixtureTypecheck: Schema.String,
    publicSeamConformance: Schema.String,
    timingEvidence: Schema.String,
    upstreamOraclePreserved: Schema.Boolean,
  }),
  scopeEvidence: Schema.Struct({
    generic: Schema.String,
    typeOperator: Schema.String,
    react: Schema.String,
  }),
  residualRisk: Schema.NonEmptyArray(EvidenceTextSchema),
});

export type TimingReport = Schema.Schema.Type<typeof TimingReportSchema>;
export type GoNoGoArtifact = Schema.Schema.Type<typeof GoNoGoArtifactSchema>;

type ReactDivergenceArtifact = {
  readonly fixture: "base-ui-component";
  readonly compiler: typeof issue14TypeScript7Compiler;
  readonly sourceOracle: "output.json";
  readonly comparison: "exact";
  readonly divergence: {
    readonly code: string;
    readonly reason: string;
    readonly genus: string;
    readonly upstreamPreserved: boolean;
    readonly differenceCount: number;
    readonly differenceDigest: string;
    readonly differencePaths?: readonly string[];
  };
};

const ReactDivergenceArtifactSchema = Schema.Struct({
  fixture: Schema.Literal("base-ui-component"),
  compiler: Schema.Literal(issue14TypeScript7Compiler),
  sourceOracle: Schema.Literal("output.json"),
  comparison: Schema.Literal("exact"),
  divergence: Schema.Struct({
    code: EvidenceTextSchema,
    reason: EvidenceTextSchema,
    genus: EvidenceTextSchema,
    upstreamPreserved: Schema.Boolean,
    differenceCount: Schema.Natural,
    differenceDigest: EvidenceTextSchema,
    /** Legacy reviewed records carry count+digest; newer records may add paths. */
    differencePaths: Schema.optionalKey(Schema.Array(EvidenceTextSchema)),
  }),
});

const Ts7DivergenceArtifactSchema = Schema.Struct({
  fixture: Schema.String,
  compiler: Schema.Literal(issue14TypeScript7Compiler),
  sourceOracle: Schema.Literal("output.json"),
  comparison: Schema.Literal("exact"),
  divergence: Schema.Struct({
    code: EvidenceTextSchema,
    reason: EvidenceTextSchema,
    /** A stable machine-readable genus for grouping, not a vague TS7 label. */
    genus: EvidenceTextSchema,
    upstreamPreserved: Schema.Boolean,
    differenceCount: Schema.Natural,
    differenceDigest: EvidenceTextSchema,
    /** Exact paths are optional for the legacy records; count+digest remain required. */
    differencePaths: Schema.optionalKey(Schema.Array(EvidenceTextSchema)),
  }),
});
function fixtureFile(fixture: string, file: string, fixtureRoot = fixtureDirectory): string {
  return resolve(fixtureRoot, fixture, file);
}

function isJsonObject(value: Schema.Json): value is Schema.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodedJson(path: string): Schema.Json {
  return Schema.decodeUnknownSync(Schema.Json)(JSON.parse(readFileSync(path, "utf8")));
}

export function decodeTimingReport(value: Schema.Json): TimingReport {
  return Schema.decodeUnknownSync(TimingReportSchema)(value);
}

export function decodeGoNoGoArtifact(value: Schema.Json): GoNoGoArtifact {
  return Schema.decodeUnknownSync(GoNoGoArtifactSchema)(value);
}

/** Validate every decoded fixture-matrix field against the canonical gate. */
export function validateGoNoGoFixtureMatrix(matrix: GoNoGoArtifact["fixtureMatrix"]): void {
  if (JSON.stringify(matrix) !== JSON.stringify(issue02GoNoGoFixtures)) {
    throw new Error("The Issue 02 go/no-go fixture matrix is stale or incomplete.");
  }
}

export function readTimingReport(path: string): TimingReport {
  return decodeTimingReport(decodedJson(path));
}

export function readGoNoGoArtifact(path: string): GoNoGoArtifact {
  return decodeGoNoGoArtifact(decodedJson(path));
}

export function fixtureInputPath(definition: Issue02TimingFixture | Issue02SupplementalFixture): string {
  return fixtureFile(definition.fixture, definition.file);
}

export function readModuleOracle(definition: Issue02TimingFixture): ModuleNode {
  return Schema.decodeUnknownSync(ModuleNodeSchema)(
    decodedJson(fixtureFile(definition.fixture, definition.oracleFile))
  );
}

export function readWarningOracle(definition: Issue02TimingFixture): readonly ExtractWarning[] {
  return Schema.decodeUnknownSync(Schema.Array(ExtractWarningSchema))(
    decodedJson(fixtureFile(definition.fixture, definition.warningOracle))
  );
}

export function stableWarningPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const libMarker = "/lib/";
  const libIndex = normalized.lastIndexOf(libMarker);
  if (normalized.includes("/node_modules/") && libIndex >= 0) {
    return `node_modules/typescript/lib/${normalized.slice(libIndex + libMarker.length)}`;
  }
  const workspaceRelative = relative(packageDirectory, filePath).replaceAll("\\", "/");
  return workspaceRelative.startsWith("../") ? "external/" + workspaceRelative : workspaceRelative;
}

export function normalizeWarnings(warnings: readonly ExtractWarning[]): readonly ExtractWarning[] {
  return warnings.map((warning) => {
    const normalizedFilePath = stableWarningPath(warning.filePath);
    const normalizedStack = warning.parsedSymbolStack.map((entry) =>
      entry.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(entry) ? stableWarningPath(entry) : entry
    );
    let message = warning.message.replaceAll(warning.filePath, normalizedFilePath);
    for (const [index, entry] of warning.parsedSymbolStack.entries()) {
      message = message.replaceAll(entry, normalizedStack[index] ?? entry);
    }
    return { ...warning, filePath: normalizedFilePath, parsedSymbolStack: normalizedStack, message };
  });
}

function leafPaths(value: Schema.Json | undefined, path: string): readonly string[] {
  if (value === undefined) return [];
  if (value === null || typeof value !== "object") return [path];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${path}/@length`];
    return value.flatMap((entry, index) => leafPaths(entry, `${path}/${index}`));
  }
  if (!isJsonObject(value)) return [path];
  const keys = Object.keys(value);
  if (keys.length === 0) return [path];
  return keys.flatMap((key) => leafPaths(value[key], `${path}/${key}`));
}

function differencePaths(
  left: Schema.Json | undefined,
  right: Schema.Json | undefined,
  path = ""
): readonly string[] {
  if (left === undefined || right === undefined) {
    return left === right ? [] : [...leafPaths(left, path), ...leafPaths(right, path)];
  }
  if (typeof left !== typeof right || left === null || right === null || typeof left !== "object") {
    return Object.is(left, right) ? [] : [path];
  }
  if (Array.isArray(left)) {
    if (!Array.isArray(right)) return [...leafPaths(left, path), ...leafPaths(right, path)];
    const result: string[] = left.length === right.length ? [] : [`${path}/@length`];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      result.push(...differencePaths(left[index], right[index], `${path}/${index}`));
    }
    return result;
  }
  if (Array.isArray(right)) return [...leafPaths(left, path), ...leafPaths(right, path)];
  if (!isJsonObject(left) || !isJsonObject(right)) return [path];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].flatMap((key) => differencePaths(left[key], right[key], `${path}/${key}`));
}

export function canonicalDifferencePaths(left: Schema.Json, right: Schema.Json): readonly string[] {
  return [...new Set(differencePaths(left, right))].sort();
}

/** SHA-256 of the canonical JSON encoding of the sorted, exact leaf paths. */
export function differenceDigest(paths: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...new Set(paths)].sort()), "utf8")
    .digest("hex");
}

function readReactDivergenceArtifact(fixtureRoot = fixtureDirectory): ReactDivergenceArtifact {
  return Schema.decodeUnknownSync(ReactDivergenceArtifactSchema)(
    decodedJson(fixtureFile("base-ui-component", "ts7-oracle.json", fixtureRoot))
  );
}

export function assertReactDivergenceEvidence(fixtureRoot = fixtureDirectory): void {
  const artifact = readReactDivergenceArtifact(fixtureRoot);
  const upstream = decodedJson(fixtureFile("base-ui-component", "output.json", fixtureRoot));
  const ts7 = decodedJson(fixtureFile("base-ui-component", "output.tsgo.json", fixtureRoot));
  const paths = canonicalDifferencePaths(upstream, ts7);
  if (paths.length === 0 || artifact.divergence.differenceCount === 0) {
    throw new Error("The React TS7 divergence must retain a nonzero upstream difference.");
  }
  if (
    artifact.divergence.differenceCount !== paths.length ||
    artifact.divergence.differenceDigest !== differenceDigest(paths) ||
    (artifact.divergence.differencePaths !== undefined &&
      JSON.stringify(artifact.divergence.differencePaths) !== JSON.stringify(paths))
  ) {
    throw new Error("The React TS7 divergence evidence is stale or incomplete.");
  }
  if (
    artifact.divergence.genus.length === 0 ||
    !artifact.divergence.upstreamPreserved ||
    artifact.divergence.reason.length === 0
  ) {
    throw new Error("The React TS7 divergence evidence must preserve and explain the upstream oracle.");
  }
}

/**
 * Validates a reviewed TypeScript 7 divergence record against the two oracles
 * it describes. The upstream oracle is never rewritten, so a stale record or a
 * silently regenerated TS7 oracle fails instead of hiding compiler drift.
 */
export function assertTs7DivergenceEvidence(fixture: string, fixtureRoot = fixtureDirectory): void {
  const artifact = Schema.decodeUnknownSync(Ts7DivergenceArtifactSchema)(
    decodedJson(fixtureFile(fixture, "ts7-oracle.json", fixtureRoot))
  );
  if (artifact.fixture !== fixture) {
    throw new Error(`The TS7 divergence record names a different fixture: ${fixture}`);
  }
  const paths = canonicalDifferencePaths(
    decodedJson(fixtureFile(fixture, "output.json", fixtureRoot)),
    decodedJson(fixtureFile(fixture, "output.tsgo.json", fixtureRoot))
  );
  if (
    artifact.divergence.differenceCount !== paths.length ||
    artifact.divergence.differenceDigest !== differenceDigest(paths)
  ) {
    throw new Error(`The TS7 divergence evidence is stale or incomplete: ${fixture}`);
  }
  if (
    artifact.divergence.differencePaths !== undefined &&
    JSON.stringify(artifact.divergence.differencePaths) !== JSON.stringify(paths)
  ) {
    throw new Error(`The TS7 divergence paths are stale or incomplete: ${fixture}`);
  }
  if (artifact.divergence.genus.trim().length === 0) {
    throw new Error(`The TS7 divergence genus must be non-empty: ${fixture}`);
  }
  if (paths.length === 0 || artifact.divergence.differenceCount === 0) {
    throw new Error(`The TS7 divergence must retain a nonzero upstream difference: ${fixture}`);
  }
  if (!artifact.divergence.upstreamPreserved || artifact.divergence.reason.length === 0) {
    throw new Error(`The TS7 divergence evidence must preserve and explain the upstream oracle: ${fixture}`);
  }
}

export function readFixtureOracle(fixture: string, oracleFile: string): ModuleNode {
  return Schema.decodeUnknownSync(ModuleNodeSchema)(decodedJson(fixtureFile(fixture, oracleFile)));
}

export function assertStableWarningOracle(definition: Issue02TimingFixture): void {
  const source = readFileSync(fixtureFile(definition.fixture, definition.warningOracle), "utf8");
  if (
    /(?:^|["':\s(])\/(?:[^"'\s]|\\.)+/u.test(source) ||
    /[A-Za-z]:[\\/]/u.test(source) ||
    /node_modules[\\/]\.pnpm[\\/]/u.test(source)
  ) {
    throw new Error(`The warning oracle contains an unstable path: ${definition.fixture}`);
  }
}

export function assertFixtureOracle(definition: Issue02TimingFixture, result: ExtractionResult): void {
  if (definition.fixture === "base-ui-component") assertReactDivergenceEvidence();
  if (JSON.stringify(result.module) !== JSON.stringify(readModuleOracle(definition))) {
    throw new Error(`The live fixture no longer matches its reviewed oracle: ${definition.fixture}`);
  }
  assertStableWarningOracle(definition);
  if (JSON.stringify(normalizeWarnings(result.warnings)) !== JSON.stringify(readWarningOracle(definition))) {
    throw new Error(
      `The live fixture warning output no longer matches its checked-in oracle: ${definition.fixture}`
    );
  }
}

export function assertSupplementalFixture(
  definition: Issue02SupplementalFixture,
  result: ExtractionResult
): void {
  const names = result.module.exports.map((entry) => entry.name);
  if (JSON.stringify(names) !== JSON.stringify(definition.expectedExports)) {
    throw new Error(`The live public-seam regression fixture changed: ${definition.fixture}`);
  }
  if (result.warnings.length > 0) {
    throw new Error(
      `The live public-seam regression fixture emitted unexpected warnings: ${definition.fixture}`
    );
  }
  if (result.module.exports.some((entry) => entry.type.kind !== "object")) {
    throw new Error(`The live public-seam regression fixture changed type resolution: ${definition.fixture}`);
  }
}
