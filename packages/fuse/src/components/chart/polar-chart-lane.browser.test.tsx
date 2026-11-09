// The polar tooltip's side lanes, in Chromium with motion on. Units under test: the polar tooltip's
// lane anchor over PieChart, RadialChart, RadarChart and ClockChart. Oracles: the rendered boxes of every label past
// the rim and of a title above the chart, which the popup may never overlap; the figure, whose sides
// and top the popup stays inside, and the viewport, which it stays inside below;
// the popup's padding box, which holds every run of its text, so no value is cut, with the active
// ray every 15° round the dial; and the lane rule, which keeps a lane until the ray is 20° into the
// other half, so a pointer that turns from 9 o'clock through 12 to 3 o'clock switches lanes once,
// and one that wiggles 15° either side of 12 o'clock switches none.
import type { ReactElement } from "react";

import { beforeEach, describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { pointerAt, pointerTarget } from "../../../test/chart/marks";
import { clientPoint, dialPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { radarLayer } from "../../../test/chart/radar";
import { glidePointerTo } from "../../../test/pointer-press";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

beforeEach(async () => {
  await page.viewport(1024, 900);
});

const DAY = Date.parse("2025-10-24T22:00:00Z");
const KEYS = Array.from({ length: 24 }, (_, index) => `k${String(index)}`);
const CONFIG: ChartConfig = Object.fromEntries(
  KEYS.map((key) => [key, { label: `Del ${key}`, color: "chart-1" as const }])
);

/** Each family with 24 options, whose active rays lie 15° apart round the dial. */
const FAMILIES: readonly (readonly [string, ReactElement])[] = [
  [
    "a pie of 24 equal slices",
    <PieChart.Root
      key="pie"
      data={KEYS.map((part) => ({ part, kr: 10 }))}
      config={CONFIG}
      nameKey="part"
      valueKey="kr"
      maxSlices={24}
      data-intro="none"
      aria-label="Regning">
      <PieChart.Pie />
      <PieChart.Labels position="outside" />
      <PieChart.Tooltip />
    </PieChart.Root>,
  ],
  [
    "a radial chart of 24 rings ending 15° apart",
    <RadialChart.Root
      key="radial"
      data={KEYS.map((budget, index) => ({ budget, kwh: 15 * (index + 1) }))}
      config={CONFIG}
      nameKey="budget"
      valueKey="kwh"
      max={360}
      data-intro="none"
      aria-label="Budsjett">
      <RadialChart.Track />
      <RadialChart.Bar />
      <RadialChart.Tooltip />
    </RadialChart.Root>,
  ],
  [
    "a radar of 24 spokes",
    <RadarChart.Root
      key="radar"
      data={KEYS.map((spoke, index) => ({ spoke: `T${String(index)}`, NO1: 2 + (index % 3) }))}
      config={{ NO1: { label: "NO1", color: "chart-1" } }}
      nameKey="spoke"
      data-intro="none"
      aria-label="Radar">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.Line dataKey="NO1" />
      <RadarChart.Tooltip />
    </RadarChart.Root>,
  ],
  [
    "a clock of 24 hourly prices in a 560 px box, whose side lanes hold about 140 px and whose values carry a unit and a VAT basis that cannot wrap",
    <div key="price" style={{ width: 560 }}>
      <ClockChart.Root
        data={Array.from({ length: 24 }, (_, hour) => ({
          start: DAY + hour * 3_600_000,
          ore: 30 + (hour % 7) * 4.3,
        }))}
        config={{
          ore: {
            label: "Spotpris",
            color: "chart-1",
            format: {
              preset: "unit-price",
              currency: "NOK",
              minor: true,
              vat: "excluded",
              maximumFractionDigits: 1,
            },
          },
        }}
        xKey="start"
        cycle="day"
        interval="hour"
        data-intro="none"
        aria-label="Spotpris">
        <ClockChart.Grid />
        <ClockChart.AngleAxis />
        <ClockChart.Column dataKey="ore" />
        <ClockChart.Tooltip />
      </ClockChart.Root>
    </div>,
  ],
  [
    "a clock of 24 hours",
    <ClockChart.Root
      key="clock"
      data={Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * 3_600_000, kwh: 1 + (hour % 4) }))}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="start"
      cycle="day"
      interval="hour"
      data-intro="none"
      aria-label="Døgn">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Line dataKey="kwh" />
      <ClockChart.Tooltip />
    </ClockChart.Root>,
  ],
];

type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** The first run of the popup's text that reaches past its padding box, or null when all fit. */
function clipped(node: HTMLElement): string | null {
  if (node.scrollWidth > node.clientWidth)
    return `scrolls ${String(node.scrollWidth)} > ${String(node.clientWidth)}`;
  const box = node.getBoundingClientRect();
  const left = box.left + node.clientLeft;
  const right = left + node.clientWidth;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
    if ((text.textContent ?? "").trim() === "") continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    for (const run of range.getClientRects())
      if (run.left < left - 0.5 || run.right > right + 0.5)
        return `"${text.textContent ?? ""}" past the padding`;
  }
  return null;
}

