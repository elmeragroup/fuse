/**
 * Packed-entry gzip ceilings. Rows store `measuredGzip`. Ceiling derives as
 * measured × 1.5 unless a standing ceiling is written.
 */
import { FLAG_RAW_CEILING_BYTES } from "./flag-payload";

/** Date of the `measuredGzip` values recorded in the budget tables. */
export const BUDGETS_MEASURED_ON = "2026-09-19";

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

// 2026-09-19: all rows re-measured against the pinned toolchain. Growth below a written ceiling
// keeps it; shrink ratchets it down by the saved bytes (scroll-area −73, illustrations −10,
// sidebar −76). Collapsible measures 27627 (+351), still under its standing ceiling — no shrink to
// record. The shared root barrel grew within its standing ceiling, which stays unchanged (performance.md §2).
export const JS_ENTRY_BUDGETS: readonly JsEntryBudget[] = derive([
  { name: ".", entryFile: "index.js", measuredGzip: 234557, ceilingGzip: 257843 },
  { name: "theme", entryFile: "theme.js", measuredGzip: 6197, ceilingGzip: 9194 },
  { name: "badge", entryFile: "badge.js", measuredGzip: 15739, ceilingGzip: 23493 },
  { name: "button", entryFile: "button.js", measuredGzip: 25571, ceilingGzip: 37821 },
  { name: "card", entryFile: "card.js", measuredGzip: 16100, ceilingGzip: 23937 },
  { name: "dialog", entryFile: "dialog.js", measuredGzip: 46343, ceilingGzip: 67844 },
  { name: "popover", entryFile: "popover.js", measuredGzip: 57668, ceilingGzip: 85298 },
  { name: "scroll-area", entryFile: "scroll-area.js", measuredGzip: 28482, ceilingGzip: 42731 },
  { name: "illustrations", entryFile: "illustrations.js", measuredGzip: 11036, ceilingGzip: 16580 },
  { name: "separator", entryFile: "separator.js", measuredGzip: 10621, ceilingGzip: 15786 },
  { name: "field", entryFile: "field.js", measuredGzip: 30596, ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", measuredGzip: 24394, ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", measuredGzip: 25443, ceilingGzip: 37569 },
  { name: "input-group", entryFile: "input-group.js", measuredGzip: 28528, ceilingGzip: 42002 },
  { name: "textarea", entryFile: "textarea.js", measuredGzip: 21587, ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", measuredGzip: 1456, ceilingGzip: 2082 },
  // `pnpm gen component` appends a 0-ceiling row below this marker, so a brand-new packed
  // entry cannot slip through unbudgeted. Replace the 0 with measured × 1.5.
  // plop:js-entry-budget
  { name: "sidebar", entryFile: "sidebar.js", measuredGzip: 82769, ceilingGzip: 123748 },
  { name: "toast", entryFile: "toast.js", measuredGzip: 43158, ceilingGzip: 63440 },
  {
    name: "phone-number-field",
    entryFile: "phone-number-field.js",
    measuredGzip: 120212,
    ceilingGzip: 174516,
  },
  {
    name: "popover-info-button",
    entryFile: "popover-info-button.js",
    measuredGzip: 61411,
    ceilingGzip: 90792,
  },
  { name: "combobox", entryFile: "combobox.js", measuredGzip: 75479, ceilingGzip: 109703 },
  { name: "toggle-group", entryFile: "toggle-group.js", measuredGzip: 29541, ceilingGzip: 43413 },
  { name: "checkbox-card", entryFile: "checkbox-card.js", measuredGzip: 30303, ceilingGzip: 45285 },
  { name: "radio-group", entryFile: "radio-group.js", measuredGzip: 41712, ceilingGzip: 60297 },
  { name: "checkbox", entryFile: "checkbox.js", measuredGzip: 38951, ceilingGzip: 55520 },
  { name: "selection-item", entryFile: "selection-item.js", measuredGzip: 32423, ceilingGzip: 47954 },
  { name: "switch", entryFile: "switch.js", measuredGzip: 26581, ceilingGzip: 39825 },
  { name: "button-group", entryFile: "button-group.js", measuredGzip: 17738, ceilingGzip: 26381 },
  { name: "accordion", entryFile: "accordion.js", measuredGzip: 30624, ceilingGzip: 45276 },
  { name: "description-list", entryFile: "description-list.js", measuredGzip: 10794, ceilingGzip: 16070 },
  { name: "emoji", entryFile: "emoji.js", measuredGzip: 2442 },
  { name: "avatar", entryFile: "avatar.js", measuredGzip: 12898, ceilingGzip: 18701 },
  { name: "alert-dialog", entryFile: "alert-dialog.js", measuredGzip: 48778, ceilingGzip: 71367 },
  { name: "dropdown-menu", entryFile: "dropdown-menu.js", measuredGzip: 69465, ceilingGzip: 102293 },
  { name: "collapsible", entryFile: "collapsible.js", measuredGzip: 27627, ceilingGzip: 40881 },
  { name: "select", entryFile: "select.js", measuredGzip: 64967, ceilingGzip: 95586 },
  { name: "show", entryFile: "show.js", measuredGzip: 148 },
  { name: "loader", entryFile: "loader.js", measuredGzip: 16852, ceilingGzip: 25122 },
  { name: "empty", entryFile: "empty.js", measuredGzip: 21399, ceilingGzip: 32034 },
  { name: "frame", entryFile: "frame.js", measuredGzip: 9109, ceilingGzip: 13589 },
  { name: "code", entryFile: "code.js", measuredGzip: 12857, ceilingGzip: 17634 },
  { name: "span", entryFile: "span.js", measuredGzip: 17419, ceilingGzip: 25986 },
  { name: "timeline-list", entryFile: "timeline-list.js", measuredGzip: 23579, ceilingGzip: 35330 },
  { name: "sheet", entryFile: "sheet.js", measuredGzip: 57967, ceilingGzip: 85812 },
  { name: "text-field", entryFile: "text-field.js", measuredGzip: 34371, ceilingGzip: 50193 },
  { name: "tooltip", entryFile: "tooltip.js", measuredGzip: 51784, ceilingGzip: 76722 },
  { name: "heading", entryFile: "heading.js", measuredGzip: 17413, ceilingGzip: 25924 },
  { name: "text", entryFile: "text.js", measuredGzip: 17418, ceilingGzip: 25919 },
  { name: "toggle", entryFile: "toggle.js", measuredGzip: 25703, ceilingGzip: 38223 },
  { name: "skeleton", entryFile: "skeleton.js", measuredGzip: 8753, ceilingGzip: 13052 },
  { name: "number-field", entryFile: "number-field.js", measuredGzip: 42364, ceilingGzip: 60983 },
  { name: "meter", entryFile: "meter.js", measuredGzip: 27862, ceilingGzip: 41048 },
  { name: "tabs", entryFile: "tabs.js", measuredGzip: 26252, ceilingGzip: 38664 },
  { name: "confirm-button", entryFile: "confirm-button.js", measuredGzip: 25977, ceilingGzip: 38438 },
  { name: "table", entryFile: "table.js", measuredGzip: 12010, ceilingGzip: 17721 },
  { name: "textarea-field", entryFile: "textarea-field.js", measuredGzip: 33800, ceilingGzip: 46464 },
  { name: "pagination", entryFile: "pagination.js", measuredGzip: 19671, ceilingGzip: 28785 },
  { name: "breadcrumb", entryFile: "breadcrumb.js", measuredGzip: 25527, ceilingGzip: 37869 },
  { name: "alert", entryFile: "alert.js", measuredGzip: 30996, ceilingGzip: 45885 },
  {
    name: "react-aria/ui-providers",
    entryFile: "react-aria/ui-providers.js",
    measuredGzip: 2031,
    ceilingGzip: 2981,
  },
  {
    name: "react-aria/date-field",
    entryFile: "react-aria/date-field.js",
    measuredGzip: 71488,
    ceilingGzip: 105099,
  },
  {
    name: "react-aria/calendar",
    entryFile: "react-aria/calendar.js",
    measuredGzip: 62362,
    ceilingGzip: 91506,
  },
  {
    name: "react-aria/range-calendar",
    entryFile: "react-aria/range-calendar.js",
    measuredGzip: 63827,
    ceilingGzip: 93471,
  },
  {
    name: "react-aria/date-picker",
    entryFile: "react-aria/date-picker.js",
    measuredGzip: 107196,
    ceilingGzip: 157282,
  },
  {
    name: "react-aria/date-range-picker",
    entryFile: "react-aria/date-range-picker.js",
    measuredGzip: 106711,
    ceilingGzip: 156552,
  },
  { name: "react-aria/link", entryFile: "react-aria/link.js", measuredGzip: 32413, ceilingGzip: 46851 },
  {
    name: "react-aria/search-field",
    entryFile: "react-aria/search-field.js",
    measuredGzip: 42976,
    ceilingGzip: 62397,
  },
  {
    name: "react-aria/grid-list",
    entryFile: "react-aria/grid-list.js",
    measuredGzip: 70571,
    ceilingGzip: 100964,
  },
  {
    name: "react-aria/focusable",
    entryFile: "react-aria/focusable.js",
    measuredGzip: 4680,
    ceilingGzip: 5463,
  },
  {
    name: "react-aria/file-trigger",
    entryFile: "react-aria/file-trigger.js",
    measuredGzip: 37687,
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
  // 2026-09-15: dark palettes for both variants, dark-only reset expansion, grouped selectors.
  // 2026-09-15: also removed the dead toast title selectors (Toast.Title inherits the root's
  // soft foreground). Ceilings ratcheted down by the bytes saved against the standing ones,
  // keeping headroom: themes.css 6786 − 370 = 6416, styles.css 24575 − 109 = 24466.
  // styles.css re-measured at 22965 after the toast description took the root's `--toast-copy`
  // pair (+79 bytes, within the standing ceiling).
  // 2026-09-17: dark external company rules materialize the full reset set, so the cascade no
  // longer depends on emission order. themes.css re-measured at 4472 (+29 gzip over the
  // 2026-09-15 record); no token values changed and the ceiling stays at 6416.
  // 2026-09-19: styles.css re-measured at 23421 (+456), within its standing ceiling of 24466
  // (performance.md §2); themes.css is unchanged at 4472/6416.
  { name: "themes.css", file: "themes.css", measuredGzip: 4472, ceilingGzip: 6416 },
  { name: "styles.css", file: "styles.css", measuredGzip: 23421, ceilingGzip: 24466 },
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
