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
  cellSelector,
  forcedSelector,
  measuredSelectors,
  PAGE_LAYOUT,
  slotSpan,
} from "../compare/preview-page.ts";
import type { CellContent } from "../compare/preview-page.ts";
import type { PreviewTheme } from "../compare/preview-theme.ts";
import { matrixCells, variantKey } from "../components/component-spec.ts";
import type { AxisSpec } from "../components/kit-spec.ts";
import { ANCHOR_CENTRE, ANCHOR_WIDTH, CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type { MeasuredFacts } from "./capture-format.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  CapturedRoot,
  SetCapture,
  VariableSource,
} from "./capture-format.ts";
import type { InstanceManifest, PartManifest } from "./manifest.ts";
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
  isRecorded,
  owningClass,
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
  readonly addedAxes?: ReadonlySet<string>;
  readonly statePart?: string;
  readonly statePeer?: string;
  readonly focusPart?: string;
  /**
   * The BOOLEAN properties that show the set's optional parts, which every cell renders turned on:
   * the set draws each part, and its property hides it.
   */
  readonly optional?: ReadonlySet<string>;
  /** The width of the host the root sits in, in CSS pixels, or undefined for the slot's. */
  readonly previewWidthFor?: (cell: Readonly<Record<string, string>>) => number | undefined;
  /** The `data-slot` of each element an open composite's cell measures, as its manifest names them. */
  readonly union?: readonly string[];
  /** An anchored popup's distance from its anchor, which the perturbation probe measures. */
  readonly sideOffset?: number;
  /** The set's parts, whose keys the perturbation probe finds the layers of its boxes by. */
  readonly parts?: readonly (PartManifest | InstanceManifest)[];
};

/** The theme every capture renders in: the kit's first preview theme. */
export const CAPTURE_THEME: PreviewTheme = {
  scheme: "light",
  identity: "neutral",
  brand: "fkas",
  segment: "private",
  density: "dense",
};

/** A cell's forced state left its styles as its resting twin's, so the capture would record rest. */
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
  const turnedOn = [...(target.optional ?? [])];
  const content = (shown: Readonly<Record<string, string>>): CellContent => {
    if (!isClientRenderer(renderer)) {
      return { _tag: "Static", html: renderCellHtml(renderer, shown, target.optional) };
    }
    const client: CellContent = { _tag: "Client", set: target.key, cell: shown };
    return turnedOn.length === 0 ? client : { ...client, turnedOn };
  };
  // The root carries the slot its family stamps where the set names one.
  const root = { ...target, slot: target.elementSlot?.(cell) ?? target.slot };
  const forced = forcedPseudoClasses(cell, renderer.highlight);
  const writesHighlight = writesHighlightAttribute(cell, renderer.highlight);
  return {
    id: `c${String(index)}`,
    content: content(cell),
    measured: measuredSelectors(root, target.union),
    span: slotSpan(PAGE_LAYOUT, target.previewWidthFor?.(cell)),
    height: undefined,
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
  const classes = classesUp(element, path);
  return { element, all, kept: kept.map((winner) => capturedDeclaration(winner, classes)) };
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
const MEASURED: ReadonlySet<string> = new Set([
  "--anchor-height",
  "--available-height",
  "--available-width",
  "--transform-origin",
  "transform",
]);

/**
 * The declarations the capture keeps of an element's `style` attribute. Around a root it keeps only
 * custom properties, which pass down, since a harness host or Base UI writes the rest from what it
 * measured, such as a host as wide as its popup. Base UI's measured positioner values drop, and the
 * anchor's width stays as a symbol the build resolves, as does the offset Base UI gives an element
 * it places by its `data-side`, such as a popup's arrow, along that side.
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
  if (MEASURED.has(declaration.property) || (around && !declaration.property.startsWith("--"))) {
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
    // A `::before` or `::after` with no `content` renders no box (CSS Generated Content 3 §1.1).
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
  const placed = element.textIndex === undefined ? written : { ...written, textIndex: element.textIndex };
  return element.measured === undefined ? placed : { ...placed, measured: element.measured };
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
): Promise<readonly string[]> {
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
      return names.flatMap((name, index) => before[index] === after[index] ? [] : [name + ": " + before[index] + " became " + after[index]]);
    }`,
  });
  // SAFETY: the function above returns an array of strings by value.
  return (result.value ?? []) as readonly string[];
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

/** A cell's elements with the longhands each one's winners leave at their initial value. */
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
  return root instanceof UnknownLayer ? root : { ...raw, root };
}

