# Plan 001: Split `theme-api.browser.test.tsx` into three focused browser-test files

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving to the next step. If anything in the
> "STOP conditions" section occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 85aa892..HEAD -- packages/ui/src/theme/theme-api.browser.test.tsx packages/ui/test/`
> If either path changed since commit `85aa892`, compare the "Current state" excerpts below
> against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt / tests
- **Planned at**: commit `85aa892`, 2026-08-21

## Why this matters

`packages/ui/src/theme/theme-api.browser.test.tsx` is 1,299 lines — over the repo's own
1k-line review ceiling — and mixes four unrelated test subjects (provider/scope behavior,
the `useColorScheme` hook surface, forced color-scheme, and color-scheme runtime/diagnostic
internals) in one file. A recent refactor extracted the shared `render()` helper into
`packages/ui/test/browser-render.ts`; this plan finishes that direction by splitting the
file along its existing `describe` seams so each subject has one home. No behavior changes;
all test cases move verbatim.

## Current state

- `packages/ui/src/theme/theme-api.browser.test.tsx` — the single 1,299-line browser test
  file being split. Its layout (verify with
  `rg -n "^describe|^function|^const [A-Z]" packages/ui/src/theme/theme-api.browser.test.tsx`):

  | Lines (at `85aa892`) | Content                                                                                                        |
  | -------------------- | -------------------------------------------------------------------------------------------------------------- |
  | 1–24                 | imports                                                                                                        |
  | 26–28                | theme constants `fkasPrivate`, `tkasCompany`, `guenPrivate`                                                    |
  | 30–45                | `defaultManifest`, `writeManifest()`, `runBootstrap()`                                                         |
  | 47–65                | file-scoped `beforeEach` (writes default manifest) and `afterEach` (document/storage/env cleanup)              |
  | 67–80                | `stampDocumentBrand()`, `readDocumentBrand()`                                                                  |
  | 82–130               | probes: `ThemeProbe`, `LocaleProbe`, `ScopeProbe`, `ValidatorErrorBoundary`                                    |
  | 132–431              | `describe("ThemeProvider / ThemeScope")`                                                                       |
  | 433–466              | `describe("ElmeraGroupUiProvider")`                                                                            |
  | 468–493              | `describe("overlay containment")`                                                                              |
  | 495–576              | color-scheme helpers: `ColorSchemeOutput`, `ColorSchemeSetter`, `mountedColorScheme`, `stubPrefersColorScheme` |
  | 578–743              | `describe("useColorScheme")`                                                                                   |
  | 745–1021             | `describe("forced color-scheme")`                                                                              |
  | 1023–1073            | `describe("color-scheme transition suppression")`                                                              |
  | 1075–1143            | `describe("color-scheme bootstrap diagnostics")`                                                               |
  | 1145–1162            | `runtimeConfig()`, `brandAttributeWrites()` helpers                                                            |
  | 1164–1180            | `describe("color-scheme store commit vs discard")`                                                             |
  | 1182–1250            | `describe("ThemeProvider committed color-scheme options")`                                                     |
  | 1252–1299            | `describe("ThemeProvider equal-axis theme identity")`                                                          |

- `packages/ui/test/browser-render.ts` — existing shared browser-test helper exporting
  `render(node)` (`createRoot` + `flushSync` + tracked unmount). New files import it exactly
  like the old file does: `import { render } from "../../test/browser-render";`.
- Vitest browser project discovers tests via glob `src/**/*.browser.test.tsx`
  (`packages/ui/vitest.config.ts`), so new files placed in `packages/ui/src/theme/` are
  picked up automatically with no config change.
- Repo conventions: oxlint with `--deny-warnings` runs repo-wide (`pnpm lint`); match the
  existing import grouping of the source file (external packages first, then internal
  relative imports, alphabetical). Comments explain "why", never "what".

## Commands you will need

Run from the repo root unless noted.

| Purpose                | Command                                                                            | Expected on success |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| Unit tests (ui pkg)    | `pnpm --filter @elmeragroup/ui test`                                               | exit 0, all pass    |
| Browser tests (ui pkg) | `pnpm --filter @elmeragroup/ui test:browser`                                       | exit 0, all pass    |
| Single browser file    | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/<file>` | exit 0              |
| Typecheck (ui pkg)     | `pnpm --filter @elmeragroup/ui type-check`                                         | exit 0              |
| Lint                   | `pnpm lint`                                                                        | exit 0, no warnings |

