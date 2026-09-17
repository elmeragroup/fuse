# Release runbook

Current state: once publishing is activated, every push to `main` publishes a canary and merging the bot's Version Packages PR publishes the stable line. Publishing authenticates with an npm token for now and moves to OIDC later (§6), and the release and version jobs are skipped until `RELEASE_ENABLED` is set to `true` (§8). The release engine is `@elmeragroup/internal/release` ([ADR 0011](../adr/0011-release-runs-on-the-internal-engine.md)); this chapter owns the UI-specific policy around it. The repository is not public and does not yet publish (§7).

## 1 Scope & home

- **One public package, one version.** `@elmeragroup/ui` is a single package (see [architecture](architecture.md)); `/theme`, `/icons`, `/illustrations`, per-component subpaths, and the CSS entries are exports of it. There is no independent-versioning question — no cross-package skew is possible. `tooling/*` packages are internal and are **not** published by this pipeline.
- **Home**: a **public repository in the existing Elmera GitHub org**. CI is **GitHub Actions**. Publishes go to **public npmjs.com** under the `@elmeragroup` org, with the maintainer (Tommy Barvåg) as npm org owner — he holds the open-distribution authority (§4).
- Versioning follows **semver**; the changelog is generated from changesets (§2), never hand-edited.
- The release engine ships in `@elmeragroup/internal` as its `release` export, not as a workspace package ([ADR 0011](../adr/0011-release-runs-on-the-internal-engine.md)). It owns eligibility, canary allocation, GitHub release records, archive verification, promotion, and retry. This repository owns the [pack adapter](../../packages/ui/scripts/release-pack.ts) and the workflows.

## 2 Versioning: changesets and the Version Packages PR

Changesets collect release notes and calculate versions. The bot prepares the version PR; the maintainer decides when to merge it.

1. **Collect changesets during development.** Every PR that changes published behavior (API, styles, tokens, types, doc strings shipped in the package) includes a changeset created with `pnpm changeset`. Choose `patch` for fixes, `minor` for compatible additions, or `major` for breaking changes. Write the summary for package consumers. One file can cover related changes; separate files can describe independent changes within the same PR. Internal-only PRs (CI, docs site, tests) carry the `no-changeset` label instead.
2. **Merge as many PRs as needed.** Each merge to `main` also publishes a canary once publishing is activated (§3). Their changeset files accumulate; the highest pending bump determines the next stable version, and multiple patch or minor changesets do not each increment the version separately.
3. **The bot opens the Version Packages PR.** Once publishing is activated, every push to `main` runs the version job: while changesets are pending, `changesets/action` opens or updates the `changeset-release/main` PR by running `pnpm release:version` (`changeset version` plus a lockfile refresh). Version jobs queue without cancelling or replacing one another. Immediately before the action, each job checks the current `main` commit through GitHub and skips the update if its source is stale, so checks finishing out of order cannot roll the release PR back. The PR records the version and changelog and deletes the consumed changesets; it publishes nothing by itself. The commit is created with `GITHUB_TOKEN`, so its push does not start a merge run — the version workflow dispatches `merge.yml` on `changeset-release/main` explicitly.
4. **The merge gate validates the PR.** On the release branch, `pnpm release check-pr` asserts the stable bump against `origin/main`, that every changeset is consumed, and that the changelog carries the version. Errors are fixed by updating `main` and letting the bot refresh the PR, never by hand-editing the generated changelog.
5. **Merging the Version Packages PR is the release action.** The merge commit carries the stable bump, so, once publishing is activated, the push to `main` publishes the stable version (§2.1). Keep the PR open across as many merges as wanted — each one adds a canary and updates the PR — and merge it when the stable line should ship. Before merging, let the bot refresh the PR against `main` until it consumes every pending note: the engine's stable gate rejects any remaining `.changeset/*.md`, so a stale PR lands the version bump, fails publication, and skips the version: the commit still carries the unconsumed notes, so retrying it cannot succeed.

The engine's stable gate requires the version bump to arrive through a merged `changeset-release/main` PR. A manually prepared release branch does not publish; the bot flow is the only stable path.

## 2.1 Publishing

The [publish workflow](../../.github/workflows/publish-release.yml) calls the engine through `pnpm release publish <commit>` (or `pnpm release retry <record-tag>`), which runs the pack adapter and the recorded publication protocol.

