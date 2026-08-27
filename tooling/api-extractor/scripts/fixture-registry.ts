/* Shared fixture registries for the issue-specific upstream conformance suites. */

export const issue02TimingFixtures = [
  {
    fixture: "alias-with-explicit-type-args",
    file: "input.ts",
    oracleFile: "output.json",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "mapped-alias-two-hop",
    file: "input.ts",
    oracleFile: "output.json",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "module-dts-declarations-and-reexports",
    file: "input.d.ts",
    oracleFile: "output.json",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "base-ui-component",
    file: "input.tsx",
    oracleFile: "output.tsgo.json",
    warningOracle: "warnings.tsgo.json",
  },
] as const;

export const issue02SupplementalFixtures = [
  {
    fixture: "module-dts-type-star",
    file: "input.d.ts",
    // Issue 10 orders explicit re-exports before star-contributed names
    // (TypeScript 6 symbol-table semantics required by the upstream oracles);
    // these pins recorded raw TypeScript 7 enumeration order and were reviewed
    // to the same rule.
    expectedExports: ["RuntimeValue", "Value", "OtherValue"],
  },
  {
    fixture: "module-resolution-alias",
    file: "input.d.ts",
    expectedExports: ["RuntimeValue", "AliasValue"],
  },
  {
    fixture: "module-resolution-package",
    file: "input.d.ts",
    expectedExports: ["RuntimeValue", "PackageValue"],
  },
] as const;

export const issue02GoNoGoFixtures = [
  { fixture: "alias-with-explicit-type-args", oracle: "immutable-upstream", status: "pass" },
  { fixture: "mapped-alias-two-hop", oracle: "immutable-upstream", status: "pass" },
  {
    fixture: "module-dts-declarations-and-reexports",
    oracle: "immutable-upstream",
    status: "pass",
    notes: [
      "type-only declaration-file re-exports are filtered",
      "package-owned module-resolution operation is implemented",
      "module import metadata is preserved",
    ],
  },
  {
    fixture: "module-dts-type-star",
    oracle: "public-seam-regression",
    status: "pass",
    notes: [
      "export type * from ./source.js resolves to source.d.ts",
      "type exports are retained and runtime exports are filtered from the star",
    ],
  },
  {
    fixture: "module-resolution-alias",
    oracle: "public-seam-regression",
    status: "pass",
    notes: [
      "non-relative path mapping resolves through the compiler symbol graph",
      "explicit runtime re-export remains visible",
    ],
  },
  {
    fixture: "module-resolution-package",
    oracle: "public-seam-regression",
    status: "pass",
    notes: [
      "package exports resolve through the compiler symbol graph",
      "explicit runtime re-export remains visible",
    ],
  },
  {
    fixture: "base-ui-component",
    oracle: "reviewed-ts7-exact",
    status: "pass",
    divergenceRecord: "test/fixtures/base-ui-component/ts7-oracle.json",
    warningOracle: "test/fixtures/base-ui-component/warnings.tsgo.json",
  },
] as const;

export type Issue02TimingFixture = (typeof issue02TimingFixtures)[number];
export type Issue02SupplementalFixture = (typeof issue02SupplementalFixtures)[number];
export type Issue02GoNoGoFixture = (typeof issue02GoNoGoFixtures)[number];
/**
 * Union and intersection fixtures ported from upstream `e145350`.
 *
 * `immutable-upstream` fixtures must reproduce the copied `output.json`
 * byte-for-byte. The one `reviewed-ts7` fixture keeps that upstream oracle
 * unchanged and adds a separate TypeScript 7 oracle plus a machine-readable
 * reason record, so the divergence stays inspectable instead of regenerated.
 */
export const issue04CanonicalizationFixtures = [
  {
    fixture: "distributive-conditional-intersection-expansion",
    file: "input.ts",
    oracle: "immutable-upstream",
  },
  { fixture: "intersection-order-deduplication", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "large-nested-union-any-order", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "nested-function-union-any-deduplication", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "type-alias-union-member-resolution", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "type-indexed-access-union-resolution", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "type-intersection-resolution", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "type-never-resolution", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "type-union-object-props-resolution", file: "input.tsx", oracle: "immutable-upstream" },
  { fixture: "union-any-wildcard-order", file: "input.ts", oracle: "immutable-upstream" },
  { fixture: "union-never-reduction", file: "input.ts", oracle: "immutable-upstream" },
  {
    fixture: "mapped-type-prettify-intersection-resolution",
    file: "input.ts",
    oracle: "reviewed-ts7",
  },
] as const;

export type Issue04Fixture = (typeof issue04CanonicalizationFixtures)[number];

