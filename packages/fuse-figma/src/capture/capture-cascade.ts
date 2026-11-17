/**
 * The cascade of a component set read from its capture, as the mapping reads it through
 * {@link BoxCascade}. Chromium matched the rules and the capture resolved each element's winning
 * declarations, so each layer here applies its element's winners in cascade order over what its
 * parent passes down. The rest is the recipe cascade's: the layers, their computed styles, the reads
 * through {@link LayerStyle} and the coverage rows of what no layer read.
 *
 * - The page's elements and the component's own elements around the root stand around it, as the
 *   recipe cascade's page and ancestors do. They pass their inherited declarations down and the kit
 *   draws none of the rest. A page element's synced variables stay out, so a `var()` of the root's
 *   keeps binding the variable as the recipe cascade's page leaves it.
 * - A part is the element below its box with the part's `data-slot`, or, for a part without one, the
 *   element at the part's place: the element-ordinal path from the nearest element with a `data-slot`,
 *   such as `field/1/0`. The elements between a box and its part pass down what they inherit.
 * - An instance part's inner root is the element below its box with the inner root's `data-slot`.
 *   The classes the composite passes it are the ones it carries beyond those the inner set's own
 *   capture shows on its root in the same inner cell, and the composite owns their rows.
 * - A declaration's row names the layer of the element whose class set it: the box itself, or the
 *   box above whose child selector reached it, and that element's origin owns the row.
 */

import { percentHeightBasis } from "../components/box-sizing.ts";
import { KitUnmappable } from "../components/build-errors.ts";
import {
  CellLedger,
  childSpacingNote,
  inheritance,
  inheritsProperty,
  LayerStyle,
} from "../components/cascade.ts";
import type {
  Applied,
  BoxCascade,
  CellScope,
  ChildSpacing,
  CoverageNote,
  InPlace,
  InstanceScope,
  Layer,
  PartElement,
  MeasuredBox,
  Recorder,
} from "../components/cascade.ts";
import { variantKey } from "../components/component-spec.ts";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  PreviewLength,
  IconSlot,
  InstanceDefinition,
  OuterDeclaration,
  PartDefinition,
} from "../components/component-spec.ts";
import { CascadeLogs, routed } from "../components/coverage-log.ts";
import type { Origin } from "../components/coverage-log.ts";
import { exceptLastChildClass } from "../components/css-selector.ts";
import { evaluateLength, normalizeCss, readColor, splitTopLevel } from "../components/css-values.ts";
import type { VariableIndex, Viewport } from "../components/css-values.ts";
import { modalLayout } from "../components/fixed-placement.ts";
import type { NumberSpec } from "../components/kit-spec.ts";
import type { StateTable } from "../components/state-table.ts";
import { ANCHOR_CENTRE, ANCHOR_WIDTH } from "./capture-format.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  CapturedRoot,
  SetCapture,
} from "./capture-format.ts";

/** Why the kit draws none of a page element's own declarations. */
const PAGE_UNDRAWN = "the page around the component, which the kit draws no layer for";

/** Why the kit draws none of an element of the component's markup around the root. */
const AROUND_UNDRAWN =
  "an element of the component's markup around the root, which the kit draws no layer for";

/** Why the kit draws none of an element between a box and its part. */
const BETWEEN_UNDRAWN = "an element between a box and its part, which the kit draws no layer for";

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
    specificity: [0, 0, 0],
    order: -1,
    declarations: [{ property: "font-size", value: "16px" }],
  };
}

/**
 * The names the capture gives a rule that selects through no class and the page or the reset sets
 * on every element, whose unread rows drop as the recipe cascade's base layer's do.
 */
const BASE_NAMES = ["fuse.css base layer", "tailwind preflight", "user agent"] as const;

/**
 * The state table of a capture-backed cell. The capture holds what each cell's variants did, so no
 * read of a variant's meaning happens, and one is a defect.
 */
const NO_STATE_TABLE: StateTable = (variant) => {
  throw new Error(
    `the capture-backed cascade read the meaning of ${variant}, which the capture already holds`
  );
};

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
};

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
};

/**
 * Whether a declaration resets its longhands to their initial values from a style sheet every page
 * applies to every element, Tailwind's preflight, Fuse's base layer or the browser's own, as the
 * base layer's `margin: 0` does. A reset sets nothing a component draws, so the cascade leaves it out,
 * as the recipe cascade never modelled them, and a box reads such a longhand as unset.
 */
