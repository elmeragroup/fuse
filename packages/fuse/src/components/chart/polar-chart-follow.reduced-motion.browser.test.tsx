// The polar angle follower under the reader's reduced-motion preference, in every engine. Units
// under test: the clock's Scrubber and ActiveDot and the radar's hand and ActiveDot on the Root's
// follower (MOTION-REVIEW R1.12). Oracle, written by hand: under reduced motion a pointer step puts
// the hand and the dot on the new slot at once, so the hand reads the slot's middle, 15i + 7.5° of a
// 24-hour day or 90i° of four spokes, before any frame runs, no animation plays, and the follower
// asks for no frame.
import type { ReactElement } from "react";

import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import type { FrameClock } from "../../../test/chart/frame-clock";
import { clientPoint, dialPoint, hoverAt } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";

const DAY = Date.parse("2025-10-24T22:00:00Z");

let clock: FrameClock | null = null;
afterEach(() => {
  clock?.restore();
  clock = null;
});

const CASES: readonly (readonly [string, ReactElement, string, string, number, (slot: number) => number])[] =
  [
    [
      "a clock",
      <ClockChart.Root
        key="clock"
        data={Array.from({ length: 24 }, (_, hour) => ({
          start: DAY + hour * 3_600_000,
          kwh: 1 + (hour % 4),
        }))}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        aria-label="Døgn">
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.Scrubber />
        <ClockChart.ActiveDot dataKey="kwh" />
      </ClockChart.Root>,
      '[data-slot="clock-chart-scrubber"] [data-part="hand"]',
      "clock-chart-active-dot",
      24,
      (slot) => 15 * slot + 7.5,
    ],
    [
      "a radar",
      <RadarChart.Root
        key="radar"
        data={[4, 2, 3, 1].map((a, index) => ({ spoke: `s${String(index)}`, a }))}
        config={{ a: { label: "NO1", color: "chart-1" } }}
        nameKey="spoke"
        aria-label="Radar">
        <RadarChart.Grid />
        <RadarChart.Line dataKey="a" />
        <RadarChart.ActiveDot dataKey="a" />
      </RadarChart.Root>,
      '[data-slot="radar-chart-spoke"][data-part="hand"]',
      "radar-chart-active-dot",
      4,
      (slot) => 90 * slot,
    ],
  ];

it.each(CASES)(
  "rests %s's hand and dot on a pointer step at once",
  async (_, chart, handSlot, dotSlot, count, angleOf) => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>{chart}</div>
      </LocaleProvider>
    );
    // DOM audit: the hand and the dot layer are aria-hidden plot output, read by their slots.
    const hand = host.querySelector<SVGElement>(handSlot);
    const layer = host.querySelector<SVGSVGElement>(`[data-slot="${dotSlot}"]`);
    if (hand === null || layer === null) throw new Error("no parts");
    const at = (slot: number) => {
      const point = dialPoint(angleOf(slot) + 1, 0.7);
      return clientPoint(layer, point.x, point.y);
    };
    await hoverAt(...at(0));
    clock = installFrameClock(performance.now());
    const target = Math.floor(count / 2) + 1;
    page
      .getByRole("listbox")
      .element()
      .dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: at(target)[0],
          clientY: at(target)[1],
          pointerType: "mouse",
        })
      );
    const turned = Number.parseFloat(getComputedStyle(hand).rotate);
    expect((((turned - angleOf(target)) % 360) + 360) % 360).toBeCloseTo(0, 6);
    const moving = host
      .getAnimations({ subtree: true })
      .filter(
        (animation) => !(animation instanceof CSSTransition && animation.transitionProperty === "opacity")
      );
    expect(moving).toHaveLength(0);
    expect(clock.pending()).toBe(false);
    // DOM audit: the dot's group shows its reading by data-value.
    expect(layer.querySelector("[data-follow]")?.hasAttribute("data-value")).toBe(true);
  }
);
