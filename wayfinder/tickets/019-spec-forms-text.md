---
id: 019
title: Spec: text inputs & fields
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the text-input family: field, input, input-group, text-field, textarea + text-area, number-field, numeric-only-text-field (judgment call 5: re-home over base-ui/text-field or fold in as inputMode/filter prop), phone-number-field, button (+button-variants), button-group.

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-17. **Assets**: the seeded shared [conventions chapter](../../docs/spec/components/conventions.md) plus ten API-complete specs under `docs/spec/components/`: [field](../../docs/spec/components/field.md), [input](../../docs/spec/components/input.md), [textarea](../../docs/spec/components/textarea.md), [textarea-field](../../docs/spec/components/textarea-field.md), [input-group](../../docs/spec/components/input-group.md), [text-field](../../docs/spec/components/text-field.md), [number-field](../../docs/spec/components/number-field.md), [phone-number-field](../../docs/spec/components/phone-number-field.md), [button](../../docs/spec/components/button.md), [button-group](../../docs/spec/components/button-group.md). APIs captured from source (three parallel extraction/drafting passes), every deliberate change in each spec's §8.

**Judgment calls resolved (user):**

1. **numeric-only-text-field folds into text-field** as `filter?: "numeric"` (+ auto `inputMode="numeric"`); the external component is retired with a migration note. (Inventory judgment call 5.)
2. **`text-area` renamed `textarea-field`** — kills the hyphen-only collision with the `textarea` primitive, mirrors input→text-field symmetry.
3. **Composite prop face kept**: `isX` booleans + `onChange(value)` + `minValue/maxValue/formatOptions`; primitives stay base-ui-native. Two-level split documented once in conventions.
4. **Input-like surfaces: `bg-card`**, never literal `bg-white` (dark-ready; identical rendering in all 16 themes today).
5. **Recipes public where borrowed** (`buttonVariants`, `buttonGroupVariants`, `textFieldVariants`); micro-recipes private.

**Family-wide spec fixes recorded as divergences**: namespace renames (Field.*, InputGroup.*, ButtonGroup.*); `inverted:` and `dark:` ref classes dropped (mechanism/lint); `InputGroup.Text` gains `data-slot`; ButtonGroup orientation default emitted; `errorMessage` unified to ReactNode; textarea-field gains `isDisabled` + `defaultValue`; dead `textArea` tv slot removed; Flag's dead `"emoji"` variant value removed; phone-number-field's seven load-bearing hacks preserved and documented; NumberField's NaN-for-empty contract kept.
