// The touch judge of Chartability heuristic 9, in Chromium through CDP touch events. A scrub across
// the plot moves the active slot under the finger and its lift pins the slot, a tap pins the
// tooltip, and a second tap dismisses it, closing the popup and the crosshair, after CONTRACT
// section 9.4's pointer rules and layer 05's review findings q9 and s12. The expected labels are
// the rows' own category names, written by hand.
import { describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

type TouchPoint = { readonly x: number; readonly y: number };

type TouchCdp = {
  send: (
    method: "Input.dispatchTouchEvent",
    params: { type: "touchStart" | "touchMove" | "touchEnd"; touchPoints: readonly TouchPoint[] }
  ) => Promise<void>;
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): TouchCdp => cdp() as TouchCdp;

async function touch(type: "touchStart" | "touchMove" | "touchEnd", point?: TouchPoint): Promise<void> {
  await session().send("Input.dispatchTouchEvent", { type, touchPoints: point === undefined ? [] : [point] });
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

const ROWS = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag"].map((day, index) => ({
  day,
  kwh: 10 + index * 3,
}));

function TouchChart() {
  return (
    <div style={{ width: 400 }}>
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={ROWS}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="day"
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" />
          <Chart.Tooltip />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** The centre of the bar in slot `index`, in CSS pixels. */
function barCentre(host: HTMLElement, index: number): TouchPoint {
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  const rect = host.querySelectorAll('[data-slot="chart-bar"]')[index]?.getBoundingClientRect();
  if (rect === undefined) throw new Error(`no bar ${String(index)}`);
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function tooltipLabel(): string | null {
  // DOM audit: the tooltip portals out of the host, and its label slot names the active slot.
  return document.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

/** Whether the tooltip popup shows, which Base UI unmounts once it closes. */
function popupOpen(): boolean {
  // DOM audit: the popup portals out of the host and carries its own slot.
  return document.querySelector('[data-slot="chart-tooltip"]') !== null;
}

function active(host: HTMLElement): boolean {
  // DOM audit: Root's figure states the active slot, which the crosshair reads, on data-active.
  return host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") ?? false;
}

function pinned(host: HTMLElement): boolean {
  // DOM audit: the surface states the pin on its own data attribute.
  return host.querySelector('[data-slot="chart-surface"]')?.hasAttribute("data-pinned") ?? false;
}

describe("touch", () => {
  it("scrubs the active slot under the finger", async () => {
    const { host } = renderThemed(<TouchChart />);
    await touch("touchStart", barCentre(host, 0));
    await expect.poll(tooltipLabel).toBe("mandag");
    await touch("touchMove", barCentre(host, 2));
    await expect.poll(tooltipLabel).toBe("onsdag");
    await touch("touchMove", barCentre(host, 4));
    await expect.poll(tooltipLabel).toBe("fredag");
    await touch("touchEnd");
    // The lift pins the slot the scrub ended on.
    await expect.poll(() => pinned(host)).toBe(true);
    expect(tooltipLabel()).toBe("fredag");
  });

  it("keeps one pin and one popup through a scrub across two Panels", async () => {
    const rows = ROWS.map((row, index) => ({ ...row, price: 50 - index * 5 }));
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{
              kwh: { label: "Forbruk", color: "chart-1" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="day"
            aria-label="Forbruk og pris per dag">
            <Chart.Panel series={["kwh"]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
            <Chart.Panel series={["price"]}>
              <Chart.Bar dataKey="price" />
            </Chart.Panel>
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // The scrub starts on Monday's bar in the upper Panel and ends on Thursday's in the lower one.
    // It starts sideways, as a scrub does, since a drag that starts downward scrolls the page.
    const start = barCentre(host, 0);
    await touch("touchStart", start);
    await expect.poll(tooltipLabel).toBe("mandag");
    await touch("touchMove", { x: barCentre(host, 1).x, y: start.y });
    await expect.poll(tooltipLabel).toBe("tirsdag");
    // The lower Panel's bars follow the upper Panel's five, so bar 7 is Wednesday's.
    await touch("touchMove", barCentre(host, 7));
    await expect.poll(tooltipLabel).toBe("onsdag");
    await touch("touchMove", barCentre(host, 8));
    await touch("touchEnd");
    await expect.poll(() => pinned(host)).toBe(true);
    expect(tooltipLabel()).toBe("torsdag");
    // DOM audit: the popup portals out of the host and carries its own slot.
    expect(document.querySelectorAll('[data-slot="chart-tooltip"]')).toHaveLength(1);
    expect(host.querySelectorAll('[role="listbox"]')).toHaveLength(1);
  });

  it("pins the tooltip with a tap and dismisses it with a second tap", async () => {
    const { host } = renderThemed(<TouchChart />);
    const point = barCentre(host, 1);
    await touch("touchStart", point);
    await touch("touchEnd");
    await expect.poll(() => pinned(host)).toBe(true);
    expect(tooltipLabel()).toBe("tirsdag");
    await touch("touchStart", point);
    await touch("touchEnd");
    await expect.poll(() => pinned(host)).toBe(false);
    await expect.poll(popupOpen).toBe(false);
    expect(active(host)).toBe(false);
  });
});
