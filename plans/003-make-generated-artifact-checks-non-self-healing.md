# Plan 003: Make generated-artifact checks observe drift before repair

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cbf25f..HEAD -- apps/docs/package.json apps/docs/test/docs-pipeline.test.ts packages/ui/package.json packages/ui/scripts/build.ts packages/ui/scripts/write-source-exports.ts packages/ui/src/barrel-generation.test.ts docs/spec/architecture.md docs/spec/tooling.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Reference drift check**: `git diff --stat 7cbf25f..HEAD -- apps/docs/turbo.json apps/docs/scripts/generate.ts apps/docs/test/api-artifact.test.ts packages/ui/scripts/generate-exports.ts packages/ui/src/exports-map.test.ts`. Stop if these ownership/comparison mechanisms changed.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7cbf25f`, 2026-08-26

## Why this matters

Two drift checks run only after the command graph has silently rewritten the tracked files they are meant to validate. Docs generation can run twice before tests, erasing the record that stale `api.json` files were repaired; the UI build rewrites `package.json#exports` and `src/index.ts` before their tests compare them. Separating explicit regeneration from validation makes CI fail on stale committed artifacts instead of normalizing them first.

## Current state

### Docs API artifacts

- `apps/docs/turbo.json` correctly declares `build` and `type-check` as depending on the `generate` task; `test` depends on `build`.
- `apps/docs/package.json` also embeds generation in both consumers:

```json
"build": "pnpm run generate && next build",
"type-check": "pnpm run generate && next typegen && tsc --noEmit"
```

That means a Turbo docs build runs `generate`, then the package build runs it again. `apps/docs/scripts/generate.ts:220-236` writes `src/generated/api-drift.ts` with only the slugs rewritten by the current invocation. The second clean invocation replaces the first invocation's non-empty stale list with `[]`.

`apps/docs/test/api-artifact.test.ts:53-57` expects that list to be empty specifically to detect repair-before-test:

```ts
it("was already up to date when the last generation pass ran", () => {
  expect(API_ARTIFACTS_REWRITTEN /* regeneration guidance */).toEqual([]);
});
```

### UI source exports

- `packages/ui/scripts/generate-exports.ts` exports `writeSourceExports`, which rewrites tracked `packages/ui/src/index.ts` and `packages/ui/package.json`.
- `packages/ui/scripts/build.ts:7-11` imports and calls it before `tsdown`:

```ts
import { writePublishManifest, writeSourceExports } from "./generate-exports";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
writeSourceExports(packageRoot);
```

- `packages/ui/src/exports-map.test.ts` compares the committed exports map/root barrel with fresh generated values, but root Turbo `test` depends on `@elmeragroup/ui#build`. The build repairs those files first.
- `packages/ui/src/barrel-generation.test.ts` is the focused unit-test home for export generation.

The current normative sentence in `docs/spec/architecture.md:47` says the exports generator runs as part of the build. `docs/spec/tooling.md:121` says adding a source entry is followed by regeneration. Change the former contract so regeneration is explicit while build remains read-only with respect to tracked source files.

Repo constraints:

- `apps/docs/turbo.json` is JSON-with-comments; do not parse it with `JSON.parse` in a test.
- Generated docs under `src/generated/**` are Turbo outputs; per-component `api.json` is committed and reviewable.
- Public publish artifacts under `packages/ui/dist/**` remain build outputs and `writePublishManifest` must still run.

## Commands you will need

| Purpose          | Command                                                                                       | Expected on success                                       |
| ---------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| UI drift tests   | `pnpm --filter @elmeragroup/ui test -- src/barrel-generation.test.ts src/exports-map.test.ts` | both files pass                                           |
| Docs graph test  | `pnpm exec turbo run test --filter=docs --force`                                              | generate runs once before build/test; all docs tests pass |
| UI build         | `pnpm --filter @elmeragroup/ui build`                                                         | exit 0; tracked source export files remain unchanged      |
| UI typecheck     | `pnpm --filter @elmeragroup/ui type-check`                                                    | exit 0                                                    |
| Full merge gates | `pnpm ci:checks`                                                                              | exit 0                                                    |
| Worktree check   | `git status --short`                                                                          | no generated artifact appears outside Scope               |

