import { Effect } from "effect";

import { releaseCheckedCommit, retryRelease } from "@elmeragroup/internal/release";
import type { PackAndVerify } from "@elmeragroup/internal/release";

import { pack } from "../packages/ui/scripts/release-pack.ts";
import { parseReleaseCommand } from "./release-command.ts";
import { releasePackage } from "./release.ts";

// `pack` is typed against the package's own release stamp; the assignment checks it structurally
// against the engine's `PackAndVerify` seam (ReleaseIntent).
const packAndVerify: PackAndVerify = { pack };

const command = parseReleaseCommand(process.argv.slice(2));
if (command.mode === "main") {
  await Effect.runPromise(releaseCheckedCommit(releasePackage, packAndVerify, command.commit));
} else {
  await Effect.runPromise(retryRelease(releasePackage, command.tag));
}
