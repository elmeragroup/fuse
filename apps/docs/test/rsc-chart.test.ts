/**
 * Unit under test: the chart entry rendered from a directive-free server page that draws S06.
 * Oracle: React's Flight serialiser and a client-only render. The Flight path's HTML must equal a
 * prerender of the same page with no Flight, both must hold the mark and tick counts written by
 * hand from the Elhub fixture, and a function prop passed to a client part must fail the server
 * render, as the negative control.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";
import { flightClientReferences, inlinedFlightPayload } from "./fixtures/rsc-flight-payload";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function serverRender(scenario: "page" | "function-format") {
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
    expect(payload).toContain(
      '["$","svg",null,{"data-slot":"sparkline","role":"img","aria-label":"Spotpris i dag"}'
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
      // 24 hours times 5 groups. The fixture's hours are all present, so every cell draws a box.
      expect(slotCount(html, "chart-bar")).toBe(120);
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
    expect(ssr.flight).toContain('<svg data-slot="sparkline" role="img" aria-label="Spotpris i dag"></svg>');
  });

  it("rejects a function prop passed from the server to a client part", () => {
    const rejected = serverRender("function-format");
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("Functions cannot be passed directly to Client Components");
    expect(rejected.stdout).toBe("");
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
    expect(segment).toMatch(/^<figure data-slot="chart"[^>]*aria-label="Visitors by month"/u);

    const names = new Set(flightClientReferences(inlinedFlightPayload(html)).map(({ name }) => name));
    // The positive control: a client demo on the same page crosses as its own reference.
    expect(names.has("BarChartBasic")).toBe(true);
    expect(names.has("BarChartServer")).toBe(false);
    // Only a server-rendered demo sends Root as a reference of its own, since every client demo
    // carries Root inside its own module.
    expect(names.has("ChartRoot")).toBe(true);
  });
});
