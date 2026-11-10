// The values Fuse's date components hold, and how they enter: a PlainDate, PlainDateTime or
// ZonedDateTime from any Temporal implementation. Every value is re-branded through
// `X.from(String(x))`, never `instanceof`: a value from another implementation (a second copy of
// the polyfill, native Temporal beside a polyfill) fails `instanceof` and may lack this runtime's
// internal slots, while its ISO string is the one form every implementation reads. The same parser
// reads ISO text the user pastes into a field.

import { err, ok } from "./result";
import type { Result } from "./result";
import { temporal } from "./temporal";

/** A value the date components hold. */
export type TemporalValue = Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;

/** The smallest unit a date component edits: a day, or a time down to the hour, minute or second. */
export type DateGranularity = "day" | "hour" | "minute" | "second";

/**
 * The kind a component's values take, with the zone a ZonedDateTime value lives in. A kind a
 * value or default value named outlives a cleared value, so typing into an emptied field emits
 * the same kind.
 */
export type ValueKind =
  | { readonly kind: "PlainDate" }
  | { readonly kind: "PlainDateTime" }
  | { readonly kind: "ZonedDateTime"; readonly timeZone: string };

/** An input no Temporal kind reads. */
export class TemporalInputError extends Error {
  override readonly name = "TemporalInputError";
  readonly _tag = "TemporalInputError" as const;

  /**
   * @param input - The ISO text that failed, as the input printed it.
   * @param cause - Temporal's own error, when a kind was detected but its parser refused the text.
   */
  constructor(
    readonly input: string,
    cause?: RangeError
  ) {
    super(
      `"${input}" is not a date, a date and time, or a date and time with a bracketed time zone such as 2026-03-15T09:30+01:00[Europe/Oslo], in the ISO 8601 or Gregorian calendar.`,
      { cause }
    );
  }
}

/** A time granularity asked of a value that holds only a date. */
export class GranularityConflictError extends Error {
  override readonly name = "GranularityConflictError";
  readonly _tag = "GranularityConflictError" as const;

  /** @param granularity - The time granularity asked for. */
  constructor(readonly granularity: Exclude<DateGranularity, "day">) {
    super(
      `granularity "${granularity}" needs a value with a time, but the value is a PlainDate. Pass a PlainDateTime or ZonedDateTime, or leave granularity at "day".`
    );
  }
}

// An ISO 8601 date, extended or basic, with an optional six-digit signed year, then what follows.
const ISO_DATE = /^(?:[+-]\d{6}|\d{4})-?\d{2}-?\d{2}(.*)$/su;
// RFC 9557 time zone annotation: brackets, optionally critical, whose content is no `key=value`.
// The content excludes `[` as well as `]`, so a run of unclosed brackets is scanned once, not
// once per bracket.
const ZONE_ANNOTATION = /\[!?[^=[\]]+\]/u;
// RFC 9557 calendar annotations, each with its calendar id, excluding `[` for the same reason.
const CALENDAR_ANNOTATION = /\[!?u-ca=([^[\]]*)\]/gu;
// The calendars read: their dates are ISO 8601 dates. Temporal reads calendar ids case-insensitively.
const READ_CALENDARS: ReadonlySet<string> = new Set(["iso8601", "gregory"]);
// A time followed by a UTC offset or `Z`: the digits and separators of the time, then the sign.
const TIME_WITH_OFFSET = /^[Tt ][\d:.,]+[Zz+-]/u;

/** The kind an ISO string prints, by its form alone; the kind's parser still checks the fields. */
function isoKind(text: string): ValueKind["kind"] | undefined {
  const rest = ISO_DATE.exec(text)?.[1];
  if (rest === undefined) {
    return undefined;
  }
  // Only the ISO calendar is read. Native Temporal reads every CLDR calendar and the polyfill the
  // subpath installs reads few, so another calendar would be a value on a server and an error in
  // a polyfilled browser, and its fields would not be the ISO fields the components edit.
  for (const [, calendar = ""] of rest.matchAll(CALENDAR_ANNOTATION)) {
    if (!READ_CALENDARS.has(calendar.toLowerCase())) {
      return undefined;
    }
  }
  if (ZONE_ANNOTATION.test(rest)) {
    return "ZonedDateTime";
  }
  // An offset without a bracketed zone names an instant. Temporal's plain parsers accept it and
  // drop the offset, which would move the moment the text meant, so no kind reads it.
  if (TIME_WITH_OFFSET.test(rest)) {
    return undefined;
  }
  return /^[Tt ]/u.test(rest) ? "PlainDateTime" : "PlainDate";
}

/**
 * A ZonedDateTime at the instant its text names. The default offset check matches an offset
 * printed to the minute against the zone's own, so a zone whose offset has seconds, such as
 * Africa/Monrovia's -00:44:30 until 1972, round-trips exactly. Only when the offset disagrees
 * with the zone's rules is the offset itself taken.
 */
