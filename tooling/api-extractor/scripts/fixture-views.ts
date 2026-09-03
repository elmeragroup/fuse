import { fixtureEvidenceCatalog, validateFixtureEvidenceCatalog } from "./fixture-catalog.ts";
import type {
  ConformanceDisposition,
  FixtureEvidenceRecord,
  FixtureIssue,
  IssueFixtureOracle,
} from "./fixture-catalog.ts";

export type ConformanceFixture = {
  readonly fixture: string;
  readonly file: string;
  readonly disposition: ConformanceDisposition;
};

export function deriveConformancePlan(
  catalog: readonly FixtureEvidenceRecord[]
): readonly ConformanceFixture[] {
  validateFixtureEvidenceCatalog(catalog);
  return catalog.flatMap((record) =>
    record.conformance === false
      ? []
      : [
          {
            fixture: record.id,
            file: record.input.file,
            disposition: record.conformance.disposition,
          },
        ]
  );
}

export const issue14FixtureManifest = deriveConformancePlan(fixtureEvidenceCatalog);
export type Issue14Fixture = (typeof issue14FixtureManifest)[number];

function issueOracle(record: FixtureEvidenceRecord): IssueFixtureOracle {
  return record.oracle.disposition === "reviewed-divergence" ? "reviewed-ts7" : "immutable-upstream";
}

export function orderedView<T extends { readonly order: number }>(
  values: readonly T[],
  label: string
): readonly T[] {
  const result = [...values].sort((left, right) => left.order - right.order);
  if (
    result.some((entry) => !Number.isSafeInteger(entry.order) || entry.order < 0) ||
    new Set(result.map((entry) => entry.order)).size !== result.length
  ) {
    throw new Error(`${label} must have unique non-negative ordering.`);
  }
  return result;
}

type IssueViewRecord = {
  readonly fixture: string;
  readonly file: string;
  readonly oracle: IssueFixtureOracle;
  readonly group: string | undefined;
  readonly order: number;
};

export function deriveIssueMembershipPlan(
  catalog: readonly FixtureEvidenceRecord[],
  issue: FixtureIssue
): readonly {
  readonly fixture: string;
  readonly input: string;
  readonly evidenceId: string;
}[] {
  validateFixtureEvidenceCatalog(catalog);
  return catalog.flatMap((record) =>
    record.issues.includes(issue)
      ? [{ fixture: record.id, input: record.input.file, evidenceId: record.evidence.id }]
      : []
  );
}

function deriveOrderedIssueView(
  catalog: readonly FixtureEvidenceRecord[],
  issue: FixtureIssue
): readonly IssueViewRecord[] {
  validateFixtureEvidenceCatalog(catalog);
  return orderedView(
    catalog.flatMap((record) => {
      const metadata = record.evidence.metadata.issueViews?.[issue];
      return metadata === undefined
        ? []
        : [
            {
              fixture: record.id,
              file: record.input.file,
              oracle: issueOracle(record),
              group: metadata.group,
              order: metadata.order,
            },
          ];
    }),
    `Issue ${issue} fixture view`
  );
}

function requiredGroup(record: IssueViewRecord, issue: FixtureIssue): string {
  if (record.group === undefined) throw new Error(`Issue ${issue} fixture ${record.fixture} needs a group.`);
  return record.group;
}

export const issue03UpstreamFixtures = deriveOrderedIssueView(fixtureEvidenceCatalog, "03").map(
  ({ fixture, file }) => ({ fixture, file })
);
export type Issue03UpstreamFixture = (typeof issue03UpstreamFixtures)[number];

export const issue04CanonicalizationFixtures = deriveOrderedIssueView(fixtureEvidenceCatalog, "04").map(
  ({ fixture, file, oracle }) => ({ fixture, file, oracle })
);
export type Issue04Fixture = (typeof issue04CanonicalizationFixtures)[number];

export const issue05ContainerFixtures = deriveOrderedIssueView(fixtureEvidenceCatalog, "05").map(
  (record) => ({ fixture: record.fixture, file: record.file, container: requiredGroup(record, "05") })
);
export type Issue05Fixture = (typeof issue05ContainerFixtures)[number];

export const issue06CallableFixtures = deriveOrderedIssueView(fixtureEvidenceCatalog, "06").map((record) => ({
  fixture: record.fixture,
  file: record.file,
  family: requiredGroup(record, "06"),
}));
export type Issue06Fixture = (typeof issue06CallableFixtures)[number];

function issueFamilyFixtures(issue: FixtureIssue): readonly {
  readonly fixture: string;
  readonly file: string;
  readonly oracle: IssueFixtureOracle;
  readonly family: string;
}[] {
  return deriveOrderedIssueView(fixtureEvidenceCatalog, issue).map((record) => ({
    fixture: record.fixture,
    file: record.file,
    oracle: record.oracle,
    family: requiredGroup(record, issue),
  }));
}

