# 007 — Component inventory reconciliation

Reconciled union of the two reference `@elmeragroup/ui` packages, per the ticket rules: **union of both packages; on overlap, internal wins** (explicitly: `base-ui/phone-number-field` beats `phone-text-field`; `base-ui/combobox` beats `combo-box`); external-only components join the set but are expected to adopt base-ui; the internal react-aria date/calendar cluster is honored as the **interim tier**.

Path shorthands used throughout:

- **INT** = `.ref/OrderModuleInternalWeb/packages/ui` (base-ui era; the winner on overlap)
- **EXT** = `.ref/OrderModuleWeb/packages/ui` (react-aria-components / radix era)

Evidence base: `INT/package.json` exports map (80 entries), `EXT/package.json` exports map (55 entries), full `src/` trees of both, `INT/src/react-aria/README.md` (documents the four RAC clusters and the uninstall plan).

Tiers (from ticket + CONTEXT.md):

- `base-ui` — built on `@base-ui/react`
- `react-aria interim` — still on `react-aria-components`, part of the library, marked for future migration
- `composite` — assembled from base-ui/interim primitives (+ third-party like sonner/recharts)
- `unheadless` — plain markup + tailwind-variants, no headless library (table, card, badge, …)

---

## Master table

Canonical name = the v1 export subpath. Source of truth = the file the v1 implementation is lifted from.

### base-ui tier