/**
 * Array, tuple, record, mapped-key, and index-signature fixtures ported from
 * upstream `e145350`.
 *
 * Every entry reproduces the copied `output.json` byte-for-byte, so this family
 * carries no reviewed TypeScript 7 divergence of its own. The `container` field
 * records which part of the family a fixture is evidence for, so a container
 * shape cannot silently lose its only fixture.
 */
export const issue05ContainerFixtures = [
  { fixture: "type-array-syntax-resolution", file: "input.ts", container: "array" },
  { fixture: "type-tuple-resolution", file: "input.ts", container: "tuple" },
  { fixture: "mapped-tuple-rest-synthetic-key", file: "input.ts", container: "tuple" },
  { fixture: "type-record-resolution", file: "input.ts", container: "record" },
  { fixture: "type-utility-types-resolution", file: "input.ts", container: "record" },
  { fixture: "type-index-signature-resolution", file: "input.ts", container: "indexSignature" },
  {
    fixture: "generic-callback-index-signature-deduplication",
    file: "input.ts",
    container: "indexSignature",
  },
  { fixture: "mapped-alias-finite-key", file: "input.ts", container: "mappedKey" },
  { fixture: "mapped-alias-nested-value", file: "input.ts", container: "mappedKey" },
  { fixture: "mapped-alias-nested-mapped-value", file: "input.ts", container: "mappedKey" },
  { fixture: "readonly-array-mapped-alias-wrapped", file: "input.ts", container: "readonlyArray" },
  { fixture: "readonly-array-mapped-type", file: "input.ts", container: "readonlyArray" },
  { fixture: "readonly-array-mapped-type-any-value", file: "input.ts", container: "readonlyArray" },
  { fixture: "readonly-array-mapped-type-as-clause", file: "input.ts", container: "readonlyArray" },
  {
    fixture: "readonly-array-mapped-type-key-no-default",
    file: "input.ts",
    container: "readonlyArray",
  },
  { fixture: "readonly-array-mapped-type-literal-key", file: "input.ts", container: "readonlyArray" },
  {
    fixture: "readonly-array-mapped-type-non-optional",
    file: "input.ts",
    container: "readonlyArray",
  },
  { fixture: "readonly-array-mapped-type-number-key", file: "input.ts", container: "readonlyArray" },
  {
    fixture: "readonly-array-mapped-type-plus-optional",
    file: "input.ts",
    container: "readonlyArray",
  },
  {
    fixture: "readonly-array-mapped-type-strip-optional",
    file: "input.ts",
    container: "readonlyArray",
  },
  {
    fixture: "readonly-array-mapped-type-template-literal-constraint",
    file: "input.ts",
    container: "readonlyArray",
  },
  {
    fixture: "readonly-array-mapped-type-union-default",
    file: "input.ts",
    container: "readonlyArray",
  },
  {
    fixture: "readonly-array-mapped-type-value-no-default",
    file: "input.ts",
    container: "readonlyArray",
  },
  {
    fixture: "readonly-array-mapped-type-with-concrete-props",
    file: "input.ts",
    container: "readonlyArray",
  },
  { fixture: "type-cycle-recursive-resolution", file: "input.ts", container: "recursive" },
] as const;

export type Issue05Fixture = (typeof issue05ContainerFixtures)[number];

/**
 * Class, callable, method, and overload fixtures ported from upstream
 * `e145350`.
 *
 * Every entry reproduces the copied `output.json` byte-for-byte, so this
 * family also carries no reviewed TypeScript 7 divergence of its own. The
 * `family` field records which part of Issue 06 a fixture is evidence for, so
 * a behaviour cannot silently lose its only ported fixture.
 */
export const issue06CallableFixtures = [
  {
    fixture: "class-members-visibility-and-signatures",
    file: "input.ts",
    family: "class",
  },
  { fixture: "class-method-generic-signatures", file: "input.ts", family: "method" },
  { fixture: "class-method-overload-signatures", file: "input.ts", family: "method" },
  {
    fixture: "class-private-members-type-alias-filtering",
    file: "input.ts",
    family: "class",
  },
  {
    fixture: "function-callable-intersection-extra-properties",
    file: "input.tsx",
    family: "callable",
  },
  { fixture: "function-declaration-expression-arrow", file: "input.ts", family: "callable" },
  { fixture: "jsdoc-comments-and-overloads", file: "input.tsx", family: "overload" },
  { fixture: "merged-interface-signature-typeparams", file: "input.ts", family: "overload" },
  { fixture: "module-reexport-imported-class-type", file: "input.ts", family: "class" },
] as const;

export type Issue06Fixture = (typeof issue06CallableFixtures)[number];

/**
 * Generic, alias, callback, constraint, default, and substitution fixtures
 * ported from upstream `e145350`.
 *
 * `immutable-upstream` fixtures must reproduce the copied `output.json`
 * byte-for-byte. The one `reviewed-ts7` fixture keeps that upstream oracle
 * unchanged and adds a separate TypeScript 7 oracle plus a machine-readable
 * reason record, so the divergence stays inspectable instead of regenerated.
 * The `family` field records which part of Issue 07 a fixture is evidence
 * for, so a behaviour cannot silently lose its only ported fixture.
 */
