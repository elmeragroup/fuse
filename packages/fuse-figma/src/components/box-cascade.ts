/**
 * The cascade of one box, the root or a part, as the mapping reads it: its own style, and the
 * cascades of the parts and icons below it. `capture/capture-cascade.ts` runs it from a set's capture.
 */
import type { Cell, IconSlot, PreviewLength } from "./component-spec";
import type { Origin } from "./coverage-log";
import type { DrawnAt } from "./drawn-parts";
import type { NumberSpec } from "./kit-spec";
import type { CoverageNote, InPlace, LayerStyle } from "./layer-style";
/**
 * The cascade a box below another runs in where it is another set's root built in place, as an
 * instance part's inner component is: the inner cell, where the rows of its layers go, and the
 * origin of the classes the outer component passes it.
 */
export type InstanceScope = {
  readonly cell: Cell;
  readonly inPlace: InPlace;
  readonly passed: { readonly origin: Origin };
};

/**
 * Reads the declarations of one class that styles every child of a box but the last as the box's
 * item spacing, with what becomes of each declaration, or undefined where the class draws no item
 * spacing.
 */
export type ChildSpacing = (
  declarations: readonly { readonly property: string; readonly value: string }[]
) => { readonly itemSpacing: NumberSpec; readonly notes: ReadonlyMap<string, CoverageNote> } | undefined;

/**
 * What finds a frame part's element below its box: the part's key, its `data-slot`, and, for a part
 * without a `data-slot`, its place, as a part definition's `place` says.
 */
export type PartElement = {
  readonly key: string;
  readonly slot: string | undefined;
  readonly place?: string;
  /** Whether a BOOLEAN property shows the part, so a composite that turns it off leaves it out. */
  readonly optional?: true;
  /** Whether the part's element follows its box's text in the markup, as the definition's `after` says. */
  readonly after?: "label";
};

/**
 * The cascade of an icon: its `<svg>`'s computed style, and the place and `data-slot` of the `<svg>`,
 * whose box the icon layer draws. A wrapper around it, as a pending Button's spinner sits in a
 * slotted span, draws no layer of its own. Undefined where the icon's element is not in the cell's
 * own capture.
 */
export type IconCascade = { readonly style: LayerStyle; readonly drawnAt: DrawnAt | undefined };

