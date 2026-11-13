/**
 * The Turbopack loader that turns on Live code for the component pages' demos.
 *
 * `next.config.ts` runs it on the modules `isLiveCodeDemo` names, in `next dev`, `next build` and
 * `build:e2e` alike. It reads the settable props of every part from the committed `api.json`
 * files and hands them to `lensDemoSource`, which rewrites the demo. Each file the answers came
 * from is a dependency of the demo, so a regenerated artifact recompiles it, also from Turbopack's
 * persistent cache. Node runs it by stripping types, so it and the modules it imports use erasable
 * syntax and `.ts` specifiers.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { openLiveCodeSchemas } from "./lib/live-code-schemas.ts";
import { lensDemoSource } from "./lib/live-code-transform.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const lensModule = path.join(here, "../src/components/live-code/lens.tsx");

/** The loader context fields this loader uses. */
type LoaderContext = {
  readonly resourcePath: string;
  /** Recompiles the module when `file` changes. */
  addDependency(file: string): void;
};

/**
 * Rewrites one demo for Live code, or returns it unchanged.
 *
 * @param source - The demo module's source.
 * @returns The module Turbopack compiles.
 */
export default function liveCodeLoader(this: LoaderContext, source: string): string {
  const specifier = path.relative(path.dirname(this.resourcePath), lensModule).split(path.sep).join("/");
  const schemas = openLiveCodeSchemas();
  const out = lensDemoSource(
    source,
    schemas.schemaOf,
    specifier.startsWith(".") ? specifier : `./${specifier}`
  );
  for (const file of schemas.files()) this.addDependency(file);
  return out ?? source;
}
