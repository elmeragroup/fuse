# Post-v1 roadmap

Directional chapter for `@elmeragroup/fuse`: work deliberately deferred out of v1, with the trigger that unlocks each item and what the v1 architecture already has in place for it — nothing here is normative until it graduates into a spec chapter of its own.

**Explicitly not on this roadmap**: migrations of the two OrderModule apps (OrderModuleInternalWeb / OrderModuleWeb) were ruled out of this effort entirely — the spec carries no compat assessment for them, and they do not return here.

## 1 react-aria → base-ui migration (date cluster + interim atoms)

- **What**: retire the `react-aria/` quarantine tier by re-homing its components on base-ui at bare paths. The tier holds eleven public interim exports: the date five (date-picker, date-range-picker, date-field, calendar, range-calendar) plus search-field, grid-list, link, focusable, file-trigger, ui-providers. Private cluster internals (RAC modal, dialog, button) retire with it.
- **Why deferred**: base-ui has no date/calendar primitives today; react-aria-components is the honored interim tier precisely to avoid hand-rolling date widgets for v1.
- **Trigger**: base-ui shipping date-field/calendar primitives of comparable quality (each non-date atom can migrate earlier, piecemeal — link/focusable/file-trigger have no hard react-aria dependency in their contract).
- **Already prepared**: the interim entries carry migration-to-base-ui markers; the tier is path-quarantined so no other entry can pull its dependencies ([performance](performance.md) §5); heading/text/span were already re-homed as plain typography, and Disclosure/list-box/alert were already de-RAC'd, so the date cluster is the last island.
- **Completion criteria**: all eleven components available at bare paths on base-ui; `react-aria/` subpaths removed (a major version); `react-aria-components`, the `react-aria` hooks package, `@internationalized/date`, and `tailwindcss-react-aria-components` uninstalled (`@internationalized/string`, the permanent intl-dictionary runtime, stays); the 60 kB date-cluster budget entry and the date-cluster lazy-loading recipe deleted.

## 2 Dark palette review items

- **What**: GE's external palette, the shared support-role mappings, and the complete chart ordering remain provisional. Product-level state, artwork and chart distinguishability review remains open.
- **Why deferred**: the dark layers shipped the values the available Figma sources support; these items need designer acceptance rather than more implementation.
- **Trigger**: design review resolving the provisional choices, or a product surface that exercises charts, states or artwork in a dark theme.
- **Already prepared**: the [external matrix](../notes/dark-theme/external-dark-theme-matrix.md) and [internal mapping](../notes/dark-theme/internal-dark-theme-matrix.md) record source evidence, implementation and the remaining review work.

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
- **Why deferred**: token values were locked at spec time (004: all mints final); the violet plus mandatory `ring-offset-2` is the accepted v1 mitigation, recorded as documented deviation 2 in [accessibility](accessibility.md) §6.
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

## 9 Additional playgrounds

- **What**: a standalone scratch app or an editable in-browser playground for component experiments and reproductions.
- **Why deferred**: the docs app already provides component demos, theme controls, and instant HMR against workspace source exports. A separate app or editor adds maintenance without a demonstrated v1 need. _(Amended 2026-09-05: defer the standalone app as well as the in-browser editor.)_
- **Trigger**: a concrete limitation in the docs development workflow, or external-contribution and bug-reproduction friction after public release.
- **Already prepared**: demos are plain runnable `.tsx` with no docs-specific format, so they load into any editor runtime unmodified; the standalone bundle CSS distribution gives an in-browser sandbox a single stylesheet to attach.

## 10 Density user preference (Wave 2)

