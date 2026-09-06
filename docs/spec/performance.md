# Performance guidelines

Normative chapter for `@elmeragroup/ui`.

## 1 Principles

- Budgets are **regression ratchets, not aspirations**: every published entry has a CI-enforced ceiling. **Per-component and per-icon** ceilings only move **down** (or are consciously raised in a reviewed PR that says why). **Shared/aggregate** entries (`styles.css`, the root barrel `.`) are the exception: they recalibrate to measured×1.5 in the PR that grows them (§2).
- The library never trades app control for its own convenience: no internal lazy boundaries or self-scheduled work. Approved global listeners are enumerated in §6.
- Weight is opt-in by architecture: per-icon exports, subpath entries, optional peers — importing `Button` must never pay for `Chart`.

## 2 Bundle budgets

[Size budgets](../../packages/ui/scripts/size-budgets.ts) own recorded measurements and ceilings. The docs site generates its size reference from that module. [Flag payload policy](../../packages/ui/scripts/flag-payload.ts) owns the separate aggregate raw-SVG ceiling. This chapter owns how budgets change, not a copy of their current numbers.

- `size-limit` bundles consumer fixtures against the packed package and measures min+gzip. It exercises the exported dependency graph, excludes peers, and fails on a ceiling breach. Measuring an unbundled source facade is insufficient.
- A new entry starts at measured × 1.5. Deferred entries have no published budget until they ship; the future chart measurement excludes its optional recharts peer.
- Per-component and per-icon ceilings remain fixed as measurements grow beneath them. Raising a ceiling requires an explicit reviewed reason.
- Shared entries, including `styles.css` and the root barrel, recalibrate to measured × 1.5 in a change that grows them.
- When an entry shrinks, reduce its ceiling by the bytes saved to preserve its existing headroom. Record the new measurement without adding slack.
- Flag assets have count, hash, and aggregate raw-byte checks. The packed Vite consumer also checks that flags remain external assets, stay out of JavaScript data URLs, and satisfy its JavaScript payload ceiling. Entry-level gzip checks alone cannot catch consumer-side asset inlining.

Run `pnpm --filter @elmeragroup/ui pack`, then `pnpm --filter @elmeragroup/ui size-limit` after building. Review changes to the budget module alongside the implementation that caused them.

## 3 RSC / client boundaries

- **Default server-safe.** A component carries `"use client"` (at source; tsdown preserves it) only when it owns interactivity — state, effects, event handlers, browser APIs.
- **Authoritative classification** follows the policy above. This table owns the expected status; the generated docs are checked against it. **On conflict this table wins**:

  | Component           | RSC status                                                                                                  |
  | ------------------- | ----------------------------------------------------------------------------------------------------------- |
  | accordion           | client                                                                                                      |
  | alert               | server (static composite; the optional `onAction` button is a client base-ui `Button` child)                |
  | alert-dialog        | client                                                                                                      |
  | avatar              | client (base-ui Avatar owns image loading state)                                                            |
  | badge               | server                                                                                                      |
  | breadcrumb          | client (`useRender` polymorphism)                                                                           |
  | button              | client (pending/visually-disabled state, `usePredictedEvents` wiring)                                       |
  | button-group        | client (`useRender` polymorphism)                                                                           |
  | calendar            | client                                                                                                      |
  | card                | server                                                                                                      |
  | chart               | deferred (Wave 9) — client when shipped                                                                     |
  | checkbox            | client                                                                                                      |
  | checkbox-card       | client                                                                                                      |
  | code                | server                                                                                                      |
  | collapsible         | client                                                                                                      |
  | combobox            | client                                                                                                      |
  | confirm-button      | client                                                                                                      |
  | date-field          | client                                                                                                      |
  | date-picker         | client                                                                                                      |
  | date-range-picker   | client                                                                                                      |
  | description-list    | server                                                                                                      |
  | dialog              | client                                                                                                      |
  | dropdown-menu       | client                                                                                                      |
  | emoji               | server                                                                                                      |
  | empty               | server                                                                                                      |
  | field               | client (base-ui Field validity wiring)                                                                      |
  | file-trigger        | client                                                                                                      |
  | focusable           | client                                                                                                      |
  | frame               | server                                                                                                      |
  | grid-list           | client                                                                                                      |
  | heading             | client (`useRender` polymorphism)                                                                           |
  | input               | client (base-ui Field-wired control)                                                                        |
  | input-group         | client                                                                                                      |
  | item                | client (`useRender` polymorphism and group-context semantics)                                               |
  | link                | client (RAC press handling + router context)                                                                |
  | loader              | server                                                                                                      |
  | meter               | client (base-ui Meter primitive)                                                                            |
  | number-field        | client                                                                                                      |
  | pagination          | client (provider-only locale context supplies built-in navigation copy)                                     |
  | phone-number-field  | client                                                                                                      |
  | popover             | client                                                                                                      |
  | popover-info-button | client                                                                                                      |
  | radio-group         | client                                                                                                      |
  | range-calendar      | client                                                                                                      |
  | scroll-area         | client                                                                                                      |
  | search-field        | client                                                                                                      |
  | select              | client                                                                                                      |
  | selection-item      | client                                                                                                      |
  | separator           | client (base-ui Separator primitive)                                                                        |
  | sheet               | client                                                                                                      |
  | show                | server                                                                                                      |
  | sidebar             | client                                                                                                      |
  | skeleton            | server                                                                                                      |
  | span                | client (`useRender` polymorphism)                                                                           |
  | switch              | client                                                                                                      |
  | table               | server (`VerticalTable.Header` and `VerticalTable.Key` are client `useRender` islands)                      |
  | tabs                | client                                                                                                      |
  | text                | client (`useRender` polymorphism)                                                                           |
  | text-field          | client                                                                                                      |
  | textarea            | server (plain native element, no owned state; Field wiring comes from the client `TextareaField`)           |
  | textarea-field      | client                                                                                                      |
  | timeline-list       | server (presentational list rendering)                                                                      |
  | toast               | client                                                                                                      |
  | toggle              | client                                                                                                      |
  | toggle-group        | client                                                                                                      |
  | tooltip             | client                                                                                                      |
  | ui-providers        | client (`ElmeraGroupUiProvider`, `useElmeraGroupUi`, and RAC `RouterProvider` wiring all use React context) |

  Bespoke SVG icons, illustrations, logos, emoji, flag assets, and curated Phosphor adapters are server-safe. The adapters import the pinned package's explicit `@phosphor-icons/react/dist/ssr/<Icon>` modules, never its client or root barrel ([icons](icons.md) §2); `/icons` is therefore a server-safe, directive-free facade.

