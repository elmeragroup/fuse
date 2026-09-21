import { Effect } from "effect";
import { resolve } from "node:path";

import {
  checkReleasePr,
  ReleaseError,
  releaseCheckedCommit,
  resolveReleasePackage,
  retryRelease,
} from "@elmeragroup/internal/release";
import type { PackAndVerify, ReleasePackage } from "@elmeragroup/internal/release";

export type ReleaseCommand =
  | { mode: "check-pr" }
  | { mode: "publish"; commit: string }
  | { mode: "retry"; tag: string };

export const USAGE = "Usage: pnpm release check-pr | publish <commit> | retry <record-tag>";

export function parseReleaseCommand(argv: readonly string[]): ReleaseCommand {
  const [mode, target] = argv;
  if (mode === "check-pr" && argv.length === 1) return { mode };
  if (argv.length === 2 && target !== undefined && target.length > 0) {
    if (mode === "publish") return { mode, commit: target };
    if (mode === "retry") return { mode, tag: target };
  }
  throw new Error(USAGE);
}

/** The one published package, resolved by the shared release engine (release.md §1). */
function releasePackage(): ReleasePackage {
  const checkoutRoot = resolve(import.meta.dirname, "..");
  return resolveReleasePackage(checkoutRoot, resolve(checkoutRoot, "packages/fuse"), "@elmeragroup/fuse");
}

/**
 * The pack adapter, loaded only by `publish`: `check-pr` and `retry` must not load the
 * build and theme toolchain, and `retry` never packs.
 */
function loadPackAdapter(): Effect.Effect<PackAndVerify, ReleaseError> {
  return Effect.tryPromise({
    try: () => import("../packages/fuse/scripts/release-pack.ts").then(({ pack }) => ({ pack })),
    catch: (cause) => new ReleaseError({ message: "Could not load the release-pack adapter", cause }),
  });
}

function run(command: ReleaseCommand, pkg: ReleasePackage): Effect.Effect<void, ReleaseError> {
  switch (command.mode) {
    case "check-pr":
      return checkReleasePr(pkg);
    case "publish":
      return Effect.gen(function* () {
        // `pack` implements the engine's `PackAndVerify` seam.
        const adapter = yield* loadPackAdapter();
        return yield* releaseCheckedCommit(pkg, adapter, command.commit);
      });
    case "retry":
      return retryRelease(pkg, command.tag);
  }
}

if (import.meta.main) {
  const command = parseReleaseCommand(process.argv.slice(2));
  await Effect.runPromise(run(command, releasePackage()));
}
