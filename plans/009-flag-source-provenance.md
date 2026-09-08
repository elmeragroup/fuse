# Plan 009: Verify the pinned flag checkout before copying assets

> **Executor instructions**: Read this file fully, follow the steps in order, and run every verification gate. A failing test is expected only in Step 2 (characterization). Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/scripts/flag-assets.ts' 'packages/ui/src/flag-source.test.ts' 'docs/reference-sources.md' 'plans/README.md'`. If any in-scope file changed, compare the "Current state" excerpts with the live files before proceeding; on a mismatch, treat it as a STOP condition. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `f14057be`, 2026-09-08 (reviewed and tightened 2026-09-08 against the same commit)
- **Audit finding**: 9
- **Status**: TODO

## Why this matters

`vendorFlags` copies whatever is in `.ref/flag-icons/svg` and then writes a `PROVENANCE.md` that attributes the copy to a fixed commit, `FLAG_SOURCE_COMMIT`. Nothing checks that the checkout is actually at that commit or that its SVGs and LICENSE are unmodified. A stale, advanced, or locally edited reference checkout therefore produces shipped assets with false provenance and a misleading license notice. After this plan, regeneration refuses an unverified checkout before it creates or modifies anything under `packages/ui/src/flags/`.

## Current state

All paths are relative to the repo root `/Users/tommy.lunde.barvag/src/work/elmera/ui`.

- `packages/ui/scripts/flag-assets.ts` — flag generator helpers plus `vendorFlags` (the copy step). This is the only implementation file that changes.
- `packages/ui/scripts/generate-flags.ts` — 7-line CLI wrapper; calls `vendorFlags(join(packageRoot, "../.."), packageRoot)`. Read-only for this plan.
- `packages/ui/scripts/flag-payload.ts` — `FLAG_SVG_COUNT = 249`, `FLAG_RAW_CEILING_BYTES = 800 * 1024`. Read-only.
- `packages/ui/src/flags.test.ts` — existing unit tests for the helpers; the structural exemplar for the new test file. Read-only.
- `packages/ui/src/flags/PROVENANCE.md` — generated; its `Commit:` line currently equals the pin below. Do not edit or regenerate.
- `docs/reference-sources.md` — table of pinned `.ref/` checkouts; gets a short recovery note.

`packages/ui/scripts/flag-assets.ts:15-16`:

```ts
const FLAG_SOURCE_COMMIT = "a3d5adcf4fe650536d7694ca6d93c607ebf16c4e";
const FLAG_SOURCE_REPO = "https://github.com/yammadev/flag-icons";
```

`packages/ui/scripts/flag-assets.ts:142-174` (the function to guard; note `mkdirSync` is the first side effect and runs before any validation):

