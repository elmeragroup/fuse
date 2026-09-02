/**
 * Reviews or rewrites `test/api-shadow.snapshot.json`.
 *
 *   node scripts/api-shadow-snapshot.ts            # report drift, exit 1 when any
 *   node scripts/api-shadow-snapshot.ts --update   # accept the measured differences
 */

import {
  readShadowSnapshot,
  reviewAgainstSnapshot,
  runDocsShadowComparison,
  shadowSnapshotFile,
} from "./lib/api-shadow.ts";
import { nodeDocsWriter } from "./lib/docs-writer.ts";

const update = process.argv.includes("--update");
const report = await runDocsShadowComparison({
  writer: nodeDocsWriter,
  persistSnapshot: update,
});
if (update) {
  console.log(`wrote ${shadowSnapshotFile}: ${JSON.stringify(report.summary)}`);
} else {
  const review = reviewAgainstSnapshot(
    report.apiDifferences,
    report.problemDifferences,
    readShadowSnapshot()
  );
  if (review.unexplained.length === 0 && review.stale.length === 0) {
    console.log(`shadow snapshot is current: ${JSON.stringify(report.summary)}`);
  } else {
    for (const key of review.unexplained) console.error(`unexplained: ${key}`);
    for (const key of review.stale) console.error(`stale: ${key}`);
    console.error("run `pnpm run shadow:update` after reviewing the differences above");
    process.exitCode = 1;
  }
}
