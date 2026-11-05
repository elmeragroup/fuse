/**
 * Unit under test: the chart entry rendered from a directive-free server page that draws S06.
 * Oracle: React's Flight serialiser and a client-only render. The Flight path's HTML must equal a
 * prerender of the same page with no Flight, both must hold the layer and tick counts written by
 * hand from the Elhub fixture and no mark, since marks draw once the browser measures the plot, and
 * a function prop passed to a client part must fail the server render, as the negative control.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";
import { flightClientReferences, inlinedFlightPayload } from "./fixtures/rsc-flight-payload";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function serverRender(scenario: "page" | "composed" | "polar" | "function-format") {
  return spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      join(fixtures, "rsc-namespace-register.mjs"),
      join(fixtures, "rsc-chart-server.ts"),
      scenario,
    ],
    { cwd: fixtures, encoding: "utf8" }
  );
}

type SsrResult = { clientModules: string[]; flight: string; clientOnly: string };

/** How many elements of the HTML carry the data-slot. */
function slotCount(html: string, slot: string): number {
  return html.split(`data-slot="${slot}"`).length - 1;
}

describe("the chart entry under React Server Components", () => {
  const server = serverRender("page");
  const payload = server.stdout;

  it("renders the page on the server with no error", () => {
    expect(server.stderr).not.toMatch(/Error/u);
    expect(server.status).toBe(0);
  });

  it("sends LocaleProvider, Chart.Root and its parts as client references and runs Sparkline on the server", () => {
    const references = flightClientReferences(payload).map(
      ({ module, name }) => `${module.replace(/^.*\/packages\/fuse\/src\//u, "")}#${name}`
    );
    expect(references).toEqual([
      "intl/locale-context.tsx#LocaleProvider",
      "components/chart/chart-root.tsx#ChartRoot",
      "components/chart/chart-headline.tsx#ChartHeadline",
      "components/chart/chart-axis.tsx#ChartYAxis",
      "components/chart/chart-axis.tsx#ChartXAxis",
      "components/chart/chart-bar.tsx#ChartBar",
      "components/chart/chart-legend.tsx#ChartLegend",
      "components/chart/chart-legend.tsx#ChartLegendItem",
      "components/chart/chart-series.tsx#ChartSeriesIcon",
      "components/chart/chart-series.tsx#ChartSeriesLabel",
    ]);
    // The name joins the consumer's label and the range sentence, which the server writes.
    expect(payload).toContain(
      '["$","svg",null,{"data-slot":"sparkline","data-variant":"line","role":"img","aria-label":"Spotpris i dag. Lavest 0,8, høyest 1,2."'
    );
  });

  it("formats the headline on the server with Fuse's canonical spaces", () => {
    expect(payload).toContain("1,78\u00a0kr/kWh\u00a0inkl.\u00a0mva");
  });

  it("produces the same HTML through Flight as a client-only render", () => {
    // SAFETY: rsc-chart-ssr.ts writes this one JSON object, and every field the test reads is
    // compared against an expected value, so a shape that disagrees fails an assertion.
    const ssr = JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", join(fixtures, "rsc-chart-register-ssr.mjs"), join(fixtures, "rsc-chart-ssr.ts")],
        { cwd: fixtures, encoding: "utf8", input: payload }
      )
    ) as SsrResult;
    expect(ssr.clientModules.length).toBeGreaterThan(0);
    expect(ssr.flight).toBe(ssr.clientOnly);
    for (const html of [ssr.flight, ssr.clientOnly]) {
      // The server sends one SVG layer per group, five, and its plot's loader, but no bar: the
      // browser draws the 24 hours times 5 groups once it measures the plot.
      expect(slotCount(html, "chart-bar-series")).toBe(5);
      expect(slotCount(html, "loader")).toBe(1);
      expect(slotCount(html, "chart-skeleton-mark")).toBe(0);
      expect(slotCount(html, "chart-bar")).toBe(0);
      // Every hour writes a tick, and the widths in its `data-min` hide the ones a narrow plot lacks room for.
      expect(slotCount(html, "chart-x-tick")).toBe(24);
      // The highest hour's stack is 3897.232 MWh, which the 1-2-5 rule nices to 0 to 4000 by 1000.
      expect(slotCount(html, "chart-y-tick")).toBe(5);
    }
    // T022: the household icon, a server-rendered element in the config, crosses Flight whole.
    expect(slotCount(ssr.flight, "chart-series-icon")).toBe(5);
    expect(ssr.flight).toMatch(
      /data-slot="chart-series-icon" aria-hidden="true"><svg [^>]*viewBox="0 0 256 256"/u
    );
    // The Sparkline's two readings sit between a gap, so each draws as a dot in its 10-unit cell.
    expect(ssr.flight).toContain(
      '<svg data-slot="sparkline" data-variant="line" role="img" aria-label="Spotpris i dag. Lavest 0,8, høyest 1,2." viewBox="0 0 30 100"'
    );
    expect(ssr.flight).toContain('<path data-slot="sparkline-path" d="M5,0ZM25,100Z"></path>');
  });

  it("rejects a function prop passed from the server to a client part", () => {
    const rejected = serverRender("function-format");
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("Functions cannot be passed directly to Client Components");
    expect(rejected.stdout).toBe("");
  });
});

