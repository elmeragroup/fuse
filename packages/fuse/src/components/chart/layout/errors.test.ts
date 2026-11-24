// Unit under test: issueRecords, which turns a Root's data issues into its production warnings.
// Oracle: records by rule and subject, written by hand, in the order each group first appears,
// each message the owner's name and the describe text of the group's first issue and count.
// Browser tests run as development, where issueRecords throws, so only this test reaches production.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelIssue } from "./cartesian-model";
import { issueRecords } from "./errors";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("issueRecords", () => {
  it("returns one record per rule and subject in production, in the order groups first appear", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Rule A on column x, rule B on column y, rule A on column z, A on x again, then B on x, which
    // shares its column with A but is its own group.
    const issues: ModelIssue[] = [
      { rule: "non-finite-value", slot: 0, key: "x" },
      { rule: "invalid-quality", slot: 1, key: "y" },
      { rule: "non-finite-value", slot: 2, key: "z" },
      { rule: "non-finite-value", slot: 3, key: "x" },
      { rule: "invalid-quality", slot: 4, key: "x" },
    ];
    const describeIssue = (issue: ModelIssue, count = 1) =>
      `slot ${"slot" in issue ? String(issue.slot) : "none"} of ${String(count)}`;
    expect(issueRecords("Chart.Root", issues, describeIssue)).toEqual([
      { rule: "non-finite-value", subject: "x", message: "Chart.Root slot 0 of 2" },
      { rule: "invalid-quality", subject: "y", message: "Chart.Root slot 1 of 1" },
      { rule: "non-finite-value", subject: "z", message: "Chart.Root slot 2 of 1" },
      { rule: "invalid-quality", subject: "x", message: "Chart.Root slot 4 of 1" },
    ]);
  });
});
