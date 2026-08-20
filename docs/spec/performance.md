# Performance guidelines

Normative chapter for `@elmeragroup/ui`. Sources: [A11y & performance guideline chapters](../../wayfinder/tickets/026-a11y-performance-guidelines.md), [Package architecture](../../wayfinder/tickets/008-package-architecture.md), [Icon system](../../wayfinder/tickets/009-icon-system.md), [Token pipeline](../../wayfinder/tickets/018-token-pipeline.md).

## 1 Principles

- Budgets are **regression ratchets, not aspirations**: every published entry has a CI-enforced ceiling; ceilings only move **down** (or are consciously raised in a reviewed PR that says why).
- The library never trades app control for its own convenience: no internal lazy boundaries or self-scheduled work. Approved global listeners are limited to base-ui internals, Button's shared intent registry, and Sidebar's mounted keyboard shortcut; §6 defines their lifetimes.
- Weight is opt-in by architecture: per-icon exports, subpath entries, optional peers — importing `Button` must never pay for `Chart`.

## 2 Bundle budgets

- **Mechanism**: `size-limit` bundles a minimal consumer fixture for each public JS entry against the packed package, then measures min+gzip. Measuring raw unbundled facades is meaningless, so the fixture imports the entry's named exports and exercises its normal graph. Runs in the merge gate; breach fails the build.
- **Calibration**: numbers below are provisional; at first real build each is set to **measured × ~1.5** and committed. From then on, the ratchet rule applies.
- Provisional ceilings (min+gzip, ESM, excluding react/react-dom/peers):

  | Entry | Ceiling | Note |
  | --- | --- | --- |
  | Baseline component entry (button, badge, input, …) | 10 kB | includes shared runtime pulled by that entry |
  | Heavy composites: select, combobox, table, sidebar, toast | 20 kB | base-ui positioning/list machinery |
  | `phone-number-field` | 60 kB | includes the min-metadata phone engine and generated flag-URL manifest, but no SVG bytes |
  | `chart` | 15 kB | **excluding** recharts (optional peer — never bundled) |
  | Date cluster (`react-aria/` date entries, incl. `@internationalized/date`) | 60 kB | quarantined tier; uninstalls with the cluster |
  | Root barrel (56 bare components + theme) | 150 kB | excludes the quarantined RAC entries; exists for DX and apps are steered to subpaths |
  | `icons` per-icon export | 2 kB | Phosphor single icon |
  | `themes.css` (standalone bundle) | 10 kB gzip | see §4 |
  | Flag SVGs | 800 KiB aggregate raw ceiling | 249 two-letter country assets total 765,286 bytes at the pinned snapshot; excluded from JS budgets and never inlined. Individual SVGs legitimately exceed 5 kB; count + hashes + aggregate size are the gates. The manifest module counts within `phone-number-field`. |

- The docs site publishes the measured sizes per entry (generated, same source as the API tables).

## 3 RSC / client boundaries

- **Default server-safe.** A component carries `"use client"` (at source; tsdown preserves it) only when it owns interactivity — state, effects, event handlers, browser APIs.
- **Authoritative classification** — every component spec, applying that policy. Each spec's §1 header carries the same status; this table is the audit view, and **on conflict this table wins**:

  | Component | RSC status |
  | --- | --- |
  | accordion | client |
  | alert | server (static composite; the optional `onAction` button is a client base-ui `Button` child) |
  | alert-dialog | client |
  | avatar | client (base-ui Avatar owns image loading state) |
  | badge | server |
  | breadcrumb | client (`useRender` polymorphism) |
  | button | client (pending/visually-disabled state, `usePredictedEvents` wiring) |
  | button-group | client (`useRender` polymorphism) |
  | calendar | client |
  | card | server |
  | chart | client |
  | checkbox | client |
  | checkbox-card | client |
  | code | server |
  | collapsible | client |
  | combobox | client |
  | confirm-button | client |
  | date-field | client |
  | date-picker | client |
  | date-range-picker | client |
  | description-list | server |
  | dialog | client |
  | dropdown-menu | client |
  | emoji | server |
  | empty | server |
  | field | client (base-ui Field validity wiring) |
  | file-trigger | client |
  | focusable | client |
  | frame | server |
  | grid-list | client |
  | heading | client (`useRender` polymorphism) |
  | input | client (base-ui Field-wired control) |
  | input-group | client |
  | item | client (`useRender` polymorphism and group-context semantics) |
  | link | client (RAC press handling + router context) |
  | loader | server |
  | meter | client (base-ui Meter primitive) |
  | number-field | client |
  | pagination | client (provider-only locale context supplies built-in navigation copy) |
  | phone-number-field | client |
  | popover | client |
  | popover-info-button | client |
  | radio-group | client |
  | range-calendar | client |
  | scroll-area | client |
  | search-field | client |
  | select | client |
  | selection-item | client |
  | separator | client (base-ui Separator primitive) |
  | sheet | client |
  | show | server |
  | sidebar | client |
  | skeleton | server |
  | span | client (`useRender` polymorphism) |
  | switch | client |
  | table | client (`VerticalTable.Header` uses `useRender`; no sortable/selection API is specified) |
  | tabs | client |
  | text | client (`useRender` polymorphism) |
  | text-field | client |
  | textarea | server (plain native element, no owned state; Field wiring comes from the client `TextareaField`) |
  | textarea-field | client |
  | timeline-list | server (presentational list rendering) |
  | toast | client |
  | toggle | client |
  | toggle-group | client |
  | tooltip | client |
  | ui-providers | client (`ElmeraGroupUiProvider`, `useElmeraGroupUi`, and RAC `RouterProvider` wiring all use React context) |

  Bespoke SVG icons, illustrations, logos, emoji, flag assets, and curated Phosphor adapters are server-safe. The adapters import the pinned package's explicit `@phosphor-icons/react/dist/ssr/<Icon>` modules, never its client or root barrel ([icons](icons.md) §2); `/icons` is therefore a server-safe, directive-free facade.
