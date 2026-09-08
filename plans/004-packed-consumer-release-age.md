# Plan 004: Enforce the release-age guard in isolated React consumer installs

> **Executor instructions**: Read this file fully, follow the steps in order, and run every verification gate before moving on. Stop on the conditions in "STOP conditions" instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- packages/ui/scripts/package-check-react.ts packages/ui/scripts/package-check.ts packages/ui/src/package-check-react.test.ts docs/spec/tooling.md pnpm-workspace.yaml .oxlintrc.json`. If any listed file changed, compare the "Current state" excerpts with the live files before proceeding; on a mismatch, treat it as a STOP condition. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f14057be`, 2026-09-08 (reviewed and tightened 2026-09-08 against the same commit)
- **Audit finding**: 4
- **Status**: TODO

## Why this matters

The workspace refuses any dependency version younger than 72 hours (`minimumReleaseAge: 4320` in `pnpm-workspace.yaml`, normative in `docs/spec/tooling.md` §2). The packed React compatibility check, however, runs plain `npm install` in three fresh temporary consumers and then imports and renders the result. Those installs read no pnpm setting, so a freshly published transitive dependency of the tarball can land in the check within minutes of release, on every PR (`package:check` runs in the merge workflow, `.github/workflows/merge.yml:40`). This plan gives those installs the same 72-hour cutoff with npm's own `--before` flag, keeps the installs real (no symlinks, no lockfile), and proves the cutoff with a unit test that never touches the network. No compromised dependency was found; this closes a policy gap.

## Current state

### Files

- [packages/ui/scripts/package-check-react.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts) — the check. Exports `checkPackedReactCompatibility(tarball: string): void`; installs three React pairs into `mkdtempSync` consumers, runs `test/packed-consumer/react-probe.ts` in each, removes each consumer in `finally`.
- [packages/ui/scripts/package-check.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check.ts) — the only caller (`checkPackedReactCompatibility(tarball)` at line 34). Read-only for this plan; the new function signature must keep this call compiling unchanged.
- [packages/ui/src/package-check.test.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/package-check.test.ts) — the existing unit suite for `packages/ui/scripts/*` helpers. The structural exemplar for the new test file.
- [pnpm-workspace.yaml](/Users/tommy.lunde.barvag/src/work/elmera/ui/pnpm-workspace.yaml) — `minimumReleaseAge: 4320` plus `minimumReleaseAgeExclude` naming `effect@4.0.0-rc.111` and `"@elmeragroup/internal@0.1.1-canary.1"`. Read-only.
- [docs/spec/tooling.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/tooling.md) — §2 "Package manager & supply chain", line 29 is the "Release-age guard" bullet to amend.

### Excerpts

[packages/ui/scripts/package-check-react.ts:22-48](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts:22):

```ts
/** Install the tarball with real peer pairs, without workspace symlinks or aliases. */
export function checkPackedReactCompatibility(tarball: string): void {
  const pairs: ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  for (const pair of pairs) {
    const consumer = mkdtempSync(join(tmpdir(), "elmera-packed-react-"));
    try {
      writeFileSync(join(consumer, "package.json"), JSON.stringify({ /* file:<tarball>, react, react-dom */ }));
      const install = spawnSync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"],
        { cwd: consumer, encoding: "utf8", timeout: 180_000 }
      );
```

[packages/ui/scripts/package-check-react.ts:49-68](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts:49): a non-zero install status throws `Packed React <version> install failed:` with stderr/stdout; otherwise the probe is copied in and run with `spawnSync(process.execPath, ["probe.ts", pair.react, pair.reactDom], { cwd: consumer, encoding: "utf8", timeout: 30_000 })`; the `finally` block runs `rmSync(consumer, { recursive: true, force: true })`.

[pnpm-workspace.yaml:134-139](/Users/tommy.lunde.barvag/src/work/elmera/ui/pnpm-workspace.yaml:134):

```yaml
minimumReleaseAge: 4320

minimumReleaseAgeExclude:
  - effect@4.0.0-rc.111
  # Canary line of the in-house tooling package; each bump names the exact version (tooling.md §2).
  - "@elmeragroup/internal@0.1.1-canary.1"
```

[docs/spec/tooling.md:29](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/tooling.md:29):

```md
- **Release-age guard**: `minimumReleaseAge: 4320` (72 hours) in pnpm settings — no package version installs until it has been on the registry for three days. The refs' `overrides` block carries any forced resolutions; additions to it require a PR comment stating why.
```

