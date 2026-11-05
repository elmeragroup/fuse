// The clock dial's paths and labels. Units under test: entranceFrame, clockLine, clockArea,
// clockWedges, clockDots, curveRoute, sampleCurve and fitClockLabels. Oracles, written by hand: the
// Motion table's clock entrance, a 750 ms wedge and a 500 ms ease-out cubic rise from the moment the
// wedge reaches a slot, inside one 1,250 ms progress; D16's seam, which closes when both end slots
// hold readings and stays open otherwise; R5's rule as the cartesian Line keeps it, a dashed segment
// beside an estimated reading and a dashed bridge over a missing one under "connect"; an arc between
// two equal radii; and the arc-length fit of 13 px labels 8 px apart round dials of the buckets'
// widths, at 1.1 R: 24 hours need 21 px each, so odd hours show from the 160 px bucket on, where
// 2π · 88 / 24 ≈ 23.0 px, and even hours from the 120 px bucket, where 2 · 2π · 66 / 24 ≈ 34.6 px.
import { describe, expect, it } from "vitest";

import { fitClockLabels } from "./clock-labels";
import {
  clockArea,
  clockDots,
  clockLine,
  clockWedges,
  curveRoute,
  entranceFrame,
  sampleCurve,
} from "./clock-path";
import type { ClockSlots } from "./clock-path";

/** The loop's numbers for n equal slots: progress 1, then each slot's angles, base and tip. */
function numbers(tips: readonly number[], base = 0.3, progress = 1): number[] {
  const step = 360 / tips.length;
  return [progress, ...tips.flatMap((tip, slot) => [slot * step, (slot + 1) * step, base, tip])];
}

/** Every slot a reading, with no mark. */
function readings(count: number, missing: "gap" | "connect" = "gap"): ClockSlots {
  return {
    states: Array.from({ length: count }, () => "reading" as const),
    marked: Array.from({ length: count }, () => false),
    missing,
  };
}

/** The radius of each point a path visits. */
function radii(d: string): number[] {
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map((match) =>
    Math.hypot(Number(match[1]), Number(match[2]))
  );
}

describe("the entrance (the Motion table's clock row)", () => {
  it("opens the wedge over 750 ms and raises each slot over 500 ms from the moment the wedge reaches it", () => {
    // Half the progress is 625 ms: the wedge has opened 360 · 625 / 750 = 300°. Slot 0 starts at 0°
    // and has risen for 625 ms, so it rests. Slot 2 of 4 starts at 180°, which the wedge reached at
    // 375 ms, so it has risen for 250 ms, t = 0.5, and 1 − 0.5³ = 0.875 of its height.
    const { values, reveal } = entranceFrame(numbers([1, 1, 1, 1], 0.2, 0.5));
    expect(reveal).toBeCloseTo(300, 9);
    expect(values[4]).toBeCloseTo(1, 9);
    expect(values[12]).toBeCloseTo(0.2 + 0.8 * 0.875, 9);
    // Slot 3 starts at 270°, reached at 562.5 ms: 62.5 ms of 500, t = 0.125.
    expect(values[16]).toBeCloseTo(0.2 + 0.8 * (1 - 0.875 ** 3), 9);
  });

  it("draws the numbers as they are once the progress reaches 1", () => {
    const rest = numbers([0.5, 0.6]);
    expect(entranceFrame(rest)).toEqual({ values: rest, reveal: 360 });
  });
});

