# Remaining implementation after the accepted PoC

Input for `/to-tickets` and a later loop/wave spec. Written against the current implementation specification and the accepted PoC (tickets 01–09), not recollection. This ticket implements no library or docs features and does not start the waves below.

> **Amended 2026-08-21** against the post-PoC theme track (`7d60222..31ef4eb`): the Elmera visual identity (`elma`) landed — the matrix is **20 themes / 6 brands**, not 16/5; the color-scheme runtime moved to a host-placed closed bootstrap (`ColorSchemeScript` / `colorSchemeScriptSource`, `ForceColorScheme`, `injectColorSchemeScript` defaulting `false`); deployment-fixed **density** landed (`data-density` on the document root, `--control-*` implementation variables in `ui.css`, `defaultDensityForVariant` / `densityAttributes` on `/theme`, `elmera/no-hardcoded-density-metrics` lint); `BrandLogo` shipped early in `/icons` as an accessible text/`displayName` span fallback (icons.md §4 contract — SVG marks still owed); `apps/static-theme` (Vite first-paint fixture) exists; oxlint runs deny-warnings. Density preference/persistence is roadmap §10, not v1.

**PoC kept.** Tickets 01–09 are accepted. Keep the workspace, token pipeline, `/theme`, generated exports + tsdown pack gates, Phosphor adapters, Button, ScrollArea, and the docs-app MVP. Do not restart foundation.

**Counts.** Appendix A is exhaustive: **56** bare component entries + **11** quarantined `react-aria/` entries = **67** canonical components, plus non-component JS (`theme`, `icons`, `illustrations`, `flags`) and CSS/assets. PoC shipped **2** bare components (`button`, `scroll-area`). Remaining: **54** bare + **11** RAC = **65** components, plus leftover assets, leftover spine, leftover docs pipeline, leftover release, and a short list of foundation leftovers.

Roadmap items in [docs/spec/roadmap.md](../../docs/spec/roadmap.md) are **not** v1 waves (RAC→base-ui migration, dark values, VR, extra brands, Phosphor-core codegen, nn-NO, shadcn registry, in-browser playground editor). OrderModule app migrations stay out of scope.

---

## 0 How to read this file

Sequencing follows [docs/spec/README.md](../../docs/spec/README.md) §How to implement:

1. Foundation leftovers (everything later depends on this layer; most of it already landed).
2. Assets (bespoke/logos/illustrations/flags) before components replace reference icons or render countries.
3. Component spine leftovers (`Separator`, `Field`, `Input`, `Item`) plus the package-private RAC support stack.
4. Load-bearing edges named in the README.
5. Remaining families once their imports exist.
6. Docs pipeline (not the PoC MVP).
7. Release (org-setup HITL blocks publish, not development).

Within a dependency-ready group, every component ships with its spec’s §9 tests and §10 demos in the same change. No temporary public paths. No placeholder exports. No invented Appendix A names.

`.ref/` is lift source only. Coupling below is estimated from those graphs plus each spec’s anatomy/§8; APIs stay in the component specs.

---

## 1 What the accepted PoC already proved

Keep this layer. Later waves must not re-open it except to extend it (new entry files, new catalog pins, new dictionary owners).

| Layer | Landed | Evidence |
| --- | --- | --- |
| Workspace | pnpm 11 catalog, turbo graph, oxlint + anti-slop, oxfmt, vitest unit/browser/types, shared TS configs | tickets 02 |
| Tokens / CSS | 20-permutation `themes.css` codegen (15 emitted rules, `elma` included), dual CSS (`/css` + `/styles.css`), contrast-matrix snapshot, 20-theme contract test, central reduced-motion, `--control-*` density variables (`:root` dense / `:root[data-density="comfortable"]`) | tickets 03 + theme track |
| Theme + locale | `ThemeProvider` / `ThemeScope` / `useTheme` / `themeAttributes` / `validateTheme` / `BRANDS` / `ColorSchemeScript` / `colorSchemeScriptSource` / `ForceColorScheme` / `useColorScheme` / `defaultDensityForVariant` / `densityAttributes` / `ElmeraGroupUiProvider` / `useElmeraGroupUi` | tickets 04 + theme track |
| Color scheme + density | Host-placed closed color-scheme bootstrap + provider-owned runtime marker (`data-theme`), commit-safe store; deployment-fixed density stamped by the host on `<html>` (`dense` internal / `comfortable` external); painted canvas stays light until dark values land | theme track (`7d60222..31ef4eb`) |
| BrandLogo (fallback) | `/icons` exports `BrandLogo` — exhaustive six-code switch rendering an accessible `<span>` `displayName` fallback per icons.md §4; already in `runtimeExportsFor("icons")` | theme track |
| First-paint hosts | `apps/docs` verified Next App Router recipe (attrs + density on `<html>`, script in `<head>`, `suppressHydrationWarning`); `apps/static-theme` Vite HTML-adapter fixture incl. isolated comfortable stamp | theme track |
| Overlay resolver | package-private `useThemeScopeContainer`: explicit element/ref → nearest `ThemeScope` → `undefined`; `null` means wait, not `document.body` | ticket 04 browser tests; **no overlay consumer yet** |
| Package shape | generated `exports`, tsdown unbundle, `publishConfig.directory: "dist"` + `linkDirectory: false`, publint / attw / export-path / emitted-directive | tickets 05, 09 |
| Phosphor | 111 SSR adapters, `weight` narrowed, `/icons` subpath-only | ticket 06 |
| Button | `useRender`, public `buttonVariants`, pending / visually-disabled, shared intent registry, `focusRing({ target: "self" })` | ticket 07 |
| ScrollArea | compound Root + Bar, batteries-included viewport | ticket 08 |
| Docs MVP | Next `(docs)` three-column chrome, docs-local SideNav/QuickNav over library ScrollArea, host-owned theme selects, live Button + ScrollArea pages, blank `(private)` / `(website)` | ticket 09 |

**PoC leftovers that are real remaining work (not parked taste):**

- `size-limit` is still `"true"`. Performance.md §2 budgets are not enforced.
- Packed-consumer fixtures (`fixtures/next-app-router`, `fixtures/vite`) do not exist. Publish-only per tooling.md §7.5 / release.md §5.
- Flags packed-asset contract in `package-check` is a no-op until `flags/` exists.
- `runtimeExportsFor` in `packages/ui/scripts/entries.ts` only names `.`, `theme`, `icons`, `button`, `scroll-area`. Adding a component without extending that map ships an entry whose names are not asserted.
- Root barrel `packages/ui/src/index.ts` is hand-written (`export *` of button, scroll-area, theme). Parallel component tickets will conflict here unless barrel generation lands first.
- Catalog does not yet pin `react-aria-components`, `react-aria`, `@internationalized/date`, `@internationalized/string`, `libphonenumber-js`, `sugar-high`, `recharts`. `entries.ts` already lists them as allowed runtime deps; they are not installed.
- No `useLocalizedStrings` / co-located `intl/` dictionaries. Locale *context* exists; string *resolution* does not.
- RAC `UiProviders` is not implemented (ticket 04 shipped the permanent provider only).
- No RAC import lint yet (`react-aria-components` / `react-aria` / `@internationalized/date` only from the private RAC subtree or `react-aria/` facades).
- No `apps/playground`, no plop generator, no changesets, no `.github/` workflows.
- Docs type-check Next preset is still local compiler-option drift (ticket 09 review, dropped for PoC acceptance).
- Shared `focusRing` visual CSS assertion (ring on `:focus-visible`, absent on mouse focus) is still owed (accessibility.md §8; ticket 07 leftover).
- Playwright Chromium is a local cache; CI images must install it.
- `oxfmt` still ignores `docs/**`, `wayfinder/**`, `CONTEXT.md`.

