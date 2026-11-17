/**
 * The component definition the mapping walks, as `capture/manifest.ts` builds it from a set's
 * manifest: its axes, parts, instances, labels and icons, and what a build takes and returns. It also
 * holds the pure utilities over definitions, such as the variant matrix. `component-builder.ts` turns
 * a definition and its capture into a Figma component set.
 */

import type { CellAccounting } from "../capture/capture-cascade.ts";
import type { CoverageRow } from "./coverage";
import type { ModeView, VariableIndex, Viewport } from "./css-values";
import type { AxisSpec, BooleanPropertySpec, ComponentSetSpec, SwapPropertySpec } from "./kit-spec";
import type { CompiledUtilities } from "./utility-css";

/**
 * A preview length: its pixels in the file's default mode, and its CSS length where it changes by
 * mode, which a whole `100%` then binds as that length binds.
 */
export type PreviewLength = { readonly pixels: number; readonly css?: string | undefined };

/** One cell of a variant matrix: a value for each axis. */
export type Cell = Readonly<Record<string, string>>;

/** An icon a part renders in a cell, described as the DOM holds it, so the capture finds it. */
export type IconSlot = {
  readonly key: string;
  readonly name: string;
  /** The side of the label the icon sits on. */
  readonly side: "start" | "end";
  /**
   * Whether the `<svg>` is a child of the part that lists it. The spinner of a pending Button sits in
   * a span, so it is not.
   */
  readonly direct: boolean;
  /** The `data-icon` the icon, or the span around it, carries. */
  readonly dataIcon: "inline-start" | "inline-end" | undefined;
  /** The Fuse icon the layer shows, by its export name, such as `Plus`. */
  readonly icon: string;
  /** The INSTANCE_SWAP property that picks the icon, or undefined for a fixed icon. */
  readonly swapProperty: string | undefined;
  /**
   * The BOOLEAN property that shows or hides the icon, which links the icon layer's `visible` beside
   * its swap link (PI2), or undefined for an icon that shows wherever its cell lists it. A cell lists
   * an optional icon wherever the set can show it, and the markup renders it only while the property
   * is on.
   */
  readonly optional?: BooleanPropertySpec;
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
 * A text layer a part shows, and where its characters come from: one text in every cell, which a
 * TEXT property of the set can set, or a text per cell, which no property sets, since one property
 * holds one default.
 */
export type LabelDefinition = {
  readonly key: string;
  readonly name: string;
  /** Whether a cell shows the label. A Kbd shows it in its text cell and not its icon cell. */
  readonly shownIn: (cell: Cell) => boolean;
  /**
   * The attribute in which the component's markup holds the characters in a cell, as an `<input>`
   * holds its placeholder in `placeholder` and its value in `value`. It returns undefined for a cell
   * whose box holds them as its own text, as a `<textarea>` holds its value, and a label without it
   * holds them as its own text in every cell.
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
 * What the root, or a part below it, renders in a cell: its children. The children sit in DOM order:
 * the parts first, then the start icons, the label and the end icons, and last the parts whose
 * `after` names the label.
 */
export type BoxDefinition = {
  /** The text layer, or undefined for a part that shows no text of its own. */
  readonly label: LabelDefinition | undefined;
  /** The icons a cell renders in this part, in DOM order. A start icon sits before the label. */
  readonly iconsFor: (cell: Cell) => readonly IconSlot[];
  /** The parts directly below this one, in DOM order, each a frame or an instance of another set. */
  readonly parts?: readonly (PartDefinition | InstanceDefinition)[];
  /**
   * The picture the box shows, as an `<img>` shows its `src`: the bytes of a PNG file, the one
   * format the kit ships, which the build reads when it maps the box. Undefined for a box that shows
   * none.
   */
  readonly image?: () => Uint8Array;
  /**
   * The positioned element around the box that is the containing block of the box's absolute parts,
   * where the box's own `position` leaves it static, and that has the box's border box, as Base UI's
   * tooltip positioner holds its popup. The placement of an absolute part reads the box as its
   * containing block there. Undefined for a box whose own `position` decides.
   */
  readonly positionedBy?: string;
};

/**
 * A part below the root, such as a checkbox's indicator. It inherits its parent's text color, font
 * and custom properties as the DOM does.
 */
export type PartDefinition = BoxDefinition & {
  /** The key of the part's frame layer. */
  readonly key: string;
  /**
   * The part's `data-slot`, which names its layer, or undefined for a part without one, as Radio's
   * dot, whose layer takes the part's key as its name.
   */
  readonly slot: string | undefined;
  /** Whether a cell renders the part. Base UI mounts a checkbox's indicator only while checked. */
  readonly shownIn: (cell: Cell) => boolean;
  /**
   * The BOOLEAN property of the set that shows or hides the part in the cells that render it, and
   * the value it starts with, for a part a docs demo leaves out, such as a description. Undefined for
   * a part that shows wherever a cell renders it.
   */
  readonly optional?: BooleanPropertySpec;
  /**
   * `"label"` for a part the markup holds after its box's label and end icons, as a Dropdown menu
   * row's shortcut follows the row's own text, so its layer sits after theirs. Undefined for a part
   * that sits before them, as the box's parts do by default.
   */
  readonly after?: "label";
  /**
   * Where the build finds a part without a `data-slot`: the element-ordinal path from the nearest
   * element above it with a `data-slot`, such as `field/1/0` for the first child of the Field root's
   * second child. Undefined for a part with a `data-slot`.
   */
  readonly place?: string;
};

/**
 * The values a composite gives the inner set's TEXT, BOOLEAN and INSTANCE_SWAP properties, each by
 * the property's name: the characters of the label the property sets, whether the part the property
 * shows is there, and the export name of the icon the property picks, such as `Star`.
 */
export type InstanceProperties = {
  readonly text?: Readonly<Record<string, string>>;
  readonly boolean?: Readonly<Record<string, boolean>>;
  readonly swap?: Readonly<Record<string, string>>;
  /**
   * The TEXT values for the instances inside the inner root, each at the keys of the instance parts
   * from the inner root down, as a Command row gives its Kbd group's caps `Alt` and a letter.
   * Undefined for none.
   */
  readonly nested?: readonly NestedProperties[];
};

/** The TEXT values for one instance inside an instance, at the keys of the instance parts down to it. */
export type NestedProperties = {
  readonly path: readonly string[];
  readonly text: Readonly<Record<string, string>>;
};

/**
 * A part that renders another kit component, as Alert renders a Button for its action. The set draws
 * it as an instance of the inner set's variant, so the composite stays linked to the set that draws
 * the part. The build maps the inner root in place, below the outer parts, and proves the instance
 * draws what that root draws, as `instance-parts.ts` says.
 */
export type InstanceDefinition = {
  readonly kind: "instance";
  /** The key of the instance layer. */
  readonly key: string;
  /** The inner component, whose set the kit builds before the set that holds this part. */
  readonly of: ComponentDefinition;
  /** The inner set's cell the part renders in an outer cell. */
  readonly cell: (outer: Cell) => Cell;
  /**
   * The `data-slot` the outer component stamps on the inner root in place of the inner root's own,
   * as `Popover.Trigger` stamps `popover-trigger` on the Button it renders. The layer keeps the inner
   * root's name. Undefined where the inner root keeps its own slot.
   */
  readonly slot?: string;
  /**
   * The values the outer cell gives the inner set's properties, undefined where every property keeps
   * its default.
   */
  readonly properties?: (outer: Cell) => InstanceProperties;
  /** Whether a cell renders the part. */
  readonly shownIn: (cell: Cell) => boolean;
  /**
   * The BOOLEAN property of the outer set that shows or hides the instance, and the value it starts
   * with, as {@link PartDefinition.optional} says for a frame. Undefined for an instance that shows
   * wherever a cell renders it.
   */
  readonly optional?: BooleanPropertySpec;
  /**
   * `"label"` for an instance the markup holds after its box's label and end icons, as a Command
   * row's Kbd group shortcut follows the row's own text, as {@link PartDefinition.after} says for a
   * frame.
   */
  readonly after?: "label";
  /** True where a designer sets the inner set's properties from the outer instance's panel. */
  readonly exposed?: true;
};

/** A component the builder can turn into a component set. Its own box is the root. */
export type ComponentDefinition = BoxDefinition & {
  readonly key: string;
  readonly name: string;
  /** The root layer's name, and the root element's `data-slot` unless `elementSlot` names another. */
  readonly slot: string;
  /**
   * The `data-slot` the root carries in a cell, as Pagination's edge link carries
   * `pagination-previous` or `pagination-next` by its direction. Undefined for a root its `slot` names.
   */
  readonly elementSlot?: (cell: Cell) => string;
  /**
   * The `data-slot` of the part that takes the set's `state` axis, for a root that a pointer does not
   * hover, a keyboard does not focus and a native `disabled` does not disable, as an Accordion item
   * holds the trigger that does. `figma:compare` forces hover and focus on that part. Undefined for a
   * root that takes its states itself.
   */
  readonly statePart?: string;
  /**
   * The place of the element that takes the set's `state` axis where it carries no `data-slot`, as
   * Number field's `<input>` sits at `field/1/0/0`, by the element-ordinal path a part's `place`
   * names. `figma:compare` and the capture force hover and focus on it.
   */
  readonly statePlace?: string;
  /**
   * The `data-slot` of the sibling before the root whose state the set's `state` axis follows, for a
   * root that reads it through `peer-*` variants, as a Sidebar menu badge reads its menu button's
   * hover through `peer-hover/menu-button:`. `figma:compare` forces hover and focus on that sibling.
   * A definition names it or `statePart`, not both. Undefined for a root that takes its states itself.
   */
  readonly statePeer?: string;
  /**
   * The `data-slot` of the part a keyboard focuses, for a root a pointer hovers that takes focus only
   * through a part inside it, which it reads through `has-focus-visible:`, as File upload's dropzone
   * holds its trigger. `figma:compare` forces a focus cell's focus on that part and a hover cell's
   * hover on the root. Undefined for a root whose focus cells force focus where they force hover.
   */
  readonly focusPart?: string;
  /**
   * The width in pixels the root's container gives it, which a root's percentage width takes and a
   * block-level root with no width fills, as the Figma preview and the compare host draw it. A
   * variant root sits in its component set, which has no auto layout, so the width is fixed. Without
   * it, a root's percentage stays unmapped and its unset width hugs.
   */
  readonly previewWidth?: number;
  /**
   * The width each cell's container gives the root, for a set whose cells differ, as the capture
   * measured it around the root. A definition names it or {@link ComponentDefinition.previewWidth},
   * not both.
   */
  readonly previewWidthFor?: (cell: Cell) => number | undefined;
  /**
   * The height in pixels the root's containing block gives it, which a root's percentage height
   * takes, as the Sidebar demo frame's `h-[28rem]` gives the container's `h-full`. Without it, the
   * root's percentage height takes the content height the elements around it set, or stays unmapped.
   * The compare renderer draws the same block around it.
   */
  readonly previewHeight?: PreviewLength;
  /**
   * The viewport a `position: fixed` root sits in, in pixels, as a Dialog's popup, a Command palette
   * and an overlay's scrim sit in the browser window. A fixed box's containing block is the viewport
   * (CSS 2.1 §10.1), so the root's percentages take it, its `dvh` and `dvw` read against it (CSS
   * Values 4 §6.1.2), and `inset-0` with no size of its own makes it the viewport's size (CSS 2.1
   * §10.3.7, §10.6.4). The compare renderer draws the same viewport around the root. Undefined for a
   * root that sits in none, whose fixed lengths that read one stay unmapped.
   */
  readonly viewport?: Viewport;
  /**
   * `visible` for a root whose layers reach past it, as an anchored composite's popup casts its
   * shadow beside the column that holds it, so the root leaves them unclipped. Undefined for every
   * other root, whose clipping its capture decides. The build stops on a root that is `visible` and
   * casts a shadow.
   */
  readonly rootOverflow?: "visible";
  readonly axes: readonly AxisSpec[];
  /**
   * The axes added to the set after a file first held it, as Select trigger gained `width`. Each
   * leaves its first value out of the variant key, so the variants the set held before keep their
   * keys and the plugin renames them in place to name the new axis. A real file kept each renamed
   * variant's id and a designer's instance of it linked, reading the new axis at its first value
   * (W5-P2), where a new key would delete the variant and orphan those instances. The variant name
   * still lists every axis. Undefined for a set whose axes it has held from the start.
   */
  readonly addedAxes?: ReadonlySet<string>;
  readonly columnAxis: string;
  /** The INSTANCE_SWAP properties, each with the export name of the icon it starts with. */
  readonly swapProperties: readonly SwapPropertySpec[];
};

/** What the builder needs besides the component. */
export type BuildContext = {
  readonly compiled: CompiledUtilities;
  readonly variables: VariableIndex;
  /**
   * Each mode of the synced collections, with the variables as it resolves them, which the build
   * measures a layer's geometry in where the bounds across all modes cannot tell. Undefined for none.
   */
  readonly modes?: readonly ModeView[];
};

/** A component set and the coverage of the captured declarations it read. */
export type BuiltComponent = {
  readonly componentSet: Omit<ComponentSetSpec, "page">;
  readonly coverage: readonly CoverageRow[];
  /** Each font style the text layers use. */
  readonly fontStyles: readonly string[];
  /** What each cell's cascade put into its layers, by the cell's key, which the coverage oracle reads. */
  readonly accounting: ReadonlyMap<string, CellAccounting>;
};

/**
 * The width a cell's container gives the root, as {@link ComponentDefinition.previewWidthFor} or
 * {@link ComponentDefinition.previewWidth} says.
 *
 * @param definition - The component.
 * @param cell - The cell.
 * @returns The width in pixels, or undefined where the container gives the root none.
 */
export function previewWidthIn(
  definition: Pick<ComponentDefinition, "previewWidth" | "previewWidthFor">,
  cell: Cell
): number | undefined {
  return definition.previewWidthFor === undefined
    ? definition.previewWidth
    : definition.previewWidthFor(cell);
}

/**
 * The key of one variant, such as `button/variant=default,size=sm,state=rest,icon=none`. An axis the
 * definition added later is left out at its first value, as `addedAxes` says.
 *
 * @param definition - The component.
 * @param cell - The cell.
 * @returns The key.
 */
export function variantKey(
  definition: Pick<ComponentDefinition, "key" | "axes" | "addedAxes">,
  cell: Cell
): string {
  const keyed = definition.axes.filter(
    (axis) => definition.addedAxes?.has(axis.name) !== true || cell[axis.name] !== axis.values[0]
  );
  return `${definition.key}/${keyed.map((axis) => `${axis.name}=${cell[axis.name] ?? ""}`).join(",")}`;
}

/** Every cell of the matrix, the first axis varying slowest. */
export function matrixCells(axes: readonly AxisSpec[]): readonly Cell[] {
  return axes.reduce<Cell[]>(
    (cells, axis) => cells.flatMap((cell) => axis.values.map((value) => ({ ...cell, [axis.name]: value }))),
    [{}]
  );
}