- **RSC status is part of the public contract**: the expected status in this table and a matching field in the generated docs API tables.
- **Composition rule**: a server-safe component may render a client child; a change that flips a server-safe component to client is a **breaking change to its spec** — it must be flagged in §8 Divergence/changelog, never happen silently.
- The `"use client"` directive is **per source file, not per entry**: a single entry may expose both server modules and client modules — `/theme` does exactly this. Within one module there is still exactly one directive decision: no `-client` wrapper entries, no double exports.

  | `/theme` export                                                                                                                                                                                 | RSC status | Role                                                                                                                                                                                                                          |
  | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `themeAttributes`, `defaultDensityForVariant`, `densityAttributes`, `themeSlug`, `parseThemeSlug`, `coerceTheme`, `validateTheme`, `BRANDS`, `THEME_VARIANTS`, `THEME_SEGMENTS`, `LEGAL_THEMES` | server     | brand and density kernel; safe in layouts, `_document`, Vite config. The axis tuples and legal set are additive `/theme` exports (2026-09-02)                                                                                 |
  | `ColorSchemeScript`, `colorSchemeScriptSource`                                                                                                                                                  | server     | host-placed first-paint bootstrap. `ColorSchemeScript` stays a server-safe `<script>` renderer so `<head>` placement remains true; `colorSchemeScriptSource` returns closed IIFE text for `transformIndexHtml` / `ScriptOnce` |
  | `ThemeProvider`, `useTheme`, `useColorScheme`, `ForceColorScheme`                                                                                                                               | client     | document writer, hooks, runtime force. Not first-paint adapters                                                                                                                                                               |
  | `ThemeScope`                                                                                                                                                                                    | client     | subtree brand writer                                                                                                                                                                                                          |
  | `ElmeraGroupUiProvider`, `useElmeraGroupUi`                                                                                                                                                     | client     | locale context                                                                                                                                                                                                                |

  Hosts import the server bootstrap from a server or config module. Importing `ColorSchemeScript` through a client component and rendering it after `createRoot` is not a first-paint path.

## 4 CSS

