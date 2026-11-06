/**
 * The plot loader's browser fixture mounts a chart's server HTML with no hydration, so its plot is
 * never measured and keeps the loader the server sends, as a page does while its script loads.
 */
import { renderToString } from "react-dom/server";

import { Chart } from "../../src/components/chart/chart-namespace";
import { LocaleProvider } from "../../src/intl/locale-context";
import type { ThemeInput } from "../../src/theme/theme-input";
import { ThemeScope } from "../../src/theme/theme-scope";

const ROWS = [
  { name: "x", a: 2, b: 1 },
  { name: "y", a: 3, b: 2 },
];

const CONFIG = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const;

/**
 * Mount the server HTML of a 400 px bar chart in a theme, with one plot or with two Panels.
 *
 * @param layout - "plot" for one Bar in Root's plot, "panels" for a Bar in each of two Panels.
 * @param theme - The theme the chart renders in, as the themed harness scopes a suite.
 * @returns The host, appended to the document, which the caller removes.
 */
export function serverChart(layout: "plot" | "panels", theme: ThemeInput): HTMLElement {
  const host = document.createElement("div");
  host.style.width = "400px";
  host.innerHTML = renderToString(
    <ThemeScope theme={theme}>
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={ROWS} config={CONFIG} xKey="name" aria-label="Lasting">
          {layout === "plot" ? (
            <Chart.Bar dataKey="a" />
          ) : (
            <>
              <Chart.Panel series={["a"]}>
                <Chart.Bar dataKey="a" />
              </Chart.Panel>
              <Chart.Panel series={["b"]}>
                <Chart.Bar dataKey="b" />
              </Chart.Panel>
            </>
          )}
        </Chart.Root>
      </LocaleProvider>
    </ThemeScope>
  );
  document.body.append(host);
  return host;
}

/**
 * The loader's opacity with its own animation held at a time from the animation's start.
 *
 * @param loader - A plot's `loader` element.
 * @param ms - Milliseconds from the animation's start.
 * @returns The computed opacity.
 */
export function loaderOpacityAt(loader: Element, ms: number): number {
  for (const animation of loader.getAnimations()) {
    animation.pause();
    animation.currentTime = ms;
  }
  return Number(getComputedStyle(loader).opacity);
}