export const issue07GenericFixtures = issueFamilyFixtures("07");
export type Issue07Fixture = (typeof issue07GenericFixtures)[number];
export const issue08MappedFixtures = issueFamilyFixtures("08");
export type Issue08Fixture = (typeof issue08MappedFixtures)[number];
export const issue09TypeOperatorFixtures = issueFamilyFixtures("09");
export type Issue09Fixture = (typeof issue09TypeOperatorFixtures)[number];
export const issue10ModuleSurfaceFixtures = issueFamilyFixtures("10");
export type Issue10Fixture = (typeof issue10ModuleSurfaceFixtures)[number];

export const issue11ReactFixtures = deriveOrderedIssueView(fixtureEvidenceCatalog, "11").map((record) => ({
  fixture: record.fixture,
  file: record.file,
  family: requiredGroup(record, "11"),
}));
export type Issue11Fixture = (typeof issue11ReactFixtures)[number];

export const issue12ReactFixtures = issueFamilyFixtures("12").map((record) => ({
  ...record,
  warningOracle: "warnings.tsgo.json" as const,
}));
export type Issue12Fixture = (typeof issue12ReactFixtures)[number];

export const issue13ExternalFixtures = issueFamilyFixtures("13");
export type Issue13Fixture = (typeof issue13ExternalFixtures)[number];

export function deriveWarningPlan(
  catalog: readonly FixtureEvidenceRecord[],
  issue: "12" | "13"
): readonly {
  readonly fixture: string;
  readonly oracleFile: "warnings.tsgo.json" | null;
  readonly codes: readonly string[];
}[] {
  return orderedView(
    deriveOrderedIssueView(catalog, issue).map((view) => {
      const record = catalog.find((candidate) => candidate.id === view.fixture);
      if (record === undefined) throw new Error(`Missing warning fixture ${view.fixture}.`);
      return {
        fixture: record.id,
        oracleFile: record.warnings.oracleFile,
        codes: record.warnings.codes,
        order: record.evidence.metadata.warningOrder?.[issue] ?? view.order,
      };
    }),
    `Issue ${issue} warning plan`
  ).map(({ fixture, oracleFile, codes }) => ({ fixture, oracleFile, codes }));
}

export function deriveWarningEvidencePlan(catalog: readonly FixtureEvidenceRecord[]): readonly {
  readonly fixture: string;
  readonly oracleFile: "warnings.tsgo.json";
  readonly codes: readonly string[];
}[] {
  validateFixtureEvidenceCatalog(catalog);
  return catalog.flatMap((record) =>
    record.warnings.oracleFile === null
      ? []
      : [{ fixture: record.id, oracleFile: record.warnings.oracleFile, codes: record.warnings.codes }]
  );
}

function warningRecord(
  plan: readonly { readonly fixture: string; readonly codes: readonly string[] }[]
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(plan.map((entry) => [entry.fixture, entry.codes]));
}

export const issue12ExpectedWarnings = warningRecord(deriveWarningPlan(fixtureEvidenceCatalog, "12"));
export const issue13ExpectedWarnings = warningRecord(deriveWarningPlan(fixtureEvidenceCatalog, "13"));

export function expectedWarningCodes(
  plan: Readonly<Record<string, readonly string[]>>,
  fixture: string
): readonly string[] {
  const codes = plan[fixture];
  if (codes === undefined) throw new Error(`Missing warning evidence for fixture ${fixture}.`);
  return codes;
}

export const issue12ReactFixtureAudit = orderedView(
  fixtureEvidenceCatalog.flatMap((record) => {
    const audit = record.evidence.metadata.reactAudit;
    return audit === undefined
      ? []
      : [
          {
            fixture: record.id,
            file: record.input.file,
            owner: audit.owner,
            oracle: issueOracle(record),
            order: audit.order,
          },
        ];
  }),
  "Issue 12 React fixture audit"
).map(({ fixture, file, owner, oracle }) => ({ fixture, file, owner, oracle }));
export type Issue12ReactFixtureAuditEntry = (typeof issue12ReactFixtureAudit)[number];

export type Issue02SupplementalFixture = {
  readonly fixture: string;
  readonly file: string;
  readonly expectedExports: readonly string[];
};

export const issue02SupplementalFixtures: readonly Issue02SupplementalFixture[] =
  fixtureEvidenceCatalog.flatMap((record) =>
    record.evidence.metadata.expectedExports === undefined
      ? []
      : [
          {
            fixture: record.id,
            file: record.input.file,
            expectedExports: record.evidence.metadata.expectedExports,
          },
        ]
  );
