---
id: 024
title: Spec: date & react-aria interim
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the react-aria interim tier under the react-aria/ path prefix: date-picker cluster, calendar/range-calendar export question (judgment call 4: public or private), list-box (judgment call 3: admit from EXT or declare select/combobox the replacement), the RAC atoms quarantine (field/popover/item/span), and the modal fate note. Each spec carries the migration-to-base-ui marker required by the roadmap.

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-18 — the final family; **every component in the canonical inventory is now specced**. **Assets**: fourteen specs under `docs/spec/components/`: date-picker, date-range-picker, date-field, calendar, range-calendar, search-field, grid-list, link, focusable, file-trigger, ui-providers, heading, text, span.

**Judgment calls resolved:**

1. **Call 4 (user, overriding zero-usage evidence): calendar and range-calendar go PUBLIC** under the `react-aria/` prefix — with the polish that implies (range-calendar's inline tv → `styles/`, raw gray/blue palette → tokens).
2. **Call 3: list-box RETIRED.** The dead internal copy is deleted; the one external call site (a read-only partner roster) migrates to Item.Group/Item in a ScrollArea; DropdownListBox* is absorbed by base-ui select/combobox popups.
3. **Quarantine roster (call 10 executed)**: eleven public interim exports under `react-aria/` (the date five + search-field, grid-list, link, focusable, file-trigger, ui-providers); **heading/text/span RE-HOME as plain typography components at their bare paths** (291 import sites keep working; `slot` dropped, `useRender` added, recipes public, TextProps collisions disambiguated); **dropped from public**: field (→ base-ui field), popover (zero consumers anywhere), item (→ base-ui item). Private cluster internals: modal, dialog, RAC button (exists only for calendar slot navigation). Judgment call 6 confirmed: RAC modal/dialog fully internal; external Modal consumers land on base-ui dialog/sheet (migration deltas documented).
4. **Six interim fixes (user)**: shared `OVERLAY_CONTAINER_ATTR` constant kills the popover↔modal DOM-string coupling; date-range-picker aligned with date-picker (styled Dialog, leading-zeros default, tokens, new recipe); range-calendar tokenized; Phosphor swaps (CalendarBlank for the trigger); TextProps disambiguation; stale README cluster note corrected in the tier description.

Drafting caught extra ref defects, all specced: file-trigger's `variant`/`isDisabled` props leaking onto the RAC primitive instead of the Button; missing `aria-hidden`/accessible names on search-field clear + file-trigger icons; the `tailwindcss-react-aria-components` plugin variants rewritten as explicit `data-[…]` selectors (plugin dropped); typography recipes fully enumerated including an undocumented `align` axis. `@internationalized/date` confirmed to uninstall together with the date cluster.
