/**
 * Packed-entry gzip ceilings. Rows store `measuredGzip`. Ceiling derives as
 * measured × 1.5 unless a standing ceiling is written.
 */
import { FLAG_RAW_CEILING_BYTES } from "./flag-payload";

/** Date of the `measuredGzip` values recorded in the budget tables. */
export const BUDGETS_MEASURED_ON = "2026-09-03";

export type JsEntryBudget = {
  name: string;
  entryFile: string;
  measuredGzip: number;
  ceilingGzip: number;
};

export type NamedImportBudget = {
  name: string;
  entryFile: string;
  exportName: string;
  measuredGzip: number;
  ceilingGzip: number;
};

export type CssBudget = {
  name: string;
  file: string;
  measuredGzip: number;
  ceilingGzip: number;
};

export type FlagRawBudget = {
  name: string;
  ceilingBytes: number;
};

type MeasuredRow = { measuredGzip: number; ceilingGzip?: number };
type Measured<T> = Omit<T, "ceilingGzip"> & { ceilingGzip?: number };

export function ceilingFromMeasured(gzipBytes: number): number {
  return Math.round(gzipBytes * 1.5);
}

export function withDerivedCeiling<T extends MeasuredRow>(row: T): T & { ceilingGzip: number } {
  return { ...row, ceilingGzip: row.ceilingGzip ?? ceilingFromMeasured(row.measuredGzip) };
}

function derive<T extends MeasuredRow>(rows: readonly T[]): Array<T & { ceilingGzip: number }> {
  return rows.map(withDerivedCeiling);
}