- **What**: let an end user override the deployment density default (`internal → dense`, `external → comfortable`) with an explicit `dense` | `comfortable` preference; persist it; sync across tabs; stamp the resolved value before first paint without layout shift. Hosts keep calling `densityAttributes` on the document root. A later preference is `densityAttributes(preference ?? defaultDensityForVariant(theme.variant))`.
- **Why deferred**: Wave 1 is deployment-fixed. There is no runtime density state, no density bootstrap script, and no product surface asking to persist a user choice. Shipping a `ThemeProvider` density prop now would freeze the public interface before the preference model exists.
- **Trigger**: a consuming product committing to a user-visible density control (settings, first-run, or equivalent), with a defined persistence store.
- **Already prepared**: `Density` / `densityAttributes` / `defaultDensityForVariant` are public and server-safe ([theming](theming.md) §7.2). Variant does not select `--control-*` in generated theme CSS. Library metrics stay `:root[data-density]`-anchored. `ThemeProvider` and `ThemeScope` have no `density` prop.
- **Out of this item**: nested `data-density` in library CSS; a reserved `"system"` density value (there is no system density resolver); table row density (`h-10` / cell `p-2` / in-frame calc — [component authoring](../component-authoring.md)); OrderModule app migrations.
- **Cost when triggered**: a host-placed pre-paint density stamp (not a copied IIFE); persistence and storage-failure behaviour; cross-tab sync; scroll/form/overlay preservation on toggle; docs picker only if product wants an override preview. Revisit `ThemeProvider` only if diagnosis/runtime echo is actually required — do not add a prop solely to repeat a server-known primitive.

## 11 Chart (Wave 9)

- **What**: ship `@elmeragroup/fuse/chart` — recharts composition wrappers (`Chart.Container` / tooltip / legend / style). `recharts` becomes an optional peer; the entry is removed from `DEFERRED_ENTRIES` and joins the exports map, barrel, packed-name assertions, and size budgets.
- **Why deferred**: No consuming product has committed to a charted surface. Chart is not required for the first publish.
- **Trigger**: a consuming product committing to a charted surface, with `recharts` accepted as an optional peer.
- **Already prepared**: `--chart-1..8` tokens, and the exports-codegen deferred-entry seam (`DEFERRED_ENTRIES` in `packages/fuse/scripts/entries.ts`). No docs page or nav entry until the component exists.
- **Completion criteria**: `chart.ts` source; `recharts` in published optional-peer ranges; size-limit row excluding recharts; docs page and reviewed demos; `DEFERRED_ENTRIES` empty or without `chart`.

## 12 Effect 4 RC → stable

- **What**: move `effect` off the pinned prerelease `4.0.0-rc.115` onto the first stable `4.x`, and delete the `minimumReleaseAgeExclude` entry that the pin requires from `pnpm-workspace.yaml`.
- **Why deferred**: `@elmeragroup/internal` pins `effect` to the prerelease as a runtime dependency ([ADR 0010](../adr/0010-internal-package-owns-extraction-and-lint.md)), and this repository's release scripts import it directly ([ADR 0011](../adr/0011-release-runs-on-the-internal-engine.md)); no stable 4.x exists yet. The repo-wide `minimumReleaseAge: 4320` (72 hours) supply-chain guard cannot admit a prerelease, so the pin buys itself a named exclusion. The list's other entry is the exact version [tooling](tooling.md) §2 lists: the catalog-pinned canary. All are per exact version, which is what keeps the exceptions temporary rather than a policy hole. _(Amended 2026-09-18; amended 2026-09-19; amended 2026-09-21.)_
- **Trigger**: Effect 4.0.0 stable on the registry, aged past the 72-hour guard on its own.
- **Already prepared**: the version moves when `@elmeragroup/internal` releases against stable Effect and the docs drift check (`apps/docs/test/api-artifact.test.ts`) is the regression net for taking that release.
- **Completion criteria**: an `@elmeragroup/internal` release on stable `4.x` installed here; `minimumReleaseAgeExclude` removed entirely (not merely emptied of this entry) unless a new exception is separately justified; `pnpm ci:checks` green on Node 24.

## 13 Token-free publishing (OIDC + provenance)

- **What**: replace the `NPM_TOKEN` publish secret with npm **Trusted Publishing** (OIDC) and turn on provenance from a public repository.
- **Why deferred**: the release engine promotes the checked version with `npm dist-tag add`, which npm's OIDC trusted publishing cannot authenticate ([npm/cli#8547](https://github.com/npm/cli/issues/8547), open). Provenance also requires a public repository, and a trusted publisher can only be configured once the package exists.
- **Trigger**: the engine gains an OIDC-compatible promotion path and the repository is public.
- **Already prepared**: [release](release.md) §6 records the token as temporary; the pack adapter and the record protocol are auth-agnostic; the publish workflow's GitHub token is already `github.token`.
- **Completion criteria**: `publish-release.yml` requests `id-token: write` and sets provenance; the `NPM_TOKEN` secret is deleted; [release](release.md) §6–§7 updated.
