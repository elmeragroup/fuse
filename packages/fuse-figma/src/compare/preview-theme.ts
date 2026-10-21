/**
 * The theme a preview frame pins, read from its variable modes and stamped on the page the way
 * Fuse applies a theme: `data-theme="dark"` on an ancestor for the dark scheme, the three
 * `data-theme-*` attributes on the themed element, and `data-density` on the document root,
 * whose density the role metrics follow.
 *
 * The mode names are the ones `figma:sync` writes: `Light`/`Dark`, `Internal`/`External`,
 * `Private`/`Company`, the brand's display name, and `Auto`/`Dense`/`Comfortable`. A brand that
 * allows one segment is named `<display name> (<segment> only)` and shows that segment's theme
 * under either `Fuse segment` mode.
 */

import { Result } from "effect";

import {
  BRAND_CODES,
  BRANDS,
  defaultDensityForVariant,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "@elmeragroup/fuse/theme-catalog";
import type { BrandCode, Density, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme-catalog";

import type { ModeRef } from "../components/kit-spec.ts";

/** A theme, color scheme and density, as the page stamps them. */
export type PreviewTheme = {
  readonly scheme: "light" | "dark";
  readonly variant: ThemeVariant;
  readonly brand: BrandCode;
  readonly segment: ThemeSegment;
  readonly density: Density;
};

/** Modes the harness cannot turn into a Fuse theme. */
class UnsupportedModes extends Error {
  readonly _tag = "UnsupportedModes" as const;
}

const SCHEMES = ["light", "dark"] as const;
const DENSITIES = ["dense", "comfortable"] as const;

function lowerCaseOf<Value extends string>(values: readonly Value[], mode: string): Value | undefined {
  return values.find((value) => value === mode.toLowerCase());
}

function brandOf(mode: string): BrandCode | undefined {
  return BRAND_CODES.find((code) => {
    const { displayName, segments } = BRANDS[code];
    const [only, ...others] = segments;
    return mode === displayName || (others.length === 0 && mode === `${displayName} (${only} only)`);
  });
}

/**
 * Parse the modes a preview frame resolves into the theme it renders.
 *
 * @param modes - The frame's mode for each collection, by name. Collections the theme does not
 *   read, such as `Fuse primitives`, are ignored.
 * @returns The theme, or `UnsupportedModes` naming the collection that is missing or holds a mode
 *   the harness does not know.
 */
export function parsePreviewTheme(modes: readonly ModeRef[]): Result.Result<PreviewTheme, UnsupportedModes> {
  const modeOf = (collection: string) => modes.find((ref) => ref.collection === collection)?.mode;
  const read = <Value>(collection: string, parse: (mode: string) => Value | undefined) => {
    const mode = modeOf(collection);
    const value = mode === undefined ? undefined : parse(mode);
    return value === undefined
      ? Result.fail(
          new UnsupportedModes(
            mode === undefined
              ? `the preview resolves no mode for ${collection}`
              : `the harness cannot render ${collection} / ${mode}`
          )
        )
      : Result.succeed(value);
  };
  return Result.gen(function* () {
    const scheme = yield* read("Fuse tokens", (mode) => lowerCaseOf(SCHEMES, mode));
    const variant = yield* read("Fuse variant", (mode) => lowerCaseOf(THEME_VARIANTS, mode));
    const segment = yield* read("Fuse segment", (mode) => lowerCaseOf(THEME_SEGMENTS, mode));
    const brand = yield* read("Fuse brand", brandOf);
    const density = yield* read("Fuse density", (mode) =>
      mode === "Auto" ? defaultDensityForVariant(variant) : lowerCaseOf(DENSITIES, mode)
    );
    const allowed = BRANDS[brand].segments;
    // A brand pinned to one segment shows that segment's theme under either segment mode.
    const shown = allowed.find((candidate) => candidate === segment) ?? allowed[0];
    const theme: PreviewTheme = { scheme, variant, brand, segment: shown, density };
    return theme;
  });
}

/** The attributes the page puts on `<html>` and on `<body>` for a theme. */
export type ThemeStamps = {
  readonly root: Readonly<Record<"data-theme" | "data-density", string>>;
  readonly body: Readonly<Record<"data-theme-variant" | "data-theme-brand" | "data-theme-segment", string>>;
};

/**
 * Where the page stamps a theme. `themes.css` matches the dark scheme as
 * `[data-theme="dark"] [data-theme-variant=…]`, so the scheme sits on the root and the theme on
 * a descendant, and the density metrics match `:root[data-density=…]`.
 *
 * @param theme - The preview's theme.
 * @returns The attributes for `<html>` and `<body>`.
 */
export function themeStamps(theme: PreviewTheme): ThemeStamps {
  return {
    root: { "data-theme": theme.scheme, "data-density": theme.density },
    body: {
      "data-theme-variant": theme.variant,
      "data-theme-brand": theme.brand,
      "data-theme-segment": theme.segment,
    },
  };
}
