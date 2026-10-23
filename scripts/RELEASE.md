# Release runbook

`@elmeragroup/fuse` is the only published package. The
[`@elmeragroup/internal` release engine](https://github.com/elmeragroup/internal)
owns eligibility, version allocation, records, archive verification and promotion.
The [CLI](release.ts), [pack adapter](../packages/fuse/scripts/release-pack.ts) and
[workflows](../.github/workflows/) own this repository's integration.

## Activate publishing

Publishing and version-PR creation are disabled until the repository variable
`RELEASE_ENABLED` is `true`. Before enabling it, the account owner must:

1. Require 2FA for all members of the npm `@elmeragroup` organization.
2. Recheck availability of `@elmeragroup/fuse` on public npm and record a reserved-name
   policy that avoids collisions with internal packages. The last check was 2026-09-29.
3. Make this repository public in the Elmera GitHub organization and enable Actions.
   Allow Actions to create and approve pull requests. Require branches to be current
   before merging so an outdated Version Packages PR cannot merge. Enable Dependabot
   alerts and Dependabot security updates.
4. Add the `merge.yml` trusted-publisher entry on npm, as
   [Authentication](#authentication-and-pending-work) describes, then set
   `RELEASE_ENABLED=true`.
5. Verify that the next push to `main` publishes a canary, sets the `canary` dist-tag
   and creates its GitHub release record. Verify `latest` after the first stable release.

Keep publishing enabled while a Version Packages PR is open. Merging that PR while
publishing is disabled consumes the changesets without publishing the version.
Record completed account setup and any deviations in the team's shared tracker.

## Changesets and channels

Add a changeset for published behavior, API, styles, tokens, types or shipped doc
strings. Use patch for fixes, minor for compatible additions and major for breaks.
Internal-only changes use the `no-changeset` PR label. Generate changelogs through
the versioning flow; fix their source notes rather than editing generated history.

Once activated, pushes to `main` publish `x.y.z-canary.N` under `canary`, except
stable version commits and commits already covered by a stable or descendant canary.
A PR whose change leaves the packed package unchanged (Markdown, CI, tests) can carry
the `no-canary` label; its merge publishes nothing, and the next canary carries it.
The label never applies to the bot's Version Packages PR, so a stable bump always publishes.
The engine allocates canaries against the planned changeset version or next patch.
Changesets pre-mode versions such as `-beta.N` are not supported.

While changesets are pending, the bot opens or refreshes `changeset-release/main`
with `pnpm release:version`. The version workflow skips stale source commits and
explicitly dispatches merge checks because its `GITHUB_TOKEN` push does not start them.
The PR records the version/changelog and consumes notes; it publishes nothing itself.

Merging the bot's Version Packages PR publishes the stable version under `latest`.
Wait for the bot to consume every pending note against current `main` before merging.
A stale PR that leaves notes behind fails the stable gate after landing its version
bump; retrying the same commit cannot fix it. Fix release-PR errors on `main` and let
the bot refresh. Manually prepared version bumps are not a stable release path.

Fuse publishes some dependencies at exact versions
([published-dependencies.ts](../packages/fuse/scripts/published-dependencies.ts)), so consumers
receive an upstream security fix only through a Fuse release. A Dependabot security PR for one of
them ships with a patch changeset. If the fixed version is younger than `minimumReleaseAge`, add
it to `minimumReleaseAgeExclude` by exact version in the same PR.

## Publish gates and recovery

Publishing runs only in CI. The
[publish workflow](../.github/workflows/publish-release.yml) calls
`pnpm release publish <commit>` after both merge jobs, checks and browser, pass.
The pack adapter builds with the release identity, packs once, and checks those
exact bytes. [PUBLISH_GATES](../packages/fuse/scripts/release-pack.ts) owns the gate
list; [turbo.json](../turbo.json) owns the merge dependencies. The publish adapter
reruns its Chromium packed-consumer checks. It runs them again against the exact
publish bytes even though the merge browser job has passed.
Local `pnpm ci:checks` includes both browser and packed-consumer tasks; `pnpm check` leaves
the packed-consumer and package checks to CI.

The adapter builds and runs its gates with the publish credentials removed from the
environment ([release-credentials.ts](../packages/fuse/scripts/release-credentials.ts)). These
are the GitHub token and the OIDC request pair, `ACTIONS_ID_TOKEN_REQUEST_URL` and
`ACTIONS_ID_TOKEN_REQUEST_TOKEN`. The engine holds its GitHub token from before packing, and npm
requests its OIDC token only at publication. [Authentication](#authentication-and-pending-work)
describes the gap this leaves.

If publication fails after an archive was recorded, add the `publish-release.yml`
trusted-publisher entry on npm ([Authentication](#authentication-and-pending-work)), then
dispatch **Publish Release** on `main` with the record tag, `v<version>` or
`canary-<full commit SHA>`.
A dispatch from another ref is skipped. Retry restores and verifies the recorded
archive against its source; it never repacks. The workflow uses
`pnpm release retry <record-tag>` for this path.

A retry publishes without provenance. npm names `GITHUB_SHA` as the source commit, and a
dispatch runs at the head of `main`, which can be later than the commit the recorded archive
came from. The workflow sets `NPM_CONFIG_PROVENANCE=false` for the retry command only.

## Authentication and pending work

The publish job authenticates to npm through trusted publishing. It runs in the GitHub
environment `npm`, which only `main` can deploy to, and holds `id-token: write`. npm
exchanges the job's OIDC token for a short-lived publish token. It generates provenance
without a `--provenance` flag for every publication except a retry, which
[Publish gates and recovery](#publish-gates-and-recovery) explains. The job holds no npm token.

For a `workflow_call`, npm checks the calling workflow's filename, not the called file.
`@elmeragroup/fuse` therefore needs one trusted-publisher entry per entry point, each for
repository `elmeragroup/fuse` and environment `npm`:

- `merge.yml` covers every publication from a push to `main`.
- `publish-release.yml` covers a **Publish Release** retry. Add it only when a retry is needed.

npm deletes an entry that has not published within 2 days of its creation, so add each entry
shortly before the run that uses it. Enable "Allow npm dist-tag" and direct publish on each
entry, because the engine publishes under `pending` and then promotes with `npm dist-tag add`.

`npm dist-tag` authenticates over OIDC from npm 11.21.0
([npm/cli#10038](https://github.com/npm/cli/pull/10038)). The npm bundled with
`.node-version` is older, so the [publish workflow](../.github/workflows/publish-release.yml)
installs an exact npm before the engine runs. Raise that pin only to a release older than
the `minimumReleaseAge` window in `pnpm-workspace.yaml`. With the token gone, set the
package's publishing access to "Require two-factor authentication and disallow tokens".

Two gaps remain. Build and publish share a job, so build code can request an OIDC token
during the run. Removing the request pair from the environment stops code that reads its own
environment, but a same-user process can still read any ancestor process's
`/proc/<pid>/environ`. Closing that gap needs a publish job that never builds, which waits on a
prepare-only engine operation. Keeping the original run's provenance on a retry needs an
engine change in `elmeragroup/internal` that records the attestation and passes it back
through `--provenance-file`.

The Next App Router fixture is `packages/fuse/scripts/package-check-next-consumer.ts`
over `packages/fuse/test/packed-consumer/next-app-router/`. It installs the packed
tarball in Tailwind-source mode and checks a server page rendering namespace parts,
a client island and flag SVGs. The Vite fixture is the `phone` scenario of
`packages/fuse/scripts/package-check-flags-consumer.ts`. It builds the packed tarball
in standalone-CSS mode under a non-root base and checks the flag SVGs stay external.
Both run inside the `test:packed-consumer` publish gate. The existing `apps/docs` and
`apps/static-theme` first-paint proofs do not replace these fixtures.

Set up the Vercel docs project with PR previews and enable pkg-pr-new for ephemeral
per-PR installs. These previews have no release dist-tag or provenance claim and
are separate from library development and release activation.

## Distribution constraints

Open distribution is already approved; there is no additional sign-off gate.
The intended distribution is one public repository and public npm package.
Package code is MIT; copied artwork keeps its own notices and licenses, including
CC BY 4.0 Twemoji.
Logos ship publicly. Revisit their distribution if brand or legal owners object.
Fonts remain app-supplied through font-family tokens; never ship font binaries,
including commercially licensed Neo Sans, in this package.