function isReset(declaration: CapturedDeclaration, index: number, initial: ReadonlySet<number>): boolean {
  const reset =
    declaration.source === "preflight" || declaration.source === "user-agent" || declaration.layer === "base";
  return reset && initial.has(index);
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
 * The spacing declarations any element child of a box wins. The box's spacing reads them, so its
 * children leave them out, as the recipe cascade keeps a box's except-last rules on the box.
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
  initial: ReadonlySet<number> = new Set(path.at(-1)?.element.initial ?? [])
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
    return [
      {
        part: owner.name,
        className: declaration.className,
        origin,
        rank: 0,
        specificity: [0, 0, 0],
        order,
        declarations: [{ property: declaration.property, value }],
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
  const applied = appliedOf(read, declarations, path, () => true, new Set());
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
  readonly #logs = new CascadeLogs();
  /** The cells the build mapped, with the elements their mapping drew and the inner roots. */
  readonly #cells: { readonly cell: CapturedCell; readonly read: CellRead }[] = [];

  /** @param source - The set's capture and what its cascade reads beside it. */
  constructor(source: CaptureSetSource) {
    this.#source = source;
    this.#context = {
      ...source.context,
      base: [
        ...source.context.base,
        ...BASE_NAMES.map((className) => ({ className, property: "", value: "" })),
      ],
    };
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
      meaningOf: NO_STATE_TABLE,
      cell,
      context: this.#context,
      origin: this.#origin,
      record: this.#origin.record,
      logs: this.#logs,
      inPlace: undefined,
    };
    const read: CellRead = {
      declarations: [...capture.declarations],
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
    };
    this.#cells.push({ cell: captured, read });
    return new CaptureCellCascade(read, new CellLedger(scope), capture.page, captured, this.#source.open);
  }

  /**
   * Record what the set's logs hold once every cell has cascaded, and each class of the set's own
   * markup that styled nothing in any cell, as dropped: a class whose variant no cell shows, such as
   * a label's `has-[>[data-slot=field]]:` arm, or a marker class such as `group/field`. The classes
   * of an instance part's inner root and the elements below it are the inner set's.
   */
  finish(): void {
    this.#logs.finish(this.#origin.record);
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
        for (const index of [...element.declarations, ...Object.values(element.pseudo).flat()]) {
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

/**
 * The longhands a pseudo-element's style can set and still paint nothing a box shows: its place,
 * size, spacing and box model, its border and outline styles and colors, which a zero width or no
 * style leaves unpainted, its background's placement, which no image paints, the text style a
 * pseudo-element with no text draws nothing with, and its motion.
 */
const PSEUDO_SILENT = new RegExp(
  `^(?:${[
    "--.*",
    "position",
    "top|right|bottom|left|inset.*",
    "(?:min-|max-)?(?:width|height)",
    "(?:margin|padding)(?:-.*)?",
    "box-sizing|display|pointer-events|z-index|cursor|unicode-bidi|visibility|opacity",
    "border-(?:.*-)?radius",
    "outline-(?:color|offset|width)",
    "background-(?:position.*|size|repeat|clip|origin|attachment)",
    "color|font.*|line-height|letter-spacing|text-.*|white-space.*|word-.*",
    "transition.*|animation.*|transform.*|translate|rotate|scale|will-change",
  ].join("|")})$`
);

/** The border styles that draw no border, whatever its width (CSS Backgrounds 3 §4.2). */
const NO_BORDER = new Set(["none", "hidden"]);

/** The border width keywords, each above zero (CSS Backgrounds 3 §4.3). */
const WIDTH_KEYWORDS: ReadonlyMap<string, number> = new Map([
  ["thin", 1],
  ["medium", 3],
  ["thick", 5],
]);

/** The border styles a `border` shorthand names (CSS Backgrounds 3 §4.2). */
const BORDER_STYLES = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/** The sides of a box, in the order a one-to-four-value shorthand names them. */
const SIDES = ["top", "right", "bottom", "left"] as const;

/** The values of a one-to-four-value shorthand for each side, top, right, bottom and left (CSS Backgrounds 3 §4). */
function perSide(values: readonly string[]): readonly string[] | undefined {
  const [top, right, bottom, left] = values;
  if (top === undefined || values.length > 4) {
    return undefined;
  }
  const across = right ?? top;
  return [top, across, bottom ?? top, left ?? across];
}

/**
 * A border shorthand as the longhands it sets, each side's width, style and color, with the initial
 * value for a part it leaves out: `medium`, `none` and `currentcolor` (CSS Backgrounds 3 §4). A
 * `border` or a side's shorthand names each part at most once, in any order. Undefined for a
 * property that is no border shorthand, and for one whose parts the build cannot tell apart, as a
 * `var()` that stands for one of them.
 */
function borderLonghands(
  property: string,
  value: string
): readonly (readonly [string, string])[] | undefined {
  const tokens = splitTopLevel(normalizeCss(value), " ");
  const side = /^border(?:-(top|right|bottom|left))?$/.exec(property);
  if (side !== null) {
    let width: string | undefined;
    let lineStyle: string | undefined;
    let color: string | undefined;
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (token.includes("var(")) {
        return undefined;
      }
      if (BORDER_STYLES.has(lower) && lineStyle === undefined) {
        lineStyle = lower;
      } else if ((evaluateLength(token) !== undefined || WIDTH_KEYWORDS.has(lower)) && width === undefined) {
        width = token;
      } else if (color === undefined) {
        color = token;
      } else {
        return undefined;
      }
    }
    const sides = side[1] === undefined ? SIDES : [side[1]];
    return sides.flatMap((each) => [
      [`border-${each}-width`, width ?? "medium"] as const,
      [`border-${each}-style`, lineStyle ?? "none"] as const,
      [`border-${each}-color`, color ?? "currentcolor"] as const,
    ]);
  }
  const part = /^border-(width|style|color)$/.exec(property)?.[1];
  const values = part === undefined ? undefined : perSide(tokens);
  return part === undefined || values === undefined
    ? undefined
    : SIDES.map((each, index) => [`border-${each}-${part}`, values[index] ?? ""] as const);
}

/**
 * Declarations with each border shorthand split into its longhands, as {@link borderLonghands} says,
 * so the cascade decides each side's width, style and color by its usual precedence.
 */
function withBorderLonghands(applied: readonly Applied[]): Applied[] {
  return applied.map((each) => ({
    ...each,
    declarations: each.declarations.flatMap(({ property, value }) =>
      (borderLonghands(property, value) ?? [[property, value] as const]).map(([longhand, part]) => ({
        property: longhand,
        value: part,
      }))
    ),
  }));
}

/**
 * Whether a side of a pseudo-element's border paints: its resolved style draws, and its width does
 * not resolve to zero, a width the build cannot resolve counting as painting. Undefined for a style
 * that resolves to no border style.
 */
function sidePaints(style: LayerStyle, side: string): boolean | undefined {
  const lineStyle = normalizeCss(style.resolved(`border-${side}-style`) ?? "none").toLowerCase();
  if (!BORDER_STYLES.has(lineStyle)) {
    return undefined;
  }
  if (NO_BORDER.has(lineStyle)) {
    return false;
  }
  const width = normalizeCss(style.resolved(`border-${side}-width`) ?? "medium").toLowerCase();
  return (evaluateLength(width) ?? WIDTH_KEYWORDS.get(width)) !== 0;
}

/**
 * Whether a property of a pseudo-element's resolved style paints, by its value, or undefined where the
 * build does not tell. A border side's width, style and color paint together, as {@link sidePaints}
 * reads them, and a border shorthand left unsplit is one the build does not tell.
 */
function pseudoPaint(
  style: LayerStyle,
  property: string,
  properties: readonly string[],
  variables: VariableIndex
): boolean | undefined {
  const value = normalizeCss(style.resolved(property) ?? "").toLowerCase();
  if (property === "content") {
    return !["", '""', "''", "none", "normal"].includes(value);
  }
  const side = /^border-(top|right|bottom|left)-(?:width|style|color)$/.exec(property)?.[1];
  if (side !== undefined) {
    return sidePaints(style, side);
  }
  if (property === "background-color" || property === "background") {
    if (["transparent", "none"].includes(value)) {
      return false;
    }
    const color = readColor(value, variables);
    return color?.kind === "literal" ? color.color.a > 0 : true;
  }
  if (property === "background-image" || property === "box-shadow") {
    return value !== "none";
  }
  if (property === "outline-style" || property === "outline") {
    return !value.split(" ").every((token) => token === "none" || evaluateLength(token) === 0);
  }
  return PSEUDO_SILENT.test(property) ? false : undefined;
}

/**
 * Cascade a box's `::before` and `::after` over the box, as the browser does, and note each
 * declaration it sets itself, since the kit draws no layer for a pseudo-element: dropped where its
 * resolved style paints nothing, as a control's hit area does with empty content and no fill,
 * border, shadow or outline, and unmapped where it paints or sets a longhand the build does not
 * read, such as a `backdrop-filter`, which blurs what lies behind it with no paint of its own.
 */
function readPseudoElements(
  read: CellRead,
  ledger: CellLedger,
  placed: readonly Placed[],
  layer: Layer,
  path: readonly string[]
): void {
  const own = placed.at(-1)?.element;
  for (const [pseudo, indexes] of Object.entries(own?.pseudo ?? {})) {
    if (pseudo === "placeholder") {
      continue;
    }
    const applied = withBorderLonghands(appliedOf(read, indexes, placed, () => true, new Set()));
    const pseudoLayer = ledger.add(inheritance(layer, read.context), applied, layer);
    const style = new LayerStyle(ledger, pseudoLayer, [...path, `::${pseudo}`]);
    const properties = style.ownProperties();
    const verdicts = properties.map((property) => ({
      property,
      paints: pseudoPaint(style, property, properties, read.context.variables),
    }));
    const unread = verdicts.flatMap(({ property, paints }) => (paints === undefined ? [property] : []));
    const paints = verdicts.flatMap(({ property, paints }) => (paints === true ? [property] : []));
    const note: CoverageNote =
      unread.length > 0
        ? {
            outcome: "unmapped",
            detail: `the kit draws no layer for the \`::${pseudo}\` pseudo-element, and the build does not tell whether its ${unread.join(", ")} paints`,
          }
        : paints.length > 0
          ? {
              outcome: "unmapped",
              detail: `the kit draws no layer for the \`::${pseudo}\` pseudo-element, whose ${paints.join(", ")} paints`,
            }
          : {
              outcome: "dropped",
              detail: `the \`::${pseudo}\` pseudo-element paints nothing: its content is empty and it sets no fill, border, shadow or outline`,
            };
    for (const property of properties) {
      style.mark(property, note.outcome, note.detail, []);
    }
  }
}

/**
 * The elements around a root as the cascade placed them, the layer of the innermost one, and the
 * layers of the component's own elements around it, outermost first.
 */
type AroundPath = {
  readonly placed: readonly Placed[];
  readonly layer: Layer | undefined;
  readonly own: readonly Layer[];
};

/** The cascade of one cell, read from its capture. */
export class CaptureCellCascade {
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #page: readonly CapturedElement[];
  readonly #cell: CapturedCell;
  readonly #open: OpenPlacement | undefined;

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
      // The elements around the root and the root itself, from which box sizing reads the basis.
      box.heightBasis = normalizeCss(box.style.resolved("height") ?? "").endsWith("%")
        ? percentHeightBasis(
            [...path.own.map((layer) => new LayerStyle(this.#ledger, layer, [])), box.style],
            this.#read.context.variables
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
    return { around, root: stretched };
  }

  /** A box's element as the root's path places it. */
  #placed(element: CapturedElement, name: string): Placed {
    return { element, name, origin: this.#ledger.scope.origin };
  }

  /**
   * The layers of the page's elements and of the component's own elements around a root. A page
   * element passes down what inherits, its synced variables left out, so a `var()` of the root's
   * keeps binding the variable as the recipe cascade's page leaves it. The component's own elements
   * cascade every declaration they win, as the recipe cascade cascades an ancestor its definition
   * names, so a root's `100%` height can read the height around it, and each declaration nothing
   * reads drops with the element's reason.
   */
  #aroundPath(around: readonly CapturedElement[]): AroundPath {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent: Layer | undefined;
    const path: Placed[] = [];
    const layers: Layer[] = [];
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
        layers.push(parent);
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
      logs: new CascadeLogs(),
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
   * The capture names no ancestor that paints behind the root.
   *
   * @returns Undefined.
   */
  backdrop(): LayerStyle | undefined {
    return undefined;
  }

  /** Give every declaration no layer read its row, as the recipe cascade's cell does. */
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
    specificity: [0, 0, 0],
    order,
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
 * The classes a composite passes an inner root: those the root carries in the composite's capture
 * beyond the ones the inner set's own capture shows on its root in the same inner cell.
 */
/**
 * What a composite's instance part takes from the inner set's own capture: the classes the composite
 * passes the inner root, and the inner root as the inner set's capture holds it in the same cell.
 */
type InstanceClasses = {
  readonly passed: ReadonlySet<string>;
  readonly own: CapturedElement;
  readonly capture: SetCapture;
};

function passedClasses(
  read: CellRead,
  root: CapturedElement,
  set: string,
  cell: Cell,
  part: string
): InstanceClasses {
  const capture = read.captureOf(set);
  const own = capture?.cells.find((each) =>
    Object.entries(cell).every(([axis, value]) => each.cell[axis] === value)
  )?.roots[0].root;
  if (own === undefined || capture === undefined) {
    throw new KitUnmappable({
      message: `the instance part ${part} shows ${set}, whose kept capture lacks the cell ${JSON.stringify(cell)}, so the build cannot tell the classes the composite passes`,
    });
  }
  const ownClasses = new Set(own.classes);
  return { passed: new Set(root.classes.filter((className) => !ownClasses.has(className))), own, capture };
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
  /** Whether the box's element sets its `::marker` a `content` beyond `normal` or `none`. */
  readonly markerContent: boolean | undefined;
  /** What the capture measured of the box's element. */
  readonly measured: MeasuredBox | undefined;
  /** The content height around a root whose height is a percentage, as {@link percentHeightBasis} reads it. */
  heightBasis: PreviewLength | undefined = undefined;

  /**
   * @param read - The cell's declarations.
   * @param ledger - The ledger of the scope the box cascades in.
   * @param placed - The elements from `<html>` down to the box's, with their layer names.
   * @param parent - The layer of the element above the box.
   * @param path - The keys of the layers from the root down to the box's.
   * @param composed - What a composite's root holds beyond its element's.
   */
  constructor(
    read: CellRead,
    ledger: CellLedger,
    placed: readonly Placed[],
    parent: Layer | undefined,
    path: readonly string[],
    composed: ComposedRoot = PLAIN
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
      parent
    );
    this.style = new LayerStyle(ledger, this.#layer, path);
    this.path = path;
    readPseudoElements(read, ledger, placed, this.#layer, path);
    this.elementChildren = own?.element.children.length;
    this.elementTag = own?.element.tag;
    // The capture records a `::marker` only where it sets such a `content`.
    this.markerContent = own === undefined ? undefined : own.element.pseudo.marker !== undefined;
    this.measured = own === undefined ? undefined : measuredBox(own.element, read.declarations);
  }

  spaceChildren(children: number | undefined, spacing?: ChildSpacing): NumberSpec | undefined {
    const own = this.#placed.at(-1);
    const byChild = spacingByChild(this.#read, own?.element);
    const indexes = [...new Set(byChild.flatMap((held) => [...held]))];
    const withheld = indexes.flatMap((index) => {
      const declaration = this.#read.declarations[index];
      return declaration === undefined ? [] : [declaration];
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
    for (const { className, property, value } of withheld) {
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
      });
    }
    return spaced?.itemSpacing;
  }

  inPlace(): InPlace | undefined {
    return this.#ledger.scope.inPlace;
  }

  part(_classes: string, part: string, element: PartElement): BoxCascade {
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
    return this.#below(elements, part, this.#ledger, [...this.path, element.key], undefined);
  }

  instance(
    _classes: { readonly own: string; readonly passed: string },
    part: string,
    element: {
      readonly slot: string | undefined;
      readonly tag: string | undefined;
      readonly set?: string;
      readonly after?: "label";
    },
    _defaults: readonly OuterDeclaration[],
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
    if (found === undefined || root === undefined || element.set === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no inner root ${element.slot ?? "without a data-slot"} for the instance part ${part}`,
      });
    }
    const { passed, own, capture } = passedClasses(this.#read, root, element.set, scope.cell, part);
    this.#read.inner.set(root, passed);
    this.#read.innerOwn.set(root, { root: own, capture });
    for (const [below, classes] of passedBelowRoot(root, own)) {
      this.#read.passedBelow.set(below, { classes, origin: scope.passed.origin });
    }
    const inner: CellScope = {
      meaningOf: scope.meaningOf,
      cell: scope.cell,
      context: this.#ledger.scope.context,
      origin: scope.inPlace.inner,
      record: scope.inPlace.inner.record,
      logs: scope.logs,
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
    passed: Placed["passed"]
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
    return new CaptureBoxCascade(this.#read, ledger, placed, parent, path);
  }

  labelElement(): LayerStyle | undefined {
    return undefined;
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
 * claiming their elements in order. The build draws each as a slot around a dot, as it draws a part
 * whose recipe classes set `scale`, so every cell has the same layer tree.
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
 * height under it says nothing about the set.
 */
function measuredBox(element: CapturedElement, declarations: readonly CapturedDeclaration[]): MeasuredBox {
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
    widest: facts?.widest === true,
    holdsWidest: holds(element),
    lineFits: facts?.lineFits === true,
  };
}
