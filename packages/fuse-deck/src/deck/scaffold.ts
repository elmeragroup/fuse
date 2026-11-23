/**
 * `create`: a new deck directory with a manifest, a cover slide, the brief and an `AGENTS.md`.
 * The scaffold is deterministic: the same arguments write the same files, with no model call.
 *
 * A new directory appears whole: `create` writes the deck into a temporary sibling and renames it
 * into place. An existing empty directory gets `deck.json` last, so it never holds a deck that
 * `fuse-deck` finds before every file is there. A failure removes only the paths the call created,
 * and a call that loses a race to another `create` stops with `DeckDirectoryNotEmpty`.
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import { randomUUID } from "node:crypto";
import { rmdir } from "node:fs/promises";
import path from "node:path";

import { MANIFEST_FILE, SLIDES_DIR } from "./deck-files.ts";
import * as DeckManifest from "./deck-manifest.ts";
import { mdxText } from "./mdx-text.ts";
import { SlideId, slidePath } from "./slide-id.ts";

/** The theme a new deck gets when `create` names none. */
export const DEFAULT_THEME = "neutral-elma-private";

/** The id of the slide every new deck starts with. */
const COVER_ID = SlideId.make("cover");

/** `create` would write into a directory that already holds files. */
export class DeckDirectoryNotEmpty extends Schema.TaggedError<DeckDirectoryNotEmpty>()(
  "DeckDirectoryNotEmpty",
  {
    message: Schema.String,
    hint: Schema.String,
    path: Schema.String,
  }
) {}

/** `create` could not write the deck. */
export class ScaffoldFailed extends Schema.TaggedError<ScaffoldFailed>()("ScaffoldFailed", {
  message: Schema.String,
  path: Schema.String,
}) {}

/** What `create` writes a deck from. */
export type ScaffoldInput = {
  /** The new deck's directory. */
  readonly directory: string;
  /** What the talk is for, kept byte for byte in `BRIEF.md`. */
  readonly brief: Option.Option<string>;
  /** A Fuse theme slug. */
  readonly theme: string;
};

/** The deck `create` wrote. */
export type ScaffoldResult = {
  /** The deck directory, absolute. */
  readonly root: string;
  /** The files it wrote, relative to the deck. */
  readonly files: readonly string[];
};

/**
 * Write a new deck. The directory may exist only when it is empty.
 *
 * @param input - The directory, the brief and the theme.
 * @returns The deck's directory and files, `DeckDirectoryNotEmpty`, or `ScaffoldFailed`.
 */
export const scaffoldDeck = Effect.fn("scaffoldDeck")(function* (input: ScaffoldInput) {
  const fs = yield* FileSystem.FileSystem;
  const root = path.resolve(input.directory);
  const failed = (error: PlatformError.PlatformError) =>
    new ScaffoldFailed({ message: `Could not write the deck in ${root}: ${error.message}`, path: root });

  const notEmpty = new DeckDirectoryNotEmpty({
    message: `${root} is not empty.`,
    hint: "Pass a new directory, or an empty one.",
    path: root,
  });

  const entries = yield* fs.readDirectory(root).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(Option.none<readonly string[]>())
    ),
    Effect.mapError(failed)
  );
  if (Option.isSome(entries) && entries.value.length > 0) {
    return yield* notEmpty;
  }

  const title = titleFromDirectory(root);
  const files = new Map<string, string>([
    [
      MANIFEST_FILE,
      DeckManifest.formatManifest({
        title,
        theme: input.theme,
        density: "comfortable",
        aspect: "16:9",
        order: [COVER_ID],
      }),
    ],
    [slidePath(COVER_ID), coverSlide(title, input.brief)],
    ["AGENTS.md", agentsFile(title)],
    [".gitignore", ".fuse-deck/\ndist/\n"],
    ...Option.match(input.brief, {
      onNone: () => [],
      onSome: (brief): Array<[string, string]> => [["BRIEF.md", brief]],
    }),
  ]);
  // deck.json goes last, so a directory that holds it holds the whole deck.
  const ordered = [...files].sort(
    ([left], [right]) => Number(left === MANIFEST_FILE) - Number(right === MANIFEST_FILE)
  );
  if (Option.isSome(entries)) {
    yield* writeIntoEmpty(fs, root, ordered).pipe(
      Effect.mapError((error) => (error._tag === "PlatformError" ? failed(error) : notEmpty))
    );
  } else {
    const parent = path.dirname(root);
    const staging = path.join(parent, `.${path.basename(root)}.${randomUUID()}.tmp`);
    yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(failed));
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(staging);
      yield* writeIntoEmpty(fs, staging, ordered).pipe(
        Effect.catchTag("Claimed", () => Effect.fail(notEmpty))
      );
      // Another process may have filled the directory since the check; then the rename fails.
      yield* fs
        .rename(staging, root)
        .pipe(
          Effect.catch((error) =>
            Effect.flatMap(
              fs.exists(root),
              (taken): Effect.Effect<never, DeckDirectoryNotEmpty | PlatformError.PlatformError> =>
                taken ? Effect.fail(notEmpty) : Effect.fail(error)
            )
          )
        );
    }).pipe(
      Effect.onError(() => fs.remove(staging, { recursive: true, force: true }).pipe(Effect.ignore)),
      Effect.mapError((error) => (error._tag === "PlatformError" ? failed(error) : error))
    );
  }
  return { root, files: [...files.keys()] } satisfies ScaffoldResult;
});

