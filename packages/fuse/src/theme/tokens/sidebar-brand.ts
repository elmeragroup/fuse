import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Wcag from "@elmeragroup/color/wcag";

import { cssVarReference } from "../css-values";
import { tokenOklch } from "../token-color";
import { isDerivedTokenName, TOKEN_NAMES } from "./contract";
import type { LayerTokens, TokenContract } from "./contract";
import { PRIMITIVE_NAMES, PRIMITIVES, WHITE } from "./primitives";

// The text floor: `text-sidebar-brand` sets small copy on the sidebar, and a
// `bg-sidebar-brand` fill carries text.
const TEXT_FLOOR = 4.5;

const LIGHTNESS_STEP = 0.01;

/** The literal at the end of a value's `var()` chain, through the composed roles and the primitives. */
function literalOf(tokens: LayerTokens, value: string): string {
  const name = cssVarReference(value);
  if (name === undefined) {
    return value;
  }
  const role = TOKEN_NAMES.find((candidate) => candidate === name);
  if (role !== undefined && !isDerivedTokenName(role)) {
    return literalOf(tokens, tokens[role]);
  }
  const primitive = PRIMITIVE_NAMES.find((candidate) => candidate === name);
  if (primitive === undefined) {
    throw new Error(`${value} names neither a layer role nor a primitive`);
  }
  return literalOf(tokens, PRIMITIVES[primitive]);
}

function contrast(foreground: Oklch.Oklch, background: Oklch.Oklch): number {
  return getOrThrow(Wcag.contrastRatio(Oklch.toSrgb(foreground), Oklch.toSrgb(background)));
}

/**
 * The brand color at the first lightness, stepping away from the sidebar's, that reaches the
 * text floor on the sidebar. Each step keeps the hue and the chroma the sRGB gamut allows,
 * and is measured as its `oklch()` literal reads back, so the emitted value is the one that
 * passed.
 */
function readableTone(brand: Oklch.Oklch, sidebar: Oklch.Oklch): Oklch.Oklch {
  const direction = brand.l < sidebar.l ? -1 : 1;
  for (let step = 1; ; step++) {
    const lightness = Math.min(1, Math.max(0, brand.l + direction * step * LIGHTNESS_STEP));
    const components = { l: lightness, c: brand.c, h: brand.h, alpha: brand.alpha };
    const tone = tokenOklch(Oklch.format(Oklch.clampChromaToSrgb(getOrThrow(Oklch.make(components)))));
    if (contrast(tone, sidebar) >= TEXT_FLOOR) {
      return tone;
    }
    if (lightness === 0 || lightness === 1) {
      throw new Error(
        `No lightness of ${Oklch.format(brand)} reaches ${TEXT_FLOOR}:1 on the sidebar ${Oklch.format(sidebar)}`
      );
    }
  }
}

/** The two derived roles that paint the brand on the sidebar. */
export type SidebarBrandPair = Pick<TokenContract, "sidebar-brand" | "sidebar-brand-foreground">;

/**
 * The sidebar's brand pair for one composed theme. `--brand` stays the brand's identity
 * everywhere else. On the sidebar the brand sets text and fills behind text, so both roles
 * must clear 4.5:1 there. A brand that already does keeps the `var(--brand)` alias; another
 * takes the first tone, stepped in lightness away from the sidebar, that does. The foreground
 * is the brand's own foreground when it passes on that tone, then white, then the sidebar's
 * foreground, then the sidebar itself, which passes by the tone's construction.
 *
 * @param tokens - Every layer-assigned role of one composed theme in one scheme.
 * @returns The `sidebar-brand` and `sidebar-brand-foreground` values, computed from the
 *   roles their `DERIVED_ROLES` entries name.
 * @throws When no lightness of the brand reaches the floor on the sidebar, a defect in the
 *   palettes.
 */
export function readableSidebarBrand(tokens: LayerTokens): SidebarBrandPair {
  const sidebar = tokenOklch(literalOf(tokens, tokens.sidebar));
  const brand = tokenOklch(literalOf(tokens, tokens.brand));
  const tone = contrast(brand, sidebar) >= TEXT_FLOOR ? brand : readableTone(brand, sidebar);
  const foregrounds = ["var(--brand-foreground)", WHITE, "var(--sidebar-foreground)"] as const;
  // The sidebar passes on the tone by the tone's construction, so it ends the preference.
  const foreground =
    foregrounds.find((value) => contrast(tokenOklch(literalOf(tokens, value)), tone) >= TEXT_FLOOR) ??
    "var(--sidebar)";
  return {
    "sidebar-brand": tone === brand ? "var(--brand)" : Oklch.format(tone),
    "sidebar-brand-foreground": foreground,
  };
}