```ts
export function vendorFlags(repoRoot: string, packageRoot: string): void {
  const sourceDir = join(repoRoot, ".ref/flag-icons/svg");
  const destDir = join(packageRoot, "src/flags");
  mkdirSync(destDir, { recursive: true });

  const files = listFlagFiles(sourceDir);
  const payload = flagPayload(sourceDir, files);
  assertFlagPayload(payload);
  // ... copies each SVG into destDir, collects sha256 lines ...
  copyFileSync(join(repoRoot, ".ref/flag-icons/LICENSE"), join(destDir, "LICENSE"));
  writeFileSync(join(destDir, "PROVENANCE.md"), `... - Commit: \`${FLAG_SOURCE_COMMIT}\` ...`);
  writeFlagManifest(packageRoot);
}
```

Imports at the top of the file today: `createHash` from `node:crypto`; `copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync` from `node:fs`; `join` from `node:path`. There is no `node:child_process` import yet.

`docs/reference-sources.md:9` pins `.ref/flag-icons` to `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e` and line 16 states "References supply code and immutable source artwork only." Line 3 already tells implementers to verify `git -C .ref/<name> rev-parse HEAD` equals the table; this plan automates that check for the flag generator only.

Verified facts at plan time (2026-09-08): `.ref/` is gitignored; the local `.ref/flag-icons` exists, `git -C .ref/flag-icons rev-parse HEAD` prints the pin above, `git -C .ref/flag-icons rev-parse --show-toplevel` prints `/Users/tommy.lunde.barvag/src/work/elmera/ui/.ref/flag-icons`, and `git -C .ref/flag-icons status --porcelain --untracked-files=all -- svg LICENSE` is empty. `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flags.test.ts` passes 9 tests in about 2 s.

Existing test exemplar, `packages/ui/src/flags.test.ts:97-114` — temporary directory, `try/finally` cleanup, explicit 30 s timeout with a one-line reason comment:

```ts
// Timeout: copying + SHA-256 hashing the full flag set twice is slow under full-gate parallel load.
it("fails the PROVENANCE SHA-256 gate when a packed SVG is mutated", () => {
  const hashes = parseProvenanceHashes(readFileSync(join(flagsDir, "PROVENANCE.md"), "utf8"));
  expect(flagHashFailure(flagsDir, files, hashes)).toBeUndefined();

  const scratch = mkdtempSync(join(tmpdir(), "elmera-ui-flag-hash-"));
  try {
    // ...
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}, 30_000);
```

Child-process exemplar, `packages/ui/scripts/build-css.ts:21-35` — every script in `packages/ui/scripts/` uses `spawnSync` with an argument array and checks `.status`; match it (do not introduce `execSync` with a shell string):

```ts
const compiled = spawnSync("pnpm", ["exec", "tailwindcss" /* ... */], { cwd: packageRoot, stdio: "inherit" });
if (compiled.status !== 0) {
  process.exit(compiled.status ?? 1);
}
```

Conventions and constraints that apply:

- TypeScript is `strict` with `noUncheckedIndexedAccess`; `packages/ui/tsconfig.json` includes `scripts/`, so `type-check` covers the script.
- Lint is `oxlint . --deny-warnings`, so every warning fails. Rules that bite here: `anti-slop/no-runtime-typeof` (avoid `typeof x === "string"` style checks), `anti-slop/no-narration-comments` and `anti-slop/no-slop-comments` (comments must state a reason, not narrate the next line), `typescript/restrict-template-expressions` (only strings/numbers in template literals — `spawnSync` output must be a string, so pass `encoding: "utf8"`), `anti-slop/no-object-parameters` (never type a parameter as `object`), `unicorn/filename-case` (kebab-case file names; `flag-source.test.ts` complies).
- Unit tests live under `packages/ui/src/**/*.test.ts`, environment `node`, and run via the `unit` vitest project. Vitest's default per-test timeout is 5 s; add an explicit timeout with a reason comment on tests that spawn git or write hundreds of files, as the exemplar does.
- `packages/ui/src/source-contracts.test.ts:256-266` forbids the literal `.ref/` in non-test files under `packages/ui/src/`. Test files are excluded from that walk and `scripts/` is outside it, so this plan is unaffected as long as no new non-test `src/` module mentions `.ref/`.
- `packages/ui/src/flags.test.ts:135-141` asserts `scripts/flag-assets.ts` does not match `/\nvendorFlags\(/` (no top-level self-invocation). Keep `vendorFlags` a plain exported function.
- Read `docs/component-authoring.md` for general authoring conventions. The accessibility spec is not relevant to this tooling-only change.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. `git --version` must succeed (the new tests spawn git). If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose              | Command                                                                                                  | Expected on success                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts` | Both files listed in the report; all tests pass (after Step 3 and Step 4)         |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                               | Exit 0                                                                            |
| Lint                 | `pnpm lint`                                                                                              | Exit 0, no warnings (needs `pnpm --filter @elmeragroup/ui build` first; see note) |
| Full completion gate | `pnpm ci:checks`                                                                                         | Exit 0                                                                            |

Notes:

- The root `lint` task depends on the UI build (`turbo.json` `//#lint`). Running `pnpm lint` directly without `packages/ui/dist` present can fail on `import/no-cycle` resolution in `apps/static-theme`; run `pnpm --filter @elmeragroup/ui build` first, or rely on `pnpm ci:checks`, which orders it.
- `pnpm ci:checks` fans out to lint, repo-policy tests, type-check, unit tests, browser tests, packed-consumer tests, type tests, build, package check, and size limit. Browser tests need permission to bind a local port and start Chromium; package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result.
- `packages/ui/vitest.config.ts` sets `passWithNoTests: true`, so exit 0 alone is insufficient: confirm `src/flag-source.test.ts` appears in the report with the expected test count.
- None of the gates runs `generate-flags`; the real `.ref/flag-icons` checkout and the committed flag assets must be byte-identical before and after this work. Generated changes are allowed only within Scope; standard ignored build/test outputs are permitted.

## Scope

**In scope, the only files to modify:**

- [packages/ui/scripts/flag-assets.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/flag-assets.ts)
- [packages/ui/src/flag-source.test.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/flag-source.test.ts) (create)
- [docs/reference-sources.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/reference-sources.md)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope, do NOT touch:**

- `packages/ui/scripts/generate-flags.ts` — the CLI keeps calling `vendorFlags(repoRoot, packageRoot)` with two arguments; the new optional third parameter defaults to the production pin.
- `packages/ui/scripts/flag-payload.ts`, `packages/ui/src/flags/**` (SVGs, `LICENSE`, `PROVENANCE.md`, `manifest.ts`), `packages/ui/src/flags.ts`, `packages/ui/src/flags.test.ts`.
- The real `.ref/flag-icons` checkout: do not fetch, checkout, reset, clean, or otherwise modify it, and do not run `generate-flags` against it.
- The pinned commit value, license notices, payload count or ceiling, package exports, dependencies. No new dependency; no new public export from `@elmeragroup/ui`.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/flag-source-provenance` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `chore: verify the pinned flag checkout before copying assets`. Do not commit, push, open a PR, or publish a release unless instructed. No changeset is needed: shipped assets and runtime behavior are unchanged.

## Design

Two additions to `packages/ui/scripts/flag-assets.ts`:

1. `export function assertFlagSourceCheckout(sourceRoot: string, expectedCommit: string): void` — runs git via `spawnSync("git", [...], { cwd: sourceRoot, encoding: "utf8" })` and throws an `Error` naming the failed condition and the expected revision. It never modifies the checkout. Checks, in order:
   - `sourceRoot` exists and is a directory (`existsSync` + `statSync`), else throw `... is missing; clone the pinned reference (see docs/reference-sources.md)`.
   - `git rev-parse --show-toplevel` exits 0 and its trimmed output, after `realpathSync`, equals `realpathSync(sourceRoot)`. This is what stops a missing or non-repo `.ref/flag-icons` from silently resolving to the parent `ui` repository (git walks upward to find `.git`). `realpathSync` on both sides is required: on macOS `tmpdir()` is `/var/folders/...`, a symlink to `/private/var/...`, and git prints the resolved path.
   - `git rev-parse HEAD` trimmed output equals `expectedCommit`.
   - `git status --porcelain --untracked-files=all -- svg LICENSE` output is empty. The pathspecs are relative to `cwd`, which is why `cwd: sourceRoot` is mandatory. This rejects staged, unstaged, and untracked changes under `svg/` and to `LICENSE`, while ignoring unrelated edits (README, `package.json`) in the reference checkout.
   - Any git invocation with non-zero `status` (or `error` set, e.g. git not installed) throws with the stderr text included.
2. `vendorFlags(repoRoot, packageRoot, expectedCommit = FLAG_SOURCE_COMMIT)` — calls `assertFlagSourceCheckout(join(repoRoot, ".ref/flag-icons"), expectedCommit)` as its first statement, before `mkdirSync(destDir, ...)`, and writes `expectedCommit` (not the constant directly) into the `Commit:` line of `PROVENANCE.md`. The third parameter exists only so tests can run the full success path against a temporary repository whose HEAD can never equal the production pin; `generate-flags.ts` keeps passing two arguments and therefore uses the production pin.

Everything after the guard (`listFlagFiles`, `flagPayload`, `assertFlagPayload`, copies, hashes, manifest) stays as is.

## Steps

### Step 1: Check the baseline and scope

Confirm tool versions, record the worktree status, run the drift check, and read `packages/ui/scripts/flag-assets.ts`, `packages/ui/scripts/generate-flags.ts`, and `packages/ui/src/flags.test.ts` in full. Confirm the "Current state" excerpts match.

**Verify**: `git rev-parse --short HEAD && git status --short`, then `git diff --stat f14057be..HEAD -- 'packages/ui/scripts/flag-assets.ts' 'packages/ui/src/flag-source.test.ts' 'docs/reference-sources.md' 'plans/README.md'`, then `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flags.test.ts`.

**Expected**: HEAD is `f14057be`, or later commits leave the excerpts applicable; pre-existing changes are recorded and untouched; the existing flags tests pass (9 tests at plan time).

### Step 2: Characterize the missing guard through `vendorFlags`

Create `packages/ui/src/flag-source.test.ts`. In this step import only `vendorFlags` from `../scripts/flag-assets` (the helper from Step 3 does not exist yet; importing it here would make the whole file fail to load rather than fail the intended assertion).

Write a fixture builder used by every test in the file: `makeFixture()` creates `mkdtempSync(join(tmpdir(), "elmera-ui-flag-source-"))` containing `repoRoot/.ref/flag-icons/` (a fresh git repository) with `svg/` holding exactly 249 files named `AA.svg`, `AB.svg`, ... (two uppercase letters, a few bytes each, e.g. `<svg xmlns="http://www.w3.org/2000/svg"/>`), a `LICENSE` file, and one unrelated `README.md`; commit everything; and create `packageRoot/` as a sibling directory. Payload validation then passes (249 files, far under 800 KiB), so the only thing that can fail is the guard under test. Return the paths plus the fixture's HEAD SHA (from `git rev-parse HEAD`). Clean up with `rmSync(root, { recursive: true, force: true })` in `finally`.

Run git in fixtures as `spawnSync("git", args, { cwd, encoding: "utf8" })` with a fixed identity and no signing, so the developer's global git config cannot interfere: `["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "init", "-q"]`, `[..., "add", "-A"]`, `[..., "commit", "-q", "-m", "fixture"]`. Throw if any `status !== 0`.

Add the first regression: `vendorFlags(repoRoot, packageRoot)` (two arguments, production pin) against a clean fixture must throw an error mentioning the expected revision `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e`, and afterwards `existsSync(join(packageRoot, "src/flags"))` must be `false`. Add a variant where `packageRoot/src/flags/sentinel.txt` already exists with known content; after the throw the sentinel content must be unchanged and no `PROVENANCE.md` may exist. Give both tests a 30 s timeout with a reason comment, matching the exemplar.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts`.

**Expected**: `src/flags.test.ts` passes. In `src/flag-source.test.ts` both new tests fail because `vendorFlags` currently does not throw: it creates `src/flags`, copies the fixture SVGs, and writes `PROVENANCE.md` attributing them to the production pin (the false-provenance bug). Any other failure (fixture build error, payload error, git error) means the fixture is wrong; fix the fixture before continuing.

### Step 3: Add the guard and call it before the first write

Implement `assertFlagSourceCheckout` and the `vendorFlags` change exactly as described in "Design". Add `spawnSync` from `node:child_process` and `realpathSync` from `node:fs` to the imports. Suggested error messages (each must include the failed condition; the revision-related ones must include `expectedCommit`):

- `Flag source ${sourceRoot} is missing; clone the pinned reference described in docs/reference-sources.md`
- `Flag source ${sourceRoot} is not the root of a Git checkout (git resolved ${toplevel})`
- `Flag source is at ${head}, expected ${expectedCommit}; check out the pinned commit before regenerating`
- `Flag source has local changes under svg/ or LICENSE; restore the checkout before regenerating:\n${porcelainOutput}`
- `git ${args.join(" ")} failed in ${sourceRoot}: ${stderr}`

Do not `process.exit` inside the helper; throw, so tests can assert and the CLI fails with a stack trace as it does for `assertFlagPayload` today.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts`, then `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: All tests in both files pass (the two Step 2 regressions now pass); type-check exits 0.

### Step 4: Cover the helper and the success path

Extend `packages/ui/src/flag-source.test.ts`, now also importing `assertFlagSourceCheckout`. Use the fixture builder and its HEAD SHA as `expectedCommit`. Cases:

Helper-level (`assertFlagSourceCheckout(join(repoRoot, ".ref/flag-icons"), fixtureHead)`):

- clean fixture: does not throw;
- second commit (edit `README.md`, `add -A`, `commit`): throws matching `/expected [0-9a-f]{40}/` and containing the fixture's first SHA as the expected value;
- unstaged edit to `svg/AA.svg`: throws matching `/local changes/`;
- staged edit to `svg/AA.svg` (`git add`): throws matching `/local changes/`;
- edit to `LICENSE`: throws matching `/local changes/`;
- untracked `svg/ZZ.svg`: throws matching `/local changes/`;
- unrelated unstaged edit to `README.md`: does not throw;
- `sourceRoot` pointing at a directory that is not a git repository but whose parent is one (e.g. `join(repoRoot, ".ref/flag-icons/svg")` — git resolves to the fixture repo's toplevel): throws matching `/not the root of a Git checkout/`;
- `sourceRoot` that does not exist: throws matching `/is missing/`.

`vendorFlags`-level with the injected pin:

- `vendorFlags(repoRoot, packageRoot, fixtureHead)` on a clean fixture succeeds; `packageRoot/src/flags` then contains 249 SVGs, `LICENSE`, `PROVENANCE.md` whose `Commit:` line contains `fixtureHead`, and `manifest.ts`;
- `vendorFlags(repoRoot, packageRoot, fixtureHead)` after an unstaged `svg/AA.svg` edit throws matching `/local changes/` and leaves `packageRoot/src/flags` absent.

Group the cases so the fixture is built once per `describe` where practical (`beforeAll`/`afterAll`, or one `it` with several assertions) — each fixture commits 250 files, and the whole file should stay well under a minute. Keep the 30 s timeout with a reason comment on any test that spawns git.

Then edit `docs/reference-sources.md`: after the table paragraph ending "...or the packed artifact." (line 16), add a short subsection, for example `## Regenerating flags`, stating that `generate-flags` refuses to run unless `.ref/flag-icons` is a Git checkout at the table's commit with no local changes under `svg/` or to `LICENSE`; that the generator never modifies the checkout; and that recovery is manual: inspect with `git -C .ref/flag-icons status --porcelain` and `git -C .ref/flag-icons diff`, then restore with `git -C .ref/flag-icons checkout --detach <commit from the table>` (and `git -C .ref/flag-icons restore .` or `git -C .ref/flag-icons clean -n` reviewed by a human) before rerunning generation. Three to six sentences; keep the existing table and paragraphs unchanged.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts`, then `git -C .ref/flag-icons status --porcelain` and `git status --short -- packages/ui/src/flags`.

**Expected**: All cases pass; the report lists `src/flag-source.test.ts` with at least 12 tests and `src/flags.test.ts` with 9. Both status commands print nothing (real reference checkout and committed flag assets untouched).

### Step 5: Complete verification and handoff

Run the completion gates. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the Step 1 baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts` → all targeted tests pass; both files listed; no unhandled errors.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

**Verify**: `pnpm --filter @elmeragroup/ui build && pnpm lint` → exit 0, no warnings.

**Verify**: `pnpm ci:checks` → exit 0, including format, lint, repo-policy, type, unit, browser, packed-consumer, build, package-check, and size-limit gates.

**Verify**: `grep -n "assertFlagSourceCheckout\|mkdirSync(destDir" packages/ui/scripts/flag-assets.ts` → the `assertFlagSourceCheckout(` call inside `vendorFlags` appears on a lower line number than `mkdirSync(destDir`.

## Test plan

- New file `packages/ui/src/flag-source.test.ts`, modeled on `packages/ui/src/flags.test.ts` (temporary directories, `try/finally` or `afterAll` cleanup, explicit timeouts with reason comments). Cases are enumerated in Steps 2 and 4: two `vendorFlags` regressions with the production pin (absent destination; pre-existing sentinel), nine helper cases, two `vendorFlags` cases with the injected pin.
- Fixtures use synthetic SVGs and a fixture-local git identity passed via `-c` flags; nothing reads or writes the real `.ref/` or `packages/ui/src/flags/`.
- A helper-only suite is insufficient: the two production-pin `vendorFlags` regressions are what prove the guard runs before destination mutation.
- Existing `packages/ui/src/flags.test.ts` must keep passing unchanged.

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts` runs both files and passes every case.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/flag-source.test.ts src/flags.test.ts`: both files appear in the report; all tests pass; `src/flag-source.test.ts` has at least 12 tests.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: exit 0.
- [ ] `pnpm lint` (after a UI build): exit 0, no warnings.
- [ ] `pnpm ci:checks`: exit 0.
- [ ] `grep -c "assertFlagSourceCheckout" packages/ui/scripts/flag-assets.ts` ≥ 2 (definition plus the call in `vendorFlags`), and the call precedes `mkdirSync(destDir`.
- [ ] `git -C .ref/flag-icons rev-parse HEAD` still prints `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e` and `git -C .ref/flag-icons status --porcelain` is empty.
- [ ] `git status --short -- packages/ui/src/flags packages/ui/scripts/generate-flags.ts packages/ui/scripts/flag-payload.ts` prints nothing.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no new changes outside Scope after accounting for the recorded baseline.
- [ ] Row 009 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report (do not improvise) if:

- The "Current state" excerpts do not match the live code (drift), or `packages/ui/scripts/generate-flags.ts` no longer calls `vendorFlags` with exactly two arguments.
- `git -C .ref/flag-icons rev-parse HEAD` does not print the pin in `docs/reference-sources.md:9`, or the `Commit:` line of `packages/ui/src/flags/PROVENANCE.md` differs from it — the pin and the shipped assets disagree, which is a separate decision, not something to fix here.
- A verification step fails twice after one reasonable repair attempt.
- `git` is unavailable in the execution environment, or a CI gate turns out to require the `.ref/` checkout merely to consume shipped flags (it must not; only regeneration needs it).
- The guard can only be made to pass by falling back to the parent repository's `.git` (the toplevel check is failing on the real checkout for a reason you cannot explain).
- A correct solution appears to require touching an out-of-scope file, a new dependency, or a new public export.
- Do not weaken assertions, skip a gate, suppress an error, add lint-disable comments, or regenerate committed flag assets to make verification pass.

## Maintenance notes

- When intentionally updating the upstream pin: change `FLAG_SOURCE_COMMIT` in `packages/ui/scripts/flag-assets.ts` and the `.ref/flag-icons` row in `docs/reference-sources.md` together, check out that commit in `.ref/flag-icons`, and re-vendor in a separately reviewed asset change (the SHA-256 gate in `flags.test.ts` will fail until the new `PROVENANCE.md` lands with it).
- Reviewer checklist: the guard is the first statement in `vendorFlags`; git is invoked with argument arrays and `cwd: sourceRoot`; both toplevel paths go through `realpathSync`; the third `vendorFlags` parameter has the default `FLAG_SOURCE_COMMIT` and `generate-flags.ts` is untouched; no test touches the real `.ref/` or `src/flags/`.
- The guard checks a snapshot of the checkout; it does not make a concurrently edited checkout atomic. That is acceptable for a developer-run generator.
- Deferred: applying the same checkout verification to the other `.ref/` sources in the table (they are copied by hand, not by a generator), and any automated recovery (`fetch`/`checkout`) of the reference checkout — deliberately out of scope so the tool never mutates a human's working copy.
