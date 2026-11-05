// D24's rim floor in Chromium. Unit under test: PieChart.Pie's frame, which floors every slice it
// writes. Oracle: D24, written by hand. A slice whose reading is above 0 shows at least one device
// pixel of rim between the seams stroked over its two edges, so its outer arc spans at least the
// seam plus one device pixel, while its share and its texts keep the true value. The pointer picks
// the slice it sees: at a 100 px radius and DPR 1 the floored slice spans the 2 px seam and one
// pixel, 3 / 100 rad ≈ 1.719°, so it starts near 358.28° and 359° lies inside it (Q2, B13).
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  activeSlice,
  clientPoint,
  dialPoint,
  hoverAt,
  outerArc,
  pieSvg,
  sectors,
} from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

it("keeps a device pixel of rim between the seams of a slice a millionth of the pie", async () => {
  // The second slice is 1 in 1 000 001, 0.00036° of the turn, far under a pixel of any rim.
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <PieChart.Root
          data={[
            { part: "strom", kwh: 1_000_000 },
            { part: "lys", kwh: 1 },
          ]}
          config={{ strom: { label: "Strøm", color: "chart-1" }, lys: { label: "Lys", color: "chart-2" } }}
          nameKey="part"
          valueKey="kwh"
          data-intro="none"
          aria-label="Forbruk">
          <PieChart.Pie />
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
  const radius = pieSvg(host).getBoundingClientRect().width / 2;
  const seam = Number.parseFloat(getComputedStyle(pieSvg(host)).getPropertyValue("--chart-slice-seam"));
  await expect
    .poll(() => {
      const arc = outerArc(sectors(host)[1]?.getAttribute("d") ?? "");
      return arc === null ? 0 : (((arc[1] - arc[0]) * Math.PI) / 180) * radius;
    })
    .toBeGreaterThanOrEqual(seam + 1 / window.devicePixelRatio - 0.01);
  // The seam the floor clears is the bar seam's 2 px default.
  expect(seam).toBe(2);
  // The pointer at 359°, inside the floored slice's visible rim, picks it.
  expect(radius).toBe(100);
  expect(window.devicePixelRatio).toBe(1);
  const inside = dialPoint(359, 0.75);
  await hoverAt(...clientPoint(pieSvg(host), inside.x, inside.y));
  expect(activeSlice(host)).toBe(1);
  // The texts keep the true value: the option reads 1 and 0 %, from the share set that sums to 100.
  await userEvent.tab();
  await userEvent.keyboard("{ArrowDown}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Lys: 1, 0\u00a0prosent");
});
