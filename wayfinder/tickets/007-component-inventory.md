---
id: 007
title: Component inventory reconciliation
type: research
status: closed
assignee: research-agent
blocked-by: []
---

## Question

What is the **canonical component inventory** of `@elmeragroup/ui` v1 — the reconciled union of both reference UI packages, with no duplicates?

Rules (settled during charting): union of `.ref/OrderModuleInternalWeb/packages/ui` and `.ref/OrderModuleWeb/packages/ui`; **on overlap, internal wins** (explicitly: internal's `base-ui/phone-number-field` beats external's `phone-text-field`; internal's `base-ui/combobox` beats external's `combo-box`). External-only components join the set but are expected to adopt base-ui (OrderModuleWeb will migrate to our base-ui setup). The react-aria date/calendar cluster from internal is honored as an interim tier.

Produce, per component: canonical name, source of truth (internal path / external path), tier (`base-ui` | `react-aria interim` | `composite` | `unheadless` e.g. table/card), overlap notes (which duplicate it supersedes), and external-only components that need a base-ui reimplementation decision (e.g. menu, tabs exist internally; check list-box, toggle-button, numeric-only-text-field, pagination variants, timeline-list divergence).

Also inventory: hooks, `Icon`/logo exports, chart, toaster, utilities (`cn`, `tv`), and the not-exported internal composites.

Deliverable: `wayfinder/research/007-component-inventory.md` — the draft inventory table with flagged judgment calls for the human (feeds _Component API spec template_).

## Resolution

Findings: [research/007-component-inventory.md](../research/007-component-inventory.md).

Reconciled inventory: **~75 canonical entries in four tiers** — 33 base-ui (all internal-sourced, incl. avatar and scroll-area), 17 react-aria interim (date cluster + foundational atoms per internal's react-aria/README four-cluster map), plus composite and unheadless tiers. All 30+ overlaps resolved internal-first (phone-number-field, combobox, dropdown-menu⊃menu, toggle/toggle-group⊃toggle-button, base-ui tabs/dialog/select ⊃ RAC ones).

**17 judgment calls flagged for the human**, headline ones: external-only survivors needing base-ui reimplementation decisions (accordion — sole radix consumer, list-box — internal copy is orphaned, numeric-only-text-field, modal, public calendar/range-calendar); the icon fork (78 material SVGs vs ~150 lucide keys) — feeds _Icon system_; dual `./field` vs `./base-ui/field` export-path policy; external's richer card API; Telinet logos for fkse; `chart`'s `export * from "recharts"`; sonner 1.x→2.x. These judgment calls are inputs to _Component API spec template_ and _Icon system_.
