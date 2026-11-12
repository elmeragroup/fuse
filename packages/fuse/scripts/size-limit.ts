// Measures the packed tarball's gzip sizes against `size-budgets.ts` and writes the size report
// the merge workflow's PR comment reads. Run it through turbo (`turbo run size-limit`), which
// packs first; a direct run measures whatever tarball `.artifacts/` holds.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { rolldown } from "rolldown";
import type { RolldownBuild } from "rolldown";

import { discoverEntries, publishExportTarget, PUBLISHED_PEER_RANGES } from "./entries.ts";
import { packageRootFromScript } from "./paths.ts";
import { BUDGETS_MEASURED_ON, ceilingFor, MEASURED_GZIP } from "./size-budgets.ts";
import { isBreach, SIZE_REPORT_SCHEMA } from "./size-report.ts";
import type { SizeEntry, SizeEntryKind, SizeReport } from "./size-report.ts";
import { ARTIFACTS_DIR, fail, withExtractedTarballAsync } from "./tarball.ts";

/** Where the report lands, beside the tarball it measures. The turbo task caches it as output. */
const REPORT_FILE = "size-report.json";

/**
 * Named imports measured on their own, because a consumer importing one of them must not pay for
 * the rest of its entry. The whole `icons` entry is never measured: consumers only import icons
 * by name.
 */
const NAMED_IMPORTS = [
  { subpath: ".", exportName: "Button" },
  { subpath: "icons", exportName: "Check" },
  { subpath: "chart", exportName: "Chart" },
  { subpath: "chart", exportName: "PieChart" },
  { subpath: "chart", exportName: "RadialChart" },
  { subpath: "chart", exportName: "RadarChart" },
  { subpath: "chart", exportName: "ClockChart" },
  { subpath: "chart", exportName: "ScatterChart" },
  { subpath: "chart", exportName: "Sparkline" },
] as const;

const UNMEASURED_WHOLE_ENTRIES = new Set(["icons"]);

/** Every published peer, plus the JSX runtime subpaths of the `react` peer, which bundles exclude. */
const PEER_EXTERNALS = [...Object.keys(PUBLISHED_PEER_RANGES), "react/jsx-runtime", "react/jsx-dev-runtime"];

/** One bundle to measure: a packed entry whole, or one named export of it. */
type BundleTarget = {
  readonly name: string;
  readonly kind: Extract<SizeEntryKind, "entry" | "named-import">;
  readonly entryFile: string;
  readonly exportName?: string;
};

function namedImportName(subpath: string, exportName: string): string {
  return subpath === "." ? `${exportName} from the root barrel` : `${exportName} from ${subpath}`;
}

