// The tooltip's one dismissal and the one active identity, in Chromium. Oracle: the pointer and
// key rules, the `defaultActiveX` rule that Root reads the x at mount and makes its slot active
// when the window first holds it, unless a reader moved first, with the option naming that slot in
// the same commit, and the rows' own names and values, written by hand.
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { FocusOnLoad, LoadInTransition, PointProbe, preloadsSheet } from "../../../test/chart/default-active";
import { bars, popupOpen } from "../../../test/chart/marks";
import { holdRequest } from "../../../test/request-hold";
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
  defaultActiveX,
  children,
}: {
  readonly data: readonly { readonly [key: string]: number | string }[];
  readonly config?: ChartConfig;
  readonly xRange?: readonly [string, string];
  readonly defaultActiveX?: string;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <div style={{ width: 400 }}>
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data-intro="none"
          data={data}
          config={config}
          xKey="name"
          xRange={xRange}
          defaultActiveX={defaultActiveX}
          aria-label="Plott">
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

/** Focuses the plot's option from its own layout effect, inside Root, once `loaded` is set. */
function FocusFromChild({ loaded }: { readonly loaded: boolean }) {
  useLayoutEffect(() => {
    if (loaded) document.querySelector<HTMLElement>('[role="option"]')?.focus();
  }, [loaded]);
  return null;
}

/**
 * A plot of bars whose default is b, with no part that reads the active point until `probe` mounts
 * the probe.
 */
function LateRows({
  data,
  probe,
}: {
  readonly data: readonly { readonly [key: string]: number | string }[];
  readonly probe: boolean;
}) {
  return (
    <div style={{ width: 400 }}>
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data-intro="none"
          data={data}
          config={ONE}
          xKey="name"
          defaultActiveX="b"
          aria-label="Plott">
          <Chart.Bar dataKey="v" />
          {probe ? <PointProbe /> : null}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

function active(host: HTMLElement): boolean {
  // Root states the active slot, which the crosshair reads, on data-active.
  return host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") ?? false;
}

function activeValue(host: HTMLElement): string | null {
  // The plot's ActiveValue is aria-hidden output.
  return host.querySelector('[data-slot="chart-active-value"]')?.textContent ?? null;
}

const ROWS = ["a", "b", "c"].map((name, index) => ({ name, v: index + 1 }));

/** The element over a bar's center, which is the plot's pointer target, and that point inside it. */
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
    const [, second, third] = bars(host);
    if (second === undefined || third === undefined) throw new Error("no bars");
    await userEvent.hover(...over(host, second));
    await expect.poll(popupOpen).toBe(true);
    await userEvent.click(...over(host, second));
    // The listbox states the pin on its own data attribute.
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
    // Focus b in [a, b], replace the data with [c, d], then with [b, c, d].
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
    // Focus b, narrow the window to a, widen it again.
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
    // Focus the third series, then replace the config with one series.
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
    // Root writes the focused series on data-near, which all series leave off.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-near")).toBe(false);
  });

  it("makes a default x active once rows that hold it arrive, and lands the first Tab on it", async () => {
    // A loading page mounts Root with no rows, then hands it a, b and c. b's value is 2.
    const { host, rerender } = renderThemed(<Plot data={[]} defaultActiveX="b" />);
    rerender(<Plot data={ROWS} defaultActiveX="b" />);
    // Root writes the active source on data-active, "default" for the default slot.
    expect(host.querySelector('[data-slot="chart"]')?.getAttribute("data-active")).toBe("default");
    expect(activeValue(host)).toBe("2");
    await expect.poll(popupOpen).toBe(true);
    // The option and Root name one slot, so focus enters on b and its name starts with b.
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("b")).toBe(true);
    expect(activeValue(host)).toBe("2");
  });

  it("keeps a late default active when a parent focuses the plot in the commit that brings its rows", () => {
    // The parent's layout effect runs after Root's in the commit that hands Root a, b and c, and
    // focuses the option. The option already names b, so focus keeps b, whose value is 2, active.
    const { host, rerender } = renderThemed(
      <FocusOnLoad loaded={false}>
        <Plot data={[]} defaultActiveX="b" />
      </FocusOnLoad>
    );
    rerender(
      <FocusOnLoad loaded>
        <Plot data={ROWS} defaultActiveX="b" />
      </FocusOnLoad>
    );
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("b")).toBe(true);
    expect(activeValue(host)).toBe("2");
  });

  it("activates the late default when a child of Root focuses the plot in the commit that brings its rows", () => {
    // The child's layout effect runs before Root's in that commit. Focus makes b active for the
    // new rows, so the option and the readout both name b.
    const { host, rerender } = renderThemed(
      <Plot data={[]} defaultActiveX="b">
        <FocusFromChild loaded={false} />
        <PointProbe />
      </Plot>
    );
    rerender(
      <Plot data={ROWS} defaultActiveX="b">
        <FocusFromChild loaded />
        <PointProbe />
      </Plot>
    );
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("b")).toBe(true);
    expect(host.querySelector("[data-point]")?.textContent).toBe("b");
  });

  it("keeps the slot a reader focuses while a transition that brings the default waits to commit", async () => {
    // The rows hold a, and a transition brings a, b and c, then waits on a stylesheet before it
    // commits. Focus that enters the plot meanwhile activates a, a reader's move, so the default b
    // stays inactive once the rows land, and the option and the probe both name a. Nothing that
    // renders before the commit reads the active point, so the focus re-renders nothing and React
    // commits the render it held.
    const href = new URL(`./chart.css?late-rows=${crypto.randomUUID()}`, import.meta.url).href;
    const release = await holdRequest(href);
    let load: (() => void) | undefined;
    const { host } = renderThemed(
      <LoadInTransition
        href={href}
        bind={(next) => {
          load = next;
        }}>
        {(loaded) => <LateRows data={loaded ? ROWS : ROWS.slice(0, 1)} probe={loaded} />}
      </LoadInTransition>
    );
    load?.();
    await expect.poll(() => preloadsSheet(href)).toBe(true);
    // React finishes the render in the task that preloads, and the commit waits on the sheet.
    await nextFrames(2);
    expect(bars(host)).toHaveLength(1);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("a")).toBe(true);
    await release();
    await expect.poll(() => bars(host)).toHaveLength(3);
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("a")).toBe(true);
    expect(host.querySelector("[data-point]")?.textContent).toBe("a");
  });

  it("keeps a late default inactive once a reader has moved the active slot and left", async () => {
    // The first rows hold only a. Focus activates a and leaving the plot clears it, which leaves
    // nothing active, as at mount. Rows that then bring b keep nothing active.
    const { host, rerender } = renderThemed(<Plot data={[]} defaultActiveX="b" />);
    rerender(<Plot data={ROWS.slice(0, 1)} defaultActiveX="b" />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(activeValue(host)).toBe("1");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(active(host)).toBe(false);
    rerender(<Plot data={ROWS} defaultActiveX="b" />);
    expect(active(host)).toBe(false);
    expect(popupOpen()).toBe(false);
  });

  it.each([
    ["arrive after mount", []],
    ["are there at mount", ROWS],
  ] as const)(
    "keeps a default outside the window pending when its rows %s, until the window holds it",
    (_, first) => {
      // The window shows a and b, and the default is c, whose value is 3. A data update inside the
      // window keeps nothing active, and the window that widens to c makes c active.
      const { host, rerender } = renderThemed(<Plot data={first} xRange={["a", "b"]} defaultActiveX="c" />);
      rerender(<Plot data={ROWS} xRange={["a", "b"]} defaultActiveX="c" />);
      expect(active(host)).toBe(false);
      rerender(
        <Plot data={ROWS.map((row) => ({ ...row, v: row.v * 10 }))} xRange={["a", "b"]} defaultActiveX="c" />
      );
      expect(active(host)).toBe(false);
      rerender(<Plot data={ROWS} xRange={["a", "c"]} defaultActiveX="c" />);
      expect(host.querySelector('[data-slot="chart"]')?.getAttribute("data-active")).toBe("default");
      expect(activeValue(host)).toBe("3");
    }
  );

  it("ignores a defaultActiveX added after mount", () => {
    // Root reads the default at mount, as `defaultValue` works, and the chart mounted with none.
    const { host, rerender } = renderThemed(<Plot data={ROWS} />);
    rerender(<Plot data={ROWS} defaultActiveX="b" />);
    rerender(<Plot data={ROWS.map((row) => ({ ...row, v: row.v * 10 }))} defaultActiveX="b" />);
    expect(active(host)).toBe(false);
  });
});

