/**
 * Map a box, the root or a part, and the parts and icons below it onto Figma fields, from the
 * cascade of each: its display, corner and icons, assembled from what the other modules read.
 * `box-flow.ts` lays out its flow, `box-sizing.ts` sizes it, `box-paint.ts` paints it,
 * `label-layout.ts` sets its label and `placement.ts` places its parts. `component-spec.ts`
 * assembles a set from the root of each cell.
 */
import { readFlow, settleFlow, stretchedLayer } from "./box-flow";
import type { Flow } from "./box-flow";
import { describeColor, readPaint } from "./box-paint";
import type { BoxPaint } from "./box-paint";
import {
  absoluteRoom,
  growingRoom,
  lessMargins,
  outOfFlow,
  partShare,
  readGrowth,
  readSizing,
  roomInside,
  UNREAD_SHARE,
  unstretched,
} from "./box-sizing";
import type { Holder, Room, RowShare } from "./box-sizing";
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
  evaluateNumber,
  isInfiniteLength,
  normalizeCss,
  readColor,
  readNumber,
} from "./css-values";
import type { CascadedInstance, InstanceParts } from "./instance-parts";
import { castsSpread, fixedLength, iconKey, ringFill, ZERO } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  CounterAlignSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  LimitsSpec,
  NumberSpec,
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
import { dropZeroMargins, placeParts, readRotation, slotAroundDot, wrapMargins } from "./placement";
import type { Layout } from "./placement";
import { stacksFirstOnTop } from "./stacking";
import type { PaintedInstances } from "./stacking";

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
    display === "block" && (layers.length === 0 || ownText || stacked)
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
    ["", "normal"].includes(value("white-space")) &&
    value("text-wrap") !== "nowrap" &&
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
};

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

