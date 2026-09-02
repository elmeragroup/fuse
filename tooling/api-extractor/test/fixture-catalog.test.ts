import { describe, expect, it } from "vitest";

import {
  fixtureEvidenceCatalog,
  issue02BytesReceivedPathLengthHeadroom,
  validateFixtureEvidenceCatalog,
} from "../scripts/fixture-catalog.ts";
import type { FixtureEvidenceRecord } from "../scripts/fixture-catalog.ts";
import { assertRequestCountCeiling } from "../scripts/fixture-evidence.ts";
import {
  derivePackageExecutionPlan,
  derivePackageTypecheckPlan,
  deriveTimingPlan,
  deriveTypecheckPlan,
  externalSelectionTimingFixtures,
  issue02TimingFixtures,
  issue14TimingFixtures,
  packageFixtureTypecheckPlan,
} from "../scripts/fixture-plans.ts";
import {
  deriveConformancePlan,
  deriveIssueMembershipPlan,
  deriveWarningEvidencePlan,
  issue02GoNoGoFixtures,
  issue02SupplementalFixtures,
  issue03UpstreamFixtures,
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
} from "../scripts/fixture-views.ts";
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
      timing: [
        {
          plan: "issue02",
          order: 3,
          maxFetchedToMaterializedRatio: 140,
          maxRequestCount: 433,
          maxBytesReceived: 3200000,
        },
        { plan: "issue14", order: 3 },
      ],
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
        maxFetchedToMaterializedRatio: 140,
        maxRequestCount: 433,
        maxBytesReceived: 3200000,
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
      issue03: issue03UpstreamFixtures,
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
      issue03: [
        { fixture: "type-object-shape-resolution", file: "input.ts" },
        { fixture: "enum-members-values-and-docs", file: "input.ts" },
        { fixture: "jsdoc-extra-tags-preservation", file: "input.ts" },
        { fixture: "object-property-count-limit-scope", file: "input.tsx" },
        { fixture: "function-parameters-optional-and-defaults", file: "input.ts" },
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
        count: 33,
        first: "test/fixtures/issue-02-tsconfig.json",
        last: "test/fixtures/component-object/tsconfig.json",
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

  it("owns Issue 02 ratio budgets with timing membership", () => {
    expect(
      issue02TimingFixtures.map(
        ({
          fixture,
          maxFetchedToMaterializedRatio,
          maxRequestCount,
          maxBytesReceived,
          bytesReceivedPathLengthHeadroom,
        }) => ({
          fixture,
          maxFetchedToMaterializedRatio,
          maxRequestCount,
          maxBytesReceived,
          bytesReceivedPathLengthHeadroom,
        })
      )
    ).toEqual([
      {
        fixture: "alias-with-explicit-type-args",
        maxFetchedToMaterializedRatio: 1.2,
        maxRequestCount: 148,
        maxBytesReceived: 33303,
        bytesReceivedPathLengthHeadroom: issue02BytesReceivedPathLengthHeadroom,
      },
      {
        fixture: "mapped-alias-two-hop",
        maxFetchedToMaterializedRatio: 1.2,
        maxRequestCount: 83,
        maxBytesReceived: 22577,
        bytesReceivedPathLengthHeadroom: issue02BytesReceivedPathLengthHeadroom,
      },
      {
        fixture: "module-dts-declarations-and-reexports",
        maxFetchedToMaterializedRatio: 120,
        maxRequestCount: 187,
        maxBytesReceived: 980000,
        bytesReceivedPathLengthHeadroom: undefined,
      },
      {
        fixture: "base-ui-component",
        maxFetchedToMaterializedRatio: 140,
        maxRequestCount: 433,
        maxBytesReceived: 3200000,
        bytesReceivedPathLengthHeadroom: undefined,
      },
    ]);
    for (const fixture of issue02TimingFixtures) {
      const ceiling = fixture.maxBytesReceived + (fixture.bytesReceivedPathLengthHeadroom ?? 0);
      expect(ceiling).toBeGreaterThanOrEqual(fixture.maxBytesReceived);
      if (fixture.bytesReceivedPathLengthHeadroom !== undefined) {
        expect(ceiling).toBeLessThan(1_000_000);
      }
    }

    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "alias-with-explicit-type-args");
    if (fixture === undefined) throw new Error("Missing representative timing fixture");
    const invalidPathLengthHeadroom: FixtureEvidenceRecord = {
      ...fixture,
      timing: fixture.timing.map((entry) =>
        entry.plan === "issue02" ? { ...entry, bytesReceivedPathLengthHeadroom: 0 } : entry
      ),
    };
    expect(() => deriveTimingPlan([invalidPathLengthHeadroom], "issue02")).toThrow(
      /path-length headroom metadata/u
    );

    const duplicatePlan: FixtureEvidenceRecord = {
      ...fixture,
      timing: [...fixture.timing, ...fixture.timing],
    };
    expect(() => validateFixtureEvidenceCatalog([duplicatePlan])).toThrow(/duplicate timing plans/u);
  });

  it("owns and enforces the selective external-type request plateau", () => {
    expect(externalSelectionTimingFixtures).toEqual([
      {
        fixture: "package-selective-external-types",
        file: "input.ts",
        maxRequestCount: 310,
      },
    ]);
    const fixture = externalSelectionTimingFixtures[0];
    if (fixture === undefined) throw new Error("Missing external-selection timing fixture");

    expect(() =>
      assertRequestCountCeiling({
        fixture: fixture.fixture,
        requestCount: fixture.maxRequestCount,
        maxRequestCount: fixture.maxRequestCount,
      })
    ).not.toThrow();
    expect(() =>
      assertRequestCountCeiling({
        fixture: fixture.fixture,
        requestCount: fixture.maxRequestCount + 1,
        maxRequestCount: fixture.maxRequestCount,
      })
    ).toThrow(/budget exceeded.*311 > 310/u);
  });

  it("catalogs the backend lazy-declaration fixture as seam-only evidence", () => {
    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "backend-lazy-declarations");
    if (fixture === undefined) throw new Error("Missing backend lazy-declaration fixture");
    expect(fixture).toMatchObject({
      input: { id: "backend-lazy-declarations/input.ts", file: "input.ts" },
      issues: ["02"],
      conformance: false,
      typecheck: { strategy: "not-applicable" },
      timing: [],
      warnings: { oracleFile: null, codes: [] },
      oracle: {
        disposition: "not-applicable",
        upstreamFile: null,
        selectedFile: null,
        divergenceRecord: null,
      },
      evidence: {
        id: "backend-lazy-declarations/regression",
        origin: "local-regression",
        metadata: {
          packageTypechecks: [
            { order: 31, project: "test/fixtures/backend-lazy-declarations/tsconfig.json" },
          ],
        },
      },
    });

    const inventedOracle: FixtureEvidenceRecord = {
      ...fixture,
      oracle: { ...fixture.oracle, selectedFile: "output.json" },
    };
    expect(() => validateFixtureEvidenceCatalog([inventedOracle])).toThrow(/seam-only evidence/u);
  });

  it("accepts multiple distinct package type-check projects for seam-only evidence", () => {
    const fixture = fixtureEvidenceCatalog.find((record) => record.id === "backend-lazy-declarations");
    if (fixture === undefined) throw new Error("Missing backend lazy-declaration fixture");
    const withMultipleTypechecks: FixtureEvidenceRecord = {
      ...fixture,
      evidence: {
        ...fixture.evidence,
        metadata: {
          ...fixture.evidence.metadata,
          packageTypechecks: [
            { order: 32, project: "test/fixtures/issue-03-object-apis/tsconfig.json" },
            { order: 31, project: "test/fixtures/backend-lazy-declarations/tsconfig.json" },
          ],
        },
      },
    };

    expect(derivePackageTypecheckPlan([withMultipleTypechecks])).toEqual([
      {
        fixture: "backend-lazy-declarations",
        project: "test/fixtures/backend-lazy-declarations/tsconfig.json",
      },
      {
        fixture: "backend-lazy-declarations",
        project: "test/fixtures/issue-03-object-apis/tsconfig.json",
      },
    ]);

    const withDuplicateOrder: FixtureEvidenceRecord = {
      ...withMultipleTypechecks,
      evidence: {
        ...withMultipleTypechecks.evidence,
        metadata: {
          ...withMultipleTypechecks.evidence.metadata,
          packageTypechecks: [
            { order: 31, project: "test/fixtures/backend-lazy-declarations/tsconfig.json" },
            { order: 31, project: "test/fixtures/issue-03-object-apis/tsconfig.json" },
          ],
        },
      },
    };
    expect(() => derivePackageTypecheckPlan([withDuplicateOrder])).toThrow(/unique non-negative ordering/u);
  });

  it.each([
    { label: "missing", packageTypechecks: undefined },
    { label: "empty", packageTypechecks: [] },
  ] as const)(
    "rejects $label package type-check coverage for seam-only evidence",
    ({ packageTypechecks }) => {
      const fixture = fixtureEvidenceCatalog.find((record) => record.id === "backend-lazy-declarations");
      if (fixture === undefined) throw new Error("Missing backend lazy-declaration fixture");
      const withoutTypecheckCoverage: FixtureEvidenceRecord = {
        ...fixture,
        evidence: {
          ...fixture.evidence,
          metadata: { ...fixture.evidence.metadata, packageTypechecks },
        },
      };

      expect(() => validateFixtureEvidenceCatalog([withoutTypecheckCoverage])).toThrow(/seam-only evidence/u);
    }
  );

  it.each(["backend-lazy-declarations", "package-selective-external-types"])(
    "rejects a fabricated regression evidence identity for seam-only fixture %s",
    (fixtureId) => {
      const fixture = fixtureEvidenceCatalog.find((record) => record.id === fixtureId);
      if (fixture === undefined) throw new Error(`Missing seam-only fixture ${fixtureId}`);
      const fabricatedEvidence: FixtureEvidenceRecord = {
        ...fixture,
        evidence: { ...fixture.evidence, id: `${fixture.id}/fabricated` },
      };

      expect(() => validateFixtureEvidenceCatalog([fabricatedEvidence])).toThrow(
        /invalid regression evidence identity/u
      );
    }
  );

  it.each(["backend-lazy-declarations", "package-selective-external-types"])(
    "rejects missing issue membership for seam-only fixture %s",
    (fixtureId) => {
      const fixture = fixtureEvidenceCatalog.find((record) => record.id === fixtureId);
      if (fixture === undefined) throw new Error(`Missing seam-only fixture ${fixtureId}`);
      const missingIssueMembership: FixtureEvidenceRecord = { ...fixture, issues: [] };

      expect(() => validateFixtureEvidenceCatalog([missingIssueMembership])).toThrow(
        /missing issue membership/u
      );
    }
  );

  it.each(["backend-lazy-declarations", "package-selective-external-types"])(
    "rejects a fixture-directory escape in seam-only input metadata for %s",
    (fixtureId) => {
      const fixture = fixtureEvidenceCatalog.find((record) => record.id === fixtureId);
      if (fixture === undefined) throw new Error(`Missing seam-only fixture ${fixtureId}`);
      const escapedInput: FixtureEvidenceRecord = {
        ...fixture,
        input: { id: `${fixture.id}/../input.ts`, file: "../input.ts" },
      };

      expect(() => validateFixtureEvidenceCatalog([escapedInput])).toThrow(
        /invalid fixture-local input file/u
      );
    }
  );
});
