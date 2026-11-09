// The clock's angle follower under a moving pointer, in Chromium with motion on. Units under test:
// ClockChart.ActiveDot and ClockChart.Scrubber on the Root's follower.
// Oracles: the Line's own rendered path, sampled at 4,000 points along its length and mapped to the
// screen by its own CTM, on which the dot must lie in every frame of a glide; the dot's angle about
// the dial's rendered centre, which the Scrubber's computed rotation must match; and the dot's own
// last frame step, which a second step 80 ms into a glide may not exceed by more than half. The
// day is solar-shaped: 96 quarter-hours, near zero at night and a sine over the day.
//
// The follower's pace across a curve that bends between a frame's two ends runs on frames the test
// steps by hand. Unit under test: createPolarFollow's capped turn. Oracle: the dot's travel in each
// frame, the chord between its two points on a radius curve defined there, which may not pass the
// pointer's pace, the rim's travel at the pace's turn. The curve is a slot of a monotone series as a
// cubic draws it: flat at both knots and steepest between them, where a frame's two ends read less
// than its middle does.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { clockLayer } from "../../../test/chart/clock";
import { clientPoint, dialPoint, hoverAt } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { MotionHost } from "./chart-motion";
import { createPolarFollow, STRETCH_SPAN } from "./chart-polar-follow";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";

/** Midnight in Oslo on 25 October 2025, a 24-hour day of 96 quarter-hours. */
const DAY = Date.parse("2025-10-24T22:00:00Z");
const QUARTER = 900_000;

/** A solar-shaped day: 4 Wh a quarter at night, a sine peaking near 1.25 kWh at 13:00. */
const SOLAR = Array.from({ length: 96 }, (_, quarter) => ({
  start: DAY + quarter * QUARTER,
  solar: quarter >= 28 && quarter < 76 ? 0.05 + 1.2 * Math.sin((Math.PI * (quarter - 28)) / 48) : 0.004,
}));

