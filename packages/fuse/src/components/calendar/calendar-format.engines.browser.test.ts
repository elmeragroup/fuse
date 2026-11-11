/**
 * Unit under test: the calendar's formatted text in every engine. Oracles, written out by hand per
 * locale, which Chromium and WebKit must each reproduce: for days and months, the strings
 * React Aria's interim tier writes through the same `Intl` options; for a range of months, CLDR's
 * month names joined by the locale's interval fallback separator, with a shared year written once.
 * The ranges are deliberately not `formatRange` output, whose shortening differs by engine (see
 * `calendar-format.ts`).
 */
import { describe, expect, it } from "vitest";

import "../../temporal-polyfill";
import {
  formatDayName,
  formatDayNumber,
  formatMonth,
  formatMonthRange,
  formatWeekday,
} from "./calendar-format";

const OCTOBER_12 = "2026-10-12";

describe.each([
  {
    locale: "en-US",
    name: "Monday, October 12, 2026",
    number: "12",
    month: "October 2026",
    range: "October\u00a0–\u00a0December\u00a02026",
    acrossYears: "November\u00a02026\u00a0–\u00a0January\u00a02027",
    week: "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
  },
  {
    locale: "nb-NO",
    name: "mandag 12. oktober 2026",
    number: "12",
    month: "oktober 2026",
    range: "oktober–desember\u00a02026",
    acrossYears: "november\u00a02026–januar\u00a02027",
    week: "man.,tir.,ons.,tor.,fre.,lør.,søn.",
  },
  {
    locale: "sv-SE",
    name: "måndag 12 oktober 2026",
    number: "12",
    month: "oktober 2026",
    range: "oktober–december\u00a02026",
    acrossYears: "november\u00a02026–januari\u00a02027",
    week: "mån,tis,ons,tors,fre,lör,sön",
  },
  {
    locale: "fi-FI",
    name: "maanantaina 12. lokakuuta 2026",
    number: "12",
    month: "lokakuu 2026",
    range: "lokakuu–joulukuu\u00a02026",
    acrossYears: "marraskuu\u00a02026–tammikuu\u00a02027",
    week: "ma,ti,ke,to,pe,la,su",
  },
] as const)("calendar text in $locale", ({ locale, name, number, month, range, acrossYears, week }) => {
  const day = Temporal.PlainDate.from(OCTOBER_12);

  it("names a day in full", () => {
    expect(formatDayName(locale, day)).toBe(name);
  });

  it("writes a day's number alone", () => {
    expect(formatDayNumber(locale, day)).toBe(number);
  });

  it("names a month, and a one-month range by the month with no-break spaces", () => {
    expect(formatMonth(locale, Temporal.PlainYearMonth.from("2026-10"))).toBe(month);
    expect(
      formatMonthRange(
        locale,
        Temporal.PlainYearMonth.from("2026-10"),
        Temporal.PlainYearMonth.from("2026-10")
      )
    ).toBe(month.replace(" ", "\u00a0"));
  });

  it("writes three months as one range", () => {
    expect(
      formatMonthRange(
        locale,
        Temporal.PlainYearMonth.from("2026-10"),
        Temporal.PlainYearMonth.from("2026-12")
      )
    ).toBe(range);
    expect(
      formatMonthRange(
        locale,
        Temporal.PlainYearMonth.from("2026-11"),
        Temporal.PlainYearMonth.from("2027-01")
      )
    ).toBe(acrossYears);
  });

  it("labels the weekday columns from Monday", () => {
    const labels = Array.from({ length: 7 }, (_, index) => formatWeekday(locale, day.add({ days: index })));
    expect(labels.join(",")).toBe(week);
  });
});
