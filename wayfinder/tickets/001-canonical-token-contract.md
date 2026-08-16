---
id: 001
title: Canonical token contract
type: grilling
status: open
assignee: null
blocked-by: []
---

## Question

The two reference projects use **conflicting token contracts** and the library must have exactly one. Which token naming model does `@elmeragroup/ui` standardize on, and what is the exact set of token names every theme must supply?

- OrderModuleInternalWeb (`packages/ui/src/styles/ui.css`) is **shadcn-style**: `--background/--foreground`, `--primary/--primary-foreground`, `--muted`, `--card`, `--sidebar-*`, `--chart-1..8`, neutral ramp `--neutral-0..100`, `--brand-<code>` accent vars, `--radius` + `--radius-button`.
- OrderModuleWeb (`packages/ui/src/styles/brands.css`) is **Material-3-style**: `--surface/--on-surface/--surface-variant`, `--primary/--on-primary/--primary-container/--on-primary-container`, `--secondary`, `--tertiary`, four-way status set (`error/info/success/warning` each with `on-`/`-container` forms), `--radius` + `--radius-button`, all oklch.

Decide: (a) one unified contract (which one wins, or a merged superset), (b) the complete token list (colors, radii, fonts, breakpoints, chart ramp, sidebar block, status set), (c) which tokens are **themable** (themes must/can override) vs **locked** (library-fixed), (d) how the internal grayscale + brand-accent model maps onto the same contract the external full-brand themes use, (e) legacy-token bridging policy (the refs carry legacy HSL triplets and known footguns like `--popover: var(--card)` eager-binding — the new contract should shed these deliberately).

Base per user directive: the shadcn variable base (see the effort's original brief) plus what `ui.css` already defines. Dark mode: the contract must not preclude a future `data-theme` light/dark axis, but no dark values are specced.

This is the load-bearing decision of the whole effort — most theming tickets block on it.
