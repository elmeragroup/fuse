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
import { runCommand } from "./run-command";
import { fail, linkConsumerModules, withExtractedTarball } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

try {
  withExtractedTarball(packageRoot, "fuse-pack-", (extracted, tarball) => {
    checkPackedReactCompatibility(tarball);
    runCommand("pnpm", ["exec", "publint", tarball], packageRoot);
    runCommand(
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
      packageRoot
    );
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
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log("package:check passed");
