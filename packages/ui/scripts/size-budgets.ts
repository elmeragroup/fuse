/**
 * Packed-entry gzip ceilings. Calibrated 2026-08-21 as measured × 1.5
 * against the packed tarball (rolldown minify, peers external), then
 * recalibrated for shared/aggregate rows when those entries grow.
 *
 * New JS entry ⇒ add a row, measured×1.5.
 *
 * Recalibration policy (also in performance.md §2):
 * - Shared/aggregate entries (`styles.css`, root barrel `.`) recalibrate to
 *   measured×1.5 in the PR that grows them. Record the new measurement here.
 * - Per-component / per-icon entries keep the ratchet: ceilings only move down
 *   unless a reviewed PR says why.
 *
 * `styles.css` shrank on 2026-08-24 (ticket 74b): the component demos moved out of this
 * package into `apps/docs`, so their classes stopped leaking into the standalone
 * stylesheet through Tailwind's automatic source detection. Measured gzip 9905 → 9758
 * (raw 64422 → 63849). The shrink is not a recalibration trigger under the policy above,
 * so rather than leave the freed bytes as slack the ceiling is consciously tightened by
 * exactly what the sheet lost — 10616 → 10469, keeping the standing 2026-08-21 headroom.
 * Combined Heading+Text type-scale plus Popover utilities then grew the sheet to 10573
 * gzip on 2026-08-25, exceeding 10469, so the shared/aggregate row recalibrates to
 * measured×1.5.
 *
 * Current measurements (gzip bytes, 2026-08-27). Earlier measurement rounds live in git.
 *   .             171895  (ToggleGroup joined the root barrel; exceeded 171567, recalibrated to measured×1.5)
 *   theme          6133
 *   icons/Check     818  (per-icon export, not the full roster)
 *   button        25214
 *   scroll-area   28536
 *   illustrations 11046
 *   separator     10524
 *   field         30272
 *   item          24115
 *   input         25081
 *   textarea      21319
 *   dialog        45274
 *   popover       56866
 *   card          15963
 *   badge         15658
 *   input-group   28007
 *   flags          1388
 *   button-group  17587  (first calibration, ceiling 26381)
 *   accordion     30184  (first calibration, ceiling 45276)
 *   emoji          2442  (first calibration, ceiling 3663)
 *   avatar        12463  (first calibration, ceiling 18701)
 *   show            148  (first calibration, ceiling 222)
 *   frame          9059  (first calibration, ceiling 13589)
 *   code          11756  (first calibration, ceiling 17634)
 *   tooltip       51148  (first calibration, ceiling 76722)
 *   dropdown-menu 68195  (first calibration, ceiling 102293)
 *   switch        26550  (first calibration, ceiling 39825)
 *   collapsible   27254  (first calibration, ceiling 40881)
 *   select        63724  (first calibration, ceiling 95586)
 *   heading       17329
 *   text          17315
 *   span          17324  (first calibration, ceiling 25986)
 *   toggle        25507
 *   skeleton       8701  (combined packed gzip after rebase; first calibration, ceiling 13052)
 *   timeline-list 23555  (first calibration, ceiling 35333)
 *   sheet         57208  (first calibration, ceiling 85812)
 *   text-field    33475  (first calibration, ceiling 50193)
 *   loader        16748  (first calibration, ceiling 25122)
 *   empty         21356  (first calibration, ceiling 32034)
 *   description-list 10713  (first calibration, ceiling 16070)
 *   alert-dialog  47578  (first calibration, ceiling 71367)
 *   number-field  40655  (first calibration, ceiling 60983)
 *   meter         27365  (first calibration, ceiling 41048)
 *   tabs          25776  (first calibration, ceiling 38664)
 *   confirm-button 25625  (first calibration, ceiling 38438)
 *   table         11814  (first calibration, ceiling 17721)
 *   textarea-field 30976  (first calibration, ceiling 46464)
 *   pagination    19190  (first calibration, ceiling 28785)
 *   breadcrumb    25246  (first calibration, ceiling 37869)
 *   alert         30590  (first calibration, ceiling 45885)
 *   selection-item 31969  (first calibration, ceiling 47954)
 *   checkbox      37013  (first calibration, ceiling 55520)
 *   radio-group   40198  (first calibration, ceiling 60297)
 *   checkbox-card 30194  (first calibration, ceiling 45291)
 *   react-aria/ui-providers 1987  (first calibration, ceiling 2981)
 *   react-aria/date-field 70066  (recipe relocated to styles/date-field.ts; ratchet tightened by the 5 bytes it lost, ceiling 105099)
 *   react-aria/calendar 61232  (recipes relocated to styles/calendar.ts and the useId error-id override dropped; the module boundary costs 209 bytes, still far under the standing 91535 ceiling, so recorded, not loosened)
 *   react-aria/range-calendar 62417  (follows Calendar's relocated shared header parts; up 87, under the standing 93495 ceiling, so recorded, not loosened)
 *   react-aria/date-picker 105312  (PickerDialog deleted and the two-pane row folded into the recipe; ratchet tightened, ceiling 157968 — still the widest interim entry: it packs the field, calendar and overlay stacks together)
 *   react-aria/date-range-picker 104800  (composes the styled Dialog directly now that PickerDialog is gone; ratchet tightened, ceiling 157200 — the same three stacks as DatePicker, minus its preset pane and dictionary)
 *   react-aria/link 31234  (first calibration, ceiling 46851 — the RAC link runtime, no field/overlay stack)
 *   react-aria/search-field 41598  (first calibration, ceiling 62397 — RAC search field, field chrome, clear button, dictionary)
 *   react-aria/grid-list 67309  (first calibration, ceiling 100964 — RAC grid list and selection checkbox)
 *   react-aria/focusable 3642  (first calibration, ceiling 5463 — RAC Focusable and useFocusable re-export)
 *   react-aria/file-trigger 36483  (first calibration, ceiling 54725 — RAC FileTrigger, internal Button, three Phosphor icons)
 *   toggle-group  28942  (first calibration, ceiling 43413)
 *   themes.css     2274
 *   styles.css    19354  (grid-list first calibration grew the sheet; under the standing 25265
 *                  ceiling from Table recalibration, so recorded, not loosened. Do not spell flagged
 *                  utilities in this file: Tailwind's source detection scans it and would emit them again.)
 */
