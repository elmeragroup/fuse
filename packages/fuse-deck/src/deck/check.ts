/**
 * `check`: everything that keeps a deck from building, reported at once. A deck whose `deck.json`
 * does not decode fails before the slides are read.
 */

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { DeckFiles } from "./deck-files.ts";
import { slidePath } from "./slide-id.ts";
import { parseSlideSource } from "./slide-source.ts";

/** One thing wrong with a deck. */
export const CheckProblem = Schema.Union([
  Schema.TaggedStruct("DanglingSlide", {
    message: Schema.String,
    hint: Schema.String,
    id: Schema.String,
  }),
  Schema.TaggedStruct("OrphanSlide", {
    message: Schema.String,
    hint: Schema.String,
    path: Schema.String,
  }),
  Schema.TaggedStruct("InvalidFrontmatter", {
    message: Schema.String,
    hint: Schema.String,
    id: Schema.String,
  }),
]);

/** One thing wrong with a deck. */
export type CheckProblem = typeof CheckProblem.Type;

/** How far `check` could check the deck's theme. */
export type ThemeStatus = "unvalidated";

/** A deck `check` found nothing wrong with. */
export type CheckReport = {
  /** How many slides the order holds. */
  readonly slides: number;
  /** How far the theme was checked. */
  readonly theme: ThemeStatus;
};

/** `check` found problems. */
export class DeckCheckFailed extends Schema.TaggedError<DeckCheckFailed>()("DeckCheckFailed", {
  message: Schema.String,
  hint: Schema.String,
  problems: Schema.Array(CheckProblem),
}) {}

/**
 * Check the deck: dangling ids, orphan files and each slide's frontmatter.
 *
 * @returns The report, or `DeckCheckFailed` listing every problem.
 */
export const checkDeck = Effect.fn("checkDeck")(function* () {
  const deck = yield* DeckFiles;
  const loaded = yield* deck.load;
  const problems: CheckProblem[] = [];

  for (const id of loaded.dangling) {
    problems.push({
      _tag: "DanglingSlide",
      message: `deck.json names ${id}, but ${slidePath(id)} does not exist.`,
      hint: `Restore the file, or run \`fuse-deck slides remove ${id}\`.`,
      id,
    });
  }
  for (const path of loaded.orphans) {
    problems.push({
      _tag: "OrphanSlide",
      message: `${path} is not in deck.json's order, so the deck never shows it.`,
      hint: "Delete it if the deck does not need it. To keep it, move it out of slides/, run `fuse-deck slides add <id>`, and copy its content into the new file.",
      path,
    });
  }
  for (const { id } of loaded.slides) {
    if (loaded.dangling.includes(id)) {
      continue;
    }
    const source = parseSlideSource(id, yield* deck.readSlide(id));
    if (Result.isFailure(source)) {
      problems.push({
        _tag: "InvalidFrontmatter",
        message: source.failure.message,
        hint: source.failure.hint,
        id,
      });
    }
  }

  if (problems.length > 0) {
    return yield* new DeckCheckFailed({
      message: `The deck has ${problems.length === 1 ? "1 problem" : `${String(problems.length)} problems`}.`,
      hint: "Fix each problem, then run `fuse-deck check` again.",
      problems,
    });
  }
  return { slides: loaded.slides.length, theme: "unvalidated" } satisfies CheckReport;
});
