// Unit under test: chartDescription, the generated description, after layer 05's review findings
// q16 and s14. Oracle: CONTRACT section 9.3's description facts and the en-US dictionary templates,
// with every expected sentence written by hand from the rows below.
import { describe, expect, it } from "vitest";

import { chartDescription } from "./chart-text";
import type { ValueFormat } from "./chart-types";
import { DATED_SLOT_CASES } from "./format/fixtures/time-literals";
import { buildCartesianModel } from "./layout/cartesian-model";
import type { ModelSeriesConfig } from "./layout/cartesian-model";

function describeRows(
  rows: readonly { readonly [key: string]: number | string }[],
  series: readonly (readonly [string, ModelSeriesConfig])[],
  options: {
    readonly xRange?: readonly [string, string];
    readonly locale?: "en-US" | "nb-NO";
    readonly format?: ValueFormat;
  } = {}
): string {
  const model = buildCartesianModel({
    rows,
    series,
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
    xRange: options.xRange,
  });
  const config = Object.fromEntries(
    series.map(([key]) => [
      key,
      { label: key.toUpperCase(), color: "chart-1" as const, format: options.format },
    ])
  );
  return chartDescription({
    locale: options.locale ?? "en-US",
    model,
    config,
    xFormat: undefined,
    now: undefined,
  });
}

describe("chartDescription", () => {
  it("states the spoken unit once after each label, as CONTRACT section 9.3's example does", () => {
    // js7: 9.3 writes "Forbruk i kilowattimer: lavest 0,33 kl. 03 til 04", so the unit follows
    // the label and each value reads bare. A count joins its noun with a no-break space, and a sentence
    // starts with a capital.
    const rows = [
      { name: "a", p: 0.33, q: 1 },
      { name: "b", p: 1.88, q: 2 },
    ];
    const energy = { preset: "energy", unit: "kWh" } as const;
    expect(
      describeRows(
        rows,
        [
          ["p", { stack: "s" }],
          ["q", { stack: "s" }],
        ],
        { locale: "nb-NO", format: energy }
      )
    ).toBe(
      "Fra a til b, 2\u00a0kategorier. P i kilowattimer: lavest 0,33 a, høyest 1,88 b. Q i kilowattimer: lavest 1 a, høyest 2 b. Totalt i kilowattimer: lavest 1,33 a, høyest 3,88 b."
    );
    expect(describeRows(rows.slice(0, 1), [["p", {}]], { format: energy })).toBe(
      "A, 1\u00a0category. P in kilowatt-hours: lowest 0.33 a, highest 0.33 a."
    );
  });

  it("states each stack's lowest and highest total after the series", () => {
    // Stack s totals 1 + 2 = 3 at a and 3 + 4 = 7 at b.
    const rows = [
      { name: "a", p: 1, q: 2 },
      { name: "b", p: 3, q: 4 },
    ];
    expect(
      describeRows(rows, [
        ["p", { stack: "s" }],
        ["q", { stack: "s" }],
      ])
    ).toBe(
      "From a to b, 2 categories. P: lowest 1 a, highest 3 b. Q: lowest 2 a, highest 4 b. Total: lowest 3 a, highest 7 b."
    );
  });

  it("states where a projection starts inside the window", () => {
    const rows = [
      { name: "a", p: 1 },
      { name: "b", p: 2 },
      { name: "c", p: 3 },
    ];
    expect(describeRows(rows, [["p", { projectedFrom: "b" }]])).toBe(
      "From a to c, 3 categories. P: lowest 1 a, highest 3 c. P is projected from b."
    );
    // A window that ends before the projection starts states none.
    expect(describeRows(rows, [["p", { projectedFrom: "c" }]], { xRange: ["a", "b"] })).toBe(
      "From a to b, 2 categories. P: lowest 1 a, highest 2 b."
    );
  });

  it("names the current slot only when it lies in the window", () => {
    // Three Oslo hours from midnight on 1 October 2025, in summer time, so midnight is 22:00 UTC.
    const midnight = Date.UTC(2025, 8, 30, 22);
    const hour = 3_600_000;
    const rows = [0, 1, 2].map((index) => ({ at: midnight + index * hour, p: index + 1 }));
    const describeAt = (xRange: readonly [number, number]): string =>
      chartDescription({
        locale: "en-US",
        model: buildCartesianModel({
          rows,
          series: [["p", {}]],
          xKey: "at",
          time: { interval: "hour", timeZone: "Europe/Oslo", now: midnight + 2 * hour + 600_000 },
          stackOffset: "diverging",
          baseline: "zero",
          include: [],
          xRange,
        }),
        config: { p: { label: "P", color: "chart-1" } },
        xFormat: undefined,
        now: midnight + 2 * hour + 600_000,
      });
    // Now lies in the third hour, which a window of the first two leaves out.
    expect(describeAt([midnight, midnight + hour])).not.toContain("Now:");
    expect(describeAt([midnight, midnight + 2 * hour])).toContain("Now:");
  });
});

