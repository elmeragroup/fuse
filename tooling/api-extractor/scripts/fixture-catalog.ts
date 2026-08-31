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
export type IssueFixtureOracle = "immutable-upstream" | "reviewed-ts7";

type IssueViewMetadata = {
  readonly order: number;
  readonly group?: string;
};

type GoNoGoEvidence = {
  readonly order: number;
  readonly oracle: "immutable-upstream" | "public-seam-regression" | "reviewed-ts7-exact";
  readonly status: "pass";
  readonly notes?: readonly string[];
  readonly divergenceRecord?: string;
  readonly warningOracle?: string;
};

type FixtureViewMetadata = {
  readonly issueViews?: Partial<Record<FixtureIssue, IssueViewMetadata>>;
  readonly warningOrder?: Partial<Record<"12" | "13", number>>;
  readonly timingOrder?: Partial<Record<TimingPlan, number>>;
  readonly expectedExports?: readonly string[];
  readonly goNoGo?: GoNoGoEvidence;
  readonly reactAudit?: {
    readonly order: number;
    readonly owner: "issue11" | "issue12" | "issue13";
  };
  readonly packageTypechecks?: readonly {
    readonly order: number;
    readonly project: string;
  }[];
};

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
    readonly metadata: FixtureViewMetadata;
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
  readonly metadata?: FixtureViewMetadata;
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
      metadata: options.metadata ?? {},
    },
  };
}

