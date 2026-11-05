/**
 * The boundary between the announcement and its notes renderer's process: what part of the
 * changelog is read, the notes the renderer answers with, and the JSON both exchange, the request
 * on the process's standard input and the notes on its standard output.
 *
 * The announcement's process holds the step's secrets and loads this module, never the parser: the
 * renderer (`release-notes.ts`, `changelog-section.ts`, `section-packer.ts`) imports its types from
 * here, and this module imports nothing that reads Markdown.
 */

import { Schema } from "effect";

import { StableVersion } from "./release-record.ts";

/**
 * How many bytes of the changelog are read from git. Changesets writes the newest version first,
 * so the notes a release announces sit at the top; the first release, holding 250 changesets, is a
 * 172 KB section. Reading a bounded prefix keeps the cost flat as the changelog grows.
 */
export const READ_LIMIT = 512 * 1024;

/**
 * The part of a changelog that was read: all of it, or its first `READ_LIMIT` bytes when it is
 * longer. A prefix may end inside a line, even inside a character.
 */
export const Changelog = Schema.Union([
  Schema.TaggedStruct("Whole", { text: Schema.String }),
  Schema.TaggedStruct("Prefix", { text: Schema.String }),
]);

/** The part of a changelog that was read. */
export type Changelog = typeof Changelog.Type;

/** Slack's limit for a section's text (docs.slack.dev, Block Kit). */
export const SECTION_TEXT_LIMIT = 3000;

/**
 * Note sections a stable announcement shows before it links the full changelog. Four full
 * sections keep a large release readable and the message at eight blocks, under Slack's 50.
 */
export const NOTE_SECTION_LIMIT = 4;

/** Why notes that were shown are not the version's whole notes. */
export const ShortenedBy = Schema.Literals([
  /** The notes fill four sections before they end. */
  "section-limit",
  /** A link label or code span longer than a section was shortened, or a link's URL dropped. */
  "oversized-unit",
  /** The read part of the changelog ends inside the section. */
  "read-limit",
  /** Blocks or spans nested deeper than the renderer nests are shown flattened, without markup. */
  "nesting",
]);

/** Why notes that were shown are not the version's whole notes. */
export type ShortenedBy = typeof ShortenedBy.Type;

/** Whether the notes shown hold all of the version's notes. */
export const Extent = Schema.Union([
  Schema.TaggedStruct("Whole", {}),
  Schema.TaggedStruct("Shortened", { by: ShortenedBy }),
]);

/** Whether the notes shown hold all of the version's notes. */
export type Extent = typeof Extent.Type;

/** Why a version's notes could not be shown. */
export const UnreadableCause = Schema.Literals([
  /** micromark threw on the changelog. */
  "parse-failed",
  /** Rendering threw on the section. */
  "render-failed",
  /** Reading and rendering the notes took longer than their time limit. */
  "over-budget",
  /** The process that reads and renders the notes failed or answered with something else. */
  "renderer-failed",
  /** The process that reads and renders the notes answered with more than an answer can hold. */
  "answer-too-large",
]);

/** Why a version's notes could not be shown. */
export type UnreadableCause = typeof UnreadableCause.Type;

/** One version's notes, or why there are none to show. */
export const VersionNotes = Schema.Union([
  Schema.TaggedStruct("Notes", {
    /** At most four mrkdwn texts, each within Slack's 3000-character section limit; empty for a heading without notes. */
    sections: Schema.Array(Schema.String.check(Schema.isBetweenLength(1, SECTION_TEXT_LIMIT))).check(
      Schema.isMaxLength(NOTE_SECTION_LIMIT)
    ),
    extent: Extent,
  }),
  /** The changelog has no `## <version>` heading, or there is no changelog. */
  Schema.TaggedStruct("Missing", {}),
  /** The heading, if any, lies past the part of the changelog that is read. */
  Schema.TaggedStruct("BeyondReadLimit", {}),
  Schema.TaggedStruct("Unreadable", { cause: UnreadableCause }),
]);

/** One version's notes, or why there are none to show. */
export type VersionNotes = typeof VersionNotes.Type;

/** What the renderer's process is asked: a version's notes in a changelog. */
export const RenderRequest = Schema.fromJsonString(
  Schema.Struct({ version: StableVersion, changelog: Changelog })
);

/** What the renderer's process answers: the notes. */
export const RenderedNotes = Schema.fromJsonString(VersionNotes);
