# Plan 006: Synchronize theme preferences after local-storage clears

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in Step 2. Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/theme/theme-provider.tsx' 'packages/ui/src/theme/use-color-scheme.browser.test.tsx' '.changeset/theme-storage-events.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 6
- **Status**: DONE

## Why this matters

`ThemeProvider` listens for `storage` events so a color-scheme choice made in one tab reaches every other open tab. The listener has two gaps:

1. `localStorage.clear()` in another tab fires a `storage` event with `key: null`. The listener compares `event.key` to the configured key and returns, so the mounted tab keeps showing the cleared preference instead of falling back to `defaultColorScheme`.
2. The listener never checks `event.storageArea`. A `sessionStorage` write under the same key (from any script on the origin) is applied as if it were a persisted preference.

After this plan, only `localStorage` events are honored, a whole-store clear restores the configured fallback (or whatever was written after the clear), and none of this writes back to storage.

## Current state

Whitespace is condensed in some excerpts. Line numbers are at commit `f14057be`.

**The listener to change**, [packages/ui/src/theme/theme-provider.tsx:116-139](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/theme-provider.tsx:116):

```tsx
useEffect(() => {
  store.markMounted();
  store.hydratePreference(readStoredColorScheme(options.storageKey, options.defaultColorScheme));
  store.recoverDocument();

  const onStorage = (event: StorageEvent) => {
    if (event.key !== options.storageKey) {
      return;
    }
    store.receivePreference(parseColorScheme(event.newValue, options.defaultColorScheme));
  };
  // ... onMedia, addEventListener("storage", onStorage), cleanup
}, [options.defaultColorScheme, options.enableSystem, options.storageKey, store]);
```

`parseColorScheme` and `readStoredColorScheme` are already imported in this file from `./color-scheme` (lines 15-22). Their definitions, [packages/ui/src/theme/color-scheme.ts:99-130](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/color-scheme.ts:99):

```ts
export function parseColorScheme(value: string | null | undefined, fallback: ColorScheme): ColorScheme;
export function readStoredColorScheme(storageKey: string, fallback: ColorScheme): ColorScheme {
  try {
    return parseColorScheme(localStorage.getItem(storageKey), fallback);
  } catch {
    return parseColorScheme(null, fallback);
  }
}
```

`readStoredColorScheme` already swallows a throwing `localStorage` getter, so re-reading after a clear is safe in sandboxed documents.

**The store methods**, [packages/ui/src/theme/color-scheme-runtime.ts:201-215](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/color-scheme-runtime.ts:201):

```ts
setPreference(next) {
  preference = parseColorScheme(next, config.defaultColorScheme);
  writeStoredColorScheme(config.storageKey, preference);   // persists
  if (activeForce() === undefined) { writeResolvedNow(); }
  emit();
},
receivePreference(next) {
  preference = parseColorScheme(next, config.defaultColorScheme);   // no storage write
  if (activeForce() === undefined) { writeResolvedNow(); }
  emit();
},
```

`receivePreference` is the only correct target for storage-originated updates: it updates state and the document without writing back to storage. Using `setPreference` from the listener would re-persist the fallback into a store the user just cleared. Both methods take a `ColorScheme`, so the listener must parse before calling. When a force (mount-level `forcedColorScheme` or a descendant `ForceColorScheme`) is active, the preference is recorded but the document keeps the forced value until the force is released; do not change that.

**Test exemplar**, [packages/ui/src/theme/use-color-scheme.browser.test.tsx:132-151](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/use-color-scheme.browser.test.tsx:132):

```tsx
it("applies storage and media events in the same turn", async () => {
  const media = stubPrefersColorScheme(false);
  window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
  const { host } = render(
    <ThemeProvider theme={fkasPrivate}>
      <ColorSchemeOutput />
    </ThemeProvider>
  );
  await mountedColorScheme(host, "internal-fkas-private:system/light");
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
      newValue: "dark",
      storageArea: window.localStorage,
    })
  );
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  await mountedColorScheme(host, "internal-fkas-private:dark/dark");
  // ...
});
```

Fixture facts (from [packages/ui/test/theme-browser-fixtures.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/test/theme-browser-fixtures.tsx)):

