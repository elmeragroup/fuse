/**
 * The cascade of a component set read from its capture, as the mapping reads it through
 * {@link BoxCascade}. Chromium matched the rules and the capture resolved each element's winning
 * declarations, so each layer here applies its element's winners in cascade order over what its
 * parent passes down. `layer-style.ts` owns the rest: the cell's ledger of layers, their computed
 * styles, the reads through {@link LayerStyle}, and the coverage rows of what no layer read.
 *
 * - The page's elements and the component's own elements around the root stand around it. They pass
 *   their inherited declarations down and the kit draws none of the rest. A page element's synced
 *   variables stay out, so a `var()` of the root's keeps binding the variable rather than the value
 *   the page gives it.
 * - A part is the element below its box with the part's `data-slot`, or, for a part without one, the
 *   element at the part's place: the element-ordinal path from the nearest element with a `data-slot`,
 *   such as `field/1/0`. The elements between a box and its part pass down what they inherit.
 * - An instance part's inner root is the element below its box with the inner root's `data-slot`.
 *   The classes the composite passes it are the ones it carries beyond those the inner set's own
 *   capture shows on its root in the same inner cell, and the composite owns their rows.
 * - A declaration's row names the layer of the element whose class set it: the box itself, or the
 *   box above whose child selector reached it, and that element's origin owns the row.
 */

import { childSpacingNote } from "../components/box-cascade.ts";
import type {
  BoxCascade,
  CapturedText,
  ChildSpacing,
  InstanceScope,
  PartElement,
  MeasuredBox,
  PseudoCascade,
} from "../components/box-cascade.ts";
import { KitUnmappable } from "../components/build-errors.ts";
import { variantKey } from "../components/component-spec.ts";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  PreviewLength,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "../components/component-spec.ts";
import { routed } from "../components/coverage-log.ts";
import type { Origin } from "../components/coverage-log.ts";
import type { CapturedAt } from "../components/coverage.ts";
import { exceptLastChildClass } from "../components/css-selector.ts";
import { evaluateLength, evaluatePercentage, normalizeCss, readColor } from "../components/css-values.ts";
import type { VariableIndex, Viewport } from "../components/css-values.ts";
import { modalLayout } from "../components/fixed-placement.ts";
import type { NumberSpec } from "../components/kit-spec.ts";
import { CellLedger, inheritance, inheritsProperty, LayerStyle } from "../components/layer-style.ts";
import type {
  Applied,
  CellScope,
  CoverageNote,
  InPlace,
  Layer,
  Recorder,
} from "../components/layer-style.ts";
import { percentHeightBasis } from "../components/percent-height.ts";
import { ANCHOR_CENTRE, ANCHOR_WIDTH } from "./capture-format.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  CapturedRoot,
  SetCapture,
} from "./capture-format.ts";
import { PseudoBoxCascade, pseudoVerdict, withBorderLonghands } from "./pseudo-elements.ts";

/** Why the kit draws none of a page element's own declarations. */
const PAGE_UNDRAWN = "the page around the component, which the kit draws no layer for";

/** Why the kit draws none of an element of the component's markup around the root. */
const AROUND_UNDRAWN =
  "an element of the component's markup around the root, which the kit draws no layer for";

/** Why the kit draws none of an element between a box and its part. */
const BETWEEN_UNDRAWN = "an element between a box and its part, which the kit draws no layer for";

/**
 * Why a declaration of an element that generates no box, read by no layer and not inherited, sets
 * nothing: its parts lay out in its parent's box, and it has no box of its own to take the property
 * (CSS Display 3 §2.5).
 */
const NO_BOX_UNDRAWN =
  "the element generates no box (display: contents), so it has no box this property sets";

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
 * An element on the path from `<html>` to a box: its layer's name, the origin that owns the rows of
 * the classes it carries, and the classes on it a composite passes, whose rows the composite owns.
 */
type Placed = {
  readonly element: CapturedElement;
  readonly name: string;
  readonly origin: Origin;
  readonly passed?: { readonly classes: ReadonlySet<string>; readonly origin: Origin };
};

/** What every box of a cell reads. */
type CellRead = {
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
   * The elements below an instance part's inner root that carry classes the composite passes, such
   * as a caret glyph's, with those classes and the composite's origin, which owns their rows.
   */
  readonly passedBelow: Map<CapturedElement, NonNullable<Placed["passed"]>>;
  /**
   * The copy a placement rule made of a captured root, by the root: an anchor that stretches, or
   * the Backdrop that holds the modal popup. The cascade drew the copy, which the set's unused
   * classes read in place of the root.
   */
  readonly replaced: Map<CapturedElement, CapturedElement>;
  /** The root each element around a root holds, as a positioner holds its popup. */
  readonly rootOf: ReadonlyMap<CapturedElement, CapturedElement>;
  /**
   * The width that stands for Base UI's `--anchor-width` in the cell, as a length, or undefined where
   * the cell has no anchor of a definite width, which leaves the property unset.
   */
  readonly anchorWidth: string | undefined;
  /** The root `data-slot` of each set that holds this one as an instance, as {@link CaptureSetSource} says. */
  readonly instancedIn: ReadonlySet<string>;
  /** Each captured element of the cell, and each copy a placement rule made of one, by its place. */
  readonly places: Map<CapturedElement, string>;
  /** The cell's key, which names its captured declarations' rows. */
  readonly cell: string;
  /** Where the cell's instance parts hold their inner roots, as {@link CellAccounting} says. */
  readonly instances: InstancePlace[];
};

/**
 * Where a cell's instance part holds its inner root: the root's place in the cell, as
 * {@link CellAccounting} names places, and the inner set's key and cell, whose own capture holds the
 * same root and below it the declarations that set owns.
 */
export type InstancePlace = { readonly place: string; readonly set: string; readonly cell: string };

/**
 * What the rows of one cell account for, by the captured element and declaration. A place is the
 * measured root's index, then `around/` and the element's index among the elements around it,
 * outermost first, or `root` and the child index at each step down, as `0/root/1/0`. A declaration
 * is its place, `#`, and its index into the capture's declarations. The set's recorder collects each
 * declaration a row it records names, so one that reaches no row of the set's coverage, as a class a
 * composite passes an instance whose row the composite drops (#754), is not accounted for. The
 * cell's instance parts say where an inner set's declarations sit, which that set accounts for in its
 * own capture.
 */
export type CellAccounting = {
  readonly accounted: ReadonlySet<string>;
  readonly instances: readonly InstancePlace[];
};

/**
 * Each captured element of a cell by its place, as {@link CellAccounting} names places.
 *
 * @param cell - The captured cell.
 * @returns Each element's place.
 */
export function placesOf(cell: CapturedCell): Map<CapturedElement, string> {
  const places = new Map<CapturedElement, string>();
  const below = (element: CapturedElement, place: string): void => {
    places.set(element, place);
    element.children.forEach((child, index) => {
      below(child, `${place}/${String(index)}`);
    });
  };
  cell.roots.forEach(({ around, root }, index) => {
    around.forEach((element, at) => places.set(element, `${String(index)}/around/${String(at)}`));
    below(root, `${String(index)}/root`);
  });
  return places;
}

/** A captured declaration of an element as a row names it, or undefined for a synthetic one. */
function atOf(read: CellRead, element: CapturedElement | undefined, index: number): CapturedAt | undefined {
  const place = element === undefined ? undefined : read.places.get(element);
  return place === undefined || index >= read.declarationCount
    ? undefined
    : { cell: read.cell, declaration: `${place}#${String(index)}` };
}

/**
 * How an open composite places the elements its cells measure, as its manifest names it:
 * `anchored`, a popup beside its anchor, `sideOffset` pixels apart, as Base UI's positioner places
 * it, or `modal`, a popup fixed over the Backdrop in the viewport.
 */
export type OpenPlacement =
  | { readonly _tag: "anchored"; readonly sideOffset: number }
  | { readonly _tag: "modal"; readonly viewport: Viewport };

