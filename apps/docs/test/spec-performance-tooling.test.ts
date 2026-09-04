/**
 * Spec 11 / ticket 51: performance.md §2 tracks size-budgets.ts, and
 * docs#generate declares turbo outputs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot, uiRoot } from "../scripts/lib/paths.ts";
import { parseBudgets, parseMeasuredOn } from "../scripts/lib/sizes.ts";

const performanceSpec = readFileSync(join(repoRoot, "docs/spec/performance.md"), "utf8");
const sizeBudgetsPath = join(uiRoot, "scripts/size-budgets.ts");
const sizeBudgetsSource = readFileSync(sizeBudgetsPath, "utf8");

function specSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(`## ${heading}`);
  if (start === -1) {
    throw new Error(`docs/spec/performance.md is missing ## ${heading}`);
  }
  const fromHeading = markdown.slice(start);
  const next = fromHeading.slice(3).search(/\n## /);
  return next === -1 ? fromHeading : fromHeading.slice(0, 3 + next);
}

function parseEmbeddedGzipRows(section: string): Map<string, { measuredGzip: number; ceilingGzip: number }> {
  const rows = new Map<string, { measuredGzip: number; ceilingGzip: number }>();
  for (const line of section.split("\n")) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line.trim());
    if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
      continue;
    }
    rows.set(match[1], { measuredGzip: Number(match[2]), ceilingGzip: Number(match[3]) });
  }
  return rows;
}

describe("performance.md §2 tracks size-budgets.ts", () => {
  const section = specSection(performanceSpec, "2 Bundle budgets");
  const measuredOn = parseMeasuredOn(sizeBudgetsSource, sizeBudgetsPath);
  const budgets = parseBudgets(sizeBudgetsSource, sizeBudgetsPath);

  it("points at size-budgets.ts as the source of truth and dates the snapshot", () => {
    expect(section).toMatch(/size-budgets\.ts/);
    expect(section).toContain(`calibrated snapshot as of ${measuredOn}`);
  });

  it("embeds every gzip budget with matching measuredGzip and ceilingGzip", () => {
    const embedded = parseEmbeddedGzipRows(section);
    expect(
      [...embedded.keys()].sort(),
      "performance.md §2 table names must equal size-budgets.ts gzip rows"
    ).toEqual(budgets.map((budget) => budget.name).sort());
    for (const budget of budgets) {
      expect(embedded.get(budget.name), budget.name).toEqual({
        measuredGzip: budget.measuredGzip,
        ceilingGzip: budget.ceilingGzip,
      });
    }
  });

  it("records the flag SVG raw ceiling from FLAG_RAW_CEILING_BYTES", () => {
    const flagPayload = readFileSync(join(uiRoot, "scripts/flag-payload.ts"), "utf8");
    const factors = /export const FLAG_RAW_CEILING_BYTES = (\d+)\s*\*\s*(\d+)/.exec(flagPayload);
    expect(factors?.[1], "flag-payload.ts FLAG_RAW_CEILING_BYTES factors").toBeDefined();
    expect(factors?.[2], "flag-payload.ts FLAG_RAW_CEILING_BYTES factors").toBeDefined();
    const ceilingBytes = Number(factors?.[1]) * Number(factors?.[2]);
    expect(section).toContain("flags/*.svg");
    expect(section).toContain(String(ceilingBytes));
  });
});

describe("docs#generate turbo outputs", () => {
  it("declares generate outputs so a cache hit restores the generated tree", () => {
    const turbo = readFileSync(join(repoRoot, "apps/docs/turbo.json"), "utf8");
    const generate = /"generate":\s*\{[\s\S]*?\n    \}/.exec(turbo)?.[0];
    expect(generate, "apps/docs/turbo.json is missing a generate task").toBeDefined();
    expect(generate).toMatch(/"outputs"\s*:/);
    expect(generate).toContain("src/generated/**");
    expect(generate).toMatch(/src\/app\/\\+\(docs\\+\)\/components\/\*\/api\.json/);
    expect(generate).toContain("public/components/**");
    expect(generate).toContain("public/llms.txt");
  });
});