describe("value identity", () => {
  it("tells two windows apart whose names would join alike", async () => {
    // The windows ["a|sb", "c"] and ["a", "b|sc"] both joined to "sa|sb|sc" under the old key.
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

describe("a consumer ref on Root", () => {
  it("receives the figure, and Root still marks the hovered slot active", async () => {
    let figure: HTMLElement | null = null;
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            ref={(element) => {
              figure = element;
            }}
            data-intro="none"
            data={ROWS}
            config={ONE}
            xKey="name"
            aria-label="Plott">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // Root's figure carries the active state the crosshair reads.
    const root = host.querySelector('[data-slot="chart"]');
    expect(figure).toBe(root);
    const [, second] = bars(host);
    if (second === undefined) throw new Error("no bars");
    await userEvent.hover(...over(host, second));
    await expect.poll(() => root?.getAttribute("data-active")).toBe("pointer");
  });
});

describe("a click that moves a pin onto the option's slot", () => {
  it("pins the clicked slot, though its press focuses the option", async () => {
    // The plot's option lies over the first slot, a, so a press there focuses it.
    const { host } = renderThemed(<Plot data={ROWS} />);
    const [first, second] = bars(host);
    if (first === undefined || second === undefined) throw new Error("no bars");
    await userEvent.click(...over(host, second));
    await expect.poll(() => activeValue(host)).toBe("2");
    await userEvent.click(...over(host, first));
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    await expect.poll(popupOpen).toBe(true);
    await expect.poll(() => activeValue(host)).toBe("1");
  });
});
