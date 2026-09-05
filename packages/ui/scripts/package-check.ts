import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, symlinkSync } from "node:fs";
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
import { fail, withExtractedTarball } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

function runInherited(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: packageRoot, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${String(result.status ?? "null")}`);
  }
}

function linkConsumerModules(consumerRoot: string, extracted: string): void {
  const dest = join(consumerRoot, "node_modules");
  const source = join(packageRoot, "node_modules");
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (entry === ".bin" || entry === "@elmeragroup") {
      continue;
    }
    symlinkSync(join(source, entry), join(dest, entry));
  }
  const scoped = join(dest, "@elmeragroup");
  mkdirSync(scoped, { recursive: true });
  symlinkSync(extracted, join(scoped, "ui"));
}

try {
  withExtractedTarball(packageRoot, "elmera-ui-pack-", (extracted, tarball) => {
    checkPackedReactCompatibility(tarball);
    runInherited("pnpm", ["exec", "publint", tarball]);
    runInherited("pnpm", [
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
    ]);
    const consumerRoot = join(dirname(extracted), "consumer");
    mkdirSync(consumerRoot, { recursive: true });
    linkConsumerModules(consumerRoot, extracted);
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
