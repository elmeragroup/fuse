/**
 * What the announcement and its notes renderer's process exchange, as JSON: the request on the
 * process's standard input and the notes on its standard output.
 */

import { Schema } from "effect";

import { ChangelogData } from "./changelog-section.ts";
import { VersionNotes } from "./release-notes.ts";
import { StableVersion } from "./release-record.ts";

/** What the renderer's process is asked: a version's notes in a changelog. */
export const RenderRequest = Schema.fromJsonString(
  Schema.Struct({ version: StableVersion, changelog: ChangelogData })
);

/** What the renderer's process answers: the notes. */
export const RenderedNotes = Schema.fromJsonString(VersionNotes);
