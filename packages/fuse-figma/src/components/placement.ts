/**
 * Where the parts of a box sit, read from the CSS that places them rather than from auto layout:
 * `position` and the centering pattern, an absolute part at its parent's top left, a translate
 * along a row, a `scale`, and the `rotate` of a part or an icon. `box-mapping.ts` maps each box,
 * then hands this module the box's layout and the parts it mapped, and gets back the box's primary
 * alignment and the parts' layers, absolute where they sit outside the flow. A part that scales
 * draws as a slot around a dot, which the set's topology decides once for every cell.
 */
import { listNames, outOfFlow } from "./box-sizing";
import type { Room } from "./box-sizing";
import { splitClasses } from "./cascade";
import type { CoverageNote, LayerStyle } from "./cascade";
import { splitClassName } from "./class-name";
import type { Cell, PartDefinition } from "./component-spec";
import {
  describeNumber,
  evaluateLength,
  evaluateLengthOf,
  evaluateNumber,
  evaluatePercentage,
  normalizeCss,
  readNumber,
  splitTopLevel,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { fixedLength, NO_LIMITS, ZERO } from "./kit-spec";
import type {
  AbsoluteSpec,
  BoxSpec,
  CounterAlignSpec,
  DirectionSpec,
  FrameLayerSpec,
  NumberSpec,
  PrimaryAlignSpec,
  RotationSpec,
  SizeSpec,
  StrokeSpec,
} from "./kit-spec";
import type { CompiledUtilities } from "./utility-css";

/** How a box lays out its layers, as the box mapping read it. */
export type Layout = {
  /** Whether the box is a flex box, which lays out its layers along its direction. */
  readonly flex: boolean;
  /**
   * The flex box's direction, a row or a column. A `-webkit-box` that clamps its text is a column,
   * and every other box is horizontal.
   */
  readonly direction: DirectionSpec;
  readonly primaryAlign: PrimaryAlignSpec;
  readonly counterAlign: CounterAlignSpec;
  /** Where `justify-content` packs the layers, or `unset` where nothing sets it. */
  readonly justify: PrimaryAlignSpec | "unset";
};

/** The lengths of a row that place a part along it. The width is undefined where the row hugs it. */
type RowSize = {
  readonly width: NumberSpec | undefined;
  readonly stroke: StrokeSpec | undefined;
  readonly paddingLeft: NumberSpec;
  readonly paddingRight: NumberSpec;
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
  /**
   * How many layers sit in the box's flow in the cell: its parts, icons and label, but no part that
   * `position: absolute` takes out of it.
   */
  readonly layers: number;
  readonly size: RowSize;
};

/** Where a box places its parts: its primary alignment, and each part's layer, absolute where it sits outside the flow. */
export type Placement = {
  readonly primaryAlign: PrimaryAlignSpec;
  readonly layers: readonly FrameLayerSpec[];
};

/**
 * Read where each part of a box sits, and the box's primary alignment. A part that centers itself
 * by absolute position, one absolute at the box's top left, or one moved along a row by a
 * translate, reads here. A translate on the one part of a flex row sets the row's alignment.
 *
 * @param parent - The box that holds the parts.
 * @param parts - The parts the cell renders in it, as mapped.
 * @returns The box's primary alignment, the translate's where one maps, else the layout's, and the
 *   parts' layers in order.
 */
export function placeParts(parent: ParentBox, parts: readonly PlacedPart[]): Placement {
  const centering = centersAlone(parent, parts) ? "centers-its-one-layer" : "other";
  const layers = parts.map(({ style, layer }) => {
    const absolute = readAbsoluteStart(style, layer, parent.style);
    switch (absolute.kind) {
      case "absolute":
        return { ...layer, absolute: absolute.at };
      case "refused":
        return layer;
      case "other":
        readPosition(style, centering);
        return layer;
    }
  });
  return { primaryAlign: alignAlongRow(parent, parts), layers };
}

/**
 * Whether a box's auto layout centers on both axes the one part it holds outside its flow, with
 * nothing in its flow, so the part is the only layer the auto layout draws.
 */
function centersAlone({ layout, layers }: ParentBox, parts: readonly PlacedPart[]): boolean {
  return (
    layout.primaryAlign === "CENTER" && layout.counterAlign === "CENTER" && layers === 0 && parts.length === 1
  );
}

/** The primary alignment of a box: a translate's on the one layer of a flex row, a part, else the layout's. */
function alignAlongRow(parent: ParentBox, parts: readonly PlacedPart[]): PrimaryAlignSpec {
  const { layout, layers } = parent;
  const flowing = parts.filter((part) => !outOfFlow(part.style));
  const [only] = flowing;
  if (
    only === undefined ||
    flowing.length !== 1 ||
    layers !== 1 ||
    !layout.flex ||
    layout.direction !== "HORIZONTAL"
  ) {
    return layout.primaryAlign;
  }
  const size = {
    width: fixedLength(only.layer.sizing.horizontal),
    height: fixedLength(only.layer.sizing.vertical),
  };
  const moved = readTranslate(only.style, size, {
    contentWidth: contentWidth(parent.style, parent.size),
    justify: layout.justify,
  });
  return moved ?? layout.primaryAlign;
}

/** The margin properties, physical and logical, as Tailwind compiles `m-*`, `mx-*`, `ms-*` and the rest. */
const MARGINS = [
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
] as const;

/** The margins above and below a box, which leave its width alone. The `margin` shorthand sets all four. */
const VERTICAL_MARGINS: ReadonlySet<string> = new Set([
  "margin-top",
  "margin-bottom",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
]);

/**
 * Read where the root sits. The root has no parent to center it, so `relative` drops and any
 * other position stays unmapped. It sits in no flex line either, so `align-self: auto`, the
 * initial value, drops, and any other alignment, such as `stretch`, stays unmapped. A `flex` that
 * grows or shrinks it along a line drops whatever its value, as Empty's `flex-1` does. Nor does it sit
 * in a line of text, so `vertical-align`, which places an inline box in its line, drops whatever
 * its value, as Avatar's `align-middle` does. A margin lies outside the box and spaces it from its
 * siblings and its parent's edge, and the root sits alone in its component set, so a margin drops,
 * as Field legend's `mb-3` does. A block whose width its container gives it is the exception: its
 * width is the container's less its horizontal margins (CSS 2.1 §10.3.3), which the build does not
 * subtract, so those margins stay unmapped.
 *
 * @param style - The root's style.
 * @param room - What the root's container gives it, whose automatic width says whether the root
 *   takes the preview width.
 */
export function placeRoot(style: LayerStyle, room: Room): void {
  readPosition(style, "other");
  style.read(
    "align-self",
    (value) => (normalizeCss(value) === "auto" ? value : undefined),
    () => ({
      outcome: "dropped",
      detail: "the component's root sits in no row, and auto asks for no alignment",
    })
  );
  style.read(
    "vertical-align",
    (value) => value,
    () => ({ outcome: "dropped", detail: "the component's root sits in no line box, so no line aligns it" })
  );
  style.read(
    "flex",
    (value) => value,
    () => ({
      outcome: "dropped",
      detail: "the component's root sits in no flex line, so nothing grows or shrinks it",
    })
  );
  const width = normalizeCss(style.resolved("width") ?? "auto");
  const widthFromContainer = room.horizontal.auto.kind !== "hug" && width === "auto";
  for (const property of MARGINS) {
    if (widthFromContainer && !VERTICAL_MARGINS.has(property)) {
      style.mark(
        property,
        "unmapped",
        "the root's width is its container's less this margin, which the build does not subtract"
      );
      continue;
    }
    style.read(
      property,
      (value) => value,
      () => ({
        outcome: "dropped",
        detail:
          "the component's root sits alone in its component set, so its margin spaces it from nothing the set draws",
      })
    );
  }
}

/** A part's physical margins, which the frame around the part draws as its padding. */
const PART_MARGINS = ["margin-top", "margin-right", "margin-bottom", "margin-left"] as const;

/**
 * Draw a part's margins. A flex item's margins add to the space between it and its siblings and its
 * parent's edge, and never collapse (CSS Flexbox 1 §4.2), so a transparent frame around the part,
 * hugging it, whose padding is the margins, draws the part's margin box. The frame keeps the part's
 * key, name and BOOLEAN property, so hiding the part hides its margin too, and the part's own box
 * sits in it as a layer named `box`. Only `margin-top`, `margin-right`, `margin-bottom` and
 * `margin-left` map, at a length of zero or more, on a part in a flex parent's flow whose sides are
 * fixed or hug: a negative margin pulls a sibling closer, which no padding draws, a margin beside a
 * fill takes room from it, and a logical or shorthand margin stays unmapped. Where any of them does
 * not map, none does, so no frame draws part of a margin.
 *
 * @param style - The part's style.
 * @param layer - The part's layer as the mapping drew it.
 * @param parent - Whether the part's parent is a flex box.
 * @param variables - The synced variables a margin can bind.
 * @returns The frame around the part, or the layer as it was where it has no margin that maps.
 */
export function wrapMargins(
  style: LayerStyle,
  layer: FrameLayerSpec,
  parent: Pick<Layout, "flex">,
  variables: VariableIndex
): FrameLayerSpec {
  const set = PART_MARGINS.filter((property) => style.has(property));
  const fixedOrHugs = layer.sizing.horizontal.kind !== "fill" && layer.sizing.vertical.kind !== "fill";
  const length = (value: string): NumberSpec | undefined => {
    const spec = readNumber(value, variables);
    return spec?.kind === "literal" && spec.value < 0 ? undefined : spec;
  };
  const maps = set.every((property) => length(style.resolved(property) ?? "") !== undefined);
  if (set.length === 0 || !parent.flex || outOfFlow(style) || !fixedOrHugs || !maps) {
    return layer;
  }
  const margin = (property: (typeof PART_MARGINS)[number]): NumberSpec =>
    style.read(property, length, (spec) =>
      spec.kind === "literal"
        ? {
            outcome: "literal",
            detail: `${spec.value}px of padding on a frame around the part, the space the margin adds`,
          }
        : describeNumber(spec)
    ) ?? ZERO;
  const { visibleProperty, ...box } = layer;
  const frame: FrameLayerSpec = {
    kind: "frame",
    key: layer.key,
    name: layer.name,
    direction: "HORIZONTAL",
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: margin("margin-top"),
    paddingRight: margin("margin-right"),
    paddingBottom: margin("margin-bottom"),
    paddingLeft: margin("margin-left"),
    itemSpacing: ZERO,
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [{ ...box, key: "box", name: "box" }],
  };
  return visibleProperty === undefined ? frame : { ...frame, visibleProperty };
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
  const { sizing, limits, cornerRadius, stroke } = box;
  const dot: FrameLayerSpec = {
    kind: "frame",
    key: "dot",
    name: "dot",
    ...box,
    sizing: {
      horizontal: scaledSize(sizing.horizontal, share),
      vertical: scaledSize(sizing.vertical, share),
    },
    limits: NO_LIMITS,
    cornerRadius: scaled(cornerRadius, share),
    stroke: stroke === undefined ? undefined : scaledStroke(stroke, share),
  };
  return {
    direction: "HORIZONTAL",
    sizing,
    limits,
    clips: false,
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

/** How the coverage table names an absolute part's place. */
const AT_TOP_LEFT =
  "an absolute layer at its parent's top left, which keeps its share of the parent's width and stretches with its height";

/** The properties whose zero, or absence, leaves a parent's padding box where its border box is. */
const FLUSH = ["padding-top", "padding-right", "padding-bottom", "padding-left", "border-width"] as const;

/** The limits that would hold an absolute part's share of its parent where Figma's constraints scale it. */
const SHARE_BOUNDS = ["min-width", "max-width", "min-height", "max-height"] as const;

/**
 * What {@link readAbsoluteStart} made of a part: an absolute layer at its parent's top left, a part
 * of that shape it refused and recorded as unmapped, or any other part, which the other readers
 * place.
 */
type AbsoluteRead =
  | { readonly kind: "absolute"; readonly at: AbsoluteSpec }
  | { readonly kind: "refused" }
  | { readonly kind: "other" };

/**
 * Read `absolute top-0 left-0` as an absolute layer at its parent's top left, as a meter's fill sits
 * in its bar. The parent must be positioned, so it is the part's containing block, and hold no
 * padding or border, so its padding box, where the offsets start, is the frame Figma places the
 * layer in. The part's width must be a share of the parent's, which keeps its share as the parent
 * grows, as Figma's SCALE does, and its height the parent's whole height, as `100%` or `inherit` take
 * it, which keeps both edges, as STRETCH does (P8). The room the part had resolved both to literals.
 * A `min-*` or `max-*` on the part bounds its share, which CSS holds as the parent grows and Figma's
 * constraints would carry past, so such a part stays unmapped and its row names the bound. Every
 * other offset, length or parent leaves the position to the other readers.
 *
 * @param style - The part's style.
 * @param layer - The part, mapped in the room an absolute part has.
 * @param parent - The parent's style.
 * @returns The part's place, its refusal, or `other` where the pattern does not hold.
 */
function readAbsoluteStart(style: LayerStyle, layer: FrameLayerSpec, parent: LayerStyle): AbsoluteRead {
  const keyword = (reader: LayerStyle, property: string): string =>
    normalizeCss(reader.resolved(property) ?? "");
  const zero = (reader: LayerStyle, property: string): boolean =>
    evaluateLength(reader.resolved(property) ?? "") === 0;
  const holds =
    keyword(style, "position") === "absolute" &&
    !["", "static"].includes(keyword(parent, "position")) &&
    FLUSH.every((property) => !parent.has(property) || zero(parent, property)) &&
    zero(style, "top") &&
    zero(style, "left") &&
    !style.has("right") &&
    !style.has("bottom") &&
    evaluatePercentage(style.resolved("width") ?? "") !== undefined &&
    fixedLength(layer.sizing.horizontal)?.kind === "literal" &&
    (style.inherits("height") || evaluatePercentage(style.resolved("height") ?? "") === 1) &&
    fixedLength(layer.sizing.vertical)?.kind === "literal";
  if (!holds) {
    return { kind: "other" };
  }
  const bounds = SHARE_BOUNDS.filter((property) => style.has(property));
  const note: CoverageNote =
    bounds.length === 0
      ? { outcome: "literal", detail: AT_TOP_LEFT }
      : {
          outcome: "unmapped",
          detail: `${listNames(bounds)} ${bounds.length === 1 ? "bounds" : "bound"} the layer's share of its parent, which Figma's constraints would carry past the bound as the parent resizes`,
        };
  for (const property of ["position", "top", "left"]) {
    style.read(
      property,
      () => note,
      (decided) => decided
    );
  }
  return bounds.length === 0
    ? { kind: "absolute", at: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } } }
    : { kind: "refused" };
}

/**
 * The width of a box's content box: its fixed width less its side borders and padding.
 *
 * @returns The width in pixels, or undefined when the width, the border or a side's padding is
 *   not a literal.
 */
function contentWidth(reader: LayerStyle, box: RowSize): number | undefined {
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
  readonly justify: PrimaryAlignSpec | "unset";
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
  size: { readonly width: NumberSpec | undefined; readonly height: NumberSpec | undefined },
  row: Row
): PrimaryAlignSpec | undefined {
  const { width, height } = size;
  const position = normalizeCss(reader.raw("position") ?? "static");
  if (position !== "static" && position !== "relative") {
    return undefined;
  }
  return reader.read(
    "translate",
    (value): PrimaryAlignSpec | undefined => {
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
          literal(fixedLength(box.sizing.horizontal)) &&
          literal(fixedLength(box.sizing.vertical)) &&
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

/** A stroke at a share of its size: its weight and each dash and gap length scale with the paint. */
function scaledStroke(stroke: StrokeSpec, share: number): StrokeSpec {
  const weight = scaled(stroke.weight, share);
  const { dashPattern } = stroke;
  return dashPattern === undefined
    ? { ...stroke, weight }
    : { ...stroke, weight, dashPattern: dashPattern.map((length) => length * share) };
}

/** An axis's sizing at a share of its size: a fixed length scales, and hug or fill stays. */
function scaledSize(size: SizeSpec, share: number): SizeSpec {
  return size.kind === "fixed" ? { kind: "fixed", length: scaled(size.length, share) } : size;
}

/**
 * The degrees of a turn as Tailwind compiles it: `rotate-*` to an angle such as `180deg`, and
 * `-rotate-*` to `calc(90deg * -1)`.
 *
 * @returns The degrees clockwise, or undefined for any other value, such as another unit or an axis.
 */
function clockwiseDegrees(value: string): number | undefined {
  const angle = /^(-?\d*\.?\d+)deg$/.exec(value)?.[1];
  const negated = /^calc\((\d*\.?\d+)deg \* -1\)$/.exec(value)?.[1];
  if (angle !== undefined) {
    return Number(angle);
  }
  return negated === undefined ? undefined : -Number(negated);
}

/**
 * Read a part's or an icon's `rotate` as the turn Figma's `rotation` holds. CSS turns a box
 * clockwise about its center and leaves its layout as it was. Figma counts degrees
 * counterclockwise: on 2026-10-22 a real file read `relativeTransform` `[[0, -1], [1, 0]]` at -90, a
 * clockwise turn in its y-down space (PQ), so `rotate: 90deg` is -90. Figma lays a turned layer out
 * by its turned box (PR, PQ), so the plugin's kit check takes only the turns that keep the box.
 * `none` is no turn.
 *
 * @param style - The part's or the icon's style.
 * @returns The turn from -180 to 180, or undefined for none, no `rotate`, or one that does not map.
 */
export function readRotation(style: LayerStyle): RotationSpec | undefined {
  const rotation = style.read(
    "rotate",
    (value) => {
      const normalized = normalizeCss(value);
      const clockwise = normalized === "none" ? 0 : clockwiseDegrees(normalized);
      if (clockwise === undefined) {
        return undefined;
      }
      const turned = ((-clockwise % 360) + 360) % 360;
      return turned > 180 ? turned - 360 : turned;
    },
    (turn) => ({
      outcome: "literal",
      detail: turn === 0 ? "no turn" : `a rotation of ${turn}, counterclockwise as Figma counts it`,
    })
  );
  return rotation === 0 ? undefined : rotation;
}
