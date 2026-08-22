# 009 — Phosphor Icons as the icon family for @elmeragroup/ui

Research date: 2026-08-17. Methods: fetched primary sources (GitHub `phosphor-icons/react`, `phosphor-icons/core`, `phosphor-icons/homepage`, npm registry, lucide.dev) and **installed `@phosphor-icons/react@2.1.10` + `@phosphor-icons/core@2.1.1` locally** to measure sizes, inspect dist output, and run the coverage mapping. Numbers are tagged **[measured]** (verified locally) or **[claimed]** (stated by a source).

## TL;DR verdict

**Suitable, with three caveats.** Phosphor is MIT-licensed, ESM-first, `sideEffects: false`, genuinely per-icon tree-shakeable (verified with esbuild), typed with a clean `Icon`/`IconProps` contract, and covered **all 232 lucide-equivalent UI concepts we checked (232/232)** plus nearly all energy-domain concepts (misses: `ev-station`, `refrigerator`, `activity`, `meter`, `heat/radiator` — all with close substitutes). It has multiple animation-ready spinners (`spinner`, `spinner-gap`, `circle-notch`).

Caveats:

1. **Every icon component ships all six weight variants** — one Map with 6 path sets per icon. A Phosphor icon costs ~3.2 KB min / ~0.8 KB gzip vs lucide's ~0.4 KB min / ~0.18 KB gzip per icon [measured]. For a curated set of ~150 icons that's roughly ~480 KB min / ~120 KB gzip vs ~60 KB / ~27 KB with lucide — real but tolerable; avoidable entirely by building own components from `@phosphor-icons/core` SVGs (regular weight only).
2. **No `'use client'` directives anywhere in the package** [measured]. The default (`/dist/csr`) icons use `useContext` + `forwardRef`, so in Next App Router RSC they must be imported into a client component, or you use the separate `/dist/ssr` entrypoint (no context support). A library re-exporting them must add its own `'use client'` banner or standardize on the SSR variants.
3. **Slow release cadence**: last npm release May 2025 (v2.1.10); `@phosphor-icons/core` on npm last published March 2024, though both repos had pushes as recently as Jan 2026. React 19 works (peer range `>= 16.8`), but `forwardRef`-based composition for _custom_ icons is a known open irritation ([#137](https://github.com/phosphor-icons/react/issues/137)).

The strongest option for @elmeragroup/ui: **own icon components generated from `@phosphor-icons/core` SVGs at one standardized weight** — smallest bundles, no context/RSC/CJS pitfalls, no runtime dependency to version-manage. Re-exporting `@phosphor-icons/react` directly is workable but inherits all three caveats.

---

## 1. Package facts

| Fact            | Value                                                                                | Source                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package         | `@phosphor-icons/react`                                                              | [npm](https://www.npmjs.com/package/@phosphor-icons/react)                                                                                                             |
| Current version | **2.1.10** (published 2025-05-22) [measured via `npm view`]                          | [npm registry](https://registry.npmjs.org/@phosphor-icons/react)                                                                                                       |
| License         | MIT                                                                                  | [npm](https://www.npmjs.com/package/@phosphor-icons/react), [GitHub LICENSE](https://github.com/phosphor-icons/react)                                                  |
| Dependencies    | **none**; peerDeps `react >= 16.8`, `react-dom >= 16.8` [measured]                   | package.json in installed tarball                                                                                                                                      |
| `sideEffects`   | `false` [measured]                                                                   | package.json                                                                                                                                                           |
| `type`          | `module` (ESM-first; CJS + UMD fallbacks) [measured]                                 | package.json                                                                                                                                                           |
| Unpacked size   | 33.0 MB (npm) / 57 MB dist on disk incl. sourcemap-free duplicates [measured]        | `npm view`, `du`                                                                                                                                                       |
| Icons           | **1,512 unique icons** (`dist/csr` file count) × 6 weights = 9,072 glyphs [measured] | installed package; "1,512 icons and counting in 6 weights" [claimed] per [Figma plugin page](https://www.figma.com/community/plugin/898620911119764089/phosphor-icons) |
| GitHub          | 1,722 stars, 20 open issues, pushed 2026-01-06 [measured via GitHub API]             | [api.github.com/repos/phosphor-icons/react](https://api.github.com/repos/phosphor-icons/react)                                                                         |

### Module/exports mechanics [measured, package.json `exports`]

- Root `.` → `dist/index.es.js` (195 KB barrel of re-exports) / `require` → `dist/index.cjs.js` (**5.1 MB monolith**).
- Per-icon subpaths: `./dist/csr/*`, `./dist/icons/*` (legacy alias), and a catch-all `./*` → `dist/csr/*.es.js`.
- SSR: `./ssr` and `./dist/ssr/*` → context-free variants.
- **Pitfall**: every subpath's `require` condition maps to the whole `dist/index.cjs.js`. Per-icon granularity exists **only under ESM**. A CJS consumer (or a library emitting CJS that imports subpaths) drags in the 5.1 MB monolith.

### Tree-shaking and size [measured with esbuild 0.2x, `--bundle --minify --external:react`]

| Bundle                                             | Minified | Gzip    |
| -------------------------------------------------- | -------- | ------- |
| 1 icon (`CaretDownIcon` via subpath)               | 1.9 KB   | 0.82 KB |
| 10 typical icons via **root barrel** named imports | 32.3 KB  | 8.0 KB  |
| Entire library (`export *`)                        | 5.23 MB  | 1.14 MB |
| lucide-react, same 10 icons                        | 4.2 KB   | 1.8 KB  |

So: named imports from the root barrel **do** tree-shake under esbuild (32 KB, not 5 MB) — consistent with the README's claim that "your bundle only includes code for the icons you use" ([README](https://github.com/phosphor-icons/react)). The README nonetheless warns that some dev servers/bundlers transpile all 9,000+ icon modules on the dev-server path and recommends per-icon subpath imports or Next.js `optimizePackageImports` ([README, "Imports" section](https://github.com/phosphor-icons/react#imports)). Average per-icon cost: ~3.2 KB min / ~0.8 KB gzip, because **each icon's def file (avg 3.48 KB [measured]) contains all six weights**.

## 2. React API

Verified against installed dist source and [README](https://github.com/phosphor-icons/react).

- **Per-icon components**: `dist/csr/<Name>.es.js` exports both `Name` and `NameIcon` (the `Icon` suffix was added in v2.1.8, [releases](https://github.com/phosphor-icons/react/releases)). Each is `forwardRef((props, ref) => <IconBase weights={defsMap} .../>)` [measured].
- **Props** [measured, `dist/lib/types.d.ts`]:
  ```ts
  export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  export interface IconProps extends ComponentPropsWithoutRef<"svg">, RefAttributes<SVGSVGElement> {
    alt?: string;
    color?: string;
    size?: string | number;
    weight?: IconWeight;
    mirrored?: boolean;
  }
  export type Icon = React.ForwardRefExoticComponent<IconProps>;
  ```
  Full SVG prop passthrough; `alt` renders a `<title>` child; `mirrored` applies `transform="scale(-1, 1)"` [measured, `IconBase.es.js`].
- **Defaults**: `color: "currentColor"`, `size: "1em"`, `weight: "regular"`, `mirrored: false` — supplied by `IconContext`'s default value [measured, `context.es.js`].
- **IconContext**: `IconContext.Provider` sets defaults for all nested icons; per-icon props override ([README](https://github.com/phosphor-icons/react#composability)).
- **SSR/RSC**: **no `'use client'` directive exists anywhere in dist** [measured, grep]. CSR icons call `useContext` inside `IconBase`, so importing them directly into a Next.js App Router Server Component fails; the sanctioned options are (a) import from `@phosphor-icons/react/ssr` (context-free `SSRBase`, added v2.0.11, [releases](https://github.com/phosphor-icons/react/releases)) — with the documented limitation that SSR icons "cannot inherit styles from an ancestor IconContext" ([README](https://github.com/phosphor-icons/react#react-server-components)) — or (b) use CSR icons only inside client components. Users have requested embedded `'use client'` + an `IconProvider` ([issue #92](https://github.com/phosphor-icons/react/issues/92), open, Apr 2024). Note the SSR variants still use `forwardRef`, which is RSC-safe.
- **React 19**: peer range `>= 16.8` includes 19; using the icons works ([issue #108](https://github.com/phosphor-icons/react/issues/108), closed). Friction point: the documented _custom icon_ composition pattern requires `forwardRef`, deprecated (not removed) in React 19 — maintainers say they can't eliminate it while supporting older Reacts ([issue #137](https://github.com/phosphor-icons/react/issues/137)).
- **TypeScript quality**: good — `Icon`, `IconProps`, `IconWeight` exported from root and `./lib`; every icon `.d.ts` typed as `Icon`; JSDoc icon previews in editors since v2.1.6 ([releases](https://github.com/phosphor-icons/react/releases)).

## 3. Weights

Six weights: `thin | light | regular | bold | fill | duotone` ([README](https://github.com/phosphor-icons/react)). Mechanism [measured, `dist/defs/*.es.js`]: each icon has one def module exporting a `Map<IconWeight, ReactElement>` with pre-rendered `<path>` elements for **all six weights**; `IconBase` picks `weights.get(weight)` at render time. Duotone entries are two paths, one at `opacity: 0.2`.

Implications:

- **Weight switching is a pure prop change** — no separate imports, instant theming, animatable between weights only via swap (paths differ, not stroke-width interpolation).
- **Bundle cost**: importing one icon always pays for six weights (~6× path data). Unused weights are _not_ tree-shaken — they live in one Map inside one module. This is the main size disadvantage vs lucide.
- **Standardizing one default weight** in a design system is easy at the API level (wrap `IconContext.Provider` or fix `weight="regular"` in a wrapper component) but does **not** recover the bundle cost. To pay for only one weight, generate components from `@phosphor-icons/core/assets/<weight>/*.svg` instead — regular-weight SVGs average ~0.5 KB raw [measured, e.g. `caret-down.svg` = 219 bytes].
- Phosphor weights are **cut as separate outline shapes filled with `currentColor`** (`fill`-based rendering, `viewBox="0 0 256 256"`), not strokes — so weight is discrete, unlike lucide's continuous `strokeWidth`.

## 4. Coverage mapping

Method [measured]: script mapped **232 lucide icon concepts** (chevrons/carets, arrows, check/x, trash, pencil, search, plus/minus, user(s), gear, calendar, clock, download/upload, external-link, eye/eye-slash, funnel, copy, loaders, alert/info circles, buildings, phone, mail, file/folder, house, menu, dots-three, refresh, sign-out, star, heart, lock/unlock, lightning, sun, moon, globe, map-pin, credit-card, shopping-cart, package, truck, wallet, receipt, percent, tag, trend-up/down, chart-bar/line/pie, table, list, grid, columns, rows, kanban, bell, media controls, printer, share, maximize/minimize, sliders, toggles, paperclip, hash, at, currencies, lightbulb, flame, leaf, drop, thermometer, wind, plug, battery, power, wifi, monitor, database, qr-code, fingerprint, trophy, sparkle, undo/redo, grips, sidebar/panels, layers, prohibit, …) to candidate Phosphor names and checked existence in `@phosphor-icons/core@2.1.1/assets/regular/`. Script: scratchpad `map.mjs`.

**Result: 232/232 found.** Zero gaps in the typical-UI set. Name translation is required (Phosphor's vocabulary differs from lucide's): `chevron-*` → `caret-*`, `search` → `magnifying-glass`, `settings` → `gear`, `edit` → `pencil-simple`/`note-pencil`, `home` → `house`, `menu` → `list`, `more-horizontal` → `dots-three`, `external-link` → `arrow-square-out`, `eye-off` → `eye-slash`, `filter` → `funnel`, `alert-triangle` → `warning`, `alert-circle` → `warning-circle`, `mail` → `envelope`, `log-out` → `sign-out`, `zap` → `lightning`, `refresh-cw` → `arrows-clockwise`, `trending-up` → `trend-up`, `bar-chart` → `chart-bar`, `save` → `floppy-disk`, `history` → `clock-counter-clockwise`, `help-circle` → `question`, `grip-vertical` → `dots-six-vertical`, `ban` → `prohibit`, `award` → `medal`, `send` → `paper-plane-tilt`.

**Energy-sales / Material-Symbols-adjacent concepts** [measured, same method]: present — `solar-panel`, `windmill`, `lightning`, `plug`, `plugs`, `plugs-connected`, `charging-station`, `battery-charging`, `gas-pump`, `gauge`, `invoice`, `receipt`, `handshake`, `headset` (≈ support_agent), `seal-check` (≈ verified), `identification-card`, `house-line`, `buildings`, `car`, `snowflake`, `fan`, `fire`/`flame`, `thermometer`, `signature`, `piggy-bank`, `hand-coins`, `money-wavy`, `currency-eur`, `washing-machine`, `oven`, `television`, `train`/`bus`/`taxi`/`bicycle`. **Misses with substitutes**: `ev-station` → `charging-station`; `refrigerator` → none close (use `snowflake` or custom); `activity` → `pulse`; `meter` (electric meter) → `gauge`; `heat`/`radiator` → `thermometer`/`fire`. Caveat: the exact 78-icon Material list wasn't available to this research; the check covered representative energy/CRM concepts — rerun `map.mjs` against the real list before committing.

**Spinner**: yes — `spinner`, `spinner-gap`, `spinner-ball`, and `circle-notch` all exist [measured]; `circle-notch`/`spinner-gap` are the usual choices for a CSS `animation: spin` loader (rotationally asymmetric, reads as motion).

## 5. Ecosystem / tooling

- **Figma**: official plugin ([Phosphor Icons plugin](https://www.figma.com/community/plugin/898620911119764089/phosphor-icons)) and official profile ([figma.com/@phosphoricons](https://www.figma.com/@phosphoricons)); library generator at [phosphor-icons/figma](https://github.com/phosphor-icons/figma).
- **Raw SVGs**: [`@phosphor-icons/core`](https://github.com/phosphor-icons/core) npm 2.1.1 (MIT), `assets/<weight>/<name>.svg`, 1,512 per weight [measured]; exports subpaths per SVG plus a catalog module. Note: npm publish is from 2024-03-29 [measured]; repo pushed 2026-01-06 — newer icons may exist in-repo before an npm release.
- **Web font**: [`@phosphor-icons/web`](https://github.com/phosphor-icons/web) exists (noted per brief; not relevant — font icons are inferior for a component library).
- **Other official packages**: Vue, Flutter, Elm, Swift, + 30 community ports ([phosphor-icons/homepage](https://github.com/phosphor-icons/homepage)).

### lucide vs phosphor [measured where noted]

|                                | lucide-react 1.31.0                                                                                                          | @phosphor-icons/react 2.1.10                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Icon count                     | "1600+" [claimed, [lucide.dev](https://lucide.dev/guide/)]; 2,008 icon modules incl. aliases [measured]                      | 1,512 unique × 6 weights = 9,072 [measured]                                                                                              |
| Default style                  | stroke-based outlines: `fill:none; stroke:currentColor; strokeWidth:2; round caps/joins` [measured, `defaultAttributes.mjs`] | filled outline shapes, `fill:currentColor` [measured, core SVGs]                                                                         |
| Grid / viewBox                 | `0 0 24 24`, default 24px [measured]                                                                                         | `0 0 256 256`, default `1em` [measured]; "designed at 16×16 px" [claimed, [homepage README](https://github.com/phosphor-icons/homepage)] |
| Stroke/weight control          | continuous `strokeWidth` (+ `absoluteStrokeWidth`)                                                                           | discrete 6-weight `weight` prop                                                                                                          |
| Per-icon gzip (10-icon bundle) | ~0.18 KB [measured]                                                                                                          | ~0.8 KB [measured]                                                                                                                       |
| License                        | ISC                                                                                                                          | MIT                                                                                                                                      |
| Default size                   | 24                                                                                                                           | `1em` (inherits font-size — arguably nicer in text)                                                                                      |

## 6. Pitfalls when re-exporting a subset from a published library

1. **`'use client'`**: Phosphor ships none. If @elmeragroup/ui re-exports CSR icons, the library's own icon entry chunk must carry `'use client'` (tsdown/rolldown `banner` or a directive-preserving plugin), or re-export the `/ssr` variants (losing `IconContext`). Building own components from core SVGs sidesteps this — an icon that's pure SVG with props needs no directive at all and works in RSC natively.
2. **CJS trap**: every subpath's `require` condition resolves to the 5.1 MB `index.cjs.js` [measured]. If the library publishes a CJS build that imports Phosphor subpaths, CJS consumers get the monolith. ESM-only output (or inlining the icons at build time) avoids this.
3. **Peer vs regular dependency**: if the library re-exports Phosphor components, make it a **regular dependency** (it has no singleton state that must be shared; `IconContext` only matters if the app _also_ uses Phosphor directly and expects one context — in that case duplicate copies mean the app's `IconContext.Provider` won't style the library's icons). If icons are part of the library's public API surface that apps also import directly, a **peerDependency with a caret range** prevents double-instancing. If the library inlines SVG paths from `@phosphor-icons/core` at build time, core becomes a devDependency and consumers carry no Phosphor dependency at all — cleanest.
4. **Duplicate-icon bundling**: with `sideEffects:false` and per-icon ESM modules, apps that import both the library's re-exports and Phosphor directly will still dedupe _if_ versions match; pin/align via peerDependency range or avoid by inlining. Two different Phosphor versions in one node_modules tree = every shared icon duplicated (~0.8 KB gzip each).
5. **Version pinning**: releases are infrequent (2.1.8→2.1.10 in one week of May 2025 after ~11 months quiet [measured, npm `time`]). v2.1.8 renamed exports to `*Icon` (old names kept as deprecated aliases) — a reminder that minor releases can churn the public names you re-export. Pin exact or narrow-caret and snapshot the subset in tests.
6. **Dev-server transpile cost**: apps consuming the barrel see slow cold starts in Vite/Next dev; the README recommends subpath imports or `optimizePackageImports: ["@phosphor-icons/react"]` ([README](https://github.com/phosphor-icons/react#imports)). A curated re-export (or inlined SVGs) removes this problem for library consumers entirely — a genuine argument _for_ the subset approach.

## Sources

- npm: https://www.npmjs.com/package/@phosphor-icons/react (registry metadata via `npm view`, 2026-08-17)
- GitHub README: https://github.com/phosphor-icons/react
- Releases: https://github.com/phosphor-icons/react/releases
- Repo stats: https://api.github.com/repos/phosphor-icons/react, https://api.github.com/repos/phosphor-icons/core
- Core package: https://github.com/phosphor-icons/core, https://www.npmjs.com/package/@phosphor-icons/core
- Homepage/org README: https://github.com/phosphor-icons/homepage
- RSC / use-client issue: https://github.com/phosphor-icons/react/issues/92; RSC discussion: https://github.com/phosphor-icons/react/discussions/46
- React 19: https://github.com/phosphor-icons/react/issues/108 (closed), https://github.com/phosphor-icons/react/issues/137 (forwardRef composition)
- Figma: https://www.figma.com/community/plugin/898620911119764089/phosphor-icons, https://www.figma.com/@phosphoricons, https://github.com/phosphor-icons/figma
- lucide: https://lucide.dev/guide/, https://lucide.dev/guide/packages/lucide-react; lucide-react@1.31.0 installed locally (defaults, counts measured)
- Local measurements: `@phosphor-icons/react@2.1.10`, `@phosphor-icons/core@2.1.1`, `lucide-react@1.31.0` installed in scratchpad; bundles built with esbuild (`--bundle --minify --format=esm --external:react`); coverage script `map.mjs` (232 lucide concepts + energy-domain names vs `core/assets/regular/`)
