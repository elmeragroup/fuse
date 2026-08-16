# 015 — anti-slop research

Ticket: `wayfinder/tickets/015-anti-slop-research.md`
Researched: 2026-08-16, against primary sources (repo README, package.json, `src/index.ts`, rule sources, GitHub API, npm registry).

## What it is

`dmmulroy/anti-slop` is a set of **15 opinionated oxlint JS-plugin rules** ("Opinionated Oxlint rules for rejecting low-evidence TypeScript and JavaScript patterns"). It is not an agent framework and not a formatter — it is a plain oxlint plugin built with `eslintCompatPlugin` from `@oxlint/plugins`, exactly the same mechanism as the refs' existing `@elmeragroup/oxlint-plugin` (`.ref/OrderModuleInternalWeb/tooling/oxlint/index.js`). The rules target patterns typical of low-effort AI-generated code: type-assertion laundering, `unknown`/`any` escape hatches, module mocking, reflection, ad hoc `typeof` narrowing.

- Repo: https://github.com/dmmulroy/anti-slop
- Author: Dillon Mulroy (sole committer)
- License: MIT
- Language: TypeScript; plugin entry `src/index.ts` (`export default eslintCompatPlugin({ meta: { name: "anti-slop" }, rules: {...} })`)

### The 15 rules (from README + `src/index.ts`)

| Rule | Rejects |
|---|---|
| `no-chained-type-assertions` | nested/chained type assertions (`x as unknown as T`) |
| `no-conditional-empty-object-spread` | conditional spreads using `{}` to omit fields |
| `no-known-value-widening` | explicit broad types that discard known value evidence |
| `no-module-mocking` | `vi.mock`/`vi.doMock`/`vi.unstable_mockModule` and jest equivalents (AST-only, no options, no exceptions) |
| `no-object-parameters` | the broad `object` type on function inputs |
| `no-reflect-apply` / `no-reflect-get` | `Reflect.apply` / `Reflect.get` |
| `no-runtime-typeof` | ad hoc `typeof` narrowing instead of boundary parsing |
| `no-shape-in-symbol-names` | any **declared** identifier containing the substring "shape" (case-insensitive; does not flag property access like `zodSchema.shape`) |
| `no-unknown-parameters` | `unknown` inputs (explicit `cause` convention excepted) |
| `no-unknown-returns` | contracts returning `unknown` / `Promise<unknown>` |
| `no-unknown-type-aliases` | aliases that merely conceal `unknown` |
| `no-unsafe-dictionary-type` | dictionary value contracts based on unsafe types |
| `no-widen-then-assert` | widening a known value then asserting it back |
| `require-safety-comment-for-type-assertion` | type assertions without a documented safety comment |

All rules are **AST-only** (verified for `no-module-mocking` and `no-shape-in-symbol-names` source; the plugin does not consume type information). They do not use or require oxlint's type-aware mode.

## Install and configuration

The project is intentionally **vendor-first, not a dependency**:

- Repo `package.json` is `"private": true`, `"name": "oxlint-plugin-anti-slop"`, `"version": "0.1.0"` — **the author does not publish it to npm**.
- README-recommended installs:
  1. Agent skill: `npx skills add dmmulroy/anti-slop --skill install-anti-slop` (repo ships a `skills/install-anti-slop/` directory; skill assets are kept in sync with `src/` via `scripts/sync-skill-assets.mjs`).
  2. Manual: copy `src/` into the repo (README suggests `tools/oxlint/anti-slop/`) and install matching `oxlint` + `@oxlint/plugins`.
- README config example registers it via `jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }]` in `oxlint.config.ts`, enables all 15 rules as `error`, and adds agent-tooling dirs (`.claude/**`, `.cursor/**`, etc.) plus the vendored dir itself to `ignorePatterns`.

### npm warning

`registry.npmjs.org/oxlint-plugin-anti-slop` exists as version `0.0.0`, published 2026-08-12 by **"gameroman" (dev@rman.dev) — not the author**, with no description, no dependencies, no repository link. This is a name-squat placeholder. **Do not install anti-slop from npm.** (`anti-slop` itself is not on npm at all: registry returns Not found.)

## Compatibility