| Canonical name | Source of truth | Tier | Overlap / supersedes notes |
|---|---|---|---|
| `alert-dialog` | `INT/src/base-ui/alert-dialog.tsx` | base-ui | Supersedes `EXT/src/alert-dialog.tsx` (RAC). |
| `avatar` | `INT/src/avatar.tsx` | base-ui | Internal-only (`@base-ui/react/avatar`). Lives at top level, not under `base-ui/`. |
| `breadcrumb` | `INT/src/base-ui/breadcrumb.tsx` | base-ui | Internal-only. |
| `button` | `INT/src/base-ui/button.tsx` | base-ui | Supersedes `EXT/src/button.tsx` (RAC). `INT/src/button.tsx` is a re-export shim of the base-ui button — keep one canonical path. |
| `button-variants` | `INT/src/base-ui/button-variants.ts` | base-ui | Internal-only (recipe split out so pagination/date-picker can borrow button looks without the component). |
| `button-group` | `INT/src/base-ui/button-group.tsx` | base-ui | Internal-only. |
| `checkbox` | `INT/src/base-ui/checkbox.tsx` | base-ui | Supersedes `EXT/src/checkbox.tsx` (RAC; its `CheckboxCard`/`CheckboxCardHorizontal` map onto internal `checkbox-card` — see judgment call 8). |
| `checkbox-card` | `INT/src/base-ui/checkbox-card.tsx` | base-ui | Internal-only export; absorbs EXT's `CheckboxCard` use cases. |
| `collapsible` | `INT/src/base-ui/collapsible.tsx` | base-ui | Internal-only; candidate replacement for EXT `accordion` (judgment call 2). |
| `combobox` | `INT/src/base-ui/combobox.tsx` | base-ui | **Settled rule:** supersedes `EXT/src/combo-box.tsx` (RAC `ComboBox`/`ComboBoxItem`/`ComboBoxSection`). |
| `dialog` | `INT/src/base-ui/dialog.tsx` | base-ui | Supersedes `EXT/src/dialog.tsx` and (together with `sheet`) `EXT/src/modal.tsx` (RAC `Modal`/`ModalOverlay`) — judgment call 6. |
| `disclosure` | `INT/src/base-ui/disclosure.tsx` | base-ui | Internal-only; the other accordion candidate (judgment call 2). |
| `dropdown-menu` | `INT/src/base-ui/dropdown-menu.tsx` | base-ui | Supersedes `EXT/src/menu.tsx` (RAC Menu family: `Menu`, `MenuItem`, `MenuPopover`, `MenuCheckboxItem`, `MenuRadioItem`, …). Naming migration for EXT consumers. |
| `field` (base-ui) | `INT/src/base-ui/field.tsx` | base-ui | Supersedes `EXT/src/field.tsx` (RAC `Form`/`Label`/`Input`/`FieldError`/`FieldGroup`). NOTE: internal *also* exports the RAC field at `./field` — dual export, judgment call 10. |
| `input` | `INT/src/base-ui/input.tsx` | base-ui | Internal-only. |
| `input-group` | `INT/src/base-ui/input-group.tsx` | base-ui | Internal-only (used by phone-number-field). |
| `item` (base-ui) | `INT/src/base-ui/item.tsx` | base-ui | Internal-only; same dual-export situation as field (`./item` is the RAC one) — judgment call 10. |
| `meter` | `INT/src/base-ui/meter.tsx` | base-ui | Internal-only. Its mode/level constants live in `INT/src/constants/meter-constants.ts` (not exported). |
| `number-field` | `INT/src/base-ui/number-field.tsx` | base-ui | Supersedes `EXT/src/number-field.tsx` (RAC; `NumberField`/`StepperButton`). |
| `phone-number-field` | `INT/src/base-ui/phone-number-field/` (index, `phone-number-field.tsx`, `flag.tsx`, `hooks/use-phone-number-field-state.ts`) | base-ui | **Settled rule:** supersedes `EXT/src/phone-text-field.tsx`. Different mechanics: INT = base-ui Combobox country picker + `usePhoneNumberFieldState`; EXT = `libphonenumber-js` `AsYouType` over a plain TextField. Consumers get a real API change. |
| `popover` (base-ui) | `INT/src/base-ui/popover.tsx` | base-ui | Supersedes `EXT/src/popover.tsx` (RAC). Internal `./popover` currently points at the RAC one (shared by date + phone clusters) — judgment call 10. |
| `radio-group` | `INT/src/base-ui/radio-group.tsx` | base-ui | Supersedes `EXT/src/radio-group.tsx` (RAC; exports `Radio`, `RadioCard`, `RadioGroup`). INT models the card style as `RadioItem*` slots over `base-ui/selection-item.tsx` — parity check is judgment call 8. |
| `scroll-area` | `INT/src/scroll-area.tsx` | base-ui | Supersedes `EXT/src/scroll-area.tsx` (`@radix-ui/react-scroll-area`). INT maps the Radix-style `type` prop onto base-ui `keepMounted` + visibility. |
| `select` | `INT/src/base-ui/select.tsx` | base-ui | Supersedes `EXT/src/select.tsx` (RAC; `Select`/`SelectItem`/`SelectSection`). |
| `separator` | `INT/src/base-ui/separator.tsx` | base-ui | Internal-only. INT exports **two** separators (`./separator` → `src/separator.tsx`, also base-ui-primitive-based, and `./base-ui/separator`) — pick one, judgment call 11. |
| `sheet` | `INT/src/base-ui/sheet.tsx` | base-ui | Internal-only. |
| `sidebar` | `INT/src/base-ui/sidebar.tsx` | base-ui | Internal-only (uses `hooks/use-is-mobile`). |
| `switch` | `INT/src/base-ui/switch.tsx` | base-ui | Supersedes `EXT/src/switch.tsx` (RAC). |
| `tabs` | `INT/src/base-ui/tabs.tsx` | base-ui | Supersedes `EXT/src/tabs.tsx` (RAC `Tabs`/`TabList`/`Tab`/`TabPanel`). |
| `text-field` | `INT/src/base-ui/text-field.tsx` | base-ui | Supersedes `EXT/src/text-field.tsx` (RAC). |
| `textarea` | `INT/src/base-ui/textarea.tsx` | base-ui | Internal-only primitive; the labeled composite is `text-area` below. |
| `toggle` / `toggle-group` | `INT/src/base-ui/toggle.tsx`, `INT/src/base-ui/toggle-group.tsx` | base-ui | Supersede `EXT/src/toggle-button.tsx` (RAC `ToggleButton`/`ToggleButtonGroup`). Naming migration for EXT consumers. |
| `tooltip` | `INT/src/base-ui/tooltip.tsx` | base-ui | Supersedes `EXT/src/tooltip.tsx` (RAC + manual open-state effect). |

### react-aria interim tier

Per `INT/src/react-aria/README.md`, RAC survives in four clusters: (1) date, (2) phone island (now migrated to base-ui except its popover), (3) facet-filter remnants (`grid-list`, `search-field`), (4) shared foundational atoms. All are part of the library, marked for future migration.

