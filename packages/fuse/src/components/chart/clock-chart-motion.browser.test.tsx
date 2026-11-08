// ClockChart's motion against SPEC's Motion table, in Chromium with motion on. Units under test:
// the clock's series marks on the Root's loop, ActiveDot on its series' tween and the Scrubber's turn. Oracles,
// written by hand from the Motion table: one 1,250 ms progress opens the wedge over 750 ms, and slot
// i of 24, whose start lies at 15i°, rises from its base over 500 ms on an ease-out cubic from
// 31.25 · i ms, so it reads base + (tip − base)(1 − (1 − t)³) with t = (ms − 31.25 i) / 500; an
// update moves each radius over 480 ms; a switch from the 24- to the 25-hour day turns each hour to
// its new angle, so 06:00 runs from 90° to 100.8° and never cuts a chord; and a key step turns the
// Scrubber the short way on the keyboard's follow spring, FOLLOW_FASTEST 5300/126, at rest within
// 0.01° by about 127 ms. The entrance runs on a hand-driven frame clock,
// read on the loop's own time; the rest read each frame's own timestamp.
import { Suspense, use, useLayoutEffect, useState } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { angleOf, clockLayer, clockPath, dotPoints } from "../../../test/chart/clock";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import slots from "./format/fixtures/slots.json" with { type: "json" };

/** Half a frame and more either side of a scheduled time, for the frame that straddles it. */
const SLACK = 34;

