// A chart Root nested in another Root, in Chromium. Unit under test: chart.css's state, first-paint
// and configuration rules, as each Root writes its state onto its own figure. Oracle: S14, a nested
// Root draws from its own state alone, so every slotted element inside an inner Root at rest
// computes the same styles as the same chart rendered alone at rest, at the same width, whatever
// the outer Root's state: active, selected, highlighted, near, past-faded, horizontal, waiting for
// its first paint, growing in or playing its entrance, and whatever its family.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";
import { ScatterChart } from "./scatter-chart-namespace";

/** The computed properties a Root's state, first paint or configuration can change on a part. */
const PROPERTIES = [
  "opacity",
  "visibility",
  "translate",
  "scale",
  "mask-image",
  "animation-name",
  "animation-play-state",
  "touch-action",
  "grid-area",
  "display",
  "clip-path",
  "flex-direction",
  "writing-mode",
  "text-align",
  "--_tl",
  "--_tr",
  "--_br",
  "--_bl",
] as const;

const BILL = [
  { part: "strom", kr: 50 },
  { part: "nettleie", kr: 30 },
  { part: "avgift", kr: 20 },
];

const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgift: { label: "Avgift", color: "chart-3" },
} as const;

/** Four price areas' spot prices in øre/kWh, two months. */
const AREAS = ["NO1", "NO2", "NO3", "NO4"].map((area, index) => ({
  area,
  okt: 60 + 10 * index,
  nov: 90 - 10 * index,
}));

const AREA_CONFIG = {
  okt: { label: "Oktober", color: "chart-1" },
  nov: { label: "November", color: "chart-2" },
} as const;

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  start: DAY + hour * 3_600_000,
  kwh: 1 + (hour % 4),
  kr: 2 + (hour % 3),
}));

const HOUR_CONFIG = {
  kwh: { label: "Forbruk", color: "chart-1" },
  kr: { label: "Kostnad", color: "chart-2" },
} as const;

/** Oslo midnight of a day in October 2025, in summer time up to 26 October. */
const october = (date: number) => new Date(Date.UTC(2025, 9, date, -2));

const DAYS = [1, 2, 3, 4].map((date) => ({ day: october(date), kwh: 10 + date, kr: 5 + date }));

const NOW = new Date(Date.UTC(2025, 9, 3, 10));

const POINTS = [
  { t: -2, kwh: 21, s: "kwh" },
  { t: 8, kwh: 14, s: "kwh" },
  { t: 18, kwh: 9, s: "kwh" },
];

/** Each inner chart, at rest, the same alone and nested. */
const INNER = {
  pie: (
    <PieChart.Root
      data={BILL}
      config={BILL_CONFIG}
      nameKey="part"
      valueKey="kr"
      data-intro="none"
      aria-label="Indre">
      <PieChart.Track />
      <PieChart.Pie />
      <PieChart.Glow dataKey="strom" />
      <PieChart.Labels />
      <PieChart.Center>
        <PieChart.CenterValue />
      </PieChart.Center>
    </PieChart.Root>
  ),
  radial: (
    <RadialChart.Root
      data={BILL}
      config={BILL_CONFIG}
      nameKey="part"
      valueKey="kr"
      max={60}
      data-intro="none"
      aria-label="Indre">
      <RadialChart.Track />
      <RadialChart.Bar />
    </RadialChart.Root>
  ),
  radar: (
    <RadarChart.Root data={AREAS} config={AREA_CONFIG} nameKey="area" data-intro="none" aria-label="Indre">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Area dataKey="okt" />
      <RadarChart.Line dataKey="nov" />
      <RadarChart.Dots dataKey="nov" />
    </RadarChart.Root>
  ),
  clock: (
    <ClockChart.Root
      data={HOURS}
      config={HOUR_CONFIG}
      xKey="start"
      cycle="day"
      interval="hour"
      data-intro="none"
      aria-label="Indre">
      <ClockChart.Grid />
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Line dataKey="kr" />
      <ClockChart.Scrubber />
    </ClockChart.Root>
  ),
  chart: (
    <Chart.Root
      data={DAYS}
      config={HOUR_CONFIG}
      xKey="day"
      interval="day"
      timeZone="Europe/Oslo"
      now={NOW}
      aria-label="Indre">
      <Chart.XAxis label="Dag" />
      <Chart.YAxis label="kWh" />
      <Chart.Bar dataKey="kwh" />
      <Chart.Reveal>
        <Chart.Line dataKey="kr" />
      </Chart.Reveal>
      <Chart.Crosshair />
      <Chart.ActiveValueLine dataKey="kwh" />
      <Chart.ActiveDot dataKey="kr" />
      <Chart.ReferenceLine y={12} label="Mål" />
      <Chart.Legend />
    </Chart.Root>
  ),
  scatter: (
    <ScatterChart.Root
      data={POINTS}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="t"
      yKey="kwh"
      seriesKey="s"
      data-intro="none"
      aria-label="Indre">
      <ScatterChart.Points dataKey="kwh" />
      <ScatterChart.ActiveDot />
    </ScatterChart.Root>
  ),
} as const;

