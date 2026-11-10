import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { bars } from "../../../test/chart/marks";
import { Composed } from "../../../test/chart/panel-fixtures";
import { plotOf } from "../../../test/chart/panel-readers";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

describe("two Panels on one x grid", () => {
  it("lists 100 Table rows with each hour's consumption once, spanning its 4 rows", async () => {
    const { host } = renderThemed(<Composed />);
    await expect.poll(() => host.querySelectorAll("tbody tr").length).toBe(100);
    const rows = [...host.querySelectorAll("tbody tr")];
    // Rows 0 to 3 are hour 0: the first holds the price and the hour's cell, the rest the price.
    expect(rows.slice(0, 5).map((row) => row.querySelectorAll("td").length)).toEqual([2, 1, 1, 1, 2]);
    const spans = rows.flatMap((row) =>
      [...row.querySelectorAll("td[rowspan]")].map((cell) => cell.getAttribute("rowspan"))
    );
    expect(spans).toEqual(Array.from({ length: 25 }, () => "4"));
    expect(rows[0]?.querySelector("td[rowspan]")?.textContent).toBe("1");
    expect(rows[96]?.querySelector("td[rowspan]")?.textContent).toBe("5");
  });
});

describe("one listbox over every Panel", () => {
  it("takes one tab stop, walks the shared x and moves the series focus from the first Panel into the second", async () => {
    const { host } = renderThemed(<Composed />);
    // Bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => bars(host).length).toBe(25);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    expect(host.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    // Quarter 5 is 01:15 to 01:30, in hour 1, whose consumption is 2 kWh, and its price is 1/4.
    const quarter = "kl. 01:15 til 01:30";
    const hour = "kl. 01 til 02";
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `${quarter}: Forbruk ${hour} 2 kilowattimer, Pris 0,25`
    );
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("6");
    expect(document.activeElement?.getAttribute("aria-setsize")).toBe("100");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `Forbruk ${hour} 2 kilowattimer, ${quarter}`
    );
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Pris 0,25, ${quarter}`);
    // The cycle ends at the last series of the last Panel.
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Pris 0,25, ${quarter}`);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("Vis som tabell");
  });
});

describe("pointer picking across Panels", () => {
  it("picks the slot by x and the nearest series of the Panel under the pointer, and none in a one-key Panel", async () => {
    const rows = [
      { name: "a", lo: 1, hi: 9, solo: 4 },
      { name: "b", lo: 2, hi: 8, solo: 5 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{
              lo: { label: "Lav", color: "chart-1" },
              hi: { label: "Høy", color: "chart-2" },
              solo: { label: "Alene", color: "chart-3" },
            }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Plukk">
            <Chart.Panel series={["lo", "hi"]} yInclude={[10]}>
              <Chart.Bar dataKey="lo" />
            </Chart.Panel>
            <Chart.Panel series={["solo"]} yInclude={[10]}>
              <Chart.Bar dataKey="solo" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // Bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => bars(host).length).toBe(4);
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const root = host.querySelector<HTMLElement>('[data-slot="chart"]');
    const move = (clientX: number, clientY: number) =>
      surface?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    const [upper, lower] = [plotOf(host, 0), plotOf(host, 1)];
    // Slot b's band is the right half. On [0, 10], 2 sits at 160 px and 8 at 40 px, so 150 px
    // lies nearer lo, at index 0, and 50 px nearer hi, at index 1.
    move(upper.left + 300, upper.top + 150);
    expect(root?.dataset.near).toBe("0");
    expect(root?.getAttribute("data-active")).toBe("pointer");
    move(upper.left + 300, upper.top + 50);
    expect(root?.dataset.near).toBe("1");
    // The lower Panel holds one key, so the pointer there picks the slot and no series.
    move(lower.left + 100, lower.top + 20);
    expect(root?.dataset.near).toBeUndefined();
    expect(root?.getAttribute("data-active")).toBe("pointer");
  });
});

describe("series selection across Panels (B1-9)", () => {
  // Usage bars in the first Panel and a price line in the second. A selected series keeps full
  // opacity and the other dims to --chart-hover-dim, 0.45.
  function Selectable() {
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[
              { name: "a", kwh: 2, price: 40 },
              { name: "b", kwh: 3, price: 60 },
            ]}
            config={{
              kwh: { label: "Forbruk", color: "chart-1" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="name"
            aria-label="Forbruk og pris">
            <Chart.Panel series={["kwh"]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
            <Chart.Panel series={["price"]}>
              <Chart.Line dataKey="price" />
            </Chart.Panel>
            <Chart.LegendToggleGroup />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The opacity of the bar series in the first Panel and the line series in the second. */
  function opacities(host: HTMLElement): number[] {
    // The series layers carry the dimming under test.
    return ['[data-slot="chart-bar-series"]', '[data-slot="chart-line-series"]'].map((selector) =>
      Number(getComputedStyle(host.querySelector(selector) ?? host).opacity)
    );
  }

  it("selects the second Panel's series with Down, Down and Enter, and dims the first Panel's", async () => {
    const { host } = renderThemed(<Selectable />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowDown}{ArrowDown}{Enter}");
    // Root's data-selected and --chart-selected are its public paint contract.
    const root = host.querySelector<HTMLElement>('[data-slot="chart"]');
    expect(root?.hasAttribute("data-selected")).toBe(true);
    expect(root?.style.getPropertyValue("--chart-selected")).toBe("1");
    expect(
      // The toggle's data-series index ties it to the selected series.
      host.querySelector('[data-slot="chart-legend-toggle"][data-series="1"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    await expect.poll(() => opacities(host)).toEqual([0.45, 1]);
  });

  it("selects the first Panel's series from its toggle, and dims the second Panel's", async () => {
    const { host } = renderThemed(<Selectable />);
    await userEvent.click(page.getByRole("button", { name: "Forbruk" }));
    await expect.poll(() => opacities(host)).toEqual([1, 0.45]);
  });
});
