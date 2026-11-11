// What a picker holds for one end before it commits, as one state that says where it came from,
// and the pure transitions its gestures make over it. DatePicker holds one end; DateRangePicker
// two (`date-range-picker/range-draft.ts`). React Aria's picker states keep a selected date and a
// selected time beside each other; here an end has one draft, so it has exactly one time,
// whichever gesture gave it last:
//
// - `empty`: nothing for the end.
// - `value`: a whole value, typed in the end's input, committed, or set by a preset. Its time is
//   its own.
// - `day`: a day picked in the calendar, with the end's value at the time typed in the popup for
//   it, or none yet (the end shows midnight until one comes, and an empty time picker that stays
//   open waits for it).
// - `time`: a wall-clock time typed in the popup with no day for the end yet, waiting for one. It
//   is a `Temporal.PlainTime`, never a value of a kind or zone, so it takes the picker's kind and
//   zone as they are when its day comes.
//
// The Root derives each part's value from the draft in the picker's kind now: an input shows
// `endValue`, the calendar and the popup time input sit on `endDay`, and the time input shows
// `endTime`. A change of the empty picker's zone or kind moves a held end's time with it (`inKind`),
// so no end commits in a zone or kind the picker no longer has.
//
// A day picked for an end follows React Aria's rule, whichever gesture gave the end its time:
// `useDatePickerState` and `useDateRangePickerState` move a picked day under the time with
// `ZonedDateTime.set`, which keeps the value as it is while its wall clock does not change and
// otherwise resolves the new wall clock as a typed one (`"compatible"`: on a repeated hour the
// earlier instant). So a day picked again keeps the instant its time was stepped to, and a time
// moved to another day takes that day's earlier instant (`pickEndDay`). The day moves under a value
// in the value's own zone and kind, which a range end may hold apart from its start's; only a time
// the picker made (typed in the popup, or held with no day) takes the picker's kind now.

