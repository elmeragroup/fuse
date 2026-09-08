# Plan 003: Restore native reset for uncontrolled numeric TextField

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step. Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/text-field/text-field.tsx' 'packages/ui/src/components/text-field/text-field.browser.test.tsx' 'packages/ui/src/components/text-field/text-field-reset.browser.test.tsx' 'packages/ui/src/components/textarea-field/textarea-field.tsx' 'packages/ui/src/hooks/use-merged-refs.ts' 'apps/docs/src/app/(docs)/components/text-field/page.mdx' 'apps/docs/src/app/(docs)/components/text-field/api.json' '.changeset/numeric-text-field-reset.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any listed file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 3
- **Status**: TODO

## Why this matters

`filter="numeric"` makes an otherwise uncontrolled TextField internally controlled: the component stores the digits in `useState` and passes them to the inner input as `value`. Native form reset (a `<button type="reset">` or `form.reset()`) rewrites the DOM value, but React immediately re-asserts the stale `internalValue`, so the field keeps the edited digits and the submitted FormData is wrong. A Chromium reproduction used `defaultValue="123"`, typed `456`, clicked Reset, and still read `456`. Nonnumeric TextFields are natively uncontrolled and reset correctly; TextareaField already solves the same class of problem for its character counter, and this plan reuses that lifecycle.

## Current state

The following excerpts identify the implementation and its current behavior. Line numbers are from commit `f14057be`.

### The component

[packages/ui/src/components/text-field/text-field.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.tsx) — the composite. Facts that matter here:

- Line 3: `import { useEffect, useState } from "react";` — no `useLayoutEffect`, no `useMergedRefs` import yet.
- Lines 70–73: `TextFieldProps` is the documented props `& Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "name" | "className" | "disabled" | "readOnly" | "required">`. Because this is React 19, `ref` and `form` arrive as ordinary props inside that intersection.
- Lines 80–102: the destructuring pulls out the documented props plus `inputMode` and leaves everything else in `...props`. **`ref` is not destructured today**; it reaches the inner `<Input>` only through the `{...props}` spread at line 167.
- Lines 103–104:

```tsx
const isControlled = value !== undefined;
const [internalValue, setInternalValue] = useState(() => defaultValue ?? "");
```

- Lines 128–139:

```tsx
function handleChange(next: string): void {
  if (filter === "numeric" && next !== "" && !containsOnlyDigits(next)) {
    return;
  }
  if (filter === "numeric" && !isControlled) {
    setInternalValue(next);
  }
  onChange?.(next);
}

const resolvedValue = filter === "numeric" ? (isControlled ? value : internalValue) : value;
const resolvedDefaultValue = filter === "numeric" ? undefined : (defaultValue ?? undefined);
```

- Lines 157–173: the inner input.

```tsx
<Input
  name={name}
  value={resolvedValue}
  defaultValue={resolvedDefaultValue}
  onChange={(event) => {
    handleChange(event.currentTarget.value);
  }}
  placeholder={placeholder}
  inputMode={inputMode ?? (filter === "numeric" ? "numeric" : undefined)}
  // fieldGroup's default would override the input's w-full.
  className={cn(input(), variant ? fieldGroup() : null)}
  {...props}
  readOnly={isReadOnly}
  required={isRequired}
  hidden={hidden}
  disabled={isDisabled}
/>
```

Contract to preserve: numeric filtering rejects nondigit edits without calling `onChange`; empty input is valid; `defaultValue` is the uncontrolled initial value and `null` is normalized to `""`/`undefined`; a parent-controlled `value` stays authoritative. Native reset is not an input edit, so it must not call `onChange`.

### The inner Input is not the place to fix this

[packages/ui/src/components/input/input.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/input/input.tsx) is a 25-line wrapper over `@base-ui/react/input`. Base UI's `FieldControl` (`node_modules/@base-ui/react/field/control/FieldControl.js`, around lines 89–110) simply forwards `value` when `value !== undefined` and `defaultValue` otherwise; it has no reset listener. The stale value therefore comes from TextField's own state, and the fix belongs in TextField.

### The exemplar to copy

[packages/ui/src/components/textarea-field/textarea-field.tsx:56-80](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/textarea-field/textarea-field.tsx:56) already implements the reset lifecycle for its counter. Copy this shape:

```tsx
  ref,
  ...props
}: TextareaFieldProps): ReactElement {
  const isControlled = value !== undefined;
  const [uncontrolledLength, setUncontrolledLength] = useState(() => (defaultValue ?? "").length);
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
  const mergedRef = useMergedRefs(ref, setTextarea);
  const formId = props.form;
  useLayoutEffect(() => {
    const form = textarea?.form;
    if (!textarea || !form || isControlled) return;
    const control = textarea;
    let subscribed = true;
    function handleReset(event: Event): void {
      // A task runs after native reset, including reset-button default actions.
      setTimeout(() => {
        if (subscribed && !event.defaultPrevented) setUncontrolledLength(control.value.length);
      });
    }
    form.addEventListener("reset", handleReset);
    return () => {
      subscribed = false;
      form.removeEventListener("reset", handleReset);
    };
  }, [textarea, isControlled, formId]);
```

It passes `ref={mergedRef}` to the inner `<Textarea>` (line 110). Three details are load-bearing: the element is captured with a `useState` setter (a stable callback ref, so the effect re-runs when the node appears), `props.form` is a dependency so a changed `form` attribute re-subscribes to the new owner form, and the deferred write checks both `event.defaultPrevented` and the `subscribed` flag. The one thing **not** to copy is the value source: the textarea reads `control.value` after the native reset because the textarea is natively uncontrolled. The numeric input is controlled by React, so after reset its DOM value is whatever React last wrote, not the default. Restore from the latest `defaultValue ?? ""` prop instead.

[packages/ui/src/hooks/use-merged-refs.ts:30](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-merged-refs.ts:30): `export function useMergedRefs<T>(first: InputRef<T>, second: InputRef<T>): RefCallback<T> | null`. It handles object refs, callback refs, React 19 ref cleanups, and `null`/`undefined`. Do not modify it.

### Test exemplar