function Solar(): ReactElement {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={SOLAR}
          config={{ solar: { label: "Sol", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="quarter-hour"
          data-intro="none"
          aria-label="Solproduksjon">
          <ClockChart.Grid />
          <ClockChart.Area dataKey="solar" />
          <ClockChart.Line dataKey="solar" />
          <ClockChart.Scrubber />
          <ClockChart.ActiveDot dataKey="solar" />
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

type Frame = { readonly dot: { x: number; y: number } | null; readonly hand: number };

/** The client point of each of 4,000 samples along a path, through its own screen CTM. */
function sampled(path: SVGPathElement): { x: number; y: number }[] {
  const length = path.getTotalLength();
  const ctm = path.getScreenCTM();
  if (ctm === null) throw new Error("no CTM");
  return Array.from({ length: 4000 }, (_, at) => {
    const point = path.getPointAtLength((length * at) / 3999).matrixTransform(ctm);
    return { x: point.x, y: point.y };
  });
}

/** The angle of a client point about a centre, in degrees from 12 o'clock, clockwise. */
function angleAbout(point: { x: number; y: number }, centre: readonly [number, number]): number {
  return (Math.atan2(point.x - centre[0], centre[1] - point.y) * 180) / Math.PI;
}

/** The signed difference of two angles, folded into [−180, 180). */
function apart(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function setup(host: HTMLElement) {
  const line = clockLayer(host, "clock-chart-line").querySelector<SVGPathElement>('path[data-part="solid"]');
  // DOM audit: the dot's own path and the hand are aria-hidden plot output, read by their parts.
  const dot = clockLayer(host, "clock-chart-active-dot").querySelector<SVGPathElement>(
    'path[data-part="dots"]'
  );
  const group = clockLayer(host, "clock-chart-active-dot").querySelector("[data-follow]");
  const hand = host.querySelector<SVGGElement>('[data-slot="clock-chart-scrubber"] [data-part="hand"]');
  if (line === null || dot === null || group === null || hand === null) throw new Error("no parts");
  const layer = clockLayer(host, "clock-chart-line");
  const centre = clientPoint(layer, 0, 0);
  const at = (slot: number) => {
    const point = dialPoint(((slot + 0.5) * 360) / 96, 0.8);
    return clientPoint(layer, point.x, point.y);
  };
  const read = (): Frame => {
    const box = dot.getBoundingClientRect();
    return {
      dot: group.hasAttribute("data-value")
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : null,
      hand: Number.parseFloat(getComputedStyle(hand).rotate),
    };
  };
  return { curve: sampled(line), centre, at, read };
}

/** Move the pointer over the plot without waiting a frame, so the next frame is the step's first. */
function moveTo(x: number, y: number): void {
  page
    .getByRole("listbox")
    .element()
    .dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" })
    );
}

describe("the clock's active dot on the Root's follower", () => {
  it.each([1, 5, 47])(
    "keeps the dot on the Line and the Scrubber on the dot through a %s-slot pointer step",
    async (step) => {
      const { host } = renderThemed(<Solar />);
      const { curve, centre, at, read } = setup(host);
      await hoverAt(...at(30));
      await recordFrames(read, () => false, 300);
      await hoverAt(...at(30 + step));
      const seen = await recordFrames(read, () => false, 700);
      const shown = seen.filter(
        (frame): frame is Frame & { dot: { x: number; y: number } } => frame.dot !== null
      );
      expect(shown.length).toBeGreaterThan(20);
      const off = shown.map(({ dot }) =>
        Math.min(...curve.map((point) => Math.hypot(point.x - dot.x, point.y - dot.y)))
      );
      expect(Math.max(...off)).toBeLessThanOrEqual(0.5);
      const turn = shown.map(({ dot, hand }) => Math.abs(apart(hand, angleAbout(dot, centre))));
      expect(Math.max(...turn)).toBeLessThanOrEqual(0.5);
      // The glide ends on the new slot's middle, at the capped pace a long step takes.
      await expect
        .poll(() => Math.abs(apart(read().hand, ((30 + step + 0.5) * 360) / 96)), { timeout: 3000 })
        .toBeLessThan(0.01);
    }
  );

  it("carries the dot's speed into a second step 80 ms into a glide", async () => {
    const { host } = renderThemed(<Solar />);
    const { at, read } = setup(host);
    await hoverAt(...at(30));
    await recordFrames(read, () => false, 300);
    await hoverAt(...at(35));
    const first = await recordFrames(read, () => false, 80);
    moveTo(...at(40));
    const [next] = await recordFrames(read, () => false, 1);
    const travel = (a: Frame | undefined, b: Frame | undefined): number =>
      a?.dot == null || b?.dot == null ? 0 : Math.hypot(b.dot.x - a.dot.x, b.dot.y - a.dot.y);
    const before = travel(first.at(-2), first.at(-1));
    const after = travel(first.at(-1), next);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(1.5 * before);
  });
});

// A stepped series under a turning pointer. Unit under test: the follower's pace beside an ActiveDot
// on a step-after Line, whose radius jumps at every slot edge. Oracle: the same dial without an
// ActiveDot, whose follower turns at the pointer's pace alone. A riser is a jump the dot makes in
// one frame at any pace, so the dot may not slow the hand there: no frame turns backwards, no turn
// after the first 12 frames drops under half the median turn, and the median lag behind the pointer
// stays within 1.25 times the dial's lag without a dot.
// Kept as a direct frame wait: it needs the frame callback's timestamp, which nextFrames drops.
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/**
 * Turn the pointer round the dial at 0.8 R at a speed in CSS px/s, one move per animation frame,
 * and read the Scrubber's unwrapped rotation each frame after the first 12.
 */
async function ring(host: HTMLElement, speed: number, turns: number) {
  const layer = clockLayer(host, "clock-chart-line");
  const [cx, cy] = clientPoint(layer, 0, 0);
  const [rx] = clientPoint(layer, 1, 0);
  const radius = rx - cx;
  // DOM audit: the Scrubber's hand is aria-hidden plot output, read by its part.
  const hand = host.querySelector<SVGGElement>('[data-slot="clock-chart-scrubber"] [data-part="hand"]');
  if (hand === null) throw new Error("no hand");
  const listbox = page.getByRole("listbox").element();
  const move = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    listbox.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: cx + 0.8 * radius * Math.sin(radians),
        clientY: cy - 0.8 * radius * Math.cos(radians),
        pointerType: "mouse",
      })
    );
  };
  move(1);
  await nextFrames(30);
  const omega = (speed / (0.8 * radius)) * (180 / Math.PI);
  const start = await nextFrame();
  const rows: { pointer: number; hand: number }[] = [];
  let unwrapped: number | null = null;
  let stopped = start;
  const read = (): number => {
    const raw = Number.parseFloat(getComputedStyle(hand).rotate);
    unwrapped = unwrapped === null ? raw : unwrapped + ((((raw - unwrapped) % 360) + 540) % 360) - 180;
    return unwrapped;
  };
  for (;;) {
    const now = await nextFrame();
    const pointer = 1 + (omega * (now - start)) / 1000;
    if (pointer > turns * 360) break;
    move(pointer);
    stopped = now;
    rows.push({ pointer, hand: read() });
  }
  // After the last move the hand comes to rest on the pointer's slot. It lands, as the sweeps'
  // landing reads it, in the first frame within 0.5° of where it rests, in milliseconds after the
  // frame of that last move.
  const after: { readonly at: number; readonly hand: number }[] = [];
  for (let wait = 0; wait < 40; wait += 1) {
    const now = await nextFrame();
    after.push({ at: now - stopped, hand: read() });
  }
  const rest = after.at(-1)?.hand ?? 0;
  const landed = after.find((frame) => Math.abs(frame.hand - rest) < 0.5)?.at ?? null;
  const moving = rows.slice(12);
  const lags = moving.map((row) => row.pointer - row.hand).sort((a, b) => a - b);
  const turned = moving.slice(1).map((row, index) => row.hand - (moving[index]?.hand ?? row.hand));
  const median = [...turned].sort((a, b) => a - b)[Math.floor(turned.length / 2)] ?? 0;
  return {
    lag: lags[Math.floor(lags.length / 2)] ?? 0,
    lagMax: lags.at(-1) ?? 0,
    landed,
    median,
    dips: turned.filter((turn) => turn < 0.5 * median).length,
    backwards: turned.filter((turn) => turn < -0.01).length,
    frames: moving.length,
  };
}

