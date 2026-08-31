/* Temporary Issue 13 registries retained until the remaining catalog consumers migrate. */

/**
 * External-type policy fixtures ported from upstream `e145350` for Issue 13.
 *
 * The ordering fix resolves dependency-owned types before structural
 * expansion, so six of these reproduce the copied `output.json` byte-for-byte.
 * The reviewed fixtures keep that upstream oracle unchanged and add separate
 * TypeScript 7 evidence for compiler-view divergences rather than extraction
 * policy changes. The `family` field records the behavior each fixture proves.
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

/** Warning codes captured by the reviewed Issue 13 evidence. */
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
