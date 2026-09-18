# Repo, tooling & testing

Normative chapter for the `@elmeragroup/ui` monorepo: workspace layout, package manager and supply-chain settings, turbo task graph, lint/format stack, custom lint guardrails, scaffolding, and the full testing strategy including the merge gate.

Package build, exports map, and `publishConfig` are owned by [architecture](architecture.md); bundle/CSS budgets by [performance](performance.md); the publish pipeline itself by [release](release.md); the accessibility test floor by [accessibility](accessibility.md) §9.

## 1 Workspace layout

pnpm workspaces + turborepo, mirroring the internal reference repo (the stated copy-paste baseline):

```
packages/ui/                  # @elmeragroup/ui — the library (only published package)
apps/docs/                    # Next.js custom-MDX docs site; verified Next App Router first-paint fixture
apps/static-theme/            # private Vite/CSR first-paint fixture (not fixtures/vite, not a publish gate)
tooling/typescript/           # @elmeragroup/typescript-config — shared tsconfig bases
```

- The API extractor and the `elmera/*` and `anti-slop/*` lint rules are not workspace packages. They ship in `@elmeragroup/internal` ([ADR 0010](../adr/0010-internal-package-owns-extraction-and-lint.md)); the root and `apps/docs` install it.

- Everything under `tooling/*` and `apps/*` is `"private": true`; `packages/ui` is the sole publish target ([release](release.md)).
- `pnpm-workspace.yaml` globs: `packages/*`, `apps/*`, `tooling/*`.
- Tests and intl dictionaries for the **library** are **co-located inside `packages/ui`**. Component **demos live in the docs app** — `apps/docs/src/app/(docs)/components/<slug>/demos/` per [docs-site](docs-site.md) §6: they are docs/VR/AI source material, never published package code _(amended 2026-08-24 — ruling 74b, 2026-08-24: demos moved out of `packages/ui` into the docs app)_. Component tests do not live in consuming apps (explicit break from the internal ref, which kept all component tests app-side). The two specified **host first-paint proofs** live in `apps/docs/test` and `apps/static-theme/test` because they must inspect production HTML before React; that exception is not permission to move library tests into apps. Those apps' `test` tasks `dependsOn: ["build"]`. They are not the release packed-consumer fixtures in §7.5.

## 2 Package manager & supply chain

