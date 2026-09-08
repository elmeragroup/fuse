# Plan 002: Localize NumberField stepper labels and expose copy overrides

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step (Step 2). Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/number-field/number-field.tsx' 'packages/ui/src/components/number-field/number-field.browser.test.tsx' 'packages/ui/src/components/number-field/number-field.test-d.tsx' 'packages/ui/src/components/number-field/intl/index.ts' 'packages/ui/src/components/number-field/intl/en-US.ts' 'packages/ui/src/components/number-field/intl/nb-NO.ts' 'packages/ui/src/components/number-field/intl/sv-SE.ts' 'packages/ui/src/components/number-field/intl/fi-FI.ts' 'docs/spec/accessibility.md' 'apps/docs/src/app/(docs)/components/number-field/page.mdx' 'apps/docs/src/app/(docs)/components/number-field/api.json' '.changeset/number-field-localization.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 2
- **Status**: TODO

## Why this matters

NumberField formats numbers using the provider locale but leaves its Increase and Decrease stepper accessible names in English. Norwegian, Swedish, and Finnish users receive mixed-language controls, which contradicts the library's own accessibility contract: "the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings" (docs/spec/accessibility.md:9). After this plan, the two stepper names resolve from a NumberField-owned four-locale dictionary, and consumers can override each name through an optional string prop, without changing number parsing or value control.

## Current state

The following excerpts identify the implementation and its current behavior. Whitespace is condensed in some excerpts.

### Where the English names come from

The component passes no `aria-label` to the stepper primitives. Base UI supplies the English defaults inside its stepper hook, and a consumer-supplied `aria-label` wins over that default because the primitive merges props in the order `[defaults, elementProps, getButtonProps]`:

`node_modules/.pnpm/@base-ui+react@1.6.0_*/node_modules/@base-ui/react/number-field/root/useNumberFieldButton.mjs:83-85`

```js
const props = {
  disabled,
  'aria-label': isIncrement ? 'Increase' : 'Decrease',
```

`.../number-field/root/useNumberFieldStepperButton.mjs:78`

```js
props: [props, elementProps, getButtonProps],
```

So no repository file spells "Increase" or "Decrease" for NumberField today; do not search for one. Passing `aria-label={...}` to `NumberFieldPrimitive.Increment` / `.Decrement` is sufficient.

### The component

[packages/ui/src/components/number-field/number-field.tsx:13](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx:13) imports the provider hook for the numeric locale, and [line 102](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx:102) reads it:

```tsx
import { useElmeraGroupUi } from "../../theme/elmera-group-ui";
// ...
const { locale } = useElmeraGroupUi();
```

[packages/ui/src/components/number-field/number-field.tsx:152-157](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx:152):

```tsx
<NumberFieldPrimitive.Increment className={cn(stepperButton, "border-b")}>
  <CaretUp aria-hidden className="size-4" />
</NumberFieldPrimitive.Increment>
<NumberFieldPrimitive.Decrement className={stepperButton}>
  <CaretDown aria-hidden className="size-4" />
</NumberFieldPrimitive.Decrement>
```

`NumberFieldProps` (lines 16-67) is a closed object type with JSDoc on every prop; the last string prop is `"aria-label"?: string;` at line 61-62. The props are destructured by name in the function signature (lines 78-101).

### The localization pattern to copy

Locale is required on `ElmeraGroupUiProvider` and never passed to an individual component (ADR 0006, docs/adr/0006-intl-strings.md:11). Each string-bearing component owns a co-located `intl/` directory of flat-key TS modules assembled with `createStringDictionary`; a value import of `LocalizedStringDictionary` outside that factory is a lint error (`.oxlintrc.json:197-202`, `no-restricted-imports`). Explicit string props win through `override ?? strings.format(key)`.

Dictionary exemplar, [packages/ui/src/components/pagination/intl/index.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/pagination/intl/index.ts):

```ts
import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Pagination's own dictionary: it owns the `pagination.*` rows of accessibility.md §4.1. */
export const paginationStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
```

Locale module exemplar, [packages/ui/src/components/pagination/intl/nb-NO.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/pagination/intl/nb-NO.ts):

```ts
/** accessibility.md §4.1 — locked copy for the `pagination.*` rows. */
export const nbNO = {
  landmark: "Sidenavigasjon",
  previous: "Forrige",
  // ...
};
```

