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

## Slack announcements

The [publish workflow](../.github/workflows/publish-release.yml) announces each publication in
Slack after the publish job succeeds, on the publish and retry paths. A stable release goes to
the channel in the repository variable `SLACK_RELEASES_CHANNEL`, with its `CHANGELOG.md` section
as the notes. A canary goes to `SLACK_CANARY_CHANNEL`, with the merged PR's title and the install
command. Both variables hold channel IDs. The steps are Effect programs in the private
[`@elmeragroup/release-announcement`](../tooling/release-announcement) package:

- [find-release.ts](../tooling/release-announcement/src/find-release.ts) runs in the publish job,
  right after the engine and still inside the `npm-release` concurrency group, and hands the
  release it finds to the `notify` job as the outputs `release-tag` and `release`.
- [announce-release.ts](../tooling/release-announcement/src/announce-release.ts) runs in the
  `notify` job. It reads the notes from git, renders the version's changelog section to Slack
  sections ([release-notes.ts](../tooling/release-announcement/src/release-notes.ts) parses it as
  CommonMark with micromark), checks the channel's history and posts.

Release text is posted verbatim, so an `@here`, `@channel` or `@everyone` in a changelog or PR title
notifies no one. Only a bounded prefix of the changelog is read from git, and the version's section
runs from its `## <version>` heading to the next one, read as CommonMark. Notes are rendered in a
child process under a time limit ([isolated-notes.ts](../tooling/release-announcement/src/isolated-notes.ts)
holds the limits and why). A version whose heading lies past what is read, or whose notes could not
be read or rendered in time, is announced with its header, its links and a link to its notes; notes
the read limit cuts into, or that fill the sections Slack shows, are marked shortened. A stable
announcement links the GitHub release, the npm version and, when its notes are shortened, missing
or not shown, the full notes in the changelog. It has no compare link to the previous stable
release: the release record does not name that release, and telling it from tags or release
listings proved unsafe (TODO.md).

The Slack token and the step's other secrets never reach the code that parses the changelog. The
child process that parses it gets an empty environment, and the step's own process, which holds the
token, does not load the Markdown parser at all (`token-process-imports.test.ts` holds it to that).

`GITHUB_API_URL`, `GITHUB_SERVER_URL` and `SLACK_API_URL` are parsed once when a step starts, and a
value that is not an https URL (or plain http to a loopback stand-in) without credentials, query or
fragment fails the step before any request. Every request and link URL is built under them so that
neither a setting nor a record tag can send the token outside the API path
([addresses.ts](../tooling/release-announcement/src/addresses.ts) holds the rules).

A run announces only the release it published. The lookup's candidates are the commit's canary
record and, for a version commit, its stable record; a retry looks up only its record tag. A
skipped or superseded canary posts nothing, and `notify` does not run. If the lookup fails, its
step fails with an error annotation, the publication stands, and the release is not announced.

Slack itself records which releases are announced. Each post carries message metadata with the event
type `fuse_release_announced` and the record tag. Before posting, `notify` reads the channel's
history from an hour before the release was published and skips the post when it finds that event
for the tag. So re-running `notify`, or the whole workflow, does not post twice. `notify` runs one
job at a time per record tag, so a publication's announcement and a retry's for the same record
cannot both post. If the history check fails, for example with `not_in_channel` or `missing_scope`,
or the channel holds more than 2,000 messages since the publication, `notify` fails without posting,
as it does when Slack says more history follows but gives no cursor. On a free Slack plan past its
history limit, Slack hides older messages and marks the history `is_limited`; unless a visible
message carries the receipt, `notify` then fails without posting, since the announcement could be
among the hidden messages. Past that limit every history read is marked limited, so a release
that was never announced cannot be posted; announcing needs a workspace whose history is not
limited, which means a paid Slack plan. History reads are retried after a network or server error and after a
rate limit, within bounds [http-retry.ts](../tooling/release-announcement/src/http-retry.ts) sets
and explains. The post is sent once and never retried: a retry after a lost response could repeat a
message Slack had already accepted. If its answer is lost, `notify` fails
and says so; re-run the failed job, which checks the history again and posts only if the first post
did not land. To post an announced release again, delete its message in Slack, then re-run `notify`.

