// Motion rule 1 of .scratch/charts-v1/reviews/motion-decision.md under the SVG brief, in
// Chromium, Firefox and WebKit: the server sends the plot's skeleton and no marks, and a hydrated
// chart draws its marks at rest once the browser measures the plot, with no recoverable error, for
// an ordinary hydration and for a Bar whose Suspense boundary hydrates late. The first data update
// then follows rules 2 and 3: surviving bars start where they were, pass through a frame between
// their two places, settle on the new data, and an added bar fades in. The geometry comes
// from motion-frames.json, which E11's oracle script writes by hand from the fixture.
import { Suspense, use } from "react";
import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import { finishedFade, runningFade } from "../../../test/chart/fade";
import { MOTION_A, MOTION_B, MOTION_CONFIG } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
import motion from "../../../test/chart/motion-frames.json" with { type: "json" };
import { fkasPrivate } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** The q series, which waits on `ready` in the browser and renders at once on the server. */
function LateBar({ ready }: { readonly ready: Promise<void> | null }): ReactNode {
  if (ready !== null) use(ready);
  return <Chart.Bar dataKey="q" />;
}

function Fixture({
  data,
  ready,
}: {
  readonly data: readonly MotionRow[];
  readonly ready?: Promise<void> | null;
}) {
  return (
    <ThemeScope theme={fkasPrivate}>
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={data}
            config={MOTION_CONFIG}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            aria-label="Forbruk per dag">
            <Chart.Bar dataKey="p" />
            {ready === undefined ? (
              <Chart.Bar dataKey="q" />
            ) : (
              <Suspense fallback={null}>
                <LateBar ready={ready} />
              </Suspense>
            )}
          </Chart.Root>
        </div>
      </LocaleProvider>
    </ThemeScope>
  );
}

async function frames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function bars(host: HTMLElement): HTMLElement[] {
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-bar"]')];
}

type Oracle = (typeof motion.bars.A)[number];

/** Whether every oracle bar sits on its box, each edge within half a pixel. */
function on(host: HTMLElement, oracle: readonly Oracle[]): boolean {
  // DOM audit: the bar series layer covers the plot box.
  const plot = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
  return oracle.every((entry) => {
    const bar = host.querySelectorAll(
      `[data-slot="chart-bar-series"][data-series="${entry.series === "p" ? "0" : "1"}"] [data-slot="chart-bar"]`
    )[entry.position];
    if (bar === undefined) return false;
    const box = barBox(bar, plot);
    return (
      Math.abs(box.left - entry.left * plot.width) <= 0.5 &&
      Math.abs(box.right - entry.right * plot.width) <= 0.5 &&
      Math.abs(box.top - (entry.top * plot.height + entry.topPx)) <= 0.5 &&
      Math.abs(box.bottom - entry.bottom * plot.height) <= 0.5
    );
  });
}

/** Whether every bar of data A sits on its oracle box, as at rest. */
function atRestOnA(host: HTMLElement): boolean {
  return on(host, motion.bars.A);
}

/** Data A's boxes of the days update B keeps, at their places in B's window. */
const SURVIVING = motion.bars.A.flatMap((entry) => {
  const kept = motion.bars.B.find((other) => other.series === entry.series && other.day === entry.day);
  return kept === undefined ? [] : [{ ...entry, position: kept.position }];
});

/**
 * Apply update B and follow the surviving bars: the commit draws them where data A left them,
 * a later frame finds them between A and B, and they settle on B.
 */
async function followUpdate(host: HTMLElement, root: Root, next: ReactNode): Promise<void> {
  flushSync(() => {
    root.render(next);
  });
  expect(on(host, SURVIVING)).toBe(true);
  // Update B adds 11 October to both series, and each added bar fades in from opacity 0.
  const added = bars(host).filter((bar) => bar.getAttribute("data-intro") === "fade");
  expect(added).toHaveLength(2);
  const fades = added.map((bar) => [bar, runningFade(bar)] as const);
  let between = false;
  for (let frame = 0; frame < 120 && !on(host, motion.bars.B); frame += 1) {
    await frames(1);
    between ||= !on(host, SURVIVING) && !on(host, motion.bars.B);
  }
  expect(between).toBe(true);
  expect(on(host, motion.bars.B)).toBe(true);
  for (const [bar, fade] of fades) await finishedFade(bar, fade);
}

async function hydrate(server: ReactNode, client: ReactNode) {
  const host = document.createElement("div");
  host.innerHTML = renderToString(server);
  document.body.append(host);
  const recover = vi.fn();
  const root = hydrateRoot(host, client, { onRecoverableError: recover });
  await frames(3);
  return { host, root, recover };
}

describe("hydration", () => {
  it("draws the measured marks at rest after a server render with none, and moves them on the first update", async () => {
    const html = renderToString(<Fixture data={MOTION_A} />);
    // The server sends the skeleton in the plot and no mark.
    expect(html).toContain('data-slot="chart-skeleton-mark"');
    expect(html).not.toContain('data-slot="chart-bar"');
    const { host, root, recover } = await hydrate(<Fixture data={MOTION_A} />, <Fixture data={MOTION_A} />);
    try {
      // Data A holds 10 days in 2 series, drawn at rest with no entrance.
      expect(bars(host)).toHaveLength(20);
      expect(atRestOnA(host)).toBe(true);
      // DOM audit: the plot's skeleton is aria-hidden, and only its slot names it.
      expect(host.querySelector('[data-slot="chart-skeleton-mark"]')).toBeNull();
      expect(recover).not.toHaveBeenCalled();
      // Update B keeps 2 to 10 October, adds 11 October and drops 1 October. The surviving bars
      // start where data A left them, move, and settle on B.
      await followUpdate(host, root, <Fixture data={MOTION_B} />);
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("draws a Bar whose Suspense boundary hydrates after the chart at rest, and moves it on the first update", async () => {
    let resolve: () => void = () => undefined;
    const ready = new Promise<void>((done) => {
      resolve = done;
    });
    const { host, root, recover } = await hydrate(
      <Fixture data={MOTION_A} ready={null} />,
      <Fixture data={MOTION_A} ready={ready} />
    );
    try {
      resolve();
      await frames(4);
      const hydrated = bars(host).every((bar) =>
        Object.keys(bar).some((key) => key.startsWith("__reactFiber$"))
      );
      expect(hydrated).toBe(true);
      expect(atRestOnA(host)).toBe(true);
      expect(bars(host).some((bar) => bar.hasAttribute("data-intro"))).toBe(false);
      expect(recover).not.toHaveBeenCalled();
      await followUpdate(host, root, <Fixture data={MOTION_B} ready={ready} />);
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
