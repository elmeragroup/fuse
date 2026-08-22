---
id: 010
title: Brand assets & licensing
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

The registry decision is **public npmjs.com** — what can legally and strategically ship inside a public package?

At stake: Fjordkraft's heading font is **Neo Sans, a licensed commercial font** (woff2 files live in the ref apps today); brand logos ship as components inside the ref ui packages; brand palettes themselves are public-by-nature (visible in any shipped CSS) but logos/fonts have redistribution terms.

Decide:

1. Fonts: keep the refs' pattern where **apps supply fonts** via `--font-primary`/`--font-heading` CSS variables (library never ships font files — cleanest), vs a separate private `@elmeragroup/fonts` package, vs public shipping (needs license verification with the font vendor).
2. Logos: public package (logos are publicly visible marks anyway) vs private assets package; who signs off?
3. Whether _any_ part needs to stay private, and if so how the public/private split works in CI.
4. License for the public package code itself (MIT? proprietary-source-visible?) and who in Elmera approves open distribution.

This is HITL: the license facts and sign-off are the human's to bring or chase (spawn a follow-up task ticket if legal/design input must be gathered).

Handed over from [Icon system](009-icon-system.md): the decided logo roster (5 brands incl. Telinet, ElmeraGroup fallback, Steddi + Trumf for internal tools) ships in `@elmeragroup/ui/icons` **contingent on this ticket's licensing outcome**; the fallback is a private assets package. Also relevant: fonts stay app-supplied per the theme contract (`--font-sans`/`--font-heading` are themable tokens), so point 1's cleanest option is already the working assumption elsewhere.

## Resolution

Decided 2026-08-17 via grilling (HITL; the user holds the distribution authority).

1. **Fonts: apps supply them — the library never ships font files.** Themes reference font-family names only via the themable `--font-sans`/`--font-heading` tokens; each app loads its own licensed files (the refs' `next/font` pattern). Neo Sans's commercial license therefore never touches the published package. No `@elmeragroup/fonts` package.
2. **Logos ship in the public package, pragmatically.** They are publicly visible marks already served in every brand site's bundles; npm changes discoverability, not exposure. The [Icon system](009-icon-system.md) contingency is **cleared** — the full logo roster ships in `@elmeragroup/ui/icons` as decided there. Escalation only if brand/legal objects later.
3. **Nothing stays private.** No public/private split, no private registry, no CI split — the question dissolves.
4. **Code license: MIT**, matching the entire dependency stack (base-ui, Phosphor, Tailwind ecosystem). **Approver: the user (Tommy Barvåg) owns the open-distribution decision** — no sign-off task ticket spawns; the spec records this.