Browser tests need Playwright browsers installed; they were green at planning time via
`pnpm turbo test:browser`.

## Scope

**In scope** (the only files you should create or modify):

- `packages/ui/src/theme/theme-api.browser.test.tsx` (modify: shrink to provider/scope tests)
- `packages/ui/src/theme/use-color-scheme.browser.test.tsx` (create)
- `packages/ui/src/theme/color-scheme-runtime.browser.test.tsx` (create)
- `packages/ui/test/theme-browser-fixtures.tsx` (create)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- Any non-test source file under `packages/ui/src/**` — this is a pure test move; if a test
  seems to require a production change, STOP.
- `packages/ui/test/browser-render.ts` — already correct; import it, don't edit it.
- Other browser test files (`brand-logo.browser.test.tsx`, `button*.browser.test.tsx`,
  `scroll-area.browser.test.tsx`) — already migrated to the shared render util.
- Test case bodies — move them verbatim. Do not "improve", rename, or delete assertions.

## Git workflow

- Branch: work on the current feature branch or `advisor/001-split-theme-browser-tests`.
- One commit for the whole split (moving tests between commits leaves the suite red).
  Message style matches the repo (conventional commits), e.g.:
  `test(theme): split theme-api browser tests by subject`

## Steps

### Step 1: Create the shared fixtures module

Create `packages/ui/test/theme-browser-fixtures.tsx`. Move these definitions out of
`theme-api.browser.test.tsx` **verbatim** (they are used by two or three of the destination
files; usage counts verified at planning time):

- Theme constants `fkasPrivate`, `tkasCompany`, `guenPrivate` (lines 26–28)
- `defaultManifest` (line 30)
- `writeManifest()` (lines 32–38)
- `stampDocumentBrand()` (lines 67–72)
- `readDocumentBrand()` (lines 74–80)
- `ColorSchemeOutput` (lines 495–503)
- `ColorSchemeSetter` (lines 505–516)
- `mountedColorScheme()` (lines 518–520)
- `stubPrefersColorScheme()` (lines 522–~576)

Export every one of them. Add the needed imports at the top of the fixtures file (copy
them from the source file: types from `./color-scheme`, `themeAttributes` from
`../src/theme/theme-attributes`, `useColorScheme` from `../src/theme/use-color-scheme`,
etc. — take only what the moved definitions reference; `tsc` will tell you if something
is missing). Do NOT put vitest hooks (`beforeEach`/`afterEach`) or `render` in this file —
each test file declares those itself, explicitly.

**Verify**: `pnpm --filter @elmeragroup/ui exec tsc --noEmit` → exits 0 once the source
file stops importing the moved symbols (Step 2). At this intermediate point the source
file still defines duplicates — that's fine; proceed.

### Step 2: Create the three test files and shrink the original

Create three files in `packages/ui/src/theme/`, moving the listed content verbatim. Each
file starts with its own copy of the header boilerplate (imports trimmed to what that file
uses, the three theme constants imported from the shared fixtures module,
`beforeEach`/`afterEach` copied from lines 47–65 of the original, and the local helpers
listed below).

**A. `theme-provider.browser.test.tsx`** (~500 lines)

- `describe` blocks: `"ThemeProvider / ThemeScope"` (132–431), `"ElmeraGroupUiProvider"`
  (433–466), `"overlay containment"` (468–493), `"ThemeProvider equal-axis theme identity"`
  (1252–1299)
- File-local helpers (used only here): `ThemeProbe` (82–93), `LocaleProbe` (95–102),
  `ScopeProbe` (104–113), `ValidatorErrorBoundary` (115–130)

**B. `use-color-scheme.browser.test.tsx`** (~550 lines)

- `describe` blocks: `"useColorScheme"` (578–743), `"forced color-scheme"` (745–1021),
  `"color-scheme transition suppression"` (1023–1073)

**C. `color-scheme-runtime.browser.test.tsx`** (~250 lines)

