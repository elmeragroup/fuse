// Unit under test: the active dot's track, parsed from a series' path data, and its keyframes.
// Oracle: hand-written path data whose geometry is known by construction: straight segments with
// their own heights, an Area's top and base, a gap between subpaths, a step riser and a lone dot.
import { curveNatural, line } from "d3-shape";
import { describe, expect, it } from "vitest";

import { areaTopPath } from "./line-path";
import type { PathPlacement, PathTopology } from "./line-path";
import { acrossAt, parseTrack, rideAt, rideCourse, rideKeyframes, runBetween } from "./ride";

/** The one run of a track that spans a stretch, or a thrown error. */
/** A placement that draws the numbers as they are, on a linear curve. */
const LINEAR: PathPlacement = {
  orientation: "vertical",
  curve: "linear",
  along: (at) => at,
  run: (centre) => [centre - 0.5, centre + 0.5],
  edge: (at) => at,
  across: (at) => at,
  digits: 3,
};

/** A topology of `count` readings in one run. */
function readings(count: number): PathTopology {
  return {
    count,
    states: Array.from({ length: count }, () => "reading" as const),
    estimated: Array.from({ length: count }, () => false),
    projectedFrom: count,
    missing: "gap",
    sides: Array.from({ length: count }, () => null),
    cells: Array.from({ length: count }, () => 1),
  };
}

function runOver(
  data: string,
  from: number,
  to: number,
  orientation: "vertical" | "horizontal" = "vertical"
) {
  const track = parseTrack(data, orientation);
  const run = track.find(({ along }) => (along[0] ?? 0) <= from && (along.at(-1) ?? 0) >= to);
  if (run === undefined) throw new Error(`no run from ${String(from)} to ${String(to)}`);
  return run;
}

describe("parseTrack", () => {
  it("reads a Line's height between its points", () => {
    const run = runOver("M0,50L10,40L20,60", 0, 20);
    expect(acrossAt(run, 5)).toBeCloseTo(45, 6);
    expect(acrossAt(run, 15)).toBeCloseTo(50, 6);
  });

  it("follows a cubic segment within a tenth of a pixel", () => {
    // A cubic whose control points sit a third of the way along a straight line draws that line.
    const run = runOver("M0,0C10,10,20,20,30,30", 0, 30);
    expect(acrossAt(run, 12)).toBeCloseTo(12, 1);
  });

  it("reads an Area's top edge and not its base", () => {
    // Tops 50, 40 and 60 over a base at 100, as an Area's numbers hold them.
    const top = areaTopPath([0, 50, 100, 10, 40, 100, 20, 60, 100], readings(3), LINEAR);
    const run = runOver(top, 0, 20);
    expect(acrossAt(run, 15)).toBeCloseTo(50, 6);
    expect(acrossAt(run, 20)).toBeCloseTo(60, 6);
  });

  it("splits at a gap and skips a lone reading's dot", () => {
    const track = parseTrack("M0,0L10,0M20,5L30,5M38,9a2,2 0 1,0 4,0a2,2 0 1,0 -4,0", "vertical");
    expect(track).toHaveLength(2);
    expect(runBetween(track, { along: 5, across: 0 }, { along: 25, across: 5 })).toBeNull();
    expect(runBetween(track, { along: 21, across: 5 }, { along: 29, across: 5 })).not.toBeNull();
    expect(runBetween(track, { along: 39, across: 9 }, { along: 41, across: 9 })).toBeNull();
  });

  it("climbs a step's riser past its place", () => {
    const run = runOver("M0,10L5,10L5,30L10,30", 0, 10);
    expect(acrossAt(run, 4.9)).toBeCloseTo(10, 6);
    expect(acrossAt(run, 5.1)).toBeCloseTo(30, 6);
  });

  it("reads a horizontal chart's slot axis down the page", () => {
    // Rows run down y, and values across x.
    const run = runOver("M50,0L40,10L60,20", 0, 20, "horizontal");
    expect(acrossAt(run, 5)).toBeCloseTo(45, 6);
  });
});

