import { readFileSync } from "node:fs";

// Relative imports keep their `.ts` extensions: the root release entry point loads this
// module without `scripts/ts-resolve.mjs`, which the other package scripts register for themselves.
import { packageRootFromScript } from "./paths.ts";
import { RELEASE_CHANNEL_ENV, RELEASE_COMMIT_ENV, RELEASE_VERSION_ENV } from "./release-stamp.ts";
import type { ReleaseStamp } from "./release-stamp.ts";
import { runCommand } from "./run-command.ts";
import { findTarball } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);

/**
 * Builds with the release stamp, packs, and runs the publish gates against the packed
 * tarball, then returns its bytes. The build stamps the version and `elmeraRelease`
 * identity into the publish manifest itself (release.md §5); no restoration is needed
 * because `dist/` is rebuildable output.
 */
export function pack(intent: ReleaseStamp): Uint8Array {
  runCommand("pnpm", ["run", "build"], packageRoot, {
    ...process.env,
    [RELEASE_VERSION_ENV]: intent.version,
    [RELEASE_COMMIT_ENV]: intent.commit,
    [RELEASE_CHANNEL_ENV]: intent.channel,
  });
  runCommand("pnpm", ["run", "pack"], packageRoot);
  for (const script of ["package:check", "size-limit", "test:packed-consumer"]) {
    runCommand("pnpm", ["run", script], packageRoot);
  }
  return new Uint8Array(readFileSync(findTarball(packageRoot)));
}