/** Another `create`, or another process, wrote into the directory first. */
class Claimed extends Schema.TaggedError<Claimed>()("Claimed", {}) {}

/**
 * Write the deck into an existing empty directory. `slides/` and each file are created exclusively,
 * so when two calls race, the one that creates `slides/` first writes the deck and the other stops
 * with `Claimed` before it writes anything. A path counts as this call's from the moment it exists,
 * before any byte goes in, so a write that fails partway leaves no file behind. On any failure this
 * call removes only the paths it created, and `slides/` only while it is empty: `rmdir` checks that
 * and removes the directory in one step, so a file another writer adds in the meantime stays.
 */
function writeIntoEmpty(
  fs: FileSystem.FileSystem,
  root: string,
  ordered: ReadonlyArray<readonly [string, string]>
): Effect.Effect<void, Claimed | PlatformError.PlatformError> {
  const created: string[] = [];
  const slides = path.join(root, SLIDES_DIR);
  const claim = <A, R>(target: string, create: Effect.Effect<A, PlatformError.PlatformError, R>) =>
    create.pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "AlreadyExists",
        () => Effect.fail(new Claimed())
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          created.push(target);
        })
      )
    );
  return Effect.gen(function* () {
    yield* claim(slides, fs.makeDirectory(slides));
    for (const [file, text] of ordered) {
      const target = path.join(root, file);
      yield* Effect.scoped(
        Effect.flatMap(claim(target, fs.open(target, { flag: "wx" })), (handle) =>
          handle.writeAll(new TextEncoder().encode(text))
        )
      );
    }
  }).pipe(
    Effect.onError(() =>
      Effect.forEach(
        created.toReversed(),
        (target) =>
          target === slides
            ? Effect.promise(() => rmdir(slides).catch(() => undefined))
            : fs.remove(target).pipe(Effect.ignore),
        { concurrency: 1, discard: true }
      )
    )
  );
}

/** `my-talk` becomes `My talk`. */
function titleFromDirectory(root: string): string {
  const words = path
    .basename(root)
    .split(/[-_\s]+/)
    .filter((word) => word !== "");
  const sentence = words.join(" ");
  return sentence === "" ? "Untitled deck" : `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

function coverSlide(title: string, brief: Option.Option<string>): string {
  const subtitle = Option.flatMap(brief, (text) =>
    Option.fromUndefinedOr(text.split(/\r?\n/).find((line) => line.trim() !== ""))
  );
  return [
    "---",
    "layout: cover",
    "---",
    "",
    `# ${mdxText(title)}`,
    ...Option.match(subtitle, { onNone: () => [], onSome: (line) => ["", mdxText(line)] }),
    "",
  ].join("\n");
}

function agentsFile(title: string): string {
  return `# ${title}

This directory is a fuse-deck presentation. \`BRIEF.md\`, when present, says what the talk is for.

Start with \`fuse-deck describe --json\`. It lists the layouts, the components a slide can use without
an import, the frontmatter keys, the deck settings and every command. Its \`skill\` field is the
absolute path of the skill that ships with fuse-deck; open that file for the workflow.

- Write each slide in \`slides/<id>.mdx\`. Its first heading is its title.
- Add, move and remove slides with \`fuse-deck slides\`, so \`deck.json\` and the files stay in step.
- Run \`fuse-deck check --json\` after each change. It exits 1 and lists each problem when the deck is
  broken.
- \`fuse-deck dev\` serves the deck with live reload; \`fuse-deck build\` writes it to \`dist/\`.
`;
}