Those leftovers belong in the waves below. They are not reasons to reopen 01–09.

---

## 2 Remaining work mapped to the README sequence

### 2.1 Foundation leftovers

Most of “scaffold / exports / tokens / theme / locale” is done. What is still owed before (or immediately as) the first remaining families:

| Leftover | Owner chapter | Why it is still serial / shared |
| --- | --- | --- |
| Barrel + `runtimeExportsFor` generation | architecture.md §2–3 | Today both are hand-maintained. Every new `src/<name>.ts` is auto-*discovered* for `exports`, but the root barrel and pack-time name list are not. Two worktrees adding **bare components** will conflict on `index.ts` and `entries.ts`. **Land a mechanical register step before parallel component waves.** Suggested: generate `src/index.ts` from discovered **bare** entries + theme only (architecture.md §2 / ADR 0005: 56 components + `/theme`; never `/icons`, `/illustrations`, `/flags`); generate `runtimeExportsFor` from a per-entry `exports:` list next to the facade (or a single `scripts/runtime-exports.ts` map) covering those subpath-only JS entries as well. Hand-editing `package.json#exports` stays forbidden. |
| `useLocalizedStrings` + dictionary convention | accessibility.md §4, ADR 0006 | Package-private hook over `@internationalized/string`. First string-bearing component cannot ship without it. Catalog-pin `@internationalized/string@^3.2.10` with the hook. Locked copy lives in accessibility.md §4.1 — do not invent keys. |
| RAC import quarantine lint | architecture.md §2.2, performance.md §5 | `react-aria-components`, `react-aria`, `@internationalized/date` importable only from `src/react-aria/**` or `react-aria/` entry facades. Land before any RAC source exists so the first RAC ticket cannot leak. |
| Overlay helper usage | theming.md §7.4, conventions.md | Resolver exists and is tested in isolation. First overlay (Dialog) is the first-of-kind *consumer*. Subsequent overlays copy that pattern; do not re-implement resolution. |
| Shared close-button rendering | dialog.md §8, sheet.md | Dialog’s ghost `icon-sm` + sr-only locale `close` + `hit-area-1` is the shared close control Sheet reuses. Extract as package-private when Dialog lands; Sheet must not fork it. |
| Catalog pins for remaining runtime deps | architecture.md §6 | Pin in `pnpm-workspace.yaml` **when the first consumer ticket needs them**, not all at once: `@internationalized/string` with the intl hook; RAC trio + `@internationalized/date` with the RAC stack; `libphonenumber-js@^1.13.9` with flags/PhoneNumberField; `sugar-high` with Code; `recharts@^2.15.4` optional peer with Chart. Do not install unused deps “for later.” |
| `size-limit` harness | performance.md §2, tooling.md §3 | Replace the stub. Calibrate each ceiling to **measured × ~1.5** at first real build of that entry, then ratchet. Can land as a harness on current entries (`.` / `theme` / `icons` / `button` / `scroll-area` / CSS) before the rest of the 67, then extend per new entry. |
| Packed fixtures | tooling.md §7.5, release.md §5 | `fixtures/next-app-router` (Tailwind-source + RSC server page + client island) and `fixtures/vite` (standalone CSS). Install the `pnpm pack` tarball, never `workspace:`. Assert flag SVG URLs once flags exist. **Publish-only**, not merge-gate. Wait until flags + at least one server-safe and one client component exist (Phosphor + Button already satisfy the icon/RSC slice; flags are the blocker for the asset assertion). |
| Plop `pnpm gen component` | tooling.md §6 | Stubs component + tests + demo + docs MDX page + source entry. Helpful once MDX exists; not a blocker for the spine. Do not let scaffolding invent APIs. |
| Playground app | docs-site.md §7, tooling.md §1 | Standalone workspace consumer, source exports, no in-browser editor. Can start after a handful of components exist; not on the serial backbone. |
| Next TS preset | tooling.md §2 | `tooling/typescript` still lacks an apps/Next preset; `apps/docs` drifts compiler options. Fold into the first docs-pipeline or playground ticket. |
| CI Playwright + merge workflow | tooling.md §8 | No `.github/` yet. Merge workflow = oxfmt + `ci:checks` + changeset presence. Needs changesets (release) and a Playwright install step. |

**Do not touch in leftover-foundation tickets:** token value modules, `themes.css` generator, ThemeProvider/ThemeScope contracts, Button/ScrollArea APIs, docs MVP chrome (except registering new pages later).

### 2.2 Assets

Phosphor adapters (111) are done. Remaining public asset surface:

#### 2.2.1 Bespoke icons + logos + `BrandLogo` (extend `/icons`)

[icons.md](../../docs/spec/icons.md) §3–4. Same entry as Phosphor; **not** in the root barrel.

Bespoke (hand-authored SVG React components, `ComponentPropsWithoutRef<"svg"> & { title?: string }`):

