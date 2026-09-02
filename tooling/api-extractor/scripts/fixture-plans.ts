import { fixtureEvidenceCatalog, validateFixtureEvidenceCatalog } from "./fixture-catalog.ts";
import type {
  FixtureEvidenceRecord,
  FixtureIssue,
  Issue02TimingMetadata,
  TimingPlan,
  TypecheckStrategy,
} from "./fixture-catalog.ts";
import { orderedView } from "./fixture-views.ts";

export type TimingFixture = {
  readonly fixture: string;
  readonly file: string;
  readonly oracleFile: "output.json" | "output.tsgo.json";
  readonly warningOracle: "warnings.tsgo.json";
};

export type Issue02TimingFixture = TimingFixture & {
  readonly maxFetchedToMaterializedRatio: number;
  readonly maxRequestCount: number;
  readonly maxBytesReceived: number;
  readonly bytesReceivedPathLengthHeadroom?: number;
};

export type Issue14TimingFixture = TimingFixture;

export type ExternalSelectionTimingFixture = {
  readonly fixture: string;
  readonly file: string;
  readonly maxRequestCount: number;
};

type TimingPlanResult = {
  readonly issue02: Issue02TimingFixture;
  readonly issue14: Issue14TimingFixture;
  readonly externalSelection: ExternalSelectionTimingFixture;
};

export function issue02TimingBudget(metadata: Issue02TimingMetadata) {
  if (metadata.bytesReceivedPathLengthHeadroom === undefined) {
    return {
      maxFetchedToMaterializedRatio: metadata.maxFetchedToMaterializedRatio,
      maxRequestCount: metadata.maxRequestCount,
      maxBytesReceived: metadata.maxBytesReceived,
    };
  }
  return {
    maxFetchedToMaterializedRatio: metadata.maxFetchedToMaterializedRatio,
    maxRequestCount: metadata.maxRequestCount,
    maxBytesReceived: metadata.maxBytesReceived,
    bytesReceivedPathLengthHeadroom: metadata.bytesReceivedPathLengthHeadroom,
  };
}

export function deriveTimingPlan<Plan extends TimingPlan>(
  catalog: readonly FixtureEvidenceRecord[],
  plan: Plan
): readonly TimingPlanResult[Plan][] {
  validateFixtureEvidenceCatalog(catalog);
  const fixtures: Array<
    (Issue02TimingFixture | Issue14TimingFixture | ExternalSelectionTimingFixture) & { order: number }
  > = [];
  for (const record of catalog) {
    for (const entry of record.timing) {
      if (entry.plan !== plan) continue;
      if (entry.plan === "externalSelection") {
        fixtures.push({
          fixture: record.id,
          file: record.input.file,
          maxRequestCount: entry.maxRequestCount,
          order: entry.order,
        });
        continue;
      }
      if (record.oracle.selectedFile === null || record.warnings.oracleFile === null) {
        throw new Error(`Fixture ${record.id} has incomplete ${entry.plan} timing evidence.`);
      }
      if (entry.plan === "issue02") {
        fixtures.push({
          fixture: record.id,
          file: record.input.file,
          oracleFile: record.oracle.selectedFile,
          warningOracle: record.warnings.oracleFile,
          ...issue02TimingBudget(entry),
          order: entry.order,
        });
        continue;
      }
      fixtures.push({
        fixture: record.id,
        file: record.input.file,
        oracleFile: record.oracle.selectedFile,
        warningOracle: record.warnings.oracleFile,
        order: entry.order,
      });
    }
  }
  return orderedView(fixtures, `${plan} timing plan`).map(
    ({ order: _order, ...fixture }) =>
      // SAFETY: `plan` selects one TimingPlanResult member; the loop above only pushes that member.
      fixture as TimingPlanResult[Plan]
  );
}

export const issue02TimingFixtures = deriveTimingPlan(fixtureEvidenceCatalog, "issue02");
export const issue14TimingFixtures = deriveTimingPlan(fixtureEvidenceCatalog, "issue14");
export const externalSelectionTimingFixtures = deriveTimingPlan(fixtureEvidenceCatalog, "externalSelection");

export function deriveTypecheckPlan(catalog: readonly FixtureEvidenceRecord[]): readonly {
  readonly fixture: string;
  readonly file: string;
  readonly strategy: Exclude<TypecheckStrategy, "not-applicable">;
}[] {
  validateFixtureEvidenceCatalog(catalog);
  return catalog.flatMap((record) => {
    if (record.conformance === false) return [];
    if (record.typecheck.strategy === "not-applicable") {
      throw new Error(`Conformance fixture ${record.id} is missing its type-check strategy.`);
    }
    return [{ fixture: record.id, file: record.input.file, strategy: record.typecheck.strategy }];
  });
}

export const issue14TypecheckPlan = deriveTypecheckPlan(fixtureEvidenceCatalog);

export function derivePackageTypecheckPlan(catalog: readonly FixtureEvidenceRecord[]): readonly {
  readonly fixture: string;
  readonly project: string;
}[] {
  validateFixtureEvidenceCatalog(catalog);
  return orderedView(
    catalog.flatMap((record) =>
      (record.evidence.metadata.packageTypechecks ?? []).map((entry) => ({
        fixture: record.id,
        project: entry.project,
        order: entry.order,
      }))
    ),
    "Package fixture type-check plan"
  ).map(({ fixture, project }) => ({ fixture, project }));
}

export const packageFixtureTypecheckPlan = derivePackageTypecheckPlan(fixtureEvidenceCatalog);

export function derivePackageExecutionPlan(catalog: readonly FixtureEvidenceRecord[]): readonly {
  readonly fixture: string;
  readonly input: string;
  readonly issues: readonly FixtureIssue[];
  readonly conformance: boolean;
  readonly typecheck: TypecheckStrategy;
  readonly timing: readonly TimingPlan[];
  readonly warningEvidence: boolean;
  readonly typecheckProjects: readonly string[];
}[] {
  validateFixtureEvidenceCatalog(catalog);
  return catalog.map((record) => ({
    fixture: record.id,
    input: record.input.file,
    issues: record.issues,
    conformance: record.conformance !== false,
    typecheck: record.typecheck.strategy,
    timing: record.timing.map((entry) => entry.plan),
    warningEvidence: record.warnings.oracleFile !== null || record.warnings.codes.length > 0,
    typecheckProjects: (record.evidence.metadata.packageTypechecks ?? []).map((entry) => entry.project),
  }));
}

export const packageFixtureExecutionPlan = derivePackageExecutionPlan(fixtureEvidenceCatalog);