- **pnpm 11**, with the exact version pinned by `packageManager` in the root manifest.
- **pnpm catalog** (`pnpm-workspace.yaml` `catalog:`) is the single version-pinning point for every shared dependency (react, base-ui, tailwind, oxlint, vitest, …). Every catalog entry is an exact version — no range operators. Workspace `package.json`s reference `"catalog:"` — a dependency version literal in a package manifest is a review error. _(Amended 2026-09-02: `@internationalized/date` pinned to `3.12.3` — the previously resolved caret and the version `react-aria-components` already installs — so CalendarDate stays a single identity. Amended 2026-09-12: refreshed to `3.12.4`, still the version `react-aria-components` installs.)_
- **`@elmeragroup/internal`** _(amended 2026-09-07)_: the root and the `docs` workspace install the registry package through one catalog entry, pinned to an exact canary version. A canary is younger than the release-age guard below by definition, so the same exact version is named in `minimumReleaseAgeExclude`; a bump edits both lines, and `pnpm test:repo-policy` checks that they agree and that both manifests use `catalog:`. The package pins `typescript` at the catalog version and carries `effect` and `@oxlint/plugins` as its own runtime dependencies. `@oxlint/plugins` is not a catalog entry; `effect` is one again because the release scripts import it, pinned to the exact version the engine itself declares ([ADR 0011](../adr/0011-release-runs-on-the-internal-engine.md)); `pnpm test:repo-policy` checks the two agree. _(Amended 2026-09-13.)_
- **Release-age guard**: `minimumReleaseAge: 4320` (72 hours) in pnpm settings — no package version installs until it has been on the registry for three days. The refs' `overrides` block carries any forced resolutions; additions to it require a PR comment stating why. The packed React consumers that `package:check` installs with npm enforce the same window through an absolute `--before` cutoff computed once per run (`scripts/package-check-react.ts`); they need no exclusion list because neither `minimumReleaseAgeExclude` entry is a dependency of the published package. _(amended 2026-09-08)_
- **oxlint stays on the minor this repo's gate was validated against** _(amended 2026-09-12: `1.82.0`, via a full green `pnpm ci:checks` with every new React-rule hit adjudicated inline; amended 2026-09-13: `@elmeragroup/internal@0.2.0-canary.1` moved its bundled `@oxlint/plugins` to `1.82.0` — the revalidation the 2026-09-12 note anticipated — and a full `pnpm ci:checks` ran green on the bump; the one rule hit was the scroll-area recipe move to `scroll-area-variants.ts`; amended 2026-09-17: `1.83.0`, via a full green `pnpm ci:checks`; `@elmeragroup/internal@0.2.0-canary.3` still bundles `@oxlint/plugins` at `1.82.0`)_: an oxlint bump here is paired with a package release, not a local plugin edit (§5.3).
- **Node 24**, with the supported range in root `engines` and the development version in `.node-version`. Node 24 and pnpm 11 majors are normative; patch bumps within those majors are maintenance changes. `@elmeragroup/internal` is built and tested against Node major 24 in its own repository.
- **TypeScript configs** split in `tooling/typescript` per the internal ref: `base.json`, `react-library.json` (packages/ui), `internal-package.json` (tooling/*); apps extend base + framework preset. `strict` everywhere; no per-package compiler-option drift outside these files.

Exact tool versions are maintained in [the workspace catalog](../../pnpm-workspace.yaml), [package.json](../../package.json), and [.node-version](../../.node-version). Published runtime ranges are owned by [entries.ts](../../packages/ui/scripts/entries.ts). Review version changes there instead of updating a second baseline here.

## 3 Turbo task graph

[Root Turbo config](../../turbo.json) owns the task graph. [Docs overrides](../../apps/docs/turbo.json) and [static-theme overrides](../../apps/static-theme/turbo.json) own their workspace dependencies. Inspect the executable graph with `pnpm exec turbo run test --dry=json --filter=docs` when changing a task; a workspace override replaces the inherited task definition.

The ordering requirements are:

- Generate docs before docs builds, type checks, and root lint. Generated outputs must be declared so a cache hit restores the files readers need, including committed `api.json` files.
- Build library artifacts before tests that inspect them. Tests must fail if a required artifact is absent, not silently skip.
- Root lint needs the UI build because the Vite config imports the built theme bootstrap, and it needs docs generation for generated imports.
- Pack once after building. Package checks and bundle measurements consume that same tarball.
- Keep browser checks separate from the non-browser merge job so they do not delay early feedback on unit or docs failures.

`pnpm ci:checks` runs formatting and the complete local aggregate. For a focused iteration, use a workspace's test script after its required build, or a filtered Turbo task to include dependencies. The [README](../../README.md#scripts) lists commands. Format checking is a root script, not a per-package Turbo task.

## 4 Formatting & linting

- **oxfmt** formats everything. Required config: `sortTailwindcss.stylesheet` pointed at the library's source stylesheet (the file behind the `@elmeragroup/ui/css` entry, see [architecture](architecture.md) §5) so class sorting knows the custom tokens/utilities and `functions: ["tv", "cn"]` (so classes inside `tv` recipes and `cn` calls are sorted too). `oxfmt --check` gates merges; no prettier anywhere. Tracked `.vscode/settings.json` sets `tailwindCSS.classFunctions` to `["tv", "cn"]` so the Tailwind IntelliSense extension completes inside those same calls.
- **oxlint, type-aware** (`oxlint-tsgolint`), configured in root `.oxlintrc.json`. Built-in plugins are `typescript`, `oxc`, `import`, and `unicorn` (`unicorn` is also listed on the apps/ui override that replaces the plugin set). `unicorn/filename-case` is `error` with `kebabCase` for every linted file; BCP 47 locale modules (`en-US.ts`, `nb-NO.ts`, …) are ignored so they keep the locale-id filenames required by [accessibility](accessibility.md) §4. Other unicorn correctness rules stay `off` so enabling the plugin does not pull in the rest of the category pack. Four JS plugins:

  ```json
  "jsPlugins": [
    "eslint-plugin-turbo",
    "@shadcn/lint",
    { "name": "elmera", "specifier": "@elmeragroup/internal/oxlint" },
    { "name": "anti-slop", "specifier": "@elmeragroup/internal/oxlint/anti-slop" }
  ]
  ```

- `@shadcn/lint` is registered with no `shadcn/*` rules enabled (rules and `settings.shadcn` discovery are configured later, per the upstream `SETUP.md`). It carries `@typescript-eslint/parser` as a hard dependency that is unused under Oxlint because the plugin prefers `oxc-parser`, so its unmet `typescript <6.1` peer warning on `pnpm install` is accepted and deliberately not silenced. _(Added 2026-09-18.)_
- `ignorePatterns` in `.oxlintrc.json`: `**/dist/**`, `**/coverage/**`, `**/.turbo/**`, `**/.next/**`, `apps/docs/src/generated/**`, `plop-templates/**`, `**/.artifacts/**`, `**/.cache/**`, `**/node_modules/**`, `.ref/**`, `packages/ui/scripts/*.mjs`, and the agent-dot dirs (`.agent/**`, `.agents/**`, `.claude/**`, `.codex/**`, `.continue/**`, `.cursor/**`, `.gemini/**`, `.opencode/**`, `.pi/**`, `.roo/**`, `.windsurf/**`). _(Added 2026-09-04.)_
- Overrides, in order, scoped exactly as `.oxlintrc.json`:
  - `apps/**/*.{ts,tsx}` and `packages/ui/**/*.{ts,tsx}` — React globals plus the `react` plugin (`react-hooks/rules-of-hooks` and both exhaustive-deps rules at `error`); this override also **replaces** the plugin set with `typescript`, `oxc`, `react`, `unicorn`.
  - `packages/ui/src/**/*.{ts,tsx}` — every `elmera/*` library rule in §5, plus the `LocalizedStringDictionary` `no-restricted-imports` path.
  - `apps/docs/src/**/*.{ts,tsx}` — `elmera/no-primitive-colors` and `elmera/no-raw-class-map` at `error`.
  - `packages/ui/test/**/*.{ts,tsx}` — `elmera/restrict-browser-helper-copy` at `error` so a copy in the test harness tree fails except the owner file the rule allowlists.
  - `packages/ui/scripts/**` — `elmera/restrict-package-root-from-script` at `error`; `scripts/paths.ts` is the owner of `dirname(fileURLToPath(import.meta.url))`.
  - `packages/ui/src/intl/create-string-dictionary.ts` — per-file `allow` that turns `no-restricted-imports` off so the factory can construct `LocalizedStringDictionary` _(added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md))_.
  - `plopfile.mjs` — the five `typescript/no-unsafe-*` rules off.
- No override matches the lint rules' own sources: they arrive compiled inside `@elmeragroup/internal` and are linted upstream. The next-line-disable discipline the retired extractor package followed (one rule per directive, a reason after `--`, no file-wide headers) remains the expectation for any new tooling code in this repository.

## 5 Custom lint guardrails

### 5.1 Whitelabel guardrails (kumo pattern) — all v1, `error`

Ship as the `elmera` plugin (`@elmeragroup/internal/oxlint`), scoped to `packages/ui/src/**` unless a bullet says otherwise:

- **`elmera/no-primitive-colors`** — library source styles with role tokens only; raw palette classes (`bg-white`, `text-slate-500`, hex/oklch literals in class strings) are forbidden. Also enabled for `apps/docs/src/**/*.{ts,tsx}`, so docs source carries the same guard. Pairs with the token rules in [component authoring](../component-authoring.md) (input-like surfaces use `bg-card`, status names are `error/info/success/warning`).
- **`elmera/no-tailwind-dark-variant`** — `dark:` is forbidden in library source; dark palettes apply through tokens selected by `[data-theme="dark"]`.
- **`elmera/enforce-variant-standard`** — every component's variant recipe conforms to the tv structure (named recipe, `variants`/`defaultVariants` on recipes that have axes, `VariantProps` typing) from [component authoring](../component-authoring.md). Since `@elmeragroup/internal@0.2.0-canary.1` the `VariantProps` tie is proved from an exported type or a function parameter annotation through local aliases, interfaces, and intersections — not a file-wide text scan — so an inline recipe in a component entry must reach `VariantProps<typeof recipe>` there or move to its `<name>-variants.ts` module. _(Amended 2026-09-13.)_ Axis-less recipes omit those objects.
- **`elmera/no-local-focus-ring`** — forbids focus-state ring creation (`focus:*ring*`, `focus-visible:*ring*`, focus-within/has-focus equivalents, and RAC focus-visible branches) outside `packages/ui/src/styles/utils.ts`. It also forbids `outline-none` / `outline-hidden` and `focus-within:*border-*` (including `group-focus-within` / `peer-focus-within`) outside that adapter, so focus suppression and focus-driven border colours cannot hide. Invalid-state rings and static popup hairlines are not matched.
- **`elmera/restrict-focus-ring-call`** — `focusRing({…})` may be called only from `packages/ui/src/styles/utils.ts` (the five resolved constants) and `packages/ui/src/react-aria/link/link.tsx` (the live `isFocusVisible` render-prop call). Every other library module imports the constants. Test files are exempt so recipe-output assertions can call the recipe. _(Added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) amendment.)_
- **`elmera/no-field-part-jsx`** — the six labeled composites that render through `FieldFrame` (TextField, NumberField, TextareaField, PhoneNumberField, CheckboxGroup, RadioGroup) must not write `<Field.Label|Description|Error|Root|Set|Legend`. FieldFrame and Field itself remain the owners. _(Added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) amendment.)_
- **`elmera/restrict-browser-helper-copy`** — `roleNamed`, `headingNamed`, `cssVarColor`, `textNamed`, `textboxNamed`, `stampDensity`, and `px` may be declared only in `packages/ui/test/themed-browser-render.tsx`. Function and `const`/`let` copies in suites fail; destructuring a name is not a declaration. Scoped to `packages/ui/src/**` and `packages/ui/test/**`. `fkasPrivate` is not in the set: `packages/ui/test/theme-fixtures.ts` declares the shared theme inputs for both tiers, so the §8 walker keeps that one grep. _(Added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) amendment. ticket 52, 2026-09-04: helper copies are a lint allow-list; `textboxNamed`, `stampDensity`, `px` moved here from the walker.)_
- **`elmera/restrict-package-root-from-script`** — `dirname(fileURLToPath(import.meta.url))` is legal only in `packages/ui/scripts/paths.ts`. Other scripts call `packageRootFromScript(import.meta.url)`. Scoped to `packages/ui/scripts/**`. _(Added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) amendment. ticket 52, 2026-09-04: scripts locate the package root through paths.ts.)_

### 5.2 Existing elmera rules

Exactly these existing rules carry over from the internal plugin and run as `error` in library source:

- **`elmera/require-icon-button-label`**: any JSX element whose name ends in `Button` (including `InputGroup.Button`, `RadioIconButton`, `ConfirmButton`) rendered with a `size` prop that starts with `icon`, or with the icon-only variant, must have an `aria-label`, an accessible slot, or visible text. The type-level Button contract remains the first line; lint catches JSX shapes the type cannot prove.
- **`elmera/restrict-process-env`**: direct `process.env` access is forbidden except for the exact `process.env.NODE_ENV` comparison inside the theme validator module, required for its accepted dev-throw/prod-coerce contract. The rule allowlists that file/key pair only; aliases, computed access, other keys, and every other library module still fail. Apps validate their own environment variables and pass values/data into the library.

`elmera/no-primitive-colors` has a narrow reviewed allowlist: backdrop scrims may use the exact black-alpha class documented by Dialog/Sheet; Item image media may use its exact black-alpha optical hairline; and the single package-private `disabledHatch` string may contain its documented `rgb(0 0 0 / 0.02)` repeating-gradient texture. The allowlist compares whole class tokens (variant prefixes are part of the token): `bg-black/10` matches, `bg-black/100` and `hover:bg-black/10` do not. No path-wide, component-wide, or arbitrary-alpha exemption is allowed; private RAC surfaces use role tokens. _(ticket 06, 2026-09-04: `disabledHatch` is a `cn()` string in `styles/utils`; the allowlist still matches the whole token.)_

### 5.3 anti-slop (third plugin)

`dmmulroy/anti-slop` — 15 AST-only oxlint rules rejecting low-evidence TS patterns (type-assertion laundering, `unknown` escape hatches, module mocking, reflection). The rules live in `@elmeragroup/internal/oxlint/anti-slop`; the source repository records which upstream commit they track.

- **Never install the npm name-squat**: `oxlint-plugin-anti-slop@0.0.0` on npm is a third-party package with no relation to the upstream repo, which is `private: true` and unpublished by design. The only supported source is the `anti-slop` entry of `@elmeragroup/internal`. Upstream refresh happens in that repository, as a manual diff, opt-in.
- **Tests**: the RuleTester suites for both plugins run in the source repository and in its packed-consumer check. This repository exercises the rules only through `pnpm lint`.
- **Rule tiers**: `error` — `no-chained-type-assertions`, `no-widen-then-assert`, `no-known-value-widening`, `no-conditional-empty-object-spread` (object spreads and `JSXSpreadAttribute`), `no-reflect-apply`, `no-reflect-get`, `no-object-parameters`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-unknown-returns`, `no-unknown-parameters`. `warn` (promote after audit) — `require-safety-comment-for-type-assertion`, `no-runtime-typeof`, `no-shape-in-symbol-names`. _(Amended 2026-09-02: `no-conditional-empty-object-spread` also matches JSX spreads.)_
- **Local rules** (not upstream; keep across refreshes): `no-slop-comments` (`warn`) rejects banners, commented-out code, panic vocabulary, and TODO/FIXME/HACK/XXX without a tracker or RFC reference. A genuine tracker or RFC reference satisfies only that last check; it does not exempt a banner or a corpse. Its one option, `ticketPattern`, is the regex source for a bare ticket id (matched with word boundaries); the default `[A-Z][A-Z0-9]*-\d+` accepts any Jira-style key, and the repo config narrows it to `ELM-\d+` so `ADR-0002`, `SHA-256`, or `HTTP-2` do not pass as tickets. `no-narration-comments` (`warn`) rejects line comments that restate the next code line, skipping over further comment lines to find it. It is a separate rule because it is a fuzzy heuristic that a team may want to disable on its own; the severity is moot in CI, where `lint` runs with `--deny-warnings`.
- **`no-module-mocking` stays `error` repo-wide**: the testing strategy (§7) is browser-mode behavior tests against real components — `vi.mock` has no place in this library. No test-dir override.

### 5.4 `elmera/no-internal-dynamic-import`

Per [performance](performance.md) §5, the library never lazy-loads internally: this rule (in the `elmera` plugin) forbids dynamic `import()` anywhere in `packages/ui/src/**`. Apps own code splitting.

### 5.5 `elmera/no-hardcoded-density-metrics` — `warn`

Library `tv()` recipes that declare a `size` axis must not hardcode signed density-owned metrics (control height, inline padding, icon-edge padding, gap, or `md`/`lg` control type). The rule also warns on those families in `data-[size=…]` class strings (Select-style, including outside `tv`) and in `tv()` `base` recipes that have no `size` axis (single-height field boxes). It also walks string literals inside `cn(...)`, `tv({ slots })`, and object literals whose keys are the Button size names, applying the same token checks whenever the same file contains a `--control-h-` reference (or the record itself is a control-box height ladder). Optical arbitrary pixel tracks (`h-[18.4px]`) stay quiet.

It does **not** ban `p-*` / `h-*` / `gap-*` across the package. Type-scale axes (`Text`, `Heading`), overlay-width axes (`Dialog`, `Sheet`), and other non-control `size` keys stay quiet. Legal geometry also stays quiet: borders, translations, `hit-area-*` expansion, `h-lh`, radius clamps, descendant icon glyph `size-3`/`size-4`, size-owned `xs`/`sm` type, layout spacing, and `py-*` / `p-*`. Severity is warning only; do not promote to error without a fresh ruling. CI is deny-warnings, so a hit still blocks.

### 5.6 `elmera/no-rac-outside-quarantine` — `error`

The forbidden specifier list is `packages/ui/scripts/forbidden-rac-packages.js` (`FORBIDDEN_RAC_PACKAGES`), the single owner imported by this rule and by package-check:

- `react-aria-components`
- `react-aria`
- `@internationalized/date`
- `@react-aria`
- `@react-stately`

Each name also matches its subpaths (`name/...`). Those specifiers may be imported only from `packages/ui/src/react-aria/**`. Imports from `src/components/**` and every other library path fail. The rule is the quarantine; it lands before any RAC source exists.

### 5.7 `no-restricted-imports` for `LocalizedStringDictionary` — `error`

Library source may not value-import `LocalizedStringDictionary` from `@internationalized/string`. Type-only imports stay legal (`useLocalizedStrings` takes the dictionary as a parameter). The factory `packages/ui/src/intl/create-string-dictionary.ts` is the per-file allow. _(Added 2026-09-04 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) amendment.)_

### 5.8 `elmera/no-raw-class-map` — `error`

Class maps with an axis or two or more slots are `tv` recipes; a single axis-less class string is `cn("…")`. This rule errors on object-literal variable initializers (with or without `as const` / `satisfies`) whose string values look like Tailwind classes, and on bare string or template class constants. Any call-expression initializer is accepted. The utility prefix and exact-token tables in the rule are the heuristic for "looks like Tailwind". Severity is error. Scoped to `packages/ui/src/**` and `apps/docs/src/**` (not static-theme). Test files, `*.test-d.tsx`, intl dictionaries, and generated paths are exempt. _(Added 2026-09-04; promoted to error 2026-09-04. Amended 2026-09-04: `cn()` for axis-less strings, call-expression inits accepted explicitly.)_

### 5.9 `elmera/facade-reexport-grammar` — `error`

`src/<name>.ts(x)` and `src/react-aria/<name>.ts(x)` facades must be explicit named re-exports only: no `export *`, no local declarations, no directives. The generated root barrel may use `export *` and is excluded. Scoped to `packages/ui/src/**`. _(Added 2026-09-04.)_

## 6 Scaffolding

`pnpm gen component <name>` creates a new component's implementation and recipe, unit and browser tests, public facade, docs page, and demo. It registers the component in the canonical entry roster and adds an unmeasured budget row. Names must be safe kebab-case and must not collide with an existing component, reserved entry, or interim React Aria entry. Deferred components require an explicit decision to activate them.

The generated files intentionally fail until implemented. Choose the anatomy, API, keyboard behavior, and variants using [component authoring](../component-authoring.md). Then:

1. Replace every implementation and test placeholder.
2. Run `pnpm --filter @elmeragroup/ui generate:exports` and review the tracked package exports and root barrel.
3. Build the package, measure the new entry, and record its budget under the [performance policy](performance.md#2-bundle-budgets).
4. Finish the authored page and demos; register reviewed scenarios in `apps/docs/test/fixtures/component-demo-requirements.json`.
5. Generate the docs API artifacts (`pnpm --filter docs generate`), then run `pnpm ci:checks`.

[plopfile.mjs](../../plopfile.mjs) and [component templates](../../plop-templates/component/) own the scaffold. Hand-created components must provide the same artifacts and registration.

## 7 Testing strategy

Vitest only. **Two co-located projects** declared in `packages/ui/vitest.config.ts` — no `VITEST_ENV` switch — plus the root repo-policy project (§7.6) _(amended 2026-09-02)_:

### 7.1 `unit` project

- Environment: Node. Files: `*.test.ts` next to sources; DOM/component behavior belongs exclusively to the browser project.
- Tests: `themeSlug`/`parseThemeSlug`/`coerceTheme`/`validateTheme`, tv recipe class output, exports-map logic, token-pipeline logic.
- **Source contracts** _(amended 2026-09-02 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md); amended 2026-09-04 — one-owner spellings moved to lint `allow` lists)_: one table-driven `packages/ui/src/source-contracts.test.ts` walks the source tree once per run and asserts the remaining source-level invariants that are not a lint rule (`facade-reexport-grammar`, `no-rac-outside-quarantine`, `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`, `restrict-focus-ring-call`, `restrict-browser-helper-copy`, `no-field-part-jsx`, `no-tailwind-dark-variant`, `restrict-process-env`, `no-restricted-imports` for `LocalizedStringDictionary`) or an exports/package-check gate: file absence, RSC classification, and `ownedBy` exactly-one-owner counts for class strings. Each contract in that suite documents why it is not a lint rule. Per-component `*.test.ts` files keep recipe class-output and pure-function tests only; they do not `readFileSync` component source to pin spelling. Adding a contract to that suite requires stating why a lint rule or gate cannot own it (ADR 0008).
- **CSS snapshot test for `themes.css`**: the generated stylesheet (23 emitted rule bodies — 15 light, 8 dark, each dark body carrying its direct and descendant selector in one list — covering 20 themes in both light and dark) is snapshot-asserted so codegen drift is a reviewed diff, paired with the size ceiling in [performance](performance.md) §4. The per-theme **contrast matrix snapshot** ([accessibility](accessibility.md) §6) lives here too.
- **20-theme contract test**: asserts every one of the 20 brand×segment themes supplies its must-override tokens and the generated CSS matches the value matrix. Functional component tests run under exactly **`internal-fkas-private`** — the first legal matrix row and the named default test theme. Theming correctness is proven once, centrally, not per component.

### 7.2 `browser` project

- Environment: `@vitest/browser` + playwright, real Chromium. Files: `*.browser.test.tsx` next to sources; requires the built library CSS (`test:browser` depends on this package's `build` task).
- Tests: all component behavior. **Written fresh against documented component behavior** — the internal ref's `base-ui-*.test.tsx` files are reference reading only, never ported.
- **All queries role/label-based** (no test-ids, no class queries) and every documented keyboard behavior has an explicit keyboard test — the a11y floor of [accessibility](accessibility.md) §9. **No axe/scanner.** String-bearing components: one render test per shipped locale + one prop-override test.
- **One shared support module.** `packages/ui/test/themed-browser-render.tsx` owns the harness (`renderThemed`, `stampDensity`, `CONTROL_MD`, `CONTROL_SM`, `px`) and the queries every suite repeats: `roleNamed(role, name)`, `textboxNamed`, `headingNamed(name, level?)` and `cssVarColor(host, token)`. `cssVarColor` reads the token on an element **under** the `ThemeScope` — the `renderThemed` host div sits outside the theme attributes and silently reads the `:root` default — and a suite asserting a role token imports `dist/themes.css`, which `dist/styles.css` does not carry. Suites do not re-declare these locally. Coverage is walked over `src/components/**` and `src/react-aria/**` — the quarantine tier is held to the same standard — by the two gate suites in §8. _(Amended 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md) and the §8 helper-coverage gate below: shared browser helpers exported and the walkers extended to the react-aria tier.)_

### 7.3 Type tests

`*.test-d.tsx`, run as the dedicated `test:types` turbo task (§3), public-API contracts only: the `ThemeInput` union (illegal brand/segment permutations must fail typecheck), variant prop unions, `useRender` signatures, icon-only `aria-label` enforcement, exports-map resolution.

### 7.4 Per-component conventions

Test file naming, co-location, and query rules are stated once in [component authoring](../component-authoring.md#tests-and-demos); this chapter owns the project/runner/CI level and does not repeat them.

### 7.5 Packed-consumer fixtures

Two fixture apps under a root `fixtures/` directory will prove the package installs and builds as consumers actually consume it (neither exists yet):

- **`fixtures/next-app-router`** — Next App Router app consuming **Tailwind-source mode** and exercising the RSC boundaries: a server page rendering server-safe components plus a client island ([performance](performance.md) §3).
- **`fixtures/vite`** — Vite app consuming **standalone-CSS mode**.

Both install the **`pnpm pack` tarball** — never `workspace:` protocol — and must build. Both additionally assert that the flag SVG assets resolve. When they land, these fixtures will run in the **release workflow as a publish gate** ([release](release.md) §5), not in the per-PR merge gate.

They are **not** the first-paint proofs. `apps/docs` verifies the Next App Router host adapter; `apps/static-theme` verifies the Vite `transformIndexHtml` adapter. Neither is `fixtures/next-app-router` / `fixtures/vite`, and neither is a publish gate.

### 7.6 Repo-policy tests

The actual non-browser merge command is dry-run through Turbo in a durable repo-policy test. Its graph must include the root lint, repo-policy, and release-script type-check tasks and the library, docs and static-theme gates, exclude browser and packed-consumer tasks, and schedule nothing from the retired tooling packages. A second test pins `@elmeragroup/internal` to one exact catalog version, checks the matching release-age exclusion, and checks the lint plugin specifiers (§2).

Merge-workflow shape and workspace lint-script contracts live in the root `test/` vitest project (`pnpm test:repo-policy`), not inside the lint plugin. `ci:checks` runs them as `//#test:repo-policy`. _(amended 2026-09-02)_

## 8 CI gates

- **Merge workflow** (required on every PR, and on push to `main`) runs three ordered stages: (1) root `oxfmt --check`; (2) turbo `ci:checks`, which fans out to type-check, release-script type checks, oxlint (all three plugins), unit tests (including theme/CSS/contrast snapshots), browser tests, type tests, build, one `pnpm pack`, package-shape checks, `size-limit`, and the root repo-policy tests; (3) changeset presence. The changeset stage runs only on `pull_request`, fails a PR without a changeset file unless the head branch is the bot's `changeset-release/main` from this repository or GitHub applies the **`no-changeset`** label (matched as a whole label name, not a substring) — the bot cannot label its own version PR. The same job runs `pnpm release check-pr` on `changeset-release/main`, and on `main` an activated push then calls the publish and version workflows ([release](release.md) §2). The root `pnpm ci:checks` script covers stages 1–2 for local reproduction; the label-aware stage is necessarily a workflow check. _(amended 2026-09-02; amended 2026-09-13)_
- **Helper-coverage gate:** `src/themed-browser-render.test.ts` and `src/focus-ring-helper.test.ts` run in the `unit` project and walk `src/components/**`, `src/react-aria/**`, and `src/hooks/**` once per run; the locator scan also walks the shared browser fixtures in `packages/ui/test/**`, so a locator keeps its `DOM audit:` obligation when it is extracted out of a suite. They fail on a local re-declaration of `fkasPrivate`, on any use of the retired `theme-browser-fixtures`, on any test-side `--tw-ring-shadow` outside `test/assert-focus-ring.ts`, on `setTimeout(` waits in browser suites, and on unsanctioned locators: `document.querySelector`/`querySelectorAll` (including on `document.body`, `document.head`, and `document.documentElement`), a `data-slot` selector, `dataset.slot`, `querySelectorAll("*")`, or a local `function bySlot`, unless a `DOM audit:` comment explains the contract on the same line or in the sixteen lines above. Tag and attribute selectors on an already-located root do not need this comment. A new component directory is walked automatically. Local `roleNamed` / `headingNamed` / `cssVarColor` / `textNamed` / `textboxNamed` / `stampDensity` / `px` copies are `elmera/restrict-browser-helper-copy`, not this walker; `fkasPrivate` stays here because `theme-fixtures.ts` declares it once for both tiers under `packages/ui/test/**`. _(Added 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md). Amended 2026-09-04 — ticket 52, 2026-09-04: one walker over both suite roots, one regex, one comment window; helper copies are a lint allow-list. Amended 2026-09-09: the locator scan also covers `packages/ui/test/**`. Amended 2026-09-10: `document.body` / `document.head` / `document.documentElement` `querySelector` calls are the same locator as `document.querySelector`. Amended 2026-09-11: the walk also covers `src/hooks/**`; a hook suite may mount through `test/browser-render` directly, since a hook probe has no theme to scope.)_
- **Build-artifact tripwires:** a test reading a `dist/` artifact asserts that the artifact exists; it never guards itself with `it.skipIf(!existsSync(…))`. The artifact is task-graph-guaranteed, so its absence is the regression the test is for and a silent skip only hides it. The guarantee is per workspace, not one global edge: `packages/ui` inherits the root `test` task, which names `@elmeragroup/ui#build` directly (§3); `apps/docs` and `apps/static-theme` **shadow** `test` with their own `dependsOn: ["build"]`, and reach the same build transitively — `docs#test → docs#build → docs#generate → ^build → @elmeragroup/ui#build`, `static-theme#test → static-theme#build → ^build → @elmeragroup/ui#build` — through the `@elmeragroup/ui` workspace dependency each app declares. A workspace that shadows `test` therefore has to re-derive the edge (`turbo run test --dry=json --filter=<workspace>` prints it); the root task's dependency does not reach it, and a shadowing workspace that did not depend on the library would inherit no guarantee at all. _(Added 2026-09-03 — [ADR 0008](../adr/0008-tests-assert-behaviour-not-source-spelling.md); spec 07 user story 11.)_
- The `pack` task is the single producer: `package:check` and `size-limit` consume its exact tarball rather than measuring raw source facades or repacking independently. `.artifacts/` is ignored; its tarball may be turbo-cached for the run but is never committed.
- **Publish gate:** [release §5](release.md#5-publish-time-gates) is the single exhaustive table. The release workflow reuses the exact packed artifact described above and must not maintain a second gate list in this chapter.
- Visual regression is **roadmap, not v1**: the plain-`.tsx` demo pipeline keeps VR-target readiness designed in — the VR suite will glob the **docs-app** demo directories (`apps/docs/src/app/(docs)/components/*/demos/`, per [docs-site](docs-site.md) §6, the base-ui precedent); tool candidate Playwright + Argos joins the publish gate when the roadmap lands it.
