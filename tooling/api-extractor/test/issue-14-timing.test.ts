import { Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertSemanticTotalsEqual,
  assertStoredTimingReport,
  assertTimingReportInvariants,
  Issue14TimingReportSchema,
  subtractTotals,
  timingToleranceMs,
  TimingCommandOutputSchema,
  timingCommandOutput,
} from "../scripts/issue-14-timing.ts";
import type { Issue14TimingReport } from "../scripts/issue-14-timing.ts";

const reportPath = resolve(import.meta.dirname, "fixtures/issue-14-timing.json");

const timingFields = ["roundTripMs", "serverTimeMs", "transportOverheadMs"] as const;
const integerFields = [
  "requestCount",
  "bytesSent",
  "bytesReceived",
  "nodesMaterialized",
  "sourceFilesFetched",
  "nodesFetched",
] as const;

function expectTimingTotalsEqual(
  actual: Issue14TimingReport["aggregate"]["measured"],
  expected: Issue14TimingReport["aggregate"]["measured"]
): void {
  for (const field of integerFields) expect(actual[field], field).toBe(expected[field]);
  for (const field of timingFields) {
    expect(Math.abs(actual[field] - expected[field]), field).toBeLessThanOrEqual(timingToleranceMs);
  }
}

function withOverBudgetLiveTiming(report: Issue14TimingReport): Issue14TimingReport {
  const overBudget = structuredClone(report);
  const sample = overBudget.samples[0];
  if (sample === undefined) throw new Error("Missing representative timing sample.");
  const addedRoundTripMs =
    overBudget.stopConditions.unacceptableIpcGrowth.maxAggregateRoundTripMs -
    overBudget.aggregate.measured.roundTripMs +
    1;

  Reflect.set(sample.measured, "roundTripMs", sample.measured.roundTripMs + addedRoundTripMs);
  Reflect.set(sample.measured, "transportOverheadMs", sample.measured.transportOverheadMs + addedRoundTripMs);
  Reflect.set(sample.delta, "roundTripMs", sample.delta.roundTripMs + addedRoundTripMs);
  Reflect.set(sample.delta, "transportOverheadMs", sample.delta.transportOverheadMs + addedRoundTripMs);
  Reflect.set(
    overBudget.aggregate.measured,
    "roundTripMs",
    overBudget.aggregate.measured.roundTripMs + addedRoundTripMs
  );
  Reflect.set(
    overBudget.aggregate.measured,
    "transportOverheadMs",
    overBudget.aggregate.measured.transportOverheadMs + addedRoundTripMs
  );
  Reflect.set(
    overBudget.aggregate.delta,
    "roundTripMs",
    overBudget.aggregate.delta.roundTripMs + addedRoundTripMs
  );
  Reflect.set(
    overBudget.aggregate.delta,
    "transportOverheadMs",
    overBudget.aggregate.delta.transportOverheadMs + addedRoundTripMs
  );
  Reflect.set(
    overBudget.stopConditions.unacceptableIpcGrowth,
    "measuredAggregateRoundTripMs",
    overBudget.stopConditions.unacceptableIpcGrowth.measuredAggregateRoundTripMs + addedRoundTripMs
  );
  Reflect.set(
    overBudget.stopConditions.unacceptableIpcGrowth,
    "deltaAggregateRoundTripMs",
    overBudget.stopConditions.unacceptableIpcGrowth.deltaAggregateRoundTripMs + addedRoundTripMs
  );
  Reflect.set(overBudget.stopConditions.unacceptableIpcGrowth, "status", "triggered");
  Reflect.set(overBudget, "decision", "no-go");
  return overBudget;
}

