// A lane popup stays inside the viewport. Unit under test: the polar tooltip's lane anchor over a
// bill PieChart with outside labels and a title, a ClockChart of six meters with a Legend at its end
// side, and a ClockChart of twelve series whose popup is taller than its side lanes, as the page
// scrolls each from fully below the viewport to fully above it and as the viewport resizes. Oracle:
// R2.3 as amended, read from the rendered boxes. A popup may leave its figure, stays inside the
// viewport and never covers its dial, its labels, its title or its Root's controls. Where the
// viewport has the popup's height and the 8 px gap free above or below the union of the dial, the
// labels, the title and the controls, some lane holds the popup, so at every such position the
// popup's box lies inside the viewport and overlaps none of them.
import type { ReactElement } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { framesUntil, nextFrames, pollFrames } from "../../../test/animation-frames";
import { hoverAt, parkRealPointer, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";

afterEach(async () => {
  window.scrollTo({ top: 0, behavior: "instant" });
  await page.viewport(1024, 768);
});

type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

const GAP = 8;

/** The most frames a popup takes to open on a hover: six times the 5 measured at most. */
const OPEN_FRAMES = 30;

/** The most frames a popup takes to close: its 150 ms fade is 9 frames at 60 a second. */
const CLOSE_FRAMES = 60;

function overlap(a: Box, b: Box): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
  );
}

/** The popup's node, which stays mounted once it has opened. */
function popupNode(): HTMLElement | null {
  // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
}

/** The popup's computed opacity, 0 while none is mounted. */
function popupOpacity(): number {
  const node = popupNode();
  return node === null ? 0 : Number(getComputedStyle(node).opacity);
}

/** Whether the popup runs an animation or a transition, such as its exit fade. */
function popupFading(): boolean {
  return (popupNode()?.getAnimations({ subtree: true }) ?? []).some(
    (animation) => animation.playState === "running"
  );
}

/**
 * Whether the popup has closed: unmounted, or no longer open with its exit fade run. A closed popup
 * stays mounted once it has opened, its positioner hidden.
 */
function popupClosed(): boolean {
  const node = popupNode();
  return node === null || (!node.hasAttribute("data-open") && !popupFading());
}

/** React reads a pointer leaving the plot from pointerout toward an element outside it. */
function leavePlot(): void {
  page
    .getByRole("listbox")
    .element()
    .dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        pointerType: "mouse",
        clientX: 0,
        clientY: 0,
        relatedTarget: document.body,
      })
    );
}

/** The shown popup's box, or null while none shows. */
function popupBox(): DOMRect | null {
  // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
  const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
  if (node === null || Number(getComputedStyle(node).opacity) < 0.5) return null;
  const box = node.getBoundingClientRect();
  return box.width === 0 ? null : box;
}

const DAY = Date.parse("2025-10-24T22:00:00Z");

/** The categorical roles the meters paint in turn. */
const ROLES = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"] as const;

/** Hourly kWh for a number of meters, each a series. */
function meters(count: number) {
  const keys = Array.from({ length: count }, (_, index) => `m${String(index + 1)}`);
  const config: ChartConfig = Object.fromEntries(
    keys.map((key, index) => [
      key,
      { label: `Måler ${String(index + 1)}`, color: ROLES[index % ROLES.length] ?? "chart-1" },
    ])
  );
  const data = Array.from({ length: 24 }, (_, hour) => ({
    start: DAY + hour * 3_600_000,
    ...Object.fromEntries(keys.map((key, index) => [key, 1 + ((hour + index) % 5)])),
  }));
  return { keys, config, data };
}

/** The layouts the sweep scrolls: each chart, the section's width and the viewport it runs in. */
const LAYOUTS = {
  bill: (
    <PieChart.Root
      data={[
        { part: "energi", kr: 640 },
        { part: "nettleie", kr: 360 },
      ]}
      config={{
        energi: { label: "Energi", color: "chart-1" },
        nettleie: { label: "Nettleie", color: "chart-2" },
      }}
      nameKey="part"
      valueKey="kr"
      data-intro="none"
      aria-labelledby="chart-title">
      <PieChart.Pie />
      <PieChart.Labels position="outside" />
      <PieChart.Tooltip />
    </PieChart.Root>
  ),
  "six meters with a side legend": (() => {
    const { keys, config, data } = meters(6);
    return (
      <ClockChart.Root
        data={data}
        config={config}
        xKey="start"
        cycle="day"
        interval="hour"
        data-intro="none"
        aria-labelledby="chart-title">
        <ClockChart.Grid />
        <ClockChart.AngleAxis />
        {keys.map((key) => (
          <ClockChart.Line key={key} dataKey={key} />
        ))}
        <ClockChart.Legend side="end" />
        <ClockChart.Tooltip />
      </ClockChart.Root>
    );
  })(),
  "twelve series, a popup taller than its side lanes": (() => {
    const { keys, config, data } = meters(12);
    return (
      <ClockChart.Root
        data={data}
        config={config}
        xKey="start"
        cycle="day"
        interval="hour"
        data-intro="none"
        aria-labelledby="chart-title">
        <ClockChart.Grid />
        <ClockChart.AngleAxis />
        {keys.map((key) => (
          <ClockChart.Line key={key} dataKey={key} />
        ))}
        <ClockChart.Tooltip />
      </ClockChart.Root>
    );
  })(),
} satisfies Record<string, ReactElement>;

