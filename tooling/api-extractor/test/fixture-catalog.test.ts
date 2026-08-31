import { describe, expect, it } from "vitest";

import {
  deriveConformancePlan,
  deriveIssueMembershipPlan,
  derivePackageExecutionPlan,
  deriveTimingPlan,
  deriveTypecheckPlan,
  deriveWarningEvidencePlan,
  fixtureEvidenceCatalog,
  issue02GoNoGoFixtures,
  issue02SupplementalFixtures,
  issue02TimingFixtures,
  issue04CanonicalizationFixtures,
  issue05ContainerFixtures,
  issue06CallableFixtures,
  issue07GenericFixtures,
  issue08MappedFixtures,
  issue09TypeOperatorFixtures,
  issue10ModuleSurfaceFixtures,
  issue11ReactFixtures,
  issue12ReactFixtureAudit,
  issue12ReactFixtures,
  issue13ExternalFixtures,
  issue14TimingFixtures,
  packageFixtureTypecheckPlan,
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

  it("flows one fixture through every package evidence view", () => {
    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "base-ui-component");
    if (fixture === undefined) throw new Error("Missing representative fixture");

    expect(deriveIssueMembershipPlan([fixture], "02")).toEqual([
      {
        fixture: "base-ui-component",
        input: "input.tsx",
        evidenceId: "base-ui-component/conformance",
      },
    ]);
    expect(deriveWarningEvidencePlan([fixture])).toEqual([
      { fixture: "base-ui-component", oracleFile: "warnings.tsgo.json", codes: [] },
    ]);
    expect(deriveTypecheckPlan([fixture])).toEqual([
      { fixture: "base-ui-component", file: "input.tsx", strategy: "direct-input" },
    ]);
    expect(deriveTimingPlan([fixture], "issue02")).toEqual([
      {
        fixture: "base-ui-component",
        file: "input.tsx",
        oracleFile: "output.tsgo.json",
        warningOracle: "warnings.tsgo.json",
      },
    ]);
    expect(derivePackageExecutionPlan([fixture])).toEqual([
      {
        fixture: "base-ui-component",
        input: "input.tsx",
        issues: ["02", "12", "14"],
        conformance: true,
        typecheck: "direct-input",
        timing: ["issue02", "issue14"],
        warningEvidence: true,
        typecheckProjects: [
          "test/fixtures/issue-12-tsconfig.json",
          "test/fixtures/issue-12-origin-review/tsconfig.json",
          "test/fixtures/issue-12-origin-review/import-equals/tsconfig.json",
          "test/fixtures/issue-12-origin-review/ambiguous-star/tsconfig.json",
          "test/fixtures/issue-12-origin-review/angle-assertion/tsconfig.json",
          "test/fixtures/issue-12-origin-review/same-origin-star/tsconfig.json",
          "test/fixtures/react-policy-non-react-dependency/tsconfig.json",
        ],
      },
    ]);
  });

  it("preserves every migrated fixture view and its established order", () => {
    expect({
      issue02Timing: issue02TimingFixtures.map((entry) => entry.fixture),
      issue02Supplemental: issue02SupplementalFixtures.map((entry) => entry.fixture),
      issue02GoNoGo: issue02GoNoGoFixtures.map((entry) => entry.fixture),
      issue04: issue04CanonicalizationFixtures.length,
      issue05: issue05ContainerFixtures.length,
      issue06: issue06CallableFixtures.length,
      issue07: issue07GenericFixtures.length,
      issue08: issue08MappedFixtures.length,
      issue09: issue09TypeOperatorFixtures.length,
      issue10: issue10ModuleSurfaceFixtures.length,
      issue11: issue11ReactFixtures.length,
      issue12: issue12ReactFixtures.length,
      issue12Audit: issue12ReactFixtureAudit.length,
      issue13: issue13ExternalFixtures.length,
      issue14Timing: issue14TimingFixtures.map((entry) => entry.fixture),
      packageTypechecks: {
        count: packageFixtureTypecheckPlan.length,
        first: packageFixtureTypecheckPlan[0]?.project,
        last: packageFixtureTypecheckPlan.at(-1)?.project,
      },
    }).toEqual({
      issue02Timing: [
        "alias-with-explicit-type-args",
        "mapped-alias-two-hop",
        "module-dts-declarations-and-reexports",
        "base-ui-component",
      ],
      issue02Supplemental: ["module-dts-type-star", "module-resolution-alias", "module-resolution-package"],
      issue02GoNoGo: [
        "alias-with-explicit-type-args",
        "mapped-alias-two-hop",
        "module-dts-declarations-and-reexports",
        "module-dts-type-star",
        "module-resolution-alias",
        "module-resolution-package",
        "base-ui-component",
      ],
      issue04: 12,
      issue05: 25,
      issue06: 9,
      issue07: 14,
      issue08: 3,
      issue09: 5,
      issue10: 5,
      issue11: 10,
      issue12: 4,
      issue12Audit: 23,
      issue13: 15,
      issue14Timing: [
        "alias-with-explicit-type-args",
        "mapped-alias-two-hop",
        "module-dts-declarations-and-reexports",
        "base-ui-component",
      ],
      packageTypechecks: {
        count: 31,
        first: "test/fixtures/issue-02-tsconfig.json",
        last: "test/fixtures/package-selective-external-types/tsconfig.json",
      },
    });
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
