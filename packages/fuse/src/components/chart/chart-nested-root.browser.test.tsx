// A Chart.Root nested inside another chart's part, in Chromium. Unit under test: the nested Root's
// own parts. Oracle: what each part's JSDoc says it does in a Root of its own, outside a polar
// Root, a tooltip, a Headline and a Crosshair.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { bars, pointerAt, pointerTarget, popup, popupOpen, surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

const ROWS = ["a", "b", "c"].map((name, index) => ({ name, v: index + 1, w: 4 - index }));

const CONFIG = { v: { label: "Forbruk", color: "chart-1" }, w: { label: "Pris", color: "chart-2" } } as const;

/** The nested Root, which the outer chart's part holds. */
function Nested({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 240 }}>
      <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Indre">
        <Chart.Bar dataKey="v" />
        <Chart.Bar dataKey="w" />
        {children}
      </Chart.Root>
    </div>
  );
}

/** The nested Root's figure, which the outer chart's figure holds. */
function nestedFigure(host: HTMLElement): HTMLElement {
  // DOM audit: each Root is a figure on the chart slot, and the nested one sits inside the outer.
  const figure = host.querySelector<HTMLElement>('[data-slot="chart"] [data-slot="chart"]');
  if (figure === null) throw new Error("no nested Root");
  return figure;
}

/** A box's centre in client pixels. */
function centreOf(rect: DOMRect): [number, number] {
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

describe("a Root nested in another chart's part", () => {
  it("renders its legend inside a polar Root that renders none of its own", () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <PieChart.Root
          data={[{ name: "a", v: 1 }]}
          config={CONFIG}
          nameKey="name"
          valueKey="v"
          aria-label="Kake">
          <Nested>
            <Chart.Legend />
          </Nested>
        </PieChart.Root>
      </LocaleProvider>
    );
    // Chart.Legend lists one entry per config key of its own Root, by the key's label.
    expect(
      page
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["Forbruk", "Pris"]);
  });

  it("leaves its SeriesLabel resting inside a pinned tooltip while its own plot is active", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ padding: "320px 24px 24px", width: 600, boxSizing: "border-box" }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip>
              <Nested>
                <Chart.SeriesLabel />
              </Nested>
            </Chart.Tooltip>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const [first] = bars(host);
    if (first === undefined) throw new Error("no bars");
    const [x, y] = centreOf(first.getBoundingClientRect());
    await pointerAt(x, y);
    await userEvent.click(...pointerTarget(x, y));
    await expect.poll(popupOpen).toBe(true);
    // DOM audit: the popup portals out of the host, and the nested Root is a figure inside it.
    const figure = popup()?.querySelector<HTMLElement>('[data-slot="chart"]');
    if (figure === null || figure === undefined) throw new Error("no nested Root in the popup");
    await pointerAt(...centreOf(surfaceBox(figure)));
    // DOM audit: Root states its active slot on data-active.
    await expect.poll(() => figure.hasAttribute("data-active")).toBe(true);
    // A SeriesLabel with no dataKey and no row prints the active point's key only in a live scope,
    // such as its own Root's tooltip, so here it prints nothing.
    expect(figure.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("");
  });

  it("draws its ActiveValue as plot output inside an outer Headline", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
          <Chart.Bar dataKey="v" />
          <Chart.Headline>
            <Nested>
              <Chart.ActiveValue dataKey="v" />
            </Nested>
          </Chart.Headline>
        </Chart.Root>
      </LocaleProvider>
    );
    // Outside a Headline, an ActiveValue is plot output that readers skip.
    // DOM audit: the plot form hides its slot from the accessibility tree.
    const value = nestedFigure(host).querySelector('[data-slot="chart-active-value"]');
    expect(value?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders no SlotLabel outside its own Crosshair, inside an outer Crosshair's children", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 600 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair>
              <Nested>
                <Chart.SlotLabel />
              </Nested>
            </Chart.Crosshair>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const figure = nestedFigure(host);
    // The nested plot has drawn its frame once its bars show, so a SlotLabel that would show has.
    await expect.poll(() => bars(figure).length).toBe(ROWS.length * 2);
    // A SlotLabel shows only inside a Crosshair of its own Root, and renders nothing elsewhere.
    // DOM audit: the pill is aria-hidden plot output, so its slot is the only locator.
    expect(figure.querySelector('[data-slot="chart-slot-label"]')).toBeNull();
  });

  it("prints no ValueLabel outside its own Marker, inside an outer Marker's children", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 600 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Marker dataKey="v" at="last">
              <Nested>
                <Chart.ValueLabel />
              </Nested>
            </Chart.Marker>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // The outer Marker renders its children once the outer plot has drawn.
    await expect.poll(() => nestedFigure(host)).toBeInstanceOf(HTMLElement);
    // A ValueLabel prints the datum of its own Root's Marker or ActiveValueLine, and nothing
    // without one, though the nested v has a reading, 3, at the outer Marker's last slot.
    // DOM audit: the pill is aria-hidden plot output, so its slot is the only locator.
    expect(nestedFigure(host).querySelector('[data-slot="chart-value-label"]')?.textContent).toBe("");
  });
});
