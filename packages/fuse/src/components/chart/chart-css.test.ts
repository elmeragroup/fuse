import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Unit under test: chart.css. Oracle: Chartability heuristic 43 (CONTRACT.md section 9.11), which
// asks that a user style sheet and forced colours reach every mark, so no chart declaration may
// win with !important. Why a test: oxlint parses no CSS, so no lint rule can read this file.
describe("chart.css", () => {
  it("declares nothing !important", () => {
    const css = readFileSync(new URL("chart.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
    expect(css).not.toContain("!important");
  });
});
