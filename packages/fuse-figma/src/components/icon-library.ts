import { Effect } from "effect";
/**
 * The icon library the kit builds: one component per icon `@elmeragroup/fuse/icons` publishes
 * that paints only with `currentColor`, drawn from the markup the Fuse icon renders. Those are
 * the icons that follow the color of the text around them, as a Button's icon does. The
 * Phosphor icons render at the library's size in their bold default weight. The bespoke icons
 * render at their own size, which the plugin scales to fit the library's square. Bespoke
 * artwork with colors of its own, such as the Vipps mark or the Signing illustration, stays out:
 * it is drawn for a colored background or reads as a blot at 16px.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "rolldown";

import { BESPOKE_ICON_NAMES, PHOSPHOR_ICON_NAMES } from "@elmeragroup/fuse/recipe-catalog";

import { KitSourceInvalid, runTool } from "./build-errors";
import type { KitBuildError } from "./build-errors";
import { iconKey } from "./kit-spec";
import type { IconSpec } from "./kit-spec";

/** The width and height of every icon component, the 16px of Fuse's `size-4` icons. */
export const ICON_SIZE = 16;

/**
 * The module the build bundles to render an icon export to SVG markup, or to undefined for a
 * name `/icons` does not export. It is source text rather than a file, so the type check does
 * not follow `@elmeragroup/fuse/icons` into Fuse's TSX, which Fuse checks with its own options.
 */
const ICON_MARKUP_SOURCE = `
import * as icons from "@elmeragroup/fuse/icons";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function renderIcon(name, size) {
  if (!Object.hasOwn(icons, name)) {
    return undefined;
  }
  return renderToStaticMarkup(createElement(icons[name], size === undefined ? {} : { width: size, height: size }));
}
`;

const ICON_MARKUP_ID = "\0fuse-icon-markup.js";

/** What the bundled {@link ICON_MARKUP_SOURCE} exports. */
type IconMarkup = {
  readonly renderIcon: (name: string, size: number | undefined) => string | undefined;
};

/** A paint attribute, a `fill` or a `stroke`, and its value. */
const PAINT_ATTRIBUTE = /\b(?:fill|stroke)="([^"]*)"/g;

/** A `class` attribute, which may paint with a Tailwind class Figma cannot read. */
const CLASS_ATTRIBUTE = /\bclass="/;

/**
 * Turn an icon's markup into its spec, or leave it out of the library. An icon belongs when it
 * paints only with `currentColor`. Figma cannot read `currentColor`, so the markup paints it
 * black, and the plugin binds the glyph's color.
 *
 * @param name - The export name.
 * @param markup - The SVG the icon renders.
 * @returns The icon's spec, or undefined for artwork with colors of its own.
 */
function iconSpec(name: string, markup: string): IconSpec | undefined {
  const paints = [...markup.matchAll(PAINT_ATTRIBUTE)].map(([, value]) => value);
  const tinted =
    paints.includes("currentColor") &&
    paints.every((value) => value === "currentColor" || value === "none") &&
    !CLASS_ATTRIBUTE.test(markup);
  return tinted ? { key: iconKey(name), name, svg: markup.replaceAll("currentColor", "#000000") } : undefined;
}

/**
 * Render every icon `@elmeragroup/fuse/icons` publishes, the Phosphor roster then the bespoke
 * icons, and keep those {@link iconSpec} admits. Node cannot load the bespoke TSX, so this
 * bundles {@link ICON_MARKUP_SOURCE} with rolldown into a temporary directory, which it removes
 * afterwards, and imports the bundle.
 *
 * @returns The icon specs, in roster order. The Effect fails with `KitSourceInvalid` when the
 *   roster names an icon `/icons` does not export, and with `KitToolFailed` when rolldown fails.
 */
export const fuseIcons: Effect.Effect<readonly IconSpec[], KitBuildError> = Effect.acquireUseRelease(
  Effect.sync(() => mkdtempSync(join(tmpdir(), "fuse-figma-icons-"))),
  (outDir) =>
    Effect.gen(function* () {
      yield* runTool("rolldown", () =>
        build({
          input: ICON_MARKUP_ID,
          // The bundle's imports resolve from this package, which depends on Fuse and React.
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          plugins: [
            {
              name: "fuse-icon-markup",
              resolveId: (id) => (id === ICON_MARKUP_ID ? id : undefined),
              load: (id) => (id === ICON_MARKUP_ID ? ICON_MARKUP_SOURCE : undefined),
            },
          ],
          platform: "node",
          logLevel: "silent",
          transform: {
            jsx: { runtime: "automatic" },
            define: { "process.env.NODE_ENV": JSON.stringify("production") },
          },
          output: { dir: outDir, format: "esm", entryFileNames: "icon-markup.mjs" },
        })
      );
      // SAFETY: the bundle is ICON_MARKUP_SOURCE, whose one export is `renderIcon`.
      const markup = (yield* Effect.promise(
        () => import(pathToFileURL(join(outDir, "icon-markup.mjs")).href)
      )) as IconMarkup;
      const render = (
        name: string,
        size: number | undefined
      ): Effect.Effect<IconSpec[], KitSourceInvalid> => {
        const svg = markup.renderIcon(name, size);
        if (svg === undefined) {
          return Effect.fail(
            new KitSourceInvalid({
              message: `@elmeragroup/fuse/icons exports no ${name}, which the icon roster lists`,
            })
          );
        }
        const spec = iconSpec(name, svg);
        return Effect.succeed(spec === undefined ? [] : [spec]);
      };
      const phosphor = yield* Effect.forEach(PHOSPHOR_ICON_NAMES, (name) => render(name, ICON_SIZE));
      const bespoke = yield* Effect.forEach(BESPOKE_ICON_NAMES, (name) => render(name, undefined));
      const icons: readonly IconSpec[] = [...phosphor.flat(), ...bespoke.flat()];
      return icons;
    }),
  (outDir) =>
    Effect.sync(() => {
      rmSync(outDir, { recursive: true, force: true });
    })
);
