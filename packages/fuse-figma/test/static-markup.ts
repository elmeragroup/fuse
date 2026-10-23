/**
 * Read the HTML `renderToStaticMarkup` writes, shared by the compare renderers' tests. React
 * writes every element with a closing tag except the void ones, quotes every attribute value
 * and escapes `"` and `>` inside them, so a tag scan finds each element, its parent and its own
 * text. The module also finds the element a cell renders for its component's root, matches an
 * element a definition names by selector, and reads the state attributes the checked-control cells
 * vary.
 */

import type { ElementSelector } from "../src/components/component-spec.ts";

/** Elements HTML never closes. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** One element of a fragment, in document order. */
export type MarkupElement = {
  readonly name: string;
  /**
   * Each attribute by its name in lowercase, as an HTML parser reads it, since React writes some
   * in camel case, such as `readOnly`. An attribute written without a value holds the empty string.
   * Values read as {@link MarkupElement.text} does, with React's entities decoded.
   */
  readonly attributes: ReadonlyMap<string, string>;
  /** The index of the parent element, or undefined at the fragment's top level. */
  readonly parent: number | undefined;
  /**
   * The text the element holds outside its child elements. The entities React writes in text,
   * `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#x27;`, read as the characters they stand for.
   */
  readonly text: string;
};

/**
 * The entities React's static renderer writes in text and attribute values, by the character each
 * stands for.
 */
const ENTITIES = new Map([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#x27;", "'"],
]);

/** Text or an attribute value as React wrote it, decoded in one pass, so `&amp;lt;` reads as `&lt;`. */
function decode(written: string): string {
  return written.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES.get(entity) ?? entity);
}

/**
 * Every element of an HTML fragment, in document order.
 *
 * @param html - Markup from `renderToStaticMarkup`.
 * @returns The elements, each with its attributes, its parent's index and its own text.
 */
export function elementsOf(html: string): readonly MarkupElement[] {
  const elements: Omit<MarkupElement, "text">[] = [];
  const texts: string[] = [];
  const open: number[] = [];
  let textStart = 0;
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g)) {
    const [tag, closing, name = "", attributes = "", selfClosing] = match;
    // The text since the last tag belongs to the innermost element still open.
    const holder = open.at(-1);
    if (holder !== undefined) {
      texts[holder] = (texts[holder] ?? "") + html.slice(textStart, match.index);
    }
    textStart = match.index + tag.length;
    if (closing === "/") {
      open.pop();
      continue;
    }
    elements.push({
      name: name.toLowerCase(),
      attributes: new Map(
        [...attributes.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map(([, key = "", value = ""]) => [
          key.toLowerCase(),
          decode(value),
        ])
      ),
      parent: open.at(-1),
    });
    if (selfClosing !== "/" && !VOID_ELEMENTS.has(name.toLowerCase())) {
      open.push(elements.length - 1);
    }
  }
  return elements.map((element, index) => ({ ...element, text: decode(texts[index] ?? "") }));
}

/**
 * Whether an element is the one a definition's selector names: it has the selector's tag, or any
 * tag where the selector names `*`, each attribute the selector lists with that exact value or, for
 * `true`, any value, and each attribute its `prefixes` list with a value that starts with a prefix
 * that is not empty, as the selector's CSS form matches it in the browser.
 *
 * @param selector - The element a root or a part names, where its markup carries no `data-slot`.
 * @param element - An element of the markup.
 * @returns Whether the element matches.
 */
export function selects(
  selector: ElementSelector,
  element: Pick<MarkupElement, "name" | "attributes">
): boolean {
  return (
    (selector.tag === "*" || element.name === selector.tag) &&
    Object.entries(selector.attributes).every(([name, value]) => {
      const held = element.attributes.get(name);
      return value === true ? held !== undefined : held === value;
    }) &&
    Object.entries(selector.prefixes ?? {}).every(
      ([name, prefix]) => prefix !== "" && element.attributes.get(name)?.startsWith(prefix) === true
    )
  );
}

/** An element with the elements it holds, in document order. */
export type MarkupNode = {
  readonly name: string;
  /** Each attribute by name. An attribute written without a value holds the empty string. */
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly MarkupNode[];
};

/** The `data-slot` of a component's root, and the tag and role its element must have. */
export type ExpectedRoot = {
  readonly slot: string;
  readonly name: string;
  readonly role: string;
};

/** The element at `index`, with the elements it holds. */
function nodeOf(elements: readonly MarkupElement[], element: MarkupElement, index: number): MarkupNode {
  return {
    name: element.name,
    attributes: element.attributes,
    children: elements.flatMap((child, childIndex) =>
      child.parent === index ? [nodeOf(elements, child, childIndex)] : []
    ),
  };
}

/**
 * The element a cell renders for its component's root: the first element whose `data-slot` is
 * the root's slot, wherever the cell's wrappers put it, as a radio sits inside its `RadioGroup`.
 *
 * @param html - Markup from `renderToStaticMarkup`.
 * @param root - The root's slot, and the tag and role its element must have.
 * @returns The root's element, with the elements it holds.
 * @throws When no element carries the slot, or the first one that does has another tag or role.
 */
export function rootOf(html: string, root: ExpectedRoot): MarkupNode {
  const elements = elementsOf(html);
  const index = elements.findIndex((element) => element.attributes.get("data-slot") === root.slot);
  const element = elements[index];
  if (element?.name !== root.name || element.attributes.get("role") !== root.role) {
    throw new Error(`no <${root.name} role="${root.role}" data-slot="${root.slot}"> in ${html}`);
  }
  return nodeOf(elements, element, index);
}

/** Base UI's checked attributes: `data-checked` while a control is on, `data-unchecked` while off. */
const CHECKED = ["data-checked", "data-unchecked"];

/**
 * The attributes of a disabled Base UI span, `aria-disabled` and `data-disabled`, the native
 * `disabled` such a span never carries, and the `aria-invalid` and `data-invalid` of a control
 * in an invalid field.
 */
const DISABLED_AND_INVALID = ["aria-disabled", "data-disabled", "disabled", "aria-invalid", "data-invalid"];

/**
 * The state attributes an element of a Radio, Radio icon button or Switch cell carries, among
 * the ones those cells vary.
 *
 * @param element - An element of the markup.
 * @returns The attributes it carries, the checked pair first and the disabled and invalid ones
 *   after.
 */
export function stateAttributes(element: Pick<MarkupElement, "attributes">): readonly string[] {
  return [...CHECKED, ...DISABLED_AND_INVALID].filter((name) => element.attributes.has(name));
}

/**
 * The state attributes a Checkbox carries, among the ones its cells vary: a checked control's,
 * and Base UI's `data-indeterminate` while it is mixed.
 *
 * @param element - An element of the markup.
 * @returns The attributes it carries, with `data-indeterminate` after the checked pair.
 */
export function checkboxStateAttributes(element: Pick<MarkupElement, "attributes">): readonly string[] {
  return [...CHECKED, "data-indeterminate", ...DISABLED_AND_INVALID].filter((name) =>
    element.attributes.has(name)
  );
}
