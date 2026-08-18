# Package architecture, build & distribution

Normative chapter for `@elmeragroup/ui`: the published package's structure, entry/export surface, build pipeline, JS + CSS distribution, and dependency policy. Sources: [Package architecture & build pipeline](../../wayfinder/tickets/008-package-architecture.md), [ADR 0005](../adr/0005-package-architecture.md), [Theme provider API](../../wayfinder/tickets/006-theme-provider-api.md), [Icon system](../../wayfinder/tickets/009-icon-system.md), [Spec: date & react-aria interim](../../wayfinder/tickets/024-spec-date-interim.md), [ADR 0006](../adr/0006-intl-strings.md).

Not owned here: repo workspace/turbo/lint/test setup → [tooling](tooling.md); token values, cascade, provider behavior, theme-CSS generation → [theming](theming.md); bundle budgets and RSC policy → [performance](performance.md); versioning and publish flow → [release](release.md).

## 1 Package boundary

- **One public package: `@elmeragroup/ui`** (ADR [0005](../adr/0005-package-architecture.md)). Theme API, icons, illustrations, every component, and both CSS modes are subpath exports of this single package — one version, no cross-package skew, no peer-range bookkeeping between siblings. There is **no** `@elmeragroup/tokens`, `@elmeragroup/icons`, or `@elmeragroup/fonts` package.
- Repo tooling (oxlint plugins incl. `tooling/oxlint-anti-slop`, shared configs) lives in separate `tooling/*` packages and is **never published under a name the library owns** — spec in [tooling](tooling.md).
- The internal (private) `@elmeragroup/*` scope already exists in company monorepos. **Any new public name must not collide with an internal package name**; the check runs in the release pipeline ([release](release.md)).
- Internal workspace helpers (e.g. the `cn` class-merge utility from the workspace `lib` package) are **build inputs, not exports**: pass 1 of the build (§4) bundles them into the entries that use them. There is **no `./utils` export** and no other grab-bag entry (per [component conventions](components/conventions.md)).

## 2 Entry & subpath map

All entries are ESM (§4). The published surface:

| Subpath | Contents | In root barrel? |
| --- | --- | --- |
| `@elmeragroup/ui` | Root barrel: **components + `/theme` API only** | — |
| `@elmeragroup/ui/<component>` | One bare path per component (`/button`, `/field`, `/select`, …) | yes |
| `@elmeragroup/ui/react-aria/<component>` | Quarantined react-aria interim tier (§2.2) | yes |
| `@elmeragroup/ui/theme` | `ThemeProvider`, `ThemeScope`, `useTheme`, `themeAttributes`, `themeSlug`/`parseThemeSlug`, `validateTheme`, `BRANDS`, `ColorSchemeScript`, `useColorScheme`, `ThemeInput`/`SupportedLocale` types, `ElmeraGroupUiProvider` | yes |
| `@elmeragroup/ui/icons` | Curated per-icon Phosphor re-exports + bespoke payment/signing/product marks + brand logo components (`BrandLogo`, per-brand logos, `ElmeraGroupLogo`, Steddi, Trumf) | **no** |
| `@elmeragroup/ui/illustrations` | Brand artwork components (`FkasMeter`, …) | **no** |
| `@elmeragroup/ui/css` | Raw Tailwind v4 source stylesheet (§5) | n/a |
| `@elmeragroup/ui/styles.css` | Precompiled standalone stylesheet for non-Tailwind apps (§5) | n/a |
| `@elmeragroup/ui/themes.css` | Theme token CSS: 16 brand/segment/variant permutations + the empty `[data-theme="dark"]` section (§5) | n/a |

Rules:

1. **Bare component path = the winning base-ui tier.** `@elmeragroup/ui/select` is always the canonical component ([conventions](components/conventions.md)). The re-homed typography components (`heading`, `text`, `span`) live at bare paths — they left the quarantine (ticket [024](../../wayfinder/tickets/024-spec-date-interim.md)).
2. **`react-aria/` quarantine.** The eleven public interim exports — date-picker, date-range-picker, date-field, calendar, range-calendar, search-field, grid-list, link, focusable, file-trigger, ui-providers — are reachable **only** under `@elmeragroup/ui/react-aria/<name>`. Each carries the migrate-to-base-ui marker in its spec; when a base-ui replacement lands at the bare path, the quarantined entry deprecates without a rename fight. `react-aria-components` and `@internationalized/date` must be imported **only** from modules under this prefix (lintable; keeps every other entry free of the cluster's weight — [performance](performance.md) §5).
3. **Barrel scope is fixed**: components + theme. Icons and illustrations are subpath-only so per-icon tree-shaking never depends on bundler barrel-shaking. Do not add them to the barrel.
4. **No default exports** anywhere; named exports only.

## 3 Exports map: codegen + test

- The `package.json` `exports` field is **code-generated** from the entry file layout (one generator script in the package, run as part of the build). Hand-editing `exports` is forbidden; adding a component = adding its source entry file, then regenerating.
- Generated per entry: `import` + `types` conditions (ESM-only, §4), plus the source-condition swap for workspace consumers (§7). CSS entries map to plain file paths.
- **Export-path test** (CI, merge gate): for every generated subpath, resolve and import it **against the published shape** (post-`publishConfig.directory`, from the `dist`-rooted layout) and assert (a) Node ESM resolution succeeds, (b) TypeScript resolves the `types` condition (verified in bulk by `arethetypeswrong`, §4), (c) the module's expected top-level export names exist. A subpath present on disk but missing from `exports` — or vice versa — fails the build.

## 4 Build pipeline

**tsdown (rolldown), kumo-style two-pass, ESM-only.** Uses the repo's standard tsdown template ([tooling](tooling.md) owns the config file locations).

- **Pass 1 — JS**: bundles each entry to a single ESM chunk. Workspace-internal code (shared `styles/utils` recipes, `cn`, per-component `intl/` modules, internal hooks) is **bundled in**; every npm dependency (`@base-ui/react`, `react-aria-components`, `@phosphor-icons/react`, `@internationalized/string`, `@internationalized/date`, `recharts`, `react`, `react-dom`) is **external**. Shared internal chunks are allowed where rolldown splits them; they live under `dist/` and are not exported.
- **Pass 2 — d.ts**: emits declarations per entry with **everything externalized** (no type bundling of npm deps; consumers resolve `@base-ui/react` types from our regular dependency).
- **`"use client"` preservation**: bundling strips directives, so tsdown's `banner` re-injects `'use client'` on every client-tier entry (client/server tiering per [performance](performance.md) §3). The same banner mechanism covers the Phosphor re-export entries in `/icons` — upstream `@phosphor-icons/react` dist lacks the directive, our re-export modules carry it (ticket [009](../../wayfinder/tickets/009-icon-system.md)). Server-safe entries get **no** banner. The banner list is derived from the same manifest that drives the exports codegen, so a new client component cannot ship directive-less.
- **ESM-only**: no CJS output, no `main`/`require` conditions. This also neutralizes Phosphor's ~5 MB CJS monolith — it is unreachable through our ESM-only graph.
- **CI gates** (merge-blocking, run on the packed artifact):
  - `publint` — package-manifest correctness (exports shape, file presence, ESM hygiene).
  - `arethetypeswrong` (`attw --pack`) — every subpath's types resolve correctly under `node16`/`bundler` resolution.
  - the export-path test (§3).
- **`publishConfig.directory: "dist"`** (base-ui pattern): the in-repo `package.json` keeps source-pointing exports for workspace consumers (§7); `npm publish`/changesets publishes the `dist` directory whose generated `package.json` carries the built exports map. The gates above run against the **published** shape, never the in-repo one.

## 5 CSS distribution (dual mode)

Published code in `node_modules` is not scanned by a consumer's Tailwind content pipeline by default — utility classes used only inside the library would silently generate nothing. The kumo dual distribution solves this for both consumer types:

1. **Tailwind v4 consumers** — import the raw source and point Tailwind at the package:

   ```css
   @import "@elmeragroup/ui/css";
   @import "@elmeragroup/ui/themes.css";
   @source "../node_modules/@elmeragroup/ui";
   ```

   The `@source` line (exactly one, documented in Quick start) makes the consumer's Tailwind build generate every utility the library's dist uses; the consumer gets dedup with their own utilities and full `@theme` customization. The published `dist` therefore keeps class strings **statically visible** (tv recipes serialize to literal strings — no runtime class construction).
2. **Non-Tailwind consumers** — import the precompiled bundle:

   ```css
   @import "@elmeragroup/ui/styles.css"; /* or a <link>: compiled utilities, preflight-scoped */
   @import "@elmeragroup/ui/themes.css";
   ```

   `styles.css` is built at package build time by running Tailwind over the library's own dist; it is self-contained and requires no consumer build step.
3. **`themes.css` is its own entry in both modes** — the 16 brand/segment/variant permutations plus the empty `[data-theme="dark"]` block, plain custom-property CSS with no Tailwind dependency. It is **codegen output, uncommitted**; generation mechanics, layer structure, and the CSS snapshot test belong to [theming](theming.md). Its size ceiling lives in [performance](performance.md) §2.

Both CSS modes ship in the same package version; there is no separate CSS package.

## 6 Dependency policy

| Dependency | Kind | Range policy | Scope |
| --- | --- | --- | --- |
| `react`, `react-dom` | **peer** | `^19` | the only unconditional peers |
| `recharts` | **optional peer** (`peerDependenciesMeta.optional: true`) | documented supported major | only `chart` imports it; `chart` re-exports wrappers, never `export * from "recharts"` |
| `@base-ui/react` | regular, **pinned** (exact version) | bumped deliberately per release | all base-ui-tier components |
| `react-aria-components` | regular, **pinned** | interim tier only | importable only under `react-aria/` (§2.2) |
| `@internationalized/date` | regular | — | **scoped to the date cluster**: imported only by `react-aria/` date entries; uninstalls from the dependency list together with the cluster at migration ([024](../../wayfinder/tickets/024-spec-date-interim.md)) |
| `@phosphor-icons/react` | regular, **pinned** | exact version (re-export surface is version-coupled) | `/icons` entries only |
| `@internationalized/string` | regular | — | ~1 kB runtime for built-in localized strings (ADR [0006](../adr/0006-intl-strings.md)); pulled by string-bearing components |

Rules:

- **React is the only thing consumers must already have.** Implementation libraries (base-ui, RAC, Phosphor, intl runtimes) are regular dependencies — never peers — so consumers do no bookkeeping for our internals and version skew is impossible.
- Optional-peer discipline: nothing outside `chart` may import `recharts`; the import is lintable and the entry is budgeted excluding recharts ([performance](performance.md) §2).
- Pinned deps (`@base-ui/react`, `react-aria-components`, `@phosphor-icons/react`) are bumped in dedicated PRs with the contract test suite as the gate — never by broad range resolution.
- No dependency on any framework (Next, React Router, TanStack) anywhere in the package — the theme entry is framework-agnostic by design (ticket [006](../../wayfinder/tickets/006-theme-provider-api.md): single `/theme` entry, no `next/` export).

## 7 sideEffects & tree-shaking

- `package.json` declares `"sideEffects": ["*.css"]` — every JS module, `intl/` locale modules included, is side-effect-free ([performance](performance.md) §4). This is what lets bundlers shake the root barrel down to the imported components; the barrel exists for DX, subpaths remain the steered default.
- Nothing in library JS executes at import time beyond declarations: no module-scope DOM access, no auto-registration, no import-time `console` output. Violations are treated as bugs against this section.

## 8 Workspace consumers (docs / playground)

- In-repo, the package's `exports` point at `src/` (TypeScript source, `development`/`source`-condition or direct path — the codegen emits both layouts): docs site and playground get instant HMR with no build step, no `transpilePackages` escape hatch needed for publishing correctness.
- On publish, `publishConfig.directory` swaps the world to `dist` (§4). Because CI's gates and the export-path test run against the published shape, the source-exports convenience can never mask a broken published package.
- Workspace consumers import the same public subpaths as external consumers — **no deep imports into `src/` internals** from docs/playground code (lintable), so docs examples are copy-paste-valid for real apps.