- `ColorSchemeOutput` renders `<output>{theme.slug}:{colorScheme}/{resolvedColorScheme ?? "pending"}</output>`. With `fkasPrivate` the slug is `internal-fkas-private`, so the expected strings look like `internal-fkas-private:system/light`.
- `mountedColorScheme(host, expected)` polls that `<output>` text.
- `stubPrefersColorScheme(false)` pins the system scheme to light. **Every test whose expected preference is `system` must call it first**, otherwise the resolved half of the string depends on the machine running the tests.
- `ColorSchemeSetter` renders a button that calls `setColorScheme(value)`.
- The suite's `afterEach` (lines 28-42) clears `window.localStorage` and `window.sessionStorage`, then calls `vi.unstubAllEnvs()` and `vi.restoreAllMocks()`. Note the order: storage is cleared **before** mocks are restored. A test that stubs the `window.localStorage` getter to throw must restore that stub itself before returning, or `afterEach` will throw.
- The existing force exemplar is `"keeps storage and media updates hidden while a descendant force is active"` (lines 435-467): it wraps `ColorSchemeOutput` in `<ForceColorScheme value="dark">`, dispatches a storage event, and asserts the output shows the new preference with the forced resolved value (`internal-fkas-private:system/dark`) while `data-theme` stays `dark`.

Repository conventions: React 19, TypeScript, colocated Vitest browser tests in `*.browser.test.tsx` (see [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md), "Tests and demos"). Tests assert rendered output and document attributes, never implementation source text. Every PR that changes published behavior needs a changeset ([docs/spec/release.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/release.md) §2). Reference files outside Scope are read-only.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose              | Command                                                                                                       | Expected on success                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx` | All selected tests run and pass after implementation |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                                    | Exit 0                                               |
| Lint                 | `pnpm lint`                                                                                                   | Exit 0, no warnings                                  |
| Full completion gate | `pnpm ci:checks`                                                                                              | Exit 0                                               |

Browser tests start Chromium through `@vitest/browser-playwright` and need permission to bind a local port. `pnpm ci:checks` runs `oxfmt --check` and then the turbo `ci:checks` fan-out (lint, repo-policy tests, type-check, unit, browser, packed-consumer and type tests, build, package:check, size-limit). Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. The UI test configuration allows no-test runs, so exit 0 alone is insufficient: confirm `use-color-scheme.browser.test.tsx` and the new case names appear in the report. Builds and the full gate can regenerate files. Generated changes are allowed only within Scope; stop if unrelated committed artifacts change. Standard ignored build/test outputs are permitted.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/theme/theme-provider.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/theme-provider.tsx) — only the `onStorage` listener inside the `useEffect` at lines 116-139.
- [packages/ui/src/theme/use-color-scheme.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/use-color-scheme.browser.test.tsx)
- [.changeset/theme-storage-events.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/theme-storage-events.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope:** Do not touch `color-scheme-runtime.ts` (store API, force stack), `color-scheme.ts` (storage helpers, bootstrap serialization), `color-scheme-script.tsx`, theme tokens, document density, or any public prop or type. Do not add a `key === null` branch anywhere except the `onStorage` listener.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/theme-storage-events` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: synchronize theme preferences after local-storage clears`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Read the cited listener, store methods, and test exemplar.

**Verify**: `git rev-parse --short HEAD && git status --short`, followed by `git diff --stat f14057be..HEAD -- 'packages/ui/src/theme/theme-provider.tsx' 'packages/ui/src/theme/use-color-scheme.browser.test.tsx' '.changeset/theme-storage-events.md' 'plans/README.md'`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave the excerpts above applicable. Pre-existing changes are recorded and untouched. Stop if the `onStorage` listener no longer matches the excerpt.

### Step 2: Reproduce the two failures

Add two `it(...)` cases inside `describe("useColorScheme", ...)` in `use-color-scheme.browser.test.tsx`, directly after `"applies storage and media events in the same turn"`. Model both on that test. These synthetic events model what the browser delivers to _other_ documents; calling `window.localStorage.clear()` locally does not fire `storage` on this window, so the test clears storage and dispatches the event itself.

1. `"restores the configured fallback when another document clears local storage"`
   - `stubPrefersColorScheme(false)`; `window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark")`; render `<ThemeProvider theme={fkasPrivate}><ColorSchemeOutput /></ThemeProvider>`; `await mountedColorScheme(host, "internal-fkas-private:dark/dark")`.
   - `window.localStorage.clear()`, then dispatch `new StorageEvent("storage", { key: null, newValue: null, oldValue: null, storageArea: window.localStorage })`.
   - Expect `document.documentElement.getAttribute("data-theme")` to be `"light"` synchronously, `await mountedColorScheme(host, "internal-fkas-private:system/light")`, and `window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)` to be `null` (the fallback was not persisted).
