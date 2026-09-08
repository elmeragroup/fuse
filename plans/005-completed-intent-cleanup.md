# Plan 005: Unregister predictive intent after its callback fires

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step. Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/hooks/use-predicted-events.ts' 'packages/ui/src/components/button/button.browser.test.tsx' '.changeset/completed-intent-cleanup.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 5
- **Status**: TODO

## Why this matters

A Button's onIntent fires once, but its registration stays in the shared registry until unmount, so every prediction-bearing pointer move still calls `getBoundingClientRect()` on it (a forced layout read) and keeps the document `pointermove` listener alive even when every registration has already fired. Work grows with mounted intent buttons after all callbacks have finished. Remove a registration the moment it fires, without changing callback semantics.

## Current state

The following excerpts identify the implementation and its current behavior. Whitespace is condensed in some excerpts.

[packages/ui/src/hooks/use-predicted-events.ts:44](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:44):

```tsx
for (const registration of [...registrations]) {
  const element = registration.getElement();
  if (element === null) {
    continue;
  }
  const rect = element.getBoundingClientRect();
```

[packages/ui/src/hooks/use-predicted-events.ts:96](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:96):

```tsx
onIntent: () => {
  if (firedRef.current) {
    return;
  }
  firedRef.current = true;
  onIntentRef.current?.();
},
```

[packages/ui/src/hooks/use-predicted-events.ts:63](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:63):

```tsx
function unregisterIntent(registration: IntentRegistration): void {
  registrations.delete(registration);
  if (registrations.size === 0) {
    document.removeEventListener("pointermove", onDocumentPointerMove);
  }
}
```

Behavior to preserve: onIntent fires once per mounted hook (`firedRef`, line 80); changing callback identity does not rearm it; the effect at line 88 skips registration entirely when `firedRef.current` is already true, so a props change after firing never re-registers. Disabled/pending/visually disabled buttons do not register: [packages/ui/src/components/button/button.tsx:67-72](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/button/button.tsx:67) passes `enabled: !disabled && !isPending && !isVisuallyDisabled && onIntent !== undefined`. Multiple active buttons share at most one document pointermove listener. Preserve latest callback lookup through onIntentRef and caller ref composition.

The documented contract is [docs/spec/performance.md:143](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/performance.md:143): "one package-private registry installs at most one document `pointermove` listener while at least one `onIntent` registration exists and removes it when the registry empties. `usePredictedEvents` and `useMergedRefs` are not public." This plan makes the registry empty sooner; it does not change that contract, so the spec needs no edit.

Match the existing pattern in [packages/ui/src/components/button/button.browser.test.tsx:140](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/button/button.browser.test.tsx:140):

```tsx
const liveButton = buttonNamed("Prefetch");
const rect = liveButton.getBoundingClientRect();
const x = rect.left + rect.width / 2;
const y = rect.top + rect.height / 2;

dispatchPredictedPointer(x, y);
dispatchPredictedPointer(x, y);
expect(live).toHaveBeenCalledTimes(1);
```

The repository uses React 19, TypeScript, package subpath exports, and colocated Vitest tests. Read [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md) for implementation conventions; it requires a changeset when the published package changes. `renderThemed` (from `packages/ui/test/themed-browser-render.tsx`) returns `{ host, rerender, unmount }` and auto-unmounts in `afterEach`, so registrations never leak between tests. Tests should exercise rendered behavior, not copy the implementation into an assertion. Reference files outside Scope are read-only.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose              | Command                                                                                                         | Expected on success                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx` | All selected tests run and pass after implementation |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                                      | Exit 0                                               |
| Lint                 | `pnpm lint`                                                                                                     | Exit 0, no warnings                                  |
| Full completion gate | `pnpm ci:checks`                                                                                                | Exit 0                                               |

`button.browser.test.tsx` imports `../../../dist/styles.css`, and `packages/ui/dist` is gitignored. In a fresh checkout or worktree run `pnpm --filter @elmeragroup/ui build` once before the targeted test command (the turbo `test:browser` task does this automatically; the bare `vitest run` does not). A "Failed to resolve import ../../../dist/styles.css" error means the build is missing, not that the test is wrong.

Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. The UI test configuration allows no-test runs, so exit 0 alone is insufficient: confirm the named files and expected new cases appear in the report. Builds and the full gate can regenerate files. Generated changes are allowed only within Scope; stop if unrelated committed artifacts change. Standard ignored build/test outputs are permitted.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/hooks/use-predicted-events.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts)
- [packages/ui/src/components/button/button.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/button/button.browser.test.tsx)
- [.changeset/completed-intent-cleanup.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/completed-intent-cleanup.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope:** Do not change prediction geometry, supported browser behavior, Button props, callback rearming, render/ref APIs, or shared pointer listener architecture. No new event manager, throttle, debounce, or benchmark project.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/completed-intent-cleanup` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `perf: unregister predictive intent after its callback fires`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Read the cited implementation and test exemplar. Compare actual behavior with the stated contract before writing the regression.