- **Canary (automatic).** Once publishing is activated, every push to `main` that is not a stable version commit publishes `x.y.z-canary.N` under the `canary` dist-tag. `N` counts from the planned changeset version while one is pending, or from the next patch otherwise; a commit already covered by a published stable or by a descendant canary is skipped, and a same-version identity mismatch is fatal.
- **Stable (by merging the Version Packages PR).** Once activated, the push that merges the PR publishes the stable version under `latest`. Nothing else may raise the stable version.
- **Retry (manual).** A failed publication is finished from the archive recorded on its GitHub release. Dispatch the Publish Release workflow from `main` with the record tag — `v<version>` for a stable, `canary-<sha>` for a canary; the publish job's `github.ref == 'refs/heads/main'` guard makes any other ref a silent no-op. Retry restores the recorded bytes, re-verifies them against the recorded source, and never re-packs.
- Publishing is a CI operation, never a local `npm publish`.

## 3 Channels & previews

- **`latest`**: stable releases from `main` via merging the Version Packages PR.
- **`canary`**: automatic prerelease channel, one version per activated merge to `main`. It replaces the former beta pre-mode plan: the engine's version grammar is `x.y.z` or `x.y.z-canary.N`, so a changesets pre-mode version (`-beta.N`) cannot be published through it.
- **Per-PR previews (pending)**: once **pkg-pr-new** is enabled (§7 item 6), it will publish an installable build of every PR (`npm i https://pkg.pr.new/...`), so consuming apps can trial a change before merge. Preview builds are ephemeral, carry no dist-tag, and are not releases — no changeset, no changelog entry, no provenance claim.

## 4 Licensing constraints on publishing

These facts bound what the published tarball may contain; they are settled, not open questions.

- **Code license: MIT**, matching the entire dependency stack (base-ui, Phosphor, Tailwind ecosystem). The `LICENSE` file and `"license": "MIT"` field ship in the package. Approver of open distribution: **Tommy Barvåg** — recorded here; no further sign-off gate exists.
- **The library never ships font files.** Fonts are app-supplied via the themable `--font-sans`/`--font-heading` tokens; themes reference font-family _names_ only. This keeps Fjordkraft's commercially licensed Neo Sans (and any future licensed font) out of the published package permanently. Any PR adding `woff2`/`ttf`/font binaries to the package is rejected on licensing grounds. There is no `@elmeragroup/fonts` package.
- **Logos ship publicly** in `@elmeragroup/ui/icons` (full decided roster). They are publicly visible marks already served in every brand site's bundles; npm changes discoverability, not exposure. Escalation only if brand/legal objects later.
- **Nothing stays private.** No public/private repo split, no private registry, no CI split.

## 5 Publish-time gates

The publish workflow publishes only when the pack adapter completes. The adapter runs the package build with the release intent so the publish manifest is written once with the release version and `elmeraRelease` identity, then runs `pnpm pack` and runs the gate scripts against that exact tarball before returning its bytes; the engine verifies the archive against the recorded intent and uploads those bytes. The table below is the **single exhaustive publish-gate list**; owning chapters define each check but must link here instead of maintaining competing release lists.

| Gate                                            | Asserts                                                                                                                                                           | Owner                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **publint**                                     | package.json/exports correctness for the published shape                                                                                                          | [architecture](architecture.md)                    |
| **arethetypeswrong (attw)**                     | type resolution across module modes                                                                                                                               | [architecture](architecture.md)                    |
| **exports-map test**                            | every codegen'd subpath resolves against the **published** shape (`publishConfig.directory` swap: in-repo `src`, published `dist`)                                | [architecture](architecture.md)                    |
| **emitted-directive parity**                    | all and only source modules with a leading `"use client"` retain it in the packed JavaScript graph                                                                | [architecture](architecture.md)                    |
| **packed-asset contract**                       | flag filenames/manifest/hashes and license/provenance files match the spec; every flag-bearing phone country resolves locally                                     | [architecture](architecture.md), [icons](icons.md) |
| **size-limit budgets**                          | every JS-entry, built-CSS, and aggregate raw-flag ceiling in the budget table holds against the packed artifact                                                   | [performance](performance.md)                      |
| **theme-contract test**                         | the 20-theme token contract holds in the built CSS                                                                                                                | [tooling](tooling.md)                              |
| **packed fixture: Next App Router** _(pending)_ | the `pnpm pack` tarball installs and builds in a Next App Router app (Tailwind-source mode, RSC boundaries: server page + client island); flag SVG assets resolve | [tooling](tooling.md)                              |
| **packed fixture: Vite** _(pending)_            | the `pnpm pack` tarball installs and builds in a Vite app (standalone-CSS mode); flag SVG assets resolve                                                          | [tooling](tooling.md)                              |

