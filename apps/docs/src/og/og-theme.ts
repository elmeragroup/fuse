/**
 * A theme's tokens in the form Satori paints: sRGB colors and pixel radii.
 *
 * Satori parses neither `oklch()` nor custom properties, so an image cannot read the theme the
 * way a page does. This module reads the generated `THEME_CATALOG`, the composed light palette
 * of every legal theme, and converts each color through `@elmeragroup/color`. A role that the
 * catalog writes as a bare alias, such as `--button-outline: var(--border)` or
 * `--brand: var(--brand-fkas)`, resolves to the named token's literal in the same theme or the
 * catalog's primitives before conversion. Any other notation, `color-mix()` included, is an
 * `OgTokenUnreadable`, never a guess.
 */

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import type * as Srgb from "@elmeragroup/color/srgb";
import type { BrandCode, Density, ThemeSegment, ThemeSlug, ThemeVariant } from "@elmeragroup/fuse/theme";

import { THEME_CATALOG } from "../generated/theme-catalog";
import type { ThemeCatalogEntry, ThemeCatalogTokenMap } from "../lib/docs-model";

/**
 * The color roles an image may paint. Every one is a contract token in every theme, the
 * `--sh-*` syntax colors Code highlights with included.
 */
const COLOR_ROLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-hover",
  "secondary-soft",
  "secondary-soft-foreground",
  "brand",
  "brand-foreground",
  "error",
  "error-foreground",
  "error-soft",
  "error-soft-foreground",
  "info",
  "info-foreground",
  "info-soft",
  "info-soft-foreground",
  "success",
  "success-foreground",
  "success-soft",
  "success-soft-foreground",
  "warning",
  "warning-foreground",
  "warning-soft",
  "warning-soft-foreground",
  "border",
  "input",
  "ring",
  "button-outline",
  "sidebar",
  "sidebar-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "sh-identifier",
  "sh-keyword",
  "sh-string",
  "sh-class",
  "sh-property",
  "sh-entity",
  "sh-jsxliterals",
  "sh-sign",
  "sh-comment",
] as const;

/** A color role an image may paint. */
export type OgColorRole = (typeof COLOR_ROLES)[number];

/** A token the catalog writes in a form this module cannot turn into a color or a length. */
export class OgTokenUnreadable extends Error {
  readonly _tag = "OgTokenUnreadable" as const;

  constructor(
    readonly slug: ThemeSlug,
    readonly token: string,
    readonly value: string | undefined
  ) {
    super(`Theme ${slug} token --${token} is not readable for an OG image: ${value ?? "missing"}`);
  }
}

/** A theme slug the generated catalog does not carry. */
export class OgThemeMissing extends Error {
  readonly _tag = "OgThemeMissing" as const;

  constructor(readonly slug: ThemeSlug) {
    super(`THEME_CATALOG has no theme ${slug}. Run \`pnpm --filter docs generate\`.`);
  }
}

/** One theme's palette and shape, ready for Satori styles. */
export type OgTheme = {
  /** The theme's canonical slug. */
  readonly slug: ThemeSlug;
  /** The audience axis. */
  readonly variant: ThemeVariant;
  /** The brand code. */
  readonly brand: BrandCode;
  /** The customer segment. */
  readonly segment: ThemeSegment;
  /** The variant's deployment density, which sets the control metrics a specimen draws. */
  readonly density: Density;
  /** Every color role as gamma-encoded sRGB. */
  readonly colors: Readonly<Record<OgColorRole, Srgb.Srgb>>;
  /** `--radius` in px, the theme's base corner. */
  readonly radius: number;
  /** `--radius-button` in px; external Fjordkraft themes use a pill. */
  readonly radiusButton: number;
  /** `--radius-step` in px: 0 in internal themes, 2 in external ones. */
  readonly radiusStep: number;
  /** `--button-outline-width` in px. */
  readonly buttonOutlineWidth: number;
};

/** A parsed theme, or why one of its tokens is unreadable. */
export type OgThemeResult =
  | { readonly _tag: "ok"; readonly value: OgTheme }
  | { readonly _tag: "err"; readonly error: OgTokenUnreadable | OgThemeMissing };

const ALIAS = /^var\(--([a-z0-9-]+)\)$/u;
const REM = /^(\d*\.?\d+)rem$/u;
const PX = /^(\d*\.?\d+)px$/u;
const ROOT_FONT_SIZE_PX = 16;

/**
 * Follows `var(--name)` aliases to a literal, through the theme's own tokens and then the
 * catalog's primitives (`--brand: var(--brand-fkas)`), refusing a cycle.
 */
