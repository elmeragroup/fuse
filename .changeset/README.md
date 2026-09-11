# Changesets

User-facing PRs add release notes with `pnpm changeset`. Choose `patch` for fixes, `minor` for compatible additions, or `major` for breaking changes, and describe the change for package consumers. A PR can use one changeset for related changes or several for separate release notes. Internal-only PRs (CI, docs site, tests) use the `no-changeset` GitHub label instead.

Changesets accumulate on `main` across merged PRs. Nothing automatically opens a release PR or publishes to npm. The five-step release preparation procedure and the pending publishing setup live in the [release runbook](../docs/spec/release.md).