import { valueKind } from "../../temporal/temporal-value";
import type { TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { boundDay } from "../calendar/calendar-dates";
import { dayAtTime, dayInKind, heldTimeValue, inKind, wallTimeOf } from "./picker-value";

/** One end's draft; see the module comment. */
export type EndpointDraft =
  | { readonly _tag: "empty" }
  | { readonly _tag: "value"; readonly value: TemporalValue }
  | { readonly _tag: "day"; readonly day: Temporal.PlainDate; readonly time: TemporalValue | null }
  | { readonly _tag: "time"; readonly time: Temporal.PlainTime };

/** An end that is a day picked in the calendar, with the time typed for it or none yet. */
export type DayEnd = Extract<EndpointDraft, { readonly _tag: "day" }>;

/** An end a calendar pick leaves: a value that kept its own time, or a picked day. */
export type PickedEnd = Extract<EndpointDraft, { readonly _tag: "day" | "value" }>;

/** An end with nothing. */
export const EMPTY_END: EndpointDraft = { _tag: "empty" };

/**
 * An end that is a value, or nothing: the draft of a value the picker holds, committed or set by a
 * preset or an input.
 *
 * @param value - The value, or `null`.
 * @returns The draft.
 */
export function endOfValue(value: TemporalValue | null): EndpointDraft {
  return value === null ? EMPTY_END : { _tag: "value", value };
}

/**
 * An end's value as its input shows it, in the picker's kind now: the value, a picked day at its
 * time (midnight until one is typed), or nothing for a time with no day yet.
 *
 * @param draft - The end's draft.
 * @param kind - The picker's kind now.
 * @returns The value, or `null`.
 */
export function endValue(draft: EndpointDraft, kind: ValueKind): TemporalValue | null {
  switch (draft._tag) {
    case "empty":
    case "time":
      return null;
    case "value":
      return draft.value;
    case "day":
      return dayEndValue(draft, kind);
  }
}

/**
 * A picked day's value as its input shows it, in the picker's kind now: the day at the time typed
 * for it, or midnight until one is.
 *
 * @param end - The picked day.
 * @param kind - The picker's kind now.
 * @returns The value.
 */
export function dayEndValue(end: DayEnd, kind: ValueKind): TemporalValue {
  return end.time === null ? dayAtTime(end.day, kind, null) : inKind(end.time, kind);
}

/**
 * The day an end's input shows: its picked day, or its value's own wall-clock day. The calendar
 * selects it, and the end's popup time input forms a typed time on it; `null` while the end holds
 * no day (see `standInDay`).
 *
 * @param draft - The end's draft.
 * @returns The day, or `null`.
 */
export function endDay(draft: EndpointDraft): Temporal.PlainDate | null {
  switch (draft._tag) {
    case "empty":
    case "time":
      return null;
    case "value":
      return boundDay(draft.value);
    case "day":
      return draft.day;
  }
}

/**
 * The kind an end's popup time input forms values in: the end's value's own, while it holds a
 * value, else the picker's kind now, which a picked day's time and a held time take (`endTime`).
 * The input keeps no kind of its own (`DateInputScope`), so this is its one source.
 *
 * @param draft - The end's draft.
 * @param kind - The picker's kind now.
 * @returns The kind.
 */
export function endKind(draft: EndpointDraft, kind: ValueKind): ValueKind {
  return draft._tag === "value" ? valueKind(draft.value) : kind;
}

/**
 * The value an end's popup time input shows and edits, in the picker's kind now: the value itself,
 * a picked day at its typed time, or a time typed with no day yet (see `heldTimeValue`). A picked
 * day without a time shows none, since its midnight is no time anyone chose. A picked day's time
 * sits on that day, so the input steps the hour through that day's instants: the repeated hour of
 * a night the clocks go back, not the typing day's.
 *
 * @param draft - The end's draft.
 * @param kind - The picker's kind now.
 * @returns The value, or `null`.
 */
export function endTime(draft: EndpointDraft, kind: ValueKind): TemporalValue | null {
  switch (draft._tag) {
    case "empty":
      return null;
    case "value":
      return draft.value;
    case "day":
      return draft.time === null ? null : inKind(draft.time, kind);
    case "time":
      return heldTimeValue(draft.time, kind);
  }
}

/**
 * Whether an end is a picked day still waiting for its time, which an empty time picker that
 * stays open holds rather than commits.
 *
 * @param draft - The end's draft.
 * @returns Whether it is a picked day without a time.
 */
export function endAwaitsTime(draft: EndpointDraft): boolean {
  return draft._tag === "day" && draft.time === null;
}

/**
 * A day picked in the calendar for an end: the end becomes that day, keeping the time it had, by
 * React Aria's rule (see the module comment). A value with a time, or a picked day's typed time,
 * that already sits on the day stays as it is, so a repeated hour keeps the instant it was stepped
 * to. Any other time takes the day at its wall-clock time, resolved as a typed time is
 * (`dayAtTime`): on a repeated hour the earlier instant. A value's time resolves in the value's own
 * zone and kind, and stays a value; a time the picker made resolves in the picker's kind now.
 *
 * @param draft - The end's draft.
 * @param day - The picked day.
 * @param kind - The picker's kind now.
 * @returns The end's draft: the value on the picked day, or the picked day.
 */
export function pickEndDay(draft: EndpointDraft, day: Temporal.PlainDate, kind: ValueKind): PickedEnd {
  switch (draft._tag) {
    case "value": {
      const time = wallTimeOf(draft.value);
      if (time === null) {
        return { _tag: "day", day, time: null };
      }
      return boundDay(draft.value).equals(day)
        ? draft
        : { _tag: "value", value: dayAtTime(day, valueKind(draft.value), time) };
    }
    case "day": {
      if (draft.time === null || boundDay(draft.time).equals(day)) {
        return { _tag: "day", day, time: draft.time };
      }
      return { _tag: "day", day, time: dayAtTime(day, kind, wallTimeOf(draft.time)) };
    }
    case "time":
      return { _tag: "day", day, time: dayAtTime(day, kind, draft.time) };
    case "empty":
      return { _tag: "day", day, time: null };
  }
}

/**
 * The value a calendar pick leaves an end with, in the picker's kind now; see `endValue`.
 *
 * @param end - The end a pick left.
 * @param kind - The picker's kind now.
 * @returns The value: midnight on a picked day until a time comes.
 */
export function pickedEndValue(end: PickedEnd, kind: ValueKind): TemporalValue {
  return end._tag === "value" ? end.value : dayEndValue(end, kind);
}

/**
 * A time typed in an end's popup time input: a value takes it on its own day, a picked day takes
 * it on that day, and an end with no day holds its wall-clock time until one comes. The typed value
 * is of the picker's kind now, and a value or a picked day keeps it whole, so a repeated hour keeps
 * the instant the input stepped to.
 *
 * @param draft - The end's draft.
 * @param time - A value holding the typed time.
 * @param kind - The picker's kind.
 * @returns The end's draft; the same draft for a typed value with no time.
 */
export function editEndTime(draft: EndpointDraft, time: TemporalValue, kind: ValueKind): EndpointDraft {
  switch (draft._tag) {
    case "value":
      return endOfValue(dayInKind(boundDay(draft.value), kind, time));
    case "day":
      return { ...draft, time: dayInKind(draft.day, kind, time) };
    case "empty":
    case "time": {
      // No day for the end: only the wall time waits, never the typed value's kind or zone.
      const wall = wallTimeOf(time);
      return wall === null ? draft : { _tag: "time", time: wall };
    }
  }
}

/**
 * Every segment of an end's popup time input was cleared: a picked day goes back to midnight, a
 * time with no day is forgotten, and a value keeps its own time, which the input shows again.
 *
 * @param draft - The end's draft.
 * @returns The end's draft, the same draft for an empty end, or `undefined` for a value, whose
 *   time cannot be cleared.
 */
export function clearEndTime(draft: EndpointDraft): EndpointDraft | undefined {
  switch (draft._tag) {
    case "value":
      return undefined;
    case "day":
      return { ...draft, time: null };
    case "time":
      return EMPTY_END;
    case "empty":
      return draft;
  }
}
