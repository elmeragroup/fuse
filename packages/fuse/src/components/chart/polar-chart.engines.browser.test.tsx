import { useEffect } from "react";

// The polar Roots' spoken phrases and hydration, in Chromium, Firefox and WebKit. Units under test:
// PieChart.Root, RadialChart.Root and RadarChart.Root. Oracles, written by hand: CONTRACT section
// 9.4's option grammar in Norwegian Bokmål, with S11's drafted words and layer 03's spoken percent
// literal, in vsr's own phrase grammar, role, name, state, position and set size joined by ", ";
// section 9.10's status words; and D18's first paint, where the server sends every mark hidden
// and a hydrated chart in view shows them, with no recoverable error.
import { virtual } from "@guidepup/virtual-screen-reader";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

afterEach(async () => {
  await virtual.stop();
});

/** A bill of 100 kr, so each part's value is its own share. */
const BILL = [
  { name: "strom", v: 50 },
  { name: "nettleie", v: 30 },
  { name: "avgifter", v: 15 },
  { name: "mva", v: 5 },
];

const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
  mva: { label: "Mva", color: "chart-4" },
} as const;

const SPOKES = [
  { area: "NO1", v: 1, w: 3 },
  { area: "NO2", v: 2, w: 2 },
  { area: "NO3", v: 3, w: 1 },
];

const SPOKE_CONFIG = {
  v: { label: "Forbruk", color: "chart-1" },
  w: { label: "Pris", color: "chart-2" },
} as const;

/** Start vsr on the host with focus on the button before the chart. */
async function start(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await virtual.start({ container: host });
}

/** Press each key and return the last phrase after each. */
async function phrasesAfter(keys: readonly string[]): Promise<string[]> {
  const heard: string[] = [];
  for (const key of keys) {
    await virtual.press(key);
    heard.push((await virtual.spokenPhraseLog()).at(-1) ?? "");
  }
  return heard;
}

describe("the polar options' spoken phrases (section 9.4)", () => {
  it("speaks a pie's slices with their shares, the folded Other slice with its count, and wraps", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <PieChart.Root
          data={BILL}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          maxSlices={3}
          aria-label="Regning">
          <PieChart.LegendToggleGroup />
        </PieChart.Root>
      </LocaleProvider>
    );
    await start(host);
    const heard = await phrasesAfter(["Tab", "ArrowDown", "ArrowDown", "ArrowDown", "Enter"]);
    expect(heard.slice(1, 4)).toEqual([
      "option, Nettleie: 30, 30\u00a0prosent, not selected, position 2, set size 3",
      "option, Annet, 2\u00a0kategorier: 20, 20\u00a0prosent, not selected, position 3, set size 3",
      "option, Strøm: 50, 50\u00a0prosent, not selected, position 1, set size 3",
    ]);
    expect(heard[4]).toBe("polite: Strøm valgt");
  });

  it("speaks a radial ring's value against its maximum and stops at the last ring", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <RadialChart.Root
          data={BILL}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          max={50}
          aria-label="Ringer"
        />
      </LocaleProvider>
    );
    await start(host);
    const heard = await phrasesAfter(["Tab", "End", "ArrowDown"]);
    expect(heard.slice(1)).toEqual([
      "option, Mva: 5 av 50, not selected, position 4, set size 4",
      "option, Mva: 5 av 50, not selected, position 4, set size 4",
    ]);
  });

  it("speaks a radar's spoke with every series, then the focused series first", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="area" aria-label="Områder" />
      </LocaleProvider>
    );
    await start(host);
    const heard = await phrasesAfter(["Tab", "ArrowRight", "ArrowDown"]);
    expect(heard.slice(1)).toEqual([
      "option, NO2: Forbruk 2, Pris 2, not selected, position 2, set size 3",
      "option, Forbruk 2, NO2, not selected, position 2, set size 3",
    ]);
  });
});

/** Calls `onCommit` from a passive effect, once the commit that hydrates the marker has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

function Fixture({ onHydrated }: { readonly onHydrated?: () => void }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 300 }}>
        <PieChart.Root data={BILL} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Labels />
          <PieChart.Center>
            <PieChart.CenterValue />
          </PieChart.Center>
          <PieChart.Legend />
          <PieChart.Table />
        </PieChart.Root>
        <CommitMarker onCommit={onHydrated} />
      </div>
    </LocaleProvider>
  );
}

describe("hydration (D18)", () => {
  it("sends the figure, its slices, its description and its table from the server, and draws once hydrated in view", async () => {
    const html = renderToString(<Fixture />);
    expect(html).toContain("Kakediagram med 4\u00a0deler, totalt 100.");
    // The server writes every slice at rest: Strøm's half from 12 o'clock to 6 through 3, as d3's
    // arc writes a half turn with no hole, rounded to 3 decimals.
    expect(html.split('data-slot="pie-chart-sector"').length - 1).toBe(4);
    expect(html).toContain('d="M0,-1A1,1,0,1,1,0,1L0,0Z"');
    expect(html.split('data-slot="pie-chart-label"').length - 1).toBe(4);
    expect(html).toContain('data-slot="chart-polar-plot"');
    expect(html).not.toContain("data-drawn");
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    const recover = vi.fn();
    const hydrated = Promise.withResolvers<void>();
    const root = hydrateRoot(host, <Fixture onHydrated={hydrated.resolve} />, {
      onRecoverableError: recover,
    });
    try {
      await hydrated.promise;
      // DOM audit: Root states its first paint on data-drawn, which the stylesheet reads.
      const figure = host.querySelector("[data-polar]");
      await expect.poll(() => figure?.hasAttribute("data-drawn")).toBe(true);
      expect(recover).not.toHaveBeenCalled();
      expect(host.querySelectorAll("tbody tr")).toHaveLength(4);
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("sends a radial chart's rings, tracks and centre from the server, and hydrates them as they are", async () => {
    function Rings({ onHydrated }: { readonly onHydrated?: () => void }) {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 300 }}>
            <RadialChart.Root
              data={BILL}
              config={BILL_CONFIG}
              nameKey="name"
              valueKey="v"
              max={50}
              aria-label="Ringer">
              <RadialChart.Track />
              <RadialChart.Bar />
              <RadialChart.Center>
                <RadialChart.CenterValue />
              </RadialChart.Center>
            </RadialChart.Root>
            <CommitMarker onCommit={onHydrated} />
          </div>
        </LocaleProvider>
      );
    }
    const html = renderToString(<Rings />);
    expect(html.split('data-slot="radial-chart-ring"').length - 1).toBe(4);
    expect(html.split('data-slot="pie-chart-track"').length - 1).toBe(4);
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    const recover = vi.fn();
    const hydrated = Promise.withResolvers<void>();
    const root = hydrateRoot(host, <Rings onHydrated={hydrated.resolve} />, { onRecoverableError: recover });
    try {
      await hydrated.promise;
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
