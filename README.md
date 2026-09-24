# Fuse

Whitelabel React components for Elmera Group's energy brands and corporate Elmera. One public package, 20 theme permutations (variant × brand × segment), ESM-only.

Density is a document-level control-metric axis, independent of theme. Variant supplies only the deployment default (`internal → dense`, `external → comfortable`). Brand is host-owned: spread `themeAttributes(theme)` on `<html>`, then stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))`.

Start with [AGENTS.md](AGENTS.md) for contribution conventions and [CONTEXT.md](CONTEXT.md) for theme vocabulary. Consumer guidance lives in the [docs app](<apps/docs/src/app/(docs)>).

## Why Fuse

An electrical fuse connects the name to Elmera's energy business. To fuse means bringing things together, which reflects teams sharing components and solutions across brands and markets.

- **Simplify.** Solve common interface problems once and make those solutions easy to reuse.
- **Be friendly.** Build accessible, understandable interfaces for customers, with approachable tools and documentation for teams.
- **Create value.** Reduce duplicated work so teams can spend more time improving customer experiences.

## Prerequisites

- **Node**: `>=24.13 <25` — the version in [`.node-version`](.node-version) (`24.13.0`). The build, codegen and docs scripts run TypeScript directly through Node's type-stripping flags, so an older major fails.
- **pnpm 11** — `packageManager` pins the exact version; use Corepack.
- `.ref/` reference checkouts are needed only to lift new reference implementations or artwork ([reference sources](packages/fuse/REFERENCE-SOURCES.md)). They are not needed to build, test, or run the repo.

```sh
pnpm install
pnpm dev
```

Docs: `pnpm --filter docs dev` → http://localhost:3000.

## Scripts

Root scripts fan out through turbo unless noted.

| Script                    | Does                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`              | Builds every package (`@elmeragroup/fuse` via tsdown, the Next apps, static-theme)                                    |
| `pnpm dev`                | Runs the dev servers                                                                                                  |
| `pnpm lint`               | `oxlint . --deny-warnings` over the tree, including the two local plugins                                             |
| `pnpm lint:fix`           | The same with `--fix`                                                                                                 |
| `pnpm format`             | `oxfmt` write; `pnpm format:check` is the CI form                                                                     |
| `pnpm test`               | Unit tests (vitest) in every package                                                                                  |
| `pnpm test:browser`       | Browser-mode vitest projects                                                                                          |
| `pnpm test:types`         | Type-level tests (`*.test-d.tsx`)                                                                                     |
| `pnpm test:repo-policy`   | Root-only vitest project in [`test/`](test) — merge-workflow shape, lint script, README claims                        |
| `pnpm type-check`         | `tsc --noEmit` per package                                                                                            |
| `pnpm gen`                | plop scaffolder — new component (source, entry facade, tests, demos)                                                  |
| `pnpm changeset`          | Adds a changeset; see [Contribution flow](#contribution-flow)                                                         |
| `pnpm release:version`    | `changeset version` + lockfile refresh; the Version Packages PR script                                                |
| `pnpm release`            | Release-engine CLI: `check-pr` validates a Version Packages PR; `publish <commit>` and `retry <record-tag>` run in CI |
| `pnpm type-check:scripts` | `tsc --noEmit` for the root release scripts                                                                           |
| `pnpm ci:checks`          | The merge gate locally: `oxfmt --check` then `turbo run ci:checks`                                                    |

Package-scoped scripts worth knowing:

| Script                                             | Does                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm --filter @elmeragroup/fuse generate:exports` | Regenerates the root barrel and runtime export names from the entry facades           |
| `pnpm --filter @elmeragroup/fuse pack`             | Produces the single tarball that `package:check` and `size-limit` consume             |
| `pnpm --filter @elmeragroup/fuse package:check`    | publint / attw / exports-map / emitted-directive checks against that tarball          |
| `pnpm --filter @elmeragroup/fuse size-limit`       | Bundle budgets against that tarball                                                   |
| `pnpm --filter docs generate`                      | Regenerates the docs API tables and each component's committed `api.json`             |
| `pnpm --filter @elmeragroup/fuse-figma figma:sync` | Writes the tokens into a Figma file; `figma:check` prints the plan and fails on drift |

`@elmeragroup/fuse` has no work of its own to do under `ci:checks`: its gates are separate turbo tasks that the aggregate already depends on. Its `ci:checks` script is therefore a no-op anchor that lets `turbo run ci:checks` fan out, and it says so; the same note is in [`turbo.json`](turbo.json).

## Package map

| Path                  | Name                             | What it is                                                                               |
| --------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/fuse`       | `@elmeragroup/fuse`              | The one published package: components, `/theme`, `/icons`, `/illustrations`, CSS entries |
| `apps/docs`           | `docs`                           | Next docs site, generated API reference, demo corpus, llms.txt                           |
| `apps/static-theme`   | `static-theme`                   | Vite host proving standalone-CSS mode and first-paint theme attributes                   |
| `packages/fuse-figma` | `@elmeragroup/fuse-figma`        | Private CLI that syncs the design tokens into a Figma file's variables                   |
| `packages/color`      | `@elmeragroup/color`             | Private color parsing, conversion, mixing and WCAG contrast, shared by every workspace   |
| `tooling/typescript`  | `@elmeragroup/typescript-config` | Shared tsconfig bases                                                                    |

The API extractor and the `elmera/*` and `anti-slop/*` lint rules come from [`@elmeragroup/internal`](https://github.com/elmeragroup/internal). The workspace pins it once in the pnpm catalog.

## Contribution flow

1. **Scaffold** — `pnpm gen` for a new component; it writes the source, the entry facade, test files and demo stubs.
2. **Implement** using [AGENTS.md](AGENTS.md) and the component's source and tests. Update public JSDoc and consumer docs when usage changes; keep implementation rationale beside its owner.
3. **Tests and demos** ship in that same change. Record the title, RSC status and demo files in `apps/docs/test/fixtures/component-inventory.json` and regenerate API artifacts.
4. **Changeset** — `pnpm changeset` for anything user-facing. Internal-only PRs (CI, docs site, tests) carry the `no-changeset` GitHub label instead. Never edit an existing changeset to move a gate; edit one only to correct what it says shipped.
5. **Gate** — `pnpm ci:checks` green locally before review. The merge workflow runs the same stages plus the label-aware changeset check.

**After rebasing, regenerate the generated artifacts before running the gate**: `pnpm --filter docs generate` rewrites the committed per-component `api.json` files. They are derived from the library's public API, so a rebase that picks up an API change leaves them stale and fails the docs drift check on work that is otherwise correct.

## Release

Once publishing is activated, every push to `main` publishes a **canary** and the bot opens or updates the **Version Packages PR** while changesets are pending; merging that PR publishes the **stable** line and is the release action — several canaries can precede a stable. Publishing runs on the [`@elmeragroup/internal` release engine](https://github.com/elmeragroup/internal) with a token for now, moving to OIDC later. The [release runbook](scripts/RELEASE.md) owns the channels, the pack-adapter gates, and the activation prerequisites.

## Reading by task

| Task                              | Start here                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Change or add a component         | [AGENTS.md](AGENTS.md), then the component's source, tests and docs page                                      |
| Integrate the library into an app | [Package README](packages/fuse/README.md) and [theming](<apps/docs/src/app/(docs)/handbook/theming/page.tsx>) |
| Diagnose build or test failures   | The failing workspace's scripts and [Turbo dependencies](turbo.json)                                          |
| Understand theme vocabulary       | [Domain glossary](CONTEXT.md)                                                                                 |
| Find unfinished work              | [TODO.md](TODO.md)                                                                                            |
| Prepare a release                 | [Release runbook](scripts/RELEASE.md)                                                                         |
| Sync tokens to Figma              | [fuse-figma README](packages/fuse-figma/README.md)                                                            |

Source and configuration own inventories, versions, values, and measurements. Documentation explains the policies and procedures that govern them.