/** The open popup and its positioner. */
function popup(): { readonly box: DOMRect; readonly side: string | null; readonly node: HTMLElement } | null {
  // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
  const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
  if (node === null || Number(getComputedStyle(node).opacity) < 0.5) return null;
  const box = node.getBoundingClientRect();
  if (box.width === 0) return null;
  return {
    box,
    side: node.closest('[data-slot="chart-tooltip-positioner"]')?.getAttribute("data-side") ?? null,
    node,
  };
}

async function frames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1)
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

function Card({ children }: { readonly children: ReactElement }): ReactElement {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <section style={{ width: 728, padding: 24 }}>
        <h2 style={{ margin: 0 }}>Forbruk per time</h2>
        {children}
      </section>
    </LocaleProvider>
  );
}

describe("the polar tooltip's side lanes", () => {
  it.each(FAMILIES)(
    "keeps the popup of %s off every label and the title, inside the figure above and the viewport below, its text whole, at every ray",
    async (_, chart) => {
      const { host } = renderThemed(<Card>{chart}</Card>);
      await userEvent.tab();
      const figure = polarFigure(host);
      const title = host.querySelector("h2");
      if (title === null) throw new Error("no title");
      const labels = [
        ...figure.querySelectorAll(
          '[data-slot$="angle-label"], [data-slot="pie-chart-label"], [data-slot$="value-label"], [data-slot$="radius-label"]'
        ),
      ]
        .map((label) => label.getBoundingClientRect())
        .filter((box) => box.width > 0);
      const bounds = figure.getBoundingClientRect();
      const faults: string[] = [];
      for (let step = 0; step < 24; step += 1) {
        await frames(14);
        const shown = popup();
        if (shown === null) {
          faults.push(`step ${String(step)}: no popup`);
        } else {
          const { box } = shown;
          if (labels.some((label) => overlap(box, label) > 0))
            faults.push(`step ${String(step)}: over a label`);
          if (overlap(box, title.getBoundingClientRect()) > 0)
            faults.push(`step ${String(step)}: over the title`);
          if (box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5 || box.top < bounds.top - 0.5)
            faults.push(`step ${String(step)}: outside the figure's sides or top`);
          if (box.bottom > window.innerHeight + 0.5) faults.push(`step ${String(step)}: below the viewport`);
          const cut = clipped(shown.node);
          if (cut !== null) faults.push(`step ${String(step)}: ${cut}`);
        }
        await userEvent.keyboard("{ArrowRight}");
      }
      expect(faults).toEqual([]);
    }
  );
});

describe("the polar tooltip's lane switches", () => {
  /** Turn the pointer round the clock at 0.8 R through the angles given, and count lane changes. */
  async function switches(host: HTMLElement, angles: readonly number[]): Promise<number> {
    // DOM audit: the line layer is aria-hidden plot output, read by its slot, for its screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="clock-chart-line"]');
    if (layer === null) throw new Error("no layer");
    const sides: (string | null)[] = [];
    for (const angle of angles) {
      const point = dialPoint(angle, 0.8);
      await hoverAt(...clientPoint(layer, point.x, point.y));
      await frames(1);
      const shown = popup();
      if (shown !== null) sides.push(shown.side);
    }
    return sides.filter((side, index) => index > 0 && side !== sides[index - 1]).length;
  }

  const clock = (FAMILIES[4] ?? FAMILIES[0])?.[1];

  it("switches once on a turn from 9 o'clock through 12 to 3 o'clock", async () => {
    const { host } = renderThemed(<Card>{clock ?? <span />}</Card>);
    expect(
      await switches(
        host,
        Array.from({ length: 37 }, (_, step) => 270 + 5 * step)
      )
    ).toBe(1);
  });

  it("switches none on a wiggle 15° either side of 12 o'clock", async () => {
    const { host } = renderThemed(<Card>{clock ?? <span />}</Card>);
    const wiggle = Array.from({ length: 24 }, (_, step) => 15 * Math.sin((step * Math.PI) / 4));
    expect(await switches(host, wiggle)).toBe(0);
  });

  it("keeps a side lane for the keys after a pointer has opened the popup and left", async () => {
    const { host } = renderThemed(<Card>{clock ?? <span />}</Card>);
    // DOM audit: the line layer is aria-hidden plot output, read by its slot, for its screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="clock-chart-line"]');
    if (layer === null) throw new Error("no layer");
    const point = dialPoint(60, 0.6);
    await pointerAt(...clientPoint(layer, point.x, point.y));
    await frames(20);
    expect(popup()?.side).toBe("right");
    // The popup closes after the pointer leaves, and the keys open it again on a side lane.
    await pointerAt(2, 2);
    await frames(30);
    await userEvent.tab();
    const sides: (string | null)[] = [];
    for (let step = 0; step < 6; step += 1) {
      await frames(14);
      sides.push(popup()?.side ?? null);
      await userEvent.keyboard("{ArrowRight}");
    }
    expect(sides).toEqual(["right", "right", "right", "right", "right", "right"]);
  });
});

