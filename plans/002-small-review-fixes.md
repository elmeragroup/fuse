# Plan 002: Small review fixes — honest test tripwires, BrandLogo guard, doc wording, pin-check dedup

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving to the next step. If anything in the
> "STOP conditions" section occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 85aa892..HEAD -- turbo.json packages/ui/src/icons/brand-logo.tsx packages/ui/src/theme/validate-theme.ts packages/ui/src/theme/theme-api.test.ts .scratch/poc/remaining-implementation.md`
> If any of these changed since commit `85aa892`, compare the "Current state" excerpts
> below against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plans/001; touches different files)
- **Category**: tests / dx / docs / tech-debt
- **Planned at**: commit `85aa892`, 2026-08-21

## Why this matters

Four small findings from a branch audit of `feat/theme-cleanup`, none urgent but all cheap:

1. Two density-artifact tripwire tests silently **skip** on a fresh CI checkout because
   turbo's root `test` task has no dependency on the UI package build that produces the
   artifact they assert on. A tripwire that skips isn't a tripwire.
2. `BrandLogo` used to throw `"Unhandled brand"` for out-of-contract input; after the
   switch-to-lookup refactor it throws a bare `TypeError`. Restore the explicit message.
3. The roadmap scratch doc still describes `BrandLogo` as an "exhaustive six-code switch"
   — the very construct this branch deleted.
4. `validateTheme` checks `brandAllowsSegment` for diagnostics and then `pinTheme`
   re-checks it, and the `coerceTheme` test titled "in every environment" only exercises
   one environment.

## Current state

### Fix 1 — turbo test task (`turbo.json`)

```jsonc
// turbo.json (lines 17–19 at 85aa892)
"lint": {
  "inputs": ["$TURBO_DEFAULT$", "tooling/oxlint-plugin/**", "tooling/oxlint-anti-slop/**"]
},
```

and:

```jsonc
// turbo.json (line 23) — the target of fix 1: no dependsOn, so unit tests can run
// before packages/ui/dist exists and both skipIf-guarded artifact assertions skip.
"test": {},
```

The guarded assertions:
- `apps/docs/test/demo-stage-density.test.ts` — `it.skipIf(!existsSync(artifactPath))("the imported artifact exists after the ui build", ...)`
- `packages/ui/src/theme/density-css.test.ts` — `it.skipIf(!existsSync(demoStageCssPath))("is emitted next to themes.css", ...)`

The `//#lint` task already depends on `"@elmeragroup/ui#build"` with an explanatory
comment (lines 6–12); mirror that comment style. Note `test:browser` already depends on
`"build"` — only plain `test` lacks it.

### Fix 2 — BrandLogo guard (`packages/ui/src/icons/brand-logo.tsx`)

Current component body (line 18):

```tsx
const displayName = BRANDS[brand].displayName;
return (
  <span {...rest} className={className} data-variant={variant} role="img" aria-label={title ?? displayName}>
    {displayName}
  </span>
);
```

For runtime-garbage `brand` (JS consumer ignoring types), `BRANDS[brand]` is `undefined`
and the error is `TypeError: Cannot read properties of undefined`. The pre-refactor code
threw `new Error("Unhandled brand")`.

### Fix 3 — stale doc wording (`.scratch/poc/remaining-implementation.md`)

Two occurrences of "six-code switch" survive from before the switch was deleted:

- Layer table row: `` | BrandLogo (fallback) | `/icons` exports `BrandLogo` — exhaustive six-code switch rendering an accessible `<span>` ... ``
- §2.2.1 paragraph: "`BrandLogo` **already shipped** (theme track) as the icons.md §4 fallback contract: exhaustive six-code switch (`fkas`/`fkab` → Fjordkraft, ..."

Find them with `grep -n "six-code switch" .scratch/poc/remaining-implementation.md`.

### Fix 4 — validate-theme dedup + test env coverage

`packages/ui/src/theme/validate-theme.ts` currently has:

```ts
function pinTheme(variant: ThemeVariant, brand: BrandCode, segment: ThemeSegment): ThemeInput {
  if (brandAllowsSegment(brand, segment)) {
    // SAFETY: BRANDS.segments is the pin table that ThemeInput encodes; membership is the runtime check.
    return { variant, brand, segment } as ThemeInput;
  }
  // SAFETY: a single-segment BRANDS entry is the pinned segment for that brand.
  return { variant, brand, segment: BRANDS[brand].segments[0] } as ThemeInput;
}
```

and `validateTheme` calls `brandAllowsSegment(parsed.brand, parsed.segment)` for its
diagnostics branch, then calls `pinTheme(...)` which performs the same check again.

The test to extend lives in `packages/ui/src/theme/theme-api.test.ts` (~line 118):

