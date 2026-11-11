"use client";

// The zone's name a zoned DateInput writes after its time, and the clock read it takes. An empty
// zoned input names its zone as it is today, as React Aria's does, since the name changes with
// summer time; so does a time-only input showing a time on the stand-in day, which no one chose
// (`standInDay`). Any other value names the zone at its own instant. This module owns that choice
// (`zoneNamingInstant`), which the segments' name and a paste's check both read.

import { useLayoutEffect, useMemo, useState } from "react";

import type { TemporalValue } from "../../temporal/temporal-value";
import { EMPTY_ZONE_INSTANT, formatInstant, writesZoneName, zoneNameAt } from "./date-field-format";
import type { FieldFormat } from "./date-field-format";
import { onStandInDay } from "./date-input-scope";
import type { DateInputScope } from "./date-input-scope";

/**
 * The instant an input names a value's zone at: the value's own, or `null` for today while it shows
 * no value, or a time on the stand-in day, which names no day anyone chose. The name the segments
 * write (`useFieldZoneName`) and the name pasted text must carry (`date-input-paste.ts`) both read
 * it, so the input reads back the text it writes.
 *
 * @param value - The value shown, or `null` for none.
 * @param scope - The input's scope.
 * @returns The instant in epoch milliseconds, or `null` for today (see `todayInstant`).
 */
export function zoneNamingInstant(value: TemporalValue | null, scope: DateInputScope): number | null {
  return value === null || onStandInDay(scope) ? null : formatInstant(value);
}

/**
 * Today, as `zoneNamingInstant`'s `null` means it: `Date.now()` rather than `Temporal.Now`, so a
 * test that fakes `Date` fakes it too, as `today()` does.
 *
 * @returns Epoch milliseconds.
 */
export function todayInstant(): number {
  return Date.now();
}

/**
 * The zone's name a field's segments and description write.
 *
 * The clock is read once the input has mounted, never while rendering, so the server and the
 * hydrating render write the same fixed instant's name (`EMPTY_ZONE_INSTANT`), and only by a field
 * that writes a zone name and names it for today (`todayInstant`). The name read is kept, `null`
 * while it is the fixed instant's, so a clock read that changes no name renders nothing again.
 *
 * @param format - The field's format.
 * @param instant - The instant the field names its zone at (`zoneNamingInstant`), or `null` for today.
 * @returns The name, such as "GMT+2"; empty for a field that writes none.
 */
export function useFieldZoneName(format: FieldFormat, instant: number | null): string {
  const readsClock = instant === null && writesZoneName(format);
  const [todayName, setTodayName] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (readsClock) {
      const name = zoneNameAt(format, todayInstant());
      // oxlint-disable-next-line react/set-state-in-effect -- the clock is the external system: reading it in render would split the server's and the browser's text, so the render after mount is the point
      setTodayName(name === zoneNameAt(format, EMPTY_ZONE_INSTANT) ? null : name);
    }
  }, [readsClock, format]);
  return useMemo(() => {
    if (!writesZoneName(format)) {
      return "";
    }
    return instant === null
      ? (todayName ?? zoneNameAt(format, EMPTY_ZONE_INSTANT))
      : zoneNameAt(format, instant);
  }, [format, instant, todayName]);
}
