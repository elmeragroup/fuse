---
id: 002
title: Theming cascade prototype
type: prototype
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

Does the **data-attribute theming mechanism scale**? The user favors `data-theme-variant` / `data-theme-brand` / `data-theme-segment` on `<html>`/`<body>` over single theme classes (both refs use classes today: `.fkas`, `.fkas-c`, `.v2 .fkas`), mainly to keep `data-theme` free for future light/dark.

Build a small throwaway prototype (plain CSS + a demo page is enough) that answers:

1. Can 16 permutations (8 internal + 8 external) be expressed with attribute-combination selectors (`[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]`) without a combinatorial explosion of CSS — and how do shared/fallback rules read (e.g. external tkas company falling back to tkas private values)?
2. Specificity & cascade behavior: attribute selectors vs the class approach, interaction with Tailwind v4 `@theme inline` variable mapping, and with nested re-scoping (OrderModuleWeb re-scopes a `<main>` subtree and portals dialogs *inside* it so overlays inherit theme vars — the mechanism must support scoped subtrees and portals).
3. Ergonomics: what the generated CSS looks like per theme file, and whether a hybrid (one `data-theme="<slug>"` attribute carrying the full slug) is simpler than three attributes.

Deliverable: prototype linked from this ticket + a recommendation (three attributes vs single slug attribute vs classes).

Prototype asset: [002-theming-cascade.html](../prototypes/002-theming-cascade.html) — self-contained, double-click to open. All three mechanisms generated from one shared value table by a pure `themeEngine` module; five guided walkthroughs (brand tour, segment fallback, variant flip, scoped island & portals, mechanism shoot-out).

## Resolution

Decided 2026-08-17, user-confirmed after driving the prototype. **Three data attributes win**: `data-theme-variant` / `data-theme-brand` / `data-theme-segment`, placeable on any element (nothing anchors to `<html>`). Rationale in [ADR 0002](../../docs/adr/0002-theme-attributes.md). Findings the prototype established:

1. **Scales without explosion.** 13 rules cover all 16 permutations: `:root` defaults, 5 brand-pointer rules (keyed on brand alone, serving both variants), 1 internal grayscale base, 5 external brand palettes, 1 genuine segment delta (fkas-c). Rules grow with *value differences*, not permutations; missing segment palettes (tkas/guen company) fall back to private **by absence of a rule** — zero fallback CSS.
2. **Specificity parity.** `[data-x="y"]` ≡ class (0,1,0); compounds appear only at genuine axis intersections. Tailwind v4 `@theme inline` emits `var(--token)` at the use site, so tokens re-resolve per scope under any mechanism — interop is a non-issue.
3. **Scoped subtrees & portals work** — markers on any element re-theme that subtree; a portal *inside* the scope inherits correctly, a portal *outside* silently retargets to the page theme. The mechanism supports OrderModuleWeb's pattern; enforcing portal-inside discipline is the [Theme provider API](006-theme-provider-api.md)'s job (noted there).
4. **Slug rejected**: axis rules need `^=`/`*=`/`$=` substring selectors (string tricks), and the slug occupies `data-theme` — the axis the token contract reserves for light/dark.
5. **Classes rejected**: equal power, but bare `.company`/`.private` words risk app-CSS collisions and are illegible as theme markers in DevTools.

Bonus finding: generating the three stylesheets from one typed value table was trivially easy and caught value drift by construction — a strong signal for the codegen side of the [Token pipeline](018-token-pipeline.md) decision.
