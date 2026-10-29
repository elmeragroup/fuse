// The tooltip's one dismissal and the one active identity, in Chromium, Firefox and WebKit, after
// layer 05's review findings q9, q10, s3, s4 and s12. Oracle: CONTRACT section 9.4's pointer and
// key rules and the rows' own names and values, written by hand.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const ONE = { v: { label: "V", color: "chart-1" } } as const satisfies ChartConfig;

function Plot({
  data,
  config = ONE,
  xRange,
  children,
}: {
  readonly data: readonly { readonly [key: string]: number | string }[];
  readonly config?: ChartConfig;
  readonly xRange?: readonly [string, string];
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <div style={{ width: 400 }}>
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root data={data} config={config} xKey="name" xRange={xRange} aria-label="Plott">
          {Object.keys(config).map((key) => (
            <Chart.Bar key={key} dataKey={key} />
          ))}
          <Chart.Tooltip />
          <Chart.ActiveValue dataKey={Object.keys(config)[0] ?? "v"} />
          {children}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** Finish the entrance, so bars sit at rest under the pointer. */
function settle(host: HTMLElement): void {
  // DOM audit: Root's figure holds every animation of the chart.
  for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? []) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)) animation.finish();
  }
}

function bars(host: HTMLElement): HTMLElement[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-bar"]')];
}

function popupOpen(): boolean {
  // DOM audit: the popup portals out of the host and carries its own slot.
  return document.querySelector('[data-slot="chart-tooltip"]') !== null;
}

function active(host: HTMLElement): boolean {
  // DOM audit: Root states the active slot, which the crosshair reads, on data-active.
  return host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") ?? false;
}

function activeValue(host: HTMLElement): string | null {
  // DOM audit: the plot's ActiveValue is aria-hidden output.
  return host.querySelector('[data-slot="chart-active-value"]')?.textContent ?? null;
}

const ROWS = ["a", "b", "c"].map((name, index) => ({ name, v: index + 1 }));

/** The element over a bar's centre, which is the plot's pointer target, and that point inside it. */
function over(_host: HTMLElement, bar: HTMLElement): [Element, { position: { x: number; y: number } }] {
  const rect = bar.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const target = document.elementFromPoint(x, y);
  if (target === null) throw new Error("nothing over the bar");
  const box = target.getBoundingClientRect();
  return [target, { position: { x: x - box.left, y: y - box.top } }];
}

describe("the one dismissal", () => {
  it("closes the popup and the crosshair on a click on the pinned slot, and keeps them closed there", async () => {
    const { host } = renderThemed(<Plot data={ROWS} />);
    settle(host);
    const [, second, third] = bars(host);
    if (second === undefined || third === undefined) throw new Error("no bars");
    await userEvent.hover(...over(host, second));
    await expect.poll(popupOpen).toBe(true);
    await userEvent.click(...over(host, second));
    // DOM audit: the listbox states the pin on its own data attribute.
    expect(host.querySelector('[data-slot="chart-surface"]')?.hasAttribute("data-pinned")).toBe(true);
    await userEvent.click(...over(host, second));
    await expect.poll(popupOpen).toBe(false);
    expect(active(host)).toBe(false);
    // The pointer still rests on the dismissed slot, and another slot reopens the popup.
    await userEvent.hover(...over(host, third));
    await expect.poll(popupOpen).toBe(true);
  });

  it("closes a pinned popup and the crosshair on a press outside the chart", async () => {
    const { host } = renderThemed(<Plot data={ROWS} />);
    settle(host);
    const [first] = bars(host);
    if (first === undefined) throw new Error("no bars");
    await userEvent.hover(...over(host, first));
    await userEvent.click(...over(host, first));
    await expect.poll(popupOpen).toBe(true);
    await userEvent.click(document.body, { position: { x: 5, y: 5 } });
    await expect.poll(popupOpen).toBe(false);
    expect(active(host)).toBe(false);
  });
});

describe("the one active identity", () => {
  it("follows Root's fallback when new data drops the focused slot and later brings it back", async () => {
    // s3: focus b in [a, b], replace the data with [c, d], then with [b, c, d].
    const { host, rerender } = renderThemed(<Plot data={ROWS.slice(0, 2)} />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}");
    expect(activeValue(host)).toBe("2");
    rerender(
      <Plot
        data={[
          { name: "c", v: 3 },
          { name: "d", v: 4 },
        ]}
      />
    );
    rerender(
      <Plot
        data={[
          { name: "b", v: 2 },
          { name: "c", v: 3 },
          { name: "d", v: 4 },
        ]}
      />
    );
    // Both the option and Root took c when b left, so both still name c. The option moves focus
    // to its new element after the commit, so the check waits for it.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")?.startsWith("c")).toBe(true);
    expect(activeValue(host)).toBe("3");
  });

  it("follows Root's fallback when the window drops the focused slot and widens again", async () => {
    // q10: focus b, narrow the window to a, widen it again.
    const { host, rerender } = renderThemed(<Plot data={ROWS} xRange={["a", "c"]} />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}");
    expect(activeValue(host)).toBe("2");
    rerender(<Plot data={ROWS} xRange={["a", "a"]} />);
    rerender(<Plot data={ROWS} xRange={["a", "c"]} />);
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")?.startsWith("a")).toBe(true);
    expect(activeValue(host)).toBe("1");
  });

  it("gives a removed focused series way to all series", async () => {
    // s4: focus the third series, then replace the config with one series.
    const three = {
      x: { label: "X", color: "chart-1" },
      y: { label: "Y", color: "chart-2" },
      z: { label: "Z", color: "chart-3" },
    } as const satisfies ChartConfig;
    const rows = [{ name: "a", x: 1, y: 2, z: 3 }];
    const { host, rerender } = renderThemed(<Plot data={rows} config={three} />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("Z")).toBe(true);
    rerender(<Plot data={rows} config={{ x: three.x }} />);
    const label = document.activeElement?.getAttribute("aria-label") ?? "";
    expect(label.startsWith(",")).toBe(false);
    expect(label).toContain("X");
    // DOM audit: Root writes the focused series on data-near, which all series leave off.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-near")).toBe(false);
  });
});

describe("value identity", () => {
  it("tells two windows apart whose names would join alike", async () => {
    // q11: ["a|sb", "c"] and ["a", "b|sc"] both joined to "sa|sb|sc" under the old key.
    const rows = ["a", "a|sb", "b|sc", "c"].map((name, index) => ({ name, v: index + 1 }));
    const { host, rerender } = renderThemed(<Plot data={rows} xRange={["a|sb", "c"]} />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("1");
    rerender(<Plot data={rows} xRange={["a", "b|sc"]} />);
    // The new window starts at a, so a|sb, still active, moves to the window's second place.
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("2");
    expect(activeValue(host)).toBe("2");
  });
});