The factory (`packages/ui/src/intl/create-string-dictionary.ts`) types all four modules with the same key set, so a key present in one locale file and missing in another is a type error at the `createStringDictionary` call.

Consumption exemplar, [packages/ui/src/components/pagination/pagination.tsx:5,33,39](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/pagination/pagination.tsx:33):

```tsx
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
// ...
const strings = useLocalizedStrings(paginationStrings);
// ...
aria-label={ariaLabel ?? label ?? strings.format("landmark")}
```

`useLocalizedStrings` (`packages/ui/src/hooks/use-localized-strings.ts`) reads the provider locale itself and caches one formatter per dictionary and locale. NumberField must keep its existing `useElmeraGroupUi()` call because the numeric `locale` prop on `NumberFieldPrimitive.Root` still needs the raw locale string.

### The string manifest

[docs/spec/accessibility.md §4.1](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md) "Locked v1 string manifest" is the cross-component audit source. Its table columns are, in order: `Owner/key`, `nb-NO`, `sv-SE`, `en-US`, `fi-FI`. Rows are sorted alphabetically by owner; `meter.success` is followed directly by `overlay.close`, so the new `numberField.*` rows belong between them. Amendments to this section are recorded inline as `_(Amended YYYY-MM-DD — reason.)_` (see the existing note in the §4.1 intro paragraph). Plan 010 also edits `docs/spec/accessibility.md`, in a different section; run the drift check against the live file and keep your edit confined to the §4.1 table and its amendment note.

### Existing tests

[packages/ui/src/components/number-field/number-field.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.browser.test.tsx) already imports `SUPPORTED_LOCALES` and `withLocale` (line 11) and wraps every render in a provider through `renderField(node, locale = "en-US")` (lines 24-26). Two helpers reference the English names and must keep working unchanged in `en-US` renders:

```tsx
// lines 41-47
function buttonNamed(name: string): HTMLElement {
  /* page.getByRole("button", { name, exact: true }) */
}
// lines 49-57 — note the narrowed parameter type
function stepperIn(fieldName: string, name: "Increase" | "Decrease"): HTMLElement {
  /* matches aria-label attribute */
}
```

The first test (lines 60-76) asserts `page.getByRole("button", { name: "Increase", exact: true })` and `"Decrease"` under the default `en-US` locale. The `formatOptions` test (lines 140-182) is the per-locale exemplar: it loops `SUPPORTED_LOCALES`, renders, asserts, and `unmount()`s. The density test (lines 325-343) shows `rerender(...)` from `renderThemed` being used with `withLocale`.

The per-locale + override browser test to model after is [packages/ui/src/components/pagination/pagination.browser.test.tsx:125-159](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/pagination/pagination.browser.test.tsx:125): a `for (const locale of SUPPORTED_LOCALES)` loop with per-locale copy tables (`LANDMARK_COPY[locale]`), then one `nb-NO` render proving overrides win and the dictionary default is absent.

[packages/ui/src/components/number-field/number-field.test-d.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.test-d.tsx) has three tests: entry parity (lines 9-12), a closed-face test with one `expectTypeOf<NumberFieldProps["x"]>().toEqualTypeOf<...>()` line per prop and `not.toHaveProperty("locale")` at line 37, and a JSX test with `@ts-expect-error` rejections (lines 66-79). Precedent for rejecting a non-string with a numeric literal: `packages/ui/src/components/show/show.test-d.tsx:23-24` (`// @ts-expect-error ...` above `<Show when={1}>`).

### Other repository facts

