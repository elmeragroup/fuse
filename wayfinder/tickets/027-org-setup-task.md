---
id: 027
title: npm & GitHub org setup
type: task
status: open
assignee: null
blocked-by: []
---

## Question

HITL task (human holds the accounts): stand up the publishing infrastructure decided in [Release & versioning pipeline](014-release-pipeline.md). Checklist:

1. **npm**: create/claim the `@elmeragroup` org on npmjs.com; user as owner; require 2FA for all members.
2. **Name-collision check** (from [Package architecture](008-package-architecture.md)): verify `@elmeragroup/ui` (and any future public name) does not collide with internal private `@elmeragroup/*` package names; record the reserved-names policy.
3. **GitHub**: create the public repo in the Elmera GitHub org; enable GitHub Actions.
4. **Trusted publishing**: configure npm Trusted Publisher for the repo's release workflow (OIDC), `NPM_CONFIG_PROVENANCE: true`; no npm token in secrets.
5. **Vercel**: create the docs-site project wired to the repo (per [Docs site & playground](012-docs-and-playground.md)), PR previews on.
6. **pkg-pr-new**: enable for per-PR preview installs.

Resolution records: org/repo URLs, owner accounts, and any deviations. This is execution-prep — it blocks publishing, not the spec; it does not block [Spec assembly](017-spec-assembly.md).
