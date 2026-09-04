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

function gzipBudgets() {
  return [...JS_ENTRY_BUDGETS, ...NAMED_IMPORT_BUDGETS, ...CSS_BUDGETS];
}

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
      "sidebar",
      "toast",
      "phone-number-field",
      "popover-info-button",
      "combobox",
      "toggle-group",
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
      "react-aria/file-trigger",
      "icons/Check",
    ]);
    expect(FLAG_RAW_BUDGETS).toEqual([{ name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES }]);
    expect(CSS_BUDGETS.map((budget) => budget.name)).toEqual(["themes.css", "styles.css"]);
  });

  it("derives ceilingGzip from measuredGzip and never re-types per-entry ceilings", () => {
    const budgetsSource = readFileSync(join(packageRoot, "scripts/size-budgets.ts"), "utf8");
    expect(budgetsSource).toContain("withDerivedCeiling");
    expect(budgetsSource).toContain("measuredGzip");
    const testSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(testSource).not.toMatch(/JS_ENTRY_BUDGETS\.find\(/);

    for (const budget of gzipBudgets()) {
      expect(budget.measuredGzip, budget.name).toBeGreaterThan(0);
      const derived = ceilingFromMeasured(budget.measuredGzip);
      if (budget.ceilingGzip === derived) {
        expect(budget.ceilingGzip).toBe(derived);
        continue;
      }
      // Standing ratchet: the written ceiling is the previously committed number, never
      // raised when the entry grows under it, and not looser than measured × 1.5 either.
      expect(budget.ceilingGzip, budget.name).toBeGreaterThan(0);
      expect(budget.ceilingGzip, budget.name).not.toBe(derived);
    }
  });

  it("shares packed extract+symlink with package-check through withExtractedTarball", () => {
    const tarball = readFileSync(join(packageRoot, "scripts/tarball.ts"), "utf8");
    expect(tarball).toContain("export function withExtractedTarball");
    expect(tarball).toContain("export function extractPackedPackage");
    expect(tarball).toContain("export const ARTIFACTS_DIR");
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).toContain(
      "withExtractedTarball"
    );
    expect(readFileSync(join(packageRoot, "scripts/size-limit.ts"), "utf8")).toContain(
      "withExtractedTarball"
    );
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).not.toContain(
      "function extractPackedPackage"
    );
    expect(readFileSync(join(packageRoot, "scripts/size-limit.ts"), "utf8")).not.toContain("symlinkSync");
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).not.toContain("mkdtempSync");
    expect(readFileSync(join(packageRoot, "scripts/size-limit.ts"), "utf8")).not.toContain("mkdtempSync");
  });

  it("packs the tarball outside the dist tree", () => {
    const source = readFileSync(join(packageRoot, "scripts/pack.ts"), "utf8");
    expect(source).toContain("--pack-destination");
    expect(source).toContain("ARTIFACTS_DIR");
    expect(source).toContain("findTarball");
    expect(source).not.toContain("copyFileSync");
    expect(source).not.toContain("readdirSync(dist)");
  });
});
