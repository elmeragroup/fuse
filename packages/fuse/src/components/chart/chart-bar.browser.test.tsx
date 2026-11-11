import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { bars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const TWO = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const satisfies ChartConfig;

describe("emphasis", () => {
  it("selects every tied maximum and speaks the dictionary word in the option", async () => {
    const rows = [1, 3, 3, 2].map((a, index) => ({ name: `k${String(index + 1)}`, a, b: 0 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Uthevet">
          <Chart.Bar dataKey="a" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true, true, false]);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowDown}");
    // The option moves focus to its new element after the commit, so the check waits for it.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("A 3, uthevet, k2");
  });
});
