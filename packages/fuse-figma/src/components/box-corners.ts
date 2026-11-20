import type { CornerRadiusSpec, CornersSpec } from "./corner-spec";
import { describeNumber, isInfiniteLength, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
/**
 * A box's corners: one `border-radius` on every corner, or a radius per corner where a class sets
 * one by its physical or logical name, as `first:rounded-t-lg` rounds a list's first row and a
 * range's `rounded-s-full` its first day. `box-mapping.ts` reads them once the box's sizing is known,
 * since an infinite radius takes its length from the box's sides.
 */
import type { SizingSpec } from "./kit-spec";
import { fixedLength } from "./kit-spec";
import type { NumberSpec } from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";

/** A corner as Figma names it, and the longhands that set it: physical, then logical. */
const CORNERS = [
  { key: "topLeft", physical: "border-top-left-radius", logical: "border-start-start-radius" },
  { key: "topRight", physical: "border-top-right-radius", logical: "border-start-end-radius" },
  { key: "bottomRight", physical: "border-bottom-right-radius", logical: "border-end-end-radius" },
  { key: "bottomLeft", physical: "border-bottom-left-radius", logical: "border-end-start-radius" },
] as const;

/** One of Figma's four corners. */
type Corner = (typeof CORNERS)[number];

/**
 * Read a box's corner radius: `border-radius` on every corner, or a radius per corner.
 *
 * @param reader - The box's style.
 * @param sides - The box's sizing, whose fixed sides an infinite `border-radius` reads, and the
 *   sizing with the literal length it holds on each axis it hugs, as `held-size.ts` reads it, whose
 *   sides an infinite radius per corner reads.
 * @param variables - The synced variables a radius can bind.
 * @returns The corner radius, or undefined where the box sets none or it does not map.
 */
export function readCorner(
  reader: LayerStyle,
  { sizing, held }: { readonly sizing: SizingSpec; readonly held: SizingSpec },
  variables: VariableIndex
): CornerRadiusSpec | undefined {
  const own = CORNERS.filter((corner) => cornerProperty(reader, corner) !== undefined);
  return own.length === 0 ? readUniform(reader, sizing, variables) : readCorners(reader, held, variables);
}

/** The longhand a box sets a corner by, physical or logical, or undefined for neither. */
function cornerProperty(reader: LayerStyle, corner: Corner): string | undefined {
  return [corner.physical, corner.logical].find((property) => reader.has(property));
}

/**
 * Read `border-radius` as the corner. An infinite radius, which `rounded-full` compiles to, reads
 * as half a side. CSS scales down radii whose sum exceeds a side, so it draws any radius above half
 * the shorter side as that half. With both sides fixed, the build writes that half. With one side
 * fixed, it writes half that side: on 2026-10-22 a real file drew a radius above half the shorter
 * side as that half and kept the written value (probe P10), so Figma draws it as CSS does whichever
 * side ends up shorter. A box with no fixed side has no length to halve, so its pill corner stays
 * unmapped.
 */
function readUniform(
  reader: LayerStyle,
  sizing: SizingSpec,
  variables: VariableIndex
): NumberSpec | undefined {
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const corner = reader.read(
    "border-radius",
    (value): { readonly radius: NumberSpec; readonly detail: string | undefined } | undefined => {
      const radius = readNumber(value, variables);
      if (radius !== undefined) {
        return { radius, detail: undefined };
      }
      if (!isInfiniteLength(value)) {
        return undefined;
      }
      if (width?.kind === "literal" && height?.kind === "literal") {
        const half = Math.min(width.value, height.value) / 2;
        return {
          radius: { kind: "literal", value: half },
          detail: `${half}px, half the shorter side, which CSS draws for any larger radius`,
        };
      }
      const fixedSide =
        width === undefined
          ? { side: "height", length: height }
          : height === undefined
            ? { side: "width", length: width }
            : undefined;
      if (fixedSide?.length?.kind !== "literal") {
        return undefined;
      }
      const half = fixedSide.length.value / 2;
      return {
        radius: { kind: "literal", value: half },
        detail: `${half}px, half the fixed ${fixedSide.side}, which Figma and CSS cap at half the shorter side`,
      };
    },
    ({ radius, detail }) => (detail === undefined ? describeNumber(radius) : { outcome: "literal", detail }),
    reader.feed("cornerRadius")
  );
  return corner?.radius;
}

/** A radius CSS takes as infinite, which the scaling below reads as this many pixels. */
const INFINITE_PX = 1e30;

/**
 * A corner's radius before CSS scales it: infinite, a literal, or a variable with the greatest value
 * it holds in any mode.
 */
type RawRadius =
  | { readonly kind: "infinite" }
  | { readonly kind: "literal"; readonly px: number }
  | { readonly kind: "variable"; readonly spec: NumberSpec; readonly most: number };

/**
 * Read a radius per corner where the box sets one by its own longhand, physical, or logical as the
 * kit's left-to-right, horizontal page names it (CSS Logical Properties 1 §6.2): `start-start` is the
 * top left, `start-end` the top right, `end-end` the bottom right and `end-start` the bottom left. A
 * corner the box names no longhand for takes 0.
 *
 * CSS scales every radius by one factor where the radii along a side add up past it (CSS Backgrounds
 * 3 §5.5), so `rounded-s-full` on a 36px square rounds its two left corners by 18px, and a 30px and a
 * 10px corner along a 36px side by 27px and 9px. Figma draws each corner on its own, capped at half
 * the shorter side (probe P10). So the radii map only on a box whose sides are literal, where the
 * radii CSS draws are each within half the shorter side, which Figma then draws as written: scaled
 * literals where CSS scales them, and a variable only where the greatest value it holds in any mode
 * leaves CSS nothing to scale and stays within that half, so every mode draws alike. Any other
 * corner set stays unmapped. A box that sets a corner longhand beside `border-radius` stays unmapped
 * too, since which one wins depends on their order, which the build does not read.
 */
function readCorners(
  reader: LayerStyle,
  sizing: SizingSpec,
  variables: VariableIndex
): CornersSpec | undefined {
  if (reader.has("border-radius")) {
    return undefined;
  }
  const raw = CORNERS.map((corner) => rawRadius(reader, corner, variables));
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const drawn =
    width?.kind === "literal" && height?.kind === "literal"
      ? drawnCorners(raw, width.value, height.value)
      : undefined;
  const [topLeft, topRight, bottomRight, bottomLeft] = drawn ?? [];
  const corners =
    topLeft === undefined || topRight === undefined || bottomRight === undefined || bottomLeft === undefined
      ? undefined
      : ({ kind: "corners", topLeft, topRight, bottomRight, bottomLeft } as const);
  for (const corner of CORNERS) {
    const property = cornerProperty(reader, corner);
    if (property === undefined) {
      continue;
    }
    const length = corners?.[corner.key];
    reader.read(
      property,
      () => length,
      (read): CoverageNote =>
        read.kind === "literal"
          ? {
              outcome: "literal",
              detail: `${read.value}px on the ${corner.key} corner, as CSS draws it on the box's sides`,
            }
          : describeNumber(read),
      reader.feed("cornerRadius")
    );
  }
  return corners;
}

/** A corner's radius before CSS scales it, or undefined for a value that reads as no length. */
function rawRadius(reader: LayerStyle, corner: Corner, variables: VariableIndex): RawRadius | undefined {
  const property = cornerProperty(reader, corner);
  const value = property === undefined ? "0px" : (reader.resolved(property) ?? "");
  if (isInfiniteLength(value)) {
    return { kind: "infinite" };
  }
  const spec = readNumber(value, variables);
  if (spec?.kind === "literal") {
    return { kind: "literal", px: spec.value };
  }
  const most = spec === undefined ? undefined : variables.maximum(spec.variable);
  return spec === undefined || most === undefined ? undefined : { kind: "variable", spec, most };
}

/**
 * The radii CSS draws on a box of literal sides (CSS Backgrounds 3 §5.5), each its radius times the
 * least of 1 and every side's length over the radii along it, a variable at its greatest value, or
 * undefined where Figma would draw one otherwise: a drawn radius past half the shorter side, which
 * Figma caps, or a variable CSS would scale in some mode, which one bound length cannot follow.
 */
function drawnCorners(
  raw: readonly (RawRadius | undefined)[],
  width: number,
  height: number
): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined ? [] : [each]));
  if (known.length !== raw.length) {
    return undefined;
  }
  const px = known.map((each) =>
    each.kind === "infinite" ? INFINITE_PX : each.kind === "literal" ? each.px : each.most
  );
  const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = px;
  const ratio = (length: number, sum: number) => (sum === 0 ? 1 : length / sum);
  const factor = Math.min(
    1,
    ratio(width, topLeft + topRight),
    ratio(height, topRight + bottomRight),
    ratio(width, bottomRight + bottomLeft),
    ratio(height, bottomLeft + topLeft)
  );
  const cap = Math.min(width, height) / 2;
  const scaled = factor < 1;
  const fits = px.every((radius) => radius * factor <= cap + 1e-9);
  if (!fits || (scaled && known.some((each) => each.kind === "variable"))) {
    return undefined;
  }
  return known.map((each, index): NumberSpec =>
    each.kind === "variable"
      ? each.spec
      : { kind: "literal", value: Math.round((px[index] ?? 0) * factor * 1e6) / 1e6 }
  );
}
