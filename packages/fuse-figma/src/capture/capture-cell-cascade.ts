/**
 * The cascade of one cell: its root over the page and the component's elements around it. An open
 * composite's root is its placement rule's: the box an anchored popup and its anchor sit in, the row
 * of a nested popup's parent popup and its column, or the Backdrop a modal popup sits over.
 * `anchored-placement.ts` reads the anchored rule and guards its hugging anchor,
 * `nested-placement.ts` reads the nested one, and `root-backdrop.ts` the background the root shows
 * from the elements around it.
 *
 * - The page's elements and the component's own elements around the root stand around it. They pass
 *   their inherited declarations down and the kit draws none of the rest. A page element's synced
 *   variables stay out, so a `var()` of the root's keeps binding the variable rather than the value
 *   the page gives it.
 */

import type { BoxCascade } from "../components/box-cascade.ts";
import { KitUnmappable } from "../components/build-errors.ts";
import type { Origin } from "../components/coverage-log.ts";
import { normalizeCss } from "../components/css-values.ts";
import type { Viewport } from "../components/css-values.ts";
import { modalLayout } from "../components/fixed-placement.ts";
import { CellLedger, inheritance, inheritsProperty, LayerStyle } from "../components/layer-style.ts";
import type { Applied, CellScope, Layer } from "../components/layer-style.ts";
import { percentHeightBasis, stretchedToHost } from "../components/percent-height.ts";
import { anchoredPlacement, checkHuggingAnchor } from "./anchored-placement.ts";
import { CaptureBoxCascade } from "./capture-box-cascade.ts";
import type { CapturedCell, CapturedElement, CapturedRoot } from "./capture-format.ts";
import { appliedOf, splitBorders, undrawnName } from "./cell-read.ts";
import type { CellRead, Placed } from "./cell-read.ts";
import { NESTED_PLACEMENT, nestedLayout } from "./nested-placement.ts";
import type { NestedPlacement } from "./nested-placement.ts";
import { backdropAround } from "./root-backdrop.ts";

/** Why the kit draws none of a page element's own declarations. */
const PAGE_UNDRAWN = "the page around the component, which the kit draws no layer for";

/** Why the kit draws none of an element of the component's markup around the root. */
const AROUND_UNDRAWN =
  "an element of the component's markup around the root, which the kit draws no layer for";

/**
 * The font size `<html>` takes where no rule sets one: the initial `medium` (CSS Fonts 4 §2.5), which
 * Chromium draws at 16px. No rule declares it, so the capture holds no winner for it, and a root
 * whose own classes set no size, as Link's, inherits it.
 */
function initialFontSize(origin: Origin): Applied {
  return {
    part: "html",
    className: "user agent",
    origin,
    rank: -3,
    order: -1,
    at: undefined,
    declarations: [{ property: "font-size", value: "16px" }],
  };
}

/**
 * How an open composite places the elements its cells measure, as its manifest names it:
 * `anchored`, a popup beside its anchor, `sideOffset` pixels apart, as Base UI's positioner places
 * it, `nested`, a popup beside a row of another popup, as `nested-placement.ts` draws it, or
 * `modal`, a popup fixed over the Backdrop in the viewport.
 */
export type OpenPlacement =
  | { readonly _tag: "anchored"; readonly sideOffset: number }
  | NestedPlacement
  | { readonly _tag: "modal"; readonly viewport: Viewport };

/**
 * The elements around a root as the cascade placed them, the layer of the innermost one, and the
 * layers of the component's own elements around it, outermost first.
 */
type AroundPath = {
  readonly placed: readonly Placed[];
  readonly layer: Layer | undefined;
  readonly own: readonly { readonly element: CapturedElement; readonly layer: Layer }[];
};

/** The cascade of one cell, read from its capture. */
export class CaptureCellCascade {
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #page: readonly CapturedElement[];
  readonly #cell: CapturedCell;
  readonly #open: OpenPlacement | undefined;
  #backdrop: LayerStyle | undefined;

  constructor(
    read: CellRead,
    ledger: CellLedger,
    page: readonly CapturedElement[],
    cell: CapturedCell,
    open: OpenPlacement | undefined
  ) {
    this.#read = read;
    this.#ledger = ledger;
    this.#page = page;
    this.#cell = cell;
    this.#open = open;
  }

