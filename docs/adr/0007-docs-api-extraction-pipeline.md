# 0007 — Docs API extraction pipeline

Date: 2026-09-02. Status: accepted. Records the production cutover landed in `9a0a433`.

## Context

Docs API tables are generated at docs build from TypeScript types and JSDoc ([docs-site](../spec/docs-site.md) §8). The original plan (wayfinder ticket 012) extracted demos and API surface through AST walks and generated module maps. Ruling 74b (2026-08-24) replaced that with hand-authored `page.mdx`, demos imported as ordinary ESM, and a committed per-component `api.json` produced by an in-repo TypeScript-checker walk — explicitly without `@mui/internal-docs-infra`.

The Effect-native extractor (`tooling/api-extractor`, `@elmeragroup/api-extractor`) was added as a workspace package to describe dependency types the checker walk treated as opaque forwarded props. Production generation was then routed through it for selected Base UI props in the same squash that first mentioned the extractor in the docs-site chapter, while that chapter still said extraction "stays the in-repo TS-checker generator". This ADR is the decision record; the chapter describes one pipeline.

## Decision

Production docs API generation is a **hybrid**:

1. **Library-owned rows** come from the in-repo TypeScript-checker walk (`apps/docs/scripts/lib/api.ts`). It remains authoritative for part discovery, prop names, printed types, requiredness, destructuring defaults, JSDoc, and RSC status.
2. **Selected dependency rows** come from the Effect extractor with `includeExternalTypes: ["@base-ui/react"]`. Only props whose declaration provenance belongs to that package, that carry JSDoc, and that the checker walk already counted as forwarded, are merged into a separate **Base UI primitive props** group. The extractor's printed types are discarded; the checker's types win. A default declared by the library wrapper takes precedence over the dependency's JSDoc default.

The two sides are compared on every docs `test:shadow` run. Reviewed differences live in `apps/docs/test/api-shadow.snapshot.json`. Shadow is validation only; it does not write artifacts.

This hybrid superseded the earlier AST-extraction plan (ruling 74b, 2026-08-24: no demo AST extract, no MUI docs-infra). Collapsing it to a single extractor is out of scope here.

### Extractor decisions that shipped with the cutover

- **Type-operator output mode removed.** Public `ExtractorOptions` has no syntax-only / resolved-only switch. A `keyof` node always carries both the authored operand and the checker's resolved key set (`resolutionKind`: `exact` | `baseConstraint` | `fallback`).
- **Warning union 3→8.** Recoverable losses are the eight structured codes listed in the package README (`unsupported-type-fallback`, `missing-enum-declaration`, `missing-default-export-symbol`, `omitted-index-signature`, `unrepresented-construct-signatures`, `omitted-callable-members`, `unresolved-re-export`, `uncertain-component-recognition`). Consumers branch on `code`, not `message` text.
- **Timing evidence is boundary-only.** Live timing is captured for the four sequential public-seam boundary fixtures (Issue 02 / Issue 14 / external-selection plans). `roundTripMs` is an observation; stop conditions are request count and bytes received against catalog ceilings. The public `ProjectExtractor` layer does not accept a timing switch.
- **`dist/` build.** `scripts/build.ts` emits `dist/` via `tsc` as a local check (`pnpm run build` / `check:all`). The package stays private; workspace consumers import `src/` through `"exports"`. There is no published distribution.
- **Lint overrides.** `tooling.md` §4 permits oxlintrc overrides only for the two oxlint plugin packages. The extractor does not add a file-glob override. Demonstrated incompatibilities (unstable TypeScript 7 AST typing, optional model fields that preserve upstream JSON) use next-to-the-code `oxlint-disable` headers with a reason; they are not a path-wide exemption. _(Reaffirmed 2026-09-03 — see “Exceptions at their use sites” below.)_

Normative pipeline: [docs-site](../spec/docs-site.md) §8. Package inventory: [tooling](../spec/tooling.md) §1.

### One extraction seam (2026-09-03)

