/**
 * Package directories on disk. The CLI runs from `src/` in this checkout and from `dist/` in the
 * packed package, and an install may put a dependency anywhere, so each lookup walks up from a
 * file to the `package.json` that names the package rather than counting levels.
 */

import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@elmeragroup/fuse-deck";

const decodeName = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Struct({ name: Schema.String })));

/** The nearest directory at or above `start` whose `package.json` names `name`. */
function packageRootAbove(start: string, name: string): Option.Option<string> {
  for (let directory = start; ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, "package.json");
    const found = existsSync(manifest) ? decodeName(readFileSync(manifest, "utf8")) : Option.none();
    if (Option.isSome(found) && found.value.name === name) {
      return Option.some(directory);
    }
    if (path.dirname(directory) === directory) {
      return Option.none();
    }
  }
}

/**
 * The directory of the fuse-deck package that holds the running module.
 *
 * @returns The package directory, absolute.
 * @throws When no ancestor holds fuse-deck's `package.json`, which only a broken install causes.
 */
export function fuseDeckPackageRoot(): string {
  const here = fileURLToPath(import.meta.url);
  return Option.getOrThrowWith(
    packageRootAbove(path.dirname(here), PACKAGE_NAME),
    () => new Error(`No ${PACKAGE_NAME} package.json above ${here}.`)
  );
}

/**
 * The skill that ships in the package, for an agent to open.
 *
 * @returns The absolute path of `skill/SKILL.md`.
 */
export function shippedSkillPath(): string {
  return path.join(fuseDeckPackageRoot(), "skill", "SKILL.md");
}

/** A package fuse-deck resolves, as the install placed it. */
export type DependencyPackage = {
  /** The package directory, with symlinks resolved. */
  readonly root: string;
  /** The file the package's main entry resolves to, with symlinks resolved. */
  readonly entry: string;
};

/**
 * Find a package fuse-deck resolves. It resolves the package's main entry, because not every
 * package exports its `package.json`.
 *
 * @param name - The package's name.
 * @returns The package's directory and entry, or none when fuse-deck cannot resolve the package.
 */
export function dependencyPackage(name: string): Option.Option<DependencyPackage> {
  return Option.flatMap(
    Result.getSuccess(Result.try(() => realpathSync(fileURLToPath(import.meta.resolve(name))))),
    (entry) => Option.map(packageRootAbove(path.dirname(entry), name), (root) => ({ root, entry }))
  );
}
