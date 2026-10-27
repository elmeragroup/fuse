/**
 * How a box lays out the layers in its flow, as `box-mapping.ts` maps it: the direction and the
 * alignments its flex, grid or block layout gives them, a column's stretch, and the alignment a row's
 * parts set through `align-self`, which settles once the parts map.
 */
import { BLOCK_LEVEL, heightBounds, listNames } from "./box-sizing";
import type { ChildSpacing, CoverageNote, Feed, LayerStyle } from "./cascade";
import { describeNumber, evaluateLength, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
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
 * Why a box of fixed or filling length that `space-between` sets spaces nothing out, as the box
 * mapping finds once its layers map: it holds one layer in its flow, or one that fills it along its
 * direction. Undefined where it spaces its layers out.
 */
export type UnspacedReason = "lone" | "grows";

/** What a box's `space-between` became, by why it spaces nothing out, or where it spaces its layers out. */
const SPACE_BETWEEN_DETAILS = {
  spaced: "spaced out between the ends of the primary axis",
  lone: "with one layer, which `space-between` places as `flex-start` does, so packed at the start of the primary axis",
  grows:
    "beside a layer that grows into the free space, so packed at the start of the primary axis with the gap, which Figma's SPACE_BETWEEN would drop (PV, W5-P3)",
} as const satisfies Record<UnspacedReason | "spaced", string>;

/**
 * Read the `justify-content: space-between` that {@link readFlow} leaves unread on a box of fixed or
 * filling length, once its layers map and the box mapping knows whether it spaces anything out.
 *
 * @param reader - The box's style.
 * @param unspaced - Why the box spaces nothing out, or undefined where it spaces its layers out.
 */
export function readSpaceBetween(reader: LayerStyle, unspaced: UnspacedReason | undefined): void {
  reader.read(
    "justify-content",
    (value) => (normalizeCss(value) === "space-between" ? value : undefined),
    () => ({ outcome: "literal", detail: SPACE_BETWEEN_DETAILS[unspaced ?? "spaced"] }),
    reader.feed("primaryAlign")
  );
}

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
 * Read the direction and alignments a box lays out its layers by, before its layers map, since they
 * decide how much room each layer has. A flex box is an auto layout along its `flex-direction`, a row
 * unless a column is set, that places its layers by `align-items` and `justify-content`. In a row an
 * unset alignment stays centered, as every published row was drawn. CSS packs a row's layers at the
 * start and stretches them, which shows only where a row has room to spare or layers of unequal
 * height. A fixed or filling row with room beside a hugging layer packs at its start once its layers
 * map, as `leavesRoomAtEnd` in `box-mapping.ts` decides. A column takes CSS's start on both axes, and
 * its unset `align-items` stretches its layers across it, which {@link roomInside} gives them. A grid
 * that puts every item in one column, as {@link placesInOneColumn} says, is such a column. Any other
 * grid places its layers by `place-content`, which {@link readDisplay} reads, so its alignments stay
 * unread. `line-clamp-*` makes a `-webkit-box` column, which sets its text from the top left. A row
 * whose parts set their own `align-self` aligns as {@link readSelfAlignment} says. A block box that
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
  if (display === "grid" && placesInOneColumn(reader, flow)) {
    return { layout: ONE_COLUMN_GRID, self: undefined };
  }
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
  const autoStart = flex && !column ? readAutoStart(reader, flow) : undefined;
  const alignments = hugged ? HUGGED_ALIGNMENTS : PRIMARY_ALIGNMENTS;
  // A box with free space spaces its layers out only where they map to leave it some, so the box
  // mapping reads its `space-between` once they map.
  const spaceBetweenUnread =
    flex &&
    !hugged &&
    autoStart === undefined &&
    normalizeCss(reader.resolved("justify-content") ?? "") === "space-between";
  // A label that fills before the margin leaves no free space, so the row packs at its start.
  const primaryAlign =
    autoStart === "label-fills"
      ? "MIN"
      : autoStart === "spaced"
        ? (alignments.get("space-between")?.align ?? unset)
        : spaceBetweenUnread
          ? "SPACE_BETWEEN"
          : (readAlign(reader, "justify-content", "primary", alignments, reader.feed("primaryAlign")) ??
            unset);
  const layout: Layout = {
    flex,
    blocks: false,
    direction,
    primaryAlign,
    counterAlign,
    justify:
      autoStart !== undefined ? "SPACE_BETWEEN" : reader.has("justify-content") ? primaryAlign : "unset",
  };
  // A flex item sits in no line box, so `vertical-align` does not apply to it (CSS Flexbox 1 §3), as
  // an avatar's `align-middle` in an Avatar group.
  for (const { style } of flex ? flow.parts : []) {
    style.read(
      "vertical-align",
      (value) => value,
      () => ({ outcome: "dropped", detail: "a flex item sits in no line box, so no line aligns it" }),
      []
    );
  }
  if (autoStart === "label-fills") {
    return { layout: { ...layout, labelFills: true }, self };
  }
  return { layout: spaceBetweenUnread ? { ...layout, spaceBetweenUnread: true } : layout, self };
}

