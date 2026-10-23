/**
 * Map a box, the root or a part, and the parts and icons below it onto Figma fields, from the
 * cascade of each: its layout, display, corner and icons. `box-sizing.ts` sizes the box,
 * `box-paint.ts` paints it, `label-layout.ts` sets its label and `placement.ts` places its parts.
 * `component-spec.ts` assembles a set from the root of each cell.
 */
import { describeColor, readPaint } from "./box-paint";
import type { BoxPaint } from "./box-paint";
import {
  absoluteRoom,
  growingRoom,
  heightBounds,
  lessMargins,
  listNames,
  outOfFlow,
  partShare,
  readGrowth,
  readSizing,
  roomInside,
  UNREAD_SHARE,
  unstretched,
} from "./box-sizing";
import type { Holder, Room, RowShare } from "./box-sizing";
import type { BoxCascade, LayerStyle } from "./cascade";
import type {
  BoxDefinition,
  BuildContext,
  Cell,
  IconSlot,
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
import { castsSpread, coveredShadow, fixedLength, iconKey, ringFill, walkLayers, ZERO } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  ColorSpec,
  CounterAlignSpec,
  DirectionSpec,
  FrameLayerSpec,
  IconLayerSpec,
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
import { placeParts, readRotation, slotAroundDot, wrapMargins } from "./placement";
import type { Layout } from "./placement";

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

/** Where `align-items` places a box's children across its direction, by the value Tailwind compiles. */
const ALIGNMENTS = new Map<string, { readonly align: CounterAlignSpec; readonly where: string }>([
  ["flex-start", { align: "MIN", where: "at the start of" }],
  ["center", { align: "CENTER", where: "centered on" }],
  ["flex-end", { align: "MAX", where: "at the end of" }],
]);

/**
 * Where `justify-content` places a box's children along its direction. `space-between` puts the
 * first and last child flush with the ends and the spare room between the children.
 */
const PRIMARY_ALIGNMENTS = new Map<string, { readonly align: PrimaryAlignSpec; readonly where: string }>([
  ...ALIGNMENTS,
  ["space-between", { align: "SPACE_BETWEEN", where: "spaced out between the ends of" }],
]);

/**
 * Where `justify-content` places the children of a box that hugs them along its direction with no
 * minimum there. Such a box has no free space, so `space-between` packs them at its start with the
 * gap between them (CSS Box Alignment 3 §5.3, §8). Figma's SPACE_BETWEEN would drop the gap: a real
 * file drew no gap under it beside a filling text on 2026-10-23 (PV), and the owner's Select triggers
 * drew the caret against the value.
 */
const HUGGED_ALIGNMENTS = new Map<string, { readonly align: PrimaryAlignSpec; readonly where: string }>([
  ...PRIMARY_ALIGNMENTS,
  ["space-between", { align: "MIN", where: "with no room to space them out, so packed at the start of" }],
]);

function readAlign<Align extends PrimaryAlignSpec>(
  reader: LayerStyle,
  property: string,
  axis: string,
  alignments: ReadonlyMap<string, { readonly align: Align; readonly where: string }>
): Align | undefined {
  return reader.read(
    property,
    (value) => alignments.get(normalizeCss(value)),
    ({ where }) => ({ outcome: "literal", detail: `${where} the ${axis} axis` })
  )?.align;
}

/** The direction `flex-direction` gives a flex box, by the value Tailwind compiles. */
const DIRECTIONS = new Map<string, { readonly direction: DirectionSpec; readonly detail: string }>([
  ["row", { direction: "HORIZONTAL", detail: "a row, its layers left to right" }],
  ["column", { direction: "VERTICAL", detail: "a column, its layers top to bottom" }],
]);

/**
 * Read the direction and alignments a box lays out its layers by, before its layers map, since
 * they decide how much room each layer has. A flex box is an auto layout along its
 * `flex-direction`, a row unless a column is set, that places its layers by `align-items` and
 * `justify-content`. In a row an unset alignment stays centered, as every published row was drawn.
 * CSS packs a row's layers at the start and stretches them, which shows only where a row has room
 * to spare or layers of unequal height. A column takes CSS's start on both axes, and its unset
 * `align-items` stretches its layers across it, which {@link roomInside} gives them. A grid places
 * its layers by `place-content`, which {@link readDisplay} reads, so its alignments stay unread.
 * `line-clamp-*` makes a `-webkit-box` column, which sets its text from the top left. A row whose
 * parts set their own `align-self` aligns as {@link readSelfAlignment} says. A block box that
 * {@link stacksBlocks} is a column from the top left, where alignments do not apply.
 *
 * @param flow - The parts in the box's flow, and the names of its icons and label, which set no
 *   alignment of their own.
 * @param box - The box's sizing and limits, which say whether it hugs its layers along its
 *   direction with no minimum, so `justify-content` has no free space to distribute.
 * @returns The box's layout, and the alignment its parts set, which {@link settleSelfAlignment}
 *   settles once the parts map.
 */
function readFlow(
  reader: LayerStyle,
  flow: FlowLayers,
  box: { readonly sizing: SizingSpec; readonly limits: LimitsSpec }
): Flow {
  const display = normalizeCss(reader.raw("display") ?? "");
  const blocks = stacksBlocks(reader, flow);
  if (display === "grid" || display === "-webkit-box" || blocks) {
    const column = display !== "grid";
    return {
      layout: {
        flex: false,
        blocks,
        direction: column ? "VERTICAL" : "HORIZONTAL",
        primaryAlign: column ? "MIN" : "CENTER",
        counterAlign: column ? "MIN" : "CENTER",
        justify: "unset",
      },
      self: undefined,
    };
  }
  const flex = display === "flex" || display === "inline-flex";
  const direction = flex
    ? (reader.read(
        "flex-direction",
        (value) => DIRECTIONS.get(normalizeCss(value)),
        ({ detail }) => ({ outcome: "literal", detail })
      )?.direction ?? "HORIZONTAL")
    : "HORIZONTAL";
  const unset = direction === "VERTICAL" ? "MIN" : "CENTER";
  const self = flex && direction === "HORIZONTAL" ? readSelfAlignment(reader, flow) : undefined;
  const counterAlign = self?.align ?? readAlign(reader, "align-items", "counter", ALIGNMENTS) ?? unset;
  const column = direction === "VERTICAL";
  const hugged =
    flex &&
    (column ? box.sizing.vertical : box.sizing.horizontal).kind === "hug" &&
    (column ? box.limits.minHeight : box.limits.minWidth) === undefined;
  const primaryAlign =
    readAlign(reader, "justify-content", "primary", hugged ? HUGGED_ALIGNMENTS : PRIMARY_ALIGNMENTS) ?? unset;
  return {
    layout: {
      flex,
      blocks: false,
      direction,
      primaryAlign,
      counterAlign,
      justify: reader.has("justify-content") ? primaryAlign : "unset",
    },
    self,
  };
}

/** The displays that make a box block-level, which a block box stacks down its content box. */
const BLOCK_LEVEL: ReadonlySet<string> = new Set(["block", "flex", "grid"]);

/** The gaps, which separate the items of flex, grid and multi-column boxes and no blocks. */
const GAPS = ["gap", "row-gap", "column-gap"] as const;

/**
 * Whether a block box stacks its layers as blocks: every layer in its flow is a part whose display
 * is block-level, and the box sets no gap, which separates no blocks (CSS Box Alignment 3 §8). A part
 * whose display nothing sets may be inline, so it leaves the box as it was.
 */
function stacksBlocks(reader: LayerStyle, flow: FlowLayers): boolean {
  return (
    normalizeCss(reader.raw("display") ?? "") === "block" &&
    flow.parts.length > 0 &&
    flow.others.length === 0 &&
    flow.parts.every(({ style }) => BLOCK_LEVEL.has(normalizeCss(style.raw("display") ?? ""))) &&
    GAPS.every((property) => !reader.has(property))
  );
}

/** An axis that fills the room its parent gives it, as a stretched part fills its row's height. */
const FILL_SIZE: SizeSpec = { kind: "fill" };

/** The layers in a box's flow: its parts, each with its style, and its icons and label by name. */
type FlowLayers = {
  readonly parts: readonly { readonly name: string; readonly style: LayerStyle }[];
  readonly others: readonly string[];
};

/** How a box lays out its layers, and the alignment its parts set, where they set one. */
type Flow = {
  readonly layout: Layout;
  readonly self: SelfAlignment | undefined;
};

/**
 * A row's alignment that its parts set through `align-self`, beside the row's own `align-items`,
 * which the row draws once its parts map.
 */
type SelfAlignment = {
  /** The alignment the parts that set one ask for, which the row takes. */
  readonly align: CounterAlignSpec;
  /** The row's own `align-items`, where the layers that set none take it. */
  readonly own: { readonly align: CounterAlignSpec; readonly where: string } | undefined;
  /** The names of the parts that set an alignment. */
  readonly setters: readonly string[];
  /** The names of the layers that set none, the icons and the label among them. */
  readonly loose: readonly string[];
  /** The names of the loose parts that draw the same stretched, as {@link stretchesAlike} says. */
  readonly stretchable: ReadonlySet<string>;
};

/**
 * Whether a part a row places by its `align-items` draws the same stretched across the row's height:
 * a flex row that sets no height or margin of its own, paints nothing, pads the same above and below,
 * and places its own layers across the way the row places it, as Item's `flex items-center` actions
 * do. Stretched, it centers what it holds where the row would center it.
 */
function stretchesAlike(style: LayerStyle, own: CounterAlignSpec): boolean {
  const display = normalizeCss(style.raw("display") ?? "");
  const direction = normalizeCss(style.resolved("flex-direction") ?? "row");
  const placed = ALIGNMENTS.get(normalizeCss(style.resolved("align-items") ?? ""))?.align;
  const unset = (properties: readonly string[]) => properties.every((property) => !style.has(property));
  return (
    (display === "flex" || display === "inline-flex") &&
    direction === "row" &&
    placed === own &&
    unset([
      "height",
      "min-height",
      "max-height",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
    ]) &&
    unset(["background-color", "border-width", "box-shadow", "outline-width"]) &&
    style.resolved("padding-top") === style.resolved("padding-bottom")
  );
}

/**
 * Read the counter alignment of a row whose parts set their own `align-self`, which places a part
 * across the row in place of the row's `align-items` (CSS Box Alignment 3 §6.1), as Item's
 * `item-described:self-start` tops the media and the content beside a description. A Figma auto
 * layout aligns all its layers one way, so the row takes the alignment its parts ask for, where they
 * all ask for one, and each part's `align-self` reads as literal. What becomes of the row's own
 * `align-items` waits for the parts to map, as {@link settleSelfAlignment} says. Two alignments, one
 * Figma has no form for, or a row that leaves a layer to an unset `align-items` leave `align-self`
 * unread, so unmapped.
 *
 * @returns The alignment, or undefined where no part sets one, where it is the row's own, or where the
 *   row cannot draw it, which leaves the row's own `align-items` to decide.
 */
function readSelfAlignment(reader: LayerStyle, { parts, others }: FlowLayers): SelfAlignment | undefined {
  const selfOf = (style: LayerStyle) => normalizeCss(style.resolved("align-self") ?? "auto");
  const setters = parts.filter((part) => selfOf(part.style) !== "auto");
  const values = new Set(setters.map((part) => selfOf(part.style)));
  const [value] = values;
  const self = values.size === 1 && value !== undefined ? ALIGNMENTS.get(value) : undefined;
  const looseParts = parts.filter((part) => !setters.includes(part));
  const loose = [...looseParts.map((part) => part.name), ...others];
  const own = ALIGNMENTS.get(normalizeCss(reader.resolved("align-items") ?? ""));
  if (self === undefined || (loose.length > 0 && own === undefined)) {
    return undefined;
  }
  for (const part of setters) {
    part.style.read(
      "align-self",
      (read) => read,
      () => ({
        outcome: "literal",
        detail: `${self.where} the counter axis, where the row places its layers`,
      })
    );
  }
  if (own?.align === self.align) {
    return undefined;
  }
  return {
    align: self.align,
    own,
    setters: setters.map((part) => part.name),
    loose,
    stretchable: new Set(
      own === undefined
        ? []
        : looseParts.filter((part) => stretchesAlike(part.style, own.align)).map((part) => part.name)
    ),
  };
}

/**
 * Settle a row that takes the alignment its parts set. A layer that sets none stretches across the
 * row's height, where a fill across a hugging row stretches to the height its other layers set (PF),
 * and so centers what it holds where CSS centers it, as Item's actions do. That draws what CSS draws
 * only where the layer {@link stretchesAlike} and is no taller than the row: its tallest height, as
 * {@link heightBounds} reads it, is no taller than the shortest height of a layer that sets an
 * alignment, as Item's actions, one 20px line, beside a content column of at least two lines. The
 * row's `align-items` then reads as literal through those layers. Where a layer that sets none
 * cannot stretch so, the row cannot place it as CSS does, so `align-items` stays unmapped, naming it.
 *
 * @param self - The alignment the row's parts set.
 * @param layers - The layers of the row's parts in its flow, as mapped.
 * @returns The names of the layers that stretch, none where `align-items` stays unmapped.
 */
function settleSelfAlignment(
  reader: LayerStyle,
  self: SelfAlignment,
  layers: readonly FrameLayerSpec[]
): ReadonlySet<string> {
  const { own, setters, loose, stretchable } = self;
  if (loose.length === 0 || own === undefined) {
    reader.read(
      "align-items",
      (read) => read,
      () => ({ outcome: "dropped", detail: "every layer of the row sets its own `align-self`" })
    );
    return new Set();
  }
  const floor = Math.max(
    ...layers.filter((layer) => setters.includes(layer.name)).map((layer) => heightBounds(layer).min)
  );
  const fits = (name: string) => {
    const tallest = heightBounds(layers.find((layer) => layer.name === name)).max;
    return tallest !== undefined && tallest <= floor;
  };
  const stretch = loose.every((name) => stretchable.has(name) && fits(name));
  if (!stretch) {
    reader.mark(
      "align-items",
      "unmapped",
      `Figma aligns a row's layers one way, so ${listNames(loose)} can sit ${own.where} the counter axis only by stretching across it, which draws what CSS draws only for a layer that paints nothing, places its own layers so and is no taller than the layers that set \`align-self\``
    );
    return new Set();
  }
  const [it, places, stretches] =
    loose.length === 1 ? ["it", "places its", "stretches"] : ["them", "place their", "stretch"];
  reader.read(
    "align-items",
    (read) => read,
    () => ({
      outcome: "literal",
      detail: `${listNames(loose)} ${stretches} across the counter axis and ${places} layers ${own.where} it, where CSS places ${it} ${own.where} the counter axis`,
    })
  );
  return new Set(loose);
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
 * @param width - The box's width, as its sizing reads it.
 * @returns Whether the box is a block that sets its own text in lines.
 */
function readDisplay(
  reader: LayerStyle,
  layers: readonly string[],
  label: string | undefined,
  layout: Layout,
  clamp: number | undefined,
  width: SizeSpec
): boolean {
  const display = normalizeCss(reader.raw("display") ?? "");
  if (display === "-webkit-box") {
    for (const property of ["display", "-webkit-box-orient"]) {
      reader.read(
        property,
        (value) => (clamp === undefined ? undefined : value),
        () => ({ outcome: "literal", detail: "a column around its clamped label" })
      );
    }
    return false;
  }
  const inert = inertClamp(reader);
  if (inert !== undefined) {
    reader.mark("-webkit-box-orient", "dropped", inert);
  }
  if (display === "grid") {
    const center = literalLayout(["center"], "centered on both axes");
    const centered =
      layers.length === 1 && reader.read("place-content", center.map, center.describe) !== undefined;
    reader.read(
      "display",
      (value) => (centered ? value : undefined),
      () => ({ outcome: "literal", detail: "an auto layout around its one layer" })
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
  reader.read("display", flow.map, flow.describe);
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
};

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
  const number = (property: string): NumberSpec | undefined =>
    reader.read(property, (value) => readNumber(value, context.variables), describeNumber);
  const color = (property: string): ColorSpec | undefined =>
    reader.read(property, (value) => readColor(value, context.variables), describeColor);

  const boxSizing = literalLayout(["border-box"], "strokes count in the auto layout");
  reader.read("box-sizing", boxSizing.map, boxSizing.describe);

  const paint = readPaint(reader, box.image, context.variables, variant);
  const opacity = reader.read("opacity", evaluateNumber, (value) => ({
    outcome: "literal",
    detail: `opacity ${value}`,
  }));
  const textColor = color("color");
  const label = box.label?.shownIn(cell) === true ? box.label : undefined;
  const slots = box.iconsFor(cell);
  const onlyText =
    label !== undefined && slots.length === 0 && !(box.parts ?? []).some((child) => child.shownIn(cell));
  // The box's lengths and layout read before its parts map, since they decide what a part can fill.
  const fit = onlyText && drawsAlikeWide(reader, paint) ? "room" : "content";
  const { sizing, limits, clips, extent } = readSizing(reader, room, context.variables, fit);

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
  const shown = (box.parts ?? [])
    .filter((child) => child.shownIn(cell))
    .map((child) => {
      const name = partName(child);
      return {
        child,
        name,
        cascade: cascade.part(
          child.classesFor(cell),
          name,
          { slot: child.slot, tag: child.element?.tag },
          {
            inline: child.styleFor?.(cell) ?? [],
            defaults: child.elementDefaults ?? [],
          }
        ),
      };
    });
  const flowing = shown.filter((part) => !outOfFlow(part.cascade.style));
  // A part's own `align-self` can decide the box's alignment, so the layout reads once they cascade.
  const { layout, self } = readFlow(
    reader,
    {
      parts: flowing.map(({ name, cascade: part }) => ({ name, style: part.style })),
      others: [...start, ...(label === undefined ? [] : [label]), ...end].map(({ name }) => name),
    },
    { sizing, limits }
  );
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
      })
    );
  }
  const mapped = shown.map((part) => {
    const index = flowing.indexOf(part);
    const inFlow = (): Room => {
      const inside = roomInside(holder, index);
      return index === growing ? growingRoom(holder, index, inside) : inside;
    };
    const room = index === -1 ? absoluteRoom(holder) : lessMargins(inFlow(), part.cascade.style);
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
    const layer = wrapMargins(part.cascade.style, turned, layout, context.variables);
    return { layer, style: part.cascade.style, paints: own.fill !== undefined };
  });
  // The parts a row stretches across its height, which their own height decides once they map.
  const stretched =
    self === undefined
      ? new Set<string>()
      : settleSelfAlignment(
          reader,
          self,
          mapped.filter(({ style }) => !outOfFlow(style)).map(({ layer }) => layer)
        );
  const parts = mapped.map(({ layer, style }) => ({
    style,
    layer: stretched.has(layer.name) ? { ...layer, sizing: { ...layer.sizing, vertical: FILL_SIZE } } : layer,
  }));
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
  const textBlock = readDisplay(reader, holder.layers, label?.name, layout, clamp, sizing.horizontal);
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const paddingLeft = number("padding-left") ?? ZERO;
  const paddingRight = number("padding-right") ?? ZERO;
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
    () => ({ outcome: "dropped", detail: "both sides are fixed, so the ratio sizes neither" })
  );
  const mappedBox: BoxSpec = {
    direction: layout.direction,
    sizing,
    limits,
    clips,
    paddingTop: number("padding-top") ?? ZERO,
    paddingRight,
    paddingBottom: number("padding-bottom") ?? ZERO,
    paddingLeft,
    itemSpacing: space ?? number("gap") ?? ZERO,
    // A native control's placement of its label wins over the box's own alignment.
    primaryAlign: placed?.primaryAlign ?? (packsAtStart ? "MIN" : placement.primaryAlign),
    counterAlign:
      placed?.counterAlign ?? (textBlock ? blockLineAlign(layout, sizing, limits) : layout.counterAlign),
    cornerRadius: readCorner(reader, sizing, context) ?? ZERO,
    ...paint,
    opacity: opacity ?? 1,
    children,
  };
  return layout.blocks && stacksFirstOnTop(reader, mapped) ? { ...mappedBox, firstOnTop: true } : mappedBox;
}

