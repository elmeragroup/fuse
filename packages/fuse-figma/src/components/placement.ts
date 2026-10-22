/**
 * Where the parts of a box sit, read from the CSS that places them rather than from auto layout:
 * `position` and the centering pattern, a translate along a row, and a `scale`. `component-spec.ts`
 * maps each box, then hands this module the box's layout and the parts it mapped, and gets back
 * the box's primary alignment. A part that scales draws as a slot around a dot, which the set's
 * topology decides once for every cell.
 */
import { splitClasses } from "./cascade";
import type { LayerStyle } from "./cascade";
import { splitClassName } from "./class-name";
import type { Cell, PartDefinition } from "./component-spec";
import {
  evaluateLengthOf,
  evaluateNumber,
  evaluatePercentage,
  normalizeCss,
  splitTopLevel,
} from "./css-values";
import { ZERO } from "./kit-spec";
import type { AlignSpec, BoxSpec, FrameLayerSpec, NumberSpec } from "./kit-spec";
import type { CompiledUtilities } from "./utility-css";

/** How a box lays out its layers, as the box mapping read it. */
export type Layout = {
  /** Whether the box is a flex box whose `flex-direction` is unset or `row`, a horizontal auto layout. */
  readonly flexRow: boolean;
  readonly primaryAlign: AlignSpec;
  readonly counterAlign: AlignSpec;
  /** Where `justify-content` packs the layers, or `unset` where nothing sets it. */
  readonly justify: AlignSpec | "unset";
};

/** A part a box holds: its computed style and the layer the mapping drew for it. */
export type PlacedPart = {
  readonly style: LayerStyle;
  readonly layer: FrameLayerSpec;
};

/** The box that holds the parts, as far as placing them needs to know. */
export type ParentBox = {
  readonly style: LayerStyle;
  readonly layout: Layout;
  /** How many layers the box holds in the cell, its parts among them. */
  readonly layers: number;
  readonly size: Pick<BoxSpec, "width" | "stroke" | "paddingLeft" | "paddingRight">;
};

/**
 * Read where each part of a box sits, and the box's primary alignment. A part that centers itself
 * by absolute position, or one moved along a row by a translate, reads here. A translate on the
 * one part of a flex row sets the row's alignment.
 *
 * @param parent - The box that holds the parts.
 * @param parts - The parts the cell renders in it, as mapped.
 * @returns The box's primary alignment: the translate's where one maps, else the layout's.
 */
export function placeParts(parent: ParentBox, parts: readonly PlacedPart[]): AlignSpec {
  const { layout, layers } = parent;
  const centering =
    layout.primaryAlign === "CENTER" && layout.counterAlign === "CENTER" && layers === 1
      ? "centers-its-one-layer"
      : "other";
  for (const part of parts) {
    readPosition(part.style, centering);
  }
  const [only] = parts;
  if (only === undefined || layers !== 1 || !layout.flexRow) {
    return layout.primaryAlign;
  }
  const moved = readTranslate(only.style, only.layer, {
    contentWidth: contentWidth(parent.style, parent.size),
    justify: layout.justify,
  });
  return moved ?? layout.primaryAlign;
}

/**
 * Read where the root sits. The root has no parent to center it, so `relative` drops and any
 * other position stays unmapped.
 *
 * @param style - The root's style.
 */
export function placeRoot(style: LayerStyle): void {
  readPosition(style, "other");
}

/**
 * The parts whose classes set `scale` in some cell of the matrix, under any variant. Each draws as
 * a slot around a dot in every cell, so every cell has the same layer tree. The build asks once per
 * set, before it maps a cell.
 *
 * @param parts - Every part of the component, at any depth.
 * @param cells - Every cell of its matrix.
 * @param compiled - The compiled utilities, which say what each class sets.
 * @returns Each such part.
 */
