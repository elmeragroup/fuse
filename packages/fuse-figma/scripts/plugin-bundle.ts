/**
 * Bundle the plugin's main thread with a kit inlined. `figma:plugin` writes the bundle to
 * `plugin/dist/code.js`, and the bundle load test runs it in a sandbox that holds only the
 * globals Figma provides.
 */

import { Effect, Schema } from "effect";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

import type { KitSpec } from "../src/components/kit-spec.ts";

const entry = fileURLToPath(new URL("../plugin/src/code.ts", import.meta.url));

/** Rolldown could not bundle the main thread, such as for an import it cannot resolve. */
export class BundleFailed extends Schema.TaggedError<BundleFailed>()("BundleFailed", {
  message: Schema.String,
}) {}

/**
 * Bundle `plugin/src/code.ts`. Figma runs the main thread as one classic script, so the bundle
 * is an IIFE with no imports, and the kit arrives as an inlined literal.
 *
 * @param kit - The kit the bundle reconciles.
 * @returns The bundle's code, or `BundleFailed` with rolldown's message.
 */
export const bundlePlugin = Effect.fn("bundlePlugin")(function* (kit: KitSpec) {
  const { output } = yield* Effect.tryPromise({
    try: () =>
      build({
        input: entry,
        platform: "neutral",
        transform: { define: { __FUSE_KIT__: JSON.stringify(kit) } },
        output: { format: "iife" },
        write: false,
      }),
    catch: (cause) =>
      new BundleFailed({
        message: `Rolldown could not bundle the plugin: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });
  const [chunk, ...rest] = output;
  if (rest.length > 0) {
    return yield* Effect.die(new Error(`Bundling the plugin made ${output.length} files instead of one.`));
  }
  return chunk.code;
});