| Canonical name | Source of truth | Tier | Overlap / supersedes notes |
|---|---|---|---|
| `date-field` | `INT/src/react-aria/date-field.tsx` | react-aria interim | Supersedes `EXT/src/date-field.tsx`. |
| `date-picker` | `INT/src/react-aria/date-picker.tsx` | react-aria interim | Supersedes `EXT/src/date-picker.tsx`. Internally composes the non-exported `react-aria/button|calendar|dialog|popover`. |
| `date-range-picker` | `INT/src/react-aria/date-range-picker.tsx` | react-aria interim | Supersedes `EXT/src/date-range-picker.tsx`. Composes non-exported `range-calendar`. |
| `calendar` | `INT/src/react-aria/calendar.tsx` (**not exported by INT**) | react-aria interim | EXT exports it publicly (`EXT/src/calendar.tsx`); INT keeps it date-cluster-internal. Whether v1 exposes `./calendar` is judgment call 4. |
| `range-calendar` | `INT/src/react-aria/range-calendar.tsx` (**not exported by INT**) | react-aria interim | Same situation as calendar (`EXT/src/range-calendar.tsx` is public). Judgment call 4. |
| `field` | `INT/src/react-aria/field.tsx` | react-aria interim | Currently the target of INT's `./field` export; coexists with `base-ui/field`. Judgment call 10. |
| `file-trigger` | `INT/src/react-aria/file-trigger.tsx` | react-aria interim | Internal-only. |
| `focusable` | `INT/src/react-aria/focusable.tsx` | react-aria interim | Supersedes `EXT/src/focusable.tsx` (both wrap react-aria `useFocusable`). |
| `grid-list` | `INT/src/react-aria/grid-list.tsx` | react-aria interim | Internal-only (facet-filter remnant; README defers migration to the listbox/filter rewrite). |
| `heading` | `INT/src/react-aria/heading.tsx` | react-aria interim | Supersedes `EXT/src/heading.tsx`. Foundational atom consumed by card/table/timeline-list/description-list. |
| `item` | `INT/src/react-aria/item.tsx` | react-aria interim | Currently the target of INT's `./item` export; coexists with `base-ui/item`. Judgment call 10. |
| `link` | `INT/src/react-aria/link.tsx` | react-aria interim | Supersedes `EXT/src/link.tsx`. |
| `popover` | `INT/src/react-aria/popover.tsx` | react-aria interim | Currently the target of INT's `./popover` export; shared by date cluster and phone island. Coexists with `base-ui/popover`. Judgment call 10. |
| `search-field` | `INT/src/react-aria/search-field.tsx` | react-aria interim | Supersedes `EXT/src/search-field.tsx`. Facet-filter remnant. |
| `span` | `INT/src/react-aria/span.tsx` | react-aria interim | Supersedes `EXT/src/span.tsx` (both are RAC `Text` styled as span). |
| `text` | `INT/src/react-aria/text.tsx` | react-aria interim | Supersedes `EXT/src/text.tsx`. |
| `ui-providers` | `INT/src/react-aria/ui-providers.tsx` | react-aria interim | Supersedes `EXT/src/ui-providers.tsx` (both wrap RAC `RouterProvider`; INT also mounts `ElmeraGroupUiProvider` from `src/ui-context.tsx`). |

### composite tier