## Scope

**In scope** (the only files you should modify):

- `apps/docs/package.json`
- `apps/docs/test/docs-pipeline.test.ts` (create)
- `packages/ui/package.json`
- `packages/ui/scripts/build.ts`
- `packages/ui/scripts/write-source-exports.ts` (create)
- `packages/ui/src/barrel-generation.test.ts`
- `docs/spec/architecture.md`
- `docs/spec/tooling.md`
- `plans/README.md` (status row only)

**Reference-only; do not modify**:

- `apps/docs/turbo.json` — already has the authoritative dependencies.
- `apps/docs/scripts/generate.ts` and `apps/docs/test/api-artifact.test.ts` — their one-pass drift signal is correct.
- `packages/ui/scripts/generate-exports.ts` and `packages/ui/src/exports-map.test.ts` — generation and comparison logic is correct.

**Out of scope** (do NOT touch):

- Generated `apps/docs/src/generated/**`, `public/components/**`, `public/llms.txt`, or committed component `api.json` files.
- Generated `packages/ui/src/index.ts` or the existing `package.json#exports` data, except the new script entry in `package.json`.
- Publish-manifest generation in `dist`, tsdown, CSS build, or packaging behavior.
- Turbo cache strategy, dependency versions, or a new generation framework.
- A changeset; this is internal tooling. Use the repository's `no-changeset` PR label.

## Git workflow

- Branch: `codex/003-non-self-healing-artifact-checks`
- Conventional commits; `fix(tooling): expose generated artifact drift` is appropriate.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Make the Turbo docs generation pass authoritative

Edit only the two scripts in `apps/docs/package.json`:

```json
"build": "next build",
"type-check": "next typegen && tsc --noEmit"
```

Keep `dev` self-contained with `pnpm run generate && next dev --port 3000`; direct development is not running under a preceding Turbo generate task. Keep `generate` itself unchanged. Do not change `apps/docs/turbo.json`: its `build`/`type-check` dependencies already make generation authoritative in the task graph.

**Verify**: `pnpm exec turbo run build --filter=docs --force --dry=json` → output contains one `docs#generate` task and one `docs#build` task, with generate ordered before build.

### Step 2: Add a docs pipeline contract test

Create `apps/docs/test/docs-pipeline.test.ts`. Parse `apps/docs/package.json` with `JSON.parse` and read `apps/docs/turbo.json` as text because it contains comments. Assert all of these exact invariants:

- `scripts.build === "next build"`;
- `scripts["type-check"] === "next typegen && tsc --noEmit"`;
- neither script contains `pnpm run generate`;
- `scripts.dev` still contains `pnpm run generate`;
- the Turbo source contains `build` and `type-check` task blocks whose `dependsOn` includes `generate`.

Resolve paths from `import.meta.url`, not `process.cwd()`, so the test works both filtered and through Turbo. Keep assertions focused on this ownership boundary; do not duplicate the entire Turbo config.

**Verify**: `pnpm exec turbo run test --filter=docs --force` → all docs tests pass. In the task output, docs generation runs once; `API_ARTIFACTS_REWRITTEN` stays empty for a clean checkout.

### Step 3: Remove tracked-source repair from the UI build

In `packages/ui/scripts/build.ts`, remove `writeSourceExports` from the import and delete its call. Keep `writePublishManifest(packageRoot)` after the build: it writes the publish-only `dist/package.json` and is not part of the bug.

Create `packages/ui/scripts/write-source-exports.ts` as a minimal explicit entry point. It should resolve the package root from its own `import.meta.url`, import `writeSourceExports` from `./generate-exports`, and call it once. Add this exact package script using the same Node 24 TypeScript flags as the other scripts:

```json
"generate:exports": "node --experimental-strip-types --experimental-transform-types --import ./scripts/ts-resolve.mjs scripts/write-source-exports.ts"
```

Do not add dependencies or modify the generated exports themselves.

**Verify**: record `git diff -- packages/ui/src/index.ts packages/ui/package.json`, run `pnpm --filter @elmeragroup/ui build`, then run the diff again. Expected: the build succeeds and introduces no changes to `src/index.ts` or to `package.json` beyond the manually added `generate:exports` script.