The adapter runs `package:check` (publint, attw, exports-map, directives, packed assets, packed React compatibility), `size-limit`, and `test:packed-consumer` (standalone-CSS rendering and flag-asset consumers) against the tarball; the merge gate runs the same gates on every PR. The theme-contract test runs in the merge suite against the generated stylesheet, and the release job's dependency on the merge checks keeps it on the publish path. Publishing deliberately waits on the merge checks rather than the Vitest browser suite; the adapter re-runs its own Chromium-based `test:packed-consumer` against the packed artifact, and a flake in the merge browser suite must not strand a landed stable bump. The packed Next App Router and Vite fixture rows remain pending publish gates until those apps land ([tooling](tooling.md) §7.5).

## 6 Authentication & provenance

- **npm token for now.** The publish workflow authenticates with a granular `NPM_TOKEN` repository secret, because the engine promotes the checked version with `npm dist-tag add` and npm's OIDC trusted publishing cannot authenticate that command ([npm/cli#8547](https://github.com/npm/cli/issues/8547)). The token is scoped to the `@elmeragroup` org and rotated when maintainers change. It is the only long-lived credential in the pipeline.
- **OIDC pivot (planned).** The target remains token-free **npm Trusted Publishing** (OIDC) with provenance. It requires (a) the package to exist so the registry can bind a trusted publisher, (b) a public repository for provenance attestations, and (c) an engine promotion path that works under OIDC. Until all three hold, the token stays. Tracked in [roadmap](roadmap.md) §13.
- **2FA is required for all members** of the npm `@elmeragroup` org.
- Publishes occur only from the Publish Release workflow: automatically for canaries on `main`, automatically for a stable on the Version Packages merge commit, or manually as a retry (§2.1). The engine's stable gate rejects any other stable bump.

## 7 Org-setup prerequisites (pending)

The account owner must complete the following before the first publish. Track completion in a shared issue with the resulting org/repo URLs, owner accounts, and any deviations.

1. **npm org**: the `@elmeragroup` org exists and publishes `@elmeragroup/internal`; require 2FA for all members.
2. **Name-collision check**: `@elmeragroup/ui` is unclaimed on the public registry as of 2026-09-13; record a **reserved-names policy** for future public names.
3. **GitHub**: make the repository public in the Elmera GitHub org; enable GitHub Actions, and under **Settings → Actions → General** allow GitHub Actions to create and approve pull requests (`changesets/action` opens the Version Packages PR with `GITHUB_TOKEN`). Require branches to be up to date before merging, so the bot's refresh blocks a stale Version Packages PR merge.
4. **Trusted Publishing (after the OIDC pivot, §6)**: bind the npm Trusted Publisher for the repo's `publish-release.yml` workflow, set provenance, and delete the `NPM_TOKEN` secret.
5. **Vercel**: create the docs-site project wired to the repo, PR previews on.
6. **pkg-pr-new**: enable for per-PR preview installs (§3).

Items 1–3 unblock the first canary; item 4 is the §6 pivot. Items 5–6 enable docs previews and per-PR installs; they do not block library development.

## 8 Activate publishing

1. Complete §7 items 1–3.
2. Set the `NPM_TOKEN` repository secret (granular, org-scoped) and the `RELEASE_ENABLED` repository variable (`true`). The release and version jobs on `main` are skipped until the variable is `true`, so merges before activation neither publish, create records, nor open a Version Packages PR. Keep the variable set while a Version Packages PR is open, and do not merge a Version Packages PR while publishing is off — an open PR remains mergeable, and merging it consumes its changesets without publishing that version.
3. Confirm the next push to `main` publishes a canary; verify the `canary` dist-tag and the GitHub release record. If a run failed after recording an archive, dispatch Publish Release with the record tag to retry (§2.1).
4. Merge a Version Packages PR to publish the first stable; verify `latest`.
5. After the OIDC pivot, update §6 and this chapter's current-state paragraph (§7 item 4).

The Effect stable-version follow-up remains in the [roadmap](roadmap.md#12-effect-4-rc--stable).
