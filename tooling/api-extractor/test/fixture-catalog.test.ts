import { describe, expect, it } from "vitest";

import {
  deriveConformancePlan,
  fixtureEvidenceCatalog,
  validateFixtureEvidenceCatalog,
} from "../scripts/fixture-catalog.ts";
import type { FixtureEvidenceRecord } from "../scripts/fixture-catalog.ts";
import { readIssue14ConformanceReport } from "../scripts/issue-14-conformance.ts";

describe("fixture evidence catalog", () => {
  it("derives conformance evidence from the representative fixture record", () => {
    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "base-ui-component");
    if (fixture === undefined) throw new Error("Missing representative fixture");

    expect(fixture).toMatchObject({
      id: "base-ui-component",
      input: {
        id: "base-ui-component/input.tsx",
        file: "input.tsx",
      },
      issues: ["02", "12", "14"],
      conformance: {
        evidenceId: "base-ui-component/conformance",
        disposition: "reviewed-ts7",
      },
      typecheck: { strategy: "direct-input" },
      timing: ["issue02", "issue14"],
      warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
      oracle: {
        disposition: "reviewed-divergence",
        upstreamFile: "output.json",
        selectedFile: "output.tsgo.json",
      },
      evidence: {
        id: "base-ui-component/conformance",
        origin: "pinned-upstream",
      },
    });
    expect(deriveConformancePlan([fixture])).toEqual([
      {
        fixture: "base-ui-component",
        file: "input.tsx",
        disposition: "reviewed-ts7",
      },
    ]);
  });

  it("matches the complete stored conformance identity, classification, and order", () => {
    const stored = readIssue14ConformanceReport();
    expect(deriveConformancePlan(fixtureEvidenceCatalog)).toEqual(
      stored.fixtures.map((fixture) => ({
        fixture: fixture.fixture,
        file: fixture.input,
        disposition: fixture.disposition,
      }))
    );
    expect(
      fixtureEvidenceCatalog.filter((fixture) => fixture.evidence.origin === "pinned-upstream")
    ).toHaveLength(116);
    expect(
      fixtureEvidenceCatalog.filter((fixture) => fixture.oracle.disposition === "generated")
    ).toHaveLength(3);
  });

  it("rejects duplicate fixture identities before deriving a plan", () => {
    const [first, second] = fixtureEvidenceCatalog;
    const duplicate: FixtureEvidenceRecord = {
      ...second,
      id: first.id,
      input: first.input,
      evidence: first.evidence,
    };
    expect(() => deriveConformancePlan([first, duplicate])).toThrow(/duplicate fixture identity/u);
  });

  it("rejects missing evidence identities and incompatible classifications", () => {
    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "base-ui-component");
    if (fixture === undefined || fixture.conformance === false) {
      throw new Error("Missing representative conformance fixture");
    }
    const missingEvidence: FixtureEvidenceRecord = {
      ...fixture,
      conformance: { ...fixture.conformance, evidenceId: "missing/conformance" },
    };
    expect(() => deriveConformancePlan([missingEvidence])).toThrow(/missing conformance evidence/u);

    const incompatible: FixtureEvidenceRecord = {
      ...fixture,
      conformance: { ...fixture.conformance, disposition: "unchanged" },
    };
    expect(() => deriveConformancePlan([incompatible])).toThrow(/incompatible oracle disposition/u);
  });

  it("rejects unstable catalog ordering", () => {
    expect(() => validateFixtureEvidenceCatalog([...fixtureEvidenceCatalog].reverse())).toThrow(
      /stable fixture-identity ordering/u
    );
  });
});