/** What a set's capture-backed cascade reads beside its capture. */
export type CaptureSetSource = {
  readonly capture: SetCapture;
  /** The definition the manifest gives, whose variant keys name the cells. */
  readonly definition: ComponentDefinition;
  /** The synced variables and the compiled theme values the reads substitute. */
  readonly context: BuildContext;
  /** Adds a row to the set's coverage table. */
  readonly record: Recorder;
  /** The kept capture of another set, which an instance part's inner set reads. */
  readonly captureOf: (key: string) => SetCapture | undefined;
  /** How the set places its cells' elements, undefined for a set whose cells measure one root. */
  readonly open: OpenPlacement | undefined;
  /** The width that stands for `--anchor-width` in a cell, as {@link CellRead} says. */
  readonly anchorWidth: (cell: Cell) => string | undefined;
  /**
   * The root `data-slot` of each set whose manifest holds this set as an instance part, as
   * {@link instancingSlots} reads them, such as Select popup's `select-content` around Select item.
   */
  readonly instancedIn: ReadonlySet<string>;
};

/** An element's own winning declarations, then its pseudo-elements'. */
function declarationsOf(element: CapturedElement): readonly number[] {
  return [...element.declarations, ...Object.values(element.pseudo).flat()];
}

/**
 * Whether a declaration resets its longhands to their initial values from a style sheet every page
 * applies to every element, Tailwind's preflight, Fuse's base layer or the browser's own, as the
 * base layer's `margin: 0` does. A reset sets nothing a component draws, so the cascade leaves it out,
 * and a box reads such a longhand as unset.
 */
export function isReset(
  declaration: CapturedDeclaration,
  index: number,
  initial: readonly number[]
): boolean {
  const reset =
    declaration.source === "preflight" || declaration.source === "user-agent" || declaration.layer === "base";
  return reset && initial.includes(index);
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
function spacingByChild(read: CellRead, box: CapturedElement | undefined): readonly ReadonlySet<number>[] {
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

/** Why a box's spacing declarations stay unmapped where its children do not all win them alike. */
const UNEVEN_SPACING: CoverageNote = {
  outcome: "unmapped",
  detail:
    "not every child but the last wins the class's spacing alike, or the last child wins it too, which one item spacing cannot draw",
};

/**
 * The declarations of the element at the end of `path`, less those its parent's spacing reads. Only
 * a drawn box spaces its children and records those rows, so a child of an element the kit draws no
 * layer for keeps them.
 */
function ownDeclarations(read: CellRead, path: readonly Placed[]): readonly number[] {
  const own = path.at(-1)?.element;
  const parent = path.at(-2)?.element;
  const withheld = parent !== undefined && read.drawn.has(parent) ? exceptLastOf(read, parent) : new Set();
  return (own?.declarations ?? []).filter((index) => !withheld.has(index));
}

/** The declarations of an element as the cascade applies them, in the capture's order. */
function appliedOf(
  read: CellRead,
  declarations: readonly number[],
  path: readonly Placed[],
  keep: (declaration: CapturedDeclaration) => boolean,
  initial: readonly number[] = path.at(-1)?.element.initial ?? []
): Applied[] {
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
    const origin =
      owner.passed?.classes.has(declaration.className) === true ? owner.passed.origin : owner.origin;
    const at = atOf(read, path.at(-1)?.element, index);
    return [
      {
        part: owner.name,
        className: declaration.className,
        origin,
        rank: 0,
        order,
        declarations: [{ property: declaration.property, value }],
        at,
      },
    ];
  });
}

/**
 * A declaration's value, with a symbol the capture keeps in place of Base UI's measured pixels
 * resolved. The anchor's width is the cell's anchor's as the build maps it. Where the anchor hugs its
 * text, a width the spec does not hold, the popup draws at its own `min-width`, the least Base UI
 * makes it, found on the root the positioner holds: right for an anchor narrower than that minimum,
 * as every sample's is, and too narrow for a wider one, which the kit cannot draw yet (a composite's
 * popup instance carries no `min-width` of its own). The popup's width never follows its rows. The
 * anchor's centre, along a centred popup's side, is the popup's centre less half the element's own
 * size there; for a popup aligned to the anchor's start or end it does not resolve.
 */