import { FLAG_RAW_CEILING_BYTES } from "./flag-payload";

export type JsEntryBudget = {
  name: string;
  entryFile: string;
  ceilingGzip: number;
};

export type NamedImportBudget = {
  name: string;
  entryFile: string;
  exportName: string;
  ceilingGzip: number;
};

export type CssBudget = {
  name: string;
  file: string;
  ceilingGzip: number;
};

export type FlagRawBudget = {
  name: string;
  ceilingBytes: number;
};

export const JS_ENTRY_BUDGETS: readonly JsEntryBudget[] = [
  { name: ".", entryFile: "index.js", ceilingGzip: 257843 },
  { name: "theme", entryFile: "theme.js", ceilingGzip: 9194 },
  { name: "badge", entryFile: "badge.js", ceilingGzip: 23493 },
  { name: "button", entryFile: "button.js", ceilingGzip: 37821 },
  { name: "card", entryFile: "card.js", ceilingGzip: 23946 },
  { name: "dialog", entryFile: "dialog.js", ceilingGzip: 67844 },
  { name: "popover", entryFile: "popover.js", ceilingGzip: 85298 },
  { name: "scroll-area", entryFile: "scroll-area.js", ceilingGzip: 42804 },
  { name: "illustrations", entryFile: "illustrations.js", ceilingGzip: 16590 },
  { name: "separator", entryFile: "separator.js", ceilingGzip: 15786 },
  { name: "field", entryFile: "field.js", ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", ceilingGzip: 37569 },
  { name: "input-group", entryFile: "input-group.js", ceilingGzip: 42017 },
  { name: "textarea", entryFile: "textarea.js", ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", ceilingGzip: 2082 },
  // `pnpm gen component` appends a 0-ceiling row below this marker, so a brand-new packed
  // entry cannot slip through unbudgeted. Replace the 0 with measured × 1.5.
  // plop:js-entry-budget
  { name: "toggle-group", entryFile: "toggle-group.js", ceilingGzip: 43413 },
  { name: "checkbox-card", entryFile: "checkbox-card.js", ceilingGzip: 45291 },
  { name: "radio-group", entryFile: "radio-group.js", ceilingGzip: 60297 },
  { name: "checkbox", entryFile: "checkbox.js", ceilingGzip: 55520 },
  { name: "selection-item", entryFile: "selection-item.js", ceilingGzip: 47954 },
  { name: "switch", entryFile: "switch.js", ceilingGzip: 39825 },
  { name: "button-group", entryFile: "button-group.js", ceilingGzip: 26381 },
  { name: "accordion", entryFile: "accordion.js", ceilingGzip: 45276 },
  { name: "description-list", entryFile: "description-list.js", ceilingGzip: 16070 },
  { name: "emoji", entryFile: "emoji.js", ceilingGzip: 3663 },
  { name: "avatar", entryFile: "avatar.js", ceilingGzip: 18701 },
  { name: "alert-dialog", entryFile: "alert-dialog.js", ceilingGzip: 71367 },
  { name: "dropdown-menu", entryFile: "dropdown-menu.js", ceilingGzip: 102293 },
  { name: "collapsible", entryFile: "collapsible.js", ceilingGzip: 40881 },
  { name: "select", entryFile: "select.js", ceilingGzip: 95586 },
  { name: "show", entryFile: "show.js", ceilingGzip: 222 },
  { name: "loader", entryFile: "loader.js", ceilingGzip: 25122 },
  { name: "empty", entryFile: "empty.js", ceilingGzip: 32034 },
  { name: "frame", entryFile: "frame.js", ceilingGzip: 13589 },
  { name: "code", entryFile: "code.js", ceilingGzip: 17634 },
  { name: "span", entryFile: "span.js", ceilingGzip: 25986 },
  { name: "timeline-list", entryFile: "timeline-list.js", ceilingGzip: 35333 },
  { name: "sheet", entryFile: "sheet.js", ceilingGzip: 85812 },
  { name: "text-field", entryFile: "text-field.js", ceilingGzip: 50193 },
  { name: "tooltip", entryFile: "tooltip.js", ceilingGzip: 76722 },
  { name: "heading", entryFile: "heading.js", ceilingGzip: 25934 },
  { name: "text", entryFile: "text.js", ceilingGzip: 25919 },
  { name: "toggle", entryFile: "toggle.js", ceilingGzip: 38223 },
  { name: "skeleton", entryFile: "skeleton.js", ceilingGzip: 13052 },
  { name: "number-field", entryFile: "number-field.js", ceilingGzip: 60983 },
  { name: "meter", entryFile: "meter.js", ceilingGzip: 41048 },
  { name: "tabs", entryFile: "tabs.js", ceilingGzip: 38664 },
  { name: "confirm-button", entryFile: "confirm-button.js", ceilingGzip: 38438 },
  { name: "table", entryFile: "table.js", ceilingGzip: 17721 },
  { name: "textarea-field", entryFile: "textarea-field.js", ceilingGzip: 46464 },
  { name: "pagination", entryFile: "pagination.js", ceilingGzip: 28785 },
  { name: "breadcrumb", entryFile: "breadcrumb.js", ceilingGzip: 37869 },
  { name: "alert", entryFile: "alert.js", ceilingGzip: 45885 },
  { name: "react-aria/ui-providers", entryFile: "react-aria/ui-providers.js", ceilingGzip: 2981 },
  { name: "react-aria/date-field", entryFile: "react-aria/date-field.js", ceilingGzip: 105099 },
  { name: "react-aria/calendar", entryFile: "react-aria/calendar.js", ceilingGzip: 91535 },
  { name: "react-aria/range-calendar", entryFile: "react-aria/range-calendar.js", ceilingGzip: 93495 },
  { name: "react-aria/date-picker", entryFile: "react-aria/date-picker.js", ceilingGzip: 157968 },
  {
    name: "react-aria/date-range-picker",
    entryFile: "react-aria/date-range-picker.js",
    ceilingGzip: 157200,
  },
  { name: "react-aria/link", entryFile: "react-aria/link.js", ceilingGzip: 46851 },
  { name: "react-aria/search-field", entryFile: "react-aria/search-field.js", ceilingGzip: 62397 },
  { name: "react-aria/grid-list", entryFile: "react-aria/grid-list.js", ceilingGzip: 100964 },
  { name: "react-aria/focusable", entryFile: "react-aria/focusable.js", ceilingGzip: 5463 },
  { name: "react-aria/file-trigger", entryFile: "react-aria/file-trigger.js", ceilingGzip: 54725 },
];

export const NAMED_IMPORT_BUDGETS: readonly NamedImportBudget[] = [
  { name: "icons/Check", entryFile: "icons.js", exportName: "Check", ceilingGzip: 1215 },
];

export const CSS_BUDGETS: readonly CssBudget[] = [
  { name: "themes.css", file: "themes.css", ceilingGzip: 3424 },
  { name: "styles.css", file: "styles.css", ceilingGzip: 25265 },
];

export const FLAG_RAW_BUDGETS: readonly FlagRawBudget[] = [
  { name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES },
];

export function ceilingFromMeasured(gzipBytes: number): number {
  return Math.round(gzipBytes * 1.5);
}

export function budgetFailure(name: string, bytes: number, ceiling: number): string | undefined {
  if (bytes <= ceiling) {
    return undefined;
  }
  return `${name} ${bytes} bytes exceeds ceiling ${ceiling}`;
}
