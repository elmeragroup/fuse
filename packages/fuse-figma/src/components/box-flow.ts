/**
 * How a box lays out the layers in its flow, as `box-mapping.ts` maps it: the direction and the
 * alignments its flex, grid or block layout gives them, a column's stretch, and the alignment a row's
 * parts set through `align-self`, which settles once the parts map.
 */
import { heightBounds, listNames } from "./box-sizing";
import type { Feed, LayerStyle } from "./cascade";
import { normalizeCss } from "./css-values";
import type {
  ChildLayerSpec,
  CounterAlignSpec,
  DirectionSpec,
  FrameLayerSpec,
  InstanceLayerSpec,
  LimitsSpec,
  PrimaryAlignSpec,
  SizeSpec,
  SizingSpec,
} from "./kit-spec";
import type { Layout } from "./placement";

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

/**
 * Read an alignment along one axis, `justify-content` along the box's direction or `align-items`
 * across it, filling the fields `feed` names.
 */
function readAlign<Align extends PrimaryAlignSpec>(
  reader: LayerStyle,
  property: string,
  axis: string,
  alignments: ReadonlyMap<string, { readonly align: Align; readonly where: string }>,
  feed: Feed
): Align | undefined {
  return reader.read(
    property,
    (value) => alignments.get(normalizeCss(value)),
    ({ where }) => ({ outcome: "literal", detail: `${where} the ${axis} axis` }),
    feed
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
 * @param flow - The parts in the box's flow, and its icons and label, which set no
 *   alignment of their own.
 * @param box - The box's sizing and limits, which say whether it hugs its layers along its
 *   direction with no minimum, so `justify-content` has no free space to distribute, and the sizing
 *   of the layers inside it, which a column's `align-items` decides as it stretches them or not.
 * @returns The box's layout, and the alignment its parts set, which {@link settleFlow}
 *   settles once the parts map.
 */
export function readFlow(
  reader: LayerStyle,
  flow: FlowLayers,
  box: { readonly sizing: SizingSpec; readonly limits: LimitsSpec; readonly inside: Feed }
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
        ({ detail }) => ({ outcome: "literal", detail }),
        reader.feed("direction")
      )?.direction ?? "HORIZONTAL")
    : "HORIZONTAL";
  const unset = direction === "VERTICAL" ? "MIN" : "CENTER";
  const self = flex && direction === "HORIZONTAL" ? readSelfAlignment(reader, flow) : undefined;
  const column = direction === "VERTICAL";
  // A set `align-items` stops a column stretching its layers, as `roomInside` reads it.
  const counterAlign =
    self?.align ??
    readAlign(reader, "align-items", "counter", ALIGNMENTS, [
      ...reader.feed("counterAlign"),
      ...(column ? box.inside : []),
    ]) ??
    unset;
  const hugged =
    flex &&
    (column ? box.sizing.vertical : box.sizing.horizontal).kind === "hug" &&
    (column ? box.limits.minHeight : box.limits.minWidth) === undefined;
  const primaryAlign =
    readAlign(
      reader,
      "justify-content",
      "primary",
      hugged ? HUGGED_ALIGNMENTS : PRIMARY_ALIGNMENTS,
      reader.feed("primaryAlign")
    ) ?? unset;
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

/**
 * One layer in a box's flow: its key, which tells it from the box's other layers, as the keys of two
 * instance parts of one set do where both take the set's slot as their name, and its name, which the
 * coverage table names.
 */
export type FlowLayer = { readonly key: string; readonly name: string };

/**
 * The layers in a box's flow: its parts, each with its style and the sizing a stretch across the box
 * fills, and its icons and label.
 */
export type FlowLayers = {
  readonly parts: readonly (FlowLayer & { readonly style: LayerStyle; readonly sizing: Feed })[];
  readonly others: readonly FlowLayer[];
};

/** How a box lays out its layers, and the alignment its parts set, where they set one. */
export type Flow = {
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
  /** The keys of the parts that set an alignment. */
  readonly setters: ReadonlySet<string>;
  /** The layers that set none, the icons and the label among them. */
  readonly loose: readonly FlowLayer[];
  /** The keys of the loose parts that draw the same stretched, as {@link stretchesAlike} says. */
  readonly stretchable: ReadonlySet<string>;
  /** The sizing of the loose parts, which the row's `align-items` fills where they stretch. */
  readonly stretching: Feed;
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
 * `align-items` waits for the parts to map, as {@link settleFlow} says. Two alignments, one Figma has
 * no form for, or a row that leaves a layer to an unset `align-items` leave `align-self` unread, so
 * unmapped.
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
  const loose = [...looseParts, ...others];
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
      }),
      // The part places itself where the row's alignment draws it.
      reader.feed("counterAlign")
    );
  }
  if (own?.align === self.align) {
    return undefined;
  }
  return {
    align: self.align,
    own,
    setters: new Set(setters.map((part) => part.key)),
    loose: loose.map(({ key, name }) => ({ key, name })),
    stretchable: new Set(
      own === undefined
        ? []
        : looseParts.filter((part) => stretchesAlike(part.style, own.align)).map((part) => part.key)
    ),
    stretching: looseParts.flatMap((part) => part.sizing),
  };
}

