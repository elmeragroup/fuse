// The polar tooltip's orbit, in Chromium with motion on. Unit under test: PieChart.Tooltip's glide
// between slices, through the polar anchor's path route. Oracle: D7's rule that the popup orbits
// the dial and never crosses its centre, so every frame keeps the popup's centre at least the
// outer radius plus the rim gap from the dial's centre, which a straight glide between two nearly
// opposite bisectors breaks by passing within a few pixels of it.
import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { glideLanded, label, popupOpen } from "../../../test/chart/marks";
import { onTheWay, positioner, sweepGlides } from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import type { OrbitPoint } from "./layout/polar-orbit";
import { PieChart } from "./pie-chart-namespace";

beforeEach(async () => {
  await page.viewport(1024, 768);
});

/** Strøm's bisector sits at 111.6° and Nettleie's at 284.4°, 172.8° apart. */
const BILL = [
  { name: "strom", v: 62 },
  { name: "nettleie", v: 34 },
  { name: "avgifter", v: 4 },
];

const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
} as const;

/** The popup's centre, from its positioner's box. */
function popupCentre(): OrbitPoint {
  const box = positioner()?.getBoundingClientRect() ?? new DOMRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

describe("the polar tooltip's orbit (D6, D7)", () => {
  it("glides round the dial the short way and never crosses its centre", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400, margin: "200px auto" }}>
          <PieChart.Root data={BILL} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Kake">
            <PieChart.Tooltip />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    await userEvent.tab();
    await expect.poll(popupOpen).toBe(true);
    await glideLanded();
    expect(label()).toBe("Strøm");
    const dial = page.getByRole("listbox").element().getBoundingClientRect();
    const centre = { x: dial.left + dial.width / 2, y: dial.top + dial.height / 2 };
    const start = popupCentre();
    await userEvent.keyboard("{ArrowDown}");
    // DOM audit: the glide plays on the positioner, which portals out of the chart.
    await expect
      .poll(() =>
        positioner()
          ?.getAnimations()
          .some(({ playState }) => playState === "running")
      )
      .toBe(true);
    const places = sweepGlides(document.body, popupCentre);
    const end = places.at(-1) ?? start;
    // The popup rests on the far side: Nettleie's bisector points left and a little up.
    expect(end.x).toBeLessThan(centre.x - dial.width / 2);
    expect(start.x).toBeGreaterThan(centre.x + dial.width / 2);
    expect(onTheWay(places).length).toBeGreaterThan(0);
    const rim = dial.width / 2 + 8;
    const closest = Math.min(...places.map(({ x, y }) => Math.hypot(x - centre.x, y - centre.y)));
    expect(closest).toBeGreaterThanOrEqual(rim - 1);
    // The short way from 111.6° to 284.4° runs clockwise through the bottom, below the centre.
    expect(Math.max(...places.map(({ y }) => y))).toBeGreaterThan(centre.y + rim - 1);
    expect(label()).toBe("Nettleie");
  });
});
