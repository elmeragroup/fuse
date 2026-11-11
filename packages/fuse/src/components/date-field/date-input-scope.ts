"use client";

// Which units a DateInput shows, decided by the control around it rather than a public prop. A
// date picker's popup edits only the time of the value it holds, as React Spectrum's picker puts a
// time field under its calendar: the same DateInput, its segments cut to the hour onwards, so the
// popup's time and the picker's input share every editing rule. No public time-only kind or
// TimeField comes with it; the picker's `TimeInput` parts are its only callers.
//
// This module is the one owner of the day a time-only input's time sits on: the day its control
// holds, or, while the control holds none, the stand-in day (`standInDay`). The control also
// supplies the input's kind: a time-only input edits a value its control owns, so it keeps no
// kind of its own, and a kind a value it once showed named never outlives that value.

import { createContext } from "react";

import { referenceDay } from "../../temporal/reference-day";
import type { ValueKind } from "../../temporal/temporal-value";
import type { EditableSegmentType } from "./date-draft";

/** The units a DateInput shows: its date and time down to its granularity, or the time alone. */
export type DateInputUnits = "date-time" | "time";

/** The units a time-only input leaves out. */
export const DATE_UNITS: ReadonlySet<EditableSegmentType> = new Set(["year", "month", "day"]);

/**
 * Whether an input of these units shows a unit, which both its segments and the format it writes
 * them in read: every unit, or a time-only input's units from the hour on.
 *
 * @param units - The input's units.
 * @param unit - The unit.
 * @returns Whether it is shown.
 */
export function scopeShows(units: DateInputUnits, unit: EditableSegmentType): boolean {
  return units === "date-time" || !DATE_UNITS.has(unit);
}

/**
 * What the control around a DateInput decides about it. A time-only input edits the time of a
 * value on `day`, the day the control holds (its value's day, or a day picked without a value
 * yet), so a time typed for that day forms on it, in the offset the zone has that day. `null`
 * while the control holds no day: the time then sits on the stand-in day (see `standInDay`). Its
 * values are of `kind`, which the control supplies every render in place of the input's own kind
 * resolution and memory.
 */
export type DateInputScope =
  | { readonly units: "date-time" }
  | { readonly units: "time"; readonly day: Temporal.PlainDate | null; readonly kind: ValueKind };

/** The scope of a DateInput that no control decides about: every unit, on today's day. */
export const FULL_SCOPE: DateInputScope = { units: "date-time" };

/** The scope the control around a DateInput gives it; a DateInput anywhere else shows every unit. */
export const DateInputScopeContext = createContext<DateInputScope>(FULL_SCOPE);

/**
 * The day a time-only input forms and shows a time on while its control holds no day: the
 * reference day, on which the zones Fuse's markets use move no clocks, so no wall time typed on it
 * falls in a gap. The control commits the time on its own day once one comes. Forming and showing
 * a held time on this one day keeps the value the input commits and the one it is shown the same,
 * so the digits typed so far carry on. It is no day anyone chose, so the input names its zone for
 * today, as it does while empty.
 *
 * @returns The day, a new object each call.
 */
export function standInDay(): Temporal.PlainDate {
  return referenceDay();
}

/**
 * Whether a scope's input shows a time its control holds with no day, on {@link standInDay}.
 *
 * @param scope - The input's scope.
 * @returns Whether the scope is time-only and its control holds no day.
 */
export function onStandInDay(scope: DateInputScope): boolean {
  return scope.units === "time" && scope.day === null;
}
