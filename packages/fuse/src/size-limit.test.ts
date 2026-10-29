import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BARE_COMPONENT_ENTRIES,
  DEFERRED_ENTRIES,
  NON_COMPONENT_JS_ENTRIES,
  RAC_ENTRIES,
} from "../scripts/entries";
import {
  budgetFailure,
  ceilingFromMeasured,
  CSS_BUDGETS,
  FLAG_RAW_BUDGETS,
  JS_ENTRY_BUDGETS,
  NAMED_IMPORT_BUDGETS,
  withDerivedCeiling,
} from "../scripts/size-budgets";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("size-limit harness", () => {
  it("is not the stub true script", () => {
    const parsed: unknown = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error("package.json is not an object");
    }
    // SAFETY: this test only reads the size-limit script string.
    const scripts = (parsed as { scripts: { "size-limit": string } }).scripts;
    expect(scripts["size-limit"]).not.toBe("true");
    expect(scripts["size-limit"]).toContain("size-limit.ts");
  });

  it("calibrates ceilings at measured × 1.5 and fails a miss", () => {
    expect(ceilingFromMeasured(1000)).toBe(1500);
    expect(budgetFailure("button", 10, 20)).toBeUndefined();
    expect(budgetFailure("button", 21, 20)).toBe("button 21 bytes exceeds ceiling 20");
  });

  it("budgets every published JS entry, with icons measured through one named import", () => {
    // Oracle: the entry allowlists that decide what is published. A new entry fails here until
    // it gets a reviewed budget row.
    const published = [
      ...NON_COMPONENT_JS_ENTRIES.filter((entry) => entry !== "icons"),
      ...BARE_COMPONENT_ENTRIES.filter((entry) => !DEFERRED_ENTRIES.some((deferred) => deferred === entry)),
      ...RAC_ENTRIES.map((entry) => `react-aria/${entry}`),
    ];
    expect(JS_ENTRY_BUDGETS.map((budget) => budget.name).toSorted()).toEqual(published.toSorted());
    expect(NAMED_IMPORT_BUDGETS.map((budget) => budget.name)).toEqual([
      "icons/Check",
      "Button from the root barrel",
    ]);
    expect(FLAG_RAW_BUDGETS).toEqual([{ name: "flags/*.svg", ceilingBytes: 819200 }]);
    expect(CSS_BUDGETS.map((budget) => budget.name)).toEqual(["themes.css", "styles.css"]);
  });

  it("derives an omitted ceiling at measured × 1.5 and keeps a standing override", () => {
    expect(withDerivedCeiling({ measuredGzip: 1000 })).toEqual({
      measuredGzip: 1000,
      ceilingGzip: 1500,
    });
    expect(withDerivedCeiling({ measuredGzip: 1000, ceilingGzip: 1200 })).toEqual({
      measuredGzip: 1000,
      ceilingGzip: 1200,
    });
  });
});