function resolvedValue(
  read: CellRead,
  declaration: CapturedDeclaration,
  element: CapturedElement
): string | undefined {
  if (declaration.value === ANCHOR_WIDTH) {
    return read.anchorWidth ?? ownMinimum(read, element) ?? "auto";
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

/** The name of an element the kit draws no layer for: its `data-slot`, or its tag. */
function undrawnName(element: CapturedElement): string {
  return element.attributes["data-slot"] ?? element.tag;
}

/**
 * The declarations of an `<input>`'s `::placeholder`, where it shows its placeholder: it has one and
 * no value. The kit draws the placeholder as the box's own text, so its text style applies on the box
 * after the box's own declarations, and the rest, such as its opacity, drops.
 */
function placeholderOf(read: CellRead, ledger: CellLedger, path: readonly Placed[]): Applied[] {
  const element = path.at(-1)?.element;
  const declarations = element?.pseudo.placeholder;
  if (
    element === undefined ||
    declarations === undefined ||
    element.attributes.placeholder === undefined ||
    (element.attributes.value ?? "") !== ""
  ) {
    return [];
  }
  const text = (property: string) => inheritsProperty(property, read.context);
  const applied = appliedOf(read, declarations, path, () => true, []);
  for (const {
    part,
    className,
    origin,
    declarations: [declaration],
  } of applied) {
    if (declaration !== undefined && !text(declaration.property)) {
      routed(
        ledger.scope.inPlace,
        origin
      )({
        part,
        className,
        property: declaration.property,
        value: declaration.value,
        outcome: "dropped",
        detail:
          "the kit draws the placeholder as the box's own text, which takes the placeholder's text style and not its box's",
      });
    }
  }
  return applied
    .filter(({ declarations: [declaration] }) => declaration !== undefined && text(declaration.property))
    .map((each) => ({ ...each, order: element.declarations.length + each.order }));
}

/**
 * The variants and utilities of a transition's frames, which style an element only while it enters
 * or leaves, or move it, and which a still frame of the kit never shows. A class that matched no
 * captured element drops when one of these explains it, and is unshown otherwise. Each entry is
 * a variant or utility the class carries, then why the kit draws none of it.
 */
const TRANSIENT_VARIANTS: readonly (readonly [RegExp, string])[] = [
  [
    /(^|:)data-(starting|ending)-style:/,
    "Base UI sets `data-starting-style` and `data-ending-style` only while the element enters or leaves",
  ],
  [/(^|:)starting:/, "`@starting-style` styles the element only for the frame it first renders"],
  [/(^|:)motion-(safe|reduce):/, "the variant styles the element's motion, which a still frame never shows"],
  [
    /(^|:)(animate|transition|duration|ease|delay|fade|zoom|spin|slide)(-|$)/,
    "a motion utility, which a still frame never shows",
  ],
];

/** Why a class that matched no captured element is a transition's frame, or undefined. */
function transientVariant(className: string): string | undefined {
  return [...TRANSIENT_VARIANTS, ...UNDRAWN_CHROME].find(([pattern]) => pattern.test(className))?.[1];
}

/**
 * Classes that style the browser's own chrome, which no Figma frame draws, so a rule of theirs that
 * matched no captured element drops rather than stands for a state: Base UI's
 * `base-ui-disable-scrollbar` and Tailwind's `no-scrollbar` hide a scrolling list's scrollbar, which
 * the page renders through `::-webkit-scrollbar` only while the list overflows.
 */
const UNDRAWN_CHROME: readonly (readonly [RegExp, string])[] = [
  [
    /(^|[:-])(no-scrollbar|disable-scrollbar)$/,
    "the class hides a scrolling list's scrollbar, which a static frame does not draw",
  ],
];

/** The cascade of every cell of a set, read from its capture. */
export class CaptureSetCascade {
  readonly #source: CaptureSetSource;
  readonly #context: BuildContext;
  readonly #origin: Origin;
  /** The cells the build mapped, with the elements their mapping drew and the inner roots. */
  readonly #cells: { readonly cell: CapturedCell; readonly read: CellRead }[] = [];

  /** @param source - The set's capture and what its cascade reads beside it. */
  constructor(source: CaptureSetSource) {
    this.#source = source;
    this.#context = source.context;
    this.#origin = { record: source.record };
  }

  /**
   * Start the cascade of one cell.
   *
   * @param cell - The cell.
   * @returns The cell's cascade.
   * @throws `KitUnmappable` where the capture lacks the cell, which a run of `figma:capture` adds.
   */
  cell(cell: Cell): CaptureCellCascade {
    const { capture, definition } = this.#source;
    const key = variantKey(definition, cell);
    const captured = capture.cells.find((each) => each.key === key);
    if (captured === undefined) {
      throw new KitUnmappable({
        message: `captures/${capture.set}.json has no cell ${key}; run figma:capture`,
      });
    }
    const scope: CellScope = {
      cell,
      context: this.#context,
      origin: this.#origin,
      record: this.#origin.record,
      inPlace: undefined,
    };
    const read: CellRead = {
      declarations: [...capture.declarations],
      declarationCount: capture.declarations.length,
      context: this.#context,
      captureOf: this.#source.captureOf,
      drawn: new Map(),
      inner: new Map(),
      innerOwn: new Map(),
      passedBelow: new Map(),
      replaced: new Map(),
      rootOf: new Map(
        captured.roots.flatMap(({ around, root }) => around.map((each) => [each, root] as const))
      ),
      anchorWidth: this.#source.anchorWidth(cell),
      instancedIn: this.#source.instancedIn,
      places: placesOf(captured),
      cell: captured.key,
      instances: [],
    };
    this.#cells.push({ cell: captured, read });
    return new CaptureCellCascade(read, new CellLedger(scope), capture.page, captured, this.#source.open);
  }

  /**
   * Where each cell's instance parts hold their inner roots, by the cell's key.
   *
   * @returns Each cascaded cell's instance places, as {@link CellAccounting} names them.
   */
  instancePlaces(): ReadonlyMap<string, readonly InstancePlace[]> {
    return new Map(this.#cells.map(({ cell, read }) => [cell.key, read.instances]));
  }

  /**
   * Record each class of the set's own markup that styled nothing in any cell, as dropped: a class whose variant no cell shows, such as
   * a label's `has-[>[data-slot=field]]:` arm, or a marker class such as `group/field`. The classes
   * of an instance part's inner root and the elements below it are the inner set's.
   */
  finish(): void {
    const carried = new Map<string, Set<string>>();
    const used = new Set<string>();
    // A class some rule styles, and whether a rule written for it matched in some cell.
    const styled = new Set<string>();
    const matched = new Set<string>();
    for (const { cell, read } of this.#cells) {
      const nameOf = (element: CapturedElement) => read.drawn.get(element) ?? undrawnName(element);
      const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
        const passed = read.inner.get(element);
        const name = nameOf(element);
        const classes = carried.get(name) ?? new Set();
        const unmatched = new Set(element.unmatched);
        for (const className of element.classes.filter((each) => passed?.has(each) ?? true)) {
          classes.add(className);
          const key = JSON.stringify([name, className]);
          (unmatched.has(className) ? styled : matched).add(key);
        }
        carried.set(name, classes);
        const here = [...path, element];
        for (const index of declarationsOf(element)) {
          const declaration = this.#source.capture.declarations[index];
          const owner = declaration === undefined ? undefined : here[here.length - 1 - declaration.owner];
          if (declaration !== undefined && owner !== undefined) {
            used.add(JSON.stringify([nameOf(owner), declaration.className]));
          }
        }
        if (passed !== undefined) {
          return;
        }
        for (const child of element.children) {
          visit(child, here);
        }
      };
      const visited = new Set<CapturedElement>();
      for (const { around, root } of cell.roots) {
        around.forEach((element, index) => {
          visit(element, around.slice(0, index));
        });
        // The cascade drew a placement rule's copy of the root, which holds a modal popup too.
        const drawn = read.replaced.get(root) ?? root;
        if (!visited.has(root)) {
          visit(drawn, around);
        }
        drawn.children.forEach((child) => visited.add(child));
      }
    }
    for (const [part, classes] of carried) {
      for (const className of classes) {
        const key = JSON.stringify([part, className]);
        if (used.has(key)) {
          continue;
        }
        const transient = styled.has(key) && !matched.has(key) ? transientVariant(className) : undefined;
        this.#origin.record({
          part,
          className,
          property: "",
          value: "",
          ...(!styled.has(key) || matched.has(key)
            ? {
                outcome: "dropped",
                detail: "no rule of the class wins a declaration on an element of any captured cell",
              }
            : transient === undefined
              ? {
                  outcome: "unshown",
                  detail:
                    "the class styles a state no captured cell shows: no rule written for it matched an element of any cell",
                }
              : { outcome: "dropped", detail: transient }),
        });
      }
    }
  }
}

/** A box's pseudo-element the mapping draws as a layer of its own, with its cascaded style. */
export type DrawnPseudo = { readonly pseudo: "before" | "after"; readonly style: LayerStyle };

/**
 * Cascade a box's `::before` and `::after` over the box, as the browser does. One that paints, with
 * every longhand it sets one the build reads, and that the capture measured as an absolute box laid
 * out against the box in every mode (`pseudoBoxes`), is the mapping's to draw as a layer of its own.
 * Every other one notes each declaration it sets itself as `pseudoVerdict` says.
 *
 * @returns The pseudo-elements the mapping draws, `::before` first.
 */
function readPseudoElements(
  read: CellRead,
  ledger: CellLedger,
  placed: readonly Placed[],
  layer: Layer,
  path: readonly string[]
): readonly DrawnPseudo[] {
  const own = placed.at(-1)?.element;
  const boxes: ReadonlySet<string> = new Set(own?.measured?.pseudoBoxes ?? []);
  const drawn: DrawnPseudo[] = [];
  for (const [pseudo, indexes] of Object.entries(own?.pseudo ?? {})) {
    if (pseudo === "placeholder") {
      continue;
    }
    const applied = withBorderLonghands(appliedOf(read, indexes, placed, () => true, []));
    const pseudoLayer = ledger.add(inheritance(layer, read.context), applied, layer);
    const style = new LayerStyle(ledger, pseudoLayer, [...path, `::${pseudo}`]);
    const { paints, ...note } = pseudoVerdict(style, pseudo, read.context.variables);
    if (paints && (pseudo === "before" || pseudo === "after") && boxes.has(pseudo)) {
      drawn.push({ pseudo, style });
      continue;
    }
    for (const property of style.ownProperties()) {
      style.mark(property, note.outcome, note.detail, []);
    }
  }
  return drawn.toSorted((left, right) => Number(left.pseudo === "after") - Number(right.pseudo === "after"));
}

/**
 * The elements around a root as the cascade placed them, the layer of the innermost one, and the
 * layers of the component's own elements around it, outermost first.
 */
type AroundPath = {
  readonly placed: readonly Placed[];
  readonly layer: Layer | undefined;
  readonly own: readonly { readonly element: CapturedElement; readonly layer: Layer }[];
};

/** Why a background around the root stays unmapped, where the root cannot draw it as one fill. */
const STACKED_BACKDROP =
  "the background shows behind the root through or over another paint, which one fill on the root cannot draw";

/** Why a background around the root stays unmapped, where the root or an element it shows through alters how it paints. */
const ALTERED_BACKDROP =
  "the root or an element between it and the background changes how it paints, by its opacity, corners, filter, backdrop filter, mask, clip or blend mode, which one opaque rectangular fill on the root cannot draw";

/** A box's corner radii: the shorthand, which the cascade keeps whole, and each corner's longhand. */
const CORNER_RADII = [
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
] as const;

/**
 * Whether an element changes how its background, and what shows through it, paints, beyond one
 * opaque rectangle across its box: an opacity below 1 (CSS Color 4 §15.1), a rounded corner (CSS
 * Backgrounds 3 §5), a filter (Filter Effects 1 §5), a backdrop filter, which filters what shows
 * through the element but not its own background (Filter Effects 2 §3), a mask or a clip path (CSS
 * Masking 1 §6, §7), or a blend mode other than `normal` (Compositing 1 §3.2). A value the build does
 * not read counts as a change.
 */
function altersPaint(style: LayerStyle): boolean {
  const value = (property: string, initial: string): string =>
    normalizeCss(style.resolved(property) ?? initial).toLowerCase();
  const opacity = value("opacity", "1");
  const opaque = evaluatePercentage(opacity) === 1 || Number(opacity) === 1;
  const square = CORNER_RADII.every((corner) => evaluateLength(value(corner, "0")) === 0);
  return (
    !opaque ||
    !square ||
    value("filter", "none") !== "none" ||
    value("backdrop-filter", "none") !== "none" ||
    value("-webkit-backdrop-filter", "none") !== "none" ||
    value("mask", "none") !== "none" ||
    value("mask-image", "none") !== "none" ||
    value("clip-path", "none") !== "none" ||
    value("mix-blend-mode", "normal") !== "normal"
  );
}

/**
 * The element around a root whose background the root shows across its box, where the root paints
 * none: among the elements that lie exactly behind the root, as the capture measured them, the
 * innermost whose background paints. A transparent background shows what lies further out, so the
 * search goes on past it. An opaque color hides everything further out, so it is the fill, as the
 * Sidebar Provider's wrapper paints `bg-sidebar` behind an inset panel's container. A synced
 * variable is the fill where nothing further out among them paints. A translucent color, a
 * background image, or a variable over another paint composites more than one layer, which one
 * fill cannot draw, so those backgrounds stay unmapped and the root takes none. An element with
 * padding around the root, as a popup's content around its rows, does not lie exactly behind it, so
 * its background is no fill of the root's.
 *
 * The root draws a fill it takes through its own effects, so a root that changes how it paints, as
 * {@link altersPaint} says, takes none, just as an element between it and the background does: a
 * root at half opacity would fade a background that Chromium paints whole behind it.
 *
 * The search stops at the root element of a set that holds this one as an instance, as Select
 * popup's `select-content` holds Select item's rows: that set draws the paint around its instances
 * itself, so a row that took it would paint it twice. An element no such set roots, as the Sidebar
 * Provider's wrapper, stays in the search.
 *
 * @param ledger - The cell's ledger.
 * @param root - The root's style.
 * @param around - The component's elements around the root, outermost first, with their layers.
 * @param coinciding - How many of them, innermost first, lie exactly behind the root.
 * @param variables - The synced variables a color can bind.
 * @param instancedIn - The root `data-slot` of each set that holds this one as an instance.
 * @returns The element's style, whose reads fill the root's fields, or undefined for none.
 */
function backdropAround(
  ledger: CellLedger,
  root: LayerStyle,
  around: readonly { readonly element: CapturedElement; readonly layer: Layer }[],
  coinciding: number,
  variables: VariableIndex,
  instancedIn: ReadonlySet<string>
): LayerStyle | undefined {
  const inward = around.toReversed().slice(0, coinciding);
  const holder = inward.findIndex(({ element }) => instancedIn.has(element.attributes["data-slot"] ?? ""));
  const behind = (holder === -1 ? inward : inward.slice(0, holder)).map(
    ({ layer }) => new LayerStyle(ledger, layer, [])
  );
  const image = (style: LayerStyle): boolean =>
    normalizeCss(style.resolved("background-image") ?? "none") !== "none";
  const color = (style: LayerStyle) =>
    style.has("background-color")
      ? readColor(style.resolved("background-color") ?? "", variables)
      : undefined;
  const paints = (style: LayerStyle): boolean => {
    const read = color(style);
    return (
      image(style) || (style.has("background-color") && !(read?.kind === "literal" && read.color.a === 0))
    );
  };
  const refuse = (styles: readonly LayerStyle[], detail: string = STACKED_BACKDROP): undefined => {
    for (const style of styles) {
      for (const property of ["background-color", "background-image"]) {
        style.mark(property, "unmapped", detail, []);
      }
    }
    return undefined;
  };
  for (const [index, style] of behind.entries()) {
    if (!paints(style)) {
      continue;
    }
    const read = color(style);
    const further = behind.slice(index + 1).filter(paints);
    // The background reaches the root as one opaque rectangle only where nothing from the root out
    // to the element that paints it changes how it paints.
    if ([root, ...behind.slice(0, index + 1)].some(altersPaint)) {
      return refuse([style, ...further], ALTERED_BACKDROP);
    }
    // A translucent color or an image shows what lies beneath it. A variable can be translucent in
    // some mode, so it paints the root alone only where nothing else paints beneath it.
    const solid = read?.kind === "literal" ? read.color.a >= 1 : read !== undefined && further.length === 0;
    return image(style) || !solid ? refuse([style, ...further]) : style;
  }
  return undefined;
}

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
      // The elements around the root and the root itself, from which box sizing reads the basis.
      box.heightBasis = normalizeCss(box.style.resolved("height") ?? "").includes("%")
        ? percentHeightBasis(
            [...path.own.map(({ layer }) => new LayerStyle(this.#ledger, layer, [])), box.style],
            this.#read.context.variables,
            { lengthAsDeclared: first.root.measured?.basisAsDeclared === true }
          )
        : undefined;
      return box;
    }
    if (open._tag === "anchored") {
      const path = this.#aroundPath([]);
      const placement = anchoredPlacement(this.#cell, open.sideOffset, this.#read.declarations);
      checkHuggingAnchor(this.#cell, placement, this.#read);
      const roots = placement.roots.map((each) =>
        each === placement.anchor && placement.anchorFills ? this.#withStretch(each) : each
      );
      const element = composedRoot(part, roots);
      return new CaptureBoxCascade(
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
    }
    const [popup, ...rest] = others;
    if (popup === undefined || rest.length > 0) {
      throw new KitUnmappable({
        message: `${this.#cell.key} measures ${String(this.#cell.roots.length)} elements, and a modal composite measures its Backdrop and its popup`,
      });
    }
    const layout = modalLayout(this.#detachedStyle(popup), open.viewport);
    if (layout === undefined) {
      throw new KitUnmappable({
        message: `the popup of ${this.#cell.key} is fixed neither at the viewport's centre nor a length below its top and centred across, which the Backdrop cannot place`,
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
    return { element, name, origin: this.#ledger.scope.origin };
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
      path.push({ element, name: undrawnName(element), origin });
      const own = appliedOf(
        this.#read,
        element.declarations,
        path,
        ({ property }) => !page || (inheritsProperty(property, context) && !context.variables.owns(property))
      );
      const applied = [
        ...(parent === undefined ? [initialFontSize(origin)] : []),
        // A border's sides cascade one by one, so the content height around the root reads them.
        ...(page ? own : withBorderLonghands(own)),
      ];
      parent = this.#ledger.add(
        parent === undefined ? new Map() : inheritance(parent, context),
        applied,
        parent,
        {
          undrawn,
        }
      );
      if (!page) {
        layers.push({ element, layer: parent });
      }
    }
    return { placed: path, layer: parent, own: layers };
  }

  /**
   * A modal popup's own style, read apart from the cell's layers, which the Backdrop's layout reads
   * before the popup cascades in place. Its reads record nothing.
   */
  #detachedStyle(popup: CapturedRoot): LayerStyle {
    const scope: CellScope = {
      ...this.#ledger.scope,
      origin: { record: () => undefined },
      record: () => undefined,
    };
    const ledger = new CellLedger(scope);
    const placed: Placed[] = [{ element: popup.root, name: "popup", origin: scope.origin }];
    const layer = ledger.add(
      new Map(),
      appliedOf(this.#read, popup.root.declarations, placed, () => true),
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

/**
 * An anchored composite's roots in the order the composite draws them, the root's layout, and its
 * anchor, which fills the composite across where it is block-level and its width is auto.
 */
type AnchoredPlacement = {
  readonly roots: readonly CapturedRoot[];
  readonly anchor: CapturedRoot;
  readonly anchorFills: boolean;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
};

/** The flex alignment of Base UI's `data-align`. */
const ALIGN: ReadonlyMap<string, string> = new Map([
  ["start", "flex-start"],
  ["center", "center"],
  ["end", "flex-end"],
]);

/**
 * The one rule that draws an anchored composite: Base UI's positioner puts the popup on the side
 * its `data-side` names, `sideOffset` pixels from the anchor, aligned to it as its `data-align`
 * names. The composite is a column for `top` and `bottom` and a row for `left` and `right`, with the
 * popup first on `top` and `left`, its gap the offset, and its counter alignment the popup's. An
 * anchor that is block-level with an auto width fills the composite across, as it fills the host it
 * renders in (CSS 2.1 §10.3.3); any other anchor sits as the popup aligns.
 *
 * @param cell - The cell, which measures the anchor and the popup in either order.
 * @param sideOffset - The popup's offset from the anchor, in pixels.
 * @param declarations - The capture's declarations, which the roots' indexes name.
 * @returns The roots in drawn order and the root's layout.
 * @throws `KitUnmappable` where the cell does not measure one popup that names its side and
 *   alignment beside one anchor.
 */
export function anchoredPlacement(
  cell: CapturedCell,
  sideOffset: number,
  declarations: readonly CapturedDeclaration[]
): AnchoredPlacement {
  const popups = cell.roots.filter(({ root }) => root.attributes["data-side"] !== undefined);
  const anchors = cell.roots.filter(({ root }) => root.attributes["data-side"] === undefined);
  const [popup] = popups;
  const [anchor] = anchors;
  const side = popup?.root.attributes["data-side"] ?? "";
  const align = ALIGN.get(popup?.root.attributes["data-align"] ?? "");
  if (
    popup === undefined ||
    anchor === undefined ||
    popups.length > 1 ||
    anchors.length > 1 ||
    align === undefined
  ) {
    throw new KitUnmappable({
      message: `${cell.key} measures no popup with Base UI's data-side and data-align beside one anchor`,
    });
  }
  const across = side === "left" || side === "right";
  if (!across && side !== "top" && side !== "bottom") {
    throw new KitUnmappable({
      message: `${cell.key}'s popup sits on the side ${side}, which Base UI does not name`,
    });
  }
  const winner = (longhand: string): string =>
    anchor.root.declarations
      .map((index) => declarations[index])
      .findLast((each) => each?.longhands.includes(longhand))
      ?.value.trim() ?? "";
  const blockLevel = /^(block|flex|grid|flow-root|table)$/.test(winner("display"));
  const autoWidth = winner("width") === "" || winner("width") === "auto";
  return {
    roots: side === "top" || side === "left" ? [popup, anchor] : [anchor, popup],
    anchor,
    anchorFills: !across && blockLevel && autoWidth,
    declarations: [
      { property: "display", value: "flex" },
      { property: "flex-direction", value: across ? "row" : "column" },
      { property: "align-items", value: align },
      { property: "gap", value: `${String(sideOffset)}px` },
    ],
  };
}

/**
 * The guard of the hugging-anchor rule. Where the anchor's width is not in the spec, as a trigger that
 * hugs its text, the popup draws at its own `min-width`, which is right only while the anchor is no
 * wider: Base UI makes the popup `max(anchor, minimum)`. The capture marks a popup whose anchor is
 * wider, and such a cell of a popup whose `width` reads `--anchor-width` stops the build, naming the
 * popup and its `min-width`. A popup sized otherwise, as Popover's `w-72`, does not take the anchor's
 * width, so its anchor may be any width.
 *
 * @throws `KitUnmappable` where a hugging anchor is wider than the popup's `min-width`.
 */
function checkHuggingAnchor(cell: CapturedCell, placement: AnchoredPlacement, read: CellRead): void {
  const popup = placement.roots.find((each) => each !== placement.anchor)?.root;
  // Only a popup whose width reads the anchor's takes it, as Select's `w-(--anchor-width)` does.
  const sized = popup?.declarations
    .map((index) => read.declarations[index])
    .some(
      (declaration) =>
        declaration?.longhands.includes("width") === true && declaration.value.includes("--anchor-width")
    );
  if (read.anchorWidth !== undefined || sized !== true || popup?.measured?.anchorWiderThanMinimum !== true) {
    return;
  }
  const minimum = popup.declarations
    .map((index) => read.declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("min-width") === true)?.value;
  throw new KitUnmappable({
    message: `${cell.key}: the browser widens the ${popup.attributes["data-slot"] ?? "popup"} to its anchor, which hugs its text past the popup's min-width, ${minimum ?? "unset"}, and the kit draws the popup at that min-width; give the anchor a width the spec holds, or shorten the sample's text`,
  });
}

/** The element an anchored composite's root stands for: a box holding its roots, in drawn order. */
function composedRoot(slot: string, roots: readonly CapturedRoot[]): CapturedElement {
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
    children: roots.map(({ root }) => root),
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

/**
 * The elements from below a box down to the element at a place, an element-ordinal path such as
 * `field/1/0` from the nearest element above with that `data-slot`.
 */
function elementsAtPlace(
  path: readonly { readonly element: CapturedElement }[],
  place: string
): readonly CapturedElement[] | undefined {
  const [slot, ...steps] = place.split("/");
  const from = path.findLast((placed) => placed.element.attributes["data-slot"] === slot)?.element;
  if (from === undefined) {
    return undefined;
  }
  const below: CapturedElement[] = [];
  let at = from;
  for (const step of steps) {
    const child = at.children[Number(step)];
    if (child === undefined) {
      return undefined;
    }
    below.push(child);
    at = child;
  }
  const box = path.at(-1)?.element;
  const boxAt = box === undefined ? -1 : below.indexOf(box);
  return boxAt >= 0 ? below.slice(boxAt + 1) : below;
}

/**
 * The elements from below a box down to the first one with a `data-slot` that no earlier part of the
 * box claimed, breadth first, through elements without one, or undefined where none sits below. The
 * box's parts claim their elements in DOM order, so a popup's rows each find their own.
 */
function elementsWithSlot(
  box: CapturedElement,
  slot: string,
  claimed: ReadonlySet<CapturedElement>
): readonly CapturedElement[] | undefined {
  const direct = box.children.find((child) => child.attributes["data-slot"] === slot && !claimed.has(child));
  if (direct !== undefined) {
    return [direct];
  }
  for (const child of box.children) {
    if (child.attributes["data-slot"] !== undefined) {
      continue;
    }
    const below = elementsWithSlot(child, slot, claimed);
    if (below !== undefined) {
      return [child, ...below];
    }
  }
  return undefined;
}

/**
 * What a composite's instance part takes from the inner set's own capture: the classes the composite
 * passes the inner root, those it carries in the composite's capture beyond the ones the inner set's
 * own capture shows on its root in the same inner cell, that root, and the inner cell's key.
 */
type InstanceClasses = {
  readonly passed: ReadonlySet<string>;
  readonly own: CapturedElement;
  readonly capture: SetCapture;
  readonly cell: string;
};

function passedClasses(
  read: CellRead,
  root: CapturedElement,
  set: string,
  cell: Cell,
  part: string
): InstanceClasses {
  const capture = read.captureOf(set);
  const inner = capture?.cells.find((each) =>
    Object.entries(cell).every(([axis, value]) => each.cell[axis] === value)
  );
  const own = inner?.roots[0].root;
  if (own === undefined || inner === undefined || capture === undefined) {
    throw new KitUnmappable({
      message: `the instance part ${part} shows ${set}, whose kept capture lacks the cell ${JSON.stringify(cell)}, so the build cannot tell the classes the composite passes`,
    });
  }
  const ownClasses = new Set(own.classes);
  return {
    passed: new Set(root.classes.filter((className) => !ownClasses.has(className))),
    own,
    capture,
    cell: inner.key,
  };
}

/**
 * What a composite's root holds beyond its element's: the elements below it down to each root its
 * cell measures, by the root's `data-slot`, and its placement rule's declarations.
 */
type ComposedRoot = {
  readonly rooted: ReadonlyMap<string, readonly CapturedElement[]>;
  readonly applied: readonly Applied[];
};

/** A box that holds no other root. */
const PLAIN: ComposedRoot = { rooted: new Map(), applied: [] };

/**
 * Whether an element's own winning `visibility` shows it, or undefined where it wins none, or one,
 * such as `inherit`, that leaves the inherited value.
 */
function declaredVisibility(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): boolean | undefined {
  const value = element.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.property === "visibility")?.value;
  const keyword = value === undefined ? undefined : normalizeCss(value);
  return keyword === "visible" ? true : keyword === "hidden" || keyword === "collapse" ? false : undefined;
}

/** The cascade of one box, read from its element in the capture. */
class CaptureBoxCascade implements BoxCascade {
  readonly style: LayerStyle;
  readonly path: readonly string[];
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #placed: readonly Placed[];
  readonly #layer: Layer;
  readonly #rooted: ReadonlyMap<string, readonly CapturedElement[]>;
  /** How many element children the box's element holds in the capture. */
  readonly elementChildren: number | undefined;
  /** The tag of the box's element in the capture. */
  readonly elementTag: string | undefined;
  /** The text the box's element holds as its own in the capture. */
  readonly elementText: string | undefined;
  /** Whether the box's element sets its `::marker` a `content` beyond `normal` or `none`. */
  readonly markerContent: boolean | undefined;
  /** What the capture measured of the box's element. */
  readonly measured: MeasuredBox | undefined;
  /** The content height around a root whose height is a percentage, as {@link percentHeightBasis} reads it. */
  heightBasis: PreviewLength | undefined = undefined;
  /** The box's pseudo-elements the mapping draws as layers, as `readPseudoElements` keeps them. */
  readonly pseudoElements: readonly PseudoCascade[];

  /**
   * @param read - The cell's declarations.
   * @param ledger - The ledger of the scope the box cascades in.
   * @param placed - The elements from `<html>` down to the box's, with their layer names.
   * @param parent - The layer of the element above the box.
   * @param path - The keys of the layers from the root down to the box's.
   * @param composed - What a composite's root holds beyond its element's.
   * @param undrawn - Why the box's own declarations that no layer reads set nothing, for an element
   *   that generates no box, or undefined.
   */
  constructor(
    read: CellRead,
    ledger: CellLedger,
    placed: readonly Placed[],
    parent: Layer | undefined,
    path: readonly string[],
    composed: ComposedRoot = PLAIN,
    undrawn?: string
  ) {
    this.#read = read;
    this.#ledger = ledger;
    this.#placed = placed;
    this.#rooted = composed.rooted;
    const own = placed.at(-1);
    if (own !== undefined) {
      read.drawn.set(own.element, own.name);
    }
    this.#layer = ledger.add(
      parent === undefined ? new Map() : inheritance(parent, read.context),
      [
        ...appliedOf(read, ownDeclarations(read, placed), placed, () => true),
        ...placeholderOf(read, ledger, placed),
        ...composed.applied,
      ],
      parent,
      undrawn === undefined ? undefined : { undrawn }
    );
    this.style = new LayerStyle(ledger, this.#layer, path);
    this.path = path;
    this.pseudoElements = readPseudoElements(read, ledger, placed, this.#layer, path).map(
      ({ pseudo, style }) => ({ pseudo, cascade: new PseudoBoxCascade(style, ledger.scope.inPlace) })
    );
    this.elementChildren = own?.element.children.length;
    this.elementTag = own?.element.tag;
    this.elementText = own?.element.text;
    // The capture records a `::marker` only where it sets such a `content`.
    this.markerContent = own === undefined ? undefined : own.element.pseudo.marker !== undefined;
    // The parent the capture measured is the box's frame only where the kit draws that element.
    const above = placed.at(-2)?.element;
    this.measured =
      own === undefined
        ? undefined
        : measuredBox(own.element, read.declarations, above !== undefined && read.drawn.has(above));
  }

  spaceChildren(children: number | undefined, spacing?: ChildSpacing): NumberSpec | undefined {
    const own = this.#placed.at(-1);
    const byChild = spacingByChild(this.#read, own?.element);
    const indexes = [...new Set(byChild.flatMap((held) => [...held]))];
    const withheld = indexes.flatMap((index) => {
      const declaration = this.#read.declarations[index];
      return declaration === undefined ? [] : [{ ...declaration, index }];
    });
    if (own === undefined || withheld.length === 0) {
      return undefined;
    }
    // One item spacing draws the class only where every child but the last wins all of it and the
    // last child none, as CSS gives it where nothing on a child outranks it.
    const even =
      byChild.at(-1)?.size === 0 &&
      byChild.slice(0, -1).every((held) => indexes.every((index) => held.has(index)));
    const spaced =
      even && children !== undefined && children > 1
        ? spacing?.(withheld.map(({ property, value }) => ({ property, value })))
        : undefined;
    const note = even ? childSpacingNote(children) : UNEVEN_SPACING;
    // The box's row of a class accounts for each child's declaration of it.
    const childrenAt = (index: number): readonly CapturedAt[] =>
      byChild.flatMap((held, at) =>
        held.has(index) ? (atOf(this.#read, own.element.children[at], index) ?? []) : []
      );
    for (const { className, property, value, index } of withheld) {
      const origin = own.passed?.classes.has(className) === true ? own.passed.origin : own.origin;
      routed(
        this.#layer.inPlace,
        origin
      )({
        part: own.name,
        className,
        property,
        value,
        ...(spaced?.notes.get(property) ?? note),
        at: childrenAt(index),
      });
    }
    return spaced?.itemSpacing;
  }

  inPlace(): InPlace | undefined {
    return this.#ledger.scope.inPlace;
  }

  part(part: string, element: PartElement): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined
        ? undefined
        : element.slot !== undefined
          ? (this.#rooted.get(element.slot) ?? elementsWithSlot(box, element.slot, this.#claimed))
          : element.place === undefined
            ? undefined
            : elementsAtPlace(this.#placed, element.place);
    // An optional part the composite turns off is not in its markup; the inner set's own capture of
    // the same cell holds it, as the instance draws it hidden.
    const own = box === undefined || element.optional !== true ? undefined : this.#read.innerOwn.get(box);
    const borrowed =
      (found === undefined || found.length === 0) && own !== undefined && element.slot !== undefined
        ? elementsWithSlot(own.root, element.slot, new Set())?.map((each) =>
            adopted(this.#read, each, own.capture)
          )
        : undefined;
    const elements = borrowed ?? found;
    if (borrowed === undefined && found?.[0] !== undefined) {
      this.#checkTextSide(found[0], `the part ${part}`, element.after === "label" ? "after" : "before");
    }
    if (elements === undefined || elements.length === 0) {
      throw new KitUnmappable({
        message: `the capture holds no element for the part ${part} below ${this.#placed.at(-1)?.name ?? "the root"}, ${element.slot === undefined ? `at the place ${element.place ?? "the manifest leaves unnamed"}` : `with data-slot ${element.slot}`}`,
      });
    }
    // An element that generates no box hands its parts to this box, so its own path is this box's.
    const noBox = elements.at(-1)?.measured?.noBox === true;
    return this.#below(
      elements,
      part,
      this.#ledger,
      noBox ? this.path : [...this.path, element.key],
      undefined,
      noBox ? NO_BOX_UNDRAWN : undefined
    );
  }

  instance(
    part: string,
    element: { readonly slot: string | undefined; readonly set: string; readonly after?: "label" },
    scope: InstanceScope
  ): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined || element.slot === undefined
        ? undefined
        : (this.#rooted.get(element.slot) ?? elementsWithSlot(box, element.slot, this.#claimed));
    const root = found?.at(-1);
    if (found?.[0] !== undefined && this.#rooted.size === 0) {
      this.#checkTextSide(
        found[0],
        `the instance part ${part}`,
        element.after === "label" ? "after" : "before"
      );
    }
    if (found === undefined || root === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no inner root ${element.slot ?? "without a data-slot"} for the instance part ${part}`,
      });
    }
    const { passed, own, capture, cell } = passedClasses(this.#read, root, element.set, scope.cell, part);
    const place = this.#read.places.get(root);
    if (place !== undefined) {
      this.#read.instances.push({ place, set: element.set, cell });
    }
    this.#read.inner.set(root, passed);
    this.#read.innerOwn.set(root, { root: own, capture });
    for (const [below, classes] of passedBelowRoot(root, own)) {
      this.#read.passedBelow.set(below, { classes, origin: scope.passed.origin });
    }
    const inner: CellScope = {
      cell: scope.cell,
      context: this.#ledger.scope.context,
      origin: scope.inPlace.inner,
      record: scope.inPlace.inner.record,
      inPlace: scope.inPlace,
    };
    return this.#below(found, part, this.#ledger.withScope(inner), [], {
      classes: passed,
      origin: scope.passed.origin,
    });
  }

  /** Cascade the elements down to a part's, the last of `elements`, below this box. */
  #below(
    elements: readonly CapturedElement[],
    part: string,
    ledger: CellLedger,
    path: readonly string[],
    passed: Placed["passed"],
    undrawn?: string
  ): BoxCascade {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent = this.#layer;
    const placed = [...this.#placed];
    for (const between of elements.slice(0, -1)) {
      placed.push({ element: between, name: undrawnName(between), origin });
      parent = this.#ledger.add(
        inheritance(parent, context),
        appliedOf(this.#read, between.declarations, placed, ({ property }) =>
          inheritsProperty(property, context)
        ),
        parent,
        { undrawn: BETWEEN_UNDRAWN }
      );
    }
    const target = elements.at(-1);
    if (target !== undefined) {
      this.#claimed.add(target);
      const own: Placed = { element: target, name: part, origin: ledger.scope.origin };
      const passedHere = passed ?? this.#read.passedBelow.get(target);
      placed.push(passedHere === undefined ? own : { ...own, passed: passedHere });
    }
    return new CaptureBoxCascade(this.#read, ledger, placed, parent, path, PLAIN, undrawn);
  }

  /**
   * Cascade the element the box holds its label's text in, as a Sidebar row holds its label in a
   * `<span>`, where a rule of a class above the element reaches it, as `[&>span:last-child]:truncate`
   * does. The element is the box's child of the label's tag that holds a text node and no
   * `data-slot`, and the label is the box's last layer. Its path is the text layer's.
   *
   * @param element - Whether the label is the box's last layer, and the label's key.
   * @returns The element's style, or undefined where no rule of a class above it reaches it, so the
   *   label reads this box's style.
   */
  labelElement(element: {
    readonly last: boolean;
    readonly key: string;
  }): { readonly style: LayerStyle; readonly measured: MeasuredBox } | undefined {
    const box = this.#placed.at(-1);
    if (box === undefined || !element.last) {
      return undefined;
    }
    const held = box.element.children.find(
      (child) =>
        child.textIndex !== undefined &&
        child.attributes["data-slot"] === undefined &&
        !this.#claimed.has(child)
    );
    // A declaration's `owner` counts the steps up to the element whose class its rule names: 0 for
    // the element itself, so any higher count names the box or an element above it.
    if (
      held === undefined ||
      !held.declarations.some((index) => (this.#read.declarations[index]?.owner ?? 0) > 0)
    ) {
      return undefined;
    }
    this.#claimed.add(held);
    const placed = [...this.#placed, { element: held, name: undrawnName(held), origin: box.origin }];
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#read.context),
      appliedOf(this.#read, held.declarations, placed, () => true),
      this.#layer
    );
    return {
      style: new LayerStyle(this.#ledger, layer, [...this.path, element.key]),
      measured: measuredBox(held, this.#read.declarations, false),
    };
  }

  capturedText(attribute: string | undefined): CapturedText {
    const element = this.#placed.at(-1)?.element;
    if (element === undefined) {
      return { _tag: "Unresolved", reason: "the capture holds no element for the label's box" };
    }
    const visible = normalizeCss(this.style.resolved("visibility") ?? "visible") === "visible";
    if (attribute !== undefined) {
      const value = element.attributes[attribute];
      return value === undefined
        ? { _tag: "Unresolved", reason: `the element holds no \`${attribute}\` attribute` }
        : visible
          ? { _tag: "Painted", source: "attribute", text: value }
          : { _tag: "Hidden" };
    }
    const pieces: string[] = [];
    let painted = visible;
    // An element's own text sits after the element children its `textIndex` counts, and an element
    // a layer draws holds a part's text, not the label's.
    const walk = (at: CapturedElement, shown: boolean): void => {
      const own = (): void => {
        if (shown && at.text !== "") {
          pieces.push(at.text);
          painted = true;
        }
      };
      const index = at.textIndex ?? at.children.length;
      at.children.forEach((child, place) => {
        if (place === index) {
          own();
        }
        if (!this.#read.drawn.has(child)) {
          walk(child, declaredVisibility(child, this.#read.declarations) ?? shown);
        }
      });
      if (index >= at.children.length) {
        own();
      }
    };
    walk(element, visible);
    return painted ? { _tag: "Painted", source: "nodes", text: pieces.join("") } : { _tag: "Hidden" };
  }

  icon(slot: IconSlot): LayerStyle {
    this.#icons ??= iconPaths(this.#placed.at(-1)?.element);
    // An icon is an `<svg>` the box holds itself, or one inside a wrapper, as a pending Button's
    // spinner sits in a span, and it marks its side with `data-icon` where the slot names one.
    const matches = (path: readonly CapturedElement[]): boolean =>
      (slot.direct ? path.length === 1 : path.length > 1) &&
      path[0]?.attributes["data-icon"] === slot.dataIcon;
    const at = this.#icons.findIndex(matches);
    // An optional icon the composite turns off is not in its markup; the inner set's own capture of
    // the same cell holds it, as the instance draws it hidden.
    const box = this.#placed.at(-1)?.element;
    const own = box === undefined ? undefined : this.#read.innerOwn.get(box);
    const [found] =
      at >= 0
        ? this.#icons.splice(at, 1)
        : slot.optional === undefined || own === undefined
          ? []
          : iconPaths(own.root)
              .filter(matches)
              .map((path) => path.map((each) => adopted(this.#read, each, own.capture)));
    if (found === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no <svg> for the icon ${slot.name} of ${this.#placed.at(-1)?.name ?? "the root"}`,
      });
    }
    if (at >= 0) {
      this.#checkTextSide(found[0], `the icon ${slot.name}`, slot.side === "start" ? "before" : "after");
    }
    return this.#below(found, slot.name, this.#ledger, [...this.path, slot.key], undefined).style;
  }

  /**
   * Check that a child of the box draws on the side of the box's own text its definition names: an
   * icon on its `side`, a part after the text where it is `after: "label"` and before it otherwise,
   * by its place in the markup and its `order`. A box without text of its own, and a child out of
   * the flow, have no side to check.
   *
   * @throws `KitUnmappable` where the captured markup puts the child on the other side.
   */
  #checkTextSide(child: CapturedElement | undefined, what: string, side: "before" | "after"): void {
    const box = this.#placed.at(-1)?.element;
    const textIndex = box?.textIndex;
    const index = child === undefined || box === undefined ? -1 : box.children.indexOf(child);
    if (textIndex === undefined || index < 0) {
      return;
    }
    // A flex item's `order` moves it past the text, an anonymous item at order 0 (CSS Flexbox 1
    // §5.4), as a pending Button's `order-first` draws its spinner first.
    const winner = (longhand: string): string | undefined =>
      child?.declarations
        .map((each) => this.#read.declarations[each])
        .findLast((declaration) => declaration?.longhands.includes(longhand) === true)
        ?.value.trim();
    // An absolute or fixed child sits out of the flow, where its offsets place it.
    if (/^(absolute|fixed)$/.test(winner("position") ?? "")) {
      return;
    }
    const order = Number(winner("order") ?? "0");
    const before = order === 0 || Number.isNaN(order) ? index < textIndex : order < 0;
    if (before !== (side === "before")) {
      throw new KitUnmappable({
        message: `${what} of ${this.#placed.at(-1)?.name ?? "the root"} sits ${before ? "before" : "after"} the box's text in the capture, and its definition puts it ${side}`,
      });
    }
  }

  /** The elements the box's parts, instance parts and icons claimed so far. */
  readonly #claimed = new Set<CapturedElement>();

  /** The box's icons not read yet, each as the elements from below the box down to its `<svg>`. */
  #icons: CapturedElement[][] | undefined;
}

/**
 * The icons of a box in DOM order, each as the elements from below the box down to its `<svg>`. The
 * walk enters an element without a `data-slot`, and one that marks an icon's side with `data-icon`,
 * as the span around a pending Button's spinner does, but no other part.
 */
function iconPaths(box: CapturedElement | undefined): CapturedElement[][] {
  const found: CapturedElement[][] = [];
  const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
    for (const child of element.children) {
      const here = [...path, child];
      if (child.tag === "svg") {
        found.push(here);
      } else if (child.attributes["data-slot"] === undefined || child.attributes["data-icon"] !== undefined) {
        visit(child, here);
      }
    }
  };
  if (box !== undefined) {
    visit(box, []);
  }
  return found;
}

/**
 * Whether the root of some cell of a capture casts a shadow, a winning `box-shadow` other than
 * `none`, or clips its content, a winning `overflow` other than `visible`. An anchored or modal
 * composite's roots count as the cell's.
 *
 * @param capture - The capture.
 * @returns True where some cell's root does either.
 */
export function castsShadowOrClips(capture: SetCapture): boolean {
  return capture.cells.some(({ roots }) =>
    roots.some(({ root }) =>
      root.declarations.some((index) => {
        const declaration = capture.declarations[index];
        if (declaration === undefined) {
          return false;
        }
        const { longhands, value } = declaration;
        return (
          (longhands.includes("box-shadow") && value.trim() !== "none") ||
          (longhands.some((longhand) => longhand.startsWith("overflow")) && !/^visible$/.test(value.trim()))
        );
      })
    )
  );
}

/**
 * The parts of a definition whose element wins a `scale` in some cell of its capture, as Switch's
 * thumb does while off, found by slot or by place as the cascade finds them, each box's parts
 * claiming their elements in order. The build draws each as a slot around a dot in every cell, so
 * every cell has the same layer tree.
 *
 * @param capture - The set's capture.
 * @param parts - The definition's parts.
 * @returns The parts that scale.
 */
export function partsThatScaleIn(
  capture: SetCapture,
  parts: readonly (PartDefinition | InstanceDefinition)[]
): ReadonlySet<PartDefinition> {
  const found = new Set<PartDefinition>();
  const scales = (element: CapturedElement): boolean =>
    element.declarations.some((index) => capture.declarations[index]?.longhands.includes("scale") === true);
  const visit = (
    box: readonly { readonly element: CapturedElement }[],
    below: readonly (PartDefinition | InstanceDefinition)[]
  ): void => {
    const claimed = new Set<CapturedElement>();
    const element = box.at(-1)?.element;
    for (const part of below) {
      const slot = "kind" in part ? (part.slot ?? part.of.slot) : part.slot;
      const elements =
        element === undefined
          ? undefined
          : slot !== undefined
            ? elementsWithSlot(element, slot, claimed)
            : "kind" in part || part.place === undefined
              ? undefined
              : elementsAtPlace(box, part.place);
      const target = elements?.at(-1);
      if (target === undefined || elements === undefined) {
        continue;
      }
      claimed.add(target);
      if (!("kind" in part)) {
        if (scales(target)) {
          found.add(part);
        }
        visit([...box, ...elements.map((each) => ({ element: each }))], part.parts ?? []);
      }
    }
  };
  for (const { roots } of capture.cells) {
    for (const { root } of roots) {
      visit([{ element: root }], parts);
    }
  }
  return found;
}

/**
 * An element of another set's capture, and the elements below it, with its declarations added to
 * the cell's, so their indexes name them there.
 */
function adopted(
  read: CellRead,
  element: CapturedElement,
  from: SetCapture,
  added: Map<number, number> = new Map()
): CapturedElement {
  const index = (each: number): number => {
    const known = added.get(each);
    const declaration = from.declarations[each];
    if (known !== undefined || declaration === undefined) {
      return known ?? each;
    }
    read.declarations.push(declaration);
    added.set(each, read.declarations.length - 1);
    return read.declarations.length - 1;
  };
  return {
    ...element,
    declarations: element.declarations.map(index),
    initial: element.initial.map(index),
    pseudo: Object.fromEntries(Object.entries(element.pseudo).map(([name, list]) => [name, list.map(index)])),
    children: element.children.map((child) => adopted(read, child, from, added)),
  };
}

/**
 * The elements below an instance part's inner root in the composite's capture that carry classes
 * beyond the ones the same element carries in the inner set's own capture, with those classes. The
 * walk pairs the two trees' children by position while their tags agree.
 */
function passedBelowRoot(
  inPlace: CapturedElement,
  own: CapturedElement
): ReadonlyMap<CapturedElement, ReadonlySet<string>> {
  const found = new Map<CapturedElement, ReadonlySet<string>>();
  const visit = (here: CapturedElement, there: CapturedElement): void => {
    for (const [index, child] of here.children.entries()) {
      const twin = there.children[index];
      if (twin === undefined || twin.tag !== child.tag) {
        continue;
      }
      const ownClasses = new Set(twin.classes);
      const extra = child.classes.filter((className) => !ownClasses.has(className));
      if (extra.length > 0) {
        found.set(child, new Set(extra));
      }
      visit(child, twin);
    }
  };
  visit(inPlace, own);
  return found;
}

/** Why the build draws a box's text, or its wrapping row, on one line. */
const MEASURED_ONE_LINE = "the capture measured it on one line in this cell";

/** Why the build draws a box under its `max-height`. */
const MEASURED_UNDER_MAX_HEIGHT = "the capture measured it under its max-height";

/**
 * What the capture measured of a box's element, as the mapping reads it. A `max-height` that reads
 * Base UI's measured `--available-height` is the page's room, not the box's, so the box's measured
 * height under it says nothing about the set. `parentSpansBlock` speaks of the element's parent, so
 * it holds only where `drawnParent` says the kit draws that parent as the box's frame.
 */
function measuredBox(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[],
  drawnParent: boolean
): MeasuredBox {
  const facts = element.measured;
  const maxHeight = element.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("max-height") === true);
  const holds = (each: CapturedElement): boolean =>
    each.measured?.widest === true || each.children.some(holds);
  return {
    fitsOneLine: facts?.oneLine === true ? MEASURED_ONE_LINE : undefined,
    underMaxHeight:
      facts?.underMaxHeight === true && maxHeight?.value.includes("--available-") !== true
        ? MEASURED_UNDER_MAX_HEIGHT
        : undefined,
    underMaxWidth: facts?.underMaxWidth === true,
    freeAlongMain: facts?.freeAlongMain === true,
    fitsAlongMain: facts?.fitsAlongMain === true,
    itemsAtContent: facts?.itemsAtContent === true,
    tableTiles: facts?.tableTiles === true,
    inlineRow: facts?.inlineRow === true,
    widest: facts?.widest === true,
    holdsWidest: holds(element),
    lineFits: facts?.lineFits === true,
    ellipsisFits: facts?.ellipsisFits === true,
    trackFits: facts?.trackFits === true,
    ratioHeight: facts?.ratioHeight,
    gridHugs: facts?.gridHugs ?? [],
    gridHolds: facts?.gridHolds ?? [],
    gridWidest: facts?.gridWidest ?? [],
    gridTallest: facts?.gridTallest ?? [],
    gridItems: facts?.gridItems,
    gridItem: facts?.gridItem,
    noBox: facts?.noBox === true,
    parentSpansBlock: drawnParent && facts?.parentSpansBlock === true,
    oneLength: new Set(facts?.oneLength ?? []),
  };
}