| Concern | Verdict |
|---|---|
| oxlint `^1.x` | Compatible. anti-slop pins `oxlint@1.78.0` / `@oxlint/plugins@1.78.0`; the ref repo uses `oxlint@^1.75.0` / `@oxlint/plugins@^1.75.0`. Same JS-plugin API (`eslintCompatPlugin`). |
| Type-aware rules (`options.typeAware`, `oxlint-tsgolint`) | No interaction. anti-slop rules are AST-only jsPlugin rules; they run in the JS-plugin pass, orthogonal to tsgolint. |
| Custom `@elmeragroup/oxlint-plugin` | No collision. Plugin namespaces differ (`anti-slop/*` vs `elmera/*`); the ref `.oxlintrc.json` already loads multiple `jsPlugins` (eslint-plugin-turbo + elmera), so adding a third entry is routine. |
| oxfmt | Orthogonal — anti-slop is lint-only, no formatting opinions. |
| pnpm | Fine — repo itself is a pnpm project (`packageManager: pnpm@10.33.0`); vendored code has one dependency, `@oxlint/plugins`. |
| turborepo | Fine — lint-only. Only caveat: include the vendored plugin dir in the `lint` task's inputs so rule edits bust the turbo cache (the refs' `tooling/oxlint/` has the same need). |
| TS entry point | README loads `index.ts` directly as a jsPlugin specifier, which the author validates against oxlint 1.78. On oxlint 1.75 this is unproven; the safe route is either upgrading oxlint to ≥1.78 or vendoring the rules as `.js` like the existing `tooling/oxlint/rules/*.js`. |

## Maturity assessment

- **Created 2026-08-12, last push 2026-08-14 — the repo is four days old.** 12 commits total, single author.
- 1,589 stars, 26 forks, 1 open issue (viral launch, tiny track record).
- **No releases, no tags, no npm publish, no versioning story.** Version pinning is impossible; "upstream updates" means re-copying files.
- Tests exist for 12 of 15 rules (plain `tsx`-run test files); CI via `.github/`.
- Mitigation: the project *explicitly designs for vendoring* — you own the copy, so upstream abandonment is a non-risk and upstream churn is opt-in.

Verdict: **immature as a dependency, acceptable as vendored code.** Treat it as a starting-point rule pack you fork and own, not as maintained third-party tooling.

## Conflicts / friction with the existing setup