describe("the follower beside a stepped series' dot", () => {
  /** 96 quarter-hourly prices, a stepped day that moves at every quarter. */
  const PRICES = Array.from({ length: 96 }, (_, quarter) => ({
    start: DAY + quarter * QUARTER,
    price: 40 + 30 * Math.sin((quarter / 96) * Math.PI * 3) + 12 * Math.cos(quarter * 0.9),
  }));

  function Stepped({ dot }: { readonly dot: boolean }): ReactElement {
    return (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={PRICES}
            config={{ price: { label: "Pris", color: "chart-1" } }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            data-intro="none"
            aria-label="Spotpris">
            <ClockChart.Grid />
            <ClockChart.Line dataKey="price" curve="step-after" />
            <ClockChart.Scrubber />
            {dot ? <ClockChart.ActiveDot dataKey="price" /> : null}
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("keeps pace with a pointer at 800 px/s, as the dial without a dot does", async () => {
    const plain = renderThemed(<Stepped dot={false} />);
    await nextFrames(20);
    const alone = await ring(plain.host, 800, 1.5);
    plain.unmount();
    const { host } = renderThemed(<Stepped dot />);
    await nextFrames(20);
    const beside = await ring(host, 800, 1.5);
    expect(beside.frames).toBeGreaterThan(30);
    expect(beside.backwards).toBe(0);
    expect(beside.dips).toBe(0);
    expect(beside.lag).toBeLessThanOrEqual(1.25 * alone.lag);
  });

  it("never turns backwards over three turns at 2,000 px/s", async () => {
    const { host } = renderThemed(<Stepped dot />);
    await nextFrames(20);
    const result = await ring(host, 2000, 3);
    expect(result.frames).toBeGreaterThan(30);
    expect(result.backwards).toBe(0);
  });
});

describe("the follower beside the docs Solar day's dot under a fast circle", () => {
  /** The docs Solar demo's day: 92 quarter-hours of 29 March 2026, the short day of the spring change, in kWh. */
  const KWH = [
    0.0025, 0.0026, 0.0032, 0.0039, 0.006, 0.0064, 0.0069, 0.0068, 0.0053, 0.0039, 0.0071, 0.0086, 0.0085,
    0.0085, 0.0087, 0.0084, 0.0086, 0.0091, 0.0088, 0.0089, 0.0084, 0.0082, 0.008, 0.0085, 0.0124, 0.0124,
    0.0173, 0.0264, 0.0956, 0.1097, 0.1257, 0.1488, 0.3323, 0.3578, 0.3844, 0.4133, 0.6903, 0.7201, 0.7444,
    0.7746, 1.0426, 1.069, 1.0904, 1.1017, 1.2334, 1.2424, 1.2451, 1.25, 1.1754, 1.1661, 1.1509, 1.1144,
    0.9432, 0.9489, 0.9026, 0.8629, 0.6007, 0.564, 0.494, 0.4526, 0.2146, 0.1972, 0.1802, 0.1584, 0.0876,
    0.0774, 0.0744, 0.0641, 0.0313, 0.0252, 0.0187, 0.0154, 0.0064, 0.0047, 0.004, 0.0034, 0.0029, 0.0029,
    0.003, 0.003, 0.0029, 0.0028, 0.0028, 0.0028, 0.0027, 0.0027, 0.0028, 0.0027, 0.0027, 0.0027, 0.0027,
    0.0027,
  ];
  /** Midnight in Oslo on 29 March 2026. */
  const SPRING = Date.parse("2026-03-28T23:00:00Z");

  function SolarDay(): ReactElement {
    return (
      <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={KWH.map((solar, quarter) => ({ start: SPRING + quarter * QUARTER, solar }))}
            config={{
              solar: { label: "Solar", color: "chart-3", format: { preset: "energy", unit: "kWh" } },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            data-intro="none"
            aria-label="Solar">
            <ClockChart.Grid />
            <ClockChart.AngleAxis />
            <ClockChart.Area dataKey="solar" />
            <ClockChart.Line dataKey="solar" />
            <ClockChart.Scrubber />
            <ClockChart.ActiveDot dataKey="solar" />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  // Four turns at 2,000 px/s: under the dot's pace the hand trails the pointer, by more than half a
  // turn at times, and keeps turning the pointer's way; it lands within 300 ms once the pointer stops.
  it("never turns backwards over four turns at 2,000 px/s, trails by under a turn, and lands within 300 ms", async () => {
    const { host } = renderThemed(<SolarDay />);
    await nextFrames(20);
    const result = await ring(host, 2000, 4);
    expect(result.frames).toBeGreaterThan(30);
    expect(result.backwards).toBe(0);
    expect(result.lagMax).toBeLessThan(360);
    expect(result.landed).not.toBeNull();
    expect(result.landed ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(300);
  });
});

/** The hand-stepped dial's outer radius in CSS pixels. */
const R = 100;

/** The pace, in degrees a frame at the rim: 4° on a 100 px dial is 6.98 px a frame. */
const PACE = 4;

/** The slot from 30° to 33.75°, a quarter-hour of a day, over which the radius rises by 0.105 R. */
const SLOT = { from: 30, to: 33.75, base: 0.5, rise: 0.105 };

/** The curve's radius at an angle, in outer radii: a smoothstep over the slot, flat outside it. */
function radius(angle: number): number {
  const u = Math.min(1, Math.max(0, (angle - SLOT.from) / (SLOT.to - SLOT.from)));
  return SLOT.base + SLOT.rise * u * u * (3 - 2 * u);
}

/** Where a dot on the curve sits at an angle, in CSS pixels about the centre. */
function dotAt(angle: number): DOMPoint {
  const turn = (angle * Math.PI) / 180;
  return new DOMPoint(R * radius(angle) * Math.sin(turn), -R * radius(angle) * Math.cos(turn));
}

/** The dot's stretch as ClockChart.ActiveDot reads it: the radius and the slope over ±STRETCH_SPAN. */
function stretch(angle: number): number {
  const slope =
    (radius(angle + STRETCH_SPAN) - radius(angle - STRETCH_SPAN)) / ((2 * STRETCH_SPAN * Math.PI) / 180);
  return Math.hypot(radius(angle), slope);
}

/** Frames the test runs one at a time, 1000/60 ms apart. */
function handFrames(): MotionHost & { readonly step: () => boolean } {
  let time = 0;
  let queued: ((time: number) => void) | null = null;
  return {
    now: () => time,
    requestFrame: (callback) => {
      queued = callback;
      return 1;
    },
    cancelFrame: () => {
      queued = null;
    },
    step: () => {
      const run = queued;
      if (run === null) return false;
      queued = null;
      time += 1000 / 60;
      run(time);
      return true;
    },
  };
}

describe("the follower's pace on a curve steepest between a frame's two ends", () => {
  it.each([28, 28.25, 28.5, 28.75, 29])(
    "carries the dot no further in any frame than the pace carries the rim, from %s°",
    (start) => {
      const frames = handFrames();
      const follow = createPolarFollow({
        frames,
        reduced: () => false,
        // A stiff, critically damped spring wants more than the pace in every frame, so the cap turns each one.
        spring: () => ({ stiffness: 5000, damping: 141 }),
        leapSpring: () => ({ stiffness: 5000, damping: 141 }),
        maxTurn: () => PACE,
      });
      follow.measure(R);
      follow.stretch(stretch);
      const shown: number[] = [];
      follow.subscribe((angle) => shown.push(angle));
      // The first angle snaps; a 6° step then glides over the slot with a floor of 6/12 = 0.5° a frame,
      // under the 4 / (2.46 × 1.05) = 1.55° the steepest stretch allows, so the pace decides.
      follow.retarget(start, "step");
      follow.retarget(start + 6, "step");
      for (let frame = 0; frame < 120 && frames.step(); frame += 1);
      expect(shown.at(-1)).toBe(start + 6);
      // At 2° on a 100 px dial the rim travels 3.49 px a frame.
      const pace = (R * PACE * Math.PI) / 180;
      const travel = shown.slice(1).map((angle, index) => {
        const from = dotAt(shown[index] ?? angle);
        const to = dotAt(angle);
        return Math.hypot(to.x - from.x, to.y - from.y);
      });
      expect(travel.filter((step) => step > pace + 1e-9)).toEqual([]);
      // The glide crossed the slot's steepest middle, 31.875°, in a frame of its own.
      expect(
        shown.some((angle, index) => index > 0 && (shown[index - 1] ?? angle) < 31.875 && angle > 31.875)
      ).toBe(true);
    }
  );
});

// The follower under steps that outrun it, on frames the test steps by hand. Unit under test:
// createPolarFollow's retarget, which unwraps each step against the target it already chases and
// drops whole turns of lag. Oracle: the angles worked by hand below, with the hand held at 0° while
// the pointer whirls ahead, as no frame runs between the steps.
describe("the follower behind a pointer that outruns it", () => {
  function behind() {
    const frames = handFrames();
    const follow = createPolarFollow({
      frames,
      reduced: () => false,
      spring: () => ({ stiffness: 5000, damping: 141 }),
      leapSpring: () => ({ stiffness: 5000, damping: 141 }),
      maxTurn: () => 4,
    });
    follow.measure(R);
    const shown: number[] = [];
    follow.subscribe((angle) => shown.push(angle));
    follow.retarget(0, "commit");
    return { follow, frames, shown };
  }

  it("keeps turning the pointer's way once the pointer leads by more than half a turn", () => {
    const { follow, frames, shown } = behind();
    // The pointer steps 90°, 180° and 270° ahead while the hand still shows 0°. Against the chased
    // target the steps unwrap to 90°, 180° and 270°; against the shown 0°, 270° would be -90°.
    follow.retarget(90, "step");
    follow.retarget(180, "step");
    follow.retarget(270, "step");
    for (let frame = 0; frame < 120 && frames.step(); frame += 1);
    expect(shown.at(-1)).toBe(270);
    const turned = shown.slice(1).map((angle, index) => angle - (shown[index] ?? angle));
    expect(turned.filter((turn) => turn < 0)).toEqual([]);
  });

  it("takes the short way from the angle shown on a step half a turn from the target it chases", () => {
    const { follow, frames, shown } = behind();
    // A half-turn step spans 180°, past the near leap's 90°, so its floor of 180 / 10 = 18° a frame
    // outruns the 4° pace: three frames show 18°, 36° and 54°.
    follow.retarget(180, "step");
    for (let frame = 0; frame < 3; frame += 1) frames.step();
    expect(shown.slice(1)).toEqual([18, 36, 54]);
    // Back to 0°, half a turn from the chased 180° either way, as a pointer through the centre
    // steps: it takes the short way from the shown 54°, back to 0°, not on round to 360°.
    const from = shown.length;
    follow.retarget(0, "step");
    for (let frame = 0; frame < 120 && frames.step(); frame += 1);
    expect(shown.at(-1)).toBe(0);
    expect(shown.slice(from).filter((angle) => angle > 54)).toEqual([]);
  });

  it("drops a whole turn of lag, and turns only the rest of the way", () => {
    const { follow, frames, shown } = behind();
    // 90°, 180° and 270° unwrap as above, 0° to 360°, a whole turn ahead of the shown 0°, so the
    // shown angle drops to 360°; then 90° unwraps to 450°, a quarter turn on.
    for (const angle of [90, 180, 270, 0, 90]) follow.retarget(angle, "step");
    for (let frame = 0; frame < 120 && frames.step(); frame += 1);
    expect(shown.at(-1)).toBe(450);
    // The snapped 0° aside, every shown angle lies in the last quarter turn, from 360° to 450°.
    expect(shown.slice(1).filter((angle) => angle <= 360 || angle > 450)).toEqual([]);
  });
});

// A pointer swinging through the dial's centre. Unit under test: the follower's step on an even
// count, where crossing the centre lands half a turn from the target it chases. Oracle: a pointer
// swinging along one line asks for at most half a turn at a time, so the hand never turns more
// than half a turn and a slot one way.
describe("the follower under a pointer swinging through the centre", () => {
  function Hours(): ReactElement {
    return (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={Array.from({ length: 24 }, (_, hour) => ({
              start: DAY + hour * 3_600_000,
              kwh: 1 + (hour % 4),
            }))}
            config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
            xKey="start"
            cycle="day"
            interval="hour"
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Grid />
            <ClockChart.Line dataKey="kwh" />
            <ClockChart.Scrubber />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("never turns the hand more than 190° one way over three round trips through the centre at 2,000 px/s", async () => {
    const { host } = renderThemed(<Hours />);
    await nextFrames(20);
    const layer = clockLayer(host, "clock-chart-line");
    const [cx, cy] = clientPoint(layer, 0, 0);
    const [rx] = clientPoint(layer, 1, 0);
    const radius = rx - cx;
    // DOM audit: the Scrubber's hand is aria-hidden plot output, read by its part.
    const hand = host.querySelector<SVGGElement>('[data-slot="clock-chart-scrubber"] [data-part="hand"]');
    if (hand === null) throw new Error("no hand");
    const listbox = page.getByRole("listbox").element();
    // The 97.5° to 277.5° diameter, from 0.9 R through the exact centre to 0.9 R and back.
    const along = (97.5 * Math.PI) / 180;
    const ux = Math.sin(along);
    const uy = -Math.cos(along);
    const move = (offset: number) =>
      listbox.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: cx + offset * ux,
          clientY: cy + offset * uy,
          pointerType: "mouse",
        })
      );
    const leg = 1.8 * radius;
    move(0.9 * radius);
    await nextFrames(20);
    const start = await nextFrame();
    let unwrapped: number | null = null;
    const hands: number[] = [];
    for (;;) {
      const now = await nextFrame();
      const travelled = (2000 * (now - start)) / 1000;
      if (travelled > 6 * leg) break;
      const into = travelled % (2 * leg);
      move(0.9 * radius - (into < leg ? into : 2 * leg - into));
      const raw = Number.parseFloat(getComputedStyle(hand).rotate);
      unwrapped = unwrapped === null ? raw : unwrapped + ((((raw - unwrapped) % 360) + 540) % 360) - 180;
      hands.push(unwrapped);
    }
    let left = 30;
    const tail = await recordFrames(
      () => Number.parseFloat(getComputedStyle(hand).rotate),
      () => (left -= 1) === 0,
      Number.POSITIVE_INFINITY
    );
    for (const raw of tail) {
      unwrapped = unwrapped === null ? raw : unwrapped + ((((raw - unwrapped) % 360) + 540) % 360) - 180;
      hands.push(unwrapped);
    }
    // The longest one-way run of the hand, summing frames that turn the same way.
    let run = 0;
    let longest = 0;
    hands.slice(1).forEach((angle, index) => {
      const turn = angle - (hands[index] ?? angle);
      if (Math.abs(turn) < 0.01) return;
      run = Math.sign(turn) === Math.sign(run) ? run + turn : turn;
      longest = Math.max(longest, Math.abs(run));
    });
    expect(hands.length).toBeGreaterThan(20);
    expect(longest).toBeLessThanOrEqual(190);
  });
});