  /**
   * Cascade the root over the page and the component's elements around it. An open composite's
   * root is its rule's: the box an anchored popup and its anchor sit in, or the Backdrop a modal
   * popup sits over.
   *
   * @param part - The root's layer name.
   * @returns The root's cascade.
   * @throws `KitUnmappable` where the cell's roots do not fit the set's placement.
   */
  root(part: string): BoxCascade {
    const [first, ...others] = this.#cell.roots;
    const open = this.#open;
    if (open === undefined) {
      if (others.length > 0) {
        throw new KitUnmappable({
          message: `${this.#cell.key} measures ${String(this.#cell.roots.length)} elements, and its manifest names no open composite's placement`,
        });
      }
      const path = this.#aroundPath(first.around);
      const box = new CaptureBoxCascade(
        this.#read,
        this.#ledger,
        [...path.placed, this.#placed(first.root, part)],
        path.layer,
        [],
        {
          rooted: new Map(),
          applied: [],
        }
      );
      this.#backdrop = backdropAround(
        this.#ledger,
        box.style,
        path.own,
        first.root.measured?.coincidingAround ?? 0,
        this.#read.context.variables,
        this.#read.instancedIn
      );
      // The elements around the root and the root itself, from which box sizing reads the basis, or
      // whether the flex rows around a root of `auto` height stretch it to its host's height.
      const chain = [...path.own.map(({ layer }) => new LayerStyle(this.#ledger, layer, [])), box.style];
      const lengthAsDeclared = { lengthAsDeclared: first.root.measured?.basisAsDeclared === true };
      const height = normalizeCss(box.style.resolved("height") ?? "auto");
      box.heightBasis = height.includes("%")
        ? percentHeightBasis(chain, this.#read.context.variables, lengthAsDeclared)
        : undefined;
      box.stretchedToHost = height === "auto" && stretchedToHost(chain, lengthAsDeclared);
      return box;
    }
    if (open._tag === "anchored") {
      const path = this.#aroundPath([]);
      const placement = anchoredPlacement(this.#cell, open.sideOffset, this.#read.declarations);
      checkHuggingAnchor(this.#cell, placement, this.#read.anchorWidth, this.#read.declarations);
      const roots = placement.roots.map((each) =>
        each === placement.anchor && placement.anchorFills ? this.#withStretch(each) : each
      );
      const element = composedRoot(part, roots);
      const box = new CaptureBoxCascade(
        this.#read,
        this.#ledger,
        [...path.placed, this.#placed(element, part)],
        path.layer,
        [],
        {
          rooted: rootedChains(roots),
          applied: placementApplied(part, this.#ledger.scope.origin, placement.declarations),
        }
      );
      box.drawnSlots = placement.roots.map(({ root }) => root.attributes["data-slot"]);
      return box;
    }
    if (open._tag === "nested") {
      const path = this.#aroundPath([]);
      const placement = nestedLayout(this.#cell, open, {
        declarations: this.#read.declarations,
        variables: this.#read.context.variables,
        styleOf: (element) => this.#detachedStyle(element),
      });
      return new CaptureBoxCascade(
        this.#read,
        this.#ledger,
        [...path.placed, this.#placed(composedRoot(part, placement.children), part)],
        path.layer,
        [],
        {
          rooted: rootedChains(placement.roots),
          applied: placementApplied(
            part,
            this.#ledger.scope.origin,
            placement.declarations,
            NESTED_PLACEMENT
          ),
        }
      );
    }
    const [popup, ...rest] = others;
    if (popup === undefined || rest.length > 0) {
      throw new KitUnmappable({
        message: `${this.#cell.key} measures ${String(this.#cell.roots.length)} elements, and a modal composite measures its Backdrop and its popup`,
      });
    }
    const layout = modalLayout(this.#detachedStyle(popup.root), open.viewport);
    if (layout === undefined) {
      throw new KitUnmappable({
        message: `the popup of ${this.#cell.key} is fixed neither at the viewport's centre, nor a length below its top and centred across, nor against its right edge, which the Backdrop cannot place`,
      });
    }
    // The popup portals beside the Backdrop, which the composite draws it over.
    const backdrop: CapturedElement = { ...first.root, children: [...first.root.children, popup.root] };
    this.#read.replaced.set(first.root, backdrop);
    this.#read.places.set(backdrop, this.#read.places.get(first.root) ?? "");
    const around = this.#aroundPath(first.around);
    const slot = popup.root.attributes["data-slot"];
    return new CaptureBoxCascade(
      this.#read,
      this.#ledger,
      [...around.placed, this.#placed(backdrop, part)],
      around.layer,
      [],
      {
        rooted: new Map(slot === undefined ? [] : [[slot, [popup.root]]]),
        applied: placementApplied(part, this.#ledger.scope.origin, layout, MODAL_PLACEMENT),
      }
    );
  }

  /**
   * An anchor that fills the composite across, with the rule's `align-self: stretch` as its own last
   * declaration, which the cell's declarations gain.
   */
  #withStretch({ around, root }: CapturedRoot): CapturedRoot {
    this.#read.declarations.push({
      property: "align-self",
      value: "stretch",
      important: false,
      longhands: ["align-self"],
      source: "page",
      layer: "",
      selector: "",
      className: ANCHORED_PLACEMENT,
      owner: 0,
    });
    const stretched = { ...root, declarations: [...root.declarations, this.#read.declarations.length - 1] };
    this.#read.replaced.set(root, stretched);
    this.#read.places.set(stretched, this.#read.places.get(root) ?? "");
    return { around, root: stretched };
  }

  /** A box's element as the root's path places it. */
  #placed(element: CapturedElement, name: string): Placed {
    return { element, name, origin: this.#ledger.scope.origin, holders: [] };
  }

  /**
   * The layers of the page's elements and of the component's own elements around a root. A page
   * element passes down what inherits, its synced variables left out, so a `var()` of the root's
   * keeps binding the variable. The component's own elements cascade every declaration they win, so
   * a root's `100%` height can read the height around it, and each declaration nothing reads drops
   * with the element's reason.
   */
  #aroundPath(around: readonly CapturedElement[]): AroundPath {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent: Layer | undefined;
    const path: Placed[] = [];
    const layers: { readonly element: CapturedElement; readonly layer: Layer }[] = [];
    const elements = [
      ...this.#page.map((element) => ({ element, undrawn: PAGE_UNDRAWN, page: true })),
      ...around.map((element) => ({ element, undrawn: AROUND_UNDRAWN, page: false })),
    ];
    for (const { element, undrawn, page } of elements) {
      path.push({ element, name: undrawnName(element), origin, holders: [] });
      const own = appliedOf(
        this.#read,
        element.declarations,
        path,
        ({ property }) => !page || (inheritsProperty(property, context) && !context.variables.owns(property))
      );
      const inherited = parent === undefined ? new Map() : inheritance(parent, context);
      const applied = [
        ...(parent === undefined ? [initialFontSize(origin)] : []),
        // A border's sides cascade one by one, so the content height around the root reads them.
        ...(page ? own : splitBorders(this.#ledger.scope, inherited, own)),
      ];
      parent = this.#ledger.add(inherited, applied, parent, { undrawn });
      if (!page) {
        layers.push({ element, layer: parent });
      }
    }
    return { placed: path, layer: parent, own: layers };
  }

  /**
   * A captured element's own style, read apart from the cell's layers: a modal popup's, which the
   * Backdrop's layout reads before the popup cascades in place, or a nested composite's parent popup
   * and rows, which its column reads. Its reads record nothing.
   */
  #detachedStyle(element: CapturedElement): LayerStyle {
    const scope: CellScope = {
      ...this.#ledger.scope,
      origin: { record: () => undefined },
      record: () => undefined,
    };
    const ledger = new CellLedger(scope);
    const placed: Placed[] = [{ element, name: "popup", origin: scope.origin, holders: [] }];
    const layer = ledger.add(
      new Map(),
      appliedOf(this.#read, element.declarations, placed, () => true),
      undefined
    );
    return new LayerStyle(ledger, layer, []);
  }

  /**
   * The style of the element around the root that paints behind it, as {@link backdropAround}
   * finds it, or undefined for none.
   *
   * @returns The element's style.
   */
  backdrop(): LayerStyle | undefined {
    return this.#backdrop;
  }

  /** Give every declaration no layer read its row, as the cell's ledger records it. */
  settle(): void {
    this.#ledger.settle();
  }
}

/** The class name the anchored rule's declarations carry on the root. */
const ANCHORED_PLACEMENT = "Base UI's anchored placement";

/** The class name the modal rule's declarations carry on the Backdrop. */
const MODAL_PLACEMENT = "the modal popup's fixed placement";

/** The element an anchored composite's root stands for: a box holding its roots, in drawn order. */
function composedRoot(slot: string, roots: readonly (CapturedRoot | CapturedElement)[]): CapturedElement {
  return {
    tag: "div",
    attributes: { "data-slot": slot },
    classes: [],
    text: "",
    declarations: [],
    initial: [],
    pseudo: {},
    variables: {},
    unmatched: [],
    children: roots.map((each) => ("root" in each ? each.root : each)),
  };
}

/**
 * The elements from below a composite's root down to each of its roots, by the root's `data-slot`:
 * the component's own markup around it, such as a portal and the positioner, then the root.
 */
function rootedChains(roots: readonly CapturedRoot[]): ReadonlyMap<string, readonly CapturedElement[]> {
  return new Map(
    roots.flatMap(({ around, root }) => {
      const slot = root.attributes["data-slot"];
      return slot === undefined ? [] : [[slot, [...around, root]] as const];
    })
  );
}

/** A placement rule's declarations, applied on the composite's root as one class's. */
function placementApplied(
  part: string,
  origin: Origin,
  declarations: readonly { readonly property: string; readonly value: string }[],
  className: string = ANCHORED_PLACEMENT
): readonly Applied[] {
  return declarations.map((declaration, order) => ({
    part,
    className,
    origin,
    rank: 1,
    order,
    at: undefined,
    declarations: [declaration],
  }));
}
