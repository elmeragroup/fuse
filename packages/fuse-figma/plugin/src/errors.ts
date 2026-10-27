/**
 * This module holds the failures a designer can cause and fix, and tells them apart from bugs.
 * Each error keeps the message the plugin UI shows. The errors extend `Data.TaggedError`, because the
 * plugin bundle imports no `Schema`.
 *
 * Every one reaches a run's error channel as a failure. The kit check returns the file's and the
 * spec's as a `Result` before any planner reads them, so a throw in a planner is a defect.
 */

import { Data } from "effect";

import type { KitContradiction } from "../../src/components/kit-check.ts";

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
