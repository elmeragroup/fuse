# 0002 — Theme selection via three data attributes

Date: 2026-08-17. Status: accepted.

## Context

Themes are variant × brand × segment (20 permutations); both reference apps select themes with bare classes (`.fkas`, `.fkas-c`, `.v2 .fkas`). The token contract (ADR 0001) reserves `data-theme` for a future light/dark axis. A throwaway prototype (retired at v1; see git history before the wayfinder removal) generated all candidate mechanisms' CSS from one value table and compared them live, including scoped-subtree and portal behavior.

## Decision

Theme markers are **three data attributes** — `data-theme-variant`, `data-theme-brand`, `data-theme-segment` — placeable on any element; no selector anchors to `<html>`, so subtrees re-scope by carrying their own markers. `data-theme` remains reserved for light/dark. Theme CSS is structured as: `:root` defaults → brand-pointer rules keyed on brand alone → one internal reset → per-brand external palettes → segment deltas only where values differ. The internal rule and every emitted external palette directly declare the complete set of values that any external/segment layer can override, using defaults for source-level omissions; this prevents an outer scoped theme from leaking into an inner one. Missing segment palettes fall back by absence of a rule.

## Alternatives rejected

- **Single slug attribute** (`data-theme="external-fkas-company"`): axis-level rules require `^=`/`*=`/`$=` substring selectors, and the attribute occupies the reserved light/dark axis.
- **Classes (status quo)**: identical specificity and rule structure, but bare `.company`/`.private` tokens can collide with app CSS and are illegible as theme markers in DevTools.

## Consequences

- 15 rules cover 20 permutations; adding a brand adds ~2 rules (accent pointer + external palette), satisfying "adding brands must be cheap".
- Works unchanged with Tailwind v4 `@theme inline` (utilities reference `var(--token)` at the use site, re-resolving per scope).
- Portals must render _inside_ the themed scope or they silently take the outer theme — the theme-provider API owns that discipline.
- Each axis is independently visible on the element and independently switchable at runtime.
