---
id: 022
title: Spec: navigation & structure
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

API-complete specs for the navigation family: tabs, breadcrumb, sidebar (light-sidebar tokens per the value matrix), pagination, collapsible + disclosure + the accordion decision (judgment call 2: reimplement accordion on base-ui vs point consumers at disclosure), scroll-area, separator (single canonical export per the template decision).

Execute against the template and conventions locked in [Component API spec template](011-component-api-spec-template.md) (ten sections per component, tv recipes public, namespace compounds, useRender polymorphism, ref-verbatim + Divergence capture). Source-of-truth files per component: the master table in [007 component inventory](../research/007-component-inventory.md). Deliverable: spec bodies under docs/spec/components/ (linked here), plus resolved judgment calls recorded in this ticket.

## Resolution

Resolved 2026-08-18. **Assets**: eight API-complete specs under `docs/spec/components/`: [tabs](../../docs/spec/components/tabs.md), [breadcrumb](../../docs/spec/components/breadcrumb.md), [sidebar](../../docs/spec/components/sidebar.md), [pagination](../../docs/spec/components/pagination.md), [collapsible](../../docs/spec/components/collapsible.md), [accordion](../../docs/spec/components/accordion.md), [scroll-area](../../docs/spec/components/scroll-area.md), [separator](../../docs/spec/components/separator.md).

**Judgment call 2 resolved (user): accordion is reimplemented on base-ui's Accordion primitive, and Disclosure is retired.** Extraction established base-ui ships Root/Item/Header/Trigger/Panel and the external radix accordion maps mechanically (type→multiple, Material tokens→contract tokens, ExpandMore→CaretDown, keyframes→`--accordion-panel-height` transition); expressing it via Disclosure would be lossy. Retiring Disclosure's RAC-shaped compat layer (migration mapping: grouped→Accordion, ungrouped→Collapsible) **removes the last react-aria dependency outside the date cluster**. Drafting verified two primitive facts against base-ui source: `orientation`/`loopFocus` are deprecated (Tab-only focus per updated APG — tests assert arrows do NOT move focus), and triggers emit `data-panel-open`, not `data-open`.

**Other rulings (user)**:

1. **Pagination full cleanup**: plain functions, react-aria `Span`→span, dead tv slots removed, `paginaton.ts` typo fixed, data-slots added, `paginationVariants` public; the required i18n `text` props stay (no baked English).
2. **Sidebar seven fixes**: legacy duplicate `data-sidebar` attributes dropped (spec flags the one live selector that must be rewritten to `data-slot` + regression test); mobile-branch className drop fixed; `setOpen` type accepts updater (the ref violates its own declared type); MenuSkeleton's random-width hydration hazard fixed; Trigger uses Button ghost icon-sm; `SIDEBAR_COOKIE_NAME="sidebar:state"` kept as HARD invariant (funnel SSR reads it); token usage constrained to the contract's 8 light-sidebar tokens. Trigger icon: Phosphor `SidebarSimple`.
3. **One separator**: base-ui version canonical (judgment call 11 executed — `data-slot` + `data-orientation` CSS mechanism + `self-stretch`); root file retired with exact behavioral deltas documented; the mechanism is `data-orientation` (extraction corrected my "data-variant" framing).
4. Tabs: `tabsListVariants` public; seven `dark:` trigger classes dropped (enumerated). Scroll-area: Radix-style `type` mapping kept verbatim; dead legacy `scrollAreaVariants` deleted. Breadcrumb: `useRender` exemplar; Phosphor CaretRight/DotsThree.
