/**
 * Unit under test: the number and date range summaries a DataTableFilter chip shows, in Chromium
 * and WebKit. Oracles, written by hand: a date range is each end's CLDR medium date in full,
 * joined by CLDR's date interval fallback, ` – ` in en-US with no-break spaces and `–` in nb-NO,
 * sv-SE and fi-FI, and a range from a day to the same day is that day's date. A number range
 * follows CLDR's number range pattern, a bare en dash between unsigned numbers and a spaced one
 * after a sign, with every space written as U+00A0.
 */
import { describe, expect, it } from "vitest";

import { summarize } from "./filter-summary";

const strings = {
  moreValues: (count: string) => `+${count}`,
  quoted: (text: string) => `"${text}"`,
  yes: "Yes",
  no: "No",
};

const amount = { kind: "number", label: "Amount", format: { maximumFractionDigits: 0 } } as const;
const created = { kind: "date", label: "Created" } as const;

describe.each([
  {
    locale: "en-US",
    sameDay: "Oct 2, 2026",
    numbers: "1,200–4,500",
    days: "Oct 2, 2026\u00a0–\u00a0Oct 12, 2026",
    years: "Dec 30, 2026\u00a0–\u00a0Jan 2, 2027",
  },
  {
    locale: "nb-NO",
    sameDay: "2. okt. 2026",
    numbers: "1\u00a0200–4\u00a0500",
    days: "2. okt. 2026–12. okt. 2026",
    years: "30. des. 2026–2. jan. 2027",
  },
  {
    locale: "sv-SE",
    sameDay: "2 okt. 2026",
    numbers: "1\u00a0200–4\u00a0500",
    days: "2 okt. 2026–12 okt. 2026",
    years: "30 dec. 2026–2 jan. 2027",
  },
  {
    locale: "fi-FI",
    sameDay: "2.10.2026",
    numbers: "1\u00a0200–4\u00a0500",
    days: "2.10.2026–12.10.2026",
    years: "30.12.2026–2.1.2027",
  },
] as const)("a range summary in $locale", ({ locale, numbers, sameDay, days, years }) => {
  it("joins a number range with a bare en dash", () => {
    expect(
      summarize({ kind: "number", operator: "isBetween", values: [1200, 4500] }, amount, locale, strings).text
    ).toBe(numbers);
  });

  it("writes both ends of a date range in full and joins them with the locale's separator", () => {
    const between = (from: string, to: string) =>
      summarize({ kind: "date", operator: "isBetween", values: [from, to] }, created, locale, strings).text;
    expect(between("2026-10-02", "2026-10-12")).toBe(days);
    expect(between("2026-12-30", "2027-01-02")).toBe(years);
  });

  it("writes a range from a day to the same day as that one date", () => {
    expect(
      summarize(
        { kind: "date", operator: "isBetween", values: ["2026-10-02", "2026-10-02"] },
        created,
        locale,
        strings
      ).text
    ).toBe(sameDay);
  });
});

describe("an nb-NO unit range summary", () => {
  it("writes the spaces around a signed range and before its unit as no-break spaces", () => {
    const temperature = {
      kind: "number",
      label: "Temperatur",
      format: { style: "unit", unit: "celsius", maximumFractionDigits: 0 },
    } as const;
    expect(
      summarize({ kind: "number", operator: "isBetween", values: [-5, 3] }, temperature, "nb-NO", strings)
        .text
    ).toBe("\u22125\u00a0–\u00a03\u00a0°C");
  });
});
