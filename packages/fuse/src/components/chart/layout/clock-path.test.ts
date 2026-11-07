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
  curveRadiusAt,
  curveRoute,
  entranceFrame,
  pixelMarks,
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

  it("closes a complete coarse series whose last slots its final reading covers (B4)", () => {
    // Three hours on a dial of twelve quarter-hour-like slots: each reading owns four slots, which
    // carry its hour's angles, and the three after it are covered. As three hourly slots close, so
    // does the same series drawn coarse.
    const hour = (slot: number): [number, number] => [
      Math.floor(slot / 4) * 120,
      (Math.floor(slot / 4) + 1) * 120,
    ];
    const values = [
      1,
      ...Array.from({ length: 12 }, (_, slot) => [
        ...hour(slot),
        0.3,
        0.5 + Math.floor(slot / 4) / 10,
      ]).flat(),
    ];
    const slots: ClockSlots = {
      states: Array.from({ length: 12 }, (_, slot) => (slot % 4 === 0 ? "reading" : "covered")),
      marked: Array.from({ length: 12 }, () => false),
      missing: "gap",
    };
    expect(clockLine(numbers([0.5, 0.6, 0.7]), readings(3), "linear").solid.endsWith("Z")).toBe(true);
    expect(clockLine(values, slots, "linear").solid.endsWith("Z")).toBe(true);
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

  it("dashes and hatches the closing edge beside an estimated first or last reading (B7)", () => {
    // Six slots of 60°, every vertex at 0.6 and slot 0, at 30°, estimated. Its marked pieces run
    // from slot 5's vertex at 330° across midnight to slot 1's at 90°, so the closing edge from
    // 330° to 30° is dashed, and no solid point lies strictly inside it.
    const slots = { ...readings(6), marked: [true, false, false, false, false, false] };
    const angles = (d: string) =>
      [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map(
        (match) => ((((Math.atan2(Number(match[1]), -Number(match[2])) * 180) / Math.PI) % 360) + 360) % 360
      );
    const { solid, marked } = clockLine(numbers([0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), slots, "linear");
    const inClosing = (angle: number) => angle > 330.5 || angle < 29.5;
    expect(angles(marked).some(inClosing)).toBe(true);
    expect(angles(solid).some(inClosing)).toBe(false);
    const area = clockArea(numbers([0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), slots, "linear");
    expect(angles(area.marked).some(inClosing)).toBe(true);
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

/** Each closed subpath of a path of M, L and Z commands, as x and y points. */
function subpathsOf(d: string): { x: number; y: number }[][] {
  return d
    .split("M")
    .filter((part) => part !== "")
    .map((part) =>
      [...`M${part}`.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map((match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      }))
    );
}

/** Whether a point lies inside a path filled even-odd: an odd count of edge crossings to its right. */
function insideEvenOdd(d: string, x: number, y: number): boolean {
  let inside = false;
  for (const points of subpathsOf(d)) {
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length] ?? a;
      if (a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)) inside = !inside;
    });
  }
  return inside;
}

describe("an Area's quality hatch (Q3)", () => {
  // 24 linear slots of 15°, vertex i at 15i + 7.5°, the base at the hole's 0.3 and tips that vary:
  // 0.5 at midnight, rising 0.015 a slot, and 0.9 at slot 23. A linear curve draws straight in angle
  // and radius between vertices, so the tip at an angle is the interpolation of its two vertices.
  // The hatch must fill exactly the band beside each marked reading, from the vertex before it to
  // the vertex after it, between the base and the tip, and nothing else.
  const tips = Array.from({ length: 24 }, (_, slot) => (slot === 23 ? 0.9 : 0.5 + 0.015 * slot));
  const vertex = (slot: number) => 15 * slot + 7.5;
  const tipAt = (angle: number): number => {
    const turn = (((angle - 7.5) % 360) + 360) % 360;
    const slot = Math.floor(turn / 15);
    const t = (turn - 15 * slot) / 15;
    return (tips[slot] ?? 0) + ((tips[(slot + 1) % 24] ?? 0) - (tips[slot] ?? 0)) * t;
  };
  const xy = (angle: number, radius: number): readonly [number, number] => [
    radius * Math.sin((angle * Math.PI) / 180),
    -radius * Math.cos((angle * Math.PI) / 180),
  ];

  it.each([
    ["a marked midnight reading", [0]],
    ["two adjacent marked readings", [5, 6]],
    ["a marked last reading", [23]],
  ] as const)("hatches exactly the band beside %s, inside the area", (_, marked: readonly number[]) => {
    const slots = { ...readings(24), marked: Array.from({ length: 24 }, (_, slot) => marked.includes(slot)) };
    const { solid, marked: hatch } = clockArea(numbers(tips), slots, "linear");
    // The band runs from the vertex before the first marked reading to the vertex after the last.
    const from = vertex(Math.min(...marked) - 1);
    const to = vertex(Math.max(...marked) + 1);
    for (let angle = from - 30; angle <= to + 30; angle += 1) {
      const inBand = angle > from + 0.5 && angle < to - 0.5;
      const outBand = angle < from - 0.5 || angle > to + 0.5;
      if (!inBand && !outBand) continue;
      const tip = tipAt(angle);
      for (const share of [0.15, 0.5, 0.85]) {
        const radius = 0.3 + (tip - 0.3) * share;
        const [x, y] = xy(angle, radius);
        expect(insideEvenOdd(hatch, x, y), `${String(angle)}° at ${radius.toFixed(3)}`).toBe(inBand);
        if (inBand) expect(insideEvenOdd(solid, x, y)).toBe(true);
      }
      // Never in the hole, never past the tip.
      expect(insideEvenOdd(hatch, ...xy(angle, 0.2))).toBe(false);
      expect(insideEvenOdd(hatch, ...xy(angle, tip + 0.02))).toBe(false);
    }
  });
});

describe("a step curve's quality (Q3, B7)", () => {
  // A step draws each reading across its own slot, so its quality covers exactly that slot: hour h
  // of 24 runs from 15h° to 15(h + 1)°. A cell step draws the slot's two ends, and the midpoint step
  // turns halfway between two vertices, which on equal slots is their shared edge.
  const angleOf = ([x = 0, y = 0]: readonly number[]) =>
    ((((Math.atan2(x, -y) * 180) / Math.PI) % 360) + 360) % 360;
  const pointsOf = (d: string) =>
    [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map((match) => [Number(match[1]), Number(match[2])]);
  const xy = (angle: number, radius: number): readonly [number, number] => [
    radius * Math.sin((angle * Math.PI) / 180),
    -radius * Math.cos((angle * Math.PI) / 180),
  ];
  const day = (marked: number, pending: readonly number[]): ClockSlots => ({
    ...readings(24),
    states: Array.from({ length: 24 }, (_, slot) => (pending.includes(slot) ? "pending" : "reading")),
    marked: Array.from({ length: 24 }, (_, slot) => slot === marked),
  });

  it.each(
    (["step-after", "step-before", "step"] as const).flatMap((curve) => [
      [curve, "06:00 of a complete day", day(6, []), 90, 105] as const,
      // An open run's midpoint step starts at its first vertex, 7.5°, so it draws hour 0 from there.
      [
        curve,
        "00:00 of a live day whose 23:00 is pending",
        day(0, [23]),
        curve === "step" ? 7.5 : 0,
        15,
      ] as const,
    ])
  )("dashes and hatches exactly the slot of a %s curve's estimated %s", (curve, _, slots, from, to) => {
    const tips = Array.from({ length: 24 }, () => 0.6);
    const line = clockLine(numbers(tips), slots, curve);
    const dashed = pointsOf(line.marked).map(angleOf);
    expect(Math.min(...dashed)).toBeCloseTo(from, 1);
    expect(Math.max(...dashed)).toBeCloseTo(to, 1);
    expect(
      pointsOf(line.solid)
        .map(angleOf)
        .filter((angle) => angle > from + 0.5 && angle < to - 0.5)
    ).toEqual([]);
    const area = clockArea(numbers(tips), slots, curve);
    for (let angle = 0.25; angle < 360; angle += 1) {
      if (Math.abs(angle - from) < 0.5 || Math.abs(angle - to) < 0.5) continue;
      expect(insideEvenOdd(area.marked, ...xy(angle, 0.45)), `${String(angle)}°`).toBe(
        angle > from && angle < to
      );
    }
  });
});

describe("a step area's hatch at its slot's edges", () => {
  // A step draws each reading flat across its slot, so the hatch of hour 6, from 90° to 105°, must
  // take hour 6's own top and base right up to each edge, not the neighbour's on the far side of
  // the step. Hour 5 reads 0.9 beside 0.45 everywhere else, and in the stacked case its base sits at
  // 0.6 beside 0.35 everywhere else, so the edge at 90° jumps on both curves.
  const xy = (angle: number, radius: number): readonly [number, number] => [
    radius * Math.sin((angle * Math.PI) / 180),
    -radius * Math.cos((angle * Math.PI) / 180),
  ];
  /** The loop's numbers for 24 slots with a tip and a base each. */
  const day = (tip: (slot: number) => number, base: (slot: number) => number): number[] => [
    1,
    ...Array.from({ length: 24 }, (_, slot) => [slot * 15, (slot + 1) * 15, base(slot), tip(slot)]).flat(),
  ];
  const slots = { ...readings(24), marked: Array.from({ length: 24 }, (_, slot) => slot === 6) };

  it.each(
    (["step-after", "step-before", "step"] as const).flatMap((curve) => [
      [
        curve,
        "unequal readings",
        day(
          (slot) => (slot === 5 ? 0.9 : 0.45),
          () => 0.3
        ),
        0.3,
        0.45,
      ] as const,
      [
        curve,
        "a stack's stepping base",
        day(
          (slot) => (slot === 5 ? 0.9 : 0.45),
          (slot) => (slot === 5 ? 0.6 : 0.35)
        ),
        0.35,
        0.45,
      ] as const,
    ])
  )("keeps a %s area's hatch over %s inside hour 6 and inside the fill", (curve, _, values, base, tip) => {
    const { solid, marked } = clockArea(values, slots, curve);
    const middle = (base + tip) / 2;
    // Just inside each edge, hour 6's band is hatched; just outside, nothing is.
    for (const angle of [90.5, 104.5]) {
      expect(insideEvenOdd(marked, ...xy(angle, middle)), `${String(angle)}° in the band`).toBe(true);
      expect(insideEvenOdd(marked, ...xy(angle, tip + 0.05)), `${String(angle)}° above the tip`).toBe(false);
      expect(insideEvenOdd(marked, ...xy(angle, base - 0.02)), `${String(angle)}° below the base`).toBe(
        false
      );
    }
    for (const angle of [89.5, 105.5]) {
      for (const radius of [middle, 0.7]) {
        expect(insideEvenOdd(marked, ...xy(angle, radius)), `${String(angle)}° at ${String(radius)}`).toBe(
          false
        );
      }
    }
    // Every point the hatch covers lies inside the fill.
    for (let angle = 85; angle <= 110; angle += 0.25) {
      for (let radius = 0.2; radius <= 1; radius += 0.02) {
        if (insideEvenOdd(marked, ...xy(angle, radius))) {
          expect(
            insideEvenOdd(solid, ...xy(angle, radius)),
            `${String(angle)}° at ${radius.toFixed(2)}`
          ).toBe(true);
        }
      }
    }
  });
});

describe("an hourly year's quality", () => {
  // 2025 holds 8,760 hours, every other one estimated, drawn as a step. Oracle: the marks written by
  // hand: each estimated hour dashes, or hatches, across its own slot as a piece of its own, and
  // each plain hour draws its own plain piece between them.
  const tips = Array.from({ length: 8760 }, (_, hour) => 0.4 + (0.5 * ((hour * 7) % 13)) / 13);
  const values = numbers(tips);
  const slots: ClockSlots = {
    ...readings(8760),
    marked: Array.from({ length: 8760 }, (_, hour) => hour % 2 === 1),
  };
  const pieces = (d: string): number => d.split("M").length - 1;

  it("steps back to the first reading at 12 o'clock when a closed step Line splits", () => {
    // A step-after line holds each reading to its slot's end and steps there to the next one, so at
    // 12 o'clock it steps from the last reading, 0.8, to the first, 0.5, as it steps from 0.5 to 0.6
    // at 90°. The step opens slot 0's piece, which is plain. A cell step's turn starts at slot 0's
    // start, where this step falls; the midpoint step's starts at slot 0's middle, past it.
    const quarters = numbers([0.5, 0.6, 0.7, 0.8]);
    const marks = { ...readings(4), marked: [false, true, false, true] };
    for (const curve of ["step-after", "step-before"] as const) {
      const { solid, marked } = clockLine(quarters, marks, curve);
      expect(
        radii(solid)
          .slice(0, 2)
          .map((radius) => radius.toFixed(3)),
        curve
      ).toEqual(["0.800", "0.500"]);
      expect(
        radii(marked)
          .slice(0, 3)
          .map((radius) => radius.toFixed(3)),
        curve
      ).toEqual(["0.500", "0.500", "0.600"]);
    }
  });

  it("dashes each estimated hour of a step-after Line on its own", () => {
    const { solid, marked } = clockLine(values, slots, "step-after");
    // The odd hours are dashed and the even ones plain, each across its own slot.
    expect([pieces(solid), pieces(marked)]).toEqual([4380, 4380]);
  });

  it("hatches each estimated hour of a step-after Area on its own", () => {
    const { marked } = clockArea(values, slots, "step-after");
    expect(pieces(marked)).toBe(4380);
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

  it("rides the closing edge back across midnight to the last slot's own reading (B6)", () => {
    // A linear day with radii 0.5 at slot 0, 0.6 at slot 1, 0.9 at slot 23 and 0.7 elsewhere. A
    // step back from slot 0, at 7.5°, to slot 23, at 352.5°, runs 15° back along the closing edge,
    // straight from 0.5 to 0.9, and ends on 0.9.
    const tips = Array.from({ length: 24 }, (_, slot) =>
      slot === 0 ? 0.5 : slot === 1 ? 0.6 : slot === 23 ? 0.9 : 0.7
    );
    const route = curveRoute(numbers(tips), readings(24), "linear", 0, 23);
    expect(route[0]?.radius).toBeCloseTo(0.5, 6);
    expect(route.at(-1)?.radius).toBeCloseTo(0.9, 6);
    expect((((route.at(-1)?.angle ?? 0) % 360) + 360) % 360).toBeCloseTo(352.5, 6);
    for (const { radius } of route) {
      expect(radius).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(radius).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  it.each([
    ["from slot 1 back across midnight to slot 23", 1, 23, 0.5, 22.5, 0.9, 352.5],
    ["from slot 23 on across midnight to slot 1", 23, 1, 0.9, 352.5, 0.5, 22.5],
  ] as const)(
    "ends an open run's ride %s on the destination's own vertex, never past the samples (B8)",
    (_, from, to, startRadius, startAngle, endRadius, endAngle) => {
      // A linear day with slot 0 missing, so slots 1 to 23 form one open run: radii 0.5 at slot 1,
      // 0.6 at slot 2, 0.9 at slot 23 and 0.7 elsewhere. The short way between 1 and 23 crosses
      // midnight, outside the run's samples, so the ride goes straight from vertex to vertex.
      const tips = Array.from({ length: 24 }, (_, slot) =>
        slot === 1 ? 0.5 : slot === 2 ? 0.6 : slot === 23 ? 0.9 : 0.7
      );
      const slots: ClockSlots = {
        ...readings(24),
        states: Array.from({ length: 24 }, (_, slot) => (slot === 0 ? "missing" : "reading")),
      };
      const route = curveRoute(numbers(tips), slots, "linear", from, to);
      const turn = (angle: number) => ((angle % 360) + 360) % 360;
      expect(route[0]?.radius).toBeCloseTo(startRadius, 6);
      expect(turn(route[0]?.angle ?? 0)).toBeCloseTo(startAngle, 6);
      expect(route.at(-1)?.radius).toBeCloseTo(endRadius, 6);
      expect(turn(route.at(-1)?.angle ?? 0)).toBeCloseTo(endAngle, 6);
      for (const { radius } of route) {
        expect(radius).toBeGreaterThanOrEqual(0.5 - 1e-9);
        expect(radius).toBeLessThanOrEqual(0.9 + 1e-9);
      }
    }
  );

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

describe("curveRadiusAt", () => {
  // Two linear slots, their vertices at 90° (0.4) and 270° (0.8). Two readings never close round
  // the dial (D16 closes three or more), so in unrolled space the line runs straight from one vertex
  // to the other, reads 0.6 halfway at 180°, and draws nothing across 12 o'clock.
  const two = numbers([0.4, 0.8]);
  it.each([
    [90, 0.4],
    [180, 0.6],
    [540, 0.6],
    [270, 0.8],
  ])("reads a two-slot linear line at %s° as %s", (angle, radius) => {
    expect(curveRadiusAt(two, readings(2), "linear", angle)).toBeCloseTo(radius, 9);
  });

  it("reads nothing across 12 o'clock on a two-slot line", () => {
    expect(curveRadiusAt(two, readings(2), "linear", 0)).toBeNull();
  });

  it("reads nothing past an open run's end, and a lone reading's tip in its slot", () => {
    // Slot 3 of 4 is pending, so the run of slots 0 to 2 ends at slot 2's vertex, 225°.
    const open: ClockSlots = { ...readings(4), states: ["reading", "reading", "reading", "pending"] };
    expect(curveRadiusAt(numbers([0.5, 0.5, 0.5, 0.5]), open, "linear", 300)).toBeNull();
    const lone: ClockSlots = { ...readings(4), states: ["missing", "reading", "missing", "missing"] };
    expect(curveRadiusAt(numbers([0.5, 0.7, 0.5, 0.5]), lone, "linear", 100)).toBe(0.7);
    expect(curveRadiusAt(numbers([0.5, 0.7, 0.5, 0.5]), lone, "linear", 200)).toBeNull();
  });
});

describe("the hatch by pixel column", () => {
  // Slot i of n lies in column ⌊(i + ½) · columns / n⌋: of 8 slots on 4 columns, slots 0 and 1 share
  // column 0, 2 and 3 column 1, and so on, and a column hatches when any of its slots is marked.
  it("marks every slot of a column that holds a marked slot", () => {
    expect(pixelMarks([true, false, false, false, false, false, false, true], 4)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("keeps each slot's own mark when every slot spans a pixel or more", () => {
    const marks = [true, false, true, false];
    expect(pixelMarks(marks, 4)).toBe(marks);
    expect(pixelMarks(marks, 400)).toBe(marks);
  });

  it("hatches an hourly year of alternating estimates as one region on a 1,257-pixel rim", () => {
    // A 100 px dial at 2× has 2π · 100 · 2 ≈ 1,257 device pixels round its rim, so each column holds
    // about seven hours, at least one of them estimated, and the whole closed loop hatches.
    const tips = Array.from({ length: 8760 }, (_, hour) => 0.4 + (0.5 * ((hour * 7) % 13)) / 13);
    const slots: ClockSlots = {
      ...readings(8760),
      marked: Array.from({ length: 8760 }, (_, hour) => hour % 2 === 1),
    };
    const { marked } = clockArea(numbers(tips), slots, "step-after", 1257);
    expect(marked.split("M").length - 1).toBe(1);
  });
});