/** The cascade of one box, the root or a part, as the mapping reads it. */
export type BoxCascade = {
  /** The box's computed style. */
  readonly style: LayerStyle;
  /**
   * The keys of the layers from the root down to the box's, the root of an instance part built in
   * place counting as a root, which the fields its reads fill name.
   */
  readonly path: readonly string[];
  /**
   * Give the declarations this box's classes win on every child but the last, as `space-y-4` does,
   * their rows once the mapping knows how many element children the box holds: the item spacing
   * `spacing` reads, where every child but the last wins all of them, or {@link childSpacingNote}'s.
   *
   * @param children - The element children the box holds in the cell, drawn or not.
   * @param spacing - Reads the declarations as the item spacing, where the box draws every element
   *   child as a layer in its flow, or undefined where it cannot.
   * @returns The item spacing, or undefined.
   */
  spaceChildren(children: number | undefined, spacing?: ChildSpacing): NumberSpec | undefined;
  /**
   * The instance part built in place whose layers hold this box, undefined for a box of the set's own.
   *
   * @returns The in-place build.
   */
  inPlace(): InPlace | undefined;
  /**
   * Cascade a part below this box, over what this box passes down.
   *
   * @param part - The part's layer name.
   * @param element - The part's key and how its element is found: its `data-slot`, or its place.
   * @returns The part's cascade.
   */
  part(part: string, element: PartElement): BoxCascade;
  /**
   * Cascade another set's root below this box, as an instance part renders the inner component
   * there. A declaration at or below the inner root belongs to the innermost set that claims it, as
   * `capture/instance-twin.ts` decides. Where a chip holds a row that holds this tag, a declaration
   * the tag does not claim belongs to the row where the row claims it, and to the chip otherwise. Its
   * layers' rows and the fields their reads fill go where `scope.inPlace` says, and its path starts
   * again at the inner root.
   *
   * @param part - The inner root's layer name.
   * @param element - The inner root's `data-slot`, the inner set's key, whose kept capture names the
   *   classes the composite passes, and whether it follows this box's text.
   * @param scope - The inner cell, the in-place build and the origin of the set that holds the
   *   instance.
   * @returns The inner root's cascade.
   */
  instance(
    part: string,
    element: { readonly slot: string | undefined; readonly set: string; readonly after?: "label" },
    scope: InstanceScope
  ): BoxCascade;
  /**
   * Cascade the element this box holds its label in, where a rule of a class above it reaches it, as
   * `[&>span:last-child]:truncate` reaches the `<span>` a Sidebar row holds its text in. The kit draws
   * no layer for the element, whose label the box draws as its own text, so the element's path is
   * the text layer's.
   *
   * @param element - Whether the label is the box's last layer, and the label's key.
   * @returns The element's style and what the capture measured of it, or undefined where no rule of a
   *   class above it reaches it, so the label reads this box's style.
   */
  labelElement(element: {
    readonly last: boolean;
    readonly key: string;
  }): { readonly style: LayerStyle; readonly measured: MeasuredBox } | undefined;
  /**
   * The text the capture recorded for this box's label: the value of the attribute a control holds
   * its text in, such as an `<input>`'s `placeholder`, or else the box element's own text nodes and
   * those of the elements below it that no layer draws, in document order, each where its element is
   * visible.
   *
   * @param attribute - The attribute the label's text is in, or undefined for text nodes.
   * @returns The text and where it came from, `Hidden` where none of it paints, or `Unresolved`
   *   with why the capture holds no text for it.
   */
  capturedText(attribute: string | undefined): CapturedText;
  /**
   * The box's text nodes and those of the elements below it that no layer draws, in document order,
   * each with the style of every element between the box and the text node, outermost first, as
   * Code's highlighter holds each token in a span inside a line span. The box's own text has no
   * element between. Defined only where such an element sets a declaration beyond the base layers',
   * as a token's inline `color` is, and undefined where the box's own style speaks for all of its
   * text.
   *
   * @param label - The label's key, which each element's reads fill.
   * @returns The runs, or undefined.
   */
  textRuns(label: string): readonly TextRun[] | undefined;
  /**
   * Cascade an icon this box shows, over what this box passes down.
   *
   * @param slot - The icon.
   * @returns The icon's computed style, and where the element that carries its `data-slot` sits.
   */
  icon(slot: IconSlot): IconCascade;
  /** How many element children the box's element holds, or undefined where the capture holds none. */
  readonly elementChildren: number | undefined;
  /**
   * Where the box's element sits in the cell's capture and the `data-slot` it carries, as
   * `drawn-parts.ts` records a drawn part, or undefined for a box with no captured element of its
   * own, as a pseudo-element or an open composite's composed root.
   */
  readonly drawnAt: DrawnAt | undefined;
  /** The tag of the box's element: a form control's tag says where the browser places its text. */
  readonly elementTag: string | undefined;
  /** The text the box's element holds as its own, as the capture records it, or undefined for none. */
  readonly elementText: string | undefined;
  /** Whether the box's element sets its `::marker` a `content` beyond `normal` or `none`. */
  readonly markerContent: boolean | undefined;
  /**
   * What the capture measured of the box's element, as reasons the mapping reads: its text, or its
   * wrapping row's items, on one line under its `max-width`; its content under its `max-height`;
   * whether it is, or holds, the widest row of a popup that hugs its rows; and whether its line box
   * adds nothing to its one inline-level child.
   */
  readonly measured: MeasuredBox | undefined;
  /**
   * The content height the elements around a root give its percentage height, where the root's
   * height is a percentage.
   */
  readonly heightBasis?: PreviewLength | undefined;
  /**
   * Whether the flex rows around a root of `auto` height provably stretch it to the height of its
   * sample's host, which the manifest names as the preview height. Absent elsewhere.
   */
  readonly stretchedToHost?: boolean;
  /**
   * The `data-slot` of each root an anchored composite's root draws, in the order its placement
   * rule draws them: the popup first on the `top` and `left` sides, the anchor first otherwise.
   * Absent on any other box.
   */
  readonly drawnSlots?: readonly (string | undefined)[] | undefined;
  /**
   * The box's `::before` and `::after` the mapping draws as layers of their own, `::before` first:
   * each paints, and the capture measured it as an absolute box laid out against the box.
   */
  readonly pseudoElements: readonly PseudoCascade[];
};

/** A pseudo-element the mapping draws as a layer, as {@link BoxCascade.pseudoElements} lists it. */
export type PseudoCascade = {
  readonly pseudo: "before" | "after";
  /** Its cascade, a box with no parts, icons or label of its own. */
  readonly cascade: BoxCascade;
};

/**
 * The text the capture recorded for a label, as {@link BoxCascade.capturedText} reads it: painted, from
 * an attribute or from text nodes; hidden, where nothing of it paints; or unresolved, with why.
 */
export type CapturedText =
  | { readonly _tag: "Painted"; readonly source: "attribute" | "nodes"; readonly text: string }
  | { readonly _tag: "Hidden" }
  | { readonly _tag: "Unresolved"; readonly reason: string };

/** A text node of a label and the styles of the elements it sits in below the box, as {@link BoxCascade.textRuns} reads it. */
export type TextRun = {
  readonly text: string;
  /** The style of each element between the box and the text node, outermost first. */
  readonly elements: readonly LayerStyle[];
  /**
   * The URL the run links to: the `href` of the innermost `<a>` between the box and the text node,
   * as `linkTarget` reads it, or undefined for none.
   */
  readonly hyperlink: string | undefined;
};

