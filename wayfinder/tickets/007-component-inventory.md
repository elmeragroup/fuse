---
id: 007
title: Component inventory reconciliation
type: research
status: open
assignee: research-agent
blocked-by: []
---

## Question

What is the **canonical component inventory** of `@elmeragroup/ui` v1 — the reconciled union of both reference UI packages, with no duplicates?

Rules (settled during charting): union of `.ref/OrderModuleInternalWeb/packages/ui` and `.ref/OrderModuleWeb/packages/ui`; **on overlap, internal wins** (explicitly: internal's `base-ui/phone-number-field` beats external's `phone-text-field`; internal's `base-ui/combobox` beats external's `combo-box`). External-only components join the set but are expected to adopt base-ui (OrderModuleWeb will migrate to our base-ui setup). The react-aria date/calendar cluster from internal is honored as an interim tier.

Produce, per component: canonical name, source of truth (internal path / external path), tier (`base-ui` | `react-aria interim` | `composite` | `unheadless` e.g. table/card), overlap notes (which duplicate it supersedes), and external-only components that need a base-ui reimplementation decision (e.g. menu, tabs exist internally; check list-box, toggle-button, numeric-only-text-field, pagination variants, timeline-list divergence).

Also inventory: hooks, `Icon`/logo exports, chart, toaster, utilities (`cn`, `tv`), and the not-exported internal composites.

Deliverable: `wayfinder/research/007-component-inventory.md` — the draft inventory table with flagged judgment calls for the human (feeds *Component API spec template*).