// The Root's own controls. Unit under test: the polar tooltip's lanes beside a Legend and a Table.
// Oracles: the rendered boxes of the legend and of the table toggle, which the popup may never
// overlap, in a side lane at a wide width or in the bottom lane at a narrow one; and the toggle,
// which a pointer gliding from the dial to its centre opens on the first click.
describe("the polar tooltip beside the Root's legend and table toggle", () => {
  const SERIES_KEYS = Array.from({ length: 24 }, (_, index) => `T${String(index)}`);

  function Radar({ width }: { readonly width: number }): ReactElement {
    return (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <section style={{ width, padding: 24 }}>
          <h2 style={{ margin: 0 }}>Forbruk per time</h2>
          <RadarChart.Root
            data={SERIES_KEYS.map((spoke, index) => ({ spoke, NO1: 2 + (index % 3), NO2: 1 + (index % 4) }))}
            config={{ NO1: { label: "NO1", color: "chart-1" }, NO2: { label: "NO2", color: "chart-2" } }}
            nameKey="spoke"
            data-intro="none"
            aria-label="Radar">
            <RadarChart.Grid />
            <RadarChart.AngleAxis />
            <RadarChart.Line dataKey="NO1" />
            <RadarChart.Line dataKey="NO2" />
            <RadarChart.Legend />
            <RadarChart.Tooltip />
            <RadarChart.Table />
          </RadarChart.Root>
        </section>
      </LocaleProvider>
    );
  }

  it.each([
    [728, "a side lane"],
    [360, "the bottom lane"],
  ] as const)(
    "keeps the popup off the legend and the toggle at every ray at %s px, in %s",
    async (width, lane) => {
      const { host } = renderThemed(<Radar width={width} />);
      await userEvent.tab();
      const figure = polarFigure(host);
      // DOM audit: the legend and the toggle are the Root's own controls, read by their slots.
      const controls = [
        ...figure.querySelectorAll('[data-slot="chart-legend"], [data-slot="chart-table-toggle"]'),
      ].map((control) => control.getBoundingClientRect());
      expect(controls).toHaveLength(2);
      const faults: string[] = [];
      const sides = new Set<string | null>();
      for (let step = 0; step < 24; step += 1) {
        await frames(14);
        const shown = popup();
        if (shown === null) faults.push(`step ${String(step)}: no popup`);
        else {
          sides.add(shown.side);
          for (const control of controls) {
            const covered = overlap(shown.box, control);
            if (covered > 0) faults.push(`step ${String(step)}: ${covered.toFixed(0)} px² over a control`);
          }
        }
        await userEvent.keyboard("{ArrowRight}");
      }
      expect(faults).toEqual([]);
      if (lane === "the bottom lane") expect([...sides]).toEqual(["bottom"]);
      else expect(sides.has("bottom")).toBe(false);
    }
  );

  it("lets a pointer glide from the dial to the table toggle and open the table on the first click", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 360 }}>
          <RadialChart.Root
            data={[
              { measure: "energy", used: 287, budget: 450 },
              { measure: "cost", used: 612, budget: 900 },
            ]}
            config={{
              energy: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
              cost: { label: "Kostnad", color: "chart-2", format: { style: "currency", currency: "NOK" } },
            }}
            nameKey="measure"
            valueKey="used"
            maxKey="budget"
            innerRadius={0.45}
            data-intro="none"
            aria-label="Hittil i måneden">
            <RadialChart.Track />
            <RadialChart.Bar />
            <RadialChart.Legend />
            <RadialChart.Tooltip />
            <RadialChart.Table />
          </RadialChart.Root>
        </div>
      </LocaleProvider>
    );
    await frames(10);
    // DOM audit: the ring layer is aria-hidden plot output, read by its slot, for its screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="radial-chart-bar"]');
    if (layer === null) throw new Error("no rings");
    // At 0.6 R the inner ring, Kostnad, lies under the pointer, 120° round.
    const point = dialPoint(120, 0.6);
    await pointerAt(...clientPoint(layer, point.x, point.y));
    await expect.poll(() => popup() !== null).toBe(true);
    const toggle = page.getByRole("button", { name: "Vis som tabell" }).element();
    await glidePointerTo(toggle, 20);
    const box = toggle.getBoundingClientRect();
    const shown = popup();
    expect(shown === null ? 0 : overlap(shown.box, box)).toBe(0);
    // The click lands on whatever lies under the toggle's centre, as a hand's does.
    await userEvent.click(...pointerTarget(box.left + box.width / 2, box.top + box.height / 2));
    await expect.poll(() => page.getByRole("button", { name: "Skjul tabell" }).query()).not.toBeNull();
  });
});