describe("a line round the dial", () => {
  it("closes across 12 o'clock when both end slots hold readings (D16)", () => {
    const { solid } = clockLine(numbers([0.6, 0.6, 0.6, 0.6]), readings(4), "linear");
    expect(solid.endsWith("Z")).toBe(true);
    // Every point of a run of equal values lies on the circle: the segments are arcs.
    for (const radius of radii(solid)) expect(radius).toBeCloseTo(0.6, 3);
  });

  it("stays open when the last slot holds no reading yet", () => {
    const slots = { ...readings(4), states: ["reading", "reading", "reading", "pending"] as const };
    const { solid } = clockLine(numbers([0.6, 0.6, 0.6, 0.6]), slots, "linear");
    expect(solid.endsWith("Z")).toBe(false);
    expect(solid.match(/M/gu)).toHaveLength(1);
  });

  it("breaks at a missing reading, and bridges it dashed under connect", () => {
    const states = ["reading", "missing", "reading", "reading"] as const;
    const gap = clockLine(numbers([0.6, 0.6, 0.6, 0.6]), { ...readings(4), states }, "linear");
    // Slots 2, 3 and 0 run across the seam, and slot 1 breaks it.
    expect(gap.solid.match(/M/gu)).toHaveLength(1);
    expect(gap.marked).toBe("");
    const bridged = clockLine(numbers([0.6, 0.6, 0.6, 0.6]), { ...readings(4, "connect"), states }, "linear");
    expect(bridged.marked).not.toBe("");
  });

  it("dashes the segments that touch an estimated reading", () => {
    const slots = { ...readings(6), marked: [false, false, false, true, false, false] };
    const { solid, marked } = clockLine(numbers([0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), slots, "linear");
    expect(marked).not.toBe("");
    expect(solid).not.toBe("");
    // Slot 3 sits at 210°, so its dashed piece runs from slot 2's vertex at 150° to slot 4's at 270°.
    const points = [...marked.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map((match) => [
      Number(match[1]),
      Number(match[2]),
    ]);
    const angle = ([x = 0, y = 0]: number[]) => ((((Math.atan2(x, -y) * 180) / Math.PI) % 360) + 360) % 360;
    expect(angle(points[0] ?? [])).toBeCloseTo(150, 1);
    expect(angle(points.at(-1) ?? [])).toBeCloseTo(270, 1);
  });

  it("draws a reading between two gaps as a lone dot", () => {
    const states = ["missing", "reading", "missing", "missing"] as const;
    const { solid, lone } = clockLine(numbers([0.6, 0.6, 0.6, 0.6]), { ...readings(4), states }, "linear");
    expect(solid).toBe("");
    expect(lone).toMatch(/^M[\d.-]+,[\d.-]+h0$/u);
  });
});

describe("an area round the dial", () => {
  it("fills a closed loop as the band between two closed outlines", () => {
    const { solid } = clockArea(numbers([0.8, 0.8, 0.8, 0.8], 0.3), readings(4), "linear");
    expect(solid.match(/Z/gu)).toHaveLength(2);
    const all = radii(solid);
    // Coordinates round to 3 decimals, so a radius reads back within 1e-3.
    expect(Math.max(...all)).toBeCloseTo(0.8, 2);
    expect(Math.min(...all)).toBeCloseTo(0.3, 2);
  });
});

describe("the columns", () => {
  it("draws one wedge per reading in its group", () => {
    const groups = clockWedges(
      numbers([0.5, 0.9, 0.5, 0.9]),
      readings(4),
      [0, 1, 2, 3],
      { padAngle: 0, padRadius: 1 },
      (_, base, tip) => [base, tip],
      (slot) => (slot % 2 === 0 ? "low" : "high")
    );
    expect([...groups.keys()]).toEqual(["low", "high"]);
    expect(groups.get("low")?.match(/M/gu)).toHaveLength(2);
  });

  it("puts each dot at its slot's middle angle and its tip", () => {
    // Slot 1 of 4 spans 90° to 180°, so its dot sits at 135° on radius 0.5.
    const dots = clockDots(numbers([0.5, 0.5, 0.5, 0.5]), readings(4), () => "all").get("all") ?? "";
    const second = [...dots.matchAll(/M(-?[\d.]+),(-?[\d.]+)h0/gu)][1];
    expect(Number(second?.[1])).toBeCloseTo(0.5 * Math.sin((135 * Math.PI) / 180), 3);
    expect(Number(second?.[2])).toBeCloseTo(-0.5 * Math.cos((135 * Math.PI) / 180), 3);
  });
});

describe("a ride along the curve", () => {
  it("takes the short way round, through 12 o'clock when that is shorter", () => {
    const route = curveRoute(numbers([0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), readings(6), "linear", 5, 0);
    // From slot 5 at 330° to slot 0 at 30°, 60° forward across the seam, never through 180°.
    expect(route[0]?.angle).toBeCloseTo(330, 6);
    expect((route.at(-1)?.angle ?? 0) % 360).toBeCloseTo(30, 6);
    for (const { angle } of route) expect(angle % 360 > 300 || angle % 360 < 60).toBe(true);
  });

  it("samples a segment between equal radii as an arc", () => {
    const line = sampleCurve(
      [
        { angle: 0, radius: 0.5 },
        { angle: 90, radius: 0.5 },
      ],
      "linear"
    );
    expect(line.length).toBeGreaterThan(40);
    for (const point of line) expect(point.radius).toBeCloseTo(0.5, 12);
  });
});

describe("the label fit", () => {
  it("shows even hours from the 120 px bucket and odd hours from the 160 px bucket", () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ slot: hour, angle: hour * 15, unit: hour }));
    const shown = fitClockLabels(
      hours,
      hours.map(() => 13),
      "day",
      1.1
    );
    expect(shown[0]).toBe("always");
    expect(shown.slice(1, 4)).toEqual([160, 120, 160]);
  });

  it("keeps every label a narrower dial shows, so a stride of 3 never gives way to a stride of 2", () => {
    // 40 px labels need 48 px per pair. A stride of 3 fits from 120 px, where 3 · 2π · 66 / 24 ≈ 51.8;
    // a stride of 2 would fit from 200 px, where 2 · 2π · 110 / 24 ≈ 57.6, but it drops hour 3, so the
    // dial keeps the stride of 3 until every hour fits, from 360 px, where 2π · 198 / 24 ≈ 51.8.
    const hours = Array.from({ length: 24 }, (_, hour) => ({ slot: hour, angle: hour * 15, unit: hour }));
    const shown = fitClockLabels(
      hours,
      hours.map(() => 40),
      "day",
      1.1
    );
    expect(shown.slice(1, 4)).toEqual([360, 360, 120]);
  });
});