- `themes.css` (15 CSS rules / 20 permutations plus one terminal dark-placeholder comment, ADR [0002](../adr/0002-theme-attributes.md) layer structure) is codegen output, uncommitted, reviewed via **CSS snapshot test** and capped by the §2 ceiling — the snapshot catches semantic drift, the ceiling catches generator bloat.
- Dual distribution per [architecture](architecture.md#5-css-distribution-dual-mode): Tailwind-source consumers pay only for what they use via the normal content scan; the standalone bundle is the one that needs the budget.
- `sideEffects` lists only CSS; every JS module (intl modules included) is side-effect-free so tree-shaking holds.

## 5 Code splitting & lazy loading

- **The library never lazy-loads internally** — no dynamic `import()` anywhere in library source (lintable). Internal async boundaries would create loading states apps can't control or style.
- Apps own splitting; the docs ship a first-class recipe for the **date cluster**. A matching Chart recipe lands when `chart` ships (Wave 9) — the two entries whose weight justifies a boundary.
- `recharts` is a **future optional peer** (chart, Wave 9): not in published ranges at v1. When chart ships, cost is opt-in at install time, and `chart` re-exports wrappers only (no `export * from "recharts"`).
- The `react-aria/` quarantine keeps all tier-only dependencies (`react-aria-components`, the `react-aria` hooks package, `@internationalized/date`, and `tailwindcss-react-aria-components`) reachable only via `react-aria/` subpaths or the private RAC subtree, so no bare entry can accidentally pull them.

## 6 Runtime practices

- Animations touch **`transform` and `opacity` only** by default. Layout-property animations the library itself installs (the reviewed v1 exceptions) are:
  - **Accordion.Content** panel **height**: `transition-[height] duration-200` against base-ui's `--accordion-panel-height`. Collapsible does **not** install a height transition; it is an unstyled passthrough that exposes `--collapsible-panel-height` / `--collapsible-panel-width` for consumers.
  - **Accordion** default-variant Trigger **padding-bottom**: `transition-[padding-bottom]`.
  - **Sidebar** shell **width** during its 200 ms expand/collapse: gap and container `transition-[width] duration-200 ease-linear`. Offcanvas `left`/`right` offset, Rail position, and GroupLabel `-mt-8` snap. MenuButton color/background/box-shadow and GroupLabel opacity are non-layout.
  - **Item.Footer** content-reveal **grid track**: `grid-rows` `0fr↔1fr` plus `@starting-style`.
  - **Meter** bar fill: `transition-all` on the absolutely positioned fill (width of the value bar).
- Each of those exceptions is disabled by the central reduced-motion rule ([accessibility](accessibility.md) §7). New layout-property animation requires a spec amendment and measurement.
- Context values are **memoized** (`ElmeraGroupUiProvider` already does); no context provider re-renders its subtree on unrelated prop churn.
- No per-frame CSS-variable writes on shared ancestors (inherited-var recalc storms); transient interaction state writes `style.transform` on the element itself.
- Tooltips/popovers reuse base-ui's shared positioning; components never install their own scroll/resize listeners. Overlay positioning listeners belong to base-ui internals.
- **Document-level listeners the library installs** (and no others):
  1. **ThemeProvider** (`theme-provider.tsx`): while mounted, one `window` `storage` listener (filtered on `storageKey`) and, when `enableSystem` is true, one `matchMedia("(prefers-color-scheme: dark)")` `change` listener. Both are removed on cleanup.
  2. **`useIsMobile`** (package-private, Sidebar only): subscribes to `(max-width: 767px)` through `useSyncExternalStore`; the snapshot is `mql.matches` and the server snapshot is `false`.
  3. **Button intent prediction**: one package-private registry installs at most one document `pointermove` listener while at least one `onIntent` registration exists and removes it when the registry empties. `usePredictedEvents` and `useMergedRefs` are not public.
  4. **Sidebar.Provider**: one `window` `keydown` shortcut listener (`cmd`/`ctrl`+B) exists only while the Provider is mounted and is removed on cleanup.
- `ColorSchemeScript` / `colorSchemeScriptSource` read `matchMedia` once at first paint; they do not subscribe. `prefers-reduced-motion` is a CSS `@media` block in the library stylesheet, not a JS listener.

## 7 i18n cost

- Four locales (`nb-NO`, `sv-SE`, `en-US`, `fi-FI`) ship **eagerly** inside each string-bearing component's entry — a few hundred bytes per component at this scale, already inside the §2 ceilings. The runtime (`@internationalized/string`) is ~1 kB once. `useLocalizedStrings` caches one `LocalizedStringFormatter` per dictionary identity and locale, so chips, toasts, and pagination edges share an instance rather than allocating per mount (ADR [0006](../adr/0006-intl-strings.md), amendment 2026-09-02). _(Amended 2026-09-02 — ADR 0006 formatter-cache amendment.)_
- **Revisit threshold**: if shipped locales approach ~10, move to per-locale modules + resolver-level subsetting (the react-aria `optimize-locales` model — requires per-locale files to survive bundling as separate modules). Roadmap item, not v1 machinery.
