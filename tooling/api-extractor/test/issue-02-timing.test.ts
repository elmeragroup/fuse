import { Effect } from "effect";
import type { Schema } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  decodeGoNoGoArtifact,
  decodeTimingReport,
  readGoNoGoArtifact,
  readTimingReport,
  validateGoNoGoFixtureMatrix,
} from "../scripts/fixture-evidence.ts";
import { ProjectExtractor } from "../src/index.ts";
import {
  extractModuleWithTiming,
  InternalProjectExtractorTiming,
  timedProjectExtractorLayer,
} from "../src/internal/timing.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureDirectory, "issue-02-tsconfig.json");
const timingReportPath = resolve(fixtureDirectory, "issue-02-timing.json");
const goNoGoPath = resolve(fixtureDirectory, "issue-02-go-no-go.json");
const cases = [
  ["alias-with-explicit-type-args", "input.ts"],
  ["mapped-alias-two-hop", "input.ts"],
  ["module-dts-declarations-and-reexports", "input.d.ts"],
  ["base-ui-component", "input.tsx"],
] as const;

describe("Issue 02 compiler timing boundary", () => {
  it("decodes complete checked-in artifacts and rejects malformed nested fields", () => {
    const timing = readTimingReport(timingReportPath);
    const goNoGo = readGoNoGoArtifact(goNoGoPath);

    expect(timing.samples[0]?.totals.nodesFetched).toBeGreaterThan(0);
    const supplemental = goNoGo.fixtureMatrix[2];
    expect(supplemental.fixture).toBe("module-dts-declarations-and-reexports");
    expect(supplemental.notes).toContain("module import metadata is preserved");
    expect(timing.stopConditions.backendLeakage.evidence).toContain("check-boundary.ts");
    expect(timing.stopConditions.durableContractLeakage.evidence).toContain("backend contracts");
    expect(timing.stopConditions.unacceptableIpcGrowth.evidence).toContain("all four");
    expect(goNoGo.stopConditions.durableContractLeakage.evidence).toContain("backend contracts");
    expect(goNoGo.residualRisk).toHaveLength(3);

    const malformedTiming = {
      ...timing,
      samples: timing.samples.map((sample, index) =>
        index === 0 ? { ...sample, totals: { ...sample.totals, nodesFetched: "not-a-number" } } : sample
      ),
    } satisfies Schema.Json;
    expect(() => decodeTimingReport(malformedTiming)).toThrow();

    const missingTimingEvidence = {
      ...timing,
      stopConditions: {
        ...timing.stopConditions,
        backendLeakage: { status: timing.stopConditions.backendLeakage.status },
      },
    } satisfies Schema.Json;
    expect(() => decodeTimingReport(missingTimingEvidence)).toThrow();

    const { residualRisk: _residualRisk, ...missingResidualRisk } = goNoGo;
    expect(() => decodeGoNoGoArtifact(missingResidualRisk)).toThrow();

    const missingBackendEvidence = {
      ...goNoGo,
      stopConditions: {
        ...goNoGo.stopConditions,
        backendLeakage: { status: goNoGo.stopConditions.backendLeakage.status },
      },
    } satisfies Schema.Json;
    expect(() => decodeGoNoGoArtifact(missingBackendEvidence)).toThrow();

    const missingSupplementalNotes = {
      ...goNoGo,
      fixtureMatrix: goNoGo.fixtureMatrix.map((fixture, index) => {
        if (index !== 3) return fixture;
        return { fixture: fixture.fixture, oracle: fixture.oracle, status: fixture.status };
      }),
    } satisfies Schema.Json;
    expect(() => decodeGoNoGoArtifact(missingSupplementalNotes)).toThrow();

    const missingFixture = {
      ...goNoGo,
      fixtureMatrix: goNoGo.fixtureMatrix.slice(0, -1),
    } satisfies Schema.Json;
    expect(() => decodeGoNoGoArtifact(missingFixture)).toThrow();

    const malformedReactEvidence = {
      ...goNoGo,
      fixtureMatrix: goNoGo.fixtureMatrix.map((fixture, index) =>
        index === 6 ? { ...fixture, warningOracle: 123 } : fixture
      ),
    } satisfies Schema.Json;
    expect(() => decodeGoNoGoArtifact(malformedReactEvidence)).toThrow();

    const blankResidualRisk = {
      ...goNoGo,
      residualRisk: ["   "],
    } satisfies Schema.Json;
    expect(() => decodeGoNoGoArtifact(blankResidualRisk)).toThrow();
  });

  it("rejects decoded fixture-matrix metadata drift", () => {
    const goNoGo = readGoNoGoArtifact(goNoGoPath);
    const fixtureMatrix = goNoGo.fixtureMatrix;
    const supplemental = fixtureMatrix[3];
    const react = fixtureMatrix[6];
    const wrongSupplementalNote = {
      ...goNoGo,
      fixtureMatrix: [
        fixtureMatrix[0],
        fixtureMatrix[1],
        fixtureMatrix[2],
        {
          ...supplemental,
          notes: supplemental.notes.map((note, noteIndex) => (noteIndex === 0 ? note + " (stale)" : note)),
        },
        fixtureMatrix[4],
        fixtureMatrix[5],
        fixtureMatrix[6],
      ],
    } satisfies Schema.Json;
    const decodedWrongSupplementalNote = decodeGoNoGoArtifact(wrongSupplementalNote);
    expect(() => validateGoNoGoFixtureMatrix(decodedWrongSupplementalNote.fixtureMatrix)).toThrow();

    const wrongReactDivergenceRecord = {
      ...goNoGo,
      fixtureMatrix: [
        fixtureMatrix[0],
        fixtureMatrix[1],
        fixtureMatrix[2],
        fixtureMatrix[3],
        fixtureMatrix[4],
        fixtureMatrix[5],
        { ...react, divergenceRecord: react.divergenceRecord + " (stale)" },
      ],
    } satisfies Schema.Json;
    const decodedWrongReactDivergenceRecord = decodeGoNoGoArtifact(wrongReactDivergenceRecord);
    expect(() => validateGoNoGoFixtureMatrix(decodedWrongReactDivergenceRecord.fixtureMatrix)).toThrow();

    const wrongReactWarningOracle = {
      ...goNoGo,
      fixtureMatrix: [
        fixtureMatrix[0],
        fixtureMatrix[1],
        fixtureMatrix[2],
        fixtureMatrix[3],
        fixtureMatrix[4],
        fixtureMatrix[5],
        { ...react, warningOracle: react.warningOracle + " (stale)" },
      ],
    } satisfies Schema.Json;
    const decodedWrongReactWarningOracle = decodeGoNoGoArtifact(wrongReactWarningOracle);
    expect(() => validateGoNoGoFixtureMatrix(decodedWrongReactWarningOracle.fixtureMatrix)).toThrow();
  });

  it.each(cases)(
    "reports normalized compiler IPC timing for %s through the public seam",
    async (name, file) => {
      const inputPath = resolve(fixtureDirectory, name, file);
      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            yield* ProjectExtractor;
            const timing = yield* InternalProjectExtractorTiming;
            return yield* extractModuleWithTiming(timing, inputPath);
          }).pipe(Effect.provide(timedProjectExtractorLayer({ tsconfigPath })))
        )
      );

      expect(result.result).not.toHaveProperty("timing");
      expect(result.timing.enabled).toBe(true);
      expect(result.timing.totals.requestCount).toBeGreaterThan(0);
      expect(result.timing.totals.roundTripMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.totals.bytesSent).toBeGreaterThan(0);
      expect(result.timing.totals.bytesReceived).toBeGreaterThan(0);
      expect(result.timing.recentRequests.length).toBeGreaterThan(0);
      expect(result.timing.recentRequests.every((request) => request.roundTripMs >= 0)).toBe(true);
    }
  );
});
