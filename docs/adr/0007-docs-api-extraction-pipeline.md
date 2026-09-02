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
- **Lint overrides.** `tooling.md` §4 permits oxlintrc overrides only for the two oxlint plugin packages. The extractor does not add a file-glob override. Demonstrated incompatibilities (unstable TypeScript 7 AST typing, optional model fields that preserve upstream JSON) use next-to-the-code `oxlint-disable` headers with a reason; they are not a path-wide exemption.

Normative pipeline: [docs-site](../spec/docs-site.md) §8. Package inventory: [tooling](../spec/tooling.md) §1.

## Alternatives rejected

- **Keep the checker walk as the sole production path; extractor shadow-only.** Rejected because committed `api.json` artifacts already carry Base UI dependency props that HTML and markdown consumers render.
- **Replace the checker walk with the Effect extractor for library rows.** Rejected for this change: part inventory, ordering, and printed types stay on the walk that already gates JSDoc and unresolvable types. A full cutover is a later decision.
- **Vendor `@mui/internal-docs-infra`.** Already rejected by ruling 74b, 2026-08-24 (0.x-breaking-by-policy; peers TypeScript 6).

## Consequences

- Docs generation depends on `@elmeragroup/api-extractor` as a workspace package. Extractor behaviour changes that affect selected Base UI props show up as `api.json` diffs and as shadow-snapshot diffs.
- Library prop types cannot drift from the checker: merge always rewrites selected props to the walk's type string.
- Maintainers read this ADR for why the pipeline is two-sourced, not the removed wayfinder ticket 028.
