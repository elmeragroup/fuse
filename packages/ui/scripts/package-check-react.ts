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

export type ReactPair = { react: string; reactDom: string };

/** The consumer `package.json` shape `npm install` runs against. */
export type ConsumerManifest = {
  private: true;
  type: "module";
  dependencies: { "@elmeragroup/ui": string; react: string; "react-dom": string };
};

export function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

/** The oldest supported React, one interim release, and the workspace's own version. */
export function reactPairs(): ReactPair[] {
  return [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
}

/** A consumer manifest that installs the tarball by path next to one real React pair. */
export function consumerManifest(tarball: string, pair: ReactPair): ConsumerManifest {
  return {
    private: true,
    type: "module",
    dependencies: {
      "@elmeragroup/ui": `file:${tarball}`,
      react: pair.react,
      "react-dom": pair.reactDom,
    },
  };
}

/** `npm install` arguments; `--before` mirrors pnpm's `minimumReleaseAge` (tooling.md §2). */
export function installArgs(cutoff: string): string[] {
  return [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    `--before=${cutoff}`,
  ];
}

/** Install the tarball with real peer pairs, without workspace symlinks or aliases. */
export function checkPackedReactCompatibility(tarball: string): void {
  // One cutoff for the whole run: three consumers resolving against different instants
  // could disagree about which versions exist.
  const cutoff = releaseAgeCutoff(new Date());
  for (const pair of reactPairs()) {
    const consumer = mkdtempSync(join(tmpdir(), "elmera-packed-react-"));
    try {
      writeFileSync(join(consumer, "package.json"), JSON.stringify(consumerManifest(tarball, pair)));
      const install = spawnSync("npm", installArgs(cutoff), {
        cwd: consumer,
        encoding: "utf8",
        timeout: 180_000,
      });
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