/**
 * Measure a root's tree in the page and keep what holds on any platform, by each element's
 * element-ordinal path from the root, `""` for the root:
 *
 * - `containerWidth`, on the root: the content width of the element around it, where the root's
 *   margin box fills it, widening with it, and one more character of the root's text leaves it as it
 *   is, so CSS sets it and not the text. A positioned element with an auto width, as Base UI's
 *   positioner, shrinks to its content, so it is no such container.
 * - `widest`: in a root as wide as its own content and wider than its `min-width`, so its rows' text
 *   sets its width, the leaf row with text that fills its parent and whose own text is the widest,
 *   more than half a pixel wider than the next.
 * - `oneLine`: an element under a `max-width` whose own text sits on one line, or a wrapping flex
 *   row whose items do.
 * - `underMaxHeight`: an element more than half a pixel under its `max-height`.
 *
 * The page restores every element it changes before it returns.
 */
async function measuredFacts(cdp: CDPSession, nodeId: number): Promise<ReadonlyMap<string, MeasuredFacts>> {
  const { object } = await cdp.send("DOM.resolveNode", { nodeId });
  if (object.objectId === undefined) {
    return new Map();
  }
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    functionDeclaration: MEASURE_IN_PAGE,
  });
  // SAFETY: the page function returns facts by path, as plain JSON.
  return new Map(Object.entries((result.value ?? {}) as Record<string, MeasuredFacts>));
}

/** The page side of {@link measuredFacts}, called on the root. */
const MEASURE_IN_PAGE = `function () {
  const root = this;
  const out = {};
  const put = (path, key, value) => { (out[path] ??= {})[key] = value; };
  const contentWidth = (element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().width - ["padding-left", "padding-right", "border-left-width", "border-right-width"].reduce((sum, name) => sum + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
  };
  const texts = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const found = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim() !== "") { found.push(node); }
    }
    return found;
  };
  const withLonger = (element, read) => {
    const nodes = texts(element);
    const before = nodes.map((node) => node.textContent);
    nodes.forEach((node) => { node.textContent += "W"; });
    const value = read();
    nodes.forEach((node, index) => { node.textContent = before[index]; });
    return value;
  };
  const maxContent = (element) => {
    const style = element.getAttribute("style");
    element.style.width = "max-content";
    const width = element.getBoundingClientRect().width;
    if (style === null) { element.removeAttribute("style"); } else { element.setAttribute("style", style); }
    return width;
  };
  const elements = [];
  const walk = (element, path) => {
    elements.push({ element, path });
    if (element.localName === "svg") { return; }
    [...element.children].forEach((child, index) => walk(child, path === "" ? String(index) : path + "/" + String(index)));
  };
  walk(root, "");
  const parent = root.parentElement;
  const shrinks = (element) => ["absolute", "fixed"].includes(getComputedStyle(element).position);
  if (parent !== null && !shrinks(root) && !shrinks(parent)) {
    const before = contentWidth(parent);
    const style = parent.getAttribute("style");
    const width = root.getBoundingClientRect().width;
    parent.style.width = String(parent.getBoundingClientRect().width + 10) + "px";
    const follows = Math.abs(root.getBoundingClientRect().width - width - 10) <= 0.5;
    if (style === null) { parent.removeAttribute("style"); } else { parent.setAttribute("style", style); }
    const own = getComputedStyle(root);
    const margins = (Number.parseFloat(own.marginLeft) || 0) + (Number.parseFloat(own.marginRight) || 0);
    const fills = Math.abs(width + margins - before) <= 0.5 && follows;
    if (fills && withLonger(root, () => Math.abs(contentWidth(parent) - before) <= 0.01)) {
      put("", "containerWidth", Math.round(before * 100) / 100);
    }
  }
  const minimum = Number.parseFloat(getComputedStyle(root).minWidth) || 0;
  const width = root.getBoundingClientRect().width;
  if (width > minimum + 0.5 && Math.abs(maxContent(root) - width) <= 0.5) {
    const rows = elements.filter(({ element }) => element !== root && element.hasAttribute("data-slot") && element.parentElement !== null && texts(element).length > 0 && Math.abs(element.getBoundingClientRect().width - contentWidth(element.parentElement)) <= 0.5);
    const leaves = rows.filter((row) => !rows.some((other) => other !== row && row.element.contains(other.element)));
    const widths = leaves.map(({ element, path }) => ({ path, width: maxContent(element) })).sort((left, right) => right.width - left.width);
    const [first, second] = widths;
    if (first !== undefined && (second === undefined || first.width - second.width > 0.5)) {
      put(first.path, "widest", true);
    }
  }
  for (const { element, path } of elements) {
    const style = getComputedStyle(element);
    const own = [...element.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
    if (style.flexWrap.startsWith("wrap") && element.children.length > 1) {
      let bottom = -Infinity;
      let lines = 0;
      for (const child of [...element.children].map((each) => each.getBoundingClientRect()).sort((left, right) => left.top - right.top)) {
        if (child.top >= bottom - 0.5) { lines += 1; }
        bottom = Math.max(bottom, child.bottom);
      }
      if (lines === 1) { put(path, "oneLine", true); }
    } else if (own.length > 0 && style.maxWidth !== "none") {
      const tops = new Set();
      for (const node of own) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) { tops.add(Math.round(rect.top)); }
      }
      if (tops.size === 1) { put(path, "oneLine", true); }
    }
    if (style.maxHeight !== "none" && element.getBoundingClientRect().height + 0.5 < Number.parseFloat(style.maxHeight)) {
      put(path, "underMaxHeight", true);
    }
  }
  return out;
}`;

