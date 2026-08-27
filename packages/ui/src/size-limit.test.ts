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
      "checkbox-card",
      "radio-group",
      "checkbox",
      "selection-item",
      "switch",
      "button-group",
      "accordion",
      "description-list",
      "emoji",
      "avatar",
      "alert-dialog",
      "dropdown-menu",
      "collapsible",
      "select",
      "show",
      "loader",
      "empty",
      "frame",
      "code",
      "span",
      "timeline-list",
      "sheet",
      "text-field",
      "tooltip",
      "heading",
      "text",
      "toggle",
      "skeleton",
      "number-field",
      "meter",
      "tabs",
      "confirm-button",
      "table",
      "textarea-field",
      "pagination",
      "breadcrumb",
      "alert",
      "react-aria/ui-providers",
      "react-aria/date-field",
      "react-aria/calendar",
      "react-aria/range-calendar",
      "react-aria/date-picker",
      "react-aria/date-range-picker",
      "react-aria/link",
      "react-aria/search-field",
      "react-aria/grid-list",
      "react-aria/focusable",
      "icons/Check",
    ]);
    expect(FLAG_RAW_BUDGETS).toEqual([{ name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES }]);
    expect(CSS_BUDGETS.map((budget) => budget.name)).toEqual(["themes.css", "styles.css"]);
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "flags")?.ceilingGzip).toBe(
      ceilingFromMeasured(1388)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "accordion")?.ceilingGzip).toBe(
      ceilingFromMeasured(30184)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "emoji")?.ceilingGzip).toBe(
      ceilingFromMeasured(2442)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "avatar")?.ceilingGzip).toBe(
      ceilingFromMeasured(12467)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "alert-dialog")?.ceilingGzip).toBe(
      ceilingFromMeasured(47578)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "show")?.ceilingGzip).toBe(
      ceilingFromMeasured(148)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "span")?.ceilingGzip).toBe(
      ceilingFromMeasured(17324)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "heading")?.ceilingGzip).toBe(
      ceilingFromMeasured(17289)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "text")?.ceilingGzip).toBe(
      ceilingFromMeasured(17279)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "popover")?.ceilingGzip).toBe(
      ceilingFromMeasured(56865)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "toggle")?.ceilingGzip).toBe(
      ceilingFromMeasured(25482)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "loader")?.ceilingGzip).toBe(
      ceilingFromMeasured(16748)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "skeleton")?.ceilingGzip).toBe(
      ceilingFromMeasured(8701)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "timeline-list")?.ceilingGzip).toBe(
      ceilingFromMeasured(23555)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "sheet")?.ceilingGzip).toBe(
      ceilingFromMeasured(57208)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "text-field")?.ceilingGzip).toBe(
      ceilingFromMeasured(33462)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "tooltip")?.ceilingGzip).toBe(
      ceilingFromMeasured(51148)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "empty")?.ceilingGzip).toBe(
      ceilingFromMeasured(21356)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "frame")?.ceilingGzip).toBe(
      ceilingFromMeasured(9059)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "code")?.ceilingGzip).toBe(
      ceilingFromMeasured(11756)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "description-list")?.ceilingGzip).toBe(
      ceilingFromMeasured(10713)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "dropdown-menu")?.ceilingGzip).toBe(
      ceilingFromMeasured(68195)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "switch")?.ceilingGzip).toBe(
      ceilingFromMeasured(26550)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "button-group")?.ceilingGzip).toBe(
      ceilingFromMeasured(17587)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "collapsible")?.ceilingGzip).toBe(
      ceilingFromMeasured(27254)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "select")?.ceilingGzip).toBe(
      ceilingFromMeasured(63724)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "number-field")?.ceilingGzip).toBe(
      ceilingFromMeasured(40655)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "meter")?.ceilingGzip).toBe(
      ceilingFromMeasured(27365)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "tabs")?.ceilingGzip).toBe(
      ceilingFromMeasured(25776)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "confirm-button")?.ceilingGzip).toBe(
      ceilingFromMeasured(25625)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "table")?.ceilingGzip).toBe(
      ceilingFromMeasured(11814)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "textarea-field")?.ceilingGzip).toBe(
      ceilingFromMeasured(30976)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "pagination")?.ceilingGzip).toBe(
      ceilingFromMeasured(19190)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "breadcrumb")?.ceilingGzip).toBe(
      ceilingFromMeasured(25246)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "alert")?.ceilingGzip).toBe(
      ceilingFromMeasured(30590)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "selection-item")?.ceilingGzip).toBe(
      ceilingFromMeasured(31969)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "checkbox")?.ceilingGzip).toBe(
      ceilingFromMeasured(37013)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "radio-group")?.ceilingGzip).toBe(
      ceilingFromMeasured(40198)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "checkbox-card")?.ceilingGzip).toBe(
      ceilingFromMeasured(30194)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/ui-providers")?.ceilingGzip).toBe(
      ceilingFromMeasured(1987)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/date-field")?.ceilingGzip).toBe(
      ceilingFromMeasured(70066)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/calendar")?.ceilingGzip).toBe(
      ceilingFromMeasured(61023)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/range-calendar")?.ceilingGzip).toBe(
      ceilingFromMeasured(62330)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/date-picker")?.ceilingGzip).toBe(
      ceilingFromMeasured(105312)
    );
    expect(
      JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/date-range-picker")?.ceilingGzip
    ).toBe(ceilingFromMeasured(104800));
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/link")?.ceilingGzip).toBe(
      ceilingFromMeasured(31234)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/search-field")?.ceilingGzip).toBe(
      ceilingFromMeasured(41598)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/grid-list")?.ceilingGzip).toBe(
      ceilingFromMeasured(67309)
    );
    expect(JS_ENTRY_BUDGETS.find((budget) => budget.name === "react-aria/focusable")?.ceilingGzip).toBe(
      ceilingFromMeasured(3642)
    );
    // styles.css recalibrated 2026-08-25: Table in-frame utilities exceeded 15860.
    expect(CSS_BUDGETS.find((budget) => budget.name === "styles.css")?.ceilingGzip).toBe(
      ceilingFromMeasured(16843)
    );
  });

  it("shares packed extract+symlink with package-check", () => {
    // Source-grep: helper single-sourcing has no consumer-behavior probe beyond the pack gate.
    const tarball = readFileSync(join(packageRoot, "scripts/tarball.ts"), "utf8");
    expect(tarball).toContain("export function extractPackedPackage");
    expect(tarball).toContain("export const ARTIFACTS_DIR");
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).toContain(
      "extractPackedPackage"
    );
    expect(readFileSync(join(packageRoot, "scripts/size-limit.ts"), "utf8")).toContain(
      "extractPackedPackage"
    );
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).not.toContain(
      "function extractPackedPackage"
    );
    expect(readFileSync(join(packageRoot, "scripts/size-limit.ts"), "utf8")).not.toContain("symlinkSync");
  });

  it("packs the tarball outside the dist tree", () => {
    // Order/absence of pack destination has no consumer-behavior probe beyond the pack task.
    const source = readFileSync(join(packageRoot, "scripts/pack.ts"), "utf8");
    expect(source).toContain("--pack-destination");
    expect(source).toContain("ARTIFACTS_DIR");
    expect(source).not.toContain("copyFileSync");
    expect(source).not.toContain("readdirSync(dist)");
  });
});
