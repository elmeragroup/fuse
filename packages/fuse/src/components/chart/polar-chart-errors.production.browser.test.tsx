// The polar data rules in React's production build (S10). Units under test: PieChart.Root and
// RadarChart.Root. Oracle: the fallback each rule's message names, written by hand. A negative
// reading draws as 0 and keeps its sign in the Table, a fifth radar series is left out, and a
// category the config lacks folds into the Other slice. Each warns once, a render later included.
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { label } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";

let warn = vi.spyOn(console, "warn");

afterEach(() => {
  warn.mockRestore();
});

function spy(): void {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
} as const;

/** Dispatch a pointer move onto the dial at an angle, halfway out from its centre. */
async function hoverAngle(angle: number): Promise<void> {
  const surface = page.getByRole("listbox").element();
  const box = surface.getBoundingClientRect();
  const radians = (angle * Math.PI) / 180;
  surface.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: box.left + box.width / 2 + (box.width / 4) * Math.sin(radians),
      clientY: box.top + box.height / 2 - (box.height / 4) * Math.cos(radians),
      pointerType: "mouse",
    })
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("the polar data rules in production", () => {
  it("draws a negative reading as 0, keeps its sign in the Table, and warns once", async () => {
    spy();
    const rows = [
      { name: "strom", v: 60 },
      { name: "nettleie", v: -20 },
      { name: "avgifter", v: 40 },
    ];
    const chart = (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <PieChart.Root data={rows} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning">
            <PieChart.Tooltip />
            <PieChart.Table />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart);
    rerender(chart);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("draws the value as 0");
    // Strøm sweeps 0° to 216° and Avgifter 216° to 360°: Nettleie draws no width.
    await hoverAngle(100);
    await expect.poll(label).toBe("Strøm");
    await hoverAngle(250);
    await expect.poll(label).toBe("Avgifter");
    // DOM audit: each cell prints its text beside a hidden spoken twin, so the printed text is read.
    const values = [...host.querySelectorAll("tbody tr")].map(
      (row) =>
        row.children[1]?.querySelector('[aria-hidden="true"]')?.textContent ?? row.children[1]?.textContent
    );
    expect(values).toEqual(["60", "\u221220", "40"]);
  });

  it("counts a reading that is not a finite number as missing, and warns once with its row (B9)", () => {
    spy();
    const rows = [
      { name: "strom", v: 60 },
      { name: "nettleie", v: Number.NaN },
    ];
    const chart = (
      <LocaleProvider locale="nb-NO">
        <PieChart.Root data={rows} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning" />
      </LocaleProvider>
    );
    const { rerender } = renderThemed(chart);
    rerender(chart);
    expect(warn).toHaveBeenCalledTimes(1);
    // The NaN sits in row 1, the Nettleie category.
    expect(String(warn.mock.calls[0]?.[0])).toContain("PieChart.Root");
    expect(String(warn.mock.calls[0]?.[0])).toContain("Row 1");
    expect(String(warn.mock.calls[0]?.[0])).toContain('"nettleie"');
  });

  it("compares a radar's first four series, leaves the fifth out, and warns once", () => {
    spy();
    // A config built at run time, whose keys the type-level cap cannot count.
    const config: ChartConfig = {
      no1: { label: "NO1", color: "chart-1" },
      no2: { label: "NO2", color: "chart-2" },
      no3: { label: "NO3", color: "chart-3" },
      no4: { label: "NO4", color: "chart-4" },
      no5: { label: "NO5", color: "chart-5" },
    };
    const rows = ["Vinter", "Vår", "Sommer"].map((season, index) => ({
      season,
      no1: 40 + index,
      no2: 50 + index,
      no3: 30 + index,
      no4: 20 + index,
      no5: 60 + index,
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <RadarChart.Root data={rows} config={config} nameKey="season" aria-label="Pris per sesong">
            <RadarChart.Legend />
          </RadarChart.Root>
        </div>
      </LocaleProvider>
    );
    expect(warn).toHaveBeenCalledTimes(1);
    // DOM audit: the legend's items carry their slot, and each item's text is its series label.
    expect(
      [...host.querySelectorAll('[data-slot="chart-legend-item"]')].map((item) => item.textContent)
    ).toEqual(["NO1", "NO2", "NO3", "NO4"]);
  });

  it("folds a category the config lacks into Other, counted as one category, and warns once", async () => {
    spy();
    const rows = [
      { name: "strom", v: 50 },
      { name: "fjernvarme", v: 20 },
      { name: "nettleie", v: 30 },
    ];
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <PieChart.Root data={rows} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning" />
        </div>
      </LocaleProvider>
    );
    expect(warn).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await userEvent.keyboard("{End}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Annet, 1\u00a0kategori: 20, 20\u00a0prosent"
    );
    expect(document.activeElement?.getAttribute("aria-setsize")).toBe("3");
  });
});
