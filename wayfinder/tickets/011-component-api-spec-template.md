---
id: 011
title: Component API spec template
type: grilling
status: open
assignee: null
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
