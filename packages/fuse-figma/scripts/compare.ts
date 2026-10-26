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

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Result, Runtime } from "effect";
import { readFileSync } from "node:fs";
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

/**
 * The run stopped, and what it printed says why. The runtime exits 1 and prints nothing more, as
 * `cli.ts`'s reported failure does.
 */
class CompareStopped extends Data.TaggedError("CompareStopped") {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = 1;
}

/** Print why the run stops, on stderr, and stop it. */
const stop = (message: string) =>
  Console.error(message).pipe(Effect.andThen(Effect.fail(new CompareStopped())));

/** The text of a thrown value, for a message. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- throw boundary: Node's parser and file reads throw values with no static type
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Run the self-check, print its lines and the report path, and stop when it failed. */
const selfCheck = Effect.fn("compare.selfCheck")(function* (options: CompareOptions) {
  const result = yield* runSelfCheck(options).pipe(Effect.catch((failure) => stop(failure.message)));
  for (const line of result.lines) {
    yield* Console.log(line);
  }
  yield* Console.log(`Report: ${resolve(options.outDir, "report.html")}`);
  if (!result.passed) {
    return yield* new CompareStopped();
  }
});

/** Compare a snapshot export and print the summary, the five worst cells and the report path. */
const compare = Effect.fn("compare.snapshot")(function* (snapshotPath: string, options: CompareOptions) {
  const path = resolve(snapshotPath);
  const text = yield* Effect.try({ try: () => readFileSync(path, "utf8"), catch: describe }).pipe(
    Effect.catch((reason) => stop(`Could not read ${path}: ${reason}`))
  );
  const snapshot = parseSnapshot(text);
  if (Result.isFailure(snapshot)) {
    return yield* stop(snapshot.failure.message);
  }
  const report = yield* compareSnapshot(snapshot.success, options).pipe(
    Effect.catch((failure) => stop(failure.message))
  );
  const sized = report.rows.filter((row) => row.verdict.flags.includes("size")).length;
  yield* Console.log(
    `Compared ${String(report.rows.length)} cells from ${String(report.previews.length)} previews; ${String(sized)} differ in box size, ${String(report.skipped.length)} skipped.`
  );
  for (const row of report.rows.slice(0, 5)) {
    yield* Console.log(
      `  ${row.verdict.tolerantPercent.toFixed(2)}% tolerant, ${row.verdict.rawPercent.toFixed(2)}% raw  ${row.variant}  (${row.previewName})${row.verdict.flags.length === 0 ? "" : ` [${row.verdict.flags.join(", ")}]`}`
    );
  }
  if (report.fuseBuildStale) {
    yield* Console.warn(
      "Fuse's sources changed after its build. Run pnpm --filter @elmeragroup/fuse build and compare again."
    );
  }
  yield* Console.log(`Report: ${resolve(options.outDir, "report.html")}`);
});

const program = Effect.gen(function* () {
  const args = yield* Effect.try({
    try: () =>
      parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
          out: { type: "string" },
          threshold: { type: "string" },
          "self-check": { type: "boolean", default: false },
        },
      }),
    catch: describe,
  }).pipe(Effect.catch((reason) => stop(`${reason}\n${USAGE}`)));
  const { values, positionals } = args;
  const threshold = values.threshold === undefined ? DEFAULT_THRESHOLD : Number(values.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    return yield* stop(`--threshold takes a number from 0 to 1, not ${values.threshold ?? ""}`);
  }
  const isSelfCheck = values["self-check"];
  const outDir = resolve(values.out ?? (isSelfCheck ? `${DEFAULT_OUT}self-check/` : DEFAULT_OUT));
  const options: CompareOptions = { outDir, threshold, layout: PAGE_LAYOUT };
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(outDir, { recursive: true });
  if (isSelfCheck) {
    return yield* selfCheck(options);
  }
  const [snapshotPath, ...extra] = positionals;
  if (snapshotPath === undefined || extra.length > 0) {
    return yield* stop(USAGE);
  }
  return yield* compare(snapshotPath, options);
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
