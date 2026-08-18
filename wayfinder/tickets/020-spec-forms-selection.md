---
id: 020
title: Spec: selection controls
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the selection family: checkbox + checkbox-card, radio-group (judgment call 8: confirm INT RadioItem*/selection-item patterns cover EXT RadioCard + horizontal card layouts), switch, select, combobox, toggle + toggle-group, meter.

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-17. **Assets**: ten API-complete specs under `docs/spec/components/`: [selection-item](../../docs/spec/components/selection-item.md), [checkbox](../../docs/spec/components/checkbox.md), [checkbox-card](../../docs/spec/components/checkbox-card.md), [radio-group](../../docs/spec/components/radio-group.md), [switch](../../docs/spec/components/switch.md), [select](../../docs/spec/components/select.md), [combobox](../../docs/spec/components/combobox.md), [toggle](../../docs/spec/components/toggle.md), [toggle-group](../../docs/spec/components/toggle-group.md), [meter](../../docs/spec/components/meter.md). APIs extracted from source; every deliberate change in each spec's §8.

**Judgment call 8 resolved (user)**: the internal patterns cover the external selection cards **with one restoration** — `SelectionItem.Shell` gains `controlPosition: "start" | "end"` (trailing indicators, the external funnels' RadioCard pattern; spacer width derives from the control slot). Everything else (pluggable switch/checkbox indicator, iconPosition grid, shape, Heading level, wrapChildren, the layout/itemSpacing/connectedEdges matrix) is dropped with migration notes; `control: ReactNode` is the escape hatch. Extraction verdict: internal `CheckboxCard` is a **strict superset of external `CheckboxCardHorizontal`** — full parity, no action.

**Seven bugfix divergences ruled (user)**: truthy `isPending` gate on RadioGroup's header row; ToggleGroup item-level variant/size made effective (`itemProp ?? contextValue`; extraction sharpened that ref inertness is conditional — specced precisely); dead Radix `data-[state=on]` selector removed; Meter emits `data-slot` attributes (was the only slot-less component); dead `data-variant=destructive` selectors removed from Select/Combobox; `bg-white` → `bg-card` + all `dark:`/`inverted:` drops; RadioIconButton `bg-background` → `bg-card`.

**Other spec rulings**: `Combobox.Clear` promoted to an exported namespace part; Select/Combobox Content parts gain the `container` prop (overlay convention); `toggleVariants` public (sanctioned borrow), `checkboxCardStyles`/`meterVariants` private; Phosphor swaps throughout (`LoaderCircle→SpinnerGap`, carets, `Circle/CheckCircle` with fill-weight-permitted note). Notable kept-faithful facts: select items highlight via DOM focus while combobox items use `data-highlighted` (real behavioral difference); meter's `EXCEEDED_MAX_VALUE` compound-matrix fall-through footnoted; `ring-brand` on checkbox-card is valid (`--brand` is a first-class contract token).
