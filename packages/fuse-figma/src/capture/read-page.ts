/**
 * Read a cell from an opened compare page through the Chrome DevTools Protocol: the elements from
 * `<html>` down to the cell's root, the elements below the root, and for each one the rules Chromium
 * matched on it, its own and its pseudo-elements', with each rule's stylesheet, layer and matching
 * selectors. `winners.ts` resolves the cascade from them.
 */

import type { CDPSession } from "playwright";

import type { MeasuredFacts } from "./capture-format.ts";
import { classNamesIn, physicalLonghand, selectorsIn } from "./winners.ts";
import type { RawProperty, RawRule, RuleSource } from "./winners.ts";

/** An element as the page holds it, with the rules Chromium matched on it. */
export type RawElement = {
  /** The node's DevTools id, which the verification resolves the node by. */
  readonly nodeId: number;
  readonly tag: string;
  readonly attributes: readonly (readonly [string, string])[];
  readonly classes: readonly string[];
  readonly text: string;
  /** How many element children precede the first own text node, where the element has text. */
  readonly textIndex: number | undefined;
  readonly rules: readonly RawRule[];
  /**
   * The rules matched on each of the element's pseudo-elements, each pseudo-element the page matched
   * a rule on, such as a scrollbar's, of which the capture records {@link KEPT_PSEUDO}'s.
   */
  readonly pseudo: readonly { readonly name: string; readonly rules: readonly RawRule[] }[];
  readonly children: readonly RawElement[];
  /** The longhands whose computed value is their initial value, once the verification read them. */
  readonly initial: ReadonlySet<string>;
  /** What the capture measured of the element, once `run-capture.ts` measured it. */
  readonly measured?: MeasuredFacts;
};

/** The page holds no element a cell names, so the capture has nothing to read. */
export class CellNotFound extends Error {
  readonly _tag = "CellNotFound" as const;
}

/**
 * The parts of the DevTools protocol's types the read uses. Playwright types `CDPSession.send` with
 * the full protocol from `playwright-core`, which this package does not depend on directly, and its
 * results fit these.
 */
type CdpNode = {
  readonly nodeId: number;
  readonly nodeType: number;
  readonly localName: string;
  readonly nodeValue: string;
  readonly attributes?: readonly string[];
  readonly children?: readonly CdpNode[];
  readonly shadowRoots?: readonly CdpNode[];
};

type CdpProperty = {
  readonly name: string;
  readonly value: string;
  readonly important?: boolean;
  readonly implicit?: boolean;
  readonly text?: string;
  readonly disabled?: boolean;
  readonly parsedOk?: boolean;
  readonly longhandProperties?: readonly { readonly name: string }[];
};

type CdpStyle = { readonly cssProperties: readonly CdpProperty[] };

type CdpSpecificity = { readonly a: number; readonly b: number; readonly c: number };

type CdpRule = {
  readonly styleSheetId?: string;
  readonly origin: string;
  readonly selectorList: {
    readonly text: string;
    readonly selectors: readonly { readonly text: string; readonly specificity?: CdpSpecificity }[];
  };
  readonly style: CdpStyle;
  readonly layers?: readonly { readonly text: string }[];
};

type CdpRuleMatch = { readonly rule: CdpRule; readonly matchingSelectors: readonly number[] };

/** The pseudo-elements the capture keeps, those a kit cell can draw. */
export const KEPT_PSEUDO: ReadonlySet<string> = new Set(["placeholder", "before", "after"]);

/** Where a rule comes from, by its stylesheet's URL, its layer and its selector. */
function ruleSource(rule: CdpRule, sheets: ReadonlyMap<string, string>, layer: string): RuleSource {
  if (rule.origin === "user-agent") {
    return "user-agent";
  }
  const url = rule.styleSheetId === undefined ? "" : (sheets.get(rule.styleSheetId) ?? "");
  const path = url === "" ? "" : new URL(url).pathname;
  if (path.endsWith("/fuse/themes.css")) {
    return "theme";
  }
  if (path.endsWith("/fuse/styles.css")) {
    return layer === "theme" ? "theme" : "fuse";
  }
  if (path.endsWith("/tailwind/preflight.css")) {
    return "preflight";
  }
  // The page's own `<style>` sets the body's font and color and compiles the classes a renderer names
  // as the host's own into `utilities`, as a host does; its other rules place, hide and steady the
  // cells.
  return rule.selectorList.text === "body" || layer === "utilities" ? "page" : "harness";
}