[packages/ui/src/components/textarea-field/textarea-reset.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/textarea-field/textarea-reset.browser.test.tsx) is the structural pattern: a `for` loop over default values `["Original", ""]` × reset methods `["button", "programmatic"]`, a canceled-reset + unmount case that spies on `form.removeEventListener`, and a controlled-parent case. It uses `renderThemed as render` from [packages/ui/test/themed-browser-render.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/test/themed-browser-render.tsx), whose return value spreads the `vitest-browser-react` render result, so `host` and `unmount` are available. It wraps the tree in `withLocale("en-US", …)` because TextareaField renders localized copy; TextField has none, so `withLocale` is optional here. The existing [text-field.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.browser.test.tsx) imports `../../../dist/styles.css` and `./text-field`; either the relative import or `@elmeragroup/ui/text-field` (the textarea test's style) is acceptable for the new file.

### Conventions and docs

The repository uses React 19, TypeScript, package subpath exports, and colocated Vitest tests. Read [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md) — its line 3 says "Component behavior lives in the implementation, public JSDoc, authored docs pages, and co-located tests. Update them together. … Add a changeset when the published package changes." [docs/spec/accessibility.md:9](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md:9): "the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings." Tests should exercise rendered behavior, not copy the implementation into an assertion. Reference files outside Scope are read-only.

**Generated artifact trap.** [apps/docs/src/app/(docs)/components/text-field/api.json](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/text-field/api.json>) is generated from `TextFieldProps` JSDoc by `pnpm --filter docs generate`, committed, and drift-checked by `apps/docs/test/api-artifact.test.ts` (which runs under `pnpm ci:checks`). If you change the JSDoc on `defaultValue` or `filter` in text-field.tsx, you must run `pnpm --filter docs generate` and commit the regenerated `api.json`; never hand-edit it. If you leave JSDoc untouched, `api.json` must not change. Do not add a new docs demo — that would also require editing `apps/docs/test/fixtures/component-demo-requirements.json`, which is out of scope; document the behavior in prose on `page.mdx` instead.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose                      | Command                                                                                                                                                                                                                                           | Expected on success                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| UI build (test prerequisite) | `pnpm --filter @elmeragroup/ui build`                                                                                                                                                                                                             | Exit 0; `packages/ui/dist/styles.css` exists                                                                                              |
| Targeted tests               | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx` | All three files appear in the report; all tests pass after implementation                                                                 |
| Regenerate API artifacts     | `pnpm --filter docs generate`                                                                                                                                                                                                                     | Exit 0; only run if JSDoc in text-field.tsx changed                                                                                       |
| UI type check                | `pnpm --filter @elmeragroup/ui type-check`                                                                                                                                                                                                        | Exit 0                                                                                                                                    |
| Lint                         | `pnpm lint`                                                                                                                                                                                                                                       | Exit 0, no warnings (`oxlint . --deny-warnings`)                                                                                          |
| Full completion gate         | `pnpm ci:checks`                                                                                                                                                                                                                                  | Exit 0 (format check, then turbo: lint, repo policy, type-check, unit, browser, packed consumer, types, build, package check, size-limit) |

The targeted test command calls vitest directly, bypassing turbo's `test:browser → build` dependency, and `text-field.browser.test.tsx` imports `../../../dist/styles.css`. Build first (or after any pull) or the suite fails on a missing file, not on your code. Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. `packages/ui/vitest.config.ts` sets `passWithNoTests: true`, so exit 0 alone is insufficient: confirm the three named files and the new case names appear in the report. Builds and the full gate write only to ignored outputs (`dist/`, `.next/`, `.artifacts/`); stop if a committed file outside Scope changes.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/components/text-field/text-field.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.tsx)
- [packages/ui/src/components/text-field/text-field.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.browser.test.tsx) (only if an existing case needs adjusting; expected unchanged)
- [packages/ui/src/components/text-field/text-field-reset.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field-reset.browser.test.tsx) (create)
- [apps/docs/src/app/(docs)/components/text-field/page.mdx](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/text-field/page.mdx>)
- [apps/docs/src/app/(docs)/components/text-field/api.json](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/text-field/api.json>) — **generated only**, via `pnpm --filter docs generate`, and only if JSDoc changed
- [.changeset/numeric-text-field-reset.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/numeric-text-field-reset.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope:** Do not edit `Input`, `FieldFrame`, `TextareaField`, `use-merged-refs.ts`, the phone-number field or its state machine (plan 011 owns its reset), shared hooks, filters beyond the existing numeric mode, the public `TextFieldProps` type (adding or removing props), controlled/uncontrolled switching semantics, `component-demo-requirements.json`, or any new demo file. No reusable form-reset abstraction in this plan — inline the lifecycle in TextField like TextareaField does.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/numeric-text-field-reset` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: restore native reset for uncontrolled numeric TextField`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline, build, and scope

Confirm the tool versions above, record the worktree status, run the drift check, and build the UI package so `dist/styles.css` exists. Read text-field.tsx, textarea-field.tsx lines 56–80, and textarea-reset.browser.test.tsx in full. Confirm text-field.tsx still matches the excerpts (no `ref` destructuring, `internalValue` state, `resolvedValue`/`resolvedDefaultValue`).

**Verify**: `git rev-parse --short HEAD && git status --short`, then the drift check command from the top of this plan, then `pnpm --filter @elmeragroup/ui build && ls packages/ui/dist/styles.css`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave these excerpts and contracts applicable. Pre-existing changes are recorded and untouched. Build exits 0 and the file is listed. Stop if the implementation materially differs.

### Step 2: Add reset regressions

Create `packages/ui/src/components/text-field/text-field-reset.browser.test.tsx` patterned on textarea-reset.browser.test.tsx. Render a real `<form>` containing `<TextField label="Digits" name="digits" filter="numeric" defaultValue={defaultValue} onChange={onChange} />` and `<button type="reset">Reset</button>`. Loop over `defaultValue` in `["123", "", undefined, null]` and reset method in `["button", "programmatic"]` (`host.querySelector("form")?.reset()`). For each: `userEvent.fill` the textbox with `"456"`, assert it shows `456`, record `onChange.mock.calls.length`, reset, then `await expect.element(textbox).toHaveValue(expected)` where `expected` is `defaultValue ?? ""`, assert `new FormData(form).get("digits")` equals `expected`, and assert the `onChange` call count did not increase. Use awaited `expect.element` assertions, never fixed sleeps.

Also add one contrast case in the same file: a nonnumeric `<TextField name="plain" defaultValue="abc" />` in a form resets to `abc` today. It must pass before and after the change (it proves the plain path is untouched).

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx`.

**Expected**: The new uncontrolled numeric reset cases fail because the textbox still holds `456`; the nonnumeric contrast case, the existing TextField suite, and the textarea suite pass. If the numeric cases already pass, STOP: the bug no longer reproduces and the plan is stale.

### Step 3: Wire the uncontrolled numeric reset lifecycle

In text-field.tsx:

1. Change the React import to `import { useEffect, useLayoutEffect, useState } from "react";` and add `import { useMergedRefs } from "../../hooks/use-merged-refs";`.
2. Add `ref,` to the destructuring in `TextField({ … })` immediately before `...props` so the spread can no longer overwrite the merged ref.
3. After the `internalValue` state, add the lifecycle. Target shape:

```tsx
const [inputElement, setInputElement] = useState<HTMLInputElement | null>(null);
const mergedRef = useMergedRefs(ref, setInputElement);
const formId = props.form;
const ownsNumericState = filter === "numeric" && !isControlled;
useLayoutEffect(() => {
  const form = inputElement?.form;
  if (!inputElement || !form || !ownsNumericState) return;
  let subscribed = true;
  function handleReset(event: Event): void {
    // A task runs after native reset, including reset-button default actions.
    setTimeout(() => {
      if (subscribed && !event.defaultPrevented) setInternalValue(defaultValue ?? "");
    });
  }
  form.addEventListener("reset", handleReset);
  return () => {
    subscribed = false;
    form.removeEventListener("reset", handleReset);
  };
}, [inputElement, ownsNumericState, formId, defaultValue]);
```

`defaultValue` is in the dependency list so the deferred write always restores the latest prop; re-subscribing on a `defaultValue` change is harmless because the effect only adds a listener. If lint (`react-hooks/exhaustive-deps` or the repo's oxlint rules) complains about the dependency list, satisfy the rule rather than disabling it. 4. Pass `ref={mergedRef}` on the `<Input>`. Place it before `{...props}` or after — `ref` is no longer in `props`, so position does not matter, but keep the existing order of the other attributes.

Do not call `onChange` from the reset path. Do not touch `handleChange`, `resolvedValue`, or `resolvedDefaultValue`. Nonnumeric and parent-controlled fields must have no listener attached (`ownsNumericState` false).

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx`.

**Expected**: All Step 2 cases and the existing TextField/textarea suites pass. No React warnings about switching between controlled and uncontrolled.

### Step 4: Prove cancellation, cleanup, defaults, refs, and document

Add these cases to text-field-reset.browser.test.tsx, modeled on the textarea file's second and third tests:

- **Canceled reset + unmount**: `<form onReset={(e) => e.preventDefault()}>`; fill `456`, `form.reset()`, assert the textbox still shows `456`; spy on `form.removeEventListener`, `unmount()`, assert a `"reset"` removal happened.
- **Controlled parent**: a fixture holding `useState("123")` and passing `value`/`onChange`; after `form.reset()` the textbox still shows the edited digits and `onChange` was not called again.
- **External form association**: render `<form id="outer"><button type="reset">Reset</button></form>` with the TextField rendered _outside_ the form but with `form="outer"`; reset via the button and assert the default is restored.
- **Reassociation**: render with `form="a"`, use `rerender` to switch to `form="b"`, reset form `b`, assert restore; reset form `a` afterwards and assert no change.
- **Unmount before the deferred write**: fill, call `form.reset()`, `unmount()` synchronously, then `await` a macrotask (`await new Promise((r) => setTimeout(r))`) and assert no console error or React "state update on unmounted component" warning was emitted (spy on `console.error`).
- **Latest defaultValue**: render with `defaultValue="123"`, fill `456`, `rerender` with `defaultValue="789"`, assert the textbox still shows `456` (a prop change alone must not erase an edit), then reset and assert `789`.
- **Refs**: an object ref (`createRef<HTMLInputElement>()`) and a callback ref (`vi.fn()`) both receive the `<input>` element; the callback ref is called with `null` (or its cleanup runs) on unmount.

Then document the behavior: in `page.mdx`, extend the `<Prose>` paragraph that describes `filter="numeric"` with one sentence stating that an uncontrolled numeric field restores its `defaultValue` on native form reset without calling `onChange`. Optionally tighten the `defaultValue` JSDoc in text-field.tsx to say the same; if you do, run `pnpm --filter docs generate` and include the regenerated `api.json`.

Create `.changeset/numeric-text-field-reset.md`:

```md
---
"@elmeragroup/ui": patch
---

`TextField` with `filter="numeric"` now restores its `defaultValue` on native form reset instead of keeping the edited digits. `onChange` is not called for the reset.
```

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx`.

**Expected**: All reset, cancellation, association, ref, and default cases pass without extra `onChange` calls or console errors.

### Step 5: Complete verification and handoff

Run the completion commands below. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline; the only changed or new paths are those in Scope. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx`.

**Expected**: All three files appear in the report and pass; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0.

**Verify**: `pnpm lint`.

**Expected**: Exit 0, no warnings.

**Verify**: `pnpm ci:checks`.

**Expected**: Exit 0. This includes `apps/docs/test/api-artifact.test.ts`, which fails if `api.json` is stale relative to the JSDoc.

## Test plan

Use the browser's real `form.reset()` algorithm and reset-button default action plus `FormData`, not a manually dispatched `reset` event as the sole test. Use awaited `expect.element` assertions instead of fixed delays. Keep the existing invalid-digit rejection, numeric `inputMode`, and controlled-value cases in text-field.browser.test.tsx unchanged. New file: `packages/ui/src/components/text-field/text-field-reset.browser.test.tsx`, cases as listed in Steps 2 and 4. Structural exemplar: `packages/ui/src/components/textarea-field/textarea-reset.browser.test.tsx`.

**Final targeted verification**: the targeted test command must list all three files and pass every existing and newly specified case.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/text-field/text-field.browser.test.tsx src/components/text-field/text-field-reset.browser.test.tsx src/components/textarea-field/textarea-reset.browser.test.tsx`: all three files reported, all tests pass, no unhandled errors.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: exit 0.
- [ ] `pnpm lint`: exit 0, no warnings.
- [ ] `pnpm ci:checks`: exit 0.
- [ ] `text-field-reset.browser.test.tsx` exists and contains the Step 2 matrix plus every Step 4 case.
- [ ] `grep -n "useMergedRefs\|useLayoutEffect" packages/ui/src/components/text-field/text-field.tsx` returns matches; `grep -n "ref," packages/ui/src/components/text-field/text-field.tsx` shows `ref` destructured before `...props`.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no paths outside Scope after accounting for the recorded baseline. `api.json` appears only if JSDoc changed, and then only via `pnpm --filter docs generate`.
- [ ] `.changeset/numeric-text-field-reset.md` declares `"@elmeragroup/ui": patch`.
- [ ] Row 003 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report if:

- The current-state code has materially drifted: `ref` is already destructured, a reset listener already exists, or `internalValue`/`resolvedValue` are gone.
- The Step 2 numeric regressions pass before any implementation change (bug no longer reproduces).
- A verification step fails twice after one reasonable repair attempt.
- Base UI's `Input`/`FieldControl` turns out to swallow or reassign `ref` so the merged ref never receives the `<input>` element — that would require changing the `Input` wrapper, which is out of scope.
- Merging refs breaks callback-ref cleanup (the Step 4 ref case fails) and the fix would need changes to `use-merged-refs.ts`.
- Making reset work requires calling `onChange`, changing a parent-controlled value, or altering the numeric filter or `defaultValue` normalization contract.
- `pnpm ci:checks` fails on `api-artifact.test.ts` after running `pnpm --filter docs generate`, or regeneration changes any `api.json` other than text-field's.

Do not weaken assertions, skip a gate, suppress a lint rule, or update unrelated snapshots to make verification pass. Do not absorb the phone-number field's reset (plan 011) into this implementation.

## Maintenance notes

- Any future component that keeps internal React state for a native form control needs the same reset boundary: subscribe to `element.form` on `reset`, defer one task, check `defaultPrevented` and a live flag, and restore from props rather than from the controlled DOM value.
- Reviewers should check that the listener is attached only when `filter === "numeric" && value === undefined`, that `ref` is destructured so `{...props}` cannot clobber `mergedRef`, and that no `onChange` call exists in the reset path.
- Deferred on purpose: a shared `useFormReset` hook. Two inline copies (TextareaField, TextField) plus plan 011's phone field would make three; extract only after 011 lands and the shapes are known to agree.
