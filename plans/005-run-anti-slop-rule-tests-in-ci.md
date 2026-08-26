# Plan 005: Run the vendored anti-slop rule tests in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cbf25f..HEAD -- tooling/oxlint-anti-slop/package.json tooling/oxlint-anti-slop/README.md docs/spec/tooling.md`
> If an in-scope file changed since this plan was written, compare the facts below against the live code before proceeding; on a mismatch, treat it as a STOP condition.
>
> **Reference drift check**: `git diff --stat 7cbf25f..HEAD -- tooling/oxlint-anti-slop/rules turbo.json package.json pnpm-lock.yaml`. Stop if the root test graph, dependency lock, or vendored test corpus changed.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7cbf25f`, 2026-08-26

## Why this matters

The repository enforces vendored anti-slop rules during linting, but the package has no `test` script, so Turbo omits all 12 rule-test files from the root test and CI graphs. A broken rule or an incompatible oxlint plugin upgrade can therefore land without exercising the vendored test corpus. Node 24's built-in test runner already executes these self-contained RuleTester files successfully; exposing that command to Turbo closes the gap without another dependency.

## Current state

- `tooling/oxlint-anti-slop/package.json` has no `scripts` field and depends only on `@oxlint/plugins` via the workspace catalog.
- `tooling/oxlint-anti-slop/rules/*.test.ts` contains 12 test modules. Each imports `RuleTester` from `oxlint/plugins-dev`, imports its local rule, and calls `tester.run(...)` at module top level.
- `tooling/oxlint-plugin/package.json` is the neighboring custom-plugin precedent: it declares a package-level `test` script, so Turbo includes it.
- Root `package.json#scripts.test` is `turbo run test`; root `turbo.json#tasks.test` defines the shared task. Turbo runs a workspace's test task only when that workspace declares a `test` script.

The anti-slop manifest currently ends after:

```json
"exports": { ".": "./index.ts" },
"dependencies": { "@oxlint/plugins": "catalog:" }
```

The following exact command was validated at commit `7cbf25f` with Node 24 and exits 0 with `tests 12`, `pass 12`, `fail 0`:

```sh
node --experimental-strip-types --test tooling/oxlint-anti-slop/rules/*.test.ts
```

When run from the package directory, the script form is `node --experimental-strip-types --test rules/*.test.ts`. Do not convert these vendored modules to Vitest solely to make CI discover them.

## Commands you will need

| Purpose         | Command                                                                          | Expected on success                                               |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Package tests   | `pnpm --filter @elmeragroup/oxlint-plugin-anti-slop test`                        | Node reports 12 tests, 12 pass, 0 fail                            |
| Turbo proof     | `pnpm exec turbo run test --filter=@elmeragroup/oxlint-plugin-anti-slop --force` | output includes the anti-slop package's `test` task and it passes |
| Root test graph | `pnpm test`                                                                      | all workspace tests pass, including anti-slop                     |
| Format/lint     | `pnpm format:check && pnpm lint`                                                 | both exit 0                                                       |
| Lockfile check  | `git diff --exit-code -- pnpm-lock.yaml`                                         | exit 0, no lockfile change                                        |

## Scope

**In scope** (the only files you should modify):

- `tooling/oxlint-anti-slop/package.json`
- `tooling/oxlint-anti-slop/README.md`
- `docs/spec/tooling.md`
- `plans/README.md` (status row only)

**Reference-only; do not modify**:

- `tooling/oxlint-anti-slop/rules/*.test.ts` — the existing tests already run successfully.
- `tooling/oxlint-plugin/package.json` — neighboring package pattern.
- Root `package.json`, `turbo.json`, and `pnpm-lock.yaml` — no graph/dependency edit is necessary.

**Out of scope** (do NOT touch):

- Vendored rule source or test cases.
- Upstream refresh, vendored commit SHA, or rule severity configuration.
- Vitest/catalog dependencies or any new package.
- Root Turbo task definitions or CI workflow files.
- A changeset; this private tooling package is not published. Use the `no-changeset` PR label.

## Git workflow

- Branch: `codex/005-test-vendored-anti-slop`
- Conventional commit style; use `test(lint): run anti-slop rule tests in CI`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Expose the validated package test command

Add this scripts block to `tooling/oxlint-anti-slop/package.json`, preserving the manifest's existing fields and catalog dependency:

```json
"scripts": {
  "test": "node --experimental-strip-types --test rules/*.test.ts"
}
```

Do not add `vitest`, `tsx`, `ts-node`, or another runner. Node 24 is the repository's pinned runtime and its type stripping is sufficient for these modules.

**Verify**: `pnpm --filter @elmeragroup/oxlint-plugin-anti-slop test` → exactly 12 files pass and none fail.

### Step 2: Prove Turbo/CI discovery

Run the filtered Turbo command from the table with `--force`. Confirm the output names `@elmeragroup/oxlint-plugin-anti-slop:test`; a successful run of only an unrelated dependency is not sufficient.

Do not edit root `turbo.json`: its generic `test` task already discovers package scripts. Do not edit GitHub Actions: the merge gate already invokes Turbo's aggregate checks, which include the root test graph.

**Verify**: `pnpm exec turbo run test --filter=@elmeragroup/oxlint-plugin-anti-slop --force` → anti-slop test task executes, reports 12 passing files, and exits 0.

### Step 3: Document the maintenance command and CI guarantee

Add a short “Tests” section to `tooling/oxlint-anti-slop/README.md` naming the filtered pnpm command and stating that the root Turbo `test`/CI graph discovers it through the package script.

In `docs/spec/tooling.md` §5.3, state that the 12 vendored RuleTester modules run under Node 24's test runner and are part of the root Turbo test graph. Keep the existing warning never to install the npm name-squat and the manual upstream-refresh policy intact.

**Verify**: `rg -n 'experimental-strip-types|12 vendored|anti-slop.*test' tooling/oxlint-anti-slop/README.md docs/spec/tooling.md` → both locations document the runnable test contract.

### Step 4: Run the root checks and prove no dependency churn

Run `pnpm test`, then format/lint. Because only a script and docs changed, `pnpm-lock.yaml` must be byte-for-byte unchanged.

**Verify**: root tests, format, and lint all exit 0; `git diff --exit-code -- pnpm-lock.yaml` exits 0; `git status --short` lists only Scope files.

## Test plan

- Direct package execution: all 12 existing `*.test.ts` modules execute and pass.
- Turbo discovery: package test task appears explicitly in filtered output.
- Root graph regression: `pnpm test` includes the package and remains green.
- No test-source rewrite is necessary; the existing RuleTester throws/failures propagate through Node's per-file test isolation.
- No dependency/lockfile change is allowed.

## Done criteria

- [ ] The anti-slop package declares the exact validated Node 24 test script.
- [ ] Direct package execution reports 12 pass and 0 fail.
- [ ] Turbo output explicitly runs `@elmeragroup/oxlint-plugin-anti-slop:test`.
- [ ] Root `pnpm test`, format, and lint pass.
- [ ] README and tooling spec document the test/CI contract.
- [ ] Root manifests, Turbo config, vendored source/tests, and lockfile are unchanged.
- [ ] No changeset is added; `plans/README.md` is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Node is no longer pinned to major 24 or does not support `--experimental-strip-types` in the executor environment.
- The direct package command does not report 12 executed files; a zero-test success is a failure of this plan.
- Any RuleTester module fails before the manifest edit; diagnose the pre-existing failure separately rather than changing vendored tests here.
- Turbo does not discover the package script through its existing generic test task.
- A proposed solution requires a new dependency, root task/workflow edit, or lockfile change.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- An upstream refresh must keep the package script green and update the documented test count if files are added or removed.
- Reviewers should check the Turbo log for the named package task, not only the root exit code.
- If Node eventually removes the experimental flag, migrate the runner deliberately in a separate tooling change; do not silently stop executing the tests.
