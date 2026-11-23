/**
 * Capture component sets in Chromium. Each set's cells render on one compare page, every cell of
 * its matrix, with its state forced as `figma:compare` forces it. The run reads each cell's elements
 * and matched rules through DevTools, resolves each element's winning declarations with
 * `winners.ts`, and checks each winner against the browser: forcing the winning value onto the
 * element as an important inline declaration must leave every longhand it wins unchanged. A winner
 * the browser disagrees with fails the capture.
 */

import { Effect } from "effect";
import type { CDPSession } from "playwright";

import type {
  BrowserUnavailable,
  CellRequest,
  CompareBrowser,
  OpenedPreview,
} from "../compare/browser-render.ts";
import { forcesState } from "../compare/browser-render.ts";
import { isClientRenderer, renderCellHtml } from "../compare/cell-renderers.ts";
import type { AnyCellRenderer } from "../compare/cell-renderers.ts";
import {
  fallbackInteraction,
  forcedPseudoClasses,
  restingTwin,
  writesHighlightAttribute,
} from "../compare/cells.ts";
import type { FontNotLoaded } from "../compare/font-check.ts";
import {
  cellRoom,
  cellSelector,
  forcedSelector,
  measuredSelectors,
  rootInCell,
  PAGE_LAYOUT,
} from "../compare/preview-page.ts";
import type { CellContent } from "../compare/preview-page.ts";
import type { PreviewTheme } from "../compare/preview-theme.ts";
import { CORNER_LONGHANDS } from "../components/box-corners.ts";
import { possibleCells, variantKey } from "../components/component-spec.ts";
import type { ImpossibleCells } from "../components/component-spec.ts";
import type { Viewport } from "../components/css-values.ts";
import type { AxisSpec } from "../components/kit-spec.ts";
import { ANCHOR_CENTRE, ANCHOR_WIDTH, CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  CapturedRoot,
  SetCapture,
  VariableSource,
} from "./capture-format.ts";
import { factsOfWinners } from "./declared-facts.ts";
import type { FlowRelativeElement } from "./flow-facts.ts";
import type { SetManifest } from "./manifest.ts";
import { measuredFacts } from "./page-facts.ts";
import type { RootRole } from "./page-facts.ts";
import {
  CellNotFound,
  expandLonghands,
  indexDocument,
  KEPT_PSEUDO,
  readCell,
  styledClasses,
} from "./read-page.ts";
import type { RawCell, RawElement } from "./read-page.ts";
import {
  capturedDeclaration,
  flowRelativeEdges,
  isRecorded,
  owningClass,
  classNamesIn,
  resolveWinners,
  selectorsIn,
  UnknownLayer,
} from "./winners.ts";
import type { RawRule, Winner } from "./winners.ts";

/**
 * What the capture needs of a set: its key and slot, its matrix, and the parts that take its
 * states. It names no element by selector.
 */
export type CaptureTarget = {
  readonly key: string;
  readonly slot: string;
  /** The `data-slot` the root carries in a cell where it is not `slot`, as a family stamps its own. */
  readonly elementSlot?: (cell: Readonly<Record<string, string>>) => string;
  readonly axes: readonly AxisSpec[];
  /** The axis values the component cannot show together, whose cells the capture leaves out. */
  readonly impossible?: readonly ImpossibleCells[];
  readonly addedAxes?: ReadonlySet<string>;
  readonly statePart?: string;
  /** The place of the element that takes the set's states, as the manifest's `statePlace` says. */
  readonly statePlace?: string;
  readonly statePeer?: string;
  readonly focusPart?: string;
  /**
   * The BOOLEAN properties that show the set's optional parts, which every cell renders turned on:
   * the set draws each part, and its property hides it.
   */
  readonly optional?: ReadonlySet<string>;
  /** The viewport a fixed root sits in. The renderer sizes a fixed root's host to it. */
  readonly viewport?: Viewport;
  /** The width of the host the root sits in, in CSS pixels, or undefined for the slot's. */
  readonly previewWidthFor?: (cell: Readonly<Record<string, string>>) => number | undefined;
  /** The `data-slot` of each element an open composite's cell measures, as its manifest names them. */
  readonly union?: readonly string[];
  /** An anchored popup's distance from its anchor, which the perturbation probe measures. */
  readonly sideOffset?: number;
  /** The row a nested popup opens beside, the anchor the perturbation probe measures its gap from. */
  readonly anchor?: SetManifest["anchor"];
};

/** The theme every capture renders in: the kit's first preview theme. */
export const CAPTURE_THEME: PreviewTheme = {
  scheme: "light",
  identity: "neutral",
  brand: "fkas",
  segment: "private",
  density: "dense",
};

/**
 * A cell's forced state left its read as its resting twin's, so the capture would record rest, or
 * the matrix holds no resting twin to tell.
 */
export class StateNotReached extends Error {
  readonly _tag = "StateNotReached" as const;
}

/** The browser computes a value other than the winner the capture resolved. */
export class WinnerContradicted extends Error {
  readonly _tag = "WinnerContradicted" as const;
}

/** A cell's markup has a shape the capture does not read yet, such as a union of measured elements. */
export class CaptureUnsupported extends Error {
  readonly _tag = "CaptureUnsupported" as const;
}

/** Why a set's capture failed. */
export type CaptureFailure =
  | StateNotReached
  | WinnerContradicted
  | CaptureUnsupported
  | CellNotFound
  | UnknownLayer
  | FontNotLoaded
  | BrowserUnavailable;

