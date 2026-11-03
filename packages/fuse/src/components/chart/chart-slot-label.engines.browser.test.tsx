// Chart.SlotLabel's text in Chromium, Firefox and WebKit. Oracle: DECISIONS D14 and D34. The pill
// prints the active slot as Intl formats it in Oslo, written out here with Intl itself: in the
// interval's tick preset when nothing names a format, in Chart.XAxis's `format` when the pill
// names none, and in its own `format` over the axis's.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { DAY_AND_MONTH, DayChart, hoverSlot, intl, shownText } from "../../../test/chart/slot-label";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";

describe("Chart.SlotLabel's text", () => {
  it("prints the interval's tick preset when nothing names a format", async () => {
    const { host } = renderThemed(<DayChart count={20} />);
    await hoverSlot(host, 9, 20);
    expect(shownText(host)).toBe(intl(9, { day: "numeric" }));
  });

  it("prints the x axis's own format when it names none of its own", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} />);
    await hoverSlot(host, 10, 20);
    expect(shownText(host)).toBe(intl(10, DAY_AND_MONTH));
  });

  it("prints its own format over the axis's", async () => {
    const { host } = renderThemed(
      <DayChart count={20} format={DAY_AND_MONTH} slotFormat={{ day: "numeric" }} />
    );
    await hoverSlot(host, 10, 20);
    expect(shownText(host)).toBe(intl(10, { day: "numeric" }));
  });
});
