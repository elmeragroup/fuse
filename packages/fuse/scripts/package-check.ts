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
import { combinedFailure, runCommandAsync, settleAll } from "./run-command";
import type { CommandOutput } from "./run-command";
import { fail, linkConsumerModules, withExtractedTarballAsync } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);

try {
  await withExtractedTarballAsync(packageRoot, "fuse-pack-", async ({ extracted, tarball }) => {
    // The React matrix, publint and attw each read only the tarball. Every one of their child
    // processes is spawned synchronously here, before the in-process checks below block this
    // thread, so the installs and tools run while those checks do; the React probes follow their
    // installs once the thread is free. Any failure aborts the rest, and every child closes (and
    // only then is its consumer scheduled for removal) before the error propagates.
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
          "styles.css",
          "themes.css",
        ],
        { cwd: packageRoot, signal: controller.signal }
      )
    );
    // Each tool resolves to the printing of its output, deferred until every tool has passed.
    const printOutput = (output: CommandOutput) => () => {
      process.stdout.write(output.stdout);
      process.stderr.write(output.stderr);
    };
    const tools = settleAll([
      reactProbes.then((lines) => () => {
        for (const line of lines) {
          console.log(line);
        }
      }),
      publint.then(printOutput),
      attw.then(printOutput),
    ]);
    try {
      runInProcessChecks(extracted);
    } catch (error) {
      controller.abort();
      // Tools that failed on their own are reported beside this error; abort echoes drop out.
      const failures: unknown[] = [error];
      try {
        await tools;
      } catch (toolFailure) {
        failures.push(toolFailure);
      }
      throw combinedFailure(failures) ?? error;
    }
    for (const print of await tools) {
      print();
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
