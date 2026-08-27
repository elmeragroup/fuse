/* The authoritative full-conformance manifest and Issue 13 warning contract. */

export const issue14TypeScript7Compiler = "typescript@7.0.2" as const;

/**
 * External-type policy fixtures ported from upstream `e145350` for Issue 13.
 *
 * The ordering fix resolves dependency-owned types BEFORE structural
 * expansion (upstream's own registry order), so six of these reproduce the
 * copied `output.json` byte-for-byte. The reviewed ones keep that upstream
 * oracle unchanged and add a TypeScript 7 oracle plus a machine-readable
 * reason record each: their residuals are compiler-view divergences (union
 * identity flattening, final-hop alias naming, default-symbol naming, and the
 * external React graph genus recorded since Issue 02), not extraction policy.
 * The `family` field records which part of Issue 13 a fixture is evidence for.
 */
export const issue13ExternalFixtures = [
  {
    fixture: "external-conditional-type-resolution",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "externalConditional",
  },
  {
    fixture: "external-union-type-name-preservation",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "externalUnions",
  },
  {
    fixture: "generic-props-namespace-specialization",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "namespaceSpecialization",
  },
  {
    fixture: "interface-extends-namespace-and-omit-resolution",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "heritageOmit",
  },
  {
    fixture: "module-export-forms",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "exportForms",
  },
  {
    fixture: "module-reexports-aliased-source-tracking",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "reexportTracking",
  },
  {
    fixture: "module-reexports-parts-namespace",
    file: "input.ts",
    oracle: "reviewed-ts7",
    family: "reexportNamespaces",
  },
  {
    fixture: "react-component-overload-any-callback-deduplication",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "overloadDeduplication",
  },
  {
    fixture: "react-component-render-callback-props",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "renderCallbacks",
  },
  {
    fixture: "react-component-union-variants",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "componentUnions",
  },
  {
    fixture: "react-event-handlers",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "handlers",
  },
  {
    fixture: "react-hook-arrow-function",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "hooks",
  },
  {
    fixture: "react-hook-function-declaration",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "hooks",
  },
  {
    fixture: "react-hook-function-expression",
    file: "input.ts",
    oracle: "immutable-upstream",
    family: "hooks",
  },
  {
    fixture: "react-refs",
    file: "input.tsx",
    oracle: "reviewed-ts7",
    family: "refs",
  },
] as const;

export type Issue13Fixture = (typeof issue13ExternalFixtures)[number];

/**
 * Authoritative Issue 14 manifest.  Unlike the issue-specific evidence arrays
 * above, this list is the complete pinned upstream fixture set and is the only
 * collection used for full-conformance totals.  Keep it sorted by fixture name
 * and give every name exactly one oracle disposition so fixtures cannot be
 * counted twice through overlapping issue arrays.
 */
