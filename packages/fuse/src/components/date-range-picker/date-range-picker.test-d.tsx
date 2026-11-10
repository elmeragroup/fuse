import { expectTypeOf, test } from "vitest";

import { DateRangePicker, DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import type {
  DateRangePickerValidationError,
  DateRangePickerValue,
  DateRangePickerValueChangeReason,
} from "@elmeragroup/fuse/date-range-picker";

// Hand-written kinds, the table `madeKind` in temporal/temporal-value.ts follows at runtime: a
// value or default value names the kind; without one, granularity "day" or none makes a PlainDate
// whatever the zone, and a time unit makes a ZonedDateTime with a zone and a PlainDateTime without.
type Granularity = "day" | "hour" | "minute" | "second";
const ZONED = Temporal.ZonedDateTime.from("2026-10-05T09:30+02:00[Europe/Oslo]");
const LOCAL = Temporal.PlainDateTime.from("2026-10-05T09:30");

test("DateRangePickerField's range names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DateRangePickerField
        key="no props"
        label="Period"
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateRangePickerField
        key="zone alone"
        label="Period"
        timeZone="Europe/Oslo"
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateRangePickerField
        key="time unit"
        label="Period"
        granularity="minute"
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DateRangePickerField
        key="time unit and zone"
        label="Period"
        granularity="minute"
        timeZone="Europe/Oslo"
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.ZonedDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateRangePickerField
        key="any granularity"
        label="Period"
        granularity={granularity}
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<
            Temporal.PlainDate | Temporal.PlainDateTime
          > | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime>()
        }
      />,
      <DateRangePickerField
        key="optional zone"
        label="Period"
        granularity="hour"
        timeZone={zone}
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<
            Temporal.PlainDateTime | Temporal.ZonedDateTime
          > | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime>()
        }
      />,
      <DateRangePickerField
        key="default value"
        label="Period"
        defaultValue={{ start: ZONED, end: ZONED.add({ days: 4 }) }}
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.ZonedDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateRangePickerField
        key="value beside props"
        label="Period"
        value={{ start: LOCAL, end: LOCAL.add({ days: 4 }) }}
        granularity="minute"
        timeZone="Europe/Oslo"
        onChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
    ];
  }
  expectTypeOf(table).toBeFunction();
});

test("DateRangePicker.Root's range names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DateRangePicker.Root
        key="no props"
        aria-label="Period"
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateRangePicker.Root
        key="zone alone"
        aria-label="Period"
        timeZone="Europe/Oslo"
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DateRangePicker.Root
        key="time unit"
        aria-label="Period"
        granularity="minute"
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DateRangePicker.Root
        key="time unit and zone"
        aria-label="Period"
        granularity="minute"
        timeZone="Europe/Oslo"
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.ZonedDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateRangePicker.Root
        key="any granularity"
        aria-label="Period"
        granularity={granularity}
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<
            Temporal.PlainDate | Temporal.PlainDateTime
          > | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | Temporal.PlainDateTime>()
        }
      />,
      <DateRangePicker.Root
        key="optional zone"
        aria-label="Period"
        granularity="hour"
        timeZone={zone}
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<
            Temporal.PlainDateTime | Temporal.ZonedDateTime
          > | null>()
        }
        isDateUnavailable={(value) =>
          expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | Temporal.ZonedDateTime>()
        }
      />,
      <DateRangePicker.Root
        key="default value"
        aria-label="Period"
        defaultValue={{ start: ZONED, end: ZONED.add({ days: 4 }) }}
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.ZonedDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DateRangePicker.Root
        key="value beside props"
        aria-label="Period"
        value={{ start: LOCAL, end: LOCAL.add({ days: 4 }) }}
        granularity="minute"
        timeZone="Europe/Oslo"
        onValueChange={(value) =>
          expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDateTime> | null>()
        }
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
    ];
  }
  expectTypeOf(table).toBeFunction();
});

test("DateRangePicker.Root passes cancelable details with its reasons", () => {
  const _root = (
    <DateRangePicker.Root
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>();
        expectTypeOf(details.reason).toEqualTypeOf<DateRangePickerValueChangeReason>();
        expectTypeOf(details.getValidationError()).toEqualTypeOf<DateRangePickerValidationError | null>();
      }}
    />
  );
});

test("no date prop takes ISO text", () => {
  const day = Temporal.PlainDate.from("2026-10-09");
  // @ts-expect-error a range's start is a Temporal object
  const _start = <DateRangePickerField label="Period" value={{ start: "2026-10-05", end: day }} />;
  // @ts-expect-error a range's end is a Temporal object
  const _end = <DateRangePickerField label="Period" defaultValue={{ start: day, end: "2026-10-09" }} />;
  // @ts-expect-error a bound is a Temporal object
  const _min = <DateRangePickerField label="Period" minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _max = <DateRangePickerField label="Period" maxValue="2026-10-31" />;
  // @ts-expect-error a range's start is a Temporal object
  const _rootStart = <DateRangePicker.Root value={{ start: "2026-10-05", end: day }} />;
  // @ts-expect-error a range's end is a Temporal object
  const _rootEnd = <DateRangePicker.Root defaultValue={{ start: day, end: "2026-10-09" }} />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMin = <DateRangePicker.Root minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMax = <DateRangePicker.Root maxValue="2026-10-31" />;
  // @ts-expect-error a range needs both ends
  const _half = <DateRangePickerField label="Period" value={{ start: day }} />;
});

test("a misspelt or undeclared prop does not compile", () => {
  // @ts-expect-error granularity is misspelt
  const _fieldMisspelt = <DateRangePickerField label="Period" granulartiy="minute" />;
  // @ts-expect-error field takes no `disabled`
  const _fieldUndeclared = <DateRangePickerField label="Period" disabled />;
  // @ts-expect-error granularity is misspelt
  const _rootMisspelt = <DateRangePicker.Root aria-label="Period" granulartiy="minute" />;
  // @ts-expect-error root takes no `isDisabled`
  const _rootUndeclared = <DateRangePicker.Root aria-label="Period" isDisabled />;
});

test("an explicit Temporal type argument does not compile: the props name the kind", () => {
  // @ts-expect-error the kind is not a type argument
  const _fieldTyped = <DateRangePickerField<Temporal.PlainDate> label="Period" />;
  // @ts-expect-error the kind is not a type argument
  const _rootTyped = <DateRangePicker.Root<Temporal.PlainDate> aria-label="Period" />;
});
