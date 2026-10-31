// Bar layout judges in Chromium. Oracles: section 8.15's hand-derived band of
// 40 px with 14 px grouped bars at 5 and 21 px, section 8.12's structural counts per form, section
// 8.14's plot heights, section 8.10's tie fixture, and metamorphic relations: a locale change
// leaves geometry unchanged, scaling the data scales the ticks, and an all-zero series added to a
// stack moves no other mark.
import { useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import type { BarBox } from "../../../test/chart/bar-box";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { barLayerBox, bars } from "../../../test/chart/marks";
import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";
import fallBack from "./format/fixtures/prices/fall-back-2025-10-26-quarter.json" with { type: "json" };
import spike from "./format/fixtures/prices/negative-spike-2026-05-24-quarter.json" with { type: "json" };

const TWO = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const satisfies ChartConfig;

function boxes(host: HTMLElement, series?: number): BarBox[] {
  const plot = barLayerBox(host);
  return bars(host, series).map((bar) => barBox(bar, plot));
}

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
}

describe("bars in a band", () => {
  function two(
    children: ReactNode,
    data: readonly { name: string; a: number; b: number }[] = [
      { name: "x", a: 4, b: 2 },
      { name: "y", a: 3, b: 1 },
    ]
  ) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 80 }}>
          <Chart.Root data-intro="none" data={data} config={TWO} xKey="name" aria-label="To">
            {children}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws a two-key group's bars 14 px wide at 5 and 21 px of a 40 px band", () => {
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const [a] = boxes(host, 0);
    const [b] = boxes(host, 1);
    near(a?.left ?? 0, 5);
    near(a?.right ?? 0, 19);
    near(b?.left ?? 0, 21);
    near(b?.right ?? 0, 35);
    // The second band starts at 40 px.
    near(boxes(host, 0)[1]?.left ?? 0, 45);
  });

  it("rests a Marker and its pill on the first grouped bar's middle and tip (B1-5, Q1-4)", () => {
    // One category on 300 px: the band keeps 225 px inside its 25 % gap, from 37.5 px, and two bars
    // with the default 2 px gap take 111.5 px each, so the first spans 37.5 to 149 px and its
    // middle lies at 93.25 px, never at the slot's centre at 150 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data-intro="none"
            data={[{ name: "x", a: 3, b: 4 }]}
            config={TWO}
            xKey="name"
            aria-label="To">
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
            <Chart.Marker dataKey="a" at="first">
              <Chart.ValueLabel />
            </Chart.Marker>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const [bar] = boxes(host, 0);
    // DOM audit: the marker's dot and its pill's anchor are aria-hidden plot output.
    const dot = host.querySelector('[data-slot="chart-marker"] > svg > [data-slot="chart-dot"]');
    const anchor = host.querySelector<HTMLElement>('[data-slot="chart-marker"] > [data-part="anchor"]');
    const cx = Number(dot?.getAttribute("cx"));
    expect(Math.abs(cx - 93.25)).toBeLessThanOrEqual(0.75);
    near(cx, ((bar?.left ?? 0) + (bar?.right ?? 0)) / 2);
    near(Number(dot?.getAttribute("cy")), bar?.top ?? 0);
    expect(Number.parseFloat(anchor?.style.getPropertyValue("--chart-marker-x") ?? "")).toBe(cx);
  });

  it("rests every Marker a tied maximum or a listed selection picks on its own bar (B2-4, Q2-3)", () => {
    // 80 px and two categories in a BarGroup of a = [3, 3] and b = [4, 4]: a's bars span 5 to 19
    // and 45 to 59 px, so a's markers centre at 12 and 52 px, never at the groups' 20 and 60.
    for (const at of ["max", { x: ["x", "y"] }] as const) {
      const { host, unmount } = renderThemed(
        two(
          <>
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
            <Chart.Marker dataKey="a" at={at}>
              <Chart.ValueLabel />
            </Chart.Marker>
          </>,
          [
            { name: "x", a: 3, b: 4 },
            { name: "y", a: 3, b: 4 },
          ]
        )
      );
      // DOM audit: the marker's dots and pill anchors are aria-hidden plot output.
      const dots = [...host.querySelectorAll('[data-slot="chart-marker"] > svg > [data-slot="chart-dot"]')];
      const anchors = [
        ...host.querySelectorAll<HTMLElement>('[data-slot="chart-marker"] > [data-part="anchor"]'),
      ];
      const middles = boxes(host, 0).map(({ left, right }) => (left + right) / 2);
      expect(middles, JSON.stringify(at)).toEqual([12, 52]);
      expect(dots.map((dot) => Number(dot.getAttribute("cx")) - 0.5)).toEqual(middles);
      expect(
        anchors.map((anchor) => Number.parseFloat(anchor.style.getPropertyValue("--chart-marker-x")) - 0.5)
      ).toEqual(middles);
      unmount();
    }
  });

  it("centres ActiveValue over its own grouped bar at rest and through an update (B2-7)", () => {
    // 300 px and one category: a's bar spans 37.5 to 149 px, so its value centres over the bar's
    // drawn middle, near 93.25 px, at rest and in every frame of an update that changes only a's
    // value, never over the group's centre at 150 px.
    const clock = installFrameClock();
    try {
      const chart = (a: number) => (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 300 }}>
            <Chart.Root
              data-intro="none"
              data={[{ name: "x", a, b: 4 }]}
              config={TWO}
              xKey="name"
              yInclude={[0, 4]}
              aria-label="To">
              <Chart.BarGroup series={["a", "b"]}>
                <Chart.Bar dataKey="a" />
                <Chart.Bar dataKey="b" />
              </Chart.BarGroup>
              <Chart.ActiveValue dataKey="a" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart(3));
      // DOM audit: ActiveValue is aria-hidden plot output, placed by its share of the plot.
      const centre = () =>
        Number.parseFloat(
          host
            .querySelector<HTMLElement>('[data-slot="chart-active-value"]:not([data-outgoing])')
            ?.style.getPropertyValue("--chart-value-at") ?? ""
        ) * barLayerBox(host).width;
      const [bar] = boxes(host, 0);
      const middle = ((bar?.left ?? 0) + (bar?.right ?? 0)) / 2;
      expect(Math.abs(middle - 93.25)).toBeLessThanOrEqual(0.5);
      expect(centre()).toBeCloseTo(middle, 4);
      const start = clock.now();
      rerender(chart(2));
      for (const ms of [0, 120, 240, 600]) {
        clock.frameAt(start + ms);
        expect(centre(), String(ms)).toBeCloseTo(middle, 4);
      }
    } finally {
      clock.restore();
    }
  });

  it("takes a BarGroup's own 10 px bar gap: 10 px bars at 5 and 25 px of each 40 px band", () => {
    // Each 40 px band keeps 30 px inside its 25 % gap, from 5 px. Two bars and one 10 px gap split
    // it into 10 px bars at 5 and 25 px, and at 45 and 65 px in the second band.
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": "10px" }}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const edges = [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    expect(edges).toHaveLength(8);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges[index] ?? 0, edge));
  });

  it("keeps a 20 px bar gap that leaves the bars width: 5 px bars at 5 and 30 px of each 40 px band", () => {
    // Q7-3: 30 px inside each band's 25 % gap, less one 20 px gap, leaves two 5 px bars. The gap
    // stays as asked, so the bars sit at 5 and 30 px, and at 45 and 70 px in the second band.
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": "20px" }}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const edges = [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    expect(edges).toHaveLength(8);
    [5, 10, 45, 50, 30, 35, 70, 75].forEach((edge, index) => near(edges[index] ?? 0, edge));
  });

  it("redraws memoized bars when only the group's own spacing changes", async () => {
    // B2-2: the group's gap grows from 2 to 10 px while its Bars skip rendering. 14 px bars at 5
    // and 21 px become 10 px bars at 5 and 25 px, as the 30 px inside each band splits anew.
    const control = { widen: (): void => undefined };
    function Group({ children }: { readonly children: ReactNode }) {
      const [gap, setGap] = useState("2px");
      useLayoutEffect(() => {
        control.widen = () => {
          setGap("10px");
        };
      });
      return (
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": gap }}>
          {children}
        </Chart.BarGroup>
      );
    }
    // One element for the Bars, so the group's renders hand React the same children to skip.
    const members = (
      <>
        <Chart.Bar dataKey="a" />
        <Chart.Bar dataKey="b" />
      </>
    );
    const { host } = renderThemed(two(<Group>{members}</Group>));
    const edges = () => [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    [5, 19, 45, 59, 21, 35, 61, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
    control.widen();
    await expect.poll(() => Math.round(edges()[1] ?? 0)).toBe(15);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
  });

  it("redraws a group that never renders again when Root's own spacing changes", async () => {
    // B3-3: Root's gap grows from 2 to 10 px while the group's element stays the same. The bars
    // become 10 px wide at 5 and 25 px of each 40 px band.
    const group = (
      <Chart.BarGroup series={["a", "b"]}>
        <Chart.Bar dataKey="a" />
        <Chart.Bar dataKey="b" />
      </Chart.BarGroup>
    );
    // The same rows on every render, so only Root's style changes.
    const rows = [
      { name: "x", a: 4, b: 2 },
      { name: "y", a: 3, b: 1 },
    ];
    const chart = (gap: string) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 80 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={TWO}
            xKey="name"
            style={{ "--chart-bar-gap": gap }}
            aria-label="To">
            {group}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart("2px"));
    const edges = () => [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    [5, 19, 45, 59, 21, 35, 61, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
    rerender(chart("10px"));
    await expect.poll(() => Math.round(edges()[1] ?? 0)).toBe(15);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
  });

  it("fills the band less the 25 % gap outside a group", () => {
    const { host } = renderThemed(two(<Chart.Bar dataKey="a" />));
    const [first] = boxes(host);
    near(first?.left ?? 0, 5);
    near(first?.right ?? 0, 35);
  });
});

/** The quality of day index 20, estimated, and of day index 10, missing. */
function qualityAt(index: number): ChartQuality | undefined {
  if (index === 20) return "estimated";
  return index === 10 ? "missing" : undefined;
}

describe("bars denser than the device pixels", () => {
  it("keeps one device pixel for every bar of 100 categories in two series on a 400 px plot", async () => {
    // B2-1 at DPR 1: each 4 px band keeps 3 px inside its 25 % gap, and two bars 2 px apart get
    // 0.5 px each, from 4i + 0.5 and 4i + 3. The first snaps to [4i, 4i + 1], and the second,
    // whose edges both snap to 4i + 3, keeps one pixel to 4i + 4.
    expect(devicePixelRatio).toBe(1);
    const rows = Array.from({ length: 100 }, (_, index) => ({ name: `c${String(index)}`, a: 2, b: 3 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Tett">
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    expect(barLayerBox(host).width).toBe(400);
    for (const series of [0, 1]) {
      const drawn = boxes(host, series);
      expect(drawn).toHaveLength(100);
      drawn.forEach(({ left, right }, index) => {
        near(left, 4 * index + (series === 0 ? 0 : 3));
        near(right - left, 1);
      });
    }
    // The active overlay draws the same rectangle over the second slot.
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: the overlays are aria-hidden plot output.
    const overlays = [...host.querySelectorAll('[data-slot="chart-bar-active"]')];
    expect(
      overlays.map((overlay) => [overlay.getAttribute("visibility"), overlay.getAttribute("width")])
    ).toEqual([
      ["visible", "1"],
      ["visible", "1"],
    ]);
  });
});

describe("structural counts per form", () => {
  function quarters(rows: readonly { readonly time_start: string; readonly SEK_per_kWh: number }[]) {
    return (
      <LocaleProvider locale="sv-SE">
        <Chart.Root
          data-intro="none"
          data={rows.map((row) => ({ start: new Date(row.time_start), price: row.SEK_per_kWh }))}
          config={{ price: { label: "Spotpris", color: "chart-diverging" } }}
          xKey="start"
          interval="quarter-hour"
          timeZone="Europe/Stockholm"
          aria-label="Spotpris">
          <Chart.Bar dataKey="price" />
        </Chart.Root>
      </LocaleProvider>
    );
  }

  it("draws 96 boxes for the spike day's quarters", () => {
    expect(bars(renderThemed(quarters(spike)).host)).toHaveLength(96);
  });

  it("draws 100 boxes for the fall-back day's quarters", () => {
    expect(bars(renderThemed(quarters(fallBack)).host)).toHaveLength(100);
  });

  it("draws 365 days as one path per series, one per quality state and emphasis as overlay boxes", () => {
    // Oslo midnight is 23:00 UTC, and 22:00 UTC in summer time, from 31 March to 26 October 2025.
    const start = Date.UTC(2025, 0, 1, -1);
    const rows = Array.from({ length: 365 }, (_, index) => ({
      day: new Date(start + index * 86_400_000 - (index >= 89 && index <= 298 ? 3_600_000 : 0)),
      kwh: index === 10 ? null : 10 + (index % 30),
      q: qualityAt(index),
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data-intro="none"
          data={rows}
          config={{ kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" } }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host)).toHaveLength(0);
    // DOM audit: path-form bars are aria-hidden plot output.
    const paths = [...host.querySelectorAll('[data-slot="chart-bar-path"]')];
    // The fill, projected, estimated and missing paths stay mounted, whether or not they draw.
    expect(paths.map((path) => path.getAttribute("data-quality"))).toEqual([
      null,
      null,
      "estimated",
      "missing",
    ]);
    // 39 is the highest value, on day indices 29, 59 and on to 359, so 12 days tie.
    expect(host.querySelectorAll('[data-slot="chart-bar-emphasis"]')).toHaveLength(12);
  });
});

/** The heights of a path's columns, one `M x y H x V y` rectangle each, in order. */
function columnHeights(path: Element | null | undefined): number[] {
  return [...(path?.getAttribute("d") ?? "").matchAll(/M[\d.]+ ([\d.]+)H[\d.]+V([\d.]+)/gu)].map(
    ([, top = "0", bottom = "0"]) => Number(bottom) - Number(top)
  );
}

/** The rectangles of a path-form fill, one `M x y H x V y` subpath each. */
function rectsOfFill(path: Element | null | undefined) {
  return [...(path?.getAttribute("d") ?? "").matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)/gu)].map(
    ([, x = "0", top = "0", right = "0", bottom = "0"]) => ({
      x: Number(x),
      width: Number(right) - Number(x),
      height: Number(bottom) - Number(top),
    })
  );
}

/** The oracle's eased progress 120 ms into a 480 ms tween. */
function easedAt120(): number {
  const { from, to, at } = frames.references.line;
  return (at[120] - from) / (to - from);
}

describe("path form motion", () => {
  /** A 365-category chart with no axes, the plot its whole 1,095 px width. */
  function year(
    data: readonly { name: string; a: number | null }[],
    color: "chart-1" | "chart-seq" = "chart-1",
    yInclude?: readonly number[]
  ) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 1095 }}>
          <Chart.Root
            data-intro="none"
            data={data}
            config={{ a: { label: "A", color } }}
            xKey="name"
            yInclude={yInclude}
            aria-label="År">
            <Chart.Bar dataKey="a" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("shrinks columns whose readings all fall to 0, keeping their fill path mounted (Q1-3)", () => {
    // 365 readings of 10 under yInclude [10] all go to 0. The domain stays [0, 10], so each column
    // shrinks from the plot's full height h toward the zero line and is h × (1 − eased) tall at
    // 120 ms, while at rest the fill path draws nothing.
    const clock = installFrameClock();
    try {
      const rows = (value: number) =>
        Array.from({ length: 365 }, (_, index) => ({ name: `d${String(index)}`, a: value }));
      const { host, rerender } = renderThemed(year(rows(10), "chart-1", [10]));
      // DOM audit: the path form's fill is aria-hidden plot output.
      const fill = () => host.querySelector('[data-slot="chart-bar-path"][data-part="fill"]');
      const full = columnHeights(fill())[0] ?? 0;
      expect(full).toBeGreaterThan(100);
      const start = clock.now();
      rerender(year(rows(0), "chart-1", [10]));
      clock.frameAt(start + 120);
      const heights = columnHeights(fill());
      expect(heights).toHaveLength(365);
      for (const height of heights)
        expect(Math.abs(height - full * (1 - easedAt120()))).toBeLessThanOrEqual(1);
      clock.frameAt(start + 600);
      expect(fill()?.getAttribute("d")).toBe("");
    } finally {
      clock.restore();
    }
  });

  it("shrinks a scale's columns in their own step's path when their readings leave (B1-8)", () => {
    // 365 scale-coloured readings of 0, 50 and 100 in turn. Every 50 becomes null with the domain
    // still [0, 100], so the 50s' step path, which draws nothing at rest after the update, still
    // draws its 122 columns at half the full height × (1 − eased) 120 ms in.
    const clock = installFrameClock();
    try {
      const rows = (half: number | null) =>
        Array.from({ length: 365 }, (_, index) => ({
          name: `d${String(index)}`,
          a: [0, half, 100][index % 3] ?? null,
        }));
      const { host, rerender } = renderThemed(year(rows(50), "chart-seq"));
      // DOM audit: the path form's step paths are aria-hidden plot output.
      const steps = () => [...host.querySelectorAll('[data-slot="chart-bar-path"][data-part="fill"]')];
      const halves = steps().find(
        (path) => columnHeights(path).length === 122 && path.getAttribute("d")?.includes("V")
      );
      const tall = Math.max(...steps().flatMap((path) => columnHeights(path)));
      const step = halves?.getAttribute("data-fill");
      const full = columnHeights(halves)[0] ?? 0;
      expect(Math.abs(full - tall / 2)).toBeLessThanOrEqual(1);
      const start = clock.now();
      rerender(year(rows(null), "chart-seq"));
      clock.frameAt(start + 120);
      const path = host.querySelector(`[data-slot="chart-bar-path"][data-fill="${step ?? ""}"]`);
      const heights = columnHeights(path);
      expect(heights).toHaveLength(122);
      for (const height of heights)
        expect(Math.abs(height - full * (1 - easedAt120()))).toBeLessThanOrEqual(1);
    } finally {
      clock.restore();
    }
  });

  it("slides the active overlay with its column when a category is appended (Q1-5)", () => {
    // 365 categories on 1,095 px, 3 px a slot, with no axes. A slot's bar span keeps 2.25 px of its
    // 3 px inside the 25 % band gap, from 0.375 px. One category is appended and the first dropped,
    // so the active column slides one slot left, from 3 (q + 1) + 0.375 px to its rest at 3q px,
    // and the overlay over it moves the same way at the oracle's eased progress.
    const clock = installFrameClock();
    try {
      const rows = (from: number) =>
        Array.from({ length: 365 }, (_, index) => ({ name: `d${String(from + index)}`, a: 10 }));
      const chart = (data: readonly { name: string; a: number }[]) => (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 1095 }}>
            <Chart.Root data-intro="none" data={data} config={{ a: TWO.a }} xKey="name" aria-label="År">
              <Chart.Bar dataKey="a" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart(rows(0)));
      // DOM audit: the listbox is the plot's pointer surface, and the overlay is aria-hidden output.
      const surface = host.querySelector<HTMLElement>('[role="listbox"]');
      const box = surface?.getBoundingClientRect() ?? new DOMRect();
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + 3 * 182 + 1.5,
          clientY: box.top + box.height / 2,
          pointerType: "mouse",
        })
      );
      const overlay = () => host.querySelector('[data-slot="chart-bar-active"]');
      const start = clock.now();
      rerender(chart(rows(1)));
      clock.frameAt(start + 120);
      const moving = Number(overlay()?.getAttribute("x"));
      clock.frameAt(start + 600);
      const rest = Number(overlay()?.getAttribute("x"));
      expect(rest % 3).toBe(0);
      expect(moving).toBeGreaterThan(rest);
      expect(Math.abs(moving - (rest + 3.375 * (1 - easedAt120())))).toBeLessThanOrEqual(1);
    } finally {
      clock.restore();
    }
  });
});

