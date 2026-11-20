/**
 * Where an absolute part sits against its containing block, read once for frames and instances
 * alike into the one placement the spec holds (`EdgePlacementSpec`). An absolute box's offsets
 * measure from its containing block's padding edge (CSS 2.1 §10.3.7, §10.6.4), and Figma places a
 * layer from its parent's outer edge, so each distance is the offset and the parent's border on that
 * side. The parent is the containing block where it is positioned, or where the definition names the
 * positioned element around it with its border box. A static parent with no border also places the
 * part where the capture measured its border box as the padding box of a containing block above it
 * (`parentSpansBlock`), as Sheet's column spans the popup that places its corner close. There the
 * parent's outer edge is the block's padding edge, so each distance is the offset alone.
 *
 * On each axis the part sits one of five ways, each kept by its Figma constraint as the parent
 * resizes:
 *
 * - its start offset set and its end `auto`, at a length of its own that is one length in every
 *   mode: `start`, which MIN keeps;
 * - its end offset set and its start `auto`, at such a length: `end`, which MAX keeps;
 * - both offsets set at an `auto` length, which CSS stretches between them, or one offset set at
 *   `100%` of the parent's length, which ends that far past the other edge: `stretch`, which STRETCH
 *   keeps. `inherit` takes the parent's declared length, its whole one only where the parent has no
 *   limit, border or padding on the axis, so elsewhere it is a length of the part's own;
 * - a zero start offset at a share of the parent's length, in a parent with no border or padding on
 *   the axis whose length the room knows, so both ends stay shares of the parent's outer length:
 *   `scale`, which SCALE keeps, as a meter's fill keeps its share of the bar. A nonzero start, which
 *   CSS keeps fixed where SCALE would move it, leaves a share below the whole unmapped;
 * - for an instance down its parent, its top neither one length below the parent's top nor set,
 *   its centre one offset from the parent's centre in every mode: `centre`, which CENTER keeps (N11).
 *
 * An instance keeps the length its main gives it. Every offset, border and centre offset is one
 * length in every mode, affine in the synced variables with no variable left in it. A `min-*` other
 * than zero or a `max-*` other than `none`, a zero maximum included, on a `stretch` or `scale` axis
 * bounds a length CSS holds and Figma's constraints carry past (CSS 2.1 §10.4), so it leaves the
 * place unmapped, and so do offsets that leave a stretch no length, where CSS draws the box empty
 * (CSS 2.1 §10.3.7). A part that turns, moves by a translate or scales, an offset or length of any
 * other shape, both offsets beside a length of the part's own, and a containing block the parent is
 * not leave the part's place unmapped, an instance's with the reason.
 *
 * An instance at its parent's end across, at a width the capture did not measure one length in every
 * mode (`oneLength`), keeps its place only in a placement wrapper (`placement-wrapper.ts`), as
 * `wrapIfVarying` says, so the plan names the wrapper it needs.
 *
 * `box-mapping.ts` plans the place, and every length it sets, before the part maps, so the sizing
 * gives a `stretch` axis the length the parent leaves it and a refused place leaves it none, and
 * `placement.ts` reads it once the part maps.
 */
