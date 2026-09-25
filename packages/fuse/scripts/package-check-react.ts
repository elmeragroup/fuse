import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packageRootFromScript } from "./paths";
import { runCommandAsync } from "./run-command";

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

async function checkReactPair(tarball: string, pair: ReactPair, cutoff: string): Promise<string> {
  const consumer = await mkdtemp(join(tmpdir(), "elmera-packed-react-"));
  try {
    // The tarball installs by path next to one real React pair.
    await writeFile(
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
    try {
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
        { cwd: consumer, timeoutMs: 180_000 }
      );
    } catch (error) {
      throw new Error(
        `Packed React ${pair.react} install failed:\n${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
    await writeFile(
      join(consumer, "probe.ts"),
      await readFile(join(packageRoot, "test/packed-consumer/react-probe.ts"))
    );
    try {
      const probe = await runCommandAsync(process.execPath, ["probe.ts", pair.react, pair.reactDom], {
        cwd: consumer,
        timeoutMs: 30_000,
      });
      return probe.stdout.trim();
    } catch (error) {
      throw new Error(
        `Packed React ${pair.react} rendering failed:\n${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
        }
      );
    }
  } finally {
    removeDetached(consumer);
  }
}

/**
 * Deletes `directory` from a detached process that outlives this one. Each consumer holds
 * about 28k installed files, and deleting them costs seconds of disk time that no result
 * depends on.
 */
function removeDetached(directory: string): void {
  spawn(
    process.execPath,
    ["-e", "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })", directory],
    { detached: true, stdio: "ignore" }
  ).unref();
}

/**
 * Install the tarball with real peer pairs, without workspace symlinks or aliases. The pairs
 * install into separate consumers concurrently, since install I/O dominates the run;
 * probe output is returned in pair order.
 */
export async function checkPackedReactCompatibility(tarball: string): Promise<string[]> {
  // The oldest supported React, one interim release, and the workspace's own version.
  const reactPairs: readonly ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  // One cutoff for the whole run: three consumers resolving against different instants
  // could disagree about which versions exist. `--before` mirrors pnpm's `minimumReleaseAge`
  const cutoff = releaseAgeCutoff(new Date());
  return Promise.all(reactPairs.map((pair) => checkReactPair(tarball, pair, cutoff)));
}
