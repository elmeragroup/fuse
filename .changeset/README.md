# Changesets

User-facing PRs add release notes with `pnpm changeset`. Choose `patch` for fixes, `minor` for compatible additions, or `major` for breaking changes, and describe the change for package consumers. A PR can use one changeset for related changes or several for separate release notes. Internal-only PRs (CI, docs site, tests) use the `no-changeset` GitHub label instead.

Changesets accumulate on `main` across merged PRs. Once publishing is activated, each push publishes a canary and, while changesets are pending, the bot opens or updates the Version Packages PR; merging that PR publishes the stable line. The [release runbook](../scripts/RELEASE.md) owns the details.
