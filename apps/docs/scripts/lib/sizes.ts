/**
 * Measured bundle sizes for the Tokens page (docs-site.md §3.3, performance.md §2).
 *
 * The docs never carry their own numbers: both columns come out of
 * `packages/ui/scripts/size-budgets.ts`, the module `size-limit` enforces in the merge
 * gate. Each budget row stores `measuredGzip`; `ceilingGzip` is derived as measured × 1.5
 * unless a standing ratchet ceiling is written on the row. A budgeted entry with no
 * recorded measurement fails docs generation, so the published table cannot quietly fall
 * behind the budgets it sits next to.
 *
 * The read is lexical rather than an import: that module resolves its own imports
 * through the library's TypeScript loader, which the docs generator does not run under.
 * Lexical is also how the rest of this pipeline reads library facts — every number here
 * is something the file literally says.
 *
 * The flag SVG aggregate is deliberately out of scope: it is a raw-byte asset ceiling,
 * not a measured JS/CSS payload, and performance.md keeps it on its own gate. It has no
 * `ceilingGzip`, so it never matches.
 */

import { readFileSync } from "node:fs";

import type { BundleEntryKind, BundleSize } from "../../src/lib/docs-model.ts";
import type { ProblemLog } from "./errors.ts";

/** The date stamped on the recorded measurement, plus every entry it covers. */
export type BundleSizeReport = {
  measuredOn: string;
  entries: readonly BundleSize[];
};

const MEASURED_ON = /export const BUDGETS_MEASURED_ON = "(\d{4}-\d{2}-\d{2})"/;
const BUDGET_OBJECT = /\{\s*name:\s*"([^"]+)"([^}]*)\}/g;

type Budget = {
  name: string;
  kind: BundleEntryKind;
  measuredGzip: number;
  ceilingGzip: number;
};

function derivedCeiling(measuredGzip: number): number {
  return Math.round(measuredGzip * 1.5);
}

function fieldNumber(body: string, field: string): number | undefined {
  const match = new RegExp(`${field}:\\s*(\\d+)`).exec(body);
  const value = match?.[1];
  return value === undefined ? undefined : Number(value);
}

/**
 * Reads the recorded measurement date out of the budget module.
 */
export function parseMeasuredOn(source: string, file: string): string {
  const measuredOn = MEASURED_ON.exec(source)?.[1];
  if (measuredOn === undefined) {
    throw new Error(`${file}: no BUDGETS_MEASURED_ON date to read sizes from`);
  }
  return measuredOn;
}

/**
 * Reads every gzip-budgeted entry out of the budget tables. A budget declaring a `file`
 * measures built CSS; one declaring an `entryFile` measures a JavaScript entry.
 * `ceilingGzip` is the standing number when written, otherwise measured × 1.5.
 */
export function parseBudgets(source: string, file: string): readonly Budget[] {
  const budgets: Budget[] = [];
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
    budgets.push({
      name,
      kind: body.includes("entryFile:") ? "js" : "css",
      measuredGzip,
      ceilingGzip: fieldNumber(body, "ceilingGzip") ?? derivedCeiling(measuredGzip),
    });
  }
  if (budgets.length === 0) {
    throw new Error(`${file}: no gzip budgets found — the budget tables moved or changed shape`);
  }
  return budgets;
}

/** Every budgeted JS and CSS entry, paired with its recorded measurement. */
export function readBundleSizes(budgetsFile: string, problems: ProblemLog): BundleSizeReport {
  const source = readFileSync(budgetsFile, "utf8");
  const measuredOn = parseMeasuredOn(source, budgetsFile);

  const entries: BundleSize[] = [];
  for (const budget of parseBudgets(source, budgetsFile)) {
    if (budget.measuredGzip <= 0) {
      problems.add(
        `size budget "${budget.name}" has no recorded measurement in packages/ui/scripts/size-budgets.ts`
      );
      continue;
    }
    entries.push({
      name: budget.name,
      kind: budget.kind,
      measuredGzip: budget.measuredGzip,
      ceilingGzip: budget.ceilingGzip,
    });
  }
  return { measuredOn, entries };
}
