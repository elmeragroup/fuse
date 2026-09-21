import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packageRootFromScript } from "./paths";

const require = createRequire(import.meta.url);
const packageRoot = packageRootFromScript(import.meta.url);

/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml (tooling.md §2). */
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

/** Install the tarball with real peer pairs, without workspace symlinks or aliases. */
export function checkPackedReactCompatibility(tarball: string): void {
  // The oldest supported React, one interim release, and the workspace's own version.
  const reactPairs = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  // One cutoff for the whole run: three consumers resolving against different instants
  // could disagree about which versions exist. `--before` mirrors pnpm's `minimumReleaseAge`
  // (tooling.md §2).
  const cutoff = releaseAgeCutoff(new Date());
  for (const pair of reactPairs) {
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
      const install = spawnSync(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--package-lock=false",
          `--before=${cutoff}`,
        ],
        {
          cwd: consumer,
          encoding: "utf8",
          timeout: 180_000,
        }
      );
      if (install.status !== 0) {
        throw new Error(`Packed React ${pair.react} install failed:\n${install.stderr || install.stdout}`);
      }
      writeFileSync(
        join(consumer, "probe.ts"),
        readFileSync(join(packageRoot, "test/packed-consumer/react-probe.ts"))
      );
      const probe = spawnSync(process.execPath, ["probe.ts", pair.react, pair.reactDom], {
        cwd: consumer,
        encoding: "utf8",
        timeout: 30_000,
      });
      if (probe.status !== 0) {
        throw new Error(`Packed React ${pair.react} rendering failed:\n${probe.stderr || probe.stdout}`);
      }
      console.log(probe.stdout.trim());
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }
}