| Canonical name | Source of truth | Tier | Overlap / supersedes notes |
|---|---|---|---|
| `alert` | `INT/src/alert.tsx` | composite | Supersedes `EXT/src/alert.tsx`. INT composes `react-aria/item` slots + lucide `Icon`; EXT used `MaterialIcon` + Link. |
| `chart` | `INT/src/chart/` (`chart.tsx`, `index.ts`) | composite | Internal-only. shadcn-style recharts wrapper (`ChartContainer`, `ChartTooltip[Content]`, `ChartLegend[Content]`, `ChartStyle`) **plus `export * from "recharts"`** — judgment call 15. |
| `code` | `INT/src/code.tsx` | composite | Internal-only (`sugar-high` highlighter). |
| `confirm-button` | `INT/src/confirm-button.tsx` | composite | Internal-only (two-step confirm over `base-ui/button`). |
| `emoji` | `INT/src/emoji/index.tsx` | composite | Internal-only. Hand-inlined Twemoji-style SVG set exported as `Emoji`. |
| `numeric-only-text-field` | `EXT/src/numeric-only-text-field.tsx` | composite | **External-only.** Thin filter over `TextField` using `containOnlyNumbers` from `@elmeragroup/validation`. Needs a base-ui decision (judgment call 5): re-home over `base-ui/text-field` or fold in as an `inputMode`/filter prop. |
| `pagination` | `INT/src/pagination.tsx` | composite | Supersedes `EXT/src/pagination.tsx`. Same slot API (`Pagination`, `…Content/Item/Link/Next/Previous/Ellipsis`); divergence is only in dependencies (INT: `base-ui/button-variants` + lucide `Icon` + `react-aria/span`; EXT: its RAC `buttonVariants` + `MaterialIcon`). Low-risk supersede. |
| `phone-number-field` | (listed in base-ui tier) | — | — |
| `popover-info-button` | `INT/src/popover-info-button.tsx` | composite | Internal-only (info "?" button over `base-ui/popover`). |
| `text-area` | `INT/src/text-area.tsx` | composite | Supersedes `EXT/src/text-area.tsx` (RAC). Labeled composite over `base-ui/field` + `base-ui/textarea`. |
| `timeline-list` | `INT/src/timeline-list.tsx` | composite | Supersedes `EXT/src/timeline-list.tsx`. Divergence checked: **identical component/slot names** (`ListItemWithTimeline[Title|Time|Description]`); EXT inlines `timelineVariants` and uses React-19 `ref` props, INT pulls the recipe from `src/styles/timeline.ts` and still uses `forwardRef`. Internal wins; consider adopting EXT's ref style during the port (judgment call 14). |
| `toaster` | `INT/src/toaster.tsx` | composite | Supersedes `EXT/src/toaster.tsx`. Both wrap sonner and re-export `toast`; INT pins sonner `^2.0.7`, EXT `^1.7.4` — major-version delta noted in judgment call 13. |

### unheadless tier

| Canonical name | Source of truth | Tier | Overlap / supersedes notes |
|---|---|---|---|
| `badge` | `INT/src/badge.tsx` | unheadless | Supersedes `EXT/src/badge.tsx`. |
| `brand-logo` | `INT/src/brand-logo.tsx` | unheadless | Supersedes `EXT/src/brand-logo.tsx`. Logo sets differ: INT = Fjordkraft/Trøndelagkraft/Gudbrandsdal (+`*Small`) + ElmeraGroup fallback; EXT = same three (+`*Mini`) + **Telinet**. Judgment call 9. |
| `card` | `INT/src/card.tsx` | unheadless | Supersedes `EXT/src/card.tsx` — but EXT's card API is far richer (`CardSection*`, `CardLabelValue*`, `CardTag`, `CardText`, `CardValue`, …) and INT covers some of that ground with `frame` + `description-list`. Judgment call 7. |
| `description-list` | `INT/src/description-list.tsx` | unheadless | Internal-only. |
| `empty` | `INT/src/empty.tsx` | unheadless | Internal-only (empty-state block). |
| `frame` | `INT/src/frame.tsx` | unheadless | Internal-only. |
| `loader` | `INT/src/loader.tsx` | unheadless | Supersedes `EXT/src/loader.tsx` (EXT spun a `MaterialIcon`; INT spins lucide `Icon.Loader`). |
| `show` | `INT/src/show.tsx` | unheadless | Supersedes `EXT/src/show.tsx` — byte-for-byte the same conditional-render helper. |
| `skeleton` | `INT/src/skeleton.tsx` | unheadless | Internal-only (consumed by `table`). |
| `table` | `INT/src/table.tsx` | unheadless | Supersedes `EXT/src/table.tsx`. Same slot names; INT adds skeleton/`frame` integration and a `Heading` caption. |

### external-only, joining the set (need base-ui decisions)

