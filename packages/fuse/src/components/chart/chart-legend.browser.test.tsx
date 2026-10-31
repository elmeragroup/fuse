// The legend toggles' target size, name and pressed cue, in Chromium. The
// expectations come from CONTRACT section 9.9 and AGENTS.md's 24 px floor.
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { DENSITIES } from "../../theme";
import { Chart } from "./chart-namespace";
import "./chart.css";

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

function legend() {
  return renderThemed(
    <S06Chart>
      <Chart.Bar dataKey="household" />
      <Chart.LegendToggleGroup />
    </S06Chart>
  );
}

describe("legend toggles", () => {
  it.each(DENSITIES)("hold the 24 px target floor at %s density", (density) => {
    stampDensity(density);
    legend();
    for (const name of ["Husholdning", "Hytte"]) {
      const box = page.getByRole("button", { name }).element().getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
  });

  it("names each toggle by its visible label and sits in a group named Serier", () => {
    legend();
    expect(page.getByRole("group", { name: "Serier" }).element()).toBeTruthy();
    expect(page.getByRole("button", { name: "Husholdning" }).element().textContent).toBe("Husholdning");
  });

  it("presses one toggle at a time, clears on a second press and announces each change", async () => {
    const { host } = legend();
    const status = host.querySelector('[role="status"]');
    await userEvent.click(page.getByRole("button", { name: "Hytte" }));
    expect(page.getByRole("button", { name: "Hytte" }).element().getAttribute("aria-pressed")).toBe("true");
    expect(status?.textContent).toBe("Hytte valgt");
    await userEvent.click(page.getByRole("button", { name: "Husholdning" }));
    expect(page.getByRole("button", { name: "Hytte" }).element().getAttribute("aria-pressed")).toBe("false");
    expect(status?.textContent).toBe("Husholdning valgt ");
    await userEvent.click(page.getByRole("button", { name: "Husholdning" }));
    expect(status?.textContent).toBe("Ingen serie valgt");
    // DOM audit: Root's data-selected attribute is its public paint contract.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-selected")).toBe(false);
  });

  it("draws a 1 px outline on the pressed toggle, which survives forced colours", async () => {
    legend();
    const toggle = page.getByRole("button", { name: "Hytte" }).element();
    await userEvent.click(toggle);
    const style = getComputedStyle(toggle);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
  });
});

describe("a LegendValue that falls back to now", () => {
  /** 1 to 10 October 2026 in Oslo, whose days start at 22:00 UTC the day before under summer time. */
  const DAYS = Array.from({ length: 10 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 8, 30 + index, 22)),
    kwh: 101 + index,
  }));

  function valueAt(now: Date): string {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={DAYS}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          xRange={[DAYS[0]?.day ?? new Date(0), DAYS[4]?.day ?? new Date(0)]}
          now={now}
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" />
          <Chart.Legend>
            <Chart.LegendItem>
              <Chart.LegendValue fallback="now" />
            </Chart.LegendItem>
          </Chart.Legend>
        </Chart.Root>
      </LocaleProvider>
    );
    // DOM audit: the value is plain text inside the legend item, with no role of its own.
    return host.querySelector('[data-slot="chart-legend-value"]')?.textContent ?? "";
  }

  it("prints the reading of the day that holds now inside the window", () => {
    // 3 October at noon in Oslo is the third day, whose reading is 103.
    expect(valueAt(new Date(Date.UTC(2026, 9, 3, 10)))).toContain("103");
  });

  it("prints nothing when now falls after the window", () => {
    // 8 October is in the data but outside the 1–5 October window.
    expect(valueAt(new Date(Date.UTC(2026, 9, 8, 10)))).toBe("");
  });
});