type Family = keyof typeof INNER;

/** The inner chart in a box of its own, so it lays out at the same width alone and nested. */
function Boxed({ family }: { readonly family: Family }) {
  return <div style={{ width: 240 }}>{INNER[family]}</div>;
}

/** What sets an outer Root's state, which each Root takes as far as its props allow. */
type OuterProps = {
  /** Select the Root's second category on mount. */
  readonly selected?: true;
  readonly orientation?: "horizontal";
  readonly now?: Date;
  /** Fade the slots before `now`, as `data-fade="past"` does. */
  readonly fade?: true;
  readonly intro?: "none" | "center";
};

/** Every outer Root, its inner chart among its parts, with the props that set its state. */
const OUTER = {
  pie: (inner, { selected, intro }) => (
    <PieChart.Root
      data={BILL}
      config={BILL_CONFIG}
      nameKey="part"
      valueKey="kr"
      defaultSelectedKey={selected === true ? "nettleie" : undefined}
      data-intro={intro === "none" ? "none" : undefined}
      aria-label="Ytre">
      <PieChart.Pie />
      <PieChart.Center>
        <PieChart.CenterValue />
      </PieChart.Center>
      <PieChart.LegendToggleGroup />
      {inner}
    </PieChart.Root>
  ),
  radial: (inner, { selected, intro }) => (
    <RadialChart.Root
      data={BILL}
      config={BILL_CONFIG}
      nameKey="part"
      valueKey="kr"
      max={60}
      defaultSelectedKey={selected === true ? "nettleie" : undefined}
      data-intro={intro === "none" ? "none" : undefined}
      aria-label="Ytre">
      <RadialChart.Track />
      <RadialChart.Bar />
      <RadialChart.LegendToggleGroup />
      {inner}
    </RadialChart.Root>
  ),
  radar: (inner, { selected, intro }) => (
    <RadarChart.Root
      data={AREAS}
      config={AREA_CONFIG}
      nameKey="area"
      defaultSelectedKey={selected === true ? "nov" : undefined}
      data-intro={intro === "none" ? "none" : undefined}
      aria-label="Ytre">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.Line dataKey="okt" />
      <RadarChart.Line dataKey="nov" />
      <RadarChart.LegendToggleGroup />
      {inner}
    </RadarChart.Root>
  ),
  clock: (inner, { selected, intro, now, fade }) => (
    <ClockChart.Root
      data={HOURS}
      config={HOUR_CONFIG}
      xKey="start"
      cycle="day"
      interval="hour"
      now={now}
      defaultSelectedKey={selected === true ? "kr" : undefined}
      data-fade={fade === true ? "past" : undefined}
      data-intro={intro === "none" ? "none" : undefined}
      aria-label="Ytre">
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Line dataKey="kr" />
      <ClockChart.LegendToggleGroup />
      {inner}
    </ClockChart.Root>
  ),
  chart: (inner, { selected, intro, orientation, fade }) => (
    <Chart.Root
      data={DAYS}
      config={HOUR_CONFIG}
      xKey="day"
      interval="day"
      timeZone="Europe/Oslo"
      now={NOW}
      orientation={orientation}
      defaultSelectedKey={selected === true ? "kr" : undefined}
      data-fade={fade === true ? "past" : undefined}
      data-intro={intro}
      aria-label="Ytre">
      <Chart.XAxis />
      <Chart.YAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Line dataKey="kr" />
      <Chart.Crosshair />
      <Chart.LegendToggleGroup />
      {inner}
    </Chart.Root>
  ),
  scatter: (inner, { intro }) => (
    <ScatterChart.Root
      data={POINTS}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="t"
      yKey="kwh"
      seriesKey="s"
      data-intro={intro === "none" ? "none" : undefined}
      aria-label="Ytre">
      <ScatterChart.Points dataKey="kwh" />
      <ScatterChart.ActiveDot />
      {inner}
    </ScatterChart.Root>
  ),
} satisfies Record<Family, (inner: ReactNode, props: OuterProps) => ReactNode>;

