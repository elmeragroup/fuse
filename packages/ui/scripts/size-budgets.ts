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
 * The standing precedent for the down direction (2026-08-24, ticket 74b, `styles.css`
 * 9905 → 9758): **a shrink is not a recalibration trigger**, so rather than leave the
 * freed bytes as slack the ceiling is tightened by exactly what was lost, keeping the
 * headroom the entry was calibrated with. That is applied verbatim below.
 *
 * Re-measured 2026-09-03 (spec 08, the phase-B close): the shared overlay/field spine
 * landed across tickets 29 and 36–45, and this is the first full re-measure since. Every
 * number below is the packed measurement at that commit. Ten entries came in **under**
 * their previously recorded measurement, and each of those ceilings is tightened by
 * exactly the bytes lost. The rest grew — a per-entry cost of the shared modules that
 * each entry now pulls in, and of the behaviour tickets 42/45 added — but every one is
 * still under its standing ceiling, so those are **recorded, not loosened** (per-entry
 * ratchet above; the root barrel `.` and `styles.css` are the two shared/aggregate rows
 * and neither grew past its ceiling either). Earlier measurement rounds live in git.
 *
 * Current measurements (gzip bytes, 2026-09-03). Earlier measurement rounds live in git.
 *   .                            233882
 *   theme                          6172
 *   badge                         15658
 *   button                        25238
 *   card                          15954  (shrank 9 across phase B; ceiling tightened by exactly that, 23946 → 23937)
 *   dialog                        45319
 *   popover                       56876
 *   scroll-area                   28548
 *   illustrations                 11046
 *   separator                     10524
 *   field                         30277
 *   item                          24134
 *   input                         25103
 *   input-group                   27992  (shrank 15 across phase B; ceiling tightened by exactly that, 42017 → 42002)
 *   textarea                      21344
 *   flags                          1388
 *   sidebar                       82836
 *   toast                         42375
 *   phone-number-field           118103
 *   popover-info-button           60602
 *   combobox                      73496
 *   toggle-group                  29080
 *   checkbox-card                 30188  (shrank 6 across phase B; ceiling tightened by exactly that, 45291 → 45285)
 *   radio-group                   40394
 *   checkbox                      37214
 *   selection-item                32004
 *   switch                        26562
 *   button-group                  17587
 *   accordion                     30202
 *   description-list              10715
 *   emoji                          2442
 *   avatar                        12463
 *   alert-dialog                  47715
 *   dropdown-menu                 68268
 *   collapsible                   27265
 *   select                        64079
 *   show                            148
 *   loader                        16748
 *   empty                         21356
 *   frame                          9059
 *   code                          11756
 *   span                          17324
 *   timeline-list                 23552  (shrank 3 across phase B; ceiling tightened by exactly that, 35333 → 35330)
 *   sheet                         57256
 *   text-field                    33683
 *   tooltip                       51157
 *   heading                       17319  (shrank 10 across phase B; ceiling tightened by exactly that, 25934 → 25924)
 *   text                          17315
 *   toggle                        25531
 *   skeleton                       8701
 *   number-field                  40997
 *   meter                         27773
 *   tabs                          25822
 *   confirm-button                25653
 *   table                         11932
 *   textarea-field                32924
 *   pagination                    19416
 *   breadcrumb                    25342
 *   alert                         30609
 *   react-aria/ui-providers        1987
 *   react-aria/date-field         70226
 *   react-aria/calendar           61208  (shrank 24 across phase B; ceiling tightened by exactly that, 91535 → 91511)
 *   react-aria/range-calendar     62415  (shrank 2 across phase B; ceiling tightened by exactly that, 93495 → 93493)
 *   react-aria/date-picker       104650  (shrank 662 across phase B; ceiling tightened by exactly that, 157968 → 157306)
 *   react-aria/date-range-picker 104152  (shrank 648 across phase B; ceiling tightened by exactly that, 157200 → 156552)
 *   react-aria/link               31273
 *   react-aria/search-field       41777
 *   react-aria/grid-list          68844
 *   react-aria/focusable           3642
 *   react-aria/file-trigger       36493
 *   icons/Check                     818
 *   themes.css                     2274
 *   styles.css                    22995  (shrank 496 across phase B; ceiling tightened by exactly that, 25071 → 24575)
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
  { name: "card", entryFile: "card.js", ceilingGzip: 23937 },
  { name: "dialog", entryFile: "dialog.js", ceilingGzip: 67844 },
  { name: "popover", entryFile: "popover.js", ceilingGzip: 85298 },
  { name: "scroll-area", entryFile: "scroll-area.js", ceilingGzip: 42804 },
  { name: "illustrations", entryFile: "illustrations.js", ceilingGzip: 16590 },
  { name: "separator", entryFile: "separator.js", ceilingGzip: 15786 },
  { name: "field", entryFile: "field.js", ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", ceilingGzip: 37569 },
  { name: "input-group", entryFile: "input-group.js", ceilingGzip: 42002 },
  { name: "textarea", entryFile: "textarea.js", ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", ceilingGzip: 2082 },
  // `pnpm gen component` appends a 0-ceiling row below this marker, so a brand-new packed
  // entry cannot slip through unbudgeted. Replace the 0 with measured × 1.5.
  // plop:js-entry-budget
  { name: "sidebar", entryFile: "sidebar.js", ceilingGzip: 123824 },
  { name: "toast", entryFile: "toast.js", ceilingGzip: 63440 },
  { name: "phone-number-field", entryFile: "phone-number-field.js", ceilingGzip: 174516 },
  { name: "popover-info-button", entryFile: "popover-info-button.js", ceilingGzip: 90792 },
  { name: "combobox", entryFile: "combobox.js", ceilingGzip: 109703 },
  { name: "toggle-group", entryFile: "toggle-group.js", ceilingGzip: 43413 },
  { name: "checkbox-card", entryFile: "checkbox-card.js", ceilingGzip: 45285 },
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
  { name: "timeline-list", entryFile: "timeline-list.js", ceilingGzip: 35330 },
  { name: "sheet", entryFile: "sheet.js", ceilingGzip: 85812 },
  { name: "text-field", entryFile: "text-field.js", ceilingGzip: 50193 },
  { name: "tooltip", entryFile: "tooltip.js", ceilingGzip: 76722 },
  { name: "heading", entryFile: "heading.js", ceilingGzip: 25924 },
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
  { name: "react-aria/calendar", entryFile: "react-aria/calendar.js", ceilingGzip: 91511 },
  { name: "react-aria/range-calendar", entryFile: "react-aria/range-calendar.js", ceilingGzip: 93493 },
  { name: "react-aria/date-picker", entryFile: "react-aria/date-picker.js", ceilingGzip: 157306 },
  {
    name: "react-aria/date-range-picker",
    entryFile: "react-aria/date-range-picker.js",
    ceilingGzip: 156552,
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
  { name: "styles.css", file: "styles.css", ceilingGzip: 24575 },
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
