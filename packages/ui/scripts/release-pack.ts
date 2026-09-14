import { readFileSync } from "node:fs";

import type { ReleaseIntent } from "@elmeragroup/internal/release";

import { buildPackage } from "./build";
import { packageRootFromScript } from "./paths";
import { runCommand } from "./run-command";
import { findTarball } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

/**
 * The release.md §5 gates the pack adapter runs (the spec lists more rows than this adapter;
 * pending fixtures and the merge-only theme contract are not publish gates here). Every gate
 * also runs in the merge `ci:checks` graph, which `test/release-workflow.test.mjs` keeps pinned.
 */
export const PUBLISH_GATES = ["package:check", "size-limit", "test:packed-consumer"] as const;

/**
 * Builds the package with the release intent written into its publish manifest, packs it, and
 * runs the publish gates against the packed tarball, then returns its bytes. `dist/` is
 * rebuildable output, so no restoration is needed (release.md §5).
 */
export function pack(intent: ReleaseIntent): Uint8Array {
  buildPackage(packageRoot, intent);
  runCommand("pnpm", ["run", "pack"], packageRoot);
  for (const script of PUBLISH_GATES) {
    runCommand("pnpm", ["run", script], packageRoot);
  }
  return readFileSync(findTarball(packageRoot));
}
