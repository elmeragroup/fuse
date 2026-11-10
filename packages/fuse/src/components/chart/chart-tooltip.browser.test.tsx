// WCAG 1.4.13 for the chart tooltip, rows T043 and T044, in Chromium. The
// sequence and its outcomes come from CONTRACT section 9.12, and every expected label is written
// by hand from the committed Elhub rows.
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { S06Chart } from "../../../test/chart/bar-charts";
import { label, pointerAt, popup, surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

afterEach(async () => {
  await page.viewport(1024, 768);
});

/** Wait for two animation frames and the popup's open fade, so Base UI has placed it. */
async function settle(): Promise<void> {
  await nextFrames(2);
  // The popup portals to the theme scope container, outside the render host.
  const open = document.querySelector('[data-slot="chart-tooltip"]');
  await Promise.all(open?.getAnimations({ subtree: true }).map((animation) => animation.finished) ?? []);
}

/**
 * Whether a popup shows on screen: rendered, not hidden and not faded out. A closed popup stays
 * mounted once it has opened, so closing must take it out of view, not out of the document.
 */
function visible(element: HTMLElement): boolean {
  return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

/** The open popup, which the test keeps to follow through its close and its reopening. */
function openPopup(): HTMLElement {
  const open = popup();
  if (open === null) throw new Error("no open popup");
  return open;
}

/** Move the pointer to a point in client coordinates, as `pointerAt` does, and let the popup settle. */
async function pointerTo(x: number, y: number): Promise<void> {
  await pointerAt(x, y);
  await settle();
}

function chart() {
  return renderThemed(
    <div style={{ padding: "160px 24px 24px", width: "min(600px, 100%)", boxSizing: "border-box" }}>
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Tooltip />
      </S06Chart>
    </div>
  );
}

describe.each([
  ["at the desktop width", 1024],
  ["in a 320 px viewport, WCAG 1.4.10's reflow width", 320],
])("the tooltip %s", (_, width) => {
  it("is hoverable, persistent and dismissible", async () => {
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    // Slot 14 is 14:00 to 15:00.
    const x = plot.left + slotWidth * 14.5;
    await pointerTo(x, plot.top + plot.height * 0.8);
    expect(label()).toBe("14–15");
    const open = openPopup();
    expect(visible(open)).toBe(true);
    // The popup sits above the column, or beside it when the root has no room above. Straight
    // up or down the column stays on the slot, so the pointer reaches the popup's height and then
    // the popup itself without the content changing.
    const box = popup()?.getBoundingClientRect() ?? new DOMRect();
    const side = popup()?.getAttribute("data-side");
    const middle = box.top + box.height / 2;
    // A popup beside the column touches it on its near edge, the right edge of a popup on the left.
    const near = side === "left" ? box.right - 4 : box.left + 4;
    await pointerTo(x, side === "top" ? box.bottom + 2 : middle);
    expect(label()).toBe("14–15");
    await pointerTo(side === "top" ? x : near, side === "top" ? box.bottom - 4 : middle);
    expect(label()).toBe("14–15");
    // Sideways inside the popup keeps it, over whatever slots lie beneath.
    await pointerTo(box.right - 4, middle);
    expect(label()).toBe("14–15");
    await pointerTo(box.left + 4, middle);
    expect(label()).toBe("14–15");
    // Back onto another slot updates it in place.
    await pointerTo(plot.left + slotWidth * 3.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("03–04");
    // Leaving the plot and the popup closes it, out of view once its exit ends.
    await pointerTo(4, 4);
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    // Coming back opens the same popup into view.
    await pointerTo(plot.left + slotWidth * 3.5, plot.top + plot.height * 0.9);
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });

  it("closes on Escape with the pointer still, and stays closed until the slot changes", async () => {
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
    const open = openPopup();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.85);
    expect(popup()).toBeNull();
    expect(visible(open)).toBe(false);
    await pointerTo(plot.left + slotWidth * 6.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("06–07");
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });

  it("reopens on the dismissed slot after the pointer leaves the plot and comes back", async () => {
    // jc14: after Escape, a pointer that left the plot and returned to the same slot never
    // reopened the popup, which fails 1.4.13's sequence at the 320 px reflow width.
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    const open = openPopup();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    await pointerTo(4, 4);
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });
});

describe("the tooltip after Escape and a blur", () => {
  it("opens on the slot Escape closed once focus has left the chart", async () => {
    // From the button before the chart, Tab and five steps reach 05–06, and Escape closes it. The
    // dismissal lasts only while the reader stays, so after Tab moves on to the button after the
    // chart, a pointer that moves over 05–06 opens it.
    const { host } = chart();
    page.getByRole("button", { name: "før" }).element().focus();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect.poll(label).toBe("05–06");
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("etter");
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.4, plot.top + plot.height * 0.9);
    await pointerTo(plot.left + slotWidth * 5.6, plot.top + plot.height * 0.85);
    await expect.poll(label).toBe("05–06");
  });
});

describe("tooltip readings", () => {
  it("adds the projection word after a projected value, as the option and the table do", async () => {
    // q17 and s13: b is projected, and en-US spells the word "projected".
    renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[
              { name: "a", v: 1 },
              { name: "b", v: 2 },
            ]}
            config={{ v: { label: "V", color: "chart-1", projectedFrom: "b" } }}
            xKey="name"
            defaultActiveX="b"
            aria-label="Projection">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await settle();
    // The popup portals out of the host, and its value slot holds the reading.
    expect(document.querySelector('[data-slot="chart-tooltip-value"]')?.textContent).toBe("2 (projected)");
  });
});