| Canonical name | Source of truth (today) | Tier (today) | Notes |
|---|---|---|---|
| `accordion` | `EXT/src/accordion.tsx` | unheadless-ish (`@radix-ui/react-accordion`) | Only radix-accordion consumer in either package. Internal answers: `base-ui/disclosure` + `base-ui/collapsible`. Judgment call 2. |
| `list-box` | `EXT/src/list-box.tsx` | react-aria interim | RAC `ListBox` + `DropdownListBox*`. INT has `src/react-aria/list-box.tsx` but it is **not exported and orphaned** (nothing imports it; only its style recipe `src/styles/list-box.ts` is referenced). Judgment call 3. |
| `numeric-only-text-field` | `EXT/src/numeric-only-text-field.tsx` | composite | See composite tier row; judgment call 5. |
| `calendar`, `range-calendar` | `EXT/src/calendar.tsx`, `EXT/src/range-calendar.tsx` | react-aria interim | Public in EXT; implementation superseded by INT's non-exported react-aria versions. Judgment call 4. |
| `modal` | `EXT/src/modal.tsx` | react-aria interim | RAC `Modal`/`ModalOverlay`. INT keeps its RAC modal date-cluster-internal and offers `base-ui/dialog` + `base-ui/sheet` publicly. Judgment call 6. |
| `material-icons` | `EXT/src/material-icons/` | n/a (assets) | 78-icon Material Symbols SVG set exported as `MaterialIcon`. Judgment call 1. |
| `illustrations` | `EXT/src/illustrations/` (`fkas-meter.tsx`, `index.ts`) | n/a (assets) | `Illustration.FkasMeter` only. Brand-specific artwork — likely grows per brand. |
| `utils` | `EXT/src/utils.ts` | utility | `cn`, `tv`, `VariantProps`, `DIALOG_ROOT_ID`, `getBrandClassName`. INT deliberately has no `./utils` export (sources `cn`/`tv` from `@elmeragroup/lib`). Judgment call 12. |

### shared non-component exports

| Export | INT | EXT | Notes |
|---|---|---|---|
| `./ui.css` | `INT/src/styles/ui.css` | `EXT/src/styles/ui.css` | EXT's `ui.css` additionally `@import`s `./brands.css` and `./product-hub-reset.css` (both EXT-only files). Token/theme reconciliation is another ticket's problem; flagged in judgment call 16. |
| `./styles.css` | `dist/index.css` (built) | `dist/index.css` | Build artifact, both. |
| `./styles` | `INT/src/styles/index.ts` | — (EXT re-exports `*Variants` from component files via its non-exported `src/index.ts` barrel) | INT recipe barrel: `badgeVariants, calendarVariants, cardVariants, dateFieldVariants, datePickerVariants, dialogVariants, fieldVariants/fieldGroupVariants/fieldBorderVariants, headingVariants, linkVariants, listBoxVariants, loaderVariants, modalVariants, paginationVariants, popoverVariants, scrollAreaVariants, searchFieldVariants, spanVariants, textVariants, textFieldVariants, timelineVariants, toasterVariants` + `focusRing`, `disabledHatch` (from `src/styles/utils.ts`). Note the filename typo `src/styles/paginaton.ts`. |
| `./types` | `INT/src/types/index.ts` | `EXT/src/types/index.ts` | Identical: re-export of `ValidationErrors` from `@react-types/shared`. RAC-coupled — dies with the interim tier. |
| `./icons` | `INT/src/icons/index.ts` | `EXT/src/icons/index.ts` | See icon section below. |
| `./hooks` | `INT/src/hooks/index.ts` | — | See hooks section below. |

---

## Hooks

INT-only (`./hooks` → `INT/src/hooks/index.ts`):

| Hook | File |
|---|---|
| `useIsMobile` | `INT/src/hooks/use-is-mobile.ts` (also consumed by `base-ui/sidebar`) |
| `useMergedRefs` | `INT/src/hooks/use-merged-refs.ts` |
| `usePredictedEvents` | `INT/src/hooks/use-predicted-events.ts` |
| `useRefWithInit` | `INT/src/hooks/use-ref-with-init.ts` |

Not exported: `usePhoneNumberFieldState` (`INT/src/base-ui/phone-number-field/hooks/use-phone-number-field-state.ts`) — internal to phone-number-field; keep private.

EXT has no hooks export.

## Icons / logos / illustrations

Two incompatible icon systems exist — **judgment call 1**.

