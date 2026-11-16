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
import { CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  SetCapture,
  VariableSource,
} from "./capture-format.ts";
import { CellNotFound, expandLonghands, indexDocument, readCell } from "./read-page.ts";
import type { RawCell, RawElement } from "./read-page.ts";
import { capturedDeclaration, isRecorded, resolveWinners, UnknownLayer } from "./winners.ts";
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
function requestOf(
  target: CaptureTarget,
  renderer: AnyCellRenderer,
  cell: Readonly<Record<string, string>>,
  index: number
): CellRequest {
  const content = (shown: Readonly<Record<string, string>>): CellContent =>
    isClientRenderer(renderer)
      ? { _tag: "Client", set: target.key, cell: shown }
      : { _tag: "Static", html: renderCellHtml(renderer, shown, target.optional) };
  // The root carries the slot its family stamps where the set names one.
  const root = { ...target, slot: target.elementSlot?.(cell) ?? target.slot };
  const forced = forcedPseudoClasses(cell, renderer.highlight);
  const writesHighlight = writesHighlightAttribute(cell, renderer.highlight);
  return {
    id: `c${String(index)}`,
    content: content(cell),
    measured: measuredSelectors(root, isClientRenderer(renderer) ? renderer.union : undefined),
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
]);

/** How the capture writes an element. */
type ElementOptions = {
  readonly numbered: (value: string) => string;
  readonly table: DeclarationTable;
  readonly withChildren: boolean;
  /** Whether the element is the page's slot, whose `style` attribute and marks place it. */
  readonly slot: boolean;
};

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
  const kept = options.slot ? resolved.kept.filter((winner) => winner.source !== "inline") : resolved.kept;
  const here = [...path, resolved];
  const pseudo: Record<string, readonly CapturedDeclaration[]> = {};
  for (const { name, rules } of element.pseudo) {
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
  return {
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
    children,
  };
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

/** One cell's capture from its raw read, and the page's elements around it. */
function captureCell(
  raw: RawCell,
  key: string,
  cell: Readonly<Record<string, string>>,
  table: DeclarationTable
):
  | { readonly page: readonly CapturedElement[]; readonly cell: CapturedCell }
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
  const numbered = idNumbering();
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
  const root = captureElement(raw.root, path, { numbered, table, withChildren: true, slot: false });
  if (root instanceof UnknownLayer) {
    return root;
  }
  return { page: around.slice(0, slot + 1), cell: { key, cell, around: around.slice(slot + 1), root } };
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

/** Read and check the cells of an opened page, each with every property's longhands. */
async function readCells(
  opened: OpenedPreview,
  cells: readonly PlannedCell[]
): Promise<readonly RawCell[] | CaptureFailure> {
  const index = indexDocument(opened.document);
  const page = new Map<string, RawElement>();
  const read: RawCell[] = [];
  for (const { request, key } of cells) {
    if (forcesState(request) && !opened.forced.has(request.id)) {
      return new StateNotReached(
        `${key}: forcing ${request.forced.join(" and ")} changed no style against the cell at rest`
      );
    }
    const [measured, ...others] = request.measured;
    if (measured === undefined || others.length > 0) {
      return new CaptureUnsupported(
        `${key}: the cell measures ${String(request.measured.length)} elements, and the capture reads one root`
      );
    }
    const raw = await readCell(opened.cdp, opened.sheets, index, cellSelector(request.id, measured), page);
    if (raw instanceof CellNotFound) {
      return raw;
    }
    read.push(raw);
  }
  const expanded: RawCell[] = [];
  for (const raw of await expandLonghands(opened.cdp, read)) {
    const marked = await withInitial(opened.cdp, raw);
    if (marked instanceof UnknownLayer) {
      return marked;
    }
    expanded.push(marked);
  }
  for (const [at, raw] of expanded.entries()) {
    const wrong = await verifyCell(opened.cdp, raw);
    if (wrong instanceof UnknownLayer) {
      return wrong;
    }
    if (wrong.length > 0) {
      return new WinnerContradicted(
        `${cells[at]?.key ?? ""}: the browser computes other values than the resolved winners:\n  ${wrong.join("\n  ")}`
      );
    }
  }
  return expanded;
}

/** Turn the read cells into the capture's page, declarations and cells, in matrix order. */
function capturedCells(
  cells: readonly PlannedCell[],
  read: readonly RawCell[]
): Pick<SetCapture, "page" | "declarations" | "cells"> | CaptureFailure {
  const table = new DeclarationTable();
  const captured: CapturedCell[] = [];
  let page: readonly CapturedElement[] = [];
  for (const [at, { key, cell }] of cells.entries()) {
    const raw = read[at];
    if (raw === undefined) {
      return new CaptureUnsupported(`${key}: the page read no cell`);
    }
    const one = captureCell(raw, key, cell, table);
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
  const printed = new Map(captured.map((each) => [each.key, JSON.stringify([each.around, each.root])]));
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
  const read: RawCell[] = [];
  for (const each of reads) {
    if (each instanceof Error) {
      return yield* Effect.fail(each);
    }
    read.push(...each);
  }
  const captured = capturedCells(cells, read);
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
