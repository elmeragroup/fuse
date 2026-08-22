---
id: 014
title: Release & versioning pipeline
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [008]
---

## Question

How is `@elmeragroup/ui` versioned and published to public npmjs.com?

Strong reference pattern (kumo): **changesets** + `changesets/action` (auto "Version Packages" PR → publish on merge) with `NPM_CONFIG_PROVENANCE: true`, `pkg-pr-new` for per-PR preview installs, publint/attw/prepublish test gates.

Decide: changesets vs alternatives, single-version vs independent if multiple packages come out of _Package architecture & build pipeline_, npm org/team setup for the `@elmeragroup` scope on npmjs.com (who owns it — spawn a task ticket for org creation + 2FA/provenance setup), dist-tags & prerelease channels (beta for the OrderModuleWeb base-ui adoption period), changelog generation, and CI provider assumptions (GitHub Actions?into which GitHub org does this repo go — also feeds the task ticket).

## Resolution

Decided 2026-08-17 via grilling. Single-vs-independent versioning dissolved by [Package architecture](008-package-architecture.md) (single package).

1. **changesets** + `changesets/action` (kumo pattern verbatim): changeset file per user-facing PR, bot-maintained Version-Packages PR, publish on merge, changelog generated from changesets.
2. **Channels**: stable on `latest`; `beta` dist-tag via changesets pre-mode for the OrderModule adoption period; **pkg-pr-new** per-PR installable preview builds.
3. **Auth/supply chain**: npm **Trusted Publishing** (GitHub Actions OIDC, no long-lived token) with `NPM_CONFIG_PROVENANCE: true`; 2FA required for all npm org members; publishes only from the release workflow. Publish gates per [Testing strategy](013-testing-strategy.md) (publint, attw, export-path vs published shape, theme-contract test).
4. **Home**: public repo in the existing **Elmera GitHub org**; CI = GitHub Actions; npm `@elmeragroup` org on npmjs.com with the user as owner (holds distribution authority per [Brand assets & licensing](010-brand-assets-licensing.md)). The public/private **name-collision check** handed over from Package architecture lives in the setup checklist.

Concrete setup work graduated to the HITL task ticket [npm & GitHub org setup](027-org-setup-task.md).
