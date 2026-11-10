// The value rules both date pickers share on top of DateInput's and Calendar's: a calendar day in
// the picker's kind, the calendar's unavailable check, and the kind an input a reset remounts must
// keep. The kind itself resolves as DateInput's does (`date-field/use-value-kind.ts`).

import { useMemo } from "react";

import { temporal } from "../../temporal/temporal";
import type { ResolvedKind, TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { placeholderValue } from "../date-field/date-draft";

/** A picker Root, named in diagnostics. */
export type PickerOwner = "DatePicker.Root" | "DateRangePicker.Root";

/**
 * A calendar day as a picker value: the day itself for a date, or the day at the time `base`
 * holds, in its zone, so picking a day keeps the time; midnight when there is no value yet.
 *
 * @param day - The day.
 * @param kind - The picker's kind.
 * @param base - The value whose time the day keeps, or `null`.
 * @returns The value.
 */
export function dayInKind(
  day: Temporal.PlainDate,
  kind: ValueKind,
  base: TemporalValue | null
): TemporalValue {
  return base !== null && "hour" in base
    ? base.with({ year: day.year, month: day.month, day: day.day })
    : placeholderValue(day, kind);
}

/**
 * The calendar's unavailable check: a day is unavailable when its midnight in the picker's kind
 * is. It keeps one identity while the kind does, which `useValueKind` keeps while its parts hold.
 *
 * @param unavailable - The picker's `isDateUnavailable`, or `undefined`.
 * @param kind - The picker's kind.
 * @returns The day check, or `undefined`.
 */
export function useDayUnavailable(
  unavailable: ((value: TemporalValue) => boolean) | undefined,
  kind: ValueKind
): ((day: Temporal.PlainDate) => boolean) | undefined {
  return useMemo(
    () =>
      unavailable === undefined
        ? undefined
        : (day: Temporal.PlainDate) => unavailable(dayInKind(day, kind, null)),
    [unavailable, kind]
  );
}

/**
 * A value of the picker's kind for an input's `defaultValue` beside its controlled `value`, when a
 * value or default value named that kind. DateInput resolves its kind from its value, then the kind
 * a value named before, then its default value, then its granularity; an input a form reset
 * remounts holds no kind yet, so with an empty value its kind would come from `granularity` and
 * `timeZone` alone, and a zoned picker showing only the day (`granularity="day"`) would emit
 * PlainDates, a zoned picker without `timeZone` PlainDateTimes. Handing this witness as
 * `defaultValue` keeps the named kind and zone. A kind `granularity` and `timeZone` made gets no
 * witness: the input takes the same props, makes the same kind, and follows them when they change,
 * as the calendar does. A controlled input never shows its default value.
 *
 * @param resolved - The picker's resolved kind.
 * @returns A value of that kind, a new object each call, or `undefined` for a kind the props made,
 *   and for a PlainDate, the kind an empty input takes anyway.
 */
export function kindWitness(resolved: ResolvedKind): TemporalValue | undefined {
  if (!resolved.named || resolved.kind.kind === "PlainDate") {
    return undefined;
  }
  // Any day serves: only the witness's kind and zone are read, and a controlled input never shows it.
  return placeholderValue(temporal().PlainDate.from({ year: 2001, month: 1, day: 1 }), resolved.kind);
}
