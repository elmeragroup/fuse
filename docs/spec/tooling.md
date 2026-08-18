# Repo, tooling & testing

Normative chapter for the `@elmeragroup/ui` monorepo: workspace layout, package manager and supply-chain settings, turbo task graph, lint/format stack, custom lint guardrails, scaffolding, and the full testing strategy including the merge gate. Sources: [Repo & tooling spec](../../wayfinder/tickets/016-repo-tooling-spec.md), [Testing strategy](../../wayfinder/tickets/013-testing-strategy.md), [anti-slop research](../../wayfinder/research/015-anti-slop.md), [Component spec conventions](components/conventions.md).

Package build, exports map, and `publishConfig` are owned by [architecture](architecture.md); bundle/CSS budgets by [performance](performance.md); the publish pipeline itself by [release](release.md); the accessibility test floor by [accessibility](accessibility.md) §8.

## 1 Workspace layout

pnpm workspaces + turborepo, mirroring the internal reference repo (the stated copy-paste baseline):

```
packages/ui/                  # @elmeragroup/ui — the library (only published package)
apps/docs/                    # Next.js custom-MDX docs site
apps/playground/              # scratch consumer app (dev + manual QA)
tooling/typescript/           # @elmeragroup/typescript-config — shared tsconfig bases
tooling/oxlint-plugin/        # @elmeragroup/oxlint-plugin — elmera/* custom rules
tooling/oxlint-anti-slop/     # @elmeragroup/oxlint-plugin-anti-slop — vendored anti-slop (§5.3)
```

- Everything under `tooling/*` and `apps/*` is `"private": true`; `packages/ui` is the sole publish target ([release](release.md)).
- `pnpm-workspace.yaml` globs: `packages/*`, `apps/*`, `tooling/*`.
- Tests, demos, and intl dictionaries are **co-located inside `packages/ui`** — no tests live in consuming apps (explicit break from the internal ref, which kept all component tests app-side).

## 2 Package manager & supply chain

