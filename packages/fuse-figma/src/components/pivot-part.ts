/**
 * An absolute part placed by its centre, as a Tooltip's arrow hangs from its popup's edge.
 * `box-mapping.ts` plans it with `planPivot` beside its plan by its parent's edges, before the part
 * maps, and `placeParts` in `placement.ts` places the mapped layer and writes its coverage rows with
 * `applyPivot`.
 */
import type { PlacementPlan } from "./absolute-placement";
import { foldTranslateTurn, originIsCentre, ownTurn, transformsAboutBorderBox } from "./box-transform";
import { evaluateLength, evaluateLengthOf, normalizeCss, shareLength, splitTopLevel } from "./css-values";
import { fixedLength, PIVOT_EDGES } from "./kit-spec";
import type { FrameLayerSpec, PivotEdge, PivotSpec, RotationSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import { MARGINS } from "./margin-box";
import type { ParentBox } from "./placement";

/**
 * Every property that sets a width on one or more of a box's border sides, physical and logical, so
 * that a border on any side keeps the pivot from reading the padding box as the frame's edge.
 */
const BORDER_WIDTHS = [
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-inline-width",
  "border-block-width",
  "border-inline-start-width",
  "border-inline-end-width",
  "border-block-start-width",
  "border-block-end-width",
];

/**
 * The CSS that places a part on one axis: its two inset properties, start first. Each inset
 * property names the edge it measures from.
 */
type AxisInsets = {
  readonly start: "left" | "top";
  readonly end: "right" | "bottom";
};

/**
 * The start inset that puts a part's centre a fixed distance from its containing block's centre
 * along one axis: half the block's length plus `constant`, and the component `move` of its translate
 * along that axis, which may take a share of the part's own size there.
 */
type AlongInset = {
  readonly property: "left" | "top";
  readonly constant: number;
  readonly move: string;
};

/**
 * The inset that puts a part's centre a fixed distance inside one edge of its containing block:
 * `length` from `edge`, and the component `move` of its translate across that edge.
 */
type AcrossInset = {
  readonly edge: PivotEdge;
  readonly length: number;
  readonly move: string;
};

/**
 * Where one axis's insets put the part's centre before its size is known: along the containing
 * block's centre, inside one of its edges, or no fixed place, for the reason given. The translate
 * joins it once the plan has read the part's moves.
 */
type AxisRole =
  | ({ readonly role: "along" } & Omit<AlongInset, "move">)
  | ({ readonly role: "across" } & Omit<AcrossInset, "move">)
  | { readonly role: "refused"; readonly why: string };

/** How far a start inset's share may sit from a half and still read as one. */
const HALF_TOLERANCE = 1e-9;

/**
 * Read where one axis's insets put the part's centre. The part sets one of the axis's two insets. A
 * start inset of half the containing block's length plus a length puts the centre a fixed distance
 * from the block's centre along the axis. A length alone on either side puts the centre a fixed
 * distance inside the edge that inset names. A start inset that reads the block's length any other
 * way, such as `min(50%, 60px)`, which is half the length up to 120px and 60px past it, moves the
 * centre against the block's centre as the block resizes, so the axis has no fixed place. The reader
 * takes the block's length only in the start inset, so an end inset that reads it gives no place
 * either.
 */
function readAxis(style: LayerStyle, insets: AxisInsets): AxisRole | undefined {
  const { start, end } = insets;
  if (style.has(start) === style.has(end)) {
    return undefined;
  }
  const edge = style.has(start) ? start : end;
  const value = style.resolved(edge) ?? "";
  const length = evaluateLength(value);
  if (length !== undefined) {
    return { role: "across", edge, length };
  }
  if (edge === end) {
    return !value.includes("%")
      ? undefined
      : {
          role: "refused",
          why: `\`${edge}: ${value}\` reads the containing block's length, which the reader takes only in a start inset, \`${start}\`, so set the equivalent \`${start}\` instead`,
        };
  }
  const share = shareLength(value);
  // `shareLength` scales and sums percentages in binary floating point, which reads
  // `calc(85% - 35% - 5px)` as 0.49999999999999994 of the length and `calc(255% - 205% - 5px)` as
  // 0.5000000000000004, so a half is any share within 1e-9 of 0.5, far below any share a stylesheet
  // writes on purpose. A `min()` or `max()` over a percentage reads as no share at all.
  if (share !== undefined && Math.abs(share.share - 0.5) <= HALF_TOLERANCE) {
    return { role: "along", property: start, constant: share.constant };
  }
  return !value.includes("%")
    ? undefined
    : {
        role: "refused",
        why: `\`${edge}: ${value}\` is no half of the containing block's length plus a constant, so the part's centre moves against the block's centre as the block resizes, and no constraint keeps it`,
      };
}

/**
 * What a frame placed by its centre takes where its layer maps with no fixed size, which its centre
 * needs: its plan by its parent's edges, which also sizes it, and whether it falls back on that plan
 * or fails the build. A pseudo-element its edges do not place fails it, since the kit draws a
 * pseudo-element only by its place.
 */
export type PivotFallback = {
  readonly edges: PlacementPlan | undefined;
  readonly unsized: "edges" | "fails";
};

/**
 * A frame part's place by its centre as planned before it maps, or why it has none. The plan holds
 * the insets and the translate, and {@link applyPivot} resolves the centre from the size the part
 * maps at.
 */
export type PivotPlan =
  | {
      readonly kind: "pivot";
      readonly along: AlongInset;
      readonly across: AcrossInset;
      /** The turn its `transform` folds in, as {@link foldTranslateTurn} reads it, or undefined. */
      readonly rotation: RotationSpec | undefined;
      readonly properties: readonly string[];
      readonly fallback: PivotFallback;
    }
  | {
      readonly kind: "pivot-refused";
      readonly why: string;
      /**
       * Whether the part turns, through its own `rotate` or a `transform` the reader folds, so that
       * no other reader places it and the build fails.
       */
      readonly turned: boolean;
    };

/**
 * What moves a part from where its insets put it: its `translate`, or the translate and the turn a
 * `transform` of `translate()` then `rotate()` composes, and the property the place reads them from.
 * Refused where a transform the reader does not fold moves the part, where its own turn takes an
 * angle the kit does not read, where a turn or a scale acts about a `transform-origin` other than its
 * centre, or where its transforms take a reference box other than its border box, so its own size
 * does not resolve their percentages.
 */
type Moves =
  | {
      readonly kind: "moves";
      readonly translate: string;
      readonly turn: RotationSpec | undefined;
      readonly from: "translate" | "transform";
    }
  | { readonly kind: "refused"; readonly why: string };

/** The properties that move or turn a part about its reference box. */
const MOVING = ["translate", "rotate", "scale", "transform"];

/** Whether a part declares a property other than `none`. */
const declares = (style: LayerStyle, property: string) =>
  !["", "none"].includes(normalizeCss(style.resolved(property) ?? ""));

/** The moves of a part, as {@link Moves} says. Reads nothing. */
function movesOf(style: LayerStyle): Moves {
  if (MOVING.some((property) => declares(style, property)) && !transformsAboutBorderBox(style)) {
    return {
      kind: "refused",
      why: `\`transform-box: ${style.resolved("transform-box") ?? ""}\` moves the part about a box other than its border box`,
    };
  }
  const own = ownTurn(style);
  if (own.kind === "unread") {
    return { kind: "refused", why: `\`rotate: ${own.value}\` is no angle the kit reads` };
  }
  const folded = foldTranslateTurn(style);
  if (folded.kind === "refused") {
    return folded;
  }
  // A turn or a scale about any point but the centre moves the centre, which the place reads.
  const about = own.kind === "turned" ? "rotate" : declares(style, "scale") ? "scale" : undefined;
  if (about !== undefined && !originIsCentre(style)) {
    return {
      kind: "refused",
      why: `\`${about}: ${style.resolved(about) ?? ""}\` acts about \`transform-origin: ${style.resolved("transform-origin") ?? ""}\`, not the part's centre`,
    };
  }
  return folded.kind === "none"
    ? {
        kind: "moves",
        translate: normalizeCss(style.resolved("translate") ?? "none"),
        turn: undefined,
        from: "translate",
      }
    : { kind: "moves", translate: folded.translate, turn: folded.turn, from: "transform" };
}

/** The properties that say how a part's transforms act, which its place reads where something moves it. */
const TRANSFORM_FRAME = ["transform-origin", "transform-box"];

/**
 * Plan where an absolute frame part sits by its centre, as {@link applyPivot} reads it once it maps
 * at its own size. A pseudo-element draws a layer only where something places it, so the box mapping
 * draws one this plans. Reads nothing.
 *
 * The part hangs from one edge of its containing block, centred along it, as a Tooltip's arrow
 * does from the popup's edge that faces its trigger: on one axis a start inset of half the containing
 * block's length plus a length, on the other one inset of a length, a translate of lengths or shares
 * of the part's own size, a fixed size and no margin. CSS offsets the part's box from its containing
 * block's padding box (CSS 2.1 §10.3.7, §10.6.4), then `translate` moves it, a percentage taking the
 * part's own size, and `rotate` turns it about its centre, which stays where it was (CSS Transforms 2
 * §6). A `transform` of `translate()` then `rotate()` about the centre moves and turns it the same
 * way, as {@link foldTranslateTurn} reads it, so the part takes that turn as its rotation, as a
 * Popover arrow's `::before` does. Both hold only where the transforms take the part's border box as
 * their reference box ({@link transformsAboutBorderBox}). So its centre sits a fixed distance from the
 * containing block's centre along the edge and a fixed distance inside the edge whatever the block's
 * size, which the constraints {@link PIVOT_EDGES} names keep, and the plugin places the part from
 * that centre.
 * An unturned part plans here too, since `absolute-placement.ts` refuses a translate and an offset
 * that takes a share of the block's length. A turned part has no other reader, since the plugin
 * places an absolute layer by an `x` and `y` that a turn moves. The parent must be the containing
 * block: positioned itself, or static inside the positioned element its definition names in
 * `positionedBy`, with the box's border box, and it sets no border on any side, so its padding box is
 * the frame Figma places the layer in. On 2026-10-27 a real file drew such a part hanging from the
 * bottom edge at -45 centred at (W/2, H - 2) from the plugin's centre, and kept it there through
 * density and text-driven resizes, in the main and in an instance (W5-P11, W5-P11b). On 2026-11-20 a
 * real file held the inset on all four edges through every resize (PG17). On 2026-11-21 a real file
 * kept such a part, turned -45 with an INSIDE stroke, centred on the bottom edge of a clipping
 * 12 × 6 frame that is itself placed by its centre
 * (https://github.com/elmeragroup/fuse/issues/844#issuecomment-7061135720).
 * A part whose insets take that shape has no place where its start inset reads the containing
 * block's length other than as a half plus a constant, its end inset reads it at all, or the reader
 * refuses its moves. The plan gives the reason, and the box mapping decides what the part does
 * without a place. Every other part leaves its place to the other readers.
 *
 * @param style - The part's style.
 * @param parent - The box that holds it: its style and the positioned element around it, if any.
 * @param fallback - What the part takes where its layer maps with no fixed size.
 * @returns The part's insets, translate and turn, why it has none, or undefined where the pattern
 *   does not hold.
 */
export function planPivot(
  style: LayerStyle,
  parent: Pick<ParentBox, "style" | "positionedBy">,
  fallback: PivotFallback
): PivotPlan | undefined {
  const contains =
    !["", "static"].includes(normalizeCss(parent.style.resolved("position") ?? "")) ||
    parent.positionedBy !== undefined;
  if (
    normalizeCss(style.resolved("position") ?? "") !== "absolute" ||
    !contains ||
    BORDER_WIDTHS.some(
      (property) => parent.style.has(property) && evaluateLength(parent.style.resolved(property) ?? "") !== 0
    ) ||
    MARGINS.some((property) => style.has(property) && evaluateLength(style.resolved(property) ?? "") !== 0)
  ) {
    return undefined;
  }
  const axes = [
    readAxis(style, { start: "left", end: "right" }),
    readAxis(style, { start: "top", end: "bottom" }),
  ];
  const refused = axes.find((axis) => axis?.role === "refused");
  const along = axes.find((axis) => axis?.role === "along");
  const across = axes.find((axis) => axis?.role === "across");
  if (refused === undefined && (along?.role !== "along" || across?.role !== "across")) {
    return undefined;
  }
  const turned = ownTurn(style).kind === "turned";
  const moves = movesOf(style);
  if (moves.kind === "refused") {
    return { kind: "pivot-refused", why: moves.why, turned };
  }
  if (refused?.role === "refused") {
    return { kind: "pivot-refused", why: refused.why, turned: turned || (moves.turn ?? 0) !== 0 };
  }
  const [moveX = "0px", moveY = "0px"] = splitTopLevel(moves.translate, " ").filter(
    (part) => part !== "none"
  );
  // A translate takes the part's size only as a percentage's basis, so one that evaluates against
  // one size evaluates against every size.
  if (
    along?.role !== "along" ||
    across?.role !== "across" ||
    evaluateLengthOf(moveX, 0) === undefined ||
    evaluateLengthOf(moveY, 0) === undefined
  ) {
    return undefined;
  }
  const horizontal = along.property === "left";
  const moved = MOVING.some((property) => declares(style, property));
  return {
    kind: "pivot",
    along: { property: along.property, constant: along.constant, move: horizontal ? moveX : moveY },
    across: { edge: across.edge, length: across.length, move: horizontal ? moveY : moveX },
    rotation: moves.turn === 0 ? undefined : moves.turn,
    properties: [
      "position",
      along.property,
      across.edge,
      moves.from,
      ...(moved ? TRANSFORM_FRAME.filter((property) => style.has(property)) : []),
    ],
    fallback,
  };
}

/**
 * The centre a plan puts a part of the given size at: half its size and its translate past each
 * inset, a percentage in the translate taking the part's size on that axis.
 *
 * @returns The centre, or undefined where a translate does not evaluate against the size.
 */
function centreOf(
  plan: Extract<PivotPlan, { readonly kind: "pivot" }>,
  size: { readonly width: number; readonly height: number }
): PivotSpec | undefined {
  const { along, across } = plan;
  const [alongSize, acrossSize] =
    along.property === "left" ? [size.width, size.height] : [size.height, size.width];
  const alongMove = evaluateLengthOf(along.move, alongSize);
  const acrossMove = evaluateLengthOf(across.move, acrossSize);
  if (alongMove === undefined || acrossMove === undefined) {
    return undefined;
  }
  // An end inset measures from the far edge, so the translate moves the centre toward it.
  const toward = PIVOT_EDGES[across.edge].from === "start" ? acrossMove : -acrossMove;
  return {
    kind: "pivot",
    edge: across.edge,
    along: along.constant + alongSize / 2 + alongMove,
    inset: across.length + acrossSize / 2 + toward,
  };
}

/**
 * Place a mapped frame part by the centre {@link planPivot} planned, at the fixed size the part maps
 * at, with the turn its `transform` folds in, and record the properties that place it. The size is
 * the layer's, after the sizing applies the part's aspect ratio and limits, since CSS resolves the
 * translate and the centre against the box it lays out.
 *
 * @param style - The part's style.
 * @param layer - The part, mapped.
 * @param plan - The part's planned insets and translate.
 * @returns The layer, placed by its centre, or undefined where it maps with no fixed size, which
 *   leaves its place to the plan's fallback.
 */
export function applyPivot(
  style: LayerStyle,
  layer: FrameLayerSpec,
  plan: Extract<PivotPlan, { readonly kind: "pivot" }>
): FrameLayerSpec | undefined {
  const width = fixedLength(layer.sizing.horizontal);
  const height = fixedLength(layer.sizing.vertical);
  const spec =
    width?.kind === "literal" && height?.kind === "literal"
      ? centreOf(plan, { width: width.value, height: height.value })
      : undefined;
  if (spec === undefined) {
    return undefined;
  }
  const { rotation, properties } = plan;
  const alongAxis = PIVOT_EDGES[spec.edge].along === "horizontal" ? "horizontal centre" : "vertical centre";
  const { constraints } = PIVOT_EDGES[spec.edge];
  const placed = `the layer's centre sits ${spec.along}px from its containing block's ${alongAxis} and ${spec.inset}px inside its ${spec.edge} edge, where the plugin places it by its centre, and ${constraints.horizontal} across and ${constraints.vertical} down keep it there`;
  for (const property of properties) {
    const turns = property === "transform" && rotation !== undefined;
    const detail = turns
      ? `${placed}, and the turn is a rotation of ${rotation}, counterclockwise as Figma counts it`
      : placed;
    style.read(
      property,
      () => detail,
      (decided) => ({ outcome: "literal", detail: decided }),
      turns ? [...style.feed("placement"), ...style.feed("rotation")] : style.feed("placement")
    );
  }
  return rotation === undefined ? { ...layer, placement: spec } : { ...layer, placement: spec, rotation };
}
