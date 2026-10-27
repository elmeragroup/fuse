/**
 * Map a box, the root or a part, and the parts and icons below it onto Figma fields, from the
 * cascade of each: its display, corner and icons, assembled from what the other modules read.
 * `box-flow.ts` lays out its flow, `box-sizing.ts` sizes it, `box-paint.ts` paints it,
 * `label-layout.ts` sets its label and `placement.ts` places its parts. `component-spec.ts`
 * assembles a set from the root of each cell.
 */

import {
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
  growingRoom,
  hugsUncapped,
  lessMargins,
  outOfFlow,
  partShare,
  readGrowth,
  readSizing,
  roomInside,
  rootRoom,
  selfStretchedRoom,
  UNREAD_SHARE,
  unstretched,
} from "./box-sizing";
import type { Holder, Room, RowShare } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import type { BoxCascade, Feed, LayerStyle, SpecField } from "./cascade";
import type {
  BoxDefinition,
  BuildContext,
  Cell,
  IconSlot,
  InstanceDefinition,
  LabelDefinition,
  PartDefinition,
} from "./component-spec";
import {
  describeNumber,
  evaluateLength,
  evaluateNumber,
  isInfiniteLength,
  normalizeCss,
  readColor,
  readNumber,
} from "./css-values";
import type { Viewport } from "./css-values";
import { EMPTY_PART, leavesNoTrace, NO_TRACE, vanishes } from "./empty-part";
import { fixedPlace, placeCentredFixed, refuseFixedPlace } from "./fixed-placement";
import { joinFlushLayers } from "./flush-layers";
import { readBleed, sectioned } from "./full-bleed";
import { holdsWidthRow, namedMinimum, rowMinimum, rowRoom, rowsAcross } from "./hugging-rows";
import type { CascadedInstance, InstanceParts } from "./instance-parts";
import { castsSpread, fixedLength, iconKey, outOfLayout, ringFill, ZERO } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
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
  labelCharacters,
  labelElementHolder,
  mapLabel,
  readLineClamp,
  readWithoutLabel,
  spaceBeforeLabel,
} from "./label-layout";
import type { LabelScope } from "./label-layout";
import { adjoinsMargin, foldNegativeMargin, wrapFrameMargins, wrapInstanceMargins } from "./margin-box";
import type { FoldingBox } from "./margin-box";
import {
  dropIdleOrigin,
  endsBesideLabel,
  endsInFlow,
  huggedWidth,
  padToOffset,
  placeParts,
  readRotation,
  slotAroundDot,
} from "./placement";
import type { Layout } from "./placement";
import { stacksFirstOnTop } from "./stacking";
import type { PaintedInstances } from "./stacking";
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

/** Why a grid in one column drops its `column-gap`. */
const ONE_COLUMN_GAP = "the grid lays its items in one column, which has no column gap";

/**
 * Read `display` once the box's layers are known. A flex box is an auto layout along its direction.
 * A grid with no template stacks each layer in a row of its own, so a grid with
 * `place-content: center` is an auto layout centered on both axes only around one layer. Any other
 * grid stays unmapped. A block box with no layers lays nothing out, so it is a frame like any
 * other. One that holds only its label sets the text in lines across its width, which the label's
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
  box: { readonly width: SizeSpec; readonly inside: Feed }
): boolean {
  const { width, inside } = box;
  // The display picks the layout: its direction, the alignments an unset property leaves, whether the
  // layers inside fill or hug, and the paint order of a box that stacks blocks.
  const lays = [
    ...reader.feed("direction"),
    ...reader.feed("primaryAlign"),
    ...reader.feed("counterAlign"),
    ...inside,
    ...(layout.blocks ? reader.feed("firstOnTop") : []),
  ];
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
  const ownText = label !== undefined && layers.length === 1 && layers[0] === label;
  // Blocks fill a box only across a width it has before they lay out.
  const stacked = layout.blocks && width.kind !== "hug";
  const flow =
    display === "list-item" && stacked
      ? literalLayout(
          ["list-item"],
          "a vertical auto layout, its block-level parts stacked down it as in a block box, since Tailwind preflight's `list-style: none` on the list leaves the item no marker"
        )
      : display === "inline-block" && ownText
        ? literalLayout(
            ["inline-block"],
            "an inline-block that holds only its own text, which it lays out inside as a block box does (CSS Display 3 §2.1), as an `<input>` holds its value"
          )
        : display === "block" && (layers.length === 0 || ownText || stacked)
          ? literalLayout(
              ["block"],
              stacked
                ? "a vertical auto layout, its block-level parts stacked down it, each as wide as the box"
                : ownText
                  ? "a block box that sets its own text in lines"
                  : "a frame with no layers to lay out"
            )
          : literalLayout(
              ["inline-flex", "flex"],
              layout.direction === "VERTICAL" ? "a vertical auto layout" : "a horizontal auto layout"
            );
  reader.read("display", flow.map, flow.describe, lays);
  return display === "block" && ownText;
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
};

/** A box's paddings across, which a part that fills it spans inside. */
const SIDE_PADDINGS = ["padding-left", "padding-right"] as const;

