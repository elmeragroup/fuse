// Unit under test: issueGroups, which groups the model's data issues for production's warnings.
// Oracle: groups by rule and subject, written by hand, in the order each group first appears.
import { describe, expect, it } from "vitest";

import type { ModelIssue } from "./cartesian-model";
import { issueGroups } from "./errors";

describe("issueGroups", () => {
  it("keeps the order groups first appear in, across rules, with each group's first issue and count", () => {
    // Rule A on column x, rule B on column y, rule A on column z, then A on x again.
    const issues: ModelIssue[] = [
      { rule: "non-finite-value", slot: 0, key: "x" },
      { rule: "invalid-quality", slot: 1, key: "y" },
      { rule: "non-finite-value", slot: 2, key: "z" },
      { rule: "non-finite-value", slot: 3, key: "x" },
    ];
    expect(issueGroups(issues)).toEqual([
      { rule: "non-finite-value", subject: "x", first: issues[0], count: 2 },
      { rule: "invalid-quality", subject: "y", first: issues[1], count: 1 },
      { rule: "non-finite-value", subject: "z", first: issues[2], count: 1 },
    ]);
  });
});
