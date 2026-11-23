/**
 * Where Vite keeps the deck's optimized dependencies. Vite keys that cache by its config and by the
 * lockfile it finds at or above the deck. The deck's dependencies come from fuse-deck's install,
 * which may sit anywhere and leaves no lockfile above the deck, so after the install changes Vite
 * would keep serving the dependencies it optimized from the old one. Each install therefore gets its
 * own cache directory, named after a fingerprint of the files the optimizer reads from and of the
 * install's lockfile.
 *
 * Nothing here deletes a cache. Another `dev` on the same deck may be serving from any of them, and
 * an install that changes leaves one directory behind, which `.fuse-deck/` holds out of the way.
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import { createHash } from "node:crypto";
import path from "node:path";

import type { DependencyPackage } from "../package-root.ts";

/** The directory, inside the deck, that holds one optimizer cache per install. */
const CACHES = path.join(".fuse-deck", "vite");

/** The lockfiles of npm, pnpm, Yarn and Bun, which record the versions of every installed package. */
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];

/** The deck's optimizer cache. */
export type OptimizerCache = {
  /** The cache directory, absolute. */
  readonly directory: string;
  /**
   * The install's lockfile, whose bytes the directory's name includes. Without one, a dependency
   * of React, React DOM or Fuse can change while their own files stay the same, so the start must
   * re-optimize.
   */
  readonly lockfile: Option.Option<string>;
};

/**
 * The optimizer cache for the deck and the packages its page imports. It names the same directory
 * while the install is unchanged, and another one once a package is reinstalled, moved or upgraded,
 * or the lockfile changes: the name hashes each `package.json`'s bytes, the identity, size and times
 * of each `package.json` and entry file, and the lockfile's bytes. A file that cannot be read counts
 * as missing.
 *
 * @param deckRoot - The deck directory.
 * @param packages - React, React DOM, Fuse and fuse-deck, as installed.
 * @param install - fuse-deck's package directory; the nearest lockfile at or above it is the install's.
 * @returns The cache directory and the lockfile it includes.
 */
export const optimizerCache = Effect.fn("optimizerCache")(function* (
  deckRoot: string,
  packages: readonly DependencyPackage[],
  install: string
) {
  const fs = yield* FileSystem.FileSystem;
  const stamp = (file: string) =>
    fs.stat(file).pipe(
      Effect.map((info) =>
        [
          file,
          String(Option.getOrNull(info.ino)),
          String(info.size),
          String(Option.getOrNull(Option.map(info.mtime, (date) => date.getTime()))),
          String(Option.getOrNull(Option.map(info.birthtime, (date) => date.getTime()))),
        ].join(":")
      ),
      Effect.orElseSucceed(() => `${file}:missing`)
    );
  const bytes = (file: string) => fs.readFile(file).pipe(Effect.orElseSucceed(() => new Uint8Array()));
  const hash = createHash("sha256");
  for (const { root, entry } of packages) {
    const manifest = path.join(root, "package.json");
    hash.update(yield* stamp(manifest));
    hash.update(yield* bytes(manifest));
    hash.update(yield* stamp(entry));
  }
  const lockfile = yield* lockfileAbove(fs, install);
  if (Option.isSome(lockfile)) {
    hash.update(lockfile.value);
    hash.update(yield* bytes(lockfile.value));
  }
  return {
    directory: path.join(deckRoot, CACHES, hash.digest("hex").slice(0, 16)),
    lockfile,
  } satisfies OptimizerCache;
});

/** The nearest lockfile in `start` or a directory above it. */
const lockfileAbove = Effect.fn("lockfileAbove")(function* (fs: FileSystem.FileSystem, start: string) {
  for (let directory = start; ; directory = path.dirname(directory)) {
    for (const name of LOCKFILES) {
      const file = path.join(directory, name);
      if (yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false))) {
        return Option.some(file);
      }
    }
    if (path.dirname(directory) === directory) {
      return Option.none<string>();
    }
  }
});