/** A page that scrolls a chart, its title above it, through the viewport. */
function renderScene(layout: keyof typeof LAYOUTS = "bill", width = "min(728px, 100%)") {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <button type="button">Før</button>
      <div style={{ height: 1400 }} />
      <section style={{ width }}>
        <h2 id="chart-title" style={{ margin: 0 }}>
          Forbruk
        </h2>
        {LAYOUTS[layout]}
      </section>
      <div style={{ height: 1400 }} />
    </LocaleProvider>
  );
  const figure = polarFigure(host);
  // The plot's listbox spans the dial's box.
  const dial = (): DOMRect => page.getByRole("listbox").element().getBoundingClientRect();
  // DOM audit: the labels are aria-hidden plot output, read by their slots, as the anchor reads them.
  const labels = (): DOMRect[] =>
    [
      ...figure.querySelectorAll(
        '[data-slot$="angle-label"], [data-slot="pie-chart-label"], [data-slot$="value-label"], [data-slot$="radius-label"]'
      ),
    ]
      .map((label) => label.getBoundingClientRect())
      .filter((box) => box.width > 0);
  // DOM audit: the legend is a list of decorative swatches and labels, read by its slot.
  const controls = (): DOMRect[] =>
    [...figure.querySelectorAll('[data-slot="chart-legend"]')].map((legend) =>
      legend.getBoundingClientRect()
    );
  const title = (): DOMRect => host.querySelector("h2")?.getBoundingClientRect() ?? new DOMRect();
  // The surface hands focus between option elements, so the option to focus is the current one.
  const option = (): HTMLElement => {
    const current = host.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    if (current === null) throw new Error("no option");
    return current;
  };
  const before = host.querySelector<HTMLElement>("button");
  if (before === null) throw new Error("no button");
  /**
   * What a step that missed found: the figure's active and pinned state, the popup's inline and
   * computed opacity, its positioner's hidden state and whether the document has focus.
   */
  const state = (): string => {
    const node = popupNode();
    const positioner = node?.parentElement;
    return [
      `data-active ${String(figure.getAttribute("data-active"))}`,
      `data-pinned ${String(figure.hasAttribute("data-pinned"))}`,
      `opacity ${node === null ? "unmounted" : `inline "${node.style.opacity}", computed ${String(popupOpacity())}`}`,
      `positioner hidden ${String(positioner?.hidden ?? null)}, anchor-hidden ${String(positioner?.hasAttribute("data-anchor-hidden") ?? null)}`,
      `document focus ${String(document.hasFocus())}`,
    ].join("; ");
  };
  /** The faults of the shown popup against the rule, or none where no lane need hold it. */
  const faults = (where: string): string[] => {
    const box = popupBox();
    if (box === null) return [`${where}: no popup (${state()})`];
    const obstacles = [dial(), title(), ...labels(), ...controls()];
    const top = Math.min(...obstacles.map((rect) => rect.top));
    const bottom = Math.max(...obstacles.map((rect) => rect.bottom));
    const room = top - GAP >= box.height || window.innerHeight - (bottom + GAP) >= box.height;
    if (!room) return [];
    const found: string[] = [];
    if (box.top < -0.5 || box.bottom > window.innerHeight + 0.5)
      found.push(`${where}: outside the viewport at ${box.top.toFixed(0)}–${box.bottom.toFixed(0)}`);
    if (overlap(box, dial())) found.push(`${where}: over the dial`);
    if (labels().some((label) => overlap(box, label))) found.push(`${where}: over a label`);
    if (overlap(box, title())) found.push(`${where}: over the title`);
    if (controls().some((control) => overlap(box, control))) found.push(`${where}: over the legend`);
    return found;
  };
  /** The scroll offset that puts the dial's top at a viewport y. */
  const scrollFor = (dialTop: number): number => window.scrollY + dial().top - dialTop;
  return { dial, option, before, faults, state, scrollFor };
}