const IMPORTANT = /\s*!important\s*$/;

/** The declarations a style writes: the authored ones where it has source text, else every explicit one. */
function propertiesOf(style: CdpStyle): readonly RawProperty[] {
  const authored = style.cssProperties.some((property) => property.text !== undefined);
  return style.cssProperties
    .filter((property) =>
      authored
        ? property.text !== undefined && property.disabled !== true && property.parsedOk !== false
        : property.implicit !== true
    )
    .map((property) => ({
      name: property.name,
      value: property.value.replace(IMPORTANT, ""),
      important: property.important === true || IMPORTANT.test(property.value),
      longhands:
        property.longhandProperties === undefined || property.longhandProperties.length === 0
          ? [property.name]
          : property.longhandProperties.map((longhand) => longhand.name),
    }));
}

/** A matched rule as {@link RawRule} keeps it. */
function sourcedRule(match: CdpRuleMatch, sheets: ReadonlyMap<string, string>): RawRule {
  const { rule } = match;
  const layer = (rule.layers ?? [])
    .map((each) => each.text)
    .filter((text) => text !== "")
    .join(".");
  const matching = match.matchingSelectors.flatMap((index) => {
    const selector = rule.selectorList.selectors[index];
    return selector === undefined ? [] : [selector];
  });
  const specificity = matching
    .map(({ specificity }): readonly [number, number, number] => [
      specificity?.a ?? 0,
      specificity?.b ?? 0,
      specificity?.c ?? 0,
    ])
    .reduce<readonly [number, number, number]>(
      (best, each) => ((each[0] - best[0] || each[1] - best[1] || each[2] - best[2]) > 0 ? each : best),
      [0, 0, 0]
    );
  return {
    source: ruleSource(rule, sheets, layer),
    layer,
    selector: matching.map((selector) => selector.text).join(", "),
    specificity,
    properties: propertiesOf(rule.style),
  };
}

/** The style attribute as a rule, after every matched one. */
function inlineRule(style: CdpStyle | undefined): readonly RawRule[] {
  const properties = style === undefined ? [] : propertiesOf(style);
  return properties.length === 0
    ? []
    : [{ source: "inline", layer: "", selector: "", specificity: [0, 0, 0], properties }];
}

/** The attribute pairs of a node, which DevTools lists flat. */
function attributePairs(node: CdpNode): readonly (readonly [string, string])[] {
  const flat = node.attributes ?? [];
  const pairs: (readonly [string, string])[] = [];
  for (let index = 0; index + 1 < flat.length; index += 2) {
    pairs.push([flat[index] ?? "", flat[index + 1] ?? ""]);
  }
  return pairs;
}

/** The `pseudo` the browser gives the element in an `<input>`'s own shadow root that draws its placeholder. */
const PLACEHOLDER_PSEUDO = "-webkit-input-placeholder";

/**
 * The `::placeholder` rules of an `<input>` or `<textarea>`. DevTools lists no placeholder among an
 * element's pseudo-elements: the placeholder is an element in the control's own shadow root, which
 * the page read with `pierce`, and its matched rules hold the `::placeholder` ones among the
 * browser's own for that element, which the read leaves out.
 */
async function placeholderRules(
  cdp: CDPSession,
  sheets: ReadonlyMap<string, string>,
  node: CdpNode
): Promise<readonly RawRule[]> {
  const holder = (node.shadowRoots ?? [])
    .flatMap((root) => root.children ?? [])
    .find((child) =>
      attributePairs(child).some(([name, value]) => name === "pseudo" && value === PLACEHOLDER_PSEUDO)
    );
  if (holder === undefined) {
    return [];
  }
  const matched = await cdp.send("CSS.getMatchedStylesForNode", { nodeId: holder.nodeId });
  return (matched.matchedCSSRules ?? [])
    .map((match) => sourcedRule(match, sheets))
    .filter((rule) => rule.source !== "user-agent" && rule.selector.includes("::placeholder"));
}

/**
 * Read one element and, unless it is an `<svg>`, whose shapes the kit draws as one icon, the
 * elements below it.
 */
