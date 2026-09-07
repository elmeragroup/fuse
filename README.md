# Elmera UI

Whitelabel React components for Elmera Group's energy brands and corporate Elmera. One public package, 20 theme permutations (variant × brand × segment), ESM-only.

Density is a document-level control-metric axis, independent of theme. Variant supplies only the deployment default (`internal → dense`, `external → comfortable`). Brand is host-owned: spread `themeAttributes(theme)` on `<html>`, then stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))`.

Current cross-component contracts live in [docs/spec/](docs/spec/README.md); the glossary is [CONTEXT.md](CONTEXT.md). Read only the chapter your change affects.

## Prerequisites

- **Node**: `>=24.13 <25` — the version in [`.node-version`](.node-version) (`24.13.0`). The build, codegen and docs scripts run TypeScript directly through Node's type-stripping flags, so an older major fails.
- **pnpm 11** — `packageManager` pins the exact version; use Corepack.
- `.ref/` reference checkouts are needed only to lift new reference implementations or artwork ([reference sources](docs/reference-sources.md)). They are not needed to build, test, or run the repo.

```sh
pnpm install
pnpm dev
```

Docs: `pnpm --filter docs dev` → http://localhost:3000.

## Scripts

Root scripts fan out through turbo unless noted.

| Script                  | Does                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm build`            | Builds every package (`@elmeragroup/ui` via tsdown, the Next apps, static-theme)               |
| `pnpm dev`              | Runs the dev servers                                                                           |
| `pnpm lint`             | `oxlint . --deny-warnings` over the tree, including the two local plugins                      |
| `pnpm lint:fix`         | The same with `--fix`                                                                          |
| `pnpm format`           | `oxfmt` write; `pnpm format:check` is the CI form                                              |
| `pnpm test`             | Unit tests (vitest) in every package                                                           |
| `pnpm test:browser`     | Browser-mode vitest projects                                                                   |
| `pnpm test:types`       | Type-level tests (`*.test-d.tsx`)                                                              |
| `pnpm test:repo-policy` | Root-only vitest project in [`test/`](test) — merge-workflow shape, lint script, README claims |
| `pnpm type-check`       | `tsc --noEmit` per package                                                                     |
| `pnpm gen`              | plop scaffolder — new component (source, entry facade, tests, demos)                           |
| `pnpm changeset`        | Adds a changeset; see [Contribution flow](#contribution-flow)                                  |
| `pnpm ci:checks`        | The merge gate locally: `oxfmt --check` then `turbo run ci:checks`                             |

Package-scoped scripts worth knowing:

| Script                                           | Does                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `pnpm --filter @elmeragroup/ui generate:exports` | Regenerates the root barrel and runtime export names from the entry facades  |
| `pnpm --filter @elmeragroup/ui pack`             | Produces the single tarball that `package:check` and `size-limit` consume    |
| `pnpm --filter @elmeragroup/ui package:check`    | publint / attw / exports-map / emitted-directive checks against that tarball |
| `pnpm --filter @elmeragroup/ui size-limit`       | Bundle budgets against that tarball                                          |
| `pnpm --filter docs generate`                    | Regenerates the docs API tables and each component's committed `api.json`    |

`@elmeragroup/ui` has no work of its own to do under `ci:checks`: its gates are separate turbo tasks that the aggregate already depends on. Its `ci:checks` script is therefore a no-op anchor that lets `turbo run ci:checks` fan out, and it says so; the same note is in [`turbo.json`](turbo.json).

## Package map

| Path                 | Name                             | What it is                                                                               |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/ui`        | `@elmeragroup/ui`                | The one published package: components, `/theme`, `/icons`, `/illustrations`, CSS entries |
| `apps/docs`          | `docs`                           | Next docs site, generated API reference, demo corpus, llms.txt                           |
| `apps/static-theme`  | `static-theme`                   | Vite host proving standalone-CSS mode and first-paint theme attributes                   |
| `tooling/typescript` | `@elmeragroup/typescript-config` | Shared tsconfig bases                                                                    |

The API extractor and the `elmera/*` and `anti-slop/*` lint rules come from [`@elmeragroup/internal`](https://github.com/elmeragroup/internal). Until it is on npm, the workspace installs the packed archive under [`vendor/internal/`](vendor/internal/README.md).

## Contribution flow

1. **Scaffold** — `pnpm gen` for a new component; it writes the source, the entry facade, test files and demo stubs.
2. **Implement** using [component authoring](docs/component-authoring.md) and the owning library-wide contract in [docs/spec/](docs/spec/README.md). Update public JSDoc and authored docs with the code; record architectural decisions in an ADR.
3. **Tests and demos** ship in that same change. Maintain the reviewed demo coverage in `apps/docs/test/fixtures/component-demo-requirements.json` and regenerate API artifacts.
4. **Changeset** — `pnpm changeset` for anything user-facing. Internal-only PRs (CI, docs site, tests) carry the `no-changeset` GitHub label instead. Never edit an existing changeset to move a gate; edit one only to correct what it says shipped.
5. **Gate** — `pnpm ci:checks` green locally before review. The merge workflow runs the same stages plus the label-aware changeset check.

**After rebasing, regenerate the generated artifacts before running the gate**: `pnpm --filter docs generate` rewrites the committed per-component `api.json` files. They are derived from the library's public API, so a rebase that picks up an API change leaves them stale and fails the docs drift check on work that is otherwise correct.

## Release

The [release runbook](docs/spec/release.md) separates the active Version Packages workflow from the publishing pipeline that still needs setup. Do not merge the bot's Version Packages PR until the npm/GitHub prerequisites and publish workflow are ready.

## Reading by task

| Task                              | Start here                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Change or add a component         | [Component authoring](docs/component-authoring.md), then that component's source, tests, and docs page |
| Integrate the library into an app | [Package README](packages/ui/README.md) and [theme integration](docs/theming-integration.md)           |
| Change library-wide behavior      | [Contract index](docs/spec/README.md), which maps changes to one owning chapter                        |
| Diagnose build or test failures   | [Tooling](docs/spec/tooling.md), the failing workspace's scripts, and its Turbo config                 |
| Understand a decision             | [ADRs](docs/adr/) and [domain glossary](CONTEXT.md)                                                    |
| Find unfinished work              | [Roadmap](docs/spec/roadmap.md)                                                                        |

Source and configuration own inventories, versions, values, and measurements. Documentation explains the policies and procedures that govern them.
