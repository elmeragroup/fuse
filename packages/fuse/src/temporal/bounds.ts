// Where a value falls against a minimum and maximum of any kind. A bound's kind is independent of
// the value's: a ZonedDateTime field may take a ZonedDateTime minimum and a PlainDateTime maximum.
// The comparison reproduces React Aria's `value.compare(bound)` from `@internationalized/date`, so
// moving off the interim date tier keeps every validation result:
//
// - A PlainDate value compares days with the bound's own date. A ZonedDateTime bound gives the
//   date on its own wall clock, in its own zone.
// - A PlainDateTime value compares wall clocks. A PlainDate bound reads as its midnight, so 10:00
//   on the maximum's day is past a PlainDate maximum; a ZonedDateTime bound gives its own wall
//   clock, in its own zone.
// - A ZonedDateTime value compares instants. A plain bound reads as that wall clock in the value's
//   zone, a PlainDate bound as its midnight there. A wall clock a DST change skips or repeats
//   resolves as Temporal's "compatible": the later instant for a gap, the earlier for an overlap.

import { temporal } from "./temporal";
import { hasTime, isZoned } from "./temporal-value";
import type { TemporalValue } from "./temporal-value";

/** Where a value falls against its bounds. */
export type BoundsCheck = "underflow" | "within" | "overflow";

/** A value's minimum and maximum. Either may be absent. */
export type Bounds = {
  /** The earliest value allowed, itself allowed. */
  readonly min: TemporalValue | undefined;
  /** The latest value allowed, itself allowed. */
  readonly max: TemporalValue | undefined;
};

/** A plain bound as a wall clock: a PlainDate at its midnight. */
function plainWallClock(bound: Temporal.PlainDate | Temporal.PlainDateTime): Temporal.PlainDateTime {
  return hasTime(bound) ? bound : bound.toPlainDateTime();
}

/** `value` against `bound`: negative before it, zero at it, positive after it. */
function compareWithBound(value: TemporalValue, bound: TemporalValue): number {
  const runtime = temporal();
  if (isZoned(value)) {
    const instant = isZoned(bound)
      ? bound
      : plainWallClock(bound).toZonedDateTime(value.timeZoneId, { disambiguation: "compatible" });
    return runtime.ZonedDateTime.compare(value, instant);
  }
  if (hasTime(value)) {
    const wallClock = isZoned(bound) ? bound.toPlainDateTime() : plainWallClock(bound);
    return runtime.PlainDateTime.compare(value, wallClock);
  }
  // Both kinds with a time have `toPlainDate`, so `hasTime` need not tell them apart here.
  return runtime.PlainDate.compare(value, hasTime(bound) ? bound.toPlainDate() : bound);
}

/**
 * Where a value falls against a minimum and maximum of any kind, by React Aria's rules: see this
 * module's header for how each pair of kinds compares.
 *
 * @param value - The value, of this runtime's Temporal.
 * @param bounds - The minimum and maximum, of this runtime's Temporal; each optional.
 * @returns `"underflow"` before the minimum, `"overflow"` after the maximum, `"within"` otherwise.
 *   The minimum is checked first, so a value outside reversed bounds reads as `"underflow"`.
 */
export function checkBounds(value: TemporalValue, bounds: Bounds): BoundsCheck {
  if (bounds.min !== undefined && compareWithBound(value, bounds.min) < 0) {
    return "underflow";
  }
  if (bounds.max !== undefined && compareWithBound(value, bounds.max) > 0) {
    return "overflow";
  }
  return "within";
}
