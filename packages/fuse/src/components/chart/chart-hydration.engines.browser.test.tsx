// Motion rule 1 of .scratch/charts-v1/reviews/motion-decision.md, in Chromium, Firefox and WebKit:
// a hydrated chart matches the server output and starts no motion, for an ordinary hydration and for
// a Bar whose Suspense boundary hydrates late. The first data update after either hydration then
// follows rules 2 and 3, so surviving bars move and an added bar fades in. The oracle is the rule
// itself, read through `getAnimations()`, and E11's motion fixture, whose data A and B are written
// by hand.
import { Suspense, use } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { MOTION_A, MOTION_B, MOTION_CONFIG } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
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

/** Every animation the bars run, as the animated properties of each. */
function barAnimations(host: HTMLElement): string[] {
  return bars(host).flatMap((bar) =>
    bar
      .getAnimations()
      .map((animation) =>
        animation instanceof CSSTransition ? animation.transitionProperty : animation.constructor.name
      )
  );
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
  it("starts no motion when a server chart hydrates, and moves its bars on the first update", async () => {
    const { host, root, recover } = await hydrate(<Fixture data={MOTION_A} />, <Fixture data={MOTION_A} />);
    try {
      // Data A holds 10 days in 2 series.
      expect(bars(host)).toHaveLength(20);
      expect(barAnimations(host)).toEqual([]);
      expect(bars(host).some((bar) => bar.style.getPropertyValue("--chart-bar-step") !== "")).toBe(false);
      expect(recover).not.toHaveBeenCalled();
      root.render(<Fixture data={MOTION_B} />);
      await frames(2);
      // Update B keeps 2 to 10 October, adds 11 October and drops 1 October.
      const added = bars(host).filter((bar) => bar.getAttribute("data-intro") === "fade");
      expect(added).toHaveLength(2);
      expect(barAnimations(host).filter((property) => property === "top").length).toBeGreaterThan(0);
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("starts no motion when a Bar's Suspense boundary hydrates after the chart, and moves it on the first update", async () => {
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
      expect(barAnimations(host)).toEqual([]);
      expect(bars(host).some((bar) => bar.hasAttribute("data-intro"))).toBe(false);
      expect(recover).not.toHaveBeenCalled();
      root.render(<Fixture data={MOTION_B} ready={ready} />);
      await frames(2);
      expect(bars(host).filter((bar) => bar.getAttribute("data-intro") === "fade")).toHaveLength(2);
      expect(barAnimations(host).filter((property) => property === "top").length).toBeGreaterThan(0);
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