**INT `./icons`** (`INT/src/icons/index.ts`):
- `Icon` — a ~150-key map of **lucide-react** icons (with renames: `Building: Building2`, `Details: TextSearch`, `Loader: Loader2`, `Trash: Trash2`) plus embedded product logos (`CollectLogo`, `DeviateLogo`, `OrderLogo`, `FunnelLogo`, `DoubleCheck`).
- Named brand logo exports: `ElmeraGroupLogo(+Small)`, `FjordkraftLogo(+Small)`, `GudbrandsdalEnergiLogo(+Small)`, `TrondelagkraftLogo(+Small)`, `SteddiLogo`, `TrumfLogo(+Small)`.
- Re-exported types: `LucideIcon`, `LucideProps`.
- **Orphan:** `INT/src/icons/nordic-green-energy-sweden-logo.tsx` exists but is imported nowhere (not in the index barrel, no other references).

**EXT `./icons`** (`EXT/src/icons/index.ts`):
- `Icon` — a small map of bespoke SVGs: `Alert`, `BankIdDna`, `BankIdSweden`, `Contract`, `HomeTitleIcon`, `Signing`, `StromSmart`, `Vipps` (customer-facing payment/signing assets — external-only, must join the union).
- Logos: `FjordkraftLogo`, `GudbrandsdalEnergiLogo`, `TelinetLogo`, `TrondelagkraftLogo`; plus non-barrel mini variants `fjordkraft-logo-mini.tsx`, `telinet-logo-mini.tsx`, `trondelagkraft-logo-mini.tsx` (imported directly by `EXT/src/brand-logo.tsx`).

**EXT `./material-icons`** (`EXT/src/material-icons/index.ts`): `MaterialIcon` map over 78 Material Symbols SVGs (+ `README.md`). Used pervasively inside EXT components (loader, pagination, accordion, alert, button…), so the icon-system decision gates every EXT component port.

**EXT `./illustrations`** (`EXT/src/illustrations/index.ts`): `Illustration.FkasMeter` (`fkas-meter.tsx`).

## Utilities

| Utility | INT | EXT | Reconciliation |
|---|---|---|---|
| `cn`, `tv`, `VariantProps` | imported from `@elmeragroup/lib` everywhere (e.g. `INT/src/alert.tsx`) — **not part of the ui package** | exported from `EXT/src/utils.ts` | Internal wins: utilities live in `@elmeragroup/lib`; drop the `./utils` export (judgment call 12). |
| `composeTailwindRenderProps` | `INT/src/react-aria/utils.ts` (not exported; RAC-only helper) | `EXT/src/compose-tailwind-render-props.ts` (not exported) | Identical function, duplicated. Keep INT's copy, private, dies with the interim tier. |
| `getBrandClassName`, `DIALOG_ROOT_ID` | — | `EXT/src/utils.ts` | External-only. `getBrandClassName` couples to `EXT/src/styles/brands.css` theme classes; belongs to the theming ticket, not the component package. `DIALOG_ROOT_ID` is a portal-target convention — decide where it lands. |
| `focusRing`, `disabledHatch` | `INT/src/styles/utils.ts` via `./styles` barrel | `focusRing`, `focusVisibleRing` exported from `EXT/src/button.tsx` | Internal wins. |
| `toast` (sonner re-export) | `INT/src/toaster.tsx` | `EXT/src/toaster.tsx` | Internal wins. |

## Not-exported internals (inventory)

**INT** (files with no exports-map entry):

