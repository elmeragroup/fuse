/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and maps it
 * onto Figma fields. Every declaration it reads lands in the coverage table with what became
 * of it.
 */
import { describeColor, readPaint } from "./box-paint";
import { absoluteRoom, outOfFlow, readSizing, roomInside, rootRoom, unstretched } from "./box-sizing";
import type { Holder, Room } from "./box-sizing";
import { SetCascade, splitClasses } from "./cascade";
import type { BoxCascade, LayerStyle } from "./cascade";
import type { CoverageRow } from "./coverage";
import {
  describeNumber,
  evaluateNumber,
  isInfiniteLength,
  normalizeCss,
  readColor,
  readNumber,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { fixedLength, walkLayers, ZERO } from "./kit-spec";
import type {
  AxisSpec,
  BooleanPropertySpec,
  BoxSpec,
  ChildLayerSpec,
  ColorSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  CounterAlignSpec,
  DirectionSpec,
  FrameLayerSpec,
  NumberSpec,
  IconLayerSpec,
  PrimaryAlignSpec,
  SizingSpec,
  SwapPropertySpec,
  TextPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { mapLabel, readLineClamp, readWithoutLabel, spaceBeforeLabel } from "./label-layout";
import { booleanPropertiesOf, refusePresenceReads } from "./optional-parts";
import type { OptionalPart } from "./optional-parts";
import { partsThatScale, placeParts, placeRoot, readRotation, slotAroundDot } from "./placement";
import type { Layout } from "./placement";
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
  /**
   * The classes the `<svg>` carries itself, such as Loader's `animate-spin size-4`. They cascade
   * with the child selectors that reach the icon, each by its specificity, over what the icon
   * inherits. An icon without them takes its style from its boxes alone.
   */
  readonly classes?: string;
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
 * The variants Base UI stamps on a checked control's root, for a definition's `facts`:
 * `data-checked` and `aria-checked="true"` while it is on, and `data-unchecked` while it is off.
 * A control with a third value adds its own, as Checkbox adds `data-indeterminate`.
 */
export const BASE_UI_CHECKED_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  ["data-checked", (cell: Cell) => cell.checked === "on"],
  ["data-unchecked", (cell: Cell) => cell.checked === "off"],
  ["aria-checked", (cell: Cell) => cell.checked === "on"],
]);

/**
 * What a set's root element is, which decides the attributes its disabled state holds.
 *
 * - `native-control`: a native `<button>`, disabled through its `disabled` attribute.
 * - `base-ui-span`: a Base UI `<span>`, such as a radio, which Base UI disables with
 *   `aria-disabled` and keeps focusable.
 * - `base-ui-field-label`: Base UI's `Field.Label` `<label>`, which takes its Field's state as
 *   data attributes, so a disabled Field marks it `data-disabled` alone.
 */
export type RootKind = "native-control" | "base-ui-span" | "base-ui-field-label";

/**
 * Where a native control sets its text within the text's box, which no class says, as an `<input>`
 * centers its value down its box and a `<textarea>` starts its text at the top.
 */
export type TextPlacement = {
  readonly horizontal: "start" | "center" | "end";
  readonly vertical: "top" | "center" | "bottom";
  /**
   * How the control sets its text in lines, which it does itself whatever the box's `display` says.
   * `single` keeps the text on one line across the content box, as an `<input>` sets its value,
   * whatever `white-space` says, so the label fills the box's width and ends in an ellipsis after one
   * line. `wrap` wraps the text at the content box's width, as a `<textarea>` wraps its value, so the
   * label fills the width with its height following its lines. Undefined leaves the lines to the
   * box's CSS.
   */
  readonly lines?: "single" | "wrap";
};

/**
 * A text layer a part shows, and where its characters come from: one text in every cell, which a
 * TEXT property of the set can set, or a text per cell, which no property sets, since one property
 * holds one default.
 */
