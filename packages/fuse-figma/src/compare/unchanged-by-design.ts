/**
 * The forced-state cells the kit draws exactly as at rest. A pressed Toggle fills with
 * `toggle-pressed` through `aria-pressed:`, which outranks the `muted` hover tint, so its hover
 * cell looks like its resting twin in Figma and in the browser alike. A hovered Sidebar menu badge paints
 * `sidebar-accent-foreground` where its resting twin paints `sidebar-foreground`, and a theme that
 * gives both one color draws the two cells alike. The page then reaches no change by forcing, which
 * is the expected outcome there and no sign of a missing state, so it tries no real hover or focus.
 *
 * The run builds the component sets with `buildComponentSets()` in its own process, so the
 * expectation follows the recipes the browser renders and never a stale `spec.json`.
 */

import { isDeepStrictEqual } from "node:util";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { variantKey } from "../components/component-spec.ts";
import type { BoxSpec, ColorSpec, ComponentSetSpec, InstanceOverride } from "../components/kit-spec.ts";
import { ownKey } from "../components/own-key.ts";
import { forcedPseudoClasses, restingTwin } from "./cells.ts";
import type { PreviewTheme } from "./preview-theme.ts";

/**
 * The color a `Fuse tokens` variable holds in one theme, or undefined for a variable the theme does
 * not resolve to a color, such as a role tint or a radius.
 */
export type TokenColorOf = (name: string) => ColorSpec | undefined;

/**
 * The variant keys of the forced-state cells whose built variant draws as its resting twin's in one
 * theme: equal once each `Fuse tokens` color both bind resolves to the theme's color.
 *
 * @param componentSets - The built component sets.
 * @param colorOf - The theme's color of a token, from {@link tokenColorsIn}.
 * @returns The key of each hover or focus variant whose root spec equals the root spec of the
 *   same cell at rest, with the theme's colors in place of the tokens it resolves.
 */
export function unchangedByDesign(
  componentSets: readonly Pick<ComponentSetSpec, "key" | "axes" | "variants">[],
  colorOf: TokenColorOf
): ReadonlySet<string> {
  const unchanged = new Set<string>();
  for (const set of componentSets) {
    const byKey = new Map(set.variants.map((variant) => [variant.key, variant]));
    for (const variant of set.variants) {
      if (forcedPseudoClasses(variant.properties).length === 0) {
        continue;
      }
      const twin = byKey.get(variantKey(set, restingTwin(variant.properties)));
      if (
        twin !== undefined &&
        isDeepStrictEqual(inTheme(twin.root, colorOf), inTheme(variant.root, colorOf))
      ) {
        unchanged.add(variant.key);
      }
    }
  }
  return unchanged;
}

/**
 * The theme's color of each token, for a preview's theme: the literal at the end of the token's
 * reference chain in the theme's variant, brand and segment, in its scheme.
 *
 * @param theme - The theme a preview stamps.
 * @returns The color of a color token, or undefined for any other name, or for every name where the
 *   catalog holds no such theme.
 */
export function tokenColorsIn(theme: PreviewTheme): TokenColorOf {
  const resolved = resolveThemeCatalog().themes.find(
    ({ input }) =>
      input.variant === theme.variant && input.brand === theme.brand && input.segment === theme.segment
  );
  const tokens = resolved?.schemes[theme.scheme].tokens;
  return (name) => {
    if (tokens === undefined || !ownKey(tokens, name)) {
      return undefined;
    }
    const entry = tokens[name];
    if (entry.kind !== "color") {
      return undefined;
    }
    const { r, g, b, alpha } = entry.value;
    return { kind: "literal", color: { r, g, b, a: alpha } };
  };
}

/** A color as the theme resolves it, where it is a `Fuse tokens` variable the theme gives a color. */
type ThemeColor = (color: ColorSpec) => ColorSpec;

/** An instance override with its colors as the theme resolves them. */
function overrideInTheme(override: InstanceOverride, paint: ThemeColor): InstanceOverride {
  switch (override.field) {
    case "cornerRadius":
    case "textAlign":
      return override;
    case "effects":
      return {
        ...override,
        shadows: override.shadows.map((shadow) => ({ ...shadow, color: paint(shadow.color) })),
      };
    case "fill":
    case "strokeColor":
      return override.color === undefined ? override : { ...override, color: paint(override.color) };
    default:
      return { ...override, color: paint(override.color) };
  }
}

/**
 * A box with each `Fuse tokens` color it paints, at any depth, as the theme resolves it. An instance
 * layer's own colors are its overrides; the inner set paints the rest, which resolves there.
 */
function inTheme<Box extends BoxSpec>(box: Box, colorOf: TokenColorOf): Box {
  const paint: ThemeColor = (color) =>
    color.kind === "variable" && color.variable.collection === "Fuse tokens"
      ? (colorOf(color.variable.name) ?? color)
      : color;
  return {
    ...box,
    fill: box.fill === undefined || box.fill.kind === "image" ? box.fill : paint(box.fill),
    stroke: box.stroke === undefined ? undefined : { ...box.stroke, color: paint(box.stroke.color) },
    shadows: box.shadows.map((shadow) => ({ ...shadow, color: paint(shadow.color) })),
    children: box.children.map((child) => {
      switch (child.kind) {
        case "frame":
          return inTheme(child, colorOf);
        case "instance":
          return child.overrides === undefined
            ? child
            : { ...child, overrides: child.overrides.map((override) => overrideInTheme(override, paint)) };
        default:
          return { ...child, color: paint(child.color) };
      }
    }),
  };
}
