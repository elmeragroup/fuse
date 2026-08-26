# Plan 004: Make release and visual-regression readiness claims truthful

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cbf25f..HEAD -- 'apps/docs/src/app/(docs)/releases/page.tsx' 'apps/docs/src/app/(docs)/about/page.tsx' 'apps/docs/src/app/(docs)/handbook/llms-txt/page.tsx' apps/docs/test/readiness-copy.test.ts`
> If any in-scope page changed since this plan was written, compare the "Current state" claims against the live page before proceeding; on a mismatch, treat it as a STOP condition.
>
> **Reference drift check**: `git diff --stat 7cbf25f..HEAD -- .github/workflows/version-packages.yml docs/spec/release.md docs/spec/roadmap.md`. A release/visual-regression implementation landing is a STOP condition, not a reason to paste stale wording.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `7cbf25f`, 2026-08-26

## Why this matters

The public docs describe publishing, installable PR previews, trusted publishing, provenance, packed-consumer gates, and visual-regression testing as operational today. The repository itself says those capabilities are pending or deferred, and the only release workflow currently creates/updates the Version Packages PR. Readers should be able to distinguish the intended release design from infrastructure that is actually available.

## Current state

- `.github/workflows/version-packages.yml` — runs Changesets' version action; it has no npm publish job, OIDC permission, provenance setting, pkg-pr-new step, packed-consumer fixtures, or visual-regression job.
- `docs/spec/release.md` §7 — authoritative readiness note. It says npm package/scope ownership, OIDC Trusted Publishing, org 2FA, Vercel previews, and pkg-pr-new are pending; until items 1–4 are done the workflow cannot publish, and until items 5–6 are done previews are unavailable.
- `docs/spec/roadmap.md:23-29` — explicitly defers visual-regression tooling and baseline management.

The rendered docs contradict those sources:

- `apps/docs/src/app/(docs)/releases/page.tsx:34-35`: **“Merging that PR publishes.”**
- `releases/page.tsx:56-57`: **“every PR gets an installable build”**.
- `releases/page.tsx:91-94`: says the package is already bound as an npm Trusted Publisher and every release carries signed provenance.
- `apps/docs/src/app/(docs)/about/page.tsx:48-53`: says one authored demo feeds a live visual-regression suite.
- `apps/docs/src/app/(docs)/handbook/llms-txt/page.tsx:45-48`: repeats the three-live-consumer claim.

Treat `docs/spec/release.md` and `docs/spec/roadmap.md` as the factual source for this copy-only correction. Do not implement the pending infrastructure in this plan.

## Commands you will need

| Purpose                 | Command                                                                          | Expected on success       |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| Focused readiness tests | `pnpm exec turbo run test --filter=docs --force -- --run readiness-copy.test.ts` | readiness-copy tests pass |
| Full docs tests         | `pnpm exec turbo run test --filter=docs --force`                                 | all docs tests pass       |
| Docs typecheck          | `pnpm exec turbo run type-check --filter=docs --force`                           | exit 0                    |
| Format/lint             | `pnpm format:check && pnpm lint`                                                 | both exit 0               |

## Scope

**In scope** (the only files you should modify):

- `apps/docs/src/app/(docs)/releases/page.tsx`
- `apps/docs/src/app/(docs)/about/page.tsx`
- `apps/docs/src/app/(docs)/handbook/llms-txt/page.tsx`
- `apps/docs/test/readiness-copy.test.ts` (create)
- `plans/README.md` (status row only)

**Reference-only; do not modify**:

- `.github/workflows/version-packages.yml`
- `docs/spec/release.md`
- `docs/spec/roadmap.md`

**Out of scope** (do NOT touch):

- GitHub workflows, npm configuration, organization settings, Vercel, or pkg-pr-new.
- Packed-consumer fixtures or visual-regression infrastructure.
- The designed release stages/gate list; only their readiness framing changes.
- Other docs pages, shared components, or styling.
- A changeset; the docs app is private. Use the `no-changeset` PR label.

## Git workflow

- Branch: `codex/004-truthful-readiness-docs`
- Conventional commit style; use `docs: clarify release infrastructure readiness`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Frame the release page as a target design with explicit current status

In `releases/page.tsx`, keep the useful explanation of changesets, Version Packages PRs, release channels, preview packages, publish gates, and supply-chain goals. Add an early, unmistakable readiness note that says the automated publish and preview infrastructure is not active yet and links/references the pending prerequisites described in the release spec.

Rewrite present-tense operational claims as target-state language. The rendered page must convey these exact facts:

- Changesets currently maintain the Version Packages PR.
- Merging it does **not yet** publish automatically; automated npm publishing is planned after the pending org/repository setup.
- Per-PR installable package previews and docs previews are planned, not available for every PR today.
- Packed-consumer checks are intended publish gates, not an active release workflow.
- Trusted Publishing/OIDC, provenance, and required org 2FA are prerequisites/target controls, not already configured facts.

Do not dilute the target design into uncertainty: distinguish “designed flow” from “current readiness” in headings or lead text, then keep the intended details clearly labeled.

**Verify**: `rg -n 'Merging that PR publishes|every PR gets an installable build|package is bound to its release workflow' 'apps/docs/src/app/(docs)/releases/page.tsx'` → no matches.

### Step 2: Correct visual-regression claims on both overview pages

In `about/page.tsx` and `handbook/llms-txt/page.tsx`, keep the authored-demo pipeline's current consumers (live docs and generated AI/Markdown material) accurate. Describe the demo corpus as **ready to become** input to the planned visual-regression suite, not as feeding a suite today.

Use consistent terms on both pages: “planned visual-regression suite” or equivalent future-tense wording. Do not imply that screenshots, baselines, or a visual-regression publish gate exist.

**Verify**: `rg -n 'feeds three consumers|the visual-regression suite' 'apps/docs/src/app/(docs)/about/page.tsx' 'apps/docs/src/app/(docs)/handbook/llms-txt/page.tsx'` → no unqualified present-tense claims.

### Step 3: Add production-page truthfulness regressions

Create `apps/docs/test/readiness-copy.test.ts`, following `apps/docs/test/handbook.test.ts` and importing `fetchText` from `./docs-server`. Fetch `/releases`, `/about`, and `/handbook/llms-txt` from the built docs app.

Use focused semantic phrases rather than snapshotting whole pages. Tests must assert:

1. `/releases` contains explicit “not active yet” or “pending” release readiness language and target-state language for publishing/previews.
2. `/releases` does not contain the three old unconditional claims quoted in Step 1.
3. `/about` and `/handbook/llms-txt` contain planned/future visual-regression language.
4. Neither page says demos currently feed three live consumers or an unqualified existing visual-regression suite.

Keep each failure message specific enough to tell an editor which readiness distinction was lost. Do not inspect CSS classes or add test IDs.

**Verify**: run the focused readiness-test command → the new file passes against production-rendered HTML. Temporarily restoring an old unconditional sentence should fail its test; revert the temporary change.

### Step 4: Run the full docs gates

Run full docs tests and typecheck, then root format/lint. Review the rendered prose in the test response text for coherent sentences after React HTML serialization; do not add a browser automation dependency.

**Verify**: all four commands in the table exit 0 and `git status --short` lists only Scope files.

## Test plan

- Release page positive: clearly marks automated publishing/previews as pending or inactive.
- Release page negative: old unconditional publish, every-PR-preview, and existing Trusted Publisher claims are absent.
- About/LLM pages positive: visual regression is consistently described as planned/future.
- About/LLM pages negative: no current three-consumer/suite claim remains.
- Tests use built page HTML through the existing `docs-server` helper, matching the repository's docs test convention.

## Done criteria

- [ ] The release page separates designed flow from current readiness.
- [ ] It makes automated publishing, previews, packed release gates, OIDC/provenance, and org setup status accurate.
- [ ] About and LLM handbook pages describe visual regression as planned.
- [ ] Production-page tests lock positive readiness wording and reject old false claims.
- [ ] Full docs tests/typecheck and root lint/format pass.
- [ ] No workflow, spec, infrastructure, or changeset file is modified.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- A publish workflow, pkg-pr-new workflow, packed-consumer fixtures, Trusted Publisher configuration evidence, or visual-regression suite has landed since `7cbf25f`; re-audit actual readiness first.
- `docs/spec/release.md` no longer marks the listed prerequisites pending, or `docs/spec/roadmap.md` no longer defers visual regression.
- Correcting the copy appears to require implementing infrastructure or changing the normative target design.
- The docs route paths have changed or production tests cannot fetch them through the existing helper.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- When each prerequisite lands, update the release page and its positive/negative tests in the same PR, backed by the workflow/config evidence.
- When visual regression lands, update both overview pages together so the authored-demo story remains consistent.
- Reviewers should reject wording that conflates a specified target state with an operational capability.