export const issue07GenericFixtures = [
  {
    fixture: "generic-argument-alias-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "alias",
  },
  {
    fixture: "generic-callback-alias-constraint-deduplication",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "deduplication",
  },
  {
    fixture: "generic-callback-alias-renamed-typeparams",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "renaming",
  },
  {
    fixture: "generic-callback-alias-vs-inline-deduplication",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "deduplication",
  },
  {
    fixture: "generic-callback-constraint-property-keys",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "constraint",
  },
  {
    fixture: "generic-callback-default-deduplication",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "default",
  },
  {
    fixture: "generic-callback-nested-shadow-deduplication",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "shadowing",
  },
  {
    fixture: "generic-constraint-tostring-collapse",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "constraint",
  },
  {
    fixture: "generic-default-argument-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "default",
  },
  {
    fixture: "generic-function-and-interface-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "substitution",
  },
  {
    fixture: "interface-method-generic-signatures",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "method",
  },
  {
    fixture: "type-alias-generic-argument-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "alias",
  },
  {
    fixture: "type-alias-basic-resolution",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "alias",
  },
  {
    fixture: "type-reference-vs-inline-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "alias",
  },
] as const;

export type Issue07Fixture = (typeof issue07GenericFixtures)[number];

/**
 * Mapped-type resolution fixtures ported from upstream `e145350`.
 *
 * Every entry reproduces the copied `output.json` byte-for-byte, so this
 * family also carries no reviewed TypeScript 7 divergence of its own. The
 * `family` field records which part of Issue 08 a fixture is evidence for, so
 * a behaviour cannot silently lose its only ported fixture.
 */
export const issue08MappedFixtures = [
  {
    fixture: "external-mapped-type-name-preservation",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "external",
  },
  {
    fixture: "mapped-type-builtin-utility-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "modifiers",
  },
  {
    fixture: "mapped-type-optional-aliased-unknown",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "openDomain",
  },
] as const;

export type Issue08Fixture = (typeof issue08MappedFixtures)[number];

/**
 * Type-operator, conditional, and indexed-access fixtures ported from
 * upstream `e145350` for Issue 09.
 *
 * `immutable-upstream` fixtures must reproduce the copied `output.json`
 * byte-for-byte. The one `reviewed-ts7` fixture keeps that upstream oracle
 * unchanged and adds a separate TypeScript 7 oracle plus a machine-readable
 * reason record: TypeScript 7 orders the reduced keyof key set by sorted key
 * where TypeScript 6 preserved the operand's declaration order.
 */
export const issue09TypeOperatorFixtures = [
  {
    fixture: "type-alias-export-preservation",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "alias",
  },
  {
    fixture: "type-conditional-return-and-props",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "conditional",
  },
  {
    fixture: "type-extract-utility-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "conditional",
  },
  {
    fixture: "type-literal-union-resolution",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "keyof",
  },
  {
    fixture: "unresolved-indexed-access-fallback",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "indexedAccess",
  },
] as const;

export type Issue09Fixture = (typeof issue09TypeOperatorFixtures)[number];

/**
 * Module-surface, namespace, and re-export fixtures ported from upstream
 * `e145350` for Issue 10.
 *
 * `immutable-upstream` fixtures must reproduce the copied `output.json`
 * byte-for-byte. `namespace-export-resolution` keeps that upstream oracle
 * unchanged and adds a reviewed `output.tsgo.json` plus a machine-readable
 * reason record: TypeScript 7 hands the resolver a flattened union view where
 * TypeScript 6 preserved the pre-flattening composition, so optional enum
 * properties arrive as expanded enum literals beside `undefined` and two-hop
 * alias unions report the final hop instead of the intermediate name.
 */
export const issue10ModuleSurfaceFixtures = [
  {
    fixture: "interface-merged-default-and-aliased-exports",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "mergedDeclarations",
  },
  {
    fixture: "module-reexports-basic",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "reexports",
  },
  {
    fixture: "namespace-callback-alias-resolution",
    file: "input.tsx",
    oracle: "immutable-upstream",
    family: "namespaces",
  },
  {
    fixture: "namespace-nested-alias-resolution",
    file: "input.tsx",
    oracle: "immutable-upstream",
    family: "namespaces",
  },
  {
    fixture: "namespace-export-resolution",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "namespaces",
  },
] as const;

export type Issue10Fixture = (typeof issue10ModuleSurfaceFixtures)[number];