2. `"ignores session-storage events that reuse the preference key"`
   - Same mount with `"dark"` stored; then dispatch `new StorageEvent("storage", { key: DEFAULT_COLOR_SCHEME_STORAGE_KEY, newValue: "light", storageArea: window.sessionStorage })`.
   - Expect `data-theme` to remain `"dark"` and `await mountedColorScheme(host, "internal-fkas-private:dark/dark")`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx`.

**Expected**: Exactly these two new cases fail (case 1 stays `dark/dark`; case 2 flips to `light/light`); every pre-existing case passes. If either new case passes before the implementation changes, the test is not exercising the bug: fix the test, do not proceed.

### Step 3: Filter by storage area and handle whole-store clears

Replace the `onStorage` listener in `theme-provider.tsx` (lines 121-126) with this shape. Keep it inside the same `useEffect`; do not change the dependency array, the other listeners, or the imports (both helpers are already imported).

```tsx
const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== options.storageKey) {
    return;
  }
  let localArea: Storage;
  try {
    localArea = window.localStorage;
  } catch {
    return; // storage inaccessible in this document; nothing to synchronize
  }
  if (event.storageArea !== localArea) {
    return; // sessionStorage, a null storageArea, or a foreign Storage object
  }
  if (event.key === null) {
    // Whole-store clear: re-read so a value written after the clear wins over the fallback.
    store.receivePreference(readStoredColorScheme(options.storageKey, options.defaultColorScheme));
    return;
  }
  store.receivePreference(parseColorScheme(event.newValue, options.defaultColorScheme));
};
```

Decisions this encodes; keep them:

- Events with `storageArea === null` are ignored. Real browser-generated `storage` events for `localStorage` always carry the receiving window's `localStorage` object as `storageArea` (HTML spec, "send a storage notification"), so strict identity is safe. Every existing test in the suite already passes `storageArea: window.localStorage`.
- Always `receivePreference`, never `setPreference`, so storage-originated updates do not write back to storage.
- No new exports, no changes to `color-scheme-runtime.ts`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx`.

**Expected**: The two Step 2 cases and every pre-existing case pass.

### Step 4: Cover edge cases and the force interaction

Add these cases to the same file. Put the first five in `describe("useColorScheme", ...)`; put the force case in `describe("forced color-scheme", ...)` after `"keeps storage and media updates hidden while a descendant force is active"`, modeled on it. Each case pins the system scheme with `stubPrefersColorScheme(false)` when a `system` preference is expected.

