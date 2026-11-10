---
"@elmeragroup/fuse": minor
---

Adds `DateField` and the `DateInput` parts from `@elmeragroup/fuse/date-field` and the root entry:
a segmented input for a date, a date and time, or a date and time in a zone, whose values are
Temporal values. It is the Temporal replacement for the interim
`@elmeragroup/fuse/react-aria/date-field`, which stays unchanged.

```tsx
import { DateField } from "@elmeragroup/fuse/date-field";

<DateField label="Moving date" name="moving" defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
<DateField label="Outage starts" granularity="minute" hourCycle={24} timeZone="Europe/Oslo" />;
```

- `DateField` keeps the interim prop names (`label`, `description`, `errorMessage`, `isInvalid`,
  `isDisabled`, `isReadOnly`, `isRequired`, `value`, `defaultValue`, `onChange`, `minValue`,
  `maxValue`, `isDateUnavailable`, `granularity`, `hourCycle`, `hideTimeZone`, `size`,
  `shouldForceLeadingZeros`), and adds `timeZone`, the zone an empty field's `ZonedDateTime` takes.
  Values are `Temporal.PlainDate`, `PlainDateTime` or `ZonedDateTime` objects from any
  implementation, never their ISO text; `onChange` hands back this runtime's value of the field's
  kind, which an emptied field keeps. A value is built in a client component, as for `Calendar`.
  The field holds no state, so a server component renders it without a date value.
- The kind is typed without a type argument: a `value` or `defaultValue` names what `onChange` and
  `isDateUnavailable` receive, and without either `granularity` and `timeZone` do, as at runtime.
  No granularity or `"day"` gives a `PlainDate`, a time `granularity` a `PlainDateTime`, and a time
  `granularity` with `timeZone` a `ZonedDateTime`, so the second field above reports
  `Temporal.ZonedDateTime | null`. A `granularity` or `timeZone` whose type is a union gives the
  union of the kinds it could make.
- Segments follow the locale's order and React Aria's editing rules: typed digits fill a segment
  and move on, the arrows step and wrap it (a zoned hour through the real hours of a DST night),
  Page Up and Page Down by a page, Home and End to its ends, Backspace removes a digit, and the day
  period takes its first letter. A key held with Ctrl, Cmd or Alt is left to the browser. A value
  commits once every segment is filled; February 30 waits for blur and commits as the month's
  last day.
- `minValue` and `maxValue` take any kind, compared as React Aria compares them, and a failing
  value reports React Aria's words ("Value must be 10/31/2026 or earlier.", "Selected date
  unavailable.") in the `LocaleProvider`'s locale. A half-typed or empty required field reports
  itself too.
- Inside `Form`, or a `Field.Root` of your own around `DateInput.Root`, the field is a Field: its
  ISO text reaches `onFormSubmit` and `FormData` under its `name`, its validity blocks a submit,
  and the form focuses its first segment for an error, a returned one included.
- `DateInput.Root` and `DateInput.Segment` are the parts, with Base UI's names (`value`,
  `onValueChange`, `disabled`, `readOnly`, `required`, `invalid`, `render`). `onValueChange` passes
  details with a `reason` (`"input-change"`, `"input-clear"`, `"input-paste"`),
  `getValidationError()`, which names a failure in Calendar's words (`"rangeUnderflow"`,
  `"rangeOverflow"`, `"unavailable"`), and `cancel()`. React Aria has no equivalent. Its children
  receive each segment as `DateInputSegmentData`, a literal, the zone's name or a unit:
  `isEditable` narrows `type` to a unit, and `type` tells the other two apart.
- Segments are spinbuttons named by their unit and the label ("month, Moving date"), textboxes on
  iOS, with the numeric keyboard and a Next key, and the field handles Android's composition input.