async function readElement(
  cdp: CDPSession,
  sheets: ReadonlyMap<string, string>,
  node: CdpNode,
  withChildren: boolean
): Promise<RawElement> {
  const matched = await cdp.send("CSS.getMatchedStylesForNode", { nodeId: node.nodeId });
  const attributes = attributePairs(node);
  const tag = node.localName;
  const children =
    withChildren && tag !== "svg"
      ? await Promise.all(
          (node.children ?? [])
            .filter((child) => child.nodeType === 1)
            .map((child) => readElement(cdp, sheets, child, true))
        )
      : [];
  const placeholder = await placeholderRules(cdp, sheets, node);
  return {
    nodeId: node.nodeId,
    tag,
    attributes,
    classes: (attributes.find(([name]) => name === "class")?.[1] ?? "").split(/\s+/).filter(Boolean),
    text: (node.children ?? [])
      .filter((child) => child.nodeType === 3)
      .map((child) => child.nodeValue)
      .join("")
      .trim(),
    textIndex: textIndexOf(node),
    rules: [
      ...(matched.matchedCSSRules ?? []).map((match) => sourcedRule(match, sheets)),
      ...inlineRule(matched.inlineStyle),
    ],
    pseudo: [
      ...(matched.pseudoElements ?? []).map((entry) => ({
        name: entry.pseudoType,
        rules: entry.matches.map((match) => sourcedRule(match, sheets)),
      })),
      ...(placeholder.length === 0 ? [] : [{ name: "placeholder", rules: placeholder }]),
    ],
    children,
    initial: new Set(),
  };
}

/** How many element children of a node precede its first text node that holds more than white space. */
function textIndexOf(node: CdpNode): number | undefined {
  let elements = 0;
  for (const child of node.children ?? []) {
    if (child.nodeType === 3 && child.nodeValue.trim() !== "") {
      return elements;
    }
    if (child.nodeType === 1) {
      elements += 1;
    }
  }
  return undefined;
}

/** The document's nodes, with each node's parent, read once per page. */
export type DocumentIndex = {
  readonly parents: ReadonlyMap<number, CdpNode>;
  readonly nodes: ReadonlyMap<number, CdpNode>;
  readonly root: CdpNode;
};

/**
 * Index the page's whole DOM, which the cells' reads walk.
 *
 * @param root - The document, as the opened page read it.
 * @returns The document and each node's parent.
 */
export function indexDocument(root: CdpNode): DocumentIndex {
  const parents = new Map<number, CdpNode>();
  const nodes = new Map<number, CdpNode>();
  const visit = (node: CdpNode): void => {
    nodes.set(node.nodeId, node);
    for (const child of node.children ?? []) {
      parents.set(child.nodeId, node);
      visit(child);
    }
  };
  visit(root);
  return { parents, nodes, root };
}

/** A cell as the page holds it: the elements around its root, outermost first, and the root. */
export type RawCell = {
  readonly around: readonly RawElement[];
  readonly root: RawElement;
};

/**
 * Read one cell's root, the elements around it and the elements below it.
 *
 * @param cdp - The page's DevTools session.
 * @param sheets - Each stylesheet's URL, by its DevTools id.
 * @param index - The page's DOM.
 * @param selector - The root's selector from the document.
 * @param page - The page's elements read so far, which every cell shares: `<html>`, `<body>` and
 *   the first slot, whose rules every slot shares but for the `style` attribute that places it.
 * @returns The cell, or `CellNotFound` where no element matches the selector.
 */
export async function readCell(
  cdp: CDPSession,
  sheets: ReadonlyMap<string, string>,
  index: DocumentIndex,
  selector: string,
  page: Map<string, RawElement>
): Promise<RawCell | CellNotFound> {
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: index.root.nodeId, selector });
  const node = index.nodes.get(nodeId);
  if (nodeId === 0 || node === undefined) {
    return new CellNotFound(`the page holds no element ${selector}`);
  }
  const chain: CdpNode[] = [];
  for (
    let parent = index.parents.get(nodeId);
    parent !== undefined;
    parent = index.parents.get(parent.nodeId)
  ) {
    if (parent.nodeType === 1) {
      chain.unshift(parent);
    }
  }
  const around: RawElement[] = [];
  let inside = false;
  for (const each of chain) {
    const slot = attributePairs(each).some(([name]) => name === "data-compare-cell");
    const key = slot ? "slot" : String(each.nodeId);
    const known = inside ? undefined : page.get(key);
    const element = known ?? (await readElement(cdp, sheets, each, false));
    if (!inside) {
      page.set(key, element);
    }
    around.push(element);
    inside ||= slot;
  }
  return { around, root: await readElement(cdp, sheets, node, true) };
}

