/**
 * Removes every markdown file under `public/` that `src/generated/catalog.json` names no twin for.
 *
 * Generation prunes the same files, but turbo skips generation on a cache hit and restores only
 * the current outputs, so a twin an earlier run wrote for a since renamed route would stay on
 * disk and Next would serve it. The `reconcile-markdown` task runs this uncached before Next
 * builds or serves (`turbo.json`), and the `start` script runs it before `next start`.
 */

import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";

import { Catalog } from "@elmeragroup/docs-catalog";

import { markdownTwinFiles, pruneUnwrittenMarkdown } from "./lib/markdown-pruning.ts";
import { catalogFile, publicDir } from "./lib/paths.ts";

/** The generated catalog could not be read or decoded, so no markdown was removed. */
class CatalogUnreadable extends Schema.TaggedError<CatalogUnreadable>()("CatalogUnreadable", {
  message: Schema.String,
}) {}

/** The failure of reading `file`, as the script reports it. */
function catalogUnreadable(file: string, cause: unknown): CatalogUnreadable {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return new CatalogUnreadable({
    message: `docs: ${file} is unreadable, so no markdown was removed: ${reason}`,
  });
}

const reconcile = Effect.gen(function* () {
  const text = yield* Effect.try({
    try: () => readFileSync(catalogFile, "utf8"),
    catch: (cause) => catalogUnreadable(catalogFile, cause),
  });
  const catalog = yield* Schema.decodeEffect(Schema.fromJsonString(Catalog))(text).pipe(
    Effect.mapError((cause) => catalogUnreadable(catalogFile, cause))
  );
  yield* Effect.sync(() => pruneUnwrittenMarkdown(publicDir, markdownTwinFiles(catalog)));
});

const exit = await Effect.runPromiseExit(reconcile);
if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
  process.exitCode = 1;
}
