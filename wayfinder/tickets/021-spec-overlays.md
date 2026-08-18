---
id: 021
title: Spec: overlays & menus
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the overlay family: dialog, alert-dialog, sheet, popover, dropdown-menu, tooltip, toast. All overlays take a container prop (portal-inside-scope discipline from the theme provider decision). Judgment call 6 (EXT modal -> dialog+sheet) is settled by the inventory; record the migration note.

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-18. **Assets**: seven API-complete specs under `docs/spec/components/`: [dialog](../../docs/spec/components/dialog.md), [alert-dialog](../../docs/spec/components/alert-dialog.md), [sheet](../../docs/spec/components/sheet.md), [popover](../../docs/spec/components/popover.md), [tooltip](../../docs/spec/components/tooltip.md), [dropdown-menu](../../docs/spec/components/dropdown-menu.md), [toast](../../docs/spec/components/toast.md).

**Headline ruling (user): toast pivots from sonner to base-ui Toast.** sonner is abolished (drops out of the dependency tree entirely); the spec wraps base-ui's Toast primitives (`useToastManager`/`createToastManager`, F6 viewport landmark, CSS-var stacking/swipe contract), with kumo's base-ui toast adopted as the styling precedent (its stacking/swipe recipe taken near-verbatim). The `TOAST_STYLE.INVERTED` raw-oklch object dies in favor of token inversion. **Known breaking change** for OrderModuleWeb and OrderModuleInternalWeb — migration mapped old→new in the spec's §8.

**Other rulings (user)**:
1. **Close button unified on Dialog's pattern** (Button ghost icon-sm + sr-only + hit-area) across Dialog and Sheet (Sheet's hand-rolled markup replaced; small visual delta accepted); AlertDialog keeps it forced off; Dialog.Footer's action-row `showCloseButton` unchanged.
2. **Popover arrow tokenized** (`bg-popover` + `border-border`, geometry kept) — kills the family's worst violation (`before:bg-white` + `dark:` raw colors). Tooltip keeps its token-inverted always-on arrow; differing show-behavior deliberate.
3. **Six family-wide fixes**: `container` prop on every Content, forwarded to the internal portal (extraction confirmed zero components exposed one); z-50 deduped to one per overlay (flat strategy documented); DropdownMenu.SubContent's double-applied base classes fixed (extraction sharpened the "double-wrap" framing — the true defect is conflicting class merges); Tooltip's dead Radix `delayed-open` classes + phantom kbd hooks removed, nested-provider `delay` behavior documented; AlertDialog body becomes a real Description (aria-describedby was never wired); scrim stays literal `bg-black/10` with a dark-roadmap note.

Kept-faithful highlights: AlertDialog stays prop-driven over Dialog.Root (not base-ui AlertDialog) with `data-dialog-action-type` hooks; Sheet's Drawer foundation (side-in-context, swipe-var transform classes, VirtualKeyboardProvider constraint, pointer-events viewport hack) documented as no-refactor zones; DropdownMenu.LinkItem (Funnel addition) kept; judgment call 6 (external modal → dialog+sheet) recorded as a migration note. Phosphor swaps verified (`OctagonX→WarningOctagon` — no octagon-X glyph exists).
