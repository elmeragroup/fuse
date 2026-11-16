// The linear x axis of issue #515 in Chromium. Unit under test: `xScale="linear"` on Chart.Root,
// from its rows to the drawn vertices, bars, ticks, options, tooltip and table. Oracle: the stated
// x domain, worked out by hand with d3's nice rule for 10 ticks, mapped onto the plot surface's
// measured client box, and the nb-NO words written by hand, never read from Fuse.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { bars, label, pointerAt, surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** An EV's charging power by state of charge, at unevenly spaced readings. */
const CURVE = [
  { soc: 0, kw: 50 },
  { soc: 5, kw: 120 },
  { soc: 20, kw: 150 },
  { soc: 50, kw: 110 },
  { soc: 100, kw: 10 },
] as const;

const CONFIG = {
  kw: { label: "Ladeeffekt", color: "chart-1", format: { preset: "power", unit: "kW" } },
} as const;

function Curve({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <button type="button">før</button>
      <div style={{ width: 640 }}>
        <Chart.Root
          data={CURVE}
          config={CONFIG}
          xKey="soc"
          xScale="linear"
          xFormat={{ style: "unit", unit: "percent" }}
          xLabel="Ladenivå"
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Ladekurve">
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The x a share of the stated domain lands on, in client pixels across the plot surface. */
function clientX(box: DOMRect, share: number): number {
  return box.left + share * box.width;
}

/** The focused option's name, position and set size. */
function focused(): readonly [string | null, string | null, string | null] {
  const element = document.activeElement;
  return [
    element?.getAttribute("aria-label") ?? null,
    element?.getAttribute("aria-posinset") ?? null,
    element?.getAttribute("aria-setsize") ?? null,
  ];
}

describe('xScale="linear"', () => {
  it("draws each vertex at its x number's share of the x domain", async () => {
    const { host } = renderThemed(
      <Curve>
        <Chart.Line dataKey="kw" curve="linear" />
        <Chart.Dots dataKey="kw" />
      </Curve>
    );
    // Dots are aria-hidden plot output, so their slot locates them.
    const dots = () => [...host.querySelectorAll<SVGCircleElement>('[data-slot="chart-dot"]')];
    await expect.poll(() => dots().length).toBe(5);
    const box = surfaceBox(host);
    // The x domain runs from 0 to 100, which d3's nice rule keeps, so 5 % sits at 5 % of the plot.
    const expected = [0, 0.05, 0.2, 0.5, 1].map((share) => clientX(box, share));
    const centers = dots().map((dot) => {
      const rect = dot.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    centers.forEach((center, index) => {
      expect(Math.abs(center - (expected[index] ?? 0))).toBeLessThanOrEqual(1);
    });
  });

  it("labels nice numbers in Root's xFormat, not one label per row", () => {
    const { host } = renderThemed(
      <Curve>
        <Chart.XAxis />
        <Chart.Line dataKey="kw" />
      </Curve>
    );
    // XAxis ticks are aria-hidden plot output, so their slot locates them.
    const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
    // d3's 10 ticks over 0 to 100 step by 10, thinned at narrow widths, and print in percent.
    const texts = ticks.map((tick) => tick.textContent);
    expect(texts).toEqual([
      "0\u00a0%",
      "10\u00a0%",
      "20\u00a0%",
      "30\u00a0%",
      "40\u00a0%",
      "50\u00a0%",
      "60\u00a0%",
      "70\u00a0%",
      "80\u00a0%",
      "90\u00a0%",
      "100\u00a0%",
    ]);
    expect(ticks.map((tick) => tick.style.getPropertyValue("--chart-at"))).toEqual([
      "0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1",
    ]);
  });

  it("steps the keyboard through every row in x order, naming each x with Root's xLabel", async () => {
    const shuffled = [CURVE[3], CURVE[0], CURVE[4], CURVE[1], CURVE[2]];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data={shuffled}
          config={CONFIG}
          xKey="soc"
          xScale="linear"
          xFormat={{ style: "unit", unit: "percent" }}
          xLabel="Ladenivå"
          data-intro="none"
          aria-label="Ladekurve">
          <Chart.Line dataKey="kw" />
        </Chart.Root>
      </LocaleProvider>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    const names = [focused()];
    for (let step = 0; step < 4; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
      names.push(focused());
    }
    // Rows arrive shuffled and the options run in ascending x, one per row.
    // Fuse writes every space it formats as U+00A0, and joins the parts with plain spaces.
    expect(names).toEqual([
      ["Ladenivå 0\u00a0prosent: Ladeeffekt 50\u00a0kilowatt", "1", "5"],
      ["Ladenivå 5\u00a0prosent: Ladeeffekt 120\u00a0kilowatt", "2", "5"],
      ["Ladenivå 20\u00a0prosent: Ladeeffekt 150\u00a0kilowatt", "3", "5"],
      ["Ladenivå 50\u00a0prosent: Ladeeffekt 110\u00a0kilowatt", "4", "5"],
      ["Ladenivå 100\u00a0prosent: Ladeeffekt 10\u00a0kilowatt", "5", "5"],
    ]);
  });

  it("picks the row nearest the pointer, and the tooltip prints its x in Root's xFormat", async () => {
    const { host } = renderThemed(
      <Curve>
        <Chart.Line dataKey="kw" />
        <Chart.Tooltip />
      </Curve>
    );
    await expect.poll(() => surfaceBox(host).width).toBeGreaterThan(0);
    const box = surfaceBox(host);
    const y = box.top + box.height / 2;
    // 30 % lies nearer 20 % than 50 %, and 40 % nearer 50 %: the cells meet halfway, at 35 %.
    await pointerAt(clientX(box, 0.3), y);
    await expect.poll(label).toBe("20\u00a0%");
    await pointerAt(clientX(box, 0.4), y);
    await expect.poll(label).toBe("50\u00a0%");
  });

  it("heads the table's x column with xLabel and lists each row's x in Root's xFormat", async () => {
    renderThemed(
      <Curve>
        <Chart.Line dataKey="kw" />
        <Chart.Table />
      </Curve>
    );
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    const table = page.getByRole("table").element();
    const headers = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent);
    expect(headers[0]).toBe("Ladenivå");
    // Each row header prints its x and speaks it, as the twin spans of a formatted label do.
    const heads = page.getByRole("rowheader").elements();
    expect(heads.map((cell) => cell.querySelector('[aria-hidden="true"]')?.textContent)).toEqual([
      "0\u00a0%",
      "5\u00a0%",
      "20\u00a0%",
      "50\u00a0%",
      "100\u00a0%",
    ]);
    expect(heads.map((cell) => cell.querySelector(".sr-only")?.textContent)).toEqual([
      "0\u00a0prosent",
      "5\u00a0prosent",
      "20\u00a0prosent",
      "50\u00a0prosent",
      "100\u00a0prosent",
    ]);
  });

  it("centers each bar on its x and gives every bar the closest pair's pitch less the band gap", async () => {
    const rows = [
      { kw: 10, price: 1 },
      { kw: 20, price: 2 },
      { kw: 40, price: 3 },
      { kw: 50, price: 4 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 640 }}>
          <Chart.Root
            data={rows}
            config={{ price: { label: "Pris", color: "chart-1" } }}
            xKey="kw"
            xScale="linear"
            xInclude={[0, 60]}
            data-intro="none"
            style={{ "--chart-plot-height": "200px", "--chart-band-gap": "20%" }}
            aria-label="Pris per trinn">
            <Chart.Bar dataKey="price" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await expect.poll(() => bars(host).length).toBe(4);
    const box = surfaceBox(host);
    // The domain runs from 0 to 60. The closest x values lie 10 apart, a sixth of the plot, and a
    // bar fills 80 % of that, so every bar is 8/60 of the plot wide and centered on its x.
    const width = (box.width * 10 * 0.8) / 60;
    for (const [index, bar] of bars(host).entries()) {
      const rect = bar.getBoundingClientRect();
      const center = clientX(box, (rows[index]?.kw ?? 0) / 60);
      expect(Math.abs(rect.left + rect.width / 2 - center)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.width - width)).toBeLessThanOrEqual(1);
    }
  });

  it("holds each step from its x to the next under step-after, the last to the plot's end", async () => {
    const steps = [
      { kw: 0, price: 80 },
      { kw: 2, price: 120 },
      { kw: 5, price: 200 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 640 }}>
          <Chart.Root
            data={steps}
            config={{ price: { label: "Pris", color: "chart-1" } }}
            xKey="kw"
            xScale="linear"
            xInclude={[10]}
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Kapasitetsledd">
            <Chart.Line dataKey="price" curve="step-after" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // The line is aria-hidden plot output, so its slot locates it.
    const path = () =>
      host.querySelector('[data-slot="chart-line"][data-part="solid"]')?.getAttribute("d") ?? "";
    await expect.poll(path).not.toBe("");
    const box = surfaceBox(host);
    // Each run's two ends, read off the path's points along x: 0 to 2, 2 to 5 and 5 to 10 kW of a
    // domain from 0 to 10.
    const xs = [...path().matchAll(/[ML]([\d.-]+),/gu)].map((match) => Number(match[1]) + box.left);
    const expected = [0, 0.2, 0.2, 0.5, 0.5, 1].map((share) => clientX(box, share));
    expect(xs).toHaveLength(expected.length);
    xs.forEach((x, index) => {
      expect(Math.abs(x - (expected[index] ?? 0))).toBeLessThanOrEqual(1);
    });
  });
});
