// The React cost of pointer and motion, in Chromium. In a 240-step pointer sweep only the tooltip
// and the plot surface render, and marks, the crosshair and a static legend render 0 times, so a
// chart of marks and followers alone, a SlotLabel's rolling pill among them, commits nothing. A ValueLabel prints the active value as
// text, so it renders per slot, as the tooltip does. A LegendValue renders at most once per change
// of active slot. A data update costs one Root commit and its tween costs none. The counts come
// from React's Profiler, and the expected numbers come from CONTRACT section 4, pass-2's
// interaction README section 6 and the SVG brief's motion rule, not from Fuse. A parent's
// re-render with an equal inline config or x format, and a legend toggle, render no mark at all.
// A stream that shifts its window by one slot per append keeps every x-tick node whose slot stays.
import { Profiler } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { MOTION_A, MOTION_B, MOTION_CONFIG } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

const commits = new Map<string, number>();

function Counted({
  id,
  onCommit,
  children,
}: {
  readonly id: string;
  readonly onCommit?: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Profiler
      id={id}
      onRender={(_, phase) => {
        if (phase === "mount") return;
        commits.set(id, (commits.get(id) ?? 0) + 1);
        onCommit?.();
      }}>
      {children}
    </Profiler>
  );
}

// The inputs the browser itself sends. The sweep dispatches untrusted events, so a trusted one is
// input from outside the test, such as a real pointer or a focus change.
const BROWSER_INPUTS = [
  "pointerover",
  "pointerout",
  "pointermove",
  "pointerdown",
  "focusin",
  "focusout",
  "keydown",
];

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("pointer cost", () => {
  it("renders only the tooltip, the surface and a LegendValue in a 240-step sweep", async () => {
    commits.clear();
    // Each LegendValue commit's sweep step and printed value, and each input the browser sent, so
    // a failure names what moved the active slot besides the sweep.
    let step = -1;
    const valueCommits: string[] = [];
    const browserInputs: string[] = [];
    const recordInput = (event: Event) => {
      if (event.isTrusted) browserInputs.push(`${String(step)}:${event.type}`);
    };
    const { host } = renderThemed(
      <div style={{ width: 820 }}>
        <S06Chart>
          <Counted id="bar">
            <Chart.Bar dataKey="household" />
          </Counted>
          <Counted id="crosshair">
            <Chart.Crosshair />
          </Counted>
          <Counted id="tooltip">
            <Chart.Tooltip />
          </Counted>
          <Counted id="legend">
            <Chart.Legend />
          </Counted>
          <Counted
            id="legend-value"
            onCommit={() => {
              // DOM audit: a LegendValue is a span with no role of its own, read only for its text.
              const value = host.querySelector('[data-slot="chart-legend-value"]')?.textContent ?? "";
              valueCommits.push(`${String(step)}:${value}`);
            }}>
            <Chart.Legend>
              <Chart.LegendItem>
                <Chart.LegendValue />
              </Chart.LegendItem>
            </Chart.Legend>
          </Counted>
        </S06Chart>
      </div>
    );
    // The real cursor rests where an earlier suite left it. A popup that moves onto or off it makes
    // the browser send hover events of its own, so it rests in the viewport's far corner, right of
    // the 820 px chart that holds the popup.
    await userEvent.hover(document.documentElement, {
      position: { x: window.innerWidth - 2, y: window.innerHeight - 2 },
      force: true,
    });
    // The mount ends with the commit that draws the measured plot.
    await frame();
    commits.clear();
    valueCommits.length = 0;
    for (const type of BROWSER_INPUTS) host.addEventListener(type, recordInput, true);
    window.addEventListener("blur", recordInput);
    window.addEventListener("focus", recordInput);
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    const slots = new Set<number>();
    try {
      for (step = 0; step < 240; step += 1) {
        const x = box.left + (box.width * (step + 0.5)) / 240;
        surface?.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: x,
            clientY: box.top + box.height / 2,
            pointerType: "mouse",
          })
        );
        slots.add(Math.floor(((step + 0.5) / 240) * 24));
        await frame();
      }
    } finally {
      for (const type of BROWSER_INPUTS) host.removeEventListener(type, recordInput, true);
      window.removeEventListener("blur", recordInput);
      window.removeEventListener("focus", recordInput);
    }
    expect(commits.get("bar") ?? 0).toBe(0);
    expect(commits.get("crosshair") ?? 0).toBe(0);
    expect(commits.get("legend") ?? 0).toBe(0);
    expect(commits.get("tooltip") ?? 0).toBeGreaterThan(0);
    // 24 slots, so at most 24 changes of the active slot, each rendering the legend value once.
    expect(
      commits.get("legend-value") ?? 0,
      `LegendValue commits (step:value) ${valueCommits.join(" ")}; browser inputs ${browserInputs.slice(0, 40).join(" ") || "none"}`
    ).toBeLessThanOrEqual(slots.size);
  });

  it("commits nothing while the pointer sweeps a chart of marks and followers", async () => {
    commits.clear();
    const { host } = renderThemed(
      <div style={{ width: 820 }}>
        <Counted id="chart">
          <S06Chart>
            <Chart.Grid />
            <Chart.XAxis />
            <Chart.Crosshair>
              <Chart.SlotLabel />
            </Chart.Crosshair>
            <Chart.Bar dataKey="household" />
            <Chart.ActiveValueLine dataKey="household" />
            <Chart.ReferenceLine y={1} />
          </S06Chart>
        </Counted>
      </div>
    );
    await frame();
    commits.clear();
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    for (let step = 0; step < 240; step += 1) {
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + (box.width * (step + 0.5)) / 240,
          clientY: box.top + box.height / 2,
          pointerType: "mouse",
        })
      );
      await frame();
    }
    // The sweep reached the chart: the crosshair band sits on the last of the 24 hours, which the
    // slot grid may end a few pixels short of the plot's edge, its leftover pixels split between
    // both ends.
    // DOM audit: the crosshair is aria-hidden plot output.
    const band = host.querySelector('[data-slot="chart-crosshair"] rect')?.getBoundingClientRect();
    expect(band?.left ?? 0).toBeGreaterThan(box.left + (box.width * 22.5) / 24);
    expect(band?.right ?? 0).toBeLessThanOrEqual(box.right + 0.5);
    expect(commits.get("chart") ?? 0).toBe(0);
  });

  it("costs one Root commit for a data update, 0 for its transition, and 0 marks for hover during it", async () => {
    function Motion({ data }: { readonly data: readonly MotionRow[] }): ReactNode {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 400 }}>
            <Counted id="root">
              <Chart.Root
                data={data}
                config={MOTION_CONFIG}
                xKey="day"
                interval="day"
                timeZone="Europe/Oslo"
                data-intro="none"
                aria-label="Forbruk per dag">
                <Counted id="bar">
                  <Chart.Bar dataKey="p" />
                </Counted>
              </Chart.Root>
            </Counted>
          </div>
        </LocaleProvider>
      );
    }
    const { host, rerender } = renderThemed(<Motion data={MOTION_A} />);
    await frame();
    commits.clear();
    rerender(<Motion data={MOTION_B} />);
    expect(commits.get("root")).toBe(1);
    // The tween writes attributes in requestAnimationFrame, so its 480 ms commit nothing.
    const quiet = performance.now();
    while (performance.now() - quiet < 520) await frame();
    expect(commits.get("root")).toBe(1);
    rerender(<Motion data={MOTION_A} />);
    const afterUpdate = commits.get("bar") ?? 0;
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    const start = performance.now();
    // Hover across the plot while the 480 ms tween runs, then wait for it to end.
    for (let step = 0; performance.now() - start < 520; step += 1) {
      const x = box.left + ((step % 10) + 0.5) * (box.width / 10);
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: box.top + 10,
          pointerType: "mouse",
        })
      );
      await frame();
    }
    expect(commits.get("bar") ?? 0).toBe(afterUpdate);
  });
});