- **pnpm**, version pinned via the root `packageManager` field.
- **pnpm catalog** (`pnpm-workspace.yaml` `catalog:`) is the single version-pinning point for every shared dependency (react, base-ui, tailwind, oxlint, vitest, …). Workspace `package.json`s reference `"catalog:"` — a dependency version literal in a package manifest is a review error.
- **Release-age guard**: `minimumReleaseAge: 4320` (72 hours) in pnpm settings — no package version installs until it has been on the registry for three days. The refs' `overrides` block carries any forced resolutions; additions to it require a PR comment stating why.
- **oxlint and `@oxlint/plugins` are pinned to the same minor, ≥ 1.78.0** — the floor the vendored anti-slop code is validated against (§5.3).
- **Node**: current LTS, pinned in root `engines.node` and `.node-version`.
- **TypeScript configs** split in `tooling/typescript` per the internal ref: `base.json`, `react-library.json` (packages/ui), `internal-package.json` (tooling/*); apps extend base + framework preset. `strict` everywhere; no per-package compiler-option drift outside these files.

## 3 Turbo task graph

`turbo.json` declares, with explicit `outputs` and env allowlists (no implicit env passthrough):

| Task | Depends on | Outputs | Notes |
| --- | --- | --- | --- |
| `build` | `^build` | `dist/**` | tsdown for packages/ui ([architecture](architecture.md)); Next build for apps |
| `lint` | — | — | oxlint; `inputs` include `tooling/oxlint-plugin/**` and `tooling/oxlint-anti-slop/**` so rule edits bust the cache |
| `type-check` | `^build` | — | `tsc --noEmit` per package |
| `test` | — | — | vitest `unit` project (§7.1) |
| `test:browser` | `^build` | — | vitest `browser` project; needs built CSS |
| `dev` | `^build` | — | `persistent: true`, uncached |
| `ci:checks` | aggregate | — | fans out to lint + type-check + test + test:browser + build — the merge gate entry point (§8) |

Format checking (`oxfmt --check`) runs as a root script, not a per-package turbo task.

## 4 Formatting & linting

- **oxfmt** formats everything. Required config: `sortTailwindcss.stylesheet` pointed at the library's source stylesheet (the file behind the `@elmeragroup/ui/css` entry, see [architecture](architecture.md) §5) so class sorting knows the custom tokens/utilities and `functions: ["tv", "cn"]` (so classes inside `tv` recipes and `cn` calls are sorted too). `oxfmt --check` gates merges; no prettier anywhere.
- **oxlint, type-aware** (`oxlint-tsgolint`), configured in root `.oxlintrc.json` with three JS plugins:

  ```json
  "jsPlugins": [
    "eslint-plugin-turbo",
    { "name": "elmera", "specifier": "@elmeragroup/oxlint-plugin" },
    { "name": "anti-slop", "specifier": "@elmeragroup/oxlint-plugin-anti-slop" }
  ]
  ```

- Overrides carve the two plugin source dirs (`tooling/oxlint-plugin/**`, `tooling/oxlint-anti-slop/**`) out of the type-unsafe rules, exactly as the internal ref does for its rule sources.

## 5 Custom lint guardrails

### 5.1 Whitelabel guardrails (kumo pattern) — all v1, `error`

Ship in `@elmeragroup/oxlint-plugin`, scoped to `packages/ui/src/**`:

- **`elmera/no-primitive-colors`** — library source styles with role tokens only; raw palette classes (`bg-white`, `text-slate-500`, hex/oklch literals in class strings) are forbidden. Pairs with the token rules in [conventions](components/conventions.md) (input-like surfaces use `bg-card`, status names are `error/info/success/warning`).
- **`elmera/no-tailwind-dark-variant`** — `dark:` is forbidden in library source; the dark axis is token-reserved behind `[data-theme="dark"]`.
- **`elmera/enforce-variant-standard`** — every component's variant recipe conforms to the tv structure (named recipe, `variants`/`defaultVariants` shape, `VariantProps` typing) from [conventions](components/conventions.md).

### 5.2 Existing elmera rules

The internal ref's `@elmeragroup/oxlint-plugin` rules (e.g. `elmera/require-icon-button-label`) carry over unchanged in the same plugin package.

### 5.3 anti-slop (vendored third plugin)

`dmmulroy/anti-slop` — 15 AST-only oxlint rules rejecting low-evidence TS patterns (type-assertion laundering, `unknown` escape hatches, module mocking, reflection).

- **Vendored, never installed**: the upstream repo is `private: true` and unpublished by design; `oxlint-plugin-anti-slop@0.0.0` on npm is a **third-party name-squat — never install it**. The upstream is days-old, single-author, releaseless: immature as a dependency, acceptable as owned code. We copy `src/` into `tooling/oxlint-anti-slop` as `@elmeragroup/oxlint-plugin-anti-slop` (`private`, `"exports": { ".": "./index.ts" }`, one dependency: `@oxlint/plugins` at the pinned oxlint minor) and record the vendored upstream commit SHA in that package's README. Upstream refresh = manual diff, opt-in.
- **Rule tiers**: `error` — `no-chained-type-assertions`, `no-widen-then-assert`, `no-known-value-widening`, `no-conditional-empty-object-spread`, `no-reflect-apply`, `no-reflect-get`, `no-object-parameters`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-unknown-returns`, `no-unknown-parameters`. `warn` (promote after audit) — `require-safety-comment-for-type-assertion`, `no-runtime-typeof`, `no-shape-in-symbol-names`.
- **`no-module-mocking` stays `error` repo-wide**: the testing strategy (§7) is browser-mode behavior tests against real components — `vi.mock` has no place in this library. No test-dir override.

### 5.4 `elmera/no-internal-dynamic-import`

Per [performance](performance.md) §5, the library never lazy-loads internally: this rule (in `@elmeragroup/oxlint-plugin`) forbids dynamic `import()` anywhere in `packages/ui/src/**`. Apps own code splitting.

## 6 Scaffolding (plop, v1)

`pnpm gen component <name>` (plop generator in the repo root) stubs, via templates + inject markers:

1. `packages/ui/src/components/<name>/<name>.tsx` — component skeleton with tv recipe stub conforming to `enforce-variant-standard`.
2. Co-located `<name>.test.ts` (unit) and `<name>.browser.test.tsx` (browser) stubs with role-based query scaffolding.
3. A plain-`.tsx` demo file per [conventions](components/conventions.md).
4. A docs MDX page stub in `apps/docs`.
5. An **exports-map entry** injected into `packages/ui/package.json` (inject marker), keeping the subpath contract of [architecture](architecture.md) mechanical.

The generator mechanically enforces the ten-section spec template's file conventions; hand-created components that skip it must reproduce every artifact above.

## 7 Testing strategy

Vitest only. **Two co-located projects** declared in `packages/ui/vitest.config.ts` — no `VITEST_ENV` switch:

### 7.1 `unit` project

- Environment: node/happy-dom. Files: `*.test.ts` next to sources.
- Tests: `themeSlug`/`parseThemeSlug`/`validateTheme`, tv recipe class output, exports-map logic, token-pipeline logic.
- **CSS snapshot test for `themes.css`**: the generated stylesheet (13 rules / 16 permutations) is snapshot-asserted so codegen drift is a reviewed diff, paired with the size ceiling in [performance](performance.md) §4. The per-theme **contrast matrix snapshot** ([accessibility](accessibility.md) §6) lives here too.
- **16-theme contract test**: asserts every one of the 16 brand×segment themes supplies its must-override tokens and the generated CSS matches the value matrix. Functional component tests run under **one default theme only** — theming correctness is proven once, centrally, not per component.

### 7.2 `browser` project

- Environment: `@vitest/browser` + playwright, real Chromium. Files: `*.browser.test.tsx` next to sources; requires the built library CSS (`test:browser` depends on `^build`).
- Tests: all component behavior. **Written fresh against each spec's §9 test requirements** — the internal ref's `base-ui-*.test.tsx` files are reference reading only, never ported.
- **All queries role/label-based** (no test-ids, no class queries) and every spec §7 keyboard behavior has an explicit keyboard test — the a11y floor of [accessibility](accessibility.md) §8. **No axe/scanner.** String-bearing components: one render test per shipped locale + one prop-override test.

### 7.3 Type tests

`*.test-d.tsx`, public-API contracts only: the `ThemeInput` union (illegal brand/segment permutations must fail typecheck), variant prop unions, `useRender` signatures, icon-only `aria-label` enforcement, exports-map resolution.

### 7.4 Per-component conventions

Test file naming, co-location, and query rules are stated once in [conventions](components/conventions.md) §Tests & demos; this chapter owns the project/runner/CI level and does not repeat them.

## 8 CI gates

- **Merge gate** (`ci:checks`, required on every PR): type-check · oxlint (all three plugins, anti-slop included) · `oxfmt --check` · unit tests (incl. theme-contract, CSS + contrast snapshots) · browser tests · type tests · build · **`size-limit`** over the built publish artifacts against the [performance](performance.md) §2 ceilings.
- **Publish gate** ([release](release.md)) adds, against the **published package shape** (post-`publishConfig.directory`): `publint` · `@arethetypeswrong/cli` · the export-path resolution test · a re-run of the theme-contract test on the shipped `themes.css`.
- Visual regression is **roadmap, not v1**: the plain-`.tsx` demo pipeline keeps VR-target readiness designed in; tool candidate Playwright + Argos joins the publish gate when the roadmap lands it.