/** Every property name a cell's rules write, its pseudo-elements' included. */
function propertyNames(element: RawElement, names: Set<string>): void {
  for (const rule of [...element.rules, ...element.pseudo.flatMap((pseudo) => pseudo.rules)]) {
    for (const property of rule.properties) {
      names.add(property.name);
    }
  }
  for (const child of element.children) {
    propertyNames(child, names);
  }
}

/** The element with each property's longhands taken from `longhands`. */
function withLonghands(element: RawElement, longhands: ReadonlyMap<string, readonly string[]>): RawElement {
  const rule = (each: RawRule): RawRule => ({
    ...each,
    properties: each.properties.map((property) => ({
      ...property,
      longhands: [...new Set((longhands.get(property.name) ?? property.longhands).map(physicalLonghand))],
    })),
  });
  return {
    ...element,
    rules: element.rules.map(rule),
    pseudo: element.pseudo.map((pseudo) => ({ ...pseudo, rules: pseudo.rules.map(rule) })),
    children: element.children.map((child) => withLonghands(child, longhands)),
  };
}

/**
 * Give every property of a cell's rules the longhands the browser expands it to. DevTools lists a
 * shorthand's longhands only where its value parses without `var()`, so `border-color:
 * var(--border)` comes with none. The page expands each name itself: a shorthand set to `initial`
 * on a detached element sets each of its longhands.
 *
 * @param cdp - The page's DevTools session.
 * @param cells - The cells as read.
 * @returns The cells, each property with its longhands.
 */
export async function expandLonghands(
  cdp: CDPSession,
  cells: readonly RawCell[]
): Promise<readonly RawCell[]> {
  const names = new Set<string>();
  for (const cell of cells) {
    for (const element of [...cell.around, cell.root]) {
      propertyNames(element, names);
    }
  }
  const { result } = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(${String((list: readonly string[]) =>
      list.map((name) => {
        if (name.startsWith("--")) {
          return [name, [name]];
        }
        const probe = document.createElement("div");
        probe.style.setProperty(name, "initial");
        const set = Array.from({ length: probe.style.length }, (_, index) => probe.style.item(index));
        return [name, set.length === 0 ? [name] : set];
      })
    )})(${JSON.stringify([...names].toSorted())})`,
  });
  // SAFETY: the expression above returns `[name, longhands]` pairs by value.
  const longhands = new Map((result.value ?? []) as readonly (readonly [string, readonly string[]])[]);
  return cells.map((cell) => ({
    around: cell.around.map((element) => withLonghands(element, longhands)),
    root: withLonghands(cell.root, longhands),
  }));
}

/**
 * The classes the page's stylesheets write a rule for: the first class each selector of each style
 * rule names, as a Tailwind utility's selector names its own class first, in every imported sheet,
 * layer, media query and nesting.
 *
 * @param cdp - The page's DevTools session.
 * @returns The classes.
 */
export async function styledClasses(cdp: CDPSession): Promise<ReadonlySet<string>> {
  const { result } = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(${String(() => {
      const found: string[] = [];
      const visit = (rules: CSSRuleList): void => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            found.push(rule.selectorText);
          }
          if (rule instanceof CSSImportRule && rule.styleSheet !== null) {
            visit(rule.styleSheet.cssRules);
          } else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
            visit(rule.cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        visit(sheet.cssRules);
      }
      return found;
    })})()`,
  });
  // SAFETY: the expression above returns an array of selector texts by value.
  const lists = (result.value ?? []) as readonly string[];
  return new Set(
    lists.flatMap((list) =>
      selectorsIn(list).flatMap((selector) => {
        const [first] = classNamesIn(selector);
        return first === undefined ? [] : [first];
      })
    )
  );
}