describe("the description of a domain into a new year", () => {
  it("writes both years in its span and dates its extremes", () => {
    // Two Oslo hours, 23:00 on 31 December 2025 and 00:00 on 1 January 2026, holding 1 and 2.
    const model = buildCartesianModel({
      rows: [
        { start: new Date("2025-12-31T22:00:00Z"), v: 1 },
        { start: new Date("2025-12-31T23:00:00Z"), v: 2 },
      ],
      series: [["v", {}]],
      xKey: "start",
      time: { interval: "hour", timeZone: "Europe/Oslo" },
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const config = { v: { label: "V", color: "chart-1" as const } };
    expect(chartDescription({ locale: "en-US", model, config, xFormat: undefined, now: undefined })).toBe(
      "From Wednesday, December 31, 2025 to Thursday, January 1, 2026, 2 hours. " +
        "V: lowest 1 Wednesday, December 31, 2025, 11 PM to 12 AM, " +
        "highest 2 Thursday, January 1, 2026, 12 AM to 1 AM."
    );
  });
});

describe("chartDescription over a coarse series (X2)", () => {
  it("counts a missing hour once, in hours, and names each extreme by its hour", () => {
    // Eight quarters of 1 October 2025 in Oslo, 00:00 to 02:00, with now at 02:00. Price reads 1 on
    // every quarter. Usage is hourly: 2 on hour 0's first quarter, nothing for hour 1, which has
    // ended, so hour 1 is one missing hour, not four missing quarters.
    const midnight = Date.UTC(2025, 8, 30, 22);
    const rows = Array.from({ length: 8 }, (_, index) => {
      const row = { start: new Date(midnight + index * 15 * 60_000), price: 1 };
      return index === 0 ? { ...row, kwh: 2 } : row;
    });
    const model = buildCartesianModel({
      rows,
      series: [
        ["price", {}],
        ["kwh", { interval: "hour" }],
      ],
      xKey: "start",
      time: { interval: "quarter-hour", timeZone: "Europe/Oslo", now: midnight + 2 * 3_600_000 },
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const text = chartDescription({
      locale: "nb-NO",
      model,
      config: { price: { label: "Pris", color: "chart-1" }, kwh: { label: "Forbruk", color: "chart-2" } },
      xFormat: undefined,
      now: midnight + 2 * 3_600_000,
    });
    // The hour range joins its words with no-break spaces, as format/fixtures/time-literals.ts writes it.
    const hour = "kl.\u00a000\u00a0til\u00a001";
    expect(text).toContain(`Forbruk: lavest 2 ${hour}, høyest 2 ${hour}.`);
    expect(text).toContain("1\u00a0time mangler.");
    expect(text).not.toContain("kvarter mangler");
  });
});

describe("chartDescription dates a coarse series' extremes (Y1, B3-1)", () => {
  /** A committed dated label, by its case name. */
  const dated = (name: string): string => {
    const found = DATED_SLOT_CASES.find((entry) => entry.name === name);
    if (found === undefined) throw new Error(`no dated case ${name}`);
    return found.spoken;
  };

  function describeCoarse(
    rows: readonly { readonly start: Date; readonly kwh?: number }[],
    root: "quarter-hour" | "hour",
    own: "hour" | "day"
  ): string {
    const model = buildCartesianModel({
      rows,
      series: [["kwh", { interval: own }]],
      xKey: "start",
      time: { interval: root, timeZone: "Europe/Oslo" },
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    return chartDescription({
      locale: "nb-NO",
      model,
      config: { kwh: { label: "Forbruk", color: "chart-1" } },
      xFormat: undefined,
      now: undefined,
    });
  }

  it("dates each hour on a quarter-hour domain of two days", () => {
    // 192 quarters of 1 and 2 October 2025 in Oslo. Hourly usage reads 1 at midnight on the 1st, 2
    // at midnight on the 2nd and 1.5 in every other hour, so the extremes lie a day apart.
    const midnight = Date.UTC(2025, 8, 30, 22);
    const rows = Array.from({ length: 192 }, (_, index) => {
      const start = new Date(midnight + index * 15 * 60_000);
      if (index % 4 !== 0) return { start };
      return { start, kwh: index === 0 ? 1 : index === 96 ? 2 : 1.5 };
    });
    expect(describeCoarse(rows, "quarter-hour", "hour")).toContain(
      `Forbruk: lavest 1 ${dated("an hour on a two-day domain in nb-NO")}, høyest 2 ${dated("the second day's first hour on a two-day domain in nb-NO")}.`
    );
  });

  it("dates each day with its year on an hourly domain into a new year", () => {
    // 48 hours of 31 December 2025 and 1 January 2026 in Oslo. Daily usage reads 1 on the 31st and
    // 2 on the 1st, each on its day's first hour.
    const first = Date.UTC(2025, 11, 30, 23);
    const rows = Array.from({ length: 48 }, (_, index) => {
      const start = new Date(first + index * 3_600_000);
      return index === 0 ? { start, kwh: 1 } : index === 24 ? { start, kwh: 2 } : { start };
    });
    expect(describeCoarse(rows, "hour", "day")).toContain(
      `Forbruk: lavest 1 ${dated("a day on a domain into 2026, in nb-NO")}, høyest 2 ${dated("the first day of 2026 on a domain into 2026, in nb-NO")}.`
    );
  });
});
