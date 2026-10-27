/**
 * This module holds the failures `buildKit` reports, apart from `KitContradiction`, which the kit
 * check in `kit-check.ts` owns. Each keeps the message the build printed before it had types.
 *
 * The build's own checks return `KitSourceInvalid` as a `Result`, and `buildKit` lifts each where
 * it orchestrates. `runTool` turns a tool's rejection into `KitToolFailed`. The mapping throws
 * `KitUnmappable` from deep inside, and `mapSets` in `build-kit.ts` catches it in one place and
 * returns it as a `Result`.
 */

import { Data, Effect } from "effect";

import type { KitContradiction } from "./kit-check.ts";

/**
 * A recipe or a kit definition asks for a layer, part or property the build cannot map to Figma,
 * such as two labels that give one TEXT property two defaults. The mapping throws it from deep
 * inside the CSS cascade and the part mappers, class constructors and per-cell callbacks among
 * them, and `mapSets` in `build-kit.ts` returns it as a `Result`, so `buildKit` fails with it.
 */
export class KitUnmappable extends Data.TaggedError("KitUnmappable")<{
  readonly message: string;
}> {}

/**
 * A Fuse source the build reads lacks what the kit needs: the variable set, the theme catalog,
 * `fuse.css` or the icon roster.
 */
export class KitSourceInvalid extends Data.TaggedError("KitSourceInvalid")<{
  readonly message: string;
}> {}

/**
 * A tool the build runs, Tailwind or rolldown, failed for a reason the build does not classify, or
 * the file system refused the build's temporary directory.
 */
export class KitToolFailed extends Data.TaggedError("KitToolFailed")<{
  readonly message: string;
  readonly tool: "tailwindcss" | "rolldown" | "file system";
  readonly cause: unknown;
}> {}

/** A failure `buildKit` reports. */
export type KitBuildError = KitContradiction | KitUnmappable | KitSourceInvalid | KitToolFailed;

/**
 * Run a tool's promise as an Effect. A `KitSourceInvalid` the tool's callbacks threw keeps its
 * type, as the stylesheet loader `utility-css.ts` hands Tailwind does, and any other rejection
 * becomes `KitToolFailed` with the tool's own message.
 *
 * @param tool - The tool.
 * @param run - Starts the tool's work.
 * @returns The work as an Effect.
 */
export function runTool<A>(
  tool: KitToolFailed["tool"],
  run: () => Promise<A>
): Effect.Effect<A, KitSourceInvalid | KitToolFailed> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      cause instanceof KitSourceInvalid
        ? cause
        : new KitToolFailed({ message: cause instanceof Error ? cause.message : String(cause), tool, cause }),
  });
}
