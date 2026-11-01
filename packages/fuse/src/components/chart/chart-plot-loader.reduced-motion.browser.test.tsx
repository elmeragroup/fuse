// The plot's loader under reduced motion, in Chromium, Firefox and WebKit, whose Playwright
// context sets prefers-reduced-motion: reduce. Unit under test: the server HTML of Root and
// chart.css's loader rules. Oracle: the same 400 ms wait as with motion, after which the loader
// shows at once, with no fade.
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

describe("the plot loader under reduced motion", () => {
  it("matches the reduce query in this engine", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("stays hidden for 400 ms, then shows at once", () => {
    host = serverChart("plot", fkasPrivate);
    // DOM audit: the loader is aria-hidden plot output, and only its slot names it.
    const loader = host.querySelector('[data-slot="chart-plot"] > [data-slot="loader"]');
    if (loader === null) throw new Error("no loader");
    expect(loaderOpacityAt(loader, 0)).toBe(0);
    expect(loaderOpacityAt(loader, 390)).toBe(0);
    expect(loaderOpacityAt(loader, 410)).toBe(1);
  });
});