export function partsThatScale(
  parts: readonly PartDefinition[],
  cells: readonly Cell[],
  compiled: CompiledUtilities
): ReadonlySet<PartDefinition> {
  const setsScale = (className: string): boolean =>
    compiled.rules
      .get(splitClassName(className).utility)
      ?.declarations.some((declaration) => declaration.property === "scale") === true;
  return new Set(
    parts.filter((part) => cells.some((cell) => splitClasses(part.classesFor(cell)).some(setsScale)))
  );
}

/**
 * Draw a part that scales: a transparent slot at its layout size, centering a dot that holds the
 * part's paint and layers at the share of its size its `scale` takes, 1 where no scale applies.
 *
 * @param style - The part's style.
 * @param box - The part, mapped at its layout size.
 * @returns The slot, without its key and name.
 */
export function slotAroundDot(style: LayerStyle, box: BoxSpec): BoxSpec {
  const share = readScale(style, box);
  const { width, height, minWidth, cornerRadius, stroke } = box;
  const dot: FrameLayerSpec = {
    kind: "frame",
    key: "dot",
    name: "dot",
    ...box,
    width: width === undefined ? undefined : scaled(width, share),
    height: height === undefined ? undefined : scaled(height, share),
    minWidth: undefined,
    cornerRadius: scaled(cornerRadius, share),
    stroke: stroke === undefined ? undefined : { ...stroke, weight: scaled(stroke.weight, share) },
  };
  return {
    width,
    height,
    minWidth,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [dot],
  };
}

/**
 * How a parent lays out its layers, as far as a positioned part needs to know: an auto layout
 * centered on both axes around this one layer, or anything else, which is also what the root has.
 */
type ParentLayout = "centers-its-one-layer" | "other";

/**
 * Read where a box sits. A `relative` box stays where the flow puts it and only anchors positioned
 * descendants, so it drops. `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` puts
 * the box's center on its containing block's center. Inside a parent whose auto layout centers it
 * as its one layer, that is where Figma draws it too, assuming the parent sits centered in the
 * containing block, as Radio's indicator does in its root. Every other position, offset or
 * translate stays unmapped.
 *
 * @param reader - The box's style.
 * @param parent - How the box's parent lays it out. The root passes `other`.
 */
function readPosition(reader: LayerStyle, parent: ParentLayout): void {
  const translate = splitTopLevel(normalizeCss(reader.resolved("translate") ?? ""), " ").map(
    evaluatePercentage
  );
  const centered =
    parent === "centers-its-one-layer" &&
    normalizeCss(reader.raw("position") ?? "") === "absolute" &&
    ["top", "left"].every((property) => evaluatePercentage(reader.resolved(property) ?? "") === 0.5) &&
    translate.length === 2 &&
    translate.every((share) => share === -0.5);
  if (centered) {
    for (const property of ["position", "top", "left", "translate"]) {
      reader.read(
        property,
        (value) => value,
        () => ({
          outcome: "literal",
          detail: "centered on its containing block, as its parent's auto layout centers it",
        })
      );
    }
    return;
  }
  reader.read(
    "position",
    (value) => (normalizeCss(value) === "relative" ? value : undefined),
    () => ({
      outcome: "dropped",
      detail: "it only anchors positioned descendants, which auto layout does not need",
    })
  );
}

/**
 * The width of a box's content box: its fixed width less its side borders and padding.
 *
 * @returns The width in pixels, or undefined when the width, the border or a side's padding is
 *   not a literal.
 */
function contentWidth(
  reader: LayerStyle,
  box: Pick<BoxSpec, "width" | "stroke" | "paddingLeft" | "paddingRight">
): number | undefined {
  const { width, stroke, paddingLeft, paddingRight } = box;
  const border = reader.has("border-width") ? stroke?.weight : ZERO;
  return width?.kind === "literal" &&
    border?.kind === "literal" &&
    paddingLeft.kind === "literal" &&
    paddingRight.kind === "literal"
    ? width.value - 2 * border.value - paddingLeft.value - paddingRight.value
    : undefined;
}

/** What a part moved along its parent's row needs to know of the row. */
type Row = {
  /** The width of the row's content box, or undefined where it is not fixed. */
  readonly contentWidth: number | undefined;
  /** Where `justify-content` packs the row's children, or `unset` where nothing sets it. */
  readonly justify: AlignSpec | "unset";
};

