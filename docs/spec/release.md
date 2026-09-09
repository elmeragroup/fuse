# Release runbook

Current state: maintainers manually prepare release PRs from accumulated changesets. No workflow automatically opens a version PR or publishes to npm. Merging a release PR records the version and changelog only.

Publishing and previews remain pending. Sections 3 and 6 describe the intended setup after activation; the first publish requires §7 items 1–4 and a manually triggered publishing workflow implementing §5.

## 1 Scope & home

- **One public package, one version.** `@elmeragroup/ui` is a single package (see [architecture](architecture.md)); `/theme`, `/icons`, `/illustrations`, per-component subpaths, and the CSS entries are exports of it. There is no independent-versioning question — no cross-package skew is possible. `tooling/*` packages are internal and are **not** published by this pipeline.
- **Home**: a **public repository in the existing Elmera GitHub org**. CI is **GitHub Actions**. Publishes go to **public npmjs.com** under the `@elmeragroup` org, with the maintainer (Tommy Barvåg) as npm org owner — he holds the open-distribution authority (§4).
- Versioning follows **semver**; the changelog is generated from changesets (§2), never hand-edited.

## 2 Manual release preparation

Changesets collect release notes and calculate versions. The maintainer decides when to prepare a release and opens the PR manually.

1. **Collect changesets during development.** Every PR that changes published behavior (API, styles, tokens, types, doc strings shipped in the package) includes a changeset created with `pnpm changeset`. Choose `patch` for fixes, `minor` for compatible additions, or `major` for breaking changes. Write the summary for package consumers. One file can cover related changes; separate files can describe independent changes within the same PR. Internal-only PRs (CI, docs site, tests) carry the `no-changeset` label instead.
2. **Merge as many PRs as needed.** Their changeset files accumulate on `main` without changing the package version or publishing anything. The highest pending bump determines the next version; multiple patch or minor changesets do not each increment the version separately.
3. **Start a release branch from the latest `main`.** Use a clean checkout and a branch such as `codex/release-ui`. Install the pinned dependencies, inspect the pending release, then apply it:

   ```sh
   pnpm install --frozen-lockfile
   pnpm exec changeset status
   pnpm exec changeset version
   pnpm install --lockfile-only
   pnpm ci:checks
   ```

   `pnpm changeset` adds a note; `pnpm exec changeset version` consumes the pending notes. Versioning updates `packages/ui/package.json`, generates `packages/ui/CHANGELOG.md`, and deletes the consumed changeset files. The lockfile command refreshes any affected workspace metadata. The CLI does not commit these changes automatically.

4. **Review and open the release PR.** Check the version, generated changelog, changeset deletions, and any lockfile changes. Correct inaccurate source changeset summaries before regenerating; never hand-edit the generated changelog. Commit the resulting changes and open a PR targeting `main`, with a title such as `chore: release @elmeragroup/ui <version>`. Apply the `no-changeset` label because this PR consumes changesets rather than adding one. All other merge checks still apply; there is no branch-name exemption.
5. **Merge after review and CI pass.** This records the version and changelog. It does not publish to npm, create a release tag, or create a GitHub Release. Changesets merged after the release branch was prepared can remain pending for the next release. To include them in this release, recreate the versioning changes from the updated `main` instead of layering another version bump onto the prepared one.

There is no need to add a changeset describing the release procedure itself. Do not run versioning on every feature branch or manually bump the package version alongside each change.

## 2.1 Publishing is a separate manual action (pending)

After the prerequisites and publishing workflow are implemented, a maintainer will explicitly trigger publishing for the reviewed release commit on `main`. Merging a feature PR or release PR will not trigger publishing. The workflow must build and check the artifact using §5, authenticate using §6, and publish the checked tarball. Git tags and GitHub Releases should be created only after a successful publish.

Publishing remains a CI operation, never a local `npm publish`. Preparing a version PR locally does not require npm publishing credentials.

## 3 Channels & previews

- **`latest`**: stable releases from `main` via the manually triggered publishing flow in §2.1.
- **`beta`**: prerelease channel via **changesets pre-mode** (`changeset pre enter beta` / `exit`), published under the `beta` dist-tag. Its designated use is the **OrderModuleWeb base-ui adoption period**; the channel exists for any future migration window on the same mechanics. Pre-mode versions never move the `latest` tag.
- **Per-PR previews**: **pkg-pr-new** publishes an installable build of every PR (`npm i https://pkg.pr.new/...`), so consuming apps can trial a change before merge. Preview builds are ephemeral, carry no dist-tag, and are not releases — no changeset, no changelog entry, no provenance claim.

## 4 Licensing constraints on publishing

These facts bound what the published tarball may contain; they are settled, not open questions.

- **Code license: MIT**, matching the entire dependency stack (base-ui, Phosphor, Tailwind ecosystem). The `LICENSE` file and `"license": "MIT"` field ship in the package. Approver of open distribution: **Tommy Barvåg** — recorded here; no further sign-off gate exists.
- **The library never ships font files.** Fonts are app-supplied via the themable `--font-sans`/`--font-heading` tokens; themes reference font-family _names_ only. This keeps Fjordkraft's commercially licensed Neo Sans (and any future licensed font) out of the published package permanently. Any PR adding `woff2`/`ttf`/font binaries to the package is rejected on licensing grounds. There is no `@elmeragroup/fonts` package.
- **Logos ship publicly** in `@elmeragroup/ui/icons` (full decided roster). They are publicly visible marks already served in every brand site's bundles; npm changes discoverability, not exposure. Escalation only if brand/legal objects later.
- **Nothing stays private.** No public/private repo split, no private registry, no CI split.

