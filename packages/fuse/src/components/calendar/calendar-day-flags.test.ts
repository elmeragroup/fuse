/**
 * Unit under test: the day-flag encoding the selection owner hands the shared parts, and the
 * state mapping that writes it back as attributes. Oracle: the flag order, render-state names and
 * `data-<flag>` attributes written out by hand in `calendar-context.ts`'s `CalendarDayFlag` and
 * `CalendarDayFlagState` JSDoc.
 */
import { describe, expect, it } from "vitest";

import { DAY_FLAG_STATE_ATTRIBUTES, dayFlags, dayFlagState, NO_DAY_FLAGS } from "./calendar-context";

describe("day flags", () => {
  it("writes the flags in one order whatever order they come in, once each", () => {
    expect(dayFlags(["invalid", "in-range", "selected", "selection-end", "selected"])).toBe(
      "selected selection-end in-range invalid"
    );
    expect(
      dayFlags(["highlighted", "invalid", "selection-end", "in-range", "selection-start", "selected"])
    ).toBe("selected selection-start selection-end in-range highlighted invalid");
    expect(NO_DAY_FLAGS).toBe("");
  });

  it("reads each of the six flags as its own boolean, named in camel case", () => {
    const fields = [
      ["selected", "selected"],
      ["selection-start", "selectionStart"],
      ["selection-end", "selectionEnd"],
      ["in-range", "inRange"],
      ["highlighted", "highlighted"],
      ["invalid", "invalid"],
    ] as const;
    const none = {
      selected: false,
      selectionStart: false,
      selectionEnd: false,
      inRange: false,
      highlighted: false,
      invalid: false,
    };
    for (const [flag, field] of fields) {
      expect(dayFlagState(dayFlags([flag])), flag).toEqual({ ...none, [field]: true });
    }
    expect(dayFlagState(NO_DAY_FLAGS)).toEqual(none);
    expect(
      dayFlagState(
        dayFlags(["selected", "selection-start", "selection-end", "in-range", "highlighted", "invalid"])
      )
    ).toEqual({
      selected: true,
      selectionStart: true,
      selectionEnd: true,
      inRange: true,
      highlighted: true,
      invalid: true,
    });
  });

  it("writes each flag that holds as a bare data-<flag> attribute and leaves the rest off", () => {
    expect(
      Object.fromEntries(
        Object.entries(DAY_FLAG_STATE_ATTRIBUTES).map(([field, write]) => [
          field,
          [write(true), write(false)],
        ])
      )
    ).toEqual({
      selected: [{ "data-selected": "" }, null],
      selectionStart: [{ "data-selection-start": "" }, null],
      selectionEnd: [{ "data-selection-end": "" }, null],
      inRange: [{ "data-in-range": "" }, null],
      highlighted: [{ "data-highlighted": "" }, null],
      invalid: [{ "data-invalid": "" }, null],
    });
  });
});
