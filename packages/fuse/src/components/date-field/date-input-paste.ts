// Pasted text read into a date input's value, formed as typing forms it. An input that shows its
// date takes ISO text of a kind it can hold, or text in the field's own format; a time-only input
// takes a wall-clock time. These only read: the session's `paste` transition
// (`date-input-session.ts`) commits what they return.

import { hasTime, isZoned, parseTemporal, parseWallTime } from "../../temporal/temporal-value";
import type { TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { boundDay } from "../calendar/calendar-dates";
import {
  draftOf,
  draftToValue,
  roundTrips,
  segmentLimits,
  setSegment,
  wallClockInstants,
} from "./date-draft";
import type { DateDraft } from "./date-draft";
import type { FieldText } from "./date-field-text";
import type { SessionSettings } from "./date-input-session";

/** A value in a kind: a date-time's date for a PlainDate input, a zone's wall clock, a wall clock in a zone. */
function convertToKind(value: TemporalValue, kind: ValueKind): TemporalValue | undefined {
  switch (kind.kind) {
    case "PlainDate":
      return boundDay(value);
    case "PlainDateTime":
      if (isZoned(value)) return value.toPlainDateTime();
      return hasTime(value) ? value : undefined;
    case "ZonedDateTime":
      if (isZoned(value)) return value.withTimeZone(kind.timeZone);
      return hasTime(value)
        ? value.toZonedDateTime(kind.timeZone, { disambiguation: "compatible" })
        : undefined;
  }
}

/**
 * The instant of a zoned wall time that the text's zone name names: the earlier or the later one of
 * a wall time the zone repeats, the one instant of any other; `undefined` when the name is neither.
 * Each candidate's name is the one the input writes for it (`settings.zoneInstant`), so a time on
 * the stand-in day carries today's name, as its segments show it.
 */
function namedInstant(
  value: Temporal.ZonedDateTime,
  read: FieldText,
  settings: SessionSettings
): Temporal.ZonedDateTime | undefined {
  return wallClockInstants(value.toPlainDateTime(), value.timeZoneId).find((candidate) =>
    read.namesZoneAt(settings.zoneInstant(candidate))
  );
}

/** What a pasted draft forms over, and the text it was read from, when it was. */
type PastedDraft = {
  /** Every shown unit pasted, the hidden ones the base's. */
  readonly draft: DateDraft;
  /** The committed value, or the placeholder: the draft's hidden units, kind and zone. */
  readonly base: TemporalValue;
  readonly settings: SessionSettings;
  /** The text the draft was read from, whose zone name picks a repeated wall time's instant. */
  readonly read?: FieldText;
};

/**
 * The value a pasted draft forms, as typing forms it: a value that holds exactly what was pasted,
 * so `02/30/2026`, or 02:30 on a night the clocks skip it, is no value. Text that wrote a zone name
 * picks the instant it names of a repeated wall time; otherwise the wall time resolves as typed.
 */
function formedValue({ draft, base, settings, read }: PastedDraft): TemporalValue | undefined {
  const formed = draftToValue(draft, base, settings.hourCycle);
  const value = read !== undefined && isZoned(formed) ? namedInstant(formed, read, settings) : formed;
  return value !== undefined && roundTrips(draft, value, settings.fields, settings.hourCycle)
    ? value
    : undefined;
}

/**
 * Text in the field's own format, read by the field's format (`readFieldText`), as the value of the
 * units it names: over the committed value (or the placeholder), every number inside its unit's
 * limits and every shown unit named, since one the text left out would silently keep the base's.
 */
function formattedValue(text: string, settings: SessionSettings): TemporalValue | undefined {
  const read = settings.readText(text);
  if (read === undefined) {
    return undefined;
  }
  const base = settings.committed ?? settings.placeholder();
  // The units the field does not show, such as a day field's hour, keep the base's, as typing the
  // shown ones keeps them; the paste sets every shown unit.
  let draft = draftOf(base, settings.hourCycle);
  for (const { type, value } of read.entries) {
    const { min, max } = segmentLimits(type, settings.hourCycle);
    if (type !== "dayPeriod" && !(value >= min && value <= max)) {
      return undefined;
    }
    draft = setSegment(draft, type, value, base, settings.hourCycle);
  }
  if (!settings.fields.every((field) => read.entries.some((entry) => entry.type === field))) {
    return undefined;
  }
  return formedValue({ draft, base, settings, read });
}

/**
 * A wall-clock time pasted into a time-only input. The input edits the time of its own day, the
 * committed value's or the placeholder's, so the time names that day's instant; it resolves as
 * typed: on a repeated hour, the earlier instant; in a skipped one, nothing, as typing leaves such
 * a time a draft. The shown units take the time as `draftOf` splits it into the hour cycle; the
 * hidden ones keep the base's, and no offset is held.
 */
function wallTimeValue(time: Temporal.PlainTime, settings: SessionSettings): TemporalValue | undefined {
  const base = settings.committed ?? settings.placeholder();
  const pasted = draftOf(boundDay(base).toPlainDateTime(time), settings.hourCycle);
  const draft = settings.fields.reduce<DateDraft>((shown, type) => ({ ...shown, [type]: pasted[type] }), {
    ...draftOf(base, settings.hourCycle),
    offsetNanoseconds: null,
  });
  return formedValue({ draft, base, settings });
}

/**
 * Pasted text in an input that shows its date: ISO text of a kind the input can hold, converted to
 * its kind, else text in the field's own format. sv-SE writes a day as `2026-10-12`, which reads as
 * a PlainDate a date-time input cannot take but its format can.
 *
 * @param text - The trimmed clipboard text.
 * @param settings - The input's settings.
 * @returns The value, or `undefined` when the text names none the input can hold.
 */
export function pastedValue(text: string, settings: SessionSettings): TemporalValue | undefined {
  const parsed = parseTemporal(text);
  return (
    (parsed._tag === "ok" ? convertToKind(parsed.value, settings.kind) : undefined) ??
    formattedValue(text, settings)
  );
}

/**
 * Pasted text in a time-only input: ISO text that names a wall-clock time takes that time alone,
 * its date, offset and zone dropped (see `parseWallTime`). ISO text of a date alone names no time
 * and reads as nothing, rather than its digits as one. A UTC time (`Z`) names an instant, not a
 * wall time: it is read as any other text, in the field's own format, which it never matches.
 *
 * @param text - The trimmed clipboard text.
 * @param settings - The input's settings.
 * @returns The value on the input's day, or `undefined` when the text names no time it can hold.
 */
export function pastedTime(text: string, settings: SessionSettings): TemporalValue | undefined {
  const time = parseWallTime(text);
  if (time._tag === "ok") {
    return wallTimeValue(time.value, settings);
  }
  return parseTemporal(text)._tag === "ok" ? undefined : formattedValue(text, settings);
}
