# 0008 — Tests assert behaviour, not source spelling

Date: 2026-09-02. Status: accepted; amended 2026-09-04 — one-owner spellings are lint `allow` lists, not source-line greps; amended 2026-09-18 — repo-wide policies with no upstream lint rule yet live as `pnpm test:repo-policy` walkers.

## Context

Eighty-two co-located `*.test.ts` files under `packages/ui/src` read their component's source with `readFileSync` and asserted its spelling: import specifiers, exact JSX lines, the presence of a `"use client"` directive, the absence of a function name — roughly a thousand `expect(source…)` calls. Those assertions pass when behaviour is wrong (a class string is present but never rendered) and fail when behaviour is right but spelled differently (an import is renamed, a recipe is extracted). They also block every de-duplication the shared-spine work needs: moving a class constant into a shared module breaks forty tests that never observed the component.

Most of what they asserted is already enforced mechanically. `facade-reexport-grammar`, `no-rac-outside-quarantine`, `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`, `no-tailwind-dark-variant` and `restrict-process-env` are lint rules over the same source; the exports map, packed-package check and size-limit gates cover the published surface. What was left was a small residue of genuine source-level invariants with no mechanical owner.

## Decision

A co-located `*.test.ts` file asserts **recipe class output and pure functions only**. It does not read component source.

The residue moves to **one table-driven suite**, `packages/ui/src/source-contracts.test.ts`, keyed by component. A contract earns a place there only if no lint rule and no gate covers it, and each `describe` carries a `Why not a lint rule` comment saying why — typically because the invariant is a spec table (the RSC classification), a count or a two-file coupling (`z-50` declared once and restated nowhere), a data relationship inside a recipe (the derived responsive orientation face), a licensed verbatim lift (the Twemoji path data), or a one-off "do not reintroduce" ban whose allowlist would be the banned identifiers themselves.

Component behaviour is proven in the browser project by role and label queries; class output is proven once in the unit project by calling the recipe.

## Alternatives rejected

- **Keep the source-text tests and grandfather them.** They are the reason the overlay and field consolidation cannot move a string; leaving them freezes the spelling of code that is about to move.
- **Write a lint rule for each remaining contract.** The residue is not a grammar. A rule for "this file is a client component" would restate the performance chapter's table in JavaScript, and a rule banning `z-50` would need an exemption for exactly the module that owns it while still not asserting the "exactly once" half.
- **Delete the residue too.** The invariants are load-bearing and each has a cited spec section; unguarded, they regress silently.

## Consequences

- `readFileSync` in `packages/ui/src/**/*.test.ts*` is limited to the contracts suite, the generator/roster tests, and the gate suites that read `package.json`, the workspace catalog, notice files or the barrel — never a component module.
- Renaming an import, extracting a helper or moving a class constant no longer touches the component's test file.
- A regression that only a spelling assertion caught now fails in the contracts suite instead, with the reason it lives there written next to it.
- Adding a contract is a reviewed act: it must state why it is not a lint rule, which keeps the suite from re-growing into per-component source greps.

## Amendment 2026-09-04 — lint `allow` lists for one-owner spellings

Phase B added "only this file may spell or import that" contracts as exact-source greps in `source-contracts.test.ts`. Those fail when a formatter wraps a line or a constant is renamed, with behaviour intact. One-owner spellings are now oxlint rules with a per-file `allow` for the owner:

- `no-restricted-imports` forbids a value import of `LocalizedStringDictionary` outside `intl/create-string-dictionary.ts` (type-only imports stay legal).
- `elmera/restrict-focus-ring-call` forbids `focusRing({…})` outside `styles/utils.ts`, with the documented `react-aria/link` exemption.
- `elmera/no-field-part-jsx` forbids `<Field.Label|Description|Error|Root|Set|Legend` in the labeled composites FieldFrame already owns.

The contracts suite walks the source tree once per run and keeps only what lint cannot see: file absence, RSC classification, and `ownedBy` exactly-one-owner counts for class strings. Exact `export const …` source-line assertions are value assertions against the recipe, or gone.

## Amendment 2026-09-18 — repo-wide policies without an upstream lint rule yet

Repo-wide policies that have no upstream lint rule yet live as `test/*.test.mjs` walkers under `pnpm test:repo-policy`: `module-names`, `lint-disable-reasons`, `tsconfig-types-augmentation` and `release-age-exclusions`. They are reviewed contracts in the sense above — each exists because no rule upstream owns it. `lint-disable-reasons` retires when `@elmeragroup/internal` anti-slop ships `require-disable-reason`; the `module-names` allowlist entry for `packages/ui/src/styles/utils.ts` retires when the `@elmeragroup/internal` focus-ring rules take the owner path as a rule option. The other two assert committed-configuration couplings that no upstream rule owns: every shared-config extender keeps the csstype augmentation in `compilerOptions.types`, and every `minimumReleaseAgeExclude` entry is catalog-paired or carries an unexpired `Temporary: …` comment.
