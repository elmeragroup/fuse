---
id: 023
title: Spec: data display & feedback
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the display/feedback family: table, card (judgment call 7: reconcile EXT's rich CardSection*/CardLabelValue* API with INT card + frame + description-list), description-list, badge, avatar, frame, empty, skeleton, chart (judgment call 15: fate of 'export * from recharts'; recharts is an optional peer per package architecture), code, alert, loader, confirm-button, popover-info-button, show.

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-18. **Assets**: sixteen API-complete specs under `docs/spec/components/`: table, frame, description-list, skeleton, card, badge, avatar, empty, **item** (the base-ui Item family, added to the roster as a public export), chart, code, alert, loader, confirm-button, popover-info-button, show.

**Judgment call 7 resolved (user): decomposition wins.** Internal card stays lean (one `direction` axis, `cardVariants` public for the text-field borrow); the external rich card's three jobs decompose: CardSection→Frame.Panel, label/value grid→DescriptionList or VerticalTable.Body, anchor/button sections→Item.Root with `render`, side content→Item.Media. The emphasis/variant/padding axes and `dataTestId` die with migration notes.

**Judgment call 15 resolved (user): chart exports wrappers only.** The ref's real `export * from "recharts"` is removed — consumers import recharts (their optional peer) directly; migration is one import-source swap covering the 11 symbols apps actually use. ChartStyle's `.dark` map → `[data-theme="dark"]` (reserved-axis alignment).

**De-RAC ruling (user): full re-home.** Alert re-composed on base-ui Item + Button; popover-info-button → base-ui Button; react-aria Heading/Text in table/card/description-list → plain semantic elements with identical classes. **react-aria now survives only in the date cluster.** Consumer-visible deltas (plain-div Item.Title, sm-padding change, no intent prefetch) enumerated per spec.

**Eight fixes ruled (user)**: avatar raw grays → muted tokens; table's `bg-neutral-90` → `bg-muted`; VerticalTable double-spread bug (drafting also folded the ref's redundant 7th export into VerticalTable.Body); alert's dead VariantProps + unreachable base style removed; Empty.Media slot mismatch; chart falsy-zero tooltip bug; confirm-button disarm-on-disable; kept-verbatim-with-docs: recharts `[stroke=…]` escape hatches, badge's token-derived color-mix, shadow literals, code's `dangerouslySetInnerHTML`.

**Spec-added divergences worth noting**: loader gains `role="status"` (was AT-invisible); popover-info-button's hardcoded aria-label becomes an i18n-injectable `label` prop; badge/description-list/skeleton gain data-slots (were slot-less). **Flagged open for the a11y chapter** ([A11y & performance guideline chapters](026-a11y-performance-guidelines.md)): base-ui Item.Group renders `role="list"` while Item dropped the `listitem` default — a list with zero list items; spec pushes the role to consumers pending a library-wide ruling.
