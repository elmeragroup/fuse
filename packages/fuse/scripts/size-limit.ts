import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "rolldown";

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

/**
 * Bundles in-process through rolldown's JS API with the options the CLI form
 * (`rolldown <input> --format esm --minify --platform browser --file <output>`) sets. One
 * bundle per budget keeps every size attributable to its own entry.
 */
async function rolldownBundle(input: string, output: string): Promise<void> {
  try {
    await build({
      input,
      platform: "browser",
      external: PEER_EXTERNALS,
      logLevel: "silent",
      output: { file: output, format: "esm", minify: true },
    });
  } catch (error) {
    throw new Error(
      `rolldown failed for ${input}:\n${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/** One measured bundle, reported in budget order once every bundle has settled. */
type Measurement = { readonly name: string; readonly bytes: number; readonly ceilingGzip: number };

async function measureJsEntry(
  extracted: string,
  work: string,
  entryFile: string,
  name: string,
  ceilingGzip: number
): Promise<Measurement> {
  const input = join(extracted, entryFile);
  if (!existsSync(input)) {
    throw new Error(`Packed entry ${name} missing ${entryFile}`);
  }
  const output = join(work, `${workStem(name)}.js`);
  await rolldownBundle(input, output);
  return { name, bytes: gzipSize(readFileSync(output)), ceilingGzip };
}

async function measureNamedImport(
  extracted: string,
  work: string,
  entryFile: string,
  exportName: string,
  name: string,
  ceilingGzip: number
): Promise<Measurement> {
  const input = join(extracted, entryFile);
  if (!existsSync(input)) {
    throw new Error(`Packed entry ${name} missing ${entryFile}`);
  }
  const fixture = join(work, `${workStem(name)}.fixture.js`);
  writeFileSync(fixture, `export { ${exportName} } from ${JSON.stringify(input)};\n`);
  const output = join(work, `${workStem(name)}.js`);
  await rolldownBundle(fixture, output);
  return { name, bytes: gzipSize(readFileSync(output)), ceilingGzip };
}

/**
 * Runs `tasks` with at most `limit` in flight and resolves to their results in input order.
 * Rolldown parallelizes inside each build, so the cap stays below the core count.
 */
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

const BUNDLE_CONCURRENCY = Math.max(1, Math.floor(availableParallelism() / 2));

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
      [
        ...JS_ENTRY_BUDGETS.map(
          (budget) => () => measureJsEntry(extracted, work, budget.entryFile, budget.name, budget.ceilingGzip)
        ),
        ...NAMED_IMPORT_BUDGETS.map(
          (budget) => () =>
            measureNamedImport(
              extracted,
              work,
              budget.entryFile,
              budget.exportName,
              budget.name,
              budget.ceilingGzip
            )
        ),
      ],
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