/** A part a box stacks: its layer, its style and whether it paints a fill of its own. */
type StackedPart = {
  readonly layer: FrameLayerSpec;
  readonly style: LayerStyle;
  readonly paints: boolean;
};

/**
 * The properties that put a box in a layer of its own at any value but their initial one: a box
 * that is positioned or that makes a stacking context, which CSS paints after the inline-level boxes
 * of the stacking context around it (CSS 2.1 Appendix E). Each value lists the property's initial
 * values, as the build reads them.
 */
const OWN_LAYER: ReadonlyMap<string, readonly string[]> = new Map([
  ["position", ["static"]],
  ["opacity", ["1", "100%"]],
  ["transform", ["none"]],
  ["translate", ["none"]],
  ["rotate", ["none"]],
  ["scale", ["none"]],
  ["filter", ["none"]],
  ["backdrop-filter", ["none"]],
  ["isolation", ["auto"]],
  ["mix-blend-mode", ["normal"]],
  ["will-change", ["auto"]],
  ["contain", ["none"]],
  ["clip-path", ["none"]],
  ["mask-image", ["none"]],
  ["perspective", ["none"]],
]);

/** Whether a block paints its background with its block siblings': it sets no property of {@link OWN_LAYER}. */
function paintsInFlow(style: LayerStyle): boolean {
  return [...OWN_LAYER].every(([property, initial]) => {
    const value = style.resolved(property);
    return value === undefined || initial.includes(normalizeCss(value));
  });
}

