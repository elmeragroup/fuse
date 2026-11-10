import { Temporal as Polyfill } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

/**
 * Unit under test: `printedProp` then `parseTemporalProp`, the seam every date component's date
 * props pass through, in the order `useTemporalProp` runs them. Oracle: the date-prop contract
 * written out by hand: a Temporal object of any kind and any implementation is read as this
 * runtime's value of the same kind and text, and text throws a TypeError that names the Root, the
 * prop and the fix. The second implementation is `temporal-polyfill/implementation`, which never
 * hands back the unit runtime's native Temporal.
 */
import "../../temporal-polyfill";
import type { TemporalValue } from "../../temporal/temporal-value";
import { parseTemporalProp, printedProp } from "./calendar-input";

/** A present date prop read as `useTemporalProp` reads it, without the memo. */
function readProp(input: TemporalValue, owner: string, prop: string): TemporalValue {
  return parseTemporalProp(printedProp(input, owner, prop) ?? "", owner, prop);
}

describe("the date-prop seam", () => {
  it.each([
    ["PlainDate", Temporal.PlainDate.from("2026-10-05"), "2026-10-05"],
    ["PlainDateTime", Temporal.PlainDateTime.from("2026-10-05T09:30"), "2026-10-05T09:30:00"],
    [
      "ZonedDateTime",
      Temporal.ZonedDateTime.from("2026-10-05T09:30+02:00[Europe/Oslo]"),
      "2026-10-05T09:30:00+02:00[Europe/Oslo]",
    ],
  ])("reads a %s", (kind, input, text) => {
    const value = readProp(input, "DateInput.Root", "value");
    expect(Object.prototype.toString.call(value)).toBe(`[object Temporal.${kind}]`);
    expect(value.toString()).toBe(text);
  });

  it("reads another implementation's object as this runtime's", () => {
    const foreign = Polyfill.ZonedDateTime.from("2026-10-05T09:30+02:00[Europe/Oslo]");
    expect(foreign instanceof Temporal.ZonedDateTime).toBe(false);
    const value = readProp(foreign, "DateInput.Root", "value");
    expect(value instanceof Temporal.ZonedDateTime).toBe(true);
    expect(value.toString()).toBe("2026-10-05T09:30:00+02:00[Europe/Oslo]");
  });

  it("refuses a Temporal object no kind reads with a TypeError naming the Root, the prop and its text", () => {
    const hebrew = Temporal.PlainDate.from("2026-03-15").withCalendar("hebrew");
    const call = () => readProp(hebrew, "DateInput.Root", "value");
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^DateInput\.Root value: "2026-03-15\[u-ca=hebrew\]" is not a date/u);
  });

  it("refuses ISO text with a TypeError naming the Root, the prop and the fix", () => {
    const call = () =>
      // @ts-expect-error -- text reaches the seam past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
      printedProp("2026-10-05T09:30", "DatePicker.Root", "defaultValue");
    expect(call).toThrow(TypeError);
    expect(call).toThrow(
      'DatePicker.Root defaultValue: received the string "2026-10-05T09:30", but date props take a Temporal object, such as Temporal.PlainDateTime.from("2026-10-05T09:30"). A Temporal value passed from a server component arrives as its ISO text, so build the value in a client component.'
    );
  });

  it("refuses text no kind reads without suggesting a kind", () => {
    const call = () =>
      // @ts-expect-error -- as above, text that reaches the seam past the types
      printedProp("next Tuesday", "Calendar.Root", "minValue");
    expect(call).toThrow(
      'Calendar.Root minValue: received the string "next Tuesday", but date props take a Temporal object: a Temporal.PlainDate, PlainDateTime or ZonedDateTime. A Temporal value passed from a server component arrives as its ISO text, so build the value in a client component.'
    );
  });
});
