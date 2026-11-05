// ClockChart's motion against SPEC's Motion table, in Chromium with motion on. Units under test:
// the clock's series marks on the Root's loop, ActiveDot's ride and the Scrubber's turn. Oracles,
// written by hand from the Motion table: one 1,250 ms progress opens the wedge over 750 ms, and slot
// i of 24, whose start lies at 15i°, rises from its base over 500 ms on an ease-out cubic from
// 31.25 · i ms, so it reads base + (tip − base)(1 − (1 − t)³) with t = (ms − 31.25 i) / 500; an
// update moves each radius over 480 ms; a switch from the 24- to the 25-hour day turns each hour to
// its new angle, so 06:00 runs from 90° to 100.8° and never cuts a chord; the active dot rides the
// drawn curve on the follow spring, ln 2000 / 15 ≈ 507 ms for a key step; and the Scrubber turns the
// short way on 420/42, settling by about 483 ms. Time is read from each frame's own timestamp.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { angleOf, clockLayer, clockPath, dotPoints } from "../../../test/chart/clock";
import { polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import slots from "./format/fixtures/slots.json" with { type: "json" };

/** Half a frame and more either side of a scheduled time, for the frame that straddles it. */
const SLACK = 34;

const OCT_25 = slots.hour["Europe/Oslo"]["2025-10-25"].utc_start.map((start) => Date.parse(start));
const OCT_26 = slots.hour["Europe/Oslo"]["2025-10-26"].utc_start.map((start) => Date.parse(start));

function Dial({
  starts = OCT_25,
  value = () => 4,
  intro,
  children,
}: {
  readonly starts?: readonly number[];
  readonly value?: (slot: number) => number;
  readonly intro?: "none";
  readonly children?: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={starts.map((start, slot) => ({ start, kwh: value(slot) }))}
          config={{ kwh: { label: "kWh", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          yInclude={[4]}
          data-intro={intro}
          aria-label="Døgn">
          <ClockChart.Dots dataKey="kwh" />
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Each frame's time since a start and each dot's angle and radius, until `until` ms past it. */
async function record(
  host: HTMLElement,
  start: () => number | null,
  until: number
): Promise<
  { readonly t: number; readonly dots: readonly { readonly angle: number; readonly radius: number }[] }[]
> {
  const frames: { t: number; dots: { angle: number; radius: number }[] }[] = [];
  for (;;) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const from = start();
    if (from === null) continue;
    const dots = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0")).map(({ x, y }) => ({
      angle: angleOf(x, y),
      radius: Math.hypot(x, y),
    }));
    frames.push({ t: now - from, dots });
    if (now - from > until) return frames;
  }
}

/** A slot's risen share at a time of the entrance, the Motion table's rise. */
function risen(slot: number, ms: number): number {
  const t = Math.min(1, Math.max(0, (ms - 31.25 * slot) / 500));
  return 1 - (1 - t) ** 3;
}

describe("the clock's entrance (SPEC's Motion table)", () => {
  it("raises slot i from its base over 500 ms from 31.25·i ms, as the wedge reaches it", async () => {
    const { host } = renderThemed(<Dial />);
    const figure = polarFigure(host);
    let from: number | null = null;
    const frames = await record(
      host,
      () => {
        if (from === null && figure.hasAttribute("data-drawn")) from = performance.now();
        return from;
      },
      1400
    );
    // The domain is [0, 4] and every reading 4, so each dot rises from the hole's 0.3 to the rim.
    for (const slot of [0, 6, 12, 23]) {
      for (const { t, dots } of frames) {
        const radius = dots[slot]?.radius ?? 0;
        const low = 0.3 + 0.7 * risen(slot, t - SLACK);
        const high = 0.3 + 0.7 * risen(slot, t + SLACK);
        expect(radius, `slot ${String(slot)} at ${String(Math.round(t))} ms`).toBeGreaterThanOrEqual(
          low - 0.002
        );
        expect(radius, `slot ${String(slot)} at ${String(Math.round(t))} ms`).toBeLessThanOrEqual(
          high + 0.002
        );
      }
    }
    expect(frames.some(({ dots }) => (dots[12]?.radius ?? 0) > 0.4 && (dots[12]?.radius ?? 0) < 0.9)).toBe(
      true
    );
  });
});

describe("the clock's updates", () => {
  it("moves each radius over 480 ms, between its old and its new", async () => {
    const { host, rerender } = renderThemed(<Dial intro="none" value={() => 4} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Dial intro="none" value={() => 2} />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    // 2 of [0, 4] under "radial": √(0.09 + 0.455).
    const after = Math.sqrt(0.545);
    for (const { t, dots } of frames) {
      const radius = dots[3]?.radius ?? 0;
      expect(radius).toBeGreaterThanOrEqual(after - 0.002);
      expect(radius).toBeLessThanOrEqual(1.002);
      if (t > 480 + SLACK) expect(radius).toBeCloseTo(after, 2);
    }
    expect(
      frames.some(({ dots }) => (dots[3]?.radius ?? 0) > after + 0.05 && (dots[3]?.radius ?? 0) < 0.95)
    ).toBe(true);
  });

  it("turns each hour to its new angle when the 24-hour day gives way to the 25-hour one", async () => {
    const { host, rerender } = renderThemed(<Dial intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Dial intro="none" starts={OCT_26} />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    // 06:00 is slot 6 of 24, centred at 97.5°, and slot 7 of 25, centred at 108°.
    const six = frames.map(({ dots }) => dots[7]?.angle ?? 0);
    for (const angle of six) {
      expect(angle).toBeGreaterThanOrEqual(97.5 - 0.1);
      expect(angle).toBeLessThanOrEqual(108 + 0.1);
    }
    expect(six.some((angle) => angle > 98.5 && angle < 107)).toBe(true);
    // Every dot stays on the rim as it turns: the dial rotates, it never cuts a chord.
    for (const { dots } of frames) for (const { radius } of dots) expect(radius).toBeCloseTo(1, 2);
    expect(frames.at(-1)?.dots).toHaveLength(25);
  });
});

describe("the clock's followers (SPEC's Motion table)", () => {
  it("rides the active dot along the drawn curve to the next slot, on the follow spring", async () => {
    const { host } = renderThemed(
      <Dial intro="none" value={(slot) => (slot % 2 === 0 ? 4 : 2)}>
        <ClockChart.ActiveDot dataKey="kwh" />
      </Dial>
    );
    await userEvent.tab();
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    await userEvent.keyboard("{ArrowRight}");
    const dot = clockLayer(host, "clock-chart-active-dot");
    // DOM audit: the dot rides in its follow group, read by data-follow.
    const ride = dot.querySelector("[data-follow]")?.getAnimations()[0];
    const frames = ride?.effect instanceof KeyframeEffect ? ride.effect.getKeyframes() : [];
    // From slot 0 at 7.5° on the rim to slot 1 at 22.5° on √0.545: sampled along the curve, more than
    // a straight line's two points, and every point between the two angles.
    expect(frames.length).toBeGreaterThan(3);
    const duration = Number(ride?.effect?.getComputedTiming().duration);
    expect(duration).toBeGreaterThan(400);
    expect(duration).toBeLessThanOrEqual(507);
  });

  it("turns the Scrubber to the active slot the short way round on 420/42", async () => {
    const { host } = renderThemed(
      <Dial intro="none">
        <ClockChart.Scrubber />
      </Dial>
    );
    await userEvent.tab();
    // DOM audit: the Scrubber's hand is its part "hand".
    const hand = host.querySelector('[data-slot="clock-chart-scrubber"] [data-part="hand"]');
    await userEvent.keyboard("{ArrowLeft}");
    const turn = hand?.getAnimations()[0];
    const frames = turn?.effect instanceof KeyframeEffect ? turn.effect.getKeyframes() : [];
    // Slot 0's middle at 7.5° to slot 23's at 352.5° is 15° back, not 345° forward.
    expect(frames.map((frame) => frame.rotate)).toEqual(["7.5deg", "-7.5deg"]);
    const duration = Number(turn?.effect?.getComputedTiming().duration);
    expect(duration).toBeGreaterThan(400);
    expect(duration).toBeLessThanOrEqual(483);
  });
});
