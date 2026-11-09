import { temporal } from "./temporal";

/**
 * Today's date in a time zone, from `Date.now()`.
 *
 * Read it in an effect, never while rendering: a server and a browser disagree about the clock,
 * and a render that reads it cannot be prerendered. It reads `Date.now()` rather than
 * `Temporal.Now`, so a test that fakes `Date` fakes today too; native `Temporal.Now` ignores a
 * faked `Date`.
 *
 * @param timeZone - An IANA time zone, such as `"Europe/Oslo"`, or a fixed offset.
 * @returns The calendar date at this instant in that zone.
 */
export function today(timeZone: string): Temporal.PlainDate {
  return temporal().Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(timeZone).toPlainDate();
}
