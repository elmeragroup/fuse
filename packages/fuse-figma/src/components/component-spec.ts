/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and maps it
 * onto Figma fields. Every declaration it reads lands in the coverage table with what became
 * of it.
 */
import { SetCascade, splitClasses } from "./cascade";
import type { BoxCascade, CoverageNote, LayerStyle } from "./cascade";
import type { CoverageRow } from "./coverage";
import {
  evaluateNumber,
  evaluatePercentage,
  isInfiniteLength,
  normalizeCss,
  readColor,
  readNumber,
  readShadows,
  splitTopLevel,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { walkLayers } from "./kit-spec";
import type {
  AlignSpec,
  AxisSpec,
  BoxSpec,
  ChildLayerSpec,
  ColorSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  FrameLayerSpec,
  NumberSpec,
  IconLayerSpec,
  ShadowSpec,
  StringSpec,
  StrokeSpec,
  SwapPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { makeStateTable } from "./state-table";
import type { CompiledUtilities } from "./utility-css";

/** One cell of a variant matrix: a value for each axis. */
export type Cell = Readonly<Record<string, string>>;

/**
 * An icon a part renders in a cell, described as the DOM holds it, so the recipe's child
 * selectors can find it the way the browser does.
 */
export type IconSlot = {
  readonly key: string;
  readonly name: string;
  /** The side of the label the icon sits on. */
  readonly side: "start" | "end";
  /**
   * Whether the `<svg>` is a child of the part that lists it, which `[&>svg]` on that part
   * selects. The spinner of a pending Button sits in a span, so it is not.
   */
  readonly direct: boolean;
  /** The `data-icon` the icon, or the span around it, carries. */
  readonly dataIcon: "inline-start" | "inline-end" | undefined;
  /** The Fuse icon the layer shows, by its export name, such as `Plus`. */
  readonly icon: string;
  /** The INSTANCE_SWAP property that picks the icon, or undefined for a fixed icon. */
  readonly swapProperty: string | undefined;
};

/**
 * The swap properties of a set's icon slots.
 *
 * @param slots - The slots, in the order the set lists their properties.
 * @returns The swap property of each slot that has one, starting with the slot's icon.
 */
export function swapProperties(slots: readonly IconSlot[]): readonly SwapPropertySpec[] {
  return slots.flatMap((slot) =>
    slot.swapProperty === undefined ? [] : [{ name: slot.swapProperty, defaultIcon: slot.icon }]
  );
}

/**
 * The key of the icon component for a Fuse icon.
 *
 * @param name - The icon's export name, such as `ArrowRight`.
 * @returns The key, such as `icon/ArrowRight`.
 */
export function iconKey(name: string): string {
  return `icon/${name}`;
}

/**
 * What a set's root element is, which decides the attributes its disabled state holds.
 *
 * - `native-control`: a native `<button>`, disabled through its `disabled` attribute.
 * - `base-ui-span`: a Base UI `<span>`, such as a radio, which Base UI disables with
 *   `aria-disabled` and keeps focusable.
 */
export type RootKind = "native-control" | "base-ui-span";

/** A text layer a part shows, and the set's text property that sets its characters. */
export type LabelDefinition = {
  readonly key: string;
  readonly name: string;
  readonly characters: string;
  readonly textProperty: string;
  /** Whether a cell shows the label. A Kbd shows it in its text cell and not its icon cell. */
  readonly shownIn: (cell: Cell) => boolean;
};

/**
 * What the root, or a part below it, renders in a cell: its classes and its children. The
 * children sit in DOM order: the parts first, then the start icons, the label and the end icons.
 */
export type BoxDefinition = {
  /** The recipe's class string for one cell. */
  readonly classesFor: (cell: Cell) => string;
  /** The text layer, or undefined for a part that shows no text of its own. */
  readonly label: LabelDefinition | undefined;
  /** The icons a cell renders in this part, in DOM order. A start icon sits before the label. */
  readonly iconsFor: (cell: Cell) => readonly IconSlot[];
  /** The parts directly below this one, in DOM order. */
  readonly parts?: readonly PartDefinition[];
};

/**
 * A part below the root, such as a checkbox's indicator. It cascades its own classes, and
 * inherits its parent's text color, font and custom properties as the DOM does.
 */
export type PartDefinition = BoxDefinition & {
  /** The key of the part's frame layer. */
  readonly key: string;
  /**
   * The part's `data-slot`, which names its layer, or undefined for an element without one,
   * such as Radio's dot, whose layer takes the part's key as its name.
   */
  readonly slot: string | undefined;
  /** Whether a cell renders the part. Base UI mounts a checkbox's indicator only while checked. */
  readonly shownIn: (cell: Cell) => boolean;
};

/** A component the builder can turn into a component set. Its own box is the root. */
export type ComponentDefinition = BoxDefinition & {
  readonly key: string;
  readonly name: string;
  /** The root part's `data-slot`, which names the root layer. */
  readonly slot: string;
  /**
   * What the root element is. A set whose `state` axis has `disabled` names it, and
   * `state-table.ts` refuses one that does not.
   */
  readonly rootKind?: RootKind;
  readonly axes: readonly AxisSpec[];
  readonly columnAxis: string;
  /**
   * The variants each of the component's own states renders, beyond the ones `state-table.ts`
   * gives every component, such as `{ pending: ["data-disabled", "aria-disabled"] }`.
   */
  readonly states: Readonly<Record<string, readonly string[]>>;
  /** Each variant only this component uses, and whether it holds in a cell. */
  readonly facts: ReadonlyMap<string, (cell: Cell) => boolean>;
  /**
   * The variants of states this component leaves out on top of the shared ones, such as a
   * group's corners. A class with one of them lands in the coverage table as dropped. A class
   * with a variant neither the table nor the definition knows is unmapped, so a new state in
   * the recipe fails the gate.
   */
  readonly omittedStates: ReadonlySet<string>;
  /**
   * The pseudo-elements the kit draws no layer for, such as `after` for a hit area, each with the
   * reason a designer reads in the coverage table. A class on one of them lands there as dropped.
   */
  readonly omittedPseudoElements?: ReadonlyMap<string, string>;
  /** The INSTANCE_SWAP properties, each with the export name of the icon it starts with. */
  readonly swapProperties: readonly SwapPropertySpec[];
};

/**
 * A declaration a part gets from outside its recipe, where its recipe sets nothing: one the
 * host page sets on an ancestor and the part inherits, such as the text color of an outline
 * Button, or one a base-layer rule sets on the part itself.
 */
export type OuterDeclaration = {
  /** The host class or the stylesheet rule that sets it, for the coverage table. */
  readonly className: string;
  readonly property: string;
  readonly value: string;
};

/** What the builder needs besides the component. */
export type BuildContext = {
  readonly compiled: CompiledUtilities;
  readonly variables: VariableIndex;
  /** The inherited declarations of the host page, applied before every other declaration. */
  readonly page: readonly OuterDeclaration[];
  /**
   * The base-layer declarations every root gets, applied after the page's and before every
   * recipe class, since any utility beats the base layer. A root that does not read one drops it.
   */
  readonly base: readonly OuterDeclaration[];
};

/** A component set and the coverage of the recipe classes it read. */
export type BuiltComponent = {
  readonly componentSet: Omit<ComponentSetSpec, "page">;
  readonly coverage: readonly CoverageRow[];
  /** Each font style the text layers use. */
  readonly fontStyles: readonly string[];
};

/** The Figma style of each Roboto weight a recipe reaches. */
const FONT_STYLES = new Map([
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
]);

/**
 * Build the component set for every cell of the definition's matrix.
 *
 * @param definition - The component.
 * @param context - The compiled utilities and the synced variables.
 * @returns The component set, its coverage and the font styles its text uses.
 */
export function buildComponentSet(definition: ComponentDefinition, context: BuildContext): BuiltComponent {
  const coverage = new Map<string, CoverageRow>();
  const fontStyles = new Set<string>();
  const record = (row: Omit<CoverageRow, "component">): void => {
    const full = { component: definition.name, ...row };
    coverage.set(
      JSON.stringify([full.part, full.className, full.property, full.value, full.outcome, full.detail]),
      full
    );
  };
  const cascade = new SetCascade(makeStateTable(definition), context, record);
  const variants = matrixCells(definition.axes).map((cell): VariantSpec => {
    const cellCascade = cascade.cell(cell);
    const scope: MapScope = { definition, cell, context };
    const rootCascade = cellCascade.root(definition.classesFor(cell), definition.slot);
    const root: ComponentRootSpec = { name: definition.slot, ...mapBox(definition, rootCascade, scope) };
    readPosition(rootCascade.style, "other");
    cellCascade.settle();
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        fontStyles.add(layer.fontStyle);
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  cascade.finish();
  return {
    componentSet: {
      key: definition.key,
      name: definition.name,
      axes: definition.axes,
      columnAxis: definition.columnAxis,
      textProperties: boxesOf(definition).flatMap(({ label }) =>
        label === undefined ? [] : [{ name: label.textProperty, defaultValue: label.characters }]
      ),
      swapProperties: definition.swapProperties.map((property) => ({
        name: property.name,
        defaultIcon: iconKey(property.defaultIcon),
      })),
      variants,
    },
    coverage: [...coverage.values()],
    fontStyles: [...fontStyles],
  };
}

/**
 * The key of one variant, such as `button/variant=default,size=sm,state=rest,icon=none`.
 *
 * @param definition - The component.
 * @param cell - The cell.
 * @returns The key.
 */
export function variantKey(definition: Pick<ComponentDefinition, "key" | "axes">, cell: Cell): string {
  return `${definition.key}/${definition.axes.map((axis) => `${axis.name}=${cell[axis.name] ?? ""}`).join(",")}`;
}

/**
 * Every class the root and its parts use in any cell of the matrix, which the build compiles.
 *
 * @param definition - The component.
 * @returns The classes, in the order the boxes first use them.
 */
export function definitionClasses(definition: ComponentDefinition): readonly string[] {
  return matrixCells(definition.axes).flatMap((cell) =>
    boxesOf(definition).flatMap((box) => splitClasses(box.classesFor(cell)))
  );
}

/** The box and every part below it, depth first. */
function boxesOf(box: BoxDefinition): readonly BoxDefinition[] {
  return [box, ...(box.parts ?? []).flatMap(boxesOf)];
}

/** A part's layer name: its `data-slot`, or its key for an element without one. */
function partName(part: PartDefinition): string {
  return part.slot ?? part.key;
}

/** Every cell of the matrix, the first axis varying slowest. */
export function matrixCells(axes: readonly AxisSpec[]): readonly Cell[] {
  return axes.reduce<Cell[]>(
    (cells, axis) => cells.flatMap((cell) => axis.values.map((value) => ({ ...cell, [axis.name]: value }))),
    [{}]
  );
}

function describeNumber(spec: NumberSpec): CoverageNote {
  return spec.kind === "variable"
    ? { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` }
    : { outcome: "literal", detail: `${spec.value}px` };
}

function describeColor(spec: ColorSpec): CoverageNote {
  if (spec.kind === "variable") {
    return { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` };
  }
  const { r, g, b, a } = spec.color;
  return {
    outcome: "literal",
    detail: `rgba(${[r, g, b].map((channel) => Math.round(channel * 255)).join(", ")}, ${a})`,
  };
}

/** A background that paints nothing, which the root writes as no fill. */
const NO_FILL = "no fill";

/**
 * Read a background as the root's fill. A literal color at alpha 0, such as `transparent`,
 * paints nothing in CSS, so it becomes no fill, as an unset background does. The plugin then
 * gives a root that casts a spread shadow its clear fill, which Figma counts and an alpha-0
 * fill it does not.
 */
function readFill(value: string, index: VariableIndex): ColorSpec | typeof NO_FILL | undefined {
  const color = readColor(value, index);
  return color?.kind === "literal" && color.color.a === 0 ? NO_FILL : color;
}

function describeFill(fill: ColorSpec | typeof NO_FILL): CoverageNote {
  return fill === NO_FILL
    ? { outcome: "literal", detail: "no fill, since a transparent background paints nothing" }
    : describeColor(fill);
}

const ZERO: NumberSpec = { kind: "literal", value: 0 };

function literalLayout(expected: readonly string[], detail: string) {
  return {
    map: (value: string) => (expected.includes(normalizeCss(value)) ? value : undefined),
    describe: () => ({ outcome: "literal" as const, detail }),
  };
}

/** Where `align-items` and `justify-content` place a box's children, by the value Tailwind compiles. */
const ALIGNMENTS = new Map<string, { readonly align: AlignSpec; readonly where: string }>([
  ["flex-start", { align: "MIN", where: "at the start of" }],
  ["center", { align: "CENTER", where: "centered on" }],
  ["flex-end", { align: "MAX", where: "at the end of" }],
]);

function readAlign(reader: LayerStyle, property: string, axis: string): AlignSpec | undefined {
  return reader.read(
    property,
    (value) => ALIGNMENTS.get(normalizeCss(value)),
    ({ where }) => ({ outcome: "literal", detail: `${where} the ${axis} axis` })
  )?.align;
}

/**
 * Read how a box lays out its layers. A flex box is a horizontal auto layout that places them by
 * `align-items` and `justify-content`. A grid with no template stacks each layer in a row of its
 * own, so a grid with `place-content: center` is an auto layout centered on both axes only
 * around one layer. Any other grid stays unmapped.
 *
 * @param layers - How many layers the box holds in the cell.
 * @returns The alignment on each axis.
 */
function readLayout(reader: LayerStyle, layers: number): Pick<BoxSpec, "primaryAlign" | "counterAlign"> {
  if (normalizeCss(reader.raw("display") ?? "") === "grid") {
    const centered =
      layers === 1 &&
      reader.read(
        "place-content",
        (value) => (normalizeCss(value) === "center" ? true : undefined),
        () => ({ outcome: "literal", detail: "centered on both axes" })
      ) === true;
    reader.read(
      "display",
      (value) => (centered ? value : undefined),
      () => ({ outcome: "literal", detail: "an auto layout around its one layer" })
    );
    return { primaryAlign: "CENTER", counterAlign: "CENTER" };
  }
  const display = literalLayout(["inline-flex", "flex"], "a horizontal auto layout");
  reader.read("display", display.map, display.describe);
  // An unset alignment stays centered, as every root drew before parts. CSS packs it at the start
  // and stretches it, which shows only where a box has room to spare or children of unequal height.
  const counterAlign = readAlign(reader, "align-items", "counter") ?? "CENTER";
  const primaryAlign = readAlign(reader, "justify-content", "primary") ?? "CENTER";
  return { primaryAlign, counterAlign };
}

/** What the mapping of every layer of one cell reads besides the layer's own style. */
type MapScope = {
  readonly definition: ComponentDefinition;
  readonly cell: Cell;
  readonly context: BuildContext;
};

/**
 * Map a box, the root or a part, and the parts and icons below it, from the cascade of each.
 *
 * @param box - The root's or the part's definition.
 * @param cascade - The box's cascade.
 * @returns The box, without the root's name or a frame's key.
 */
function mapBox(box: BoxDefinition, cascade: BoxCascade, scope: MapScope): BoxSpec {
  const { definition, cell, context } = scope;
  const reader = cascade.style;
  const number = (property: string): NumberSpec | undefined =>
    reader.read(property, (value) => readNumber(value, context.variables), describeNumber);
  const color = (property: string): ColorSpec | undefined =>
    reader.read(property, (value) => readColor(value, context.variables), describeColor);

  for (const [property, layout] of [
    ["box-sizing", literalLayout(["border-box"], "strokes count in the auto layout")],
    ["white-space", literalLayout(["nowrap"], "the label hugs its width")],
  ] as const) {
    reader.read(property, layout.map, layout.describe);
  }

  const stroke = readStroke(reader, context);
  const shadows = readShadowStack(reader, context);
  const opacity = reader.read("opacity", evaluateNumber, (value) => ({
    outcome: "literal",
    detail: `opacity ${value}`,
  }));
  const textColor = color("color");
  const fill = reader.read("background-color", (value) => readFill(value, context.variables), describeFill);

  const start: ChildLayerSpec[] = [];
  const end: ChildLayerSpec[] = [];
  for (const slot of box.iconsFor(cell)) {
    const icon = mapIcon(slot, cascade.icon(slot), scope);
    if (icon !== undefined) {
      (slot.side === "start" ? start : end).push(icon);
    }
  }
  const parts = (box.parts ?? [])
    .filter((child) => child.shownIn(cell))
    .map((child) => {
      const name = partName(child);
      const childCascade = cascade.part(child.classesFor(cell), name);
      const layer: FrameLayerSpec = {
        kind: "frame",
        key: child.key,
        name,
        ...mapBox(child, childCascade, scope),
      };
      return { layer, style: childCascade.style };
    });
  const children: ChildLayerSpec[] = [...parts.map(({ layer }) => layer), ...start];
  const label = box.label?.shownIn(cell) === true ? box.label : undefined;
  if (label === undefined) {
    for (const property of TEXT_PROPERTIES) {
      reader.mark(property, "dropped", "the cell shows no text");
    }
  } else {
    children.push(mapLabel(definition, label, cell, reader, context, textColor));
  }
  children.push(...end);
  // The layout reads once the children are known, since a grid maps only around one layer.
  const { primaryAlign, counterAlign } = readLayout(reader, children.length);
  const layout =
    primaryAlign === "CENTER" && counterAlign === "CENTER" && children.length === 1
      ? "centers-its-one-layer"
      : "other";
  for (const part of parts) {
    readPosition(part.style, layout);
  }
  const width = number("width");
  reader.read(
    "max-width",
    (value) => {
      const max = readNumber(value, context.variables);
      return max?.kind === "literal" && width?.kind === "literal" && max.value >= width.value
        ? max
        : undefined;
    },
    () => ({ outcome: "dropped", detail: "it is no less than the fixed width, so it never narrows the box" })
  );

  const height = number("height");
  reader.read(
    "aspect-ratio",
    (value) => (width !== undefined && height !== undefined ? value : undefined),
    () => ({ outcome: "dropped", detail: "both sides are fixed, so the ratio sizes neither" })
  );
  return {
    width,
    height,
    minWidth: number("min-width"),
    paddingTop: number("padding-top") ?? ZERO,
    paddingRight: number("padding-right") ?? ZERO,
    paddingBottom: number("padding-bottom") ?? ZERO,
    paddingLeft: number("padding-left") ?? ZERO,
    itemSpacing: number("gap") ?? ZERO,
    primaryAlign,
    counterAlign,
    cornerRadius: readCorner(reader, { width, height }, context) ?? ZERO,
    fill: fill === NO_FILL ? undefined : fill,
    stroke,
    shadows,
    opacity: opacity ?? 1,
    children,
  };
}

/**
 * How a parent lays out its layers, as far as a positioned part needs to know: an auto layout
 * centered on both axes around this one layer, or anything else, which is also what the root has.
 */
type ParentLayout = "centers-its-one-layer" | "other";

/** The offsets of a part that centers itself on its containing block, each as a share of a size. */
const CENTERING_OFFSETS = [
  ["top", 0.5],
  ["left", 0.5],
] as const;

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
    CENTERING_OFFSETS.every(
      ([property, share]) => evaluatePercentage(reader.resolved(property) ?? "") === share
    ) &&
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

/**
 * Read `border-radius` as the corner. An infinite radius, which `rounded-full` compiles to, reads
 * as half the box's shorter side. CSS scales down radii whose sum exceeds a side, so it draws any
 * larger radius as that half. The plugin writes the half itself rather than rely on Figma
 * clamping a larger radius the same way. A box that hugs a side has no length to halve, so its
 * pill corner stays unmapped.
 *
 * @param size - The box's width and height, each undefined when the box hugs that side.
 * @returns The corner, or undefined when the box sets none or it does not map.
 */
function readCorner(
  reader: LayerStyle,
  size: { readonly width: NumberSpec | undefined; readonly height: NumberSpec | undefined },
  context: BuildContext
): NumberSpec | undefined {
  const { width, height } = size;
  const corner = reader.read(
    "border-radius",
    (value): { readonly radius: NumberSpec; readonly half: number | undefined } | undefined => {
      const radius = readNumber(value, context.variables);
      if (radius !== undefined) {
        return { radius, half: undefined };
      }
      if (!isInfiniteLength(value) || width?.kind !== "literal" || height?.kind !== "literal") {
        return undefined;
      }
      const half = Math.min(width.value, height.value) / 2;
      return { radius: { kind: "literal", value: half }, half };
    },
    ({ radius, half }) =>
      half === undefined
        ? describeNumber(radius)
        : {
            outcome: "literal",
            detail: `${half}px, half the shorter side, which CSS draws for any larger radius`,
          }
  );
  return corner?.radius;
}

/**
 * Map one icon. A slot whose computed style is `display: none` is left out, as the pending
 * Button leaves out its own leading icon while its spinner takes the place. The icon's glyph
 * takes the text color it inherits, as a Fuse icon paints with `currentColor`.
 *
 * @returns The icon layer, or undefined for an icon the cell hides.
 */
function mapIcon(
  slot: IconSlot,
  style: LayerStyle,
  { definition, cell, context }: MapScope
): IconLayerSpec | undefined {
  const hidden = style.read(
    "display",
    (value) => (normalizeCss(value) === "none" ? true : undefined),
    () => ({ outcome: "literal", detail: "the icon is left out" })
  );
  if (hidden === true) {
    for (const property of ["width", "height"]) {
      style.mark(property, "dropped", "the icon is left out");
    }
    return undefined;
  }
  const width = style.read("width", (value) => readNumber(value, context.variables), describeNumber);
  const height = style.read("height", (value) => readNumber(value, context.variables), describeNumber);
  const color = style.read("color", (value) => readColor(value, context.variables), describeColor);
  if (width === undefined || color === undefined || JSON.stringify(width) !== JSON.stringify(height)) {
    throw new Error(`${variantKey(definition, cell)}: the ${slot.name} needs a square size and a text color`);
  }
  return {
    kind: "icon",
    key: slot.key,
    name: slot.name,
    icon: iconKey(slot.icon),
    swapProperty: slot.swapProperty,
    size: width,
    color,
  };
}

/** The `box-shadow` every Tailwind shadow and ring utility writes, one layer per custom property. */
const TAILWIND_SHADOW_LAYERS = [
  "--tw-inset-shadow",
  "--tw-inset-ring-shadow",
  "--tw-ring-offset-shadow",
  "--tw-ring-shadow",
  "--tw-shadow",
] as const;

const TAILWIND_SHADOW_STACK = TAILWIND_SHADOW_LAYERS.map((layer) => `var(${layer})`).join(",");

/**
 * Read the drop shadows. Tailwind composes `box-shadow` from one custom property per layer,
 * so the builder reads each layer a class set on its own. A layer that does not map, such
 * as a shadow whose blur is a formula over a variable, leaves the other layers in place.
 */
function readShadowStack(root: LayerStyle, context: BuildContext): readonly ShadowSpec[] {
  const raw = root.raw("box-shadow");
  if (raw === undefined) {
    return [];
  }
  const describe = (mapped: readonly ShadowSpec[]) => ({
    outcome: mapped.some((shadow) => shadow.color.kind === "variable")
      ? ("bound" as const)
      : ("literal" as const),
    detail: mapped.length === 0 ? "no visible shadow" : `${mapped.length} drop shadow(s)`,
  });
  if (normalizeCss(raw) !== TAILWIND_SHADOW_STACK) {
    return root.read("box-shadow", (value) => readShadows(value, context.variables), describe) ?? [];
  }
  root.mark("box-shadow", "literal", "Tailwind's shadow stack, read layer by layer");
  return TAILWIND_SHADOW_LAYERS.flatMap((layer) =>
    root.has(layer)
      ? (root.read(layer, (value) => readShadows(value, context.variables), describe) ?? [])
      : []
  );
}

/**
 * A CSS border becomes an inside stroke. A border with no style or a style other than solid
 * stays unmapped, and so does one with no color, which would otherwise draw no stroke and leave
 * no row.
 */
function readStroke(root: LayerStyle, context: BuildContext): StrokeSpec | undefined {
  if (!root.has("border-width")) {
    return undefined;
  }
  root.missing(
    "border-color",
    "border-width",
    "no class or base rule colors the border, so the stroke is left out"
  );
  const style = root.read(
    "border-style",
    (value) => (normalizeCss(value) === "solid" ? value : undefined),
    () => ({ outcome: "literal", detail: "a solid stroke" })
  );
  const weight = root.read("border-width", (value) => readNumber(value, context.variables), describeNumber);
  const color = root.read("border-color", (value) => readColor(value, context.variables), describeColor);
  return style === undefined || weight === undefined || color === undefined ? undefined : { color, weight };
}

/** The text properties a label reads, which a part without a label drops. */
const TEXT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-decoration-line",
  "text-underline-offset",
] as const;

function mapLabel(
  definition: ComponentDefinition,
  label: LabelDefinition,
  cell: Cell,
  root: LayerStyle,
  context: BuildContext,
  color: ColorSpec | undefined
): ChildLayerSpec {
  const fontSize = root.read("font-size", (value) => readNumber(value, context.variables), describeNumber);
  const lineHeight = root.read(
    "line-height",
    (value) => {
      const bound = context.variables.lookup(value);
      if (bound !== undefined) {
        return { kind: "variable" as const, variable: bound };
      }
      const number = evaluateNumber(value);
      if (number === undefined) {
        return undefined;
      }
      // A unitless line height multiplies the font size, which must then be a literal.
      if (/px|rem|%/.test(value)) {
        return { kind: "literal" as const, value: number };
      }
      return fontSize?.kind === "literal"
        ? { kind: "literal" as const, value: number * fontSize.value }
        : undefined;
    },
    describeNumber
  );
  const fontFamily = root.read(
    "font-family",
    (value): StringSpec | undefined => {
      const bound = context.variables.lookup(value);
      return bound === undefined ? undefined : { kind: "variable", variable: bound };
    },
    (spec) => ({
      outcome: "bound",
      detail: spec.kind === "variable" ? `${spec.variable.collection} / ${spec.variable.name}` : spec.value,
    })
  );
  const weight = root.read(
    "font-weight",
    (value) => {
      const number = evaluateNumber(value);
      return number === undefined ? undefined : FONT_STYLES.get(number);
    },
    (style) => ({ outcome: "literal", detail: `font style ${style}` })
  );
  const underlined = root.read(
    "text-decoration-line",
    (value) => {
      const line = normalizeCss(value);
      return line === "underline" ? true : line === "none" ? false : undefined;
    },
    (drawn) => ({ outcome: "literal", detail: drawn ? "an underline" : "no decoration" })
  );
  let underline: { readonly offset: number | undefined } | undefined;
  if (underlined === true) {
    underline = {
      offset: root.read("text-underline-offset", evaluateNumber, (offset) => ({
        outcome: "literal",
        detail: `an underline offset of ${offset}px`,
      })),
    };
  } else {
    root.mark("text-underline-offset", "dropped", "the cell draws no underline");
  }
  if (fontFamily === undefined || fontSize === undefined || lineHeight === undefined || color === undefined) {
    throw new Error(
      `${variantKey(definition, cell)}: the label needs a font family, size, line height and color`
    );
  }
  return {
    kind: "text",
    key: label.key,
    name: label.name,
    characters: label.characters,
    textProperty: label.textProperty,
    fontFamily,
    fontStyle: weight ?? "Regular",
    fontSize,
    lineHeight,
    color,
    underline,
  };
}