/** The TEXT and INSTANCE_SWAP values a mapping applies, by property name. */
export type PropertyValues = {
  readonly text: Readonly<Record<string, string>>;
  readonly swap: Readonly<Record<string, string>>;
  /** The classes the outer component gives the icon each INSTANCE_SWAP property places. */
  readonly swapClasses: Readonly<Record<string, string>>;
};

/** No property values, as a set's own cells take their labels and icons from the definition. */
export const NO_VALUES: PropertyValues = { text: {}, swap: {}, swapClasses: {} };

/** A label showing the characters a TEXT value gives its property, where one does. */
function labelWith(label: LabelDefinition, text: PropertyValues["text"]): LabelDefinition {
  const characters = label.textProperty === undefined ? undefined : text[label.textProperty];
  return characters === undefined || label.textProperty === undefined ? label : { ...label, characters };
}

/** An icon slot showing the icon an INSTANCE_SWAP value picks for its property, where one does. */
function slotWith(slot: IconSlot, swap: PropertyValues["swap"]): IconSlot {
  const icon = slot.swapProperty === undefined ? undefined : swap[slot.swapProperty];
  return icon === undefined ? slot : { ...slot, icon };
}

/** The classes the outer component gives the icon a slot's swap property places, if any. */
function givenClasses(slot: IconSlot, values: PropertyValues): string | undefined {
  return slot.swapProperty === undefined ? undefined : values.swapClasses[slot.swapProperty];
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

  const label = box.label?.shownIn(cell) === true ? labelWith(box.label, scope.values.text) : undefined;
  const inside = sizingInside(box, cell, cascade.path, label);
  const boxSizing = literalLayout(["border-box"], "strokes count in the auto layout");
  // Strokes inside the box's lengths leave its layers the room inside them.
  reader.read("box-sizing", boxSizing.map, boxSizing.describe, [
    ...reader.feed("stroke"),
    ...reader.feed("sizing"),
    ...inside,
  ]);

  const paint = readPaint(reader, box.image, context.variables, variant);
  dropIdleOrigin(reader);
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
  const onlyText =
    label !== undefined && slots.length === 0 && !(box.parts ?? []).some((child) => child.shownIn(cell));
  // The box's lengths and layout read before its parts map, since they decide what a part can fill.
  const fit = onlyText && drawsAlikeWide(reader, paint) ? "room" : "content";
  const { sizing, limits, clips, extent, known } = readSizing(reader, room, context.variables, fit, inside);

  const start: ChildLayerSpec[] = [];
  const end: ChildLayerSpec[] = [];
  // The style of the last icon on each side, where a row's last layer can set an auto margin.
  const lastIcon = new Map<IconSlot["side"], LayerStyle>();
  for (const slot of slots) {
    const style = cascade.icon(slot, givenClasses(slot, scope.values));
    const icon = mapIcon(slot, style, scope);
    if (icon !== undefined) {
      (slot.side === "start" ? start : end).push(icon);
      lastIcon.set(slot.side, style);
    }
  }
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
  }
  const empty: readonly ShownPart[] = leftOut.map(({ part }) => part);
  const inDom = orderModified(
    reader,
    cascaded.filter((part) => !empty.includes(part)),
    slots.length + (label === undefined ? 0 : 1)
  );
  // The parts the markup holds after the label draw after it and the end icons, and so does an
  // absolute part first in the DOM that may end a row beside its label in flow.
  const leading = label !== undefined && end.length === 0 ? leadingAbsolute(inDom) : undefined;
  const afterLabel = (part: ShownPart): boolean =>
    part === leading || (part.kind === "frame" ? part.child.after : part.visit.part.after) === "label";
  const before = inDom.filter((part) => !afterLabel(part));
  const trailing = inDom.filter((part) => afterLabel(part));
  const shown = [...before, ...trailing];
  // Every part and icon is an element child, absolute or hidden ones too, and so is the element a
  // label's characters sit in, beside the ones the definition draws no layer for.
  const undrawn = box.undrawnChildren?.(cell);
  const elementChildren =
    undrawn === undefined
      ? undefined
      : shown.length + empty.length + slots.length + (label?.textElement === undefined ? 0 : 1) + undrawn;
  const flowing = shown.filter((part) => !outOfFlow(part.cascade.style));
  const flowingBefore = before.filter((part) => !outOfFlow(part.cascade.style));
  const flowingAfter = trailing.filter((part) => !outOfFlow(part.cascade.style));
  const others = [...start, ...(label === undefined ? [] : [label]), ...end];
  // A part's place in `holder.layers`: the parts before the label, its icons and itself, then the rest.
  const layerIndex = (index: number): number =>
    index < flowingBefore.length ? index : index + others.length;
  const order = [
    ...flowingBefore.map(({ name }) => name),
    ...others.map(({ name }) => name),
    ...flowingAfter.map(({ name }) => name),
  ];
  // A part's own `align-self` can decide the box's alignment, so the layout reads once they cascade.
  const flow = readFlow(
    reader,
    {
      parts: flowing.map((part) => ({
        key: part.key,
        name: part.name,
        style: part.cascade.style,
        sizing: sizingOf(part.kind === "instance" ? part.visit.part : part.child, cascade.path),
      })),
      others,
      // The flow ends with the last part after the label, else the last end icon, else the label, else
      // the last start icon or part.
      last:
        flowingAfter.at(-1)?.cascade.style ??
        lastIcon.get("end") ??
        (label === undefined ? (lastIcon.get("start") ?? flowingBefore.at(-1)?.cascade.style) : undefined),
      labelBeforeLast: label !== undefined && order.length > 2 && order.at(-2) === label.name,
    },
    { sizing, limits, inside }
  );
  const { layout } = flow;
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
  const holder: Holder = {
    style: reader,
    layout,
    sizing,
    limits,
    extent,
    layers: order,
    widthCap: room.widthCap,
    unbounded: room.unbounded,
    widthKnown: known.horizontal,
    shares: [
      ...flowingBefore.map((part) => partShare(part.cascade.style)),
      ...start.map(iconShare),
      ...(label === undefined ? [] : [UNREAD_SHARE]),
      ...end.map(iconShare),
      ...flowingAfter.map((part) => partShare(part.cascade.style)),
    ],
  };
  const growing = readGrowth(
    holder,
    flowing.map((part) => part.cascade.style),
    box.underMaxHeight
  );
  // An absolute part that ends the row draws in flow there where the row's end padding keeps its room.
  const last = shown.at(-1);
  const inFlowEnd =
    last?.kind === "frame" &&
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
  readWraps(holder, growing, box.fitsOneLine);
  const flush = SIDE_PADDINGS.every((property) => evaluateLength(reader.resolved(property) ?? "0px") === 0);
  const { clipsAround: _parent, inFlexRow: _row, ...own } = scope;
  const clipped: MapScope = clips && flush ? { ...own, clipsAround: true } : own;
  const partScope: MapScope =
    layout.flex && layout.direction === "HORIZONTAL" ? { ...clipped, inFlexRow: true } : clipped;
  // A popup that hugs its rows hugs the one that sets its width and fills the others.
  const across = rowsAcross(
    { layout, width: sizing.horizontal, limits },
    flowing.map((part) => holdsWidthRow(part.kind === "instance" ? part.visit.part : part.child, cell))
  );
  const minimum =
    across === undefined ? undefined : rowMinimum(limits.minWidth, room, reader, context.variables);
  const mapped = shown.map((part): MappedPart => {
    const index = flowing.indexOf(part);
    const inFlow = (): Room => {
      const inside = roomInside(holder, layerIndex(index));
      const room = rowRoom(inside, across?.[index], minimum);
      return index === growing ? growingRoom(holder, layerIndex(index), room) : room;
    };
    const room =
      index === -1
        ? absoluteRoom(holder)
        : selfStretchedRoom(holder, part.cascade.style, lessMargins(inFlow(), part.cascade.style));
    const styles = flowing.map((each) => each.cascade.style);
    return mapPart(
      part,
      room,
      layout,
      partScope,
      layout.blocks && adjoinsMargin(styles, index),
      reader,
      // A fixed part sits out of the flow, so it is first where no part shows before it.
      shown.indexOf(part) === 0
    );
  });
  const parts = settledParts(reader, flow, mapped, scope);
  const missing = unstretched(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  if (missing !== undefined) {
    reader.missing(missing.property, missing.neededBy, missing.detail);
  }
  const clamp = readLineClamp(holder, label);
  const labelHolder = label === undefined ? holder : labelBox(holder, cascade, label, growing);
  const labelScope = (shown: LabelDefinition): LabelScope => {
    const own: LabelScope = {
      cell,
      variables: context.variables,
      color: textColor,
      clamp,
      variant,
      path: [...cascade.path, shown.key],
      fitsOneLine: box.fitsOneLine,
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
      huggedWidth(mapped[shown.indexOf(leading)]?.layer)
    )
      ? leading.cascade.style
      : undefined;
  const endInFlow = inFlowEnd ?? leadingEnd;
  const after: readonly ChildLayerSpec[] = [
    ...start,
    ...(placed === undefined ? [] : [placed.layer]),
    ...end,
  ];
  // The display reads once the layers are known, since a grid maps only around one item.
  const textBlock = readDisplay(reader, holder.layers, label?.name, layout, clamp, {
    width: across === undefined ? sizing.horizontal : FILL_ACROSS,
    inside,
  });
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
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
          flowing.map((part) => ({ style: part.cascade.style, instance: part.kind === "instance" })),
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
    endInFlow
  );
  // Placement gives an absolute instance a new layer, which paints what the layer it replaces does.
  placement.layers.forEach((layer, index) => {
    const before = parts[index]?.layer;
    const drawn = before?.kind === "instance" && layer !== before ? scope.painted.resolve(before) : undefined;
    if (layer.kind === "instance" && drawn?.kind === "frame") {
      scope.painted.note(layer, drawn);
    }
  });
  // A grid in one column spaces its rows by `row-gap`, which `gap` sets too.
  const itemSpacing =
    space ??
    spaced ??
    (layout.oneColumnGrid === true ? number("row-gap", "itemSpacing") : undefined) ??
    number("gap", "itemSpacing") ??
    // A row spaces its layers by `column-gap` (CSS Box Alignment 3 §8.1), as `gap-x-4` does.
    (layout.flex && layout.direction === "HORIZONTAL" ? number("column-gap", "itemSpacing") : undefined) ??
    ZERO;
  const counterAlign =
    placed?.counterAlign ?? (textBlock ? blockLineAlign(layout, sizing, limits) : layout.counterAlign);
  // The parts before the label sit first, sectioned where separators cancel the box's padding, and
  // the parts after the label last.
  const first = placement.layers.slice(0, before.length);
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
    ...placement.layers.slice(before.length),
  ];
  const children = joinFlushLayers(
    reader,
    layout,
    flowing.map((part) => ({ key: part.key, style: part.cascade.style })),
    laid,
    counterAlign
  );
  reader.read(
    "aspect-ratio",
    (value) => (width !== undefined && height !== undefined ? value : undefined),
    () => ({ outcome: "dropped", detail: "both sides are fixed, so the ratio sizes neither" }),
    []
  );
  const unspaced = spacesNothingOut(layout, placement.primaryAlign, children);
  if (layout.spaceBetweenUnread === true) {
    readSpaceBetween(reader, unspaced);
  }
  const mappedBox: BoxSpec = {
    direction: layout.direction,
    sizing,
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
      (packsAtStart ||
      leavesRoomAtEnd(layout, sizing, placement.primaryAlign, children) ||
      unspaced !== undefined
        ? "MIN"
        : placement.primaryAlign),
    counterAlign,
    cornerRadius: readCorner(reader, sizing, context) ?? ZERO,
    ...paint,
    opacity: opacity ?? 1,
    children,
  };
  const stacks = mapped.map(({ stacked, style, paints }) => ({
    layer: scope.painted.resolveBox(stacked),
    style,
    paints,
  }));
  return layout.blocks && stacksFirstOnTop(reader, stacks) ? { ...mappedBox, firstOnTop: true } : mappedBox;
}

