/**
 * The files the comparison page loads, found on disk: Fuse's built CSS, Tailwind's preflight and
 * the brand font, and the CSS of the classes the renderers name as the host's own, compiled as the
 * host's build would. The Fuse build is the one `pnpm --filter @elmeragroup/fuse build` writes, which
 * the comparison also renders the components from.
 *
 * The font comes from `@fontsource/roboto`, Google's Roboto, the family Figma renders for the
 * kit's labels. `--font-sans` lists Roboto first in every theme, and the page checks that the
 * face it uses has loaded, so a missing font file fails the run instead of falling back to a
 * system font.
 */

import { Result } from "effect";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileHostUtilities } from "../components/utility-css.ts";
import { isClientRenderer, RENDERER_ENTRIES } from "./cell-renderers.ts";
import type { AnyCellRenderer } from "./cell-renderers.ts";
import { buildClientBundle } from "./client-bundle.ts";
import { ASSET_PATHS } from "./preview-page.ts";

/** The Fuse package, next to this one in the workspace. */
const FUSE_ROOT = fileURLToPath(new URL("../../../fuse/", import.meta.url));

/** The build outputs the comparison reads: the CSS, the icons and each renderer's entry. */
const BUILD_OUTPUTS: readonly string[] = [
  ...new Set(["dist/styles.css", "dist/themes.css", "dist/icons.js", ...RENDERER_ENTRIES]),
];

/** The font weights the page can load, every upright cut the package ships. */
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** The Fuse build is missing. */
export class FuseBuildMissing extends Error {
  readonly _tag = "FuseBuildMissing" as const;
}

/** What the page loads, as paths on disk and CSS text. */
export type PageAssets = {
  readonly styles: string;
  readonly themes: string;
  readonly preflight: string;
  /** `@font-face` rules whose sources point at {@link ASSET_PATHS.fontFiles}. */
  readonly fontCss: string;
  /** The directory that holds the font files. */
  readonly fontDirectory: string;
  /** The font package's directory, whose pnpm path names its version, for the report. */
  readonly fontPackage: string;
  /** The rules of every class a renderer names as the host's own. */
  readonly hostCss: string;
  /** The bundle that mounts the client cells, empty when no renderer is a client renderer. */
  readonly client: string;
};

/** The Fuse build and whether its sources changed after it. */
export type FuseBuild = {
  readonly root: string;
  /** True when a file under `packages/fuse/src` is newer than the oldest build output. */
  readonly stale: boolean;
};

function newestModification(directory: string): number {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((newest, entry) => Math.max(newest, statSync(join(entry.parentPath, entry.name)).mtimeMs), 0);
}

/**
 * Find the Fuse build.
 *
 * @returns The build, or `FuseBuildMissing` naming the first output that does not exist.
 */
export function locateFuseBuild(): Result.Result<FuseBuild, FuseBuildMissing> {
  const times: number[] = [];
  for (const output of BUILD_OUTPUTS) {
    const path = join(FUSE_ROOT, output);
    try {
      times.push(statSync(path).mtimeMs);
    } catch {
      return Result.fail(
        new FuseBuildMissing(
          `${path} does not exist. Build Fuse first: pnpm --filter @elmeragroup/fuse build`
        )
      );
    }
  }
  return Result.succeed({
    root: FUSE_ROOT,
    stale: newestModification(join(FUSE_ROOT, "src")) > Math.min(...times),
  });
}

/**
 * Read the page's assets.
 *
 * @param build - The Fuse build.
 * @param renderers - The renderers, whose host classes the page compiles and whose client
 *   renderers it bundles.
 * @returns The paths, the font CSS, the host's CSS and the client bundle.
 */
export async function readPageAssets(
  build: FuseBuild,
  renderers: ReadonlyMap<string, AnyCellRenderer>
): Promise<PageAssets> {
  const fontPackage = dirname(fileURLToPath(import.meta.resolve("@fontsource/roboto/400.css")));
  const fontCss = FONT_WEIGHTS.map((weight) =>
    readFileSync(join(fontPackage, `${String(weight)}.css`), "utf8").replaceAll(
      "url(./files/",
      `url(${ASSET_PATHS.fontFiles}`
    )
  ).join("\n");
  return {
    styles: join(build.root, "dist/styles.css"),
    themes: join(build.root, "dist/themes.css"),
    preflight: fileURLToPath(import.meta.resolve("tailwindcss/preflight.css")),
    fontCss,
    fontDirectory: join(fontPackage, "files"),
    fontPackage,
    hostCss: await compileHostUtilities(
      [...renderers.values()].flatMap((renderer) => renderer.hostClasses ?? [])
    ),
    client: await buildClientBundle([...renderers.values()].filter(isClientRenderer)),
  };
}
