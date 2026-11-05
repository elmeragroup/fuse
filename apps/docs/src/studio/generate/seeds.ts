/**
 * The theme studio's seed data: every legal theme's tokens in both schemes, each with the CSS
 * its theme rule declares and the value at the end of its chain. One module per theme, so the
 * studio's client bundle loads only the theme it shows.
 */

import * as Hex from "@elmeragroup/color/hex";
import type {
  ResolvedThemeCatalog,
  ResolvedScheme,
  ThemeVariant,
  TokenEntry,
} from "@elmeragroup/fuse/theme-catalog";

import type { FontVariable } from "../../lib/token-sections.ts";
import { FONT_STACK_LABELS, FONT_STACKS } from "../lib/font-stacks.ts";
import { referencesOf } from "../lib/references.ts";
import type { StudioSchemeSeed, StudioSeed, StudioSeedToken } from "../lib/seed.ts";

/**
 * The roles the theme rules declare as a live `color-mix()` instead of the literal the catalog
 * holds, so the studio shows the formula and a host override of a source moves them. Fuse keeps
 * the mix table private (`DERIVED_ROLES`); the studio tests check each entry against the shipped
 * `themes.css`.
 */
export const LIVE_MIXES: ReadonlyMap<string, string> = new Map([
  ["secondary-hover", "color-mix(in oklch, var(--secondary), var(--foreground) 5%)"],
]);

/** The value at the end of a token's chain, as the inspector prints it. */
function displayValue(entry: TokenEntry): string {
  switch (entry.kind) {
    case "color":
      return entry.value.alpha < 1
        ? `${Hex.formatOpaque(entry.value)} / ${String(entry.value.alpha)}`
        : Hex.formatOpaque(entry.value);
    case "dimension":
      return `${String(entry.value)}px`;
    case "fontWeight":
      return String(entry.value);
  }
}

/**
 * The font variables as the docs set them for a theme's variant (`styles/globals.css`): Inter for
 * internal themes and Roboto for external ones, with headings following the body font. Themes
 * name no fonts, so the docs, as an app, choose them.
 */
function fontSeeds(variant: ThemeVariant) {
  const body = variant === "internal" ? "inter" : "roboto";
  return {
    "font-sans": { css: FONT_STACKS[body], value: FONT_STACK_LABELS[body] },
    "font-heading": { css: FONT_STACKS.body, value: FONT_STACK_LABELS[body] },
  } satisfies Record<FontVariable, StudioSeedToken>;
}

function schemeSeed(scheme: ResolvedScheme, variant: ThemeVariant): StudioSchemeSeed {
  // SAFETY: `scheme.tokens` holds an entry for every token name and `fontSeeds` one for every font
  // variable, so the record has every key StudioSchemeSeed names. Object.fromEntries cannot carry
  // that.
  return {
    ...Object.fromEntries(
      Object.values(scheme.tokens).map((entry): [string, StudioSeedToken] => [
        entry.name,
        { css: LIVE_MIXES.get(entry.name) ?? entry.css, value: displayValue(entry) },
      ])
    ),
    ...fontSeeds(variant),
  } as StudioSchemeSeed;
}

/**
 * Every legal theme's seed, in catalog order.
 *
 * @param catalog - The resolved theme catalog.
 * @returns One seed per theme.
 */
export function buildStudioSeeds(catalog: ResolvedThemeCatalog): StudioSeed[] {
  return catalog.themes.map((theme) => ({
    slug: theme.slug,
    light: schemeSeed(theme.schemes.light, theme.input.variant),
    dark: schemeSeed(theme.schemes.dark, theme.input.variant),
  }));
}

/** One theme's seed module, without the generated banner. */
export function renderStudioSeed(seed: StudioSeed): string {
  return `import type { StudioSeed } from "../../studio/lib/seed";

export const STUDIO_SEED: StudioSeed = ${JSON.stringify(seed, null, 2)};
`;
}

/**
 * The loader module: one dynamic import per theme, so a bundler splits each seed into its own
 * chunk, the primitives the color knob offers as swatches, and every theme's alias graph, which
 * is small enough to load eagerly for the session's cycle check.
 */
export function renderStudioSeedIndex(catalog: ResolvedThemeCatalog, seeds: readonly StudioSeed[]): string {
  const loaders = catalog.themes
    .map((theme) => `  "${theme.slug}": () => import("./studio-seeds/${theme.slug}"),`)
    .join("\n");
  const references = seeds
    .map((seed) => `  "${seed.slug}": ${JSON.stringify(referencesOf(seed))},`)
    .join("\n");
  const primitives = Object.values(catalog.primitives).map((entry) => ({
    name: entry.name,
    value: Hex.formatOpaque(entry.value),
  }));
  return `import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { BaseReferences } from "../studio/lib/references";
import type { StudioPrimitive, StudioSeed } from "../studio/lib/seed";

const LOADERS = {
${loaders}
} satisfies Record<ThemeSlug, () => Promise<{ STUDIO_SEED: StudioSeed }>>;

/** One theme's seed, loaded on demand. */
export async function loadStudioSeed(slug: ThemeSlug): Promise<StudioSeed> {
  const module = await LOADERS[slug]();
  return module.STUDIO_SEED;
}

/** The primitives, which hold one value in every theme and scheme, as the color knob's swatches. */
export const STUDIO_PRIMITIVES: readonly StudioPrimitive[] = ${JSON.stringify(primitives, null, 2)};

/** Every theme's alias graph, so the session checks a theme for cycles before its seed loads. */
export const STUDIO_BASE_REFERENCES: Readonly<Record<ThemeSlug, BaseReferences>> = {
${references}
};
`;
}
