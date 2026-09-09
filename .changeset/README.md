# Changesets

User-facing PRs add release notes with `pnpm changeset`. Choose `patch` for fixes, `minor` for compatible additions, or `major` for breaking changes, and describe the change for package consumers. A PR can use one changeset for related changes or several for separate release notes. Internal-only PRs (CI, docs site, tests) use the `no-changeset` GitHub label instead.

Changesets accumulate on `main` across merged PRs. Nothing automatically opens a release PR or publishes to npm.

When ready to prepare a release:

1. Create a release branch from the latest `main` and install dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm exec changeset status` to review the pending release, then `pnpm exec changeset version` to update versions, generate the changelog, and remove the consumed changeset files.
3. Run `pnpm install --lockfile-only` to refresh the lockfile if needed, then `pnpm ci:checks`.
4. Review and commit the version, changelog, consumed changeset deletions, and any lockfile changes. Open a PR with the `no-changeset` label because it consumes release notes rather than adding one.
5. Merge after review and CI pass. This records the release version and changelog; it does not publish to npm.

See the [release runbook](../docs/spec/release.md) for the full procedure and pending publishing setup.