/** The page cell of one matrix cell. */
export function requestOf(
  target: CaptureTarget,
  renderer: AnyCellRenderer,
  cell: Readonly<Record<string, string>>,
  index: number
): CellRequest {
  const turnedOn = target.optional ?? new Set<string>();
  const content = (shown: Readonly<Record<string, string>>): CellContent =>
    isClientRenderer(renderer)
      ? { _tag: "Client", set: target.key, cell: shown, turnedOn: [...turnedOn] }
      : { _tag: "Static", html: renderCellHtml(renderer, shown, turnedOn) };
  const root = rootInCell(target, cell);
  const forced = forcedPseudoClasses(cell, renderer.highlight);
  const writesHighlight = writesHighlightAttribute(cell, renderer.highlight);
  return {
    id: `c${String(index)}`,
    name: variantKey(target, cell),
    content: content(cell),
    measured: measuredSelectors(root, target.union),
    ...cellRoom(PAGE_LAYOUT, {
      hostWidth: renderer.hostWidth,
      rootWidth: target.previewWidthFor?.(cell),
      viewport: target.viewport,
    }),
    forcedOn: forcedSelector(root, cell),
    forced,
    writesHighlightAttribute: writesHighlight,
    resting: forcesState({ forced, writesHighlightAttribute: writesHighlight })
      ? content(restingTwin(cell))
      : undefined,
    fallback: fallbackInteraction(cell),
    restsByDesign: false,
  };
}

/** An element on the path from `<html>` to an element, with its winners. */
type Resolved = {
  readonly element: RawElement;
  /** Every winner, theme and harness ones included, which names where a variable is set. */
  readonly all: readonly Winner<RawRule>[];
  /** The winners the capture records, resolved without the theme's and the harness's rules. */
  readonly kept: readonly CapturedDeclaration[];
};

/** The classes of an element, then of each element above it, nearest first. */
function classesUp(element: RawElement, path: readonly Resolved[]): readonly (readonly string[])[] {
  return [element.classes, ...path.map((each) => each.element.classes).toReversed()];
}

/** Resolve an element's winners both ways. */
function resolveElement(element: RawElement, path: readonly Resolved[]): Resolved | UnknownLayer {
  const all = resolveWinners(element.rules);
  const kept = resolveWinners(element.rules.filter(isRecorded));
  if (all instanceof UnknownLayer) {
    return all;
  }
  if (kept instanceof UnknownLayer) {
    return kept;
  }
  const browser = resolveWinners(element.rules.filter((rule) => rule.source === "user-agent"));
  if (browser instanceof UnknownLayer) {
    return browser;
  }
  const classes = classesUp(element, path);
  return {
    element,
    all,
    kept: kept.map((winner) => withRevert(capturedDeclaration(winner, classes), browser)),
  };
}

/** The keyword `revert`, apart from `revert-layer`. */
const REVERT = /(?<![\w-])revert(?![\w-])/i;

/**
 * A winner whose value names `revert`, with the value the browser's default style sheet gives its
 * longhand on the element, which `revert` rolls the cascade back to (CSS Cascade 4 §7.3.3). Any
 * other winner is as it was.
 */
function withRevert(
  declaration: CapturedDeclaration,
  browser: readonly Winner<RawRule>[]
): CapturedDeclaration {
  const [longhand] = declaration.longhands;
  if (!REVERT.test(declaration.value) || declaration.longhands.length !== 1 || longhand === undefined) {
    return declaration;
  }
  const reverted = browser.findLast(({ longhands }) => longhands.includes(longhand));
  return reverted === undefined ? declaration : { ...declaration, revertsTo: reverted.property.value };
}

const VARIABLE = /var\(\s*(--[\w-]+)/g;

/** Every custom property a list of declarations reads through `var()`. */
function referencedVariables(declarations: readonly CapturedDeclaration[]): readonly string[] {
  return [
    ...new Set(
      declarations.flatMap(({ value }) => [...value.matchAll(VARIABLE)].map((match) => match[1] ?? ""))
    ),
  ].toSorted();
}

/**
 * Where each custom property the element at the end of `path` reads is set: the nearest element at
 * or above it whose winner sets it, unless that winner is the theme's.
 */
function variableSources(path: readonly Resolved[], declarations: readonly CapturedDeclaration[]) {
  const sourceOf = (name: string): VariableSource => {
    for (let up = 0; up < path.length; up += 1) {
      const winner = path[path.length - 1 - up]?.all.find((each) => each.longhands.includes(name));
      if (winner !== undefined) {
        return winner.rule.source === "theme" ? { _tag: "theme" } : { _tag: "element", up };
      }
    }
    return { _tag: "unset" };
  };
  return Object.fromEntries(referencedVariables(declarations).map((name) => [name, sourceOf(name)] as const));
}

/**
 * Number the ids Base UI and React generate, `base-ui-…` and `_r_…_`, in the order a cell first names
 * them, so two runs, and a cell on another page, write the same ids.
 */
function idNumbering(): (value: string) => string {
  const ids = new Map<string, string>();
  return (value) =>
    value.replaceAll(/base-ui-[\w:-]+|_r_[0-9a-z]+_/g, (id) => {
      const known = ids.get(id) ?? `${id.startsWith("_r_") ? "react" : "base-ui"}-${String(ids.size + 1)}`;
      ids.set(id, known);
      return known;
    });
}

/** The capture's declarations, each once, by the index the elements name it with. */
class DeclarationTable {
  readonly declarations: CapturedDeclaration[] = [];
  readonly #indexes = new Map<string, number>();

  /** The index of a declaration, added at the end where the table lacks it. */
  index(declaration: CapturedDeclaration): number {
    const key = JSON.stringify(declaration);
    const known = this.#indexes.get(key);
    if (known !== undefined) {
      return known;
    }
    this.declarations.push(declaration);
    this.#indexes.set(key, this.declarations.length - 1);
    return this.declarations.length - 1;
  }
}

/** The attributes the compare page writes on a slot, whose values change from cell to cell. */
const SLOT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "data-compare-cell",
  "data-compare-client",
  "data-compare-props",
  "data-compare-on",
]);

/** How the capture writes an element. */
type ElementOptions = {
  readonly numbered: (value: string) => string;
  readonly table: DeclarationTable;
  readonly withChildren: boolean;
  /** Whether the element is the page's slot, whose `style` attribute and marks place it. */
  readonly slot: boolean;
  /**
   * The classes each element of the root's tree carries that a rule written for it matched there or
   * below, and the classes the page's stylesheets write a rule for. Undefined for an element around
   * the root, whose siblings the capture does not read, so it cannot tell a class that matched
   * nothing.
   */
  readonly matching?: Matching;
};

