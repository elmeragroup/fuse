import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { releaseAgeCutoff } from "./packed-consumer-install-policy";
import { packageRootFromScript } from "./paths";

const require = createRequire(import.meta.url);
const packageRoot = packageRootFromScript(import.meta.url);

type ReactPair = { react: string; reactDom: string };

/**
 * The slice of `spawnSync` this script uses, derived from the real signature so the seam
 * cannot drift from it. `cwd` is narrowed to a string: every call here passes a tmpdir path.
 */
type Spawn = (
  command: string,
  args: readonly string[],
  options: Pick<SpawnSyncOptionsWithStringEncoding, "encoding" | "timeout"> & { cwd: string }
) => Pick<SpawnSyncReturns<string>, "status" | "stdout" | "stderr">;

function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

/** Install the tarball with real peer pairs, without workspace symlinks or aliases. */
export function checkPackedReactCompatibility(
  tarball: string,
  options: { spawn?: Spawn; now?: Date } = {}
): void {
  const spawn: Spawn = options.spawn ?? spawnSync;
  // One cutoff for the whole run: three consumers resolving against different instants
  // could disagree about which versions exist.
  const cutoff = releaseAgeCutoff(options.now ?? new Date());
  const pairs: ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  for (const pair of pairs) {
    const consumer = mkdtempSync(join(tmpdir(), "elmera-packed-react-"));
    try {
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          dependencies: {
            "@elmeragroup/ui": `file:${tarball}`,
            react: pair.react,
            "react-dom": pair.reactDom,
          },
        })
      );
      const install = spawn(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--package-lock=false",
          // Mirrors pnpm's `minimumReleaseAge` for the npm-installed consumers (tooling.md §2).
          `--before=${cutoff}`,
        ],
        { cwd: consumer, encoding: "utf8", timeout: 180_000 }
      );
      if (install.status !== 0) {
        throw new Error(`Packed React ${pair.react} install failed:\n${install.stderr || install.stdout}`);
      }
      writeFileSync(
        join(consumer, "probe.ts"),
        readFileSync(join(packageRoot, "test/packed-consumer/react-probe.ts"))
      );
      const probe = spawn(process.execPath, ["probe.ts", pair.react, pair.reactDom], {
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