describe("the bottom lane's width, the widest readout's", () => {
  /** A solar day of 96 quarter-hours, whose widest label, "11:45 AM – 12:00 PM", sets the lane. */
  const SOLAR = Array.from({ length: 96 }, (_, quarter) => ({
    start: DAY + quarter * 900_000,
    solar: quarter >= 28 && quarter < 76 ? 0.05 + 1.2 * Math.sin((Math.PI * (quarter - 28)) / 48) : 0.004,
  }));

  /** The first run of the popup's text that breaks over two lines, or null when every run is one. */
  function wrapped(node: HTMLElement): string | null {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      if ((text.textContent ?? "").trim() === "") continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      if (range.getClientRects().length > 1) return text.textContent;
    }
    return null;
  }

  // The letter spacing moves the widest label's width by 19 × 0.02 = 0.38 px a case, so across 1.5 px
  // some case leaves a fraction under half a pixel, which a rounded measure gives away.
  it.each([0, 0.02, 0.04, 0.06, 0.08])(
    "keeps every line of the readout whole at every step with %s px letter spacing",
    async (spacing) => {
      const { host } = renderThemed(
        <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
          <style>{`[data-slot="chart-tooltip"] { letter-spacing: ${String(spacing)}px; }`}</style>
          <div style={{ width: 360 }}>
            <ClockChart.Root
              data={SOLAR}
              config={{
                solar: { label: "Solar", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
              }}
              xKey="start"
              cycle="day"
              interval="quarter-hour"
              data-intro="none"
              aria-label="Solar">
              <ClockChart.Grid />
              <ClockChart.AngleAxis />
              <ClockChart.Line dataKey="solar" />
              <ClockChart.Tooltip />
            </ClockChart.Root>
          </div>
        </LocaleProvider>
      );
      await userEvent.tab();
      expect(polarFigure(host)).not.toBeNull();
      const faults: string[] = [];
      for (let step = 0; step < 96; step += 1) {
        await frames(3);
        const shown = popup();
        if (shown === null) faults.push(`step ${String(step)}: no popup`);
        else {
          if (shown.side !== "bottom") faults.push(`step ${String(step)}: ${String(shown.side)} lane`);
          const broken = wrapped(shown.node);
          if (broken !== null) faults.push(`step ${String(step)}: "${broken}" on two lines`);
        }
        await userEvent.keyboard("{ArrowRight}");
      }
      expect(faults).toEqual([]);
    }
  );
});

// A side-lane leap and a lane switch fade the popup in where it rests. Unit under test: that fade on
// a five-spoke radar in a side lane, whose every spoke step at 200 px/s leaps. Oracle: the readout
// never vanishes while the user still points at an item, so from the popup's first opaque frame its
// computed opacity stays at half or more in every frame an option is active.
describe("the side lane's fade on a leap", () => {
  it("never shows the readout under half opacity while an option is active on a ring at 200 px/s", async () => {
    // The real mouse leaves the chart first: an earlier test may have left it where this chart
    // renders, and its own hover would race the synthetic moves.
    await commands.pointerGlide(1, 1, 1);
    const { host } = renderThemed(
      <Card>
        <RadarChart.Root
          data={["Households", "Cabins", "Primary", "Industry", "Services"].map((spoke, index) => ({
            spoke,
            NO1: 90 + 10 * index,
          }))}
          config={{ NO1: { label: "NO1", color: "chart-1" } }}
          nameKey="spoke"
          data-intro="none"
          aria-label="Prisområder">
          <RadarChart.Grid />
          <RadarChart.AngleAxis />
          <RadarChart.Line dataKey="NO1" />
          <RadarChart.Tooltip />
        </RadarChart.Root>
      </Card>
    );
    const figure = polarFigure(host);
    const layer = radarLayer(host, "radar-chart-line");
    const [cx, cy] = clientPoint(layer, 0, 0);
    const [rx] = clientPoint(layer, 1, 0);
    const radius = rx - cx;
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
    move(10);
    const omega = (200 / (0.8 * radius)) * (180 / Math.PI);
    const start = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const reads: { readonly opacity: number; readonly active: boolean; readonly side: string | null }[] = [];
    /** The popup's computed opacity, and whether an option is active, as the frame stands. */
    const read = () => {
      // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
      const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
      reads.push({
        opacity: node === null ? 0 : Number(getComputedStyle(node).opacity),
        active: figure.hasAttribute("data-active"),
        side: node?.closest('[data-slot="chart-tooltip-positioner"]')?.getAttribute("data-side") ?? null,
      });
    };
    for (;;) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      const angle = 10 + (omega * (now - start)) / 1000;
      if (angle > 370) break;
      // Read as the frame starts, then again once the move's commit has landed, so a fade that
      // starts in either place shows its first value.
      read();
      move(angle);
      await Promise.resolve();
      read();
    }
    const opened = reads.findIndex((sample) => sample.opacity >= 0.99);
    expect(opened).toBeGreaterThanOrEqual(0);
    const after = reads.slice(opened);
    expect(after.filter((sample) => sample.side === "bottom")).toEqual([]);
    expect(after.filter((sample) => sample.active && sample.opacity < 0.5)).toEqual([]);
  });
});