```ts
it("silently pins illegal segments in every environment", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(coerceTheme({ variant: "internal", brand: "fkab", segment: "private" })).toEqual({ ... });
  ...
});
```

Relevant domain facts (from `CONTEXT.md` / `docs/spec/theming.md`): `BRANDS[brand].segments`
arrays contain **unique** entries (`["company"]`, `["private"]`, or
`["private", "company"]`), so `resolvePinnedSegment(brand, segment) !== segment` if and
only if the brand does not allow the segment. That equivalence is what makes fix 4 safe.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Unit tests (ui pkg) | `pnpm --filter @elmeragroup/ui test` | exit 0 |
| Docs tests | `pnpm --filter docs test` | exit 0 |
| Typecheck (ui pkg) | `pnpm --filter @elmeragroup/ui type-check` | exit 0 |
| Browser tests (ui pkg) | `pnpm --filter @elmeragroup/ui test:browser` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `turbo.json`
- `packages/ui/src/icons/brand-logo.tsx`
- `packages/ui/src/icons/brand-logo.browser.test.tsx` (add one throwing-input test)
- `packages/ui/src/theme/validate-theme.ts`
- `packages/ui/src/theme/theme-api.test.ts` (extend one test)
- `.scratch/poc/remaining-implementation.md`
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):
- `apps/docs/test/demo-stage-density.test.ts` and `packages/ui/src/theme/density-css.test.ts`
  — their `skipIf` guards stay; fix 1 makes them effective rather than rewriting them.
- Any other file in `packages/ui/src/theme/**` — the coercion API surface
  (`coerceTheme`/`validateTheme` signatures and export list) must not change.
- `docs/spec/**` — spec text already matches the implementation.

## Git workflow

- Branch: current feature branch or `advisor/002-small-review-fixes`.
- One commit; conventional-commit style matching repo history, e.g.:
  `refactor(theme): make density tripwires run in CI and restore BrandLogo's unhandled-brand error`

## Steps

### Step 1: Make the root `test` task depend on the UI build (fix 1)

In `turbo.json`, change:

```jsonc
"test": {},
```

to:

```jsonc
// Density-artifact tripwires assert dist output; without the ui build they skip silently.
"test": {
  "dependsOn": ["@elmeragroup/ui#build"]
},
```

**Verify**: `pnpm turbo test` → exit 0. Then confirm the docs artifact assertion actually
ran rather than skipped: `pnpm --filter docs exec vitest run test/demo-stage-density.test.ts --reporter=verbose 2>&1 | grep -c "skipped"`
→ prints `0` (with `packages/ui/dist` present, which the new dependency guarantees).

### Step 2: Restore the explicit unknown-brand error (fix 2)

In `packages/ui/src/icons/brand-logo.tsx`, replace line 18's lookup with:

```tsx
const displayName = BRANDS[brand]?.displayName;
if (displayName === undefined) {
  throw new Error(`Unhandled brand: ${String(brand)}`);
}
```

Everything else in the component stays identical.

Then add one test to `packages/ui/src/icons/brand-logo.browser.test.tsx` inside the
existing `describe("BrandLogo")`:

```tsx
it("throws an explicit error for an unknown brand code", () => {
  expect(() =>
    render(<BrandLogo brand={"zz" as ThemeInput["brand"]} />)
  ).toThrow(/Unhandled brand: zz/);
});
```

Import `type { ThemeInput } from "../theme/tokens/themes"` alongside the existing imports
from that module. React re-throws uncaught render errors through the synchronous
`flushSync` render performed by the shared `render()` util, so the plain `expect(...).toThrow`
works; if it turns out not to propagate in your environment, STOP per the conditions below
rather than reaching for an error boundary workaround.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/icons/brand-logo.browser.test.tsx`
→ all pass including the new one (browser count 62 → 63).

### Step 3: Fix stale doc wording (fix 3)

In `.scratch/poc/remaining-implementation.md`, replace both occurrences of
"exhaustive six-code switch" with "exhaustive six-code `BRANDS` lookup"
(`grep -n "six-code switch" .scratch/poc/remaining-implementation.md` must return nothing
afterwards). Change nothing else in the sentences.

**Verify**: `grep -c "six-code switch" .scratch/poc/remaining-implementation.md` → `0`,
and `grep -c "six-code" .scratch/poc/remaining-implementation.md` → still ≥ 2 (the
references to the shipped six-code contract remain).

### Step 4: Deduplicate the pin check and cover both environments (fix 4)

In `packages/ui/src/theme/validate-theme.ts`:

1. Replace `pinTheme` with a single-segment resolver:

```ts
function resolvePinnedSegment(brand: BrandCode, segment: ThemeSegment): ThemeSegment {
  // BRANDS.segments entries are unique, so result !== segment exactly when pinned.
  return brandAllowsSegment(brand, segment) ? segment : BRANDS[brand].segments[0];
}
```

2. Rewrite `coerceTheme`'s success path:

```ts
export function coerceTheme(input: unknown): ThemeInput | null {
  const parsed = parseThemeAxes(input);
  if (!parsed.ok) {
    return null;
  }
  // SAFETY: resolvePinnedSegment returns a member of BRANDS[brand].segments, the pin
  // table ThemeInput encodes.
  return {
    variant: parsed.variant,
    brand: parsed.brand,
    segment: resolvePinnedSegment(parsed.brand, parsed.segment),
  } as ThemeInput;
}
```

3. Rewrite `validateTheme`'s tail so the check happens once, via value comparison:

```ts
const segment = resolvePinnedSegment(parsed.brand, parsed.segment);
if (segment !== parsed.segment) {
  if (isThemeDevelopment()) {
    throw pinnedSegmentError(parsed.brand, segment);
  }
  console.warn(pinnedSegmentWarning(parsed.brand, segment));
}

