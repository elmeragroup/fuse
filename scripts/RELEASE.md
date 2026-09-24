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
   policy that avoids collisions with internal packages. The last check was 2026-09-13.
3. Make this repository public in the Elmera GitHub organization and enable Actions.
   Allow Actions to create and approve pull requests. Require branches to be current
   before merging so an outdated Version Packages PR cannot merge.
4. Set the granular, organization-scoped `NPM_TOKEN` repository secret, then set
   `RELEASE_ENABLED=true`. Rotate the token when maintainers change.
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

## Publish gates and recovery

Publishing runs only in CI. The
[publish workflow](../.github/workflows/publish-release.yml) calls
`pnpm release publish <commit>` after the non-browser merge checks pass.
The pack adapter builds with the release identity, packs once, and checks those
exact bytes. [PUBLISH_GATES](../packages/fuse/scripts/release-pack.ts) owns the gate
list; [turbo.json](../turbo.json) owns the merge dependencies. The publish adapter
reruns its Chromium packed-consumer checks. It does not wait on the merge browser job.
Local `pnpm ci:checks` includes both browser and packed-consumer tasks.

If publication fails after an archive was recorded, dispatch **Publish Release**
on `main` with the record tag, `v<version>` or `canary-<full commit SHA>`.
A dispatch from another ref is skipped. Retry restores and verifies the recorded
archive against its source; it never repacks. The workflow uses
`pnpm release retry <record-tag>` for this path.

## Authentication and pending work

The engine currently promotes with `npm dist-tag add`. The tracked
[npm OIDC limitation](https://github.com/npm/cli/issues/8547) is why the pipeline
uses a token. Move to Trusted Publishing once the package exists, the repository
is public and the engine supports OIDC promotion. Configure the trusted publisher
for `publish-release.yml`, request `id-token: write`, enable provenance, then delete
`NPM_TOKEN` and update this runbook.

Pending consumer fixtures are `fixtures/next-app-router`, using the packed tarball
in Tailwind-source mode with a server page and client island, and `fixtures/vite`,
using the tarball in standalone-CSS mode. Both must build and resolve flag SVGs.
Add them to the publish gate when complete. The existing `apps/docs` and
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
