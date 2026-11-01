// The plot's loader before the browser measures it, in Chromium, Firefox and WebKit. Unit under
// test: the server HTML of Root and Panel and chart.css's loader rules. Oracles: the 400 ms wait
// and the fade on the update tokens chart.css states, 480 ms on the ease-out curve
// cubic-bezier(0, 0.7, 0.5, 1), which is past half its way at half its time, and the plot's own
// box, whose middle the loader's icon takes.
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { loaderOpacityAt, serverChart } from "../../../test/chart/plot-loader";
import { fkasPrivate } from "../../../test/themed-browser-render";
import "./chart.css";

let host: HTMLElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

describe("the plot loader", () => {
  it("stays hidden for 400 ms, then fades in over 480 ms with an ease-out curve", () => {
    host = serverChart("plot", fkasPrivate);
    // DOM audit: the loader is aria-hidden plot output, and only its slot names it.
    const loader = host.querySelector('[data-slot="chart-plot"] > [data-slot="loader"]');
    if (loader === null) throw new Error("no loader");
    expect(loader.getAttribute("aria-hidden")).toBe("true");
    expect(loaderOpacityAt(loader, 0)).toBe(0);
    expect(loaderOpacityAt(loader, 390)).toBe(0);
    const half = loaderOpacityAt(loader, 400 + 240);
    expect(half).toBeGreaterThan(0.5);
    expect(half).toBeLessThan(1);
    expect(loaderOpacityAt(loader, 400 + 500)).toBe(1);
  });

  it("centres its icon in the plot, which keeps its height", () => {
    host = serverChart("plot", fkasPrivate);
    // DOM audit: the plot and the loader's icon are aria-hidden output, located by slot and tag.
    const plot = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect();
    const icon = host.querySelector('[data-slot="loader"] > svg')?.getBoundingClientRect();
    if (plot === undefined || icon === undefined) throw new Error("no plot or icon");
    // Root's default plot height is 12.5rem, 200 px.
    expect(plot.height).toBe(200);
    expect(Math.abs(icon.left + icon.width / 2 - (plot.left + plot.width / 2))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(icon.top + icon.height / 2 - (plot.top + plot.height / 2))).toBeLessThanOrEqual(0.5);
  });

  it("shows each Panel's loader and hides Root's, which spans the Panels", () => {
    host = serverChart("panels", fkasPrivate);
    // DOM audit: each plot's loader is aria-hidden output, located by slot.
    const visibility = (selector: string) =>
      [...(host?.querySelectorAll(selector) ?? [])].map((loader) => getComputedStyle(loader).visibility);
    expect(visibility('[data-slot="chart-frame"] > [data-slot="chart-plot"] > [data-slot="loader"]')).toEqual(
      ["hidden"]
    );
    expect(visibility('[data-slot="chart-panel"] > [data-slot="chart-plot"] > [data-slot="loader"]')).toEqual(
      ["visible", "visible"]
    );
  });
});
