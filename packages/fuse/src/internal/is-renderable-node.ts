import type { ReactNode } from "react";

/**
 * Whether a node a caller handed over would paint anything. `presetGroup={showPresets &&
 * <PresetGroup />}` is the idiomatic conditional, so `false`, like `null`, `undefined` and `""`,
 * reads as nothing to render.
 *
 * @param node - The node.
 * @returns `false` for `null`, `undefined`, `false` and `""`.
 */
export function isRenderableNode(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}