/**
 * A box whose aspect ratio sets one side from the other (CSS Sizing 4 §4.2): its `height` from its
 * width, or its `width` from its height, with its border box in CSS pixels.
 */
export type RatioBox = {
  /** The side the ratio sets. */
  readonly sets: "width" | "height";
  /** The border box's width. */
  readonly width: number;
  /** The border box's height. */
  readonly height: number;
};

/** What a capture measured of a box's element, as {@link BoxCascade.measured} says. */
export type MeasuredBox = {
  readonly fitsOneLine: string | undefined;
  readonly underMaxHeight: string | undefined;
  /** The box is as wide with its `max-width` 24px lower, so the maximum never narrows it. */
  readonly underMaxWidth: boolean;
  /** The box's flex line leaves room for its items' auto margins along it in every mode. */
  readonly freeAlongMain: boolean;
  /** The box's flex line fits its items, with its auto margins at zero, in every mode. */
  readonly fitsAlongMain: boolean;
  /** The box is a flex row whose growing items each stay at their own content width in every mode. */
  readonly itemsAtContent: boolean;
  /** The box is a table box whose parts tile it in every mode, as the capture measured. */
  readonly tableTiles: boolean;
  /**
   * The box is a table row whose table collapses its borders in every mode, and whose borders no
   * box sharing their edges contests, as the capture read it.
   */
  readonly bordersCollapse: boolean;
  /** The box is a flex row's `inline` item, which sits on the row's one line in every mode. */
  readonly inlineRow: boolean;
  readonly widest: boolean;
  readonly holdsWidest: boolean;
  /** The box's line box adds no height or baseline offset to its one inline-level child. */
  readonly lineFits: boolean;
  /** The box ends its one line in an ellipsis with room for its first character and the ellipsis. */
  readonly ellipsisFits: boolean;
  /** The box is a grid whose one column is its content width, with its items' least widths inside. */
  readonly trackFits: boolean;
  /**
   * The side a box's aspect ratio sets from the other in every mode, and the border box the capture
   * measured, in CSS pixels. Undefined where the ratio sets neither side.
   */
  readonly ratio: RatioBox | undefined;
  /** On a grid of two or more columns, the columns that hug their widest item in every mode. */
  readonly gridHugs: readonly number[];
  /** On a grid of two or more columns, the columns wider than their items' least widths in every mode. */
  readonly gridHolds: readonly number[];
  /** On such a grid, each column's item at least as wide as the others in every mode, or -1. */
  readonly gridWidest: readonly number[];
  /** On such a grid, each row's item at least as tall as the others in every mode, or -1. */
  readonly gridTallest: readonly number[];
  /** On such a grid, how many items it lays out in every mode, or undefined. */
  readonly gridItems: number | undefined;
  /** On an item of such a grid, its place among the grid's items, or undefined. */
  readonly gridItem: number | undefined;
  /** The element generates no box and adds nothing to its parent's flow but its children's boxes. */
  readonly noBox: boolean;
  /**
   * The box is absolute, and its frame's parent spans its containing block, an element above it, in
   * every mode, as the capture measured.
   */
  readonly parentSpansBlock: boolean;
  /**
   * The axes along which the box, absolute, is one length in every mode, as the capture measured.
   */
  readonly oneLength: ReadonlySet<"horizontal" | "vertical">;
  /**
   * The box's width is 100% of a parent block that fits its content, and this is the widest
   * max-content width of the parent's other in-flow children, one length in every mode, in CSS
   * pixels, as the capture measured. Undefined otherwise.
   */
  readonly spansBeside: number | undefined;
  /**
   * The box is a child of the root whose positive `z-index` paints it over every other box of the
   * root, as the root's last child, in every mode, as the capture measured.
   */
  readonly paintsLast: boolean;
  /** The box's `transform` computes to the identity matrix in every mode, as the capture measured. */
  readonly identityTransform: boolean;
};

/**
 * What a class that styles every child but the last makes of a box that holds `children`.
 *
 * @param children - How many element children the box holds, or undefined where the build cannot tell.
 * @returns The note of each of the class's rows where no item spacing reads them.
 */
export function childSpacingNote(children: number | undefined): CoverageNote {
  if (children === undefined) {
    return {
      outcome: "unmapped",
      detail:
        "the definition does not count the element children the box's markup holds, so the build cannot tell which is the last",
    };
  }
  return children <= 1
    ? {
        outcome: "dropped",
        detail: `\`:not(:last-child)\` styles every child but the last, and the box holds ${children === 0 ? "none" : "one"}, so the class styles nothing the set draws`,
      }
    : { outcome: "unmapped", detail: "the kit draws no margin between a box's children" };
}
