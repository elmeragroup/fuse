import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { packageRootFromScript } from "./paths.ts";
import { runCommand } from "./run-command.ts";
import { ARTIFACTS_DIR, findTarball } from "./tarball.ts";

/** Packs `dist/` into a fresh `.artifacts/` directory and returns the tarball path. */
export function packTarball(packageRoot: string): string {
  const artifacts = join(packageRoot, ARTIFACTS_DIR);
  rmSync(artifacts, { recursive: true, force: true });
  mkdirSync(artifacts, { recursive: true });
  runCommand("pnpm", ["pack", "--pack-destination", artifacts], join(packageRoot, "dist"));
  return findTarball(packageRoot);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  packTarball(packageRootFromScript(import.meta.url));
}