export type LabelDefinition = {
  readonly key: string;
  readonly name: string;
  /** Whether a cell shows the label. A Kbd shows it in its text cell and not its icon cell. */
  readonly shownIn: (cell: Cell) => boolean;
  /** Where the text sits in its box, or undefined for the top left, where CSS sets a box's text. */
  readonly placement?: TextPlacement;
  /**
   * The attribute in which the component's markup holds the characters in a cell, as an `<input>`
   * holds its placeholder in `placeholder` and its value in `value`. It returns undefined for a cell
   * whose box holds them as its own text, as a `<textarea>` holds its value, and a label without it
   * holds them as its own text in every cell. `figma:compare`'s markup check reads the text there.
   */
  readonly textAttribute?: (cell: Cell) => string | undefined;
  /**
   * Set where the markup holds a space before the characters, as Meter's value holds one after its
   * icon. A box that sets its text in lines draws it as one space advance after a start icon, and
   * collapses it at the start of a line.
   */
  readonly leadingSpace?: true;
} & (
  | {
      /** The text every cell shows, and the default of its property. */
      readonly characters: string;
      /** The set's TEXT property that sets the characters, or undefined for none. */
      readonly textProperty: string | undefined;
      readonly charactersFor?: never;
    }
  | {
      /** The text a cell shows. */
      readonly charactersFor: (cell: Cell) => string;
      readonly characters?: never;
      readonly textProperty?: never;
    }
);

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
  /**
   * The picture the box shows, as an `<img>` shows its `src`: the bytes of a PNG file, the one
   * format the kit ships, which the build reads when it maps the box. Undefined for a box that shows
   * none.
   */
  readonly image?: () => Uint8Array;
};

/**
 * An element that carries no `data-slot`, named by its tag and the attributes it carries, as React
 * Aria's Link renders an `<a data-rac>`. `figma:compare` measures a root by its CSS form, such as
 * `a[data-rac]`, and its markup check places a root or a part by it.
 */
export type ElementSelector = {
  /** The element's tag name in lowercase, such as `a`. */
  readonly tag: string;
  /**
   * The attributes the element carries, each name in lowercase. A string matches that exact value,
   * and `true` matches the attribute with any value, as `[data-rac]` does.
   */
  readonly attributes: Readonly<Record<string, string | true>>;
};

/** One declaration of an element's `style` attribute, such as Base UI's `width: 85%` on a meter's fill. */
export type InlineDeclaration = {
  readonly property: string;
  readonly value: string;
};

/**
 * A part below the root, such as a checkbox's indicator. It cascades its own classes, and
 * inherits its parent's text color, font and custom properties as the DOM does.
 */
export type PartDefinition = BoxDefinition & {
  /** The key of the part's frame layer. */
  readonly key: string;
  /** Whether a cell renders the part. Base UI mounts a checkbox's indicator only while checked. */
  readonly shownIn: (cell: Cell) => boolean;
  /**
   * The BOOLEAN property of the set that shows or hides the part in the cells that render it, and
   * the value it starts with, for a part a docs demo leaves out, such as a description. Undefined for
   * a part that shows wherever a cell renders it. A part whose presence a selector reads, as
   * `item-described:` reads Item's description, cannot be optional, and the build stops on one.
   */
  readonly optional?: BooleanPropertySpec;
  /**
   * The declarations of the part's `style` attribute in a cell, in the attribute's order, which
   * cascade above every class, as a style attribute beats every rule of a style sheet. Undefined for
   * a part whose markup carries no `style`.
   */
  readonly styleFor?: (cell: Cell) => readonly InlineDeclaration[];
} & (
    | {
        /** The part's `data-slot`, which names its layer. */
        readonly slot: string;
        /** A part its `data-slot` names needs no selector. */
        readonly element?: never;
      }
    | {
        /** No `data-slot`, as on Radio's dot, so the layer takes the part's key as its name. */
        readonly slot: undefined;
        /**
         * The part's element, which `figma:compare`'s markup check finds below its parent part by
         * this selector. Undefined for a part the check finds by its place, as the one child element
         * of its parent beside the parts with a `data-slot`.
         */
        readonly element?: ElementSelector;
      }
  );

