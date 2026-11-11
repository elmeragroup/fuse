import { Suspense, use } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { bars } from "../../../test/chart/marks";
import { Composed } from "../../../test/chart/panel-fixtures";
import { plotOf, barHeights, frame } from "../../../test/chart/panel-readers";
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

// The Panel rules in Chromium, after ticket svg-3's checks. Unit under test: Root's check of the
// current tree's registrations, which throws a Panel rule from a layout effect once every Panel and
// every plot part of the commit has registered. Oracles: CONTRACT section 8.1's messages and bar
// heights worked out by hand on fixed domains.
describe("panel rules", () => {
  describe("Panel rules after registration", () => {
    const rows = [{ name: "a", v: 1, w: 2 }];
    const config = { v: { label: "V", color: "chart-1" }, w: { label: "W", color: "chart-2" } } as const;
    // Each message is the rule's own, written by hand from CONTRACT section 8.1's table.
    it.each([
      [
        "key-outside-panels: a config key no Panel lists",
        <Chart.Panel key="v" series={["v"]}>
          <Chart.Bar dataKey="v" />
        </Chart.Panel>,
        'Chart.Root has config key "w", which no Chart.Panel lists',
      ],
      [
        "series-in-two-panels: a key two Panels list",
        <>
          <Chart.Panel series={["v", "w"]} />
          <Chart.Panel series={["w"]} />
        </>,
        'Chart.Panel lists "w", which another Chart.Panel lists too',
      ],
      [
        "part-outside-panel: a Grid directly under a Root with Panels",
        <>
          <Chart.Grid />
          <Chart.Panel series={["v", "w"]} />
        </>,
        "Chart.Grid sits directly under a Chart.Root that has Panels",
      ],
    ])("throws %s on the render its registration triggers", async (_, children, message) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      renderThemed(
        <LocaleProvider locale="nb-NO">
          <CaughtError>
            <Chart.Root data={rows} config={config} xKey="name" aria-label="Regler">
              {children}
            </Chart.Root>
          </CaughtError>
        </LocaleProvider>
      );
      await expect.poll(() => caughtError().name).toBe("ChartCompositionError");
      expect(caughtError().message).toContain(message);
      vi.restoreAllMocks();
    });
  });

  describe("a plot part that moves between a Panel and the default layout (X1, Q2-1)", () => {
    // One reading of 2 over yInclude [0, 4], Root's and the Panel's, on a 200 px plot: a 100 px bar
    // in either layout.
    const chart = (layout: "panel" | "root" | "both") => (
      <LocaleProvider locale="nb-NO">
        <CaughtError>
          <div style={{ width: 200 }}>
            <Chart.Root
              data={[{ name: "a", v: 2 }]}
              config={{ v: { label: "V", color: "chart-1" } }}
              xKey="name"
              yInclude={[0, 4]}
              data-intro="none"
              style={{ "--chart-plot-height": "200px" }}
              aria-label="Flytte">
              {layout === "root" || layout === "both" ? <Chart.Bar dataKey="v" /> : null}
              {layout === "panel" || layout === "both" ? (
                <Chart.Panel series={["v"]} yInclude={[0, 4]}>
                  {layout === "panel" ? <Chart.Bar dataKey="v" /> : null}
                </Chart.Panel>
              ) : null}
            </Chart.Root>
          </div>
        </CaughtError>
      </LocaleProvider>
    );

    it("draws the Bar in the default layout once its Panel is replaced by it", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { host, rerender } = renderThemed(chart("panel"));
      await expect.poll(() => barHeights(host)).toEqual([100]);
      rerender(chart("root"));
      await frame();
      await frame();
      expect(caughtError().name).toBeNull();
      expect(barHeights(host)).toEqual([100]);
      vi.restoreAllMocks();
    });

    it("draws the Bar in a Panel once it moves into one from the default layout", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { host, rerender } = renderThemed(chart("root"));
      await expect.poll(() => barHeights(host)).toEqual([100]);
      rerender(chart("panel"));
      await frame();
      await frame();
      expect(caughtError().name).toBeNull();
      await expect.poll(() => barHeights(host)).toEqual([100]);
      vi.restoreAllMocks();
    });

    it("throws part-outside-panel once a Panel joins a Bar left in the default layout", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { host, rerender } = renderThemed(chart("root"));
      await expect.poll(() => barHeights(host)).toEqual([100]);
      rerender(chart("both"));
      await expect.poll(() => caughtError().name).toBe("ChartCompositionError");
      expect(caughtError().message).toContain("Chart.Bar sits directly under a Chart.Root that has Panels");
      vi.restoreAllMocks();
    });
  });

  describe("Panel coverage of the current tree (W1)", () => {
    /** Bars drawn, by Panel. */
    const barsByPanel = (host: HTMLElement) =>
      // Panels are layout rows and bars aria-hidden plot output, so slots locate both.
      [...host.querySelectorAll('[data-slot="chart-panel"]')].map(
        (panel) => panel.querySelectorAll('[data-slot="chart-bar"]').length
      );

    it("renders a rerender that replaces w with z in the config and the second Panel at once (Q1-1)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const rows = [
        { name: "a", v: 1, w: 2, z: 3 },
        { name: "b", v: 2, w: 3, z: 4 },
      ];
      const chart = (second: "w" | "z") => (
        <LocaleProvider locale="nb-NO">
          <CaughtError>
            <Chart.Root
              data={rows}
              config={{ v: { label: "V", color: "chart-1" }, [second]: { label: second, color: "chart-2" } }}
              xKey="name"
              aria-label="Bytte">
              <Chart.Panel series={["v"]}>
                <Chart.Bar dataKey="v" />
              </Chart.Panel>
              <Chart.Panel series={[second]}>
                <Chart.Bar dataKey={second} />
              </Chart.Panel>
            </Chart.Root>
          </CaughtError>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart("w"));
      await expect.poll(() => barsByPanel(host)).toEqual([2, 2]);
      rerender(chart("z"));
      await frame();
      await frame();
      expect(caughtError().name).toBeNull();
      expect(barsByPanel(host)).toEqual([2, 2]);
      vi.restoreAllMocks();
    });

    it("renders a rerender that adds b to the config, the data and the Panel together (B1-1)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const chart = (keys: readonly ("a" | "b")[]) => (
        <LocaleProvider locale="nb-NO">
          <CaughtError>
            <Chart.Root
              data={keys.includes("b") ? [{ name: "x", a: 1, b: 2 }] : [{ name: "x", a: 1 }]}
              config={Object.fromEntries(keys.map((key) => [key, { label: key, color: "chart-1" }]))}
              xKey="name"
              aria-label="Legge til">
              <Chart.Panel series={keys}>
                {keys.map((key) => (
                  <Chart.Bar key={key} dataKey={key} />
                ))}
              </Chart.Panel>
            </Chart.Root>
          </CaughtError>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart(["a"]));
      await expect.poll(() => barsByPanel(host)).toEqual([1]);
      rerender(chart(["a", "b"]));
      await frame();
      await frame();
      expect(caughtError().name).toBeNull();
      expect(barsByPanel(host)).toEqual([2]);
      vi.restoreAllMocks();
    });

    it("waits for a Panel whose server HTML hydrates later, then checks the whole tree", async () => {
      // Root and the first Panel hydrate at once. The second Panel sits in a Suspense boundary that
      // stays dehydrated until its promise resolves, so for a while only "v" is registered.
      let release: () => void = () => undefined;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      function Gate({
        promise,
        children,
      }: {
        readonly promise: Promise<void> | null;
        readonly children: ReactNode;
      }) {
        if (promise !== null) use(promise);
        return children;
      }
      const page = (promise: Promise<void> | null) => (
        <LocaleProvider locale="nb-NO">
          <CaughtError>
            <Chart.Root
              data={[{ name: "a", v: 1, w: 2 }]}
              config={{ v: { label: "V", color: "chart-1" }, w: { label: "W", color: "chart-2" } }}
              xKey="name"
              aria-label="Hydrering">
              <Chart.Panel series={["v"]}>
                <Chart.Bar dataKey="v" />
              </Chart.Panel>
              <Suspense fallback={null}>
                <Gate promise={promise}>
                  <Chart.Panel series={["w"]}>
                    <Chart.Bar dataKey="w" />
                  </Chart.Panel>
                </Gate>
              </Suspense>
            </Chart.Root>
          </CaughtError>
        </LocaleProvider>
      );
      const container = document.createElement("div");
      container.innerHTML = renderToString(page(null));
      document.body.append(container);
      const recoverable: unknown[] = [];
      const root = hydrateRoot(container, page(pending), {
        onRecoverableError: (error) => recoverable.push(error),
      });
      try {
        await expect.poll(() => barsByPanel(container)).toEqual([1, 0]);
        await frame();
        expect(caughtError().name).toBeNull();
        release();
        await expect.poll(() => barsByPanel(container)).toEqual([1, 1]);
        expect(caughtError().name).toBeNull();
        expect(recoverable).toEqual([]);
      } finally {
        root.unmount();
        container.remove();
      }
    });
  });
});
