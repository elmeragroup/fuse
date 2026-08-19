# Post-v1 roadmap

Directional chapter for `@elmeragroup/ui`: work deliberately deferred out of v1, with the trigger that unlocks each item and what the v1 architecture already has in place for it — nothing here is normative until it graduates into a spec chapter of its own. Sources: [Wayfinder map](../../wayfinder/MAP.md) (Not yet specified / Out of scope), [Spec: date & react-aria interim](../../wayfinder/tickets/024-spec-date-interim.md), [Testing strategy](../../wayfinder/tickets/013-testing-strategy.md), [Docs site & playground](../../wayfinder/tickets/012-docs-and-playground.md), [ADR 0004 Phosphor icons](../adr/0004-phosphor-icons.md), [ADR 0006 intl strings](../adr/0006-intl-strings.md), [Accessibility](accessibility.md) §6, [Performance](performance.md) §7, [Canonical token contract](../../wayfinder/tickets/001-canonical-token-contract.md), [Brand–segment matrix gaps](../../wayfinder/tickets/004-brand-segment-matrix-gaps.md).

**Explicitly not on this roadmap**: migrations of the two OrderModule apps (OrderModuleInternalWeb / OrderModuleWeb) were ruled out of this effort entirely — the spec carries no compat assessment for them, and they do not return here.

## 1 react-aria → base-ui migration (date cluster + interim atoms)

- **What**: retire the `react-aria/` quarantine tier by re-homing its components on base-ui at bare paths. The tier holds eleven public interim exports: the date five (date-picker, date-range-picker, date-field, calendar, range-calendar) plus search-field, grid-list, link, focusable, file-trigger, ui-providers. Private cluster internals (RAC modal, dialog, button) retire with it.
- **Why deferred**: base-ui has no date/calendar primitives today; react-aria-components is the honored interim tier precisely to avoid hand-rolling date widgets for v1.
- **Trigger**: base-ui shipping date-field/calendar primitives of comparable quality (each non-date atom can migrate earlier, piecemeal — link/focusable/file-trigger have no hard react-aria dependency in their contract).
- **Already prepared**: every interim spec carries a migration-to-base-ui marker; the tier is path-quarantined so no other entry can pull its dependencies ([performance](performance.md) §5); heading/text/span were already re-homed as plain typography, and Disclosure/list-box/alert were already de-RAC'd, so the date cluster is the last island.
- **Completion criteria**: all eleven components available at bare paths on base-ui; `react-aria/` subpaths removed (a major version); `react-aria-components`, the `react-aria` hooks package, `@internationalized/date`, and `tailwindcss-react-aria-components` uninstalled (`@internationalized/string`, the permanent intl-dictionary runtime, stays); the 60 kB date-cluster budget entry and the date-cluster lazy-loading recipe deleted.

## 2 Dark mode rollout

- **What**: mint and ship dark token values across the theme matrix, activated by the `data-theme="dark"` axis.
- **Why deferred**: no product surface requires dark today; minting 20 permutations of dark values without design demand would be speculative. The out-of-scope ruling covers **values only** — the axis itself is v1 architecture.
- **Trigger**: a consuming product committing to a dark surface; design supplying (or commissioning) dark palettes.
- **Already prepared**: `data-theme` is reserved for dark in the attribute cascade (ADR [0002](../adr/0002-theme-attributes.md) — variant/brand/segment use their own attributes, leaving `data-theme` free); the token pipeline ends `themes.css` with a **commented dark-axis placeholder** (not an empty CSS rule); host-placed `ColorSchemeScript` / `colorSchemeScriptSource` plus provider-owned `useColorScheme` / `ForceColorScheme` already set the reserved marker before and after paint ([theming](theming.md) §7.8); `style.colorScheme` stays off until those values exist; the `no-tailwind-dark-variant` lint rule keeps components token-driven so dark lands by values alone. The external ref's `.guen-dark` block is recorded as reference input ([token extraction](../../wayfinder/research/003-token-values.md) §1.2) — recorded, not specced, and of limited quality (double-gated, never applied by any code, hex not oklch, status-containers only).
- **Cost when triggered**: dark values per theme layer in the codegen modules, an extended contrast-matrix snapshot ([accessibility](accessibility.md) §6 applies unchanged), docs picker gains the axis.

## 3 Visual-regression testing

- **What**: screenshot-based VR over the component demos, joining the publish gate. Leading tool candidate at deferral time: **Playwright + Argos**.
- **Why deferred**: user call in the testing strategy — v1's assurance is behavioral (role-based + keyboard + 20-theme contract test); VR tooling choice and baseline management were fogged rather than specced.
- **Trigger**: first visual regression that the behavioral suite misses, or the docs demo corpus reaching the size where manual review of theme renders stops scaling.
- **Already prepared**: the demo pipeline is designed VR-ready — plain runnable `.tsx` demos are multi-output (docs source + live render + AI registry + **VR targets**), so the target corpus exists the day a tool is chosen; the 20-permutation matrix page enumerates exactly the theme surface VR should sweep.
- **Completion criteria**: VR added to the **publish** gate (per the CI-gates decision), not the merge gate.

## 4 Additional brands (Steddi, NGE/ngef, Trumf)

