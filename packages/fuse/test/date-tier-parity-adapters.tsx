import type { ReactElement, ReactNode } from "react";

import { parseDate, parseDateTime, parseZonedDateTime, toCalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { vi } from "vitest";

import { Calendar as TemporalCalendar } from "../src/components/calendar";
import { DateField as TemporalDateField } from "../src/components/date-field";
import { DatePicker as TemporalDatePicker, DatePickerField } from "../src/components/date-picker";
import { DateRangePickerField } from "../src/components/date-range-picker";
import { RangeCalendar as TemporalRangeCalendar } from "../src/components/range-calendar";
import { definedProps } from "../src/internal/defined-props";
import { LocaleProvider } from "../src/intl/locale-context";
import { Calendar } from "../src/react-aria/calendar/calendar";
import { DateField } from "../src/react-aria/date-field/date-field";
import {
  DatePicker,
  DatePickerPresetGroup,
  DatePickerPresetItem,
} from "../src/react-aria/date-picker/date-picker";
import { DateRangePicker } from "../src/react-aria/date-range-picker/date-range-picker";
import { RangeCalendar } from "../src/react-aria/range-calendar/range-calendar";
import { UiProviders } from "../src/react-aria/ui-providers/ui-providers";
import "../src/temporal-polyfill";

/**
 * The implementation-neutral face of the date tier that `src/internal/date-tier-parity.browser.test.tsx`
 * drives. Every value crosses it as an ISO 8601 string, the one representation React Aria's
 * `@internationalized/date` objects and TC39 Temporal objects both print and parse alike:
 * `2026-10-12`, `2026-10-12T14:30:00`, `2026-10-31T23:30:00+01:00[Europe/Oslo]`. Each adapter parses
 * those strings into its own value kinds and prints its committed values back through
 * `toString()`, so one scenario table and one set of literal expectations serve every
 * implementation. Props keep the labeled composites' consumer names (`label`, `minValue`,
 * `triggerPlacement`, …), which the replacement tier keeps too.
 *
 * Every scenario runs under `freezeDateTierClock`, so "today" is the same fixed date for every
 * implementation. Faking `Date` reaches React Aria, which reads today through `new Date()`. It does
 * not reach a browser's native `Temporal.Now`: `Temporal.Now.plainDateISO()` keeps returning the
 * real date under a faked `Date`. So an implementation that takes today from `Temporal.Now` must
 * still let its adapter pin today to `DATE_TIER_TODAY`, or its day names and today marking stop
 * matching the literals. It can derive today from `Date.now()` read in the browser's local zone (as
 * React Aria's `today(getLocalTimeZone())` does), which the frozen clock reaches, or take it through
 * a seam of its own.
 */
export type DateTierAdapter = {
  /** Shown in the suite title, so a failure names the implementation it came from. */
  readonly name: string;
  /** The providers a consumer mounts above the date tier, in the en-US locale every scenario uses. */
  readonly Providers: (props: { readonly children: ReactNode }) => ReactElement;
  readonly DatePicker: (props: ParityDatePickerProps) => ReactElement;
  readonly DateRangePicker: (props: ParityDateRangePickerProps) => ReactElement;
  readonly DateField: (props: ParityDateFieldProps) => ReactElement;
  readonly Calendar: (props: ParityCalendarProps) => ReactElement;
  readonly RangeCalendar: (props: ParityRangeCalendarProps) => ReactElement;
};

/**
 * The fixed local calendar date every parity scenario sees as today. It lies outside every month
 * the other scenarios show, since React Aria prefixes today's accessible day name with "Today, "
 * and a real clock would rename a pinned day on the day it falls. It is a plain date, not an
 * instant: the clock freezes at noon in the browser's own zone, so today is this date whatever
 * zone the host runs in.
 */
export const DATE_TIER_TODAY = "2030-06-15";

/**
 * Freeze `Date` at local noon on `DATE_TIER_TODAY` and return the function that restores the real
 * clock, so `beforeEach(freezeDateTierClock)` freezes before each scenario and thaws after it.
 * Only `Date` is faked, so the timers interactions wait on stay real.
 */
export function freezeDateTierClock(): () => void {
  vi.useFakeTimers({ toFake: ["Date"] });
  // A date-time string without an offset parses as local time, so this is noon in the browser's
  // zone on DATE_TIER_TODAY, never the day before or after.
  vi.setSystemTime(new Date(`${DATE_TIER_TODAY}T12:00:00`));
  return () => {
    vi.useRealTimers();
  };
}

/** Bounds and unavailable dates, shared by every surface that takes them. */
type ParityBounds = {
  /** ISO lower bound. Its kind may differ from the value's, as OrderModule's statistics page mixes them. */
  readonly minValue?: string;
  /** ISO upper bound, of any kind. */
  readonly maxValue?: string;
  /** Plain ISO dates (`2026-10-15`) a user may focus but never select. */
  readonly unavailableDates?: readonly string[];
};

/** Time-segment options, as the labeled composites name them. */
type ParityTime = {
  readonly granularity?: "day" | "minute";
  readonly hourCycle?: 12 | 24;
  readonly hideTimeZone?: boolean;
};

/** One preset in the pane beside the picker's calendar. */
export type ParityPreset = {
  readonly value: string;
  readonly label: string;
  readonly isDisabled?: boolean;
};

/** A controlled preset pane: which preset is checked and what pressing one reports. */
export type ParityPresets = {
  readonly value: string | null;
  readonly items: readonly ParityPreset[];
  readonly onChange: (value: string) => void;
};

/** The single-date picker, uncontrolled, reporting each committed value as ISO or `null`. */
export type ParityDatePickerProps = ParityBounds &
  ParityTime & {
    readonly label: string;
    readonly defaultValue?: string;
    readonly description?: string;
    readonly errorMessage?: string;
    readonly isInvalid?: boolean;
    readonly triggerPlacement?: "start" | "end";
    readonly presets?: ParityPresets;
    readonly onChange: (value: string | null) => void;
  };

/** An ISO range. */
export type ParityRange = { readonly start: string; readonly end: string };

/** The range picker, uncontrolled, reporting each committed range as `start..end` ISO or `null`. */
export type ParityDateRangePickerProps = ParityBounds &
  ParityTime & {
    readonly label: string;
    readonly defaultValue?: ParityRange;
    readonly onChange: (value: string | null) => void;
  };

/** The bare date field. */
export type ParityDateFieldProps = ParityTime & {
  readonly label: string;
  readonly defaultValue?: string;
  readonly isReadOnly?: boolean;
};

/** The standalone single-date calendar, named by `label`. */
export type ParityCalendarProps = ParityBounds & {
  readonly label: string;
  readonly defaultValue: string;
  readonly onChange: (value: string) => void;
};

/** The standalone range calendar, named by `label`. */
export type ParityRangeCalendarProps = {
  readonly label: string;
  readonly defaultValue: ParityRange;
  readonly onChange: (value: string) => void;
};

/**
 * One ISO string as the `@internationalized/date` kind its shape names: a bracketed zone makes a
 * ZonedDateTime, a time a CalendarDateTime, a bare date a CalendarDate.
 */
function toDateValue(iso: string): DateValue {
  if (iso.includes("[")) {
    return parseZonedDateTime(iso);
  }
  return iso.includes("T") ? parseDateTime(iso) : parseDate(iso);
}

function optionalDateValue(iso: string | undefined): DateValue | undefined {
  return iso === undefined ? undefined : toDateValue(iso);
}

function toRangeValue(range: ParityRange) {
  return { start: toDateValue(range.start), end: toDateValue(range.end) };
}

/** A committed range as `start..end`, each end printed through its own `toString()`. */
function printRange(range: {
  readonly start: { toString(): string };
  readonly end: { toString(): string };
}): string {
  return `${range.start.toString()}..${range.end.toString()}`;
}

/** React Aria's `isDateUnavailable`, matching a cell's calendar date against the ISO list. */
function unavailability(dates: readonly string[] | undefined): ((date: DateValue) => boolean) | undefined {
  return dates === undefined ? undefined : (date) => dates.includes(toCalendarDate(date).toString());
}

function boundProps(props: ParityBounds) {
  return definedProps({
    minValue: optionalDateValue(props.minValue),
    maxValue: optionalDateValue(props.maxValue),
    isDateUnavailable: unavailability(props.unavailableDates),
  });
}

function timeProps(props: ParityTime) {
  return definedProps({
    granularity: props.granularity,
    hourCycle: props.hourCycle,
    hideTimeZone: props.hideTimeZone,
  });
}

/**
 * The interim tier: `@elmeragroup/fuse/react-aria/*` over React Aria Components and
 * `@internationalized/date`. It is the oracle every other adapter's output must reproduce.
 */
export const reactAriaDateTier: DateTierAdapter = {
  name: "React Aria interim tier",
  Providers: ({ children }) => (
    <UiProviders locale="en-US" navigate={() => undefined}>
      {children}
    </UiProviders>
  ),
  DatePicker: (props) => (
    <DatePicker
      label={props.label}
      {...definedProps({
        defaultValue: optionalDateValue(props.defaultValue),
        description: props.description,
        errorMessage: props.errorMessage,
        isInvalid: props.isInvalid,
        triggerPlacement: props.triggerPlacement,
        presetGroup: props.presets === undefined ? undefined : presetPane(props.presets),
      })}
      {...boundProps(props)}
      {...timeProps(props)}
      onChange={(value) => props.onChange(value === null ? null : value.toString())}
    />
  ),
  DateRangePicker: (props) => (
    <DateRangePicker
      label={props.label}
      {...definedProps({
        defaultValue: props.defaultValue === undefined ? undefined : toRangeValue(props.defaultValue),
      })}
      {...boundProps(props)}
      {...timeProps(props)}
      onChange={(value) => props.onChange(value === null ? null : printRange(value))}
    />
  ),
  DateField: (props) => (
    <DateField
      label={props.label}
      {...definedProps({ defaultValue: optionalDateValue(props.defaultValue), isReadOnly: props.isReadOnly })}
      {...timeProps(props)}
    />
  ),
  Calendar: (props) => (
    <Calendar
      aria-label={props.label}
      defaultValue={toDateValue(props.defaultValue)}
      {...boundProps(props)}
      onChange={(value) => props.onChange(value.toString())}
    />
  ),
  RangeCalendar: (props) => (
    <RangeCalendar
      aria-label={props.label}
      defaultValue={toRangeValue(props.defaultValue)}
      onChange={(value) => props.onChange(printRange(value))}
    />
  ),
};

function presetPane(presets: ParityPresets): ReactElement {
  return (
    <DatePickerPresetGroup value={presets.value} onChange={presets.onChange}>
      {presets.items.map((item) => (
        <DatePickerPresetItem
          key={item.value}
          value={item.value}
          {...definedProps({ isDisabled: item.isDisabled })}>
          {item.label}
        </DatePickerPresetItem>
      ))}
    </DatePickerPresetGroup>
  );
}

/** The Temporal tier's `isDateUnavailable`, matching a value's calendar date against the ISO list. */
function temporalUnavailability(
  dates: readonly string[] | undefined
): ((value: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime) => boolean) | undefined {
  return dates === undefined ? undefined : (value) => dates.includes(value.toString().slice(0, 10));
}

function temporalBoundProps(props: ParityBounds) {
  return definedProps({
    minValue: props.minValue,
    maxValue: props.maxValue,
    isDateUnavailable: temporalUnavailability(props.unavailableDates),
  });
}

function temporalPresetPane(presets: ParityPresets): ReactElement {
  return (
    <TemporalDatePicker.Presets value={presets.value} onValueChange={(value) => presets.onChange(value)}>
      {presets.items.map((item) => (
        <TemporalDatePicker.PresetItem
          key={item.value}
          value={item.value}
          {...definedProps({ disabled: item.isDisabled })}>
          {item.label}
        </TemporalDatePicker.PresetItem>
      ))}
    </TemporalDatePicker.Presets>
  );
}

/**
 * A Calendar's or RangeCalendar's standard face: month buttons around the heading, then the months.
 * Both namespaces share these parts.
 */
function calendarFace(): ReactElement {
  return (
    <>
      <TemporalCalendar.Header>
        <TemporalCalendar.DecrementMonth />
        <TemporalCalendar.VisibleRangeHeading />
        <TemporalCalendar.IncrementMonth />
      </TemporalCalendar.Header>
      <TemporalCalendar.Months />
    </>
  );
}

/**
 * The Temporal tier: `@elmeragroup/fuse/{date-picker,date-range-picker,date-field,calendar,range-calendar}`
 * over TC39 Temporal. It takes the scenarios' ISO strings as they are, since every Temporal prop also
 * takes ISO text, and prints its values through `toString()`. Its today comes from `Date.now()`, which
 * `freezeDateTierClock` reaches.
 */
export const temporalDateTier: DateTierAdapter = {
  name: "Temporal tier",
  Providers: ({ children }) => <LocaleProvider locale="en-US">{children}</LocaleProvider>,
  DatePicker: (props) => (
    <DatePickerField
      label={props.label}
      {...definedProps({
        defaultValue: props.defaultValue,
        description: props.description,
        errorMessage: props.errorMessage,
        isInvalid: props.isInvalid,
        triggerPlacement: props.triggerPlacement,
        presetGroup: props.presets === undefined ? undefined : temporalPresetPane(props.presets),
      })}
      {...temporalBoundProps(props)}
      {...timeProps(props)}
      onChange={(value) => props.onChange(value === null ? null : value.toString())}
    />
  ),
  DateRangePicker: (props) => (
    <DateRangePickerField
      label={props.label}
      {...definedProps({ defaultValue: props.defaultValue })}
      {...temporalBoundProps(props)}
      {...timeProps(props)}
      onChange={(value) => props.onChange(value === null ? null : printRange(value))}
    />
  ),
  DateField: (props) => (
    <TemporalDateField
      label={props.label}
      {...definedProps({ defaultValue: props.defaultValue, isReadOnly: props.isReadOnly })}
      {...timeProps(props)}
    />
  ),
  Calendar: (props) => (
    <TemporalCalendar.Root
      aria-label={props.label}
      defaultValue={props.defaultValue}
      {...temporalBoundProps(props)}
      onValueChange={(value) => props.onChange(value.toString())}>
      {calendarFace()}
    </TemporalCalendar.Root>
  ),
  RangeCalendar: (props) => (
    <TemporalRangeCalendar.Root
      aria-label={props.label}
      defaultValue={props.defaultValue}
      onValueChange={(value) => props.onChange(printRange(value))}>
      {calendarFace()}
    </TemporalRangeCalendar.Root>
  ),
};

/** Every implementation the parity suite runs: the interim oracle, then its replacement. */
export const DATE_TIER_ADAPTERS: readonly DateTierAdapter[] = [reactAriaDateTier, temporalDateTier];
