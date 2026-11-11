import { flushSync } from "react-dom";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { DAY_AND_MONTH, DayChart, parts, settle, shownText, slotLabel } from "../../../test/chart/slot-label";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** Focus the plot and step to day `index`. */
async function stepTo(host: HTMLElement, index: number): Promise<void> {
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}{Home}");
  for (let step = 0; step < index; step += 1) await userEvent.keyboard("{ArrowRight}");
  settle();
}

describe("Chart.SlotLabel", () => {
  it("renders nothing on the server", () => {
    const html = renderToString(<DayChart count={20} />);
    expect(html).toContain('data-slot="chart-crosshair"');
    expect(html).not.toContain("chart-slot-label");
  });

  it("shows the right value of every part when labels have different numbers of parts", async () => {
    // "North" has one part and the other two have three, so two stacks hold an empty value.
    const names = ["North", "North East", "North West", "South"];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 640 }}>
          <Chart.Root
            data={names.map((name, index) => ({ name, v: index + 1 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Regioner">
            <Chart.XAxis />
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair>
              <Chart.SlotLabel />
            </Chart.Crosshair>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await stepTo(host, 0);
    const seen = [shownText(host)];
    for (let step = 1; step < names.length; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
      settle();
      seen.push(shownText(host));
    }
    expect(seen).toEqual(names);
  });

  it("measures with the latest format when a deferred measurement runs after a format change", async () => {
    // Unit under test: a pill whose measurement was deferred by a scale(0) ancestor, then whose
    // format changed before the deferral ran. Oracle: the same chart mounted in the new format.
    // The day alone rolls in one part, and the day with its month in four, so a model of the old
    // format measures too few parts for the new one.
    const DAY = { day: "numeric" } as const;
    const written = (host: HTMLElement) => ({
      text: shownText(host),
      full: slotLabel(host).style.getPropertyValue("--_full"),
      clip: slotLabel(host).querySelector<HTMLElement>('[data-part="pill"]')?.style.clipPath,
      parts: parts(host).map((part) => part.style.translate),
    });
    const fresh = renderThemed(<DayChart count={20} slotFormat={DAY_AND_MONTH} />);
    await stepTo(fresh.host, 9);
    const oracle = written(fresh.host);
    fresh.unmount();
    const { host, rerender } = renderThemed(<DayChart count={20} slotFormat={DAY} scale={0} />);
    await stepTo(host, 8);
    // This step finds nothing measured and defers a measurement to the task after the next frame.
    await userEvent.keyboard("{ArrowRight}");
    flushSync(() => {
      rerender(<DayChart count={20} slotFormat={DAY_AND_MONTH} scale={0} />);
    });
    const scaled = host.querySelector<HTMLElement>('[style*="scale(0)"]');
    if (scaled === null) throw new Error("no scaled wrapper");
    scaled.style.transform = "none";
    await expect.poll(() => slotLabel(host).hasAttribute("data-shown")).toBe(true);
    settle();
    expect(written(host)).toEqual(oracle);
  });
});
