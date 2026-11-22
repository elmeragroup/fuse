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

/**
 * A corner radius at a share of its size, each literal corner scaled. A bound corner keeps its
 * variable, which only a share of 1 reaches.
 *
 * @param radius - The corner radius.
 * @param share - The share of its size the radius takes.
 * @returns The scaled radius.
 */
export function scaledCorners(radius: CornerRadiusSpec, share: number): CornerRadiusSpec {
  const scaled = (length: NumberSpec): NumberSpec =>
    length.kind === "literal" ? { kind: "literal", value: length.value * share } : length;
  return radius.kind === "corners"
    ? {
        kind: "corners",
        topLeft: scaled(radius.topLeft),
        topRight: scaled(radius.topRight),
        bottomRight: scaled(radius.bottomRight),
        bottomLeft: scaled(radius.bottomLeft),
      }
    : scaled(radius);
}