/** Which classes of a root's tree a rule matched through, and which classes any rule is written for. */
type Matching = {
  readonly matched: ReadonlyMap<RawElement, ReadonlySet<string>>;
  readonly styled: ReadonlySet<string>;
};

/**
 * Base UI's positioner values, which it measures from the anchor and the page: the room left beside
 * the anchor, the anchor's height, the origin a transition scales from and the translation that
 * places the popup. They are pixels of one page, so the capture keeps none of them; the build draws
 * the placement from the composite's own rule. `--anchor-width` stays as {@link ANCHOR_WIDTH}.
 */
const OMITTED_POSITIONER_PROPERTIES: ReadonlySet<string> = new Set([
  "--anchor-height",
  "--available-height",
  "--available-width",
  "--transform-origin",
  "transform",
]);

/**
 * The heights Base UI measures as a box's natural height and writes back as pixels. Toast's root sets
 * its own `height` to `auto`, reads `offsetHeight` and writes `--toast-height`, and the viewport writes
 * the frontmost toast's as `--toast-frontmost-height`. Base UI measures again when the text or the
 * density resizes the toast, so each pixel value is the root's `auto` height for one page's text and
 * mode (`natural-height.chromium.test.ts`). The capture records each as `auto`, which the build draws
 * as a box that hugs its content in every mode. Drawer's `--drawer-height` is no such height: Drawer
 * reads the popup's `offsetHeight` as its layout sets it, without `auto`, so Sheet's 448px is the
 * viewport's height.
 */
const NATURAL_HEIGHT_PROPERTIES: ReadonlySet<string> = new Set([
  "--toast-height",
  "--toast-frontmost-height",
]);

/**
 * The declarations the capture keeps of an element's `style` attribute. Around a root it keeps only
 * custom properties, which pass down, since a harness host or Base UI writes the rest from what it
 * measured, such as a host as wide as its popup. Base UI's measured positioner values drop, and the
 * anchor's width stays as a symbol the build resolves, as does the offset Base UI gives an element
 * it places by its `data-side`, such as a popup's arrow, along that side. A height Base UI measured
 * as a box's natural height stays as `auto`, as {@link NATURAL_HEIGHT_PROPERTIES} says.
 */
function keptInline(
  declaration: CapturedDeclaration,
  around: boolean,
  attributes: readonly (readonly [string, string])[]
): readonly CapturedDeclaration[] {
  if (declaration.source !== "inline") {
    return [declaration];
  }
  const side = attributes.find(([name]) => name === "data-side")?.[1];
  const along = side === "top" || side === "bottom" ? "left" : side === undefined ? undefined : "top";
  if (!around && declaration.property === along) {
    return [{ ...declaration, value: ANCHOR_CENTRE }];
  }
  if (declaration.property === "--anchor-width") {
    return [{ ...declaration, value: ANCHOR_WIDTH }];
  }
  if (NATURAL_HEIGHT_PROPERTIES.has(declaration.property)) {
    return [{ ...declaration, value: "auto" }];
  }
  if (
    OMITTED_POSITIONER_PROPERTIES.has(declaration.property) ||
    (around && !declaration.property.startsWith("--"))
  ) {
    return [];
  }
  return [declaration];
}

/** The capture of an element and, where `withChildren`, the elements below it. */
function captureElement(
  element: RawElement,
  path: readonly Resolved[],
  options: ElementOptions
): CapturedElement | UnknownLayer {
  const classes = classesUp(element, path);
  const resolved = resolveElement(element, path);
  if (resolved instanceof UnknownLayer) {
    return resolved;
  }
  const kept = options.slot
    ? resolved.kept.filter((winner) => winner.source !== "inline")
    : resolved.kept.flatMap((winner) => keptInline(winner, !options.withChildren, element.attributes));
  const here = [...path, resolved];
  const pseudo: Record<string, readonly CapturedDeclaration[]> = {};
  for (const { name, rules } of element.pseudo.filter((each) => KEPT_PSEUDO.has(each.name))) {
    const winners = resolveWinners(rules.filter(isRecorded));
    if (winners instanceof UnknownLayer) {
      return winners;
    }
    // A `::before` or `::after` with no `content` renders no box (CSS Generated Content 3 §1.1), and
    // a `::marker` whose `content` is `normal` or `none` draws what its list item's `list-style-type`
    // and `list-style-image` say (CSS Lists 3 §3.2), which the element's own declarations hold.
    const renders =
      name === "placeholder" ||
      winners.some(({ property }) => property.name === "content" && !/^(none|normal)$/.test(property.value));
    if (renders && winners.length > 0) {
      pseudo[name] = winners.map((winner) => capturedDeclaration(winner, classes));
    }
  }
  const children: CapturedElement[] = [];
  if (options.withChildren) {
    for (const child of element.children) {
      const captured = captureElement(child, here, options);
      if (captured instanceof UnknownLayer) {
        return captured;
      }
      children.push(captured);
    }
  }
  const index = (declaration: CapturedDeclaration): number => options.table.index(declaration);
  const written: CapturedElement = {
    tag: element.tag,
    attributes: Object.fromEntries(
      element.attributes
        .filter(
          ([name]) => name !== "class" && name !== "style" && !(options.slot && SLOT_ATTRIBUTES.has(name))
        )
        .map(([name, value]) => [name, options.numbered(value)] as const)
        .toSorted(([left], [right]) => left.localeCompare(right))
    ),
    classes: element.classes,
    text: element.text,
    declarations: kept.map(index),
    initial: kept
      .filter((winner) => winner.longhands.every((longhand) => element.initial.has(longhand)))
      .map(index),
    pseudo: Object.fromEntries(Object.entries(pseudo).map(([name, winners]) => [name, winners.map(index)])),
    variables: variableSources(here, [...kept, ...Object.values(pseudo).flat()]),
    unmatched: options.matching === undefined ? [] : unmatchedClasses(element, options.matching),
    children,
  };
  const indexed = element.textIndex === undefined ? written : { ...written, textIndex: element.textIndex };
  const placed = element.texts === undefined ? indexed : { ...indexed, texts: element.texts };
  const measured = factsOfWinners(element.measured, kept);
  return measured === undefined ? placed : { ...placed, measured };
}

