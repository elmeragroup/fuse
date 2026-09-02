import { Schema } from "effect";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { relative } from "node:path";

/** Leaf file helpers shared by every script; this module imports no sibling. */

/** The installed version of a dependency, read from its package.json. */
export function packageVersion(packageName: string): string {
  const require = createRequire(import.meta.url);
  // SAFETY: package.json is a required dependency metadata file and its only consumed field is version.
  const metadata = require(`${packageName}/package.json`) as { readonly version: string };
  return metadata.version;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Reads a JSON file into the closed `Schema.Json` shape. */
export function decodeJson(path: string): Schema.Json {
  return Schema.decodeUnknownSync(Schema.Json)(JSON.parse(readFileSync(path, "utf8")));
}

/** A path relative to `root` with forward slashes on every platform. */
export function posixRelative(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}
