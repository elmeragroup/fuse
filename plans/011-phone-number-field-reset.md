# Plan 011: Clear uncontrolled phone values on native form reset

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step. Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/phone-number-field/phone-number-field.tsx' 'packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts' 'packages/ui/src/components/phone-number-field/phone-reset.browser.test.tsx' 'apps/docs/src/app/(docs)/components/phone-number-field/page.mdx' '.changeset/phone-number-field-reset.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 11
- **Status**: TODO

## Why this matters

A clean Chromium reproduction confirms both form.reset() and a native reset button leave an uncontrolled PhoneNumberField's visible number and submitted values unchanged. Reset should clear an uncontrolled number. Controlled values must remain parent-owned.

## Current state

The following excerpts identify the implementation and its current behavior. Whitespace is condensed in some excerpts.

[packages/ui/src/components/phone-number-field/phone-number-field.tsx:307](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:307):

```tsx
<InputGroup.Input
  ref={numberInputRef}
  readOnly={isReadOnly}
  name={name ? `${name}-display-value` : "phone-number-display-value"}
  value={phone.displayValue}
```

[packages/ui/src/components/phone-number-field/phone-number-field.tsx:331](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:331):

```tsx
<input type="hidden" name={name} value={phone.outputValue} disabled={isDisabled} />
```

[packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:76](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:76):

```tsx
const [stored, setState] = useState<PhoneState>(() => ({
  configuration,
  value,
  accepted: receiveValue(value ?? "", resolveSelectedCountry(countries, defaultCountryCode), configuration),
  proposal: null,
}));
```

Other facts the implementation depends on, verified at `f14057be`:

- [use-phone-number-field-state.ts:40-49](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:40) declares `UsePhoneNumberFieldStateReturn` (`displayValue`, `outputValue`, `handleInputChange`, `selectCountry`, `handlePaste`, `selectedCountry`, `countries`, `getCountryName`). There is no reset transition anywhere in the hook or component.
- [use-phone-number-field-state.ts:85-88](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:85): `reconcile(stored, value, configuration)` returns `stored` unchanged when `value` and `configuration` are unchanged, so an uncontrolled field (`value === undefined`) keeps whatever `accepted`/`proposal` the store holds. `visibleSnapshot(state)` picks `proposal` when present and not rejected, else `accepted`.
- [use-phone-number-field-state.ts:91-97](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:91): `onCountryChange` fires from an effect only when `selectedCountry.code` differs from the last notified code. Keeping the same country on reset keeps this effect silent.
- [use-phone-number-field-state.ts:99-103](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:99): `propose` is the only path that calls `onChange`. Reset must not go through `propose`, `handleInputChange`, or `selectCountry`.
- [phone-field-state.ts:48](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-field-state.ts:48): `snapshot(next: ProcessedPhoneInput, configuration: PhoneConfiguration): PhoneSnapshot`, where `ProcessedPhoneInput` is `{ digits: string; country: PhoneNumberCountry }`. `snapshot` and `visibleSnapshot` are already imported by the hook (line 23).
- [phone-engine.ts:318-320](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-engine.ts:318): `resolvePhoneFieldValues` returns `{ displayValue: "", outputValue: "" }` for empty digits under every `outputFormat`, `international`, and `formatOnType` combination. After a reset, display, `${name}`, and `${name}-display-value` are therefore all `""` regardless of variant.
- [phone-number-field.tsx:176](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:176): `numberInputRef` is a plain `useRef<HTMLInputElement>(null)` whose only current use is focus restoration at line 222. `InputGroup.Input` ([input-group.tsx:142](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/input-group/input-group.tsx:142)) is a React 19 function component that spreads `ref` through `...props` to a native `<input>`, so a callback ref works there.
- The country Combobox is detached from the host form (`form="elmera-ui-phone-country-unbound"`, line 243), so native reset never touches Base UI's hidden country input; only the two inputs at lines 307 and 331 are React-controlled and stay stale.
- Why the values stay stale: React syncs the `value` attribute of controlled inputs with their React value, so the browser's native reset restores the input to the same string React last rendered. Only a React state change can clear it. Do not mutate DOM values directly; the next render would restore stale state.

