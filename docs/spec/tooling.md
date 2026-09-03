# Repo, tooling & testing

Normative chapter for the `@elmeragroup/ui` monorepo: workspace layout, package manager and supply-chain settings, turbo task graph, lint/format stack, custom lint guardrails, scaffolding, and the full testing strategy including the merge gate. Sources: Repo & tooling spec (wayfinder ticket 016), Testing strategy (wayfinder ticket 013), anti-slop research, [Component spec conventions](components/conventions.md).

Package build, exports map, and `publishConfig` are owned by [architecture](architecture.md); bundle/CSS budgets by [performance](performance.md); the publish pipeline itself by [release](release.md); the accessibility test floor by [accessibility](accessibility.md) §9.

## 1 Workspace layout

pnpm workspaces + turborepo, mirroring the internal reference repo (the stated copy-paste baseline):

```
packages/ui/                  # @elmeragroup/ui — the library (only published package)
apps/docs/                    # Next.js custom-MDX docs site; verified Next App Router first-paint fixture
apps/static-theme/            # private Vite/CSR first-paint fixture (not fixtures/vite, not a publish gate)
apps/playground/              # scratch consumer app (dev + manual QA)
tooling/typescript/           # @elmeragroup/typescript-config — shared tsconfig bases
tooling/oxlint-plugin/        # @elmeragroup/oxlint-plugin — elmera/* custom rules
tooling/oxlint-anti-slop/     # @elmeragroup/oxlint-plugin-anti-slop — vendored anti-slop (§5.3)
tooling/api-extractor/        # @elmeragroup/api-extractor — Effect-native TypeScript API extraction (docs dependency rows; ADR 0007)
```

- Everything under `tooling/*` and `apps/*` is `"private": true`; `packages/ui` is the sole publish target ([release](release.md)).
- `pnpm-workspace.yaml` globs: `packages/*`, `apps/*`, `tooling/*`.
- Tests and intl dictionaries for the **library** are **co-located inside `packages/ui`**. Component **demos live in the docs app** — `apps/docs/src/app/(docs)/components/<slug>/demos/` per [docs-site](docs-site.md) §6: they are docs/VR/AI source material, never published package code _(amended 2026-08-24 — ruling 74b, 2026-08-24: demos moved out of `packages/ui` into the docs app)_. Component tests do not live in consuming apps (explicit break from the internal ref, which kept all component tests app-side). The two specified **host first-paint proofs** live in `apps/docs/test` and `apps/static-theme/test` because they must inspect production HTML before React; that exception is not permission to move library tests into apps. Those apps' `test` tasks `dependsOn: ["build"]`. They are not the release packed-consumer fixtures in §7.5.

## 2 Package manager & supply chain

