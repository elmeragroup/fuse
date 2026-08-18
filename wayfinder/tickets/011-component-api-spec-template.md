---
id: 011
title: Component API spec template
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [001, 007]
---

## Question

The spec must be **API-complete** (props, subpath exports, variants per component). What is the per-component spec template and the shared conventions every component spec follows — so the per-family spec tickets that graduate from this can be executed mechanically?

Decide:

1. Template fields: export path, anatomy (compound parts), props table, variant axes + allowed values, consumed tokens, data-attributes emitted, a11y notes, tier (base-ui / react-aria interim / composite), test requirements, demo requirements.
2. Variant engine: `tailwind-variants` (`tv`) as both refs use today, vs kumo-style plain variant maps with descriptions (machine-readable for docs/AI registry) — and whether `*Variants` objects are public API (external ref exports ~30 of them).
3. Compound-component convention: base-ui namespace style (`Dialog.Root`/`Dialog.Trigger`) vs flat exports — the internal ref mixes both.
4. Styling conventions: bare `data-open:` variant trap (documented in internal ui.css), `focusRing`/`disabledHatch` shared recipes, class-merge seam (`cn`).
5. How component APIs are captured from the reference source (they're the proven baseline) and where the spec may deliberately diverge.
6. The batching of per-family spec tickets this template unlocks (forms, overlays, navigation, data display, date/react-aria, layout) — define the batches; they graduate from fog when this closes.

Handed over from [Theme provider API](006-theme-provider-api.md): **standing convention — all polymorphism uses base-ui's `useRender` (`render` prop + `mergeProps`), never an `as` prop**; the template's props-table conventions must encode it. Overlay components take a `container` prop (portal-inside-scope discipline).

## Resolution

Decided 2026-08-17 via grilling. All per-family spec sessions execute against this.

1. **Template — ten mandatory sections per component**: (1) header (canonical name, export path, tier, source-of-truth file); (2) anatomy (compound parts mapped to base-ui primitives); (3) props table per part (`render` prop via `useRender`; `container` prop on overlays); (4) variants (tv axes/values/defaults + the public recipe name); (5) consumed tokens; (6) emitted data-attributes; (7) a11y (keyboard/aria/focus); (8) **divergence-from-reference**; (9) test requirements; (10) demo requirements. **Shared conventions live once** in a conventions chapter (useRender, `cn` seam, `focusRing`/`disabledHatch` recipes, the bare `data-open:` Tailwind-variant trap, portal discipline, Phosphor regular-weight usage) — referenced, never repeated.
2. **Variant engine: `tv` (tailwind-variants), recipes public.** The borrow-a-look pattern (pagination→button-variants) is sanctioned; `VariantProps` typing; variant descriptions for docs live in the spec/docs layer, not runtime.
3. **Compound convention: base-ui namespace style** (`Dialog.Root`/`Dialog.Trigger`) everywhere — internal's mixed style normalizes to this.
4. **Path policy: bare paths = winning base-ui tier; react-aria interim atoms only under `react-aria/`** (self-documenting migration marker that dies with the tier). One separator survives (judgment call 11 → `base-ui/separator` wins at the bare path). **No `./utils` export** — `cn`/`tv` come from `@elmeragroup/lib`; no deprecation shim (migrations out of scope).
5. **Capture policy: ref-verbatim + Divergence section.** The inventory's source-of-truth column is the baseline; every deliberate change (Phosphor swaps, token renames, useRender adoption, judgment-call outcomes) is listed explicitly per component.
6. **Batching: six per-family grilling tickets graduate** (each resolves its family's judgment calls and produces the spec bodies as assets): [Spec: text inputs & fields](019-spec-forms-text.md), [Spec: selection controls](020-spec-forms-selection.md), [Spec: overlays & menus](021-spec-overlays.md), [Spec: navigation & structure](022-spec-navigation.md), [Spec: data display & feedback](023-spec-data-display.md), [Spec: date & react-aria interim](024-spec-date-interim.md). All unblocked in parallel; each blocks [Spec assembly](017-spec-assembly.md).
