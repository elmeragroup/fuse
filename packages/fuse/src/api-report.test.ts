/**
 * Unit under test: the API report's leak filter in `scripts/api-report.ts`.
 * Oracle: CONTRACT.md section 3's part counts, 44 Chart parts plus the 11, 3 and 10 own parts of
 * PieChart, RadialChart and RadarChart, and report and message lines written by hand in
 * api-extractor's format.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { forgottenSymbol, leakedSymbols, namespaceParts } from "../scripts/api-report";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A forgotten-export message as api-extractor writes it. */
function message(symbol: string): string {
  return `The symbol "${symbol}" needs to be exported by the entry point chart.d.ts`;
}

describe("the chart API report's forgotten-export filter", () => {
  it("reads every namespace part from the committed report", () => {
    const parts = namespaceParts(readFileSync(join(packageRoot, "etc/chart.api.md"), "utf8"));
    expect(parts).toHaveLength(44 + 11 + 3 + 10);
    expect(parts).toContain("PieChartCenter");
    expect(parts).toContain("RadialChartBar");
    expect(parts).not.toContain("Chart");
    expect(parts).not.toContain("Sparkline");
  });

  it("reads the namespaces' own members and nothing else", () => {
    const report = [
      "```ts",
      "declare namespace Chart {",
      "    export {",
      "        ChartRoot as Root,",
      "        ChartBar as Bar",
      "    }",
      "}",
      "declare namespace Helpers {",
      "    export {",
      "        chartStore as store",
      "    }",
      "}",
      "export type ChartRootProps = {",
      "    readonly context: typeof internalContext;",
      "};",
      "```",
    ].join("\n");
    const parts = namespaceParts(report);
    expect(parts).toEqual(["ChartBar", "ChartRoot"]);
    // A private helper a props type or another namespace names fails by name.
    expect(leakedSymbols(["ChartRoot", "internalContext", "chartStore"], parts)).toEqual([
      "chartStore",
      "internalContext",
    ]);
  });

  it("names the symbol of a forgotten-export message and nothing else", () => {
    expect(forgottenSymbol(message("ChartBar"))).toBe("ChartBar");
    expect(forgottenSymbol('The doc comment for "ChartBar" is missing')).toBeUndefined();
  });

  it("names every flagged symbol that is not a part component", () => {
    const flagged = ["ChartBar", "ChartStoreState", "PieChartRoot", "useChartContext", "ChartStoreState"];
    expect(leakedSymbols(flagged, ["ChartBar", "PieChartRoot"])).toEqual([
      "ChartStoreState",
      "useChartContext",
    ]);
    expect(leakedSymbols(["ChartBar", "PieChartRoot"], ["ChartBar", "PieChartRoot"])).toEqual([]);
  });

  it("lets the radar cap's two counting helpers stay out of the entry, and nothing else", () => {
    expect(leakedSymbols(["ChartHasFiveKeys", "ChartWithoutOne", "ChartStoreState"], [])).toEqual([
      "ChartStoreState",
    ]);
  });
});
