/**
 * Map a box, the root or a part, and the parts and icons below it onto Figma fields, from the
 * cascade of each: its display, corner and icons, assembled from what the other modules read.
 * `box-flow.ts` lays out its flow, `box-sizing.ts` sizes it, `box-paint.ts` paints it,
 * `label-layout.ts` sets its label and `placement.ts` places its parts. `component-spec.ts`
 * assembles a set from the root of each cell.
 */

import { placedRoom, planPlacement, UNPAINTABLE } from "./absolute-placement";
import type { BoxCascade, PartElement } from "./box-cascade";
import { readCorner } from "./box-corners";
import type { MarkerReading } from "./box-flow";
import {
  HUGGING_ROWS_DETAIL,
  isPlainBlock,
  negativeRowSpacing,
  orderModified,
  readFlow,
  readSpaceBetween,
  settleFlow,
  stretchedLayer,
} from "./box-flow";
import type { Flow, UnspacedReason } from "./box-flow";
import { describeColor, readPaint } from "./box-paint";
import type { BoxPaint } from "./box-paint";
import {
  absoluteRoom,
  boxHeightBounds,
  fitsRoom,
  fittingRoom,
  growingRoom,
  hugsUncapped,
  leastContentWidth,
  lessMargins,
  outOfFlow,
  partShare,
  readItemSizing,
  readSizing,
  roomInside,
  selfStretchedRoom,
  UNREAD_SHARE,
  unstretched,
} from "./box-sizing";
import type { Holder, Room, RowLayer } from "./box-sizing";
import { dropIdleOrigin, readRotation } from "./box-transform";
import { KitUnmappable } from "./build-errors";
import { centresBesideSpan, foldGap, holdsOnlyLabel, padCentred } from "./centred-row";
import type {
  BoxDefinition,
  BuildContext,
  Cell,
  IconSlot,
  InstanceDefinition,
  LabelDefinition,
  PartDefinition,
} from "./component-spec";
import { labelCharacters } from "./component-spec";
import { readContentBox } from "./content-box";
import {
  describeNumber,
  evaluateLength,
  evaluateNumber,
  normalizeCss,
  readColor,
  readNumber,
} from "./css-values";
import type { Viewport } from "./css-values";
import type { DrawnAt, DrawnParts } from "./drawn-parts";
import { EMPTY_PART, leavesNoTrace, NO_TRACE, vanishes } from "./empty-part";
import { drawRestAtEnd } from "./end-frame";
import { drawsAtRoom, fitsRowRoom } from "./fitting-part";
import type { BesideLayer, FitPlace } from "./fitting-part";
import { fixedPlace, placeFixed, refuseFixedPlace } from "./fixed-placement";
import type { DrawnAmong } from "./fixed-placement";
import { DECLARED_WIDTH } from "./flex-item-width";
import type { DrawnWidth } from "./flex-item-width";
import { joinFlushLayers } from "./flush-layers";
import { readBleed, sectioned } from "./full-bleed";
import { holdsEditableText, keyedCells, readGrid } from "./grid-layout";
import { heldSizing, literalInsets } from "./held-size";
import { rowMinimum, rowRoom, rowsAcross } from "./hugging-rows";
import { readInlineItem } from "./inline-item";
import type { CascadedInstance, InstanceParts } from "./instance-parts";
import { castsSpread, fixedLength, iconKey, outOfLayout, ringFill, weightedIconName, ZERO } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  CounterAlignSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  LimitsSpec,
  NumberSpec,
  PrimaryAlignSpec,
  SizeSpec,
  SizingSpec,
} from "./kit-spec";
import {
  inertClamp,
  labelElementHolder,
  mapLabel,
  readLineClamp,
  readWithoutLabel,
  spaceBeforeLabel,
} from "./label-layout";
import type { LabelScope, PlacedLabel, TextPlacement } from "./label-layout";
import type { Feed, LayerStyle, SpecField } from "./layer-style";
import {
  adjoinsMargin,
  foldNegativeMargin,
  wrapFrameMargins,
  wrapIconMargins,
  wrapInstanceMargins,
} from "./margin-box";
import type { FoldingBox, IconMarginBox } from "./margin-box";
import { liftParts } from "./no-box";
import { arrangePaint, inPaintOrder, readRaisedLevels } from "./paint-order";
import type { PaintedLayer } from "./paint-order";
import {
  endsBesideLabel,
  endsInFlow,
  huggedWidth,
  padToOffset,
  placeParts,
  slotAroundDot,
} from "./placement";
import type { Layout } from "./placement";
import { pseudoParts } from "./pseudo-layers";
import { dropShownStackRest, readStackDisplay, readStackedCell, STACK_HIDDEN } from "./stacked-cell";
import { stacksFirstOnTop } from "./stacking";
import type { PaintedInstances } from "./stacking";
import { drawSubgridCell } from "./subgrid-row";
import { tableDisplayDetail } from "./table-layout";
import { foldTranslate, sharedTranslate } from "./translate-fold";
import type { CarriedTranslates } from "./translate-fold";

/**
 * A part's layer name: its `data-slot`, or its key for an element without one.
 *
 * @param part - The part.
 * @returns The name.
 */
export function partName(part: PartDefinition): string {
  return part.slot ?? part.key;
}

function literalLayout(expected: readonly string[], detail: string) {
  return {
    map: (value: string) => (expected.includes(normalizeCss(value)) ? value : undefined),
    describe: () => ({ outcome: "literal" as const, detail }),
  };
}

/**
 * Why a list item's `list-style-type` and `list-style-image` drop where both resolve to `none`: the
 * item generates no marker (CSS Lists 3 §3), so it draws as the block box it is.
 */
const NO_MARKER = "both resolve to `none`, so the list item draws no marker";

/** Why a grid in one column drops its `column-gap`. */
const ONE_COLUMN_GAP = "the grid lays its items in one column, which has no column gap";

/**
 * Read `display` once the box's layers are known. A flex box is an auto layout along its direction.
 * A grid with no template stacks each layer in a row of its own, so a grid with
 * `place-content: center` is an auto layout centered on both axes only around one layer. A grid whose
 * items each span its columns, and a subgrid Item in it, read their own `display` in
 * `subgrid-row.ts`. Any other grid stays unmapped. A block box with no layers lays nothing out, so it
 * is a frame like any other. One that holds only its label sets the text in lines across its width, which the label's
 * own sizing draws, as `label-layout.ts` reads it for a block box. One that stacks block-level parts
 * is a vertical auto layout where its width is fixed or fills, which its parts fill. One with any
 * other layer stays unmapped. A `-webkit-box` maps only where it clamps its label, as
 * {@link readLineClamp} decides for the label too, as a column around the label. On any other display
 * a `-webkit-box-orient` sets nothing, as {@link inertClamp} says.
 *
 * @param layers - The names of the box's layers in the cell, in its flow.
 * @param label - The name of the label the box shows in the cell, or undefined for none.
 * @param layout - The box's layout, as {@link readFlow} read it.
 * @param clamp - The lines the box clamps its label to, or undefined for none.
 * @param box - The box's width, as its sizing reads it, and the sizing of the layers inside it.
 * @returns Whether the box is a block that sets its own text in lines.
 */
