// Unit under test: slotLabel's date lead on a domain of more than one date, with the date joiner of
// format/words.ts in each locale. Oracle: DATED_SLOT_CASES in fixtures/time-literals.ts, written by
// hand from CLDR 48's dates, the hour-range literals and the drafted joiner. It sits under format/
// so the mutation run's format suite reaches the joiner.
import { describe, expect, it } from "vitest";

import { slotLabel } from "../chart-text";
import { buildCartesianModel } from "../layout/cartesian-model";
import { DATED_SLOT_CASES } from "./fixtures/time-literals";

describe("slotLabel on a domain of more than one date", () => {
  it.each(DATED_SLOT_CASES.map((dated) => [dated.name, dated] as const))("labels %s", (_, dated) => {
    const first = Date.parse(dated.first);
    const last = Date.parse(dated.last);
    const step = dated.interval === "day" ? 86_400_000 : 3_600_000;
    const rows = Array.from({ length: Math.round((last - first) / step) + 1 }, (__, index) => ({
      start: new Date(first + index * step),
      v: 1,
    }));
    const model = buildCartesianModel({
      rows,
      series: [["v", {}]],
      xKey: "start",
      time: { interval: dated.interval, timeZone: "Europe/Oslo" },
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const label = slotLabel(
      { locale: dated.locale, model, config: {}, xFormat: undefined, now: undefined },
      dated.slot
    );
    expect(label).toEqual({ text: dated.text, spoken: dated.spoken });
  });
});
