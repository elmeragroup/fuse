# DateRangePicker

## 1 Header

- **Canonical name:** `DateRangePicker`
- **Export path:** `@elmeragroup/ui/react-aria/date-range-picker` — `react-aria/` quarantine prefix (path-policy ruling).
- **RSC:** client
- **Tier:** **react-aria interim** — labeled composite over `react-aria-components` `DateRangePicker`. **Migration roadmap:** replaced by a base-ui composition alongside DatePicker; bare `@elmeragroup/ui/date-range-picker` is reserved for the successor.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/date-range-picker.tsx` (+ `styles/date-picker.ts` as the shape template for the new recipe — see §4).

## 2 Anatomy

```
AriaDateRangePicker                    (RAC DateRangePicker; base slot)
├─ Label                               — when `label`
├─ FieldGroup (group slot, min-w-[208px]; isReadOnly — the only read-only fill, §8.13)
│  ├─ DateInput slot="start"           — public, from react-aria/date-field
│  ├─ span "–" (aria-hidden, en dash separator)
│  ├─ DateInput slot="end" (flex-1)
│  └─ Button variant="ghost" size="icon-sm" > CalendarBlank (named icon import, aria-hidden)
├─ Description / FieldError            — as DatePicker
└─ Popover placement="bottom right"    (private RAC popover internal)
   └─ Dialog closeButton={false}       (private STYLED dialog — ruled alignment; ref used raw RAC Dialog)
      └─ RangeCalendar (calendar slot) — public, from react-aria/range-calendar