describe("markers in a staggered entrance (Q3-1)", () => {
  it("raises each tied maximum's marker and pill with its own bar, on that bar's delay", () => {
    // 30 equal bars on 300 px grow from the baseline in the left entrance, bar k 16k ms after the
    // first, so the last waits 464 ms. Every slot is a maximum, so each marker and pill must sit
    // on its own bar's top in every frame: at 120 ms the first has risen and the last has not.
    const clock = installFrameClock();
    try {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 300 }}>
            <Chart.Root
              data={Array.from({ length: 30 }, (_, index) => ({ name: `c${String(index)}`, a: 3 }))}
              config={{ a: TWO.a }}
              xKey="name"
              yInclude={[0, 4]}
              aria-label="Tretti">
              <Chart.Bar dataKey="a" />
              <Chart.Marker dataKey="a" at="max">
                <Chart.ValueLabel />
              </Chart.Marker>
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      const start = clock.now();
      for (const ms of [120, 300, 600]) {
        clock.frameAt(start + ms);
        // DOM audit: the marker's dots and pill anchors are aria-hidden plot output.
        const dots = [...host.querySelectorAll('[data-slot="chart-marker"] > svg > [data-slot="chart-dot"]')];
        const anchors = [
          ...host.querySelectorAll<HTMLElement>('[data-slot="chart-marker"] > [data-part="anchor"]'),
        ];
        const tops = boxes(host, 0).map(({ top }) => top);
        expect(dots).toHaveLength(30);
        dots.forEach((dot, index) => {
          near(Number(dot.getAttribute("cy")), tops[index] ?? Number.NaN);
          near(
            Number.parseFloat(anchors[index]?.style.getPropertyValue("--chart-marker-y") ?? ""),
            tops[index] ?? 0
          );
        });
        if (ms === 120) expect((tops.at(-1) ?? 0) - (tops[0] ?? 0)).toBeGreaterThan(20);
      }
    } finally {
      clock.restore();
    }
  });
});

