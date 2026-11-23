/**
 * This module holds the failures `buildKit` reports, apart from `KitContradiction`, which the kit
 * check in `kit-check.ts` owns. Each keeps the message the build printed before it had types.
 *
 * The build's own checks return `KitSourceInvalid` as a `Result`, and `buildKit` lifts each where
 * it orchestrates. `runTool` turns a tool's rejection into `KitToolFailed`. The mapping throws
 * `KitUnmappable` from deep inside, and `caughtUnmappable` in `build-kit.ts` catches it in one place
 * and returns it as a `Result`.
 */

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { KitContradiction } from "./kit-check.ts";

/**
 * A recipe or a kit definition asks for a layer, part or property the build cannot map to Figma,
 * such as two labels that give one TEXT property two defaults. The mapping throws it from deep
 * inside the CSS cascade and the part mappers, class constructors and per-cell callbacks among
 * them, and `caughtUnmappable` in `build-kit.ts` returns it as a `Result`, so `buildKit` fails with it.
 */
export class KitUnmappable extends Schema.TaggedError<KitUnmappable>()("KitUnmappable", {
  message: Schema.String,
}) {}

/**
 * A Fuse source the build reads lacks what the kit needs: the variable set, the theme catalog,
 * `fuse.css`, the icon roster or a component's docs page.
 */
export class KitSourceInvalid extends Schema.TaggedError<KitSourceInvalid>()("KitSourceInvalid", {
  message: Schema.String,
}) {}

/**
 * A tool the build runs, Tailwind or rolldown, failed for a reason the build does not classify, or
 * the file system refused the build's temporary directory.
 */
export class KitToolFailed extends Schema.TaggedError<KitToolFailed>()("KitToolFailed", {
  message: Schema.String,
  tool: Schema.Literals(["tailwindcss", "rolldown", "file system"]),
  cause: Schema.Unknown,
}) {}

/** A failure `buildKit` reports. */
export type KitBuildError = KitContradiction | KitUnmappable | KitSourceInvalid | KitToolFailed;

/** A probe, `figma:plugin --sets`, names a set the registry does not hold. */
export class ProbeSetUnknown extends Schema.TaggedError<ProbeSetUnknown>()("ProbeSetUnknown", {
  message: Schema.String,
  set: Schema.String,
}) {}

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
      Schema.is(KitSourceInvalid)(cause)
        ? cause
        : new KitToolFailed({ message: cause instanceof Error ? cause.message : String(cause), tool, cause }),
  });
}