// A row wider than any the popup has shown widens it before that frame paints. Unit under test: the
// bottom lane's fixed width on a 24-hour clock whose readings stop at 6 PM, where the 6 PM slot's
// row reads "no data yet", wider than any reading. Oracle: the popup's own height before and after
// the step, which no rendered frame between them may pass, since a row that wrapped for a frame
// would.
describe("the bottom lane's width when a wider row first shows", () => {
  it("never grows the popup past its height before and after a key step from 5 PM to 6 PM", async () => {
    /** Wednesday 15 October 2025 in Oslo, and the day's readings until 5:20 PM. */
    const today = Date.parse("2025-10-14T22:00:00Z");
    const now = Date.parse("2025-10-15T15:20:00Z");
    renderThemed(
      <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
        <div style={{ width: 360 }}>
          <ClockChart.Root
            data={Array.from({ length: 18 }, (_, hour) => ({
              start: today + hour * 3_600_000,
              kwh: 0.4 + (hour % 5) * 0.27,
            }))}
            config={{
              kwh: {
                label: "Today",
                color: "chart-1",
                format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
              },
            }}
            xKey="start"
            cycle="day"
            timeZone="Europe/Oslo"
            interval="hour"
            now={now}
            data-intro="none"
            aria-label="Today">
            <ClockChart.Grid />
            <ClockChart.AngleAxis />
            <ClockChart.Column dataKey="kwh" />
            <ClockChart.Tooltip />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Home}");
    for (let hour = 0; hour < 17; hour += 1) await userEvent.keyboard("{ArrowRight}");
    await frames(20);
    // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
    const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (node === null) throw new Error("no popup");
    expect(node.textContent).toMatch(/5\s*–\s*6\s*PM/u);
    const before = node.getBoundingClientRect().height;
    // A resize observer reports the size each rendered frame lays out, after the frame's animation
    // callbacks and before its paint, so it reads what every painted frame shows.
    const heights: number[] = [];
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) heights.push(entry.borderBoxSize[0]?.blockSize ?? 0);
    });
    observer.observe(node);
    await userEvent.keyboard("{ArrowRight}");
    await frames(30);
    observer.disconnect();
    expect(node.textContent).toContain("no data yet");
    const after = node.getBoundingClientRect().height;
    expect(heights.filter((height) => height > Math.max(before, after) + 0.5)).toEqual([]);
  });
});

