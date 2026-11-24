import * as Oklch from "@elmeragroup/color/oklch";

import { tokenOklch } from "../token-color";
import type { LayerTokens, TokenContract } from "./contract";
import { WHITE } from "./primitives";
import { literalOf, readableTone, TEXT_FLOOR, toneContrast } from "./readable-tone";

/** The two derived roles that paint the brand on the sidebar. */
export type SidebarBrandPair = Pick<TokenContract, "sidebar-brand" | "sidebar-brand-foreground">;

/**
 * The sidebar's brand pair for one composed theme. `--brand` stays the brand's identity everywhere
 * else. On the sidebar the brand sets text and fills behind text, so both roles must clear 4.5:1
 * there. A brand that already does keeps the `var(--brand)` alias. Another brand takes the nearest
 * sampled lightness that does; see `readableTone`. The foreground is the brand's own
 * foreground when it passes on that tone, then white, then the sidebar's foreground, then the
 * sidebar itself, which passes by the tone's construction.
 *
 * @param tokens - Every layer-assigned role of one composed theme in one scheme.
 * @returns The `sidebar-brand` and `sidebar-brand-foreground` values, computed from the roles their
 *   `DERIVED_ROLES` entries name.
 * @throws When no sampled lightness of the brand reaches the floor on the sidebar, which is a
 *   defect in the palettes.
 */
export function readableSidebarBrand(tokens: LayerTokens): SidebarBrandPair {
  const sidebar = tokenOklch(literalOf(tokens, tokens.sidebar));
  const brand = tokenOklch(literalOf(tokens, tokens.brand));
  const tone = readableTone(brand, [sidebar]);
  const foregrounds = ["var(--brand-foreground)", WHITE, "var(--sidebar-foreground)"] as const;
  // The sidebar passes on the tone by the tone's construction, so it ends the preference.
  const foreground =
    foregrounds.find((value) => toneContrast(tokenOklch(literalOf(tokens, value)), tone) >= TEXT_FLOOR) ??
    "var(--sidebar)";
  return {
    "sidebar-brand": tone === brand ? "var(--brand)" : Oklch.format(tone),
    "sidebar-brand-foreground": foreground,
  };
}
