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
import { combinedFailure, runCommandAsync } from "./run-command";
import { fail, linkConsumerModules, withExtractedTarballAsync } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

try {
  await withExtractedTarballAsync(packageRoot, "fuse-pack-", async ({ extracted, tarball }) => {
    // The React matrix, publint and attw each read only the tarball. Every one of their child
    // processes is spawned synchronously here, before the in-process checks below block this
    // thread, so the installs and tools run while those checks do; the React probes follow their
    // installs once the thread is free. Any failure aborts the rest, and every child settles
    // (and its consumer is scheduled for removal) before the error propagates.
    const controller = new AbortController();
    const abortOnFailure = <T>(task: Promise<T>): Promise<T> => {
      task.catch(() => {
        controller.abort();
      });
      return task;
    };
    const reactProbes = abortOnFailure(checkPackedReactCompatibility(tarball, controller.signal));
    const publint = abortOnFailure(
      runCommandAsync("pnpm", ["exec", "publint", tarball], { cwd: packageRoot, signal: controller.signal })
    );
    const attw = abortOnFailure(
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
        { cwd: packageRoot, signal: controller.signal }
      )
    );
    const tools = Promise.allSettled([reactProbes, publint, attw]);
    try {
      runInProcessChecks(extracted);
    } catch (error) {
      controller.abort();
      await tools;
      throw error;
    }
    const [reactResult, publintResult, attwResult] = await tools;
    const failures: unknown[] = [];
    for (const result of [reactResult, publintResult, attwResult]) {
      if (result.status === "rejected") {
        failures.push(result.reason);
      }
    }
    const failure = combinedFailure(failures);
    if (failure !== undefined) {
      throw failure;
    }
    if (reactResult.status === "fulfilled") {
      for (const line of reactResult.value) {
        console.log(line);
      }
    }
    for (const result of [publintResult, attwResult]) {
      if (result.status === "fulfilled") {
        process.stdout.write(result.value.stdout);
        process.stderr.write(result.value.stderr);
      }
    }
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function runInProcessChecks(extracted: string): void {
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
}

console.log("package:check passed");