- Testing convention: ADR 0008 forbids tests that read component source. Browser tests prove behavior by role and name queries. ADR 0006 (docs/adr/0006-intl-strings.md:26) requires "one dictionary-default render test per shipped locale per string-bearing component, plus prop-override tests"; the browser tests in this plan satisfy that. No separate `number-field.test.ts` unit file is required.
- `apps/docs` API reference: each component page has a committed `api.json` generated from the library's types and JSDoc by `pnpm --filter docs generate` (never hand-edit). The generator rewrites a stale artifact and records the slug in `apps/docs/src/generated/api-drift.ts`; the docs unit test `apps/docs/test/api-artifact.test.ts` fails while that list is non-empty. Running generate a second time, with the artifact now current, clears it.
- The docs handbook page `apps/docs/src/app/(docs)/handbook/localization/page.tsx` describes the mechanism generically and lists no per-component owners; it needs no edit.
- Size budget: `packages/ui/scripts/size-budgets.ts:116` records the `number-field` entry at 41008 gzip bytes with a 60983 ceiling. A two-key dictionary plus the hook adds a few hundred bytes; the gate only fails above the ceiling.
- `@elmeragroup/ui` package `exports` point at `./src/*.ts` (packages/ui/package.json:142-145), so type tests and the docs generator see source changes without a rebuild. The browser test file imports `../../../dist/styles.css` (line 6), so `packages/ui/dist/styles.css` must exist; this plan changes no CSS, so an existing build is fine.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose                                                          | Command                                                                                                                     | Expected on success                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Library build (only if `packages/ui/dist/styles.css` is missing) | `pnpm --filter @elmeragroup/ui build`                                                                                       | Exit 0; `packages/ui/dist/styles.css` exists                                 |
| Targeted browser tests                                           | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx` | Report lists `number-field.browser.test.tsx`; the expected case count passes |
| Type tests                                                       | `pnpm --filter @elmeragroup/ui test:types`                                                                                  | Exit 0; `number-field.test-d.tsx` appears in the report                      |
| UI type check                                                    | `pnpm --filter @elmeragroup/ui type-check`                                                                                  | Exit 0                                                                       |
| Regenerate docs API artifacts                                    | `pnpm --filter docs generate`                                                                                               | Exit 0; only `number-field/api.json` changes under `apps/docs/src/app`       |
| Docs unit tests (api.json drift)                                 | `pnpm --filter docs test`                                                                                                   | Exit 0                                                                       |
| Format check                                                     | `pnpm format:check`                                                                                                         | Exit 0                                                                       |
| Format in-scope files only                                       | `pnpm exec oxfmt <space-separated in-scope file paths>`                                                                     | Exit 0; `git status` shows no files outside Scope touched                    |
| Lint                                                             | `pnpm lint`                                                                                                                 | Exit 0, no warnings                                                          |
| Full completion gate                                             | `pnpm ci:checks`                                                                                                            | Exit 0                                                                       |

Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. The UI test configuration has `passWithNoTests: true`, so exit 0 alone is insufficient: confirm the named file and the expected new cases appear in the report. Builds and the full gate regenerate files; generated changes are allowed only within Scope. Stop if unrelated committed artifacts change. Standard ignored build/test outputs (`dist/`, `.next/`, `.artifacts/`, `apps/docs/src/generated/`) are permitted.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/components/number-field/number-field.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx)
- [packages/ui/src/components/number-field/number-field.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.browser.test.tsx)
- [packages/ui/src/components/number-field/number-field.test-d.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.test-d.tsx)
- [packages/ui/src/components/number-field/intl/index.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/intl/index.ts) (create)
- [packages/ui/src/components/number-field/intl/en-US.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/intl/en-US.ts) (create)
- [packages/ui/src/components/number-field/intl/nb-NO.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/intl/nb-NO.ts) (create)
- [packages/ui/src/components/number-field/intl/sv-SE.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/intl/sv-SE.ts) (create)
- [packages/ui/src/components/number-field/intl/fi-FI.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/intl/fi-FI.ts) (create)
- [docs/spec/accessibility.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md) (§4.1 table rows and amendment note only)
- [apps/docs/src/app/(docs)/components/number-field/page.mdx](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/number-field/page.mdx>)
- [apps/docs/src/app/(docs)/components/number-field/api.json](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/number-field/api.json>) (regenerated, never hand-edited)
- [.changeset/number-field-localization.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/number-field-localization.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope, do not touch even though they look related:**

- Base UI (`@base-ui/react`), the `SupportedLocale` union, `ElmeraGroupUiProvider`, `packages/ui/src/hooks/use-localized-strings.ts`, and `packages/ui/src/intl/create-string-dictionary.ts`.
- Numeric formatting, the omitted-value/`NaN` behavior, stepper geometry or classes, and the `"aria-label"` prop on the input.
- `apps/docs/src/app/(docs)/components/button-group/demos/button-group-vertical.tsx`, which uses literal `aria-label="Increase"` / `"Decrease"` on plain Buttons; that is consumer copy in a demo, not this component.
- The handbook localization page, `apps/docs/test/fixtures/component-demo-requirements.json`, and the number-field demo files; no new demo is required for two optional string props.
- `packages/ui/scripts/size-budgets.ts`; the recorded `measuredGzip` is a snapshot, not a gate, and the ceiling has ample headroom.
- No new runtime dependency.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/number-field-localization` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: localize NumberField stepper labels and expose copy overrides`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Confirm `packages/ui/dist/styles.css` exists (build once if not). Read the cited implementation, the pagination exemplars, and the existing NumberField tests.

**Verify**: `git rev-parse --short HEAD && git status --short`, then the drift-check command from the header, then `ls packages/ui/dist/styles.css`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave these excerpts and contracts applicable. Pre-existing changes are recorded and untouched. `styles.css` is present. Stop if the implementation materially differs.

### Step 2: Characterize the default names in every supported locale (red)

In `number-field.browser.test.tsx`, add one test inside the existing `describe("NumberField", …)` block, modeled on the pagination test cited above. Define two per-locale copy tables at module scope using the copy in Step 3, for example:

```tsx
const INCREASE_COPY = { "nb-NO": "Øk", "sv-SE": "Öka", "en-US": "Increase", "fi-FI": "Lisää" } as const;
const DECREASE_COPY = {
  "nb-NO": "Reduser",
  "sv-SE": "Minska",
  "en-US": "Decrease",
  "fi-FI": "Vähennä",
} as const;
```

Loop `SUPPORTED_LOCALES`: render `<NumberField label="Quantity" defaultValue={2} />` with `renderField(node, locale)`, assert `page.getByRole("button", { name: INCREASE_COPY[locale], exact: true }).query()` and the Decrease equivalent are truthy (pass `locale` as the assertion message, as pagination does), then `unmount()`. Then, in a second render, use `rerender(withLocale("nb-NO", <NumberField label="Amount" defaultValue={1234.5} />))` on a field first rendered in `en-US` and assert both stepper names and the textbox value switch to the `nb-NO` copy/format in one rerender (`renderField` returns `renderThemed`'s result, which has `rerender`; mirror the density test's `rerender(... withLocale(...))` shape).

Do not add the override props or touch `stepperIn` / `buttonNamed` in this step, so the red run is a behavioral failure rather than a type error. Keep every existing English assertion unchanged.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx`

