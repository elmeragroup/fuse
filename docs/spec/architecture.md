# Package architecture, build & distribution

Normative chapter for `@elmeragroup/ui`: the published package's structure, entry/export surface, build pipeline, JS + CSS distribution, and dependency policy.

Not owned here: repo workspace/turbo/lint/test setup → [tooling](tooling.md); token values, cascade, provider behavior, theme-CSS generation → [theming](theming.md); bundle budgets and RSC policy → [performance](performance.md); versioning and publish flow → [release](release.md).

## 1 Package boundary

- **One public package: `@elmeragroup/ui`** (ADR [0005](../adr/0005-package-architecture.md)). Theme API, icons, illustrations, every component, and both CSS modes are subpath exports of this single package — one version, no cross-package skew, no peer-range bookkeeping between siblings. There is **no** `@elmeragroup/tokens`, `@elmeragroup/icons`, or `@elmeragroup/fonts` package.
- The package's own code is MIT (`package.json#license: "MIT"`). Vendored third-party artwork retains its source license and attribution: flag files ship their MIT license/provenance (§6a), and the five Twemoji-derived `emoji` graphics ship the CC BY 4.0 notice and license required by [emoji](components/emoji.md) §5. The package manifest includes all notice/license files; an MIT package field never relabels those assets.
- Repo tooling (oxlint plugins incl. `tooling/oxlint-anti-slop`, shared configs) lives in separate `tooling/*` packages and is **never published under a name the library owns** — spec in [tooling](tooling.md).
- The internal (private) `@elmeragroup/*` scope already exists in company monorepos. **Any new public name must not collide with an internal package name**; the check runs in the release pipeline ([release](release.md)).
- Internal helpers are **build inputs, not exports**. The unbundled build (§4) emits them only as package-private relative modules reachable from public entries; there is **no `./utils`, `./styles`, or `./hooks` export** and no other grab-bag entry (per [component conventions](components/conventions.md)). This repo works in isolation — there is **no dependency on `@elmeragroup/lib`** or any other internal package. The helpers the reference code took from it (`cn`, phone parsing/formatting helpers, shared recipes, and helper hooks) are vendored as package-private modules with their applicable license notices. The reference's `UserAgentParserResult` type and `userAgent` prop are deleted; user-agent detection is absent from both public and private library code.

Overlay containment is also package-private infrastructure. The shared resolver distinguishes no `ThemeScope` from a mounted scope whose element/ref is not attached yet; in the latter case it withholds portal content instead of falling back to `document.body`. The exact resolution and lifecycle contract is [theming](theming.md) §7.4, and every overlay's public `container` prop uses `HTMLElement | RefObject<HTMLElement>`.

## 2 Entry & subpath map

All entries are ESM (§4). The published surface:

| Subpath | Contents | In root barrel? |
| --- | --- | --- |
| `@elmeragroup/ui` | Root barrel: **components + `/theme` API only** | — |
| `@elmeragroup/ui/<component>` | One bare path for each of the 56 non-interim components (`/button`, `/field`, `/select`, …) | yes |
| `@elmeragroup/ui/react-aria/<component>` | Eleven quarantined react-aria interim entries (§2.2) | **no** |
| `@elmeragroup/ui/theme` | Server-safe: `themeAttributes`, `defaultDensityForVariant`, `densityAttributes`, `themeSlug`/`parseThemeSlug`, `coerceTheme`, `validateTheme`, `BRANDS`, `ColorSchemeScript`, `colorSchemeScriptSource`, and their public types. Client: `ThemeProvider`, `ThemeScope`, `useTheme`, `useColorScheme`, `ForceColorScheme`, `ElmeraGroupUiProvider`, `useElmeraGroupUi`, and their public types. No per-framework `/theme/*` entries | yes |
| `@elmeragroup/ui/icons` | Curated per-icon Phosphor re-exports + bespoke payment/signing/product marks + brand logo components (`BrandLogo`, per-brand logos, `ElmeraGroupLogo`, Steddi, Trumf) | **no** |
| `@elmeragroup/ui/illustrations` | Brand artwork component `FkasMeter` | **no** |
| `@elmeragroup/ui/css` | Raw Tailwind v4 source stylesheet (§5) | n/a |
| `@elmeragroup/ui/styles.css` | Precompiled standalone stylesheet for non-Tailwind apps (§5) | n/a |
| `@elmeragroup/ui/themes.css` | Theme token CSS: 20 brand/segment/variant permutations + the terminal commented `[data-theme="dark"]` placeholder (§5) | n/a |
| `@elmeragroup/ui/demo-stage-comfortable.css` | Generated DemoStage nested-density overlay: the library `:root[data-density="comfortable"]` block re-scoped onto `.DemoStage`. Docs preview sandbox only; not nested density in `ui.css` | n/a |
| `@elmeragroup/ui/flags` | Generated `flagAssets` country-code→asset manifest plus `FlagAssetCode` for the flag SVGs (§6) | **no** |
| `@elmeragroup/ui/flags/<CC>.svg` | Static two-letter country flag SVG assets (§6) | n/a |