/** Finish every running transition and animation, so styles show their rest. */
function settle(host: HTMLElement): void {
  for (const animation of host.getAnimations({ subtree: true })) animation.finish();
}

/** Each slotted element's name and computed styles, in document order. */
function styles(figure: Element): { readonly name: string; readonly values: readonly string[] }[] {
  // DOM audit: the comparison covers every slotted part and sub-part, aria-hidden plot output among
  // them, so the slot attribute is the locator by design.
  return [...figure.querySelectorAll("[data-slot], [data-part], [data-reel]")].map((element) => {
    const style = getComputedStyle(element);
    const part = element.getAttribute("data-part");
    return {
      name: `${element.getAttribute("data-slot") ?? ""}${part === null ? "" : `.${part}`}`,
      // React's ids differ between renders, so a paint-server reference compares by its shape.
      values: PROPERTIES.map((property) =>
        style.getPropertyValue(property).replaceAll(/_r_[\da-z]+_/gu, "_r_")
      ),
    };
  });
}

/** The innermost Root's figure, the last in document order, since each Root holds one nested. */
function innerFigure(host: HTMLElement): HTMLElement {
  // DOM audit: each Root is a figure, and a nested one sits inside its outer Root's figure.
  const figure = [...host.querySelectorAll<HTMLElement>("figure figure")].at(-1);
  if (figure === undefined) throw new Error("no nested figure");
  return figure;
}

/** Each property that differs, as the element's name, the property, its value alone and nested. */
function differences(actual: ReturnType<typeof styles>, expected: ReturnType<typeof styles>): string[] {
  expect(actual.map(({ name }) => name)).toEqual(expected.map(({ name }) => name));
  return actual.flatMap(({ name, values }, index) =>
    PROPERTIES.flatMap((property, at) => {
      const own = expected[index]?.values[at];
      return values[at] === own ? [] : [`${name} ${property}: ${String(own)} → ${String(values[at])}`];
    })
  );
}

/**
 * Activate the option under the middle of a chart's own plot with the pointer, or on a polar chart
 * three quarters across it: a dial's middle is its centre, which has no angle to pick, so it picks
 * nothing.
 */
async function activateOwn(figure: HTMLElement): Promise<void> {
  // DOM audit: the plot's listbox is the chart's one pointer target.
  const listbox = figure.querySelector<HTMLElement>('[role="listbox"]');
  if (listbox === null) throw new Error("no listbox");
  const box = listbox.getBoundingClientRect();
  await userEvent.hover(
    listbox,
    figure.hasAttribute("data-polar") ? { position: { x: box.width * 0.75, y: box.height / 2 } } : undefined
  );
  await expect.poll(() => figure.hasAttribute("data-active")).toBe(true);
}