function bundleTargets(packageRoot: string): BundleTarget[] {
  const entryFiles = new Map(
    discoverEntries(packageRoot).jsEntries.map((entry) => [
      entry.subpath,
      publishExportTarget(entry).import.replace(/^\.\//u, ""),
    ])
  );
  const entryFile = (subpath: string): string => {
    const file = entryFiles.get(subpath);
    if (file === undefined) {
      throw new Error(`No published JS entry ${subpath}`);
    }
    return file;
  };
  return [
    ...[...entryFiles]
      .filter(([subpath]) => !UNMEASURED_WHOLE_ENTRIES.has(subpath))
      .map(([subpath, file]): BundleTarget => ({ name: subpath, kind: "entry", entryFile: file })),
    ...NAMED_IMPORTS.map(({ subpath, exportName }): BundleTarget => ({
      name: namedImportName(subpath, exportName),
      kind: "named-import",
      entryFile: entryFile(subpath),
      exportName,
    })),
  ];
}

function gzipSize(bytes: Uint8Array): number {
  return gzipSync(bytes).byteLength;
}

/**
 * Bundles one target in-process through rolldown, as a consumer's minified browser build would,
 * and gzips the single chunk in memory. One bundle per target keeps every size attributable.
 */
async function measureBundle(extracted: string, work: string, target: BundleTarget): Promise<number> {
  const entry = join(extracted, target.entryFile);
  if (!existsSync(entry)) {
    throw new Error(`Packed entry ${target.name} is missing ${target.entryFile}`);
  }
  let input = entry;
  if (target.exportName !== undefined) {
    input = join(work, `${target.name.replaceAll(/[^\w-]/gu, "-")}.js`);
    writeFileSync(input, `export { ${target.exportName} } from ${JSON.stringify(entry)};\n`);
  }
  let bundle: RolldownBuild | undefined;
  try {
    bundle = await rolldown({
      input,
      platform: "browser",
      external: PEER_EXTERNALS,
      // Rolldown leaves an unresolved import external, which would silently shrink the bundle.
      onLog(_level, log) {
        if (log.code === "UNRESOLVED_IMPORT") {
          throw new Error(log.message);
        }
      },
    });
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const chunks = output.filter((file) => file.type === "chunk");
    const [chunk] = chunks;
    if (chunks.length !== 1 || chunk === undefined) {
      throw new Error(`expected one chunk, got ${String(chunks.length)}`);
    }
    return gzipSize(Buffer.from(chunk.code));
  } catch (error) {
    throw new Error(
      `rolldown failed for ${target.name}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      }
    );
  } finally {
    await bundle?.close();
  }
}

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

/** The recorded measurements, keyed by row name. */
const RECORDED = new Map<string, number>(Object.entries(MEASURED_GZIP));

function budgeted(name: string, kind: SizeEntryKind, gzipBytes: number): SizeEntry {
  const measured = RECORDED.get(name);
  return { name, kind, gzipBytes, ceilingBytes: measured === undefined ? null : ceilingFor(measured) };
}

async function measureAll(packageRoot: string): Promise<SizeEntry[]> {
  const targets = bundleTargets(packageRoot);
  const css = discoverEntries(packageRoot).cssEntries.map((entry) => entry.publishFile);
  return withExtractedTarballAsync(packageRoot, "fuse-size-", async ({ extracted, scratch }) => {
    const work = join(scratch, "work");
    mkdirSync(work);
    // Rolldown parallelizes inside each build, so fewer bundles than cores run at once.
    const bundles = await mapConcurrent(
      targets.map(
        (target) => async () =>
          budgeted(target.name, target.kind, await measureBundle(extracted, work, target))
      ),
      Math.max(1, Math.floor(availableParallelism() / 2))
    );
    const stylesheets = css.map((file) => {
      const path = join(extracted, file);
      if (!existsSync(path)) {
        throw new Error(`Packed CSS ${file} is missing`);
      }
      return budgeted(file, "css", gzipSize(readFileSync(path)));
    });
    return [...bundles, ...stylesheets];
  });
}

function describe(entry: SizeEntry): string {
  const size = `${entry.name}: ${String(entry.gzipBytes)} gzip bytes`;
  if (entry.ceilingBytes === null) {
    return `${size}, NO BUDGET: add \`${JSON.stringify(entry.name)}: ${String(entry.gzipBytes)}\` to size-budgets.ts`;
  }
  const verdict = entry.gzipBytes > entry.ceilingBytes ? "OVER" : "ok";
  return `${size} (ceiling ${String(entry.ceilingBytes)}, recorded ${String(RECORDED.get(entry.name))}) ${verdict}`;
}

try {
  const packageRoot = packageRootFromScript(import.meta.url);
  const entries = await measureAll(packageRoot);
  const report: SizeReport = { schema: SIZE_REPORT_SCHEMA, entries };
  const reportPath = join(packageRoot, ARTIFACTS_DIR, REPORT_FILE);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Budgets recorded on ${BUDGETS_MEASURED_ON}; ceiling = recorded × 1.05, at least +512 bytes.`);
  for (const entry of entries) {
    console.log(describe(entry));
  }
  const measured = new Set(entries.map((entry) => entry.name));
  const problems = [
    ...entries.filter(isBreach).map(describe),
    ...[...RECORDED.keys()]
      .filter((name) => !measured.has(name))
      .map((name) => `${name}: recorded in size-budgets.ts but no longer measured; remove its row`),
  ];
  if (problems.length > 0) {
    fail(`size-limit failed:\n${problems.join("\n")}`);
  }
  console.log(`size-limit passed (${String(entries.length)} entries)`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