| File | Role |
|---|---|
| `INT/src/react-aria/button.tsx` | RAC Button used only inside the date cluster + `file-trigger`/`search-field`/`calendar`/`dialog`. Private. |
| `INT/src/react-aria/calendar.tsx` | Date-cluster internal (see judgment call 4). |
| `INT/src/react-aria/range-calendar.tsx` | Date-cluster internal (judgment call 4). |
| `INT/src/react-aria/dialog.tsx` | Date-internal overlay. Private. |
| `INT/src/react-aria/modal.tsx` | Date-internal overlay. Private. |
| `INT/src/react-aria/list-box.tsx` | **Orphaned** — imported by nothing (README's "phone island list-box" claim is stale; phone-number-field now uses base-ui Combobox). Candidate for deletion unless it seeds the `list-box` decision (judgment call 3). |
| `INT/src/react-aria/utils.ts` | `composeTailwindRenderProps`. Private RAC helper. |
| `INT/src/base-ui/selection-item.tsx` | Shared slot layer under `radio-group` (re-exported as `RadioItem*`) and `checkbox.tsx`. Private. |
| `INT/src/ui-context.tsx` | `ElmeraGroupUiProvider` / `useElmeraGroupUi` (userAgent + locale). Mounted by `react-aria/ui-providers.tsx`; consumed by phone-number-field. Private, but load-bearing for SSR locale/UA. |
| `INT/src/constants/meter-constants.ts` | `METER_CONSTANTS` modes/levels for `base-ui/meter`. Private. |
| `INT/src/icons/nordic-green-energy-sweden-logo.tsx` | Orphan logo (never imported). NGE is out of scope per CONTEXT.md. |
| `INT/src/styles/*.ts` recipes | Reached via the `./styles` barrel, so effectively public. |

**EXT**:

| File | Role |
|---|---|
| `EXT/src/index.ts` | Full barrel of every component + variant — **not referenced by the exports map** (dead export surface; consumers use subpaths). Do not carry it forward. |
| `EXT/src/compose-tailwind-render-props.ts` | Duplicate of INT's RAC helper. |
| `EXT/src/styles/brands.css`, `EXT/src/styles/product-hub-reset.css` | Pulled in via `EXT/src/styles/ui.css` `@import`s; theming-ticket territory. |
| `EXT/src/icons/*-mini.tsx`, `EXT/src/icons/signing.tsx` | Reached via `brand-logo`/icons barrel respectively. |

---

## Judgment calls for the human

1. **Icon system: lucide vs Material Symbols.** INT ships `Icon` as a ~150-key lucide map (`INT/src/icons/index.ts`, dep `lucide-react`); EXT ships `MaterialIcon` (78 Material SVGs, `EXT/src/material-icons/index.ts`) and uses it *inside* its components. The union rule keeps both, but every EXT component port swaps MaterialIcon → lucide. Decide: (a) lucide-only, `material-icons` dropped after external app migrates; (b) keep `./material-icons` as a legacy export for the external app's own use, components use lucide; or (c) two blessed sets long-term (doubtful). Also decide the fate of EXT's bespoke `Icon` SVGs (BankID/Vipps/Signing/StromSmart) — payment/signing assets the external app genuinely needs; suggest a separate `./icons` namespace slot for them.
2. **`accordion` (external-only, radix).** `EXT/src/accordion.tsx` is the only `@radix-ui/react-accordion` consumer anywhere. Internal already has `base-ui/disclosure` and `base-ui/collapsible`. Decide: reimplement `accordion` on base-ui (base-ui has an Accordion primitive) vs. telling the external app to migrate to `disclosure`. Keeping radix for one component seems wrong.
3. **`list-box` (external-only, RAC).** `EXT/src/list-box.tsx` exports `ListBox`, `ListBoxItem`, `DropdownListBox*`. INT's `react-aria/list-box.tsx` is unexported **and orphaned**, and the README defers this to the "listbox/filter rewrite". Decide: admit `list-box` into the interim tier from EXT's source, or declare `base-ui/select`/`base-ui/combobox` popups the replacement and give the external app a migration note.
4. **Export `calendar` / `range-calendar`?** EXT exports both publicly; INT keeps its (winning) implementations private inside the date cluster (`INT/src/react-aria/calendar.tsx`, `range-calendar.tsx`). If any external screen renders a standalone calendar, v1 must export them (interim tier); otherwise keep them private and shrink the interim surface.
5. **`numeric-only-text-field` (external-only).** Trivial composite (`EXT/src/numeric-only-text-field.tsx`) filtering via `containOnlyNumbers`. Decide: keep as a named component re-based on `base-ui/text-field`, or fold into `text-field` as an `inputMode="numeric"`/filter prop and drop the export.
6. **`modal` (external-only export).** EXT's RAC `Modal`/`ModalOverlay` vs internal's public `base-ui/dialog` + `base-ui/sheet` (INT's own RAC modal stays date-internal). Recommend superseding `modal` with `dialog`/`sheet`; needs sign-off because it deletes an EXT public path rather than renaming it. Related: EXT's `DIALOG_ROOT_ID` portal convention (`EXT/src/utils.ts`) has no INT counterpart.
7. **Card API width.** EXT's card (`EXT/src/card.tsx`) exports 18 slots (`CardSection*`, `CardLabelValue*`, `CardTag`, `CardValue`, …, including RAC-Button-based `CardSectionButton`); INT's card (`INT/src/card.tsx`) is minimal, with `frame` + `description-list` covering adjacent needs. Internal wins by rule, but the external app's screens are built on the rich API. Decide which EXT card slots get ported into the canonical card vs. mapped to `frame`/`description-list`/`item`.
8. **Selection-card parity.** EXT: `RadioCard` (`EXT/src/radio-group.tsx`), `CheckboxCard` + `CheckboxCardHorizontal` (`EXT/src/checkbox.tsx`). INT: `checkbox-card` and `RadioItem*` slots over `base-ui/selection-item.tsx` — no horizontal checkbox-card, no literal `RadioCard`. Confirm the INT patterns cover EXT's card layouts (esp. horizontal) before declaring supersession complete.
9. **Brand logo set.** EXT ships **Telinet** logos (`EXT/src/icons/telinet-logo.tsx`, `telinet-logo-mini.tsx`, wired into `EXT/src/brand-logo.tsx`) — Telinet appears in *neither* the five in-scope brands nor the out-of-scope list in `CONTEXT.md`. INT ships Steddi/Trumf/ElmeraGroup logos (out of scope per glossary) and an orphaned NGE-Sweden logo. Decide the v1 logo roster and whether `brand-logo`'s brand union includes Telinet; also reconcile the size-variant naming (`*Small` vs `*Mini`).
10. **Dual exports: `./field` vs `./base-ui/field`, `./popover` vs `./base-ui/popover`, `./item` vs `./base-ui/item`, `./button` (shim) vs `./base-ui/button`.** INT currently exports the RAC atom at the bare path and the base-ui one under `base-ui/`. For v1, decide the canonical path policy: bare paths point at the *winning tier* (base-ui) with interim atoms quarantined under an explicit prefix, or preserve INT's layout verbatim. This decision shapes every consumer import and the eventual RAC uninstall.
11. **Two separators.** INT exports both `./separator` (`INT/src/separator.tsx`) and `./base-ui/separator` (`INT/src/base-ui/separator.tsx`), both base-ui-primitive-based. Pick one, delete the other.
12. **`./utils` export.** EXT exposes `cn`/`tv` from the ui package; INT sources them from `@elmeragroup/lib` and exports nothing. Recommend the INT stance (utilities live in lib), but the external app imports `@elmeragroup/ui/utils` today — decide whether v1 ships a deprecation re-export.
13. **sonner major version.** INT `^2.0.7` vs EXT `^1.7.4`. v1 standardizes on 2.x; external app's `toast` call sites need a compat check.
14. **Ref style during ports.** EXT files already use React-19 `ref`-as-prop; INT still `forwardRef` in places (e.g. `INT/src/timeline-list.tsx`). Internal wins on implementation, but decide whether ports modernize to ref-as-prop as they land (both packages are on React 19). Feeds the Component API spec template.
15. **`chart` re-exporting all of recharts.** `INT/src/chart/index.ts` does `export * from "recharts"` — the entire recharts API becomes public surface of `@elmeragroup/ui/chart`. Decide whether v1 narrows this to the shadcn-style wrappers + an explicit primitive list.
16. **External-only CSS.** `EXT/src/styles/brands.css` (brand theme classes consumed by `getBrandClassName`) and `product-hub-reset.css` are imported by EXT's `ui.css`. They are theming/token concerns, not components — confirm they route to the theme/token workstream rather than this inventory.
17. **Housekeeping (low stakes, still human-visible):** orphaned `INT/src/react-aria/list-box.tsx` and `INT/src/icons/nordic-green-energy-sweden-logo.tsx`; stale phone-island claim in `INT/src/react-aria/README.md`; filename typo `INT/src/styles/paginaton.ts`; EXT's dead `EXT/src/index.ts` barrel.