/** The classes of an element a rule is written for, and no rule written for them matched through. */
function unmatchedClasses(element: RawElement, { matched, styled }: Matching): readonly string[] {
  const through = matched.get(element) ?? new Set();
  return element.classes.filter((className) => styled.has(className) && !through.has(className));
}

/**
 * Which classes of a root's tree some matched rule is written for, by the element that carries the
 * class: each selector of a rule that matched an element, its pseudo-elements included, is written
 * for the first class it names, which the element or the nearest element above it carries, as a
 * Tailwind utility's selector names its own class first. Losing rules count, since a class whose
 * rule matched and lost still styled the state its cell shows.
 */
function matchedClasses(
  root: RawElement,
  around: readonly RawElement[]
): ReadonlyMap<RawElement, ReadonlySet<string>> {
  const matched = new Map<RawElement, Set<string>>();
  const visit = (element: RawElement, path: readonly RawElement[]): void => {
    const up = [element, ...path.toReversed()];
    const rules = [...element.rules, ...element.pseudo.flatMap((pseudo) => pseudo.rules)].filter(isRecorded);
    for (const rule of rules) {
      for (const selector of selectorsIn(rule.selector)) {
        const { className, owner } = owningClass(
          { ...rule, selector },
          up.map((each) => each.classes)
        );
        const carrier = up[owner];
        if (carrier?.classes.includes(className) === true) {
          const known = matched.get(carrier) ?? new Set();
          known.add(className);
          matched.set(carrier, known);
        }
      }
    }
    for (const child of element.children) {
      visit(child, [...path, element]);
    }
  };
  visit(root, around);
  return matched;
}

/** Resolve the path of elements around a root, outermost first. */
function resolvePath(around: readonly RawElement[]): readonly Resolved[] | UnknownLayer {
  const path: Resolved[] = [];
  for (const element of around) {
    const resolved = resolveElement(element, path);
    if (resolved instanceof UnknownLayer) {
      return resolved;
    }
    path.push(resolved);
  }
  return path;
}

/** One root's capture from its raw read, and the page's elements around it. */
function captureRoot(
  raw: RawCell,
  key: string,
  table: DeclarationTable,
  numbered: (value: string) => string,
  styled: ReadonlySet<string>
):
  | { readonly page: readonly CapturedElement[]; readonly root: CapturedRoot }
  | UnknownLayer
  | CaptureUnsupported {
  const path = resolvePath(raw.around);
  if (path instanceof UnknownLayer) {
    return path;
  }
  const slot = raw.around.findIndex((element) =>
    element.attributes.some(([name]) => name === "data-compare-cell")
  );
  if (slot < 0) {
    return new CaptureUnsupported(`${key}: the root sits outside its cell's slot`);
  }
  const around: CapturedElement[] = [];
  for (const [index, element] of raw.around.entries()) {
    const captured = captureElement(element, path.slice(0, index), {
      numbered,
      table,
      withChildren: false,
      slot: index === slot,
    });
    if (captured instanceof UnknownLayer) {
      return captured;
    }
    around.push(captured);
  }
  const root = captureElement(raw.root, path, {
    numbered,
    table,
    withChildren: true,
    slot: false,
    matching: { matched: matchedClasses(raw.root, raw.around), styled },
  });
  if (root instanceof UnknownLayer) {
    return root;
  }
  return { page: around.slice(0, slot + 1), root: { around: around.slice(slot + 1), root } };
}

/** One cell's capture from its roots' raw reads, and the page's elements around them. */
function captureCell(
  raws: readonly RawCell[],
  key: string,
  cell: Readonly<Record<string, string>>,
  table: DeclarationTable,
  styled: ReadonlySet<string>
):
  | { readonly page: readonly CapturedElement[]; readonly cell: CapturedCell }
  | UnknownLayer
  | CaptureUnsupported {
  // One numbering for the cell, so a trigger and its popup name a shared id alike.
  const numbered = idNumbering();
  const roots: CapturedRoot[] = [];
  let page: readonly CapturedElement[] = [];
  for (const raw of raws) {
    const one = captureRoot(raw, key, table, numbered, styled);
    if (one instanceof Error) {
      return one;
    }
    page = one.page;
    roots.push(one.root);
  }
  const [first, ...others] = roots;
  if (first === undefined) {
    return new CaptureUnsupported(`${key}: the cell measures no element`);
  }
  return { page, cell: { key, cell, roots: [first, ...others] } };
}

/** One forced-winner check: the declaration to force and the longhands it must leave unchanged. */
type WinnerCheck = {
  readonly property: string;
  readonly value: string;
  readonly longhands: readonly string[];
};

/** A longhand whose computed value a forced winner changed, and how it changed. */
type Changed = { readonly longhand: string; readonly change: string };

/**
 * Force every winner of an element onto it at once, each as an important inline declaration in
 * cascade order, so each longhand ends at its winner's value, and return each longhand whose
 * computed value changed, which a wrong winner changes. The browser's own declarations are skipped,
 * since a page cannot write their internal values.
 */
async function contradictions(
  cdp: CDPSession,
  nodeId: number,
  checks: readonly WinnerCheck[]
): Promise<readonly Changed[]> {
  const { object } = await cdp.send("DOM.resolveNode", { nodeId });
  if (object.objectId === undefined || checks.length === 0) {
    return [];
  }
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    arguments: [{ value: checks }],
    functionDeclaration: `function (checks) {
      const names = [...new Set(checks.flatMap((check) => check.longhands))];
      const read = () => { const style = getComputedStyle(this); return names.map((name) => style.getPropertyValue(name)); };
      const before = read();
      const original = this.getAttribute("style");
      for (const check of checks) { this.style.setProperty(check.property, check.value, "important"); }
      const after = read();
      if (original === null) { this.removeAttribute("style"); } else { this.setAttribute("style", original); }
      return names.flatMap((name, index) => before[index] === after[index] ? [] : [{ longhand: name, change: name + ": " + before[index] + " became " + after[index] }]);
    }`,
  });
  // SAFETY: the function above returns an array of longhands and their changes by value.
  return (result.value ?? []) as readonly Changed[];
}

