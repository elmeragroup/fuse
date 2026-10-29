// Real taps through Playwright's touchscreen in Chromium and WebKit, after the layer 05 recheck's
// touch findings and CONTRACT section 9.5's Touch rule: a tap pins the tooltip, a second tap on the
// same slot dismisses it, with or without a LegendToggleGroup, a third tap opens it again, and a
// pinned popup over a short bar's empty column swallows no tap. The labels are the rows' own names.
import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../test/pointer-press";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** Five days, the second one short, so its column is mostly empty above the bar. */
const ROWS = [
  { day: "mandag", kwh: 20 },
  { day: "tirsdag", kwh: 2 },
  { day: "onsdag", kwh: 18 },
  { day: "torsdag", kwh: 16 },
  { day: "fredag", kwh: 19 },
];

function TapChart({ toggles = false }: { readonly toggles?: boolean }) {
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
          {toggles ? <Chart.LegendToggleGroup /> : null}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** A point in slot `index`, at a fraction of the plot's height from its top. */
function at(host: HTMLElement, index: number, depth: number): readonly [number, number] {
  const box = host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
  return [box.left + (box.width * (index + 0.5)) / ROWS.length, box.top + box.height * depth];
}

async function tap(point: readonly [number, number]): Promise<void> {
  await commands.tap(point[0], point[1]);
  for (let frame = 0; frame < 2; frame += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
}

function label(): string | null {
  // DOM audit: the tooltip portals out of the host, and its label slot names the active slot.
  return document.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

function popupOpen(): boolean {
  // DOM audit: the popup portals out of the host and carries its own slot, until its fade ends.
  const popup = document.querySelector('[data-slot="chart-tooltip"]');
  return popup !== null && !popup.hasAttribute("data-ending-style");
}

describe("taps", () => {
  it("pin with a tap, dismiss with a second and open again with a third", async () => {
    const { host } = renderThemed(<TapChart />);
    const point = at(host, 2, 0.9);
    await tap(point);
    await expect.poll(label).toBe("onsdag");
    await tap(point);
    await expect.poll(popupOpen).toBe(false);
    await tap(point);
    await expect.poll(popupOpen).toBe(true);
    expect(label()).toBe("onsdag");
  });

  it("dismiss with a second tap on the same slot under a LegendToggleGroup", async () => {
    const { host } = renderThemed(<TapChart toggles />);
    const point = at(host, 3, 0.9);
    await tap(point);
    await expect.poll(label).toBe("torsdag");
    await tap(point);
    await expect.poll(popupOpen).toBe(false);
  });

  it("reach the plot through a pinned popup above a short bar", async () => {
    // Tirsdag's bar is a tenth of the plot, so the popup sits over its empty column.
    const { host } = renderThemed(<TapChart />);
    const first = at(host, 1, 0.5);
    await tap(first);
    await expect.poll(label).toBe("tirsdag");
    // The second tap at the first landing point dismisses, though the popup lies there.
    await tap(first);
    await expect.poll(popupOpen).toBe(false);
    await tap(first);
    await expect.poll(label).toBe("tirsdag");
    // A tap on the neighbouring slot at the same height pins that slot.
    await tap(at(host, 2, 0.5));
    await expect.poll(label).toBe("onsdag");
  });
});

/** 96 quarter hours of 24 May 2026 in UTC, about 4 px each across a 400 px plot. */
const QUARTERS = Array.from({ length: 96 }, (_, index) => ({
  start: new Date(Date.UTC(2026, 4, 24, 0, index * 15)),
  price: 1 + (index % 4) / 4,
}));

describe("taps on a dense plot", () => {
  it("pin the slot under the finger, one slot away from the active option", async () => {
    // The final recheck: Chromium's touch adjustment moved the tap's click onto the plot's option,
    // which sat on slot 0, and the tooltip read slot 0. The oracle is each slot's own quarter hour.
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={QUARTERS}
            config={{ price: { label: "Price", color: "chart-1" } }}
            xKey="start"
            interval="quarter-hour"
            timeZone="UTC"
            aria-label="Price per quarter hour">
            <Chart.Bar dataKey="price" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
    const slot = (index: number): readonly [number, number] => [
      box.left + (box.width * (index + 0.5)) / QUARTERS.length,
      box.top + box.height * 0.9,
    ];
    const read = (): string | null => label()?.replace(/\s+/gu, " ") ?? null;
    await tap(slot(3));
    await expect.poll(read).toBe("12:45 – 1:00 AM");
    await tap(slot(4));
    await expect.poll(read).toBe("1:00 – 1:15 AM");
    await tap(slot(2));
    await expect.poll(read).toBe("12:30 – 12:45 AM");
    expect(popupOpen()).toBe(true);
  });
});
