/**
 * The cascade of one box, the root or a part, as the mapping reads it: its own style, and the
 * cascades of the parts and icons below it. `capture/capture-cascade.ts` runs it from a set's capture.
 */
import type { Cell, IconSlot, PreviewLength } from "./component-spec";
import type { Origin } from "./coverage-log";
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
   * there. The classes the outer component passes it are the passed origin's, its layers' rows and
   * the fields their reads fill go where `scope.inPlace` says, and its path starts again at the
   * inner root.
   *
   * @param part - The inner root's layer name.
   * @param element - The inner root's `data-slot`, the inner set's key, whose kept capture names the
   *   classes the composite passes, and whether it follows this box's text.
   * @param scope - The inner cell, the in-place build and the origin of the passed classes.
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
   * @returns The element's style, or undefined where no rule of a class above it reaches it, so the
   *   label reads this box's style.
   */
  labelElement(element: { readonly last: boolean; readonly key: string }): LayerStyle | undefined;
  /**
   * Cascade an icon this box shows, over what this box passes down.
   *
   * @param slot - The icon.
   * @returns The icon's computed style.
   */
  icon(slot: IconSlot): LayerStyle;
  /** How many element children the box's element holds, or undefined where the capture holds none. */
  readonly elementChildren: number | undefined;
  /** The tag of the box's element: a form control's tag says where the browser places its text. */
  readonly elementTag: string | undefined;
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
};

/** What a capture measured of a box's element, as {@link BoxCascade.measured} says. */
export type MeasuredBox = {
  readonly fitsOneLine: string | undefined;
  readonly underMaxHeight: string | undefined;
  readonly widest: boolean;
  readonly holdsWidest: boolean;
  /** The box's line box adds no height or baseline offset to its one inline-level child. */
  readonly lineFits: boolean;
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
