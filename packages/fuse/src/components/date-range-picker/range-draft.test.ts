/**
 * Unit under test: clearing an end's popup time in the range picker's draft, the one transition no
 * browser test drives (the browser tests cover typing, picking and committing through
 * `DateRangePickerField`). Oracle: React Aria's `useDateRangePickerState`, worked out by hand: a
 * value keeps its own time, a picked day without its time falls back to midnight, and a time typed
 * with no day is forgotten.
 */
import { describe, expect, it } from "vitest";

import "../../temporal-polyfill";
import type { ValueKind } from "../../temporal/temporal-value";
import { clearTime, draftOfRange, editTime, pickRange, shownEnds } from "./range-draft";
import type { RangeDraft } from "./range-draft";

const LOCAL: ValueKind = { kind: "PlainDateTime" };
const EMPTY = draftOfRange({ start: null, end: null });
const at = (iso: string) => Temporal.PlainDateTime.from(iso);

function printed(draft: RangeDraft | undefined): string {
  if (draft === undefined) {
    return "refused";
  }
  const ends = shownEnds(draft, LOCAL);
  return `${ends.start?.toString() ?? ""}..${ends.end?.toString() ?? ""}`;
}

describe("clearing an end's popup time", () => {
  it("refuses for a value, which keeps its own time", () => {
    const range = draftOfRange({ start: at("2026-10-12T08:00"), end: at("2026-10-16T17:30") });
    expect(printed(clearTime(range, "end"))).toBe("refused");
  });

  it("forgets a time typed with no day, leaving the end empty", () => {
    const timed = editTime(EMPTY, "end", at("2030-06-15T17:00"), LOCAL);
    expect(clearTime(timed, "end")).toEqual(EMPTY);
  });

  it("takes a picked day back to midnight", () => {
    const picked = pickRange(
      EMPTY,
      { start: Temporal.PlainDate.from("2026-10-12"), end: Temporal.PlainDate.from("2026-10-16") },
      LOCAL
    );
    const timed = editTime(picked, "end", at("2030-06-15T17:00"), LOCAL);
    expect(printed(timed)).toBe("2026-10-12T00:00:00..2026-10-16T17:00:00");
    expect(printed(clearTime(timed, "end"))).toBe("2026-10-12T00:00:00..2026-10-16T00:00:00");
  });
});