// A popup that closes while it waits, transparent, for its lane stays transparent. Unit under test:
// the opening hold on a radial chart whose popup has shown once, when a pointer crosses a ring for
// one frame and moves into the hole. Oracle: the readout was never shown, so it never paints: its computed opacity stays at
// most 0.05 in each of the next 15 frames.
describe("the opening hold when the popup closes during it", () => {
  it("keeps a popup the pointer crossed for one frame transparent as it closes", async () => {
    // The real mouse leaves the chart first: an earlier test may have left it where this chart
    // renders, and its own hover would race the synthetic moves.
    await commands.pointerGlide(1, 1, 1);
    const { host } = renderThemed(
      <Card>
        <RadialChart.Root
          data={[
            { budget: "heat", kwh: 300 },
            { budget: "car", kwh: 240 },
            { budget: "water", kwh: 180 },
          ]}
          config={{
            heat: { label: "Oppvarming", color: "chart-1" },
            car: { label: "Elbil", color: "chart-2" },
            water: { label: "Varmtvann", color: "chart-3" },
          }}
          nameKey="budget"
          valueKey="kwh"
          max={360}
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Tooltip />
        </RadialChart.Root>
      </Card>
    );
    // DOM audit: the bars are aria-hidden plot output, read by their slot, for their screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="radial-chart-bar"]');
    if (layer === null) throw new Error("no bars");
    const listbox = page.getByRole("listbox").element();
    const move = (point: DOMPoint) => {
      const [clientX, clientY] = clientPoint(layer, point.x, point.y);
      listbox.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    };
    // A browser sends a frame's pointer move before that frame's animation callbacks, so the move
    // into the hole lands in the frame after the ring's, before the hold's check runs: the frame is
    // asked for before the ring's move, which asks for the check's.
    // The popup opens once and closes, as on any page where it has shown before, so it is mounted
    // and the next open holds it.
    move(dialPoint(30, 0.9));
    await frames(20);
    move(dialPoint(30, 0.12));
    await frames(40);
    const next = new Promise((resolve) => requestAnimationFrame(resolve));
    move(dialPoint(30, 0.9));
    await next;
    move(dialPoint(30, 0.12));
    const opacities: number[] = [];
    for (let frame = 0; frame < 15; frame += 1) {
      await frames(1);
      // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
      const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
      opacities.push(node === null ? 0 : Number(getComputedStyle(node).opacity));
    }
    expect(opacities.filter((opacity) => opacity > 0.05)).toEqual([]);
  });

  // The order the docs build records on a flick at 2,000 px/s: the open, then in the next frame the
  // hold's check finds the popup on its lane, and only after that does the pointer's move into the
  // hole close the item. The hold's frame is asked for in the open's layout effect, so a frame asked
  // for once the hold is written runs after the check, and the move into the hole goes there.
  it("keeps a popup transparent when its item closes in the frame after it opens, after the check", async () => {
    await commands.pointerGlide(1, 1, 1);
    const { host } = renderThemed(
      <Card>
        <RadialChart.Root
          data={[
            { budget: "heat", kwh: 300 },
            { budget: "car", kwh: 240 },
            { budget: "water", kwh: 180 },
          ]}
          config={{
            heat: { label: "Oppvarming", color: "chart-1" },
            car: { label: "Elbil", color: "chart-2" },
            water: { label: "Varmtvann", color: "chart-3" },
          }}
          nameKey="budget"
          valueKey="kwh"
          max={360}
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Tooltip />
        </RadialChart.Root>
      </Card>
    );
    // DOM audit: the bars are aria-hidden plot output, read by their slot, for their screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="radial-chart-bar"]');
    if (layer === null) throw new Error("no bars");
    const listbox = page.getByRole("listbox").element();
    const move = (point: DOMPoint) => {
      const [clientX, clientY] = clientPoint(layer, point.x, point.y);
      listbox.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    };
    // The popup opens once and closes, so it is mounted, as the portal keeps it from its first open.
    move(dialPoint(30, 0.9));
    await frames(20);
    move(dialPoint(30, 0.12));
    await frames(40);
    // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
    const popup = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (popup === null) throw new Error("no mounted popup");
    const held = new Promise<void>((resolve) => {
      const watch = new MutationObserver(() => {
        if (popup.style.opacity !== "0") return;
        watch.disconnect();
        resolve();
      });
      watch.observe(popup, { attributes: true, attributeFilter: ["style"] });
    });
    move(dialPoint(30, 0.9));
    await held;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        move(dialPoint(30, 0.12));
        resolve();
      })
    );
    const opacities: number[] = [];
    for (let frame = 0; frame < 15; frame += 1) {
      await frames(1);
      opacities.push(Number(getComputedStyle(popup).opacity));
    }
    expect(opacities.filter((opacity) => opacity > 0.05)).toEqual([]);
  });

  /** A three-ring radial chart whose popup has opened once and closed, so it is mounted. */
  async function mountedRadial() {
    await commands.pointerGlide(1, 1, 1);
    const { host } = renderThemed(
      <Card>
        <RadialChart.Root
          data={[
            { budget: "heat", kwh: 300 },
            { budget: "car", kwh: 240 },
            { budget: "water", kwh: 180 },
          ]}
          config={{
            heat: { label: "Oppvarming", color: "chart-1" },
            car: { label: "Elbil", color: "chart-2" },
            water: { label: "Varmtvann", color: "chart-3" },
          }}
          nameKey="budget"
          valueKey="kwh"
          max={360}
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Tooltip />
        </RadialChart.Root>
      </Card>
    );
    // DOM audit: the bars are aria-hidden plot output, read by their slot, for their screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="radial-chart-bar"]');
    if (layer === null) throw new Error("no bars");
    const listbox = page.getByRole("listbox").element();
    const move = (point: DOMPoint) => {
      const [clientX, clientY] = clientPoint(layer, point.x, point.y);
      listbox.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    };
    move(dialPoint(30, 0.9));
    await frames(20);
    move(dialPoint(30, 0.12));
    await frames(40);
    // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
    const popup = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (popup === null) throw new Error("no mounted popup");
    /** Resolve once the popup's inline opacity reads a value. */
    const inline = (value: string) =>
      new Promise<void>((resolve) => {
        const watch = new MutationObserver(() => {
          if (popup.style.opacity !== value) return;
          watch.disconnect();
          resolve();
        });
        watch.observe(popup, { attributes: true, attributeFilter: ["style"] });
      });
    return { move, popup, inline };
  }

  // A popup that closes mid-entrance fades out from the opacity it reached. Oracle: a fade-out
  // starts from what is on screen, so no frame after the close paints the popup brighter than the
  // brightest frame before it.
  it("fades a popup that closes mid-entrance out from the opacity it reached", async () => {
    const { move, popup, inline } = await mountedRadial();
    const held = inline("0");
    move(dialPoint(30, 0.9));
    await held;
    await inline("");
    const before: number[] = [Number(getComputedStyle(popup).opacity)];
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        before.push(Number(getComputedStyle(popup).opacity));
        move(dialPoint(30, 0.12));
        resolve();
      })
    );
    const after: number[] = [];
    for (let frame = 0; frame < 15; frame += 1) {
      await frames(1);
      after.push(Number(getComputedStyle(popup).opacity));
    }
    const reached = Math.max(...before);
    expect(reached).toBeLessThan(1);
    expect(after.filter((opacity) => opacity > reached + 0.001)).toEqual([]);
  });

  // A close and a reopen between two of the hold's checks. Oracle: a popup whose item survived no
  // full frame never shows. A frame asked for before the move onto ring A runs ahead of the hold's
  // first check and asks for the frame that moves onto ring B ahead of the second; a frame asked for
  // once the hold is written runs after the first check and moves into the hole between them.
  it("keeps a popup transparent when its item closes and another opens between the hold's checks", async () => {
    const { move, popup, inline } = await mountedRadial();
    const held = inline("0");
    let closed = (): void => undefined;
    const done = new Promise<void>((resolve) => {
      closed = resolve;
    });
    // The frame after B opens, before its close: B's item has survived one check, so B is still
    // held, and nothing of it paints.
    const opacities: number[] = [];
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        move(dialPoint(30, 0.62));
        requestAnimationFrame(() => {
          opacities.push(Number(getComputedStyle(popup).opacity));
          move(dialPoint(30, 0.12));
          closed();
        });
      })
    );
    move(dialPoint(30, 0.9));
    await held;
    requestAnimationFrame(() => move(dialPoint(30, 0.12)));
    await done;
    for (let frame = 0; frame < 15; frame += 1) {
      await frames(1);
      opacities.push(Number(getComputedStyle(popup).opacity));
    }
    expect(opacities.filter((opacity) => opacity > 0.05)).toEqual([]);
  });
});

