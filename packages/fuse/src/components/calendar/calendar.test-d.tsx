import { expectTypeOf, test } from "vitest";

import { Calendar } from "@elmeragroup/fuse/calendar";
import type {
  CalendarDayButtonState,
  CalendarDayFlagState,
  CalendarPageBehavior,
  CalendarRootValueChangeEventDetails,
  CalendarValidationError,
  CalendarValueChangeReason,
  CalendarVisibleRangeChangeEventDetails,
} from "@elmeragroup/fuse/calendar";

test("Root takes a PlainDate or its ISO text and reports a PlainDate", () => {
  const _iso = <Calendar.Root aria-label="Delivery" defaultValue="2026-10-14" />;
  const _empty = <Calendar.Root aria-label="Delivery" value={null} />;
  const _date = (
    <Calendar.Root
      aria-label="Delivery"
      value={Temporal.PlainDate.from("2026-10-14")}
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>();
        expectTypeOf(details).toEqualTypeOf<CalendarRootValueChangeEventDetails>();
      }}
    />
  );
  // @ts-expect-error a calendar selects a day, not an instant
  const _instant = <Calendar.Root aria-label="Delivery" value={new Date()} />;
  expectTypeOf<CalendarValueChangeReason>().toEqualTypeOf<"day-press" | "keyboard">();
});

test("bounds take any Temporal date kind or its text, independent of the value", () => {
  const _mixed = (
    <Calendar.Root
      aria-label="Delivery"
      minValue={Temporal.ZonedDateTime.from("2026-10-01T00:00+02:00[Europe/Oslo]")}
      maxValue="2026-12-31T23:30:00"
    />
  );
});

test("details cancel and report the gesture", () => {
  expectTypeOf<CalendarRootValueChangeEventDetails["cancel"]>().toEqualTypeOf<() => void>();
  expectTypeOf<ReturnType<CalendarRootValueChangeEventDetails["getValidationError"]>>().toEqualTypeOf<
    "rangeUnderflow" | "rangeOverflow" | "unavailable" | null
  >();
  expectTypeOf<CalendarValidationError>().toEqualTypeOf<"rangeUnderflow" | "rangeOverflow" | "unavailable">();
  expectTypeOf<CalendarVisibleRangeChangeEventDetails["reason"]>().toEqualTypeOf<
    "increment-press" | "decrement-press" | "keyboard"
  >();
  const _visible = (
    <Calendar.Root
      aria-label="Delivery"
      onVisibleRangeChange={(start) => expectTypeOf(start).toEqualTypeOf<Temporal.PlainYearMonth>()}
    />
  );
});

test("pageBehavior and firstDayOfWeek take their own names only", () => {
  expectTypeOf<CalendarPageBehavior>().toEqualTypeOf<"visible" | "single">();
  // @ts-expect-error pageBehavior is visible | single
  const _paged = <Calendar.Root aria-label="Delivery" pageBehavior="all" />;
  // @ts-expect-error firstDayOfWeek takes React Aria's three-letter names
  const _monday = <Calendar.Root aria-label="Delivery" firstDayOfWeek={1} />;
});

test("Months renders its default months or a function of each month", () => {
  const _default = <Calendar.Months />;
  const _custom = (
    <Calendar.Months>{(month) => <Calendar.Month key={month.toString()} value={month} />}</Calendar.Months>
  );
  // @ts-expect-error the months are a function of each month, not elements
  const _elements = <Calendar.Months>{[]}</Calendar.Months>;
});

test("DayButton's render callback receives the day's state", () => {
  const _button = (
    <Calendar.DayButton
      render={(props, state) => {
        expectTypeOf(state).toEqualTypeOf<CalendarDayButtonState>();
        return <button {...props} />;
      }}
    />
  );
});

test("DayGridCell's render callback receives the day's flags", () => {
  const _cell = (
    <Calendar.DayGridCell
      value={Temporal.PlainDate.from("2026-10-14")}
      render={(props, state) => {
        expectTypeOf(state).toEqualTypeOf<CalendarDayFlagState>();
        return <td {...props} />;
      }}
    />
  );
});