/**
 * A cell's roots with the anchored popup's root marked where the anchor beside it is more than half a
 * pixel wider than the popup's `min-width`: Base UI then widens the popup to the anchor, which the
 * build draws only for an anchor whose width the spec holds. A cell of one root, or of two roots
 * neither of which Base UI placed by its `data-side`, stays as it is.
 */
async function withAnchorFact(cdp: CDPSession, roots: readonly RawCell[]): Promise<readonly RawCell[]> {
  const side = (raw: RawCell): boolean => raw.root.attributes.some(([name]) => name === "data-side");
  const popup = roots.find(side);
  const anchor = roots.find((raw) => !side(raw));
  if (roots.length !== 2 || popup === undefined || anchor === undefined) {
    return roots;
  }
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

/** A cell root's elements with what the page measured of each. */
async function withMeasuredFacts(cdp: CDPSession, raw: RawCell): Promise<RawCell> {
  const facts = await measuredFacts(cdp, raw.root.nodeId);
  const attach = (element: RawElement, path: string): RawElement => {
    const children = element.children.map((child, index) =>
      attach(child, path === "" ? String(index) : `${path}/${String(index)}`)
    );
    const measured = facts.get(path);
    return measured === undefined ? { ...element, children } : { ...element, children, measured };
  };
  return { ...raw, root: attach(raw.root, "") };
}

/** Check every winner of a cell's elements against the browser. */
async function verifyCell(cdp: CDPSession, raw: RawCell): Promise<readonly string[] | UnknownLayer> {
  const found: string[] = [];
  const elements: RawElement[] = [];
  const collect = (element: RawElement): void => {
    elements.push(element);
    element.children.forEach(collect);
  };
  collect(raw.root);
  for (const element of elements) {
    const winners = resolveWinners(element.rules);
    if (winners instanceof UnknownLayer) {
      return winners;
    }
    const checks = winners
      .filter((winner) => winner.rule.source !== "user-agent")
      .map(({ property, longhands }) => ({ property: property.name, value: property.value, longhands }));
    for (const change of await contradictions(cdp, element.nodeId, checks)) {
      found.push(`${elementName(element)} ${change}`);
    }
  }
  return found;
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
  for (const { request, key } of cells) {
    if (forcesState(request) && !opened.forced.has(request.id)) {
      return new StateNotReached(
        `${key}: forcing ${request.forced.join(" and ")} changed no style against the cell at rest`
      );
    }
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
  for (const [at, roots] of checked.entries()) {
    for (const wrong of roots) {
      if (wrong instanceof UnknownLayer) {
        return wrong;
      }
      if (wrong.length > 0) {
        return new WinnerContradicted(
          `${cells[at]?.key ?? ""}: the browser computes other values than the resolved winners:\n  ${wrong.join("\n  ")}`
        );
      }
    }
  }
  const measured: (readonly RawCell[])[] = [];
  for (const roots of grouped) {
    const facts = await Promise.all(roots.map((raw) => withMeasuredFacts(opened.cdp, raw)));
    measured.push(await withAnchorFact(opened.cdp, facts));
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
  // A forced state that leaves every winner as at rest drew the cell at rest, however its computed
  // styles changed, as a forced state DevTools lost by node id did.
  const printed = new Map(captured.map((each) => [each.key, JSON.stringify(each.roots)]));
  for (const { key, rest } of cells) {
    if (rest !== undefined && printed.get(key) === printed.get(rest)) {
      return new StateNotReached(`${key}: the capture holds the same winners as ${rest}`);
    }
  }
  return { page, declarations: table.declarations, cells: captured };
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
  const cells: readonly PlannedCell[] = matrixCells(target.axes).map((cell, index) => ({
    cell,
    key: variantKey(target, cell),
    request: requestOf(target, renderer, cell, index),
    rest:
      forcedPseudoClasses(cell, renderer.highlight).length > 0 ||
      writesHighlightAttribute(cell, renderer.highlight)
        ? variantKey(target, restingTwin(cell))
        : undefined,
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