/**
 * The longhands of an element whose computed value is their initial value, as a probe element set to
 * `initial` computes them, among the ones its winners set.
 */
async function initialLonghands(
  cdp: CDPSession,
  nodeId: number,
  names: readonly string[]
): Promise<ReadonlySet<string>> {
  const { object } = await cdp.send("DOM.resolveNode", { nodeId });
  if (object.objectId === undefined || names.length === 0) {
    return new Set();
  }
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    arguments: [{ value: names }],
    functionDeclaration: `function (names) {
      const probe = document.createElement("div");
      for (const name of names) { probe.style.setProperty(name, "initial"); }
      document.body.append(probe);
      const own = getComputedStyle(this);
      const initial = getComputedStyle(probe);
      const found = names.filter((name) => own.getPropertyValue(name) === initial.getPropertyValue(name));
      probe.remove();
      return found;
    }`,
  });
  // SAFETY: the function above returns an array of strings by value.
  return new Set((result.value ?? []) as readonly string[]);
}

/** An element as an error names it: its tag and `data-slot`. */
function elementName(element: RawElement): string {
  const slot = element.attributes.find(([name]) => name === "data-slot")?.[1];
  return slot === undefined ? `<${element.tag}>` : `<${element.tag} data-slot=${slot}>`;
}

/**
 * A cell's elements, the root's tree and the elements around it, with the longhands each one's
 * winners leave at their initial value.
 */
async function withInitial(cdp: CDPSession, raw: RawCell): Promise<RawCell | UnknownLayer> {
  const visit = async (element: RawElement): Promise<RawElement | UnknownLayer> => {
    const winners = resolveWinners(element.rules.filter(isRecorded));
    if (winners instanceof UnknownLayer) {
      return winners;
    }
    const children: RawElement[] = [];
    for (const child of element.children) {
      const read = await visit(child);
      if (read instanceof UnknownLayer) {
        return read;
      }
      children.push(read);
    }
    const names = [...new Set(winners.flatMap(({ longhands }) => longhands))].filter(
      (name) => !name.startsWith("--")
    );
    return { ...element, children, initial: await initialLonghands(cdp, element.nodeId, names) };
  };
  const root = await visit(raw.root);
  if (root instanceof UnknownLayer) {
    return root;
  }
  const around: RawElement[] = [];
  for (const element of raw.around) {
    const read = await visit(element);
    if (read instanceof UnknownLayer) {
      return read;
    }
    around.push(read);
  }
  return { ...raw, around, root };
}

/**
 * A cell's roots with the anchored popup's root marked where the anchor beside it is more than half a
 * pixel wider than the popup's `min-width`: Base UI then widens the popup to the anchor, which the
 * build draws only for an anchor whose width the spec holds. A cell with no pair that
 * {@link anchoredPair} finds stays as it is.
 */
async function withAnchorFact(cdp: CDPSession, roots: readonly RawCell[]): Promise<readonly RawCell[]> {
  const pair = anchoredPair(roots);
  if (pair === undefined) {
    return roots;
  }
  const { popup, anchor } = pair;
  const [{ object: popupObject }, { object: anchorObject }] = await Promise.all([
    cdp.send("DOM.resolveNode", { nodeId: popup.root.nodeId }),
    cdp.send("DOM.resolveNode", { nodeId: anchor.root.nodeId }),
  ]);
  if (popupObject.objectId === undefined || anchorObject.objectId === undefined) {
    return roots;
  }
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: popupObject.objectId,
    returnByValue: true,
    arguments: [{ objectId: anchorObject.objectId }],
    functionDeclaration: `function (anchor) {
      const minimum = Number.parseFloat(getComputedStyle(this).minWidth) || 0;
      return anchor.getBoundingClientRect().width > minimum + 0.5;
    }`,
  });
  if (result.value !== true) {
    return roots;
  }
  return roots.map((raw) =>
    raw === popup
      ? { ...raw, root: { ...raw.root, measured: { ...raw.root.measured, anchorWiderThanMinimum: true } } }
      : raw
  );
}

/**
 * A cell's anchored popup and its anchor: a cell of two roots, one of which Base UI placed by its
 * `data-side`. Undefined for any other cell.
 */
function anchoredPair(
  roots: readonly RawCell[]
): { readonly popup: RawCell; readonly anchor: RawCell } | undefined {
  const side = (raw: RawCell): boolean => raw.root.attributes.some(([name]) => name === "data-side");
  const popup = roots.find(side);
  const anchor = roots.find((raw) => !side(raw));
  return roots.length === 2 && popup !== undefined && anchor !== undefined ? { popup, anchor } : undefined;
}

/**
 * The root's elements that a matched rule gives a border side or a corner by its flow-relative name,
 * winning or not, by path, with the edges those rules set, which the page measures `otherFlow` on. A
 * losing one counts too: on a right-to-left page `border-start-start-radius` and a later
 * `border-top-left-radius` set two corners, and the capture's left-to-right cascade drops the first.
 */
function flowRelativeElements(element: RawElement, path: string): readonly FlowRelativeElement[] {
  const edges = new Set(
    element.rules.flatMap((rule) => rule.properties.flatMap(({ name }) => flowRelativeEdges(name)))
  );
  return [
    ...(edges.size === 0 ? [] : [{ path, edges: [...edges].toSorted() }]),
    ...element.children.flatMap((child, index) =>
      flowRelativeElements(child, path === "" ? String(index) : `${path}/${String(index)}`)
    ),
  ];
}