describe("rideKeyframes", () => {
  it("keeps every straight move between keyframes within half a pixel of the line, and climbs a riser at once", () => {
    const run = runOver("M0,10L5,10L5,30L10,30L20,0", 0, 20);
    // From x = 0 to rest at x = 20, as offsets from rest.
    const ride = rideCourse(run, { along: 0, across: 10 }, { along: 20, across: 0 });
    const course = (along: number) => acrossAt(run, 20 + along) - acrossAt(run, 20);
    const frames = rideKeyframes(-20, ride);
    expect(frames[0]).toMatchObject({ offset: 0, along: -20 });
    expect(frames.at(-1)?.offset).toBe(1);
    expect(frames.at(-1)?.along).toBeCloseTo(0, 9);
    expect(frames.at(-1)?.across).toBeCloseTo(0, 9);
    for (let step = 0; step <= 1000; step += 1) {
      const share = step / 1000;
      const after = frames.findIndex(({ offset }) => offset >= share);
      const end = frames[after];
      const start = frames[Math.max(0, after - 1)];
      if (start === undefined || end === undefined || end.offset === start.offset) continue;
      const part = (share - start.offset) / (end.offset - start.offset);
      const along = start.along + (end.along - start.along) * part;
      const across = start.across + (end.across - start.across) * part;
      // Off the riser, the move matches the line at its own place along.
      if (Math.abs(20 + along - 5) > 0.01)
        expect(Math.abs(across - course(along)), String(share)).toBeLessThanOrEqual(0.5);
    }
    // The riser at x = 5 is two keyframes at one offset, from 10 to 30.
    const riser = frames.findIndex((frame, index) => frames[index + 1]?.offset === frame.offset);
    expect(riser).toBeGreaterThan(0);
    expect(Math.abs((frames[riser + 1]?.across ?? 0) - (frames[riser]?.across ?? 0))).toBeGreaterThan(19);
  });

  it("rests on a keyframe of its own and follows the course through the spring's overshoot", () => {
    // The track turns at rest, x = 20: flat before it, rising one for one after it.
    const run = runOver("M0,0L20,0L30,10", 0, 30);
    // A spring that passes its target by 1% of the way, from x = 0.
    const frames = rideKeyframes(
      -20,
      rideCourse(run, { along: 0, across: 0 }, { along: 20, across: 0 }),
      1.01
    );
    const rest = frames.find(({ along }) => along === 0);
    expect(rest?.offset).toBeCloseTo(1 / 1.01, 9);
    expect(frames.at(-1)?.offset).toBe(1);
    expect(frames.at(-1)?.along).toBeCloseTo(0.2, 9);
    expect(frames.at(-1)?.across).toBeCloseTo(0.2, 9);
  });

  it.each([
    ["nine alternating readings", [20, 80, 20, 80, 20, 80, 20, 80, 20]],
    ["seventeen low readings with one peak at slot 1", [20, 80, ...Array.from({ length: 15 }, () => 20)]],
  ] as const)("keeps every vertex of %s within half a pixel of a first-to-last glide", (_name, readings) => {
    // Slots 10 px apart, each reading its own height, as a linear Line draws them.
    const data = `M${readings.map((value, index) => `${String(index * 10)},${String(value)}`).join("L")}`;
    const last = (readings.length - 1) * 10;
    const run = runOver(data, 0, last);
    const end = readings.at(-1) ?? 0;
    const frames = rideKeyframes(
      -last,
      rideCourse(run, { along: 0, across: readings[0] }, { along: last, across: end })
    );
    for (const [index, value] of readings.entries()) {
      const vertex = { along: index * 10 - last, across: value - end };
      expect(offFrames(vertex, frames), `slot ${String(index)}`).toBeLessThanOrEqual(0.5);
    }
  });
});

/** How far a point lies from the polyline through keyframes, in their along and across offsets. */
function offFrames(
  point: { readonly along: number; readonly across: number },
  frames: readonly { readonly along: number; readonly across: number }[]
): number {
  let least = Number.POSITIVE_INFINITY;
  frames.forEach((end, index) => {
    const start = frames[index - 1] ?? end;
    const [dx, dy] = [end.along - start.along, end.across - start.across];
    const length = dx * dx + dy * dy;
    const share =
      length === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.along - start.along) * dx + (point.across - start.across) * dy) / length)
          );
    least = Math.min(
      least,
      Math.hypot(point.along - start.along - dx * share, point.across - start.across - dy * share)
    );
  });
  return least;
}

