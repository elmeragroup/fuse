# 0011 — Releases run on the `@elmeragroup/internal` engine

Date: 2026-09-13. Status: accepted. Amends [ADR 0010](0010-internal-package-owns-extraction-and-lint.md) — `effect` returns to the catalog.

## Context

Publishing `@elmeragroup/ui` needs orchestration this repository does not have: a durable record of what was published, canary version allocation, archive identity, retry after a partial publish, and a stable gate that rejects a version bump that did not come through the versioning flow. [`@elmeragroup/internal`](https://github.com/elmeragroup/internal) built exactly that engine and bundles it as the `release` export, not as a second published package. Its consumer seam is a `PackAndVerify` adapter: the consumer builds, stamps packed identity, packs, verifies with its own packed-consumer checks, and returns the archive bytes; the engine owns records, eligibility, reservation, and publication.

## Decision

- This repository runs on that engine. `packages/ui` is the one `ReleasePackage`; `scripts/release.ts` resolves it, the [pack adapter](../../packages/ui/scripts/release-pack.ts) owns build → stamp → pack → gates (the adapter writes the release version and `elmeraRelease` identity into the publish manifest after the normal build), and the root scripts `release:version`, `release:run`, and `release:check-pr` are the only entry points (release.md §2).
- **Once publishing is activated, every push to `main` publishes a canary. Stable ships by merging the bot's Version Packages PR.** The merge commit carries the stable bump, so the push publishes the stable line; the engine's stable gate accepts no other path. Several canaries can precede a stable, and holding the PR open is how a maintainer controls the stable cadence.
- `.changeset/config.json` plans against `origin/main` as the engine requires.
- **Authentication is a granular npm token for now, OIDC later.** The engine promotes the checked version with `npm dist-tag add`, which npm's trusted publishing cannot authenticate ([npm/cli#8547](https://github.com/npm/cli/issues/8547)); the token is scoped to the `@elmeragroup` org and the OIDC/provenance pivot is tracked in [roadmap](../spec/roadmap.md) §13. This amends ADR 0010's consequence: `effect` is a catalog entry again because the release scripts import it.

## Consequences

- The repository gains canary publishing and a recorded, retryable publication protocol without maintaining a second publisher.
- [Release](release.md) owns the UI policy: channels, publish gates, authentication, and activation prerequisites.
- Engine behavior — eligibility, canary allocation, stable gating, promotion, recovery — is owned upstream; a needed change is a change request there, not a local fork. The release scripts type-check as part of `ci:checks` (`//#type-check:scripts`).
