# Plan 007: Render artwork with an empty title as decorative

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step (Step 2). Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- packages/ui/src/icons/bespoke-svg.ts packages/ui/src/icons/bespoke.test.ts packages/ui/src/icons/bespoke/vipps.tsx packages/ui/src/illustrations/fkas-meter.tsx`. Empty output means no drift. If any file is listed, compare the current-state excerpts below with the live files before continuing. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08 (reviewed and tightened 2026-09-08, same commit)
- **Audit finding**: 7
- **Status**: DONE

## Why this matters

`decorativeSvgProps("")` returns `{ role: "img" }`, but every artwork component renders its `<title>` element only for a truthy title. Passing `title=""` therefore produces an `<svg role="img">` with no accessible name and no `aria-hidden`: an unnamed image enters the accessibility tree. The documented contract ([docs/spec/icons.md:113](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/icons.md:113)) says decorative uses "must not acquire an accessible name accidentally"; an unnamed `role="img"` is the mirror failure. The fix is a one-condition change in the shared helper so both attributes and the title element use the same rule. No artwork file changes.

## Current state

Whitespace is condensed in some excerpts.

### The helper (the file to change)

[packages/ui/src/icons/bespoke-svg.ts:11-26](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke-svg.ts:11):

```ts
/**
 * Accessible name is only the optional `title` prop (role=img + a prop-driven
 * `<title>`). Decorative otherwise. Never ship a static `<title>`.
 * Fixed-palette artwork is permitted for illustrations (multi-color hex or
 * theme fill classes). Bespoke assets are server-safe: no hooks, no
 * "use client". Referenced clip-path / mask / gradient ids are namespaced
 * statically per asset (e.g. `signing-clip`); ...
 */