/**
 * The properties of a grid that size, place or align its tracks or items, which a grid in one column
 * from its start leaves unset. Tailwind writes some as shorthands, as `grid-cols-2` sets
 * `grid-template-columns` and `col-span-2` sets `grid-column`, so the list names both forms.
 */
const GRID_TRACKS = [
  "grid",
  "grid-template",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
  "place-items",
  "justify-items",
  "align-items",
  "place-content",
  "justify-content",
  "align-content",
] as const;

/**
 * The properties of a grid item that place or align it in the grid, or that would read as a flex
 * item's share, which a grid item ignores and the column {@link ONE_COLUMN_GRID} draws would not.
 */
const ITEM_PLACEMENT = [
  "grid-area",
  "grid-column",
  "grid-column-start",
  "grid-column-end",
  "grid-row",
  "grid-row-start",
  "grid-row-end",
  "place-self",
  "justify-self",
  "align-self",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
] as const;

/**
 * Whether a grid puts every item in one column, one row each: it sets no track, template or alignment
 * of its own, flows its items in rows, which is the default, and holds only parts that set no
 * placement. Its one `auto` column then stretches to a definite grid width (CSS Grid 1 §7.1, §8.5,
 * §11.8), each item stretches across it (CSS Box Alignment 3 §6.1), and each row takes its item's
 * height. A box, icon or label that is no part may sit in the grid as an anonymous item, which the
 * rule does not model.
 */
function placesInOneColumn(reader: LayerStyle, flow: FlowLayers): boolean {
  const autoFlow = normalizeCss(reader.raw("grid-auto-flow") ?? "row");
  return (
    flow.parts.length > 0 &&
    flow.others.length === 0 &&
    autoFlow === "row" &&
    GRID_TRACKS.every((property) => !reader.has(property)) &&
    flow.parts.every(({ style }) => ITEM_PLACEMENT.every((property) => !style.has(property)))
  );
}

/**
 * A grid in one column, drawn as a vertical auto layout packed at its start whose unset alignment
 * across stretches its parts, as a flex column's does: {@link roomInside} fills them across a definite
 * width. Grid items and flex items paint alike, in their order (CSS Grid 1 §9, CSS Flexbox 1 §4.3).
 */
const ONE_COLUMN_GRID: Layout = {
  flex: true,
  blocks: false,
  direction: "VERTICAL",
  primaryAlign: "MIN",
  counterAlign: "MIN",
  justify: "unset",
  oneColumnGrid: true,
};

/** How the coverage table names an auto start margin {@link readAutoStart} reads on two layers. */
const AUTO_START =
  "the auto margin takes the row's free space, which ends the row with the layer, as space-between places two layers";

