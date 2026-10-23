/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and
 * `box-mapping.ts` maps it onto Figma fields. Every declaration it reads lands in the coverage
 * table with what became of it. This module holds the definition types and assembles the set.
 */
import { mapBox, partName } from "./box-mapping";
import type { MapScope } from "./box-mapping";
import { rootRoom } from "./box-sizing";
import { SetCascade, splitClasses } from "./cascade";
import type { CoverageRow } from "./coverage";
import type { VariableIndex } from "./css-values";
import { iconKey, walkLayers } from "./kit-spec";
import type {
  AxisSpec,
  BooleanPropertySpec,
  ComponentRootSpec,
  ComponentSetSpec,
  SwapPropertySpec,
  TextPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { booleanPropertiesOf, refusePresenceReads } from "./optional-parts";
import type { OptionalPart } from "./optional-parts";
import { partsThatScale, placeRoot } from "./placement";
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
 * What the element that takes a set's states is, the root or the part its `statePart` names, which
 * decides the attributes its disabled state holds.
 *
 * - `native-control`: a native `<button>`, disabled through its `disabled` attribute.
 * - `base-ui-span`: a Base UI `<span>`, such as a radio, which Base UI disables with
 *   `aria-disabled` and keeps focusable.
 * - `base-ui-field-part`: Base UI's `Field.Label` `<label>`, `Field.Description` `<p>` or
 *   `Field.Error` `<div>`, which take their Field's state as data attributes, so a disabled Field
 *   marks them `data-disabled` alone and an invalid one `data-invalid` alone.
 * - `plain-element`: an element nothing stamps a state on, such as Field's title `<div>`, which
 *   shows a disabled Field only through the `group-data-disabled/field:` its definition names.
 * - `react-aria-element`: a React Aria Components element marked `data-rac`, such as a Calendar day
 *   cell `<div>`, which React Aria marks `aria-disabled="true"` and `data-disabled` while disabled,
 *   and `aria-invalid="true"` and `data-invalid` while invalid, which `invalid:` reads there.
 */
export type RootKind =
  | "native-control"
  | "base-ui-span"
  | "base-ui-field-part"
  | "plain-element"
  | "react-aria-element";

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
   * The child element in which the component's markup holds the characters as its own text, for a
   * box that wraps them in an element with no `class` or `style`, as Pagination's edge link wraps
   * its copy in a bare `<span>`. A flex row lays such an element out as it would the text alone, so
   * the kit draws the characters as the box's own text layer, between the icons on either side.
   * `figma:compare`'s markup check reads the text there, and fails an element that carries a `class`
   * or `style`. Undefined for a label the box holds as its own text or in `textAttribute`.
   */
  readonly textElement?: ElementSelector;
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
  /**
   * The declarations the browser's default style sheet gives the box's element, which no class
   * sets, such as `display: block` on a `<p>` or a `<div>`. They apply on the box below the base
   * layer and every class, as the user agent's origin does, so a class's own `display` beats them.
   * Undefined for a box whose classes set what the kit reads, or whose element is inline, as a
   * `<span>` or an `<a>` is.
   */
  readonly elementDefaults?: readonly OuterDeclaration[];
};

/**
 * An element that carries no `data-slot`, named by its tag and the attributes it carries, as React
 * Aria's Calendar renders a day as a `<div data-rac role="button">`. `figma:compare` measures a root
 * by its CSS form, such as `div[data-rac][role="button"]`, and its markup check places a root or a
 * part by it.
 */
