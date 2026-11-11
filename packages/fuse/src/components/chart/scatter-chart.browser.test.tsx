// ScatterChart's Root and marks in Chromium. Unit under test: the whole path from Root's rows to
// the drawn `d`, the grid and axis placements, the server HTML and the data rules. Oracles: pixels
// worked out by hand on a 200 by 140 px plot over x [−2, 18] and y [20 000, 160 000], where x = 2
// sits 40 px from the left and y = 90 000 sits 70 px from the top, and sentences written by hand.
import type { ReactNode } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

type Row = { readonly t: number | null; readonly kwh: number | null; readonly s: string };

/** Points whose extents nice to exactly [−2, 18] and [20 000, 160 000]. */
const ROWS: readonly Row[] = [
  { t: 18, kwh: 160_000, s: "now" },
  { t: -2, kwh: 20_000, s: "now" },
  { t: 2, kwh: 90_000, s: "now" },
  { t: 2, kwh: 90_000, s: "normal" },
  { t: -2, kwh: 20_000, s: "normal" },
  { t: 18, kwh: 160_000, s: "normal" },
];

/** A scatter chart with no axes, so its plot is the whole 200 by 140 px frame, and no entrance. */
function Scatter({
  data = ROWS,
  children,
}: {
  readonly data?: readonly Row[];
  readonly children: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 200 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          xFormat={{ style: "unit", unit: "celsius" }}
          valueFormat={{ preset: "energy", unit: "kWh" }}
          xLabel="Temperatur"
          yLabel="Forbruk"
          data-intro="none"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          {children}
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The `d` of every points path, in part order. */
function pointPaths(host: HTMLElement): (string | null)[] {
  // The points are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-points-path"]')].map((path) => path.getAttribute("d"));
}

describe("ScatterChart Root", () => {
  it("renders the final figure on the server, with no mark drawn before the browser measures", () => {
    const html = renderToString(
      <Scatter>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    const template = document.createElement("template");
    template.innerHTML = html;
    const figure = template.content.querySelector("figure");
    expect(figure?.getAttribute("aria-label")).toBe("Forbruk mot temperatur");
    expect(template.content.querySelector('[role="listbox"] [role="option"]')).not.toBeNull();
    // The server HTML is a detached fragment, and the marks and the description are
    // aria-hidden or visually hidden, so their slots are the only locators.
    expect(template.content.querySelector('[data-slot="chart-points"]')).not.toBeNull();
    expect(template.content.querySelector('[data-slot="chart-points-path"]')).toBeNull();
    expect(template.content.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      // Fuse writes every space inside a number, a unit and a count as U+00A0.
      "Forbruk 2026: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer. " +
        "Normalforbruk: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer."
    );
  });

  it("throws non-finite-x in development for a NaN x, naming the row and the column", () => {
    renderThemed(
      <CaughtError>
        <Scatter data={[...ROWS, { t: Number.NaN, kwh: 1, s: "now" }]}>
          <ScatterChart.Points dataKey="now" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartDataError");
    expect(caughtError().message).toContain('Row 6 of "t"');
  });

  it("skips a row with a null x or y quietly", async () => {
    const { host } = renderThemed(
      <Scatter data={[...ROWS, { t: null, kwh: 1, s: "now" }, { t: 4, kwh: null, s: "now" }]}>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    await expect.poll(() => pointPaths(host)).toEqual(["M0 140h0M40 70h0M200 0h0"]);
  });

  it("throws unknown-key for a part that names no config key", () => {
    renderThemed(
      <CaughtError>
        <Scatter>
          <ScatterChart.Points dataKey="missing" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartCompositionError");
    expect(caughtError().message).toContain('"missing"');
  });
});
