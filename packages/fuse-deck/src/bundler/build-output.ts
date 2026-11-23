/**
 * Where `build` may write. Vite empties its output directory before it writes, so `--out` must
 * never name the deck's sources or a directory the build does not own. The build owns the deck's
 * `dist`, a directory that does not exist or is empty, and a directory whose marker file says an
 * earlier `build` wrote it.
 *
 * The deck, its `slides/` and the output compare after resolving symlinks through the nearest
 * existing ancestor, so an alias such as macOS's `/tmp` for `/private/tmp`, or a `slides/` that links
 * elsewhere, cannot slip a source directory past the check. A directory that exists compares by its
 * device and inode, because on a volume that ignores case `Slides` names `slides/` and resolving
 * links keeps the spelling. Only the part of a path that does not exist yet compares by name.
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import path from "node:path";

import { SLIDES_DIR } from "../deck/deck-files.ts";

/** The file `build` leaves in its output directory, so a later build knows it may empty it. */
export const BUILD_MARKER = ".fuse-deck-build";

/** The output directory `build` uses when `--out` names none. */
export const DEFAULT_OUT = "dist";

/** `build --out` names a directory the build must not empty. */
export class BuildOutputRefused extends Schema.TaggedError<BuildOutputRefused>()("BuildOutputRefused", {
  message: Schema.String,
  hint: Schema.String,
  path: Schema.String,
}) {}

/** The output directory `build` may empty and write. */
export type BuildOutput = {
  /** The directory, absolute, with symlinks resolved. */
  readonly directory: string;
};

/**
 * Decide where `build` writes.
 *
 * @param root - The deck directory.
 * @param out - `--out`, relative to the deck or absolute.
 * @returns The output directory, or `BuildOutputRefused` when it holds the deck, holds `slides/` or
 *   sits inside it, or when it is a non-empty directory an earlier build did not write.
 */
export const resolveBuildOutput = Effect.fn("resolveBuildOutput")(function* (root: string, out: string) {
  const fs = yield* FileSystem.FileSystem;
  const deck = yield* locate(fs, root);
  const output = yield* locate(fs, path.resolve(root, out));
  const directory = output.path;
  const refuse = (reason: string, hint: string) =>
    new BuildOutputRefused({
      message: `build cannot write to ${directory}: ${reason}`,
      hint,
      path: directory,
    });

  const slides = yield* locate(fs, path.join(deck.path, SLIDES_DIR));
  if (holds(output, deck)) {
    return yield* refuse(
      "it holds the deck, and the build empties its output directory first.",
      `Pass a directory inside the deck, such as ${DEFAULT_OUT}, or one outside it.`
    );
  }
  if (holds(slides, output)) {
    return yield* refuse(
      "it is inside slides/, which holds the deck's sources.",
      `Pass a directory outside slides/, such as ${DEFAULT_OUT}.`
    );
  }
  if (holds(output, slides)) {
    return yield* refuse(
      "it holds slides/, which holds the deck's sources.",
      `Pass a directory that does not hold slides/, such as ${DEFAULT_OUT}.`
    );
  }
  if (directory === path.join(deck.path, DEFAULT_OUT)) {
    return { directory } satisfies BuildOutput;
  }
  const entries = yield* fs.readDirectory(directory).pipe(
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed<readonly string[]>([])
    ),
    Effect.mapError((error) => refuse(error.message, "Pass a directory the build can read and write."))
  );
  if (entries.length > 0 && !entries.includes(BUILD_MARKER)) {
    return yield* refuse(
      "it holds files that an earlier build did not write, and the build would delete them.",
      `Pass a new or empty directory, or ${DEFAULT_OUT}.`
    );
  }
  return { directory } satisfies BuildOutput;
});

/** Whether `child` is `parent` or a directory inside it. A name such as `..talk` is inside. */
function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return !path.isAbsolute(relative) && relative.split(path.sep)[0] !== "..";
}

/** A path as the guard compares it. */
type Located = {
  /** The path, with symlinks resolved through its nearest existing ancestor. */
  readonly path: string;
  /** The device and inode of the path, when it exists. */
  readonly identity: Option.Option<string>;
  /** The device and inode of each existing directory at or above the path. */
  readonly ancestors: readonly string[];
};

/** Whether `outer` is `inner` or a directory above it. */
function holds(outer: Located, inner: Located): boolean {
  return (
    isWithin(outer.path, inner.path) ||
    Option.exists(outer.identity, (identity) => inner.ancestors.includes(identity))
  );
}

/** `target` with symlinks resolved through its nearest existing ancestor, and the identities above it. */
function locate(fs: FileSystem.FileSystem, target: string): Effect.Effect<Located, BuildOutputRefused> {
  return Effect.gen(function* () {
    const missing: string[] = [];
    let existing = target;
    while (!(yield* fs.exists(existing))) {
      const parent = path.dirname(existing);
      if (parent === existing) {
        break;
      }
      missing.unshift(path.basename(existing));
      existing = parent;
    }
    const resolved = yield* fs.realPath(existing);
    const identities: Array<Option.Option<string>> = [];
    for (let directory = resolved; ; directory = path.dirname(directory)) {
      const info = yield* fs.stat(directory);
      // Without an inode the directory compares by name only; two unknown inodes never match.
      identities.push(Option.map(info.ino, (ino) => `${String(info.dev)}:${String(ino)}`));
      if (path.dirname(directory) === directory) {
        break;
      }
    }
    return {
      path: path.join(resolved, ...missing),
      identity: missing.length === 0 ? Option.flatten(Option.fromUndefinedOr(identities[0])) : Option.none(),
      ancestors: identities.flatMap(Option.toArray),
    } satisfies Located;
  }).pipe(
    Effect.mapError(
      (error: PlatformError.PlatformError) =>
        new BuildOutputRefused({
          message: `build cannot resolve ${target}: ${error.message}`,
          hint: "Pass a directory the build can read and write.",
          path: target,
        })
    )
  );
}