```

Everything above except the two segment rows and the en-dash between them is the package-private `PickerShell` DatePicker also wears (§8.13, 2026-09-03) — label, field box, trigger, help text, popover, dialog. Composes the same private internals as DatePicker (PickerShell, styled Dialog, RAC Button for slots, RAC Popover); all stay private and die with the tier.

## 3 Props

`DateRangePickerProps<T extends DateValue>` — spreads onto RAC `DateRangePicker` (open surface: `value`/`defaultValue`/`onChange` as `RangeValue<T>` `{ start, end }`, `minValue`, `maxValue`, `granularity`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `isDateUnavailable`, `allowsNonContiguousRanges`, `validate`, `startName`/`endName`, `isOpen`/`onOpenChange`, …).

| Prop                      | Type                                                | Default              | Notes                                                                                          |
| ------------------------- | --------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `label`                   | `string`                                            | —                    |                                                                                                |
| `description`             | `string`                                            | —                    |                                                                                                |
| `errorMessage`            | `ReactNode \| ((v: ValidationResult) => ReactNode)` | —                    | unified composite face                                                                         |
| `isReadOnly`              | `boolean`                                           | `false`              | Destructured to drive the `isReadOnly` tv variant (ruled addition — parity with DatePicker)    |
| `shouldForceLeadingZeros` | `boolean`                                           | **`true`**           | **Ruled addition** — the ref omits it here while DatePicker/DateField default it true; aligned |
| `className`               | RAC className                                       | —                    | Composed onto `base` slot                                                                      |
| `container`               | `HTMLElement \| RefObject<HTMLElement \| null>`     | nearest `ThemeScope` | forwarded to private Popover; explicit value wins                                              |

No `presetGroup` (DatePicker-only; DatePickerStateContext has no range counterpart in this tier).

## 4 Variants

**Ruled addition, consolidated 2026-09-03 (§8.13):** the range picker renders through `pickerVariants({ range: true })` in `styles/picker.ts`, **module-private**, the same recipe DatePicker uses — slots `base` (`group flex flex-col gap-1`), `group` (`w-auto min-w-[208px]`), `input` (`px-(--control-px-md)` plus the control type pair, no `py-*`; the end input adds `flex-1` at the call site), `separator` (the en-dash span, absorbing the ref's inline classes), `icon` (`size-4 transition-colors`), `dialog` (`p-0`), `calendar` (`p-2` — pays the inset Calendar's own root carries; RangeCalendar's root is bare and the dialog slot is `p-0`). There is no `isReadOnly` axis: the fill is `fieldGroupVariants`' own, painted once by the FieldGroup. The ref styles everything inline with zero recipe; the recipe is the alignment ruling made concrete, and the `range` axis is that ruling finished — the two shape-matched recipes were one recipe with one axis all along.

The shared private FieldGroup owns the only field surface and keyboard focus ring. DateInput reads the group's private surface context and contributes content-sized segment rows without nested borders, backgrounds, shadows or rings. Standalone DateInput retains its own surface; no public styling flag or independent per-picker compensation is added.

## 5 Consumed tokens

Own slots: `foreground` (separator — ref `text-gray-800`), `muted-foreground` (disabled separator — ref `group-disabled:text-gray-200`), `muted` (read-only fill). Via composed parts: `card`/`input`/`ring`/`error` (FieldGroup + FieldError; `card` also covers the popover surface), `primary` family + `muted`/`accent` (RangeCalendar cells per its §5 mapping). Forced-colors separator fallbacks (`[ButtonText]`/`[GrayText]`) kept.

## 6 Data attributes

- **Emitted:** RAC state attributes on root/group/inputs/cells (`data-open`, `data-invalid`, `data-disabled`, …), including `data-readonly` on the field group, which RAC stamps from the `isReadOnly` the FieldGroup now receives _(added 2026-09-03, §8.13)_. The separator relies on the root's `group` class + RAC `group-disabled:` modifier.
- **Consumed:** nothing. _(Amended 2026-09-03, §8.13.)_ The popover used to stamp `data-overlay-container="popover"` for the private RAC `Modal`'s outside-interaction check; that modal was deleted with the seam. Full reasoning in date-picker §6 — this component is again the second beneficiary.

## 7 Accessibility

- RAC DateRangePicker semantics: one labelled `group` (the field) whose two `DateInput` rows render `role="presentation"` — RAC deliberately omits per-row groups because the picker's single group already carries the label and description. Each row's segments are `spinbutton`s named `<part>, Start Date` / `<part>, End Date`; the en-dash separator is `aria-hidden` because those names already distinguish the rows.
- Trigger button: RAC-provided name, `aria-expanded`; popover contains a `dialog` wrapping the range `grid`.
- Keyboard: segment editing per DateField in both inputs; trigger opens the dialog with focus on the grid; range selection per RangeCalendar §7 (anchor → extend → commit, Escape cancels); committing the range closes the popover and returns focus.
- Invalid ranges (`end < start`, unavailable spans) drive `FieldError`, including the `(v: ValidationResult) => string` face.

## 8 Divergence from reference

1. **Export path quarantine:** `./date-range-picker` → `react-aria/date-range-picker`.
2. **Styled Dialog (ruled):** ref imports raw `Dialog` from `react-aria-components` — its popover content skipped the cluster's dialog chrome entirely; aligned to the private styled `Dialog` with `closeButton={false}` and `p-0` dialog slot, matching DatePicker.
3. **`shouldForceLeadingZeros = true` default (ruled):** ref omits it, contradicting DatePicker/DateField; aligned.
4. **Token renames (ruled):** separator `text-gray-800` → `text-foreground`, `group-disabled:text-gray-200` → `text-muted-foreground`.
5. **A recipe added where the ref styled everything inline (ruled):** first as `dateRangePickerVariants`, shape-matched to `datePickerVariants`; since 2026-09-03 the two are one `pickerVariants` (§4, §8.13).
6. **Trigger size aligned:** ref uses `size="icon"` where DatePicker uses `size="icon-sm"` with an explicit `size-4` icon; normalized to `icon-sm` as part of the parity ruling.
7. **Icon swap:** the reference calendar icon becomes the named Phosphor `CalendarBlank` import (cluster-wide choice, stated in date-picker §8).
8. **Kept:** open RAC prop spread; no preset support; private internals private. `errorMessage` is widened to the shared ReactNode/render-function face.
9. **Interim-only regular dependency:** `tailwindcss-react-aria-components` modifiers (`group-disabled:` et al.) die with the tier.
10. Adds `container` with nearest-ThemeScope default, matching DatePicker.
11. Inherited RAC `fieldGroupVariants` uses `bg-card` instead of `bg-background`, aligning the range field box with the input-surface convention.
12. **Density retokenization (2026-09-02):** the `input` slot reads `--control-px-md` and the control type pair; `py-*` is omitted because FieldGroup height is already pinned to `--control-h-md`.
13. **One picker recipe, one picker shell, one read-only fill; the dead modal stack deleted.** _(Amended 2026-09-03; spec 08 "Overlay and field shared spine", user stories 5 and 10; the full entry is [date-picker](date-picker.md) §8.11 and is not restated here.)_ For this component it means: `dateRangePickerVariants` is gone and `pickerVariants({ range: true })` takes its place (§4); the assembly moves to `internal/picker-shell.tsx`; the recipe's `isReadOnly` axis is gone and `PickerShell` hands `isReadOnly` to the FieldGroup, so the trigger glyph loses the `bg-muted` it should never have carried while the field box keeps its fill; and the popover's overlay-container stamp goes with the modal that read it.

## 9 Test requirements

- Role/label queries: group by label; the two `role="presentation"` rows' `spinbutton`s located by their `<part>, Start Date` / `<part>, End Date` names; trigger `button`; popover `dialog`; days by `gridcell`.
- Segment editing in both inputs fires `onChange` with `{ start, end }` once both are complete; leading zeros render by default.
- Open/select flow: trigger opens dialog; select start then end in the grid → `onChange` fires with the range and the popover closes; Escape mid-selection cancels and returns focus to the trigger.
- Invalid range (end before start) sets `data-invalid` and renders `errorMessage` (string and function forms).
- Overlay nesting regression: DateRangePicker inside the public base-ui `Dialog` — paging the grid and anchoring then committing both endpoints must not fire the host's `onOpenChange` and must leave the host visible _(amended 2026-09-03, §8.13: this replaces the deleted Modal/`OVERLAY_CONTAINER_ATTR` seam test)_.
- `isReadOnly`: segments inert, `bg-muted` group from the FieldGroup axis (and no tint on the trigger glyph, §8.13), popover does not open; `startName`/`endName` submit ISO strings in a form.
- Explicit and nearest-scope container behavior; nested ThemeScope retains its theme.
- Dual-density: FieldGroup height and DateInput inline padding/type match the signed `md` rung at `dense` and `comfortable`; nested `data-density` does not rescope.
- Shared focus-ring helper: keyboard focus on a start-row segment paints the `focusRing({ target: "state" })` ring on the FieldGroup and never a second ring on the segment; mouse focus paints none; both density stamps. _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain `.tsx` demos: `date-range-picker-basic` (label/description), `date-range-picker-controlled` (value + onChange), `date-range-picker-validation` (min/max + unavailable dates + function errorMessage), `date-range-picker-states` (disabled, read-only, required), `date-range-picker-in-modal` (picker hosted in the public base-ui Dialog).
