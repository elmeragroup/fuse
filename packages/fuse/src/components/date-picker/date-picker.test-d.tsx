import { expectTypeOf, test } from "vitest";

import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";
import type {
  DatePickerOpenChangeReason,
  DatePickerPresetsValueChangeEventDetails,
  DatePickerValidationError,
  DatePickerValueChangeReason,
} from "@elmeragroup/fuse/date-picker";

// Hand-written kinds, the table `madeKind` in temporal/temporal-value.ts follows at runtime: a
// value or default value names the kind; without one, granularity "day" or none makes a PlainDate
// whatever the zone, and a time unit makes a ZonedDateTime with a zone and a PlainDateTime without.
type Granularity = "day" | "hour" | "minute" | "second";
const ZONED = Temporal.ZonedDateTime.from("2026-10-05T09:30+02:00[Europe/Oslo]");
const LOCAL = Temporal.PlainDateTime.from("2026-10-05T09:30");

test("DatePickerField's value names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DatePickerField
        key="no props"
        label="Starts"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DatePickerField
        key="zone alone"
        label="Starts"
        timeZone="Europe/Oslo"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DatePickerField
        key="time unit"
        label="Starts"
        granularity="minute"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DatePickerField
        key="time unit and zone"
        label="Starts"
        granularity="minute"
        timeZone="Europe/Oslo"
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DatePickerField
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
      <DatePickerField
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
      <DatePickerField
        key="default value"
        label="Starts"
        defaultValue={ZONED}
        onChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DatePickerField
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

test("DatePicker.Root's value names the kind it reports, else granularity and timeZone do", () => {
  function table(granularity: Granularity, zone: string | undefined) {
    return [
      <DatePicker.Root
        key="no props"
        aria-label="Starts"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DatePicker.Root
        key="zone alone"
        aria-label="Starts"
        timeZone="Europe/Oslo"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate>()}
      />,
      <DatePicker.Root
        key="time unit"
        aria-label="Starts"
        granularity="minute"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.PlainDateTime>()}
      />,
      <DatePicker.Root
        key="time unit and zone"
        aria-label="Starts"
        granularity="minute"
        timeZone="Europe/Oslo"
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DatePicker.Root
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
      <DatePicker.Root
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
      <DatePicker.Root
        key="default value"
        aria-label="Starts"
        defaultValue={ZONED}
        onValueChange={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>()}
        isDateUnavailable={(value) => expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>()}
      />,
      <DatePicker.Root
        key="value beside props"
        aria-label="Starts"
        value={LOCAL}
        granularity="minute"
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
  const _value = <DatePickerField label="Starts" value="2026-10-05" />;
  // @ts-expect-error a default value is a Temporal object
  const _default = <DatePickerField label="Starts" defaultValue="2026-10-05" />;
  // @ts-expect-error a bound is a Temporal object
  const _min = <DatePickerField label="Starts" minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _max = <DatePickerField label="Starts" maxValue="2026-10-31" />;
  // @ts-expect-error a value is a Temporal object
  const _rootValue = <DatePicker.Root value="2026-10-05" />;
  // @ts-expect-error a default value is a Temporal object
  const _rootDefault = <DatePicker.Root defaultValue="2026-10-05" />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMin = <DatePicker.Root minValue="2026-10-01" />;
  // @ts-expect-error a bound is a Temporal object
  const _rootMax = <DatePicker.Root maxValue="2026-10-31" />;
  // @ts-expect-error a picker holds a Temporal value, not a Date
  const _date = <DatePickerField label="Start date" value={new Date()} />;
  // @ts-expect-error the trigger sits at the start or the end
  const _placement = <DatePickerField label="Start date" triggerPlacement="middle" />;
});

test("DatePicker.Root passes cancelable details with its reasons", () => {
  const _root = (
    <DatePicker.Root
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>();
        expectTypeOf(details.reason).toEqualTypeOf<DatePickerValueChangeReason>();
        expectTypeOf(details.getValidationError()).toEqualTypeOf<DatePickerValidationError | null>();
        expectTypeOf(details.cancel).toEqualTypeOf<() => void>();
      }}
      onOpenChange={(open, details) => {
        expectTypeOf(open).toEqualTypeOf<boolean>();
        expectTypeOf(details.reason).toEqualTypeOf<DatePickerOpenChangeReason>();
      }}
    />
  );
  // @ts-expect-error the Input takes its value from the Root
  const _input = <DatePicker.Input value={Temporal.PlainDate.from("2026-10-05")} />;
  // @ts-expect-error a preset item needs its key
  const _preset = <DatePicker.PresetItem>Today</DatePicker.PresetItem>;
});

test("DatePicker.Presets passes the key and cancelable details, as the picker's callbacks do", () => {
  const _presets = (
    <DatePicker.Presets
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<string>();
        expectTypeOf(details).toEqualTypeOf<DatePickerPresetsValueChangeEventDetails>();
        expectTypeOf(details.reason).toEqualTypeOf<"preset-press">();
        expectTypeOf(details.trigger).toEqualTypeOf<Element | undefined>();
        expectTypeOf(details.cancel).toEqualTypeOf<() => void>();
      }}
    />
  );
});

test("a misspelt or undeclared prop does not compile", () => {
  // @ts-expect-error granularity is misspelt
  const _fieldMisspelt = <DatePickerField label="Starts" granulartiy="minute" />;
  // @ts-expect-error field takes no `disabled`
  const _fieldUndeclared = <DatePickerField label="Starts" disabled />;
  // @ts-expect-error granularity is misspelt
  const _rootMisspelt = <DatePicker.Root aria-label="Starts" granulartiy="minute" />;
  // @ts-expect-error root takes no `isDisabled`
  const _rootUndeclared = <DatePicker.Root aria-label="Starts" isDisabled />;
});

test("an explicit Temporal type argument does not compile: the props name the kind", () => {
  // @ts-expect-error the kind is not a type argument
  const _fieldTyped = <DatePickerField<Temporal.PlainDate> label="Starts" />;
  // @ts-expect-error the kind is not a type argument
  const _rootTyped = <DatePicker.Root<Temporal.PlainDate> aria-label="Starts" />;
});