/** An icon slot showing the icon an INSTANCE_SWAP value picks for its property, where one does. */
function slotWith(slot: IconSlot, swap: PropertyValues["swap"]): IconSlot {
  const icon = slot.swapProperty === undefined ? undefined : swap[slot.swapProperty];
  return icon === undefined ? slot : { ...slot, icon };
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
  const { sizing, limits, clips, extent } = readSizing(reader, room, context.variables, fit, inside);

  const start: ChildLayerSpec[] = [];
  const end: ChildLayerSpec[] = [];
  for (const slot of slots) {
    const icon = mapIcon(slot, cascade.icon(slot), scope);
    if (icon !== undefined) {
      (slot.side === "start" ? start : end).push(icon);
    }
  }
  // Every part cascades before any maps, since an absolute part sits out of the box's flow. The box's
  // flow, `holder.layers`, is the one membership every layout reader below reads: the rooms, the
  // stretch, the label, the display and the placement.
  const shown = cascadeParts(box, cascade, scope);
  const flowing = shown.filter((part) => !outOfFlow(part.cascade.style));
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
      others: [...start, ...(label === undefined ? [] : [label]), ...end],
    },
    { sizing, limits, inside }
  );
  const { layout } = flow;
  const holder: Holder = {
    style: reader,
    layout,
    sizing,
    limits,
    extent,
    layers: [
      ...flowing.map(({ name }) => name),
      ...start.map(({ name }) => name),
      ...(label === undefined ? [] : [label.name]),
      ...end.map(({ name }) => name),
    ],
    widthCap: room.widthCap,
    shares: [
      ...flowing.map((part) => partShare(part.cascade.style)),
      ...start.map(iconShare),
      ...(label === undefined ? [] : [UNREAD_SHARE]),
      ...end.map(iconShare),
    ],
  };
  const growing = readGrowth(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  if (growing !== undefined && layout.direction === "HORIZONTAL") {
    reader.read(
      "flex-wrap",
      (value) => (normalizeCss(value) === "wrap" ? value : undefined),
      () => ({
        outcome: "dropped",
        detail:
          "the one layer that grows takes what the row's other layers leave, so the row breaks no line until they overflow it, and a Figma row never wraps",
      }),
      []
    );
  }
  const mapped = shown.map((part): MappedPart => {
    const index = flowing.indexOf(part);
    const inFlow = (): Room => {
      const inside = roomInside(holder, index);
      return index === growing ? growingRoom(holder, index, inside) : inside;
    };
    const room = index === -1 ? absoluteRoom(holder) : lessMargins(inFlow(), part.cascade.style);
    return mapPart(part, room, layout, scope);
  });
  const parts = settledParts(reader, flow, mapped, scope.painted);
  const missing = unstretched(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  if (missing !== undefined) {
    reader.missing(missing.property, missing.neededBy, missing.detail);
  }
  const clamp = readLineClamp(holder, label);
  const labelHolder = label === undefined ? holder : labelBox(holder, cascade, label, growing);
  const placed =
    label === undefined
      ? undefined
      : mapLabel(labelHolder, label, {
          cell,
          variables: context.variables,
          color: textColor,
          clamp,
          variant,
          path: [...cascade.path, label.key],
        });
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
  const after: readonly ChildLayerSpec[] = [
    ...start,
    ...(placed === undefined ? [] : [placed.layer]),
    ...end,
  ];
  // The display reads once the layers are known, since a grid maps only around one item.
  const textBlock = readDisplay(reader, holder.layers, label?.name, layout, clamp, {
    width: sizing.horizontal,
    inside,
  });
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const paddingLeft = number("padding-left", "paddingLeft") ?? ZERO;
  const paddingRight = number("padding-right", "paddingRight") ?? ZERO;
  const placement = placeParts(
    {
      style: reader,
      layout,
      layers: holder.layers.length,
      size: { width, stroke: paint.stroke, paddingLeft, paddingRight },
    },
    parts
  );
  const children: readonly ChildLayerSpec[] = [...placement.layers, ...after];
  reader.read(
    "aspect-ratio",
    (value) => (width !== undefined && height !== undefined ? value : undefined),
    () => ({ outcome: "dropped", detail: "both sides are fixed, so the ratio sizes neither" }),
    []
  );
  const mappedBox: BoxSpec = {
    direction: layout.direction,
    sizing,
    limits,
    clips,
    paddingTop: number("padding-top", "paddingTop") ?? ZERO,
    paddingRight,
    paddingBottom: number("padding-bottom", "paddingBottom") ?? ZERO,
    paddingLeft,
    itemSpacing: space ?? number("gap", "itemSpacing") ?? ZERO,
    // A native control's placement of its label wins over the box's own alignment.
    primaryAlign: placed?.primaryAlign ?? (packsAtStart ? "MIN" : placement.primaryAlign),
    counterAlign:
      placed?.counterAlign ?? (textBlock ? blockLineAlign(layout, sizing, limits) : layout.counterAlign),
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
      return {
        kind: "frame",
        child,
        key: child.key,
        name,
        cascade: cascade.part(
          child.classesFor(cell),
          name,
          { key: child.key, slot: child.slot, tag: child.element?.tag },
          {
            inline: child.styleFor?.(cell) ?? [],
            defaults: child.elementDefaults ?? [],
          }
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
 * @returns The part as mapped.
 */
function mapPart(part: ShownPart, room: Room, layout: Layout, scope: MapScope): MappedPart {
  if (part.kind === "instance") {
    // An instance has no margin box of its own, so only a zero margin maps.
    dropZeroMargins(part.cascade.style);
    const { layer, painted } = scope.instances.map(part, room);
    // The stacking reads what the instance draws, its inner root as built in place.
    return { layer, stacked: painted, style: part.cascade.style, paints: painted.fill !== undefined };
  }
  const own = mapBox(part.child, part.cascade, scope, room);
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
  const layer = wrapMargins(part.cascade.style, turned, layout, scope.context.variables);
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
 * @param painted - What each instance layer of the mapping paints.
 * @returns Each part's style and layer.
 */
function settledParts(
  reader: LayerStyle,
  flow: Flow,
  mapped: readonly MappedPart[],
  painted: PaintedInstances
): readonly Pick<MappedPart, "layer" | "style">[] {
  const stretched = settleFlow(
    reader,
    flow,
    mapped.filter(({ style }) => !outOfFlow(style)).map(({ layer }) => layer)
  );
  return mapped.map(({ layer, style, stacked }) => {
    const placed = stretchedLayer(layer, stretched);
    if (placed.kind === "instance") {
      painted.note(placed, stacked);
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
    throw new Error(`${variant}: the ${slot.name} needs a square size and a text color`);
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
  const rotation = readRotation(style);
  return rotation === undefined ? layer : { ...layer, rotation };
}
