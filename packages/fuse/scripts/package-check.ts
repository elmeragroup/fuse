import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { discoverEntries } from "./entries";
import {
  checkPackedBareEntryRacDeclarations,
  checkPackedBootstrap,
  checkPackedDirectives,
  checkPackedExports,
  checkPackedFlags,
  checkPackedPeers,
  checkPackedRuntimeExports,
  checkPackedTwemojiNotices,
  checkValidateThemeEnv,
  importPackedModules,
  importSpecifier,
} from "./package-check-packed";
import { checkPackedReactCompatibility } from "./package-check-react";
import { packageRootFromScript } from "./paths";
import { runCommandAsync } from "./run-command";
import { fail, linkConsumerModules, withExtractedTarballAsync } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

try {
  await withExtractedTarballAsync(packageRoot, "fuse-pack-", async ({ extracted, tarball }) => {
    // The React matrix, publint and attw each read only the tarball, so they run together as
    // child processes while the in-process checks below occupy this thread.
    const tools = Promise.all([
      checkPackedReactCompatibility(tarball),
      runCommandAsync("pnpm", ["exec", "publint", tarball], { cwd: packageRoot }),
      runCommandAsync(
        "pnpm",
        [
          "exec",
          "attw",
          tarball,
          "--profile",
          "esm-only",
          "--exclude-entrypoints",
          "css",
          "demo-stage-comfortable.css",
          "styles.css",
          "themes.css",
        ],
        { cwd: packageRoot }
      ),
    ]);
    const consumerRoot = join(dirname(extracted), "consumer");
    mkdirSync(consumerRoot, { recursive: true });
    linkConsumerModules(consumerRoot, extracted, packageRoot);
    const discovered = discoverEntries(packageRoot);
    const exported = importPackedModules(
      consumerRoot,
      discovered.jsEntries.map((entry) => importSpecifier(entry.subpath))
    );
    checkPackedExports(extracted, discovered);
    checkPackedPeers(extracted);
    checkPackedRuntimeExports(exported, discovered);
    checkPackedDirectives(extracted, discovered);
    checkPackedBareEntryRacDeclarations(extracted, discovered);
    checkPackedFlags(extracted, consumerRoot, exported[importSpecifier("flags")]);
    checkPackedTwemojiNotices(extracted);
    checkValidateThemeEnv(extracted);
    checkPackedBootstrap(consumerRoot, exported[importSpecifier("theme")]);
    const [reactProbes, publint, attw] = await tools;
    for (const line of reactProbes) {
      console.log(line);
    }
    process.stdout.write(publint.stdout);
    process.stdout.write(attw.stdout);
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log("package:check passed");
