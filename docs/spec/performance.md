# Performance guidelines

Normative chapter for `@elmeragroup/ui`. Sources: [A11y & performance guideline chapters](../../wayfinder/tickets/026-a11y-performance-guidelines.md), [Package architecture](../../wayfinder/tickets/008-package-architecture.md), [Icon system](../../wayfinder/tickets/009-icon-system.md), [Token pipeline](../../wayfinder/tickets/018-token-pipeline.md).

## 1 Principles

- Budgets are **regression ratchets, not aspirations**: every published entry has a CI-enforced ceiling; ceilings only move **down** (or are consciously raised in a reviewed PR that says why).
- The library never trades app control for its own convenience: no internal lazy boundaries, no self-scheduled work, no global listeners outside what base-ui installs.
- Weight is opt-in by architecture: per-icon exports, subpath entries, optional peers — importing `Button` must never pay for `Chart`.

## 2 Bundle budgets

- **Mechanism**: `size-limit` in CI over the **published artifacts** (post-`publishConfig.directory`, post-tsdown), one entry per exported subpath plus the root barrel. Runs in the merge gate; breach fails the build.
- **Calibration**: numbers below are provisional; at first real build each is set to **measured × ~1.5** and committed. From then on, the ratchet rule applies.
- Provisional ceilings (min+gzip, ESM, excluding react/react-dom/peers):

  | Entry | Ceiling | Note |
  | --- | --- | --- |
  | Baseline component entry (button, badge, input, …) | 10 kB | includes shared runtime pulled by that entry |
  | Heavy composites: select, combobox, table, sidebar, toast | 20 kB | base-ui positioning/list machinery |
  | `chart` | 15 kB | **excluding** recharts (optional peer — never bundled) |
  | Date cluster (`react-aria/` date entries, incl. `@internationalized/date`) | 60 kB | quarantined tier; uninstalls with the cluster |
  | Root barrel (components+theme scope) | 150 kB | exists for DX; apps are steered to subpaths |
  | `icons` per-icon export | 2 kB | Phosphor single icon |
  | `themes.css` (standalone bundle) | 10 kB gzip | see §4 |

- The docs site publishes the measured sizes per entry (generated, same source as the API tables).

## 3 RSC / client boundaries

- **Default server-safe.** A component carries `"use client"` (at source; tsdown preserves it) only when it owns interactivity — state, effects, event handlers, browser APIs.
  - **Server-renderable tier**: badge, card, frame, description-list, item (static parts), skeleton, separator, table primitives, typography (heading/text/span), code, empty, alert (static), avatar (static), icons, illustrations, logos.
  - **Client tier**: all fields and selection controls, overlays, menus, toast, tabs, sidebar, accordion, collapsible, scroll-area, pagination (interactive), chart, date cluster, `ElmeraGroupUiProvider`.
- **RSC status is part of the public contract**: a column in every spec's §3 props table header block and in the generated docs API tables.
- **Composition rule**: a server-safe component may render a client child; a change that flips a server-safe component to client is a **breaking change to its spec** — it must be flagged in §8 Divergence/changelog, never happen silently.
- No `-client` wrapper entries, no double exports — one module, one directive decision.

## 4 CSS

- `themes.css` (13 rules / 16 permutations, ADR [0002](../adr/0002-theme-attributes.md) layer structure) is codegen output, uncommitted, reviewed via **CSS snapshot test** and capped by the §2 ceiling — the snapshot catches semantic drift, the ceiling catches generator bloat.
- Dual distribution per [Package architecture](../../wayfinder/tickets/008-package-architecture.md): Tailwind-source consumers pay only for what they use via the normal content scan; the standalone bundle is the one that needs the budget.
- `sideEffects` lists only CSS; every JS module (intl modules included) is side-effect-free so tree-shaking holds.

## 5 Code splitting & lazy loading

- **The library never lazy-loads internally** — no dynamic `import()` anywhere in library source (lintable). Internal async boundaries would create loading states apps can't control or style.
- Apps own splitting; the docs ship two first-class recipes: `next/dynamic` and `React.lazy` wrappers for **Chart** and the **date cluster** (the two entries whose weight justifies a boundary).
- `recharts` stays an **optional peer**: chart's cost is opt-in at install time, and `chart` re-exports wrappers only (no `export * from "recharts"`).
- The `react-aria/` quarantine keeps the date cluster's dependencies (`react-aria-components`, `@internationalized/date`) reachable only via `react-aria/` subpaths, so no other entry can accidentally pull them.

## 6 Runtime practices

- Animations touch **`transform` and `opacity` only** (compositor-friendly; pairs with the motion band in [accessibility](accessibility.md) §7). No animated `width`/`height`/`padding`; size transitions use transforms or base-ui's measured patterns.
- Context values are **memoized** (`ElmeraGroupUiProvider` already does); no context provider re-renders its subtree on unrelated prop churn.
- No per-frame CSS-variable writes on shared ancestors (inherited-var recalc storms); transient interaction state writes `style.transform` on the element itself.
- Tooltips/popovers reuse base-ui's shared positioning; components never install their own scroll/resize listeners.

## 7 i18n cost

- Four locales (`nb-NO`, `sv-SE`, `en-US`, `fi-FI`) ship **eagerly** inside each string-bearing component's entry — a few hundred bytes per component at this scale, already inside the §2 ceilings. The runtime (`@internationalized/string`) is ~1 kB once.
- **Revisit threshold**: if shipped locales approach ~10, move to per-locale modules + resolver-level subsetting (the react-aria `optimize-locales` model — requires per-locale files to survive bundling as separate modules). Roadmap item, not v1 machinery.