describe("a lane popup inside the viewport", () => {
  it.each([
    ["bill", 390, 600, "min(728px, 100%)"],
    ["bill", 1024, 600, "min(728px, 100%)"],
    ["six meters with a side legend", 1024, 900, "800px"],
    ["twelve series, a popup taller than its side lanes", 1024, 1000, "728px"],
  ] as const)(
    "rests the %s popup inside the viewport at %s × %s from every scroll, opened by focus and by hover",
    async (layout, width, height, section) => {
      await page.viewport(width, height);
      // The scene moves the pointer through synthetic events, so the real one waits in the corner.
      await parkRealPointer();
      const { dial, option, before, faults, state, scrollFor } = renderScene(layout, section);
      await nextFrames(2);
      const size = dial().height;
      const found: string[] = [];
      // Every wait counts frames, not milliseconds, which a loaded runner that paints a few frames a
      // second runs out of, and a wait that runs out records its step in `found` and goes on.
      const close = async (where: string): Promise<void> => {
        if (!(await framesUntil(popupClosed, CLOSE_FRAMES)))
          found.push(`${where}: still shown after ${String(CLOSE_FRAMES)} frames (${state()})`);
      };
      for (let at = height; at >= -size; at -= 40) {
        window.scrollTo({ top: scrollFor(at), behavior: "instant" });
        await nextFrames(3);
        option().focus({ preventScroll: true });
        await nextFrames(14);
        found.push(...faults(`focus, dial at ${String(at)}`));
        before.focus({ preventScroll: true });
        // The real close, past the exit fade, so the hover opens a closed popup.
        await close(`blur, dial at ${String(at)}`);
        // A hover on the dial's visible part: on the chord 0.3 R right of the centre, clear of the
        // pick's dead band at the centre, at the centre's height kept within 0.9 R of it and inside
        // the viewport.
        const shown = dial();
        const radius = (shown.right - shown.left) / 2;
        const centre = { x: (shown.left + shown.right) / 2, y: (shown.top + shown.bottom) / 2 };
        const low = Math.max(centre.y - 0.9 * radius, 1);
        const high = Math.min(centre.y + 0.9 * radius, height - 1);
        if (high - low < 8) continue;
        await hoverAt(centre.x + 0.3 * radius, Math.min(high - 2, Math.max(low + 2, centre.y)));
        // The popup opens in a few frames, 2 to 5 measured: it waits for two frame checks and
        // Base UI's placement. A miss shows in `faults` with the state it found.
        await framesUntil(() => popupBox() !== null, OPEN_FRAMES);
        await nextFrames(14);
        found.push(...faults(`hover, dial at ${String(at)}`));
        leavePlot();
        await close(`leave, dial at ${String(at)}`);
      }
      expect(found).toEqual([]);
    },
    120_000
  );

  it.each(["a blur", "the pointer leaving"] as const)(
    "reopens the popup on a hover over the same slice while it still fades out after %s",
    async (close) => {
      await page.viewport(1024, 600);
      const { dial, option, before } = renderScene();
      await nextFrames(2);
      window.scrollTo({ top: 0, behavior: "instant" });
      const shown = dial();
      const radius = (shown.right - shown.left) / 2;
      // 0.3 R right of the centre lies at 90°, inside Energi's 0° to 230.4°, the slice focus opens.
      const at = [(shown.left + shown.right) / 2 + 0.3 * radius, (shown.top + shown.bottom) / 2] as const;
      if (close === "a blur") option().focus({ preventScroll: true });
      else await hoverAt(...at);
      await pollFrames(() => popupOpacity() === 1, true, OPEN_FRAMES);
      if (close === "a blur") before.focus({ preventScroll: true });
      else leavePlot();
      // Mid-fade: below half its opacity with its exit still running.
      await pollFrames(() => popupOpacity() < 0.5 && popupFading(), true, OPEN_FRAMES);
      await hoverAt(...at);
      await pollFrames(() => popupOpacity() === 1 && !popupFading(), true, 2 * OPEN_FRAMES);
      expect(popupBox()).not.toBeNull();
    }
  );

  it("moves the popup into view when a scroll carries its lane out, focus kept", async () => {
    await page.viewport(390, 600);
    const { option, faults, scrollFor } = renderScene();
    await nextFrames(2);
    window.scrollTo({ top: scrollFor(388), behavior: "instant" });
    await nextFrames(3);
    option().focus({ preventScroll: true });
    await nextFrames(14);
    expect(faults("opened")).toEqual([]);
    window.scrollBy({ top: 360, behavior: "instant" });
    await nextFrames(14);
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    expect(faults("scrolled 360 px")).toEqual([]);
  });

  it("moves the popup into view when the viewport's height shrinks under it", async () => {
    await page.viewport(390, 800);
    const { option, faults, scrollFor } = renderScene();
    await nextFrames(2);
    window.scrollTo({ top: scrollFor(388), behavior: "instant" });
    await nextFrames(3);
    option().focus({ preventScroll: true });
    await nextFrames(14);
    expect(faults("opened")).toEqual([]);
    await page.viewport(390, 600);
    await nextFrames(14);
    expect(faults("shrunk to 600")).toEqual([]);
  });
});