The complete, enumerated list of published entries — the single source of truth the exports codegen (§3) implements — is [Appendix A](#appendix-a--canonical-entry-manifest).

Rules:

1. **Bare component path = the winning base-ui tier.** `@elmeragroup/ui/select` is always the canonical component ([conventions](components/conventions.md)). The re-homed typography components (`heading`, `text`, `span`) live at bare paths — they left the quarantine ).
2. **`react-aria/` quarantine.** The eleven public interim entries — date-picker, date-range-picker, date-field, calendar, range-calendar, search-field, grid-list, link, focusable, file-trigger, and ui-providers — are reachable **only** under `@elmeragroup/ui/react-aria/<name>`. `UiProviders` is a public transition convenience that composes the permanent theme provider with RAC `I18nProvider`/`RouterProvider`; it dies with the tier. Each entry carries the migrate-to-base-ui marker in its spec. `react-aria-components`, `react-aria`, and `@internationalized/date` may be imported only from source modules in the private RAC subtree or these `react-aria/` entry facades (lintable; [performance](performance.md) §5).
3. **Barrel scope is fixed**: the 56 bare components + theme. The eleven interim RAC components remain subpath-only so the quarantine is real; icons and illustrations are likewise subpath-only so per-icon tree-shaking never depends on barrel-shaking. Do not add either group to the barrel.
4. **No default exports** anywhere; named exports only.

## 3 Exports map: codegen + test

- The `package.json` `exports` field is **code-generated** from the entry file layout (one generator script in the package, run as part of the build). Hand-editing `exports` is forbidden; adding a component = adding its source entry file, then regenerating.
- Generated per entry: `types` + `import` conditions (ESM-only, §4), with two concrete layouts from the same manifest: the repository `package.json` maps them directly to `src/**/*.ts(x)`, while `dist/package.json` maps them to emitted `.d.ts`/`.js` files (§7). No custom `source` or `development` export condition is used. CSS entries map to plain file paths in the corresponding source or distribution layout.
- **Export-path test** (CI, merge gate): for every generated subpath, resolve and import it **against the published shape** (post-`publishConfig.directory`, from the `dist`-rooted layout) and assert (a) Node ESM resolution succeeds, (b) TypeScript resolves the `types` condition (verified in bulk by `arethetypeswrong`, §4), (c) the module's expected top-level export names exist. A subpath present on disk but missing from `exports` — or vice versa — fails the build.

## 4 Build pipeline

**tsdown (rolldown), unbundled ESM-only.** `unbundle: true` compiles every reachable source module to a corresponding output module. This is the hard requirement that makes mixed entries implementable: bundling `/theme` into one entry chunk would make a server-only import inherit a client boundary.

