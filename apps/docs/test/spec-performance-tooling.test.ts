/**
 * Spec 11 / ticket 51: performance.md §2 tracks size-budgets.ts, and
 * docs#generate declares turbo outputs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FLAG_RAW_CEILING_BYTES } from "../../../packages/ui/scripts/flag-payload.ts";
import { repoRoot, uiRoot } from "../scripts/lib/paths.ts";
import { parseBudgets, parseMeasuredOn } from "../scripts/lib/sizes.ts";
import { specSection } from "./spec-section.ts";

const performanceSpec = readFileSync(join(repoRoot, "docs/spec/performance.md"), "utf8");
const sizeBudgetsPath = join(uiRoot, "scripts/size-budgets.ts");
const sizeBudgetsSource = readFileSync(sizeBudgetsPath, "utf8");

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
    expect(section).toContain("flags/*.svg");
    expect(section).toContain(String(FLAG_RAW_CEILING_BYTES));
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