function literal(tokens: ThemeCatalogTokenMap, token: string): string | undefined {
  const seen = new Set<string>();
  let name = token;
  while (!seen.has(name)) {
    seen.add(name);
    const value = tokens[`--${name}`] ?? THEME_CATALOG.primitives[`--${name}`];
    const alias = value === undefined ? null : ALIAS.exec(value);
    if (alias === null) {
      return value;
    }
    name = alias[1] ?? "";
  }
  return undefined;
}

function readColor(entry: ThemeCatalogEntry, role: OgColorRole): Srgb.Srgb | OgTokenUnreadable {
  const value = literal(entry.tokens, role);
  const parsed = value === undefined ? undefined : CssColor.parse(value);
  if (parsed === undefined || parsed._tag === "err") {
    return new OgTokenUnreadable(entry.slug, role, value);
  }
  return CssColor.toSrgb(parsed.value);
}

function readLength(entry: ThemeCatalogEntry, token: string): number | OgTokenUnreadable {
  const value = literal(entry.tokens, token);
  const rem = value === undefined ? null : REM.exec(value);
  if (rem !== null) {
    return Number(rem[1]) * ROOT_FONT_SIZE_PX;
  }
  const px = value === undefined ? null : PX.exec(value);
  if (px !== null) {
    return Number(px[1]);
  }
  return new OgTokenUnreadable(entry.slug, token, value);
}

/**
 * Read one theme from the catalog.
 *
 * @param slug - A legal theme slug.
 * @returns The theme, or the first token that does not convert.
 */
export function parseOgTheme(slug: ThemeSlug): OgThemeResult {
  const entry = THEME_CATALOG.themes.find((theme) => theme.slug === slug);
  if (entry === undefined) {
    return { _tag: "err", error: new OgThemeMissing(slug) };
  }
  const colors: Partial<Record<OgColorRole, Srgb.Srgb>> = {};
  for (const role of COLOR_ROLES) {
    const color = readColor(entry, role);
    if (color instanceof OgTokenUnreadable) {
      return { _tag: "err", error: color };
    }
    colors[role] = color;
  }
  const radius = readLength(entry, "radius");
  const radiusButton = readLength(entry, "radius-button");
  const radiusStep = readLength(entry, "radius-step");
  const buttonOutlineWidth = readLength(entry, "button-outline-width");
  for (const length of [radius, radiusButton, radiusStep, buttonOutlineWidth]) {
    if (length instanceof OgTokenUnreadable) {
      return { _tag: "err", error: length };
    }
  }
  if (
    radius instanceof OgTokenUnreadable ||
    radiusButton instanceof OgTokenUnreadable ||
    radiusStep instanceof OgTokenUnreadable ||
    buttonOutlineWidth instanceof OgTokenUnreadable
  ) {
    return { _tag: "err", error: new OgTokenUnreadable(slug, "radius", undefined) };
  }
  return {
    _tag: "ok",
    value: {
      slug,
      variant: entry.variant,
      brand: entry.brand,
      segment: entry.segment,
      density: entry.density,
      // SAFETY: the loop above assigned every member of COLOR_ROLES or returned early, so the
      // partial record is complete. TypeScript cannot follow that through the loop.
      // oxlint-disable-next-line anti-slop/no-known-value-widening -- the record is keyed by the closed role union, which the loop fills completely
      colors: colors as Record<OgColorRole, Srgb.Srgb>,
      radius,
      radiusButton,
      radiusStep,
      buttonOutlineWidth,
    },
  };
}

/**
 * Read one theme, treating an unreadable token as a defect. The catalog is generated and the
 * unit suite converts every theme, so a failure here means the generator changed under the
 * images.
 *
 * @param slug - A legal theme slug.
 * @returns The theme.
 * @throws {OgTokenUnreadable | OgThemeMissing} When the catalog cannot supply the theme.
 */
export function requireOgTheme(slug: ThemeSlug): OgTheme {
  const result = parseOgTheme(slug);
  if (result._tag === "err") {
    throw result.error;
  }
  return result.value;
}

/**
 * A color as a CSS string Satori parses: `#RRGGBB` when opaque, `rgba()` otherwise.
 *
 * @param color - A gamma-encoded sRGB color.
 * @param alpha - An opacity in `0..1` that replaces the color's own, as Tailwind's `/80` does.
 * @returns The CSS color.
 */
export function css(color: Srgb.Srgb, alpha: number = color.alpha): string {
  if (alpha >= 1) {
    return Hex.formatOpaque(color);
  }
  const channel = (value: number): string => String(Math.round(value * 255));
  return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${String(alpha)})`;
}
