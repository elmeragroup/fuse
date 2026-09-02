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

export type OracleDisposition = "immutable-upstream" | "reviewed-divergence" | "generated" | "not-applicable";
export type ConformanceDisposition = "unchanged" | "reviewed-ts7";
export type TypecheckStrategy = "direct-input" | "virtual-upstream-dependency" | "not-applicable";
export type TimingPlan = "externalSelection" | "issue02" | "issue14";
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

export type TimingMetadata =
  | {
      readonly plan: "issue02";
      readonly order: number;
      readonly maxFetchedToMaterializedRatio: number;
      readonly maxRequestCount: number;
      readonly maxBytesReceived: number;
      readonly bytesReceivedPathLengthHeadroom?: number;
    }
  | { readonly plan: "issue14"; readonly order: number }
  | { readonly plan: "externalSelection"; readonly order: number; readonly maxRequestCount: number };

export type Issue02TimingMetadata = Extract<TimingMetadata, { readonly plan: "issue02" }>;
export type Issue14TimingMetadata = Extract<TimingMetadata, { readonly plan: "issue14" }>;
export type ExternalSelectionTimingMetadata = Extract<TimingMetadata, { readonly plan: "externalSelection" }>;

type FixtureViewMetadata = {
  readonly issueViews?: Partial<Record<FixtureIssue, IssueViewMetadata>>;
  readonly warningOrder?: Partial<Record<"12" | "13", number>>;
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
  readonly timing: readonly TimingMetadata[];
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
  readonly timing?: readonly TimingMetadata[];
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
  const hasOracle = disposition === "immutable-upstream" || disposition === "reviewed-divergence";
  const participatesInConformance = options.conformance ?? hasOracle;
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
      upstreamFile: hasOracle ? "output.json" : null,
      selectedFile: !hasOracle
        ? null
        : disposition === "reviewed-divergence"
          ? "output.tsgo.json"
          : "output.json",
      divergenceRecord: disposition === "reviewed-divergence" ? "ts7-oracle.json" : null,
    },
    evidence: {
      id: evidenceId,
      origin: hasOracle ? "pinned-upstream" : "local-regression",
      compiler: issue14TypeScript7Compiler,
      metadata: options.metadata ?? {},
    },
  };
}

/** Path-length slack for small Issue 02 bytes-received budgets. */
export const issue02BytesReceivedPathLengthHeadroom = 32_768;