/** How far apart two lengths in pixels may be and still count as one. */
const SAME_LENGTH = 1e-6;

/**
 * Read a translate on the one part of a row as the row's alignment. A row that packs its children
 * at the start, as an unset `justify-content` does, holds the part at the start of its content box,
 * and the translate moves the part's border box from there, a percentage taking the part's own
 * width. A move of 0 leaves the part at the start, MIN. A move by the content width less the part's
 * width puts it flush with the end, MAX. Every other move, a vertical one, a part without a fixed
 * size and a row without a fixed width stay unmapped, and so does a row whose `justify-content`
 * disagrees.
 *
 * @param reader - The part's style.
 * @param size - The part's width and height.
 * @param row - The part's parent row.
 * @returns The row's alignment, or undefined when the part sets no translate or it does not map.
 */
function readTranslate(
  reader: LayerStyle,
  size: Pick<BoxSpec, "width" | "height">,
  row: Row
): AlignSpec | undefined {
  const { width, height } = size;
  const position = normalizeCss(reader.raw("position") ?? "static");
  if (position !== "static" && position !== "relative") {
    return undefined;
  }
  return reader.read(
    "translate",
    (value): AlignSpec | undefined => {
      // A translate with one length moves along x only.
      const [x = "", y = "0", ...z] = splitTopLevel(normalizeCss(value), " ");
      if (row.contentWidth === undefined || width?.kind !== "literal" || height?.kind !== "literal") {
        return undefined;
      }
      if (z.length > 0 || evaluateLengthOf(y, height.value) !== 0) {
        return undefined;
      }
      const moved = evaluateLengthOf(x, width.value);
      const align =
        moved === 0
          ? "MIN"
          : moved !== undefined && Math.abs(moved - (row.contentWidth - width.value)) < SAME_LENGTH
            ? "MAX"
            : undefined;
      // The move counts from the start, so a row that packs its children elsewhere moves the part
      // from another place, and one that packs them at the start says MIN.
      return row.justify === "unset" || (row.justify === "MIN" && align === "MIN") ? align : undefined;
    },
    (align) => ({
      outcome: "literal",
      detail:
        align === "MIN"
          ? "at the start of its parent's row, where it sits unmoved"
          : "at the end of its parent's row, flush with the end of the content box",
    })
  );
}

/**
 * Read a part's `scale` as the share of its size its paint takes. CSS draws a scaled box's fill,
 * border and corner at that share around its center, and leaves its layout size as it was. Only a
 * scale the same on both axes, of a box with fixed sides, literal lengths, no shadow and no layers
 * of its own maps, since Figma cannot scale a bound length or a child.
 *
 * @param reader - The part's style.
 * @param box - The part, mapped at its layout size.
 * @returns The share, 1 where no scale applies or the scale does not map.
 */
function readScale(reader: LayerStyle, box: BoxSpec): number {
  const literal = (spec: NumberSpec | undefined): boolean => spec?.kind === "literal";
  return (
    reader.read(
      "scale",
      (value) => {
        const [x, y = x, ...z] = splitTopLevel(normalizeCss(value), " ").map(evaluateNumber);
        const scalable =
          literal(box.width) &&
          literal(box.height) &&
          literal(box.cornerRadius) &&
          (box.stroke === undefined || literal(box.stroke.weight)) &&
          box.shadows.length === 0 &&
          box.children.length === 0;
        return x !== undefined && x > 0 && y === x && z.length === 0 && scalable ? x : undefined;
      },
      (share) => ({
        outcome: "literal",
        detail: `a dot at ${Math.round(share * 10_000) / 100}% of the part's size, centered in a slot the part's size`,
      })
    ) ?? 1
  );
}

/** A length at a share of its size. A bound length keeps its variable, which only a share of 1 reaches. */
function scaled(spec: NumberSpec, share: number): NumberSpec {
  return spec.kind === "literal" ? { kind: "literal", value: spec.value * share } : spec;
}