describe("composed Panels under React Server Components", () => {
  const server = serverRender("composed");

  it("renders S12's month in two Panels through Flight as a client-only render does, with no mark", () => {
    expect(server.stderr).not.toMatch(/Error/u);
    expect(server.status).toBe(0);
    // SAFETY: rsc-chart-ssr.ts writes this one JSON object, and every field the test reads is
    // compared against an expected value, so a shape that disagrees fails an assertion.
    const ssr = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--import",
          join(fixtures, "rsc-chart-register-ssr.mjs"),
          join(fixtures, "rsc-chart-ssr.ts"),
          "composed",
        ],
        { cwd: fixtures, encoding: "utf8", input: server.stdout }
      )
    ) as SsrResult;
    expect(ssr.flight).toBe(ssr.clientOnly);
    for (const html of [ssr.flight, ssr.clientOnly]) {
      expect(slotCount(html, "chart-panel")).toBe(2);
      // Root's plot and each Panel's hold a loader until the browser measures them.
      expect(slotCount(html, "loader")).toBe(3);
      expect(slotCount(html, "chart-skeleton-mark")).toBe(0);
      expect(slotCount(html, "chart-bar-series")).toBe(1);
      expect(slotCount(html, "chart-line-series")).toBe(1);
      expect(slotCount(html, "chart-bar")).toBe(0);
      expect(slotCount(html, "chart-line")).toBe(0);
      // The last Panel's x axis names September's 30 days.
      expect(slotCount(html, "chart-x-tick")).toBe(30);
      // Usage peaks at 30.7 kWh, which the 1-2-5 rule nices to 0 to 35 by 5, eight ticks, and every
      // price lies from 60 to 95 øre, niced to 0 to 100 by 20, six more.
      expect(slotCount(html, "chart-y-tick")).toBe(8 + 6);
      // The table lists both series in one row per day.
      expect(slotCount(html, "chart-table-content")).toBe(1);
      expect(html.split("<tr").length - 1).toBe(31);
    }
  });
});