Neither exclusion matters to the consumers: `@elmeragroup/ui` declares no dependency on `effect` or `@elmeragroup/internal` (see `dependencies` in [packages/ui/package.json](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/package.json)), so the npm cutoff needs no exclusion list.

### What npm `--before` does

From the npm CLI config reference (https://docs.npmjs.com/cli/v11/using-npm/config/#before): "If passed to `npm install`, will rebuild the npm tree such that only versions that were available on or before the given date are installed. If there are no versions available for the current set of dependencies, the command will error." It filters the whole tree, transitive dependencies included. A dist-tag request that fails the filter falls back to the newest passing version; this check requests exact React versions and a `file:` tarball, so no fallback applies. An exact version younger than the cutoff makes npm exit non-zero, which the existing `install.status !== 0` branch already reports. The flag exists in every npm bundled with Node 24 (local: npm 11.6.2); do not use `--min-release-age`, which is newer and unnecessary here.

### Conventions that apply

- **No module mocking, anywhere.** `.oxlintrc.json` sets `"anti-slop/no-module-mocking": "error"` with no test override, and tooling.md §5.3 says "`vi.mock` has no place in this library." To keep the unit test offline, inject the spawn function as a parameter with a default of `spawnSync` (see Step 3). Do not `vi.mock("node:child_process")`.
- **Tests assert behaviour, not source spelling** ([ADR 0008](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/adr/0008-tests-assert-behaviour-not-source-spelling.md)). Assert the arguments the builder returns and the calls the injected spawn receives; never `readFileSync` the script and grep for `--before`. Reading `pnpm-workspace.yaml` in a gate suite is explicitly allowed by that ADR ("gate suites that read `package.json`, the workspace catalog…").
- **Script tests live in the ui `unit` project**, `packages/ui/src/*.test.ts`, importing from `../scripts/…` — exemplar: [packages/ui/src/package-check.test.ts:1-20](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/package-check.test.ts:1) (imports `../scripts/package-check-lib`, `../scripts/tarball`; `mkdtempSync` scratch dirs collected and removed in `afterEach`). The root `test/` project is for repo-policy shape tests and is not used by this plan.
- **Reading the workspace file from a ui test** — exemplar: [test/internal-package.test.mjs:12-17](/Users/tommy.lunde.barvag/src/work/elmera/ui/test/internal-package.test.mjs:12) matches a line with an anchored regex (`/^  "@elmeragroup\/internal": (\S+)$/m`) and throws if absent. Use the same shape for `/^minimumReleaseAge: (\d+)$/m`. `yaml` is not a `packages/ui` devDependency; do not add it.
- **Scripts locate the package root with `packageRootFromScript(import.meta.url)`** (`elmera/restrict-package-root-from-script` is `error` under `packages/ui/scripts/**`). Tests may use `join(dirname(fileURLToPath(import.meta.url)), "..")` as `package-check.test.ts` does.
- Lint is strict and type-aware: `typescript/consistent-type-imports` (use `import type` for type-only imports), `anti-slop/no-unknown-parameters`, `anti-slop/require-safety-comment-for-type-assertion` (a `// SAFETY:` comment on the line above any `as` cast), `anti-slop/no-slop-comments` (no banner or TODO comments). `pnpm lint` runs with `--deny-warnings`.
- Formatting is `oxfmt`; `pnpm ci:checks` starts with `oxfmt --check`. Run `pnpm exec oxfmt <the files you changed>` on in-scope files only before the completion gate.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`. `node --version` must satisfy `>=24.13.0 <25` (`.node-version` is `24.13.0`); `pnpm --version` must print `11.20.0`. If `node_modules` is missing, stop and report instead of installing.

| Purpose              | Command                                                                                                                    | Expected on success                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/package-check-react.test.ts`                             | Report names `src/package-check-react.test.ts`; all cases pass; count > 0                                    |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                                                 | Exit 0                                                                                                       |
| Lint                 | `pnpm lint`                                                                                                                | Exit 0, no warnings (needs `packages/ui/dist`; run the build first if it fails on a missing `dist/theme.js`) |
| Format check         | `pnpm exec oxfmt --check`                                                                                                  | Exit 0                                                                                                       |
| Packed verification  | `pnpm --filter @elmeragroup/ui build && pnpm --filter @elmeragroup/ui pack && pnpm --filter @elmeragroup/ui package:check` | Exit 0; three JSON probe lines then `package:check passed`                                                   |
| Full completion gate | `pnpm ci:checks`                                                                                                           | Exit 0                                                                                                       |

The ui Vitest config sets `passWithNoTests: true`, so exit 0 alone proves nothing: confirm the targeted run lists `src/package-check-react.test.ts` with the case count you wrote. The packed verification and `pnpm ci:checks` need registry access and (for `ci:checks`) permission to start Chromium and bind a port; a sandbox or network failure is a blocker to report, not a pass. Builds may regenerate ignored outputs (`dist/`, `.artifacts/`, `.turbo/`); stop if any tracked file outside Scope changes.

## Scope

**In scope, the only files to create or modify:**

- [packages/ui/scripts/package-check-react.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts)
- [packages/ui/scripts/packed-consumer-install-policy.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/packed-consumer-install-policy.ts) (create)
- [packages/ui/src/package-check-react.test.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/package-check-react.test.ts) (create)
- [docs/spec/tooling.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/tooling.md) (one bullet in §2)

Also permitted: this plan's own row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans.

**Out of scope, do not touch:**

- `packages/ui/scripts/package-check.ts` — the caller keeps calling `checkPackedReactCompatibility(tarball)` with one argument; the new parameters are optional.
- `packages/ui/test/packed-consumer/react-probe.ts`, the React version matrix (`19.0.0`, `19.1.1`, installed), the published dependency ranges in `packages/ui/scripts/entries.ts`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc` or any global npm config, `.oxlintrc.json`, `turbo.json`, `.github/workflows/*`.
- Replacing the real `npm install` with symlinks or `linkConsumerModules`, dropping `--ignore-scripts`, adding a lockfile, adding an npm exclusion list, or adding a dependency (`yaml` or otherwise) to any manifest.
- No runtime library change under `packages/ui/src` other than the new test file, and no changeset (this is tooling; the merge workflow's changeset stage is handled by the operator with the `no-changeset` label if needed).

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator; for isolated execution use branch `codex/packed-consumer-release-age` from a checkout that contains this plan. Do not switch or reset another agent's working directory or overwrite pre-existing changes.

Conventional commit messages, matching `git log` (`refactor: simplify runtime state and strengthen regression tests`, `chore: simplify repository docs and component authoring`). Suggested: `chore: enforce the release-age guard in isolated React consumer installs`. Do not commit, push, open a PR, or publish unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm tool versions, record `git status --short`, run the drift check, and read `packages/ui/scripts/package-check-react.ts`, `packages/ui/scripts/package-check.ts`, and `packages/ui/src/package-check.test.ts` in full.

**Verify**: `git rev-parse --short HEAD && git status --short && git diff --stat f14057be..HEAD -- packages/ui/scripts/package-check-react.ts packages/ui/scripts/package-check.ts packages/ui/src/package-check-react.test.ts docs/spec/tooling.md pnpm-workspace.yaml .oxlintrc.json`

**Expected**: HEAD is `f14057be`, or later commits leave the excerpts above accurate. The diff is empty or reviewed. Pre-existing changes are recorded and untouched.

### Step 2: Add the pure install policy module

Create `packages/ui/scripts/packed-consumer-install-policy.ts` with three exports and no I/O:

```ts
/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml (tooling.md §2). */
export const RELEASE_AGE_MINUTES = 4320;

/** UTC ISO instant exactly RELEASE_AGE_MINUTES before `now`, for npm's `--before`. */
export function releaseAgeCutoff(now: Date): string {
  return new Date(now.getTime() - RELEASE_AGE_MINUTES * 60_000).toISOString();
}

/** Arguments for `npm <args>` in a packed consumer: the existing flags plus the absolute cutoff. */
export function npmInstallArgs(cutoff: string): string[] {
  return [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    `--before=${cutoff}`,
  ];
}
```

Then create `packages/ui/src/package-check-react.test.ts` (model the header and scratch-dir handling on `packages/ui/src/package-check.test.ts`) with these cases against the policy module:

1. `RELEASE_AGE_MINUTES` equals the number captured by `/^minimumReleaseAge: (\d+)$/m` from `readFileSync(join(packageRoot, "../../pnpm-workspace.yaml"), "utf8")`; throw a clear error if the line is absent.
2. `releaseAgeCutoff(new Date("2026-09-08T12:00:00.000Z"))` is `"2026-09-05T12:00:00.000Z"`.
3. A date-boundary case: `releaseAgeCutoff(new Date("2026-03-02T01:30:00.000Z"))` is `"2026-02-27T01:30:00.000Z"` (crosses a month boundary; 2026 is not a leap year).
4. `npmInstallArgs("2026-09-05T12:00:00.000Z")` contains `--ignore-scripts`, `--no-audit`, `--no-fund`, `--package-lock=false`, and `--before=2026-09-05T12:00:00.000Z`, and starts with `install`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/package-check-react.test.ts`

**Expected**: the report lists `src/package-check-react.test.ts` with 4 passing cases; no network access.

### Step 3: Inject the spawn boundary and use one cutoff for all three consumers

In `packages/ui/scripts/package-check-react.ts`:

1. Import `npmInstallArgs` and `releaseAgeCutoff` from `./packed-consumer-install-policy`.
2. Define a type for the injectable spawn that matches how the script already calls `spawnSync`, for example `type Spawn = (command: string, args: readonly string[], options: { cwd: string; encoding: "utf8"; timeout: number }) => { status: number | null; stdout: string; stderr: string }` (use `import type { SpawnSyncReturns } from "node:child_process"` only if it stays assignable; the plain structural type above is acceptable). Keep the type in this file or the policy module, not in `src/`.
3. Change the signature to `export function checkPackedReactCompatibility(tarball: string, options: { spawn?: Spawn; now?: Date } = {}): void`, defaulting `spawn` to `spawnSync` and `now` to `new Date()`. The existing single-argument call in `package-check.ts` must compile unchanged.
4. Compute `const cutoff = releaseAgeCutoff(now)` once, before the `for` loop, and replace the literal install array with `npmInstallArgs(cutoff)`. Use the injected `spawn` for both the install and the probe call; leave the probe arguments, timeouts, `--ignore-scripts`, the `file:` tarball spec, the error messages, and the `finally` cleanup as they are.

Add these cases to `packages/ui/src/package-check-react.test.ts`, each with a fake spawn that records every call `{ command, args, cwd }` and returns `{ status: 0, stdout: "{}", stderr: "" }` (no process is started, so the tarball path can be a fake string such as `/nonexistent/elmera-ui.tgz`; the function only writes it into a `package.json` in a temp dir):

5. Calling `checkPackedReactCompatibility(tarball, { spawn, now: new Date("2026-09-08T12:00:00.000Z") })` produces exactly three `npm` calls and three `process.execPath` probe calls, interleaved install-then-probe; every `npm` call's args equal `npmInstallArgs("2026-09-05T12:00:00.000Z")`; the three install `cwd`s are distinct and none exists after the call returns.
6. The three consumers' `package.json` files (read them inside the fake spawn from `cwd` before returning) request `react`/`react-dom` `19.0.0`, `19.1.1`, and the installed pair (compare with `JSON.parse(readFileSync(require.resolve("react/package.json")))` via `createRequire`, mirroring the script's `installedVersion`), each with `"@elmeragroup/ui": "file:<tarball>"`.
7. When the fake spawn returns `{ status: 1, stdout: "", stderr: "npm ERR! No matching version found for react@19.1.1 before 2026-09-05" }` for the second `npm` call, the function throws an error whose message starts with `Packed React 19.1.1 install failed:` and contains the stderr text, no probe call follows that install, and every consumer directory that was created no longer exists.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/package-check-react.test.ts && pnpm --filter @elmeragroup/ui type-check`

**Expected**: 7 cases pass; type check exits 0 (confirms `package-check.ts` still compiles against the widened signature).

### Step 4: Prove it against the real tarball and amend the spec

Run the packed verification with registry access. Inspect the three probe JSON lines (`{"react":"19.0.0",...}`, `19.1.1`, and the installed version). If npm reports that a version does not satisfy the cutoff, that is a STOP condition (below), not a reason to retry without `--before`.

Amend `docs/spec/tooling.md` §2, the "Release-age guard" bullet at line 29, by appending one sentence in the file's existing amendment style, for example: `The packed React consumers that package:check installs with npm enforce the same window through an absolute --before cutoff computed once per run (scripts/packed-consumer-install-policy.ts); they need no exclusion list because neither minimumReleaseAgeExclude entry is a dependency of the published package. _(amended 2026-09-08)_` (format with backticks as the surrounding bullets do). Do not change the two named pnpm exceptions or any other line.

**Verify**: `pnpm --filter @elmeragroup/ui build && pnpm --filter @elmeragroup/ui pack && pnpm --filter @elmeragroup/ui package:check`

**Expected**: exit 0; three probe JSON lines; `package:check passed`.

**Verify**: `git diff --stat -- docs/spec/tooling.md`

**Expected**: exactly one line changed in that file.

### Step 5: Format, complete verification, hand off

Run `pnpm exec oxfmt packages/ui/scripts/package-check-react.ts packages/ui/scripts/packed-consumer-install-policy.ts packages/ui/src/package-check-react.test.ts`, then the completion gates. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report the behaviour change, the checks run, and any blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/package-check-react.test.ts` → the file is listed with 7 passing cases.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

