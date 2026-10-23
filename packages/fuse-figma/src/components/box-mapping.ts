/**
 * Map a box, the root or a part, and the parts and icons below it onto Figma fields, from the
 * cascade of each: its layout, display, corner and icons. `box-sizing.ts` sizes the box,
 * `box-paint.ts` paints it, `label-layout.ts` sets its label and `placement.ts` places its parts.
 * `component-spec.ts` assembles a set from the root of each cell.
 */
import { describeColor, readPaint } from "./box-paint";
import {
  absoluteRoom,
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
import type { BoxCascade, LayerStyle } from "./cascade";
import type { BoxDefinition, BuildContext, Cell, IconSlot, PartDefinition } from "./component-spec";
import {
  describeNumber,
  evaluateNumber,
  isInfiniteLength,
  normalizeCss,
  readColor,
  readNumber,
} from "./css-values";
import { fixedLength, iconKey, ZERO } from "./kit-spec";
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
  SizingSpec,
} from "./kit-spec";
import { inertClamp, mapLabel, readLineClamp, readWithoutLabel, spaceBeforeLabel } from "./label-layout";
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
 * `line-clamp-*` makes a `-webkit-box` column, which sets its text from the top left.
 *
 * @returns The box's layout.
 */
function readFlow(reader: LayerStyle): Layout {
  const display = normalizeCss(reader.raw("display") ?? "");
  if (display === "grid" || display === "-webkit-box") {
    const column = display === "-webkit-box";
    return {
      flex: false,
      direction: column ? "VERTICAL" : "HORIZONTAL",
      primaryAlign: column ? "MIN" : "CENTER",
      counterAlign: column ? "MIN" : "CENTER",
      justify: "unset",
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
  const counterAlign = readAlign(reader, "align-items", "counter", ALIGNMENTS) ?? unset;
  const primaryAlign = readAlign(reader, "justify-content", "primary", PRIMARY_ALIGNMENTS) ?? unset;
  return {
    flex,
    direction,
    primaryAlign,
    counterAlign,
    justify: reader.has("justify-content") ? primaryAlign : "unset",
  };
}

/**
 * Read `display` once the box's layers are known. A flex box is an auto layout along its direction.
 * A grid with no template stacks each layer in a row of its own, so a grid with
 * `place-content: center` is an auto layout centered on both axes only around one layer. Any other
 * grid stays unmapped. A block box with no layers lays nothing out, so it is a frame like any
 * other. One that holds only its label sets the text in lines across its width, which the label's
 * own sizing draws, as `label-layout.ts` reads it for a block box. One with any other layer stays
 * unmapped. A `-webkit-box` maps only where it clamps its label, as {@link readLineClamp} decides
 * for the label too, as a column around the label. On any other display a `-webkit-box-orient` sets
 * nothing, as {@link inertClamp} says.
 *
 * @param layers - The names of the box's layers in the cell, in its flow.
 * @param label - The name of the label the box shows in the cell, or undefined for none.
 * @param layout - The box's layout, as {@link readFlow} read it.
 * @param clamp - The lines the box clamps its label to, or undefined for none.
 * @returns Whether the box is a block that sets its own text in lines.
 */
function readDisplay(
  reader: LayerStyle,
  layers: readonly string[],
  label: string | undefined,
  layout: Layout,
  clamp: number | undefined
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
  const flow =
    display === "block" && (layers.length === 0 || ownText)
      ? literalLayout(
          ["block"],
          ownText ? "a block box that sets its own text in lines" : "a frame with no layers to lay out"
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
  // The box's lengths and layout read before its parts, since they decide what a part can fill.
  const { sizing, limits, clips, extent } = readSizing(reader, room, context.variables);
  const layout = readFlow(reader);

  const start: ChildLayerSpec[] = [];
  const end: ChildLayerSpec[] = [];
  for (const slot of box.iconsFor(cell)) {
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
        cascade: cascade.part(child.classesFor(cell), name, child.slot, child.styleFor?.(cell) ?? []),
      };
    });
  const flowing = shown.filter((part) => !outOfFlow(part.cascade.style));
  const label = box.label?.shownIn(cell) === true ? box.label : undefined;
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
  readGrowth(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  const parts = shown.map((part) => {
    const index = flowing.indexOf(part);
    const room =
      index === -1 ? absoluteRoom(holder) : lessMargins(roomInside(holder, index), part.cascade.style);
    const box = mapBox(part.child, part.cascade, scope, room);
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
    return { layer, style: part.cascade.style };
  });
  const missing = unstretched(
    holder,
    flowing.map((part) => part.cascade.style)
  );
  if (missing !== undefined) {
    reader.missing(missing.property, missing.neededBy, missing.detail);
  }
  const clamp = readLineClamp(holder, label);
  const placed =
    label === undefined
      ? undefined
      : mapLabel(holder, label, {
          cell,
          variables: context.variables,
          color: textColor,
          clamp,
          variant,
        });
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
  const textBlock = readDisplay(reader, holder.layers, label?.name, layout, clamp);
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
  return {
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
    primaryAlign: placed?.primaryAlign ?? placement.primaryAlign,
    counterAlign:
      placed?.counterAlign ?? (textBlock ? blockLineAlign(layout, sizing, limits) : layout.counterAlign),
    cornerRadius: readCorner(reader, sizing, context) ?? ZERO,
    ...paint,
    opacity: opacity ?? 1,
    children,
  };
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

/** What an icon's `display` makes of it, by the value Tailwind compiles. */
const ICON_DISPLAYS = new Map([
  ["none", { shown: false, detail: "the icon is left out" }],
  ["inline-block", { shown: true, detail: "the icon shows where its box's auto layout places it" }],
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