describe("a glide's keyframes against a steep track", () => {
  it("keeps the course within half a pixel across the track at every place along it", () => {
    // y = 100x up to x = 1, then y = 100 + 200(x - 1) up to x = 2, by construction.
    const run = runOver("M0,0L1,100L2,300L3,300", 0, 3);
    const frames = rideKeyframes(-2, rideCourse(run, { along: 0, across: 0 }, { along: 2, across: 300 }));
    const track = (x: number) => (x <= 1 ? 100 * x : 100 + 200 * (x - 1));
    for (let step = 0; step <= 40; step += 1) {
      const x = step / 20;
      const played = polylineAt(frames, x - 2);
      expect(Math.abs(played - (track(x) - 300)), `x = ${String(x)}`).toBeLessThanOrEqual(0.5);
      // What an interrupted glide reads is the course it plays, at the same share of the way.
      const shown = rideAt(frames, x / 2);
      expect(shown.along).toBeCloseTo(x - 2, 9);
      expect(shown.across, `x = ${String(x)}`).toBeCloseTo(played, 9);
    }
  });
});

describe("a ride onto a track's last point", () => {
  it("holds the mark there through the spring's overshoot", () => {
    const run = runOver("M0,0L10,0", 0, 10);
    // A spring that passes its target by 1% of the way, from x = 0 to the track's end at x = 10.
    const frames = rideKeyframes(
      -10,
      rideCourse(run, { along: 0, across: 0 }, { along: 10, across: 0 }),
      1.01
    );
    expect(frames.every(({ along }) => along <= 0)).toBe(true);
    expect(rideAt(frames, 1)).toEqual({ along: 0, across: 0 });
  });
});

describe("a Line's terminal stack", () => {
  it("keeps the stack where the Line ends, and a ride onto its last point climbs it", () => {
    const track = parseTrack("M0,100L100,100L100,0", "vertical");
    const run = runOver("M0,100L100,100L100,0", 0, 100);
    expect(track).toHaveLength(1);
    expect([...run.along]).toEqual([0, 100, 100]);
    expect([...run.across]).toEqual([100, 100, 0]);
    // From x = 0 on the flat stretch to rest on the stack's top at x = 100.
    const frames = rideKeyframes(-100, rideCourse(run, { along: 0, across: 100 }, { along: 100, across: 0 }));
    for (let step = 0; step < 100; step += 1) {
      expect(Math.abs(polylineAt(frames, step - 100) - 100), `x = ${String(step)}`).toBeLessThanOrEqual(0.5);
    }
  });
});

/** A course's offset across at an offset along, read straight off its keyframes' polyline. */
function polylineAt(
  frames: readonly { readonly along: number; readonly across: number }[],
  along: number
): number {
  for (let index = 1; index < frames.length; index += 1) {
    const [start, end] = [frames[index - 1], frames[index]];
    if (start === undefined || end === undefined) continue;
    const [low, high] = start.along < end.along ? [start.along, end.along] : [end.along, start.along];
    if (along < low || along > high || start.along === end.along) continue;
    return start.across + ((end.across - start.across) * (along - start.along)) / (end.along - start.along);
  }
  return Number.NaN;
}

describe("round 3 tracks", () => {
  it("keeps an Area's top stack in its last column, and a glide onto its top stays on the edge", () => {
    // The area M0,100L100,100L100,0L100,200L0,200Z: tops 100, 100 and 0 over a base at 200.
    const top = areaTopPath([0, 100, 200, 100, 100, 200, 100, 0, 200], readings(3), LINEAR);
    const run = runOver(top, 0, 100);
    expect([...run.along]).toEqual([0, 100, 100]);
    expect([...run.across]).toEqual([100, 100, 0]);
    const frames = rideKeyframes(-100, rideCourse(run, { along: 0, across: 100 }, { along: 100, across: 0 }));
    for (let step = 0; step < 100; step += 1) {
      expect(Math.abs(polylineAt(frames, step - 100) - 100), `x = ${String(step)}`).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps a natural spline's span after it bends back", () => {
    const data = line().curve(curveNatural)([
      [0, 0],
      [0, 12],
      [12, 24],
    ]);
    const [run] = parseTrack(data ?? "", "vertical");
    expect(run?.along.at(-1)).toBeCloseTo(12, 6);
    expect(run?.across.at(-1)).toBeCloseTo(24, 6);
  });

  it("keeps two runs apart where they touch at one column across a gap", () => {
    const track = parseTrack("M0,100L10,100M10,0L20,0", "vertical");
    expect(runBetween(track, { along: 10, across: 100 }, { along: 20, across: 0 })).toBeNull();
    // Each run on its own still rides.
    expect(runBetween(track, { along: 10, across: 0 }, { along: 20, across: 0 })).not.toBeNull();
  });
});
