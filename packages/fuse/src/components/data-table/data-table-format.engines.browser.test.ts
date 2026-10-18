/**
 * This file runs the DataTable date judges in Chromium, Firefox and WebKit. The engines write
 * different spaces for the same date, such as U+202F, U+0020 or U+00A0 before the en-US day period,
 * and the cells must map them to one space for a server in Node and a browser in any engine to
 * render the same text.
 */
import { describe, expect, it } from "vitest";

import { formatDateCell } from "./data-table-format";

const PLACED = new Date(Date.UTC(2026, 8, 30, 14, 5));

describe("DataTable date cells in this engine", () => {
  // CLDR 48: en `M/d/yy` and `h:mm a` joined by `{1}, {0}`, nb `d. MMM y` and `HH:mm` joined by
  // `{1}, {0}`, sv `d MMM y` and `HH:mm` joined by a space, fi `d.M.y` and `H.mm` joined by
  // `{1} 'klo' {0}`. Every space is U+00A0.
  it.each([
    ["en-US", "short", "9/30/26,\u00a02:05\u00a0PM"],
    ["nb-NO", "medium", "30.\u00a0sep.\u00a02026,\u00a014:05"],
    ["sv-SE", "medium", "30\u00a0sep.\u00a02026\u00a014:05"],
    ["fi-FI", "medium", "30.9.2026\u00a0klo\u00a014.05"],
  ] as const)("writes %s %s dates with short times as the server does", (locale, dateStyle, expected) => {
    expect(formatDateCell(locale, PLACED, { dateStyle, timeStyle: "short", timeZone: "UTC" })).toBe(expected);
  });
});
