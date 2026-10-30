// Unit under test: the data constants the chart demos hold inline. Oracle: the package fixtures
// that layer 05's trim scripts wrote from frozen Elhub files and the hand-written price day, so a
// demo can never drift from the data its judges read.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";
import { NO1_HOUSEHOLD_DAILY_2025_10 as CAPACITY_DAYS } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-capacity-step";
import {
  NO1_FALL_BACK_2025_10_26,
  NO1_SPRING_2026_03_29,
} from "../src/app/(docs)/components/bar-chart/demos/bar-chart-dst-days";
import { NO1_GROUPS_2026_10_16 } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-hourly-groups";
import { NO1_HOUSEHOLD_DAILY_2025_10 as MONTH_DAYS } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-month-to-date";
import {
  NO1_HOUSEHOLD_DAILY_2024_10,
  NO1_HOUSEHOLD_DAILY_2025_10 as COMPARED_DAYS,
} from "../src/app/(docs)/components/bar-chart/demos/bar-chart-month-vs-last-year";
import { PRICE_DAY_2026_05_24 as LEVEL_DAY } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-price-levels";
import { PRICE_DAY_2026_05_24 as SPIKE_DAY } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-price-spike";
import { NO1_HOUSEHOLD_MONTHLY } from "../src/app/(docs)/components/bar-chart/demos/bar-chart-year-vs-last-year";
import {
  NO1_HOUSEHOLD_DAILY_2025_09 as SWITCH_SEPTEMBER,
  NO1_HOUSEHOLD_DAILY_2025_10 as SWITCH_OCTOBER,
} from "../src/app/(docs)/components/chart/demos/chart-month-usage-and-price";
import {
  PROSUMER_NET_2026_03_29,
  PROSUMER_SOLAR_2026_03_29,
} from "../src/app/(docs)/components/chart/demos/chart-prosumer-day";
import { PRICE_DAY_2026_05_24 as TOTAL_DAY } from "../src/app/(docs)/components/chart/demos/chart-total-price";
import {
  NO1_HOUSEHOLD_2025_10_26,
  PRICE_DAY_2025_10_26,
} from "../src/app/(docs)/components/chart/demos/chart-usage-and-price";
import {
  HOURLY_YEAR_KWH,
  HOURLY_YEAR_START,
} from "../src/app/(docs)/components/chart/demos/data/hourly-year";
import {
  HOURLY_AUTUMN_KWH,
  HOURLY_AUTUMN_START,
} from "../src/app/(docs)/components/chart/demos/data/no1-household-hourly-2025-09-2025-10";

const FIXTURES = path.join(docsRoot, "../../packages/fuse/src/components/chart/format/fixtures");

/** A package fixture's text, which each case parses where it compares. */
function fixtureText(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

describe("the chart demos' inline data", () => {
  // Each constant keeps a subset of its fixture's fields, so the fixture must match it field for
  // field and row for row.
  it("holds S06's five groups as the package fixture does", () => {
    expect(JSON.parse(fixtureText("elhub/no1-groups-2026-10-16.json"))).toMatchObject({
      rows: NO1_GROUPS_2026_10_16,
    });
  });

  it("holds the DST days as the package fixtures do", () => {
    expect(JSON.parse(fixtureText("elhub/no1-consumption-2025-10-26.json"))).toMatchObject({
      rows: NO1_FALL_BACK_2025_10_26,
    });
    expect(JSON.parse(fixtureText("elhub/no1-consumption-2026-03-29.json"))).toMatchObject({
      rows: NO1_SPRING_2026_03_29,
    });
  });

  it.each([
    ["the month to date", MONTH_DAYS],
    ["the capacity step", CAPACITY_DAYS],
    ["the month against last year", COMPARED_DAYS],
    ["the month switch", SWITCH_OCTOBER],
  ] as const)("holds October 2025's days for %s", (_, constant) => {
    expect(JSON.parse(fixtureText("elhub/no1-household-daily-2025-10.json"))).toMatchObject({
      days: constant,
    });
  });

  it("holds October 2024's days", () => {
    expect(JSON.parse(fixtureText("elhub/no1-household-daily-2024-10.json"))).toMatchObject({
      days: NO1_HOUSEHOLD_DAILY_2024_10,
    });
  });

  it("holds the 24 months", () => {
    expect(JSON.parse(fixtureText("elhub/no1-household-monthly-2024-11_2026-10.json"))).toMatchObject({
      months: NO1_HOUSEHOLD_MONTHLY,
    });
  });

  it.each([
    ["the price levels", LEVEL_DAY],
    ["the price spike", SPIKE_DAY],
    ["the total price", TOTAL_DAY],
  ] as const)("holds the hand-written price day for %s", (_, constant) => {
    expect(JSON.parse(fixtureText("prices/negative-spike-2026-05-24-quarter.json"))).toMatchObject(constant);
  });

  it("holds the hourly year", () => {
    expect(JSON.parse(fixtureText("elhub/no1-household-hourly-2025-10_2026-09.json"))).toMatchObject({
      start: HOURLY_YEAR_START,
      values: HOURLY_YEAR_KWH,
    });
  });

  it("holds September 2025's days for the month switch", () => {
    expect(JSON.parse(fixtureText("elhub/no1-household-daily-2025-09.json"))).toMatchObject({
      days: SWITCH_SEPTEMBER,
    });
  });

  it("holds September and October 2025's hours for the Sparklines", () => {
    expect(JSON.parse(fixtureText("elhub/no1-household-hourly-2025-09_2025-10.json"))).toMatchObject({
      start: HOURLY_AUTUMN_START,
      values: HOURLY_AUTUMN_KWH,
    });
  });

  it("holds the fall-back day's household hours and hand-written price quarters for usage and price", () => {
    // The constant keeps the household rows alone, in the fixture's order.
    const household = NO1_HOUSEHOLD_2025_10_26.flatMap((row) => [row, { consumptionGroup: "cabin" }]);
    expect(JSON.parse(fixtureText("elhub/no1-consumption-2025-10-26.json"))).toMatchObject({
      rows: household,
    });
    expect(JSON.parse(fixtureText("prices/fall-back-2025-10-26-quarter.json"))).toMatchObject(
      PRICE_DAY_2025_10_26
    );
  });

  it("holds the derived prosumer day", () => {
    expect(JSON.parse(fixtureText("elhub/no1-prosumer-2026-03-29.json"))).toMatchObject({
      quarters: PROSUMER_SOLAR_2026_03_29,
      hours: PROSUMER_NET_2026_03_29,
    });
  });
});
