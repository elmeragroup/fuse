import { Effect } from "effect";

import { releaseCheckedCommit, retryRelease } from "@elmeragroup/internal/release";

import { parseReleaseCommand } from "./lib/release-command.ts";
import { createPackAndVerify } from "./pack-adapter.ts";
import { releasePackage } from "./release.ts";

const command = parseReleaseCommand(process.argv.slice(2));
if (command.mode === "main") {
  await Effect.runPromise(releaseCheckedCommit(releasePackage, createPackAndVerify(), command.commit));
} else {
  await Effect.runPromise(retryRelease(releasePackage, command.tag));
}