export const fixtureEvidenceCatalog = [
  fixture("alias-with-explicit-type-args", "input.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      timingOrder: { issue02: 0, issue14: 0 },
      goNoGo: { order: 0, oracle: "immutable-upstream", status: "pass" },
      packageTypechecks: [{ order: 0, project: "test/fixtures/issue-02-tsconfig.json" }],
    },
  }),
  fixture("base-ui-component", "input.tsx", ["02", "12", "14"], "reviewed-divergence", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      timingOrder: { issue02: 3, issue14: 3 },
      goNoGo: {
        order: 6,
        oracle: "reviewed-ts7-exact",
        status: "pass",
        divergenceRecord: "test/fixtures/base-ui-component/ts7-oracle.json",
        warningOracle: "test/fixtures/base-ui-component/warnings.tsgo.json",
      },
      reactAudit: { order: 22, owner: "issue12" },
      packageTypechecks: [
        { order: 22, project: "test/fixtures/issue-12-tsconfig.json" },
        { order: 23, project: "test/fixtures/issue-12-origin-review/tsconfig.json" },
        { order: 24, project: "test/fixtures/issue-12-origin-review/import-equals/tsconfig.json" },
        { order: 25, project: "test/fixtures/issue-12-origin-review/ambiguous-star/tsconfig.json" },
        { order: 26, project: "test/fixtures/issue-12-origin-review/angle-assertion/tsconfig.json" },
        { order: 27, project: "test/fixtures/issue-12-origin-review/same-origin-star/tsconfig.json" },
        { order: 28, project: "test/fixtures/react-policy-non-react-dependency/tsconfig.json" },
      ],
    },
  }),
  fixture("class-members-visibility-and-signatures", "input.ts", ["06", "14"], "immutable-upstream", {
    warnings: {
      oracleFile: "warnings.tsgo.json",
      codes: ["unrepresented-construct-signatures", "unrepresented-construct-signatures"],
    },
    metadata: {
      issueViews: { "06": { order: 0, group: "class" } },
      packageTypechecks: [
        { order: 10, project: "test/fixtures/issue-06-tsconfig.json" },
        { order: 11, project: "test/fixtures/issue-06-review/tsconfig.json" },
      ],
    },
  }),
  fixture("class-method-generic-signatures", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 1, group: "method" } } },
  }),
  fixture("class-method-overload-signatures", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 2, group: "method" } } },
  }),
  fixture("class-private-members-type-alias-filtering", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 3, group: "class" } } },
  }),
  fixture("distributive-conditional-intersection-expansion", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "04": { order: 0 } },
      packageTypechecks: [
        { order: 5, project: "test/fixtures/issue-04-tsconfig.json" },
        { order: 6, project: "test/fixtures/issue-04-canonical/tsconfig.json" },
      ],
    },
  }),
  fixture("enum-members-values-and-docs", "input.ts", ["03", "14"], "immutable-upstream", {
    metadata: {
      packageTypechecks: [
        { order: 1, project: "test/fixtures/issue-03-tsconfig.json" },
        { order: 2, project: "test/fixtures/issue-03-object-apis/tsconfig.json" },
        { order: 3, project: "test/fixtures/issue-03-review/tsconfig.json" },
        { order: 4, project: "test/fixtures/issue-03-review/MixedRepo/tsconfig.json" },
      ],
    },
  }),
  fixture("external-conditional-type-resolution", "input.ts", ["13", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "13": { order: 0, group: "externalConditional" } },
      packageTypechecks: [
        { order: 29, project: "test/fixtures/issue-13-tsconfig.json" },
        { order: 30, project: "test/fixtures/package-selective-external-types/tsconfig.json" },
      ],
    },
  }),
  fixture("external-mapped-type-name-preservation", "input.ts", ["08", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "08": { order: 0, group: "external" } },
      packageTypechecks: [
        { order: 14, project: "test/fixtures/issue-08-tsconfig.json" },
        { order: 15, project: "test/fixtures/issue-08-review/tsconfig.json" },
      ],
    },
  }),
  fixture("external-union-type-name-preservation", "input.ts", ["13", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
    metadata: { issueViews: { "13": { order: 1, group: "externalUnions" } } },
  }),
  fixture(
    "function-callable-intersection-extra-properties",
    "input.tsx",
    ["06", "14"],
    "immutable-upstream",
    {
      metadata: { issueViews: { "06": { order: 4, group: "callable" } } },
    }
  ),
  fixture("function-declaration-expression-arrow", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 5, group: "callable" } } },
  }),
  fixture("function-parameters-optional-and-defaults", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("generic-argument-alias-resolution", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "07": { order: 0, group: "alias" } },
      packageTypechecks: [
        { order: 12, project: "test/fixtures/issue-07-tsconfig.json" },
        { order: 13, project: "test/fixtures/issue-07-review/tsconfig.json" },
      ],
    },
  }),
  fixture("generic-callback-alias-constraint-deduplication", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 1, group: "deduplication" } } },
  }),
  fixture("generic-callback-alias-renamed-typeparams", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 2, group: "renaming" } } },
  }),
  fixture("generic-callback-alias-vs-inline-deduplication", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 3, group: "deduplication" } } },
  }),
  fixture("generic-callback-constraint-property-keys", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 4, group: "constraint" } } },
  }),
  fixture("generic-callback-default-deduplication", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 5, group: "default" } } },
  }),
  fixture("generic-callback-index-signature-deduplication", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 6, group: "indexSignature" } } },
  }),
  fixture("generic-callback-nested-shadow-deduplication", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 6, group: "shadowing" } } },
  }),
  fixture("generic-callback-typeparam-vs-typename-collision", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
  }),
  fixture("generic-constraint-tostring-collapse", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 7, group: "constraint" } } },
  }),
  fixture("generic-default-argument-resolution", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 8, group: "default" } } },
  }),
  fixture("generic-function-and-interface-resolution", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 9, group: "substitution" } } },
  }),
  fixture("generic-props-namespace-specialization", "input.ts", ["13", "14"], "reviewed-divergence", {
    metadata: {
      issueViews: { "13": { order: 2, group: "namespaceSpecialization" } },
      warningOrder: { "13": 3 },
    },
  }),
  fixture("interface-extends-basic-resolution", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
  }),
  fixture(
    "interface-extends-namespace-and-omit-resolution",
    "input.ts",
    ["13", "14"],
    "reviewed-divergence",
    {
      metadata: {
        issueViews: { "13": { order: 3, group: "heritageOmit" } },
        warningOrder: { "13": 4 },
      },
    }
  ),
  fixture("interface-merged-default-and-aliased-exports", "input.ts", ["10", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "10": { order: 0, group: "mergedDeclarations" } },
      packageTypechecks: [
        { order: 18, project: "test/fixtures/issue-10-tsconfig.json" },
        { order: 19, project: "test/fixtures/issue-10-review/tsconfig.json" },
      ],
    },
  }),
  fixture("interface-method-generic-signatures", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 10, group: "method" } } },
  }),
  fixture("intersection-order-deduplication", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 1 } } },
  }),
  fixture("jsdoc-comments-and-overloads", "input.tsx", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 6, group: "overload" } } },
  }),
  fixture("jsdoc-extra-tags-preservation", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("large-nested-union-any-order", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 2 } } },
  }),
  fixture("mapped-alias-finite-key", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 7, group: "mappedKey" } } },
  }),
  fixture("mapped-alias-nested-mapped-value", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 9, group: "mappedKey" } } },
  }),
  fixture("mapped-alias-nested-value", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 8, group: "mappedKey" } } },
  }),
  fixture("mapped-alias-two-hop", "input.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      timingOrder: { issue02: 1, issue14: 1 },
      goNoGo: { order: 1, oracle: "immutable-upstream", status: "pass" },
    },
  }),
  fixture("mapped-tuple-rest-synthetic-key", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 2, group: "tuple" } } },
  }),
  fixture("mapped-type-builtin-utility-resolution", "input.ts", ["08", "14"], "immutable-upstream", {
    metadata: { issueViews: { "08": { order: 1, group: "modifiers" } } },
  }),
  fixture("mapped-type-optional-aliased-unknown", "input.ts", ["08", "14"], "immutable-upstream", {
    metadata: { issueViews: { "08": { order: 2, group: "openDomain" } } },
  }),
  fixture("mapped-type-prettify-intersection-resolution", "input.ts", ["04", "14"], "reviewed-divergence", {
    metadata: { issueViews: { "04": { order: 11 } } },
  }),
  fixture("merged-interface-signature-typeparams", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 7, group: "overload" } } },
  }),
  fixture("module-dts-declarations-and-reexports", "input.d.ts", ["02", "14"], "immutable-upstream", {
    timing: ["issue02", "issue14"],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      timingOrder: { issue02: 2, issue14: 2 },
      goNoGo: {
        order: 2,
        oracle: "immutable-upstream",
        status: "pass",
        notes: [
          "type-only declaration-file re-exports are filtered",
          "package-owned module-resolution operation is implemented",
          "module import metadata is preserved",
        ],
      },
    },
  }),
  fixture("module-dts-type-star", "input.d.ts", ["02"], "generated", {
    conformance: false,
    metadata: {
      expectedExports: ["RuntimeValue", "Value", "OtherValue"],
      goNoGo: {
        order: 3,
        oracle: "public-seam-regression",
        status: "pass",
        notes: [
          "export type * from ./source.js resolves to source.d.ts",
          "type exports are retained and runtime exports are filtered from the star",
        ],
      },
    },
  }),
  fixture("module-export-forms", "input.tsx", ["13", "14"], "reviewed-divergence", {
    metadata: {
      issueViews: { "13": { order: 4, group: "exportForms" } },
      warningOrder: { "13": 2 },
    },
  }),
  fixture("module-imports-only", "input.ts", ["14"], "immutable-upstream", {
    typecheck: "virtual-upstream-dependency",
  }),
  fixture("module-reexport-imported-class-type", "input.ts", ["06", "14"], "immutable-upstream", {
    metadata: { issueViews: { "06": { order: 8, group: "class" } } },
  }),
  fixture("module-reexports-aliased-source-tracking", "input.ts", ["13", "14"], "immutable-upstream", {
    metadata: { issueViews: { "13": { order: 5, group: "reexportTracking" } } },
  }),
  fixture("module-reexports-basic", "input.ts", ["10", "14"], "immutable-upstream", {
    metadata: { issueViews: { "10": { order: 1, group: "reexports" } } },
  }),
  fixture("module-reexports-parts-namespace", "input.ts", ["13", "14"], "reviewed-divergence", {
    metadata: { issueViews: { "13": { order: 6, group: "reexportNamespaces" } } },
  }),
  fixture("module-resolution-alias", "input.d.ts", ["02"], "generated", {
    conformance: false,
    metadata: {
      expectedExports: ["RuntimeValue", "AliasValue"],
      goNoGo: {
        order: 4,
        oracle: "public-seam-regression",
        status: "pass",
        notes: [
          "non-relative path mapping resolves through the compiler symbol graph",
          "explicit runtime re-export remains visible",
        ],
      },
    },
  }),
  fixture("module-resolution-package", "input.d.ts", ["02"], "generated", {
    conformance: false,
    metadata: {
      expectedExports: ["RuntimeValue", "PackageValue"],
      goNoGo: {
        order: 5,
        oracle: "public-seam-regression",
        status: "pass",
        notes: [
          "package exports resolve through the compiler symbol graph",
          "explicit runtime re-export remains visible",
        ],
      },
    },
  }),
  fixture("namespace-callback-alias-resolution", "input.tsx", ["10", "14"], "immutable-upstream", {
    metadata: { issueViews: { "10": { order: 2, group: "namespaces" } } },
  }),
  fixture("namespace-export-resolution", "input.tsx", ["10", "14"], "reviewed-divergence", {
    metadata: { issueViews: { "10": { order: 4, group: "namespaces" } } },
  }),
  fixture("namespace-nested-alias-resolution", "input.tsx", ["10", "14"], "immutable-upstream", {
    metadata: { issueViews: { "10": { order: 3, group: "namespaces" } } },
  }),
  fixture("nested-function-union-any-deduplication", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 3 } } },
  }),
  fixture("object-property-count-limit-scope", "input.tsx", ["03", "14"], "immutable-upstream"),
  fixture("react-component-function-declaration", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 0, group: "declaration" } },
      reactAudit: { order: 0, owner: "issue11" },
      packageTypechecks: [
        { order: 20, project: "test/fixtures/issue-11-tsconfig.json" },
        { order: 21, project: "test/fixtures/issue-11-review/tsconfig.json" },
      ],
    },
  }),
  fixture("react-component-function-overloads", "input.ts", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 3, group: "componentOverloads" } },
      reactAudit: { order: 3, owner: "issue11" },
    },
  }),
  fixture("react-component-function-variable", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 1, group: "variable" } },
      reactAudit: { order: 1, owner: "issue11" },
    },
  }),
  fixture(
    "react-component-generic-function-overloads",
    "input.ts",
    ["11", "12", "14"],
    "immutable-upstream",
    {
      metadata: {
        issueViews: { "11": { order: 4, group: "componentOverloads" } },
        reactAudit: { order: 4, owner: "issue11" },
      },
    }
  ),
  fixture(
    "react-component-overload-any-callback-deduplication",
    "input.tsx",
    ["12", "13", "14"],
    "reviewed-divergence",
    {
      warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
      metadata: {
        issueViews: { "13": { order: 7, group: "overloadDeduplication" } },
        reactAudit: { order: 5, owner: "issue13" },
      },
    }
  ),
  fixture("react-component-render-callback-props", "input.tsx", ["12", "13", "14"], "reviewed-divergence", {
    metadata: {
      issueViews: { "13": { order: 8, group: "renderCallbacks" } },
      reactAudit: { order: 6, owner: "issue13" },
    },
  }),
  fixture("react-component-return-types", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 2, group: "returnTypes" } },
      reactAudit: { order: 2, owner: "issue11" },
    },
  }),
  fixture("react-component-union-variants", "input.tsx", ["12", "13", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["uncertain-component-recognition"] },
    metadata: {
      issueViews: { "13": { order: 9, group: "componentUnions" } },
      reactAudit: { order: 7, owner: "issue13" },
    },
  }),
  fixture("react-event-handlers", "input.ts", ["12", "13", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "13": { order: 10, group: "handlers" } },
      reactAudit: { order: 8, owner: "issue13" },
    },
  }),
  fixture("react-forward-ref-component", "input.tsx", ["12", "14"], "immutable-upstream", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      issueViews: { "12": { order: 0, group: "forwardRef" } },
      reactAudit: { order: 18, owner: "issue12" },
    },
  }),
  fixture("react-forward-ref-union-props", "input.tsx", ["12", "14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      issueViews: { "12": { order: 1, group: "forwardRefUnion" } },
      reactAudit: { order: 19, owner: "issue12" },
    },
  }),
  fixture("react-hook-arrow-function", "input.ts", ["12", "13", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "13": { order: 11, group: "hooks" } },
      reactAudit: { order: 9, owner: "issue13" },
    },
  }),
  fixture("react-hook-function-declaration", "input.ts", ["12", "13", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "13": { order: 12, group: "hooks" } },
      reactAudit: { order: 10, owner: "issue13" },
    },
  }),
  fixture("react-hook-function-expression", "input.ts", ["12", "13", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "13": { order: 13, group: "hooks" } },
      reactAudit: { order: 11, owner: "issue13" },
    },
  }),
  fixture("react-hook-multiple-parameters", "input.ts", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 8, group: "hooks" } },
      reactAudit: { order: 12, owner: "issue11" },
    },
  }),
  fixture("react-hook-overload-signatures", "input.ts", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 9, group: "hooks" } },
      reactAudit: { order: 13, owner: "issue11" },
    },
  }),
  fixture("react-memo-component", "input.tsx", ["12", "14"], "immutable-upstream", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      issueViews: { "12": { order: 2, group: "memo" } },
      reactAudit: { order: 20, owner: "issue12" },
    },
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
    metadata: {
      issueViews: { "12": { order: 3, group: "overridable" } },
      reactAudit: { order: 21, owner: "issue12" },
    },
  }),
  fixture("react-props-callback-types", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 5, group: "props" } },
      reactAudit: { order: 14, owner: "issue11" },
    },
  }),
  fixture("react-props-literal-types", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 6, group: "props" } },
      reactAudit: { order: 15, owner: "issue11" },
    },
  }),
  fixture("react-props-optional-types", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 7, group: "props" } },
      reactAudit: { order: 16, owner: "issue11" },
    },
  }),
  fixture("react-refs", "input.tsx", ["12", "13", "14"], "reviewed-divergence", {
    metadata: {
      issueViews: { "13": { order: 14, group: "refs" } },
      reactAudit: { order: 17, owner: "issue13" },
    },
  }),
  fixture("readonly-array-mapped-alias-wrapped", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 10, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 11, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-any-value", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 12, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-as-clause", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 13, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-key-no-default", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 14, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-literal-key", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 15, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-non-optional", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 16, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-number-key", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 17, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-plus-optional", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 18, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-strip-optional", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 19, group: "readonlyArray" } } },
  }),
  fixture(
    "readonly-array-mapped-type-template-literal-constraint",
    "input.ts",
    ["05", "14"],
    "immutable-upstream",
    { metadata: { issueViews: { "05": { order: 20, group: "readonlyArray" } } } }
  ),
  fixture("readonly-array-mapped-type-union-default", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 21, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-value-no-default", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 22, group: "readonlyArray" } } },
  }),
  fixture("readonly-array-mapped-type-with-concrete-props", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 23, group: "readonlyArray" } } },
  }),
  fixture("symbol-double-underscore-name-preservation", "input.ts", ["14"], "reviewed-divergence", {
    warnings: { oracleFile: "warnings.tsgo.json", codes: ["unsupported-type-fallback"] },
  }),
  fixture("type-alias-basic-resolution", "input.ts", ["07", "14"], "reviewed-divergence", {
    metadata: { issueViews: { "07": { order: 12, group: "alias" } } },
  }),
  fixture("type-alias-export-preservation", "input.ts", ["09", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "09": { order: 0, group: "alias" } },
      packageTypechecks: [
        { order: 16, project: "test/fixtures/issue-09-tsconfig.json" },
        { order: 17, project: "test/fixtures/issue-09-review/tsconfig.json" },
      ],
    },
  }),
  fixture("type-alias-generic-argument-resolution", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 11, group: "alias" } } },
  }),
  fixture("type-alias-union-member-resolution", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 4 } } },
  }),
  fixture("type-array-syntax-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "05": { order: 0, group: "array" } },
      packageTypechecks: [
        { order: 7, project: "test/fixtures/issue-05-tsconfig.json" },
        { order: 8, project: "test/fixtures/issue-05-containers/tsconfig.json" },
        { order: 9, project: "test/fixtures/issue-05-review/tsconfig.json" },
      ],
    },
  }),
  fixture("type-conditional-return-and-props", "input.ts", ["09", "14"], "immutable-upstream", {
    metadata: { issueViews: { "09": { order: 1, group: "conditional" } } },
  }),
  fixture("type-cycle-recursive-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 24, group: "recursive" } } },
  }),
  fixture("type-extract-utility-resolution", "input.ts", ["09", "14"], "immutable-upstream", {
    metadata: { issueViews: { "09": { order: 2, group: "conditional" } } },
  }),
  fixture("type-index-signature-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 5, group: "indexSignature" } } },
  }),
  fixture("type-indexed-access-union-resolution", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 5 } } },
  }),
  fixture("type-intersection-resolution", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 6 } } },
  }),
  fixture("type-intrinsic-props-resolution", "input.tsx", ["14"], "immutable-upstream"),
  fixture("type-literal-union-resolution", "input.ts", ["09", "14"], "reviewed-divergence", {
    metadata: { issueViews: { "09": { order: 3, group: "keyof" } } },
  }),
  fixture("type-never-resolution", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 7 } } },
  }),
  fixture("type-object-shape-resolution", "input.ts", ["03", "14"], "immutable-upstream"),
  fixture("type-record-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 3, group: "record" } } },
  }),
  fixture("type-reference-vs-inline-resolution", "input.ts", ["07", "14"], "immutable-upstream", {
    metadata: { issueViews: { "07": { order: 13, group: "alias" } } },
  }),
  fixture("type-tuple-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 1, group: "tuple" } } },
  }),
  fixture("type-union-object-props-resolution", "input.tsx", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 8 } } },
  }),
  fixture("type-utility-types-resolution", "input.ts", ["05", "14"], "immutable-upstream", {
    metadata: { issueViews: { "05": { order: 4, group: "record" } } },
  }),
  fixture("union-any-wildcard-order", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 9 } } },
  }),
  fixture("union-never-reduction", "input.ts", ["04", "14"], "immutable-upstream", {
    metadata: { issueViews: { "04": { order: 10 } } },
  }),
  fixture("unresolved-indexed-access-fallback", "input.ts", ["09", "14"], "immutable-upstream", {
    metadata: { issueViews: { "09": { order: 4, group: "indexedAccess" } } },
  }),
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
    for (const [issue, metadata] of Object.entries(record.evidence.metadata.issueViews ?? {})) {
      // SAFETY: issueViews is typed as a partial record whose keys are FixtureIssue literals.
      if (!record.issues.includes(issue as FixtureIssue)) {
        throw new Error(`Fixture ${record.id} has issue-view metadata without issue membership.`);
      }
      if (!Number.isSafeInteger(metadata.order) || metadata.order < 0) {
        throw new Error(`Fixture ${record.id} has an invalid issue-view order.`);
      }
    }
    for (const [plan, order] of Object.entries(record.evidence.metadata.timingOrder ?? {})) {
      // SAFETY: timingOrder is typed as a partial record whose keys are TimingPlan literals.
      if (!record.timing.includes(plan as TimingPlan) || !Number.isSafeInteger(order) || order < 0) {
        throw new Error(`Fixture ${record.id} has incompatible timing metadata.`);
      }
    }
    if (record.evidence.metadata.expectedExports !== undefined && !record.issues.includes("02")) {
      throw new Error(`Fixture ${record.id} has supplemental exports without Issue 02 membership.`);
    }
    if (record.evidence.metadata.goNoGo !== undefined && !record.issues.includes("02")) {
      throw new Error(`Fixture ${record.id} has go/no-go evidence without Issue 02 membership.`);
    }
    if (record.evidence.metadata.reactAudit !== undefined && !record.issues.includes("12")) {
      throw new Error(`Fixture ${record.id} has React audit evidence without Issue 12 membership.`);
    }
    for (const entry of record.evidence.metadata.packageTypechecks ?? []) {
      if (!Number.isSafeInteger(entry.order) || entry.order < 0 || !entry.project.endsWith("tsconfig.json")) {
        throw new Error(`Fixture ${record.id} has invalid package type-check metadata.`);
      }
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

function issueOracle(record: FixtureEvidenceRecord): IssueFixtureOracle {
  return record.oracle.disposition === "reviewed-divergence" ? "reviewed-ts7" : "immutable-upstream";
}

function orderedView<T extends { readonly order: number }>(
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

export type Issue02TimingFixture = {
  readonly fixture: string;
  readonly file: string;
  readonly oracleFile: "output.json" | "output.tsgo.json";
  readonly warningOracle: "warnings.tsgo.json";
};

export function deriveTimingPlan(
  catalog: readonly FixtureEvidenceRecord[],
  plan: TimingPlan
): readonly Issue02TimingFixture[] {
  validateFixtureEvidenceCatalog(catalog);
  return orderedView(
    catalog.flatMap((record) => {
      if (!record.timing.includes(plan)) return [];
      const order = record.evidence.metadata.timingOrder?.[plan];
      if (order === undefined) throw new Error(`Fixture ${record.id} is missing ${plan} timing order.`);
      if (record.oracle.selectedFile === null || record.warnings.oracleFile === null) {
        throw new Error(`Fixture ${record.id} has incomplete ${plan} timing evidence.`);
      }
      return [
        {
          fixture: record.id,
          file: record.input.file,
          oracleFile: record.oracle.selectedFile,
          warningOracle: record.warnings.oracleFile,
          order,
        },
      ];
    }),
    `${plan} timing plan`
  ).map(({ fixture, file, oracleFile, warningOracle }) => ({
    fixture,
    file,
    oracleFile,
    warningOracle,
  }));
}

export const issue02TimingFixtures = deriveTimingPlan(fixtureEvidenceCatalog, "issue02");
export const issue14TimingFixtures = deriveTimingPlan(fixtureEvidenceCatalog, "issue14");

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

export const issue02GoNoGoFixtures = orderedView(
  fixtureEvidenceCatalog.flatMap((record) => {
    const evidence = record.evidence.metadata.goNoGo;
    return evidence === undefined ? [] : [{ fixture: record.id, ...evidence }];
  }),
  "Issue 02 go/no-go fixture view"
).map(({ order: _order, ...entry }) => entry);
export type Issue02GoNoGoFixture = (typeof issue02GoNoGoFixtures)[number];

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
    timing: record.timing,
    warningEvidence: record.warnings.oracleFile !== null || record.warnings.codes.length > 0,
    typecheckProjects: (record.evidence.metadata.packageTypechecks ?? []).map((entry) => entry.project),
  }));
}

export const packageFixtureExecutionPlan = derivePackageExecutionPlan(fixtureEvidenceCatalog);
