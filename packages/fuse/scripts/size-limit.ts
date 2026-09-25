import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { rolldown } from "rolldown";
import type { RolldownBuild } from "rolldown";

import { flagPayload, listFlagFiles } from "./flag-assets.ts";
import { packageRootFromScript } from "./paths.ts";
import {
  budgetFailure,
  CSS_BUDGETS,
  FLAG_RAW_BUDGETS,
  JS_ENTRY_BUDGETS,
  NAMED_IMPORT_BUDGETS,
} from "./size-budgets.ts";
import { fail, withExtractedTarballAsync } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);
const PEER_EXTERNALS = ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "tailwindcss"];

function gzipSize(bytes: Uint8Array): number {
  return gzipSync(bytes).byteLength;
}

function workStem(name: string): string {
  if (name === ".") {
    return "root";
  }
  return name.replaceAll("/", "-");
}

/**
 * Budget breaches collected across the run so one failing measurement reports every overage
 * instead of stopping at the first. Structural errors (a missing packed entry) still throw
 * immediately, because no measurement can follow them.
 */
const breaches: string[] = [];

function reportBudget(name: string, bytes: number, ceiling: number, unit: string): void {
  console.log(`${name}: ${bytes} ${unit} (ceiling ${ceiling})`);
  const failure = budgetFailure(name, bytes, ceiling);
  if (failure !== undefined) {
    breaches.push(failure);
  }
}

/** One bundle measurement: a packed entry, or one named export of it when `exportName` is set. */
type BundleBudget = {
  readonly name: string;
  readonly entryFile: string;
  readonly exportName?: string;
  readonly ceilingGzip: number;
};

/** One measured bundle, reported in budget order once every bundle has settled. */
type Measurement = { readonly name: string; readonly bytes: number; readonly ceilingGzip: number };

/**
 * Bundles in-process through rolldown's JS API with the options the CLI form
 * (`rolldown <input> --format esm --minify --platform browser --file <output>`) sets, and
 * gzips the generated chunk in memory. One bundle per budget keeps every size attributable to
 * its own entry.
 */
async function measure(extracted: string, work: string, budget: BundleBudget): Promise<Measurement> {
  const entry = join(extracted, budget.entryFile);
  if (!existsSync(entry)) {
    throw new Error(`Packed entry ${budget.name} missing ${budget.entryFile}`);
  }
  let input = entry;
  if (budget.exportName !== undefined) {
    input = join(work, `${workStem(budget.name)}.fixture.js`);
    writeFileSync(input, `export { ${budget.exportName} } from ${JSON.stringify(entry)};\n`);
  }
  let bundle: RolldownBuild | undefined;
  try {
    bundle = await rolldown({
      input,
      platform: "browser",
      external: PEER_EXTERNALS,
      // Rolldown leaves an unresolved import external, which silently shrinks the measured
      // bundle, so it fails the budget; every other log stays quiet.
      onLog(_level, log) {
        if (log.code === "UNRESOLVED_IMPORT") {
          throw new Error(log.message);
        }
      },
    });
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const chunks = output.filter((file) => file.type === "chunk");
    const [chunk] = chunks;
    // `--file` rejects code splitting, so a measured bundle is exactly one chunk.
    if (chunks.length !== 1 || chunk === undefined) {
      throw new Error(`expected one chunk, got ${String(chunks.length)}`);
    }
    return { name: budget.name, bytes: gzipSize(Buffer.from(chunk.code)), ceilingGzip: budget.ceilingGzip };
  } catch (error) {
    throw new Error(
      `rolldown failed for ${input}:\n${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  } finally {
    await bundle?.close();
  }
}

/**
 * Rolldown parallelizes inside each build, so the number of bundles in flight stays below the
 * core count.
 */
const BUNDLE_CONCURRENCY = Math.max(1, Math.floor(availableParallelism() / 2));

/** Runs `tasks` with at most `limit` in flight and resolves to their results in input order. */
async function mapConcurrent<T>(tasks: readonly (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = Array.from({ length: tasks.length });
  // Workers share one iterator, so each task is claimed exactly once.
  const pending = tasks.entries();
  async function worker(): Promise<void> {
    for (const [index, task] of pending) {
      results[index] = await task();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function checkCss(extracted: string, file: string, name: string, ceilingGzip: number): void {
  const path = join(extracted, file);
  if (!existsSync(path)) {
    throw new Error(`Packed CSS ${name} missing ${file}`);
  }
  reportBudget(name, gzipSize(readFileSync(path)), ceilingGzip, "gzip bytes");
}

function checkFlagRaw(extracted: string, name: string, ceilingBytes: number): void {
  const flagsDir = join(extracted, "flags");
  if (!existsSync(flagsDir)) {
    throw new Error(`Packed ${name} missing flags/`);
  }
  const files = listFlagFiles(flagsDir);
  reportBudget(name, flagPayload(flagsDir, files).bytes, ceilingBytes, "raw bytes");
}

try {
  await withExtractedTarballAsync(packageRoot, "fuse-size-", async ({ extracted }) => {
    const work = join(dirname(extracted), "work");
    mkdirSync(work);
    const measurements = await mapConcurrent(
      [...JS_ENTRY_BUDGETS, ...NAMED_IMPORT_BUDGETS].map((budget) => () => measure(extracted, work, budget)),
      BUNDLE_CONCURRENCY
    );
    for (const measurement of measurements) {
      reportBudget(measurement.name, measurement.bytes, measurement.ceilingGzip, "gzip bytes");
    }
    for (const budget of CSS_BUDGETS) {
      checkCss(extracted, budget.file, budget.name, budget.ceilingGzip);
    }
    for (const budget of FLAG_RAW_BUDGETS) {
      checkFlagRaw(extracted, budget.name, budget.ceilingBytes);
    }
  });
  if (breaches.length > 0) {
    throw new Error(`size budgets failed:\n${breaches.join("\n")}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log("size-limit passed");
