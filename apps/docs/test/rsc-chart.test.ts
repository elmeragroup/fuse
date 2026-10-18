/**
 * Unit under test: the chart entry rendered from a directive-free server page.
 * Oracle: React's Flight serialiser and a client-only render. The Flight path's HTML must equal a
 * prerender of the same page with no Flight, and a function prop passed to a client part must fail
 * the server render, as the negative control.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { flightClientReferences } from "./fixtures/rsc-flight-payload";

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

describe("the chart entry under React Server Components", () => {
  const server = serverRender("page");
  const payload = server.stdout;

  it("renders the page on the server with no error", () => {
    expect(server.stderr).not.toMatch(/Error/u);
    expect(server.status).toBe(0);
  });

  it("sends Chart.Root and its parts as client references and runs Sparkline on the server", () => {
    const references = flightClientReferences(payload).map(
      ({ module, name }) => `${module.replace(/^.*\/packages\/fuse\/src\//u, "")}#${name}`
    );
    expect(references).toEqual([
      "components/chart/chart-root.tsx#ChartRoot",
      "components/chart/chart-headline.tsx#ChartHeadline",
      "components/chart/chart-bar.tsx#ChartBar",
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
    expect(ssr.flight).toContain('<figure data-slot="chart" aria-label="Forbruk per måned"></figure>');
    expect(ssr.flight).toContain('<svg data-slot="sparkline" role="img" aria-label="Spotpris i dag"></svg>');
  });

  it("rejects a function prop passed from the server to a client part", () => {
    const rejected = serverRender("function-format");
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("Functions cannot be passed directly to Client Components");
    expect(rejected.stdout).toBe("");
  });
});