- One JS+d.ts pass emits the `src/` module graph under `dist/` with `root: "src"`, `unbundle: true`, `format: "esm"`, and `dts: true`. Package-private helpers remain relative modules in the tarball and remain inaccessible through `package.json#exports`.
- `deps.neverBundle: true` externalizes every npm dependency. `deps.onlyImport` lists the approved runtime packages from §6 and fails the build for phantom runtime dependencies. The deprecated top-level `external` option is forbidden.
- **`"use client"` is a per-source-file directive.** Every source module that owns state, effects, handlers, contexts, or browser APIs starts with it; every other source module omits it. Because unbundle mode preserves the one-source/one-output boundary, `/theme` can re-export server-safe `themeAttributes` / `defaultDensityForVariant` / `densityAttributes` / `ColorSchemeScript` / `colorSchemeScriptSource` / slug helpers alongside client `ThemeProvider` / `ThemeScope` / `useTheme` / `useColorScheme` / `ForceColorScheme` modules without collapsing them. Root and subpath barrels are directive-free re-export facades. Curated Phosphor adapters stay server-safe by importing the pinned dependency's explicit `dist/ssr/<Icon>` modules ([icons](icons.md) §2). Hosts place `ColorSchemeScript` or `colorSchemeScriptSource` in server/static HTML; they must not import those names through a client-only graph and expect first paint.
- An emitted-directive test compares every `src/**/*.{ts,tsx}` module with its `dist/` counterpart and asserts that all and only source modules with a leading `"use client"` retain it. A Next packed-consumer fixture proves server imports do not cross a client boundary.
- **ESM-only**: no CJS output, no `main`/`require` conditions. This also neutralizes Phosphor's ~5 MB CJS monolith — it is unreachable through our ESM-only graph.
- **Package-shape checks**: `publint`, `arethetypeswrong` (`attw --pack`, `esm-only` profile), the export-path test (§3), the emitted-directive test, and the packed-asset contract run against the one packed artifact in the merge gate and again at publish. [Release §5](release.md#5-publish-time-gates) is the exhaustive publish-gate list; this chapter defines these checks, not a competing release list. The two full consumer fixtures are publish-only ([tooling](tooling.md) §7.5).

### 4.1 tsdown config template

`entries` is generated from the same manifest as `package.json#exports`; `sourceFiles` is its transitive source-file list with tests, demos, stories, and type tests excluded.

```ts
import { defineConfig } from "tsdown";
import { entries } from "./scripts/entries"; // same manifest that drives exports codegen (§3, Appendix A)

export default defineConfig({
  entry: entries.sourceFiles,
  root: "src",
  outDir: "dist",
  format: "esm",
  platform: "browser",
  unbundle: true,
  dts: true,
  clean: true,
  sourcemap: true,
  deps: {
    neverBundle: true,
    onlyImport: entries.runtimeDependencies,
  },
  publint: true,
  attw: { profile: "esm-only", level: "error" },
});
```

This follows tsdown's documented [unbundle mode](https://tsdown.dev/options/unbundle) and [`deps.neverBundle`](https://tsdown.dev/options/dependencies) contract. Do not replace it with per-entry bundles or static banners.
- **`publishConfig.directory: "dist"`** (base-ui pattern): the in-repo `package.json` keeps source-pointing exports for workspace consumers (§7); `npm publish`/changesets publishes the `dist` directory whose generated `package.json` carries the built exports map. The gates above run against the **published** shape, never the in-repo one.

## 5 CSS distribution (dual mode)

Published code in `node_modules` is not scanned by a consumer's Tailwind content pipeline by default — utility classes used only inside the library would silently generate nothing. The kumo dual distribution solves this for both consumer types:

1. **Tailwind v4 consumers** — import the raw source and point Tailwind at the package:

   ```css
   @import "tailwindcss";
   @import "@elmeragroup/ui/css";
   @import "@elmeragroup/ui/themes.css";
   @source "../node_modules/@elmeragroup/ui";
   ```

   The `@source` line (exactly one, documented in Quick start) makes the consumer's Tailwind build generate every utility the library's published JavaScript uses. Because `publishConfig.directory: "dist"` publishes the contents of `dist/` as the package root, an installed package has no nested `@elmeragroup/ui/dist` directory. The path above targets the published package root; it is relative to the consumer stylesheet and must be adjusted only when that stylesheet is not one directory below the app root. Workspace-only docs/playground builds instead scan `packages/ui/src`. The consumer gets dedup with their own utilities and full `@theme` customization. Emitted class strings remain **statically visible** (tv recipes serialize to literal strings — no runtime class construction). The library's build-only standalone-CSS wrapper is a different context and continues to scan its in-repo `dist/**/*.js` graph ([theming](theming.md) §3.4).
2. **Non-Tailwind consumers** — import the precompiled bundle:

   ```css
   @import "@elmeragroup/ui/styles.css"; /* or a <link>: compiled component utilities, no Preflight */
   @import "@elmeragroup/ui/themes.css";
   ```

   `styles.css` is built at package build time by running Tailwind over the library's own dist. It contains the generated component utilities, custom variants, and package utilities but **excludes Tailwind Preflight**: a reusable library must not reset the host page. Components explicitly declare the element defaults they depend on; the consuming app owns its global reset. The file is otherwise self-contained and requires no consumer build step.
3. **`themes.css` is its own entry in both modes** — the 20 brand/segment/variant permutations plus a terminal comment reserving the `[data-theme="dark"]` block (no empty CSS rule node), plain custom-property CSS with no Tailwind dependency. It is **codegen output, uncommitted**; generation mechanics, layer structure, and the CSS snapshot test belong to [theming](theming.md). Its size ceiling lives in [performance](performance.md) §2.
4. **`demo-stage-comfortable.css`** is generated at package build from the `:root[data-density="comfortable"]` block in `ui.css`, re-scoped onto `.DemoStage`. The docs preview sandbox imports it; `ui.css` stays `:root`-anchored. This is not nested density in library CSS.

Both CSS modes ship in the same package version; there is no separate CSS package.

## 6 Dependency policy

| Dependency | Kind | Range policy | Scope |
| --- | --- | --- | --- |
| `react`, `react-dom` | **peer** | `^19` | the only unconditional peers |
| `recharts` | **optional peer** (`peerDependenciesMeta.optional: true`) | `^2.15.4` | only `chart` imports it; `chart` re-exports wrappers, never `export * from "recharts"` |
| `@base-ui/react` | regular, **pinned** | `1.6.0` | all base-ui-tier components |
| `react-aria-components` | regular, **pinned** | `1.19.0` | interim tier only; importable only under `react-aria/` (§2.2) |
| `react-aria` (the hooks package) | regular, **pinned** | `3.50.0` | used only by `react-aria/focusable`; uninstalls together with the cluster at migration |
| `@internationalized/date` | regular | `^3.12.2` | **scoped to the date cluster**: imported only by `react-aria/` date entries; uninstalls from the dependency list together with the cluster at migration ) |
| `@phosphor-icons/react` | regular, **pinned** | `2.1.10` (wrapper surface and SSR subpaths are version-coupled) | `/icons` entries only |
| `@internationalized/string` | regular | `^3.2.10` | ~1 kB runtime for built-in localized strings (ADR [0006](../adr/0006-intl-strings.md)); pulled by string-bearing components |
| `libphonenumber-js` | regular | `^1.13.9`, default (min metadata) entry | phone parsing/formatting for `phone-number-field`; picker countries are the metadata list intersected with `flagAssets` (§6a) |
| `tailwind-variants` | regular | `^3.2.2` | the `tv` recipe runtime; every styled component's variants |
| `clsx`, `tailwind-merge` | regular | `^2.1.1`, `^3.6.0` | package-private `cn` implementation |
| `sugar-high` | regular | `^1.2.1` | syntax highlighting in `code` |
| `tw-animate-css` | regular | `^1.4.0` | imported by the raw CSS entry |
| `tailwindcss-react-aria-components` | regular, **pinned** | `2.2.0` | RAC state variants; removed with that tier |
| `tailwindcss` | optional peer | `^4` | required only by raw-source CSS consumers; standalone-CSS consumers do not install it |