/** A cell root's elements with what the page measured of each, as `role` names the root. */
async function withMeasuredFacts(cdp: CDPSession, raw: RawCell, role: RootRole): Promise<RawCell> {
  const facts = await measuredFacts(
    cdp,
    raw.root.nodeId,
    role,
    corneredPaths(raw.root, ""),
    flowRelativeElements(raw.root, "")
  );
  const attach = (element: RawElement, path: string): RawElement => {
    const children = element.children.map((child, index) =>
      attach(child, path === "" ? String(index) : `${path}/${String(index)}`)
    );
    const measured = facts.get(path);
    return measured === undefined ? { ...element, children } : { ...element, children, measured };
  };
  return { ...raw, root: attach(raw.root, "") };
}

/**
 * The paths of an element and its descendants whose recorded rules declare a per-corner radius
 * longhand, which `box-corners.ts` reads a radius per corner from.
 */
function corneredPaths(element: RawElement, path: string): readonly string[] {
  const own = element.rules.some(
    (rule) =>
      rule.source !== "user-agent" && rule.properties.some((property) => CORNER_LONGHANDS.has(property.name))
  );
  return [
    ...(own ? [path] : []),
    ...element.children.flatMap((child, index) =>
      corneredPaths(child, path === "" ? String(index) : `${path}/${String(index)}`)
    ),
  ];
}

/**
 * A winner of an element below a cell root that the browser computes otherwise, by the element's path.
 * `turnable` marks a corner's on an element whose rules set a corner by its flow-relative name: the
 * capture resolves those as on a left-to-right, horizontal page, so right to left
 * `border-start-start-radius` beside an earlier `border-radius` and a later
 * `border-top-left-radius` gives the top right to `border-radius` where the browser rounds it by the
 * logical corner.
 */
type Contradiction = { readonly path: string; readonly turnable: boolean; readonly text: string };

/** A physical corner's radius longhand. */
const CORNER_RADIUS = /^border-(?:top|bottom)-(?:left|right)-radius$/;

/** Check every winner of a cell's elements against the browser. */
async function verifyCell(cdp: CDPSession, raw: RawCell): Promise<readonly Contradiction[] | UnknownLayer> {
  const found: Contradiction[] = [];
  const corners = new Set(
    flowRelativeElements(raw.root, "").flatMap(({ path, edges }) => (edges.includes("corners") ? [path] : []))
  );
  const elements: { readonly element: RawElement; readonly path: string }[] = [];
  const collect = (element: RawElement, path: string): void => {
    elements.push({ element, path });
    element.children.forEach((child, index) =>
      collect(child, path === "" ? String(index) : `${path}/${String(index)}`)
    );
  };
  collect(raw.root, "");
  for (const { element, path } of elements) {
    const winners = resolveWinners(element.rules);
    if (winners instanceof UnknownLayer) {
      return winners;
    }
    const checks = winners
      .filter((winner) => winner.rule.source !== "user-agent")
      .map(({ property, longhands }) => ({ property: property.name, value: property.value, longhands }));
    for (const { longhand, change } of await contradictions(cdp, element.nodeId, checks)) {
      found.push({
        path,
        turnable: corners.has(path) && CORNER_RADIUS.test(longhand),
        text: `${elementName(element)} ${change}`,
      });
    }
  }
  return found;
}

/** The element at a path from a cell root, as `flowRelativeElements` numbers it. */
function elementAt(root: RawElement, path: string): RawElement | undefined {
  return path === ""
    ? root
    : path
        .split("/")
        .reduce<RawElement | undefined>((element, index) => element?.children[Number(index)], root);
}

/** The cell's failure where any of its winners stays contradicted. */
function contradicted(key: string, wrong: readonly Contradiction[]): WinnerContradicted {
  return new WinnerContradicted(
    `${key}: the browser computes other values than the resolved winners:\n  ${wrong.map(({ text }) => text).join("\n  ")}`
  );
}

/** A matrix cell and the page cell that renders it. */
type PlannedCell = {
  readonly request: CellRequest;
  readonly cell: Readonly<Record<string, string>>;
  readonly key: string;
  /** The key of the cell at rest, for a cell whose state the page forces. */
  readonly rest: string | undefined;
};

/** The cells of a page as read, each as its roots, and the classes the page's stylesheets style. */
type PageRead = {
  readonly cells: readonly (readonly RawCell[])[];
  readonly styled: ReadonlySet<string>;
};

/**
 * Read and check the cells of an opened page, each with every property's longhands. A cell reads
 * each element it measures as a root of its own: the set's root, or an open composite's two.
 */
