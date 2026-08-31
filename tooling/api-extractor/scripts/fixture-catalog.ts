export const issue14TypeScript7Compiler = "typescript@7.0.2" as const;

export type FixtureIssue =
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14";

export type OracleDisposition = "immutable-upstream" | "reviewed-divergence" | "generated";
export type ConformanceDisposition = "unchanged" | "reviewed-ts7";
export type TypecheckStrategy = "direct-input" | "virtual-upstream-dependency" | "not-applicable";
export type TimingPlan = "issue02" | "issue14";

export type FixtureEvidenceRecord = {
  readonly id: string;
  readonly input: {
    readonly id: string;
    readonly file: string;
  };
  readonly issues: readonly FixtureIssue[];
  readonly conformance:
    | {
        readonly evidenceId: string;
        readonly disposition: ConformanceDisposition;
      }
    | false;
  readonly typecheck: {
    readonly strategy: TypecheckStrategy;
  };
  readonly timing: readonly TimingPlan[];
  readonly warnings: {
    readonly oracleFile: "warnings.tsgo.json" | null;
    readonly codes: readonly string[];
  };
  readonly oracle: {
    readonly disposition: OracleDisposition;
    readonly upstreamFile: "output.json" | null;
    readonly selectedFile: "output.json" | "output.tsgo.json" | null;
    readonly divergenceRecord: "ts7-oracle.json" | null;
  };
  readonly evidence: {
    readonly id: string;
    readonly origin: "pinned-upstream" | "local-regression";
    readonly compiler: typeof issue14TypeScript7Compiler;
  };
};

type FixtureOptions = {
  readonly conformance?: boolean;
  readonly timing?: readonly TimingPlan[];
  readonly typecheck?: TypecheckStrategy;
  readonly warnings?: {
    readonly oracleFile: "warnings.tsgo.json";
    readonly codes: readonly string[];
  };
};

function fixture(
  id: string,
  file: string,
  issues: readonly FixtureIssue[],
  disposition: OracleDisposition,
  options: FixtureOptions = {}
): FixtureEvidenceRecord {
  const participatesInConformance = options.conformance ?? disposition !== "generated";
  const evidenceId = `${id}/${participatesInConformance ? "conformance" : "regression"}`;
  const conformanceDisposition = disposition === "reviewed-divergence" ? "reviewed-ts7" : "unchanged";
  return {
    id,
    input: { id: `${id}/${file}`, file },
    issues,
    conformance: participatesInConformance ? { evidenceId, disposition: conformanceDisposition } : false,
    typecheck: {
      strategy: options.typecheck ?? (participatesInConformance ? "direct-input" : "not-applicable"),
    },
    timing: options.timing ?? [],
    warnings: options.warnings ?? { oracleFile: null, codes: [] },
    oracle: {
      disposition,
      upstreamFile: disposition === "generated" ? null : "output.json",
      selectedFile:
        disposition === "generated"
          ? null
          : disposition === "reviewed-divergence"
            ? "output.tsgo.json"
            : "output.json",
      divergenceRecord: disposition === "reviewed-divergence" ? "ts7-oracle.json" : null,
    },
    evidence: {
      id: evidenceId,
      origin: disposition === "generated" ? "local-regression" : "pinned-upstream",
      compiler: issue14TypeScript7Compiler,
    },
  };
}