/**
 * Whether a flex row with no `justify-content` has room beside its layers, so CSS packs them at its
 * start (CSS Box Alignment 3 §5.3: `normal` acts as `flex-start` in a flex container), where the
 * unset alignment {@link readFlow} gives a row centers them. Such a row is a fixed length or fills
 * its parent, no layer in its flow fills the row, and one hugs its content, as Select's item text
 * hugs its label. A row that hugs its layers or holds one that fills it draws alike at either
 * alignment, and so may a row of fixed layers, as a Radio's 16px indicator fills its 16px circle, so
 * those keep their own.
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
    flowing.some((child) => child.kind !== "icon" && child.sizing.horizontal.kind === "hug")
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
  return first?.kind === "frame" && parts.length === 1 && outOfFlow(first.cascade.style) ? first : undefined;
}

/**
 * Cascade the parts a box shows in the cell, each below the box: a frame part's own classes, style
 * attribute and element defaults, and an instance part's inner root, as {@link InstanceParts.cascade}
 * builds it in place.
 *
 * @param box - The box's definition.
 * @param cascade - The box's cascade.
 * @param scope - The cell and the instance parts that build in place.
 * @returns The parts, in DOM order.
 */
function cascadeParts(box: BoxDefinition, cascade: BoxCascade, scope: MapScope): readonly ShownPart[] {
  const { cell } = scope;
  return (box.parts ?? [])
    .filter((child) => child.shownIn(cell))
    .map((child): ShownPart => {
      if ("kind" in child) {
        return scope.instances.cascade(child, cascade, cell);
      }
      const name = partName(child);
      if (child.facts !== undefined && (child.parts?.length ?? 0) > 0) {
        throw new KitUnmappable({ message: `the part ${name} holds parts, which carry none of its facts` });
      }
      return {
        kind: "frame",
        child,
        key: child.key,
        name,
        cascade: cascade.part(
          child.classesFor(cell),
          name,
          {
            key: child.key,
            slot: child.slot,
            tag: child.slot === undefined ? child.element?.tag : child.tag,
          },
          {
            inline: child.styleFor?.(cell) ?? [],
            defaults: child.elementDefaults ?? [],
          },
          child.facts
        ),
      };
    });
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
 * @returns The part as mapped.
 */
/** No preview width or height, which a fixed root in a viewport does not read. */
const NO_PREVIEW = { width: undefined, height: undefined } as const;

function mapPart(
  part: ShownPart,
  room: Room,
  layout: Layout,
  scope: MapScope,
  collapses: boolean,
  parent: LayerStyle,
  first: boolean
): MappedPart {
  // The row that sets a popup's width keeps the popup's minimum, which no class of its own sets.
  const minimum = namedMinimum(part.kind === "instance" ? part.visit.part : part.child, scope.cell, room);
  if (part.kind === "instance") {
    const fixed = fixedPlace(
      { own: part.visit.part.of.viewport, composite: scope.viewport, style: part.cascade.style },
      layout,
      parent,
      first
    );
    const { layer: built, painted } = scope.instances.map(
      part,
      fixed?._tag === "placed"
        ? rootRoom(NO_PREVIEW, part.cascade.style, scope.context.variables, fixed.viewport)
        : room
    );
    if (fixed?._tag === "placed") {
      placeCentredFixed(part.cascade.style, fixed.at);
    } else if (fixed?._tag === "refused") {
      refuseFixedPlace(part.cascade.style);
    }
    const drawn = minimum === undefined ? built : { ...built, minWidth: minimum };
    const { layer, instance } = wrapInstanceMargins(
      part.cascade.style,
      drawn,
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
    };
    return instance === layer ? mapped : { ...mapped, wrapped: instance };
  }
  const frame = mapBox(part.child, part.cascade, scope, room);
  const own = minimum === undefined ? frame : { ...frame, limits: { ...frame.limits, minWidth: minimum } };
  // Figma draws a part's spread ring only over a visible fill with clipping on (PR2).
  const box = castsSpread(own.shadows) ? { ...own, fill: ringFill(own), clips: true } : own;
  const drawn: FrameLayerSpec = {
    kind: "frame",
    key: part.child.key,
    name: part.name,
    ...(scope.scaling.has(part.child) ? slotAroundDot(part.cascade.style, box) : box),
  };
  const { optional } = part.child;
  const linked = optional === undefined ? drawn : { ...drawn, visibleProperty: optional.name };
  const rotation = readRotation(part.cascade.style);
  const turned = rotation === undefined ? linked : { ...linked, rotation };
  const layer = wrapFrameMargins(
    part.cascade.style,
    turned,
    layout,
    scope.context.variables,
    collapses,
    scope.clipsAround === true
  );
  return { layer, stacked: layer, style: part.cascade.style, paints: own.fill !== undefined };
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
): readonly Pick<MappedPart, "layer" | "style">[] {
  const { painted } = scope;
  const stretched = settleFlow(
    reader,
    flow,
    mapped.filter(({ style }) => !outOfFlow(style)).map(({ layer }) => layer),
    scope.context.variables
  );
  return mapped.map(({ layer, style, stacked, wrapped }) => {
    const placed = stretchedLayer(layer, stretched);
    if (placed.kind === "instance") {
      painted.note(placed, stacked);
    }
    if (wrapped !== undefined) {
      painted.note(wrapped, { ...stacked, key: wrapped.key, name: wrapped.name });
    }
    return { style, layer: placed };
  });
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
 * @param label - The label the box shows in the cell.
 * @param growing - The index of the box's layer that grows, or undefined for none.
 * @returns The holder whose style and layout the label maps from.
 */
function labelBox(
  holder: Holder,
  cascade: BoxCascade,
  label: LabelDefinition,
  growing: number | undefined
): Holder {
  const tag = label.textElement?.tag;
  const element =
    tag === undefined
      ? undefined
      : cascade.labelElement({ tag, last: holder.layers.at(-1) === label.name, key: label.key });
  return element === undefined ? holder : (labelElementHolder(holder, element, label, growing) ?? holder);
}

/**
 * Read `border-radius` as the corner. An infinite radius, which `rounded-full` compiles to, reads
 * as half a side. CSS scales down radii whose sum exceeds a side, so it draws any radius above half
 * the shorter side as that half. With both sides fixed, the build writes that half. With one side
 * fixed, it writes half that side: on 2026-10-22 a real file drew a radius above half the shorter
 * side as that half and kept the written value (probe P10), so Figma draws it as CSS does whichever
 * side ends up shorter. A box with no fixed side has no length to halve, so its pill corner stays
 * unmapped.
 *
 * @param sizing - The box's sizing.
 * @returns The corner, or undefined when the box sets none or it does not map.
 */
function readCorner(reader: LayerStyle, sizing: SizingSpec, context: BuildContext): NumberSpec | undefined {
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const corner = reader.read(
    "border-radius",
    (value): { readonly radius: NumberSpec; readonly detail: string | undefined } | undefined => {
      const radius = readNumber(value, context.variables);
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

/** The share of a row an icon takes: its literal size, or `unread` for a bound one. */
function iconShare(icon: ChildLayerSpec): RowShare {
  return icon.kind === "icon" && icon.size.kind === "literal"
    ? { kind: "pixels", value: icon.size.value }
    : UNREAD_SHARE;
}

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
    icon: iconKey(slot.icon),
    swapProperty: slot.swapProperty,
    size: width,
    color,
  };
  const linked = slot.optional === undefined ? layer : { ...layer, visibleProperty: slot.optional.name };
  const rotation = readRotation(style);
  return rotation === undefined ? linked : { ...linked, rotation };
}
