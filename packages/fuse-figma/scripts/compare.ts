/**
 * `figma:compare`: compare the plugin's snapshot export with the real Fuse components in
 * Chromium, cell by cell, and write `report.html` and `report.json`.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:compare <snapshot.json> [--out <dir>] [--threshold <0..1>]
 *     pnpm --filter @elmeragroup/fuse-figma figma:compare --self-check [--out <dir>]
 *
 * pnpm runs the script in this package's directory, so give the snapshot as an absolute path.
 * The report goes to `.cache/figma-compare/` in this package unless `--out` names a directory.
 * `--self-check` renders the cells of the kit's preview frames, turns them into a fake snapshot
 * with two cells changed, and checks that the comparison reports exactly those two.
 */

import { Result } from "effect";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { PAGE_LAYOUT } from "../src/compare/preview-page.ts";
import { DEFAULT_THRESHOLD } from "../src/compare/raster.ts";
import { parseSnapshot } from "../src/compare/read-snapshot.ts";
import { compareSnapshot } from "../src/compare/run-compare.ts";
import type { CompareOptions } from "../src/compare/run-compare.ts";
import { runSelfCheck } from "../src/compare/self-check.ts";

const DEFAULT_OUT = fileURLToPath(new URL("../.cache/figma-compare/", import.meta.url));

const USAGE =
  "Usage: figma:compare <snapshot.json> [--out <dir>] [--threshold <0..1>]\n       figma:compare --self-check [--out <dir>]";

function exit(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        out: { type: "string" },
        threshold: { type: "string" },
        "self-check": { type: "boolean", default: false },
      },
    });
  } catch (error) {
    return exit(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
})();

const threshold = values.threshold === undefined ? DEFAULT_THRESHOLD : Number(values.threshold);
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  exit(`--threshold takes a number from 0 to 1, not ${values.threshold ?? ""}`);
}
const selfCheck = values["self-check"];
const outDir = resolve(values.out ?? (selfCheck ? `${DEFAULT_OUT}self-check/` : DEFAULT_OUT));
const options: CompareOptions = { outDir, threshold, layout: PAGE_LAYOUT };
mkdirSync(outDir, { recursive: true });

if (selfCheck) {
  const result = await runSelfCheck(options);
  if (Result.isFailure(result)) {
    exit(result.failure.message);
  }
  for (const line of result.success.lines) {
    console.log(line);
  }
  console.log(`Report: ${resolve(outDir, "report.html")}`);
  process.exit(result.success.passed ? 0 : 1);
}

const [snapshotPath, ...extra] = positionals;
if (snapshotPath === undefined || extra.length > 0) {
  exit(USAGE);
}
const text = (() => {
  try {
    return readFileSync(resolve(snapshotPath), "utf8");
  } catch (error) {
    return exit(
      `Could not read ${resolve(snapshotPath)}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
})();
const snapshot = parseSnapshot(text);
if (Result.isFailure(snapshot)) {
  exit(snapshot.failure.message);
}
const result = await compareSnapshot(snapshot.success, options);
if (Result.isFailure(result)) {
  exit(result.failure.message);
}
const report = result.success;
const sized = report.rows.filter((row) => row.verdict.flags.includes("size")).length;
console.log(
  `Compared ${String(report.rows.length)} cells from ${String(report.previews.length)} previews; ${String(sized)} differ in box size, ${String(report.skipped.length)} skipped.`
);
for (const row of report.rows.slice(0, 5)) {
  console.log(
    `  ${row.verdict.tolerantPercent.toFixed(2)}% tolerant, ${row.verdict.rawPercent.toFixed(2)}% raw  ${row.variant}  (${row.previewName})${row.verdict.flags.length === 0 ? "" : ` [${row.verdict.flags.join(", ")}]`}`
  );
}
if (report.fuseBuildStale) {
  console.warn(
    "Fuse's sources changed after its build. Run pnpm --filter @elmeragroup/fuse build and compare again."
  );
}
console.log(`Report: ${resolve(outDir, "report.html")}`);