describe("decimated path form", () => {
  it("slides a decimated column with its data when the window moves by a bucket (Q3-2)", () => {
    // 2,500 categories on 1,000 by 200 px, 0.4 px a slot, all 1 but c1005 = 100 over [0, 100].
    // M4's 500 buckets hold 5 slots each, so c1005 heads bucket 201, a 2 px column from 402 px.
    // c0 to c2499 becomes c5 to c2504, a five-slot slide, and the spike's bucket becomes bucket
    // 200, from 400 px: one 200 px column slides 2 px left, at 402 - 2 × eased on the way.
    const clock = installFrameClock();
    try {
      const rows = (from: number) =>
        Array.from({ length: 2500 }, (_, index) => ({
          name: `c${String(from + index)}`,
          a: from + index === 1005 ? 100 : 1,
        }));
      const chart = (data: readonly { name: string; a: number }[]) => (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 1000 }}>
            <Chart.Root
              data-intro="none"
              data={data}
              config={{ a: TWO.a }}
              xKey="name"
              yInclude={[0, 100]}
              style={{ "--chart-plot-height": "200px" }}
              aria-label="Mange">
              <Chart.Bar dataKey="a" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart(rows(0)));
      // DOM audit: the path form's fill is aria-hidden plot output.
      const tall = () =>
        rectsOfFill(host.querySelector('[data-slot="chart-bar-path"][data-part="fill"]')).filter(
          ({ height }) => height > 150
        );
      expect(tall().map(({ x, width, height }) => [x, width, height])).toEqual([[402, 2, 200]]);
      const start = clock.now();
      rerender(chart(rows(5)));
      clock.frameAt(start + 120);
      const moving = tall();
      expect(moving).toHaveLength(1);
      expect(Math.abs((moving[0]?.x ?? 0) - (402 - 2 * easedAt120()))).toBeLessThanOrEqual(0.5);
      // No column grows or shrinks in place on the way: each stays 2 or 200 px tall.
      const heights = rectsOfFill(host.querySelector('[data-slot="chart-bar-path"][data-part="fill"]')).map(
        ({ height }) => height
      );
      expect(heights.filter((height) => height > 3 && height < 199)).toEqual([]);
      clock.frameAt(start + 600);
      expect(tall().map(({ x, width, height }) => [x, width, height])).toEqual([[400, 2, 200]]);
    } finally {
      clock.restore();
    }
  });

  it("keeps a missing reading's tick and the emphasised maximum's box above 2,000 slots (Q1-2)", () => {
    // 2,400 categories on 600 px, a quarter pixel a slot, with no axes. Slot 1,200 is missing and
    // slot 1,800 holds the one maximum. Each draws one device pixel where its slot starts: the tick
    // from 300 to 301 px and the emphasis box from 450 to 451 px.
    const rows = Array.from({ length: 2400 }, (_, index) => ({
      name: `c${String(index)}`,
      a: index === 1200 ? null : index === 1800 ? 50 : 10 + (index % 7),
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 600 }}>
          <Chart.Root data-intro="none" data={rows} config={{ a: TWO.a }} xKey="name" aria-label="Mange">
            <Chart.Bar dataKey="a" emphasis="max" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the missing ticks and the emphasis boxes are aria-hidden plot output.
    const missing = host
      .querySelector('[data-slot="chart-bar-path"][data-quality="missing"]')
      ?.getAttribute("d");
    const ticks = [...(missing ?? "").matchAll(/M([\d.]+) [\d.]+H([\d.]+)/gu)].map(
      ([, from = "", to = ""]) => [Number(from), Number(to)]
    );
    expect(ticks).toEqual([[300, 301]]);
    const boxes = [...host.querySelectorAll('[data-slot="chart-bar-emphasis"]')].map((rect) => [
      Number(rect.getAttribute("x")),
      Number(rect.getAttribute("width")),
    ]);
    expect(boxes).toEqual([[450, 1]]);
  });
});