/** A button before the charts: the pointer rests on it, so it hovers no chart, and Tab starts from it. */
function Rest() {
  return <button type="button">Pekeren hviler her</button>;
}

/** Rest the pointer beside the charts, wherever an earlier case left it. */
async function rest(): Promise<void> {
  await userEvent.hover(page.getByRole("button", { name: "Pekeren hviler her" }));
}

/** The inner chart's styles alone, at rest, or after a setup of its own. */
async function alone(
  family: Family,
  setup?: (figure: HTMLElement) => Promise<void>
): Promise<ReturnType<typeof styles>> {
  const { host, unmount } = renderThemed(
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <Rest />
      <Boxed family={family} />
    </LocaleProvider>
  );
  await rest();
  await waitDrawn(host);
  settle(host);
  // DOM audit: the lone Root's figure.
  const figure = host.querySelector("figure");
  if (figure === null) throw new Error("no figure");
  await setup?.(figure);
  settle(host);
  const result = styles(figure);
  unmount();
  return result;
}

/**
 * Wait until every polar figure in the host has painted its first frame, and every cartesian one
 * has played its entrance, finishing the animations as they start and scrolling each one that
 * waits into view.
 */
async function waitDrawn(host: HTMLElement): Promise<void> {
  // DOM audit: a polar Root writes data-drawn on its figure once its entrance starts, and a
  // cartesian Root removes data-entrance once its wipe ends.
  await expect
    .poll(() => {
      settle(host);
      // A Root waits for its plot to come into view, so a waiting one scrolls to it.
      const waiting = [...host.querySelectorAll("figure")].filter((figure) =>
        figure.hasAttribute("data-polar")
          ? !figure.hasAttribute("data-drawn")
          : figure.hasAttribute("data-entrance")
      );
      waiting[0]?.scrollIntoView();
      return waiting.length;
    })
    .toBe(0);
}

/** How a case puts the outer Root into its state. */
type Setup = (outer: HTMLElement) => Promise<void> | void;

const activate: Setup = async (outer) => {
  page.getByRole("button", { name: "Pekeren hviler her" }).element().focus();
  await userEvent.tab();
  await userEvent.keyboard("{ArrowRight}");
  await expect.poll(() => outer.hasAttribute("data-active")).toBe(true);
};

const highlight: Setup = async (outer) => {
  await userEvent.hover(page.getByRole("button", { name: /Nettleie|Kostnad|November/u }).first());
  await expect.poll(() => outer.hasAttribute("data-highlight")).toBe(true);
};

/**
 * Hold the outer Root in a state its own loop writes for a moment, such as its entrance's wait. The
 * Root's writers keep their own tests; here the stylesheet is the unit, so the state stands still.
 */
const hold =
  (attributes: Record<string, string | null>): Setup =>
  (outer) => {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) outer.removeAttribute(name);
      else outer.setAttribute(name, value);
    }
  };

