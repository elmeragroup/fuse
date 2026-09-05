# Calendar

## 1 Header

- **Canonical name:** `Calendar` (secondary exports: `CalendarHeader`, `CalendarGridHeader`)
- **Export path:** `@elmeragroup/ui/react-aria/calendar` — `react-aria/` quarantine prefix (path-policy ruling).
- **RSC:** client
- **Tier:** **react-aria interim** — composite over `react-aria-components` `Calendar`. **Public by user ruling:** the ref had zero direct consumers outside the pickers, but the export is a deliberate API addition. **Migration roadmap:** replaced by a base-ui/custom calendar; bare `@elmeragroup/ui/calendar` is minted for the successor and this module deleted.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/calendar.tsx` + `styles/calendar.ts`.

## 2 Anatomy

```
AriaCalendar                       (RAC Calendar; base slot: bordered card surface)
├─ CalendarHeader                  (plain <header>)
│  ├─ Button slot="previous"       (private RAC Button, ghost/icon) > CaretLeft (named icon import)
│  ├─ Heading                      (RAC Heading via private heading internal, size="lg")
│  └─ Button slot="next"           > CaretRight                  (named import; icons swap in RTL)
├─ CalendarGrid  (body slot)       weekdayStyle="short"
│  ├─ CalendarGridHeader > CalendarHeaderCell (×7, headerCell slot)
│  └─ CalendarGridBody > CalendarCell (render prop per date, cell slot)
└─ Text slot="errorMessage"        — when `errorMessage` (error slot)
```

`CalendarHeader` and `CalendarGridHeader` stay exported — `RangeCalendar` composes them, and they are the reuse seam for custom calendar bodies. The month-navigation buttons are the **sole reason the private RAC `Button` internal exists**: RAC calendars wire `slot="previous"/"next"` through RAC context, which the base-ui Button cannot fill. That internal stays private and dies with the tier.

## 3 Props

`CalendarProps<T extends DateValue>` — spreads onto RAC `Calendar` with `visibleDuration` omitted (single-month only, kept from ref). Open RAC surface: `value`, `defaultValue`, `onChange`, `focusedValue`, `defaultFocusedValue`, `onFocusChange`, `minValue`, `maxValue`, `isDateUnavailable`, `isDisabled`, `isReadOnly`, `isInvalid`, `firstDayOfWeek`, `autoFocus`, …

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `errorMessage` | `ReactNode` | — | renders `Text slot="errorMessage"`; Calendar has no ValidationResult render face |
| `className` | `string \| (renderProps) => string` | — | Composed onto the `base` slot |

`CalendarHeader` takes no props (reads `useLocale()` for RTL icon flipping). `CalendarGridHeader` takes no props.

## 4 Variants

`calendarVariants` — slotted tv recipe in `styles/calendar.ts`, **module-private**. Slots: `base`, `header`, `heading`, `headerCell`, `body`, `cell` (extends shared `focusRing({ target: "state", isFocusVisible })` via a flattened `cellVariants`), `error`. Variant axes on `cell`, driven by RAC cell render props: `isSelected` (false → hover/pressed fills; true → primary fill), `isDisabled`, `isUnavailable`. No public recipe export. Private previous/next Buttons borrow `buttonVariants`, including its self-focus adapter.

## 5 Consumed tokens

`card` + `card-foreground` (calendar surface), `border` (surface border — ref `border-black/10`), `foreground` (unselected cell text — ref `text-zinc-900`), `muted` (cell hover — ref `bg-gray-100`), `accent` (cell pressed — ref `aria-pressed:bg-gray-200`), `primary` + `primary-foreground` (selected cell — ref `text-white`), `error` (invalid selected cell + error text — ref `destructive`), `muted-foreground` (weekday header cells — ref `text-gray-500`; disabled/unavailable cells — ref `text-gray-300`), `ring` (focus ring via `focusRing`). Cells are `rounded-full`; surface `rounded` + `shadow-md`. Forced-colors fallbacks kept.

## 6 Data attributes

- **Emitted:** RAC attributes only — `data-selected`, `data-disabled`, `data-unavailable`, `data-outside-month`, `data-focused`, `data-invalid`, `data-pressed` on cells; `data-disabled` on nav buttons at range bounds. No custom `data-slot` in the ref; the port adds none.
- **Consumed:** cell styling goes through tv render-prop variants (not attribute selectors); one exception kept from the ref — `aria-pressed:bg-*` on unselected cells.

## 7 Accessibility

- RAC grid semantics: `role="application"`-free calendar with `role="grid"`, `role="rowheader"`-less weekday `columnheader`s, `role="gridcell"` days; the visible `Heading` is `aria-live` month/year and labels the grid.
- Keyboard per RAC: Arrow keys move day focus in the grid; PageUp/PageDown previous/next month (Shift for year); Home/End start/end of week; Enter/Space selects.
- Previous/next are real buttons with RAC-provided accessible names; caret icons `aria-hidden`. Icons flip in RTL (`useLocale().direction`).
- `errorMessage` is wired via `Text slot="errorMessage"` → `aria-describedby` when invalid.

## 8 Divergence from reference

1. **Becomes a public export** (user ruling, overriding zero-usage evidence) at `react-aria/calendar` — deliberate API addition; ref treated it as picker plumbing.
2. **Icon swaps:** lucide `ChevronLeft`/`ChevronRight` → Phosphor `CaretLeft`/`CaretRight` from `@elmeragroup/ui/icons` (curated set; conventions §Icons).
3. **Token renames (lint guardrail applies to interim code):** `text-zinc-900` → `text-foreground`; `bg-gray-100` → `bg-muted`; `bg-gray-200` → `bg-accent`; `text-gray-500`/`text-gray-300` → `text-muted-foreground`; `text-white` → `text-primary-foreground`; `destructive` → `error`; `border-black/10` → `border-border`.
4. **Kept:** `visibleDuration` omitted (single month); private RAC Button for slot navigation. `errorMessage` is widened from string to ReactNode for the shared composite convention.
5. **Interim-only regular dependency:** RAC Tailwind modifiers used by cluster styles come from `tailwindcss-react-aria-components`; it dies with the tier.
6. **Focus unified:** cells use the canonical RAC state adapter; navigation Buttons inherit the canonical Button recipe.

## 9 Test requirements

- Role queries: `getByRole("grid")`, `getAllByRole("gridcell")`, nav via `getByRole("button", { name: /previous/i })` / `/next/i`, month heading by `getByRole("heading")`.
- Grid keyboard per §7: ArrowRight/Down move focus a day/week; PageDown advances the month and the heading updates; Enter selects and fires `onChange` with a `DateValue`.
- Selection state: selected cell exposes `aria-selected="true"`; `isDateUnavailable` cells are `aria-disabled` and unselectable; nav button disables at `minValue`/`maxValue` bounds.
- RTL: with `direction: "rtl"` locale, previous button renders CaretRight (icon flip).
- `errorMessage` renders and is referenced by `aria-describedby` when `isInvalid`.

## 10 Demo requirements

Plain `.tsx` demos: `calendar-basic` (uncontrolled defaultValue), `calendar-controlled` (value + onChange + focusedValue), `calendar-bounds` (minValue/maxValue + isDateUnavailable weekends), `calendar-error` (isInvalid + errorMessage), `calendar-rtl` (locale-flipped navigation).
