// Reveal's active place, in Chromium. Unit under test: Reveal's follower and the registered
// `--chart-active-x`. Oracles: chart.css's contract that the property does not inherit, so the place
// sits on each series Reveal masks and on no mark inside one, and the crosshair and the active dot,
// whose glides the edge must keep pace with. The place is the crosshair's column: the second of four
// 100 px bands centres at 150 px, the middle of the device pixel 150 to 151.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { springEasing } from "./layout/spring";

const CONFIG = { v: { label: "V", color: "chart-1" } } as const satisfies ChartConfig;
const ROWS = ["a", "b", "c", "d"].map((name, index) => ({ name, v: index + 1 }));

describe("Chart.Reveal", () => {
  it("writes the active place on the series it masks and on nothing inside them", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Reveal">
            <Chart.Reveal>
              <Chart.Line dataKey="v" />
              <Chart.Dots dataKey="v" />
            </Chart.Reveal>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the reveal wrapper, the series and their marks are aria-hidden plot output.
    const reveal = host.querySelector<HTMLElement>('[data-slot="chart-reveal"]');
    const line = host.querySelector<SVGElement>('[data-slot="chart-line-series"]');
    const dots = host.querySelector<SVGElement>('[data-slot="chart-dots"]');
    const path = host.querySelector('[data-slot="chart-line"][data-part="solid"]');
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}{ArrowRight}");
    const place = (node: Element | null) =>
      node === null ? "missing" : getComputedStyle(node).getPropertyValue("--chart-active-x").trim();
    // The step glides the edge; at rest it shows the place.
    for (const series of [line, dots]) for (const glide of series?.getAnimations() ?? []) glide.finish();
    expect(place(line)).toBe("150.5px");
    expect(place(dots)).toBe(place(line));
    // Elsewhere the property keeps its initial value, which draws a series whole.
    expect([place(reveal), place(path)]).toEqual(["100%", "100%"]);
    await userEvent.keyboard("{Escape}");
    host.querySelector<HTMLElement>('[role="option"]')?.blur();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active")).toBe(false);
    expect([place(line), place(dots)]).toEqual(["100%", "100%"]);
  });
});

/** Twenty-four readings on a 400 px plot, a point scale, so each slot is a little over 17 px apart. */
const SLOTS = Array.from({ length: 24 }, (_, index) => ({
  name: `s${String(index)}`,
  v: 20 + ((index * 7) % 11) * 6,
}));

function revealChart(orientation: "vertical" | "horizontal" = "vertical") {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400, paddingTop: 120 }}>
        <Chart.Root
          data={SLOTS}
          config={CONFIG}
          xKey="name"
          xScale="point"
          orientation={orientation}
          data-intro="none"
          aria-label="Reveal glide">
          <Chart.Crosshair />
          <Chart.Reveal>
            <Chart.Line dataKey="v" />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Reveal>
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** A pointer move over a slot's centre, `nudge` px past it, as the chart's own events. */
function moveTo(host: HTMLElement, slot: number, nudge = 0, axis: "x" | "y" = "x"): void {
  // DOM audit: the plot surface is the listbox that takes the chart's pointer events.
  const surface = host.querySelector<HTMLElement>('[role="listbox"]');
  if (surface === null) throw new Error("no plot");
  const box = surface.getBoundingClientRect();
  const along = (start: number, length: number) => start + (length * slot) / (SLOTS.length - 1) + nudge;
  surface.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: axis === "x" ? along(box.left, box.width) : box.left + box.width / 2,
      clientY: axis === "y" ? along(box.top, box.height) : box.top + box.height / 2,
      pointerType: "mouse",
    })
  );
}

/** Where the reveal's edge, the active dot and the crosshair line show along an axis, in client pixels. */
function shownAlong(host: HTMLElement, axis: "x" | "y" = "x") {
  // DOM audit: the masked series, the dot and the crosshair are aria-hidden plot output.
  const line = host.querySelector<SVGElement>('[data-slot="chart-line-series"]');
  const dot = host.querySelector('[data-slot="chart-active-dot"] [data-slot="chart-dot"]');
  const mark = host.querySelector('[data-slot="chart-crosshair-mark"]');
  if (line === null || dot === null || mark === null) throw new Error("no line, dot or crosshair");
  const edge = Number.parseFloat(getComputedStyle(line).getPropertyValue("--chart-active-x"));
  const [dotBox, markBox, lineBox] = [
    dot.getBoundingClientRect(),
    mark.getBoundingClientRect(),
    line.getBoundingClientRect(),
  ];
  const centre = (box: DOMRect) => (axis === "x" ? (box.left + box.right) / 2 : (box.top + box.bottom) / 2);
  return {
    edge: (axis === "x" ? lineBox.left : lineBox.top) + edge,
    dot: centre(dotBox),
    crosshair: centre(markBox),
    gliding: line.getAnimations().some(({ playState }) => playState === "running"),
  };
}

/** The timing of an element's running animation, or null. */
function timing(element: Element | null) {
  const [glide] = element?.getAnimations() ?? [];
  const effect = glide?.effect?.getTiming();
  return effect === undefined ? null : { duration: effect.duration, easing: effect.easing };
}

describe("Chart.Reveal's edge on a step", () => {
  it.each([
    { orientation: "vertical", axis: "x" },
    { orientation: "horizontal", axis: "y" },
  ] as const)(
    "glides with the active dot and the crosshair through a fast multi-slot step, $orientation",
    async ({ orientation, axis }) => {
      const { host } = renderThemed(revealChart(orientation));
      await nextFrames(2);
      moveTo(host, 2, 0, axis);
      await nextFrames(40);
      const frames: ReturnType<typeof shownAlong>[] = [];
      let watching = true;
      const watch = () => {
        if (!watching) return;
        frames.push(shownAlong(host, axis));
        requestAnimationFrame(watch);
      };
      // A nudge then a long move a frame later reads as a fast pointer.
      moveTo(host, 2, 2, axis);
      await nextFrames(1);
      moveTo(host, 18, 0, axis);
      requestAnimationFrame(watch);
      await nextFrames(60);
      watching = false;
      expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
      const apart = frames.filter(
        ({ edge, dot, crosshair }) => Math.abs(edge - dot) > 1 || Math.abs(edge - crosshair) > 1
      );
      expect(apart).toEqual([]);
    }
  );

  it("plays a slow step on the crosshair's spring, the 300/30 floor", async () => {
    const { host } = renderThemed(revealChart());
    await nextFrames(2);
    moveTo(host, 4);
    await nextFrames(60);
    moveTo(host, 12);
    await nextFrames(1);
    // DOM audit: the masked series and the crosshair layer are aria-hidden plot output.
    const line = host.querySelector('[data-slot="chart-line-series"]');
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const floor = springEasing({ stiffness: 300, damping: 30 });
    // The browser rewrites a linear() easing as it reads it back, so the easing is compared with
    // the crosshair's, read back the same way.
    expect(timing(line)?.duration).toBe(floor.duration);
    expect(timing(line)).toEqual(timing(crosshair));
  });
});