/** Whether a flex block holds a layer that casts a shadow, which paints as a flex item does. */
function ringsAsItem({ layer, style }: StackedPart): boolean {
  return (
    normalizeCss(style.raw("display") ?? "") === "flex" &&
    walkLayers(layer).some((below) => below.kind === "frame" && below.shadows.length > 0)
  );
}

/**
 * Whether a box that stacks blocks paints its first layer on top. CSS paints each block's background
 * and shadows in tree order, then the inline-level boxes, then the positioned boxes and stacking
 * contexts (CSS 2.1 Appendix E), and a flex item paints as an inline block does (CSS Flexbox 1 §4.3).
 * So a ring that a flex block's layer casts paints over a later block's fill, as the Accordion
 * trigger's focus ring over the open panel, while a block's own ring paints below the later block,
 * and a later positioned block or stacking context paints above the ring, as Figma's own order does.
 * Figma paints a later layer above an earlier one, and the first on top with `itemReverseZIndex`
 * (PZ2), which lifts every earlier layer above every later one. So the box puts its first layer on
 * top only where every block after the ring paints in flow, and no earlier layer shows a fill that
 * would cover a later layer's shadow. Otherwise it keeps Figma's order and its `display` stays
 * unmapped, with the reason.
 *
 * @param reader - The box's style, which notes a stacking no order draws.
 * @param parts - The blocks, in the order the box stacks them.
 * @returns True where a flex block's layer casts a shadow, a later block that paints in flow fills,
 *   and one order draws both.
 */
