/**
 * This module holds the failures a designer can cause and fix, and tells them apart from bugs.
 * Each error keeps the message the plugin UI shows. The errors extend `Data.TaggedError`, because the
 * plugin bundle imports no `Schema`.
 *
 * The planning engine still throws. `attempt` runs it and keeps these errors as typed failures,
 * so any other throw stays a defect.
 */

import { Data, Effect } from "effect";

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

/** The plugin UI posted a message the main thread does not handle. */
export class UnknownRequest extends Data.TaggedError("UnknownRequest")<{
  readonly message: string;
}> {}

/** A failure the plugin reports to the designer. */
export type PluginError =
  | FileNotSynced
  | DuplicateCollections
  | LayerConflict
  | FontUnavailable
  | UnknownRequest;

/**
 * Whether a thrown value is a failure the plugin reports, rather than a bug.
 *
 * @param thrown - What the planning engine threw.
 * @returns True for one of this module's errors.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- rejection boundary: this classifies what a promise rejected with, which has no static type
function isPluginError(thrown: unknown): thrown is PluginError {
  return (
    thrown instanceof FileNotSynced ||
    thrown instanceof DuplicateCollections ||
    thrown instanceof LayerConflict ||
    thrown instanceof FontUnavailable ||
    thrown instanceof UnknownRequest
  );
}

/**
 * Run promise-based plugin code as an Effect. A rejection with one of this module's errors fails
 * the Effect with it, and any other rejection is a defect.
 *
 * `run` takes no argument on purpose. Effect makes an `AbortController` for a callback that declares
 * a parameter, and the plugin does not count on Figma's main thread to provide one. The bundle load
 * test runs without it.
 *
 * @param run - Starts the work.
 * @returns The work as an Effect.
 */
export function attempt<A>(run: () => Promise<A>): Effect.Effect<A, PluginError> {
  return Effect.tryPromise({ try: run, catch: (thrown) => thrown }).pipe(
    Effect.catchIf(isPluginError, Effect.fail, Effect.die)
  );
}