export function decorativeSvgProps(title: string | undefined) {
  if (title !== undefined) {
    return { role: "img" as const };
  }
  return { "aria-hidden": true as const, focusable: false as const };
}
```

The JSDoc is load-bearing: [packages/ui/src/icons/bespoke.test.ts:118-120](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke.test.ts:118) reads this file as text and asserts it contains the exact phrase `Fixed-palette artwork is permitted for illustrations`. Keep that sentence verbatim when you edit the comment.

### The callers (read-only)

Every SVG-rendering asset uses the identical two-line pattern: helper spread, then caller props, then a truthy-title `<title>`. [packages/ui/src/icons/bespoke/vipps.tsx:6-16](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke/vipps.tsx:6):

```tsx
export function Vipps({ title, ...props }: BespokeSvgProps): ReactElement {
  return (
    <svg ... {...decorativeSvgProps(title)} {...props}>
      {title ? <title>{title}</title> : null}
```

[packages/ui/src/illustrations/fkas-meter.tsx:6-16](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/illustrations/fkas-meter.tsx:6) is the same shape and imports the helper from `../icons/bespoke-svg`.

Verified at `f14057be`: the 27 SVG-rendering asset files (26 under `packages/ui/src/icons/bespoke/`, plus `fkas-meter.tsx`) all contain `{...decorativeSvgProps(title)}` followed by `{title ? <title>{title}</title> : null}`. The other 7 files in `bespoke/` (`*-logo.tsx`) are `createLogo(...)` wrappers that forward props to a full/mark pair and render no SVG themselves ([packages/ui/src/icons/create-logo.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/create-logo.ts)). To re-confirm the count:

```sh
grep -l 'title ? <title>{title}</title> : null' packages/ui/src/icons/bespoke/*.tsx packages/ui/src/illustrations/*.tsx | wc -l   # → 27
grep -L 'decorativeSvgProps' packages/ui/src/icons/bespoke/*.tsx                                                                    # → only the 7 *-logo.tsx wrappers
```

Because caller `{...props}` is spread after the helper, an explicit caller attribute (`aria-hidden={false}`, `role`, `aria-label`) already wins over the helper's output. That precedence must not change.

[packages/ui/src/icons/brand-logo.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/brand-logo.tsx) does not use the helper: it names a `<span role="img" aria-label={title ?? displayName}>` host and renders the mark inside with no title. It is unaffected and out of scope.

### Behavior table (today vs. after this plan)

| `title` value           | Today                                                      | After                                                 |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| omitted / `undefined`   | `aria-hidden="true" focusable="false"`, no `<title>`       | unchanged                                             |
| `""`                    | `role="img"`, no `<title>`, no `aria-hidden` (**the bug**) | `aria-hidden="true" focusable="false"`, no `<title>`  |
| `"Vipps"`               | `role="img"` + `<title>Vipps</title>`                      | unchanged                                             |
| `" "` (whitespace-only) | `role="img"` + `<title> </title>`                          | unchanged; a nonempty string is treated as meaningful |

"Empty" means exactly the empty string. Whitespace-only normalization is deliberately not part of this patch (see Out of scope).

### Documented contract to honor

[docs/spec/icons.md:113](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/icons.md:113): "Every component accepts `ComponentPropsWithoutRef<"svg"> & { title?: string }`. With `title`, it renders `role="img"` and an associated `<title>`; without one it renders `aria-hidden="true"` and `focusable="false"`. Decorative uses must not acquire an accessible name accidentally." Lines 148 and 152 extend the same contract to logos and illustrations. This wording already describes the post-fix behavior, so no spec edit is required.

[docs/spec/accessibility.md:9](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md:9): "the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings." Naming or hiding an SVG is library-owned semantics.

### Test conventions

The exemplar is [packages/ui/src/icons/bespoke.test.ts:60-70](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke.test.ts:60):

```ts
it("renders a titled SVG as role=img and a decorative SVG as aria-hidden", () => {
  const titled = renderToStaticMarkup(createElement(Vipps, { title: "Vipps" }));
  expect(titled).toContain('role="img"');
  expect(titled).toContain("<title>Vipps</title>");
  expect(titled).not.toContain("aria-hidden");

  const decorative = renderToStaticMarkup(createElement(Vipps));
  expect(decorative).toContain("aria-hidden");
  expect(decorative).toContain("focusable");
  expect(decorative).not.toContain("<title>");
});
```

The file already imports `createElement`, `renderToStaticMarkup`, `Vipps`, `FkasMeter`, and defines `logosByName` (line 32) mapping the seven `LogoName` exports. A second `describe("illustrations")` block at line 200 holds the `FkasMeter` contract test (line 209). Tests assert rendered markup, not implementation text (the one source-text assertion at line 118 is the existing JSDoc guard described above). The repository uses React 19, TypeScript, package subpath exports, and colocated Vitest tests; see [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md) ("Tests and demos"). Reference files outside Scope are read-only.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm. `node --version` must satisfy `>=24.13.0 <25` (the `engines` field in `package.json`); `pnpm --version` must print `11.20.0` (the `packageManager` field). If dependencies are missing, stop and report instead of changing the lockfile.

| Purpose              | Command                                                                                  | Expected on success                                                       |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts` | Report lists `src/icons/bespoke.test.ts`; all cases pass after Step 3     |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                               | Exit 0 (`tsc --noEmit`)                                                   |
| Lint                 | `pnpm lint`                                                                              | Exit 0 (`oxlint . --deny-warnings`, so any warning fails)                 |
| Format check         | `pnpm format:check`                                                                      | Exit 0 (`oxfmt --check`); run `pnpm format` on in-scope files if it fails |
| Full completion gate | `pnpm ci:checks`                                                                         | Exit 0                                                                    |

`pnpm ci:checks` runs `oxfmt --check` and then `turbo run ci:checks`, which fans out ([turbo.json:69-82](/Users/tommy.lunde.barvag/src/work/elmera/ui/turbo.json:69)) to root `lint` and `test:repo-policy`, then per-package `type-check`, `test`, `test:browser`, `test:packed-consumer`, `test:types`, `build`, `package:check`, and `size-limit`. Browser tests bind a local port and start Chromium; the packed-consumer check needs registry access. A sandbox or network failure is a verification blocker, not a passing result.

The UI Vitest config sets `passWithNoTests: true` ([packages/ui/vitest.config.ts:6](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/vitest.config.ts:6)), so exit 0 alone proves nothing: confirm the report names `src/icons/bespoke.test.ts` and shows the new case titles from Step 2. Builds may regenerate files; standard ignored outputs are fine, but stop if any tracked file outside Scope changes.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/icons/bespoke-svg.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke-svg.ts) — change the condition on line 22 and clarify the JSDoc.
- [packages/ui/src/icons/bespoke.test.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke.test.ts) — add rendered-markup regression cases.
- [.changeset/empty-artwork-title.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/empty-artwork-title.md) (create).

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or `plans/deep-audit.md`.

**Out of scope:**

- All 33 files under `packages/ui/src/icons/bespoke/` and `packages/ui/src/illustrations/fkas-meter.tsx`. They already render `<title>` on the correct condition; the fix is entirely in the helper. Do not change SVG geometry, palettes, ids, generators, exports, or the `createLogo` wrappers.
- `packages/ui/src/icons/brand-logo.tsx` and `brand-logo.browser.test.tsx` — different mechanism (`aria-label` on a span), not affected.
- `docs/spec/icons.md` and `docs/spec/accessibility.md` — already describe the target behavior; no edit.
- Whitespace-only title normalization (`" "` → decorative) and any new accessible-label API. Both are API decisions, not this bug.
- The `BespokeSvgProps` / `LogoProps` types — the public prop surface does not change.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/empty-artwork-title` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples: `refactor: simplify runtime state and strengthen regression tests`, `chore: simplify repository docs and component authoring`. Suggested message: `fix: render artwork with an empty title as decorative`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions, record the worktree status, and run the drift check. Read `bespoke-svg.ts`, `vipps.tsx`, `fkas-meter.tsx`, and `bespoke.test.ts` lines 1-70 and 200-217. Run the two `grep` commands from "Current state" to re-confirm the 27/7 split.

**Verify**: `git rev-parse --short HEAD && git status --short`, then the drift check command from the header.

**Expected**: HEAD is `f14057be` or a descendant whose drift check output is empty (or whose listed changes leave the excerpts intact). Pre-existing changes are recorded and untouched. The grep count is 27.

### Step 2: Add rendered empty-title coverage (expected to fail)

In `packages/ui/src/icons/bespoke.test.ts`, inside `describe("bespoke icons")`, add one test after the exemplar at line 70 (name it `"treats an empty title as decorative"` or similar). Use `renderToStaticMarkup(createElement(Component, props))` exactly as the exemplar does. Assert, for `Vipps` and for one entry from `logosByName` (e.g. `TelinetLogo`):

- `{ title: "" }` → markup contains `aria-hidden="true"` and `focusable="false"`, and does not contain `role="img"` or `<title>`.
- omitted title → same four assertions (guards that the fix does not disturb the existing decorative path).
- `{ title: "Vipps" }` (or `"Telinet"`) → contains `role="img"` and `<title>Vipps</title>`, does not contain `aria-hidden`.
- `{ title: " " }` → contains `role="img"` and `<title> </title>`. Comment in the test that this records the bounded policy (nonempty means meaningful), not a claim that whitespace is a useful name.

Add a second test for explicit caller overrides, asserting exact attribute presence (these pass before and after the fix and exist to pin precedence):

- `{ title: "Vipps", "aria-hidden": true }` → contains both `role="img"` and `aria-hidden="true"` (caller wins; helper output is not stripped).
- `{ "aria-hidden": false }` with no title → contains `aria-hidden="false"` (caller wins over the helper's `true`).
- `{ "aria-label": "Pay with Vipps", role: "img" }` with no title → contains `role="img"` and `aria-label="Pay with Vipps"`, and still contains `aria-hidden="true"` (that is today's behavior for an untitled asset; the plan does not change it).

Inside `describe("illustrations")`, extend the test at line 209 (`"uses the titled vs decorative SVG contract"`) or add a sibling: `createElement(FkasMeter, { title: "" })` → contains `aria-hidden="true"`, does not contain `role="img"` or `<title>`.

Do not add a helper in the test that re-implements the title classification; assert markup strings only.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts`

**Expected**: Exactly the `title: ""` assertions fail (three components), with failure output showing `role="img"` present and `aria-hidden` absent. Every pre-existing case and the override case pass. If anything else fails, STOP.

### Step 3: Align the attribute helper

In `packages/ui/src/icons/bespoke-svg.ts`, change line 22 from `if (title !== undefined) {` to `if (title) {`. Keep both return shapes and the `as const` assertions unchanged so the inferred return type is stable. Target shape:

```ts
export function decorativeSvgProps(title: string | undefined) {
  if (title) {
    return { role: "img" as const };
  }
  return { "aria-hidden": true as const, focusable: false as const };
}
```

Update the first JSDoc sentence to say that only a nonempty `title` supplies the accessible name and that an omitted or empty title renders decorative (`aria-hidden`), matching the artwork's `{title ? <title>{title}</title> : null}` condition. Leave the rest of the comment intact, in particular the exact phrase `Fixed-palette artwork is permitted for illustrations`.

Do not touch any artwork file. If a test from Step 2 still fails after this change, the assumption "all assets render `<title>` on truthiness" is wrong for that asset: STOP and report which file.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts`

**Expected**: All cases pass, including the existing JSDoc-phrase assertion at line 118 and `"ships no static title element besides the prop-driven title slot"`. `git status --short` shows only `bespoke-svg.ts` and `bespoke.test.ts` modified.

### Step 4: Add the changeset

Create `.changeset/empty-artwork-title.md`:

```md
---
"@elmeragroup/ui": patch
---

Bespoke icons, logos, and illustrations now render as decorative (`aria-hidden="true"`) when `title` is an empty string, instead of an unnamed `role="img"`.
```

The format matches the existing [.changeset/initial-release.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/initial-release.md). `pnpm changeset` is the interactive alternative; writing the file directly is fine.

**Verify**: `pnpm format:check` and `head -3 .changeset/empty-artwork-title.md`

**Expected**: Format check exits 0; the frontmatter names `"@elmeragroup/ui": patch`.

### Step 5: Complete verification and handoff

Run the completion gates in order. Then inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the Step 1 baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report the behavior change, the checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts` → all pass; report names the file and the new case titles.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

**Verify**: `pnpm lint` → exit 0.

**Verify**: `pnpm ci:checks` → exit 0 across all fan-out tasks listed under "Commands you will need".

**Verify**: `grep -n 'title !== undefined' packages/ui/src/icons/bespoke-svg.ts` → no output.

## Test plan

All new coverage lives in `packages/ui/src/icons/bespoke.test.ts`, modeled on the test at line 60. Cases, each asserted on `renderToStaticMarkup` output:

1. `title: ""` on `Vipps`, one `logosByName` logo, and `FkasMeter` → decorative attributes, no `role="img"`, no `<title>` (the regression).
2. omitted title on the same components → identical decorative output (no change).
3. nonempty title → `role="img"` + `<title>…</title>`, no `aria-hidden` (no change).
4. `title: " "` → `role="img"` + `<title> </title>` (bounded policy recorded).
5. Explicit overrides: caller `aria-hidden` (true with a title, false without), and caller `role`/`aria-label` on an untitled asset — attribute values exactly as listed in Step 2.

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts` runs the `bespoke icons` and `illustrations` suites and passes every existing and new case.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project unit src/icons/bespoke.test.ts` passes; the report names `src/icons/bespoke.test.ts` and the new case titles (no silent zero-test run).
- [ ] `pnpm --filter @elmeragroup/ui type-check` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm ci:checks` exits 0.
- [ ] `grep -n 'title !== undefined' packages/ui/src/icons/bespoke-svg.ts` prints nothing.
- [ ] `grep -c 'Fixed-palette artwork is permitted for illustrations' packages/ui/src/icons/bespoke-svg.ts` prints `1`.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` lists only `packages/ui/src/icons/bespoke-svg.ts` and `packages/ui/src/icons/bespoke.test.ts` (plus `plans/README.md` if you own the index); `git ls-files --others --exclude-standard` adds only `.changeset/empty-artwork-title.md`, after accounting for the Step 1 baseline.
- [ ] `.changeset/empty-artwork-title.md` declares `"@elmeragroup/ui": patch`.
- [ ] Row 007 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report (do not improvise) if:

- The drift check lists a file and the live code no longer matches the excerpts, in particular if `bespoke-svg.ts:22` is no longer `if (title !== undefined)`.
- The grep in Step 1 finds an SVG-rendering asset that renders `<title>` on a condition other than `{title ? ... : null}`; fixing this bug would then need an artwork edit, which is out of scope.
- After Step 3, any `title: ""` case still fails, or any pre-existing test in `bespoke.test.ts` fails (especially the JSDoc-phrase guard at line 118).
- A verification gate fails twice after one reasonable repair attempt.
- `pnpm ci:checks` changes a tracked file outside Scope (for example a generated export list or API report).
- You find yourself wanting to change `BespokeSvgProps`, any file under `bespoke/`, `fkas-meter.tsx`, `brand-logo.tsx`, or a spec document.

Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

## Maintenance notes

- New artwork must keep using `decorativeSvgProps(title)` together with `{title ? <title>{title}</title> : null}` so the two stay in lockstep. The `"ships no static title element"` test enforces the title-slot shape; the new Step 2 tests enforce the attribute side.
- Reviewers should check that the diff touches exactly one condition in the helper plus tests and a changeset. Any artwork diff means the plan was misread.
- Deferred on purpose: whitespace-only titles still name the image. If a consumer report shows that happening in practice, decide on trimming as a documented API change (spec `icons.md:113` would need updating), not a silent tweak.
- `BrandLogo` names its host span with `aria-label` and never passes `title` into the SVG; it is unaffected by this change and by any future title-normalization decision.
