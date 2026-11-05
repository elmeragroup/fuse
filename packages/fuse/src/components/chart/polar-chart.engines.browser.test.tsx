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
import { clockLayer, clockPath, dotPoints } from "../../../test/chart/clock";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
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

  it("sends a 25-hour clock's wedges, dots, curve, labels and Now from the server, and hydrates them as they are", async () => {
    // The 25-hour 26 October 2025 in Oslo, whose slot angles, labels and hands all run through
    // trigonometry and zone rules the server and each engine must round alike.
    const start = Date.parse("2025-10-25T22:00:00Z");
    const rows = Array.from({ length: 25 }, (_, hour) => ({
      start: start + hour * 3_600_000,
      kwh: 1 + (hour % 5),
    }));
    function Clock({ onHydrated }: { readonly onHydrated?: () => void }) {
      return (
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ width: 300 }}>
            <ClockChart.Root
              data={rows}
              config={{ kwh: { label: "kWh", color: "chart-1" } }}
              xKey="start"
              cycle="day"
              interval="hour"
              now={start + 9.5 * 3_600_000}
              aria-label="Døgn">
              <ClockChart.Grid />
              <ClockChart.AngleAxis />
              <ClockChart.Column dataKey="kwh" />
              <ClockChart.Line dataKey="kwh" />
              <ClockChart.Dots dataKey="kwh" />
              <ClockChart.Now />
              <ClockChart.Center />
            </ClockChart.Root>
            <CommitMarker onCommit={onHydrated} />
          </div>
        </LocaleProvider>
      );
    }
    const html = renderToString(<Clock />);
    expect(html.split('data-slot="clock-chart-angle-label"').length - 1).toBe(24);
    expect(html).toContain('data-slot="clock-chart-now"');
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    // With no script run yet, the server's markup holds one wedge and one dot per hour, and the curve.
    // DOM audit: the wedges are aria-hidden plot output, read by their layer's slot.
    const subpaths = (slot: string): number =>
      [...host.querySelectorAll(`[data-slot="${slot}"] path`)].reduce(
        (count, path) => count + ((path.getAttribute("d") ?? "").match(/M/gu) ?? []).length,
        0
      );
    expect(subpaths("clock-chart-column")).toBe(25);
    expect(dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"))).toHaveLength(25);
    expect(clockPath(clockLayer(host, "clock-chart-line"), "solid")).not.toBe("");
    const recover = vi.fn();
    const hydrated = Promise.withResolvers<void>();
    const root = hydrateRoot(host, <Clock onHydrated={hydrated.resolve} />, { onRecoverableError: recover });
    try {
      await hydrated.promise;
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("sends a radar's grid, labels and series from the server, and hydrates them as they are", async () => {
    // Five spokes at 72° steps and a negative reading, so every ring, spoke, vertex and label
    // position goes through trigonometry the server and each engine must round alike.
    const spokes = ["NO1", "NO2", "NO3", "NO4", "NO5"].map((area, index) => ({
      area,
      index: [12, -8, 4, 20, -3][index] ?? 0,
    }));
    function Radar({ onHydrated }: { readonly onHydrated?: () => void }) {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 300 }}>
            <RadarChart.Root
              data={spokes}
              config={{ index: { label: "Indeks", color: "chart-1" } }}
              nameKey="area"
              aria-label="Indeks">
              <RadarChart.Grid />
              <RadarChart.AngleAxis />
              <RadarChart.RadiusAxis />
              <RadarChart.Area dataKey="index" />
              <RadarChart.Line dataKey="index" />
              <RadarChart.Dots dataKey="index" />
            </RadarChart.Root>
            <CommitMarker onCommit={onHydrated} />
          </div>
        </LocaleProvider>
      );
    }
    const html = renderToString(<Radar />);
    expect(html.split('data-slot="radar-chart-angle-label"').length - 1).toBe(5);
    expect(html).toContain('data-slot="radar-chart-grid-ring" data-zero=""');
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    const recover = vi.fn();
    const hydrated = Promise.withResolvers<void>();
    const root = hydrateRoot(host, <Radar onHydrated={hydrated.resolve} />, { onRecoverableError: recover });
    try {
      await hydrated.promise;
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });
});
