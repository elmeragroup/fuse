---
id: 014
title: Release & versioning pipeline
type: grilling
status: open
assignee: null
blocked-by: [008]
---

## Question

How is `@elmeragroup/ui` versioned and published to public npmjs.com?

Strong reference pattern (kumo): **changesets** + `changesets/action` (auto "Version Packages" PR → publish on merge) with `NPM_CONFIG_PROVENANCE: true`, `pkg-pr-new` for per-PR preview installs, publint/attw/prepublish test gates.

Decide: changesets vs alternatives, single-version vs independent if multiple packages come out of *Package architecture & build pipeline*, npm org/team setup for the `@elmeragroup` scope on npmjs.com (who owns it — spawn a task ticket for org creation + 2FA/provenance setup), dist-tags & prerelease channels (beta for the OrderModuleWeb base-ui adoption period), changelog generation, and CI provider assumptions (GitHub Actions?into which GitHub org does this repo go — also feeds the task ticket).