async function readCells(
  opened: OpenedPreview,
  cells: readonly PlannedCell[]
): Promise<PageRead | CaptureFailure> {
  const index = indexDocument(opened.document);
  const page = new Map<string, RawElement>();
  const read: RawCell[] = [];
  const counts: number[] = [];
  // A forced state may change no computed style, as a pressed Toggle's hover, whose fill outranks the
  // hover's: the rules written for the state match and lose. `capturedCells` checks the read instead.
  for (const { request, key } of cells) {
    if (request.measured.length === 0) {
      return new CaptureUnsupported(`${key}: the cell measures no element`);
    }
    counts.push(request.measured.length);
  }
  const selectors = cells.flatMap(({ request }) =>
    request.measured.map((measured) => cellSelector(request.id, measured))
  );
  // The first root reads the page's elements around every cell, which the others then share; the rest
  // read side by side, so DevTools answers one request while the run parses the last.
  const [first, ...rest] = selectors;
  const reads =
    first === undefined
      ? []
      : [
          await readCell(opened.cdp, opened.sheets, index, first, page),
          ...(await Promise.all(
            rest.map((selector) => readCell(opened.cdp, opened.sheets, index, selector, page))
          )),
        ];
  for (const raw of reads) {
    if (raw instanceof CellNotFound) {
      return raw;
    }
    read.push(raw);
  }
  const expanded: RawCell[] = [];
  // Each page function runs whole before the next, so the reads and checks below run side by side.
  for (const marked of await Promise.all(
    (await expandLonghands(opened.cdp, read)).map((raw) => withInitial(opened.cdp, raw))
  )) {
    if (marked instanceof UnknownLayer) {
      return marked;
    }
    expanded.push(marked);
  }
  const grouped: (readonly RawCell[])[] = [];
  let from = 0;
  for (const count of counts) {
    grouped.push(expanded.slice(from, from + count));
    from += count;
  }
  const checked = await Promise.all(
    grouped.map((roots) => Promise.all(roots.map((raw) => verifyCell(opened.cdp, raw))))
  );
  // A contradicted corner a flow-relative name may have turned waits for the facts below: it drops
  // where the element lays out other than left to right in horizontal lines in some mode, whose
  // corners the build then leaves unmapped (`logical-sides.ts`). A side's winner never drops, since
  // the build reads side widths for the layout too, as an inset or a containing block's border.
  const turnable: {
    readonly at: number;
    readonly index: number;
    readonly wrong: readonly Contradiction[];
  }[] = [];
  for (const [at, roots] of checked.entries()) {
    for (const [index, wrong] of roots.entries()) {
      if (wrong instanceof UnknownLayer) {
        return wrong;
      }
      if (wrong.some((each) => !each.turnable)) {
        return contradicted(cells[at]?.key ?? "", wrong);
      }
      if (wrong.length > 0) {
        turnable.push({ at, index, wrong });
      }
    }
  }
  const measured: (readonly RawCell[])[] = [];
  for (const roots of grouped) {
    // The roots of a cell share the page whose mode each measurement stamps, so they measure in turn.
    const facts: RawCell[] = [];
    const anchor = anchoredPair(roots)?.anchor;
    for (const raw of roots) {
      facts.push(await withMeasuredFacts(opened.cdp, raw, raw === anchor ? "anchor" : "root"));
    }
    measured.push(await withAnchorFact(opened.cdp, facts));
  }
  for (const { at, index, wrong } of turnable) {
    const root = measured[at]?.[index]?.root;
    const left = wrong.filter(
      ({ path }) =>
        root === undefined || !(elementAt(root, path)?.measured?.otherFlow ?? []).includes("corners")
    );
    if (left.length > 0) {
      return contradicted(cells[at]?.key ?? "", left);
    }
  }
  return { cells: measured, styled: await styledClasses(opened.cdp) };
}

/** Turn the read cells into the capture's page, declarations and cells, in matrix order. */
function capturedCells(
  cells: readonly PlannedCell[],
  read: readonly (readonly RawCell[])[],
  styled: ReadonlySet<string>
): Pick<SetCapture, "page" | "declarations" | "cells"> | CaptureFailure {
  const table = new DeclarationTable();
  const captured: CapturedCell[] = [];
  let page: readonly CapturedElement[] = [];
  for (const [at, { key, cell }] of cells.entries()) {
    const raw = read[at];
    if (raw === undefined) {
      return new CaptureUnsupported(`${key}: the page read no cell`);
    }
    const one = captureCell(raw, key, cell, table, styled);
    if (one instanceof Error) {
      return one;
    }
    if (at === 0) {
      page = one.page;
    }
    captured.push(one.cell);
  }
  // A forced state is reached where a rule written for it matched an element of the cell, won or
  // lost, and matched none of its resting twin's. Nothing else in the read counts: a winner or an
  // attribute can differ for reasons of its own, as a renderer that stamps the cell's state does. A
  // cell no such rule reaches draws as its resting twin only where its own read shows the component
  // leaves the state unstyled there, as `restsUnstyled` decides, as a selected calendar day's hover is.
  const readAt = new Map(cells.map(({ key }, at) => [key, read[at]] as const));
  const unreached: {
    readonly key: string;
    readonly rest: string;
    readonly state: string;
    readonly forced: RawElement | undefined;
  }[] = [];
  const stateClasses = new Map<string, Set<string>>();
  for (const { key, rest, request } of cells) {
    const resting = rest === undefined ? undefined : readAt.get(rest);
    const forced = readAt.get(key);
    if (rest === undefined || resting === undefined || forced === undefined) {
      continue;
    }
    const patterns = statePatterns(request);
    const state = patterns.map((pattern) => pattern.source).join(" ");
    const atRest = matchedSelectors(resting);
    const fresh = (selector: string) =>
      !atRest.has(selector) && patterns.some((pattern) => pattern.test(selector));
    const target = forcedElement(forced, request.forcedOn);
    if ([...matchedSelectors(forced)].some(fresh)) {
      // The classes whose rules for the state took effect on the element the page forces.
      const classes = stateClasses.get(state) ?? new Set<string>();
      for (const rule of (target?.rules ?? []).filter(({ selector }) => fresh(selector))) {
        for (const name of classNamesIn(rule.selector).filter(
          (each) => target?.classes.includes(each) === true
        )) {
          classes.add(name);
        }
      }
      stateClasses.set(state, classes);
    } else {
      unreached.push({ key, rest, state, forced: target });
    }
  }
  const [stray] = unreached.filter(
    ({ state, forced }) => !restsUnstyled(forced, stateClasses.get(state) ?? new Set())
  );
  if (stray !== undefined) {
    return new StateNotReached(
      `${stray.key}: no rule written for its forced state matched an element of the cell that ${stray.rest} does not match, and the element the page forces carries no class whose rule for the state took effect in another cell`
    );
  }
  const restLike = new Set(unreached.map(({ key }) => key));
  return {
    page,
    declarations: table.declarations,
    cells: captured.map((cell) => (restLike.has(cell.key) ? { ...cell, drawsAsRest: true as const } : cell)),
  };
}

/**
 * How a matched rule's selector names the state a cell forces: each pseudo-class the page forces,
 * such as `:hover`, and the `data-highlighted` attribute it writes on a highlighted row.
 */
function statePatterns(request: CellRequest): readonly RegExp[] {
  const highlight = request.writesHighlightAttribute ? ["\\[data-highlighted"] : [];
  return [...request.forced.map((name) => `:${name}`), ...highlight].map(
    (pattern) => new RegExp(`${pattern}(?![\\w-])`)
  );
}

