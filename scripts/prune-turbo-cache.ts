import { Schema } from "effect";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Turbo never evicts its local cache, and CI saves that directory between runs. Keeping only
 * the entries the last run hit or wrote holds the saved cache near one run's outputs instead
 * of every run's. Run it after `turbo run` with `TURBO_RUN_SUMMARY=true`.
 *
 * Usage: node scripts/prune-turbo-cache.ts <cache dir> <runs dir>
 */

/** A cache entry is `<task hash>.tar.zst` plus `<task hash>-<kind>.json` sidecars. */
const ENTRY = /^([0-9a-f]{16})(?:\.tar\.zst|-[a-z]+\.json)$/u;

/** Cache files that no kept hash owns. Files outside the entry naming stay untouched. */
export function staleCacheFiles(files: readonly string[], keep: ReadonlySet<string>): string[] {
  return files.filter((file) => {
    const hash = ENTRY.exec(file)?.[1];
    return hash !== undefined && !keep.has(hash);
  });
}

/** The part of turbo's run summary this script reads. */
const RunSummary = Schema.Struct({ tasks: Schema.Array(Schema.Struct({ hash: Schema.String })) });

/** Every task hash recorded by the run summaries in `runsDir`. */
export function summarizedHashes(runsDir: string): Set<string> {
  const hashes = new Set<string>();
  for (const file of readdirSync(runsDir).filter((name) => name.endsWith(".json"))) {
    let summary: typeof RunSummary.Type;
    try {
      summary = Schema.decodeUnknownSync(Schema.fromJsonString(RunSummary))(
        readFileSync(join(runsDir, file), "utf8")
      );
    } catch (error) {
      throw new Error(`${file} is not a turbo run summary`, { cause: error });
    }
    for (const task of summary.tasks) {
      hashes.add(task.hash);
    }
  }
  return hashes;
}

function main([cacheDir, runsDir]: readonly (string | undefined)[]): void {
  if (cacheDir === undefined || runsDir === undefined) {
    throw new Error("Usage: node scripts/prune-turbo-cache.ts <cache dir> <runs dir>");
  }
  const keep = summarizedHashes(runsDir);
  // An empty summary set would delete the whole cache; that means the run never summarized.
  if (keep.size === 0) {
    throw new Error(`No task hashes in ${runsDir}; was TURBO_RUN_SUMMARY set?`);
  }
  const stale = staleCacheFiles(readdirSync(cacheDir), keep);
  for (const file of stale) {
    rmSync(join(cacheDir, file), { force: true });
  }
  console.log(`kept ${String(keep.size)} task hashes, removed ${String(stale.length)} cache files`);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
