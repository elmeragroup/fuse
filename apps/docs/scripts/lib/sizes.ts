/**
 * Measured bundle sizes for the Tokens page (docs-site.md §3.3, performance.md §2).
 *
 * The docs never carry their own numbers: both columns come out of
 * `packages/ui/scripts/size-budgets.ts`, the module `size-limit` enforces in the merge
 * gate. Ceilings are read from its budget tables and measurements from the recorded
 * measurement block the recalibration policy makes authors update. A budgeted entry
 * with no recorded measurement fails docs generation, so the published table cannot
 * quietly fall behind the budgets it sits next to.
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

/** The date stamped on the recorded measurement block, plus every entry it covers. */
export type BundleSizeReport = {
  measuredOn: string;
  entries: readonly BundleSize[];
};

const MEASUREMENT_BLOCK = /Current measurements \(gzip bytes, (\d{4}-\d{2}-\d{2})\)\./;
const MEASUREMENT_LINE = /^\s*\*\s+(\S+)\s+(\d+)\b/;
const BUDGET_ENTRY = /\{\s*name:\s*"([^"]+)"([^}]*?)ceilingGzip:\s*(\d+)/g;

type Measurements = {
  measuredOn: string;
  byName: ReadonlyMap<string, number>;
};

/**
 * Reads the `Current measurements (gzip bytes, …)` block out of the budget module's doc
 * comment — the authors' record of what the gate last measured.
 */
export function parseMeasurements(source: string, file: string): Measurements {
  const header = MEASUREMENT_BLOCK.exec(source);
  const measuredOn = header?.[1];
  if (header === null || measuredOn === undefined) {
    throw new Error(`${file}: no "Current measurements (gzip bytes, <date>)." block to read sizes from`);
  }
  const byName = new Map<string, number>();
  for (const line of source.slice(header.index + header[0].length).split("\n")) {
    if (line.includes("*/")) {
      break;
    }
    const match = MEASUREMENT_LINE.exec(line);
    const name = match?.[1];
    const bytes = match?.[2];
    if (name === undefined || bytes === undefined) {
      continue;
    }
    byName.set(name, Number(bytes));
  }
  return { measuredOn, byName };
}

type Budget = {
  name: string;
  kind: BundleEntryKind;
  ceilingGzip: number;
};

/**
 * Reads every gzip-budgeted entry out of the budget tables. A budget declaring a `file`
 * measures built CSS; one declaring an `entryFile` measures a JavaScript entry.
 */
export function parseBudgets(source: string, file: string): readonly Budget[] {
  const budgets: Budget[] = [];
  for (const match of source.matchAll(BUDGET_ENTRY)) {
    const name = match[1];
    const body = match[2] ?? "";
    const ceiling = match[3];
    if (name === undefined || ceiling === undefined) {
      continue;
    }
    budgets.push({
      name,
      kind: body.includes("entryFile:") ? "js" : "css",
      ceilingGzip: Number(ceiling),
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
  const { measuredOn, byName } = parseMeasurements(source, budgetsFile);

  const entries: BundleSize[] = [];
  for (const budget of parseBudgets(source, budgetsFile)) {
    const measuredGzip = byName.get(budget.name);
    if (measuredGzip === undefined) {
      problems.add(
        `size budget "${budget.name}" has no recorded measurement in packages/ui/scripts/size-budgets.ts`
      );
      continue;
    }
    entries.push({
      name: budget.name,
      kind: budget.kind,
      measuredGzip,
      ceilingGzip: budget.ceilingGzip,
    });
  }
  return { measuredOn, entries };
}