- **pnpm 11**, pinned as `"packageManager": "pnpm@11.20.0"` in the root manifest.
- **pnpm catalog** (`pnpm-workspace.yaml` `catalog:`) is the single version-pinning point for every shared dependency (react, base-ui, tailwind, oxlint, vitest, …). Every catalog entry is an exact version — no range operators. Workspace `package.json`s reference `"catalog:"` — a dependency version literal in a package manifest is a review error. _(Amended 2026-09-02: `@internationalized/date` pinned to `3.12.3` — the previously resolved caret and the version `react-aria-components` already installs — so CalendarDate stays a single identity.)_
- **Release-age guard**: `minimumReleaseAge: 4320` (72 hours) in pnpm settings — no package version installs until it has been on the registry for three days. The refs' `overrides` block carries any forced resolutions; additions to it require a PR comment stating why.
- **oxlint and `@oxlint/plugins` are pinned to the same minor, ≥ 1.78.0** — the floor the vendored anti-slop code is validated against (§5.3).
- **Node 24**, pinned as `"engines": { "node": ">=24.13.0 <25" }` and `.node-version` containing `24.13.0`. Node 24 and pnpm 11 majors are normative; patch bumps within those majors are maintenance changes. `@elmeragroup/api-extractor` timing and evidence gates on Node major 24 and records the exact patch as an observation, not an assertion. _(Amended 2026-09-02.)_
- **TypeScript configs** split in `tooling/typescript` per the internal ref: `base.json`, `react-library.json` (packages/ui), `internal-package.json` (tooling/*); apps extend base + framework preset. `strict` everywhere; no per-package compiler-option drift outside these files.

The initial scaffold uses this reviewed, registry-verified exact catalog baseline; reference-derived versions are retained where applicable, while missing tool pins are explicit project choices. Upgrading one is a deliberate maintenance change, not an install-time choice: React/React DOM `19.2.8`, corresponding types `19.2.17`/`19.2.3`, Tailwind `4.3.3`, TypeScript `7.0.2`, tsdown `0.22.14`, turbo `2.10.2`, Vite `8.2.1`, Vitest and `@vitest/browser-playwright` `4.1.10`, Playwright `1.62.1`, oxfmt `0.60.0`, oxlint and `@oxlint/plugins` `1.78.0`, and oxlint-tsgolint `7.0.2001`. Runtime package pins/ranges are the canonical table in [architecture](architecture.md) §6; duplicate literals do not appear in workspace package manifests.

## 3 Turbo task graph

`turbo.json` declares, with explicit `outputs` and env allowlists (no implicit env passthrough):

| Task               | Depends on | Outputs         | Notes                                                                                                                                                                          |
| ------------------ | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build`            | `^build`   | `dist/**`       | tsdown for packages/ui ([architecture](architecture.md)); Next build for apps                                                                                                  |
| `lint`             | —          | —               | oxlint; `inputs` include `tooling/oxlint-plugin/**` and `tooling/oxlint-anti-slop/**` so rule edits bust the cache                                                             |
| `type-check`       | `^build`   | —               | `tsc --noEmit` per package                                                                                                                                                     |
| `test`             | —          | —               | vitest `unit` project (§7.1)                                                                                                                                                   |
| `test:browser`     | `build`    | —               | vitest `browser` project; needs this package's built CSS                                                                                                                       |
| `test:types`       | `build`    | —               | type tests (§7.3), `*.test-d.tsx` — a dedicated task, not folded into `test`                                                                                                   |
| `test:shadow`      | `build`    | —               | docs API extractor shadow (`docs#test:shadow`); depends on the docs build; does not reuse the `ci:checks` leaf name _(amended 2026-09-02)_                                     |
| `test:repo-policy` | —          | —               | root vitest project (`test/**`); merge-workflow and workspace lint-script contracts (`//#test:repo-policy`) _(amended 2026-09-02)_                                             |
| `pack`             | `build`    | `.artifacts/**` | `pnpm pack --pack-destination .artifacts`; produces the one ignored tarball all package-shape checks consume                                                                   |
| `package:check`    | `pack`     | —               | `publint`, `attw --pack`, export-path resolution, emitted-directive parity, and packed-asset contract checks against that tarball                                              |
| `size-limit`       | `pack`     | —               | consumer-bundled entries plus built CSS and raw flag assets enforce every [performance](performance.md) §2 ceiling against that tarball                                        |
| `dev`              | `^build`   | —               | `persistent: true`, uncached                                                                                                                                                   |
| `ci:checks`        | aggregate  | —               | fans out to lint + type-check + test + test:browser + test:types + build + package:check + size-limit + `docs#test:shadow` + `//#test:repo-policy` (§8) _(amended 2026-09-02)_ |

Format checking (`oxfmt --check`) runs as a root script, not a per-package turbo task.

## 4 Formatting & linting

- **oxfmt** formats everything. Required config: `sortTailwindcss.stylesheet` pointed at the library's source stylesheet (the file behind the `@elmeragroup/ui/css` entry, see [architecture](architecture.md) §5) so class sorting knows the custom tokens/utilities and `functions: ["tv", "cn"]` (so classes inside `tv` recipes and `cn` calls are sorted too). `oxfmt --check` gates merges; no prettier anywhere.
- **oxlint, type-aware** (`oxlint-tsgolint`), configured in root `.oxlintrc.json`. Built-in plugins are `typescript`, `oxc`, `import`, and `unicorn` (`unicorn` is also listed on the apps/ui override that replaces the plugin set). `unicorn/filename-case` is `error` with `kebabCase` for every linted file; BCP 47 locale modules (`en-US.ts`, `nb-NO.ts`, …) are ignored so they keep the locale-id filenames required by [accessibility](accessibility.md) §4. Other unicorn correctness rules stay `off` so enabling the plugin does not pull in the rest of the category pack. Three JS plugins:

  ```json
  "jsPlugins": [
    "eslint-plugin-turbo",
    { "name": "elmera", "specifier": "@elmeragroup/oxlint-plugin" },
    { "name": "anti-slop", "specifier": "@elmeragroup/oxlint-plugin-anti-slop" }
  ]
  ```

- Overrides carve the two plugin source dirs (`tooling/oxlint-plugin/**`, `tooling/oxlint-anti-slop/**`) out of the type-unsafe rules, exactly as the internal ref does for its rule sources.
- No other override exists, and `tooling/api-extractor` deliberately takes none: the extractor's exceptions are all at their use sites — an `oxlint-disable-next-line` naming one rule and the reason it cannot hold on that line, or the `SAFETY:` comment a rule asks for instead of a disable. File-wide `oxlint-disable` headers are forbidden in that package; the root repo-policy project (§7.6) fails on a returning header, on a reasonless next-line disable, and on any `.oxlintrc.json` override matching that path. _(Added 2026-09-03 — [ADR 0007](../adr/0007-docs-api-extraction-pipeline.md), “Lint overrides”: the package's 60 file-wide header directives across 37 files are gone; it now carries 148 next-line disables and 39 `SAFETY:` comments and no override.)_

## 5 Custom lint guardrails

### 5.1 Whitelabel guardrails (kumo pattern) — all v1, `error`

Ship in `@elmeragroup/oxlint-plugin`, scoped to `packages/ui/src/**`:

- **`elmera/no-primitive-colors`** — library source styles with role tokens only; raw palette classes (`bg-white`, `text-slate-500`, hex/oklch literals in class strings) are forbidden. Pairs with the token rules in [conventions](components/conventions.md) (input-like surfaces use `bg-card`, status names are `error/info/success/warning`).
- **`elmera/no-tailwind-dark-variant`** — `dark:` is forbidden in library source; the dark axis is token-reserved behind `[data-theme="dark"]`.
- **`elmera/enforce-variant-standard`** — every component's variant recipe conforms to the tv structure (named recipe, `variants`/`defaultVariants` shape, `VariantProps` typing) from [conventions](components/conventions.md).
- **`elmera/no-local-focus-ring`** — forbids focus-state ring creation (`focus:*ring*`, `focus-visible:*ring*`, focus-within/has-focus equivalents, and RAC focus-visible branches) outside `packages/ui/src/styles/utils.ts`. It also forbids `outline-none` / `outline-hidden` and `focus-within:*border-*` (including `group-focus-within` / `peer-focus-within`) outside that adapter, so focus suppression and focus-driven border colours cannot hide. Invalid-state rings and static popup hairlines are not matched. _(Amended 2026-09-02.)_

### 5.2 Existing elmera rules

Exactly these existing rules carry over from the internal plugin and run as `error` in library source:

- **`elmera/require-icon-button-label`**: any JSX element whose name ends in `Button` (including `InputGroup.Button`, `RadioIconButton`, `ConfirmButton`) rendered with a `size` prop that starts with `icon`, or with the icon-only variant, must have an `aria-label`, an accessible slot, or visible text. The type-level Button contract remains the first line; lint catches JSX shapes the type cannot prove. _(Amended 2026-09-02.)_
- **`elmera/restrict-process-env`**: direct `process.env` access is forbidden except for the exact `process.env.NODE_ENV` comparison inside the theme validator module, required for its accepted dev-throw/prod-coerce contract. The rule allowlists that file/key pair only; aliases, computed access, other keys, and every other library module still fail. Apps validate their own environment variables and pass values/data into the library.

`elmera/no-primitive-colors` has a narrow reviewed allowlist: backdrop scrims may use the exact black-alpha class documented by Dialog/Sheet; Item image media may use its exact black-alpha optical hairline; and the single package-private `disabledHatch` recipe may contain its documented `rgb(0 0 0 / 0.02)` repeating-gradient texture. The allowlist compares whole class tokens (variant prefixes are part of the token): `bg-black/10` matches, `bg-black/100` and `hover:bg-black/10` do not. No path-wide, component-wide, or arbitrary-alpha exemption is allowed; private RAC surfaces use role tokens.

### 5.3 anti-slop (vendored third plugin)

`dmmulroy/anti-slop` — 15 AST-only oxlint rules rejecting low-evidence TS patterns (type-assertion laundering, `unknown` escape hatches, module mocking, reflection), vendored from commit `446268e5d15baa968eaec669ff65358d36ae6259`.

- **Vendored, never installed**: the upstream repo is `private: true` and unpublished by design; `oxlint-plugin-anti-slop@0.0.0` on npm is a **third-party name-squat — never install it**. The upstream is days-old, single-author, releaseless: immature as a dependency, acceptable as owned code. We copy `src/` into `tooling/oxlint-anti-slop` as `@elmeragroup/oxlint-plugin-anti-slop` (`private`, `"exports": { ".": "./index.ts" }`, one dependency: `@oxlint/plugins` at the pinned oxlint minor) and record the vendored upstream commit SHA in that package's README. Upstream refresh = manual diff, opt-in.
- **Tests**: the 12 vendored RuleTester modules plus 2 local ones (14 total) run under Node 24's test runner (`node --experimental-strip-types --test rules/*.test.ts`) and are part of the root Turbo `test` graph through the package `test` script. An upstream refresh must keep that script green, keep the local rules listed below, and update the documented test count if files are added or removed.
- **Rule tiers**: `error` — `no-chained-type-assertions`, `no-widen-then-assert`, `no-known-value-widening`, `no-conditional-empty-object-spread` (object spreads and `JSXSpreadAttribute`), `no-reflect-apply`, `no-reflect-get`, `no-object-parameters`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-unknown-returns`, `no-unknown-parameters`. `warn` (promote after audit) — `require-safety-comment-for-type-assertion`, `no-runtime-typeof`, `no-shape-in-symbol-names`. _(Amended 2026-09-02: `no-conditional-empty-object-spread` also matches JSX spreads.)_
- **Local rules** (not upstream; keep across refreshes): `no-slop-comments` (`warn`) rejects banners, commented-out code, panic vocabulary, and TODO/FIXME/HACK/XXX without a tracker or RFC reference. A genuine tracker or RFC reference satisfies only that last check; it does not exempt a banner or a corpse. Its one option, `ticketPattern`, is the regex source for a bare ticket id (matched with word boundaries); the default `[A-Z][A-Z0-9]*-\d+` accepts any Jira-style key, and the repo config narrows it to `ELM-\d+` so `ADR-0002`, `SHA-256`, or `HTTP-2` do not pass as tickets. `no-narration-comments` (`warn`) rejects line comments that restate the next code line, skipping over further comment lines to find it. It is a separate rule because it is a fuzzy heuristic that a team may want to disable on its own; the severity is moot in CI, where `lint` runs with `--deny-warnings`.
- **`no-module-mocking` stays `error` repo-wide**: the testing strategy (§7) is browser-mode behavior tests against real components — `vi.mock` has no place in this library. No test-dir override.

### 5.4 `elmera/no-internal-dynamic-import`

Per [performance](performance.md) §5, the library never lazy-loads internally: this rule (in `@elmeragroup/oxlint-plugin`) forbids dynamic `import()` anywhere in `packages/ui/src/**`. Apps own code splitting.

### 5.5 `elmera/no-hardcoded-density-metrics` — `warn`

Library `tv()` recipes that declare a `size` axis must not hardcode signed density-owned metrics (control height, inline padding, icon-edge padding, gap, or `md`/`lg` control type). The rule also warns on those families in `data-[size=…]` class strings (Select-style, including outside `tv`) and in `tv()` `base` recipes that have no `size` axis (single-height field boxes). It also walks string literals inside `cn(...)`, `tv({ slots })`, and object literals whose keys are the Button size names, applying the same token checks whenever the same file contains a `--control-h-` reference (or the record itself is a control-box height ladder). Optical arbitrary pixel tracks (`h-[18.4px]`) stay quiet. _(Amended 2026-09-02.)_

It does **not** ban `p-*` / `h-*` / `gap-*` across the package. Type-scale axes (`Text`, `Heading`), overlay-width axes (`Dialog`, `Sheet`), and other non-control `size` keys stay quiet. Legal geometry also stays quiet: borders, translations, `hit-area-*` expansion, `h-lh`, radius clamps, descendant icon glyph `size-3`/`size-4`, size-owned `xs`/`sm` type, layout spacing, and `py-*` / `p-*`. Severity is warning only; do not promote to error without a fresh ruling. CI is deny-warnings, so a hit still blocks.

### 5.6 `elmera/no-rac-outside-quarantine` — `error`

`react-aria-components`, `react-aria`, and `@internationalized/date` (and their subpaths) may be imported only from `packages/ui/src/react-aria/**`. Imports from `src/components/**` and every other library path fail. The rule is the quarantine; it lands before any RAC source exists.

## 6 Scaffolding (plop, v1)

`pnpm gen component <name>` (plop generator in the repo root) stubs, via templates + inject markers:

1. `packages/ui/src/components/<name>/<name>.tsx` — component skeleton with tv recipe stub conforming to `enforce-variant-standard`.
2. Co-located `<name>.test.ts` (unit) and `<name>.browser.test.tsx` (browser) stubs with role-based query scaffolding.
3. A plain-`.tsx` demo stub in the docs app (`apps/docs/src/app/(docs)/components/<name>/demos/`) per [docs-site](docs-site.md) §6 _(amended 2026-08-24 — ruling 74b, 2026-08-24: plop writes demos next to the hand-authored `page.mdx`, not under `packages/ui`)_.
4. A hand-authored `page.mdx` stub at `apps/docs/src/app/(docs)/components/<name>/page.mdx` importing the demo and rendering the generated API reference ([docs-site](docs-site.md) §1 authoring model).
5. A source entry file named according to the canonical manifest. After adding it, run `pnpm --filter @elmeragroup/ui generate:exports` and commit the generated `package.json#exports` and root barrel. The package build still rewrites the publish manifest under `dist`; the scaffold never edits `package.json#exports` directly.

The generator mechanically enforces the ten-section spec template's file conventions; hand-created components that skip it must reproduce every artifact above.

## 7 Testing strategy

Vitest only. **Two co-located projects** declared in `packages/ui/vitest.config.ts` — no `VITEST_ENV` switch — plus the root repo-policy project (§7.6) _(amended 2026-09-02)_:

### 7.1 `unit` project

- Environment: Node. Files: `*.test.ts` next to sources; DOM/component behavior belongs exclusively to the browser project.
- Tests: `themeSlug`/`parseThemeSlug`/`coerceTheme`/`validateTheme`, tv recipe class output, exports-map logic, token-pipeline logic.
- **Source contracts** _(amended 2026-09-02 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md))_: one table-driven `packages/ui/src/source-contracts.test.ts` asserts the remaining source-level invariants that are not a lint rule (`facade-reexport-grammar`, `no-rac-outside-quarantine`, `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`, `no-tailwind-dark-variant`, `restrict-process-env`) or an exports/package-check gate. Each contract in that suite documents why it is not a lint rule. Per-component `*.test.ts` files keep recipe class-output and pure-function tests only; they do not `readFileSync` component source to pin spelling. Adding a contract to that suite requires stating why a lint rule or gate cannot own it (ADR 0008).
- **CSS snapshot test for `themes.css`**: the generated stylesheet (15 CSS rule nodes / 20 permutations plus one terminal dark-placeholder comment) is snapshot-asserted so codegen drift is a reviewed diff, paired with the size ceiling in [performance](performance.md) §4. The per-theme **contrast matrix snapshot** ([accessibility](accessibility.md) §6) lives here too.
- **20-theme contract test**: asserts every one of the 20 brand×segment themes supplies its must-override tokens and the generated CSS matches the value matrix. Functional component tests run under exactly **`internal-fkas-private`** — the first legal matrix row and the named default test theme. Theming correctness is proven once, centrally, not per component.

### 7.2 `browser` project

- Environment: `@vitest/browser` + playwright, real Chromium. Files: `*.browser.test.tsx` next to sources; requires the built library CSS (`test:browser` depends on this package's `build` task).
- Tests: all component behavior. **Written fresh against each spec's §9 test requirements** — the internal ref's `base-ui-*.test.tsx` files are reference reading only, never ported.
- **All queries role/label-based** (no test-ids, no class queries) and every spec §7 keyboard behavior has an explicit keyboard test — the a11y floor of [accessibility](accessibility.md) §9. **No axe/scanner.** String-bearing components: one render test per shipped locale + one prop-override test.
- **One shared support module.** `packages/ui/test/themed-browser-render.tsx` owns the harness (`renderThemed`, `stampDensity`, `CONTROL_MD`, `CONTROL_SM`, `px`) and the queries every suite repeats: `roleNamed(role, name)`, `textboxNamed`, `headingNamed(name, level?)` and `cssVarColor(host, token)`. `cssVarColor` reads the token on an element **under** the `ThemeScope` — the `renderThemed` host div sits outside the theme attributes and silently reads the `:root` default — and a suite asserting a role token imports `dist/themes.css`, which `dist/styles.css` does not carry. Suites do not re-declare these locally. Coverage is walked over `src/components/**` and `src/react-aria/**` — the quarantine tier is held to the same standard — by the two gate suites in §8. _(Amended 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) and the §8 helper-coverage gate below: shared browser helpers exported and the walkers extended to the react-aria tier.)_

### 7.3 Type tests

`*.test-d.tsx`, run as the dedicated `test:types` turbo task (§3), public-API contracts only: the `ThemeInput` union (illegal brand/segment permutations must fail typecheck), variant prop unions, `useRender` signatures, icon-only `aria-label` enforcement, exports-map resolution.

### 7.4 Per-component conventions

Test file naming, co-location, and query rules are stated once in [conventions](components/conventions.md) §Tests & demos; this chapter owns the project/runner/CI level and does not repeat them.

### 7.5 Packed-consumer fixtures

Two fixture apps under a root `fixtures/` directory prove the package installs and builds as consumers actually consume it:

- **`fixtures/next-app-router`** — Next App Router app consuming **Tailwind-source mode** and exercising the RSC boundaries: a server page rendering server-safe components plus a client island ([performance](performance.md) §3).
- **`fixtures/vite`** — Vite app consuming **standalone-CSS mode**.

Both install the **`pnpm pack` tarball** — never `workspace:` protocol — and must build. Both additionally assert that the flag SVG assets resolve. These fixtures run in the **release workflow as a publish gate** ([release](release.md) §5), not in the per-PR merge gate.

They are **not** the first-paint proofs. `apps/docs` verifies the Next App Router host adapter; `apps/static-theme` verifies the Vite `transformIndexHtml` adapter. Neither is `fixtures/next-app-router` / `fixtures/vite`, and neither is a publish gate.

### 7.6 Repo-policy tests

Merge-workflow shape and workspace lint-script contracts live in the root `test/` vitest project (`pnpm test:repo-policy`), not inside `@elmeragroup/oxlint-plugin`. `ci:checks` runs them as `//#test:repo-policy`. _(amended 2026-09-02)_

## 8 CI gates

- **Merge workflow** (required on every PR, and on push to `main`) runs three ordered stages: (1) root `oxfmt --check`; (2) turbo `ci:checks`, which fans out to type-check, oxlint (all three plugins), unit tests (including theme/CSS/contrast snapshots), browser tests, type tests, build, one `pnpm pack`, package-shape checks, `size-limit`, `docs#test:shadow`, and the root repo-policy tests; (3) changeset presence. The changeset stage runs only on `pull_request`, fails a PR without a changeset file unless GitHub applies the **`no-changeset`** label (matched as a whole label name, not a substring), and skips Version-Packages PRs whose head branch is `changeset-release/*` so the release PR is not blocked for consuming its own changesets. The root `pnpm ci:checks` script covers stages 1–2 for local reproduction; the label-aware stage is necessarily a workflow check. _(amended 2026-09-02)_
- **Helper-coverage gate:** `src/themed-browser-render.test.ts` and `src/focus-ring-helper.test.ts` run in the `unit` project and walk `src/components/**` and `src/react-aria/**`. They fail on a local re-declaration of a harness helper (`fkasPrivate`, `stampDensity`, `px`, `textboxNamed`), on any use of the retired `theme-browser-fixtures`, and on any test-side `--tw-ring-shadow` outside `test/assert-focus-ring.ts`. Local copies of `roleNamed`/`headingNamed`/`cssVarColor` are held to a recorded no-growth list rather than failing outright while the per-suite adoption lands; the list is a subset check, so deleting a copy needs no edit to the gate. _(Added 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_
- **Build-artifact tripwires:** a test reading a `dist/` artifact asserts that the artifact exists; it never guards itself with `it.skipIf(!existsSync(…))`. The artifact is task-graph-guaranteed, so its absence is the regression the test is for and a silent skip only hides it. The guarantee is per workspace, not one global edge: `packages/ui` inherits the root `test` task, which names `@elmeragroup/ui#build` directly (§3); `apps/docs` and `apps/static-theme` **shadow** `test` with their own `dependsOn: ["build"]`, and reach the same build transitively — `docs#test → docs#build → docs#generate → ^build → @elmeragroup/ui#build`, `static-theme#test → static-theme#build → ^build → @elmeragroup/ui#build` — through the `@elmeragroup/ui` workspace dependency each app declares. A workspace that shadows `test` therefore has to re-derive the edge (`turbo run test --dry=json --filter=<workspace>` prints it); the root task's dependency does not reach it, and a shadowing workspace that did not depend on the library would inherit no guarantee at all. _(Added 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md); spec 07 user story 11.)_
- The `pack` task is the single producer: `package:check` and `size-limit` consume its exact tarball rather than measuring raw source facades or repacking independently. `.artifacts/` is ignored; its tarball may be turbo-cached for the run but is never committed.
- **Publish gate:** [release §5](release.md#5-publish-time-gates) is the single exhaustive table. The release workflow reuses the exact packed artifact described above and must not maintain a second gate list in this chapter.
- Visual regression is **roadmap, not v1**: the plain-`.tsx` demo pipeline keeps VR-target readiness designed in — the VR suite will glob the **docs-app** demo directories (`apps/docs/src/app/(docs)/components/*/demos/`, per [docs-site](docs-site.md) §6, the base-ui precedent); tool candidate Playwright + Argos joins the publish gate when the roadmap lands it.
