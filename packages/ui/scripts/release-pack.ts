import { readFileSync } from "node:fs";

// The root release entry point loads this closure as plain type-stripped ESM, so its
// relative imports stay extension-explicit; the package's own scripts use `ts-resolve.mjs`.
import { writePublishManifest } from "./generate-exports.ts";
import { packageRootFromScript } from "./paths.ts";
import type { ReleaseStamp } from "./release-stamp.ts";
import { runCommand } from "./run-command.ts";
import { findTarball } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);

/**
 * The release.md §5 gates the pack adapter runs (the spec lists more rows than this adapter;
 * pending fixtures and the merge-only theme contract are not publish gates here). Every gate
 * also runs in the merge `ci:checks` graph, which `test/release-workflow.test.mjs` keeps pinned.
 */
export const PUBLISH_GATES = ["package:check", "size-limit", "test:packed-consumer"] as const;

/**
 * Builds the package normally, stamps the release version and `elmeraRelease` identity into
 * the publish manifest, packs, and runs the publish gates against the packed tarball, then
 * returns its bytes. The stamp comes from the canonical manifest writer, and `dist/` is
 * rebuildable output, so no restoration is needed (release.md §5).
 */
export function pack(intent: ReleaseStamp): Uint8Array {
  runCommand("pnpm", ["run", "build"], packageRoot);
  // The ordinary build already wrote the unstamped manifest; this canonical second write adds
  // the release identity (version and `elmeraRelease`) to it.
  writePublishManifest(packageRoot, intent);
  runCommand("pnpm", ["run", "pack"], packageRoot);
  for (const script of PUBLISH_GATES) {
    runCommand("pnpm", ["run", script], packageRoot);
  }
  return readFileSync(findTarball(packageRoot));
}
