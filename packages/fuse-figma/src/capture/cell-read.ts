/**
 * What every box of a cell reads, and the declarations a captured element applies to its layer: its
 * own winners in the capture's order, less those its parent's spacing reads, with the values the
 * capture keeps in place of Base UI's measured pixels resolved. A {@link Placed} names each element
 * on the path from `<html>` down to a box.
 *
 * - A declaration's row names the layer of the element whose class set it: the box itself, or the
 *   box above whose child selector reached it. The innermost set that claims the declaration on the
 *   same box of the twin owns the row, as `instance-twin.ts` decides, and the composite owns one no
 *   inner set claims.
 */

import type { BuildContext } from "../components/component-spec.ts";
import type { Origin } from "../components/coverage-log.ts";
import type { CapturedAt } from "../components/coverage.ts";
import { exceptLastChildClass } from "../components/css-selector.ts";
import { evaluateLength, normalizeCss } from "../components/css-values.ts";
import { CellLedger, LayerStyle } from "../components/layer-style.ts";
import type { Applied, CellScope, ComputedStyle } from "../components/layer-style.ts";
import type { AnchorWidth } from "./anchored-placement.ts";
import { wonLonghands } from "./border-shorthands.ts";
import { ANCHOR_CENTRE, ANCHOR_WIDTH } from "./capture-format.ts";
import type { CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";
import type { InstancePlace } from "./cell-accounting.ts";
import { declarationOrigin, isReset } from "./instance-twin.ts";
import { withBorderLonghands } from "./pseudo-elements.ts";

/**
 * An element on the path from `<html>` to a box: its layer's name, the origin of the set whose markup
 * it belongs to, and the origin of the set that holds each instance part around it in this visit,
 * innermost first.
 */
export type Placed = {
  readonly element: CapturedElement;
  readonly name: string;
  readonly origin: Origin;
  readonly holders: readonly Origin[];
};

/** What every box of a cell reads. */
export type CellRead = {
  /** The capture's declarations, then any a placement rule adds for the cell. */
  readonly declarations: CapturedDeclaration[];
  /** How many of `declarations` the capture holds, before any a placement rule adds. */
  readonly declarationCount: number;
  readonly context: BuildContext;
  /** The kept capture of another set, which names the classes its own root carries. */
  readonly captureOf: (key: string) => SetCapture | undefined;
  /** Each element the mapping drew, with the name of its layer, which the set's unused classes read. */
  readonly drawn: Map<CapturedElement, string>;
  /**
   * The inner roots of instance parts, each with the classes the composite passes it. The inner sets
   * account for the rest of their classes, and for the elements below them.
   */
  readonly inner: Map<CapturedElement, ReadonlySet<string>>;
  /**
   * The inner set's own root in the inner cell, by the inner root of each instance part, which holds
   * an optional icon the composite turns off and so leaves out of its markup.
   */
  readonly innerOwn: Map<CapturedElement, { readonly root: CapturedElement; readonly capture: SetCapture }>;
  /**
   * What the inner set of each instance part around an element claims at it, innermost first, as
   * `twinClaims` in `instance-twin.ts` finds it. The claims name no holder, so they hold for every
   * visit of the instance part, and each visit's {@link Placed} path names its holders.
   */
  readonly claims: Map<CapturedElement, readonly ReadonlySet<string>[]>;
  /**
   * The copy a placement rule made of a captured root, by the root: an anchor that stretches, or
   * the Backdrop that holds the modal popup. The cascade drew the copy, which the set's unused
   * classes read in place of the root.
   */
  readonly replaced: Map<CapturedElement, CapturedElement>;
  /** The root each element around a root holds, as a positioner holds its popup. */
  readonly rootOf: ReadonlyMap<CapturedElement, CapturedElement>;
  /** The width that stands for Base UI's `--anchor-width` in the cell, as {@link AnchorWidth} says. */
  readonly anchorWidth: AnchorWidth;
  /** The root `data-slot` of each set that holds this one as an instance, as `CaptureSetSource` in `capture-cascade.ts` says. */
  readonly instancedIn: ReadonlySet<string>;
  /** Each captured element of the cell, and each copy a placement rule made of one, by its place. */
  readonly places: Map<CapturedElement, string>;
  /** The cell's key, which names its captured declarations' rows. */
  readonly cell: string;
  /** Where the cell's instance parts hold their inner roots, as `CellAccounting` in `cell-accounting.ts` says. */
  readonly instances: InstancePlace[];
};

/** A captured declaration of an element as a row names it, or undefined for a synthetic one. */
export function atOf(
  read: CellRead,
  element: CapturedElement | undefined,
  index: number
): CapturedAt | undefined {
  const place = element === undefined ? undefined : read.places.get(element);
  return place === undefined || index >= read.declarationCount
    ? undefined
    : { cell: read.cell, declaration: `${place}#${String(index)}` };
}

/**
 * Whether a child wins a declaration through its parent's class by a rule of the shape Tailwind
 * compiles a `space-x-*` or `space-y-*` to, `:where(.space-x-2 > :not(:last-child))`, which styles
 * every child of the class's element but the last.
 */
function spacesSiblings(declaration: CapturedDeclaration | undefined): boolean {
  return declaration?.owner === 1 && exceptLastChildClass(declaration.selector) === declaration.className;
}

/** The spacing declarations each element child of a box wins, by index, child by child. */
export function spacingByChild(
  read: CellRead,
  box: CapturedElement | undefined
): readonly ReadonlySet<number>[] {
  return (box?.children ?? []).map(
    (child) => new Set(child.declarations.filter((index) => spacesSiblings(read.declarations[index])))
  );
}

/**
 * The spacing declarations any element child of a box wins. The box's spacing reads them and records
 * their rows, so its children leave them out.
 */
function exceptLastOf(read: CellRead, box: CapturedElement | undefined): ReadonlySet<number> {
  return new Set(spacingByChild(read, box).flatMap((held) => [...held]));
}

/**
 * The declarations of the element at the end of `path`, less those its parent's spacing reads. Only
 * a drawn box spaces its children and records those rows, so a child of an element the kit draws no
 * layer for keeps them.
 */
export function ownDeclarations(read: CellRead, path: readonly Placed[]): readonly number[] {
  const own = path.at(-1)?.element;
  const parent = path.at(-2)?.element;
  const withheld = parent !== undefined && read.drawn.has(parent) ? exceptLastOf(read, parent) : new Set();
  return (own?.declarations ?? []).filter((index) => !withheld.has(index));
}

/**
 * The declarations of an element's box as the cascade applies them, in the capture's order: the
 * element's own, `box` "", or a pseudo-element's, as `::before`.
 */
export function appliedOf(
  read: CellRead,
  declarations: readonly number[],
  path: readonly Placed[],
  keep: (declaration: CapturedDeclaration) => boolean,
  box = ""
): Applied[] {
  const target = path.at(-1);
  // An element's `initial` lists its own declarations that reset a longhand, none of a pseudo-element's.
  const initial = box === "" ? (target?.element.initial ?? []) : [];
  return declarations.flatMap((index, order): Applied[] => {
    const declaration = read.declarations[index];
    if (declaration === undefined || !keep(declaration) || isReset(declaration, index, initial)) {
      return [];
    }
    const owner = path[path.length - 1 - declaration.owner] ?? path.at(-1);
    if (owner === undefined) {
      return [];
    }
    const value = resolvedValue(read, declaration, owner.element);
    if (value === undefined) {
      return [];
    }
    const at = atOf(read, target?.element, index);
    return [
      {
        part: owner.name,
        className: declaration.className,
        origin: declarationOrigin(
          owner,
          target === undefined ? [] : (read.claims.get(target.element) ?? []),
          box,
          declaration
        ),
        rank: 0,
        order,
        declarations: wonLonghands(declaration.property, value, declaration.longhands) ?? [
          { property: declaration.property, value },
        ],
        at,
        wins: declaration.longhands,
      },
    ];
  });
}

/** The keyword `revert`, apart from `revert-layer`. */
const REVERT = /(?<![\w-])revert(?![\w-])/i;

/**
 * A declaration's value, with a symbol the capture keeps in place of Base UI's measured pixels
 * resolved. The anchor's width resolves as {@link AnchorWidth} says, the `minimum` to the
 * `min-width` of the root the positioner holds: right for an anchor narrower than that minimum, as
 * every hugging sample's is, and too narrow for a wider one, which `checkHuggingAnchor` stops on.
 * The popup's width never follows its rows. The anchor's centre, along a centred popup's side, is
 * the popup's centre less half the element's own size there; for a popup aligned to the anchor's
 * start or end it does not resolve. A `revert` takes the value the browser's default style sheet
 * gives the longhand, as the capture recorded it.
 */
function resolvedValue(
  read: CellRead,
  declaration: CapturedDeclaration,
  element: CapturedElement
): string | undefined {
  if (declaration.value === ANCHOR_WIDTH) {
    switch (read.anchorWidth._tag) {
      case "length":
        return read.anchorWidth.css;
      case "minimum":
        return ownMinimum(read, element) ?? "auto";
      case "unresolved":
        return undefined;
    }
  }
  if (declaration.revertsTo !== undefined) {
    // `revert` is a CSS-wide keyword, so it stands for the whole value wherever it takes effect,
    // a `var()`'s fallback included (CSS Variables 1 §3), and rolls back to the browser's value.
    return declaration.value.replace(REVERT, declaration.revertsTo);
  }
  if (declaration.value !== ANCHOR_CENTRE) {
    return declaration.value;
  }
  if (element.attributes["data-align"] !== "center") {
    return undefined;
  }
  const size = declaration.property === "left" ? "width" : "height";
  const own = element.declarations
    .map((index) => read.declarations[index])
    .findLast((each) => each?.longhands.includes(size));
  const length = own === undefined ? undefined : evaluateLength(own.value);
  return length === undefined ? undefined : `calc(50% - ${String(length / 2)}px)`;
}

/**
 * The `min-width` the popup a positioner holds declares, which a popup set alone takes for its
 * anchor's width, or undefined where it declares none.
 */
function ownMinimum(read: CellRead, positioner: CapturedElement): string | undefined {
  const popup = read.rootOf.get(positioner) ?? positioner.children[0];
  return popup?.declarations
    .map((index) => read.declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("min-width") === true)?.value;
}

/**
 * Declarations with each border shorthand split into its longhands, as `withBorderLonghands` says.
 * A shorthand's `var()` resolves through a cascade of the declarations, unsplit, over what the
 * element inherits, on a ledger of its own so the cell's layers stay as they are. The split asks for
 * a resolved value only for a `border-width` that is one `var()`, so the cascade runs at the first
 * such ask and not for an element with none. A declaration that loses its property to a later one
 * resolves to nothing.
 */
export function splitBorders(
  scope: CellScope,
  inherited: ComputedStyle,
  applied: readonly Applied[]
): Applied[] {
  let unsplit: LayerStyle | undefined;
  const cascaded = (): LayerStyle => {
    if (unsplit === undefined) {
      const scratch = new CellLedger(scope);
      unsplit = new LayerStyle(scratch, scratch.add(inherited, applied, undefined), []);
    }
    return unsplit;
  };
  return withBorderLonghands(applied, (property, value) => {
    const style = cascaded();
    return normalizeCss(style.raw(property) ?? "") === normalizeCss(value)
      ? style.resolved(property)
      : undefined;
  });
}

/** The name of an element the kit draws no layer for: its `data-slot`, or its tag. */
export function undrawnName(element: CapturedElement): string {
  return element.attributes["data-slot"] ?? element.tag;
}

/**
 * An element placed below the last of `above`, inside the same instance parts, and inside one more
 * where it is an instance part's inner root, whose holder this visit names.
 */
export function placedBelow(
  above: readonly Placed[],
  element: CapturedElement,
  name: string,
  origin: Origin,
  holder?: Origin
): Placed {
  const around = above.at(-1)?.holders ?? [];
  return { element, name, origin, holders: holder === undefined ? around : [holder, ...around] };
}
