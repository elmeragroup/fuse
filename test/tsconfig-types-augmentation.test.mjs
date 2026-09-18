import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, isString } from "./json-object.mjs";
import { findFiles, repoRoot } from "./repo-tree.mjs";

/** The `types` entry that pulls the csstype custom-property augmentation into a program. */
const AUGMENTATION = "@elmeragroup/typescript-config/css-custom-properties";

/** Directory holding the shared config package's presets. */
const SHARED_CONFIG_DIRECTORY = join("tooling", "typescript");

/** Bare-specifier prefix that maps onto `tooling/typescript`. */
const SHARED_CONFIG_SPECIFIER = "@elmeragroup/typescript-config/";

/** The config every shared-config preset and workspace tsconfig ultimately reaches. */
const SHARED_CONFIG_ROOT = join(repoRoot, SHARED_CONFIG_DIRECTORY, "base.json");

/** Workspace trees whose tsconfigs inherit the shared config. */
const WORKSPACE_TREES = ["apps", "packages", "scripts"];

/**
 * Strips `//` and block comments so tsconfigs that carry them parse as JSON. The string arm keeps
 * `//` inside a value (for example a `https://…` schema URL) from reading as a comment.
 */
const jsonComment = /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g;

/**
 * @param {string} source
 * @returns {string}
 */
function stripJsonComments(source) {
  return source.replace(jsonComment, (match, comment) => (comment ? "" : match));
}

/**
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function readTsconfig(path) {
  // SAFETY: JSON.parse is untyped; the asRecord guard below is the contract.
  const parsed = /** @type {unknown} */ (JSON.parse(stripJsonComments(readFileSync(path, "utf8"))));
  return asRecord(parsed, relative(repoRoot, path));
}

/**
 * Whether a file name is a workspace tsconfig the repo-policy rule walks.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isWorkspaceTsconfig(name) {
  return /^tsconfig.*\.json$/.test(name);
}

/**
 * Whether a file name is one of the shared config package's JSON presets.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isSharedConfigPreset(name) {
  return name.endsWith(".json") && name !== "package.json";
}

/**
 * Every candidate tsconfig named by the repo-policy rule: the root and workspace trees by
 * `tsconfig*.json` name, plus every JSON preset in the shared config package.
 */
function localTsconfigs() {
  const root = readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isWorkspaceTsconfig(entry.name))
    .map((entry) => join(repoRoot, entry.name));
  return [
    ...root,
    ...WORKSPACE_TREES.flatMap((tree) => findFiles(join(repoRoot, tree), isWorkspaceTsconfig)),
    ...findFiles(join(repoRoot, SHARED_CONFIG_DIRECTORY), isSharedConfigPreset),
  ];
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asSpecifiers(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(isString);
}

/**
 * Resolves one `extends` specifier to the config file it points at, appending the extension
 * TypeScript allows an author to omit. Bare specifiers into the shared config package map onto
 * `tooling/typescript`; relative specifiers resolve against `fromPath`; any other specifier
 * names a package's own config and is not part of a local chain.
 *
 * @param {string} fromPath
 * @param {string} specifier
 * @returns {string | undefined}
 */
function resolveConfigSpecifier(fromPath, specifier) {
  let target;
  if (specifier.startsWith(SHARED_CONFIG_SPECIFIER)) {
    target = join(repoRoot, SHARED_CONFIG_DIRECTORY, specifier.slice(SHARED_CONFIG_SPECIFIER.length));
  } else if (specifier.startsWith(".")) {
    target = resolve(dirname(fromPath), specifier);
  } else {
    return undefined;
  }
  return existsSync(target) ? target : `${target}.json`;
}

/**
 * Whether `path` extends the shared config, directly or through another tsconfig: its `extends`
 * chain reaches `tooling/typescript/base.json`.
 *
 * @param {string} path
 * @returns {boolean}
 */
function extendsSharedConfig(path) {
  return asSpecifiers(readTsconfig(path).extends).some((specifier) => {
    const target = resolveConfigSpecifier(path, specifier);
    if (target === undefined) return false;
    return target === SHARED_CONFIG_ROOT || extendsSharedConfig(target);
  });
}

/**
 * The `compilerOptions.types` list, or `undefined` when the config sets none.
 *
 * @param {string} path
 * @returns {string[] | undefined}
 */
function compilerTypes(path) {
  const label = relative(repoRoot, path);
  const config = readTsconfig(path);
  if (config.compilerOptions === undefined) return undefined;
  const options = asRecord(config.compilerOptions, `${label} compilerOptions`);
  if (options.types === undefined) return undefined;
  if (!Array.isArray(options.types)) throw new Error(`${label} compilerOptions.types is not a list`);
  return options.types.filter(isString);
}

describe("tsconfig types augmentation", () => {
  it("scans the root, the workspace trees, and the shared config package", () => {
    expect(localTsconfigs().map((path) => relative(repoRoot, path))).toEqual(
      expect.arrayContaining([
        "tsconfig.json",
        "scripts/tsconfig.json",
        "packages/ui/tsconfig.json",
        "apps/docs/tsconfig.json",
        "apps/static-theme/tsconfig.json",
        "tooling/typescript/react-library.json",
        "tooling/typescript/internal-package.json",
      ])
    );
  });

  it("re-lists the csstype augmentation in every shared-config extender that overrides `types`", () => {
    for (const path of localTsconfigs()) {
      if (!extendsSharedConfig(path)) continue;
      const types = compilerTypes(path);
      if (types === undefined) continue;
      expect(
        types,
        `${relative(repoRoot, path)} sets compilerOptions.types without ${AUGMENTATION}`
      ).toContain(AUGMENTATION);
    }
  });
});