`notify` reads the bot token from the repository secret `SLACK_BOT_TOKEN`, which `merge.yml`
passes to the called workflow by name, and only its announce step receives it. While the secret
is unset, or a channel's variable is, `notify` skips the post with a notice and stays green.

`notify` runs `pnpm install --frozen-lockfile --ignore-scripts --prod --filter
@elmeragroup/release-announcement`: the announcement's runtime dependencies (Effect, its Node
platform package and the micromark parser) and nothing else, without install scripts. So the
token shares a job with installed packages, which an earlier design avoided by building the
message in a job without secrets and posting it from one that installed nothing. That split kept
release-controlled code away from the token, but it needed a shell history check and a third-party
Slack action. A single Effect program has typed errors, bounded history pagination and a post
that is sent exactly once, tested end to end against local stand-ins for Slack and GitHub. What
the token can do, and what the install does and does not contain:

- `chat:write` lets the bot post to the channels it is invited to, and also to any user as a
  direct message by user ID; `channels:history` reads the public channels the bot is in. So code
  that ran in the announce step could post as the bot to those channels and to any person in the
  workspace, and read those channels' history. It could not read other channels or anyone's
  direct messages, or administer the workspace.
- The packages come from the frozen lockfile, so every version is one a reviewed PR pinned, and
  the frozen install holds each to the workspace's `minimumReleaseAge` (`effect@4.0.6`, which the
  workspace already runs, is its listed exception). The production-only, filtered install with
  `--ignore-scripts` cuts the code in the job to the announcement's own dependencies and runs none
  of their install scripts. That reduces exposure; it does not confine the code that does run,
  which can read the step's environment, the token included, while the step runs.
- The publish job already runs every dependency of the workspace while it holds the npm OIDC
  grant, which can publish the package itself.

To set it up, create a Slack app from this manifest and install it to the workspace:

```yaml
display_information:
  name: Fuse Releases
  description: Announces @elmeragroup/fuse releases from GitHub Actions.
features:
  bot_user:
    display_name: Fuse Releases
    always_online: false
oauth_config:
  scopes:
    bot:
      - chat:write
      - channels:history
      # Only if either channel is private:
      # - groups:history
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Store the app's Bot User OAuth Token (`xoxb-…`) as `SLACK_BOT_TOKEN`. Keep token rotation
off, since a rotating token expires after 12 hours. Invite the bot to both channels with
`/invite @Fuse Releases`, because `chat:write` posts, and `channels:history` reads, only in
channels the bot is a member of. Add `groups:history` only if either channel is private. Then set
both variables to the channel IDs from each channel's details.

Slack's 2025 limits for apps that are not in the Slack Marketplace (`conversations.history` at one
request a minute and 15 messages per request) apply only to commercially distributed apps. Slack
states that internal customer-built apps keep their existing limits
([changelog](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/),
[clarification](https://docs.slack.dev/changelog/2025/06/03/rate-limits-clarity/)). Fuse Releases is
built and installed in Elmera's own workspace and is never distributed, so the check reads 200
messages per request under Tier 3 (50+ requests a minute), for at most 10 pages. Do not enable
public distribution for the app. Under the Marketplace limits a page holds 15 messages and
requests wait a minute apart, so a busy channel would hit the page bound or the retry limit, and the
check would fail rather than post blind.

## Authentication and pending work

The publish job authenticates to npm through trusted publishing. It runs in the GitHub
environment `npm`, which only `main` can deploy to, and holds `id-token: write`. npm
exchanges the job's OIDC token for a short-lived publish token. It generates provenance
without a `--provenance` flag for every publication except a retry, which
[Publish gates and recovery](#publish-gates-and-recovery) explains. The job holds no npm token.
Keep the package's publishing access at "Require two-factor authentication and disallow
bypass 2fa tokens". That setting stops every npm token from publishing the package and
leaves trusted publishing working.

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
the `minimumReleaseAge` window in `pnpm-workspace.yaml`.

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
