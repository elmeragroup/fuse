/**
 * Unit under test: the description RangeCalendar names its range's ends with, in every engine.
 * Oracle: React Aria's RangeCalendar names for the same ranges, read from its range-start
 * day button in Chromium per locale and written out by hand. en-US is that text exactly (the parity
 * harness pins it). In nb-NO, sv-SE and fi-FI React Aria's own text comes from
 * `formatRangeToParts`, which differs between engines (a shared month dropped, sv-SE days
 * zero-padded in Chromium), so there the oracle is React Aria's sentence with each end's date as
 * that locale's CLDR long date without the year the end repeats (D-3-19); Chromium and
 * WebKit must each reproduce it.
 */
import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import "../../temporal-polyfill";
import { rangeCalendarStrings } from "./intl";
import { selectedRangeDescription } from "./range-calendar-format";

const range = (start: string, end: string) => ({
  start: Temporal.PlainDate.from(start),
  end: Temporal.PlainDate.from(end),
});

describe.each([
  {
    locale: "en-US",
    month: "Selected Range: Monday, October 5 to Friday, October 9, 2026",
    months: "Selected Range: Friday, October 30 to Monday, November 2, 2026",
    years: "Selected Range: Wednesday, December 30, 2026 to Saturday, January 2, 2027",
    day: "Selected Date: Tuesday, October 20, 2026",
  },
  {
    locale: "nb-NO",
    month: "Valgt område: mandag 5. oktober til fredag 9. oktober 2026",
    months: "Valgt område: fredag 30. oktober til mandag 2. november 2026",
    years: "Valgt område: onsdag 30. desember 2026 til lørdag 2. januar 2027",
    day: "Valgt dato: tirsdag 20. oktober 2026",
  },
  {
    locale: "sv-SE",
    month: "Valt intervall: måndag 5 oktober till fredag 9 oktober 2026",
    months: "Valt intervall: fredag 30 oktober till måndag 2 november 2026",
    years: "Valt intervall: onsdag 30 december 2026 till lördag 2 januari 2027",
    day: "Valt datum: tisdag 20 oktober 2026",
  },
  {
    locale: "fi-FI",
    month: "Valittu aikaväli: maanantaina 5. lokakuuta – perjantaina 9. lokakuuta 2026",
    months: "Valittu aikaväli: perjantaina 30. lokakuuta – maanantaina 2. marraskuuta 2026",
    years: "Valittu aikaväli: keskiviikkona 30. joulukuuta 2026 – lauantaina 2. tammikuuta 2027",
    day: "Valittu päivämäärä: tiistaina 20. lokakuuta 2026",
  },
])("RangeCalendar range description in $locale", ({ locale, month, months, years, day }) => {
  const strings = new LocalizedStringFormatter(locale, rangeCalendarStrings);

  it("writes a range inside one month, across months, across years and a single day", () => {
    expect(selectedRangeDescription(locale, strings, range("2026-10-05", "2026-10-09"))).toBe(month);
    expect(selectedRangeDescription(locale, strings, range("2026-10-30", "2026-11-02"))).toBe(months);
    expect(selectedRangeDescription(locale, strings, range("2026-12-30", "2027-01-02"))).toBe(years);
    expect(selectedRangeDescription(locale, strings, range("2026-10-20", "2026-10-20"))).toBe(day);
  });
});
