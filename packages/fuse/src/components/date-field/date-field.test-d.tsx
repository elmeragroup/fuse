import { expectTypeOf, test } from "vitest";

import type { CalendarValidationError } from "@elmeragroup/fuse/calendar";
import { DateField, DateInput } from "@elmeragroup/fuse/date-field";
import type {
  DateInputSegmentData,
  DateInputValidationError,
  DateInputValueChangeEventDetails,
  DateInputValueChangeReason,
} from "@elmeragroup/fuse/date-field";

test("DateField reports a PlainDate by default, and any kind for ISO text alone", () => {
  const _field = (
    <DateField
      label="Start date"
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>();
      }}
    />
  );
  // Text names its kind only at runtime, so text alone reports any kind; a type argument or a
  // Temporal value names it.
  const _text = (
    <DateField
      label="Start date"
      defaultValue="2026-10-05"
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<
          Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | null
        >();
      }}
    />
  );
  const _typed = (
    <DateField<Temporal.PlainDate>
      label="Start date"
      defaultValue="2026-10-05"
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>();
      }}
    />
  );
  // @ts-expect-error a date field holds a Temporal value, not a Date
  const _date = <DateField label="Start date" value={new Date()} />;
});

test("DateField's type parameter names the kind it reports", () => {
  const _zoned = (
    <DateField<Temporal.ZonedDateTime>
      label="Starts"
      granularity="minute"
      timeZone="Europe/Oslo"
      hourCycle={24}
      hideTimeZone
      minValue="2026-10-01T00:00[Europe/Oslo]"
      maxValue={Temporal.PlainDateTime.from("2026-10-31T23:30")}
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>();
      }}
      isDateUnavailable={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>();
        return false;
      }}
    />
  );
  // @ts-expect-error the hour cycle is 12 or 24
  const _cycle = <DateField label="Starts" hourCycle={23} />;
  // @ts-expect-error a field edits down to the day, hour, minute or second
  const _month = <DateField label="Starts" granularity="month" />;
});

test("DateInput.Root passes cancelable details and lists segments to its children", () => {
  const _root = (
    <DateInput.Root<Temporal.PlainDateTime>
      aria-label="Starts"
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>();
        expectTypeOf(details).toEqualTypeOf<DateInputValueChangeEventDetails>();
        details.cancel();
      }}>
      {(segment) => {
        expectTypeOf(segment).toEqualTypeOf<DateInputSegmentData>();
        return <DateInput.Segment key={segment.index} segment={segment} />;
      }}
    </DateInput.Root>
  );
  expectTypeOf<DateInputValueChangeReason>().toEqualTypeOf<"input-change" | "input-clear" | "input-paste">();
});

test("a segment's isEditable narrows its type to a unit or to a literal or the zone's name", () => {
  const _root = (
    <DateInput.Root aria-label="Starts">
      {(segment) => {
        if (segment.isEditable) {
          expectTypeOf(segment.type).toEqualTypeOf<
            "year" | "month" | "day" | "hour" | "dayPeriod" | "minute" | "second"
          >();
          expectTypeOf(segment.isPlaceholder).toEqualTypeOf<boolean>();
        } else {
          expectTypeOf(segment.type).toEqualTypeOf<"literal" | "timeZoneName">();
          expectTypeOf(segment.isPlaceholder).toEqualTypeOf<false>();
        }
        return <DateInput.Segment key={segment.index} segment={segment} />;
      }}
    </DateInput.Root>
  );
});

test("a segment's type tells a literal, the zone's name and a unit apart", () => {
  expectTypeOf<Extract<DateInputSegmentData, { type: "literal" }>>().toEqualTypeOf<{
    readonly type: "literal";
    readonly index: number;
    readonly text: string;
    readonly isPlaceholder: false;
    readonly isEditable: false;
  }>();
  expectTypeOf<Extract<DateInputSegmentData, { type: "timeZoneName" }>>().toEqualTypeOf<{
    readonly type: "timeZoneName";
    readonly index: number;
    readonly text: string;
    readonly isPlaceholder: false;
    readonly isEditable: false;
  }>();
  const _root = (
    <DateInput.Root aria-label="Starts">
      {(segment) => {
        if (segment.type === "timeZoneName") {
          expectTypeOf(segment.isEditable).toEqualTypeOf<false>();
        } else if (segment.type !== "literal") {
          expectTypeOf(segment.isEditable).toEqualTypeOf<true>();
        }
        return <DateInput.Segment key={segment.index} segment={segment} />;
      }}
    </DateInput.Root>
  );
});

test("DateInput reports a value's validation error in Calendar's words, plus its own two", () => {
  expectTypeOf<DateInputValidationError>().toEqualTypeOf<
    "rangeUnderflow" | "rangeOverflow" | "unavailable" | "valueMissing" | "incomplete"
  >();
  expectTypeOf<
    ReturnType<DateInputValueChangeEventDetails["getValidationError"]>
  >().toEqualTypeOf<CalendarValidationError | null>();
});
