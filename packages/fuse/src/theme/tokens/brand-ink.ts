import * as Oklch from "@elmeragroup/color/oklch";

import { tokenOklch } from "../token-color";
import type { LayerTokens, TokenContract } from "./contract";
import { literalOf, readableTone } from "./readable-tone";

/**
 * The brand as text on the page and on a Card for one composed theme. `--brand` fills brand shapes
 * and is free to fall under 4.5:1 on those surfaces. A brand that reaches 4.5:1 on both keeps the
 * `var(--brand)` alias. Another brand takes the nearest sampled lightness that reaches it on both;
 * see `readableTone`.
 *
 * @param tokens - Every layer-assigned role of one composed theme in one scheme.
 * @returns The `brand-ink` value, computed from the roles its `DERIVED_ROLES` entry names.
 * @throws When no sampled lightness of the brand reaches the floor on both surfaces, which is a
 *   defect in the palettes.
 */
export function readableBrandInk(tokens: LayerTokens): Pick<TokenContract, "brand-ink"> {
  const brand = tokenOklch(literalOf(tokens, tokens.brand));
  const surfaces = [tokens.background, tokens.card].map((value) => tokenOklch(literalOf(tokens, value)));
  const tone = readableTone(brand, surfaces);
  return { "brand-ink": tone === brand ? "var(--brand)" : Oklch.format(tone) };
}
