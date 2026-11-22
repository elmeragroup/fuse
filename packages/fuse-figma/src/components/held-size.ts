/**
 * The size a box that hugs holds where it holds one layer of a literal size: that layer's length and
 * the box's literal paddings and borders around it. A box that hugs takes its length from its
 * layers, which the spec draws as a hug, so a reader that needs the length in pixels, as an infinite
 * corner does, or a box whose one layer hides, which Figma's auto layout would let collapse, reads it
 * here.
 */
import type { BorderWidths } from "./box-paint";
import { evaluateLength, normalizeCss } from "./css-values";
import { outOfLayout } from "./kit-spec";
import type { ChildLayerSpec, LimitsSpec, SizeSpec, SizingSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The insets on each axis of a box: its paddings and borders. */
const INSETS = {
  horizontal: ["left", "right"],
  vertical: ["top", "bottom"],
} as const;

/**
 * The pixels a box's padding and border take on one side, or undefined where either is no literal.
 * The side's border width is the used width its stroke draws, as `borderWidths` in `box-paint.ts`
 * reads it from the declaration that wins the side, a shorthand such as `border: 2px solid` included.
 */
function sidePixels(reader: LayerStyle, borders: BorderWidths, side: keyof BorderWidths): number | undefined {
  const padding = evaluateLength(reader.resolved(`padding-${side}`) ?? "0px");
  const width = borders[side];
  return padding === undefined || width === undefined ? undefined : padding + width;
}

/**
 * A box's sizing with each axis it hugs read as the literal length it holds, where it holds one
 * layer in its flow whose length on that axis is a literal and its insets on that axis are literal
 * lengths. A `min-*` or `max-*` on the axis bounds that length as CSS does (CSS 2.1 §10.4, §10.7):
 * where the box's limits hold it as a literal, the length is clamped to it, the minimum winning a
 * conflict, and where the box sets one its limits do not hold as a literal, which could bind, the
 * axis stays as it was. Every other axis stays as it was.
 *
 * @param reader - The box's style, whose paddings and limits the length reads.
 * @param box - The box's sizing, the limits it maps, and its border widths, as `borderWidths` in
 *   `box-paint.ts` reads them.
 * @param children - The box's layers.
 * @returns The sizing.
 */
export function heldSizing(
  reader: LayerStyle,
  {
    sizing,
    limits,
    borders,
  }: { readonly sizing: SizingSpec; readonly limits: LimitsSpec; readonly borders: BorderWidths },
  children: readonly ChildLayerSpec[]
): SizingSpec {
  const flowing = children.filter((child) => !outOfLayout(child));
  const [only] = flowing;
  const held = (axis: "horizontal" | "vertical"): SizeSpec => {
    const size = sizing[axis];
    const own = only === undefined || flowing.length !== 1 ? undefined : literalLength(only, axis);
    const insets = INSETS[axis].map((side) => sidePixels(reader, borders, side));
    if (size.kind !== "hug" || own === undefined || insets.some((inset) => inset === undefined)) {
      return size;
    }
    const total = clamped(
      reader,
      axis,
      limits,
      insets.reduce<number>((sum, inset) => sum + (inset ?? 0), own)
    );
    if (total === undefined) {
      return size;
    }
    return { kind: "fixed", length: { kind: "literal", value: total } };
  };
  return { horizontal: held("horizontal"), vertical: held("vertical") };
}

/**
 * Whether a box's paddings and borders on an axis are literal lengths, which the length it holds adds.
 *
 * @param reader - The box's style.
 * @param borders - The box's border widths, as `borderWidths` in `box-paint.ts` reads them.
 * @param axis - The axis.
 * @returns True where every inset on the axis is a literal length.
 */
export function literalInsets(
  reader: LayerStyle,
  borders: BorderWidths,
  axis: "horizontal" | "vertical"
): boolean {
  return INSETS[axis].every((side) => sidePixels(reader, borders, side) !== undefined);
}

/** The limits each axis reads: its CSS properties, and the fields the box's limits hold them in. */
const LIMITS = {
  horizontal: { min: ["min-width", "minWidth"], max: ["max-width", "maxWidth"] },
  vertical: { min: ["min-height", "minHeight"], max: ["max-height", "maxHeight"] },
} as const;

/**
 * A length held to the box's limits on an axis, or undefined where the box sets a limit there that
 * its mapped limits hold as no literal, so it could bind at a length the build does not know.
 */
function clamped(
  reader: LayerStyle,
  axis: "horizontal" | "vertical",
  limits: LimitsSpec,
  length: number
): number | undefined {
  const bound = (side: "min" | "max"): number | null | undefined => {
    const [property, field] = LIMITS[axis][side];
    const written = normalizeCss(reader.resolved(property) ?? "none");
    if (["none", "auto", "0", "0px"].includes(written)) {
      return null;
    }
    const limit = limits[field];
    return limit?.kind === "literal" ? limit.value : undefined;
  };
  const min = bound("min");
  const max = bound("max");
  if (min === undefined || max === undefined) {
    return undefined;
  }
  const capped = max === null ? length : Math.min(length, max);
  return min === null ? capped : Math.max(capped, min);
}

/** A layer's literal length on an axis: a fixed literal, or an icon's literal size. */
function literalLength(layer: ChildLayerSpec, axis: "horizontal" | "vertical"): number | undefined {
  if (layer.kind === "icon") {
    return layer.size.kind === "literal" ? layer.size.value : undefined;
  }
  const size = layer.sizing[axis];
  return size.kind === "fixed" && size.length.kind === "literal" ? size.length.value : undefined;
}
