import { copyFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { withPackedConsumer } from "./packed-consumer";
import { packageRootFromScript } from "./paths";
import { runCommandAsync, settleAll } from "./run-command";

const require = createRequire(import.meta.url);
const packageRoot = packageRootFromScript(import.meta.url);

function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

type ReactPair = { readonly react: string; readonly reactDom: string };

function checkReactPair(
  tarball: string,
  pair: ReactPair,
  cutoff: string,
  signal: AbortSignal
): Promise<string> {
  return withPackedConsumer(
    {
      tarball,
      prefix: "elmera-packed-react-",
      label: `React ${pair.react}/${pair.reactDom}`,
      dependencies: { react: pair.react, "react-dom": pair.reactDom },
      cutoff,
      signal,
    },
    async (consumer) => {
      copyFileSync(join(packageRoot, "test/packed-consumer/react-probe.ts"), join(consumer, "probe.ts"));
      const probe = await runCommandAsync(process.execPath, ["probe.ts", pair.react, pair.reactDom], {
        cwd: consumer,
        timeoutMs: 30_000,
        signal,
      });
      return probe.stdout.trim();
    }
  );
}

/**
 * Install the tarball with real peer pairs, without workspace symlinks or aliases. The pairs
 * install into separate consumers concurrently, since install I/O dominates the run; every
 * install is spawned before this returns. Probe output is returned in pair order, and one
 * error names every failing pair.
 *
 * @param tarball - The packed Fuse tarball.
 * @param cutoff - The run's one `releaseAgeCutoff`, shared with every other packed consumer.
 * @param signal - Aborts the installs and probes when a sibling check fails.
 * @returns The probe output lines, in pair order.
 */
export async function checkPackedReactCompatibility(
  tarball: string,
  cutoff: string,
  signal: AbortSignal
): Promise<string[]> {
  // The oldest supported React, one interim release, and the workspace's own version.
  const reactPairs: readonly ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  return settleAll(reactPairs.map((pair) => checkReactPair(tarball, pair, cutoff, signal)));
}