/** How the coverage table names an auto start margin {@link readAutoStart} reads after the label. */
const AUTO_START_AFTER_LABEL =
  "the auto margin takes the row's free space after the label, which fills that space in Figma and paints nothing past its text, so the layer ends the row";

/** The `text-align` values that set a label's text from its left, where a filling label draws as one at its own width. */
const FROM_LEFT: ReadonlySet<string> = new Set(["", "start", "left"]);

/**
 * Read an auto start margin on the last layer of a flex row, as a menu row's shortcut or caret ends
 * the row. Auto margins take the row's free space before `justify-content` distributes it (CSS
 * Flexbox 1 §8.1), so the margin ends the row with the layer and packs the others at the start. The
 * row must leave `justify-content` unset and the layer its end margin, so nothing else places them.
 *
 * - On the last of two layers the row reads as spaced between its ends, as `space-between` places
 *   two layers: `spaced`.
 * - On the last of more layers, with the row's own label right before it and the row setting its
 *   text from the left, the label fills the free space in Figma and paints nothing past its text, so
 *   the row packs at its start with its gap and draws what CSS draws: `label-fills`. The layers
 *   before the label keep their widths.
 *
 * An auto margin anywhere else stays unread, so it lands unmapped.
 *
 * @param reader - The row's style.
 * @param flow - The row's layers in flow.
 * @returns How the margin places the row's layers, or undefined where it stays unread.
 */
function readAutoStart(reader: LayerStyle, flow: FlowLayers): "spaced" | "label-fills" | undefined {
  const { last } = flow;
  const auto = (property: string) => normalizeCss(last?.resolved(property) ?? "") === "auto";
  const count = flow.parts.length + flow.others.length;
  const placing =
    count === 2
      ? "spaced"
      : count > 2 && flow.labelBeforeLast && FROM_LEFT.has(normalizeCss(reader.resolved("text-align") ?? ""))
        ? "label-fills"
        : undefined;
  if (
    last === undefined ||
    placing === undefined ||
    reader.has("justify-content") ||
    !auto("margin-left") ||
    last.has("margin-right")
  ) {
    return undefined;
  }
  last.read(
    "margin-left",
    (value) => value,
    () => ({ outcome: "literal", detail: placing === "spaced" ? AUTO_START : AUTO_START_AFTER_LABEL }),
    reader.feed("primaryAlign")
  );
  return placing;
}

/**
 * The displays of a block container that stacks its block-level children: a block box, and a list
 * item, which is a block box with a marker (CSS Display 3 §2.3). Tailwind preflight's `list-style:
 * none` on a list leaves its items no marker, as every list the kit draws has.
 */
export const BLOCK_CONTAINERS: ReadonlySet<string> = new Set(["block", "list-item"]);

/** The gaps, which separate the items of flex, grid and multi-column boxes and no blocks. */
const GAPS = ["gap", "row-gap", "column-gap"] as const;

/**
 * Whether a block box stacks its layers as blocks: every layer in its flow is a part whose display
 * is block-level, and the box sets no gap, which separates no blocks (CSS Box Alignment 3 §8). A part
 * whose display nothing sets may be inline, so it leaves the box as it was.
 */
function stacksBlocks(reader: LayerStyle, flow: FlowLayers): boolean {
  return (
    BLOCK_CONTAINERS.has(normalizeCss(reader.raw("display") ?? "")) &&
    flow.parts.length > 0 &&
    flow.others.length === 0 &&
    (flow.parts.every(({ style }) => BLOCK_LEVEL.has(normalizeCss(style.raw("display") ?? ""))) ||
      spansItsLine(flow)) &&
    GAPS.every((property) => !reader.has(property))
  );
}