function readDisplay(
  reader: LayerStyle,
  layers: readonly string[],
  label: string | undefined,
  layout: Layout,
  clamp: number | undefined,
  box: {
    readonly width: SizeSpec;
    readonly inside: Feed;
    readonly markers: MarkerReading;
    readonly inlineRow: boolean;
    /** Whether the box is a one-cell stack of icons, as `stacked-cell.ts` reads it. */
    readonly stacked: boolean;
  }
): boolean {
  const { width, inside, markers } = box;
  // The display picks the layout: its direction, the alignments an unset property leaves, whether the
  // layers inside fill or hug, and the paint order of a box that stacks blocks.
  const lays = [
    ...reader.feed("direction"),
    ...reader.feed("primaryAlign"),
    ...reader.feed("counterAlign"),
    ...inside,
    ...(layout.blocks ? reader.feed("firstOnTop") : []),
  ];
  const ownText = label !== undefined && layers.length === 1 && layers[0] === label;
  const inline = readInlineItem(reader, { inlineRow: box.inlineRow, ownText }, lays);
  if (inline !== undefined) {
    return inline;
  }
  const display = normalizeCss(reader.raw("display") ?? "");
  if (display === "-webkit-box") {
    for (const property of ["display", "-webkit-box-orient"]) {
      reader.read(
        property,
        (value) => (clamp === undefined ? undefined : value),
        () => ({ outcome: "literal", detail: "a column around its clamped label" }),
        lays
      );
    }
    return false;
  }
  if (box.stacked) {
    readStackDisplay(reader, lays);
    return false;
  }
  if (layout.grid !== undefined || layout.subgrid !== undefined) {
    // `readGrid` reads a Figma grid's display with its tracks, and `readSubgridFlow` a subgrid
    // list's or Item's.
    return false;
  }
  const inert = inertClamp(reader);
  if (inert !== undefined) {
    reader.mark("-webkit-box-orient", "dropped", inert, []);
  }
  if (display === "grid" && layout.oneColumnGrid === true) {
    reader.read(
      "display",
      (value) => value,
      () => ({ outcome: "literal", detail: "a vertical auto layout, its items in the grid's one column" }),
      lays
    );
    reader.mark("column-gap", "dropped", ONE_COLUMN_GAP, []);
    // `readFlow` took the grid as one column only where these leave each row its item's height.
    reader.mark("grid-auto-rows", "dropped", HUGGING_ROWS_DETAIL, []);
    reader.mark("align-items", "dropped", HUGGING_ROWS_DETAIL, []);
    return false;
  }
  if (display === "grid") {
    const center = literalLayout(["center"], "centered on both axes");
    const centered =
      layers.length === 1 &&
      reader.read("place-content", center.map, center.describe, [
        ...reader.feed("primaryAlign"),
        ...reader.feed("counterAlign"),
      ]) !== undefined;
    reader.read(
      "display",
      (value) => (centered ? value : undefined),
      () => ({ outcome: "literal", detail: "an auto layout around its one layer" }),
      lays
    );
    return false;
  }
  const table = tableDisplayDetail(display, layout);
  if (table !== undefined) {
    reader.read(
      "display",
      (value) => value,
      () => ({ outcome: "literal", detail: table }),
      lays
    );
    return false;
  }
  // Blocks fill a box only across a width it has before they lay out, but one block fills a box
  // that hugs its width exactly, since the box shrinks to fit that block.
  const stacked = layout.blocks && (width.kind !== "hug" || layers.length === 1);
  // A list item with no marker lays out as the block box it is (CSS Display 3 §2.3).
  const plainBlock = isPlainBlock(reader, markers);
  // A base layer's `list-style: none` drops as every base declaration no part reads does.
  if (plainBlock && display === "list-item") {
    for (const property of ["list-style-type", "list-style-image"].filter(
      (each) => !reader.setByBase(each)
    )) {
      reader.read(
        property,
        (value) => value,
        () => ({ outcome: "dropped", detail: NO_MARKER }),
        []
      );
    }
  }
  const marker =
    display === "list-item"
      ? ", a list item whose resolved `list-style-type` and `list-style-image` are `none`, so it draws no marker"
      : "";
  const stackDetail =
    "a vertical auto layout, its block-level parts stacked down it, each as wide as the box";
  const flow =
    display === "inline-block" && ownText
      ? literalLayout(
          ["inline-block"],
          "an inline-block that holds only its own text, which it lays out inside as a block box does (CSS Display 3 §2.1), as an `<input>` holds its value"
        )
      : plainBlock && (layers.length === 0 || ownText || stacked)
        ? literalLayout(
            [display],
            (stacked
              ? stackDetail
              : ownText
                ? "a block box that sets its own text in lines"
                : "a frame with no layers to lay out") + marker
          )
        : literalLayout(
            ["inline-flex", "flex"],
            layout.direction === "VERTICAL" ? "a vertical auto layout" : "a horizontal auto layout"
          );
  reader.read("display", flow.map, flow.describe, lays);
  return plainBlock && ownText;
}

/**
 * Where a block that sets its own text in lines puts its line down the box. CSS sets the first line
 * box at the top of the content box (CSS 2.1 §9.4.1). A box that hugs its height with no limit is as
 * tall as its lines, so the row's unset centering, which every published row draws, puts the line in
 * the same place. A box with a height or a limit of its own can be taller than its lines, and the
 * line stays at the top.
 *
 * @returns MIN where the box can be taller than its lines, else the layout's own alignment.
 */
function blockLineAlign(layout: Layout, sizing: SizingSpec, limits: LimitsSpec): CounterAlignSpec {
  const hugsLines =
    sizing.vertical.kind === "hug" && limits.minHeight === undefined && limits.maxHeight === undefined;
  return hugsLines ? layout.counterAlign : "MIN";
}

/**
 * Whether a box that holds only its text draws the same at the width its parent gives it as at its
 * text's own width, so a `fit-content` width that wraps the text there can fill it: the box paints
 * nothing, its text wraps, and it sets its text from its start, along a row by `justify-content`
 * and in its lines by `text-align`.
 */
function drawsAlikeWide(reader: LayerStyle, paint: BoxPaint): boolean {
  const value = (property: string) => normalizeCss(reader.resolved(property) ?? "");
  return (
    paint.fill === undefined &&
    paint.stroke === undefined &&
    paint.shadows.length === 0 &&
    ["", "collapse"].includes(value("white-space-collapse")) &&
    value("text-wrap-mode") !== "nowrap" &&
    ["", "row"].includes(value("flex-direction")) &&
    ["", "normal", "start", "flex-start", "left"].includes(value("justify-content")) &&
    ["", "start", "left"].includes(value("text-align"))
  );
}

/** What the mapping of every layer of one cell reads besides the layer's own style. */
export type MapScope = {
  /** The variant's key, for errors. */
  readonly variant: string;
  readonly cell: Cell;
  readonly context: BuildContext;
  /** The parts that draw as a slot around a dot, the same in every cell. */
  readonly scaling: ReadonlySet<PartDefinition>;
  /** What builds the cell's instance parts in place and draws them as instance layers. */
  readonly instances: InstanceParts;
  /**
   * The TEXT and INSTANCE_SWAP values an instance part gives the inner set, which the inner root's
   * labels and icons show where it is built in place, by property name: the characters, and the
   * icon's export name. Empty for a set's own cells.
   */
  readonly values: PropertyValues;
  /** What each instance layer the mapping places paints, which the stacking of the boxes above reads. */
  readonly painted: PaintedInstances;
  /** The translate each box that paints and pads nothing carries up from its rows, as `translate-fold.ts` says. */
  readonly translates: CarriedTranslates;
  /**
   * What notes the layer each part of the set's own cell draws, as `drawn-parts.ts` records it. Absent
   * for an instance part built in place, whose layers the variant's root does not hold.
   */
  readonly drawn?: DrawnParts;
  /**
   * Whether the box's parent clips what overflows it and pads nothing across, so a box that fills it
   * across clips at its own sides too, as Select's list fills its clipping popup. Absent for a root.
   */
  readonly clipsAround?: true;
  /** Whether the box is a flex item in a row, where a negative margin across can fold. Absent for a root. */
  readonly inFlexRow?: true;
  /**
   * The viewport the set's root is fixed in, as its definition declares it, which an instance part
   * fixed in the same viewport takes as its containing block in place. Absent for a root that declares
   * none.
   */
  readonly viewport?: Viewport;
  /**
   * The root of the inner set's variant an instance part shows, where the box is that part's inner
   * root or a layer below it built in place. A layer whose own classes would change the layers it
   * holds keeps the main's, as a subgrid row's cell does, since an instance keeps its main's layers.
   * Absent for a set's own cells.
   */
  readonly main?: ComponentRootSpec;
};

/** A box's paddings across, which a part that fills it spans inside. */
const SIDE_PADDINGS = ["padding-left", "padding-right"] as const;

/** The TEXT and INSTANCE_SWAP values a mapping applies, by property name. */
export type PropertyValues = {
  readonly text: Readonly<Record<string, string>>;
  readonly swap: Readonly<Record<string, string>>;
};

/** No property values, as a set's own cells take their labels and icons from the definition. */
export const NO_VALUES: PropertyValues = { text: {}, swap: {} };

/** A label showing the characters a TEXT value gives its property, where one does. */
function labelWith(label: LabelDefinition, text: PropertyValues["text"]): LabelDefinition {
  const characters = label.textProperty === undefined ? undefined : text[label.textProperty];
  return characters === undefined || label.textProperty === undefined ? label : { ...label, characters };
}

/**
 * Where the browser places a form control's text, as HTML's rendering of form controls says: an
 * `<input>` on one line at the start of its content box, centred down it, and a `<textarea>` from its
 * top left, wrapped at its content box's width.
 */
const CONTROL_PLACEMENTS: ReadonlyMap<string, TextPlacement> = new Map([
  ["input", { horizontal: "start", vertical: "center", lines: "single" }],
  ["textarea", { horizontal: "start", vertical: "top", lines: "wrap" }],
]);

/** A label with the placement its box's element gives it, where the box is a form control. */
function withControlPlacement(label: LabelDefinition, tag: string | undefined): PlacedLabel {
  const placement = tag === undefined ? undefined : CONTROL_PLACEMENTS.get(tag);
  return placement === undefined ? label : { ...label, placement };
}

/** An icon slot showing the icon an INSTANCE_SWAP value picks for its property, where one does. */
function slotWith(slot: IconSlot, swap: PropertyValues["swap"]): IconSlot {
  const icon = slot.swapProperty === undefined ? undefined : swap[slot.swapProperty];
  return icon === undefined ? slot : { ...slot, icon };
}

/** Whether a box shows its own text in a cell and no icon or part beside it. */
function showsOnlyText(box: BoxDefinition, cell: Cell): boolean {
  return (
    box.label?.shownIn(cell) === true &&
    box.iconsFor(cell).length === 0 &&
    !(box.parts ?? []).some((child) => child.shownIn(cell))
  );
}

/** A part a cell shows in a box, cascaded: a frame, or an instance of another set. */
type ShownPart =
  | {
      readonly kind: "frame";
      readonly child: PartDefinition;
      /** The frame's key, the part's. */
      readonly key: string;
      readonly name: string;
      readonly cascade: BoxCascade;
      /** Set on a pseudo-element the box draws as a layer, which no DOM order or flow reads place. */
      readonly pseudo?: true;
    }
  | CascadedInstance;

/**
 * Map a box, the root or a part, and the parts and icons below it, from the cascade of each.
 *
 * @param box - The root's or the part's definition.
 * @param cascade - The box's cascade.
 * @param scope - The cell, its variant's key, the build context and the parts that scale.
 * @param room - What the box's parent gives it on each axis.
 * @returns The box, without the root's name or a frame's key.
 */
