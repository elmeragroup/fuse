/**
 * This module holds the failures a designer can cause and fix, and tells them apart from bugs.
 * Each error keeps the message the plugin UI shows.
 *
 * Every one reaches a run's error channel as a failure. The kit check returns the file's and the
 * spec's as a `Result` before any planner reads them, so a throw in a planner is a defect.
 */

import * as Schema from "effect/Schema";

import type { KitContradiction } from "../../src/components/kit-check.ts";

/** The file lacks a collection, variable or mode the kit binds, or holds one of another type. */
export class FileNotSynced extends Schema.TaggedError<FileNotSynced>()("FileNotSynced", {
  message: Schema.String,
  /** The collection the kit looked in. */
  collection: Schema.String,
}) {}

/** The file holds two or more local collections with a name the kit binds. */
export class DuplicateCollections extends Schema.TaggedError<DuplicateCollections>()("DuplicateCollections", {
  message: Schema.String,
  /** The name the collections share. */
  collection: Schema.String,
  /** How many local collections have that name. */
  count: Schema.Finite,
}) {}

/** A parent holds copies of a layer key, or the keyed layer has the wrong node type. */
export class LayerConflict extends Schema.TaggedError<LayerConflict>()("LayerConflict", {
  message: Schema.String,
  /** The key the conflicting layers hold. */
  key: Schema.String,
}) {}

/** Figma's `FontName`: a family, a style and, for a variable font, its axis values. */
const FigmaFontName = Schema.Struct({
  family: Schema.String,
  style: Schema.String,
  variationSettings: Schema.optionalKey(Schema.Record(Schema.String, Schema.Finite)),
});

/** Figma cannot load a font the run writes, such as one this machine lacks. */
export class FontUnavailable extends Schema.TaggedError<FontUnavailable>()("FontUnavailable", {
  message: Schema.String,
  font: FigmaFontName,
  /** Why `figma.loadFontAsync` rejected. */
  cause: Schema.Unknown,
}) {}

/** The file lacks a kit page a request reads, such as a snapshot export before the first Apply. */
export class KitNotApplied extends Schema.TaggedError<KitNotApplied>()("KitNotApplied", {
  message: Schema.String,
  /** The page key the file lacks. */
  key: Schema.String,
}) {}

/**
 * A probe's Plan met a file that holds kit sets the probe lacks, such as one the whole kit was applied
 * to, where it would delete them.
 */
export class ProbeOverKit extends Schema.TaggedError<ProbeOverKit>()("ProbeOverKit", {
  message: Schema.String,
  /** The names of the sets the probe would delete. */
  sets: Schema.Array(Schema.String),
}) {}

/** The plugin UI posted a message the main thread does not handle. */
export class UnknownRequest extends Schema.TaggedError<UnknownRequest>()("UnknownRequest", {
  message: Schema.String,
}) {}

/** A failure the plugin reports to the designer. */
export type PluginError =
  | KitContradiction
  | FileNotSynced
  | DuplicateCollections
  | LayerConflict
  | FontUnavailable
  | KitNotApplied
  | ProbeOverKit
  | UnknownRequest;