describe("the mount's cost", () => {
  it("commits a fractional plot under a transform as often as the same plot untransformed (review 3, simplify F7)", async () => {
    // A 333.3 px wide plot lays out at 333.296875 px, which the computed style serializes as
    // 333.297. The observer's first report holds the full precision. Under a transform the drawn box
    // is scaled, so only the size comparison can tell the two reports of one size apart. The oracle
    // is the untransformed chart's own count.
    const mounted = async (transform: string | undefined): Promise<number> => {
      commits.clear();
      const { unmount } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 333.3, transform, transformOrigin: "0 0" }}>
            <Counted id="mount">
              <Chart.Root
                data={MOTION_A}
                config={MOTION_CONFIG}
                xKey="day"
                interval="day"
                timeZone="Europe/Oslo"
                data-intro="none"
                aria-label="Forbruk per dag">
                <Chart.Bar dataKey="p" />
              </Chart.Root>
            </Counted>
          </div>
        </LocaleProvider>
      );
      for (let count = 0; count < 4; count += 1) await frame();
      const count = commits.get("mount") ?? 0;
      unmount();
      return count;
    };
    expect(await mounted("scale(0.5)")).toBe(await mounted(undefined));
  });
});

describe("Root's input cost (X15)", () => {
  // The marks read Root's context, which changes with what the config says and never with its
  // identity or the selection. The oracle is the context contract in chart-context.ts: a parent's
  // re-render with an equal inline config renders no mark, and a legend toggle renders the legend
  // and no mark.
  const marks = (
    <>
      <Counted id="bar">
        <Chart.Bar dataKey="p" />
      </Counted>
      <Counted id="line">
        <Chart.Line dataKey="q" />
      </Counted>
      <Counted id="axis">
        <Chart.XAxis />
      </Counted>
      <Counted id="toggles">
        <Chart.LegendToggleGroup />
      </Counted>
    </>
  );

  /** A host that rebuilds Root's config and its own props on every render, as an app often does. */
  function Host({
    tick,
    inlineFormat = false,
    children,
  }: {
    readonly tick: number;
    /** Whether the host also writes Root's `xFormat` inline, a new object on every render. */
    readonly inlineFormat?: boolean;
    readonly children: ReactNode;
  }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }} data-tick={tick}>
          <Chart.Root
            data={MOTION_A}
            config={{
              p: { label: "P", color: "chart-1" },
              q: { label: "Q", color: "chart-2" },
            }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            yInclude={[0, 10]}
            xFormat={inlineFormat ? { day: "numeric", month: "short" } : undefined}
            onSelectedKeyChange={() => undefined}
            data-intro="none"
            aria-label="Forbruk per dag">
            {children}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("renders no mark when a parent re-renders with an equal inline config", async () => {
    const { rerender } = renderThemed(<Host tick={0}>{marks}</Host>);
    await frame();
    commits.clear();
    rerender(<Host tick={1}>{marks}</Host>);
    rerender(<Host tick={2}>{marks}</Host>);
    await frame();
    expect(["bar", "line", "axis", "toggles"].map((id) => commits.get(id) ?? 0)).toEqual([0, 0, 0, 0]);
  });

  it("renders no mark when a parent re-renders with an equal inline xFormat (review 2, Y10)", async () => {
    const { rerender } = renderThemed(
      <Host tick={0} inlineFormat>
        {marks}
      </Host>
    );
    await frame();
    commits.clear();
    rerender(
      <Host tick={1} inlineFormat>
        {marks}
      </Host>
    );
    rerender(
      <Host tick={2} inlineFormat>
        {marks}
      </Host>
    );
    await frame();
    expect(["bar", "line", "axis", "toggles"].map((id) => commits.get(id) ?? 0)).toEqual([0, 0, 0, 0]);
  });

  it("reads a labelled reference's size as often under an equal inline style as under one style object (review 3, W8)", async () => {
    // The oracle is the same Root commits with the reference's style held in one object: an inline
    // style with the same values is no change, so the label's computed style is read no more often.
    const held = { opacity: 0.9 };
    const reads = async (style: () => { readonly opacity: number }): Promise<number> => {
      const reference = () => <Chart.ReferenceLine y={5} label="Mål" style={style()} />;
      const { rerender, unmount } = renderThemed(<Host tick={0}>{reference()}</Host>);
      await frame();
      const spy = vi.spyOn(window, "getComputedStyle");
      rerender(<Host tick={1}>{reference()}</Host>);
      rerender(<Host tick={2}>{reference()}</Host>);
      await frame();
      const count = spy.mock.calls.filter(
        ([element]) => element.getAttribute("data-slot") === "chart-reference-label"
      ).length;
      spy.mockRestore();
      unmount();
      return count;
    };
    const steady = await reads(() => held);
    expect(steady).toBeGreaterThan(0);
    expect(await reads(() => ({ opacity: 0.9 }))).toBe(steady);
  });

  it("renders the legend toggles and no mark when a toggle selects a series", async () => {
    renderThemed(<Host tick={0}>{marks}</Host>);
    await frame();
    commits.clear();
    await userEvent.click(page.getByRole("button", { name: "Q" }));
    await frame();
    expect(page.getByRole("button", { name: "Q" }).element().getAttribute("aria-pressed")).toBe("true");
    expect(["bar", "line", "axis"].map((id) => commits.get(id) ?? 0)).toEqual([0, 0, 0]);
    expect(commits.get("toggles") ?? 0).toBeGreaterThan(0);
  });
});

