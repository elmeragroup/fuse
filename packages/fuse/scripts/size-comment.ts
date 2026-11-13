// Prints the sticky PR size comment for the merge workflow's size-comment job:
//
//   node packages/fuse/scripts/size-comment.ts <pr-report.json> [<main-report.json>]
//
// The job runs it with plain `node` and no install, so it imports only `size-report.ts`.
import { readFileSync } from "node:fs";

import { parseSizeReport, renderSizeComment } from "./size-report.ts";
import type { SizeReport } from "./size-report.ts";

function readReport(path: string): SizeReport {
  const parsed = parseSizeReport(path, readFileSync(path, "utf8"));
  if (parsed._tag === "err") {
    console.error(parsed.error.message);
    process.exit(1);
  }
  return parsed.value;
}

const [headPath, basePath] = process.argv.slice(2);
if (headPath === undefined) {
  console.error("usage: size-comment.ts <pr-report.json> [<main-report.json>]");
  process.exit(1);
}
process.stdout.write(
  renderSizeComment(readReport(headPath), basePath === undefined ? undefined : readReport(basePath))
);