- **What**: theme the brands beyond the six visual identities (fkas, fkab, tkas, guen, fkse, elma). Corporate Elmera is in v1 as `elma`; Steddi, NGE/ngef, and Trumf remain out of this theme set.
- **Why deferred**: no product surface renders them as themes today; the effort's ruling was that the architecture must make adding brands **cheap**, not that their themes be specced.
- **Trigger**: a whitelabel or internal surface onboarding one of these brands.
- **Already prepared / cost per brand in the current architecture**: adding a brand is a closed, mechanical list — (1) extend the `BRANDS` record and widen the brand type union (illegal-permutation typing extends with it); (2) mint the exact **must-override** subset from [theming](theming.md) §2.5 (external: background/foreground plus complete card, muted, primary, secondary, and feature families; border/input; radius pair; brand pair; internal: brand pair only). Source-level typography remains optional; aliases such as the sidebar-brand pair are not separate coverage obligations; (3) add one TS theme-layer module to the token pipeline, whose generator materializes the full external reset set for nested-scope isolation and uses fallback-by-absence only for missing segment variants; (4) pass or explicitly extend the contrast-matrix and nested-scope snapshots; (5) add the brand logo component — Steddi and Trumf logo components are specified in `/icons` per ADR [0004](../adr/0004-phosphor-icons.md); NGE/ngef would be added. `elma` already uses the `BrandLogo` text/`displayName` fallback. No component code changes.

## 5 Per-brand focus-ring re-mint

- **What**: replace the single brand-independent violet `--ring` default with per-brand ring values where the violet lacks contrast.
- **Why deferred**: token values were locked at spec time ([004](../../wayfinder/tickets/004-brand-segment-matrix-gaps.md): all mints final); the violet plus mandatory `ring-offset-2` is the accepted v1 mitigation, recorded as documented deviation 2 in [accessibility](accessibility.md) §6.
- **Trigger**: design supplying per-brand ring colors, or an accessibility audit escalating the deviation — the violet falls below 3:1 non-text contrast against some strong external `--feature`/`--primary` fills.
- **Already prepared**: `--ring` is already a **themable** role token with a library default — a re-mint is pure token values per theme layer, zero component changes; the `focusRing` recipe stays untouched.

## 6 Icon codegen from `@phosphor-icons/core`

- **What**: switch the icon entry from re-exports over `@phosphor-icons/react` to codegen'd per-icon components from `@phosphor-icons/core`.
- **Why deferred**: rejected for v1 to avoid owning a codegen pipeline (ADR [0004](../adr/0004-phosphor-icons.md)); the cost accepted consciously is that each used icon carries all six Phosphor weights (~0.8 kB gzip vs ~0.5 kB codegen'd).
- **Trigger**: icon bundle weight becoming a measured problem (the 2 kB per-icon `size-limit` ceiling is the early-warning signal).
- **Already prepared**: the public API — curated per-icon named exports, `weight` narrowed to `regular | fill` — is **unchanged** by the switch; consumers never notice. Bonus on switch: codegen output is RSC-native.

## 7 Locale expansion (nn-NO next) and the subsetting threshold

- **What**: add locales beyond the shipped four (`nb-NO`, `sv-SE`, `en-US`, `fi-FI`); nn-NO is the identified next candidate.
- **Why deferred**: no current market demand beyond the four; Finnish was included because that market is imminent.
- **Trigger**: product demand per locale. Mechanics per ADR [0006](../adr/0006-intl-strings.md): one plain TS module per string-bearing component's `intl/` directory plus widening the `SupportedLocale` union — a mechanical, type-guided change, covered by the existing one-test-per-locale pattern.
- **Threshold item**: all locales ship eagerly, which is the right trade at ≤ ~10 locales. If the set approaches ~10, move to per-locale modules kept separate through the build plus resolver-level subsetting (the react-aria `optimize-locales` model) — [performance](performance.md) §7. The public API is unchanged by that switch.

## 8 shadcn-style registry

- **What**: publish a copy-paste source registry (the coss pattern) as a second distribution channel alongside the npm package.
- **Why deferred**: v1 is deliberately a packaged dependency, not copy-paste source; a registry doubles the maintenance surface with no demonstrated demand.
- **Trigger**: demand appearing from consuming teams (noted verbatim in the docs decision: "if demand appears").
- **Already prepared**: demos are plain `.tsx` files AST-extracted at docs build, and the `llms.txt` + per-component markdown endpoints are generated from the same sources — a registry would be one more generated output of an existing pipeline, not a new authoring format.

## 9 In-browser playground editor

- **What**: an editable in-browser playground (live code editing in docs, base-ui/CodeSandbox style).
- **Why deferred**: v1's playground is a standalone workspace app consuming source exports with instant HMR — full-fidelity for the team that owns the library; an in-browser editor mainly serves external contributors and issue reproductions.
- **Trigger**: external-contribution or bug-repro friction once the package is public on npmjs.com.
- **Already prepared**: demos are plain runnable `.tsx` with no docs-specific format, so they load into any editor runtime unmodified; the standalone bundle CSS distribution gives an in-browser sandbox a single stylesheet to attach.
