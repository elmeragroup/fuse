/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and
 * `box-mapping.ts` maps it onto Figma fields. Every declaration it reads lands in the coverage
 * table with what became of it. This module holds the definition types and assembles the set.
 */

import { mapBox, NO_VALUES, partName } from "./box-mapping";
import type { MapScope } from "./box-mapping";
import { readBackdrop } from "./box-paint";
import { rootRoom } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import { SetCascade, splitClasses } from "./cascade";
import type { LayerStyle } from "./cascade";
import { clippedShadows } from "./clipped-shadows";
import type { ClippedShadow } from "./clipped-shadows";
import type { CoverageRow } from "./coverage";
import { normalizeCss } from "./css-values";
import type { ModeView, VariableIndex } from "./css-values";
import { allPartsOf, framePartsOf, instancePartsOf, partsOf, renderedSlots } from "./definition-parts";
import { checkInstanceOrder, InstanceParts } from "./instance-parts";
import type { InnerSet } from "./instance-parts";
import { iconKey, walkLayers } from "./kit-spec";
import type {
  AxisSpec,
  BooleanPropertySpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  ShadowSpec,
  SwapPropertySpec,
  TextPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { booleanPropertiesOf, refusePresenceReads } from "./optional-parts";
import type { OptionalPart } from "./optional-parts";
import { partsThatScale, placeRoot } from "./placement";
import { PaintedInstances } from "./stacking";
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
  /**
   * The BOOLEAN property that shows or hides the icon, which links the icon layer's `visible` beside
   * its swap link (PI2), or undefined for an icon that shows wherever its cell lists it. A cell lists
   * an optional icon wherever the set can show it, and the markup renders it only while the property
   * is on. A class that reads whether the icon is there, through an `svg` inside `:has()`, stops the
   * build, as it does for an optional part.
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
 * children sit in DOM order: the parts first, then the start icons, the label and the end icons, and
 * last the parts whose `after` names the label.
 */
export type BoxDefinition = {
  /** The recipe's class string for one cell. */
  readonly classesFor: (cell: Cell) => string;
  /** The text layer, or undefined for a part that shows no text of its own. */
  readonly label: LabelDefinition | undefined;
  /** The icons a cell renders in this part, in DOM order. A start icon sits before the label. */
  readonly iconsFor: (cell: Cell) => readonly IconSlot[];
  /** The parts directly below this one, in DOM order, each a frame or an instance of another set. */
  readonly parts?: readonly (PartDefinition | InstanceDefinition)[];
  /**
   * How many element children the box's markup holds in a cell beside the parts, the icons and the
   * element of its label the definition draws, such as the visually hidden `<span>` that holds an
   * ellipsis's copy, so the build knows every element child the box holds. A class that styles every
   * child but the last, as `space-y-4` does, reads that count, and stays unmapped on a box whose
   * definition leaves this unset. `figma:compare`'s markup check holds the count to the markup.
   */
  readonly undrawnChildren?: (cell: Cell) => number;
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
  /**
   * Why a wrapping row lays its layers out on one line in every cell, for a row whose `flex-wrap:
   * wrap` no rule reads, since what fits depends on its text: a measurement, as Chromium measured
   * Radio group's three horizontal rows end at 201px dense and 217px comfortable in its 384px.
   * Figma's row never wraps, so the row draws as one line, and `figma:compare` shows a cell where
   * the measurement no longer holds. Undefined for a row whose wrapping a rule reads or that leaves it
   * unmapped.
   */
  readonly fitsOneLine?: string;
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
  /**
   * The attributes whose values end with a suffix, each name in lowercase, as `[data-slot$="-label"]`
   * matches the group label of Select and of Dropdown menu, which name their slots by family. An empty
   * suffix matches nothing, as in CSS. Undefined for an element the other fields name.
   */
  readonly suffixes?: Readonly<Record<string, string>>;
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
  /**
   * `"label"` for a part the markup holds after its box's label and end icons, as a Dropdown menu
   * row's shortcut follows the row's own text, so its layer sits after theirs. Undefined for a part
   * that sits before them, as the box's parts do by default.
   */
  readonly after?: "label";
  /**
   * Whether the part is the row that sets the width of a popup that hugs its rows, in a cell, as
   * `hugging-rows.ts` says: it hugs across, and its siblings fill. Undefined for a part that never is.
   */
  readonly setsWidth?: (cell: Cell) => boolean;
  /**
   * The variants only the part's own element carries, and whether each holds in a cell, as Base UI
   * stamps `data-orientation` on `Sidebar.Separator` inside a panel whose root carries none. The part's
   * classes cascade with them over the set's table. A part with facts holds no parts, since their
   * elements carry none of them, and a fact cannot give a variant the set's table already gives a
   * meaning; the build stops on either. Undefined for a part that carries only the set's facts.
   */
  readonly facts?: ReadonlyMap<string, (cell: Cell) => boolean>;
} & (
    | {
        /** The part's `data-slot`, which names its layer. */
        readonly slot: string;
        /** A part its `data-slot` names needs no selector. */
        readonly element?: never;
        /**
         * The part's element's tag, such as `input`, which a direct-child selector such as
         * `[&>input]:` reaches it by. Undefined where no class reaches the part by its tag.
         */
        readonly tag?: string;
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
   * The element the outer component renders the inner root as, where it differs from the one the
   * inner set's `element` names, as Number field's decrease stepper is the `<button
   * aria-label="Decrease">` where the stepper set names its increase stepper. `figma:compare`'s markup
   * check places the instance there. Undefined where the inner set's own element names it.
   */
  readonly element?: ElementSelector;
  /**
   * The classes the outer component passes the inner one as its `className`, which the inner
   * component merges after its own with `cn`, as Alert passes its tone's `button` slot. Undefined for
   * none.
   */
  readonly classesFor?: (outer: Cell) => string;
  /**
   * The values the outer cell gives the inner set's properties, undefined where every property keeps
   * its default.
   */
  readonly properties?: (outer: Cell) => InstanceProperties;
  /**
   * The classes the outer component gives the icon each INSTANCE_SWAP property places, by the
   * property's name, as Combobox renders the CaretDown in its caret button with `caret()`. They
   * cascade after the inner icon's own classes. Undefined for none.
   */
  readonly swapClasses?: (outer: Cell) => Readonly<Record<string, string>>;
  /** Whether a cell renders the part. */
  readonly shownIn: (cell: Cell) => boolean;
  /**
   * The BOOLEAN property of the outer set that shows or hides the instance, and the value it starts
   * with, as {@link PartDefinition.optional} says for a frame. Undefined for an instance that shows
   * wherever a cell renders it.
   */
  readonly optional?: BooleanPropertySpec;
  /**
   * Whether the part is the row that sets the width of a popup that hugs its rows, in a cell, as
   * `hugging-rows.ts` says: it hugs across, and its siblings fill. Undefined for a part that never is.
   */
  readonly setsWidth?: (cell: Cell) => boolean;
  /**
   * `"label"` for an instance the markup holds after its box's label and end icons, as a Command
   * row's Kbd group shortcut follows the row's own text, as {@link PartDefinition.after} says for a
   * frame.
   */
  readonly after?: "label";
  /** True where a designer sets the inner set's properties from the outer instance's panel. */
  readonly exposed?: true;
  /**
   * The variants that hold for the inner root where the outer component renders it, beyond the inner
   * set's own facts, as Base UI stamps `aria-expanded` on the trigger of an open popup. Each may name
   * a variant the inner set omits, through the omissions every set shares, such as `aria-expanded`,
   * or its own `omittedStates` or `omittedCompositions`, as a row link drawn outside the popup omits
   * `in-data-[slot=navigation-menu-popup]`, or one it leaves unmodelled. A variant the inner set gives
   * a meaning stops the build, as Input's `invalid` state renders `aria-invalid`, and so does an
   * omitted pseudo-element, media condition or transition frame. The in-place cascade reads them, and
   * the diff carries what they paint as overrides. Undefined for none.
   */
  readonly facts?: ReadonlyMap<string, (cell: Cell) => boolean>;
};

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
   * The `data-slot` the element `element` names carries in a cell, as Pagination's edge link carries
   * `pagination-previous` or `pagination-next` by its direction. Undefined for an element that carries
   * none in any cell, as React Aria's Link renders none, and for a root its `data-slot` names. The
   * presence check reads it for an instance part's root, and the markup check holds it to what each
   * cell renders.
   */
  readonly elementSlot?: (cell: Cell) => string;
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
   * The element of the part that takes the set's `state` axis, for such a part that carries no
   * `data-slot`, as Number field's `<input>` does, named as {@link ComponentDefinition.element} names
   * a root. `figma:compare` forces hover and focus on it, and its markup check reads the state's
   * attributes there. A definition names it or `statePart`, not both.
   */
  readonly statePartElement?: ElementSelector;
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
   * The width each cell's container gives the root, for a set whose cells differ, as a Radio row fills
   * the width of a vertical group and hugs in a horizontal one, where its container gives it none:
   * undefined for such a cell. A definition names it or {@link ComponentDefinition.previewWidth}, not
   * both.
   */
  readonly previewWidthFor?: (cell: Cell) => number | undefined;
  /**
   * The height in pixels the root's containing block gives it, which a root's percentage height
   * takes, as the Sidebar demo frame's `h-[28rem]` gives the container's `h-full`. Without it, a
   * root's percentage height stays unmapped. The compare renderer draws the same block around it.
   */
  readonly previewHeight?: number;
  /**
   * `visible` for a composite root that paints nothing of its own and holds layers whose shadows
   * reach past it, as the open Select's popup casts its shadow below and beside the column that holds
   * it, so the root leaves them unclipped. Undefined for every other root, which clips, as a spread
   * ring on the root needs (PR2). The build stops on a root that is `visible` and paints.
   */
  readonly rootOverflow?: "visible";
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
  /**
   * True for the ancestor that paints behind the root and whose box holds the root's, as
   * `Sidebar.Provider`'s wrapper paints the inset panel's band. A root that paints no background
   * takes this ancestor's background as its fill, and the coverage table names the ancestor's class.
   * Undefined for every other ancestor. A cell names at most one.
   */
  readonly backdrop?: true;
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
  /**
   * Each mode of the synced collections, with the variables as it resolves them, which the build
   * measures a layer's geometry in where the bounds across all modes cannot tell. Undefined for none.
   */
  readonly modes?: readonly ModeView[];
};

/** A component set and the coverage of the recipe classes it read. */
export type BuiltComponent = {
  readonly componentSet: Omit<ComponentSetSpec, "page">;
  readonly coverage: readonly CoverageRow[];
  /** Each font style the text layers use. */
  readonly fontStyles: readonly string[];
};

/**
 * Build the component sets of a list of definitions in its order, each with the sets before it at
 * hand, so a set builds after the sets its instance parts show.
 *
 * @template Entry - What the list holds for each set, its definition among it.
 * @param entries - The definitions, each set after the sets it holds instances of.
 * @param context - The compiled utilities and the synced variables.
 * @returns Each entry with its built set, in the list's order.
 * @throws When an instance part shows a set the list puts later or lacks, or the instance parts form
 *   a cycle, as {@link checkInstanceOrder} says, or a set does not build.
 */
export function buildSetsInOrder<Entry extends { readonly definition: ComponentDefinition }>(
  entries: readonly Entry[],
  context: BuildContext
): readonly (readonly [Entry, BuiltComponent])[] {
  checkInstanceOrder(entries.map(({ definition }) => definition));
  const built = new Map<string, InnerSet>();
  return entries.map((entry) => {
    const set = buildComponentSet(entry.definition, context, built);
    built.set(entry.definition.key, set.componentSet);
    return [entry, set] as const;
  });
}

/**
 * Build the component set for every cell of the definition's matrix.
 *
 * @param definition - The component.
 * @param context - The compiled utilities and the synced variables.
 * @param inner - The sets built before this one, by key, which its instance parts show.
 * @returns The component set, its coverage and the font styles its text uses.
 * @throws When an instance part shows a set `inner` lacks, or a cell does not build.
 */
export function buildComponentSet(
  definition: ComponentDefinition,
  context: BuildContext,
  inner: ReadonlyMap<string, InnerSet> = new Map()
): BuiltComponent {
  const coverage = new Map<string, CoverageRow>();
  const fontStyles = new Set<string>();
  const record = (row: Omit<CoverageRow, "component">): void => {
    const full = { component: definition.name, ...row };
    coverage.set(
      JSON.stringify([full.part, full.className, full.property, full.value, full.outcome, full.detail]),
      full
    );
  };
  const cells = matrixCells(definition.axes);
  const optional = optionalParts(definition, cells, undefined);
  const booleans = booleanPropertiesOf(definition.name, optional);
  // The inner sets list their own optional parts' properties, but a class of this set can read them.
  const presence = [...optional, ...innerOptionalParts(definition, cells, [], new Set([definition]))];
  if (presence.length > 0) {
    refusePresenceReads(
      definition.name,
      presence,
      new Set(definitionClasses(definition)),
      context.compiled.rulesByClass
    );
  }
  const cascade = new SetCascade(makeStateTable(definition), context, record);
  const instances = new InstanceParts(context, inner, record);
  const scaling = partsThatScale(partsOf(definition), cells, context.compiled);
  const variants = cells.map((cell): VariantSpec => {
    const cellCascade = cascade.cell(cell);
    const scope: MapScope = {
      variant: variantKey(definition, cell),
      cell,
      context,
      scaling,
      instances,
      values: NO_VALUES,
      painted: new PaintedInstances(),
      translates: new WeakMap(),
    };
    const rootCascade = cellCascade.root(definition.classesFor(cell), definition.slot, {
      declarations: definition.inheritedFor?.(cell) ?? [],
      ancestors: definition.ancestorsFor?.(cell) ?? [],
      defaults: definition.elementDefaults ?? [],
    });
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding, except a child's shadow at the root's edge, which a
    // root that paints nothing leaves unclipped through `rootOverflow`.
    const room = rootRoom(
      { width: previewWidthIn(definition, cell), height: definition.previewHeight },
      rootCascade.style,
      context.variables
    );
    const box = mapBox(definition, rootCascade, scope, room);
    const behind = box.fill === undefined ? cellCascade.backdrop() : undefined;
    const backdrop = behind && readBackdrop(behind, rootCascade.style, context.variables);
    const mapped = backdrop === undefined ? box : { ...box, fill: backdrop };
    if (
      definition.rootOverflow === "visible" &&
      (mapped.fill !== undefined || mapped.stroke !== undefined || mapped.shadows.length > 0)
    ) {
      throw new KitUnmappable({
        message: `${definition.name}: a root that leaves its layers unclipped must paint nothing, and ${variantKey(definition, cell)} paints`,
      });
    }
    const root: ComponentRootSpec = {
      name: definition.slot,
      ...mapped,
      clips: definition.rootOverflow !== "visible",
    };
    placeRoot(rootCascade.style, room, context.variables, root.children);
    if (root.clips && !clipsInCss(rootCascade.style)) {
      const shadowsOf = (layer: InstanceLayerSpec): readonly ShadowSpec[] =>
        rootEffects(layer) ??
        inner.get(layer.componentSet)?.variants.find((variant) => variant.key === layer.variant)?.root
          .shadows ??
        [];
      for (const clipped of clippedShadows(root, shadowsOf, context.variables, context.modes ?? [])) {
        record({
          part: clipped.part,
          className: "",
          property: "effects",
          value: `${clipped.reach}px`,
          outcome: "dropped",
          detail: clippedDetail(variantKey(definition, cell), clipped),
        });
      }
    }
    cellCascade.settle();
    instances.settle();
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        fontStyles.add(layer.fontStyle);
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  cascade.finish();
  instances.finish();
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

/** The shadows an instance overrides on its root, or undefined where it draws its variant's own. */
function rootEffects(layer: InstanceLayerSpec): readonly ShadowSpec[] | undefined {
  for (const override of layer.overrides ?? []) {
    if (override.field === "effects" && override.path.length === 0) {
      return override.shadows;
    }
  }
  return undefined;
}

/** The `overflow` values that clip a box's content in CSS (CSS Overflow 3 §3). */
const CSS_CLIPS: ReadonlySet<string> = new Set(["hidden", "clip", "auto", "scroll"]);

/**
 * Whether a box clips its content down in CSS, through `overflow` or `overflow-y`, as Tailwind
 * compiles `overflow-hidden` to the shorthand. A `visible` axis beside one that clips computes to
 * `auto` (CSS Overflow 3 §3), so either one clipping clips both.
 */
function clipsInCss(style: LayerStyle): boolean {
  return ["overflow", "overflow-x", "overflow-y"].some((property) =>
    normalizeCss(style.resolved(property) ?? "")
      .split(" ")
      .some((value) => CSS_CLIPS.has(value))
  );
}

/** Why a coverage row lists a shadow that reaches past a variant's root, which the root's clip cuts. */
function clippedDetail(variant: string, { reach, edges, modes }: ClippedShadow): string {
  const where = modes === undefined ? "" : ` at ${modes.join(" and ")}`;
  return `in ${variant} the shadow reaches ${reach}px past the root's ${edges}${where}, which CSS paints, since the root does not clip, while the root of every Figma variant clips so it can draw its own ring (PR2)`;
}

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

/**
 * Every class the elements around the root, the root, its parts and their icons use in any cell of
 * the matrix, which the build compiles. An instance part adds the classes the outer component passes
 * it, and those it gives the icons its swap properties place, in each cell that renders it. Its inner component's classes are the inner definition's own,
 * which the build compiles for the inner set, built first.
 *
 * @param definition - The component.
 * @returns The classes, in the order the elements first use them, the ancestors' before the boxes',
 *   and each box's before its icons'.
 */
export function definitionClasses(definition: ComponentDefinition): readonly string[] {
  return matrixCells(definition.axes).flatMap((cell) => [
    ...(definition.ancestorsFor?.(cell) ?? []).flatMap((ancestor) => splitClasses(ancestor.classes)),
    ...boxClasses(definition, cell),
  ]);
}

/** The classes a box, its icons and the parts below it use in a cell, depth first. */
function boxClasses(box: BoxDefinition, cell: Cell): readonly string[] {
  return [
    ...splitClasses(box.classesFor(cell)),
    ...box.iconsFor(cell).flatMap((slot) => splitClasses(slot.classes ?? "")),
    ...(box.parts ?? []).flatMap((part) =>
      "kind" in part
        ? part.shownIn(cell)
          ? [
              ...splitClasses(part.classesFor?.(cell) ?? ""),
              ...Object.values(part.swapClasses?.(cell) ?? {}).flatMap(splitClasses),
            ]
          : []
        : boxClasses(part, cell)
    ),
  ];
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
      throw new KitUnmappable({
        message: `${definition.name}: the labels ${first.label} and ${where} both set the ${label.textProperty} property, one starting as "${first.defaultValue}" and one as "${label.characters}". A TEXT property holds one default, so give them one text or a property each.`,
      });
    }
  }
  return [...named].map(([name, { defaultValue }]) => ({ name, defaultValue }));
}

/**
 * A definition's optional parts, depth first, each with every `data-slot` that hiding it hides, as the
 * markup renders them in the cells given: its own and those of the elements inside it, through the
 * instances it holds, whose inner roots and parts the DOM holds too.
 *
 * @param definition - The definition.
 * @param cells - Its cells, or the inner cells an instance of it shows.
 * @param inside - The instance that holds the definition's root, for an inner set's parts.
 * @returns The parts.
 */
function optionalParts(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  inside: OptionalPart["inside"]
): readonly OptionalPart[] {
  const parts = allPartsOf(definition).flatMap((part): OptionalPart[] =>
    part.optional === undefined
      ? []
      : [
          {
            name: "kind" in part ? part.of.slot : partName(part),
            property: part.optional,
            slots: renderedSlots(part, cells),
            elements: [],
            inside,
          },
        ]
  );
  // An icon is an `<svg>` with no slot, listed once by its key however many cells show it.
  const icons = new Map(
    [definition, ...partsOf(definition)].flatMap((box) =>
      cells.flatMap((cell) => box.iconsFor(cell).map((slot) => [slot.key, slot] as const))
    )
  );
  return [
    ...parts,
    ...[...icons.values()].flatMap((slot): OptionalPart[] =>
      slot.optional === undefined
        ? []
        : [{ name: slot.name, property: slot.optional, slots: [], elements: ["svg"], inside }]
    ),
  ];
}

/**
 * The optional parts of the inner sets a box's instance parts show, in the inner cells each instance
 * shows, through the instances those sets hold in turn. A definition the walk is already inside adds
 * nothing again.
 *
 * @param box - The definition whose instance parts the walk starts at.
 * @param cells - The cells of the definition, or the inner cells an instance of it shows.
 * @param path - The keys of the instance parts from the set down to the box.
 * @param inside - The definitions the walk is inside.
 * @returns The parts, each with the instance that holds it and its set.
 */
function innerOptionalParts(
  box: ComponentDefinition,
  cells: readonly Cell[],
  path: readonly string[],
  inside: ReadonlySet<ComponentDefinition>
): readonly OptionalPart[] {
  return instancePartsOf(box).flatMap((part) => {
    const { of } = part;
    if (inside.has(of)) {
      return [];
    }
    const shown = cells.filter((cell) => part.shownIn(cell)).map((cell) => part.cell(cell));
    const keys = [...path, part.key];
    return [
      ...optionalParts(of, shown, { instance: keys.join(" / "), set: of.name }),
      ...innerOptionalParts(of, shown, keys, new Set([...inside, of])),
    ];
  });
}

/**
 * The label of a box and of every frame part below it, depth first, with the layer name of its box.
 * An instance part's labels belong to its inner set.
 */
function labelsOf(
  box: BoxDefinition,
  name: string
): readonly { readonly box: string; readonly label: LabelDefinition }[] {
  return [
    ...(box.label === undefined ? [] : [{ box: name, label: box.label }]),
    ...framePartsOf(box).flatMap((part) => labelsOf(part, partName(part))),
  ];
}

/** Every cell of the matrix, the first axis varying slowest. */
export function matrixCells(axes: readonly AxisSpec[]): readonly Cell[] {
  return axes.reduce<Cell[]>(
    (cells, axis) => cells.flatMap((cell) => axis.values.map((value) => ({ ...cell, [axis.name]: value }))),
    [{}]
  );
}
