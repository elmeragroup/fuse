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

function gzipBudgets() {
  return [...JS_ENTRY_BUDGETS, ...NAMED_IMPORT_BUDGETS, ...CSS_BUDGETS];
}

type SourceBudgetRow = {
  name: string;
  measuredGzip: number;
  ceilingGzip?: number;
};

const BUDGET_OBJECT = /\{\s*name:\s*"([^"]+)"([^}]*)\}/g;

function fieldNumber(body: string, field: string): number | undefined {
  const match = new RegExp(`${field}:\\s*(\\d+)`).exec(body);
  const value = match?.[1];
  return value === undefined ? undefined : Number(value);
}

/** Source rows only — does not apply derivation. */
function parseSourceGzipRows(source: string): SourceBudgetRow[] {
  const rows: SourceBudgetRow[] = [];
  for (const match of source.matchAll(BUDGET_OBJECT)) {
    const name = match[1];
    const body = match[2] ?? "";
    if (name === undefined || !body.includes("measuredGzip:")) {
      continue;
    }
    const measuredGzip = fieldNumber(body, "measuredGzip");
    if (measuredGzip === undefined) {
      continue;
    }
    const ceilingGzip = fieldNumber(body, "ceilingGzip");
    rows.push(ceilingGzip === undefined ? { name, measuredGzip } : { name, measuredGzip, ceilingGzip });
  }
  return rows;
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

  it("exports each budget ceiling as explicit ?? ceilingFromMeasured(measured)", () => {
    const budgetsSource = readFileSync(join(packageRoot, "scripts/size-budgets.ts"), "utf8");
    expect(budgetsSource).toContain("withDerivedCeiling");
    const parsed = parseSourceGzipRows(budgetsSource);
    const exported = gzipBudgets();
    expect(parsed.map((row) => row.name)).toEqual(exported.map((budget) => budget.name));
    for (const [index, row] of parsed.entries()) {
      const budget = exported[index];
      expect(budget, row.name).toBeDefined();
      expect(budget?.measuredGzip, row.name).toBe(row.measuredGzip);
      expect(budget?.ceilingGzip, row.name).toBe(row.ceilingGzip ?? ceilingFromMeasured(row.measuredGzip));
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