- **RSC status is part of the public contract**: an `RSC` line in every component spec's §1 Header and a matching field in the generated docs API tables.
- **Composition rule**: a server-safe component may render a client child; a change that flips a server-safe component to client is a **breaking change to its spec** — it must be flagged in §8 Divergence/changelog, never happen silently.
- The `"use client"` directive is **per source file, not per entry**: a single entry may expose both server modules and client modules — `/theme` does exactly this. Within one module there is still exactly one directive decision: no `-client` wrapper entries, no double exports.

  | `/theme` export | RSC status | Role |
  | --- | --- | --- |
  | `themeAttributes`, `defaultDensityForVariant`, `densityAttributes`, `themeSlug`, `parseThemeSlug`, `validateTheme`, `BRANDS` | server | brand and density kernel; safe in layouts, `_document`, Vite config |
  | `ColorSchemeScript`, `colorSchemeScriptSource` | server | host-placed first-paint bootstrap. `ColorSchemeScript` stays a server-safe `<script>` renderer so `<head>` placement remains true; `colorSchemeScriptSource` returns closed IIFE text for `transformIndexHtml` / `ScriptOnce` |
  | `ThemeProvider`, `useTheme`, `useColorScheme`, `ForceColorScheme` | client | document writer, hooks, runtime force. Not first-paint adapters |
  | `ThemeScope` | client | subtree brand writer |
  | `ElmeraGroupUiProvider`, `useElmeraGroupUi` | client | locale context |

  Hosts import the server bootstrap from a server or config module. Importing `ColorSchemeScript` through a client component and rendering it after `createRoot` is not a first-paint path.

## 4 CSS

- `themes.css` (15 CSS rules / 20 permutations plus one terminal dark-placeholder comment, ADR [0002](../adr/0002-theme-attributes.md) layer structure) is codegen output, uncommitted, reviewed via **CSS snapshot test** and capped by the §2 ceiling — the snapshot catches semantic drift, the ceiling catches generator bloat.
- Dual distribution per [Package architecture](../../wayfinder/tickets/008-package-architecture.md): Tailwind-source consumers pay only for what they use via the normal content scan; the standalone bundle is the one that needs the budget.
- `sideEffects` lists only CSS; every JS module (intl modules included) is side-effect-free so tree-shaking holds.

## 5 Code splitting & lazy loading

- **The library never lazy-loads internally** — no dynamic `import()` anywhere in library source (lintable). Internal async boundaries would create loading states apps can't control or style.
- Apps own splitting; the docs ship two first-class recipes: `next/dynamic` and `React.lazy` wrappers for **Chart** and the **date cluster** (the two entries whose weight justifies a boundary).
- `recharts` stays an **optional peer**: chart's cost is opt-in at install time, and `chart` re-exports wrappers only (no `export * from "recharts"`).
- The `react-aria/` quarantine keeps all tier-only dependencies (`react-aria-components`, the `react-aria` hooks package, `@internationalized/date`, and `tailwindcss-react-aria-components`) reachable only via `react-aria/` subpaths or the private RAC subtree, so no bare entry can accidentally pull them.

## 6 Runtime practices

- Animations touch **`transform` and `opacity` only** by default. Reviewed v1 exceptions are: Accordion/Collapsible panel height driven by the primitive's measured CSS variable; Sidebar shell width during its 200 ms expand/collapse transition; and Item's content-reveal grid track. Each exception is enumerated in its component spec and disabled by the central reduced-motion rule. New layout-property animation requires a spec amendment and measurement.
- Context values are **memoized** (`ElmeraGroupUiProvider` already does); no context provider re-renders its subtree on unrelated prop churn.
- No per-frame CSS-variable writes on shared ancestors (inherited-var recalc storms); transient interaction state writes `style.transform` on the element itself.
- Tooltips/popovers reuse base-ui's shared positioning; components never install their own scroll/resize listeners.
- Button intent prediction uses one package-private registry: it installs at most one document `pointermove` listener while at least one `onIntent` registration exists and removes it when the registry empties. `usePredictedEvents` and `useMergedRefs` are not public. Sidebar's `window.keydown` shortcut listener exists only while `Sidebar.Provider` is mounted and is removed on cleanup.

## 7 i18n cost

- Four locales (`nb-NO`, `sv-SE`, `en-US`, `fi-FI`) ship **eagerly** inside each string-bearing component's entry — a few hundred bytes per component at this scale, already inside the §2 ceilings. The runtime (`@internationalized/string`) is ~1 kB once.
- **Revisit threshold**: if shipped locales approach ~10, move to per-locale modules + resolver-level subsetting (the react-aria `optimize-locales` model — requires per-locale files to survive bundling as separate modules). Roadmap item, not v1 machinery.