**Expected**: The new test fails on the `nb-NO`, `sv-SE`, and `fi-FI` names (Base UI renders "Increase"/"Decrease" regardless of locale) while the `en-US` iteration and every pre-existing test pass. A failure on `en-US`, or any pre-existing failure, is a STOP condition.

### Step 3: Add the dictionary and the override props (green)

1. Create the four locale modules with exactly these flat keys and copy, each with the JSDoc header `/** accessibility.md §4.1 — locked copy for the \`numberField.*\` rows. */`:

   | Module     | `increase` | `decrease` |
   | ---------- | ---------- | ---------- |
   | `en-US.ts` | Increase   | Decrease   |
   | `nb-NO.ts` | Øk         | Reduser    |
   | `sv-SE.ts` | Öka        | Minska     |
   | `fi-FI.ts` | Lisää      | Vähennä    |

   Export names must be `enUS`, `nbNO`, `svSE`, `fiFI`, matching pagination.

2. Create `intl/index.ts` exporting `numberFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE })` with a one-line JSDoc naming the `numberField.*` rows, mirroring the pagination index verbatim apart from names.

3. In `number-field.tsx`:
   - Add `import { useLocalizedStrings } from "../../hooks/use-localized-strings";` and `import { numberFieldStrings } from "./intl";` (keep import groups sorted as the file already is; lint enforces order).
   - Add to `NumberFieldProps`, next to `"aria-label"`, with public JSDoc:

     ```tsx
     /** Accessible name of the increment stepper. Defaults to the locale dictionary. */
     increaseLabel?: string;
     /** Accessible name of the decrement stepper. Defaults to the locale dictionary. */
     decreaseLabel?: string;
     ```

   - Destructure `increaseLabel` and `decreaseLabel` in the signature.
   - After the existing `const { locale } = useElmeraGroupUi();` add `const strings = useLocalizedStrings(numberFieldStrings);` and keep the `useElmeraGroupUi` call (the primitive's `locale` prop still needs it).
   - Pass `aria-label={increaseLabel ?? strings.format("increase")}` to `NumberFieldPrimitive.Increment` and `aria-label={decreaseLabel ?? strings.format("decrease")}` to `NumberFieldPrimitive.Decrement`. Change nothing else on those elements.

These four translations are introduced by this plan; they are not previously approved copy. Record them as new in the changeset and the manifest amendment note.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx`

**Expected**: Every test passes, including the Step 2 test in all four locales and all pre-existing tests (the `en-US` default is byte-identical to the Base UI default, so `stepperIn` and `buttonNamed` keep working).

### Step 4: Cover overrides, lock the copy, and publish the API change

1. Browser test: add one test rendering, in `nb-NO`, `<NumberField label="Quantity" defaultValue={2} increaseLabel="Add one" decreaseLabel="Remove one" />`. Assert both override names are found by role, assert `page.getByRole("button", { name: "Øk", exact: true }).query()` and the `"Reduser"` equivalent are `null`, then `rerender` the same element under `"fi-FI"` and assert the override names are still present (overrides survive a locale change). Add a second short test rendering only `increaseLabel="Add one"` in `sv-SE` and asserting the Decrease button is still named `"Minska"` (overrides are independent).

2. Type tests in `number-field.test-d.tsx`:
   - In the closed-face test add `expectTypeOf<NumberFieldProps["increaseLabel"]>().toEqualTypeOf<string | undefined>();` and the `decreaseLabel` equivalent. Keep `not.toHaveProperty("locale")`.
   - In the JSX test add a positive usage `<NumberField label="Quantity" increaseLabel="Add one" decreaseLabel="Remove one" />` and two rejections, following `show.test-d.tsx:23-24`:

     ```tsx
     // @ts-expect-error stepper labels are strings
     const _noNumericIncrease = <NumberField increaseLabel={1} />;
     // @ts-expect-error stepper labels are strings
     const _noNumericDecrease = <NumberField decreaseLabel={1} />;
     ```

3. Manifest: in `docs/spec/accessibility.md` §4.1, insert two rows between `meter.success` and `overlay.close`, keeping the column order `Owner/key | nb-NO | sv-SE | en-US | fi-FI`:

   ```
   | `numberField.increase` | Øk      | Öka    | Increase | Lisää   |
   | `numberField.decrease` | Reduser | Minska | Decrease | Vähennä |
   ```

   oxfmt formats Markdown, including this table (`pnpm exec oxfmt docs/spec/accessibility.md` realigns the column padding); run it on that one file rather than by hand. Append to the §4.1 intro paragraph's existing amendment note: `_(Amended 2026-09-08 — added \`numberField.increase\` and \`numberField.decrease\`.)_`. Touch nothing else in the file.

4. Docs page: in `page.mdx`'s `<Prose>` paragraph (lines 23-27), add one sentence after "There is no `locale` prop — formatting follows `ElmeraGroupUiProvider`.": "The stepper names come from the locale dictionary; `increaseLabel` / `decreaseLabel` override them."

5. Regenerate the API artifact: run `pnpm --filter docs generate` once (it rewrites `number-field/api.json` and records the slug as stale), then run it a second time so the recorded drift list is empty again.

6. Changeset: create `.changeset/number-field-localization.md` modeled on `.changeset/initial-release.md`:

   ```md
   ---
   "@elmeragroup/ui": minor
   ---

   NumberField stepper buttons are now named in the provider locale (Norwegian Bokmål, Swedish, English, Finnish) instead of always in English. New optional `increaseLabel` and `decreaseLabel` props override the built-in names.
   ```

**Verify**: `pnpm --filter docs generate && pnpm --filter docs generate && pnpm --filter docs test && pnpm --filter @elmeragroup/ui test:types && git status --short`

**Expected**: All exit 0; `number-field.test-d.tsx` is listed in the type-test report; the only `apps/docs/src/app` change in `git status` is `components/number-field/api.json` (plus the in-scope `page.mdx`), and it now lists `increaseLabel` and `decreaseLabel` with their JSDoc.

### Step 5: Complete verification and handoff

Format only in-scope files if `pnpm format:check` reports them, then run the completion gates. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm format:check` → Exit 0.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx` → All targeted tests pass; the report names the file; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → Exit 0.

**Verify**: `pnpm lint` → Exit 0, no warnings.

**Verify**: `pnpm ci:checks` → Exit 0, including format, build, type, unit, browser, type-test, size-limit, policy, and packed-consumer gates.

## Test plan

All new tests live in the two existing NumberField test files; no new test file.

Browser (`number-field.browser.test.tsx`), modeled on `pagination.browser.test.tsx:125-159`:

1. Default names per locale: for each of `nb-NO`, `sv-SE`, `en-US`, `fi-FI`, both steppers are found by `getByRole("button", { name, exact: true })` with the copy from Step 3.
2. Provider rerender: switching the provider from `en-US` to `nb-NO` via `rerender` updates both stepper names and the formatted textbox value.
3. Overrides win and survive a locale rerender (`nb-NO` → `fi-FI`), and the dictionary defaults are absent while overridden.
4. Overrides are independent: `increaseLabel` alone leaves Decrease on the dictionary default.

Type (`number-field.test-d.tsx`): both props typed `string | undefined`; JSX accepts both; `increaseLabel={1}` and `decreaseLabel={1}` rejected via `@ts-expect-error`; `locale` still rejected.

Keep every existing English assertion and the `stepperIn` / `buttonNamed` helpers unchanged; they test stepping and disabled bounds under the `en-US` default. New tests must query rendered roles and names, never the dictionary object or the source text (ADR 0008).

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx` runs the named file and passes all pre-existing cases plus the four new ones.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/number-field/number-field.browser.test.tsx`: report names the file; all pre-existing tests plus the four new cases pass; no zero-test result.
- [ ] `pnpm --filter @elmeragroup/ui test:types`: exit 0; `number-field.test-d.tsx` listed.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: exit 0.
- [ ] `pnpm --filter docs generate` (run twice) then `pnpm --filter docs test`: exit 0; `apps/docs/src/app/(docs)/components/number-field/api.json` contains `"name": "increaseLabel"` and `"name": "decreaseLabel"`.
- [ ] `grep -n 'numberField.increase\|numberField.decrease' docs/spec/accessibility.md` returns exactly two table rows.
- [ ] `ls packages/ui/src/components/number-field/intl/` lists exactly `en-US.ts fi-FI.ts index.ts nb-NO.ts sv-SE.ts`.
- [ ] `pnpm format:check`: exit 0.
- [ ] `pnpm lint`: exit 0, no warnings.
- [ ] `pnpm ci:checks`: exit 0.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no changes outside Scope after accounting for the recorded baseline.
- [ ] `.changeset/number-field-localization.md` exists and declares `"@elmeragroup/ui": minor`.
- [ ] Row 002 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report (do not improvise) if:

- The current-state excerpts do not match the live code, in particular if `number-field.tsx` already passes an `aria-label` to the steppers or already imports an `intl/` dictionary.
- The Step 2 red run fails on `en-US` or on any pre-existing test: the Base UI default has changed and the characterization must be re-derived.
- A verification step fails twice after one reasonable repair attempt.
- A correct solution requires touching a file or public contract outside Scope, including `use-localized-strings.ts`, `create-string-dictionary.ts`, or the `SupportedLocale` union.
- `pnpm --filter docs generate` rewrites any `api.json` other than `number-field/api.json`.
- The `size-limit` gate fails for the `number-field` entry.
- The `createStringDictionary` call reports a type error you cannot resolve by making the four locale modules carry the same two keys.
- `docs/spec/accessibility.md` has been edited (by plan 010 or otherwise) in a way that changes the §4.1 table structure.

Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass. If the product owner supplies different translations during execution, update the four locale modules, the §4.1 rows, the changeset, and the test copy tables together.

## Maintenance notes

- Adding a fifth locale to the library means adding `intl/<tag>.ts` here with the same two keys; the factory makes a missing module a type error at the `createStringDictionary` call.
- Reviewers should check that the `en-US` copy is unchanged from Base UI's default ("Increase"/"Decrease") so existing consumers and tests are unaffected, that the input's own `aria-label` prop is untouched, and that `api.json` was regenerated rather than hand-edited.
- Product-specific phrasing belongs in `increaseLabel` / `decreaseLabel` at the call site, not in new locale props; locale stays provider-only (ADR 0006).
- Deferred: a `number-field.test.ts` unit test asserting the dictionary carries exactly the §4.1 keys (the sidebar has one at `packages/ui/src/components/sidebar/sidebar.test.ts:69-86`). The browser tests already cover every locale and ADR 0006 does not require it.
