import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CommandAbortedError, removeDetached, runCommandAsync } from "./run-command";

/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml. */
export const RELEASE_AGE_MINUTES = 4320;

/** UTC ISO instant exactly RELEASE_AGE_MINUTES before `now`, for npm's `--before`. */
export function releaseAgeCutoff(now: Date): string {
  return new Date(now.getTime() - RELEASE_AGE_MINUTES * 60_000).toISOString();
}

/**
 * The Tailwind entry stylesheet a consumer compiles Fuse with: Tailwind, Fuse's CSS and themes,
 * and an `@source` on the package's own files.
 *
 * @param sourceDir - The unpacked Fuse package, relative to the stylesheet.
 * @returns The `source.css` text.
 */
export function packedTailwindSource(sourceDir: string): string {
  return `@import "tailwindcss" source(none);\n@import "@elmeragroup/fuse/css";\n@import "@elmeragroup/fuse/themes.css";\n@source "${sourceDir}";\n`;
}

/** One throwaway npm consumer of the packed tarball. */
export type PackedConsumer = {
  /** The tarball installed by path as `@elmeragroup/fuse`. */
  readonly tarball: string;
  /** The temp directory name prefix. */
  readonly prefix: string;
  /** Names the consumer in a failure: `Packed <label>: <message>`. */
  readonly label: string;
  /** The dependencies installed beside the tarball, name to exact version. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** npm's `--before` instant; one per run, so every consumer resolves the same registry state. */
  readonly cutoff: string;
  /** Aborts the install and the check when a sibling check fails. */
  readonly signal: AbortSignal;
};

/**
 * Installs the tarball into a fresh consumer beside `dependencies`, without workspace symlinks
 * or aliases, then runs `run` in it. The consumer is set up and `npm install` spawned
 * synchronously, before this returns, so the caller's next synchronous work overlaps the
 * install. A non-abort failure is labelled with the consumer; an abort passes through unchanged,
 * since it only echoes a sibling's failure. The consumer is scheduled for removal once every
 * child it started has closed.
 *
 * @template T - The check's result.
 * @param consumer - The tarball, dependencies and run context.
 * @param run - The check, given the installed consumer's directory.
 * @returns The check's result.
 */
export async function withPackedConsumer<T>(
  consumer: PackedConsumer,
  run: (directory: string) => Promise<T>
): Promise<T> {
  const directory = mkdtempSync(join(tmpdir(), consumer.prefix));
  try {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: { "@elmeragroup/fuse": `file:${consumer.tarball}`, ...consumer.dependencies },
      })
    );
    await runCommandAsync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        `--before=${consumer.cutoff}`,
      ],
      { cwd: directory, timeoutMs: 180_000, signal: consumer.signal }
    );
    return await run(directory);
  } catch (error) {
    if (error instanceof CommandAbortedError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Packed ${consumer.label}: ${message}`, { cause: error });
  } finally {
    removeDetached(directory);
  }
}
