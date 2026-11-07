import { describe, expect, it } from "vitest";

import dejavu from "./fixtures/dejavu-sans-advances-12px.json" with { type: "json" };
import inter from "./fixtures/inter-advances-12px.json" with { type: "json" };
import liberation from "./fixtures/liberation-sans-advances-12px.json" with { type: "json" };
import roboto from "./fixtures/roboto-advances-12px.json" with { type: "json" };
import { labelBound } from "./label-bound";

/** Each face's advances at 12 px, by character: its default glyphs' and its tabular figures'. */
const TABLES: readonly Readonly<Record<string, number>>[] = [
  roboto.advances,
  inter.advances,
  inter.tabular,
  dejavu.advances,
  dejavu.tabular,
  liberation.advances,
  liberation.tabular,
];

/** Every advance a face gives a character at 12 px. */
function advancesOf(character: string): number[] {
  return TABLES.flatMap((table) => {
    const width = table[character];
    return width === undefined ? [] : [width];
  });
}

describe("the label width bound", () => {
  // Unit under test: label-bound.ts's table. Oracle: the advances the fixtures hold, read from
  // each face's hmtx table, its default glyph and its `tnum` substitute: Roboto, whose tabular
  // figures are its default ones, Inter, DejaVu Sans and Liberation Sans.
  it("bounds every face's default and tabular advance, rounded up to a whole pixel", () => {
    for (const character of Object.keys(roboto.advances)) {
      const widest = Math.max(...advancesOf(character));
      expect([character, labelBound(character)]).toEqual([character, Math.ceil(widest)]);
    }
  });

  it("counts a character outside the table as the widest digit's bound", () => {
    const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].flatMap((digit) => advancesOf(digit));
    expect(labelBound("€")).toBe(Math.ceil(Math.max(...digits)));
  });

  it("holds the docs' ring value as Chromium draws it in Inter on macOS and on Linux", () => {
    // Oracle: the rendered widths of "1,500 kWh" in Inter at 12 px with tabular figures, measured
    // in Chromium 1.63's builds: 63.078 px on macOS and 64 px on Linux, which snaps each advance to
    // a whole pixel. Roboto's own table gives 55.65 px.
    expect(labelBound("1,500\u00a0kWh")).toBeGreaterThanOrEqual(64);
  });
});
