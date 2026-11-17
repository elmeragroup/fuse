/**
 * A box's corner radius as the kit spec holds it: one length on every corner, or four that differ,
 * which the plugin writes to Figma's four corner radii.
 */
import type { NumberSpec } from "./kit-spec";

/**
 * A box's four corners where they differ, each a length, as Figma's `topLeftRadius`,
 * `topRightRadius`, `bottomRightRadius` and `bottomLeftRadius` hold them, each bound on its own.
 */
export type CornersSpec = {
  readonly kind: "corners";
  readonly topLeft: NumberSpec;
  readonly topRight: NumberSpec;
  readonly bottomRight: NumberSpec;
  readonly bottomLeft: NumberSpec;
};

/** A box's corner radius: one length on every corner, or four that differ. */
export type CornerRadiusSpec = NumberSpec | CornersSpec;

/**
 * The lengths a corner radius holds: its one length, or its four corners' in Figma's order.
 *
 * @param spec - The corner radius.
 * @returns The lengths.
 */
export function cornerLengths(spec: CornerRadiusSpec): readonly NumberSpec[] {
  return spec.kind === "corners" ? [spec.topLeft, spec.topRight, spec.bottomRight, spec.bottomLeft] : [spec];
}