/** A component the builder can turn into a component set. Its own box is the root. */
export type ComponentDefinition = BoxDefinition & {
  readonly key: string;
  readonly name: string;
  /** The root layer's name, and the root element's `data-slot` unless `element` names the element. */
  readonly slot: string;
  /**
   * The root element, for a root whose markup carries no `data-slot`, as React Aria's Link renders
   * an `<a>` with none. `figma:compare` measures the one element of a cell this selector matches, and
   * its markup check places the root there. Undefined for a root its `data-slot` names.
   */
  readonly element?: ElementSelector;
  /**
   * What the root element is. A set whose `state` axis has `disabled` names it, and
   * `state-table.ts` refuses one that does not.
   */
  readonly rootKind?: RootKind;
  /**
   * The width in pixels the root's container gives it, which a root's percentage width takes and a
   * block-level root with no width fills, as the Figma preview and the compare host draw it. A
   * variant root sits in its component set, which has no auto layout, so the width is fixed. Without
   * it, a root's percentage stays unmapped and its unset width hugs.
   */
  readonly previewWidth?: number;
  /**
   * The declarations an element between the page and the root sets in a cell, which the root
   * inherits over the page's, such as the text color an invalid Field root passes to its input.
   * Undefined for a root that sits on the page itself.
   */
  readonly inheritedFor?: (cell: Cell) => readonly OuterDeclaration[];
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
  /**
   * The variants that style the component inside a composition the kit does not draw, or style
   * a child it holds there, such as a label's `has-[>[data-slot=checkbox]]:` around a checkbox,
   * each with the reason a designer reads in the coverage table. A class with one of them lands
   * there as dropped.
   */
  readonly omittedCompositions?: ReadonlyMap<string, string>;
  /**
   * The media variants that style the component under a condition of the user's device the kit does
   * not draw, such as `forced-colors:`, each with the reason a designer reads in the coverage table.
   * A class with one of them lands there as dropped.
   */
  readonly omittedMedia?: ReadonlyMap<string, string>;
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
  const optional = optionalParts(definition);
  const booleans = booleanPropertiesOf(definition.name, optional);
  if (optional.length > 0) {
    refusePresenceReads(
      definition.name,
      optional,
      new Set(definitionClasses(definition)),
      context.compiled.rulesByClass
    );
  }
  const cascade = new SetCascade(makeStateTable(definition), context, record);
  const cells = matrixCells(definition.axes);
  const scaling = partsThatScale(partsOf(definition), cells, context.compiled);
  const variants = cells.map((cell): VariantSpec => {
    const cellCascade = cascade.cell(cell);
    const scope: MapScope = { definition, cell, context, scaling };
    const rootCascade = cellCascade.root(
      definition.classesFor(cell),
      definition.slot,
      definition.inheritedFor?.(cell) ?? []
    );
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding.
    const root: ComponentRootSpec = {
      name: definition.slot,
      ...mapBox(definition, rootCascade, scope, rootRoom(definition.previewWidth, rootCascade.style)),
      clips: true,
    };
    placeRoot(rootCascade.style);
    cellCascade.settle();
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        fontStyles.add(layer.fontStyle);
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  cascade.finish();
  const componentSet: BuiltComponent["componentSet"] = {
    key: definition.key,
    name: definition.name,
    axes: definition.axes,
    columnAxis: definition.columnAxis,
    textProperties: textProperties(definition),
    swapProperties: definition.swapProperties.map((property) => ({
      name: property.name,
      defaultIcon: iconKey(property.defaultIcon),
    })),
    variants,
  };
  return {
    // A set without an optional part leaves the field out, so a set built before it keeps its spec.
    componentSet: booleans.length === 0 ? componentSet : { ...componentSet, booleanProperties: booleans },
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
 * Every class the root, its parts and their icons use in any cell of the matrix, which the build
 * compiles.
 *
 * @param definition - The component.
 * @returns The classes, in the order the boxes first use them, each box's before its icons'.
 */
export function definitionClasses(definition: ComponentDefinition): readonly string[] {
  return matrixCells(definition.axes).flatMap((cell) =>
    boxesOf(definition).flatMap((box) => [
      ...splitClasses(box.classesFor(cell)),
      ...box.iconsFor(cell).flatMap((slot) => splitClasses(slot.classes ?? "")),
    ])
  );
}

/**
 * The TEXT properties a set's labels name, each once, in the order the boxes first name them. One
 * property holds one default, so two labels that name it must start with the same characters.
 *
 * @throws When two labels name one property with different characters, naming both labels.
 */
function textProperties(definition: ComponentDefinition): readonly TextPropertySpec[] {
  const named = new Map<string, { readonly defaultValue: string; readonly label: string }>();
  for (const { box, label } of labelsOf(definition, definition.slot)) {
    if (label.textProperty === undefined) {
      continue;
    }
    const where = `${box} / ${label.name}`;
    const first = named.get(label.textProperty);
    if (first === undefined) {
      named.set(label.textProperty, { defaultValue: label.characters, label: where });
    } else if (first.defaultValue !== label.characters) {
      throw new Error(
        `${definition.name}: the labels ${first.label} and ${where} both set the ${label.textProperty} property, one starting as "${first.defaultValue}" and one as "${label.characters}". A TEXT property holds one default, so give them one text or a property each.`
      );
    }
  }
  return [...named].map(([name, { defaultValue }]) => ({ name, defaultValue }));
}

/**
 * The optional parts, depth first, each with every `data-slot` that hiding it hides: its own and
 * those of the parts inside it, a slotless part's included.
 */
function optionalParts(definition: ComponentDefinition): readonly OptionalPart[] {
  return partsOf(definition).flatMap((part) =>
    part.optional === undefined
      ? []
      : [
          {
            name: partName(part),
            property: part.optional,
            slots: [part, ...partsOf(part)].flatMap(({ slot }) => (slot === undefined ? [] : [slot])),
          },
        ]
  );
}

/** The label of a box and of every part below it, depth first, with the layer name of its box. */
function labelsOf(
  box: BoxDefinition,
  name: string
): readonly { readonly box: string; readonly label: LabelDefinition }[] {
  return [
    ...(box.label === undefined ? [] : [{ box: name, label: box.label }]),
    ...(box.parts ?? []).flatMap((part) => labelsOf(part, partName(part))),
  ];
}

/** Every part below a box, depth first. */
function partsOf(box: BoxDefinition): readonly PartDefinition[] {
  return (box.parts ?? []).flatMap((part) => [part, ...partsOf(part)]);
}

/** The box and every part below it, depth first. */
function boxesOf(box: BoxDefinition): readonly BoxDefinition[] {
  return [box, ...partsOf(box)];
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
 * other, and one with layers stays unmapped. A `-webkit-box` maps only where it clamps its label,
 * as {@link readLineClamp} decides for the label too, as a column around the label.
 *
 * @param layers - How many layers the box holds in the cell.
 * @param layout - The box's layout, as {@link readFlow} read it.
 * @param clamp - The lines the box clamps its label to, or undefined for none.
 */
function readDisplay(reader: LayerStyle, layers: number, layout: Layout, clamp: number | undefined): void {
  const display = normalizeCss(reader.raw("display") ?? "");
  if (display === "-webkit-box") {
    for (const property of ["display", "-webkit-box-orient"]) {
      reader.read(
        property,
        (value) => (clamp === undefined ? undefined : value),
        () => ({ outcome: "literal", detail: "a column around its clamped label" })
      );
    }
    return;
  }
  if (display === "grid") {
    const center = literalLayout(["center"], "centered on both axes");
    const centered = layers === 1 && reader.read("place-content", center.map, center.describe) !== undefined;
    reader.read(
      "display",
      (value) => (centered ? value : undefined),
      () => ({ outcome: "literal", detail: "an auto layout around its one layer" })
    );
    return;
  }
  const flow =
    layers === 0 && display === "block"
      ? literalLayout(["block"], "a frame with no layers to lay out")
      : literalLayout(
          ["inline-flex", "flex"],
          layout.direction === "VERTICAL" ? "a vertical auto layout" : "a horizontal auto layout"
        );
  reader.read("display", flow.map, flow.describe);
}

/** What the mapping of every layer of one cell reads besides the layer's own style. */
type MapScope = {
  readonly definition: ComponentDefinition;
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
 * @param room - What the box's parent gives it on each axis.
 * @returns The box, without the root's name or a frame's key.
 */
function mapBox(box: BoxDefinition, cascade: BoxCascade, scope: MapScope, room: Room): BoxSpec {
  const { definition, cell, context } = scope;
  const reader = cascade.style;
  const number = (property: string): NumberSpec | undefined =>
    reader.read(property, (value) => readNumber(value, context.variables), describeNumber);
  const color = (property: string): ColorSpec | undefined =>
    reader.read(property, (value) => readColor(value, context.variables), describeColor);

  const boxSizing = literalLayout(["border-box"], "strokes count in the auto layout");
  reader.read("box-sizing", boxSizing.map, boxSizing.describe);

  const paint = readPaint(reader, box.image, context.variables, variantKey(definition, cell));
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
        cascade: cascade.part(child.classesFor(cell), name, child.styleFor?.(cell) ?? []),
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
  };
  const parts = shown.map((part) => {
    const index = flowing.indexOf(part);
    const room = index === -1 ? absoluteRoom(holder) : roomInside(holder, index);
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
    const layer = rotation === undefined ? linked : { ...linked, rotation };
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
          variant: variantKey(definition, cell),
        });
  if (placed === undefined) {
    readWithoutLabel(reader);
  }
  const space =
    label === undefined || placed === undefined
      ? undefined
      : spaceBeforeLabel(holder, label, placed.layer, start.length, variantKey(definition, cell));
  const after: readonly ChildLayerSpec[] = [
    ...start,
    ...(placed === undefined ? [] : [placed.layer]),
    ...end,
  ];
  // The display reads once the layers are known, since a grid maps only around one item.
  readDisplay(reader, holder.layers.length, layout, clamp);
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
    counterAlign: placed?.counterAlign ?? layout.counterAlign,
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
  { definition, cell, context }: MapScope
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
    throw new Error(`${variantKey(definition, cell)}: the ${slot.name} needs a square size and a text color`);
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