1. **`no-module-mocking` will fire immediately**: 17 files in the ref repo use `vi.mock`/`vi.doMock` (e.g. `apps/web-stormwind/test/*.test.ts`, `test/browser/*.test.tsx`). The rule has no options. Either adopt the DI-over-mocking philosophy (aligned with the refs' Effect service-seam patterns, but a real migration) or turn the rule off for `**/test/**` in an override.
2. **`no-shape-in-symbol-names` is a philosophy rule with false-positive risk**: it flags *any declared identifier* containing "shape". Grep shows shape-named symbols already exist in the refs (`packages/env-sync/src/runtime/with-pim-recovery.ts`, `packages/env-sync/test/helpers/stubs.ts`, UI logo components). Zod `.shape` property *access* is safe. Recommend starting this rule at `warn` or `off`.
3. **`require-safety-comment-for-type-assertion`** stacks on top of `typescript/no-non-null-assertion: error` and `typescript/non-nullable-type-assertion-style: error` — complementary, not conflicting, but existing `as` casts will need `// SAFETY:`-style comments or the rule disabled where casts are pre-audited (the ref already carves out `tooling/oxlint/rules/*.js` from unsafe-type rules; the vendored anti-slop dir needs the same carve-out, which the README's own config shows).
4. **`no-unknown-parameters`/`no-unknown-returns`** may fight generic utility code (e.g. `to()` from `@elmeragroup/lib`, error-cause plumbing). The `cause` exception covers the common case; expect a handful of per-file overrides.
5. **`no-runtime-typeof`** is philosophically aligned with the refs' zod-at-the-boundary convention but will flag legitimate narrowing in low-level utilities.

No mechanical conflicts exist — every risk above is rule-strictness, resolvable with the same `overrides` machinery the ref `.oxlintrc.json` already uses extensively.

## Recommended wiring for the new monorepo

Vendor it in the same pattern as the existing custom plugin — a private workspace package under `tooling/`:

```
tooling/oxlint/               # existing pattern: @elmeragroup/oxlint-plugin (elmera/* rules)
tooling/oxlint-anti-slop/     # vendored copy of anti-slop src/
  package.json                # { "name": "@elmeragroup/oxlint-plugin-anti-slop", "private": true,
                              #   "type": "module", "exports": { ".": "./index.ts" },
                              #   "dependencies": { "@oxlint/plugins": "<same version as oxlint>" } }
  index.ts                    # anti-slop's src/index.ts
  rules/                      # anti-slop's src/rules/*.ts (+ tests)
  shared/                     # anti-slop's src/shared/
```

1. **Pin oxlint and `@oxlint/plugins` to the same minor** (≥1.78.0 recommended, matching the vendored code; anti-slop pins both to 1.78.0). If staying on an older 1.x, smoke-test that oxlint loads the `.ts` entry; otherwise transpile the rules to `.js` like `tooling/oxlint/rules/*.js`.
2. **Register in `.oxlintrc.json`** alongside the existing plugins:
   ```json
   "jsPlugins": [
     "eslint-plugin-turbo",
     { "name": "elmera", "specifier": "@elmeragroup/oxlint-plugin" },
     { "name": "anti-slop", "specifier": "@elmeragroup/oxlint-plugin-anti-slop" }
   ]
   ```
3. **Enable rules tiered, not all-error**:
   - `error` from day one: `no-chained-type-assertions`, `no-widen-then-assert`, `no-known-value-widening`, `no-conditional-empty-object-spread`, `no-reflect-apply`, `no-reflect-get`, `no-object-parameters`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-unknown-returns`, `no-unknown-parameters`.
   - `error` with a test-dir decision: `no-module-mocking` — decide up front whether the new repo's tests use DI seams (refs' Effect patterns support this); otherwise `"anti-slop/no-module-mocking": "off"` in an override for `**/test/**`.
   - `warn` initially: `require-safety-comment-for-type-assertion`, `no-runtime-typeof`, `no-shape-in-symbol-names` — promote to `error` after auditing hits.
4. **Overrides**: exclude the vendored dir from type-unsafe rules exactly as the ref does for `tooling/oxlint/rules/*.js`, and add the README's agent-dir `ignorePatterns` (`.claude/**` etc.) if agent scratch files live in-repo.
5. **Turborepo**: add `tooling/oxlint-anti-slop/**` to the root `lint` task `inputs` (same as `tooling/oxlint/**`).
6. **Never install from npm** (`oxlint-plugin-anti-slop@0.0.0` is a third-party squat). Upstream refresh = manually diffing `dmmulroy/anti-slop` `src/` against the vendored copy; there are no releases to track. Optionally record the vendored commit SHA in the package README.

## Sources

- https://github.com/dmmulroy/anti-slop (repo page: stars, description, activity)
- https://raw.githubusercontent.com/dmmulroy/anti-slop/main/README.md (rules, install, config example)
- https://raw.githubusercontent.com/dmmulroy/anti-slop/main/package.json (`private: true`, oxlint/@oxlint/plugins 1.78.0, pnpm)
- https://raw.githubusercontent.com/dmmulroy/anti-slop/main/src/index.ts (`eslintCompatPlugin`, rule registry)
- https://raw.githubusercontent.com/dmmulroy/anti-slop/main/src/rules/no-module-mocking.ts (AST-only, no options)
- https://raw.githubusercontent.com/dmmulroy/anti-slop/main/src/rules/no-shape-in-symbol-names.ts (declared identifiers only)
- https://api.github.com/repos/dmmulroy/anti-slop (created 2026-08-12, pushed 2026-08-14, 1,589 stars, 26 forks, MIT)
- https://api.github.com/repos/dmmulroy/anti-slop/tags and /releases (both empty)
- https://api.github.com/repos/dmmulroy/anti-slop/commits (12 commits, sole author Dillon Mulroy, 2026-08-12 → 2026-08-14)
- https://registry.npmjs.org/oxlint-plugin-anti-slop (v0.0.0 squat by "gameroman", 2026-08-12); https://registry.npmjs.org/anti-slop (Not found)
- Local: `.ref/OrderModuleInternalWeb/.oxlintrc.json`, `.ref/OrderModuleInternalWeb/tooling/oxlint/{index.js,package.json}`, ref root `package.json` (oxlint ^1.75.0, oxfmt ^0.57.0, oxlint-tsgolint ^7.0.2001)