/**
 * Whether a block container's one layer is an inline-block as wide as the container, with a fixed
 * height, as TextField's `relative` container holds its `<input>`. The layer sits alone on the
 * container's one line and spans it (CSS 2.1 §9.2.2, §10.3.9), so it lays out as a block would.
 * The line box takes the layer's height where the container's strut fits inside it: Chromium
 * measured the container exactly as tall and wide as its 36px and 44px input at both densities, in
 * a 16px `normal` line, on 2026-10-27, and a real file drew the container 384×36 at Dense and 384×44
 * at Comfortable around the Input set's instance (W5-P4).
 */
function spansItsLine(flow: FlowLayers): boolean {
  const [only, ...rest] = flow.parts;
  return (
    only !== undefined &&
    rest.length === 0 &&
    normalizeCss(only.style.raw("display") ?? "") === "inline-block" &&
    normalizeCss(only.style.resolved("width") ?? "") === "100%" &&
    only.style.has("height")
  );
}

/** The reverse flag Tailwind's `space-x-*` multiplies its margins by, 0 unless `space-x-reverse` sets it. */
const SPACE_X_REVERSE = "--tw-space-x-reverse";

/**
 * Read a negative `space-x-*` as the item spacing of a left-to-right flex row that draws every
 * element child as a layer in its flow. Tailwind compiles `-space-x-2` to `--tw-space-x-reverse: 0`,
 * `margin-inline-start: calc(L * var(--tw-space-x-reverse))` and `margin-inline-end: calc(L * calc(1 -
 * var(--tw-space-x-reverse)))` on every child but the last, L being `calc(0.25rem * -2)`. So each
 * child but the last ends -L early, and each child starts that far over the one before (CSS Flexbox 1
 * §9.4), a later sibling painting over an earlier one (§5.4). A Figma row with that negative item
 * spacing draws the same, the later layer on top (probe N7). L binds a synced variable whose code
 * syntax it equals, else it is a literal. Any other shape, a positive `space-x-*` among them, reads
 * nothing, so its rows stay unmapped.
 *
 * @param variables - The synced variables.
 * @returns The reading `BoxCascade.spaceChildren` takes.
 */