export type ElementSelector = {
  /**
   * The element's tag name in lowercase, such as `div`, or `*` for any tag, as CSS's universal
   * selector matches, for a root whose tag changes with the cell, as React Aria's Link renders an
   * `<a>` while enabled and a `<span role="link">` while disabled.
   */
  readonly tag: string;
  /**
   * The attributes the element carries, each name in lowercase. A string matches that exact value,
   * and `true` matches the attribute with any value, as `[data-rac]` does.
   */
  readonly attributes: Readonly<Record<string, string | true>>;
  /**
   * The attributes whose values start with a prefix, each name in lowercase, as
   * `[aria-label^="Tuesday, July 14, 2026"]` matches a day React Aria labels ` selected` while it is
   * the value. An empty prefix matches nothing, as in CSS. Undefined for an element the attributes
   * alone name.
   */
  readonly prefixes?: Readonly<Record<string, string>>;
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
   * an `<a>` or a `<span>` with none, or one whose `data-slot` changes with the cell, as Pagination's
   * edge link carries `pagination-previous` or `pagination-next`. `figma:compare` measures the one
   * element of a cell this selector matches, and its markup check places the root there. Undefined
   * for a root its `data-slot` names.
   */
  readonly element?: ElementSelector;
  /**
   * What the element that takes the set's states is: the root, or the part `statePart` names. A set
   * whose `state` axis has `disabled` names it, and `state-table.ts` refuses one that does not.
   */
  readonly rootKind?: RootKind;
  /**
   * The `data-slot` of the part that takes the set's `state` axis, for a root that a pointer does not
   * hover, a keyboard does not focus and a native `disabled` does not disable, as an Accordion item
   * holds the trigger that does. `figma:compare` forces hover and focus on that part, and its markup
   * check reads the state's attributes there. Undefined for a root that takes its states itself.
   */
  readonly statePart?: string;
  /**
   * The `data-slot` of the sibling before the root whose state the set's `state` axis follows, for a
   * root that reads it through `peer-*` variants, as a Sidebar menu badge reads its menu button's
   * hover through `peer-hover/menu-button:`. `figma:compare` forces hover and focus on that sibling.
   * A definition names it or `statePart`, not both. Undefined for a root that takes its states itself.
   */
  readonly statePeer?: string;
  /**
   * The width in pixels the root's container gives it, which a root's percentage width takes and a
   * block-level root with no width fills, as the Figma preview and the compare host draw it. A
   * variant root sits in its component set, which has no auto layout, so the width is fixed. Without
   * it, a root's percentage stays unmapped and its unset width hugs.
   */
  readonly previewWidth?: number;
  /**
   * The declarations the host sets around the root in a cell with no class to name them, which the
   * root inherits over the page's, such as the type a Pagination link takes from the browser's
   * medium font size and preflight on `<html>`, since its classes set none. Undefined for a root
   * that inherits nothing more from the host. An element a Fuse recipe styles is named in
   * `ancestorsFor` instead.
   */
  readonly inheritedFor?: (cell: Cell) => readonly OuterDeclaration[];
  /**
   * The elements between the page and the root in a cell, outermost first, each named by the
   * recipe classes it carries, as a Breadcrumb link sits in `Breadcrumb.List` and `Breadcrumb.Item`.
   * Each cascades its classes with the cell's states and facts, and the root inherits their
   * computed values, as an invalid Field root passes its `data-invalid:text-error` to its input.
   * Undefined, or none in a cell, for a root with no such element around it.
   */
  readonly ancestorsFor?: (cell: Cell) => readonly AncestorDefinition[];
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
 * An element between the page and the root, named by its recipe classes. The kit draws no layer
 * for it. Its classes cascade in each cell as the root's do, and the root inherits its computed
 * values, so it takes the element's type and text color. Its own declarations that do not inherit,
 * such as a list's flex row, reach no drawn layer.
 */
export type AncestorDefinition = {
  /** The element's `data-slot`, which names it in the coverage table, such as `breadcrumb-list`. */
  readonly slot: string;
  /** The classes the element carries, as its recipe gives them. */
  readonly classes: string;
  /**
   * Why the kit draws none of the element's own declarations that do not inherit, which the
   * coverage table gives for each of them, such as `the list lays out and wraps the trail, which the
   * set does not draw`.
   */
  readonly undrawn: string;
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
    const scope: MapScope = { variant: variantKey(definition, cell), cell, context, scaling };
    const rootCascade = cellCascade.root(definition.classesFor(cell), definition.slot, {
      declarations: definition.inheritedFor?.(cell) ?? [],
      ancestors: definition.ancestorsFor?.(cell) ?? [],
      defaults: definition.elementDefaults ?? [],
    });
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding.
    const room = rootRoom(definition.previewWidth, rootCascade.style);
    const root: ComponentRootSpec = {
      name: definition.slot,
      ...mapBox(definition, rootCascade, scope, room),
      clips: true,
    };
    placeRoot(rootCascade.style, room);
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
 * Every class the elements around the root, the root, its parts and their icons use in any cell of
 * the matrix, which the build compiles.
 *
 * @param definition - The component.
 * @returns The classes, in the order the elements first use them, the ancestors' before the boxes',
 *   and each box's before its icons'.
 */
export function definitionClasses(definition: ComponentDefinition): readonly string[] {
  return matrixCells(definition.axes).flatMap((cell) => [
    ...(definition.ancestorsFor?.(cell) ?? []).flatMap((ancestor) => splitClasses(ancestor.classes)),
    ...boxesOf(definition).flatMap((box) => [
      ...splitClasses(box.classesFor(cell)),
      ...box.iconsFor(cell).flatMap((slot) => splitClasses(slot.classes ?? "")),
    ]),
  ]);
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

/** Every cell of the matrix, the first axis varying slowest. */
export function matrixCells(axes: readonly AxisSpec[]): readonly Cell[] {
  return axes.reduce<Cell[]>(
    (cells, axis) => cells.flatMap((cell) => axis.values.map((value) => ({ ...cell, [axis.name]: value }))),
    [{}]
  );
}
