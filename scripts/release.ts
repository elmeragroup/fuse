import { Effect } from "effect";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  checkReleasePr,
  releaseCheckedCommit,
  resolveReleasePackage,
  retryRelease,
} from "@elmeragroup/internal/release";
import type { PackAndVerify, ReleaseError, ReleasePackage } from "@elmeragroup/internal/release";

import { pack } from "../packages/ui/scripts/release-pack.ts";

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
  return resolveReleasePackage(checkoutRoot, resolve(checkoutRoot, "packages/ui"), "@elmeragroup/ui");
}

// `pack` implements the engine's `PackAndVerify` seam.
const packAndVerify: PackAndVerify = { pack };

function run(command: ReleaseCommand, pkg: ReleasePackage): Effect.Effect<void, ReleaseError> {
  switch (command.mode) {
    case "check-pr":
      return checkReleasePr(pkg);
    case "publish":
      return releaseCheckedCommit(pkg, packAndVerify, command.commit);
    case "retry":
      return retryRelease(pkg, command.tag);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const command = parseReleaseCommand(process.argv.slice(2));
  await Effect.runPromise(run(command, releasePackage()));
}
