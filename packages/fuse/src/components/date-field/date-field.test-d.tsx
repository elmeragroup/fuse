import { expectTypeOf, test } from "vitest";

import type { CalendarValidationError } from "@elmeragroup/fuse/calendar";
import { DateField, DateInput } from "@elmeragroup/fuse/date-field";
import type {
  DateInputSegmentData,
  DateInputValidationError,
  DateInputValueChangeEventDetails,
  DateInputValueChangeReason,
} from "@elmeragroup/fuse/date-field";

// Hand-written kinds, the table `madeKind` in temporal/temporal-value.ts follows at runtime: a
// value or default value names the kind; without one, granularity "day" or none makes a PlainDate
// whatever the zone, and a time unit makes a ZonedDateTime with a zone and a PlainDateTime without.
type Granularity = "day" | "hour" | "minute" | "second";
const ZONED = Temporal.ZonedDateTime.from("2026-10-05T09:30+02:00[Europe/Oslo]");
const LOCAL = Temporal.PlainDateTime.from("2026-10-05T09:30");

test("DateField's value names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DateField
        key="no props"
        label="Starts"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateField
        key="zone alone"
        label="Starts"
        timeZone="Europe/Oslo"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateField
        key="time unit"
        label="Starts"
        granularity="minute"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DateField
        key="time unit and zone"
        label="Starts"
        granularity="minute"
        timeZone="Europe/Oslo"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateField
        key="any granularity"
        label="Starts"
        granularity={granularity}
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime>()
        }
      />,
      <DateField
        key="optional zone"
        label="Starts"
        granularity="hour"
        timeZone={zone}
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime>()
        }
      />,
      <DateField
        key="default value"
        label="Starts"
        defaultValue={ZONED}
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateField
        key="value beside props"
        label="Starts"
        value={LOCAL}
        granularity="minute"
        timeZone="Europe/Oslo"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
    ];
  }
  expectTypeOf(table).toBeFunction();
});

test("DateInput.Root's value names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DateInput.Root
        key="no props"
        aria-label="Starts"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateInput.Root
        key="zone alone"
        aria-label="Starts"
        timeZone="Europe/Oslo"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateInput.Root
        key="time unit"
        aria-label="Starts"
        granularity="second"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DateInput.Root
        key="time unit and zone"
        aria-label="Starts"
        granularity="second"
        timeZone="Europe/Oslo"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateInput.Root
        key="any granularity"
        aria-label="Starts"
        granularity={granularity}
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime>()
        }
      />,
      <DateInput.Root
        key="optional zone"
        aria-label="Starts"
        granularity="hour"
        timeZone={zone}
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime>()
        }
      />,
      <DateInput.Root
        key="default value"
        aria-label="Starts"
        defaultValue={ZONED}
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateInput.Root
        key="value beside props"
        aria-label="Starts"
        value={LOCAL}
        granularity="second"
        timeZone="Europe/Oslo"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
    ];
  }
  expectTypeOf(table).toBeFunction();
});

test("no date prop takes ISO text", () => {
  // @ts-expect-error a value is a Temporal object
  const _value = <DateField label="Starts" value="2026-10-05" />;
  // @ts-expect-error a default value is a Temporal object
  const _default = <DateField label="Starts" defaultValue="2026-10-05" />;
  // @ts-expect-error a bound is a Temporal object
  const _min = <DateField label="Starts" minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _max = <DateField label="Starts" maxValue="2026-10-31" />;
  // @ts-expect-error a value is a Temporal object
  const _rootValue = <DateInput.Root aria-label="Starts" value="2026-10-05" />;
  // @ts-expect-error a default value is a Temporal object
  const _rootDefault = <DateInput.Root aria-label="Starts" defaultValue="2026-10-05" />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMin = <DateInput.Root aria-label="Starts" minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMax = <DateInput.Root aria-label="Starts" maxValue="2026-10-31" />;
  // @ts-expect-error a date field holds a Temporal value, not a Date
  const _date = <DateField label="Start date" value={new Date()} />;
});

test("bounds take any Temporal kind, and the other props keep their own unions", () => {
  const _bounds = (
    <DateField
      label="Starts"
      granularity="minute"
      timeZone="Europe/Oslo"
      hourCycle={24}
      hideTimeZone
      minValue={Temporal.PlainDate.from("2026-10-01")}
      maxValue={Temporal.PlainDateTime.from("2026-10-31T23:30")}
    />
  );
  // @ts-expect-error the hour cycle is 12 or 24
  const _cycle = <DateField label="Starts" hourCycle={23} />;
  // @ts-expect-error a field edits down to the day, hour, minute or second
  const _month = <DateField label="Starts" granularity="month" />;
});

test("DateInput.Root passes cancelable details and lists segments to its children", () => {
  const _root = (
    <DateInput.Root
      aria-label="Starts"
      granularity="minute"
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

test("a misspelt or undeclared prop does not compile", () => {
  // @ts-expect-error granularity is misspelt
  const _fieldMisspelt = <DateField label="Starts" granulartiy="minute" />;
  // @ts-expect-error field takes no `disabled`
  const _fieldUndeclared = <DateField label="Starts" disabled />;
  // @ts-expect-error granularity is misspelt
  const _rootMisspelt = <DateInput.Root aria-label="Starts" granulartiy="minute" />;
  // @ts-expect-error root takes no `isDisabled`
  const _rootUndeclared = <DateInput.Root aria-label="Starts" isDisabled />;
});

test("a spread's undeclared key does not compile; destructured away, the spread keeps the kind", () => {
  // The shape a form library hands a controlled field: the props it takes, plus `ref` and `disabled`.
  const field = {
    label: "Starts",
    value: LOCAL,
    ref: (_element: HTMLElement | null) => undefined,
    disabled: false,
  };
  // @ts-expect-error a spread key is checked like a written one: field takes no `ref` or `disabled`
  const _spreadUndeclared = <DateField {...field} />;
  const { ref: _ref, disabled: _disabled, ...taken } = field;
  const _spreadTaken = (
    <DateField
      {...taken}
      onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
    />
  );
});

test("an explicit Temporal type argument does not compile: the props name the kind", () => {
  // @ts-expect-error the kind is not a type argument
  const _fieldTyped = <DateField<Temporal.PlainDate> label="Starts" />;
  // @ts-expect-error the kind is not a type argument
  const _rootTyped = <DateInput.Root<Temporal.PlainDate> aria-label="Starts" />;
});
