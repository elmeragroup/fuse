---
"@elmeragroup/fuse": minor
---

Adds `Calendar` from `@elmeragroup/fuse/calendar` and the root entry: a calendar built from parts
whose values are `Temporal.PlainDate`s. It is the Temporal replacement for the interim
`@elmeragroup/fuse/react-aria/calendar`, which stays unchanged.

```tsx
import { Calendar } from "@elmeragroup/fuse/calendar";

<Calendar.Root aria-label="Delivery date" defaultValue="2026-10-14" visibleMonths={2}>
  <Calendar.Header>
    <Calendar.DecrementMonth />
    <Calendar.VisibleRangeHeading />
    <Calendar.IncrementMonth />
  </Calendar.Header>
  <Calendar.Months />
</Calendar.Root>;
```

- Date props take a `Temporal.PlainDate` from any implementation or its ISO text, so a server
  component passes them across the boundary as strings. `onValueChange` hands back this runtime's
  `PlainDate`. Import `@elmeragroup/fuse/temporal-polyfill` once where the engine lacks Temporal.
- Fuse's declarations, the root entry's included, name the global `Temporal` types, which come
  from TypeScript's own lib: type-checking a consumer needs TypeScript 6.0 or later with a `lib`
  that includes `esnext` (or `esnext.temporal`). With an older compiler or lib, Fuse's
  declarations report "Cannot find namespace 'Temporal'", or, under `skipLibCheck`, the date props
  are typed `any`.
- `visibleMonths` shows several months; `pageBehavior` pages them by every visible month or by one.
  Focus moves between the months' grids without paging.
- `minValue` and `maxValue` take any Temporal date kind; `isDateUnavailable` refuses days the user
  can still focus. Day names, the bound suffixes and the month buttons' names match React Aria's in
  the four locales.
- `onValueChange` and `onVisibleRangeChange` pass details with a `reason` and `cancel()`, which keeps
  the value or the months unchanged. React Aria has no equivalent. `onValueChange`'s
  `getValidationError()` names a failure in `ValidityState`'s words, as the tier's other date
  components do: `"rangeUnderflow"`, `"rangeOverflow"` or `"unavailable"`.
- Today is read in an effect and moves at midnight, so a server render marks no today and the
  calendar prerenders.
- `fuse/css`'s shared `data-selected:` variant now matches a present `data-selected` that is not
  `"false"`, as `data-checked:` and `data-active:` do, rather than only `data-selected="true"`.
  The calendar's days write the bare attribute. A Tailwind-source consumer's own `data-selected:`
  utilities now also match an element with a bare `data-selected` or `data-selected=""`, the form
  Base UI's parts and Fuse's chart write, where they matched nothing before.