## 5 Publish-time gates

The release workflow publishes only when all gates pass. The table below is the **single exhaustive publish-gate list**; owning chapters define each check but must link here instead of maintaining competing release lists.

| Gate                                | Asserts                                                                                                                                                           | Owner                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **publint**                         | package.json/exports correctness for the published shape                                                                                                          | [architecture](architecture.md)                    |
| **arethetypeswrong (attw)**         | type resolution across module modes                                                                                                                               | [architecture](architecture.md)                    |
| **exports-map test**                | every codegen'd subpath resolves against the **published** shape (`publishConfig.directory` swap: in-repo `src`, published `dist`)                                | [architecture](architecture.md)                    |
| **emitted-directive parity**        | all and only source modules with a leading `"use client"` retain it in the packed JavaScript graph                                                                | [architecture](architecture.md)                    |
| **packed-asset contract**           | flag filenames/manifest/hashes and license/provenance files match the spec; every flag-bearing phone country resolves locally                                     | [architecture](architecture.md), [icons](icons.md) |
| **size-limit budgets**              | every JS-entry, built-CSS, and aggregate raw-flag ceiling in the budget table holds against the packed artifact                                                   | [performance](performance.md)                      |
| **theme-contract test**             | the 20-theme token contract holds in the built CSS                                                                                                                | [tooling](tooling.md)                              |
| **packed fixture: Next App Router** | the `pnpm pack` tarball installs and builds in a Next App Router app (Tailwind-source mode, RSC boundaries: server page + client island); flag SVG assets resolve | [tooling](tooling.md)                              |
| **packed fixture: Vite**            | the `pnpm pack` tarball installs and builds in a Vite app (standalone-CSS mode); flag SVG assets resolve                                                          | [tooling](tooling.md)                              |

The full merge gate (lint, types, unit/browser tests, changeset presence) runs on every PR and is specified in [tooling](tooling.md); the publish gates above additionally run against the built artifact in the release workflow, so a package that installs broken can never reach the registry. Host first-paint proofs (`apps/docs`, `apps/static-theme`) are merge-gate adapter tests, not rows in this publish-gate table and not substitutes for the packed Next/Vite consumer fixtures.

## 6 Provenance & supply-chain security

- **npm Trusted Publishing (OIDC).** The `@elmeragroup/ui` package is bound to the repo's release workflow as a Trusted Publisher. GitHub Actions authenticates via OIDC per run; **no npm token exists in repository or org secrets** — nothing long-lived to leak or rotate.
- **Provenance**: the release workflow sets `NPM_CONFIG_PROVENANCE: true`, attaching a signed provenance attestation (source repo, commit, workflow) to every published version, verifiable via `npm audit signatures`.
- **2FA is required for all members** of the npm `@elmeragroup` org.
- Publishes will occur **only** from the manually triggered release workflow for a reviewed release commit on `main` (§2.1). The beta channel (§3) publishes through the same workflow in pre-mode — same OIDC identity, same gates.

## 7 Org-setup prerequisites (pending)

The account owner must complete the following before publishing. Track completion in a shared issue with the resulting org/repo URLs, owner accounts, and any deviations.

1. **npm org**: create/claim the `@elmeragroup` org on npmjs.com; Tommy Barvåg as owner; require 2FA for all members.
2. **Name-collision check**: verify `@elmeragroup/ui` (and any future public name) does not collide with the internal private `@elmeragroup/*` package names used in the existing monorepos; record a **reserved-names policy** for future public names.
3. **GitHub**: create the public repo in the Elmera GitHub org; enable GitHub Actions.
4. **Trusted Publishing**: configure the npm Trusted Publisher binding for the repo's release workflow (OIDC), set `NPM_CONFIG_PROVENANCE: true` in the workflow; confirm **no npm token in secrets**.
5. **Vercel**: create the docs-site project wired to the repo, PR previews on.
6. **pkg-pr-new**: enable for per-PR preview installs (§3).

Until items 1–4 are done, publishing is blocked. Items 5–6 enable docs previews and per-PR installs; they do not block library development.

## 8 Activate publishing

1. Complete and verify the npm/GitHub prerequisites in §7 items 1–4.
2. Add a manually triggered release workflow with the §5 artifact gates and §6 Trusted Publishing configuration. Require a reviewed release commit on `main`; do not trigger publishing on push or PR merge. Reuse the checked tarball; never publish a separately rebuilt artifact.
3. Verify the workflow and account binding before the first manual publish. A merged release PR prepares the version and changelog but does not publish it.
4. After activation, update this guide's current-state paragraph and the README so contributors can distinguish working release channels from planned ones.

The Effect stable-version follow-up remains in the [roadmap](roadmap.md#12-effect-4-rc--stable).