### Step 4: Lock the UI build/generation boundary

Extend `packages/ui/src/barrel-generation.test.ts` with a focused pipeline-contract test. Read `scripts/build.ts`, `scripts/write-source-exports.ts`, and the package manifest using paths based on `import.meta.url`. Assert:

- build source does not mention or call `writeSourceExports`;
- the explicit entry point does call `writeSourceExports`;
- `package.json#scripts["generate:exports"]` invokes `scripts/write-source-exports.ts`;
- build still calls `writePublishManifest`.

Do not replace the existing semantic drift assertions in `exports-map.test.ts`; they are the primary check that will now observe stale tracked files.

**Verify**: run the UI drift-test command from the table → both files pass. Temporarily introducing a stale export in a scratch verification should make `exports-map.test.ts` fail before any build repairs it; revert that temporary change immediately.

### Step 5: Update the normative tooling contract

In `docs/spec/architecture.md`, replace the claim that source exports generation runs as part of build. State that `pnpm --filter @elmeragroup/ui generate:exports` explicitly rewrites tracked source exports, while build discovers entries to produce `dist` but never mutates tracked source files.

In `docs/spec/tooling.md` §6, name the explicit command after adding a source entry, and state that the generated `package.json#exports` and root barrel must be committed. Do not change the publish-artifact or scaffolding contract.

**Verify**: `rg -n 'run as part of the build|generate:exports' docs/spec/architecture.md docs/spec/tooling.md` → no old claim; both chapters name the explicit command where relevant.

### Step 6: Run merge-equivalent validation and inspect mutations

Run `pnpm ci:checks`, then `git status --short`. CI may write ignored build/generated output, but it must not modify or add tracked generated artifacts outside Scope. If any `api.json`, `src/index.ts`, or export-map data changes, stop and report the unexpected drift rather than committing the repair with this plan.

**Verify**: `pnpm ci:checks` exits 0 and `git status --short` contains only Scope files.

## Test plan

- Docs pipeline contract: build/type-check do not nest generation; Turbo remains the owner; dev remains self-contained.
- Existing docs API-artifact tests: a single clean generation pass records no stale slugs.
- UI pipeline contract: build cannot invoke the tracked-source writer; explicit command can; publish manifest still runs.
- Existing UI exports-map tests: committed exports/root barrel equal a fresh in-memory rendering.
- Mutation check: UI build and full merge gates do not change tracked generated artifacts.

## Done criteria

- [ ] Turbo invokes docs generation once before build/test; package build/type-check do not invoke it again.
- [ ] A docs contract test locks that ownership boundary.
- [ ] UI build no longer calls `writeSourceExports` but still writes the publish manifest.
- [ ] `pnpm --filter @elmeragroup/ui generate:exports` is the explicit tracked-source regeneration command.
- [ ] A UI contract test locks the build/generator separation.
- [ ] Architecture/tooling specs describe the new command and non-mutating build.
- [ ] Existing API drift and exports-map tests pass without prior self-repair.
- [ ] Full merge gates pass and no tracked generated artifact outside Scope changes.
- [ ] No changeset is added; `plans/README.md` is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `apps/docs/turbo.json` no longer makes build and type-check depend on generate, or test no longer depends on build.
- The repository requires `pnpm --filter docs build` to be self-contained outside Turbo; that conflicts with single-pass drift detection and needs an explicit architecture decision.
- UI build needs to mutate tracked source exports for a documented consumer that cannot use the explicit command.
- Removing `writeSourceExports` changes the packed `dist/package.json`; `writePublishManifest` should independently own that output.
- A clean full gate changes any committed `api.json`, `packages/ui/src/index.ts`, or export-map entry.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- When adding/removing a public UI entry, run and commit `pnpm --filter @elmeragroup/ui generate:exports` before tests.
- Keep direct docs development self-generating unless the dev workflow is moved under a watch-mode Turbo generator.
- Reviewers should inspect task output for exactly one docs generation pass and verify the UI build diff is source-clean.
- Do not weaken drift tests to accommodate a self-healing pipeline; generation ownership is the invariant this plan establishes.
