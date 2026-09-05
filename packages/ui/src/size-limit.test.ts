import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FLAG_RAW_CEILING_BYTES } from "../scripts/flag-payload";
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

  it("covers the current packed JS entries plus the per-icon export and flags", () => {
    const names = [
      ...JS_ENTRY_BUDGETS.map((budget) => budget.name),
      ...NAMED_IMPORT_BUDGETS.map((budget) => budget.name),
    ];
    expect(names).toEqual([
      ".",
      "theme",
      "badge",
      "button",
      "card",
      "dialog",
      "popover",
      "scroll-area",
      "illustrations",
      "separator",
      "field",
      "item",
      "input",
      "input-group",
      "textarea",
      "flags",
      "toast",
      "popover-info-button",
      "description-list",
      "emoji",
      "avatar",
      "alert-dialog",
      "dropdown-menu",
      "show",
      "loader",
      "empty",
      "frame",
      "code",
      "span",
      "timeline-list",
      "sheet",
      "tooltip",
      "heading",
      "text",
      "skeleton",
      "table",
      "alert",
      "icons/Check",
    ]);
    expect(FLAG_RAW_BUDGETS).toEqual([{ name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES }]);
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
    // Ticket-46 standing ceilings may sit slightly above a fresh ×1.5 (badge, date-picker).
    expect(withDerivedCeiling({ measuredGzip: 15658, ceilingGzip: 23493 }).ceilingGzip).toBe(23493);
  });
});
