// A cartesian chart's hydration, in Chromium and WebKit, whose Intl data each format the axis and
// the description. Units under test: Chart.Root and Chart.Bar from server HTML to the hydrated
// figure. Oracles: D18's first paint, where the server sends the plot's hidden loader and no mark,
// and the hydrated chart draws one bar per row and series; and React's own hydration contract, no
// recoverable error, also when a series' Suspense boundary hydrates after the rest.
import { Suspense, use, useEffect } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { bars } from "../../../test/chart/marks";
import { fkasPrivate } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** Oslo midnight on a day in October 2025, summer time. */
const oslo = (date: number) => new Date(Date.UTC(2025, 9, date, -2));

/** Ten days of two stacked series, p under q. */
const ROWS = [4, 6, 5, 7, 3, 6, 8, 5, 4, 6].map((p, index) => ({
  day: oslo(index + 1),
  p,
  q: 2 + (index % 3),
}));

const CONFIG = {
  p: { label: "Grunnlast", color: "chart-1", stack: "day" },
  q: { label: "Topp", color: "chart-2", stack: "day" },
} as const satisfies ChartConfig;

/** Calls `onCommit` from a passive effect, once the commit that hydrates the marker has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

/** The q series, which waits on `ready` in the browser and renders at once on the server. */
function LateBar({ ready }: { readonly ready: Promise<void> | null }): ReactNode {
  if (ready !== null) use(ready);
  return <Chart.Bar dataKey="q" />;
}

function Fixture({
  ready,
  onHydrated,
  onLateHydrated,
}: {
  readonly ready?: Promise<void> | null;
  readonly onHydrated?: () => void;
  readonly onLateHydrated?: () => void;
}) {
  return (
    <ThemeScope theme={fkasPrivate}>
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={ROWS}
            config={CONFIG}
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
                <CommitMarker onCommit={onLateHydrated} />
              </Suspense>
            )}
          </Chart.Root>
          <CommitMarker onCommit={onHydrated} />
        </div>
      </LocaleProvider>
    </ThemeScope>
  );
}

/** Hydrates the server HTML of `server` with `client`, once the chart's hydration commit has run. */
async function hydrate(server: ReactNode, client: (onHydrated: () => void) => ReactNode) {
  const host = document.createElement("div");
  host.innerHTML = renderToString(server);
  document.body.append(host);
  const recover = vi.fn();
  const hydrated = Promise.withResolvers<void>();
  const root = hydrateRoot(host, client(hydrated.resolve), { onRecoverableError: recover });
  await hydrated.promise;
  return { host, root, recover };
}

describe("hydration", () => {
  it("sends a hidden loader and no mark from the server, and draws every bar once hydrated", async () => {
    const html = renderToString(<Fixture />);
    expect(html).toMatch(
      /data-slot="chart-plot" aria-hidden="true"><div data-slot="loader" role="status"[^>]* aria-hidden="true">/u
    );
    expect(html).not.toContain('data-slot="chart-bar"');
    const { host, root, recover } = await hydrate(<Fixture />, (onHydrated) => (
      <Fixture onHydrated={onHydrated} />
    ));
    try {
      // 10 days in 2 series draw in the hydration commit's task.
      expect(bars(host)).toHaveLength(20);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("hydrates a series whose Suspense boundary resolves after the rest, with no recoverable error", async () => {
    const ready = Promise.withResolvers<void>();
    const late = Promise.withResolvers<void>();
    const { host, root, recover } = await hydrate(<Fixture ready={null} />, (onHydrated) => (
      <Fixture ready={ready.promise} onHydrated={onHydrated} onLateHydrated={late.resolve} />
    ));
    try {
      ready.resolve();
      await late.promise;
      await expect.poll(() => bars(host).length).toBe(20);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