- `describe` blocks: `"color-scheme bootstrap diagnostics"` (1075–1143),
  `"color-scheme store commit vs discard"` (1164–1180),
  `"ThemeProvider committed color-scheme options"` (1182–1250)
- File-local helpers: `runBootstrap()` (40–45), `runtimeConfig()` (1145–1156),
  `brandAttributeWrites()` (1157–1162)

Then reduce `theme-api.browser.test.tsx` to nothing — delete the file entirely once all
four describe blocks it contained live in file A. (Three files total, not four.)

Import shared symbols in each new file:

```ts
import {
  defaultManifest,
  fkasPrivate,
  readDocumentBrand,
  stampDocumentBrand,
  tkasCompany,
  writeManifest,
  // ...only what that file actually uses
} from "../../test/theme-browser-fixtures";
import { render } from "../../test/browser-render";
```

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/theme-provider.browser.test.tsx src/theme/use-color-scheme.browser.test.tsx src/theme/color-scheme-runtime.browser.test.tsx`
→ all tests pass; total test count across the three files equals the original count
(62 browser tests in the package at planning time).

### Step 3: Confirm discovery parity and clean up

1. `ls packages/ui/src/theme/*.browser.test.tsx` → shows the three new files and no
   `theme-api.browser.test.tsx`.
2. `grep -n "describe(" packages/ui/src/theme/*.browser.test.tsx` → every original
   `describe` title appears exactly once across the three files.
3. `grep -rn "theme-api.browser" packages/ apps/ --include="*.ts*" --include="*.json" --include="*.md"`
   → no references remain (no CI config or docs name the deleted file; if one does, update
   that single reference and note it in the commit body).

**Verify**: full gates —
`pnpm lint && pnpm turbo type-check test test:browser` → all exit 0, browser count still 62.

## Test plan

No new tests and no changed assertions: this plan relocates existing tests. The regression
risk is coverage loss, so the done criteria pin the count:

- Before starting, record the baseline: `pnpm --filter @elmeragroup/ui test:browser` → note
  the "Tests" total (62 at planning time) and per-file counts.
- After Step 2 the same totals must hold across the three new files, zero skipped.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/ui/src/theme/theme-api.browser.test.tsx` no longer exists
- [ ] `pnpm lint` exits 0
- [ ] `pnpm turbo type-check` exits 0
- [ ] `pnpm turbo test` exits 0
- [ ] `pnpm turbo test:browser` exits 0 with the same total test count as the recorded baseline (62 at planning time), none skipped
- [ ] Every moved helper is defined exactly once repo-wide:
      `for s in ColorSchemeOutput ColorSchemeSetter mountedColorScheme stubPrefersColorScheme writeManifest stampDocumentBrand readDocumentBrand ThemeProbe runtimeConfig; do echo "$s $(grep -rl "function $s\|const $s" packages/ui/src packages/ui/test | wc -l | tr -d ' ')"; done` → each prints `1`
- [ ] `wc -l packages/ui/src/theme/*.browser.test.tsx` → no file over 600 lines
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Line ranges or symbol names in "Current state" don't match the live file (drift since
  `85aa892`).
- Any helper turns out to be used by a `describe` block this plan assigned to a different
  file than the fixtures module assumes (re-run the usage greps from Why-this-matters'
  verification command and report the discrepancy instead of redesigning the split).
- The post-split browser test count differs from the baseline by anything other than 0.
- Making a test pass requires editing a non-test source file.
- Playwright browsers are unavailable in your environment (report; do not skip the gate).

## Maintenance notes

- Future color-scheme work should extend `color-scheme-runtime.browser.test.tsx`;
  provider/surface behavior belongs in `theme-provider.browser.test.tsx`. Reviewers should
  reject PRs that grow any single file past ~600 lines again.
- Shared fixtures live in `packages/ui/test/theme-browser-fixtures.tsx`; when a fixture is
  needed by a third subject, move it there rather than duplicating — but resist extracting
  anything used by only one file (that was the thermo-review lesson this branch applied).
- Deferred: the unit-side sibling `theme-api.test.ts` (444 lines) is under the ceiling and
  was intentionally left alone.
