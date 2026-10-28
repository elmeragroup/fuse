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

import { Effect, FileSystem, Option } from "effect";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileHostUtilities } from "../components/utility-css.ts";
import { isClientRenderer, RENDERER_ENTRIES } from "./cell-renderers.ts";
import type { AnyCellRenderer } from "./cell-renderers.ts";
import { buildClientBundle } from "./client-bundle.ts";
import { fileFailure, readText } from "./compare-files.ts";
import { ASSET_PATHS } from "./preview-page.ts";

/** The Fuse package, next to this one in the workspace. */
const FUSE_ROOT = fileURLToPath(new URL("../../../fuse/", import.meta.url));

/** The build outputs the comparison reads: the CSS, the icons and each renderer's entry. */
const BUILD_OUTPUTS: readonly string[] = [
  ...new Set(["dist/styles.css", "dist/themes.css", "dist/icons.js", ...RENDERER_ENTRIES]),
];

/** The font weights the page can load, every upright cut the package ships. */
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/**
 * Licensed families neither the compare page nor the real file ships, by name, with why. Where a
 * cell's text names one first, both sides draw the next family in its stack, so the font check
 * accepts it when that family has a loaded face (`font-check.ts`).
 */
export const LICENSED_FAMILIES: ReadonlyMap<string, string> = new Map([
  [
    "Neo Sans",
    "the external Fjordkraft themes' --font-heading. On 2026-10-27 the real file's external Dialog title bound font-heading to Neo Sans Medium with hasMissingFont true, listAvailableFontsAsync held no Neo Sans, and its export drew the title in Roboto Medium, as the page's CSS stack falls back to Roboto",
  ],
]);

/** The Fuse build is missing. */
export class FuseBuildMissing extends Error {
  readonly _tag = "FuseBuildMissing" as const;
}

/** What the page loads, as CSS text and the font directory on disk. */
export type PageAssets = {
  /** Fuse's built `styles.css`. */
  readonly styles: string;
  /** Fuse's built `themes.css`. */
  readonly themes: string;
  /** Tailwind's preflight. */
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

/** The modification time of a file, or 0 for a file system that keeps none. */
function modified(info: FileSystem.File.Info): number {
  return Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
}

/** The latest modification of any file below a directory. */
const newestModification = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs
    .readDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(fileFailure("read", directory)));
  const times = yield* Effect.forEach(
    entries,
    (entry) => {
      const path = join(directory, entry);
      return fs.stat(path).pipe(
        Effect.map((info) => (info.type === "File" ? modified(info) : 0)),
        Effect.mapError(fileFailure("read", path))
      );
    },
    { concurrency: 16 }
  );
  return times.reduce((newest, time) => Math.max(newest, time), 0);
});

/**
 * Find the Fuse build.
 *
 * @returns The build. The Effect fails with `FuseBuildMissing` naming the first output that does
 *   not exist, and with `CompareFileFailed` when the sources cannot be read.
 */
export const locateFuseBuild = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const times: number[] = [];
  for (const output of BUILD_OUTPUTS) {
    const path = join(FUSE_ROOT, output);
    const info = yield* fs
      .stat(path)
      .pipe(
        Effect.mapError(
          () =>
            new FuseBuildMissing(
              `${path} does not exist. Build Fuse first: pnpm --filter @elmeragroup/fuse build`
            )
        )
      );
    times.push(modified(info));
  }
  const build: FuseBuild = {
    root: FUSE_ROOT,
    stale: (yield* newestModification(join(FUSE_ROOT, "src"))) > Math.min(...times),
  };
  return build;
});

/**
 * Read the page's assets.
 *
 * @param build - The Fuse build.
 * @param renderers - The renderers, whose host classes the page compiles and whose client
 *   renderers it bundles.
 * @returns The stylesheets, the font CSS, the host's CSS and the client bundle. The Effect fails
 *   with `CompareFileFailed` for a file it cannot read, and with why the host's CSS or the bundle
 *   did not build.
 */
export const readPageAssets = Effect.fnUntraced(function* (
  build: FuseBuild,
  renderers: ReadonlyMap<string, AnyCellRenderer>
) {
  const fontPackage = dirname(fileURLToPath(import.meta.resolve("@fontsource/roboto/400.css")));
  const fonts = yield* Effect.forEach(FONT_WEIGHTS, (weight) =>
    readText(join(fontPackage, `${String(weight)}.css`))
  );
  const fontCss = fonts
    .map((css) => css.replaceAll("url(./files/", `url(${ASSET_PATHS.fontFiles}`))
    .join("\n");
  const hostCss = yield* compileHostUtilities(
    [...renderers.values()].flatMap((renderer) => renderer.hostClasses ?? [])
  );
  const client = yield* buildClientBundle([...renderers.values()].filter(isClientRenderer));
  const assets: PageAssets = {
    styles: yield* readText(join(build.root, "dist/styles.css")),
    themes: yield* readText(join(build.root, "dist/themes.css")),
    preflight: yield* readText(fileURLToPath(import.meta.resolve("tailwindcss/preflight.css"))),
    fontCss,
    fontDirectory: join(fontPackage, "files"),
    fontPackage,
    hostCss,
    client,
  };
  return assets;
});
