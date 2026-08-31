import { Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertSemanticTotalsEqual,
  assertTimingReportInvariants,
  Issue14TimingReportSchema,
  subtractTotals,
} from "../scripts/issue-14-timing.ts";
import type { Issue14TimingReport } from "../scripts/issue-14-timing.ts";

const reportPath = resolve(import.meta.dirname, "fixtures/issue-14-timing.json");

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
    expect(report.aggregate.delta.roundTripMs).toBe(
      report.aggregate.measured.roundTripMs - report.aggregate.baseline.roundTripMs
    );
    expect(report.measurement.stableContract).toBe("semantic-counters-exact");
    expect(report.measurement.wallClockContract).toBe("observational");
    assertTimingReportInvariants(report);
    for (const sample of report.samples) {
      expect(sample.measured.requestCount).toBeGreaterThan(0);
      expect(sample.measured.bytesSent).toBeGreaterThan(0);
      expect(sample.measured.bytesReceived).toBeGreaterThan(0);
      expect(sample.delta.roundTripMs).toBe(sample.measured.roundTripMs - sample.baseline.roundTripMs);
      expect(sample.delta).toEqual(subtractTotals(sample.measured, sample.baseline));
    }
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
