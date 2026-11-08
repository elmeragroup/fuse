// A polar Root's entrance while its chart waits below the fold, in Chromium with motion on, on a
// hand-driven frame clock. Units under test: the polar Root's loop and its marks' commits. Oracles,
// worked by hand: the clock's reveal wedge reads "M0,0Z" at the entrance's start and "" once whole;
// the pie's first slice, energi's 412 of 834 kr, spans 0° at the entrance's start and 177.8° at
// rest, or 115.7° once it reads 268 of 834 kr. A 200vh spacer keeps each chart out of view until
// the test scrolls to it.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import type { FrameClock } from "../../../test/chart/frame-clock";
import { outerArc, polarFigure, sectors } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";

const HOURS = Array.from({ length: 24 }, (_, slot) => ({
  start: Date.UTC(2025, 9, 24, 22) + slot * 3_600_000,
  kwh: 1 + (slot % 4),
}));

/** Each hour one kWh higher, a commit the classifier calls a move. */
const HIGHER = HOURS.map((row) => ({ ...row, kwh: row.kwh + 1 }));

const BILL = [
  { part: "energi", kr: 412 },
  { part: "nettleie", kr: 268 },
  { part: "avgift", kr: 154 },
];

/** The bill with energi and nettleie swapped. */
const SWAPPED = [
  { part: "energi", kr: 268 },
  { part: "nettleie", kr: 412 },
  { part: "avgift", kr: 154 },
];

function BelowTheFold({ children }: { readonly children: ReactNode }) {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ paddingTop: "200vh", width: 320 }}>{children}</div>
    </LocaleProvider>
  );
}

function Clock({ data }: { readonly data: typeof HOURS }) {
  return (
    <BelowTheFold>
      <ClockChart.Root
        data={data}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        aria-label="Døgn">
        <ClockChart.Column dataKey="kwh" />
      </ClockChart.Root>
    </BelowTheFold>
  );
}

function Pie({ data }: { readonly data: typeof BILL }) {
  return (
    <BelowTheFold>
      <PieChart.Root
        data={data}
        config={{
          energi: { label: "Energi", color: "chart-1" },
          nettleie: { label: "Nettleie", color: "chart-2" },
          avgift: { label: "Avgift", color: "chart-3" },
        }}
        nameKey="part"
        valueKey="kr"
        aria-label="Regning">
        <PieChart.Pie />
      </PieChart.Root>
    </BelowTheFold>
  );
}

/** The clock's reveal wedge as path data. */
function reveal(host: HTMLElement): string {
  // DOM audit: the reveal clip is aria-hidden plot output, so its part is the only locator.
  const path = host.querySelector('[data-part="reveal"]');
  if (path === null) throw new Error("no reveal");
  return path.getAttribute("d") ?? "";
}

/** The pie's first slice's span in degrees, 0 with no arc. */
function firstSpan(host: HTMLElement): number {
  const arc = outerArc(sectors(host)[0]?.getAttribute("d") ?? "");
  return arc === null ? 0 : arc[1] - arc[0];
}

/** Run 3 s of frames, 100 ms apart, while the chart stays below the fold, and read each one. */
function waitOffScreen<T>(clock: FrameClock, read: () => T): T[] {
  const start = clock.now();
  const seen: T[] = [];
  for (let t = 100; t <= 3000; t += 100) {
    clock.frameAt(start + t);
    seen.push(read());
  }
  return seen;
}

/**
 * Scroll the chart into view, run frames until its entrance starts, then 2 s of frames 16 ms apart.
 *
 * @returns The reading as the entrance starts, before its first frame, and at every frame after.
 */
async function playInView<T>(clock: FrameClock, host: HTMLElement, read: () => T): Promise<T[]> {
  const figure = polarFigure(host);
  figure.scrollIntoView();
  await expect
    .poll(() => {
      clock.frameAt(clock.now());
      return figure.hasAttribute("data-drawn");
    })
    .toBe(true);
  const seen = [read()];
  const start = clock.now();
  for (let t = 16; t <= 2000; t += 16) {
    clock.frameAt(start + t);
    seen.push(read());
  }
  return seen;
}

describe("a polar entrance below the fold", () => {
  it("holds the clock's reveal shut while it waits, then opens it from its start in view", async () => {
    const clock = installFrameClock();
    try {
      const { host } = renderThemed(<Clock data={HOURS} />);
      expect(polarFigure(host).getAttribute("data-entrance")).toBe("waiting");
      expect(reveal(host)).toBe("M0,0Z");
      expect(new Set(waitOffScreen(clock, () => reveal(host)))).toEqual(new Set(["M0,0Z"]));
      const played = await playInView(clock, host, () => reveal(host));
      expect(played[0]).toBe("M0,0Z");
      // The wedge opened through the frames between its start and its rest.
      expect(played.some((d) => d !== "M0,0Z" && d !== "")).toBe(true);
      expect(played.at(-1)).toBe("");
    } finally {
      clock.restore();
    }
  });

  it("holds the pie's slices at zero width while it waits, then grows them from there in view", async () => {
    const clock = installFrameClock();
    try {
      const { host } = renderThemed(<Pie data={BILL} />);
      // The pie draws its first placements in a microtask after the commit.
      await Promise.resolve();
      expect(polarFigure(host).getAttribute("data-entrance")).toBe("waiting");
      expect(firstSpan(host)).toBe(0);
      expect(waitOffScreen(clock, () => firstSpan(host)).every((span) => span === 0)).toBe(true);
      const played = await playInView(clock, host, () => firstSpan(host));
      expect(played[0]).toBe(0);
      expect(played.some((span) => span > 0 && span < 177)).toBe(true);
      expect(played.at(-1)).toBeCloseTo(177.8, 0);
    } finally {
      clock.restore();
    }
  });
});

describe("a data update while a polar entrance waits", () => {
  it("keeps the clock's reveal shut, then opens it from its start in view", async () => {
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(<Clock data={HOURS} />);
      waitOffScreen(clock, () => reveal(host));
      rerender(<Clock data={HIGHER} />);
      expect(reveal(host)).toBe("M0,0Z");
      expect(new Set(waitOffScreen(clock, () => reveal(host)))).toEqual(new Set(["M0,0Z"]));
      const played = await playInView(clock, host, () => reveal(host));
      expect(played[0]).toBe("M0,0Z");
      expect(played.some((d) => d !== "M0,0Z" && d !== "")).toBe(true);
      expect(played.at(-1)).toBe("");
    } finally {
      clock.restore();
    }
  });

  it("keeps the pie's slices at zero width, then grows them to the new data in view", async () => {
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(<Pie data={BILL} />);
      await Promise.resolve();
      waitOffScreen(clock, () => firstSpan(host));
      rerender(<Pie data={SWAPPED} />);
      await Promise.resolve();
      expect(firstSpan(host)).toBe(0);
      expect(waitOffScreen(clock, () => firstSpan(host)).every((span) => span === 0)).toBe(true);
      const played = await playInView(clock, host, () => firstSpan(host));
      expect(played[0]).toBe(0);
      expect(played.some((span) => span > 0 && span < 115)).toBe(true);
      expect(played.at(-1)).toBeCloseTo(115.7, 0);
    } finally {
      clock.restore();
    }
  });
});