/** One reading's step on the frame clock, the entrance's tolerance either side of its schedule. */
const STEP = 10;

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
    const clock = installFrameClock();
    const frames: { readonly t: number; readonly dots: readonly { readonly radius: number }[] }[] = [];
    try {
      const { host } = renderThemed(<Dial />);
      const figure = polarFigure(host);
      // The clock stands still while the chart waits to come into view, so whichever frame the
      // entrance starts on runs at the same instant, the loop's t = 0.
      const start = clock.now();
      await expect
        .poll(() => {
          clock.frameAt(start);
          return figure.hasAttribute("data-drawn");
        })
        .toBe(true);
      for (let t = 0; t <= 1400; t += 10) {
        clock.frameAt(start + t);
        const dots = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
        frames.push({ t, dots: dots.map(({ x, y }) => ({ radius: Math.hypot(x, y) })) });
      }
    } finally {
      clock.restore();
    }
    // The domain is [0, 4] and every reading 4, so each dot rises from the hole's 0.3 to the rim.
    // The loop's time is exact, so a reading sits within one 10 ms step of its schedule.
    for (const slot of [0, 6, 12, 23]) {
      for (const { t, dots } of frames) {
        const radius = dots[slot]?.radius ?? 0;
        const low = 0.3 + 0.7 * risen(slot, t - STEP);
        const high = 0.3 + 0.7 * risen(slot, t + STEP);
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

describe("a change of slot count mid-tween (A1-07)", () => {
  it("turns the dial from what it draws, so 00:00's dot never jumps on the switch", async () => {
    // 00:00 falls from the rim toward √0.545 over 480 ms. About 100 ms in, the 24-hour day gives
    // way to the 25-hour one with the same readings, whose 00:00 pairs with the old 00:00. The
    // route starts where the dot is drawn, so the first frame after the switch lies within one
    // frame's travel of the last frame before it: the whole fall is 0.26, and no 16 ms frame of an
    // ease-out over 480 ms covers a sixth of it.
    const { host, rerender } = renderThemed(<Dial intro="none" value={() => 4} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Dial intro="none" value={() => 2} />);
    const midnight = () => {
      const [dot] = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
      return Math.hypot(dot?.x ?? 0, dot?.y ?? 0);
    };
    const start = performance.now();
    while (performance.now() - start < 100) await new Promise((resolve) => requestAnimationFrame(resolve));
    const before = midnight();
    expect(before).toBeGreaterThan(Math.sqrt(0.545) + 0.05);
    rerender(<Dial intro="none" starts={OCT_26} value={() => 2} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(Math.abs(midnight() - before)).toBeLessThan(0.26 / 6);
  });
});

describe("a render that changes nothing (A1-13)", () => {
  it("leaves an entrance that waits to come into view waiting, to play once it does", async () => {
    // The Motion table: slot 23 of 24 rises from the hole's 0.3 only from 31.25 · 23 ≈ 719 ms, so
    // in the entrance's first frames it sits at the hole. A render that changes neither the data
    // nor any part's props places nothing, so it never snaps the waiting marks to rest.
    const rows = OCT_25.map((start) => ({ start, kwh: 4 }));
    const config = { kwh: { label: "kWh", color: "chart-1" } } as const;
    const chart = () => (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ paddingTop: "200vh", width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={config}
            xKey="start"
            cycle="day"
            interval="hour"
            yInclude={[4]}
            aria-label="Døgn">
            <ClockChart.Dots dataKey="kwh" />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(chart());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const figure = polarFigure(host);
    figure.scrollIntoView();
    await expect.poll(() => figure.hasAttribute("data-drawn")).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dots = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
    expect(dots).toHaveLength(24);
    const last = dots[23];
    expect(Math.hypot(last?.x ?? 1, last?.y ?? 1)).toBeLessThan(0.5);
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
  it("keeps the active dot on its slot's dot in every frame as an update moves the radius", async () => {
    const { host, rerender } = renderThemed(
      <Dial intro="none" value={() => 4}>
        <ClockChart.ActiveDot dataKey="kwh" />
      </Dial>
    );
    await userEvent.tab();
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    rerender(
      <Dial intro="none" value={() => 2}>
        <ClockChart.ActiveDot dataKey="kwh" />
      </Dial>
    );
    const dot = clockLayer(host, "clock-chart-active-dot");
    const seen: { readonly dot: number; readonly slot: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const [point] = dotPoints(clockPath(dot, "dots"));
      const [own] = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
      if (point !== undefined && own !== undefined)
        seen.push({ dot: Math.hypot(point.x, point.y), slot: Math.hypot(own.x, own.y) });
    }
    // Slot 0's radius moves from the rim to √0.545, and the active dot reads the same in every frame.
    expect(seen.some(({ slot }) => slot > Math.sqrt(0.545) + 0.05 && slot < 0.95)).toBe(true);
    for (const frame of seen) expect(Math.abs(frame.dot - frame.slot)).toBeLessThan(0.002);
  });

  it("shows a Marker's ValueLabel only while its dot rests, as an update moves the radius (A1-05)", async () => {
    // The pill sits past the dot's rest, so in no frame may it show while the dot is elsewhere.
    // Slot 0's radius moves from the rim to √0.545 over 480 ms; the pill shows again once it rests.
    const dial = (value: number) => (
      <Dial intro="none" value={() => value}>
        <ClockChart.Marker dataKey="kwh" at="first">
          <ClockChart.ValueLabel />
        </ClockChart.Marker>
      </Dial>
    );
    const { host, rerender } = renderThemed(dial(4));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: the marker's dot and its pill are aria-hidden plot output, read by their slots.
    const pill = () => host.querySelector<HTMLElement>('[data-slot="clock-chart-value-label"]');
    expect(pill()?.checkVisibility({ visibilityProperty: true })).toBe(true);
    rerender(dial(2));
    const marker = clockLayer(host, "clock-chart-marker");
    const seen: { readonly radius: number; readonly shown: boolean }[] = [];
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const [point] = dotPoints(clockPath(marker, "dots"));
      if (point !== undefined)
        seen.push({
          radius: Math.hypot(point.x, point.y),
          shown: pill()?.checkVisibility({ visibilityProperty: true }) ?? false,
        });
    }
    const rest = Math.sqrt(0.545);
    // The dot travels: some frame draws it between the rim and its rest.
    expect(seen.some(({ radius }) => radius > rest + 0.05 && radius < 0.95)).toBe(true);
    for (const { radius, shown } of seen) if (shown) expect(radius).toBeCloseTo(rest, 3);
    expect(seen.at(-1)?.shown).toBe(true);
  });

  it("keeps a still Marker's ValueLabel shown while another Marker's dot moves (A2-02)", async () => {
    // Only slot 0 changes, so the last slot's dot never leaves its rest and its pill never hides.
    const dial = (first: number) => (
      <Dial intro="none" value={(slot) => (slot === 0 ? first : 4)}>
        <ClockChart.Marker dataKey="kwh" at="first">
          <ClockChart.ValueLabel />
        </ClockChart.Marker>
        <ClockChart.Marker dataKey="kwh" at="last">
          <ClockChart.ValueLabel />
        </ClockChart.Marker>
      </Dial>
    );
    const { host, rerender } = renderThemed(dial(4));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: the markers' pills are aria-hidden plot output, read by their slots.
    const pills = () => [...host.querySelectorAll<HTMLElement>('[data-slot="clock-chart-value-label"]')];
    expect(pills().map((pill) => pill.checkVisibility({ visibilityProperty: true }))).toEqual([true, true]);
    rerender(dial(2));
    const seen: { readonly first: boolean; readonly last: boolean }[] = [];
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const [first, last] = pills().map((pill) => pill.checkVisibility({ visibilityProperty: true }));
      seen.push({ first: first ?? false, last: last ?? false });
    }
    // The first Marker's pill hides for its tween, and the last one's shows in every frame.
    expect(seen.some(({ first }) => !first)).toBe(true);
    for (const { last } of seen) expect(last).toBe(true);
  });

  it("hides a ValueLabel that mounts while its Marker's entrance waits to come into view (A3-01)", async () => {
    // The entrance's placement draws the marker's dot at its start, and the frame clock runs no
    // frame after it, so the pill, which sits past the dot's rest, hides from the moment it mounts
    // and shows once the entrance has played. The label mounts from a child's own state, so nothing
    // but that child renders again.
    let mount = (): void => undefined;
    function Late() {
      const [shown, setShown] = useState(false);
      useLayoutEffect(() => {
        mount = () => {
          setShown(true);
        };
      }, []);
      return shown ? <ClockChart.ValueLabel /> : null;
    }
    const clock = installFrameClock();
    try {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ paddingTop: "200vh", width: 320 }}>
            <ClockChart.Root
              data={OCT_25.map((start) => ({ start, kwh: 4 }))}
              config={{ kwh: { label: "kWh", color: "chart-1" } }}
              xKey="start"
              cycle="day"
              interval="hour"
              yInclude={[4]}
              aria-label="Døgn">
              <ClockChart.Marker dataKey="kwh" at="first">
                <Late />
              </ClockChart.Marker>
            </ClockChart.Root>
          </div>
        </LocaleProvider>
      );
      const figure = polarFigure(host);
      expect(figure.getAttribute("data-entrance")).toBe("waiting");
      mount();
      // DOM audit: the marker's pill is aria-hidden plot output, read by its slot.
      const pill = () => host.querySelector<HTMLElement>('[data-slot="clock-chart-value-label"]');
      await expect.poll(pill).not.toBeNull();
      expect(pill()?.checkVisibility({ visibilityProperty: true })).toBe(false);
      figure.scrollIntoView();
      await expect
        .poll(() => {
          clock.frameAt(clock.now() + 100);
          return pill()?.checkVisibility({ visibilityProperty: true });
        })
        .toBe(true);
    } finally {
      clock.restore();
    }
  });

  it("shows a ValueLabel that Suspense hid mid-tween once it returns after the dot rests (A3-01)", async () => {
    // Suspense hides the label's subtree while slot 0's dot moves, and reveals it once the dot
    // has rested; the pill then sits beside a resting dot, so it shows. The gate suspends and
    // resumes from its own state, so the Marker never renders again for either.
    const never = new Promise<never>(() => undefined);
    let setHold = (_hold: boolean): void => undefined;
    function Gate({ children }: { readonly children: React.ReactNode }) {
      const [hold, set] = useState(false);
      useLayoutEffect(() => {
        setHold = set;
      }, []);
      if (hold) use(never);
      return children;
    }
    const dial = (value: number) => (
      <Dial intro="none" value={() => value}>
        <ClockChart.Marker dataKey="kwh" at="first">
          <Suspense fallback={null}>
            <Gate>
              <ClockChart.ValueLabel />
            </Gate>
          </Suspense>
        </ClockChart.Marker>
      </Dial>
    );
    const { host, rerender } = renderThemed(dial(4));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: the marker's pill is aria-hidden plot output, read by its slot.
    const pill = () => host.querySelector<HTMLElement>('[data-slot="clock-chart-value-label"]');
    rerender(dial(2));
    await expect.poll(() => pill()?.checkVisibility({ visibilityProperty: true })).toBe(false);
    setHold(true);
    await expect.poll(() => pill()?.checkVisibility()).toBe(false);
    const start = performance.now();
    while (performance.now() - start < 700) await new Promise((resolve) => requestAnimationFrame(resolve));
    setHold(false);
    await expect.poll(() => pill()?.checkVisibility()).toBe(true);
    expect(pill()?.checkVisibility({ visibilityProperty: true })).toBe(true);
  });

  it("draws a Marker switched to ping on its dot at the reading it rests on (A2-01)", async () => {
    // The update moves slot 0's dot to √0.545; the ping that mounts afterwards rings that dot.
    // The data keeps its identity across the switch, so the variant is the only change.
    const four = OCT_25.map((start) => ({ start, kwh: 4 }));
    const two = OCT_25.map((start) => ({ start, kwh: 2 }));
    const dial = (data: typeof four, variant: "default" | "ping") => (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={data}
            config={{ kwh: { label: "kWh", color: "chart-1" } }}
            xKey="start"
            cycle="day"
            interval="hour"
            yInclude={[4]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Marker dataKey="kwh" at="first" variant={variant} />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(dial(four, "default"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(dial(two, "default"));
    const start = performance.now();
    while (performance.now() - start < 700) await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(dial(two, "ping"));
    const marker = clockLayer(host, "clock-chart-marker");
    const [dot] = dotPoints(clockPath(marker, "dots"));
    expect(Math.hypot(dot?.x ?? 0, dot?.y ?? 0)).toBeCloseTo(Math.sqrt(0.545), 3);
    expect(clockPath(marker, "ping")).toBe(clockPath(marker, "dots"));
  });

  it("turns the Scrubber the short way round, at rest by the keyboard spring's settle", async () => {
    const { host } = renderThemed(
      <Dial intro="none">
        <ClockChart.Scrubber />
      </Dial>
    );
    await userEvent.tab();
    // DOM audit: the Scrubber's hand is its part "hand".
    const hand = host.querySelector<SVGGElement>('[data-slot="clock-chart-scrubber"] [data-part="hand"]');
    if (hand === null) throw new Error("no hand");
    await userEvent.keyboard("{ArrowLeft}");
    const turns: { readonly t: number; readonly angle: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 400) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      turns.push({ t: now - start, angle: Number.parseFloat(getComputedStyle(hand).rotate) });
    }
    // Slot 0's middle at 7.5° to slot 23's at 352.5° is 15° back, not 345° forward: no frame turns
    // past 7.5°, and none overshoots −7.5° by more than FOLLOW_FASTEST's 0.44 % of 15°.
    for (const { angle } of turns) {
      expect(angle).toBeLessThanOrEqual(7.5001);
      expect(angle).toBeGreaterThanOrEqual(-7.5 - 0.07);
    }
    // ζω = 63 per second, so 15° · e^(−63 t) / √(1 − ζ²) is under 0.01° by 127 ms.
    for (const { t, angle } of turns) if (t > 200) expect(angle).toBeCloseTo(-7.5, 2);
  });
});
