/**
 * The Turbopack loader that turns on Live code for the component pages' demos.
 *
 * `next.config.ts` runs it on `src/app/(docs)/components/<slug>/demos/*.tsx`, in `next dev`,
 * `next build` and `build:e2e` alike. It reads the settable props of every part from the committed
 * `api.json` files and hands them to `lensDemoSource`, which rewrites the demo. Node runs it by
 * stripping types, so it and the modules it imports use erasable syntax and `.ts` specifiers.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { liveCodeSchemaOf } from "./lib/live-code-schemas.ts";
import { lensDemoSource } from "./lib/live-code-transform.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const lensModule = path.join(here, "../src/components/live-code/lens.tsx");

/** The loader context fields this loader reads. */
type LoaderContext = { readonly resourcePath: string };

/**
 * Rewrites one demo for Live code, or returns it unchanged.
 *
 * @param source - The demo module's source.
 * @returns The module Turbopack compiles.
 */
export default function liveCodeLoader(this: LoaderContext, source: string): string {
  const specifier = path.relative(path.dirname(this.resourcePath), lensModule).split(path.sep).join("/");
  return (
    lensDemoSource(source, liveCodeSchemaOf, specifier.startsWith(".") ? specifier : `./${specifier}`) ??
    source
  );
}
