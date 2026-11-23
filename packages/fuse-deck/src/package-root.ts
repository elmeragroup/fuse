/**
 * The fuse-deck package directory. The CLI runs from `src/` in this checkout and from `dist/` in the
 * packed package, so it walks up from the running module to the `package.json` that names the
 * package rather than counting levels.
 */

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@elmeragroup/fuse-deck";

const decodeName = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Struct({ name: Schema.String })));

/**
 * The directory of the fuse-deck package that holds the running module.
 *
 * @returns The package directory, absolute.
 * @throws When no ancestor holds fuse-deck's `package.json`, which only a broken install causes.
 */
export function fuseDeckPackageRoot(): string {
  for (let directory = path.dirname(fileURLToPath(import.meta.url)); ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, "package.json");
    const name = existsSync(manifest) ? decodeName(readFileSync(manifest, "utf8")) : Option.none();
    if (Option.isSome(name) && name.value.name === PACKAGE_NAME) {
      return directory;
    }
    if (path.dirname(directory) === directory) {
      throw new Error(`No ${PACKAGE_NAME} package.json above ${fileURLToPath(import.meta.url)}.`);
    }
  }
}

/**
 * The skill that ships in the package, for an agent to open.
 *
 * @returns The absolute path of `skill/SKILL.md`.
 */
export function shippedSkillPath(): string {
  return path.join(fuseDeckPackageRoot(), "skill", "SKILL.md");
}
