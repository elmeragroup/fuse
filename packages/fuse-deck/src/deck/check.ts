/**
 * `check`: everything that keeps a deck from building, reported at once. A deck whose `deck.json`
 * does not decode fails before the slides are read.
 */

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Bundler } from "../bundler/bundler.ts";
import { DeckFiles } from "./deck-files.ts";
import { slidePath } from "./slide-id.ts";

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
  Schema.TaggedStruct("SlideCompileFailed", {
    message: Schema.String,
    hint: Schema.String,
    id: Schema.String,
    line: Schema.optional(Schema.Finite),
    column: Schema.optional(Schema.Finite),
  }),
  Schema.TaggedStruct("InvalidTheme", {
    message: Schema.String,
    hint: Schema.String,
    theme: Schema.String,
  }),
]);

/** One thing wrong with a deck. */
export type CheckProblem = typeof CheckProblem.Type;

/** A deck `check` found nothing wrong with. */
export type CheckReport = {
  /** How many slides the order holds. */
  readonly slides: number;
  /** How many steps the slides hold in all. */
  readonly steps: number;
  /** The deck's theme, which Fuse accepted. */
  readonly theme: string;
};

/** `check` found problems. */
export class DeckCheckFailed extends Schema.TaggedError<DeckCheckFailed>()("DeckCheckFailed", {
  message: Schema.String,
  hint: Schema.String,
  problems: Schema.Array(CheckProblem),
}) {}

/**
 * Check the deck: dangling ids, orphan files, each slide's frontmatter, each slide's compile
 * through the deck's MDX pipeline, and the theme against Fuse.
 *
 * @returns The report, or `DeckCheckFailed` listing every problem.
 */
export const checkDeck = Effect.fn("checkDeck")(function* () {
  const deck = yield* DeckFiles;
  const bundler = yield* Bundler;
  const loaded = yield* deck.load;
  const problems: CheckProblem[] = [];
  let steps = 0;

  const theme = yield* Effect.result(bundler.firstPaint(loaded.manifest));
  if (Result.isFailure(theme)) {
    if (theme.failure._tag !== "InvalidTheme") {
      return yield* theme.failure;
    }
    problems.push({
      _tag: "InvalidTheme",
      message: theme.failure.message,
      hint: theme.failure.hint,
      theme: theme.failure.theme,
    });
  }

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
    const compiled = yield* Effect.result(bundler.compile(id, yield* deck.readSlide(id)));
    if (Result.isSuccess(compiled)) {
      steps += compiled.success.metadata.steps;
    } else if (compiled.failure._tag === "SlideFrontmatterInvalid") {
      const { message, hint } = compiled.failure;
      problems.push({ _tag: "InvalidFrontmatter", message, hint, id });
    } else {
      const { message, hint, line, column } = compiled.failure;
      problems.push({ _tag: "SlideCompileFailed", message, hint, id, line, column });
    }
  }

  if (problems.length > 0) {
    return yield* new DeckCheckFailed({
      message: `The deck has ${problems.length === 1 ? "1 problem" : `${String(problems.length)} problems`}.`,
      hint: "Fix each problem, then run `fuse-deck check` again.",
      problems,
    });
  }
  return { slides: loaded.slides.length, steps, theme: loaded.manifest.theme } satisfies CheckReport;
});