**Verify**: `git rev-parse --short HEAD && git status --short`, followed by `git diff --stat f14057be..HEAD -- 'packages/ui/src/hooks/use-predicted-events.ts' 'packages/ui/src/components/button/button.browser.test.tsx' '.changeset/completed-intent-cleanup.md' 'plans/README.md'`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave these excerpts and contracts applicable. Pre-existing changes are recorded and untouched. Stop if the implementation materially differs.

### Step 2: Measure completed registrations in the browser test

Add a new `it` case next to the existing "fires onIntent once from a predicted path" test rather than lengthening it. Shape:

1. Render one `<Button onIntent={live}>Prefetch</Button>`, `await flushEffects()`, compute the center point from `buttonNamed("Prefetch").getBoundingClientRect()` as the existing test does.
2. `const measure = vi.spyOn(liveButton, "getBoundingClientRect")` (instance spy; it calls through, so geometry is unchanged) and `const remove = vi.spyOn(document, "removeEventListener")`.
3. `dispatchPredictedPointer(x, y)` once; expect `live` called once and `remove.mock.calls.filter((call) => call[0] === "pointermove")` to have length >= 1 (the only registration fired, so the registry is empty and the listener must be gone).
4. `measure.mockClear()`, then dispatch two more matching predictions; expect `measure` not called and `live` still called once.
5. `measure.mockRestore(); remove.mockRestore();` at the end of the case (the file already restores its `addEventListener` spy the same way).

Prefer asserting the listener is gone over asserting an exact `removeEventListener` call count: after Step 3 the effect cleanup on unmount also calls `unregisterIntent`, and Step 3 must make that call a no-op rather than a second removal.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx`.

**Expected**: The new case fails on current code at sub-steps 3 and 4 (listener still attached, `measure` still called after the callback fired); every pre-existing Button case passes.

### Step 3: Unregister before invoking consumer code

Two edits in `use-predicted-events.ts`, nothing else:

1. In the `onIntent` closure inside the effect (line 96), unregister before invoking consumer code:

```tsx
onIntent: () => {
  if (firedRef.current) {
    return;
  }
  firedRef.current = true;
  unregisterIntent(registration);
  onIntentRef.current?.();
},
```

`registration` is the `const` declared on line 93; referencing it from its own closure is fine because the closure only runs after the object exists.

2. Make `unregisterIntent` idempotent so the effect cleanup (line 107) running after an already-fired registration is a true no-op instead of calling `removeEventListener` a second time whenever the registry happens to be empty. (Today's code is not incorrect here, since `Set.delete` on a missing entry is a no-op and a duplicate `removeEventListener` is harmless, but the guard keeps the listener bookkeeping exact and keeps the Step 2 spy assertions unambiguous.)

```tsx
function unregisterIntent(registration: IntentRegistration): void {
  if (!registrations.delete(registration)) {
    return;
  }
  if (registrations.size === 0) {
    document.removeEventListener("pointermove", onDocumentPointerMove);
  }
}
```

Keep the effect cleanup call. Do not reset `firedRef` on props changes. Keep the `[...registrations]` snapshot iteration in `onDocumentPointerMove`: deleting from the live Set during iteration would be legal, but the snapshot is also what keeps a callback that unmounts a sibling from skipping entries.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx`.

**Expected**: The new cleanup assertions and existing Button tests pass.

### Step 4: Cover remaining registrations and reentrant teardown

Add these cases to `button.browser.test.tsx`, each as its own `it`:

