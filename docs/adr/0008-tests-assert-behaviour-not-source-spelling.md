# 0008 — Tests assert behaviour, not source spelling

Date: 2026-09-02. Status: accepted.

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