The value prop is authoritative when defined. With value omitted, the component starts empty and owns its number. Plan policy: reset clears digits while preserving the currently selected country, including an auto-detected or user-selected country. This is a deliberate bounded choice, not a pre-existing documented reset contract. Reset must emit neither onChange nor onCountryChange. Reset is not a user edit, so `isReadOnly` and `isDisabled` do not block it: a native `readonly` or `disabled` input is reset by `form.reset()` too, and the textarea exemplar below does not gate on either flag. The public API has no defaultValue or form prop. Preserve the existing separate visible and hidden submission inputs.

Match the existing pattern in [packages/ui/src/components/textarea-field/textarea-field.tsx:64-79](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/textarea-field/textarea-field.tsx:64):

```tsx
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

Two details of that exemplar are load-bearing here. The element is held in `useState` through a callback ref (not read from `useRef.current` inside the effect) so the effect re-runs and resubscribes when React re-creates the input, for example when a parent moves the field into a different `<form>`. `useMergedRefs` lives at [packages/ui/src/hooks/use-merged-refs.ts:30](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-merged-refs.ts:30) and merges an object ref with a callback ref. The test exemplar for reset behavior is [packages/ui/src/components/textarea-field/textarea-reset.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/textarea-field/textarea-reset.browser.test.tsx): it loops over `["button", "programmatic"]`, counts `onChange` calls before reset and asserts the count is unchanged, cancels a reset with `<form onReset={(event) => event.preventDefault()}>`, and spies `removeEventListener` on unmount.

The docs page's API table is generated into `apps/docs/src/app/(docs)/components/phone-number-field/api.json` from the prop JSDoc in `phone-number-field.tsx`. That file is out of scope, so do not edit the `PhoneNumberFieldProps` JSDoc comments; document reset behavior in the page's `<Prose>` block instead.

The repository uses React 19, TypeScript, package subpath exports, and colocated Vitest tests. Read [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md) for implementation conventions and [docs/spec/accessibility.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md) for the owning accessibility contract. Its responsibility split says "the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings." Tests should exercise rendered behavior or tool results, not copy the implementation into an assertion. Reference files outside Scope are read-only.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose              | Command                                                                                                                                                                                                                                                                                                                                                     | Expected on success                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx` | All selected tests run and pass after implementation |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                                                                                                                                                                                                                                                                                  | Exit 0                                               |
| Lint                 | `pnpm lint`                                                                                                                                                                                                                                                                                                                                                 | Exit 0, no warnings                                  |
| Full completion gate | `pnpm ci:checks`                                                                                                                                                                                                                                                                                                                                            | Exit 0                                               |

Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. The UI test configuration allows no-test runs, so exit 0 alone is insufficient: confirm the named files and expected new cases appear in the report. Builds and the full gate can regenerate files. Generated changes are allowed only within Scope; stop if unrelated committed artifacts change. Standard ignored build/test outputs are permitted.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/components/phone-number-field/phone-number-field.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx)
- [packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts)
- [packages/ui/src/components/phone-number-field/phone-reset.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-reset.browser.test.tsx) (create)
- [apps/docs/src/app/(docs)/components/phone-number-field/page.mdx](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/phone-number-field/page.mdx>)
- [.changeset/phone-number-field-reset.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/phone-number-field-reset.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope:** Do not modify TextField, the shared phone parsing engine, metadata, form field names, output formats, country detection, public props, or controlled proposal acceptance. Do not add defaultValue, a form association prop, or a shared reset abstraction.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/phone-number-field-reset` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: clear uncontrolled phone values on native form reset`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Read the cited implementation and test exemplar. Compare actual behavior with the stated contract before writing the regression.

**Verify**: `git rev-parse --short HEAD && git status --short`, followed by `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/phone-number-field/phone-number-field.tsx' 'packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts' 'packages/ui/src/components/phone-number-field/phone-reset.browser.test.tsx' 'apps/docs/src/app/(docs)/components/phone-number-field/page.mdx' '.changeset/phone-number-field-reset.md' 'plans/README.md'`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave these excerpts and contracts applicable. Pre-existing changes are recorded and untouched. Stop if the implementation materially differs.

### Step 2: Move the proven regression into the normal browser suite

Create phone-reset.browser.test.tsx next to phone-state.browser.test.tsx. Import `PhoneNumberField` from `@elmeragroup/ui/phone-number-field`, `withLocale` from `../../../test/locale-matrix`, and `renderThemed as render` and `roleNamed` from `../../../test/themed-browser-render`, exactly as phone-state.browser.test.tsx lines 9-12 do. Copy its `inputNamed()` and `submission()` helpers (lines 21-31) and add a `snapshot()` helper returning `{ display: inputNamed().value, submitted: submission().get("phone"), submittedDisplay: submission().get("phone-display-value") }`.

Fixture: `<form aria-label="Phone form"><PhoneNumberField label="Mobile" name="phone" onChange={change} onCountryChange={countryChange} /><button type="reset">Reset</button></form>`, wrapped in `withLocale("en-US", ...)`. `change` and `countryChange` are `vi.fn()`.

Cases for this step:

1. `it.each(["button", "programmatic"])` uncontrolled reset: assert `snapshot()` starts all-empty; `await userEvent.fill(inputNamed(), "41234567")`; assert `{ display: "41234567", submitted: "+4741234567", submittedDisplay: "41234567" }`; record `change.mock.calls.length` and `countryChange.mock.calls.length`; reset via `await userEvent.click(roleNamed("button", "Reset"))` or `form.reset()` (get the form with `roleNamed("form", "Phone form")`); then `await expect.poll(() => snapshot()).toEqual({ display: "", submitted: "", submittedDisplay: "" })`; assert both call counts are unchanged and the country trigger (`roleNamed("button", "Select country").textContent`) still contains `+47`.
2. Canceled reset: same fixture with `<form aria-label="Phone form" onReset={(event) => event.preventDefault()}>`; fill, `form.reset()`, then `await expect.poll(() => snapshot())` still equals the populated object. Because the fix defers by one task, poll for the populated value and additionally assert it after `await new Promise((resolve) => setTimeout(resolve, 0))` so the negative case cannot pass trivially.
3. Controlled reset: `value="+4741234567"` with no parent state; `form.reset()`; `snapshot()` stays `{ display: "41234567", submitted: "+4741234567", submittedDisplay: "41234567" }` and `change` is not called.

Use `expect.poll` / `expect.element` eventual assertions after the reset rather than the investigation's fixed 100 ms delay.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx`.

**Expected**: Only case 1 (both reset methods) fails, at the all-empty `expect.poll` with the populated values retained; cases 2 and 3 and the three existing phone suites pass without unhandled browser errors.

### Step 3: Add a private uncontrolled reset transition

Add `resetUncontrolled: () => void` to `UsePhoneNumberFieldStateReturn` and return it from the hook. Implement it with a functional state updater so a deferred call (it runs from a `setTimeout` after the reset event, see Step 4) never applies stale closure state:

```ts
const resetUncontrolled = () => {
  setState((previous) => {
    if (previous.value !== undefined) return previous;
    const { country } = visibleSnapshot(previous);
    return {
      ...previous,
      accepted: snapshot({ digits: "", country }, previous.configuration),
      proposal: null,
    };
  });
};
```

Read `country` from `visibleSnapshot(previous)`, not from the render-scoped `selectedCountry`, so a country picked or auto-detected just before the reset is the one preserved. Keep `configuration` and `value` from `previous`. This bypasses `propose`, so `onChange` is not called, and the unchanged country code keeps the `onCountryChange` effect silent. Do not add a separate `useState` for reset; the whole `PhoneState` record must move together so display and hidden output cannot diverge.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0; private return type and hook implementation agree.

### Step 4: Subscribe to the owning form's reset lifecycle

In PhoneNumberField, follow the textarea exemplar shape:

1. Hold the number input element in state: `const [numberInput, setNumberInput] = useState<HTMLInputElement | null>(null);` and pass `ref={useMergedRefs(numberInputRef, setNumberInput)}` to `InputGroup.Input` (line 308) so the existing focus restoration at line 222 keeps working. Import `useMergedRefs` from `"../../hooks/use-merged-refs"` and `useLayoutEffect`/`useState` from `"react"`.
2. Keep the latest reset operation in a ref that is updated every render (`const resetRef = useRef(phone.resetUncontrolled); resetRef.current = phone.resetUncontrolled;`) so the effect below does not depend on the function identity and does not resubscribe on every keystroke.
3. `const isControlled = stateOptions.value !== undefined;` then:

```tsx
useLayoutEffect(() => {
  const form = numberInput?.form;
  if (!numberInput || !form || isControlled) return;
  let subscribed = true;
  function handleReset(event: Event): void {
    // A task runs after native reset, including reset-button default actions.
    setTimeout(() => {
      if (subscribed && !event.defaultPrevented) resetRef.current();
    });
  }
  form.addEventListener("reset", handleReset);
  return () => {
    subscribed = false;
    form.removeEventListener("reset", handleReset);
  };
}, [numberInput, isControlled]);
```

The `subscribed` flag covers unmount and a switch to controlled mode between the event and its deferred task; `event.defaultPrevented` covers a canceled reset (it is only reliable after the default action, hence the deferral). Because the element lives in state, re-parenting the field into a different `<form>` re-creates the input, re-runs the effect, and subscribes to the new owner. Do not call `handleInputChange` or `selectCountry` from the reset path; both emit user changes.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx`.

**Expected**: Both reset methods clear display and FormData; canceled and controlled cases remain unchanged.

### Step 5: Lock the country policy and lifecycle edges

Add these cases to phone-reset.browser.test.tsx, each asserting `snapshot()` and call counts as in Step 2:

- Manually selected country: open the picker via `roleNamed("button", "Select country")`, choose Sweden the way phone-number-field.browser.test.tsx lines 106-114 and 155-166 do (focus the trigger, `{Enter}`, `userEvent.fill` the search input named "Search countries" with `Sweden`, `{ArrowDown}{Enter}`, wait for the listbox to close), fill `701234567`, reset; expect all-empty values, trigger text still containing `+46`, and no new `onChange`/`onCountryChange` calls after the reset.
- Auto-detected country: fill `+46701234567` with the default `autoDetectCountry`; trigger shows `+46`; reset; expect all-empty values and `+46` retained.
- Edit after reset: reset, then `await userEvent.fill(inputNamed(), "99887766")`; expect `{ display: "99887766", submitted: "+4799887766", submittedDisplay: "99887766" }` and exactly one additional `onChange` call with `"+4799887766"`.
- Read-only: fill while editable, rerender with `isReadOnly`, reset; expect all-empty values (reset is not an edit and is not blocked). Model the rerender on phone-state.browser.test.tsx lines 240-261.
- Disabled: fill while enabled, rerender with `isDisabled`, reset; `submission().has("phone")` is `false` while disabled (existing behavior), `inputNamed().value` becomes `""`; rerender enabled again and expect `submission().get("phone")` to be `""`.
- Variants: `it.each` over `{ international: true }`, `{ formatOnType: true }`, `{ outputFormat: "national" }`, `{ outputFormat: "raw" }`; fill `41234567`, reset; expect all-empty values in every variant (see the `resolvePhoneFieldValues` fact in Current state).
- Unmount before the deferred task: pattern on textarea-reset.browser.test.tsx lines 36-55: spy `removeEventListener` on the form, fill, `form.reset()`, `unmount()` synchronously, then `await new Promise((resolve) => setTimeout(resolve, 0))`; expect the spy to have seen a `"reset"` removal and no unhandled error.
- Controlled parent accepting a value after reset: `useState("")` parent that sets `value` from `onChange`; fill `41234567`, `form.reset()`; values stay populated (parent-owned); click a `type="button"` "Clear" that sets `""`; expect all-empty values. Model on phone-state.browser.test.tsx lines 71-110.
- Different owner: render the field inside `<form aria-label="First">`, fill, then `rerender` the same tree with the field moved into a sibling `<form aria-label="Second">`; fill again (moving the field remounts it, so its state and DOM are fresh); `reset()` the first form and expect values unchanged; `reset()` the second form and expect all-empty values.

Then document the behavior on the component page: in the `<Prose>` block of page.mdx, after the paragraph beginning "Forms submit the hidden `name` input", add one short paragraph stating that a native form reset clears an uncontrolled field's number, keeps the selected country, and fires neither `onChange` nor `onCountryChange`, while a controlled `value` stays parent-owned. Create `.changeset/phone-number-field-reset.md` in the same front-matter shape as `.changeset/initial-release.md` with `"@elmeragroup/ui": patch`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx`.

**Expected**: All phone browser suites and the new country/lifecycle cases pass.

### Step 6: Complete verification and handoff

The scoped changeset must name `"@elmeragroup/ui": patch` and describe the consumer-visible result. Run the completion commands below. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx`.

**Expected**: All targeted tests pass; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0.

**Verify**: `pnpm lint`.

**Expected**: Exit 0, no warnings.

**Verify**: `pnpm ci:checks`.

**Expected**: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.

## Test plan

New file `packages/ui/src/components/phone-number-field/phone-reset.browser.test.tsx`, structured after `textarea-reset.browser.test.tsx` and using the helpers from `phone-state.browser.test.tsx`. Cases, all listed in Steps 2 and 5:

- Uncontrolled reset via reset button and via `form.reset()` (regression; fails before the fix).
- Canceled reset keeps values.
- Controlled `value` keeps values.
- Manually selected and auto-detected country preserved; number cleared; no `onChange`/`onCountryChange` after reset.
- Edit after reset works and emits one `onChange`.
- Read-only and disabled fields are still reset.
- `international`, `formatOnType`, `outputFormat: "national"`, `outputFormat: "raw"` all reset to empty strings.
- Unmount between the reset event and its deferred task removes the listener and throws nothing.
- Controlled parent that later accepts `""` clears; reset alone does not.
- Field moved to a different form is reset by the new owner only.

Do not modify the three existing phone browser suites; they are run alongside the new file as a no-regression check.

Investigation background: the archived probe ran the unchanged phone-state suite plus five probes; 14 tests passed and only the two uncontrolled reset assertions failed, observing display=41234567, submitted=+4741234567, submittedDisplay=41234567 after both reset methods. Evidence is under plans/probes/phone-reset-result.md. Do not copy its external config or React deduplication into production; the normal in-package browser configuration already works.

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx` must run the named suites and pass all existing and newly specified cases.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/phone-number-field/phone-reset.browser.test.tsx src/components/phone-number-field/phone-state.browser.test.tsx src/components/phone-number-field/phone-number-field.browser.test.tsx src/components/phone-number-field/hooks/use-phone-number-field-state.browser.test.tsx`: All targeted tests pass; no unhandled errors or silent zero-test result.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: Exit 0.
- [ ] `pnpm lint`: Exit 0, no warnings.
- [ ] `pnpm ci:checks`: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.
- [ ] The new regression cases named in this plan exist and pass; the vitest report lists `phone-reset.browser.test.tsx` with at least 20 tests.
- [ ] `grep -n "resetUncontrolled" packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts packages/ui/src/components/phone-number-field/phone-number-field.tsx` shows the type member, the hook implementation, and the component subscription.
- [ ] `git diff -- 'apps/docs/src/app/(docs)/components/phone-number-field/api.json'` is empty (prop JSDoc untouched).
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no new changes outside Scope after accounting for the recorded baseline.
- [ ] The scoped changeset declares `"@elmeragroup/ui": patch`.
- [ ] Row 011 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report if the current-state code has materially drifted, a verification step fails twice after one reasonable repair attempt, or a correct solution requires another file or public contract outside Scope. Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

STOP if `numberInput?.form` is null for a field rendered inside a `<form>` (the ref merge is not reaching the native input), if `reconcile` overwrites the reset `accepted` snapshot on the next render for an uncontrolled field, if the normal browser configuration cannot reproduce the two failures cleanly, if preserving country proves incompatible with the current state invariants, if a native reset would require notifying onChange to work, or if a broader public form/default-value API is needed. Do not treat a test-server setup error as a confirmed regression.

## Maintenance notes

A future defaultValue or controlled-country API must explicitly revisit reset behavior. Keep the entire phone snapshot synchronized so display and submitted output cannot diverge. Plan 003 offers a related reset lifecycle but is not a code dependency; do not couple the two state models.
