# Wayfinder map — `@elmeragroup/ui` specification `wayfinder:map`

Tracker conventions: see [TRACKER.md](./TRACKER.md). Domain glossary: see [CONTEXT.md](../CONTEXT.md).

## Destination

An **implementation-ready architecture and product specification** for `@elmeragroup/ui` — the whitelabel React component library (variant × brand × segment theming, 5 brands, 16 theme permutations) — delivered as markdown documents under `docs/spec/`, **API-complete** (every component's props, exports, and variants specified; every theme's token values tabulated). No library implementation happens in this effort.

## Notes

- **Fixed constraints** (validated or user-locked during charting): React 19, base-ui primitives, Tailwind v4, pnpm + turborepo, oxlint + oxfmt + anti-slop, vitest + browser mode; published to **public npmjs.com** under `@elmeragroup/ui`; react-aria-components honored as an interim tier for date/calendar (per internal ref).
- **Scope rules**: component inventory = union of both ref ui packages, **internal wins on overlap** (internal phone-number-field and combobox are canonical); five brands only; dark mode axis reserved in the contract but no dark values specced; migrations of the two OrderModule apps out of scope.
- **Skills every session should consult**: `/grilling` + `/domain-modeling` for grilling tickets, `/prototype` for prototype tickets, `/research` for research tickets. Update `CONTEXT.md` as terms sharpen; ADRs under `docs/adr/` for hard-to-reverse trade-offs.
- **Reference intel** (explorer reports, summarized in ticket bodies): internal ref = shadcn-style tokens, base-ui, source-shipped; external ref = Material-3-style tokens, react-aria-components, brand classes + one `fkas-c` segment block; kumo = best published-library reference (tsdown two-pass, changesets, codegen'd theme tokens, dual CSS distribution); coss = fumadocs + shadcn registry; base-ui repo = publishConfig/exports + testing rigor.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

_None yet — map freshly charted._

## Not yet specified

- **Per-family component API specs** — the API-complete spec bodies (forms, overlays, navigation, data display, date/react-aria, layout, feedback…). Graduate into one ticket per family once [Component API spec template](tickets/011-component-api-spec-template.md) fixes the template and batching; each then re-wires [Spec assembly](tickets/017-spec-assembly.md).
- **Token pipeline mechanics** — hand-authored theme CSS vs kumo-style typed-config→generated-CSS codegen; sharpens after [Canonical token contract](tickets/001-canonical-token-contract.md) and [Theming cascade prototype](tickets/002-theming-cascade-prototype.md) resolve.
- **npm org / GitHub org setup task** — concrete checklist emerges from [Release & versioning pipeline](tickets/014-release-pipeline.md).
- **Design-input tasks** — if [Brand–segment matrix gaps](tickets/004-brand-segment-matrix-gaps.md) or [Brand assets & licensing](tickets/010-brand-assets-licensing.md) need palettes/sign-off from design/legal, they spawn HITL task tickets.
- **Accessibility & performance guideline docs** — required spec chapters; shape emerges from the component template and testing decisions.
- **Roadmap document contents** — react-aria→base-ui migration path, dark-mode rollout, VR testing, additional brands; firm up near [Spec assembly](tickets/017-spec-assembly.md).
- **Docs-site design prototype** — likely a prototype ticket after [Docs site & playground](tickets/012-docs-and-playground.md) picks the stack (aesthetics outrank automation per brief).

## Out of scope

- **Implementing the library** — this effort ends at the spec; building `@elmeragroup/ui` is the next effort.
- **Migration plans for OrderModuleInternalWeb / OrderModuleWeb** — user ruled fully out; the spec doesn't even carry a compat assessment.
- **Brands beyond the five** (Steddi, NGE/ngef, Trumf, Elmera Group as themes) — architecture must make adding brands cheap, but their themes are not specced.
- **Dark-mode token values** — the contract reserves the `data-theme` axis only; GUEN-dark values recorded as reference, not specced.

## Ticket graph (for orientation)

Frontier at charting: [Canonical token contract](tickets/001-canonical-token-contract.md), [Theming cascade prototype](tickets/002-theming-cascade-prototype.md), [Token value extraction](tickets/003-token-value-extraction.md) (research), [Theme provider & SSR research](tickets/005-theme-provider-ssr-research.md) (research), [Component inventory reconciliation](tickets/007-component-inventory.md) (research), [Brand assets & licensing](tickets/010-brand-assets-licensing.md), [Docs site & playground](tickets/012-docs-and-playground.md), [anti-slop research](tickets/015-anti-slop-research.md) (research).

Blocked: 004←(001,003) · 006←(002,005) · 008←010 · 009←007 · 011←(001,007) · 013←008 · 014←008 · 016←(008,015) · 017←(004,006,009,011,012,013,014,016).
