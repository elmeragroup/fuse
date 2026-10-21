/**
 * The forced-state cells the kit draws exactly as at rest. A pressed Toggle fills with `muted`
 * through `aria-pressed:` and on hover through `enabled-hover:`, so its hover cell looks like its
 * resting twin in Figma and in the browser alike. The page then reaches no change by forcing or
 * by a real hover, which is the expected outcome there and no sign of a missing state.
 *
 * The run builds the component sets with `buildComponentSets()` in its own process, so the
 * expectation follows the recipes the browser renders and never a stale `spec.json`.
 */

import { isDeepStrictEqual } from "node:util";

import { variantKey } from "../components/component-spec.ts";
import type { ComponentSetSpec } from "../components/kit-spec.ts";
import { forcedPseudoClasses, restingTwin } from "./cells.ts";

/**
 * The variant keys of the forced-state cells whose built variant equals its resting twin's.
 *
 * @param componentSets - The built component sets.
 * @returns The key of each hover or focus variant whose root spec equals the root spec of the
 *   same cell at rest.
 */
export function unchangedByDesign(
  componentSets: readonly Pick<ComponentSetSpec, "key" | "axes" | "variants">[]
): ReadonlySet<string> {
  const unchanged = new Set<string>();
  for (const set of componentSets) {
    const byKey = new Map(set.variants.map((variant) => [variant.key, variant]));
    for (const variant of set.variants) {
      if (forcedPseudoClasses(variant.properties).length === 0) {
        continue;
      }
      const twin = byKey.get(variantKey(set, restingTwin(variant.properties)));
      if (twin !== undefined && isDeepStrictEqual(twin.root, variant.root)) {
        unchanged.add(variant.key);
      }
    }
  }
  return unchanged;
}
