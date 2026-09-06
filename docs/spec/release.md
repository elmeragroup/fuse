# Release runbook

Current state: [version-packages.yml](../../.github/workflows/version-packages.yml) opens and updates a Version Packages PR. It does not publish. The first publish still requires the setup in §7 and a release workflow implementing the gates in §5. Keep the Version Packages PR open until both exist.

Sections 2, 3, and 6 describe the intended publishing flow after activation; they do not claim that publishing or previews are active today.

## 1 Scope & home

- **One public package, one version.** `@elmeragroup/ui` is a single package (see [architecture](architecture.md)); `/theme`, `/icons`, `/illustrations`, per-component subpaths, and the CSS entries are exports of it. There is no independent-versioning question — no cross-package skew is possible. `tooling/*` packages are internal and are **not** published by this pipeline.
- **Home**: a **public repository in the existing Elmera GitHub org**. CI is **GitHub Actions**. Publishes go to **public npmjs.com** under the `@elmeragroup` org, with the maintainer (Tommy Barvåg) as npm org owner — he holds the open-distribution authority (§4).
- Versioning follows **semver**; the changelog is generated from changesets (§2), never hand-edited.

## 2 Versioning & publish workflow (changesets)

Versioning uses Changesets and `changesets/action`. The Version Packages PR step is active; publishing and preview steps require activation.

1. **Changeset per user-facing PR.** Every PR that changes published behavior (API, styles, tokens, types, docs strings shipped in the package) includes a changeset file declaring bump level (`patch`/`minor`/`major`) and a human-readable summary. Internal-only PRs (CI, docs site, tests) carry the `no-changeset` label instead. Presence is enforced in the merge gate (see [tooling](tooling.md)): a PR fails without a changeset unless it is labeled `no-changeset`.
2. **Version-Packages PR.** `changesets/action` maintains a bot-owned "Version Packages" PR on `main` that accumulates pending changesets, bumps `package.json`, and writes `CHANGELOG.md` entries from the changeset summaries.
3. **Publish on merge.** Merging the Version-Packages PR triggers the release workflow, which builds, runs the publish gates (§5), and publishes to npm. **Publishing happens only from this workflow** — never from a developer machine; local `npm publish` is unauthorized by construction because no token exists (§6).
4. Git tags and GitHub Releases are created by the action per published version.

## 3 Channels & previews

- **`latest`**: stable releases from `main` via the §2 flow.
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
- Publishes occur **only** from the release workflow on `main` (§2.3). The beta channel (§3) publishes through the same workflow in pre-mode — same OIDC identity, same gates.

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
2. Add a release workflow with the §5 artifact gates and §6 Trusted Publishing configuration. Reuse the checked tarball; never publish a separately rebuilt artifact.
3. Verify the workflow and account binding before merging the bot-owned Version Packages PR. The existing version workflow alone cannot publish a release.
4. After activation, update this guide's current-state paragraph and the README so contributors can distinguish working release channels from planned ones.

The Effect stable-version follow-up remains in the [roadmap](roadmap.md#12-effect-4-rc--stable).
