import { readFileSync } from "node:fs";

import type { ReleaseIntent } from "@elmeragroup/internal/release";

import { buildPackage } from "./build";
import { packTarball } from "./pack";
import { packageRootFromScript } from "./paths";
import { runCommand } from "./run-command";

const packageRoot = packageRootFromScript(import.meta.url);

/**
 * Gates rerun against the exact tarball before publication. The merge suite supplies
 * the theme contract; future full consumer fixtures remain in scripts/RELEASE.md. Every gate
 * also runs in the merge `ci:checks` graph, which `test/release-workflow.test.mjs` keeps pinned.
 */
export const PUBLISH_GATES = ["package:check", "size-limit", "test:packed-consumer"] as const;

/**
 * Builds the package with the release intent written into its publish manifest, packs it, and
 * runs the publish gates against the packed tarball, then returns its bytes. `dist/` is
 * rebuildable output, so no restoration is needed.
 */
export function pack(intent: ReleaseIntent): Uint8Array {
  buildPackage(packageRoot, intent);
  const tarball = packTarball(packageRoot);
  for (const script of PUBLISH_GATES) {
    runCommand("pnpm", ["run", script], packageRoot);
  }
  return readFileSync(tarball);
}