// SAFETY: segment came from resolvePinnedSegment over the BRANDS pin table.
return { variant: parsed.variant, brand: parsed.brand, segment } as ThemeInput;
```

Signatures, diagnostics messages, and behavior are unchanged. Delete nothing else.

4. In `packages/ui/src/theme/theme-api.test.ts`, rename the test at ~line 118 to
   `"silently pins illegal segments regardless of environment"` and exercise both
   environments:

```ts
vi.stubEnv("NODE_ENV", "development");
expect(coerceTheme({ variant: "internal", brand: "fkab", segment: "private" })).toEqual({
  variant: "internal",
  brand: "fkab",
  segment: "company",
});
vi.stubEnv("NODE_ENV", "production");
expect(coerceTheme({ variant: "external", brand: "fkse", segment: "company" })).toEqual({
  variant: "external",
  brand: "fkse",
  segment: "private",
});
```

(Keep the existing two assertions' exact expected objects; only the second one moves under
a production stub.)

**Verify**: `pnpm --filter @elmeragroup/ui test && pnpm --filter @elmeragroup/ui type-check`
→ both exit 0.

### Step 5: Full gates

**Verify**: `pnpm lint && pnpm turbo type-check test test:browser` → all exit 0;
browser total = baseline (62) + 1 new BrandLogo test = 63.

## Test plan

- New: the BrandLogo unknown-brand browser test (Step 2).
- Extended: `coerceTheme` environment coverage (Step 4).
- Existing suites act as the regression net for the `validate-theme` refactor — in
  particular `theme-api.test.ts`'s `coerceTheme`/`validateTheme` describes (legal themes,
  null returns, dev-throw/prod-warn pinning) and `themeAttributes` tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -A2 '"test":' turbo.json | grep -q '@elmeragroup/ui#build'` succeeds
- [ ] `grep -n "Unhandled brand" packages/ui/src/icons/brand-logo.tsx` finds the explicit error
- [ ] `grep -c "six-code switch" .scratch/poc/remaining-implementation.md` prints `0`
- [ ] `grep -c "brandAllowsSegment" packages/ui/src/theme/validate-theme.ts` prints exactly `2` (inside `resolvePinnedSegment` and nowhere else as a standalone pre-check)
- [ ] `pnpm lint && pnpm turbo type-check test test:browser` all exit 0; browser tests 63/63, none skipped
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live code (drift since `85aa892`).
- The Step 2 render-throw does not propagate through the shared `render()` util (i.e. the
  new browser test fails twice) — report; do not introduce an error boundary without review.
- `BRANDS[brand].segments` for any brand contains duplicate entries or is empty (the
  fix-4 equivalence breaks) — verify with
  `rg -A5 'fkas:|tkas:|guen:|fkab:|fkse:|elma:' packages/ui/src/theme/tokens/themes.ts`.
- Adding `dependsOn` to the root `test` task creates a turbo cycle or materially slows the
  inner-loop test run (>30s added on a warm cache) — report measured timings.
- Any existing test fails after Step 4 beyond a first reasonable fix attempt.

## Maintenance notes

- If a future density artifact gains a second consumer outside docs, revisit whether the
  `skipIf` guards should become hard failures instead.
- `resolvePinnedSegment` is now the single runtime home of the segment-pin rule; if a third
  caller appears, consider exporting it (with the pin-table SAFETY comment) rather than
  re-inlining checks.
- Reviewers should scrutinize that Step 4 changed no diagnostic message strings — hosts
  may match on them (`pinnedSegmentError`/`pinnedSegmentWarning` feed dev-mode output).
