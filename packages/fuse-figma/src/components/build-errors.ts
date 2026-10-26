/**
 * This module holds the failures `buildKit` reports, apart from `KitContradiction`, which the kit
 * check in `kit-check.ts` owns. Each keeps the message the build printed before it had types.
 *
 * The mapping functions stay pure and throw these where a recipe, a kit definition or a Fuse
 * source asks for something the build cannot draw. `buildKit` turns such a throw into a typed
 * failure with `failOnThrownBuildErrors`. A throw of a plain `Error` marks a broken invariant of
 * the builder itself and stays a defect.
 */

import { Data, Effect } from "effect";

import { KitContradiction } from "./kit-check.ts";

/** A recipe or a kit definition asks for a layer, part or property the build cannot map to Figma. */
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

/** A tool the build runs, Tailwind or rolldown, failed for a reason the build does not classify. */
export class KitToolFailed extends Data.TaggedError("KitToolFailed")<{
  readonly message: string;
  readonly tool: "tailwindcss" | "rolldown";
  readonly cause: unknown;
}> {}

/** A failure `buildKit` reports. */
export type KitBuildError = KitContradiction | KitUnmappable | KitSourceInvalid | KitToolFailed;

/**
 * Whether a thrown value is a failure the build reports, rather than a bug of the builder.
 *
 * @param thrown - What a mapping function or a tool threw.
 * @returns True for one of the build's errors.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- throw boundary: this classifies what a mapping function or a tool threw, which has no static type
export function isKitBuildError(thrown: unknown): thrown is KitBuildError {
  return (
    thrown instanceof KitContradiction ||
    thrown instanceof KitUnmappable ||
    thrown instanceof KitSourceInvalid ||
    thrown instanceof KitToolFailed
  );
}

/**
 * Report a failure a pure mapping function threw as a typed error, and leave every other defect a
 * defect.
 *
 * @param effect - The build.
 * @returns The build, failing with each build error a mapping function threw.
 */
export function failOnThrownBuildErrors<A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | KitBuildError, R> {
  return Effect.catchDefect(effect, (defect) =>
    isKitBuildError(defect) ? Effect.fail(defect) : Effect.die(defect)
  );
}

/**
 * Run a tool's promise as an Effect. A build error the tool's callbacks threw keeps its type, and
 * any other rejection becomes `KitToolFailed` with the tool's own message.
 *
 * @param tool - The tool.
 * @param run - Starts the tool's work.
 * @returns The work as an Effect.
 */
export function runTool<A>(
  tool: KitToolFailed["tool"],
  run: () => Promise<A>
): Effect.Effect<A, KitBuildError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      isKitBuildError(cause)
        ? cause
        : new KitToolFailed({ message: cause instanceof Error ? cause.message : String(cause), tool, cause }),
  });
}