/**
 * The element a cell's forced state lands on, where its selector names it by `data-slot`: the root
 * the selector names, or the part below it, as `forcedSelector` writes them. Undefined for any other
 * selector, as a peer's or a place's, which this read cannot follow.
 */
function forcedElement(cell: readonly RawCell[], selector: string): RawElement | undefined {
  const slots = /^\[data-slot="([^"]+)"\](?: \[data-slot="([^"]+)"\])?$/.exec(selector);
  const [, rootSlot, partSlot] = slots ?? [];
  if (rootSlot === undefined) {
    return undefined;
  }
  const slotOf = (element: RawElement) => element.attributes.find(([name]) => name === "data-slot")?.[1];
  const find = (element: RawElement, slot: string): RawElement | undefined =>
    slotOf(element) === slot
      ? element
      : element.children.map((child) => find(child, slot)).find((each) => each !== undefined);
  const root = cell.map(({ root: each }) => find(each, rootSlot)).find((each) => each !== undefined);
  return root === undefined || partSlot === undefined ? root : find(root, partSlot);
}

/**
 * Whether a cell whose forced state reached no rule leaves that state unstyled: the element the page
 * forces it on carries a class whose rule for the state took effect on the forced element of another
 * cell of the set. The page forced the state there, and the rule written for it is the element's own,
 * so only a condition this cell carries, as `not-data-selected`, keeps it from matching, and the cell
 * draws as its resting twin. A force that lands where no such class sits, as on a sibling of the part
 * the set's rules style, shows nothing of the state.
 */
function restsUnstyled(forced: RawElement | undefined, classes: ReadonlySet<string>): boolean {
  return forced?.classes.some((name) => classes.has(name)) ?? false;
}

/** The selector of every rule matched on a cell's elements and their pseudo-elements, around its roots too. */
function matchedSelectors(cell: readonly RawCell[]): ReadonlySet<string> {
  const found = new Set<string>();
  const visit = (element: RawElement): void => {
    for (const rule of [...element.rules, ...element.pseudo.flatMap(({ rules }) => rules)]) {
      found.add(rule.selector);
    }
    element.children.forEach(visit);
  };
  for (const { around, root } of cell) {
    around.forEach(visit);
    visit(root);
  }
  return found;
}

/**
 * How many pages a set's cells spread over, each in a browser context of its own, which Chromium
 * renders in a process of its own, so the pages' DevTools reads run side by side.
 */
const PAGES = 8;

/** The fewest cells worth a page of their own, below which a set renders on one page. */
const CELLS_PER_PAGE = 24;

/**
 * Capture one set: every cell of its matrix, in matrix order.
 *
 * @param browser - The Chromium that renders the pages.
 * @param target - The set.
 * @param renderer - The set's renderer.
 * @returns The capture. The Effect fails with why a cell could not be captured.
 */
export const captureSet = Effect.fn("captureSet")(function* (
  browser: CompareBrowser,
  target: CaptureTarget,
  renderer: AnyCellRenderer
) {
  const rendered = isClientRenderer(renderer) ? renderer.union : undefined;
  if (JSON.stringify(rendered) !== JSON.stringify(target.union)) {
    return yield* Effect.fail(
      new CaptureUnsupported(
        `${target.key}: its manifest measures ${target.union?.join(" and ") ?? "its root"}, and its renderer ${rendered?.join(" and ") ?? "its root"}`
      )
    );
  }
  const planned = possibleCells(target).map((cell) => ({
    cell,
    key: variantKey(target, cell),
    rest:
      forcedPseudoClasses(cell, renderer.highlight).length > 0 ||
      writesHighlightAttribute(cell, renderer.highlight)
        ? variantKey(target, restingTwin(cell))
        : undefined,
  }));
  // The page tells a forced state it reached from one it missed only against the cell's resting
  // twin, so a forced cell whose twin the matrix rules out could record rest unnoticed. The check
  // runs before any request renders the twin, which the renderer may refuse as impossible.
  const keys = new Set(planned.map(({ key }) => key));
  const twinless = planned.find(({ rest }) => rest !== undefined && !keys.has(rest));
  if (twinless !== undefined) {
    return yield* Effect.fail(
      new StateNotReached(
        `${twinless.key}: the page forces its state, and the matrix holds no ${twinless.rest ?? "resting twin"} to tell whether the state took effect`
      )
    );
  }
  const cells: readonly PlannedCell[] = planned.map((each, index) => ({
    ...each,
    request: requestOf(target, renderer, each.cell, index),
  }));
  const pages = Math.max(1, Math.min(PAGES, Math.floor(cells.length / CELLS_PER_PAGE)));
  const size = Math.ceil(cells.length / pages);
  const chunks = Array.from({ length: pages }, (_, page) => cells.slice(page * size, (page + 1) * size));
  const reads = yield* Effect.forEach(
    chunks,
    (chunk) =>
      browser.openPreview(
        CAPTURE_THEME,
        chunk.map(({ request }) => request),
        PAGE_LAYOUT,
        (opened) => readCells(opened, chunk)
      ),
    { concurrency: "unbounded" }
  );
  const read: (readonly RawCell[])[] = [];
  let styled: ReadonlySet<string> = new Set();
  for (const each of reads) {
    if (each instanceof Error) {
      return yield* Effect.fail(each);
    }
    read.push(...each.cells);
    // Every page loads the same stylesheets.
    styled = each.styled;
  }
  const captured = capturedCells(cells, read, styled);
  if (captured instanceof Error) {
    return yield* Effect.fail(captured);
  }
  const capture: SetCapture = {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    set: target.key,
    environment: {
      chromium: browser.version(),
      theme: `${CAPTURE_THEME.identity} ${CAPTURE_THEME.brand} ${CAPTURE_THEME.segment} ${CAPTURE_THEME.scheme} ${CAPTURE_THEME.density}`,
      locale: "en-US",
    },
    ...captured,
  };
  return capture;
});
