import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PUBLISHED_PEER_RANGES } from "./entries";
import { packedComponentTailwindSource, packedTailwindSource, withPackedConsumer } from "./packed-consumer";
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
 * A consumer that imports only `@elmeragroup/fuse/source/button.css`: Button's own classes
 * compile, and a class only another entry spells does not. `h-(--control-h-md)` is the md
 * control height Button's label fit binds; `animate-pulse` is Skeleton's and reaches no file
 * Button imports.
 */
const BUTTON_ONLY_MARKERS = {
  present: [{ source: "the Button label fit", rule: "height: var(--control-h-md)" }],
  absent: [{ source: "Skeleton's animate-pulse", rule: ".animate-pulse" }],
} as const;

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

      // The per-entry source stylesheet, resolved through the package exports and its own
      // relative `@source` lines, scans Button's published files and nothing else.
      writeFileSync(join(consumer, "button.css"), packedComponentTailwindSource("button"));
      await runCommandAsync(
        join(consumer, "node_modules/.bin/tailwindcss"),
        ["-i", "button.css", "-o", "button-compiled.css"],
        { cwd: consumer, timeoutMs: 60_000, signal }
      );
      const buttonOnly = readFileSync(join(consumer, "button-compiled.css"), "utf8");
      const buttonMissing = BUTTON_ONLY_MARKERS.present.filter((marker) => !buttonOnly.includes(marker.rule));
      const buttonExtra = BUTTON_ONLY_MARKERS.absent.filter((marker) => buttonOnly.includes(marker.rule));
      if (buttonMissing.length > 0 || buttonExtra.length > 0) {
        throw new Error(
          `source/button.css compiled CSS is missing ${JSON.stringify(buttonMissing.map((marker) => marker.rule))} and includes ${JSON.stringify(buttonExtra.map((marker) => marker.rule))}`
        );
      }
      return `Packed CSS compiles with tailwindcss ${floor} (${FLOOR_MARKERS.map((marker) => marker.source).join(", ")}); source/button.css scans Button alone`;
    }
  );
}
