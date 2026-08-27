import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  fail,
  importPackedModules,
  importSpecifier,
} from "./package-check-packed";
import { extractPackedPackage, findTarball } from "./tarball";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runInherited(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: packageRoot, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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

let tarball: string;
try {
  tarball = findTarball(packageRoot);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
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

const scratch = mkdtempSync(join(tmpdir(), "elmera-ui-pack-"));
try {
  let extracted: string;
  try {
    extracted = extractPackedPackage(tarball, scratch, packageRoot);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const consumerRoot = join(scratch, "consumer");
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
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("package:check passed");