function stacksFirstOnTop(reader: LayerStyle, parts: readonly StackedPart[]): boolean {
  const lifted = parts.findIndex(
    (part, index) =>
      ringsAsItem(part) && parts.slice(index + 1).some((later) => later.paints && paintsInFlow(later.style))
  );
  if (lifted === -1) {
    return false;
  }
  const refusal = stackingRefusal(parts, lifted);
  if (refusal !== undefined) {
    reader.read(
      "display",
      (value) => value,
      () => ({ outcome: "unmapped", detail: refusal })
    );
  }
  return refusal === undefined;
}

/**
 * Why no one order of a box's blocks draws the ring of a flex block's layer above a later block's
 * fill as CSS does: a later block paints above the ring as a positioned box or a stacking context,
 * or an earlier fill would cover a later shadow once the first layer is on top.
 *
 * @param parts - The blocks, in the order the box stacks them.
 * @param lifted - The index of the first flex block whose layer's ring a later block's fill meets.
 * @returns The reason, or undefined where the first layer on top draws both.
 */
function stackingRefusal(parts: readonly StackedPart[], lifted: number): string | undefined {
  const lifts = "the ring a flex block's layer casts paints above a later block's fill";
  const raised = parts.slice(lifted + 1).find((later) => !paintsInFlow(later.style));
  if (raised !== undefined) {
    return `${lifts} and below ${raised.layer.name}, a positioned box or a stacking context (CSS 2.1 Appendix E), and Figma paints a box's layers in one order`;
  }
  const covered = coveredShadow(parts.map(({ layer }) => layer));
  return covered === undefined
    ? undefined
    : `${lifts}, and putting the first layer on top would also paint the fill of ${covered.fill} over the shadow ${covered.shadow} casts, which CSS can paint above it`;
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
    tag === undefined ? undefined : cascade.labelElement({ tag, last: holder.layers.at(-1) === label.name });
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
    ({ radius, detail }) => (detail === undefined ? describeNumber(radius) : { outcome: "literal", detail })
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
    ({ detail }) => ({ outcome: "literal", detail })
  );
  style.read(
    "vertical-align",
    (value) => value,
    () => ({
      outcome: "dropped",
      detail: "Figma has no line of text, so the box's auto layout places the icon",
    })
  );
  if (display?.shown === false) {
    for (const property of ["width", "height"]) {
      style.mark(property, "dropped", "the icon is left out");
    }
    return undefined;
  }
  const width = style.read("width", (value) => readNumber(value, context.variables), describeNumber);
  const height = style.read("height", (value) => readNumber(value, context.variables), describeNumber);
  const color = style.read("color", (value) => readColor(value, context.variables), describeColor);
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