export const fixtureEvidenceCatalog = [
  fixture("alias-with-explicit-type-args", "input.ts", ["02", "14"], "immutable-upstream", {
    timing: [
      {
        plan: "issue02",
        order: 0,
        maxFetchedToMaterializedRatio: 1.2,
        maxRequestCount: 175,
        maxBytesReceived: 33303,
        bytesReceivedPathLengthHeadroom: issue02BytesReceivedPathLengthHeadroom,
      },
      { plan: "issue14", order: 0 },
    ],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
      goNoGo: { order: 0, oracle: "immutable-upstream", status: "pass" },
      packageTypechecks: [{ order: 0, project: "test/fixtures/issue-02-tsconfig.json" }],
    },
  }),
  fixture("backend-lazy-declarations", "input.ts", ["02"], "not-applicable", {
    conformance: false,
    typecheck: "not-applicable",
    metadata: {
      packageTypechecks: [{ order: 31, project: "test/fixtures/backend-lazy-declarations/tsconfig.json" }],
    },
  }),
  fixture("base-ui-component", "input.tsx", ["02", "12", "14"], "reviewed-divergence", {
    timing: [
      {
        plan: "issue02",
        order: 3,
        maxFetchedToMaterializedRatio: 140,
        maxRequestCount: 569,
        maxBytesReceived: 3200000,
      },
      { plan: "issue14", order: 3 },
    ],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
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
      issueViews: { "03": { order: 1 } },
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
      packageTypechecks: [{ order: 29, project: "test/fixtures/issue-13-tsconfig.json" }],
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
  fixture("function-parameters-optional-and-defaults", "input.ts", ["03", "14"], "immutable-upstream", {
    metadata: { issueViews: { "03": { order: 4 } } },
  }),
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
  fixture("jsdoc-extra-tags-preservation", "input.ts", ["03", "14"], "immutable-upstream", {
    metadata: { issueViews: { "03": { order: 2 } } },
  }),
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
    timing: [
      {
        plan: "issue02",
        order: 1,
        maxFetchedToMaterializedRatio: 1.2,
        maxRequestCount: 114,
        maxBytesReceived: 22577,
        bytesReceivedPathLengthHeadroom: issue02BytesReceivedPathLengthHeadroom,
      },
      { plan: "issue14", order: 1 },
    ],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
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
    timing: [
      {
        plan: "issue02",
        order: 2,
        maxFetchedToMaterializedRatio: 116,
        maxRequestCount: 237,
        maxBytesReceived: 980000,
      },
      { plan: "issue14", order: 2 },
    ],
    warnings: { oracleFile: "warnings.tsgo.json", codes: [] },
    metadata: {
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
  fixture("object-property-count-limit-scope", "input.tsx", ["03", "14"], "immutable-upstream", {
    metadata: { issueViews: { "03": { order: 3 } } },
  }),
  fixture("package-selective-external-types", "input.ts", ["13"], "not-applicable", {
    conformance: false,
    timing: [{ plan: "externalSelection", order: 0, maxRequestCount: 415 }],
    typecheck: "not-applicable",
    metadata: {
      packageTypechecks: [
        { order: 30, project: "test/fixtures/package-selective-external-types/tsconfig.json" },
      ],
    },
  }),
  fixture("react-component-function-declaration", "input.tsx", ["11", "12", "14"], "immutable-upstream", {
    metadata: {
      issueViews: { "11": { order: 0, group: "declaration" } },
      reactAudit: { order: 0, owner: "issue11" },
      packageTypechecks: [
        { order: 20, project: "test/fixtures/issue-11-tsconfig.json" },
        { order: 21, project: "test/fixtures/issue-11-review/tsconfig.json" },
        { order: 32, project: "test/fixtures/component-object/tsconfig.json" },
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
  fixture("type-object-shape-resolution", "input.ts", ["03", "14"], "immutable-upstream", {
    metadata: { issueViews: { "03": { order: 0 } } },
  }),
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
function isFixtureLocalFile(file: string): boolean {
  return file.length > 0 && file !== "." && file !== ".." && !file.includes("/") && !file.includes("\\");
}
function validateIssue02TimingMetadata(fixtureId: string, metadata: Issue02TimingMetadata): void {
  const invalid =
    !Number.isFinite(metadata.maxFetchedToMaterializedRatio) || metadata.maxFetchedToMaterializedRatio <= 0
      ? "timing ratio"
      : !Number.isSafeInteger(metadata.maxRequestCount) || metadata.maxRequestCount <= 0
        ? "request-count"
        : !Number.isSafeInteger(metadata.maxBytesReceived) || metadata.maxBytesReceived <= 0
          ? "bytes-received"
          : metadata.bytesReceivedPathLengthHeadroom !== undefined &&
              (!Number.isSafeInteger(metadata.bytesReceivedPathLengthHeadroom) ||
                metadata.bytesReceivedPathLengthHeadroom <= 0)
            ? "path-length headroom"
            : undefined;
  if (invalid !== undefined)
    throw new Error(`Fixture ${fixtureId} has invalid Issue 02 ${invalid} metadata.`);
}

function validateNonConformanceRecord(record: FixtureEvidenceRecord): void {
  if (
    record.issues.includes("14") ||
    (record.oracle.disposition !== "generated" && record.oracle.disposition !== "not-applicable")
  ) {
    throw new Error(`Fixture ${record.id} has an incompatible non-conformance classification.`);
  }
  if (record.oracle.disposition === "not-applicable") validateSeamOnlyRecord(record);
}

/**
 * A seam-only record has no oracle: it is only evidence that a backend seam
 * still type-checks and, at most, one external-selection timing budget.
 */
function validateSeamOnlyRecord(record: FixtureEvidenceRecord): void {
  const { warnings, oracle, evidence, typecheck, timing } = record;
  const { metadata } = evidence;
  const onlyExternalSelectionTiming =
    timing.length === 0 || (timing.length === 1 && timing[0]?.plan === "externalSelection");
  const hasNoOracle =
    warnings.oracleFile === null &&
    warnings.codes.length === 0 &&
    oracle.upstreamFile === null &&
    oracle.selectedFile === null &&
    oracle.divergenceRecord === null;
  const hasNoViewMetadata =
    metadata.issueViews === undefined &&
    metadata.warningOrder === undefined &&
    metadata.expectedExports === undefined &&
    metadata.goNoGo === undefined &&
    metadata.reactAudit === undefined;
  const valid =
    hasNoOracle &&
    hasNoViewMetadata &&
    evidence.origin === "local-regression" &&
    typecheck.strategy === "not-applicable" &&
    onlyExternalSelectionTiming &&
    (metadata.packageTypechecks?.length ?? 0) > 0;
  if (!valid) throw new Error(`Fixture ${record.id} has incompatible seam-only evidence metadata.`);
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
    if (!isFixtureLocalFile(record.input.file)) {
      throw new Error(`Fixture ${record.id} has an invalid fixture-local input file.`);
    }
    if (record.input.id !== `${record.id}/${record.input.file}`) {
      throw new Error(`Fixture ${record.id} has a stale input identity.`);
    }
    const evidenceKind = record.conformance === false ? "regression" : "conformance";
    if (record.evidence.id !== `${record.id}/${evidenceKind}`) {
      throw new Error(`Fixture ${record.id} has an invalid ${evidenceKind} evidence identity.`);
    }
    if (record.issues.length === 0) {
      throw new Error(`Fixture ${record.id} is missing issue membership.`);
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
    const timingPlans = record.timing.map((entry) => entry.plan);
    if (new Set(timingPlans).size !== timingPlans.length) {
      throw new Error(`Fixture ${record.id} has duplicate timing plans.`);
    }
    for (const entry of record.timing) {
      if (!Number.isSafeInteger(entry.order) || entry.order < 0) {
        throw new Error(`Fixture ${record.id} has invalid ${entry.plan} timing order metadata.`);
      }
      if (entry.plan === "issue02") validateIssue02TimingMetadata(record.id, entry);
      if (entry.plan === "externalSelection" && entry.maxRequestCount <= 0) {
        throw new Error(`Fixture ${record.id} has invalid external-selection timing metadata.`);
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
      validateNonConformanceRecord(record);
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