describe("Issue 14 second IPC timing artifact", () => {
  it("decodes the baseline, four samples, deltas, and go decision", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    expect(report.samples).toHaveLength(4);
    expect(report.samples.map((sample) => sample.fixture)).toEqual([
      "alias-with-explicit-type-args",
      "mapped-alias-two-hop",
      "module-dts-declarations-and-reexports",
      "base-ui-component",
    ]);
    expect(report.decision).toBe("go");
    expect(report.stopConditions.unacceptableIpcGrowth.status).toBe("not-triggered");
    expect(report.aggregate.measured.roundTripMs).toBeLessThanOrEqual(1000);
    expect(
      Math.abs(
        report.aggregate.delta.roundTripMs -
          (report.aggregate.measured.roundTripMs - report.aggregate.baseline.roundTripMs)
      )
    ).toBeLessThanOrEqual(timingToleranceMs);
    expect(report.measurement.stableContract).toBe("semantic-counters-exact");
    expect(report.measurement.wallClockContract).toBe("observational");
    assertTimingReportInvariants(report);
    for (const sample of report.samples) {
      expect(sample.measured.requestCount).toBeGreaterThan(0);
      expect(sample.measured.bytesSent).toBeGreaterThan(0);
      expect(sample.measured.bytesReceived).toBeGreaterThan(0);
      expectTimingTotalsEqual(sample.delta, subtractTotals(sample.measured, sample.baseline));
    }
  });

  it("accepts observational arithmetic drift just inside the production tolerance", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const nearTolerance = structuredClone(report);
    const sample = nearTolerance.samples[0];
    if (sample === undefined) throw new Error("Missing representative timing sample.");
    const acceptedDrift = timingToleranceMs * 0.999;
    Reflect.set(sample.delta, "roundTripMs", sample.delta.roundTripMs + acceptedDrift);
    Reflect.set(
      nearTolerance.aggregate.delta,
      "roundTripMs",
      nearTolerance.aggregate.delta.roundTripMs + acceptedDrift
    );
    Reflect.set(
      nearTolerance.stopConditions.unacceptableIpcGrowth,
      "measuredAggregateRoundTripMs",
      nearTolerance.stopConditions.unacceptableIpcGrowth.measuredAggregateRoundTripMs + acceptedDrift
    );

    expect(
      Math.abs(sample.delta.roundTripMs - (sample.measured.roundTripMs - sample.baseline.roundTripMs))
    ).toBeLessThanOrEqual(timingToleranceMs);
    expect(
      Math.abs(
        nearTolerance.aggregate.delta.roundTripMs -
          (nearTolerance.aggregate.measured.roundTripMs - nearTolerance.aggregate.baseline.roundTripMs)
      )
    ).toBeLessThanOrEqual(timingToleranceMs);
    expect(
      Math.abs(
        nearTolerance.aggregate.delta.roundTripMs -
          nearTolerance.samples.reduce((total, entry) => total + entry.delta.roundTripMs, 0)
      )
    ).toBeLessThanOrEqual(timingToleranceMs);
    expect(() => assertTimingReportInvariants(nearTolerance)).not.toThrow();
  });

  it("keeps semantic counters and arithmetic mutation-sensitive", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const mutated = {
      ...report,
      samples: report.samples.map((sample, index) =>
        index === 0
          ? { ...sample, measured: { ...sample.measured, requestCount: sample.measured.requestCount + 1 } }
          : sample
      ),
    };
    expect(() => assertTimingReportInvariants(mutated)).toThrow(/arithmetic|aggregate|counter/u);

    const fractionalMutation = structuredClone(report);
    const sample = fractionalMutation.samples[0];
    if (sample === undefined) throw new Error("Missing representative timing sample.");
    Reflect.set(sample.delta, "requestCount", sample.delta.requestCount + timingToleranceMs / 2);
    expect(() => assertTimingReportInvariants(fractionalMutation)).toThrow(/requestCount/u);
  });

  it("treats transport byte counts as validated observations", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const left = report.samples[0]?.measured;
    if (left === undefined) throw new Error("Missing representative timing sample.");
    const differentCheckoutObservation = {
      ...left,
      bytesSent: left.bytesSent + 17,
      bytesReceived: left.bytesReceived + 29,
    };

    expect(() =>
      assertSemanticTotalsEqual("stored", left, "different checkout", differentCheckoutObservation)
    ).not.toThrow();
    expect(() =>
      assertSemanticTotalsEqual("stored", left, "semantic regression", {
        ...differentCheckoutObservation,
        nodesFetched: left.nodesFetched + 1,
      })
    ).toThrow(/nodesFetched/u);

    const invalidObservation = structuredClone(report);
    const invalidSample = invalidObservation.samples[0];
    if (invalidSample === undefined) throw new Error("Missing representative timing sample.");
    Reflect.set(invalidSample.measured, "bytesReceived", -1);
    expect(() => assertTimingReportInvariants(invalidObservation)).toThrow(/bytesReceived/u);
  });

  it("keeps checkout portability separate from live budget enforcement", () => {
    const stored = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const overBudgetLiveMeasurement = withOverBudgetLiveTiming(stored);
    assertTimingReportInvariants(overBudgetLiveMeasurement);

    const semanticDecision = assertStoredTimingReport(
      stored,
      overBudgetLiveMeasurement,
      "verify-checkout-portability"
    );
    const portabilityOutput = timingCommandOutput(
      overBudgetLiveMeasurement,
      "verify-checkout-portability",
      semanticDecision
    );
    expect(portabilityOutput).toMatchObject({ mode: "portability", semanticDecision: "go" });
    expect(portabilityOutput).not.toHaveProperty("decision");
    expect(() => assertStoredTimingReport(stored, overBudgetLiveMeasurement, "enforce-live-budget")).toThrow(
      /IPC stop condition/u
    );
  });

  it("rejects command output that mixes live and portability decisions", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const liveOutput = timingCommandOutput(report, "enforce-live-budget", "go");
    const portabilityOutput = timingCommandOutput(report, "verify-checkout-portability", "go");

    expect(() => Schema.decodeUnknownSync(TimingCommandOutputSchema)(liveOutput)).not.toThrow();
    expect(() => Schema.decodeUnknownSync(TimingCommandOutputSchema)(portabilityOutput)).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TimingCommandOutputSchema)({
        ...liveOutput,
        mode: "portability",
        semanticDecision: "go",
      })
    ).toThrow();
  });

  it("pins the standalone timing identity and stop-condition evidence", () => {
    const report = Schema.decodeUnknownSync(Issue14TimingReportSchema)(
      JSON.parse(readFileSync(reportPath, "utf8"))
    );
    const mutate = (update: (draft: Issue14TimingReport) => void): Issue14TimingReport => {
      const draft = structuredClone(report);
      update(draft);
      return draft;
    };
    const mutations: readonly [string, Issue14TimingReport][] = [
      ["command", mutate((draft) => Reflect.set(draft, "command", "drift"))],
      ["node", mutate((draft) => Reflect.set(draft.runtime, "node", "25.0.0"))],
      ["compiler", mutate((draft) => Reflect.set(draft.runtime, "compiler", "typescript@6"))],
      ["stable contract", mutate((draft) => Reflect.set(draft.measurement, "stableContract", "drift"))],
      [
        "wall clock contract",
        mutate((draft) => Reflect.set(draft.measurement, "wallClockContract", "drift")),
      ],
      ["rationale", mutate((draft) => Reflect.set(draft.measurement, "rationale", "drift"))],
      [
        "backend evidence",
        mutate((draft) => Reflect.set(draft.stopConditions.backendLeakage, "evidence", "drift")),
      ],
      [
        "durable evidence",
        mutate((draft) => Reflect.set(draft.stopConditions.durableContractLeakage, "evidence", "drift")),
      ],
      [
        "IPC threshold",
        mutate((draft) => Reflect.set(draft.stopConditions.unacceptableIpcGrowth, "threshold", "drift")),
      ],
      [
        "IPC evidence",
        mutate((draft) => Reflect.set(draft.stopConditions.unacceptableIpcGrowth, "evidence", "drift")),
      ],
      [
        "boundary status",
        mutate((draft) => Reflect.set(draft.stopConditions.backendLeakage, "status", "triggered")),
      ],
      [
        "arithmetic",
        mutate((draft) =>
          Reflect.set(draft.aggregate.baseline, "requestCount", draft.aggregate.baseline.requestCount + 1)
        ),
      ],
    ];
    for (const [label, mutated] of mutations) {
      expect(() => assertTimingReportInvariants(mutated), label).toThrow();
    }
  });
});
