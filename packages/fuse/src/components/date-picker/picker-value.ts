// The value rules both date pickers share on top of DateInput's and Calendar's: a calendar day in
// the picker's kind, the calendar's unavailable check, and the kind an input a reset remounts must
// keep. The kind itself resolves as DateInput's does (`date-field/use-value-kind.ts`).

import { useMemo } from "react";

import { referenceDay } from "../../temporal/reference-day";
import { sameKind, valueKind } from "../../temporal/temporal-value";
import type { ResolvedKind, TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { boundDay } from "../calendar/calendar-dates";
import { parseTemporalProp, printedProp } from "../calendar/calendar-input";
import { placeholderValue } from "../date-field/date-draft";
import { standInDay } from "../date-field/date-input-scope";
import type { DatePickerPresetRange, DatePickerPresetValue } from "./picker-change-details";

/**
 * A day at a wall-clock time as a value of the picker's kind, resolved as a typed date and time
 * is: on a repeated hour the earlier instant, in a skipped one the instant after it (Temporal's
 * `"compatible"`). Midnight without a time.
 *
 * @param day - The day.
 * @param kind - The picker's kind now.
 * @param time - The wall-clock time, or `null` for midnight.
 * @returns The value.
 */
export function dayAtTime(
  day: Temporal.PlainDate,
  kind: ValueKind,
  time: Temporal.PlainTime | null
): TemporalValue {
  if (time === null) {
    return placeholderValue(day, kind);
  }
  switch (kind.kind) {
    case "PlainDate":
      return day;
    case "PlainDateTime":
      return day.toPlainDateTime(time);
    case "ZonedDateTime":
      return day.toZonedDateTime({ timeZone: kind.timeZone, plainTime: time });
  }
}

/**
 * A value's wall-clock time, or `null` for a date, which has none.
 *
 * @param value - The value.
 * @returns The time.
 */
export function wallTimeOf(value: TemporalValue): Temporal.PlainTime | null {
  return "hour" in value ? value.toPlainTime() : null;
}

/**
 * A wall time with no day yet as a value a popup time input shows, in the picker's kind and zone
 * now, on the stand-in day (`standInDay`): the input holds no day of the picker's, and the picker
 * commits the time on its day when one comes (see `dayAtTime`).
 *
 * @param time - The wall-clock time.
 * @param kind - The picker's kind now.
 * @returns The value.
 */
export function heldTimeValue(time: Temporal.PlainTime, kind: ValueKind): TemporalValue {
  return dayAtTime(standInDay(), kind, time);
}

/**
 * A value in the picker's kind now: the value itself while its kind and zone are the picker's,
 * else its day at its wall-clock time in the picker's kind, as a change of the empty picker's
 * zone or kind moves a time it held.
 *
 * @param value - The value.
 * @param kind - The picker's kind now.
 * @returns The value.
 */
export function inKind(value: TemporalValue, kind: ValueKind): TemporalValue {
  return sameKind(valueKind(value), kind) ? value : dayAtTime(boundDay(value), kind, wallTimeOf(value));
}

/**
 * One value of a preset's `dateValue` as this runtime's Temporal value of the picker's kind.
 *
 * @throws TypeError naming the prop, the Root and both kinds when its kind is not the picker's, or
 *   as `printedProp` does for text: host defects.
 */
function presetEnd(value: TemporalValue, owner: PickerOwner, kind: ValueKind, prop: string): TemporalValue {
  const parsed = parseTemporalProp(String(printedProp(value, PRESET_OWNER, prop)), PRESET_OWNER, prop);
  const received = valueKind(parsed).kind;
  if (received !== kind.kind) {
    throw new TypeError(
      `${PRESET_OWNER} ${prop}: received a Temporal.${received} inside ${owner}, whose values are Temporal.${kind.kind}; give the preset a value of the picker's kind.`
    );
  }
  return parsed;
}

/**
 * A preset's `dateValue` as a DatePicker value: this runtime's Temporal value of the picker's
 * kind, read while the preset renders, as the Root reads its own value props. A value in another
 * zone keeps its zone, as the Root's own `value` does.
 *
 * @param preset - The preset's `dateValue`.
 * @param kind - The picker's resolved kind.
 * @returns The value.
 * @throws TypeError for a range, text, or a value of another kind than the picker's: host defects.
 */
export function presetDate(preset: DatePickerPresetValue, kind: ValueKind): TemporalValue {
  if ("start" in preset) {
    throw new TypeError(
      "DatePicker.PresetItem dateValue: received a { start, end } range inside DatePicker.Root, which takes one Temporal value; a range is DateRangePicker.Root's."
    );
  }
  return presetEnd(preset, "DatePicker.Root", kind, "dateValue");
}

/**
 * A preset's `dateValue` as a DateRangePicker range: each end this runtime's Temporal value of the
 * picker's kind, so a range never mixes kinds.
 *
 * @param preset - The preset's `dateValue`.
 * @param kind - The picker's resolved kind.
 * @returns The range.
 * @throws TypeError for one value, text, or an end of another kind than the picker's: host defects.
 */
export function presetRange(preset: DatePickerPresetValue, kind: ValueKind): DatePickerPresetRange {
  if (!("start" in preset)) {
    throw new TypeError(
      "DatePicker.PresetItem dateValue: received one Temporal value inside DateRangePicker.Root, which takes a { start, end } range."
    );
  }
  return {
    start: presetEnd(preset.start, "DateRangePicker.Root", kind, "dateValue.start"),
    end: presetEnd(preset.end, "DateRangePicker.Root", kind, "dateValue.end"),
  };
}

/** The part a preset's errors name. */
const PRESET_OWNER = "DatePicker.PresetItem";

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
  return placeholderValue(referenceDay(), resolved.kind);
}
