// A reading far below the domain's maximum, under a device pixel along the value axis, in Chromium.
// Unit under test: the whole bar path from the model to the drawn polygon, through the plot frame's
// value-axis pixel floor. This file keeps the issue's reproduction at 1x, 1.5x and 2x and every
// sub-pixel place of the plot. The floor oracle, chart-floor.browser.test.tsx, walks every bar of
// random charts; the stack floor suites hold stacks, transitions and overlays. Oracles, none computed
// by the code under test: a non-zero reading draws one device pixel or more along the value axis; its
// base edge lies on the zero rule's near edge, which the grid draws on its own; its far edge lies away
// from zero, by the reading's sign; a zero reading draws nothing; and a bar lies inside the plot.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { WEEK, at, expectFloored, sweep, week } from "../../../test/chart/floor-charts";
import { bars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";

describe("a small non-zero bar", () => {
  it("draws at least one device pixel tall at every sub-pixel plot offset, and a zero flat", async () => {
    await sweep(renderThemed, 20, "vertical", week(WEEK, [1200]), (host, plot, dpr, offset) => {
      const drawn = bars(host).map((bar) => drawnRect(bar));
      // The zero rule lies on the plot's bottom edge here, so the pixel grows up inside the plot.
      expectFloored(drawn[5] ?? drawnRect(null), plot, {
        vertical: true,
        sign: 1,
        dpr,
        what: `d6 ${at(dpr, offset)}`,
      });
      expect(drawn[4]?.height, `d5 ${at(dpr, offset)}`).toBe(0);
    });
  });
});
