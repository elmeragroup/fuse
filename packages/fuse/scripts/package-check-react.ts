import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packageRootFromScript } from "./paths";
import { CommandAbortedError, combinedFailure, runCommandAsync } from "./run-command";
import { removeDetached } from "./tarball";

const require = createRequire(import.meta.url);
const packageRoot = packageRootFromScript(import.meta.url);

/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml. */
export const RELEASE_AGE_MINUTES = 4320;

/** UTC ISO instant exactly RELEASE_AGE_MINUTES before `now`, for npm's `--before`. */
export function releaseAgeCutoff(now: Date): string {
  return new Date(now.getTime() - RELEASE_AGE_MINUTES * 60_000).toISOString();
}

function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

type ReactPair = { readonly react: string; readonly reactDom: string };

/**
 * Sets the consumer up synchronously, so `npm install` is spawned before the caller's next
 * synchronous work starts; only the probe waits for the install.
 */
async function checkReactPair(
  tarball: string,
  pair: ReactPair,
  cutoff: string,
  signal: AbortSignal
): Promise<string> {
  const consumer = mkdtempSync(join(tmpdir(), "elmera-packed-react-"));
  try {
    // The tarball installs by path next to one real React pair.
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "@elmeragroup/fuse": `file:${tarball}`,
          react: pair.react,
          "react-dom": pair.reactDom,
        },
      })
    );
    copyFileSync(join(packageRoot, "test/packed-consumer/react-probe.ts"), join(consumer, "probe.ts"));
    await runCommandAsync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        `--before=${cutoff}`,
      ],
      { cwd: consumer, timeoutMs: 180_000, signal }
    );
    const probe = await runCommandAsync(process.execPath, ["probe.ts", pair.react, pair.reactDom], {
      cwd: consumer,
      timeoutMs: 30_000,
      signal,
    });
    return probe.stdout.trim();
  } catch (error) {
    if (error instanceof CommandAbortedError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Packed React ${pair.react}/${pair.reactDom}: ${message}`, { cause: error });
  } finally {
    removeDetached(consumer);
  }
}

/**
 * Install the tarball with real peer pairs, without workspace symlinks or aliases. The pairs
 * install into separate consumers concurrently, since install I/O dominates the run; every
 * install is spawned before this returns. Probe output is returned in pair order, and one
 * error names every failing pair.
 */
export async function checkPackedReactCompatibility(tarball: string, signal: AbortSignal): Promise<string[]> {
  // The oldest supported React, one interim release, and the workspace's own version.
  const reactPairs: readonly ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  // One cutoff for the whole run: three consumers resolving against different instants
  // could disagree about which versions exist. `--before` mirrors pnpm's `minimumReleaseAge`
  const cutoff = releaseAgeCutoff(new Date());
  const results = await Promise.allSettled(
    reactPairs.map((pair) => checkReactPair(tarball, pair, cutoff, signal))
  );
  const probes: string[] = [];
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      probes.push(result.value);
    } else {
      failures.push(result.reason);
    }
  }
  const failure = combinedFailure(failures);
  if (failure !== undefined) {
    throw failure;
  }
  return probes;
}