function zonedFrom(runtime: typeof Temporal, text: string): Temporal.ZonedDateTime {
  try {
    return runtime.ZonedDateTime.from(text);
  } catch (error) {
    if (error instanceof RangeError) {
      return runtime.ZonedDateTime.from(text, { offset: "use" });
    }
    throw error;
  }
}

/**
 * A value of this runtime's Temporal, from ISO text, of the kind the text prints. A Temporal value
 * from any implementation is read through `String(value)`. A bracketed time zone makes a
 * ZonedDateTime, a time a PlainDateTime, a date alone a PlainDate. A ZonedDateTime keeps the
 * exact instant its offset names, so a value whose zone rules changed between implementations
 * still means the same moment. Every value is in the ISO 8601 calendar.
 *
 * @param text - ISO text, or the text a Temporal value prints.
 * @returns The value, or `TemporalInputError` when no kind reads it. A string with a UTC offset
 *   or `Z` but no bracketed zone, such as `Date#toISOString` output or `2026-03-15T09:30+01:00`,
 *   names an instant, not one of the kinds, and is refused rather than read without its offset.
 *   A `[u-ca=…]` annotation other than `iso8601` or `gregory` is refused in every engine, and a
 *   `gregory` value is returned in `iso8601`, whose dates are the same.
 */
export function parseTemporal(text: string): Result<TemporalValue, TemporalInputError> {
  const kind = isoKind(text);
  if (kind === undefined) {
    return err(new TemporalInputError(text));
  }
  const runtime = temporal();
  try {
    switch (kind) {
      case "PlainDate":
        return ok(runtime.PlainDate.from(text).withCalendar("iso8601"));
      case "PlainDateTime":
        return ok(runtime.PlainDateTime.from(text).withCalendar("iso8601"));
      case "ZonedDateTime":
        return ok(zonedFrom(runtime, text).withCalendar("iso8601"));
    }
  } catch (error) {
    // Temporal's parsers throw RangeError for text of the right form whose fields are out of
    // range, such as 2026-02-30 or an unknown zone.
    if (error instanceof RangeError) {
      return err(new TemporalInputError(text, error));
    }
    throw error;
  }
}

/**
 * Whether a value is a ZonedDateTime, by its shape rather than `instanceof`.
 *
 * @param value - The value.
 * @returns `true` for a ZonedDateTime.
 */
export function isZoned(value: TemporalValue): value is Temporal.ZonedDateTime {
  return "timeZoneId" in value;
}

/**
 * Whether a value holds a time, by its shape rather than `instanceof`. A ZonedDateTime holds one
 * too, so test `isZoned` first where the two differ.
 *
 * @param value - The value.
 * @returns `true` for a PlainDateTime or a ZonedDateTime.
 */
export function hasTime(value: TemporalValue): value is Temporal.PlainDateTime | Temporal.ZonedDateTime {
  return "hour" in value;
}

/**
 * The kind a value has, with its zone when it is a ZonedDateTime, by its shape: a zone first,
 * since a ZonedDateTime holds a time too.
 *
 * @param value - The value.
 * @returns Its kind.
 */
export function valueKind(value: TemporalValue): ValueKind {
  if (isZoned(value)) {
    return { kind: "ZonedDateTime", timeZone: value.timeZoneId };
  }
  return hasTime(value) ? { kind: "PlainDateTime" } : { kind: "PlainDate" };
}

/** The kind a value has; none for an empty value. */
function kindOf(value: TemporalValue | null | undefined): ValueKind | undefined {
  return value == null ? undefined : valueKind(value);
}

/**
 * Whether two kinds are the same kind in the same zone.
 *
 * @param left - One kind.
 * @param right - The other kind.
 * @returns `true` when both are the same kind and, for a ZonedDateTime, the same zone.
 */
export function sameKind(left: ValueKind, right: ValueKind): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== "ZonedDateTime" || (right.kind === "ZonedDateTime" && left.timeZone === right.timeZone))
  );
}

/** A kind with where it came from: `named` when a value or default value named it. */
export type ResolvedKind = {
  /** The kind the component's values take. */
  readonly kind: ValueKind;
  /**
   * `true` when a value, a default value or a named previous kind gave the kind, which then sticks
   * through a cleared value; `false` when the granularity and zone made it, so it follows them.
   */
  readonly named: boolean;
};

/** Whether a kind holds only a date while a time granularity is asked for. */
function conflicts(kind: ValueKind, granularity: DateGranularity): boolean {
  return kind.kind === "PlainDate" && granularity !== "day";
}

/**
 * The kind the granularity and zone make when no value names one. `MadeValue` is the same rule in
 * the types; temporal-value.test.ts holds both to one table.
 */
