/**
 * This module holds the failures a designer can cause and fix, and tells them apart from bugs.
 * Each error keeps the message the plugin UI shows. The errors extend `Data.TaggedError`, because the
 * plugin bundle imports no `Schema`.
 *
 * The structural walk fails with these errors in its error channel. The leaf planners stay
 * synchronous and throw them, and `failOnThrown` turns such a throw back into a typed failure.
 * Any other throw stays a defect.
 */

import { Data, Effect } from "effect";

import { KitContradiction } from "../../src/components/kit-check.ts";

/** The file lacks a collection, variable or mode the kit binds, or holds one of another type. */
export class FileNotSynced extends Data.TaggedError("FileNotSynced")<{
  readonly message: string;
  /** The collection the kit looked in. */
  readonly collection: string;
}> {}

/** The file holds two or more local collections with a name the kit binds. */
export class DuplicateCollections extends Data.TaggedError("DuplicateCollections")<{
  readonly message: string;
  /** The name the collections share. */
  readonly collection: string;
  /** How many local collections have that name. */
  readonly count: number;
}> {}

/** A parent holds copies of a layer key, or the keyed layer has the wrong node type. */
export class LayerConflict extends Data.TaggedError("LayerConflict")<{
  readonly message: string;
  /** The key the conflicting layers hold. */
  readonly key: string;
}> {}

/** Figma cannot load a font the run writes, such as one this machine lacks. */
export class FontUnavailable extends Data.TaggedError("FontUnavailable")<{
  readonly message: string;
  readonly font: FontName;
  /** Why `figma.loadFontAsync` rejected. */
  readonly cause: unknown;
}> {}

/** The file lacks a kit page a request reads, such as a snapshot export before the first Apply. */
export class KitNotApplied extends Data.TaggedError("KitNotApplied")<{
  readonly message: string;
  /** The page key the file lacks. */
  readonly key: string;
}> {}

/** The plugin UI posted a message the main thread does not handle. */
export class UnknownRequest extends Data.TaggedError("UnknownRequest")<{
  readonly message: string;
}> {}

/** A failure the plugin reports to the designer. */
export type PluginError =
  | KitContradiction
  | FileNotSynced
  | DuplicateCollections
  | LayerConflict
  | FontUnavailable
  | KitNotApplied
  | UnknownRequest;

/**
 * Whether a thrown value is a failure the plugin reports, rather than a bug. A `KitContradiction`
 * counts, since a hand-written spec can contradict itself.
 *
 * @param thrown - What the planning engine threw.
 * @returns True for one of this module's errors.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- rejection boundary: this classifies what a promise rejected with, which has no static type
function isPluginError(thrown: unknown): thrown is PluginError {
  return (
    thrown instanceof KitContradiction ||
    thrown instanceof FileNotSynced ||
    thrown instanceof DuplicateCollections ||
    thrown instanceof LayerConflict ||
    thrown instanceof FontUnavailable ||
    thrown instanceof KitNotApplied ||
    thrown instanceof UnknownRequest
  );
}

/**
 * Report a failure a planner threw as a typed error. The leaf planners stay synchronous and throw
 * the failures a designer can fix, such as a variable the file lacks, which an Effect sees as a
 * defect. This turns such a defect back into its error and leaves every other defect a defect.
 *
 * @param effect - The run.
 * @returns The run, failing with each plugin error a planner threw.
 */
export function failOnThrown<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | PluginError, R> {
  return Effect.catchDefect(effect, (defect) =>
    isPluginError(defect) ? Effect.fail(defect) : Effect.die(defect)
  );
}