- **Sibling keeps working**: mount `<Button onIntent={first}>First</Button>` and `<Button onIntent={second}>Second</Button>`; spy `addEventListener`/`removeEventListener` on `document` before rendering. Fire First's center point: `first` once, `second` not called, no `pointermove` removal yet (Second is still pending). Then fire Second's center: `second` once, and a `pointermove` removal has now happened. Spy First's `getBoundingClientRect` after its callback and prove it is not measured while Second's prediction is dispatched.
- **Unmount from inside the callback**: `const { unmount } = renderThemed(<Button onIntent={() => { calls += 1; unmount(); }}>Gone</Button>)` (declare `unmount` with `let` before rendering so the closure can reach it). Fire once, then dispatch the same point twice more: `calls === 1`, no error, and the button is no longer in the document. This exercises the effect cleanup calling `unregisterIntent` on an already-removed registration.
- **Callback replaced before the first hit**: render with `onIntent={stale}`, `rerender` with `onIntent={fresh}` (same children), `await flushEffects()`, fire once: `fresh` once, `stale` never. Then `rerender` with a third callback and fire again: the third is never called (no rearm).
- **Listener count does not accumulate**: with the `addEventListener` spy, render, `rerender` with a different `predictionZoneSize` before firing, fire, unmount: `pointermove` additions total 2 at most (initial + re-register on the zone-size change), and after unmount the additions and removals for `pointermove` balance.

Restore every spy in the case that created it. Then create `.changeset/completed-intent-cleanup.md` with frontmatter `"@elmeragroup/ui": patch` and one sentence such as: `Button` stops measuring a button and drops the shared `pointermove` listener as soon as its `onIntent` callback has fired, instead of at unmount. Follow the format of `.changeset/initial-release.md`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx`.

**Expected**: All Button cases pass; the sibling case shows the listener survives while a registration is pending and is removed only when the last one fires.

### Step 5: Complete verification and handoff

The scoped changeset must name `"@elmeragroup/ui": patch` and describe the consumer-visible result. Run the completion commands below. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx`.

**Expected**: All targeted tests pass; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0.

**Verify**: `pnpm lint`.

**Expected**: Exit 0, no warnings.

**Verify**: `pnpm ci:checks`.

**Expected**: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.

## Test plan

All new cases live in `packages/ui/src/components/button/button.browser.test.tsx`, modeled on the existing "fires onIntent once from a predicted path" and "shares one pointermove listener" cases. Reuse `dispatchPredictedPointer`, `buttonNamed`, and `flushEffects` from that file; do not add a separate hook test file (the hook is package-private and is exercised through Button). Cases, in order of Steps 2 and 4:

1. Fired registration is not remeasured and the listener is removed when it was the last one (Step 2).
2. A pending sibling keeps its listener and its first callback after another button fires (Step 4).
3. Unmounting from inside the callback is safe and does not double-remove (Step 4).
4. Callback replacement before the first hit uses the latest callback; no rearm afterwards (Step 4).
5. Listener additions and removals balance across a `predictionZoneSize` rerender and unmount (Step 4).

Count geometry reads only after the first callback, excluding fixture setup. Keep the existing disabled/pending/visually-disabled coverage untouched. Do not assert on source text or on `registrations` (it is not exported).

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx` must run the named suites and pass all existing and newly specified cases.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/button/button.browser.test.tsx`: All targeted tests pass; no unhandled errors or silent zero-test result.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: Exit 0.
- [ ] `pnpm lint`: Exit 0, no warnings.
- [ ] `pnpm ci:checks`: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.
- [ ] The new regression cases named in this plan exist and pass.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no new changes outside Scope after accounting for the recorded baseline.
- [ ] The scoped changeset declares `"@elmeragroup/ui": patch`.
- [ ] Row 005 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report if the current-state code has materially drifted, a verification step fails twice after one reasonable repair attempt, or a correct solution requires another file or public contract outside Scope. Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

STOP if fixing cleanup changes the once-per-mount promise, if the listener disappears while a pending registration remains, or if callbacks/ref cleanup regress. STOP if the Step 3 change appears to require exporting `registrations`, `registerIntent`, or `unregisterIntent`, or editing `button.tsx`, `use-merged-refs.ts`, or `docs/spec/performance.md`; none of those is in scope. STOP if the unmount-from-callback case throws inside React's `flushSync` (the existing `render` helper wraps `root.unmount()` in `flushSync`); report the error instead of switching the helper. Do not broaden scope into tuning pointer event prediction.

## Maintenance notes

Any future callback rearming feature needs an explicit contract and tests; today `firedRef` is the single source of "done" and the effect refuses to re-register once it is set. Unregister before invoking user code because that code can unmount, rerender, or throw. Reviewers should check that `unregisterIntent` early-returns when `delete` is false, so that every registration removes the listener at most once and spy-based listener accounting stays exact. Reviewers should also confirm `unregisterIntent(registration)` precedes `onIntentRef.current?.()`; reversing them lets a consumer callback that rerenders or unmounts observe a registration that is still live. Deferred on purpose: throttling or `requestAnimationFrame`-batching the per-move measurements for pending registrations; that is a separate performance change with its own budget question.