import type { Room } from "./box-sizing";
import {
  affineLength,
  constantOf,
  evaluatePercentage,
  normalizeCss,
  scaleAffine,
  sumAffine,
} from "./css-values";
import type { AffineLength } from "./css-values";
import type { AxisPlacementSpec, EdgePlacementSpec, InstanceAxisPlacementSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The properties that place a part on one axis, and its parent's borders and paddings there. */
type Axis = {
  readonly name: "horizontal" | "vertical";
  readonly start: string;
  readonly end: string;
  readonly length: string;
  readonly min: string;
  readonly max: string;
  readonly startBorder: string;
  readonly endBorder: string;
  readonly startPadding: string;
  readonly endPadding: string;
};

const HORIZONTAL: Axis = {
  name: "horizontal",
  start: "left",
  end: "right",
  length: "width",
  min: "min-width",
  max: "max-width",
  startBorder: "border-left-width",
  endBorder: "border-right-width",
  startPadding: "padding-left",
  endPadding: "padding-right",
};

const VERTICAL: Axis = {
  name: "vertical",
  start: "top",
  end: "bottom",
  length: "height",
  min: "min-height",
  max: "max-height",
  startBorder: "border-top-width",
  endBorder: "border-bottom-width",
  startPadding: "padding-top",
  endPadding: "padding-bottom",
};

/** The offsets of an absolute box. */
const OFFSETS = ["top", "right", "bottom", "left"] as const;

/** The positions whose box is the containing block of its absolute descendants (CSS 2.1 §10.1). */
const POSITIONED: ReadonlySet<string> = new Set(["relative", "absolute", "fixed", "sticky"]);

/** The properties that move a box from where its offsets put it. */
const MOVES = ["translate", "rotate", "scale", "transform"] as const;

/** What the place of an absolute part rests on in its parent. */
export type PlacementContext = {
  /** The style of the box that holds the part. */
  readonly parent: LayerStyle;
  /** The positioned element around the box with its border box, where the definition names one. */
  readonly positionedBy: string | undefined;
  /**
   * Whether the capture measured the parent's border box as the padding box of the part's
   * containing block, an element above the parent, in every mode (`parentSpansBlock`).
   */
  readonly parentSpansBlock: boolean;
  /**
   * The axes along which the capture measured the part one length in every mode (`oneLength`),
   * empty where it measured none.
   */
  readonly oneLength: ReadonlySet<"horizontal" | "vertical">;
  /** The styles of the parts in the parent's flow, which a centre offset's parent height reads. */
  readonly flow: readonly LayerStyle[];
  /** How many layers sit in the parent's flow: its parts, icons and label. */
  readonly layers: number;
  /**
   * The parent's padding box on each axis in pixels, where its lengths are literals, as the room an
   * absolute part has says: what the part's percentages take.
   */
  readonly paddingBox: { readonly horizontal: number | undefined; readonly vertical: number | undefined };
};

/** An axis as planned: its place, and the length a stretch leaves the part where the room knows it. */
type PlannedAxis = {
  readonly kind: "axis";
  readonly at: AxisPlacementSpec;
  /** The stretched length in pixels, where the parent's padding box is a literal. */
  readonly length: number | undefined;
};

/** Why a part has no place. */
type Refused = { readonly kind: "refused"; readonly why: string };

/**
 * An instance placed at its parent's end across, at a width a mode can change, which the build draws
 * in a placement wrapper (`placement-wrapper.ts`): `outer` is the parent's outer width where the room
 * knows it, the width the wrapper stretches to.
 */
export type Wrapped = { readonly outer: number | undefined };

/** A part's place as planned before it maps, or why it has none. */
export type PlacementPlan =
  | {
      readonly kind: "planned";
      readonly horizontal: PlannedAxis;
      readonly vertical: PlannedAxis;
      /** The wrapper an instance's place needs, absent for a part placed by its own constraints. */
      readonly wrapped?: Wrapped;
    }
  | Refused;

/** The kind of layer a part draws as, which decides the places it can take. */
export type PlacedLayer = "frame" | "instance";

/** A refusal with its reason. */
const refused = (why: string): Refused => ({ kind: "refused", why });

const NOT_POSITIONED =
  "the absolute part's containing block lies above its parent, which the set does not draw";
const BORDERED_SPAN =
  "the absolute part's containing block lies above its parent, which spans it but draws a border inside the block's padding box";
const MOVED = "a turn, a translate or a scale moves the absolute part off its offsets";
const UNPLACED = refused(
  "the absolute part's offsets and lengths place it neither by its parent's edges nor its centre in every mode"
);
const NO_ROOM = refused(
  "the absolute part's offsets leave it no length between its parent's edges, where CSS draws it empty"
);
/**
 * Why an absolute part has no place where CSS paints it between in-flow layers whose flow order
 * Figma keeps, as `paint-order.ts` decides.
 */
export const UNPAINTABLE = refused(
  "CSS paints the absolute part over an in-flow layer that a positioned one precedes, which Figma, keeping the flow's order, cannot paint so"
);
const UNWRAPPED = refused(
  "a mode can change the absolute instance's length at its parent's bottom, at a centre, or across beside a place other than the top, and only a wrapper for an instance at its parent's right and top is known to keep such a place (PG16)"
);
const BOUNDED = (property: string): Refused =>
  refused(
    `\`${property}\` bounds a length the parent's edges set, which Figma's constraints would carry past the bound as the parent resizes`
  );

/** A property's value as one length in pixels in every mode, or undefined. */
function constant(style: LayerStyle, property: string): number | undefined {
  const value = style.resolved(property);
  const length = value === undefined ? undefined : affineLength(value);
  return length === undefined ? undefined : constantOf(length);
}

/** Whether a box sets an offset or length, one other than `auto`. */
function sets(style: LayerStyle, property: string): boolean {
  return normalizeCss(style.resolved(property) ?? "auto") !== "auto";
}

/**
 * Whether a box sets a `min-*` or `max-*` that can change a length (CSS 2.1 §10.4, §10.7): a minimum
 * other than its initial `auto` or zero, or a maximum other than its initial `none`, zero included.
 */
function limits(style: LayerStyle, property: string, kind: "minimum" | "maximum"): boolean {
  const value = normalizeCss(style.resolved(property) ?? "");
  return kind === "minimum" ? !["", "auto", "0", "0px"].includes(value) : !["", "none"].includes(value);
}

/** The parent's border on a side: the side's own width, else `border-width`'s, else none. */
function border(parent: LayerStyle, side: string): number | undefined {
  if (parent.has(side)) {
    return constant(parent, side);
  }
  return parent.has("border-width") ? constant(parent, "border-width") : 0;
}

/** A length on one side as an affine length, 0 where the box sets none. */
const lengthOf = (style: LayerStyle, property: string): AffineLength | undefined =>
  affineLength(style.resolved(property) ?? "0px");

/**
 * The height of a parent's border box where its one layer in flow sets it: the parent sets no height
 * or height limit, and the layer sets its own height and no margin down, so the parent is as tall as
 * the layer and its own padding and borders (CSS 2.1 §10.6.3).
 */
function parentHeight(context: PlacementContext): AffineLength | undefined {
  const { parent, flow, layers } = context;
  const [only] = flow;
  const free = ["height", "min-height", "max-height"].every((property) =>
    ["auto", "none", "0px", "0"].includes(normalizeCss(parent.resolved(property) ?? "auto"))
  );
  if (only === undefined || flow.length !== 1 || layers !== 1 || !free) {
    return undefined;
  }
  const margins = ["margin-top", "margin-bottom"].map((property) => lengthOf(only, property));
  if (margins.some((margin) => margin?.constant !== 0 || margin.coefficients.size > 0)) {
    return undefined;
  }
  const parts = [
    lengthOf(parent, "padding-top"),
    lengthOf(parent, "padding-bottom"),
    lengthOf(parent, parent.has("border-top-width") ? "border-top-width" : "border-width"),
    lengthOf(parent, parent.has("border-bottom-width") ? "border-bottom-width" : "border-width"),
    affineLength(only.resolved("height") ?? ""),
  ];
  return parts.every((part) => part !== undefined) ? sumAffine(parts) : undefined;
}

/**
 * The offset of an instance's centre from its parent's centre, down, where it is one length in every
 * mode: the parent's top border, the instance's `top` and half its height, less half the parent's
 * height, with no `bottom` beside it.
 */
function centreOffset(style: LayerStyle, context: PlacementContext): number | undefined {
  const top = affineLength(style.resolved("top") ?? "");
  const height = affineLength(style.resolved("height") ?? "");
  const outer = parentHeight(context);
  const topBorder = lengthOf(
    context.parent,
    context.parent.has("border-top-width") ? "border-top-width" : "border-width"
  );
  if (
    top === undefined ||
    height === undefined ||
    outer === undefined ||
    topBorder === undefined ||
    sets(style, "bottom")
  ) {
    return undefined;
  }
  return constantOf(sumAffine([topBorder, top, scaleAffine(height, 0.5), scaleAffine(outer, -0.5)]));
}

/** Where a part sits on one axis, as the module comment says, or the reason it has no place there. */
function planAxis(
  style: LayerStyle,
  layer: PlacedLayer,
  axis: Axis,
  context: PlacementContext
): PlannedAxis | Refused {
  const { parent } = context;
  const startBorder = border(parent, axis.startBorder);
  const endBorder = border(parent, axis.endBorder);
  const start = sets(style, axis.start) ? constant(style, axis.start) : undefined;
  const end = sets(style, axis.end) ? constant(style, axis.end) : undefined;
  const offsetsRead =
    startBorder !== undefined &&
    endBorder !== undefined &&
    (!sets(style, axis.start) || start !== undefined) &&
    (!sets(style, axis.end) || end !== undefined);
  if (
    layer === "instance" &&
    axis.name === "vertical" &&
    startBorder !== undefined &&
    start === undefined &&
    end === undefined
  ) {
    const offset = centreOffset(style, context);
    if (offset !== undefined) {
      return { kind: "axis", at: { kind: "centre", offset }, length: undefined };
    }
  }
  if (!offsetsRead) {
    return UNPLACED;
  }
  if (layer === "instance") {
    if (start !== undefined && end === undefined) {
      return { kind: "axis", at: { kind: "start", start: startBorder + start }, length: undefined };
    }
    if (end !== undefined && start === undefined) {
      return { kind: "axis", at: { kind: "end", end: endBorder + end }, length: undefined };
    }
    return UNPLACED;
  }
  const length = normalizeCss(style.resolved(axis.length) ?? "auto");
  const share = evaluatePercentage(length);
  const flush =
    startBorder + endBorder === 0 &&
    [axis.startPadding, axis.endPadding].every(
      (property) => !parent.has(property) || constant(parent, property) === 0
    );
  // `inherit` takes the parent's computed length, which is its padding box only where nothing else
  // sizes the parent on the axis: no limit of its own, and no border or padding inside the length.
  const inheritsWhole =
    style.inherits(axis.length) &&
    flush &&
    !limits(parent, axis.min, "minimum") &&
    !limits(parent, axis.max, "maximum");
  const full = share === 1 || inheritsWhole;
  const bound = limits(style, axis.min, "minimum")
    ? axis.min
    : limits(style, axis.max, "maximum")
      ? axis.max
      : undefined;
  const paddingBox = context.paddingBox[axis.name];
  // The parent's outer length, which the distances measure from, where the room knows it.
  const outer = paddingBox === undefined ? undefined : paddingBox + startBorder + endBorder;
  const stretch = (startDistance: number, endDistance: number): PlannedAxis | Refused => {
    if (bound !== undefined) {
      return BOUNDED(bound);
    }
    const spans = outer === undefined ? undefined : outer - startDistance - endDistance;
    return spans !== undefined && spans <= 0
      ? NO_ROOM
      : { kind: "axis", at: { kind: "stretch", start: startDistance, end: endDistance }, length: spans };
  };
  const own =
    length !== "auto" && share === undefined && !style.inherits(axis.length)
      ? constant(style, axis.length)
      : undefined;
  // An inherited length that is not the parent's whole one is the length the parent declares.
  const inherited = style.inherits(axis.length) && !full ? constant(style, axis.length) : undefined;
  const fixed = own ?? inherited;
  if (start !== undefined && end !== undefined) {
    return length === "auto" ? stretch(startBorder + start, endBorder + end) : UNPLACED;
  }
  if (start !== undefined) {
    // A share from a zero start in a parent with no border or padding on the axis, whose length the
    // room knows, keeps both of its ends a share of the parent's outer length, which SCALE keeps.
    if (share !== undefined && start === 0 && flush && paddingBox !== undefined) {
      return bound === undefined
        ? { kind: "axis", at: { kind: "scale", start }, length: undefined }
        : BOUNDED(bound);
    }
    if (full) {
      return stretch(startBorder + start, endBorder - start);
    }
    return fixed === undefined
      ? UNPLACED
      : { kind: "axis", at: { kind: "start", start: startBorder + start }, length: undefined };
  }
  if (end !== undefined) {
    if (full) {
      return stretch(startBorder - end, endBorder + end);
    }
    return fixed === undefined
      ? UNPLACED
      : { kind: "axis", at: { kind: "end", end: endBorder + end }, length: undefined };
  }
  return UNPLACED;
}

/**
 * Plan where an absolute part sits against its parent, reading nothing.
 *
 * @param style - The part's style.
 * @param layer - Whether the part draws as a frame or an instance.
 * @param context - The parent and its flow.
 * @returns The place on each axis, the reason the part has none, or undefined for a part that is
 *   not absolute.
 */
export function planPlacement(
  style: LayerStyle,
  layer: PlacedLayer,
  context: PlacementContext
): PlacementPlan | undefined {
  if (normalizeCss(style.resolved("position") ?? "") !== "absolute") {
    return undefined;
  }
  const positioned =
    POSITIONED.has(normalizeCss(context.parent.resolved("position") ?? "static")) ||
    context.positionedBy !== undefined;
  if (!positioned && !context.parentSpansBlock) {
    return refused(NOT_POSITIONED);
  }
  // `planAxis` adds the parent's border to each offset, which holds only where the parent is the
  // block. A parent that spans the block has its outer edge on the block's padding edge, so it must
  // draw no border.
  const bordered = [HORIZONTAL, VERTICAL].some((axis) =>
    [axis.startBorder, axis.endBorder].some((side) => border(context.parent, side) !== 0)
  );
  if (!positioned && bordered) {
    return refused(BORDERED_SPAN);
  }
  if (MOVES.some((property) => !["", "none"].includes(normalizeCss(style.resolved(property) ?? "")))) {
    return refused(MOVED);
  }
  const horizontal = planAxis(style, layer, HORIZONTAL, context);
  const vertical = planAxis(style, layer, VERTICAL, context);
  if (horizontal.kind === "refused") {
    return horizontal;
  }
  if (vertical.kind === "refused") {
    return vertical;
  }
  const planned = { kind: "planned", horizontal, vertical } as const;
  return layer === "instance" ? wrapIfVarying(planned, context) : planned;
}

/**
 * The place of an instance whose length a mode can change on an axis where it sits at its parent's
 * end or centre. Figma's MAX and CENTER keep the place as the parent resizes, but in an instance of
 * the outer component a mode that changes the part's own length keeps its `x`, so its end inset
 * drifts by the change (PG14, PG14b), where CSS keeps the declared offset (CSS 2.1 §10.3.7). A wrapper
 * that stretches across the parent and pads the offset keeps it (PG16). An axis the capture measured
 * one length in every mode (`oneLength`) needs none. The wrapper draws only the shape PG16 measured,
 * the part at its parent's end across and its start down, so any other shape a mode can resize leaves
 * the place unmapped.
 */
function wrapIfVarying(
  plan: { readonly kind: "planned"; readonly horizontal: PlannedAxis; readonly vertical: PlannedAxis },
  context: PlacementContext
): PlacementPlan {
  const varies = (axis: Axis) => plan[axis.name].at.kind !== "start" && !context.oneLength.has(axis.name);
  if (!varies(HORIZONTAL) && !varies(VERTICAL)) {
    return plan;
  }
  if (varies(VERTICAL) || plan.horizontal.at.kind !== "end" || plan.vertical.at.kind !== "start") {
    return UNWRAPPED;
  }
  const paddingBox = context.paddingBox.horizontal;
  const startBorder = border(context.parent, HORIZONTAL.startBorder);
  const endBorder = border(context.parent, HORIZONTAL.endBorder);
  const outer =
    paddingBox === undefined || startBorder === undefined || endBorder === undefined
      ? undefined
      : paddingBox + startBorder + endBorder;
  return { ...plan, wrapped: { outer } };
}

/** How the coverage table names the length a stretch sets. */
export const STRETCHED_LENGTH =
  "the layer spans its parent between its distances to the parent's edges, which STRETCH keeps as the parent resizes";

/**
 * The room an absolute part has where its plan stretches it along an axis: there the length is the
 * placement's, the parent's padding box less the part's offsets where the room knows the parent's
 * padding box, which the sizing then draws as a literal, and a length the placement leaves where it
 * does not. A length of the part's own that the room resolves reads as the sizing reads any other.
 *
 * @param room - The room an absolute part has, as `absoluteRoom` in `box-sizing.ts` reads it.
 * @param style - The part's style.
 * @param plan - The part's place, or undefined for a part placed some other way.
 * @returns The room.
 */
export function placedRoom(room: Room, style: LayerStyle, plan: PlacementPlan | undefined): Room {
  if (plan?.kind !== "planned") {
    return room;
  }
  const along = (name: "horizontal" | "vertical") => {
    const { at, length } = plan[name];
    // A length of the part's own the room resolves, as a meter's fill's `100%` of its bar, reads as
    // the sizing reads it, and only an `auto` between two offsets or an unknown parent is the place's.
    const resolved =
      sets(style, (name === "horizontal" ? HORIZONTAL : VERTICAL).length) &&
      room[name].percent.kind === "length";
    if (at.kind !== "stretch" || resolved) {
      return room[name];
    }
    return { ...room[name], placed: { detail: STRETCHED_LENGTH, length } };
  };
  return { ...room, horizontal: along("horizontal"), vertical: along("vertical") };
}

/** How the coverage table names the distance one offset keeps. */
function distance(at: AxisPlacementSpec, side: "start" | "end", edge: string): string {
  switch (at.kind) {
    case "start":
      return `${String(at.start)}px from its parent's ${edge} edge, with the parent's border, which MIN keeps`;
    case "end":
      return `${String(at.end)}px from its parent's ${edge} edge, with the parent's border, which MAX keeps`;
    case "stretch":
      return `${String(side === "start" ? at.start : at.end)}px from its parent's ${edge} edge, with the parent's border, which STRETCH keeps`;
    case "scale":
      return `${String(at.start)}px from its parent's ${edge} edge, a share of its length that SCALE keeps`;
    case "centre":
      return `its centre ${String(at.offset)}px from its parent's centre in every mode, which CENTER keeps (N11)`;
  }
}

/** What {@link readPlacement} made of a part: its place, or the reason it has none. */
export type PlacementRead =
  | { readonly kind: "placed"; readonly placement: EdgePlacementSpec; readonly wrapped?: Wrapped }
  | { readonly kind: "refused"; readonly why: string };

/**
 * Read a part's place as {@link planPlacement} planned it: its `position` and each offset it sets land
 * as literals. A refused plan has no place, and the caller leaves its rows to the reader of what
 * remains. The plan decides every length the place needs, so the read takes no mapped layer.
 *
 * @param style - The part's style.
 * @param plan - The part's place.
 * @returns The place the layer holds, or the reason it has none.
 */
export function readPlacement(style: LayerStyle, plan: PlacementPlan): PlacementRead {
  if (plan.kind === "refused") {
    return plan;
  }
  const notes = new Map([
    ["position", "an absolute layer placed by its distances to its parent's edges"],
    ["left", distance(plan.horizontal.at, "start", "left")],
    ["right", distance(plan.horizontal.at, "end", "right")],
    ["top", distance(plan.vertical.at, "start", "top")],
    ["bottom", distance(plan.vertical.at, "end", "bottom")],
  ]);
  for (const property of ["position", ...OFFSETS.filter((offset) => sets(style, offset))]) {
    const detail = notes.get(property) ?? "";
    style.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail }),
      style.feed("placement")
    );
  }
  const placement: EdgePlacementSpec = {
    kind: "edges",
    within: "parent",
    horizontal: plan.horizontal.at,
    vertical: plan.vertical.at,
  };
  return plan.wrapped === undefined
    ? { kind: "placed", placement }
    : { kind: "placed", placement, wrapped: plan.wrapped };
}

/**
 * Leave an absolute part's `position` and offsets unmapped, with the reason it has no place.
 *
 * @param style - The part's style.
 * @param why - Why the part has no place.
 */
export function leaveUnplaced(style: LayerStyle, why: string): void {
  for (const property of ["position", ...OFFSETS.filter((offset) => sets(style, offset))]) {
    style.mark(property, "unmapped", why, []);
  }
}

/**
 * Narrow a place to one an instance takes, which keeps its main's length on each axis.
 *
 * @param placement - The place {@link readPlacement} read for an instance part.
 * @returns The place, or undefined where an axis would set the instance's length.
 */
export function instancePlacement(
  placement: EdgePlacementSpec | undefined
): EdgePlacementSpec<InstanceAxisPlacementSpec> | undefined {
  const own = (at: AxisPlacementSpec): at is InstanceAxisPlacementSpec =>
    at.kind === "start" || at.kind === "end" || at.kind === "centre";
  if (placement === undefined) {
    return undefined;
  }
  const { horizontal, vertical } = placement;
  return own(horizontal) && own(vertical) ? { ...placement, horizontal, vertical } : undefined;
}
