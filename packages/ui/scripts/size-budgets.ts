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
 * Measurements (gzip bytes, 2026-08-21 Wave 3 + this PR):
 *   .             42768
 *   theme          6129
 *   icons/Check     818  (per-icon export, not the full roster)
 *   button        25214
 *   scroll-area   28536
 *   illustrations 11060
 *   separator     10524
 *   field         30256
 *   item          24115
 *   input         25047
 *   textarea      21278
 *   flags          1388
 *   themes.css     2274
 *   styles.css     7077  (recalibrated in the Wave 3 PR, measured×1.5)
 *
 * Measurements (gzip bytes, 2026-08-22 Dialog):
 *   dialog        45229  (new entry, ceiling = measured × 1.5)
 *   .             61103  (grew with the new entry; still under the standing 64167 ceiling,
 *                         so the aggregate row is recorded, not loosened)
 *   styles.css     8211  (grew with Dialog's utilities; still under the standing 10616 ceiling)
 *
 * Measurements (gzip bytes, 2026-08-22 Card):
 *   card          15964  (new entry, ceiling = measured × 1.5)
 *   .             61852  (grew with the new entry; still under the standing 64167 ceiling,
 *                         so the aggregate row is recorded, not loosened)
 *   styles.css     8714  (grew with Card's utilities; still under the standing 10616 ceiling)
 *
 * Measurements (gzip bytes, 2026-08-22 Badge):
 *   badge         15662  (new entry, ceiling = measured × 1.5)
 *   .             56607  (aggregate re-measured with the new entry; under the standing
 *                         64167 ceiling, so the row is recorded, not loosened)
 *   styles.css     9213  (grew with Badge's utilities; still under the standing 10616 ceiling)
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
  { name: ".", entryFile: "index.js", ceilingGzip: 64167 },
  { name: "theme", entryFile: "theme.js", ceilingGzip: 9194 },
  { name: "badge", entryFile: "badge.js", ceilingGzip: 23493 },
  { name: "button", entryFile: "button.js", ceilingGzip: 37821 },
  { name: "card", entryFile: "card.js", ceilingGzip: 23946 },
  { name: "dialog", entryFile: "dialog.js", ceilingGzip: 67844 },
  { name: "scroll-area", entryFile: "scroll-area.js", ceilingGzip: 42804 },
  { name: "illustrations", entryFile: "illustrations.js", ceilingGzip: 16590 },
  { name: "separator", entryFile: "separator.js", ceilingGzip: 15786 },
  { name: "field", entryFile: "field.js", ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", ceilingGzip: 37569 },
  { name: "textarea", entryFile: "textarea.js", ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", ceilingGzip: 2082 },
];

export const NAMED_IMPORT_BUDGETS: readonly NamedImportBudget[] = [
  { name: "icons/Check", entryFile: "icons.js", exportName: "Check", ceilingGzip: 1215 },
];

export const CSS_BUDGETS: readonly CssBudget[] = [
  { name: "themes.css", file: "themes.css", ceilingGzip: 3424 },
  { name: "styles.css", file: "styles.css", ceilingGzip: 10616 },
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