1. **Unrelated key**: mount with `"dark"`; dispatch `{ key: "other-key", newValue: "light", storageArea: window.localStorage }`; expect `dark/dark` unchanged.
2. **Null storageArea**: mount with `"dark"`; dispatch `{ key: DEFAULT_COLOR_SCHEME_STORAGE_KEY, newValue: "light", storageArea: null }`; expect `dark/dark` unchanged.
3. **Custom key and fallback**: render `<ThemeProvider theme={fkasPrivate} storageKey="app-color-scheme" defaultColorScheme="light">` with `window.localStorage.setItem("app-color-scheme", "dark")`; expect `dark/dark`; clear and dispatch the `key: null` local-storage event; expect `light/light` and `window.localStorage.getItem("app-color-scheme")` to be `null`.
4. **Clear followed by a newer write before delivery**: mount with `"dark"`; `window.localStorage.clear()`; `window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light")`; dispatch the `key: null` event; expect `light/light` (the re-read wins over the fallback).
5. **Inaccessible localStorage during event handling**: mount with `"dark"`; capture `const area = window.localStorage;` first; then `const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });`; dispatch `{ key: DEFAULT_COLOR_SCHEME_STORAGE_KEY, newValue: "light", storageArea: area }`; expect `dark/dark` unchanged; call `getter.mockRestore()` **before the test returns** (the suite's `afterEach` calls `window.localStorage.clear()` before `vi.restoreAllMocks()`). Vitest browser mode fails the test on an uncaught error, so an unchanged output is sufficient proof the throw was contained.
6. **Force preserved through a clear**: `stubPrefersColorScheme(false)`; store `"dark"`; render `<ThemeProvider theme={fkasPrivate}><ForceColorScheme value="light"><ColorSchemeOutput /></ForceColorScheme></ThemeProvider>`; expect `dark/light`; clear and dispatch the `key: null` local-storage event; expect `data-theme` still `"light"` and output `system/light`; then `window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)` is `null`.

Then create `.changeset/theme-storage-events.md` in the repository's changeset format (compare `.changeset/initial-release.md`):

```md
---
"@elmeragroup/ui": patch
---

`ThemeProvider` now follows `localStorage.clear()` from other tabs by restoring the configured `defaultColorScheme`, and ignores `sessionStorage` events that reuse the color-scheme key.
```

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx`.

**Expected**: All cases pass, including the 8 new ones (2 from Step 2, 6 here). No test leaves a throwing `localStorage` stub behind.

### Step 5: Complete verification and handoff

Run the completion commands below. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx`.

**Expected**: All targeted tests pass; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0.

**Verify**: `pnpm lint`.

**Expected**: Exit 0, no warnings.

**Verify**: `pnpm ci:checks`.

**Expected**: Exit 0 across the format check and every turbo `ci:checks` dependency.

## Test plan

All new tests live in `packages/ui/src/theme/use-color-scheme.browser.test.tsx`, modeled on `"applies storage and media events in the same turn"` (unforced) and `"keeps storage and media updates hidden while a descendant force is active"` (forced). Cases, by step: Step 2 adds the clear regression and the session-storage regression; Step 4 adds unrelated key, null `storageArea`, custom key and fallback, clear-then-newer-write, throwing `localStorage` getter, and clear under `ForceColorScheme`. Every case asserts through `ColorSchemeOutput`, `data-theme`, and `window.localStorage.getItem`, never through implementation text. Any test that stubs the `localStorage` getter restores it before returning.

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx` runs the file and passes every pre-existing case plus the 8 new ones.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/theme/use-color-scheme.browser.test.tsx`: all tests pass, the report names `use-color-scheme.browser.test.tsx`, and the 8 new case names appear.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: Exit 0.
- [ ] `pnpm lint`: Exit 0, no warnings.
- [ ] `pnpm ci:checks`: Exit 0.
- [ ] `grep -n "setPreference" packages/ui/src/theme/theme-provider.tsx` matches only the `setColorScheme` callback (one line), not the storage listener.
- [ ] `grep -n "storageArea" packages/ui/src/theme/theme-provider.tsx` returns at least one match.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no new changes outside Scope after accounting for the recorded baseline.
- [ ] `.changeset/theme-storage-events.md` exists and declares `"@elmeragroup/ui": patch`.
- [ ] Row 006 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report if:

- The `onStorage` listener or the store methods no longer match the excerpts in "Current state".
- A Step 2 regression passes before Step 3 is implemented and you cannot see why within one repair attempt.
- A verification step fails twice after one reasonable repair attempt.
- A pre-existing test in `use-color-scheme.browser.test.tsx` or `theme-provider.browser.test.tsx` starts failing because of the `storageArea` identity check (that would mean a real event path delivers a different `Storage` object; the design decision needs revisiting, not a looser check).
- `vi.spyOn(window, "localStorage", "get")` is rejected by Chromium in this environment (property not configurable). Report it and drop only case 5 rather than reaching for `Object.defineProperty` workarounds or an out-of-scope helper.
- A correct solution appears to require changing `color-scheme-runtime.ts`, `color-scheme.ts`, the force stack, or any public prop.

Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

## Maintenance notes

- Storage synchronization (`onStorage` -> `receivePreference`) and user-originated persistence (`setColorScheme` -> `setPreference`) are deliberately separate paths. A reviewer should confirm no storage-originated event reaches `setPreference`.
- The `key === null` branch re-reads storage instead of trusting the event payload. If a second storage-backed preference is ever added under the same provider, its clear handling needs to re-read its own key the same way.
- The strict `event.storageArea !== window.localStorage` check means synthetic events in downstream tests must pass `storageArea: window.localStorage`; jsdom-style events without a storage area are ignored by design.
- Deferred: the bootstrap script (`color-scheme-script.tsx`) reads storage once at first paint and is unaffected by runtime events; nothing to change there.
