/**
 * Fuse's theme entry, loaded through Vite. Node cannot load Fuse's TSX source, and the first-paint
 * bootstrap must be the text of Fuse's own function, so fuse-deck never imports Fuse in Node. It
 * resolves `@elmeragroup/fuse/theme` from this package, which gives `src/theme.ts` in the checkout
 * and the built file in an install, and imports it with Vite's `runnerImport`.
 *
 * `runnerImport` resolves from `process.cwd()` unless it gets a root, and a deck usually sits outside
 * the install tree, so the root is the package directory. Vite then resolves Fuse's imports the same
 * way from any working directory. It gets no config file and none of the
 * deck's plugins. It is `@experimental`: Vite is pinned exactly, and the packed smoke test is the
 * tripwire for a change.
 */

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

import type { DeckManifest } from "../deck/deck-manifest.ts";

/** The attributes Fuse stamps on `<html>`. */
export type DocumentAttributes = Readonly<Record<`data-${string}`, string>>;

/** The part of `@elmeragroup/fuse/theme` the deck uses, typed here so Node never loads Fuse's types. */
export type FuseThemeModule = {
  readonly parseThemeSlug: (slug: string) => object | null;
  readonly documentAttributes: (input: {
    readonly theme: object;
    readonly density: string;
  }) => DocumentAttributes;
  readonly colorSchemeScriptSource: (options: {
    readonly storageKey: string;
    readonly defaultColorScheme: "system";
    readonly enableSystem: boolean;
  }) => string;
};

/** What the deck's HTML needs before its first paint. */
export type FirstPaint = {
  /** The `data-theme-*` and `data-density` attributes for `<html>`. */
  readonly attributes: DocumentAttributes;
  /** Fuse's classic color-scheme bootstrap, as script text. */
  readonly bootstrap: string;
};

/** Where a deck keeps the reader's light or dark choice. */
const COLOR_SCHEME_STORAGE_KEY = "fuse-deck-color-scheme";

/** `deck.json` names a theme Fuse does not have. */
export class InvalidTheme extends Schema.TaggedError<InvalidTheme>()("InvalidTheme", {
  message: Schema.String,
  hint: Schema.String,
  theme: Schema.String,
}) {}

/** Vite could not load Fuse's theme entry. */
export class FuseThemeUnavailable extends Schema.TaggedError<FuseThemeUnavailable>()("FuseThemeUnavailable", {
  message: Schema.String,
}) {}

/**
 * Load Fuse's theme entry once.
 *
 * @param packageRoot - fuse-deck's directory, the root Vite resolves from.
 * @returns The deck's view of the theme module.
 */
export const loadFuseTheme = (packageRoot: string) =>
  Effect.tryPromise({
    try: () => importFuseTheme(packageRoot),
    catch: (cause) =>
      new FuseThemeUnavailable({
        message: `Could not load @elmeragroup/fuse/theme: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  }).pipe(Effect.withSpan("loadFuseTheme"));

/**
 * Import Fuse's theme entry through Vite's module runner, then put `NODE_ENV` back as it was.
 * Effect's `Config` only reads the environment, and this restores a value Vite writes, so it stays
 * a plain async function.
 */
async function importFuseTheme(packageRoot: string): Promise<FuseThemeModule> {
  const entry = fileURLToPath(import.meta.resolve("@elmeragroup/fuse/theme"));
  // Resolving a serve config sets NODE_ENV to development when it is unset, and a later
  // `build` in this process would then bundle React's development build.
  const nodeEnv = process.env.NODE_ENV;
  try {
    const { module } = await runnerImport<FuseThemeModule>(entry, {
      root: packageRoot,
      configFile: false,
      logLevel: "silent",
    });
    return module;
  } finally {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }
  }
}

/**
 * The first-paint attributes and bootstrap for a deck.
 *
 * @param fuse - Fuse's theme module.
 * @param manifest - The deck's settings.
 * @returns The attributes and bootstrap, or `InvalidTheme` when Fuse has no such theme.
 */
export function firstPaint(
  fuse: FuseThemeModule,
  manifest: Pick<DeckManifest, "theme" | "density">
): Effect.Effect<FirstPaint, InvalidTheme> {
  return Option.match(Option.fromNullOr(fuse.parseThemeSlug(manifest.theme)), {
    onNone: () =>
      Effect.fail(
        new InvalidTheme({
          message: `deck.json's theme ${manifest.theme} is not a Fuse theme.`,
          hint: "A theme is <identity>-<brand>-<segment>, such as neutral-elma-private or branded-fkas-company, and some brands span one segment only.",
          theme: manifest.theme,
        })
      ),
    onSome: (theme) =>
      Effect.succeed({
        attributes: fuse.documentAttributes({ theme, density: manifest.density }),
        bootstrap: fuse.colorSchemeScriptSource({
          storageKey: COLOR_SCHEME_STORAGE_KEY,
          defaultColorScheme: "system",
          enableSystem: true,
        }),
      }),
  });
}