| Export | Pinned source |
| --- | --- |
| `BankIdDna`, `BankIdSweden`, `Vipps`, `Signing`, `Contract`, `StromSmart`, `AlertMark`, `HomeTitleIcon` | `.ref/OrderModuleWeb/packages/ui/src/icons/…` |
| `OrderLogo`, `CollectLogo`, `DeviateLogo`, `FunnelLogo`, `DoubleCheck` | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/…` |

`Alert` asset is named `AlertMark` to avoid colliding with the `Alert` component. `Signing` is the one theme-aware bespoke: four Material class renames (`fill-secondary-container` → `fill-secondary-soft`, etc.). Raw `.svg` inputs become ordinary React modules; no SVGR consumer requirement.

Logos: `FjordkraftLogo`, `TrondelagkraftLogo`, `GudbrandsdalEnergiLogo`, `TelinetLogo`, `ElmeraGroupLogo`, `SteddiLogo`, `TrumfLogo` — `variant?: "full" | "mark"` (no `Small`/`Mini`). Steddi has one glyph for both variants.

`BrandLogo` **already shipped** (theme track) as the icons.md §4 fallback contract: exhaustive six-code switch (`fkas`/`fkab` → Fjordkraft, `tkas` → TrøndelagKraft, `guen` → Gudbrandsdal Energi, `fkse` → Telinet, `elma` → Elmera Group) rendering an accessible text/`displayName` `<span>`; reads no context; six-code snapshot + type tests exist. The A2 remaining work for it is swapping energy-brand fallbacks to the real SVG marks when the logo components land — do not re-ticket the switch or the contract.

Tests already named in icons.md §6: titled vs decorative SVG, `Signing` fill classes, `BrandLogo` six-code snapshot (`elma` asserts text fallback, no SVG), Next packed fixture later.

#### 2.2.2 Illustrations (`/illustrations`)

`FkasMeter` from `.ref/OrderModuleWeb/packages/ui/src/illustrations/fkas-meter.tsx`. Subpath-only. Same optional-title a11y contract. `entries.ts` already allowlists the entry; it appears in `exports` only once `src/illustrations.ts` exists.

#### 2.2.3 Flags (`/flags` + `flags/*.svg`) — first-of-kind

[architecture.md](../../docs/spec/architecture.md) §6a + icons.md §5. **This is the asset ticket PhoneNumberField cannot start without.** Subpath-only (`@elmeragroup/ui/flags`); **not** in the root barrel.

- Vendor exactly the pinned snapshot’s **249 two-letter** SVGs from `.ref/flag-icons` commit `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e`. No subdivision/collection files (`US-CA`, `GB-ENG`, `LGBT`, …).
- Generated manifest module: `flagAssets` + `FlagAssetCode`. **Not** generated from `libphonenumber-js`.
- Consumption is `<img src={flagAssets[code]}>` only. `new URL("./flags/<CC>.svg", import.meta.url).href`. No inline, sprite, CDN, emoji-flag, or user-agent branch.
- Payload gate: 249 files, **765,286 raw bytes**, aggregate ceiling **800 KiB**, plus `flags/LICENSE` + `flags/PROVENANCE.md`.
- Baseline libphonenumber→asset gap is exactly `AC`, `BQ`, `EH`, `TA`. A refresh that changes that set is a reviewed contract change.
- `discoverEntries` already emits `flags/*.svg` when `src/flags/` is non-empty. `package-check`’s packed-asset function must stop being a no-op: count, hashes, licenses, representative `NO`/`SE`/`FI` URLs, no http(s)/data/blob schemes.

Flags can land **before** PhoneNumberField. PhoneNumberField then intersects `getCountries(metadata)` with `code in flagAssets` and the 28-country product exclusion list (phone-number-field.md §3). Do not invent a public `Flag` component; `Flag` stays package-private inside PhoneNumberField.

#### 2.2.4 Emoji (component, not `/icons`)

`emoji` is a **bare component entry** (Twemoji-derived five faces, CC BY 4.0 notice in the tarball). Independent of flags/logos. Can sit in a display-family wave. Do not fold it into `/icons`.

### 2.3 Component spine leftovers

README: implement `Button` (done), `Separator`, `Field`, `Input`, and `Item`, plus the package-private RAC support stack, before the wider families.

#### Separator — `@elmeragroup/ui/separator`

Leaf. Canonical file is `.ref/.../base-ui/separator.tsx`; the root `src/separator.tsx` in the ref is retired. `data-slot="separator"` **before** `{...props}` (SidebarSeparator override). CSS orientation via `data-horizontal` / `data-vertical`, vertical `self-stretch` (not `h-full`). Used by Field.Separator, Item.Separator, ButtonGroup.Separator, Sidebar.Separator. **First spine ticket.**

#### Field — `@elmeragroup/ui/field`

Twelve-part namespace. Unlabeled building block. Uses canonical Separator. `fieldVariants` **module-private**. Primitive naming (`disabled`/`invalid`). `Field.Title` keeps `data-slot="field-label"` on purpose. This is the labeling mechanism every form composite builds on (accessibility.md §3). Tests require an Input (or Field.Control) — ship Field **immediately before or with** Input.

#### Input — `@elmeragroup/ui/input`

Single unlabeled control. `bg-card`, no tv recipe, `focusRing({ target: "self" })`. Field-wired. Grouped usage goes through `InputGroup.Input` later (slot overridden to `input-group-control`).

#### Item — `@elmeragroup/ui/item`

Ten-part namespace. Public **`itemVariants`** (SelectionItem borrows it). `useRender` state exemplar (`data-slot`/`data-variant`/`data-size` survive `render`). Group context defaults `role="listitem"` inside `Item.Group`. Uses Separator. RAC `item.tsx` is retired — Alert re-homes onto this Item.

**Spine order (serial):**

```text
Separator
   ├── Field ── Input ── (Textarea can land beside Input; it is the other unlabeled control)
   └── Item
```

`Textarea` is not named in the README spine but InputGroup and TextareaField need it. Treat it as spine-adjacent: same wave as Input, after Field (tests use Field for invalid).

#### Package-private RAC support stack

Not a public entry. Required before any of the 11 `react-aria/` components. Date-picker.md §2 names the stack:

| Private module | Job |
| --- | --- |
| `src/react-aria/internal/button.tsx` | RAC `Button` borrowing public `buttonVariants` (Calendar prev/next and picker trigger cannot use the base-ui Button) |
| `src/react-aria/internal/field.tsx` | RAC Label / Input / Description / FieldError / FieldGroup + private `fieldGroupVariants` |
| `src/react-aria/internal/checkbox.ts` | private `checkboxVariants` for GridList’s RAC selection checkbox |
| `src/react-aria/internal/dialog.tsx` | styled RAC Dialog chrome |
| `src/react-aria/internal/modal.tsx` | RAC Modal; `shouldCloseOnInteractOutside` uses `OVERLAY_CONTAINER_ATTR` |
| `src/react-aria/internal/popover.tsx` | RAC Popover; stamps `OVERLAY_CONTAINER_ATTR`; portal via `useThemeScopeContainer` |
| `OVERLAY_CONTAINER_ATTR` | package-private constant (`data-overlay-container` / `"popover"`) — DatePicker-inside-Modal seam |
| `composeTailwindRenderProps` | RAC className render-prop composer (GridList) |

None of these appear in `package.json#exports`. RAC `heading`/`text`/`span`/`item`/`field`/`popover` **public** ref paths are not reproduced: heading/text/span are re-homed at bare paths; field/item/popover RAC publics are dropped.

Install RAC deps (`react-aria-components@1.19.0`, `react-aria@3.50.0`, `@internationalized/date@^3.12.2`) with this stack, not earlier. `tailwindcss-react-aria-components@2.2.0` is already in the catalog and imported from `ui.css`.

### 2.4 Load-bearing edges (README, explicit)

Do not start the right-hand side until the left-hand side is a real public (or named private) import.

| Edge | After | Then |
| --- | --- | --- |
| Dialog → AlertDialog / Sheet | Dialog (first overlay) | AlertDialog reuses `Dialog.Content` + `role="alertdialog"` (not base-ui AlertDialog). Sheet is `@base-ui/react/drawer` but **shares Dialog’s close-button**. |
| Field + Input → text/form composites | Field, Input, (Card for TextField `variant="card"`) | TextField (public `textFieldVariants`), TextareaField, NumberField |
| Input + Textarea + Button → InputGroup | Input, Textarea, Button | InputGroup. Then Combobox (tightly coupled). Then PhoneNumberField (**does not** use public Combobox). |
| InputGroup + Field → PhoneNumberField | Field, InputGroup, flags, `textFieldVariants`, libphonenumber-js, intl hook | Direct `import { Combobox } from "@base-ui/react"` (root import is a load-bearing hack). Private Flag + `usePhoneNumberFieldState`. |
| Item + Field → SelectionItem → checkbox/radio cards | Item, Field | SelectionItem.Shell. Then CheckboxItem / RadioItem (namespace **aliases of the same objects** so `child.type` partitioning works). CheckboxCard is a *different* surface (Card + Badge + Field.Item), not SelectionItem. |
| Toggle → ToggleGroup | Toggle (public `toggleVariants`) | ToggleGroup.Item borrows the recipe |
| Calendar + DateField → DatePicker / DateRangePicker | RAC stack, Calendar, DateField, (RangeCalendar for the range picker) | DatePicker / DateRangePicker compose public DateInput + Calendar/RangeCalendar + private RAC overlays |
| Popover → PopoverInfoButton | Popover, Button, intl | Convenience composite; de-RAC’d onto base-ui Button |
| Item + Button → Alert | Item, Button | Full re-home from RAC item |
| Button → ConfirmButton, Pagination, FileTrigger (RAC button + `buttonVariants`) | Button | ConfirmButton is behavioral only. Pagination borrows `buttonVariants`. |
| ButtonGroup → canonical Separator | Separator, Button | `[data-slot]` is the join contract |
| Sheet + Tooltip + Input + Separator + Skeleton + Button → Sidebar | those six | **Later shell.** Docs chrome must not import it. |

PhoneNumberField vs Combobox: README is explicit — PhoneNumberField uses **direct** `@base-ui/react` Combobox primitives, not `@elmeragroup/ui/combobox`. The two tickets are not a spine edge. Combobox still needs InputGroup; PhoneNumberField needs InputGroup + Field + flags. They can land in the same wave after InputGroup, in **separate** tickets.

### 2.5 Remaining families (65 components)

Shipped: `button`, `scroll-area`. Everything else in Appendix A.

#### A. Unlabeled controls & layout primitives (after spine, mostly parallel)

| Component | Depends on | Notes |
| --- | --- | --- |
| `textarea` | Field only for invalid demos | Server-safe native element. InputGroup.Textarea and TextareaField need it. |
| `switch` | Field for labeled demos | Unlabeled primitive |
| `toggle` | — | Public `toggleVariants` |
| `collapsible` | — | Unstyled passthrough; `focusRing` on Trigger |
| `avatar` | — | base-ui Avatar, client |
| `skeleton` | — | Server; Sidebar.MenuSkeleton later |
| `loader` | Phosphor `SpinnerGap` | Public `loaderVariants`; server |
| `badge` | — | Public `badgeVariants`; CheckboxCard borrows |
| `card` | — | Public `cardVariants`; TextField `card` variant + CheckboxCard borrow |
| `separator` | — | Spine |
| `show` | — | Render helper, no DOM |

#### B. Typography (re-homed; no RAC)

| Component | Depends on | Notes |
| --- | --- | --- |
| `heading` | — | Public `headingVariants`; client (`useRender`). TimelineList.Title composes it. |
| `text` | — | Public `textVariants` |
| `span` | `textVariants` | `spanVariants` extends `textVariants`. Land **after** Text in the same wave, not a different wave. |

DescriptionList.Heading is a **plain `<h2>`**, not the Heading component (spec anatomy). TimelineList.Title **does** render Heading.

#### C. Form composites (after Field + Input + Textarea + Card)

| Component | Depends on | Notes |
| --- | --- | --- |
| `input-group` | Input, Textarea, Button | `focusRing({ target: "within" })`; `InputGroup.Text` must emit `data-slot="input-group-text"` |
| `text-field` | Field, Input, `cardVariants` | Public `textFieldVariants`; PhoneNumberField borrows it |
| `textarea-field` | Field, Textarea | Labeled composite; character counter |
| `number-field` | Field, locale, icons | Closed prop list; locale from provider only; empty input reports `NaN` |
| `checkbox` | Field, SelectionItem (for CheckboxItem) | Primitive can land with Field; CheckboxItem waits on SelectionItem |
| `radio-group` | Field, SelectionItem (for RadioItem) | Same split: RadioGroupItem/Radio early; RadioItem after SelectionItem |
| `selection-item` | Item, Field | Fragile `child.type === SubSection`; `controlPosition` is new |
| `checkbox-card` | Field, Checkbox, Card, Badge | Marketing card; **not** CheckboxItem |
| `phone-number-field` | Field, InputGroup, flags, libphonenumber, `textFieldVariants`, intl, icons | First-of-kind. See §3. |
| `meter` | locale, icons | Labeled composite; dictionary `meter.warning` / `meter.success` |

Checkbox primitive vs CheckboxItem: one spec, one entry `@elmeragroup/ui/checkbox`. Implementation can still stage: primitive + CheckboxGroup with Field first; CheckboxItem in the same ticket **or** immediately after SelectionItem — do not publish a partial public surface. Prefer **one ticket per Appendix A entry** that includes every export that entry names.

#### D. Overlays (after Dialog proves containment)

| Component | Depends on | Notes |
| --- | --- | --- |
| `dialog` | Button, icons, intl, overlay helper | **First overlay.** `container` on Content. Keyframe animation. |
| `alert-dialog` | Dialog, Button, icons, intl | Prop-driven; body is real `Dialog.Description` (ref bugfix) |
| `sheet` | Dialog close-button helper, Button, icons, intl | Drawer primitive; `side`→`swipeDirection` coupled; transition animation |
| `popover` | overlay helper | `showArrow` opt-in; Positioner props on Content |
| `tooltip` | overlay helper | Arrow always on; Provider delay default `0` |
| `dropdown-menu` | overlay helper, icons | base-ui Menu family; SubContent must not reuse Content |
| `select` | overlay helper, icons | Trigger `data-size`; `alignItemWithTrigger` |
| `combobox` | InputGroup, Button, overlay, intl, icons | Root import from `@base-ui/react` (same hack as PhoneNumberField). Public `useComboboxAnchor`. |
| `toast` | Button, overlay, intl, icons | **First-of-kind pivot:** not sonner. Lift chrome from kumo toast + `@base-ui/react/toast`. |
| `popover-info-button` | Popover, Button, intl, icons | After Popover |

#### E. Navigation / disclosure / chrome-adjacent (not Sidebar)

| Component | Depends on | Notes |
| --- | --- | --- |
| `accordion` | icons | **New** on `@base-ui/react/accordion`; API shape from OrderModuleWeb radix accordion. Public `accordionVariants`. Height animation is an approved layout exception. |
| `tabs` | — | base-ui Tabs |
| `breadcrumb` | icons, intl | Dictionary `breadcrumb.landmark` / `more` |
| `pagination` | `buttonVariants`, icons, intl | Client because of locale. Public `paginationVariants`. |
| `button-group` | Separator, Button | Public `buttonGroupVariants` |
| `confirm-button` | Button | Two-press; copy is consumer-owned (no dictionary) |

#### F. Display / data

| Component | Depends on | Notes |
| --- | --- | --- |
| `alert` | Item, Button, icons | Re-home onto base-ui Item; `role="alert"` explicit |
| `empty` | — (Button only in demos) | Server layout composite |
| `frame` | — | Server; Card vs Frame is a documented split, no API coupling |
| `table` | — | `VerticalTable` in the same entry; `useRender` on VerticalTable.Header |
| `description-list` | — | Server; plain heading, not Heading |
| `timeline-list` | Heading | Server list wrapping client Heading |
| `code` | `sugar-high` | Server; syntax tokens already in the theme contract |
| `emoji` | Twemoji sources + CC BY 4.0 notice | Server SVG set |
| `chart` | optional peer `recharts` | Wrappers only; no `export * from "recharts"`. Lint: nothing outside `chart` imports recharts. |
| `sidebar` | Button, Input, Separator, Skeleton, Sheet, Tooltip, icons, intl, `use-is-mobile` | **Last component family.** 23 parts. Cookie name `sidebar:state` is a hard invariant. Docs must not import it. |

#### G. RAC interim (11) — after private stack

| Entry | Depends on private stack + | Notes |
| --- | --- | --- |
| `react-aria/ui-providers` | permanent `ElmeraGroupUiProvider` | Composes locale provider + RAC `I18nProvider` + `RouterProvider`. Dies with the tier. |
| `react-aria/date-field` | internal field | Exports `DateField` + `DateInput` |
| `react-aria/calendar` | internal button, icons | Public by ruling; RangeCalendar reuses header parts |
| `react-aria/range-calendar` | Calendar header parts | After Calendar |
| `react-aria/date-picker` | DateField, Calendar, private popover/dialog/modal, intl | `datePicker.presets` dictionary |
| `react-aria/date-range-picker` | DateField, RangeCalendar, same private overlays | Styled Dialog (ref used raw) |
| `react-aria/search-field` | internal field + RAC button, intl, icons | Facet-filter remnant |
| `react-aria/grid-list` | internal checkbox, icons | Facet-filter remnant; RAC Checkbox not exported |
| `react-aria/link` | RAC RouterProvider for client navigation tests | `focusRing({ target: "state" })` |
| `react-aria/focusable` | `react-aria` hooks package | Only consumer of `react-aria` proper |
| `react-aria/file-trigger` | RAC button + `buttonVariants`, icons | |

UiProviders should land **with or immediately before** the first RAC component that needs `I18nProvider`/`RouterProvider` (Link tests, date RAC strings). Permanent locale provider already exists.

### 2.6 Docs pipeline (not the PoC MVP)

[docs-site.md](../../docs/spec/docs-site.md) §2 forbids generated API tables, demo AST extraction, and ⌘K in the PoC. Those remain. MVP already proved: workspace source exports, three-column chrome, host-owned theme picker, docs-local nav over ScrollArea, live component pages, reserved route groups.

Still owed:

| Piece | Spec | Notes |
| --- | --- | --- |
| Custom MDX pipeline | §1 | Next + custom MDX. Do not substitute fumadocs. |
| Complete SideNav inventory | §3.3 | Overview (Quick start, Accessibility, Releases, About); Handbook (Theming, Theme matrix, Tokens, Brands & segments, Icons, Localization, llms.txt); Components = **flat alphabetical list of every published component**. MVP lists only Button + ScrollArea. |
| Header ⌘K search | §3.2 | Complete-site contract; omitted from MVP. |
| Component page anatomy | §3.4 | H1 + lede, View as Markdown + View source, demo frames, generated API tables, generated Tokens-consumed (drop the section rather than hand-maintain). |
| Demo frames with extracted source | §3.5 / §6 | One `.tsx` per spec §10. AST-extract at docs build into live render + displayed source. Same files are future VR targets and the markdown endpoint. Demos already exist for Button/ScrollArea as copy-pasted examples — switch to extraction, do not keep a third copy. |
| API reference generation | §8 | From TS types + JSDoc. RSC-status column. Fail the docs build on missing JSDoc / unresolvable types. |
| Theme matrix page | §5 | 20 legal `ThemeScope` cells only (incl. `elma`), colour grid — no 20×2 density axis. Needs a small set of key components inside each cell — wait until spine + a few overlays/forms exist, not until all 67. |
| Handbook pages | §3.3 + accessibility.md §4 + performance.md §2 | Theming, matrix, tokens (measured sizes), brands & segments, icons, localization, llms.txt explainer. |
| `llms.txt` + per-component `.md` endpoints | §9 | Generated from the same pipeline. No shadcn registry. |
| Playground | §7 | Separate app. Instant HMR. No Sandpack. |
| Vercel + PR previews | §10, release.md §7 | HITL org-setup item 5. Does not block implementing the pipeline locally. |

Lift *ideas* (not APIs): `.ref/base-ui/docs` already supplied the MVP chrome. Remaining pipeline is closer to kumo’s demo-as-`.tsx` + registry markdown generator (`.ref/kumo/packages/kumo/scripts/component-registry/`) than to base-ui’s per-page `types.ts` / dual Tailwind+CSS-modules demos. Spec wins: one authored demo file, workspace public specifiers, no MDX-embedded JSX.

Docs pages for new components can be **thin MDX shells** as soon as the pipeline exists; do not block component waves on full API tables. Until the pipeline exists, do not add hand-maintained API tables.

### 2.7 Release

[release.md](../../docs/spec/release.md). Blocks **first publish**, not component development.

| Piece | When |
| --- | --- |
| Changesets + `changesets/action` Version-Packages PR | Before the first user-facing component PR after PoC (Button already shipped without changesets — that is PoC-only). Merge gate fails without a changeset unless `no-changeset`. |
| GitHub Actions merge workflow | With changesets. Stages: oxfmt → `turbo ci:checks` (includes pack, package:check, size-limit) → changeset presence. Playwright install. |
| Publish workflow | After org-setup 1–4. Trusted Publishing OIDC, `NPM_CONFIG_PROVENANCE: true`, no npm token. |
| Packed fixtures in publish gate | After fixtures exist + flags. |
| `beta` dist-tag / pre-mode | When a consuming app needs a migration window. Mechanics exist; no need to enter pre-mode until then. |
| pkg-pr-new | Org-setup item 6. |
| HITL org-setup ([wayfinder/tickets/027](../../wayfinder/tickets/027-org-setup-task.md)) | Human: npm org, name-collision check vs internal `@elmeragroup/*`, public GitHub repo, Trusted Publisher, Vercel, pkg-pr-new. **Parallel to all implementation waves. Does not unblock components.** |

Licensing already decided: MIT code, no font files, logos ship, flags MIT + emoji CC BY 4.0 notices in the tarball.

---

## 3 PoC-proven vs still first-of-kind

Use this when writing tickets: if it is proven, copy the PoC pattern; if it is first-of-kind, that ticket is a **serial gate** for everything that copies it.

| Risk | Status | What “done” means |
| --- | --- | --- |
| Token pipeline / 20 themes (incl. `elma`) | **Proven** | Do not re-open. |
| Color-scheme bootstrap + runtime marker | **Proven** | Host-placed script + provider-owned `data-theme`; painted canvas stays light. Do not re-open; dark is roadmap. |
| Deployment-fixed density (`data-density` + `--control-*`) | **Proven** | Button is the density exemplar. Every size-axis control recipe reads `--control-*` per conventions.md §density; `elmera/no-hardcoded-density-metrics` enforces. Density preference is roadmap §10 — no `ThemeProvider` density prop in v1. |
| BrandLogo fallback contract | **Proven** | Six-code span fallback shipped. A2 only swaps energy-brand marks to SVG. |
| Data-only ThemeProvider + ThemeScope attributes | **Proven** | Docs picker is the host-owned model. |
| Overlay *resolver* (`null` vs `undefined` vs element) | **Proven in isolation** | First overlay (Dialog) is the first portal consumer. Nested DatePicker-in-Modal (`OVERLAY_CONTAINER_ATTR`) is a **second** first-of-kind, RAC-only. |
| Generated exports + tsdown unbundle + `"use client"` parity | **Proven** | Adding an entry = add `src/<name>.ts` + regenerate. Still missing: barrel + runtime export-name map generation. |
| Phosphor SSR adapters | **Proven** | Bespoke/logos are a different code path (hand SVG modules, not generated wrappers). |
| `useRender` + public recipe (`buttonVariants`) | **Proven** | Item is the next `useRender` *state-through-render* exemplar (data attributes on polymorphic roots). Copy Button’s merge/ref patterns; do not treat Item as a Button. |
| Docs workspace consumption (`linkDirectory: false`) | **Proven** | New pages keep public subpaths. Do not import `src/`. |
| Docs-local SideNav ≠ library Sidebar | **Proven** | Sidebar stays a later shell. |
| **Flags ∩ libphonenumber** | **First-of-kind** | Two datasets. 249 files, 765,286 bytes, gap `{AC,BQ,EH,TA}`, 28-country product exclusion, `Extract<CountryCode, FlagAssetCode>`, fallback to `NO` then first picker country, empty picker throws. Packed `<img>` URLs. No emoji/CDN/UA. |
| **Field / Item spine** | **First-of-kind** | Namespace compounds, Field validity wiring, Item group listitem context, public `itemVariants`, SelectionItem `child.type` partitioning. Almost every form and Alert/CheckboxCard depends on this being right. |
| **Overlays (Dialog first)** | **First-of-kind** | `container` defaulting to ThemeScope, portal wait-vs-body, z-50-once, shared close-button, overlay `bg-black/10` allowlist, self-scoped `data-open:` / `data-closed:`. Sheet is a second primitive (drawer) sharing close-button. Toast is a third (imperative manager, kumo lift). Combobox/Select are popup+positioner, not dialog. |
| **RAC quarantine** | **First-of-kind** | Private stack, path prefix, lint, `UiProviders`, RAC `focusRing({ target: "state" })`, `OVERLAY_CONTAINER_ATTR`, no RAC types leaking into bare entries. Heading/Text/Span must stay out of this folder. |
| **Packed fixtures** | **First-of-kind** | Real Next App Router + Vite installs of the tarball. RSC server page importing Phosphor + a server component; client island for Button. Flag URL resolution. Publish-only. |
| **Sidebar as later shell** | **Deferred on purpose** | Largest component. Cookie + shortcut + mobile Sheet + collapsed Tooltip. Must not block docs or other families. |
| **Toast pivot** | **First-of-kind** | Ref sonner toaster is abolished. New composition. Status→priority adapter. |
| **Combobox root import** | **Documented hack** | `import { Combobox } from "@base-ui/react"` — subpath crashes. PhoneNumberField and Combobox both keep this until upstream fixes it. |
| **size-limit calibration** | **First-of-kind** | First real measurements set ceilings. |
| **Demo AST extraction** | **First-of-kind** | kumo-style; our demos already exist as plain `.tsx`. Pipeline must consume package-local demos via public specifiers. |
| **Changesets + Trusted Publishing** | **Unproven here** | kumo pattern; org-setup is HITL. |

---

## 4 Serial backbone vs parallel sets

### 4.1 Serial backbone (nothing later can start without it)

Run **in the main worktree, one ticket at a time**. No sub-agents in parallel. These edit shared files (catalog, `entries.ts`, generator, `index.ts`, `ui.css` only if needed, lint config).

```text
B0  Export-name + barrel generation
      (src/index.ts = discovered bare entries + theme only;
       runtimeExportsFor covers those plus subpath-only
       icons / illustrations / flags — they never join the barrel)
B1  useLocalizedStrings + @internationalized/string pin + dictionary test helper
B2  RAC import lint (no RAC source yet)
B3  Separator
B4  Field
B5  Input + Textarea          (same ticket or Input then Textarea immediately)
B6  Item                      (can start after B3; must not race B4–B5 on index.ts
                               until B0 exists — with B0, Item ∥ Field is allowed)
B7  Dialog                    (first overlay consumer of ThemeScope container;
                               shared close-button helper)
B8  RAC private support stack + RAC dep pins   (before any react-aria/ public entry)
```

**Assets on the backbone, but not blocking Dialog/Field:**

```text
A1  Flags vendor + /flags + packed-asset contract     (blocks PhoneNumberField only)
A2  Bespoke icons + logos + FkasMeter (+ swap BrandLogo
    energy-brand fallbacks to real SVG marks)          (blocks nothing in the 67
                                                       except docs/icon roster completeness;
                                                       do before any ticket that would
                                                       otherwise invent a mark)
```

A1 and A2 do not depend on B3–B8. architecture.md §2 / ADR 0005: `/icons`, `/illustrations`, and `/flags` are **subpath-only** and must not join the root barrel. A1/A2 tickets **do not** edit `src/index.ts` and will not merge-conflict there. They **do** depend on B0 when B0 owns `runtimeExportsFor` / `entries.ts` (today `/flags` and `/illustrations` assert `[]`; `/icons` asserts Phosphor names only — new flag/illustration/bespoke names need that map or the entry ships unasserted). After B0, A1 ∥ A2 is allowed.

**Intl hook (B1)** blocks every string-bearing component (accessibility.md §4.1 owners): AlertDialog, Breadcrumb, Combobox, DatePicker, Dialog, Meter, Pagination, PhoneNumberField, PopoverInfoButton, SearchField, Sheet, Sidebar, Toast. Dialog is the first overlay **and** a dictionary owner — B1 before B7.

**Card and Badge** are not spine, but TextField’s `card` variant and CheckboxCard need `cardVariants` / `badgeVariants`. Land Card + Badge in the first parallel wave after B0, before TextField / CheckboxCard.

### 4.2 Sets that can land in parallel (after the named gate)

Each bullet is a **set**: multiple tickets that do not import each other. Still one Appendix A entry per ticket. Still §9+§10 in the same change.

**After B0 only (true leaves):**

- `skeleton`, `loader`, `badge`, `card`, `show`, `empty`, `frame`, `avatar`, `collapsible`, `switch`, `heading`, `text` (then `span` in the same set, after Text), `code` (needs `sugar-high` pin in that ticket), `emoji` (CC BY 4.0 notice), `table`, `description-list`, `accordion`, `tabs`, `confirm-button` (Button exists)

**After B3 Separator:**

- `button-group`

**After B1 + Button (already exists):**

- `pagination` (also needs `buttonVariants`), `breadcrumb`

**After B4–B6 (spine):**

- `alert` (Item + Button)
- `timeline-list` (Heading)
- `selection-item` (Item + Field) — then `checkbox` and `radio-group` **after** SelectionItem if those tickets include *Item parts; or split is forbidden — ship the whole entry)
- `input-group` (Input + Textarea + Button)
- `text-field` (Field + Input + Card)
- `textarea-field`, `number-field`
- `toggle` then, in a later set, `toggle-group`
- `meter`

**After B7 Dialog (containment pattern copied, not re-invented):**

- `alert-dialog`, `sheet` (Sheet needs the shared close-button)
- `popover`, `tooltip`, `dropdown-menu`, `select` (independent overlays)
- `toast` (own first-of-kind; do **not** parallel with the first Dialog ticket; **may** parallel with later overlays once Dialog is accepted)

**After InputGroup:**

- `combobox`
- `phone-number-field` (also needs A1 flags + B1 intl + `textFieldVariants`)

**After Popover:**

- `popover-info-button`

**After SelectionItem + Card + Badge + Checkbox primitive:**

- `checkbox-card`

**After B8 RAC stack:**

- `react-aria/ui-providers` first (or with Link)
- then `date-field` ∥ `calendar`
- then `range-calendar` (after calendar)
- then `date-picker` (after date-field + calendar)
- then `date-range-picker` (after date-field + range-calendar)
- `search-field` ∥ `grid-list` ∥ `file-trigger` ∥ `link` ∥ `focusable` (after stack; search-field/grid-list share internals but different files)

**After Sheet + Tooltip + Input + Separator + Skeleton:**

- `sidebar` **alone** (do not parallel with other large overlays in the same wave)

**Docs pipeline** can start after Dialog + Field exist (enough to dogfood overlays and forms on the matrix page), **in parallel with remaining families**, as long as it does not edit `packages/ui` internals. Prefer a dedicated docs worktree.

**Release (changesets + Actions)** can start as soon as B0 exists. Packed fixtures after A1 flags. Org-setup HITL anytime.

### 4.3 Shared-file conflict map (when *not* to parallelize)

| File / area | Who edits | Rule |
| --- | --- | --- |
| `packages/ui/scripts/generate-exports.ts` | foundation only | Never in a component ticket |
| `packages/ui/scripts/entries.ts` discovery / allowlists | foundation only | Component tickets must not grow `BARE_COMPONENT_ENTRIES` (already complete) |
| `runtimeExportsFor` / `src/index.ts` | B0 then mechanical | After B0, component tickets only add a facade file + a small export-name list |
| `packages/ui/src/styles/ui.css` | tokens (done) + RAC plugin (done) + density `--control-*` block (done) | Component tickets do not add custom variants and do not grow the density variable set. The nine `data-*` variants already exist. Size-axis recipes *read* `--control-*`; no `dense:`/`comfortable:` variants. |
| `packages/ui/src/styles/utils.ts` | already has `focusRing`, `disabledHatch`, icon crossfade | Do not add a second focus recipe. Dialog/Sheet close-button helper is a new private module, not utils soup. |
| `packages/ui/src/theme/**` | frozen after PoC | Overlay tickets *use* `useThemeScopeContainer`; they do not change it unless a spec bug is found |
| `pnpm-workspace.yaml` catalog | first ticket that needs the dep | One dep pin per ticket that introduces it; do not batch unused pins |
| `apps/docs/src/lib/nav.ts` | docs pipeline or a tiny “register page” step | Component tickets may add a page under `(docs)/components/<name>` **or** leave docs to a follow-up wave; they must not rewrite SideNav structure |
| `packages/ui/package.json` | generator | Never hand-edit `exports`. Closed field set is a known leftover — B0 should stop the generator from being a merge hazard |

Token pipeline stays frozen. Do not parallelize tickets that rewrite the generator, the token modules, or ThemeScope.

---

## 5 Isolated worktrees and sub-agents

**Not in this ticket.** After PoC acceptance (now), a later loop/wave spec may use them as follows.

### 5.1 When to use a worktree + sub-agent

- The ticket’s source files are almost entirely `packages/ui/src/components/<name>/**` plus `packages/ui/src/<name>.ts`.
- Dependencies named in §2.4 already exist on `main`.
- No catalog pin, or the pin is unique to this ticket and will rebase cleanly.
- No edits to `generate-exports.ts`, token pipeline, ThemeScope, or `ui.css`.

Pattern: branch from `main` after the previous wave’s review gate; one ticket per worktree; one executor sub-agent per worktree; rebase onto `main` before merge; human/agent review of the **wave** before starting the next wave.

### 5.2 When not to

- Shared foundation (B0–B2, B8 RAC stack, A1 flags vendor script, size-limit harness, changesets/CI).
- Export manifest / generator / barrel (B0).
- Token pipeline (already done — never).
- First-of-kind gates: Dialog (B7), flags (A1), Field (B4), Item (B6), Toast, PhoneNumberField, RAC stack (B8), packed fixtures, demo-extraction pipeline.
- Sidebar (too many import edges; merge conflicts with Sheet/Tooltip if those are in flight).
- Two tickets that both add the first use of the same new dependency.

### 5.3 Fan-out shape a later loop spec can copy

```text
Wave N review gate (main green)
    │
    ├── worktree ticket N.1  executor ──► PR
    ├── worktree ticket N.2  executor ──► PR
    └── worktree ticket N.3  executor ──► PR
              │
              ▼
         rebase + merge serially if barrel still hand-written
         (after B0, merge order is less load-bearing)
              │
              ▼
         Wave N+1
```

Reviewers stay read-only. Do not nest sub-agents inside an executor. Do not start Wave N+1 until Wave N’s keep-list is empty (same discipline as the PoC loop, but **across** worktrees).

If B0 is skipped, **do not fan out**. Parallel `index.ts` edits will thrash.

---

## 6 Suggested wave shapes

Each wave = a batch of unblocked tickets that may run together (after B0, in worktrees) → then a human/agent review gate. Ticket titles are specific enough to feed `/to-tickets`. Do **not** start these waves in ticket 10.

### Wave 0 — Research (this file)

No product code.

### Wave 1 — Shared internals (serial, main worktree)

1. **Generate root barrel + runtime export-name map** from discovered entries (`entries.ts` / pack-time name assertions). Root barrel (`src/index.ts`) = 56 bare components + `/theme` only; `/icons`, `/illustrations`, `/flags` stay subpath-only and must not be re-exported there. `runtimeExportsFor` still lists expected names for those subpaths.
2. **`useLocalizedStrings`** + catalog pin `@internationalized/string` + a reusable locale-matrix test helper. No component dictionaries yet except a unit fixture.
3. **RAC import lint** (elmera rule): those three packages only under `src/react-aria/**`.
4. **`size-limit` harness** on current packed entries; record measured×1.5 ceilings for `.`, `theme`, `icons`, `button`, `scroll-area`, `themes.css`, `styles.css`.
5. **Changesets + GitHub Actions merge workflow** (oxfmt, `ci:checks`, Playwright install, changeset presence). Label `no-changeset` for docs-only. Does not publish.

Gate: pack still green; a dummy dictionary test passes in four locales; lint forbids `import "react-aria-components"` from `src/components/**`.

### Wave 2 — Assets (A1 ∥ A2 after Wave 1)

6. **Flags:** vendor 249 SVGs, manifest, provenance, hashes, 800 KiB ceiling, four-code gap test vs `libphonenumber-js` metadata (pin the dep here or in the PhoneNumberField ticket; **prefer here** so the gap test is real). Fill in `package-check` packed-asset contract. Subpath-only (`@elmeragroup/ui/flags`); extend `runtimeExportsFor` / `entries.ts` if B0 left `[]` — **do not** add flags to `src/index.ts`.
7. **Bespoke icons, logos, FkasMeter; swap BrandLogo fallbacks to SVG marks.** Extend `/icons` + add `/illustrations`. `Signing` class rename. CC notices where required. Same rule: subpath-only; new names go on `runtimeExportsFor`, not the root barrel (`BrandLogo` is already listed there — do not re-add).

Gate: packed tarball has `flags/NO.svg` etc.; `/icons` export test includes bespoke names; no `.ref/` path in source.

### Wave 3 — Spine (serial; Item may ∥ Field after Separator if Wave 1 barrel gen exists)

8. **Separator** (spread-order + vertical `self-stretch` browser test).
9. **Field** (12 parts, private `fieldVariants`).
10. **Input + Textarea** (unlabeled controls, `bg-card`, Field invalid demos).
11. **Item** (public `itemVariants`, listitem-in-group, `useRender` state).

Gate: Field+Input accessible-name test; Item `render={<a/>}` carries `data-slot`/`data-variant`/`data-size`; Separator slot override.

### Wave 4 — First overlay + first form edge + RAC stack (mostly serial)

12. **Dialog** + shared close-button helper + `dialog.close` dictionary. **First overlay gate.**
13. **Card + Badge** (public recipes; parallel with Dialog *after* Wave 3, not with Dialog if both touch `index.ts` pre-B0).
14. **InputGroup**.
15. **RAC private support stack** + RAC catalog pins + `OVERLAY_CONTAINER_ATTR`. No public `react-aria/` entries yet except none.

Gate: Dialog portals into ThemeScope (and waits when scope ref is null); InputGroup within-focus ring; RAC internals have zero `exports` keys.

### Wave 5 — Load-bearing dependents (first true fan-out)

Unblocked together after Wave 4:

- **AlertDialog**, **Sheet** (need Dialog / close-button)
- **TextField** (needs Card), **TextareaField**, **NumberField**
- **Toggle**
- **Popover**, **Tooltip**, **Select**, **DropdownMenu** (copy Dialog’s `container` pattern)
- **Heading**, **Text**, **Span**, **TimelineList** (Span after Text; TimelineList after Heading — both in this wave)
- Remaining Wave-1 leaves not yet done: `skeleton`, `loader`, `show`, `empty`, `frame`, `avatar`, `collapsible`, `switch`, `table`, `description-list`, `accordion`, `tabs`, `confirm-button`, `code`, `emoji`, `button-group`, `pagination`, `breadcrumb`, `meter`, `alert`

Keep **Toast**, **Combobox**, **PhoneNumberField**, **SelectionItem**, **Sidebar**, **Chart** out of this wave (first-of-kind or heavier edges).

Gate: each merged ticket has §9+§10; docs may still be MVP-thin pages.

### Wave 6 — Selection, phone, combobox, toast, RAC publics

- **SelectionItem** then **Checkbox** then **RadioGroup** then **CheckboxCard** (serial inside the set, or one ticket each with hard blockers)
- **ToggleGroup** (after Toggle)
- **Combobox** (after InputGroup)
- **PhoneNumberField** (after flags + InputGroup + TextField recipe + intl) — **solo worktree, no parallel roommate**
- **Toast** — **solo** (pivot)
- **PopoverInfoButton** (after Popover)
- **RAC `ui-providers`** then **date-field ∥ calendar** then **range-calendar** then **date-picker** then **date-range-picker**
- **search-field ∥ grid-list ∥ file-trigger ∥ link ∥ focusable**

Gate: PhoneNumberField picker never contains AC/BQ/EH/TA; packed flag URLs; RAC entries are subpath-only and absent from the barrel; date-picker in a modal does not dismiss the modal (`OVERLAY_CONTAINER_ATTR`).

### Wave 7 — Chart + Sidebar + docs pipeline start

- **Chart** (optional `recharts` peer, lint, budget excluding recharts)
- **Sidebar** last (after Sheet + Tooltip)
- **Docs MDX + demo AST extraction + API tables + Tokens-consumed**
- **Handbook pages + 20-cell theme matrix + Localization page**
- **⌘K search** (docs-local, not a library Command component)
- **`llms.txt` + per-component markdown endpoints**
- **Playground app**
- Register every published component in SideNav (flat alphabetical)

Gate: docs build fails on missing JSDoc; demos extract; Sidebar not imported from `apps/docs`; matrix shows 20 legal cells only.

### Wave 8 — Release completeness

- Packed fixtures Next + Vite (flag URLs, RSC island)
- size-limit remaining entries (calibrate new ones)
- Plop generator (optional if agents are already scaffolding by hand)
- Next TS preset; drop docs compiler-option drift
- Publish workflow (blocked on HITL 027 items 1–4)
- Vercel + pkg-pr-new (HITL 5–6)

Gate: `turbo ci:checks` includes a non-stub `size-limit`; publish job exists but may stay manual until org-setup completes.

---

## 7 Ticket-ready inventory (for `/to-tickets`)

Do not invent names. One public Appendix A entry = one implementation ticket unless the spec says two modules of the same entry (UiProviders already split: permanent half is done).

**Already shipped (do not re-ticket):** `button`, `scroll-area`; `/theme`; Phosphor `/icons` roster; docs MVP.

**Foundation / assets / tooling tickets (not components):**

| Suggested slug | Blocked by | First-of-kind? |
| --- | --- | --- |
| barrel-and-export-names | PoC | no (extends proven generator) |
| localized-strings-hook | PoC | yes (first dictionary runtime) |
| rac-import-lint | PoC | no |
| size-limit-harness | PoC | yes (calibration) |
| changesets-and-merge-ci | PoC | yes for this repo |
| flags | barrel-and-export-names (`runtimeExportsFor` / `entries.ts`; **not** `src/index.ts`) | **yes** |
| bespoke-icons-logos-illustrations | barrel-and-export-names (same; stay off the root barrel) | no (lift + a11y contract) |
| packed-fixtures | flags, size-limit-harness | **yes** |
| docs-mdx-demo-extraction-api | docs MVP, a few components | **yes** |
| docs-handbook-matrix-llms | docs-mdx-demo-extraction-api | no |
| docs-search | docs-mdx-demo-extraction-api | no |
| playground | docs MVP | no |
| plop-component-gen | docs-mdx (page stub) | no |
| org-setup HITL 027 | human | n/a |

**Spine:** `separator` → `field` → `input`+`textarea` → `item`.

**Overlays:** `dialog` (gate) → `alert-dialog`, `sheet`, `popover`, `tooltip`, `dropdown-menu`, `select` → `toast` (solo) → `combobox` (after `input-group`) → `popover-info-button`.

**Forms:** `input-group`, `text-field`, `textarea-field`, `number-field`, `selection-item`, `checkbox`, `radio-group`, `checkbox-card`, `phone-number-field` (after flags), `toggle` → `toggle-group`, `meter`.

**Leaves / display / nav:** `heading`, `text`, `span`, `badge`, `card`, `loader`, `skeleton`, `show`, `empty`, `frame`, `avatar`, `collapsible`, `switch`, `accordion`, `tabs`, `table`, `description-list`, `timeline-list`, `code`, `emoji`, `alert`, `button-group`, `breadcrumb`, `pagination`, `confirm-button`, `chart`, `sidebar` (last).

**RAC (after private stack ticket):** `react-aria/ui-providers`, `react-aria/date-field`, `react-aria/calendar`, `react-aria/range-calendar`, `react-aria/date-picker`, `react-aria/date-range-picker`, `react-aria/search-field`, `react-aria/grid-list`, `react-aria/link`, `react-aria/focusable`, `react-aria/file-trigger`.

Every component ticket reads: that spec file, conventions.md (including the **density ladder** — size-axis control recipes read the `--control-*` variables, never hardcode the metric families; `elmera/no-hardcoded-density-metrics` enforces, Button is the shipped exemplar), architecture.md (exports + RSC), the component’s §8, and the named `.ref` source of truth. Tests written fresh. Demos co-located `src/components/<name>/demos/`. Public recipe exported from the same entry when the spec says PUBLIC.

---

## 8 Coupling notes from `.ref` (estimate only)

Used only to judge parallelism. Do not copy ref public paths or RAC-public field/item/popover.

- Internal `base-ui/` folder is the real graph. Cross-imports that survive in our specs: Field ← Input/TextField/InputGroup/Phone/Selection/Checkbox/Radio; Item ← Selection/Alert; Separator ← Field/Item/ButtonGroup/Sidebar (ref still points at the *wrong* root separator — our spec already unifies); Button ← almost every interactive composite; Card/Badge ← CheckboxCard and TextField card variant.
- Ref `react-aria/README.md` still describes a “phone-number-field island” and public RAC field/item/heading. **Ours diverged:** phone is base-ui + flags; heading/text/span re-homed; RAC field/item/popover are private or gone. Do not resurrect them as public entries.
- Ref RAC `button.tsx` / `dialog.tsx` / `modal.tsx` / `popover.tsx` / `field.tsx` are the private stack. Date pickers import those, not `@elmeragroup/ui/button` / `dialog`.
- Disclosure exists in the internal ref and is **not** in Appendix A. Accordion is the public disclosure-like control. Do not add Disclosure.
- Kumo packed-fixture / demo-extraction: `packages/kumo/tests/imports/` and `scripts/component-registry/` are the shape references for Wave 8 fixtures and Wave 7 docs pipeline. Kumo toast is the chrome reference for our Toast pivot.
- Base-ui docs remaining vs our MVP: their `(docs)` already has MDX pages, per-component `types.ts`/`types.md`, and dual-demo folders. We do **not** copy that demo layout. We keep one `.tsx` per scenario (kumo) inside the package, extracted at docs build.

---

## 9 Explicit non-goals

- **This ticket (10) does not start any wave**, worktree, or sub-agent. It only records how to use them later.
- **Do not invent components** the spec does not list. Appendix A is exhaustive. No Command, no Disclosure, no RAC-public Field/Item/Popover, no `Icon` namespace, no fonts package, no `@elmeragroup/tokens`.
- **Do not treat roadmap.md as v1:** RAC→base-ui migration, dark token values, visual regression, extra brands (Steddi/NGE/Trumf as *themes*), Phosphor-core codegen, nn-NO, shadcn registry, in-browser playground editor.
- **Do not migrate OrderModule apps.**
- **Do not implement library Sidebar to finish docs chrome.** SideNav/QuickNav stay docs-local.
- **Do not use public Combobox inside PhoneNumberField.**
- **Do not add placeholder exports** to unblock a later ticket.
- **Do not reopen PoC scope** (Button/ScrollArea/theme/token pipeline) except to extend generators and catalogs as named above.

---

## 10 Suggested `/to-tickets` grouping

Feed the next ticket batch in this order so a later loop spec does not need another research pass:

1. Wave 1 internals (5 tickets: barrel/export-names, intl hook, RAC lint, size-limit, changesets+CI).
2. Wave 2 assets (2 tickets: flags; bespoke+logos+illustrations).
3. Wave 3 spine (4 tickets: separator; field; input+textarea; item).
4. Wave 4 gates (4 tickets: dialog+close-button; card+badge; input-group; RAC internals).
5. Then explode Wave 5+ from the inventory tables, each ticket blocked by the named imports, each with Read-first = that component spec + conventions + architecture + the `.ref` source-of-truth path from the spec header.

HITL 027 stays a human task in parallel, never in an agent wave.

When the loop spec is written: serial through Wave 4 in the main worktree; Wave 5 is the first `parallel()` / worktree wave; PhoneNumberField, Toast, RAC stack, Sidebar, packed fixtures, and demo extraction stay singleton tickets.