Rules:

- **React is the only unconditional peer consumers must already have.** Chart consumers also install the optional `recharts` peer; raw-source CSS consumers install the optional Tailwind peer. Standalone-CSS consumers need neither. Implementation libraries (base-ui, RAC, Phosphor, intl runtimes) are regular dependencies — never peers — so consumers do no bookkeeping for our internals and version skew is impossible.
- Optional-peer discipline: nothing outside `chart` may import `recharts`; the import is lintable and the entry is budgeted excluding recharts ([performance](performance.md) §2).
- Pinned deps (`@base-ui/react`, `react-aria-components`, `react-aria`, `@phosphor-icons/react`) are bumped in dedicated PRs with the contract test suite as the gate — never by broad range resolution.
- No dependency on any framework (Next, React Router, TanStack) anywhere in the package — the theme entry is framework-agnostic by design : single `/theme` entry, no `next/` export).

## 6a Flag assets

Country flags for `phone-number-field` (and any future country UI) ship as **external static assets, never JS**:

- **Source**: two-letter country SVG flags vendored from [`yammadev/flag-icons`](https://github.com/yammadev/flag-icons) (MIT, copyright Yefferson), pinned to commit `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e`. The vendoring script records the source repo, commit, license, and file hashes; `flags/LICENSE` and `flags/PROVENANCE.md` ship in the tarball.
- **Layout**: exactly the source snapshot's **249 two-letter files** under a `flags/` directory in the published package, plus a **generated manifest module** derived from those filenames. Subdivision/collection artwork (`US-CA`, `GB-ENG`, `LGBT`, etc.) is not copied. The manifest exports `flagAssets` and `FlagAssetCode = keyof typeof flagAssets`; it is not generated from `libphonenumber-js`, whose calling-code inventory is a different dataset.
- **Phone-country resolution**: `libphonenumber-js@1.13.9` contains four calling-code countries with no file in the pinned flag snapshot: `AC`, `BQ`, `EH`, and `TA`. They are the exact **asset-availability exclusions**, separate from PhoneNumberField's 28-country product/compliance exclusion set. PhoneNumberField forms its picker by filtering the metadata country list through both sets and `code in flagAssets`. Its `defaultCountryCode`, private `Flag`, and selected-country state use `Extract<CountryCode, FlagAssetCode>` so source-only assets that are not libphonenumber countries are not accepted either; auto-detection changes country only when the detected code resolves through `flagAssets`. Untyped input that supplies an unresolved default falls back to `NO` when present in the supplied metadata, otherwise the first picker country; an empty resolved picker throws a descriptive configuration error before render. Codegen/contract tests assert that every picker/default/auto-detected country state resolves to a shipped SVG and that the baseline libphonenumber→asset gap is exactly the four codes above. A dependency or asset refresh that changes that set is a reviewed contract change, never an implicit fallback or wrong-country flag.
- **Exports**: the manifest module (`@elmeragroup/ui/flags`) and the asset files via a subpath pattern (`@elmeragroup/ui/flags/<CC>.svg`) are both in the generated exports map (§3, Appendix A).
- **Consumption is `<img>` only.** Every uppercase `FlagAssetCode` key maps to a static `new URL("./flags/<CC>.svg", import.meta.url).href` expression; components render `<img src={flagAssets[code]} alt="" aria-hidden="true" width={20} height={15} loading="lazy" decoding="async" draggable={false}>`. The build must not inline, componentize, sprite, remotely fetch, or substitute another country's SVG. This produces the same art on macOS and Windows, keeps SVG bytes outside JavaScript, works offline, and lets the browser lazily request/cache image assets independently. Unicode flags and CDN URLs are explicitly rejected.
- **Measured payload gate**: the 249 shipped source files are exactly **765,286 bytes** at the pinned commit (~747 KiB raw; compressed tarball size is lower). CI asserts the count, hashes, and an aggregate raw ceiling of **800 KiB**. Individual files legitimately vary up to ~27 KiB, so there is no per-file ceiling. Any source refresh that changes a hash or breaches the aggregate ceiling requires an explicit asset review and changeset.

## 7 sideEffects & tree-shaking

- `package.json` declares `"sideEffects": ["**/*.css"]` — every JS module, `intl/` locale modules included, is side-effect-free ([performance](performance.md) §4). This is what lets bundlers shake the root barrel down to the imported components; the barrel exists for DX, subpaths remain the steered default.
- Nothing in library JS executes at import time beyond declarations: no module-scope DOM access, no auto-registration, no import-time `console` output. The sole environment branch is `process.env.NODE_ENV` inside `validateTheme` when that function is called, as specified in [theming](theming.md) §7.6 and linted by [tooling](tooling.md) §5.2. Violations are treated as bugs against this section.

## 8 Workspace consumers (docs / playground / static-theme)

- In-repo, the generated `package.json#exports` maps `types` and `import` directly to the TypeScript entries under `src/`; there is no custom `source`/`development` condition. Docs and playground therefore get instant HMR with no package build step and no `transpilePackages` escape hatch needed for publishing correctness.
- On publish, `publishConfig.directory` swaps the world to `dist` (§4). Because CI's gates and the export-path test run against the published shape, the source-exports convenience can never mask a broken published package.
- Workspace consumers import the same public subpaths as external consumers — **no deep imports into `src/` internals** from docs/playground/static-theme application code (lintable), so docs examples are copy-paste-valid for real apps.
- The Vite first-paint fixture's **config** loads the published `/theme` JavaScript (`packages/ui/dist/theme.js`) so `colorSchemeScriptSource`'s `Function#toString()` is the packed closed IIFE rather than workspace TypeScript source. That is the published entry shape, not a `src/` deep import. A bundling Vite config loader must not rewrite that generator. Application modules in that fixture still import `@elmeragroup/ui/theme`.

## Appendix A — canonical entry manifest

This list is exhaustive. Every **bare** component entry is also re-exported by the root barrel; the eleven interim RAC entries are deliberately excluded from it and remain reachable only through `react-aria/*`. Public recipes and component-specific public hooks come from the same entry as their component.

- **Bare component entries (56):** `accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `card`, `chart`, `checkbox`, `checkbox-card`, `code`, `collapsible`, `combobox`, `confirm-button`, `description-list`, `dialog`, `dropdown-menu`, `emoji`, `empty`, `field`, `frame`, `heading`, `input`, `input-group`, `item`, `loader`, `meter`, `number-field`, `pagination`, `phone-number-field`, `popover`, `popover-info-button`, `radio-group`, `scroll-area`, `select`, `selection-item`, `separator`, `sheet`, `show`, `sidebar`, `skeleton`, `span`, `switch`, `table`, `tabs`, `text`, `text-field`, `textarea`, `textarea-field`, `timeline-list`, `toast`, `toggle`, `toggle-group`, `tooltip`.
- **Interim RAC entries (11):** `react-aria/calendar`, `react-aria/date-field`, `react-aria/date-picker`, `react-aria/date-range-picker`, `react-aria/file-trigger`, `react-aria/focusable`, `react-aria/grid-list`, `react-aria/link`, `react-aria/range-calendar`, `react-aria/search-field`, `react-aria/ui-providers`.
- **Non-component JS entries:** `.`, `theme`, `icons`, `illustrations`, `flags`.
- **CSS/assets:** `css`, `styles.css`, `themes.css`, `demo-stage-comfortable.css`, `flags/*.svg`.

The manifest codegen rejects duplicate names, missing source files, unexpected source entries, or an entry not represented here. `flags/*.svg` is the sole pattern export; every JS/CSS export is enumerated.