export function mapBox(box: BoxDefinition, cascade: BoxCascade, scope: MapScope, room: Room): BoxSpec {
  const { variant, cell, context } = scope;
  const reader = cascade.style;
  const number = (property: string, field: SpecField): NumberSpec | undefined =>
    reader.read(
      property,
      (value) => readNumber(value, context.variables),
      describeNumber,
      reader.feed(field)
    );

  const label =
    box.label?.shownIn(cell) === true
      ? withControlPlacement(labelWith(box.label, scope.values.text), cascade.elementTag)
      : undefined;
  const inside = sizingInside(box, cell, cascade.path, label);
  const boxSizing = literalLayout(["border-box"], "strokes count in the auto layout");
  // Strokes inside the box's lengths leave its layers the room inside them. A content box reads once
  // the part maps (`content-box.ts`).
  if (normalizeCss(reader.resolved("box-sizing") ?? "") !== "content-box") {
    reader.read("box-sizing", boxSizing.map, boxSizing.describe, [
      ...reader.feed("stroke"),
      ...reader.feed("sizing"),
      ...inside,
    ]);
  }

  const paint = readPaint(
    reader,
    box.image,
    context.variables,
    variant,
    cascade.measured?.bordersCollapse === true
  );
  dropIdleOrigin(reader, cascade.measured);
  const opacity = reader.read(
    "opacity",
    evaluateNumber,
    (value) => ({ outcome: "literal", detail: `opacity ${value}` }),
    reader.feed("opacity")
  );
  // The box's text color is its label's, and its icons read their own.
  const textColor = reader.read(
    "color",
    (value) => readColor(value, context.variables),
    describeColor,
    label === undefined ? [] : reader.feed("color", [...cascade.path, label.key])
  );
  const slots = box.iconsFor(cell).map((slot) => slotWith(slot, scope.values.swap));
  const onlyText = showsOnlyText(box, cell);
  // The box's lengths and layout read before its parts map, since they decide what a part can fill.
  const fit = onlyText && drawsAlikeWide(reader, paint) ? "room" : "content";
  const { sizing, limits, clips, extent, known, aspectLock } = readSizing(
    reader,
    room,
    context.variables,
    fit,
    inside,
    {
      underMaxWidth: cascade.measured?.underMaxWidth === true,
      ratio: cascade.measured?.ratio,
      spansBeside: cascade.measured?.spansBeside,
    }
  );

  const icons: MappedIcon[] = [];
  const iconCascades = slots.map((slot) => cascade.icon(slot));
  const iconStyles = iconCascades.map(({ style }) => style);
  const stack = readStackedCell(
    reader,
    sizing,
    iconStyles,
    label !== undefined || (box.parts ?? []).some((child) => child.shownIn(cell))
  );
  for (const [place, slot] of slots.entries()) {
    const style = iconStyles[place];
    if (style === undefined) {
      continue;
    }
    if (stack !== undefined && place !== stack.shown) {
      style.dropOwn(STACK_HIDDEN);
      continue;
    }
    if (stack !== undefined) {
      dropShownStackRest(style);
    }
    const icon = mapIcon(slot, style, scope);
    if (icon !== undefined) {
      icons.push({ side: slot.side, style, icon, key: slot.key, at: iconCascades[place]?.drawnAt });
    }
  }
  const onSide = (side: IconSlot["side"]) => icons.filter((each) => each.side === side);
  // Every part cascades before any maps, since an absolute part sits out of the box's flow. The box's
  // flow, `holder.layers`, is the one membership every layout reader below reads: the rooms, the
  // stretch, the label, the display and the placement.
  const cascaded = cascadeParts(box, cascade, scope);
  // An empty part that CSS draws 0 tall and that paints nothing draws in no layer (PE4), and so does a
  // part that leaves no trace, a frame or an instance.
  const leftOut = cascaded.flatMap((part) => {
    if (part.kind === "frame" && vanishes(part.child, part.cascade.style, reader, scope.cell)) {
      return [{ part, reason: EMPTY_PART }];
    }
    return leavesNoTrace(part.cascade.style, reader) ? [{ part, reason: NO_TRACE }] : [];
  });
  for (const { part, reason } of leftOut) {
    part.cascade.style.dropOwn(reason);
    scope.drawn?.omit(part.cascade.drawnAt, part.key);
  }
  const empty: readonly ShownPart[] = leftOut.map(({ part }) => part);
  const inDom = orderModified(
    reader,
    cascaded.filter((part) => !empty.includes(part)),
    slots.length + (label === undefined ? 0 : 1)
  );
  // The parts the markup holds after the label draw after it and the end icons, and so does an
  // absolute part first in the DOM that may end a row beside its label in flow.
  const leading = label !== undefined && onSide("end").length === 0 ? leadingAbsolute(inDom) : undefined;
  const afterLabel = (part: ShownPart): boolean =>
    part === leading || (part.kind === "frame" ? part.child.after : part.visit.part.after) === "label";
  const before = inDom.filter((part) => !afterLabel(part));
  const trailing = inDom.filter((part) => afterLabel(part));
  const shown = [...before, ...trailing];
  const { elementChildren } = cascade;
  const flowing = shown.filter((part) => !outOfFlow(part.cascade.style));
  const flowingBefore = before.filter((part) => !outOfFlow(part.cascade.style));
  const flowingAfter = trailing.filter((part) => !outOfFlow(part.cascade.style));
  const others = [
    ...onSide("start").map(({ icon }) => icon),
    ...(label === undefined ? [] : [label]),
    ...onSide("end").map(({ icon }) => icon),
  ];
  // A part's place in `holder.layers`: the parts before the label, its icons and itself, then the rest.
  const layerIndex = (index: number): number =>
    index < flowingBefore.length ? index : index + others.length;
  const order = [
    ...flowingBefore.map(({ name }) => name),
    ...others.map(({ name }) => name),
    ...flowingAfter.map(({ name }) => name),
  ];
  // The capture resolves a list item's marker, and records a `::marker` only where it sets `content`.
  const markers: MarkerReading = cascade.markerContent === true ? "content" : "resolved";
  // A part's own `align-self` can decide the box's alignment, so the layout reads once they cascade.
  const flow = readFlow(
    reader,
    {
      parts: flowing.map((part) => ({
        key: part.key,
        name: part.name,
        style: part.cascade.style,
        sizing: sizingOf(part.kind === "instance" ? part.visit.part : part.child, cascade.path),
        editable: holdsEditableText(part.kind === "instance" ? part.visit.part : part.child),
        onlyText: part.kind === "frame" && part.pseudo !== true && showsOnlyText(part.child, cell),
        optional: (part.kind === "instance" ? part.visit.part : part.child).optional !== undefined,
        instance: part.kind === "instance",
      })),
      others,
      // The flow ends with the last part after the label, else the last end icon, else the label, else
      // the last start icon or part.
      last:
        flowingAfter.at(-1)?.cascade.style ??
        onSide("end").at(-1)?.style ??
        (label === undefined
          ? (onSide("start").at(-1)?.style ?? flowingBefore.at(-1)?.cascade.style)
          : undefined),
      labelBeforeLast:
        label !== undefined &&
        order.length > 2 &&
        flowingBefore.length + others.indexOf(label) === order.length - 2,
    },
    {
      sizing,
      limits,
      inside,
      markers,
      lineFits: cascade.measured?.lineFits === true,
      trackFits: cascade.measured?.trackFits === true,
      freeAlongMain: cascade.measured?.freeAlongMain === true,
      fitsAlongMain: cascade.measured?.fitsAlongMain === true,
      tableTiles: cascade.measured?.tableTiles === true,
      grid: {
        hugs: cascade.measured?.gridHugs ?? [],
        holds: cascade.measured?.gridHolds ?? [],
        widest: cascade.measured?.gridWidest ?? [],
        tallest: cascade.measured?.gridTallest ?? [],
        items: cascade.measured?.gridItems,
        places: flowing.map((part) => part.cascade.measured?.gridItem),
      },
      outOfFlow: shown.length - flowing.length,
    }
  );
  const { layout } = flow;
  // An icon's margins draw once the layout says whether the box is a flex box.
  const drawIcons = (side: IconSlot["side"]): readonly DrawnIcon[] =>
    onSide(side).map(({ style, icon, key, at }) => {
      const drawn = wrapIconMargins(style, icon, layout, context.variables);
      scope.drawn?.note(at, key, drawn.icon);
      return { style, name: icon.name, ...drawn };
    });
  const start = drawIcons("start");
  const end = drawIcons("end");
  // A class that spaces every child but the last draws as the item spacing only where each element
  // child is a part in the row's flow with no margin of its own, which would beat the class's
  // `:where()`, beside no icon or text, and no gap adds to it.
  const spacedRow =
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    elementChildren === flowing.length &&
    others.length === 0 &&
    !["gap", "column-gap"].some((property) => reader.has(property)) &&
    flowing.every(({ cascade: { style } }) => !style.has("margin-left") && !style.has("margin-right"));
  const spaced = cascade.spaceChildren(
    elementChildren,
    spacedRow ? negativeRowSpacing(context.variables) : undefined
  );
  const partLayer = ({ name, cascade: { style, elementTag } }: ShownPart): RowLayer => ({
    kind: "part",
    name,
    share: partShare(style),
    style,
    tag: elementTag,
  });
  const iconLayer = ({ name, share, style }: DrawnIcon): RowLayer => ({
    kind: "icon",
    name,
    share,
    style,
    tag: undefined,
  });
  const holder: Holder = {
    style: reader,
    layout,
    sizing,
    limits,
    extent,
    layers: [
      ...flowingBefore.map(partLayer),
      ...start.map(iconLayer),
      ...(label === undefined
        ? []
        : [
            {
              kind: "label" as const,
              name: label.name,
              share: UNREAD_SHARE,
              style: undefined,
              tag: undefined,
            },
          ]),
      ...end.map(iconLayer),
      ...flowingAfter.map(partLayer),
    ],
    widthCap: room.widthCap,
    unbounded: room.unbounded,
    widthKnown: known.horizontal,
  };
  const growth = readItemSizing(
    holder,
    flowing.map((part) => part.cascade.style),
    {
      underMaxHeight: cascade.measured?.underMaxHeight,
      itemsAtContent: cascade.measured?.itemsAtContent === true,
      labelOnly: flowing.map(holdsOnlyLabel),
    },
    isPlainBlock(reader, markers)
  );
  const growing = growth?.kind === "fills" ? growth.place : undefined;
  const centred = growth?.kind === "centred" ? growth : undefined;
  // An absolute part that ends the row draws in flow there where the row's end padding keeps its room.
  const last = shown.at(-1);
  const inFlowEnd =
    last?.kind === "frame" &&
    last.pseudo !== true &&
    holder.layers.length === flowing.length &&
    endsInFlow(
      {
        style: reader,
        layout,
        layers: flowing.length,
        endsFlush: growing !== undefined || sizing.horizontal.kind === "hug",
      },
      last.cascade.style
    )
      ? last.cascade.style
      : undefined;
  const fitsOneLine = cascade.measured?.fitsOneLine;
  readWraps(holder, growing, fitsOneLine);
  const flush = SIDE_PADDINGS.every((property) => evaluateLength(reader.resolved(property) ?? "0px") === 0);
  const { clipsAround: _parent, inFlexRow: _row, ...own } = scope;
  const clipped: MapScope = clips && flush ? { ...own, clipsAround: true } : own;
  const partScope: MapScope =
    layout.flex && layout.direction === "HORIZONTAL" ? { ...clipped, inFlexRow: true } : clipped;
  // A popup that hugs its rows hugs the one that sets its width and fills the others.
  const across = rowsAcross(
    { layout, width: sizing.horizontal, limits },
    flowing.map((part) => part.cascade.measured?.holdsWidest === true)
  );
  const minimum =
    across === undefined ? undefined : rowMinimum(limits.minWidth, room, reader, context.variables);
  // An absolute part, frame or instance, is planned before it maps, so the sizing leaves a frame the
  // length its place stretches it to, and reads its place once it maps.
  const planned = new Map(
    shown.flatMap((part) => {
      const plan =
        flowing.indexOf(part) === -1
          ? planPlacement(part.cascade.style, part.kind, {
              parent: reader,
              positionedBy: box.positionedBy,
              parentSpansBlock: part.cascade.measured?.parentSpansBlock === true,
              oneLength: part.cascade.measured?.oneLength ?? new Set(),
              flow: flowing.map((each) => each.cascade.style),
              layers: holder.layers.length,
              paddingBox: paddingBoxOf(absoluteRoom(holder)),
            })
          : undefined;
      return plan === undefined ? [] : [[part.cascade.style, plan] as const];
    })
  );
  // A part's style says whether it is absolute, or in the flow and positioned itself.
  const position = (part: ShownPart) => normalizeCss(part.cascade.style.resolved("position") ?? "static");
  // An absolute part CSS paints where Figma's order cannot, as the paint order says, has no place.
  const arrangement = arrangePaint([
    ...before.map((part) => paintedPart(part, position(part))),
    ...others.map((layer) => ({ key: layer.key, placed: false, positioned: false })),
    ...trailing.map((part) => paintedPart(part, position(part))),
  ]);
  const plans = new Map(
    shown.flatMap((part) => {
      const plan = planned.get(part.cascade.style);
      if (arrangement.unplaceable.has(part.key)) {
        return [[part.cascade.style, UNPAINTABLE] as const];
      }
      return plan === undefined ? [] : [[part.cascade.style, plan] as const];
    })
  );
  // A pseudo-element the kit draws only by its place, so one with no place draws no layer.
  const unplaced = shown.filter(
    (part) =>
      part.kind === "frame" && part.pseudo === true && plans.get(part.cascade.style)?.kind !== "planned"
  );
  for (const part of unplaced) {
    const plan = plans.get(part.cascade.style);
    const why = plan?.kind === "refused" ? plan.why : "the pseudo-element is not absolute";
    for (const property of part.cascade.style.ownProperties()) {
      part.cascade.style.mark(
        property,
        "unmapped",
        `the kit draws no layer for the pseudo-element: ${why}`,
        []
      );
    }
  }
  const drawn = shown.filter((part) => !unplaced.includes(part));
  const drawnBefore = before.filter((part) => !unplaced.includes(part));
  const flowingStyles = flowing.map((each) => each.cascade.style);
  const besideIcon = ({ style, share }: DrawnIcon): BesideLayer => ({ kind: "icon", style, share });
  const fitted = drawn.map((part): FittedPart => {
    const index = flowing.indexOf(part);
    const place =
      index === -1
        ? undefined
        : fitsRowRoom(
            holder,
            flowingStyles,
            index,
            {
              growing,
              frame: part.kind === "frame" && part.pseudo !== true,
              tag: part.cascade.elementTag,
              ownText:
                part.kind === "frame" &&
                part.child.label !== undefined &&
                (part.child.parts ?? []).length === 0 &&
                part.child.iconsFor(cell).length === 0 &&
                part.child.image === undefined,
              layer: layerIndex(index),
              beside: [
                ...start.map(besideIcon),
                ...(label === undefined ? [] : [{ kind: "label" } as const]),
                ...end.map(besideIcon),
              ],
            },
            context.variables
          );
    const fits = place !== undefined;
    const inFlow = (): Room => {
      const inside = roomInside(holder, layerIndex(index));
      const room = rowRoom(inside, across?.[index], minimum);
      if (fits) {
        return fittingRoom(holder, layerIndex(index), room);
      }
      return index === growing ? growingRoom(holder, layerIndex(index), room) : room;
    };
    // A layer its auto margins centre takes them as zero in the width it may hug up to (CSS Sizing 3
    // §2.3), which `centredRoom` in `box-sizing.ts` gives it.
    const room =
      index === -1
        ? placedRoom(absoluteRoom(holder), part.cascade.style, plans.get(part.cascade.style))
        : holder.layout.centresLone === true
          ? inFlow()
          : selfStretchedRoom(holder, part.cascade.style, lessMargins(inFlow(), part.cascade.style));
    const styles = flowing.map((each) => each.cascade.style);
    // The one layer of a box leaves the box its size when it hides: a box fixed or filling on both
    // axes keeps it, and one that hugs is drawn at the layer's literal size with its literal insets.
    const hugs = (axis: "horizontal" | "vertical") => sizing[axis].kind === "hug";
    const keepsRoom: KeptRoom =
      index === -1 ||
      holder.layers.length !== 1 ||
      (["horizontal", "vertical"] as const).some((axis) => hugs(axis) && !literalInsets(reader, axis))
        ? { kind: "none" }
        : {
            kind: "kept",
            hugs: {
              horizontal: hugs("horizontal"),
              vertical: hugs("vertical"),
            },
          };
    const result = mapPart(
      part,
      room,
      layout,
      partScope,
      layout.blocks && adjoinsMargin(styles, index),
      reader,
      // A fixed part sits out of the flow, so its place among the parts is where it shows.
      { index: drawn.indexOf(part), count: drawn.length },
      keepsRoom
    );
    // The fill draws the part's fitted width only where nothing in it paints, moves or keeps it wider at the room's.
    const fit =
      place === undefined
        ? undefined
        : { place, drawn: drawsAtRoom(result.layer, room.horizontal.length, context.variables) };
    if (fit?.drawn === false) {
      part.cascade.style.missing("width", "display", UNFITTED);
    }
    // The row's one growing layer is as wide as its least width where that is wider than the row.
    if (
      growth?.kind === "fills" &&
      growth.alone &&
      index === growing &&
      !fitsRoom(result.layer, leastContentWidth(holder, context.variables), context.variables)
    ) {
      part.cascade.style.missing("width", "flex-grow", OVERGROWN);
    }
    return {
      mapped:
        index === centred?.place
          ? withLayer(result, padCentred(result.layer, result.framed === true, centred.padding, variant))
          : result,
      fit,
    };
  });
  const mapped = fitted.map((each) => each.mapped);
  const drawnWidths = new Map(mapped.map(({ style, width }) => [style, width]));
  // A first part that fits takes the room its row spaces out, as `fitsRowRoom` says.
  const spacedFit = fitted.find((each) => each.fit?.place === "spaced-first")?.fit;
  const parts = settledParts(reader, flow, mapped, scope);
  const missing = unstretched(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  if (missing !== undefined) {
    reader.missing(missing.property, missing.neededBy, missing.detail);
  }
  const clamp = readLineClamp(holder, label);
  const labelSource = labelBox(holder, cascade, label, growing, clips);
  const labelHolder = labelSource.holder;
  const labelScope = (shown: LabelDefinition): LabelScope => {
    const own: LabelScope = {
      cell,
      variables: context.variables,
      context,
      color: textColor,
      clamp,
      variant,
      path: [...cascade.path, shown.key],
      fitsOneLine,
      ellipsisFits: labelSource.ellipsisFits,
      drawnWidths,
      captured: cascade.capturedText(shown.textAttribute?.(cell)),
      runs: shown.textAttribute?.(cell) === undefined ? cascade.textRuns(shown.key) : undefined,
    };
    // A TEXT value gave the label other characters in place, so its layout follows its variant's.
    return shown === box.label || box.label === undefined
      ? own
      : { ...own, variantCharacters: labelCharacters(box.label, cell) };
  };
  const placed = label === undefined ? undefined : mapLabel(labelHolder, label, labelScope(label));
  // A label whose element fills the room the row leaves it takes all the room there is, so the row's
  // alignment shows only where its layers overflow it, and an unset one packs them at the start
  // there, as a collapsed Sidebar row keeps its icon at its start.
  const packsAtStart = labelHolder !== holder && labelHolder.sizing.horizontal.kind === "fill";
  if (placed === undefined) {
    readWithoutLabel(reader);
  }
  const space =
    label === undefined || placed === undefined
      ? undefined
      : spaceBeforeLabel(holder, label, placed.layer, start.length, variant);
  // An absolute part first in the DOM ends the row in flow where the row ends flush: one layer grows,
  // the row hugs, or the label fills.
  const leadingEnd =
    leading !== undefined &&
    endsBesideLabel(
      {
        style: reader,
        layout,
        layers: holder.layers.length,
        endsFlush:
          growing !== undefined ||
          sizing.horizontal.kind === "hug" ||
          placed?.layer.sizing.horizontal.kind === "fill",
      },
      leading.cascade.style,
      huggedWidth(mapped[drawn.indexOf(leading)]?.layer)
    )
      ? leading.cascade.style
      : undefined;
  const endInFlow = inFlowEnd ?? leadingEnd;
  const after: readonly ChildLayerSpec[] = [
    ...start.map(({ layer }) => layer),
    ...(placed === undefined ? [] : [placed.layer]),
    ...end.map(({ layer }) => layer),
  ];
  // The display reads once the layers are known, since a grid maps only around one item.
  const textBlock = readDisplay(reader, order, label?.name, layout, clamp, {
    width: across === undefined ? sizing.horizontal : FILL_ACROSS,
    inside,
    markers,
    inlineRow: cascade.measured?.inlineRow === true,
    stacked: stack !== undefined,
  });
  const width = fixedLength(sizing.horizontal);
  // Separators that cancel a column's padding move the padding onto sections around the runs between them.
  const bleed = readBleed(
    {
      style: reader,
      layout,
      clips: clips || (scope.clipsAround === true && sizing.horizontal.kind === "fill"),
      drawsOthers: after.length > 0,
    },
    parts,
    context.variables
  );
  const sections = bleed.kind === "sections" ? bleed : undefined;
  const folding: FoldingBox = {
    paints: paint.fill !== undefined || paint.stroke !== undefined || paint.shadows.length > 0,
    hugs: sizing.horizontal.kind === "hug",
    inFlexRow: scope.inFlexRow === true,
  };
  // Rows that share a translate across move a column's content box, or a wrapper carries it up.
  const shared =
    layout.direction === "VERTICAL" && sections === undefined && endInFlow === undefined
      ? sharedTranslate(
          flowing.map((part) => part.cascade.style),
          scope.translates
        )
      : undefined;
  const moved = shared && foldTranslate(reader, shared, context.variables);
  if (shared !== undefined && moved === undefined && !folding.paints && !clips && flush) {
    scope.translates.set(reader, shared);
  }
  const paddingLeft =
    sections?.paddingLeft ??
    moved?.left ??
    foldNegativeMargin(reader, "left", folding, context.variables) ??
    number("padding-left", "paddingLeft") ??
    ZERO;
  const paddingRight =
    sections?.paddingRight ??
    (endInFlow === undefined
      ? (moved?.right ??
        foldNegativeMargin(reader, "right", folding, context.variables) ??
        number("padding-right", "paddingRight"))
      : padToOffset(reader, endInFlow, context.variables)) ??
    ZERO;
  const placement = placeParts(
    {
      style: reader,
      layout,
      layers: holder.layers.length,
      size: { width, stroke: paint.stroke, paddingLeft, paddingRight },
      positionedBy: box.positionedBy,
    },
    parts,
    endInFlow,
    plans
  );
  for (const { source, layer, border } of placement.placed) {
    // Each part's border box is drawn where placement leaves it.
    scope.drawn?.note(source.part.at, source.part.key, border);
    // Placement gives an absolute instance a new layer, which paints what the layer it replaces does,
    // and the instance a placement wrapper holds paints it too.
    const before = source.layer;
    const drawn = before.kind === "instance" && layer !== before ? scope.painted.resolve(before) : undefined;
    const [held] = layer.kind === "frame" ? layer.children : [layer];
    if (held?.kind === "instance" && drawn?.kind === "frame") {
      scope.painted.note(held, drawn);
    }
  }
  const placedLayers = placement.placed.map(({ layer }) => layer);
  // A Figma grid spaces its tracks by its own gaps, which `readGrid` reads.
  const grid =
    layout.grid === undefined
      ? undefined
      : readGrid(
          reader,
          layout.grid,
          flowing.map((part) => part.cascade.style),
          context.variables
        );
  // A grid in one column spaces its rows by `row-gap`, which `gap` sets too.
  const itemSpacing =
    (grid === undefined ? undefined : ZERO) ??
    (centred === undefined ? undefined : foldGap(reader)) ??
    space ??
    spaced ??
    (layout.oneColumnGrid === true ? number("row-gap", "itemSpacing") : undefined) ??
    number("gap", "itemSpacing") ??
    // A row spaces its layers by `column-gap` (CSS Box Alignment 3 §8.1), as `gap-x-4` does.
    (layout.flex && layout.direction === "HORIZONTAL" ? number("column-gap", "itemSpacing") : undefined) ??
    ZERO;
  const counterAlign =
    placed?.counterAlign ??
    centresBesideSpan(layout, sizing.horizontal, flowing, (part) => mapped[drawn.indexOf(part)]?.layer) ??
    (textBlock ? blockLineAlign(layout, sizing, limits) : layout.counterAlign);
  // The parts before the label sit first, sectioned where separators cancel the box's padding, and
  // the parts after the label last.
  const first = placedLayers.slice(0, drawnBefore.length);
  const laid: readonly ChildLayerSpec[] = [
    ...(sections === undefined
      ? first
      : sectioned(reader, first, sections, {
          itemSpacing,
          counterAlign,
          hugs: new Set(
            flowing.flatMap((part, index) => (across?.[index]?.kind === "hug" ? [part.key] : []))
          ),
        })),
    ...after,
    ...placedLayers.slice(drawnBefore.length),
  ];
  const joined = joinFlushLayers(
    reader,
    layout,
    flowing.map((part) => ({ key: part.key, style: part.cascade.style })),
    laid,
    counterAlign
  );
  // A row whose first part's auto margin ends the others draws them in a frame of their own.
  const children =
    layout.restAtEnd === true
      ? drawRestAtEnd(reader, joined, { itemSpacing, counterAlign }, sizing.vertical)
      : joined;
  // A row spaced around a first part that fits packs at its start, and where a fill does not draw
  // that part, the row's spacing stays unmapped with it.
  const unspaced =
    spacedFit === undefined ? spacesNothingOut(layout, placement.primaryAlign, children) : "fits";
  if (spacedFit?.drawn === false) {
    reader.mark("justify-content", "unmapped", UNFITTED, []);
  } else if (layout.spaceBetweenUnread === true) {
    readSpaceBetween(reader, unspaced);
  }
  let laidOut: BoxSpec = {
    direction: grid === undefined ? layout.direction : "GRID",
    // A box whose one layer hides keeps the length that layer holds, which Figma's auto layout would
    // give back where the box hugs it.
    sizing: children.some((child) => child.kind === "frame" && child.hidden === true)
      ? heldSizing(reader, { sizing, limits }, children)
      : sizing,
    limits,
    clips,
    paddingTop: number("padding-top", "paddingTop") ?? ZERO,
    paddingRight: sections === undefined ? paddingRight : ZERO,
    paddingBottom: number("padding-bottom", "paddingBottom") ?? ZERO,
    paddingLeft: sections === undefined ? paddingLeft : ZERO,
    itemSpacing,
    // A native control's placement of its label wins over the box's own alignment.
    primaryAlign:
      placed?.primaryAlign ??
      (centred === undefined ? undefined : "SPACE_BETWEEN") ??
      (packsAtStart ||
      leavesRoomAtEnd(layout, sizing, placement.primaryAlign, children) ||
      unspaced !== undefined
        ? "MIN"
        : placement.primaryAlign),
    counterAlign,
    cornerRadius: ZERO,
    ...paint,
    opacity: opacity ?? 1,
    children,
  };
  if (aspectLock !== undefined) {
    laidOut = { ...laidOut, aspectLock };
  }
  // The corners read last, since a radius per corner can take its side's least length from the box
  // as laid out.
  laidOut = {
    ...laidOut,
    cornerRadius:
      readCorner(
        reader,
        {
          sizing,
          held: heldSizing(reader, { sizing, limits }, children),
          leastHeight: boxHeightBounds(
            grid === undefined ? laidOut : { ...laidOut, grid: keyedCells(grid, children) },
            context.variables
          ).min,
        },
        context.variables
      ) ?? ZERO,
  };
  // A grid frame aligns MIN, the one value Figma takes on a grid, and places its items by their cells.
  const mappedBox: BoxSpec =
    grid === undefined
      ? laidOut
      : { ...laidOut, primaryAlign: "MIN", counterAlign: "MIN", grid: keyedCells(grid, children) };
  const stacks = mapped.map(({ stacked, style, paints }) => ({
    layer: scope.painted.resolveBox(stacked),
    style,
    paints,
  }));
  const firstOnTop = layout.blocks && stacksFirstOnTop(reader, stacks);
  // Each placed layer paints where CSS paints it among the in-flow ones, whose flow order stays. A box
  // that paints its first layer on top reads its order the other way round, so it keeps the markup's.
  const positioned = new Set(
    flowing.flatMap((part) => (POSITIONED_IN_FLOW.has(position(part)) ? [part.key] : []))
  );
  const painting = arrangePaint(
    children.map((child) => ({
      key: child.key,
      placed: outOfLayout(child),
      positioned: positioned.has(child.key),
    }))
  );
  const ordered =
    firstOnTop || painting.unplaceable.size > 0 ? children : inPaintOrder(children, painting.order);
  readRaisedLevels(
    drawn.map((part) => ({
      key: part.key,
      paintsLast: part.cascade.measured?.paintsLast === true,
      style: part.cascade.style,
    })),
    { order: ordered.map(({ key }) => key), firstOnTop }
  );
  const painted: BoxSpec = { ...mappedBox, children: ordered };
  return firstOnTop ? { ...painted, firstOnTop: true } : painted;
}

/** A part as the paint order reads it: absolute, or in the flow and positioned itself. */
function paintedPart(part: ShownPart, position: string): PaintedLayer {
  return { key: part.key, placed: position === "absolute", positioned: POSITIONED_IN_FLOW.has(position) };
}

/** The parent's padding box lengths an absolute part's percentages take, where the room knows them. */
function paddingBoxOf(room: Room) {
  const length = ({ percent }: Room["horizontal"]) => (percent.kind === "length" ? percent.value : undefined);
  return { horizontal: length(room.horizontal), vertical: length(room.vertical) };
}

/** The positions of an in-flow box that is positioned, which paints among the absolute ones. */
const POSITIONED_IN_FLOW: ReadonlySet<string> = new Set(["relative", "sticky"]);

/**
 * Whether a flex row with no `justify-content` has room beside its layers, so CSS packs them at its
 * start (CSS Box Alignment 3 §5.1.3: `normal` acts as `stretch`, which acts as `flex-start` in a flex container), where the
 * unset alignment {@link readFlow} gives a row centers them. Such a row is a fixed length or fills
 * its parent, no layer in its flow fills the row, and one hugs its content, as Select's item text
 * hugs its label. A row that fills its parent, where every in-flow layer has a fixed width and none is a direct icon
 * layer, packs them at its start too, as Data table filter's bar sets its Trigger at the start of its 768px row. A row that hugs its
 * layers or holds one that fills it draws alike at either alignment, and so may a fixed row of fixed
 * layers, as a Radio's 16px indicator fills its 16px circle, so those keep their own.
 *
 * @param layout - The row's layout.
 * @param sizing - The row's sizing.
 * @param aligned - The alignment the row's placement gives it, which a translate may have moved.
 * @param children - The row's layers.
 * @returns True where the row packs its layers at its start.
 */
function leavesRoomAtEnd(
  layout: Layout,
  sizing: SizingSpec,
  aligned: PrimaryAlignSpec,
  children: readonly ChildLayerSpec[]
): boolean {
  const flowing = children.filter((child) => !outOfLayout(child));
  return (
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    layout.justify === "unset" &&
    aligned === layout.primaryAlign &&
    sizing.horizontal.kind !== "hug" &&
    flowing.every((child) => child.kind === "icon" || child.sizing.horizontal.kind !== "fill") &&
    (flowing.some((child) => child.kind !== "icon" && child.sizing.horizontal.kind === "hug") ||
      (sizing.horizontal.kind === "fill" &&
        flowing.length > 0 &&
        flowing.every((child) => child.kind !== "icon" && child.sizing.horizontal.kind === "fixed")))
  );
}

/**
 * Whether a flex box that spaces its layers out between its ends has no free space to share out
 * between two layers, so `space-between` packs its layers at the start with the gap between them
 * (CSS Box Alignment 3 §5.3, §8):
 *
 * - It holds one layer in its flow, which `space-between` places as `flex-start` does, as Select
 *   field's heading row holds its lone label.
 * - It holds a layer that fills it along its direction, which takes the free space (CSS Flexbox 1
 *   §9.7), as Select field's filling trigger packs its growing value and its caret. Figma's
 *   SPACE_BETWEEN would drop the gap beside a filling layer (PV), so the box draws MIN with its gap.
 *
 * A layer a BOOLEAN hides stays in the flow here, since the property shows it again, and SPACE_BETWEEN
 * packs the lone visible layer at the start while it is hidden (W5-P1).
 *
 * @param layout - The box's layout.
 * @param aligned - The alignment the box's placement gives it.
 * @param children - The box's layers.
 * @returns Why the box packs its layers at its start, or undefined where it spaces them out.
 */
function spacesNothingOut(
  layout: Layout,
  aligned: PrimaryAlignSpec,
  children: readonly ChildLayerSpec[]
): UnspacedReason | undefined {
  if (!layout.flex || aligned !== "SPACE_BETWEEN") {
    return undefined;
  }
  const along = layout.direction === "HORIZONTAL" ? "horizontal" : "vertical";
  const flowing = children.filter((child) => !outOfLayout(child));
  if (flowing.length < 2) {
    return "lone";
  }
  return flowing.some((child) => child.kind !== "icon" && child.sizing[along].kind === "fill")
    ? "grows"
    : undefined;
}

/**
 * Read a flex row's `flex-wrap` where the row never breaks a line. A wrapping row breaks a line only
 * where its layers overflow it (CSS Flexbox 1 §9.3), while a Figma row never wraps.
 *
 * - In a row of fixed or filling width with one layer that grows, that layer takes what the others
 *   leave, so the row breaks no line until they overflow it.
 * - A row that hugs its width with nothing bounding the width CSS gives it lays its layers out on one
 *   line, so it never runs out of room, as {@link hugsUncapped} says.
 *
 * - A row its definition measured to fit its layers on one line in every cell drops it with that
 *   measurement, as {@link BoxDefinition.fitsOneLine} says.
 *
 * Elsewhere it stays unread, so it lands unmapped. Where it drops, so does the `row-gap` beside it,
 * which spaces lines the row never breaks into.
 *
 * @param holder - The box.
 * @param growing - The place of the box's layer that grows, as `readGrowth` found it.
 * @param fitsOneLine - The measurement that the row's layers fit on one line, or undefined.
 */
function readWraps(holder: Holder, growing: number | undefined, fitsOneLine: string | undefined): void {
  const { style, layout } = holder;
  if (!layout.flex || layout.direction !== "HORIZONTAL") {
    return;
  }
  const detail =
    growing === undefined && !hugsUncapped(holder)
      ? fitsOneLine
      : growing === undefined
        ? "the row hugs its layers and nothing bounds the width CSS gives it, so it never runs out of room to break a line, and a Figma row never wraps"
        : "the one layer that grows takes what the row's other layers leave, so the row breaks no line until they overflow it, and a Figma row never wraps";
  if (detail === undefined) {
    return;
  }
  const wraps = style.has("flex-wrap");
  style.read(
    "flex-wrap",
    (value) => (normalizeCss(value) === "wrap" ? value : undefined),
    () => ({ outcome: "dropped", detail }),
    []
  );
  // `row-gap` spaces the lines a wrapping row breaks into (CSS Box Alignment 3 §8.1), so a row on one
  // line leaves it nothing to space.
  if (wraps) {
    style.read(
      "row-gap",
      (value) => value,
      () => ({
        outcome: "dropped",
        detail: `the row sets its layers on one line, as ${detail}, so no gap between lines shows`,
      }),
      []
    );
  }
}

/** A width a box's blocks fill, as a popup's rows fill it where `rowsAcross` sizes them. */
const FILL_ACROSS: SizeSpec = { kind: "fill" };

/**
 * The absolute part first in a box's DOM that may end the row in flow beside the box's label, as
 * {@link endsBesideLabel} decides once the box maps: a frame part, out of the flow, with no other
 * part after it.
 */
function leadingAbsolute(parts: readonly ShownPart[]): ShownPart | undefined {
  const [first] = parts;
  return first?.kind === "frame" &&
    first.pseudo !== true &&
    parts.length === 1 &&
    outOfFlow(first.cascade.style)
    ? first
    : undefined;
}

/**
 * Cascade the parts a box shows in the cell, each below the box: a frame part, and an instance part's
 * inner root, as {@link InstanceParts.cascade} builds it in place.
 *
 * @param box - The box's definition.
 * @param cascade - The box's cascade.
 * @param scope - The cell and the instance parts that build in place.
 * @returns The parts, in DOM order.
 */
function cascadeParts(box: BoxDefinition, cascade: BoxCascade, scope: MapScope): readonly ShownPart[] {
  const { cell } = scope;
  const elements = (box.parts ?? [])
    .filter((child) => child.shownIn(cell))
    .flatMap((child): readonly ShownPart[] => {
      if ("kind" in child) {
        return [scope.instances.cascade(child, cascade, cell)];
      }
      const name = partName(child);
      const own = cascade.part(name, elementOf(child));
      // A part that generates no box hands its parts to this box (`no-box.ts`).
      if (own.measured?.noBox === true) {
        return cascadeParts({ ...child, parts: liftParts(child, own, cell) }, own, scope);
      }
      return [{ kind: "frame", child, key: child.key, name, cascade: own }];
    });
  const pseudo = pseudoParts(cascade).map(
    ({ pseudo, child, cascade: own }): ShownPart & { readonly at: "before" | "after" } => ({
      kind: "frame",
      child,
      key: child.key,
      name: child.key,
      cascade: own,
      pseudo: true,
      at: pseudo,
    })
  );
  return [
    ...pseudo.filter(({ at }) => at === "before"),
    ...elements,
    ...pseudo.filter(({ at }) => at === "after"),
  ];
}

/** What finds a frame part's element: its key, its `data-slot`, or its place for a part without one. */
function elementOf(child: PartDefinition): PartElement {
  const element: PartElement = { key: child.key, slot: child.slot };
  const placed = child.place === undefined ? element : { ...element, place: child.place };
  const optional = child.optional === undefined ? placed : { ...placed, optional: true as const };
  return child.after === undefined ? optional : { ...optional, after: child.after };
}

/**
 * Map one part in the room its box gives it. An instance part draws as its instance layer, and its
 * box's stacking reads its inner root as built in place. A frame part maps as a box, with the ring
 * fill a spread ring needs, as a slot around a dot where it scales, linked to its BOOLEAN property,
 * turned, and inside a frame that draws its margins.
 *
 * @param part - The part, as {@link cascadeParts} cascaded it.
 * @param room - What the box gives the part on each axis.
 * @param layout - The box's layout, which a part's margins read.
 * @param scope - The cell, the build context, the parts that scale and the instance parts.
 * @param collapses - Whether a vertical margin of the part adjoins another margin in a block box, as
 *   {@link adjoinsMargin} says.
 * @param parent - The box's style, which a fixed instance part's place and its margins read.
 * @param among - Where the part sits among the parts the box draws.
 * @param keepsRoom - Whether the box keeps its size with the part hidden, as {@link readHidden} needs.
 * @returns The part as mapped.
 */
function mapPart(
  part: ShownPart,
  room: Room,
  layout: Layout,
  scope: MapScope,
  collapses: boolean,
  parent: LayerStyle,
  among: DrawnAmong,
  keepsRoom: KeptRoom
): MappedPart {
  // The row that sets a popup's width keeps the popup's minimum, which no class of its own sets.
  const minimum = part.cascade.measured?.widest === true ? room.rowMinimum : undefined;
  if (part.kind === "instance") {
    const fixed = fixedPlace(
      { own: part.visit.part.of.viewport, composite: scope.viewport, style: part.cascade.style },
      layout,
      parent,
      among
    );
    const { layer: built, painted } = scope.instances.map(part, fixed?._tag === "placed" ? fixed.room : room);
    if (fixed?._tag === "placed") {
      placeFixed(part.cascade.style, fixed);
    } else if (fixed?._tag === "refused") {
      refuseFixedPlace(part.cascade.style);
    }
    const drawn = minimum === undefined ? built : { ...built, minWidth: minimum };
    const { layer, instance } = wrapInstanceMargins(
      part.cascade.style,
      drawn,
      parent,
      layout,
      scope.context.variables,
      collapses,
      scope.clipsAround === true
    );
    // The stacking reads what the instance draws, its inner root as built in place.
    const mapped: MappedPart = {
      layer,
      stacked: painted,
      style: part.cascade.style,
      paints: painted.fill !== undefined,
      width: DECLARED_WIDTH,
      border: instance,
      part: { key: part.key, at: part.cascade.drawnAt },
    };
    return instance === layer ? mapped : { ...mapped, wrapped: instance };
  }
  const frame = mapBox(part.child, part.cascade, scope, room);
  const floored =
    minimum === undefined ? frame : { ...frame, limits: { ...frame.limits, minWidth: minimum } };
  const own =
    room.subgridCell === undefined
      ? floored
      : drawSubgridCell(part.cascade.style, floored, room.subgridCell, scope.main);
  // Figma draws a part's spread ring only over a visible fill with clipping on (PR2).
  const ringed = castsSpread(own.shadows) ? { ...own, fill: ringFill(own), clips: true } : own;
  const box = readContentBox(part.cascade.style, ringed, part.cascade.inPlace() !== undefined);
  const scaled = scope.scaling.has(part.child) ? slotAroundDot(part.cascade.style, box) : undefined;
  const drawn: FrameLayerSpec = {
    kind: "frame",
    key: part.child.key,
    name: part.name,
    ...(scaled?.slot ?? box),
  };
  const { optional } = part.child;
  const linked = optional === undefined ? drawn : { ...drawn, visibleProperty: optional.name };
  const rotation = readRotation(part.cascade.style);
  const turned = rotation === undefined ? linked : { ...linked, rotation };
  const { layer: wrapped, box: inMargins } = wrapFrameMargins(
    part.cascade.style,
    turned,
    layout,
    scope.context.variables,
    collapses,
    scope.clipsAround === true
  );
  // The layer its box holds hides, the frame that draws the part's margins where it has one, once
  // its size is known, since that is the size the box keeps.
  const layer =
    optional === undefined && readHidden(part.cascade.style, keepsRoom, wrapped)
      ? { ...wrapped, hidden: true as const }
      : wrapped;
  const framed = wrapped !== turned;
  const { horizontal } = frame.sizing;
  // The browser measures a part that scales at its scaled size, which its dot draws; any other part's
  // border box is its own frame, inside the frame of its margins where it has one.
  const border = scaled?.dot ?? (framed ? inMargins : layer);
  return {
    layer,
    stacked: layer,
    style: part.cascade.style,
    paints: own.fill !== undefined,
    framed,
    width:
      horizontal.kind === "fixed" && horizontal.length.kind === "literal"
        ? { kind: "fixed", value: horizontal.length.value }
        : DECLARED_WIDTH,
    border,
    part: { key: part.key, at: part.cascade.drawnAt },
  };
}

/**
 * Whether a box keeps its size with its part hidden: `none` where the part is not its one layer in
 * flow, and `kept` with the axes the box hugs, which the box holds at the part's literal length.
 */
type KeptRoom =
  | { readonly kind: "none" }
  | { readonly kind: "kept"; readonly hugs: { readonly horizontal: boolean; readonly vertical: boolean } };

/**
 * Why a row's last part that fits its content to the room the row leaves it stays unmapped where a
 * fill would draw it otherwise, as `fitting-part.ts` says.
 */
const UNFITTED =
  "the part fits its content to the room the row leaves it, and a fill draws that room, where it or a layer inside it paints, turns, does not start at its start, holds a text that does not wrap or may be wider than the room, so it would draw wider or elsewhere";

/** Why the width of a row's one growing layer stays unmapped where it may not fit the row. */
const OVERGROWN =
  "the row's one layer grows into the row and keeps its least width, and that width may be wider than the row in a mode or is unknown, so the layer would draw wider than the fill";

/** Why a hidden part draws as a hidden layer. */
const HIDDEN =
  "the layer is hidden, which paints nothing of it or of what it holds, and the box it fills keeps its size without it";

/**
 * Read a part's `visibility: hidden`, which `invisible` sets, as a hidden layer. CSS paints nothing
 * of a hidden box, and nothing of its descendants that inherit the value, while the box keeps its room
 * in the layout (CSS Display 3 §4.1). Figma paints nothing of a hidden layer or of what it holds, but
 * its auto layout lays the layer out as if it were gone, so the two draw alike only where the room
 * the part keeps changes nothing: the part is the one layer of a box whose width and height are fixed
 * or fill, which keeps its size without it, or that hugs it on an axis where the part has a literal
 * length, as a calendar's outside day button holds its cell, so the box is drawn at that length and
 * its insets, as `held-size.ts` reads it. Anywhere else the
 * value stays unread, so it lands unmapped, and so does a descendant's own `visibility: visible`,
 * which CSS shows inside the hidden box and Figma hides with it.
 *
 * @param style - The part's style.
 * @param keepsRoom - Whether the box that holds the part keeps its size with the part hidden.
 * @param drawn - The layer the box holds for the part, its margin frame where it has one, whose literal
 *   lengths a box that hugs it keeps.
 * @returns Whether the part draws hidden.
 */
function readHidden(style: LayerStyle, keepsRoom: KeptRoom, drawn: FrameLayerSpec): boolean {
  const literal = (axis: "horizontal" | "vertical"): boolean => {
    const size = drawn.sizing[axis];
    return size.kind === "fixed" && size.length.kind === "literal";
  };
  const kept =
    keepsRoom.kind === "kept" &&
    (!keepsRoom.hugs.horizontal || literal("horizontal")) &&
    (!keepsRoom.hugs.vertical || literal("vertical"));
  return (
    style.read(
      "visibility",
      (value) => (kept && normalizeCss(value) === "hidden" ? value : undefined),
      () => ({ outcome: "literal", detail: HIDDEN }),
      []
    ) !== undefined
  );
}

/**
 * The parts as their box places them once its flow settles: each layer the row stretches across its
 * height, by its key, as {@link settleFlow} decides from the heights the parts mapped to, and each
 * instance noted with what it paints, through its layer as the box holds it, which the boxes above
 * read.
 *
 * @param reader - The box's style.
 * @param flow - The box's flow, as {@link readFlow} read it.
 * @param mapped - The box's parts, as {@link mapPart} mapped them.
 * @param scope - The mapping's scope: the synced variables, whose values bound the parts' heights, and
 *   what each instance layer of the mapping paints.
 * @returns Each part's style and layer.
 */
function settledParts(
  reader: LayerStyle,
  flow: Flow,
  mapped: readonly MappedPart[],
  scope: MapScope
): readonly Pick<MappedPart, "layer" | "style" | "border" | "part">[] {
  const { painted } = scope;
  const stretched = settleFlow(
    reader,
    flow,
    mapped.filter(({ style }) => !outOfFlow(style)).map(({ layer }) => layer),
    scope.context.variables
  );
  return mapped.map((part) => {
    const { layer, stacked, wrapped } = part;
    const settled = withLayer(part, stretchedLayer(layer, stretched));
    if (settled.layer.kind === "instance") {
      painted.note(settled.layer, stacked);
    }
    if (wrapped !== undefined) {
      painted.note(wrapped, { ...stacked, key: wrapped.key, name: wrapped.name });
    }
    return settled;
  });
}

/**
 * A part with a copy of its layer in the layer's stead: the copy draws the part's border box where
 * the layer did, and a layer inside it still does.
 *
 * @param part - The part.
 * @param copy - A copy of the part's layer with fields changed, or the layer itself.
 * @returns The part with the copy.
 */
function withLayer<Part extends Pick<MappedPart, "layer" | "border">>(
  part: Part,
  copy: FrameLayerSpec | InstanceLayerSpec
): Part {
  return { ...part, layer: copy, border: part.border === part.layer ? copy : part.border };
}

/**
 * A part as its box mapped it: the layer it draws, the frame the box's stacking reads, which is the
 * layer for a frame and the inner root as built in place for an instance, with the instances inside it
 * drawn so, its style, and whether it paints a fill of its own.
 */
type MappedPart = {
  readonly layer: FrameLayerSpec | InstanceLayerSpec;
  readonly stacked: FrameLayerSpec;
  readonly style: LayerStyle;
  readonly paints: boolean;
  /**
   * The instance inside the frame that draws an instance part's margins, as the margin box returned
   * it, absent for any other part.
   */
  readonly wrapped?: InstanceLayerSpec;
  /** Whether a frame part's layer is the frame that draws its margins. */
  readonly framed?: boolean;
  /** The width the part draws, as a label beside it in a row reads it. */
  readonly width: DrawnWidth;
  /** The layer that draws the part's border box: `layer` itself, or a layer inside it. */
  readonly border: FrameLayerSpec | InstanceLayerSpec;
  /** The part's key and where its element sits, which the cell's record of drawn parts notes. */
  readonly part: { readonly key: string; readonly at: DrawnAt | undefined };
};

/**
 * A part as its box mapped it, with its fit where it fits the room its row leaves it: its place in
 * the row, as `fitsRowRoom` reads it, and whether a fill of that room draws it.
 */
type FittedPart = {
  readonly mapped: MappedPart;
  readonly fit: { readonly place: FitPlace; readonly drawn: boolean } | undefined;
};

/**
 * The field a part's sizing fills, in the coordinates of the box that holds it: a frame's sizing, or
 * an instance layer as a whole, whose sizing in its parent's auto layout the instance carries.
 *
 * @param part - The part.
 * @param path - The keys of the layers from the root down to the box that holds it.
 * @returns The feed.
 */
function sizingOf(part: PartDefinition | InstanceDefinition, path: readonly string[]): Feed {
  return "kind" in part
    ? [{ path: [...path, part.key], field: "instance" }]
    : [{ path: [...path, part.key], field: "sizing" }];
}

/**
 * The sizing of the layers inside a box in a cell, which the box's layout decides: each part the cell
 * shows, absolute ones too, and the label. An icon draws at its own size.
 *
 * @param box - The box's definition.
 * @param cell - The cell.
 * @param path - The keys of the layers from the root down to the box.
 * @param label - The label the box shows in the cell, or undefined for none.
 * @returns The feed.
 */
function sizingInside(
  box: BoxDefinition,
  cell: Cell,
  path: readonly string[],
  label: { readonly key: string } | undefined
): Feed {
  return [
    ...(box.parts ?? []).filter((part) => part.shownIn(cell)).flatMap((part) => sizingOf(part, path)),
    ...(label === undefined ? [] : [{ path: [...path, label.key], field: "sizing" as const }]),
  ];
}

/**
 * The box a label sits in: the element the box holds it in where a class of the box styles that
 * element and the element ends a row that {@link labelElementHolder} draws, as
 * `[&>span:last-child]:truncate` styles a Sidebar row's `<span>`, or else the box itself.
 *
 * @param holder - The box.
 * @param cascade - The box's cascade, which cascades the label's element.
 * @param label - The label the box shows in the cell, or undefined for none.
 * @param growing - The index of the box's layer that grows, or undefined for none.
 * @param clips - Whether the box clips what overflows it.
 * @returns The holder whose style and layout the label maps from, and whether the capture measured
 *   room there for the label's first character and an ellipsis.
 */
function labelBox(
  holder: Holder,
  cascade: BoxCascade,
  label: LabelDefinition | undefined,
  growing: number | undefined,
  clips: boolean
) {
  const box = { holder, ellipsisFits: cascade.measured?.ellipsisFits === true };
  if (label === undefined) {
    return box;
  }
  const element = cascade.labelElement({ last: holder.layers.at(-1)?.kind === "label", key: label.key });
  if (element === undefined) {
    return box;
  }
  // The measurement is the element's whose style the label maps from.
  const { ellipsisFits } = element.measured;
  const own = labelElementHolder(holder, element.style, label, growing, { ellipsisFits, rowClips: clips });
  return own === undefined ? box : { holder: own, ellipsisFits };
}

/** An icon the box shows, as it maps before the box's layout: its side, its style and its layer. */
type MappedIcon = {
  readonly side: IconSlot["side"];
  readonly style: LayerStyle;
  readonly icon: IconLayerSpec;
  /** The icon's key and where the element the probe measures for it sits. */
  readonly key: string;
  readonly at: DrawnAt | undefined;
};

/**
 * An icon as the box draws it once its layout is known: its style, the layer the box holds, which
 * draws its margins where they map, and the width it takes along a row, as `margin-box.ts` gives them.
 */
type DrawnIcon = IconMarginBox & { readonly style: LayerStyle; readonly name: string };

/**
 * What an icon's `display` makes of it, by the value Tailwind compiles. An icon in a flex box is a
 * flex item, which lays out as a block whatever its display (CSS Display 3 §2.7), so `block` shows it
 * as `inline-block` does.
 */
const ICON_DISPLAYS = new Map([
  ["none", { shown: false, detail: "the icon is left out" }],
  ["inline-block", { shown: true, detail: "the icon shows where its box's auto layout places it" }],
  ["block", { shown: true, detail: "the icon shows where its box's auto layout places it" }],
]);

/**
 * Map one icon. A slot whose computed style is `display: none` is left out, as the pending
 * Button leaves out its own leading icon while its spinner takes the place, and `inline-block`
 * shows it. The icon's glyph takes the text color it inherits, as a Fuse icon paints with
 * `currentColor`. Its `vertical-align` drops, since Figma has no line of text, and the box's auto
 * layout places the icon across its row instead.
 *
 * @returns The icon layer, or undefined for an icon the cell hides.
 */
function mapIcon(
  slot: IconSlot,
  style: LayerStyle,
  { variant, context }: MapScope
): IconLayerSpec | undefined {
  const display = style.read(
    "display",
    (value) => ICON_DISPLAYS.get(normalizeCss(value)),
    ({ detail }) => ({ outcome: "literal", detail }),
    // Whether the icon shows decides the layers its box holds.
    style.feed("layers", style.path.slice(0, -1))
  );
  style.read(
    "vertical-align",
    (value) => value,
    () => ({
      outcome: "dropped",
      detail: "Figma has no line of text, so the box's auto layout places the icon",
    }),
    []
  );
  if (display?.shown === false) {
    for (const property of ["width", "height"]) {
      style.mark(property, "dropped", "the icon is left out", []);
    }
    return undefined;
  }
  const size = style.feed("size");
  const width = style.read("width", (value) => readNumber(value, context.variables), describeNumber, size);
  const height = style.read("height", (value) => readNumber(value, context.variables), describeNumber, size);
  const color = style.read(
    "color",
    (value) => readColor(value, context.variables),
    describeColor,
    style.feed("color")
  );
  if (width === undefined || color === undefined || JSON.stringify(width) !== JSON.stringify(height)) {
    throw new KitUnmappable({ message: `${variant}: the ${slot.name} needs a square size and a text color` });
  }
  const layer: IconLayerSpec = {
    kind: "icon",
    key: slot.key,
    name: slot.name,
    icon: iconKey(weightedIconName(slot.icon, slot.weight)),
    swapProperty: slot.swapProperty,
    size: width,
    color,
  };
  const linked = slot.optional === undefined ? layer : { ...layer, visibleProperty: slot.optional.name };
  const rotation = readRotation(style);
  return rotation === undefined ? linked : { ...linked, rotation };
}