describe("default plot heights", () => {
  it("draws the plot between 183 and 220 px tall at 358 px wide", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 358 }}>
          <Chart.Root
            data-intro="none"
            data={[{ name: "x", a: 1, b: 1 }]}
            config={TWO}
            xKey="name"
            aria-label="Høyde">
            <Chart.Bar dataKey="a" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const height = barLayerBox(host).height;
    expect(height).toBeGreaterThanOrEqual(183);
    expect(height).toBeLessThanOrEqual(220);
  });

  it("draws 5 horizontal categories 160 px tall", () => {
    const rows = ["a", "b", "c", "d", "e"].map((name, index) => ({ name, a: index + 1, b: 1 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data-intro="none"
          data={rows}
          config={TWO}
          xKey="name"
          orientation="horizontal"
          aria-label="Rader">
          <Chart.Bar dataKey="a" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(barLayerBox(host).height).toBe(160);
  });

  it("gives the horizontal category axis the width of its longest label", () => {
    const rows = ["January", "February", "March"].map((name, index) => ({ name, a: index + 1, b: 1 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data-intro="none"
          data={rows}
          config={TWO}
          xKey="name"
          orientation="horizontal"
          aria-label="Rader">
          <Chart.XAxis />
          <Chart.Bar dataKey="a" />
        </Chart.Root>
      </LocaleProvider>
    );
    // DOM audit: the root and its ticks are aria-hidden plot output, so their slots are the locators.
    const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect() ?? new DOMRect();
    const ticks = [...host.querySelectorAll('[data-slot="chart-x-tick"]')].map((tick) =>
      tick.getBoundingClientRect()
    );
    expect(ticks).toHaveLength(3);
    // Every label sits whole inside the root and ends left of the plot.
    for (const tick of ticks) {
      expect(tick.left).toBeGreaterThanOrEqual(root.left - 0.5);
      expect(tick.right).toBeLessThanOrEqual(barLayerBox(host).left + 0.5);
    }
  });
});

describe("emphasis", () => {
  it("selects every tied maximum and speaks the dictionary word in the option", async () => {
    const rows = [1, 3, 3, 2].map((a, index) => ({ name: `k${String(index + 1)}`, a, b: 0 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Uthevet">
          <Chart.Bar dataKey="a" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true, true, false]);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowDown}");
    // The option moves focus to its new element after the commit, so the check waits for it.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("A 3, uthevet, k2");
  });

  it("compares stack totals for a stacked bar", () => {
    const rows = [
      { name: "x", a: 5, b: 1 },
      { name: "y", a: 3, b: 4 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data-intro="none"
          data={rows}
          config={{
            a: { label: "A", color: "chart-1", stack: "s" },
            b: { label: "B", color: "chart-2", stack: "s" },
          }}
          xKey="name"
          aria-label="Stablet">
          <Chart.Bar dataKey="a" emphasis="max" />
          <Chart.Bar dataKey="b" />
        </Chart.Root>
      </LocaleProvider>
    );
    // The totals are 6 and 7, so y is the maximum although a is higher at x.
    expect(bars(host, 0).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true]);
  });
});

const STACKED = {
  a: { label: "A", color: "chart-1", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

const WITH_ZERO = {
  a: { label: "A", color: "chart-1", stack: "s" },
  z: { label: "Z", color: "chart-3", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

describe("metamorphic relations", () => {
  function chart(locale: SupportedLocale, scale: number, zero: boolean) {
    const rows = [
      { name: "x", a: 2 * scale, b: 3 * scale, z: 0 },
      { name: "y", a: 4 * scale, b: 1 * scale, z: 0 },
    ];
    const config: ChartConfig = zero ? WITH_ZERO : STACKED;
    return (
      <LocaleProvider locale={locale}>
        <div style={{ width: 300 }}>
          <Chart.Root data-intro="none" data={rows} config={config} xKey="name" aria-label="Relasjoner">
            <Chart.YAxis />
            <Chart.Bar dataKey="a" />
            {zero ? <Chart.Bar dataKey="z" /> : null}
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("keeps the geometry when the locale changes", () => {
    const nb = boxes(renderThemed(chart("nb-NO", 1, false)).host);
    const en = boxes(renderThemed(chart("en-US", 1, false)).host);
    expect(en).toEqual(nb);
  });

  it("scales the value ticks with the data", () => {
    const ticks = (host: HTMLElement) =>
      // DOM audit: y ticks are aria-hidden text, so their slot is the only locator.
      [...host.querySelectorAll('[data-slot="chart-y-tick"]')].map((tick) =>
        Number(tick.textContent.replace(/[\s,]/gu, ""))
      );
    const one = ticks(renderThemed(chart("en-US", 1, false)).host);
    const thousand = ticks(renderThemed(chart("en-US", 1000, false)).host);
    expect(thousand).toEqual(one.map((tick) => tick * 1000));
  });

  it("moves no other mark when an all-zero series joins the stack", () => {
    const without = renderThemed(chart("nb-NO", 1, false)).host;
    const withZero = renderThemed(chart("nb-NO", 1, true)).host;
    expect(boxes(withZero, 0)).toEqual(boxes(without, 0));
    expect(boxes(withZero, 2)).toEqual(boxes(without, 1));
  });
});

describe("bars in measured pixels", () => {
  /** Each box rounded to the half pixel, the most a snap to the device pixel grid moves an edge. */
  function expectBoxes(actual: readonly BarBox[], wanted: readonly BarBox[]): void {
    expect(actual).toHaveLength(wanted.length);
    actual.forEach((box, index) => {
      for (const edge of ["left", "right", "top", "bottom"] as const)
        near(box[edge], wanted[index]?.[edge] ?? Number.NaN);
    });
  }

  function stacked(width: number) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width }}>
          <Chart.Root
            data-intro="none"
            data={[
              { name: "x", a: 3, b: 5 },
              { name: "y", a: 2, b: 2 },
            ]}
            config={STACKED}
            xKey="name"
            aria-label="Stablet">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws a stacked chart on a 400 × 200 plot where the hand-worked pixels say", () => {
    // Totals 8 and 4 on [0, 8] give 25 px per unit down a 200 px plot. Each 200 px band keeps its
    // middle 150 px. a's inner segment ends a 2 px seam below b, which tops its stack.
    const { host } = renderThemed(stacked(400));
    expectBoxes(boxes(host, 0), [
      { left: 25, right: 175, top: 127, bottom: 200 },
      { left: 225, right: 375, top: 152, bottom: 200 },
    ]);
    expectBoxes(boxes(host, 1), [
      { left: 25, right: 175, top: 0, bottom: 125 },
      { left: 225, right: 375, top: 100, bottom: 150 },
    ]);
  });

  it("redraws the bars at a new width once the plot resizes", async () => {
    // At 300 px each band is 150 px, so its bar keeps 18.75 to 131.25 px of it.
    const { host } = renderThemed(stacked(400));
    const frame = host.querySelector<HTMLElement>('[data-slot="chart"]')?.parentElement;
    frame?.style.setProperty("width", "300px");
    await expect
      .poll(() => Math.round(boxes(host, 1)[1]?.right ?? 0), { timeout: 2000 })
      .toBe(Math.round(281.25));
    expectBoxes(boxes(host, 1), [
      { left: 18.75, right: 131.25, top: 0, bottom: 125 },
      { left: 168.75, right: 281.25, top: 100, bottom: 150 },
    ]);
  });

  it("draws horizontal bars on 32 px rows from the zero line to the right", () => {
    // Values 6 and 3 on [0, 6] across a 400 px plot, and each 32 px row keeps its middle 24 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data-intro="none"
            data={[
              { name: "a", a: 6, b: 1 },
              { name: "b", a: 3, b: 1 },
            ]}
            config={TWO}
            xKey="name"
            orientation="horizontal"
            aria-label="Rader">
            <Chart.Bar dataKey="a" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    expectBoxes(boxes(host), [
      { left: 0, right: 400, top: 4, bottom: 28 },
      { left: 0, right: 200, top: 36, bottom: 60 },
    ]);
  });
});
