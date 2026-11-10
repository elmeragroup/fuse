// Delayed hydration of scatter marks, after Chart's motion rule 1 and the scatter entrance's, in
// Chromium and WebKit: a series whose Suspense boundary hydrates while another series'
// entrance wipe runs matches the server HTML, which wrote no data-intro, with no recoverable error,
// and then takes data-intro="none", so it draws at rest and never wipes in late.
import { Suspense, use, useEffect } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { fkasPrivate } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

const ROWS = [
  { t: -2, kwh: 20_000, s: "now" },
  { t: 2, kwh: 90_000, s: "now" },
  { t: 18, kwh: 160_000, s: "normal" },
];

/** Calls `onCommit` from a passive effect, once the commit that hydrates the marker has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

/** The normal series, which waits on `ready` in the browser and renders at once on the server. */
function LatePoints({ ready }: { readonly ready: Promise<void> | null }): ReactNode {
  if (ready !== null) use(ready);
  return <ScatterChart.Points dataKey="normal" />;
}

function Fixture({
  ready,
  onHydrated,
  onLateHydrated,
}: {
  readonly ready: Promise<void> | null;
  readonly onHydrated?: () => void;
  readonly onLateHydrated?: () => void;
}) {
  return (
    <ThemeScope theme={fkasPrivate}>
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <ScatterChart.Root
            data={ROWS}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur">
            <ScatterChart.Points dataKey="now" />
            <Suspense fallback={null}>
              <LatePoints ready={ready} />
              <CommitMarker onCommit={onLateHydrated} />
            </Suspense>
          </ScatterChart.Root>
          <CommitMarker onCommit={onHydrated} />
        </div>
      </LocaleProvider>
    </ThemeScope>
  );
}

/** The CSS animations a layer runs, by name. */
function animationsOf(layer: Element | undefined): readonly string[] {
  return (layer?.getAnimations() ?? []).flatMap((animation) =>
    animation instanceof CSSAnimation ? [animation.animationName] : []
  );
}

describe("delayed hydration", () => {
  it("hydrates a series whose boundary resolves during the entrance as the server wrote it, then draws it at rest", async () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<Fixture ready={null} />);
    document.body.append(host);
    const recover = vi.fn();
    const ready = Promise.withResolvers<void>();
    const hydrated = Promise.withResolvers<void>();
    const late = Promise.withResolvers<void>();
    const root = hydrateRoot(
      host,
      <Fixture ready={ready.promise} onHydrated={hydrated.resolve} onLateHydrated={late.resolve} />,
      { onRecoverableError: recover }
    );
    try {
      await hydrated.promise;
      // DOM audit: the point layers are aria-hidden plot output, and only their slot names them.
      const layers = () => [...host.querySelectorAll('[data-slot="chart-points"]')];
      // The server wrote both layers without data-intro.
      expect(layers().map((layer) => layer.getAttribute("data-intro"))).toEqual([null, null]);
      // The now series' wipe plays before the normal series' boundary resolves.
      // DOM audit: Root's figure carries the entrance state.
      await expect
        .poll(() => host.querySelector('[data-slot="chart"]')?.getAttribute("data-entrance"))
        .toBe("played");
      expect(animationsOf(layers()[0])).toEqual(["chart-wipe-left"]);
      ready.resolve();
      await late.promise;
      await nextFrames(2);
      expect(recover).not.toHaveBeenCalled();
      expect(layers()[1]?.getAttribute("data-intro")).toBe("none");
      expect(animationsOf(layers()[1])).toEqual([]);
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