export function negativeRowSpacing(variables: VariableIndex): ChildSpacing {
  return (declarations) => {
    const values = new Map(declarations.map(({ property, value }) => [property, normalizeCss(value)]));
    const end = /^calc\((.+) \* calc\(1 - var\(--tw-space-x-reverse\)\)\)$/.exec(
      values.get("margin-inline-end") ?? ""
    )?.[1];
    if (
      end === undefined ||
      values.size !== 3 ||
      values.get(SPACE_X_REVERSE) !== "0" ||
      values.get("margin-inline-start") !== `calc(${end} * var(${SPACE_X_REVERSE}))` ||
      (evaluateLength(end) ?? 0) >= 0
    ) {
      return undefined;
    }
    const itemSpacing = readNumber(end, variables);
    if (itemSpacing === undefined) {
      return undefined;
    }
    const { outcome, detail } = describeNumber(itemSpacing);
    const notes = new Map<string, CoverageNote>([
      [
        SPACE_X_REVERSE,
        {
          outcome: "dropped",
          detail: "0 keeps the margins on the end side of each child, which the item spacing draws",
        },
      ],
      [
        "margin-inline-start",
        {
          outcome: "dropped",
          detail: `0 while \`${SPACE_X_REVERSE}\` is 0, so the start side keeps no margin`,
        },
      ],
      [
        "margin-inline-end",
        {
          outcome,
          detail: `${detail}, the item spacing: every child but the last ends that far early, and a later layer draws on top as a later sibling does`,
        },
      ],
    ]);
    return { itemSpacing, notes };
  };
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
  /**
   * The style of the box's last layer in flow, a part or an icon, which {@link readAutoStart} reads,
   * or undefined where the label ends the flow or the box holds no layer.
   */
  readonly last: LayerStyle | undefined;
  /** Whether the box's own label sits right before the last of three or more layers in flow. */
  readonly labelBeforeLast: boolean;
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
 * @param variables - The synced variables, whose values across their modes bound the layers' heights.
 * @returns The keys of the layers that stretch.
 */
export function settleFlow(
  reader: LayerStyle,
  flow: Flow,
  layers: readonly ChildLayerSpec[],
  variables: VariableIndex
): ReadonlySet<string> {
  return flow.self === undefined ? new Set() : settleSelfAlignment(reader, flow.self, layers, variables);
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
 * alignment, in every mode, as Item's actions, one 20px line, beside a content column of at least two
 * lines, or Alert's action, a Button at most 36px tall, beside a title and a description that set at
 * least 44.25px between them. The row's `align-items` then reads as literal through those layers.
 * Where a layer that sets none cannot stretch so, the row cannot place it as CSS does, so
 * `align-items` stays unmapped, naming it. The row tells its layers apart by their keys.
 *
 * @param self - The alignment the row's parts set.
 * @param layers - The layers of the row's parts in its flow, as mapped.
 * @param variables - The synced variables, whose values across their modes bound the layers' heights.
 * @returns The keys of the layers that stretch, none where `align-items` stays unmapped.
 */
function settleSelfAlignment(
  reader: LayerStyle,
  self: SelfAlignment,
  layers: readonly ChildLayerSpec[],
  variables: VariableIndex
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
    ...layers.filter((layer) => setters.has(layer.key)).map((layer) => heightBounds(layer, variables).min)
  );
  const fits = (key: string) => {
    const tallest = heightBounds(
      layers.find((layer) => layer.key === key),
      variables
    ).max;
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

/** The `display` values whose box lays its children out as flex items, which `order` places. */
const FLEX_DISPLAYS: ReadonlySet<string> = new Set(["flex", "inline-flex"]);

/** A position in a list as a word, from 0: first, second, third, then 4th and on. */
function ordinal(place: number): string {
  return ["first", "second", "third"][place] ?? `${place + 1}th`;
}

/**
 * Lay a flex box's parts out in order-modified document order (CSS Flexbox 1 §5.4): by `order`,
 * lowest first, with document order breaking ties, as Command's search addon follows its input in
 * the DOM and draws first through `order-first`. Figma draws layers in list order, so the parts take
 * that order, and each `order` reads as the place it gives. Outside a flex box, beside the box's own
 * icons or label, or with an `order` that is no integer, the parts keep document order and `order`
 * stays unread.
 *
 * @param box - The box's style.
 * @param parts - The box's parts, in document order.
 * @param ownLayers - How many icons and labels the box holds itself, which take no `order`.
 * @returns The parts in the order the box lays them out.
 */
export function orderModified<Part extends { readonly cascade: { readonly style: LayerStyle } }>(
  box: LayerStyle,
  parts: readonly Part[],
  ownLayers: number
): readonly Part[] {
  const orders = parts.map((part) => part.cascade.style.resolved("order"));
  const values = orders.map((order) => (order === undefined ? 0 : Number(normalizeCss(order))));
  if (
    !FLEX_DISPLAYS.has(normalizeCss(box.resolved("display") ?? "")) ||
    ownLayers > 0 ||
    orders.every((order) => order === undefined) ||
    !values.every(Number.isInteger)
  ) {
    return parts;
  }
  const flow = normalizeCss(box.resolved("flex-direction") ?? "").startsWith("column") ? "column" : "row";
  const sorted = parts
    .map((part, index) => ({ part, index, value: values[index] ?? 0 }))
    .toSorted((one, other) => one.value - other.value || one.index - other.index);
  sorted.forEach(({ part }, place) =>
    part.cascade.style.read(
      "order",
      (value) => value,
      () => ({
        outcome: "literal",
        detail: `the layer sits ${ordinal(place)} in the ${flow}'s order-modified document order`,
      }),
      []
    )
  );
  return sorted.map(({ part }) => part);
}