describe("a stream's cost", () => {
  it("adds an x-tick node only for an hour that enters the window, over 120 one-minute appends", async () => {
    // A 1,000-minute window from Oslo midnight, 5 January 2026, shifts by one minute per append.
    // The oracle is the data: a tick node stands for a slot that starts a whole hour, so only an
    // hour start among the appended minutes may add one. The always-shown first label sits on the
    // window's first minute and only changes its text.
    const from = Date.UTC(2026, 0, 4, 23);
    const rows = Array.from({ length: 1120 }, (_, index) => ({
      t: new Date(from + index * 60_000),
      a: 5 + Math.sin(index / 30),
    }));
    const stream = (first: number): ReactNode => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 960 }}>
          <Chart.Root
            data={rows.slice(first, first + 1000)}
            config={{ a: { label: "A", color: "chart-1" } }}
            xKey="t"
            xScale="point"
            interval="minute"
            timeZone="Europe/Oslo"
            aria-label="Strøm">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Line dataKey="a" curve="linear" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(stream(0));
    await frame();
    await frame();
    // DOM audit: the x axis is aria-hidden plot output.
    const AXIS = '[data-slot="chart-x-axis"]';
    const axis = host.querySelector(AXIS);
    // The mount draws the first label and at least the 01:00 tick, so the count below watches ticks.
    expect(axis?.querySelectorAll('[data-slot="chart-x-tick"]').length ?? 0).toBeGreaterThanOrEqual(2);
    // The observer watches the whole chart, so a remounted axis counts as added nodes too.
    let added = 0;
    let texts = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (record.type === "characterData" && target?.closest(AXIS)) texts += 1;
        added += [...record.addedNodes].filter(
          (node) => node instanceof Element && (node.matches(AXIS) || node.closest(AXIS) !== null)
        ).length;
      }
    });
    observer.observe(host, { subtree: true, childList: true, characterData: true });
    let sameAxis = 0;
    for (let first = 1; first <= 120; first += 1) {
      rerender(stream(first));
      await frame();
      if (host.querySelector(AXIS) === axis) sameAxis += 1;
    }
    observer.disconnect();
    expect(sameAxis).toBe(120);
    // Oslo keeps a whole-hour offset, so an hour starts at a UTC minute of 0.
    const enteringHours = rows.slice(1000, 1120).filter(({ t }) => t.getUTCMinutes() === 0).length;
    expect(enteringHours).toBe(2);
    expect(added).toBeLessThanOrEqual(enteringHours);
    expect(texts).toBeLessThanOrEqual(120);
  });
});
