---
id: 004
title: Brand–segment matrix gaps
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [001, 003]
---

## Question

For every one of the 16 theme permutations, what are the **final token values** — and for the permutations that don't exist in the reference code, what is the policy?

Decisions to make (with the extraction matrix from _Token value extraction_ in hand and the contract from _Canonical token contract_ fixed):

1. Fallback/aliasing policy: does `external-tkas-company` share values with `external-tkas-private` until design provides a distinct palette? Expressed how (same file, CSS aliasing, generator-level inheritance)?
2. Pinned brands: `fkab` = company-only, `fkse` = private-only — does the system hard-error on invalid permutations (`external-fkab-private`) or silently coerce?
3. `fkab` external palette does not exist anywhere — source real values (design team?) or launch aliased to `fkas`?
4. `fkse`/Telinet: confirm palette and naming (code `fkse`, renders Telinet).
5. Internal themes: exact brand-accent values per brand on the grayscale base (`--brand-*` vars exist internally today).
6. Value-level output: the API-complete spec requires the full value table per theme — produce it.

## Resolution

Decided 2026-08-17 via grilling. Full value output: **[004-theme-value-matrix.md](../research/004-theme-value-matrix.md)** — all 16 permutations, provenance-marked, including exact oklch conversions of the surviving legacy HSL values.

1. **Fallback = absence + marked table.** Permutations without distinct palettes (external tkas/guen company) get **no CSS rule**; the value matrix lists them as _(inherits private)_ so gaps stay visible and fillable without restructuring.
2. **Pinned brands**: illegal permutations (`*-fkab-private`, `*-fkse-company`) are TS type-errors at the provider, a throw in development, and coerce-to-pinned-segment + console warning in production. CSS stays best-effort. Detail delegated to [Theme provider API](006-theme-provider-api.md).
3. **fkab is a permanent, deliberate alias of fkas** — "100% how it should be for the foreseeable future" (user). Not a gap, no design task, no flag. This supersedes the "flagged design-input gap" framing in [Canonical token contract](001-canonical-token-contract.md)/ADR 0001 (ADR amended).
4. **fkse**: code stays `fkse` everywhere (slugs, attributes, types); brand metadata carries `displayName: "Telinet"` + Telinet logo, which docs and pickers render.
5. **Internal accents**: reference values verbatim for fkas/tkas/guen; fkse = minted Telinet blue. **guen's dark-sidebar orange accent is retired**: the product is moving to a light sidebar (user supplied the values: `--sidebar: oklch(0.9851 0 0)`, `--sidebar-border: oklch(0.9219 0 0)`), where navy `--brand` is legible — `--sidebar-brand` defaults to `var(--brand)` for every brand.
6. **All minted values are final** (primary-soft tints, fkse accents, light-sidebar fills) — no provisional flags, no pending design review.

Side effect recorded in the matrix: the library's sidebar defaults spec the **new light sidebar**, not the dark one in the internal ref.
