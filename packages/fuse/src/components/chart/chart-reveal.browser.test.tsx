// Reveal's active place, in Chromium. Unit under test: Reveal's follower and the registered
// `--chart-active-x`. Oracle: chart.css's contract that the property does not inherit, so the place
// sits on each series Reveal masks and on no mark inside one. The place is the crosshair's column:
// the second of four 100 px bands centres at 150 px, the middle of the device pixel 150 to 151.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const CONFIG = { v: { label: "V", color: "chart-1" } } as const satisfies ChartConfig;
const ROWS = ["a", "b", "c", "d"].map((name, index) => ({ name, v: index + 1 }));

describe("Chart.Reveal", () => {
  it("writes the active place on the series it masks and on nothing inside them", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Reveal">
            <Chart.Reveal>
              <Chart.Line dataKey="v" />
              <Chart.Dots dataKey="v" />
            </Chart.Reveal>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the reveal wrapper, the series and their marks are aria-hidden plot output.
    const reveal = host.querySelector<HTMLElement>('[data-slot="chart-reveal"]');
    const line = host.querySelector<SVGElement>('[data-slot="chart-line-series"]');
    const dots = host.querySelector<SVGElement>('[data-slot="chart-dots"]');
    const path = host.querySelector('[data-slot="chart-line"][data-part="solid"]');
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}{ArrowRight}");
    const place = (node: Element | null) =>
      node === null ? "missing" : getComputedStyle(node).getPropertyValue("--chart-active-x").trim();
    expect(place(line)).toBe("150.5px");
    expect(place(dots)).toBe(place(line));
    expect([place(reveal), place(path)]).toEqual(["", ""]);
    await userEvent.keyboard("{Escape}");
    host.querySelector<HTMLElement>('[role="option"]')?.blur();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active")).toBe(false);
    expect([place(line), place(dots)]).toEqual(["", ""]);
  });
});
