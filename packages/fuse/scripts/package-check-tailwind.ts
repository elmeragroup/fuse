import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PUBLISHED_PEER_RANGES } from "./entries";
import { packedTailwindSource, withPackedConsumer } from "./packed-consumer";
import { peerFloorRelease } from "./published-dependencies";
import { runCommandAsync } from "./run-command";

/**
 * Compiled rules that only compile when the shipped classes, `tw-animate-css` and
 * `tailwindcss-react-aria-components` all work at the floor: the 4.1 wrap utilities, the
 * animation plugin's keyframes, and a variant only the React Aria plugin defines.
 */
const FLOOR_MARKERS = [
  { source: "the wrap-anywhere utility", rule: "overflow-wrap: anywhere" },
  { source: "the wrap-break-word utility", rule: "overflow-wrap: break-word" },
  { source: "tw-animate-css", rule: "@keyframes enter" },
  { source: "tailwindcss-react-aria-components", rule: "[data-outside-month]" },
] as const;

/**
 * Installs the tarball beside the first Tailwind release its peer range admits, then compiles
 * the packed CSS against it from the installed package's sources. npm resolves the plugins' own
 * peer ranges against that Tailwind, so an incompatible plugin fails the install. `npm install`
 * is spawned before this returns. Async, so a malformed peer range rejects like every other
 * failure and reaches the caller's abort handling.
 *
 * @param tarball - The packed Fuse tarball.
 * @param cutoff - The run's one `releaseAgeCutoff`, shared with every other packed consumer.
 * @param signal - Aborts the install and compile when a sibling check fails.
 * @returns The compile summary line.
 */
export async function checkPackedTailwindFloor(
  tarball: string,
  cutoff: string,
  signal: AbortSignal
): Promise<string> {
  const floor = peerFloorRelease(PUBLISHED_PEER_RANGES.tailwindcss);
  return withPackedConsumer(
    {
      tarball,
      prefix: "elmera-packed-tailwind-",
      label: `Tailwind ${floor}`,
      dependencies: { tailwindcss: floor, "@tailwindcss/cli": floor },
      cutoff,
      signal,
    },
    async (consumer) => {
      const installed = installedTailwindVersion(consumer);
      if (installed !== floor) {
        throw new Error(`installed tailwindcss ${installed}, expected the floor ${floor}`);
      }
      writeFileSync(join(consumer, "source.css"), packedTailwindSource("./node_modules/@elmeragroup/fuse"));
      await runCommandAsync(
        join(consumer, "node_modules/.bin/tailwindcss"),
        ["-i", "source.css", "-o", "compiled.css"],
        { cwd: consumer, timeoutMs: 60_000, signal }
      );
      const compiled = readFileSync(join(consumer, "compiled.css"), "utf8");
      const missing = FLOOR_MARKERS.filter((marker) => !compiled.includes(marker.rule));
      if (missing.length > 0) {
        throw new Error(
          `compiled CSS is missing ${missing.map((marker) => `${marker.rule} (${marker.source})`).join(", ")}`
        );
      }
      return `Packed CSS compiles with tailwindcss ${floor} (${FLOOR_MARKERS.map((marker) => marker.source).join(", ")})`;
    }
  );
}

function installedTailwindVersion(consumer: string): string {
  // SAFETY: npm installed this manifest; only its version is read.
  const manifest = JSON.parse(
    readFileSync(join(consumer, "node_modules/tailwindcss/package.json"), "utf8")
  ) as {
    readonly version: string;
  };
  return manifest.version;
}