export const issue14FixtureManifest = [
  { fixture: "alias-with-explicit-type-args", file: "input.ts", disposition: "unchanged" },
  { fixture: "base-ui-component", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "class-members-visibility-and-signatures", file: "input.ts", disposition: "unchanged" },
  { fixture: "class-method-generic-signatures", file: "input.ts", disposition: "unchanged" },
  { fixture: "class-method-overload-signatures", file: "input.ts", disposition: "unchanged" },
  { fixture: "class-private-members-type-alias-filtering", file: "input.ts", disposition: "unchanged" },
  { fixture: "distributive-conditional-intersection-expansion", file: "input.ts", disposition: "unchanged" },
  { fixture: "enum-members-values-and-docs", file: "input.ts", disposition: "unchanged" },
  { fixture: "external-conditional-type-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "external-mapped-type-name-preservation", file: "input.ts", disposition: "unchanged" },
  { fixture: "external-union-type-name-preservation", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "function-callable-intersection-extra-properties", file: "input.tsx", disposition: "unchanged" },
  { fixture: "function-declaration-expression-arrow", file: "input.ts", disposition: "unchanged" },
  { fixture: "function-parameters-optional-and-defaults", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-argument-alias-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-alias-constraint-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-alias-renamed-typeparams", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-alias-vs-inline-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-constraint-property-keys", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-default-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-index-signature-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-callback-nested-shadow-deduplication", file: "input.ts", disposition: "unchanged" },
  {
    fixture: "generic-callback-typeparam-vs-typename-collision",
    file: "input.ts",
    disposition: "reviewed-ts7",
  },
  { fixture: "generic-constraint-tostring-collapse", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-default-argument-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-function-and-interface-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "generic-props-namespace-specialization", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "interface-extends-basic-resolution", file: "input.ts", disposition: "reviewed-ts7" },
  {
    fixture: "interface-extends-namespace-and-omit-resolution",
    file: "input.ts",
    disposition: "reviewed-ts7",
  },
  { fixture: "interface-merged-default-and-aliased-exports", file: "input.ts", disposition: "unchanged" },
  { fixture: "interface-method-generic-signatures", file: "input.ts", disposition: "unchanged" },
  { fixture: "intersection-order-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "jsdoc-comments-and-overloads", file: "input.tsx", disposition: "unchanged" },
  { fixture: "jsdoc-extra-tags-preservation", file: "input.ts", disposition: "unchanged" },
  { fixture: "large-nested-union-any-order", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-alias-finite-key", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-alias-nested-mapped-value", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-alias-nested-value", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-alias-two-hop", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-tuple-rest-synthetic-key", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-type-builtin-utility-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-type-optional-aliased-unknown", file: "input.ts", disposition: "unchanged" },
  { fixture: "mapped-type-prettify-intersection-resolution", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "merged-interface-signature-typeparams", file: "input.ts", disposition: "unchanged" },
  { fixture: "module-dts-declarations-and-reexports", file: "input.d.ts", disposition: "unchanged" },
  { fixture: "module-export-forms", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "module-imports-only", file: "input.ts", disposition: "unchanged" },
  { fixture: "module-reexport-imported-class-type", file: "input.ts", disposition: "unchanged" },
  { fixture: "module-reexports-aliased-source-tracking", file: "input.ts", disposition: "unchanged" },
  { fixture: "module-reexports-basic", file: "input.ts", disposition: "unchanged" },
  { fixture: "module-reexports-parts-namespace", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "namespace-callback-alias-resolution", file: "input.tsx", disposition: "unchanged" },
  { fixture: "namespace-export-resolution", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "namespace-nested-alias-resolution", file: "input.tsx", disposition: "unchanged" },
  { fixture: "nested-function-union-any-deduplication", file: "input.ts", disposition: "unchanged" },
  { fixture: "object-property-count-limit-scope", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-component-function-declaration", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-component-function-overloads", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-component-function-variable", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-component-generic-function-overloads", file: "input.ts", disposition: "unchanged" },
  {
    fixture: "react-component-overload-any-callback-deduplication",
    file: "input.tsx",
    disposition: "reviewed-ts7",
  },
  { fixture: "react-component-render-callback-props", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "react-component-return-types", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-component-union-variants", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "react-event-handlers", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-forward-ref-component", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-forward-ref-union-props", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "react-hook-arrow-function", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-hook-function-declaration", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-hook-function-expression", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-hook-multiple-parameters", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-hook-overload-signatures", file: "input.ts", disposition: "unchanged" },
  { fixture: "react-memo-component", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-mui-overridable-component", file: "input.d.ts", disposition: "reviewed-ts7" },
  { fixture: "react-props-callback-types", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-props-literal-types", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-props-optional-types", file: "input.tsx", disposition: "unchanged" },
  { fixture: "react-refs", file: "input.tsx", disposition: "reviewed-ts7" },
  { fixture: "readonly-array-mapped-alias-wrapped", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-any-value", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-as-clause", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-key-no-default", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-literal-key", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-non-optional", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-number-key", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-plus-optional", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-strip-optional", file: "input.ts", disposition: "unchanged" },
  {
    fixture: "readonly-array-mapped-type-template-literal-constraint",
    file: "input.ts",
    disposition: "unchanged",
  },
  { fixture: "readonly-array-mapped-type-union-default", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-value-no-default", file: "input.ts", disposition: "unchanged" },
  { fixture: "readonly-array-mapped-type-with-concrete-props", file: "input.ts", disposition: "unchanged" },
  { fixture: "symbol-double-underscore-name-preservation", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "type-alias-basic-resolution", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "type-alias-export-preservation", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-alias-generic-argument-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-alias-union-member-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-array-syntax-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-conditional-return-and-props", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-cycle-recursive-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-extract-utility-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-index-signature-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-indexed-access-union-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-intersection-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-intrinsic-props-resolution", file: "input.tsx", disposition: "unchanged" },
  { fixture: "type-literal-union-resolution", file: "input.ts", disposition: "reviewed-ts7" },
  { fixture: "type-never-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-object-shape-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-record-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-reference-vs-inline-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-tuple-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "type-union-object-props-resolution", file: "input.tsx", disposition: "unchanged" },
  { fixture: "type-utility-types-resolution", file: "input.ts", disposition: "unchanged" },
  { fixture: "union-any-wildcard-order", file: "input.ts", disposition: "unchanged" },
  { fixture: "union-never-reduction", file: "input.ts", disposition: "unchanged" },
  { fixture: "unresolved-indexed-access-fallback", file: "input.ts", disposition: "unchanged" },
] as const;

export type Issue14Fixture = (typeof issue14FixtureManifest)[number];

/**
 * Warnings the reviewed Issue 13 fixtures are expected to emit on TypeScript 7.
 *
 * Each entry is part of the reviewed divergence record: the checker exposes a
 * shape TypeScript 6 never resolved (a flattened union member whose dependency
 * members are policy-hidden), and the structured fallback contract reports it
 * instead of dropping it silently. Keyed by fixture name; every reviewed
 * fixture appears, so an unlisted warning fails the comparison.
 */
export const issue13ExpectedWarnings = {
  "external-conditional-type-resolution": [],
  "external-union-type-name-preservation": ["unsupported-type-fallback"],
  "module-export-forms": [],
  "generic-props-namespace-specialization": [],
  "interface-extends-namespace-and-omit-resolution": [],
  "module-reexports-aliased-source-tracking": [],
  "module-reexports-parts-namespace": [],
  "react-component-overload-any-callback-deduplication": ["unsupported-type-fallback"],
  "react-component-render-callback-props": [],
  "react-component-union-variants": ["uncertain-component-recognition"],
  "react-event-handlers": [],
  "react-hook-arrow-function": [],
  "react-hook-function-declaration": [],
  "react-hook-function-expression": [],
  "react-refs": [],
} as const satisfies Record<string, readonly string[]>;
