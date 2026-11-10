import { expectTypeOf, test } from "vitest";

import type { CalendarDayButtonState, CalendarValidationError } from "@elmeragroup/fuse/calendar";
import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";
import type {
  RangeCalendarCommitBehavior,
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
  RangeCalendarValueChangeReason,
} from "@elmeragroup/fuse/range-calendar";

test("Root takes ends as PlainDates or ISO text and reports PlainDates", () => {
  const _iso = (
    <RangeCalendar.Root aria-label="Stay" defaultValue={{ start: "2026-10-05", end: "2026-10-09" }} />
  );
  const _empty = <RangeCalendar.Root aria-label="Stay" value={null} />;
  const _dates = (
    <RangeCalendar.Root
      aria-label="Stay"
      value={{ start: Temporal.PlainDate.from("2026-10-05"), end: "2026-10-09" }}
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<RangeCalendarValue>();
        expectTypeOf(value.start).toEqualTypeOf<Temporal.PlainDate>();
        expectTypeOf(details).toEqualTypeOf<RangeCalendarRootValueChangeEventDetails>();
      }}
    />
  );
  // @ts-expect-error a range has both ends
  const _half = <RangeCalendar.Root aria-label="Stay" value={{ start: "2026-10-05" }} />;
  // @ts-expect-error a range calendar selects ranges, not one day
  const _single = <RangeCalendar.Root aria-label="Stay" value="2026-10-05" />;
  expectTypeOf<RangeCalendarValueChangeReason>().toEqualTypeOf<
    "day-press" | "keyboard" | "outside-press" | "focus-out"
  >();
});

test("getValidationError names a failing range in ValidityState's words", () => {
  expectTypeOf<ReturnType<RangeCalendarRootValueChangeEventDetails["getValidationError"]>>().toEqualTypeOf<
    "rangeUnderflow" | "rangeOverflow" | "unavailable" | null
  >();
  expectTypeOf<
    ReturnType<RangeCalendarRootValueChangeEventDetails["getValidationError"]>
  >().toEqualTypeOf<CalendarValidationError | null>();
});

test("isDateUnavailable receives the anchor", () => {
  const _unavailable = (
    <RangeCalendar.Root
      aria-label="Stay"
      isDateUnavailable={(date, anchor) => {
        expectTypeOf(date).toEqualTypeOf<Temporal.PlainDate>();
        expectTypeOf(anchor).toEqualTypeOf<Temporal.PlainDate | null>();
        return false;
      }}
    />
  );
});

test("commitBehavior takes select or reset", () => {
  expectTypeOf<RangeCalendarCommitBehavior>().toEqualTypeOf<"select" | "reset">();
  // @ts-expect-error clear is not offered
  const _clear = <RangeCalendar.Root aria-label="Stay" commitBehavior="clear" />;
});

test("the shared day button's render callback receives the range's flags", () => {
  const _button = (
    <RangeCalendar.DayButton
      render={(props, state) => {
        expectTypeOf(state).toEqualTypeOf<CalendarDayButtonState>();
        return <button {...props} />;
      }}
    />
  );
});