describe("the polar Roots under React Server Components", () => {
  const server = serverRender("polar");

  it("sends each polar Root and its parts as client references", () => {
    expect(server.stderr).not.toMatch(/Error/u);
    expect(server.status).toBe(0);
    const references = flightClientReferences(server.stdout).map(
      ({ module, name }) => `${module.replace(/^.*\/packages\/fuse\/src\//u, "")}#${name}`
    );
    // Each family's Table is its own part, and no polar page reaches the cartesian modules.
    expect(references).toEqual([
      "intl/locale-context.tsx#LocaleProvider",
      "components/chart/pie-chart-root.tsx#PieChartRoot",
      "components/chart/chart-legend.tsx#ChartLegend",
      "components/chart/polar-chart-table.tsx#PieChartTable",
      "components/chart/radial-chart-root.tsx#RadialChartRoot",
      "components/chart/polar-chart-table.tsx#RadialChartTable",
      "components/chart/radar-chart-root.tsx#RadarChartRoot",
    ]);
  });

  it("writes each figure's frame, description and table on the server as a client-only render does", () => {
    // SAFETY: rsc-chart-ssr.ts writes this one JSON object, and every field the test reads is
    // compared against an expected value, so a shape that disagrees fails an assertion.
    const ssr = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--import",
          join(fixtures, "rsc-chart-register-ssr.mjs"),
          join(fixtures, "rsc-chart-ssr.ts"),
          "polar",
        ],
        { cwd: fixtures, encoding: "utf8", input: server.stdout }
      )
    ) as SsrResult;
    expect(ssr.flight).toBe(ssr.clientOnly);
    for (const html of [ssr.flight, ssr.clientOnly]) {
      // Each Root sends its aspect-locked cell and plot, which hold its marks from L4 on.
      expect(slotCount(html, "chart-polar-cell")).toBe(3);
      expect(slotCount(html, "chart-polar-plot")).toBe(3);
      expect(slotCount(html, "loader")).toBe(0);
      // The bill's three parts and the radar's two areas.
      expect(slotCount(html, "chart-legend-item")).toBe(5);
      // The pie's and the rings' tables: a head row and three rows each.
      expect(slotCount(html, "chart-table-content")).toBe(2);
      expect(html.split("<tr").length - 1).toBe(8);
      // The bill is 1 200 kr: 612 is 51 %, 348 is 29 % and 240 is 20 %.
      expect(html).toContain(
        "Kakediagram med 3\u00a0deler, totalt 1\u00a0200. Strøm: 612, 51\u00a0prosent. Nettleie: 348, 29\u00a0prosent. Avgifter: 240, 20\u00a0prosent."
      );
      expect(html).toContain(
        "Ringdiagram med 3\u00a0ringer. NO1: 92 av 150. NO2: 88 av 150. NO4: 31 av 150."
      );
      expect(html).toContain(
        "Radardiagram med 2\u00a0serier over 4\u00a0kategorier. NO1: lavest 40 Sommer, høyest 120 Vinter. NO4: lavest 20 Sommer, høyest 45 Vinter."
      );
    }
  });
});

describe("the bar-chart page's server demo in the production build", () => {
  // Unit under test: `bar-chart-server.tsx`, which has no directive, as Next prerenders the page.
  // Oracle: React's Flight rule. A client module crosses Flight as one client reference named by
  // its export, and a server component crosses as the elements it rendered, so its own name never
  // appears and the client parts it composed appear in its place.
  it("writes the chart's figure into the demo stage and sends the chart parts in place of the demo", async () => {
    const html = await fetchText("/components/bar-chart");
    const frame = /aria-labelledby="server-component"[^>]*>([\s\S]*?)data-demo-source/u.exec(html)?.[1] ?? "";
    // The stage's Suspense boundary streams. The stage holds the placeholder `B:<n>`, and React's
    // segment `S:<n>`, later in the same HTML, holds what the server rendered into it.
    const boundary = /data-demo-stage[^>]*>(?:<!--\$\?-->)?<template id="B:(\d+)">/u.exec(frame)?.[1];
    expect(boundary).toBeDefined();
    const segment = html.split(`<div hidden id="S:${boundary ?? ""}">`)[1] ?? "";
    expect(segment).toMatch(
      /^<figure data-slot="chart"[^>]*aria-label="Day and night consumption per month"/u
    );

    const names = new Set(flightClientReferences(inlinedFlightPayload(html)).map(({ name }) => name));
    // The positive control: a client demo on the same page crosses as its own reference.
    expect(names.has("BarChartBasic")).toBe(true);
    expect(names.has("BarChartServer")).toBe(false);
    // Only a server-rendered demo sends Root as a reference of its own, since every client demo
    // carries Root inside its own module.
    expect(names.has("ChartRoot")).toBe(true);
  });
});