const CASES: readonly (readonly [string, Family, Family, OuterProps, Setup | null])[] = [
  ["an active pie around a pie", "pie", "pie", {}, activate],
  ["a selected pie around a pie", "pie", "pie", { selected: true }, null],
  ["a highlighted pie around a pie", "pie", "pie", {}, highlight],
  ["a pie waiting for its first paint around a drawn pie", "pie", "pie", {}, hold({ "data-drawn": null })],
  ["a pie counting its centre up around a pie", "pie", "pie", {}, hold({ "data-entering": "" })],
  ["an active radial chart around a radial chart", "radial", "radial", {}, activate],
  ["a selected radial chart around a radial chart", "radial", "radial", { selected: true }, null],
  [
    "a radial chart growing its tracks in around a radial chart",
    "radial",
    "radial",
    {},
    hold({ "data-entering": "", "data-grow": "" }),
  ],
  ["an active radar around a radar", "radar", "radar", {}, activate],
  ["a selected radar around a radar", "radar", "radar", { selected: true }, null],
  ["a highlighted radar around a radar", "radar", "radar", {}, highlight],
  [
    "a radar growing its grid in around a radar",
    "radar",
    "radar",
    {},
    hold({ "data-entering": "", "data-grow": "" }),
  ],
  ["an active clock around a clock", "clock", "clock", {}, activate],
  ["a selected clock around a clock", "clock", "clock", { selected: true }, null],
  ["a highlighted clock around a clock", "clock", "clock", {}, highlight],
  [
    "a clock fading its past around a clock",
    "clock",
    "clock",
    { now: new Date(DAY + 12 * 3_600_000), fade: true },
    null,
  ],
  ["an active chart around a chart", "chart", "chart", {}, activate],
  ["a selected chart around a chart", "chart", "chart", { selected: true }, null],
  ["a highlighted chart around a chart", "chart", "chart", {}, highlight],
  ["a chart fading its past around a chart", "chart", "chart", { fade: true }, null],
  ["a horizontal chart around a vertical chart", "chart", "chart", { orientation: "horizontal" }, null],
  [
    "a chart waiting for its entrance around a chart",
    "chart",
    "chart",
    {},
    hold({ "data-entrance": "waiting" }),
  ],
  [
    "a chart playing a centre entrance around a chart",
    "chart",
    "chart",
    { intro: "center" },
    hold({ "data-entrance": "played" }),
  ],
  ["an active scatter chart around a scatter chart", "scatter", "scatter", {}, activate],
  ["a pie around a chart", "pie", "chart", {}, activate],
  ["an active chart around a pie", "chart", "pie", {}, activate],
  ["a selected chart around a radar", "chart", "radar", { selected: true }, null],
  ["an active scatter chart around a clock", "scatter", "clock", {}, activate],
  ["a scatter chart around a chart", "scatter", "chart", {}, activate],
];

describe("a Root nested in another Root draws from its own state (S14, B6)", () => {
  it.each(CASES)("styles %s as the inner chart alone", async (_, outerFamily, innerFamily, props, setup) => {
    const expected = await alone(innerFamily);
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <Rest />
        <div style={{ width: 480 }}>{OUTER[outerFamily](<Boxed family={innerFamily} />, props)}</div>
      </LocaleProvider>
    );
    await rest();
    await waitDrawn(host);
    // DOM audit: the outer Root's figure, the first in the host.
    const outer = host.querySelector<HTMLElement>("figure");
    if (outer === null) throw new Error("no outer figure");
    await setup?.(outer);
    settle(host);
    expect(differences(styles(innerFigure(host)), expected)).toEqual([]);
  });

  it("styles a chart two Roots deep, inside a chart inside an active chart, as the chart alone", async () => {
    const expected = await alone("chart");
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <Rest />
        <div style={{ width: 480 }}>
          {OUTER.chart(
            <div style={{ width: 240 }}>{OUTER.chart(<Boxed family="chart" />, { intro: "none" })}</div>,
            { intro: "none" }
          )}
        </div>
      </LocaleProvider>
    );
    await rest();
    await waitDrawn(host);
    // DOM audit: the outer Root's figure, the first in the host.
    const outer = host.querySelector<HTMLElement>("figure");
    if (outer === null) throw new Error("no outer figure");
    await activate(outer);
    settle(host);
    expect(differences(styles(innerFigure(host)), expected)).toEqual([]);
  });

  it.each(["chart", "scatter", "pie", "clock"] as const)(
    "styles a nested %s's own hover as the same hover alone",
    async (family) => {
      const expected = await alone(family, activateOwn);
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <Rest />
          <div style={{ width: 480 }}>{OUTER.chart(<Boxed family={family} />, {})}</div>
        </LocaleProvider>
      );
      await rest();
      await waitDrawn(host);
      await activateOwn(innerFigure(host));
      settle(host);
      expect(differences(styles(innerFigure(host)), expected)).toEqual([]);
    }
  );
});