export const fixtureEvidenceCatalog = [
  fixture("alias-with-explicit-type-args", "input.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("base-ui-component", "input.tsx", ["02", "12", "14"], "reviewed-divergence", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("class-members-visibility-and-signatures", "input.ts", ["06", "14"], "immutable-upstream", {
    warnings: {
      oracleFile: "warnings.tsgo.json",
      codes: ["unrepresented-construct-signatures", "unrepresented-construct-signatures"],
    },
  }),
  fixture("class-method-generic-signatures", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("class-method-overload-signatures", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("class-private-members-type-alias-filtering", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("distributive-conditional-intersection-expansion", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("enum-members-values-and-docs", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("external-conditional-type-resolution", "input.ts", ["13", "14"], "immutable-upstream"),
  fixture("external-mapped-type-name-preservation", "input.ts", ["08", "14"], "immutable-upstream"),
  fixture("external-union-type-name-preservation", "input.ts", ["13", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
  }),
  fixture("function-callable-intersection-extra-properties", "input.tsx", ["06", "14"], "immutable-upstream"),
  fixture("function-declaration-expression-arrow", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("function-parameters-optional-and-defaults", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("generic-argument-alias-resolution", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-alias-constraint-deduplication", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-alias-renamed-typeparams", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-alias-vs-inline-deduplication", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-constraint-property-keys", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-default-deduplication", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-index-signature-deduplication", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("generic-callback-nested-shadow-deduplication", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-callback-typeparam-vs-typename-collision", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("generic-constraint-tostring-collapse", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-default-argument-resolution", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-function-and-interface-resolution", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("generic-props-namespace-specialization", "input.ts", ["13", "14"], "reviewed-divergence"),
  fixture("interface-extends-basic-resolution", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
  }),
  fixture("interface-extends-namespace-and-omit-resolution", "input.ts", ["13", "14"], "reviewed-divergence"),
  fixture("interface-merged-default-and-aliased-exports", "input.ts", ["10", "14"], "immutable-upstream"),
  fixture("interface-method-generic-signatures", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("intersection-order-deduplication", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("jsdoc-comments-and-overloads", "input.tsx", ["06", "14"], "immutable-upstream"),
  fixture("jsdoc-extra-tags-preservation", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("large-nested-union-any-order", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("mapped-alias-finite-key", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("mapped-alias-nested-mapped-value", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("mapped-alias-nested-value", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("mapped-alias-two-hop", "input.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("mapped-tuple-rest-synthetic-key", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("mapped-type-builtin-utility-resolution", "input.ts", ["08", "14"], "immutable-upstream"),
  fixture("mapped-type-optional-aliased-unknown", "input.ts", ["08", "14"], "immutable-upstream"),
  fixture("mapped-type-prettify-intersection-resolution", "input.ts", ["04", "14"], "reviewed-divergence"),
  fixture("merged-interface-signature-typeparams", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("module-dts-declarations-and-reexports", "input.d.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("module-dts-type-star", "input.d.ts", ["02"], "generated", { conformance: false }),
  fixture("module-export-forms", "input.tsx", ["13", "14"], "reviewed-divergence"),
  fixture("module-imports-only", "input.ts", ["14"], "immutable-upstream", {
    typecheck: "virtual-upstream-dependency",
  }),
  fixture("module-reexport-imported-class-type", "input.ts", ["06", "14"], "immutable-upstream"),
  fixture("module-reexports-aliased-source-tracking", "input.ts", ["13", "14"], "immutable-upstream"),
  fixture("module-reexports-basic", "input.ts", ["10", "14"], "immutable-upstream"),
  fixture("module-reexports-parts-namespace", "input.ts", ["13", "14"], "reviewed-divergence"),
  fixture("module-resolution-alias", "input.d.ts", ["02"], "generated", { conformance: false }),
  fixture("module-resolution-package", "input.d.ts", ["02"], "generated", { conformance: false }),
  fixture("namespace-callback-alias-resolution", "input.tsx", ["10", "14"], "immutable-upstream"),
  fixture("namespace-export-resolution", "input.tsx", ["10", "14"], "reviewed-divergence"),
  fixture("namespace-nested-alias-resolution", "input.tsx", ["10", "14"], "immutable-upstream"),
  fixture("nested-function-union-any-deduplication", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("object-property-count-limit-scope", "input.tsx", ["03", "14"], "immutable-upstream"),
  fixture("react-component-function-declaration", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-component-function-overloads", "input.ts", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-component-function-variable", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-component-generic-function-overloads", "input.ts", ["11", "12", "14"], "immutable-upstream"),
  fixture(
    "react-component-overload-any-callback-deduplication",
    "input.tsx",
    ["12", "13", "14"],
    "reviewed-divergence",
    {
      warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
    }
  ),
  fixture("react-component-render-callback-props", "input.tsx", ["12", "13", "14"], "reviewed-divergence"),
  fixture("react-component-return-types", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-component-union-variants", "input.tsx", ["12", "13", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["uncertain-component-recognition"] },
  }),
  fixture("react-event-handlers", "input.ts", ["12", "13", "14"], "immutable-upstream"),
  fixture("react-forward-ref-component", "input.tsx", ["12", "14"], "immutable-upstream", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("react-forward-ref-union-props", "input.tsx", ["12", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("react-hook-arrow-function", "input.ts", ["12", "13", "14"], "immutable-upstream"),
  fixture("react-hook-function-declaration", "input.ts", ["12", "13", "14"], "immutable-upstream"),
  fixture("react-hook-function-expression", "input.ts", ["12", "13", "14"], "immutable-upstream"),
  fixture("react-hook-multiple-parameters", "input.ts", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-hook-overload-signatures", "input.ts", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-memo-component", "input.tsx", ["12", "14"], "immutable-upstream", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("react-mui-overridable-component", "input.d.ts", ["12", "14"], "reviewed-divergence", {
    warnings: {
      oracleFile: "warnings.tsgo.json",
      codes: [
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
        "omitted-index-signature",
      ],
    },
  }),
  fixture("react-props-callback-types", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-props-literal-types", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-props-optional-types", "input.tsx", ["11", "12", "14"], "immutable-upstream"),
  fixture("react-refs", "input.tsx", ["12", "13", "14"], "reviewed-divergence"),
  fixture("readonly-array-mapped-alias-wrapped", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-any-value", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-as-clause", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-key-no-default", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-literal-key", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-non-optional", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-number-key", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-plus-optional", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-strip-optional", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture(
    "readonly-array-mapped-type-template-literal-constraint",
    "input.ts",
    ["05", "14"],
    "immutable-upstream"
  ),
  fixture("readonly-array-mapped-type-union-default", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-value-no-default", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("readonly-array-mapped-type-with-concrete-props", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("symbol-double-underscore-name-preservation", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
  }),
  fixture("type-alias-basic-resolution", "input.ts", ["07", "14"], "reviewed-divergence"),
  fixture("type-alias-export-preservation", "input.ts", ["09", "14"], "immutable-upstream"),
  fixture("type-alias-generic-argument-resolution", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("type-alias-union-member-resolution", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("type-array-syntax-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("type-conditional-return-and-props", "input.ts", ["09", "14"], "immutable-upstream"),
  fixture("type-cycle-recursive-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("type-extract-utility-resolution", "input.ts", ["09", "14"], "immutable-upstream"),
  fixture("type-index-signature-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("type-indexed-access-union-resolution", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("type-intersection-resolution", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("type-intrinsic-props-resolution", "input.tsx", ["14"], "immutable-upstream"),
  fixture("type-literal-union-resolution", "input.ts", ["09", "14"], "reviewed-divergence"),
  fixture("type-never-resolution", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("type-object-shape-resolution", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("type-record-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("type-reference-vs-inline-resolution", "input.ts", ["07", "14"], "immutable-upstream"),
  fixture("type-tuple-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("type-union-object-props-resolution", "input.tsx", ["04", "14"], "immutable-upstream"),
  fixture("type-utility-types-resolution", "input.ts", ["05", "14"], "immutable-upstream"),
  fixture("union-any-wildcard-order", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("union-never-reduction", "input.ts", ["04", "14"], "immutable-upstream"),
  fixture("unresolved-indexed-access-fallback", "input.ts", ["09", "14"], "immutable-upstream"),
] as const satisfies readonly FixtureEvidenceRecord[];

function sorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || (values[index - 1] ?? "") < value);
}

export function validateFixtureEvidenceCatalog(catalog: readonly FixtureEvidenceRecord[]): void {
  const fixtureIds = catalog.map((record) => record.id);
  if (new Set(fixtureIds).size !== fixtureIds.length) {
    throw new Error("Fixture evidence catalog contains a duplicate fixture identity.");
  }
  if (!sorted(fixtureIds)) {
    throw new Error("Fixture evidence catalog records must use stable fixture-identity ordering.");
  }

  const evidenceIds = catalog.map((record) => record.evidence.id);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new Error("Fixture evidence catalog contains a duplicate evidence identity.");
  }

  const knownEvidence = new Set(evidenceIds);
  for (const record of catalog) {
    if (record.input.id !== `${record.id}/${record.input.file}`) {
      throw new Error(`Fixture ${record.id} has a stale input identity.`);
    }
    if (!sorted(record.issues) || new Set(record.issues).size !== record.issues.length) {
      throw new Error(`Fixture ${record.id} has unstable or duplicate issue memberships.`);
    }
    if (record.conformance === false) {
      if (record.issues.includes("14") || record.oracle.disposition !== "generated") {
        throw new Error(`Fixture ${record.id} has an incompatible non-conformance classification.`);
      }
      continue;
    }
    if (!knownEvidence.has(record.conformance.evidenceId)) {
      throw new Error(`Fixture ${record.id} references missing conformance evidence.`);
    }
    if (record.conformance.evidenceId !== record.evidence.id) {
      throw new Error(`Fixture ${record.id} references conformance evidence owned by another record.`);
    }
    if (!record.issues.includes("14") || record.oracle.disposition === "generated") {
      throw new Error(`Fixture ${record.id} has an incompatible conformance classification.`);
    }
    const expectedDisposition =
      record.oracle.disposition === "reviewed-divergence" ? "reviewed-ts7" : "unchanged";
    if (record.conformance.disposition !== expectedDisposition) {
      throw new Error(`Fixture ${record.id} has an incompatible oracle disposition.`);
    }
    if (
      record.oracle.upstreamFile !== "output.json" ||
      (record.oracle.disposition === "reviewed-divergence") !==
        (record.oracle.selectedFile === "output.tsgo.json" &&
          record.oracle.divergenceRecord === "ts7-oracle.json")
    ) {
      throw new Error(`Fixture ${record.id} has incompatible oracle evidence metadata.`);
    }
  }
}

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