/**
 * React function-component, component-variable, props, and hook fixtures
 * ported from upstream `e145350` for Issue 11.
 *
 * Every entry reproduces the copied `output.json` byte-for-byte, so this
 * family carries no reviewed TS7 divergence of its own either. The `family`
 * field records which part of Issue 11 a fixture is evidence for, so a
 * recognition behavior cannot silently lose its only ported fixture.
 */
export const issue11ReactFixtures = [
  {
    fixture: "react-component-function-declaration",
    file: "input.tsx",
    family: "declaration",
  },
  { fixture: "react-component-function-variable", file: "input.tsx", family: "variable" },
  { fixture: "react-component-return-types", file: "input.tsx", family: "returnTypes" },
  {
    fixture: "react-component-function-overloads",
    file: "input.ts",
    family: "componentOverloads",
  },
  {
    fixture: "react-component-generic-function-overloads",
    file: "input.ts",
    family: "componentOverloads",
  },
  { fixture: "react-props-callback-types", file: "input.tsx", family: "props" },
  { fixture: "react-props-literal-types", file: "input.tsx", family: "props" },
  { fixture: "react-props-optional-types", file: "input.tsx", family: "props" },
  { fixture: "react-hook-multiple-parameters", file: "input.ts", family: "hooks" },
  { fixture: "react-hook-overload-signatures", file: "input.ts", family: "hooks" },
] as const;

export type Issue11Fixture = (typeof issue11ReactFixtures)[number];

/**
 * Wrapped, compound, and polymorphic React fixtures ported from upstream
 * `e145350` for Issue 12. The upstream inputs and `output.json` files remain
 * immutable. Two fixtures reproduce those oracles exactly; the forward-ref
 * union and MUI overridable surfaces keep a separate TypeScript 7 oracle and
 * reason record because checker member enumeration differs from TypeScript 6.
 */
export const issue12ReactFixtures = [
  {
    fixture: "react-forward-ref-component",
    file: "input.tsx",
    oracle: "immutable-upstream",
    family: "forwardRef",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "react-forward-ref-union-props",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "forwardRefUnion",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "react-memo-component",
    file: "input.tsx",
    oracle: "immutable-upstream",
    family: "memo",
    warningOracle: "warnings.tsgo.json",
  },
  {
    fixture: "react-mui-overridable-component",
    file: "input.d.ts",
    oracle: "reviewed-ts7",
    family: "overridable",
    warningOracle: "warnings.tsgo.json",
  },
] as const;

export type Issue12Fixture = (typeof issue12ReactFixtures)[number];

/** Warning codes captured with each Issue 12 oracle. */
export const issue12ExpectedWarnings = {
  "react-forward-ref-component": [],
  "react-forward-ref-union-props": [],
  "react-memo-component": [],
  "react-mui-overridable-component": [
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
    "omitted-index-signature",
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * Complete React-family audit for Issue 12: all 22 upstream React fixtures
 * plus the Base UI compound boundary fixture. Keeping ownership and oracle
 * disposition in one report prevents an already-covered Issue 11/13 fixture
 * from being silently omitted from the Issue 12 gate.
 */
export const issue12ReactFixtureAudit = [
  {
    fixture: "react-component-function-declaration",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-component-function-variable",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-component-return-types",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-component-function-overloads",
    file: "input.ts",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-component-generic-function-overloads",
    file: "input.ts",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-component-overload-any-callback-deduplication",
    file: "input.tsx",
    owner: "issue13",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "react-component-render-callback-props",
    file: "input.tsx",
    owner: "issue13",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "react-component-union-variants",
    file: "input.tsx",
    owner: "issue13",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "react-event-handlers",
    file: "input.ts",
    owner: "issue13",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-hook-arrow-function",
    file: "input.ts",
    owner: "issue13",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-hook-function-declaration",
    file: "input.ts",
    owner: "issue13",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-hook-function-expression",
    file: "input.ts",
    owner: "issue13",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-hook-multiple-parameters",
    file: "input.ts",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-hook-overload-signatures",
    file: "input.ts",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-props-callback-types",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-props-literal-types",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-props-optional-types",
    file: "input.tsx",
    owner: "issue11",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-refs",
    file: "input.tsx",
    owner: "issue13",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "react-forward-ref-component",
    file: "input.tsx",
    owner: "issue12",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-forward-ref-union-props",
    file: "input.tsx",
    owner: "issue12",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "react-memo-component",
    file: "input.tsx",
    owner: "issue12",
    oracle: "immutable-upstream",
  },
  {
    fixture: "react-mui-overridable-component",
    file: "input.d.ts",
    owner: "issue12",
    oracle: "reviewed-ts7",
  },
  {
    fixture: "base-ui-component",
    file: "input.tsx",
    owner: "issue12",
    oracle: "reviewed-ts7",
  },
] as const;

export type Issue12ReactFixtureAuditEntry = (typeof issue12ReactFixtureAudit)[number];