**Verify**: `pnpm lint` → exit 0, no warnings.

**Verify**: `pnpm exec oxfmt --check` → exit 0.

**Verify**: `pnpm ci:checks` → exit 0.

## Test plan

New file `packages/ui/src/package-check-react.test.ts` (ui `unit` project, `include: ["src/**/*.test.ts"]`), modelled on `packages/ui/src/package-check.test.ts`:

- Policy module (Step 2, cases 1–4): pnpm alignment, fixed-instant cutoff, month-boundary cutoff, argument list.
- Spawn boundary (Step 3, cases 5–7): one shared cutoff across three real-looking consumers, correct React pairs and tarball spec, failure stops before the probe and cleans up.
- Explicit `Date` inputs only; never assert against `Date.now()` or elapsed time.
- The real download proof stays `pnpm --filter @elmeragroup/ui package:check`; the unit suite never spawns a process.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/package-check-react.test.ts` lists the file and passes all 7 cases (no silent zero-test pass).
- [ ] `pnpm --filter @elmeragroup/ui type-check` exits 0 with `packages/ui/scripts/package-check.ts` unmodified (`git diff --quiet -- packages/ui/scripts/package-check.ts`).
- [ ] `grep -c -- '--before=' packages/ui/scripts/packed-consumer-install-policy.ts` prints `1`, and `grep -c '"install", "--ignore-scripts"' packages/ui/scripts/package-check-react.ts` prints `0` (the literal array moved into the builder).
- [ ] `pnpm lint` exits 0; `pnpm exec oxfmt --check` exits 0.
- [ ] `pnpm --filter @elmeragroup/ui build && pnpm --filter @elmeragroup/ui pack && pnpm --filter @elmeragroup/ui package:check` exits 0 and prints three probe lines.
- [ ] `pnpm ci:checks` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` show only the four Scope files (plus `plans/README.md` if you own the row), beyond the recorded baseline.
- [ ] Row 004 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report (do not improvise) if:

- The drift check shows changes and the "Current state" excerpts no longer match `package-check-react.ts` or `package-check.ts`.
- `npm install` under `--before` exits non-zero for any of the three consumers with a "no matching version" / "before" message: an exact runtime dependency (React pair or a pinned range in `entries.ts`) is younger than 72 hours. Report the package and version; do not drop or widen the cutoff, do not add an exclusion, and do not retry without the flag.
- npm rejects the `file:` tarball dependency in combination with `--before` (unexpected; report the exact message).
- Keeping the unit test offline seems to require `vi.mock`, `vi.spyOn` on `node:child_process`, or a lint-rule disable comment. The injected `spawn` parameter is the sanctioned route; if it cannot express something, report it.
- A correct change appears to need `package-check.ts`, the probe file, `pnpm-workspace.yaml`, a new dependency, or any other out-of-scope file.
- A verification step fails twice after one reasonable repair attempt, or `pnpm ci:checks` fails for sandbox/network reasons (report as blocked, not passed).
- Any tracked file outside Scope changes during builds.

Never weaken an assertion, skip a gate, or print npm configuration (it may carry registry tokens).

## Maintenance notes

- `--before` is an absolute cutoff; pnpm's `minimumReleaseAge` is relative. The alignment test (case 1) is the only link between them — when pnpm's setting changes, `RELEASE_AGE_MINUTES` must change in the same PR, and the test says so. Do not add a `minimumReleaseAgeExclude` mirror for npm: the two current exclusions are not dependencies of `@elmeragroup/ui`, and a future one that is would deserve its own review.
- Reviewers should check that `package-check.ts` still passes one argument, that both spawn calls use the injected function, and that the test file contains no `readFileSync` of the script source (ADR 0008).
- When bumping the Node major in `.node-version`, re-read the npm `before` docs for the bundled npm; the semantics above were verified against the v11 reference.
- Deferred on purpose: the release-workflow packed fixtures (`fixtures/next-app-router`, `fixtures/vite`, tooling.md §7.5) are not yet present in the repo; when they land, they should reuse `npmInstallArgs`/`releaseAgeCutoff` rather than a second policy.