export const JS_ENTRY_BUDGETS: readonly JsEntryBudget[] = derive([
  { name: ".", entryFile: "index.js", measuredGzip: 233896, ceilingGzip: 257843 },
  { name: "theme", entryFile: "theme.js", measuredGzip: 6172, ceilingGzip: 9194 },
  { name: "badge", entryFile: "badge.js", measuredGzip: 15658, ceilingGzip: 23493 },
  { name: "button", entryFile: "button.js", measuredGzip: 25248, ceilingGzip: 37821 },
  { name: "card", entryFile: "card.js", measuredGzip: 15954, ceilingGzip: 23937 },
  { name: "dialog", entryFile: "dialog.js", measuredGzip: 45332, ceilingGzip: 67844 },
  { name: "popover", entryFile: "popover.js", measuredGzip: 56880, ceilingGzip: 85298 },
  { name: "scroll-area", entryFile: "scroll-area.js", measuredGzip: 28555, ceilingGzip: 42804 },
  { name: "illustrations", entryFile: "illustrations.js", measuredGzip: 11046, ceilingGzip: 16590 },
  { name: "separator", entryFile: "separator.js", measuredGzip: 10524 },
  { name: "field", entryFile: "field.js", measuredGzip: 30277, ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", measuredGzip: 24143, ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", measuredGzip: 25114, ceilingGzip: 37569 },
  { name: "input-group", entryFile: "input-group.js", measuredGzip: 28003, ceilingGzip: 42002 },
  { name: "textarea", entryFile: "textarea.js", measuredGzip: 21354, ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", measuredGzip: 1388 },
  // `pnpm gen component` appends a 0-ceiling row below this marker, so a brand-new packed
  // entry cannot slip through unbudgeted. Replace the 0 with measured × 1.5.
  // plop:js-entry-budget
  { name: "sidebar", entryFile: "sidebar.js", measuredGzip: 82845, ceilingGzip: 123824 },
  { name: "toast", entryFile: "toast.js", measuredGzip: 42392, ceilingGzip: 63440 },
  {
    name: "phone-number-field",
    entryFile: "phone-number-field.js",
    measuredGzip: 118120,
    ceilingGzip: 174516,
  },
  {
    name: "popover-info-button",
    entryFile: "popover-info-button.js",
    measuredGzip: 60611,
    ceilingGzip: 90792,
  },
  { name: "combobox", entryFile: "combobox.js", measuredGzip: 73510, ceilingGzip: 109703 },
  { name: "toggle-group", entryFile: "toggle-group.js", measuredGzip: 29089, ceilingGzip: 43413 },
  { name: "checkbox-card", entryFile: "checkbox-card.js", measuredGzip: 30198, ceilingGzip: 45285 },
  { name: "radio-group", entryFile: "radio-group.js", measuredGzip: 40401, ceilingGzip: 60297 },
  { name: "checkbox", entryFile: "checkbox.js", measuredGzip: 37222, ceilingGzip: 55520 },
  { name: "selection-item", entryFile: "selection-item.js", measuredGzip: 32013, ceilingGzip: 47954 },
  { name: "switch", entryFile: "switch.js", measuredGzip: 26569, ceilingGzip: 39825 },
  { name: "button-group", entryFile: "button-group.js", measuredGzip: 17587 },
  { name: "accordion", entryFile: "accordion.js", measuredGzip: 30211, ceilingGzip: 45276 },
  { name: "description-list", entryFile: "description-list.js", measuredGzip: 10715, ceilingGzip: 16070 },
  { name: "emoji", entryFile: "emoji.js", measuredGzip: 2442 },
  { name: "avatar", entryFile: "avatar.js", measuredGzip: 12463, ceilingGzip: 18701 },
  { name: "alert-dialog", entryFile: "alert-dialog.js", measuredGzip: 47735, ceilingGzip: 71367 },
  { name: "dropdown-menu", entryFile: "dropdown-menu.js", measuredGzip: 68278, ceilingGzip: 102293 },
  { name: "collapsible", entryFile: "collapsible.js", measuredGzip: 27276, ceilingGzip: 40881 },
  { name: "select", entryFile: "select.js", measuredGzip: 64087, ceilingGzip: 95586 },
  { name: "show", entryFile: "show.js", measuredGzip: 148 },
  { name: "loader", entryFile: "loader.js", measuredGzip: 16748 },
  { name: "empty", entryFile: "empty.js", measuredGzip: 21356 },
  { name: "frame", entryFile: "frame.js", measuredGzip: 9059 },
  { name: "code", entryFile: "code.js", measuredGzip: 11756 },
  { name: "span", entryFile: "span.js", measuredGzip: 17324 },
  { name: "timeline-list", entryFile: "timeline-list.js", measuredGzip: 23552, ceilingGzip: 35330 },
  { name: "sheet", entryFile: "sheet.js", measuredGzip: 57266, ceilingGzip: 85812 },
  { name: "text-field", entryFile: "text-field.js", measuredGzip: 33692, ceilingGzip: 50193 },
  { name: "tooltip", entryFile: "tooltip.js", measuredGzip: 51165, ceilingGzip: 76722 },
  { name: "heading", entryFile: "heading.js", measuredGzip: 17319, ceilingGzip: 25924 },
  { name: "text", entryFile: "text.js", measuredGzip: 17315, ceilingGzip: 25919 },
  { name: "toggle", entryFile: "toggle.js", measuredGzip: 25540, ceilingGzip: 38223 },
  { name: "skeleton", entryFile: "skeleton.js", measuredGzip: 8701 },
  { name: "number-field", entryFile: "number-field.js", measuredGzip: 41008, ceilingGzip: 60983 },
  { name: "meter", entryFile: "meter.js", measuredGzip: 27773, ceilingGzip: 41048 },
  { name: "tabs", entryFile: "tabs.js", measuredGzip: 25832, ceilingGzip: 38664 },
  { name: "confirm-button", entryFile: "confirm-button.js", measuredGzip: 25662, ceilingGzip: 38438 },
  { name: "table", entryFile: "table.js", measuredGzip: 11932, ceilingGzip: 17721 },
  { name: "textarea-field", entryFile: "textarea-field.js", measuredGzip: 32934, ceilingGzip: 46464 },
  { name: "pagination", entryFile: "pagination.js", measuredGzip: 19425, ceilingGzip: 28785 },
  { name: "breadcrumb", entryFile: "breadcrumb.js", measuredGzip: 25352, ceilingGzip: 37869 },
  { name: "alert", entryFile: "alert.js", measuredGzip: 30619, ceilingGzip: 45885 },
  { name: "react-aria/ui-providers", entryFile: "react-aria/ui-providers.js", measuredGzip: 1987 },
  {
    name: "react-aria/date-field",
    entryFile: "react-aria/date-field.js",
    measuredGzip: 70232,
    ceilingGzip: 105099,
  },
  {
    name: "react-aria/calendar",
    entryFile: "react-aria/calendar.js",
    measuredGzip: 61203,
    ceilingGzip: 91506,
  },
  {
    name: "react-aria/range-calendar",
    entryFile: "react-aria/range-calendar.js",
    measuredGzip: 62393,
    ceilingGzip: 93471,
  },
  {
    name: "react-aria/date-picker",
    entryFile: "react-aria/date-picker.js",
    measuredGzip: 104626,
    ceilingGzip: 157282,
  },
  {
    name: "react-aria/date-range-picker",
    entryFile: "react-aria/date-range-picker.js",
    measuredGzip: 104152,
    ceilingGzip: 156552,
  },
  { name: "react-aria/link", entryFile: "react-aria/link.js", measuredGzip: 31282, ceilingGzip: 46851 },
  {
    name: "react-aria/search-field",
    entryFile: "react-aria/search-field.js",
    measuredGzip: 41782,
    ceilingGzip: 62397,
  },
  {
    name: "react-aria/grid-list",
    entryFile: "react-aria/grid-list.js",
    measuredGzip: 68846,
    ceilingGzip: 100964,
  },
  { name: "react-aria/focusable", entryFile: "react-aria/focusable.js", measuredGzip: 3642 },
  {
    name: "react-aria/file-trigger",
    entryFile: "react-aria/file-trigger.js",
    measuredGzip: 36501,
    ceilingGzip: 54725,
  },
] satisfies readonly Measured<JsEntryBudget>[]);

export const NAMED_IMPORT_BUDGETS: readonly NamedImportBudget[] = derive([
  {
    name: "icons/Check",
    entryFile: "icons.js",
    exportName: "Check",
    measuredGzip: 818,
    ceilingGzip: 1215,
  },
] satisfies readonly Measured<NamedImportBudget>[]);

export const CSS_BUDGETS: readonly CssBudget[] = derive([
  { name: "themes.css", file: "themes.css", measuredGzip: 2274, ceilingGzip: 3424 },
  { name: "styles.css", file: "styles.css", measuredGzip: 22995, ceilingGzip: 24575 },
] satisfies readonly Measured<CssBudget>[]);

export const FLAG_RAW_BUDGETS: readonly FlagRawBudget[] = [
  { name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES },
];

export function budgetFailure(name: string, bytes: number, ceiling: number): string | undefined {
  if (bytes <= ceiling) {
    return undefined;
  }
  return `${name} ${bytes} bytes exceeds ceiling ${ceiling}`;
}
