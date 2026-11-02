// Root's entrance under reduced motion, in Chromium, Firefox and WebKit, whose Playwright context
// sets prefers-reduced-motion: reduce. Oracle, worked by hand: four categories reading 1 to 4 on a
// [0, 4] domain over a 200 px plot draw bars 50, 100, 150 and 200 px tall at rest, in the commit
// that draws them, with no waiting state on Root, below the fold and after hydration alike.
import { useEffect } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { barHeights } from "../../../test/chart/marks";
import { fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const CONFIG = { v: { label: "V", color: "chart-1" } } as const satisfies ChartConfig;
const ROWS = [1, 2, 3, 4].map((v, index) => ({ name: `c${String(index)}`, v }));

/** Calls `onCommit` from a passive effect, once the commit that hydrates it has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

/** A Bar under a spacer that puts the plot below the 896 px page. */
function Fixture({ onHydrated }: { readonly onHydrated?: () => void }) {
  return (
    <ThemeScope theme={fkasPrivate}>
      <LocaleProvider locale="nb-NO">
        <div style={{ height: 2000 }} />
        <div style={{ width: 400 }}>
          <Chart.Root
            data={ROWS}
            config={CONFIG}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Inngang uten bevegelse">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
          <CommitMarker onCommit={onHydrated} />
        </div>
      </LocaleProvider>
    </ThemeScope>
  );
}

function waits(host: HTMLElement): boolean {
  // DOM audit: Root's figure carries the entrance state on its slot.
  return host.querySelector('[data-slot="chart"]')?.hasAttribute("data-entrance") ?? true;
}

describe("the entrance under reduced motion", () => {
  it("matches the reduce query in this engine", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("draws a chart below the fold at rest in the commit that mounts it", () => {
    const { host } = renderThemed(<Fixture />);
    expect(barHeights(host)).toEqual([50, 100, 150, 200]);
    expect(waits(host)).toBe(false);
  });

  it("draws a hydrated chart at rest once it hydrates, with no waiting state", async () => {
    // The server reads no reduced motion, so the hydrating Root starts as though motion were on
    // and finds the preference in the commit after.
    const host = document.createElement("div");
    host.innerHTML = renderToString(<Fixture />);
    document.body.append(host);
    const hydrated = Promise.withResolvers<void>();
    const root = hydrateRoot(host, <Fixture onHydrated={hydrated.resolve} />);
    try {
      await hydrated.promise;
      // The marks draw in the task of the hydration commit, before the browser paints it.
      expect(barHeights(host)).toEqual([50, 100, 150, 200]);
      expect(waits(host)).toBe(false);
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
