import { Schema } from "effect";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { relative } from "node:path";

/** Leaf file helpers shared by every script; this module imports no sibling. */

/** Timing evidence gates on Node major 24; the exact patch is a recorded observation. */
export const requiredNodeMajor = 24 as const;

export function nodeMajor(version: string): number {
  const [major] = version.split(".");
  const parsed = Number.parseInt(major ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid Node version: ${version}`);
  }
  return parsed;
}

export function assertNodeMajor(version: string = process.versions.node): void {
  if (nodeMajor(version) !== requiredNodeMajor) {
    throw new Error(`Timing evidence requires Node ${requiredNodeMajor}.x, got ${version}`);
  }
}

export const issue02TimingCommand = "node scripts/timing.ts --plan issue02 --check" as const;

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