// A popup that closes while its lane fade runs fades out from where the fade got. Unit under test:
// the lane fade and the close on a pie of four equal slices, where slices 0 (45°) and 1 (135°) rest
// in the right lane and slice 3 (315°) in the left. Two switches a frame apart run two fades at once.
// Oracle: a fade-out starts from what is on screen, so in the 15 frames after the close nothing
// paints brighter than the brightest frame before it.
describe("a close during the lane fade", () => {
  /** Each frame's painted opacity, read after the frame's animation callbacks, before it paints. */
  function paintedFrames() {
    const painted: number[] = [];
    let on = true;
    let frame = 0;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:-40px;top:0;width:1px;height:1px;visibility:hidden";
    document.body.append(probe);
    const observer = new ResizeObserver(() => {
      if (!on) return;
      // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
      const popup = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
      const box = popup?.getBoundingClientRect();
      painted.push(
        popup && box && box.width > 0 && box.height > 0 ? Number(getComputedStyle(popup).opacity) : 0
      );
    });
    observer.observe(probe);
    const tick = () => {
      if (!on) return;
      frame += 1;
      probe.style.width = frame % 2 === 0 ? "1px" : "2px";
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return {
      painted,
      stop: () => {
        on = false;
        observer.disconnect();
        probe.remove();
      },
    };
  }

  it.each([
    { close: "two frames after a lane switch", switches: [{ angle: 315, frames: 2 }] },
    {
      close: "right after a second lane switch inside the first's fade",
      switches: [
        { angle: 315, frames: 1 },
        { angle: 135, frames: 0 },
      ],
    },
    {
      close: "two frames after a second lane switch inside the first's fade",
      switches: [
        { angle: 315, frames: 1 },
        { angle: 135, frames: 2 },
      ],
    },
  ])("fades a popup closed $close out from where the fade got", async ({ switches }) => {
    await commands.pointerGlide(1, 1, 1);
    const { host } = renderThemed(
      <Card>
        <PieChart.Root
          data={[
            { part: "a", kr: 10 },
            { part: "b", kr: 10 },
            { part: "c", kr: 10 },
            { part: "d", kr: 10 },
          ]}
          config={{
            a: { label: "Nettleie", color: "chart-1" },
            b: { label: "Strøm", color: "chart-2" },
            c: { label: "Avgifter", color: "chart-3" },
            d: { label: "Påslag", color: "chart-4" },
          }}
          nameKey="part"
          valueKey="kr"
          data-intro="none"
          aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Tooltip />
        </PieChart.Root>
      </Card>
    );
    await frames(20);
    // DOM audit: the pie is aria-hidden plot output, read by its slot, for its screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="pie-chart-pie"]');
    if (layer === null) throw new Error("no pie");
    const listbox = page.getByRole("listbox").element();
    const move = (angle: number) => {
      const point = dialPoint(angle, 0.6);
      const [clientX, clientY] = clientPoint(layer, point.x, point.y);
      listbox.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    };
    const escape = () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // Mounted by an open and a dismiss on slice 1, so slice 0 opens again after it.
    move(135);
    await frames(30);
    escape();
    await frames(45);
    // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
    const popup = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (popup === null) throw new Error("no mounted popup");
    const record = paintedFrames();
    move(45);
    // The release: the first frame the popup is open, holds no inline opacity and paints.
    for (let wait = 0; wait < 20; wait += 1) {
      await frames(1);
      if (
        popup.hasAttribute("data-open") &&
        popup.style.opacity === "" &&
        Number(getComputedStyle(popup).opacity) > 0.01
      )
        break;
    }
    await frames(1);
    for (const step of switches) {
      move(step.angle);
      await frames(step.frames);
    }
    // What is on screen at the close: the frames painted so far and the fade's value now, which a
    // close in a later frame callback reads one fade step on from the last painted frame.
    const before = Math.max(0, ...record.painted, Number(getComputedStyle(popup).opacity));
    const at = record.painted.length;
    escape();
    await frames(16);
    record.stop();
    const after = record.painted.slice(at, at + 15);
    expect(after.length).toBeGreaterThan(10);
    expect(after.filter((opacity) => opacity > before + 0.001)).toEqual([]);
  });
});

// A bottom lane that would leave the viewport. Unit under test: the polar tooltip's lane anchor over
// a two-slice PieChart with its default 200 px dial, near the bottom of a 390 × 600 viewport, whose
// side lanes hold under 128 px. Oracle: R2.3 as amended, read from the rendered boxes: the popup
// lies inside the viewport, and it overlaps neither the dial's drawing, the labels past the rim, nor
// the title the Root's `aria-labelledby` names.
describe("the polar tooltip near the viewport's bottom", () => {
  it("rests inside the viewport, off the dial, its labels and its title, when below would leave it", async () => {
    await page.viewport(390, 600);
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div data-spacer="" />
        <h2 id="bill-title" style={{ margin: 0 }}>
          Regning
        </h2>
        <PieChart.Root
          data={[
            { part: "energi", kr: 640 },
            { part: "nettleie", kr: 360 },
          ]}
          config={{
            energi: { label: "Energi", color: "chart-1" },
            nettleie: { label: "Nettleie", color: "chart-2" },
          }}
          nameKey="part"
          valueKey="kr"
          data-intro="none"
          aria-labelledby="bill-title">
          <PieChart.Pie />
          <PieChart.Labels position="outside" />
          <PieChart.Tooltip />
        </PieChart.Root>
      </LocaleProvider>
    );
    const figure = polarFigure(host);
    // DOM audit: the pie's drawing is aria-hidden plot output, read by its slot.
    const dial = (): DOMRect => {
      const drawing = figure.querySelector('[data-slot="pie-chart-pie"]');
      if (drawing === null) throw new Error("no pie");
      return drawing.getBoundingClientRect();
    };
    // The spacer lowers the chart until the figure ends 8 px above the viewport's 600.
    const spacer = host.querySelector<HTMLElement>("[data-spacer]");
    if (spacer === null) throw new Error("no spacer");
    spacer.style.height = `${String(592 - figure.getBoundingClientRect().bottom)}px`;
    await frames(2);
    expect(dial().bottom).toBeGreaterThan(500);
    await userEvent.tab();
    await frames(14);
    const shown = popup();
    expect(shown).not.toBeNull();
    const box = shown?.box ?? new DOMRect();
    const title = host.querySelector("h2")?.getBoundingClientRect() ?? new DOMRect();
    // DOM audit: the labels are aria-hidden plot output, read by their slot.
    const labels = [...figure.querySelectorAll('[data-slot="pie-chart-label"]')]
      .map((label) => label.getBoundingClientRect())
      .filter((rect) => rect.width > 0);
    expect(labels).toHaveLength(2);
    expect({
      top: box.top >= -0.5,
      bottom: box.bottom <= window.innerHeight + 0.5,
      dial: overlap(box, dial()),
      labels: labels.map((label) => overlap(box, label)),
      title: overlap(box, title),
    }).toEqual({ top: true, bottom: true, dial: 0, labels: [0, 0], title: 0 });
  });
});
