// The clock's angle follower under a moving pointer, in Chromium with motion on. Units under test:
// ClockChart.ActiveDot and ClockChart.Scrubber on the Root's follower (MOTION-REVIEW Fix R1).
// Oracles: the Line's own rendered path, sampled at 4,000 points along its length and mapped to the
// screen by its own CTM, on which the dot must lie in every frame of a glide; the dot's angle about
// the dial's rendered centre, which the Scrubber's computed rotation must match; and the dot's own
// last frame step, which a second step 80 ms into a glide may not exceed by more than half (R1.6 to
// R1.8). The day is solar-shaped: 96 quarter-hours, near zero at night and a sine over the day.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { clockLayer } from "../../../test/chart/clock";
import { clientPoint, dialPoint, hoverAt } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
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

/** Each animation frame's reading for `ms`. */
async function frames(read: () => Frame, ms: number): Promise<Frame[]> {
  const seen: Frame[] = [];
  const start = performance.now();
  while (performance.now() - start < ms) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    seen.push(read());
  }
  return seen;
}

describe("the clock's active dot on the Root's follower (R1)", () => {
  it.each([1, 5, 47])(
    "keeps the dot on the Line and the Scrubber on the dot through a %s-slot pointer step",
    async (step) => {
      const { host } = renderThemed(<Solar />);
      const { curve, centre, at, read } = setup(host);
      await hoverAt(...at(30));
      await frames(read, 300);
      await hoverAt(...at(30 + step));
      const seen = await frames(read, 700);
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
    await frames(read, 300);
    await hoverAt(...at(35));
    const first = await frames(read, 80);
    moveTo(...at(40));
    const [next] = await frames(read, 1);
    const travel = (a: Frame | undefined, b: Frame | undefined): number =>
      a?.dot == null || b?.dot == null ? 0 : Math.hypot(b.dot.x - a.dot.x, b.dot.y - a.dot.y);
    const before = travel(first.at(-2), first.at(-1));
    const after = travel(first.at(-1), next);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(1.5 * before);
  });
});