function madeKind(granularity: DateGranularity, timeZone: string | undefined): ValueKind {
  if (granularity === "day") {
    return { kind: "PlainDate" };
  }
  return timeZone === undefined ? { kind: "PlainDateTime" } : { kind: "ZonedDateTime", timeZone };
}

/**
 * The value type `madeKind` makes from a granularity and zone: `"day"` or no granularity makes a
 * PlainDate whatever the zone; a time unit makes a ZonedDateTime with a zone and a PlainDateTime
 * without. A granularity or zone that is a union, such as an optional `timeZone`, makes the union
 * of what each member makes.
 *
 * @template G - The `granularity` prop's type, `undefined` when it is not given.
 * @template Z - The `timeZone` prop's type, `undefined` when it is not given.
 */
export type MadeValue<G, Z> = G extends "day" | undefined
  ? Temporal.PlainDate
  : Z extends string
    ? Temporal.ZonedDateTime
    : Temporal.PlainDateTime;

/** A prop's type in a props object: `undefined` when the object has no such key. */
type PropType<P, K extends string> = K extends keyof P ? P[K] : undefined;

/**
 * The value type a date component's props make when no value or default value names one:
 * `MadeValue` of the `granularity` and `timeZone` they hold. A component's value type defaults
 * to it, so a call site never names the kind.
 *
 * @template P - The props, as `KindProps` infers them.
 */
export type PropsMadeValue<P> = MadeValue<PropType<P, "granularity">, PropType<P, "timeZone">>;

/**
 * A props object mapped onto itself. TypeScript infers `P` from props through a mapped type like
 * this one even when they hold an unannotated callback, which keeps it from inferring a type
 * parameter from the whole object, and the inference keeps a prop's own type: an optional
 * `timeZone` stays `string | undefined`, where inferring from the prop alone drops the
 * `undefined`. `granularity` and `timeZone` keep their types; the component's other declared props,
 * React's `key` and hyphenated attributes add nothing; any other key is `never`, so a misspelt or
 * undeclared prop is an error, as it is on a component that is not generic. The same rule makes
 * the old form that named the kind as a type argument fail: `<DateField<Temporal.PlainDate>>`
 * binds `P` to PlainDate, whose members the props then need, each as `never`.
 *
 * @template P - The props.
 * @template Declared - The component's props type, whose keys are the props it takes.
 */
export type KindProps<P, Declared> = {
  [K in keyof P]: K extends "granularity" | "timeZone"
    ? P[K]
    : K extends keyof Declared | "key" | `${string}-${string}`
      ? unknown
      : never;
};

/** What a component's value kind resolves from, each already parsed. */
export type ValueKindSources = {
  /** The current value, controlled or held: `null` when empty. */
  readonly value: TemporalValue | null;
  /**
   * The kind resolved before, with where it came from. A named kind sticks through a cleared
   * value; one the granularity and zone made does not. `undefined` on the first resolution.
   */
  readonly previous: ResolvedKind | undefined;
  /** The initial value, which names the kind while the value starts empty. */
  readonly defaultValue: TemporalValue | null | undefined;
  /** The smallest unit edited. A time granularity with no value to read makes a value with a time. */
  readonly granularity: DateGranularity | undefined;
  /** The zone a ZonedDateTime value takes when no value names one. */
  readonly timeZone: string | undefined;
};

/**
 * The kind a component's values take. The first source that names one wins:
 *
 * 1. the value, when it is not empty;
 * 2. the kind resolved before, when it is named, so clearing keeps the kind and zone. A named
 *    PlainDate is skipped when a time granularity is now asked for, since no value holds it;
 * 3. the default value;
 * 4. the granularity: `"day"` or none makes a PlainDate; `"hour"`, `"minute"` or `"second"`
 *    makes a ZonedDateTime in `timeZone` when one is given, and a PlainDateTime otherwise. A
 *    kind made this way is not named, so it follows later changes to `granularity` and `timeZone`.
 *
 * A value's own zone wins over `timeZone`. The result is a new object each call; a caller that
 * stores it compares `named` and `sameKind` rather than identity.
 *
 * @param sources - The parsed sources.
 * @returns The kind with its provenance, or `GranularityConflictError` when a time granularity
 *   meets a PlainDate value or default value.
 */
export function resolveValueKind(sources: ValueKindSources): Result<ResolvedKind, GranularityConflictError> {
  const { value, previous, defaultValue, timeZone } = sources;
  const granularity = sources.granularity ?? "day";
  const sticky =
    previous?.named === true && !conflicts(previous.kind, granularity) ? previous.kind : undefined;
  const namedKind = kindOf(value) ?? sticky ?? kindOf(defaultValue);
  if (namedKind === undefined) {
    return ok({ kind: madeKind(granularity, timeZone), named: false });
  }
  if (granularity !== "day" && conflicts(namedKind, granularity)) {
    return err(new GranularityConflictError(granularity));
  }
  return ok({ kind: namedKind, named: true });
}