/**
 * Settle a box's flow once its parts map: in a row that takes the alignment its parts set, which of
 * its layers stretch across its height, as {@link settleSelfAlignment} decides. Every other box
 * stretches none here.
 *
 * @param reader - The box's style.
 * @param flow - The box's flow, as {@link readFlow} read it.
 * @param layers - The layers of the box's parts in its flow, as mapped.
 * @returns The keys of the layers that stretch.
 */
export function settleFlow(
  reader: LayerStyle,
  flow: Flow,
  layers: readonly ChildLayerSpec[]
): ReadonlySet<string> {
  return flow.self === undefined ? new Set() : settleSelfAlignment(reader, flow.self, layers);
}

/**
 * A part's layer as its row draws it once the flow settles: filling the row's height where the row
 * stretches it, by its key, and as it was otherwise.
 *
 * @param layer - The part's layer, as mapped.
 * @param stretched - The keys of the layers the row stretches, as {@link settleFlow} gives them.
 * @returns The layer.
 */
export function stretchedLayer(
  layer: FrameLayerSpec | InstanceLayerSpec,
  stretched: ReadonlySet<string>
): FrameLayerSpec | InstanceLayerSpec {
  return stretched.has(layer.key) ? { ...layer, sizing: { ...layer.sizing, vertical: FILL_SIZE } } : layer;
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
 * The row tells its layers apart by their keys.
 *
 * @param self - The alignment the row's parts set.
 * @param layers - The layers of the row's parts in its flow, as mapped.
 * @returns The keys of the layers that stretch, none where `align-items` stays unmapped.
 */
function settleSelfAlignment(
  reader: LayerStyle,
  self: SelfAlignment,
  layers: readonly ChildLayerSpec[]
): ReadonlySet<string> {
  const { own, setters, loose, stretchable, stretching } = self;
  const names = loose.map(({ name }) => name);
  if (loose.length === 0 || own === undefined) {
    reader.read(
      "align-items",
      (read) => read,
      () => ({ outcome: "dropped", detail: "every layer of the row sets its own `align-self`" }),
      []
    );
    return new Set();
  }
  const floor = Math.max(
    ...layers.filter((layer) => setters.has(layer.key)).map((layer) => heightBounds(layer).min)
  );
  const fits = (key: string) => {
    const tallest = heightBounds(layers.find((layer) => layer.key === key)).max;
    return tallest !== undefined && tallest <= floor;
  };
  const stretch = loose.every(({ key }) => stretchable.has(key) && fits(key));
  if (!stretch) {
    reader.mark(
      "align-items",
      "unmapped",
      `Figma aligns a row's layers one way, so ${listNames(names)} can sit ${own.where} the counter axis only by stretching across it, which draws what CSS draws only for a layer that paints nothing, places its own layers so and is no taller than the layers that set \`align-self\``,
      []
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
      detail: `${listNames(names)} ${stretches} across the counter axis and ${places} layers ${own.where} it, where CSS places ${it} ${own.where} the counter axis`,
    }),
    // Every loose layer is a part here, which the stretch fills across the row.
    [...reader.feed("counterAlign"), ...stretching]
  );
  return new Set(loose.map(({ key }) => key));
}
