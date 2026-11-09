---
"@elmeragroup/fuse": minor
---

Adds `RangeCalendar` from `@elmeragroup/fuse/range-calendar` and the root entry: a calendar that
selects a range of days, on `Calendar`'s parts, whose values are `Temporal.PlainDate`s. It is the
Temporal replacement for the interim `@elmeragroup/fuse/react-aria/range-calendar`, which stays
unchanged.

```tsx
import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

<RangeCalendar.Root aria-label="Stay" defaultValue={{ start: "2026-10-12", end: "2026-10-16" }}>
  <RangeCalendar.Header>
    <RangeCalendar.DecrementMonth />
    <RangeCalendar.VisibleRangeHeading />
    <RangeCalendar.IncrementMonth />
  </RangeCalendar.Header>
  <RangeCalendar.Months />
</RangeCalendar.Root>;
```

- The value is `{ start, end }`; each end takes a `Temporal.PlainDate` from any implementation or
  its ISO text, and `onValueChange` hands back this runtime's `PlainDate`s, earlier day first.
- The first day pressed anchors the range, which then follows the hovered or focused day across
  every visible month until a second day completes it. Enter or Space anchors and moves focus on a
  day, Escape drops the anchor, and focus leaving the calendar or a press released outside it
  completes the range (`commitBehavior="select"`) or drops it (`"reset"`), as React Aria does. A
  touch that scrolls the page leaves the range open.
- `isDateUnavailable` receives the anchored day, and an anchored range reaches only the available
  days around its anchor, looked for up to `visibleMonths` months each way, as in React Aria. A
  longer range can span an unavailable day further out; check it in `onValueChange`.
- The range ends' names start with the whole range ("Selected Range: Monday, October 12 to Friday,
  October 16, 2026"), and the focused day describes what selecting it does, as React Aria's do in the
  four locales.
- Its grids are `aria-multiselectable`. A range left open when the calendar turns read-only or
  disabled is dropped, never completed.
- `onValueChange` passes details with a `reason` (`"day-press"`, `"keyboard"`, `"outside-press"`,
  `"focus-out"`) and `cancel()`. React Aria has no equivalent. `getValidationError()` names a
  failing range in `ValidityState`'s words, as `Calendar` does: `"rangeUnderflow"`,
  `"rangeOverflow"` or `"unavailable"`.

`Calendar.DayGridCell` now also writes its day's selection data attributes, bare and present only
while they hold (`data-selected`, `data-in-range`, `data-selection-start`, `data-selection-end`,
`data-highlighted`, `data-invalid`), as the day button does, so a range's band can be painted
across the cells. In forced colors, `Calendar`'s selected day and a range's ends take the system's
`Highlight`.
