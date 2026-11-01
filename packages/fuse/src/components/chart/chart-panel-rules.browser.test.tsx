// The Panel rules in Chromium, after ticket svg-3's checks. Unit under test: Root's check of the
// current tree's registrations, which throws a Panel rule from a layout effect once every Panel and
// every plot part of the commit has registered. Oracles: CONTRACT section 8.1's messages and bar
// heights worked out by hand on fixed domains.
import { Suspense, use, useMemo } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { barHeights, frame } from "../../../test/chart/panel-readers";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ChartRootContext } from "./chart-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

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
    // DOM audit: Panels are layout rows and bars aria-hidden plot output, so slots locate both.
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

describe("plot part registration with Root (Y5)", () => {
  it("registers each plot part in the default layout once", async () => {
    // Root's own context, passed on with registerRootPart counting the parts that register. A Bar,
    // a Line and a Grid under the default layout are three parts, so three registrations.
    const registered: string[] = [];
    function Counting({ children }: { readonly children: ReactNode }): ReactNode {
      const root = use(ChartRootContext);
      if (root === null) throw new Error("no Root");
      const counted = useMemo(
        () => ({
          ...root,
          registerRootPart: (part: string) => {
            registered.push(part);
            return root.registerRootPart(part);
          },
        }),
        [root]
      );
      return <ChartRootContext value={counted}>{children}</ChartRootContext>;
    }
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <Chart.Root
            data={[{ name: "a", v: 1, w: 2 }]}
            config={{ v: { label: "V", color: "chart-1" }, w: { label: "W", color: "chart-2" } }}
            xKey="name"
            aria-label="Teller">
            <Counting>
              <Chart.Grid />
              <Chart.Bar dataKey="v" />
              <Chart.Line dataKey="w" />
            </Counting>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await frame();
    expect(registered.toSorted()).toEqual(["Chart.Bar", "Chart.Grid", "Chart.Line"]);
  });
});