The hybrid above shipped as three orchestrations that agreed by copy: the generation
pass, the `api.json` regenerator behind the drift check, and the shadow run each walked
a component's entry themselves, and the generator kept its own copy of the demo and
route validation that `docs-inspection` already owned. Each generation therefore walked
every component four times and printed the type of every forwarded React and DOM prop
only to discard almost all of them.

`apps/docs/scripts/lib/api` now exposes `extractLibraryApi`, the one walk, returning the
published parts beside the facts behind them (implementation source, RSC status,
destructuring defaults, forwarded summary, accepted prop symbols). The generation pass and the
`api.json` regenerator call it over the whole inventory; the shadow calls the
per-component `extractComponentApi` it maps over, so that a diagnostic stays attributable
to one component. The Effect side borrows its sources and forwarded counts from the same
model rather than recomputing them, and a prop's type is printed when a consumer asks for
that prop. `docs-inspection` is the single owner of demo and route validation, and the
generator imports it. The shadow comparison runs one `compareNamedCollection` over two
views (API parts, provenance evidence) instead of two copies of the same algorithm.

Nothing about the two-source decision changes: library rows still come from the checker
walk, selected `@base-ui/react` rows still come from the extractor, and the committed
`api.json` bytes are unchanged by the consolidation. One measured behaviour did change:
the adapter merges a prop's declarations as extractor nodes, so a rendered type is no
longer split on `|` — 115 shadow entries had union members hoisted out of a nested
`React.ReactElement<…>` type argument and now render the type the extractor produced.
The snapshot was refreshed with `pnpm run shadow:update`; every reviewed key and its
reason survived unchanged.

### Exceptions at their use sites (2026-09-03)

The bullet above was honoured in the letter and broken in the spirit: instead of a path-wide
override the package carried 60 file-wide `/* oxlint-disable … */` directives across 37 files.
A whole-file exemption is broader than the override it avoids, and it hides which line needed
it — 26 of those rule-instances, including every `typescript/no-unsafe-*` header in
`backend/ts7/module.ts`, `module-ordering.ts` and `reexport-chain.ts`, had stopped exempting
anything at all.

The decision itself stands and is now implemented: `.oxlintrc.json` grants this package no
override. Every exception is an `oxlint-disable-next-line` on the line it governs, naming one
rule and why that rule cannot hold there (148 of them, 108 for the model's absent-key JSON
encoding), or the `SAFETY:` comment the rule was asking for rather than a disable (39).

A scoped override for `src/backend/ts7/**` was drafted first, following spec 09's
implementation decision, and rejected on the evidence. The `typescript/no-unsafe-*` family that
decision named is no longer violated anywhere in that directory, so exempting it would exempt
nothing; and the two `anti-slop` rules the raw-compiler seam genuinely trips are tripped on ten
lines in four of that directory's twenty-three files, which ten next-line disables cover exactly.
An override would have bought a forward exemption for nineteen files with no demonstrated need,
which is the shape wayfinder ticket 028 forbade.

`test/extractor-lint-exceptions.test.mjs` in the root repo-policy project holds all three
properties: no file-wide header, no reasonless next-line disable, no override matching the
package path. Normative text: [tooling](../spec/tooling.md) §4.

## Alternatives rejected

- **Keep the checker walk as the sole production path; extractor shadow-only.** Rejected because committed `api.json` artifacts already carry Base UI dependency props that HTML and markdown consumers render.
- **Replace the checker walk with the Effect extractor for library rows.** Rejected for this change: part inventory, ordering, and printed types stay on the walk that already gates JSDoc and unresolvable types. A full cutover is a later decision.
- **Vendor `@mui/internal-docs-infra`.** Already rejected by ruling 74b, 2026-08-24 (0.x-breaking-by-policy; peers TypeScript 6).

## Consequences

- Docs generation depends on `@elmeragroup/api-extractor` as a workspace package. Extractor behaviour changes that affect selected Base UI props show up as `api.json` diffs and as shadow-snapshot diffs.
- Library prop types cannot drift from the checker: merge always rewrites selected props to the walk's type string.
- Maintainers read this ADR for why the pipeline is two-sourced, not the removed wayfinder ticket 028.
