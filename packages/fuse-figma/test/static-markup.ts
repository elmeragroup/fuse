/**
 * Read the HTML `renderToStaticMarkup` writes, shared by the compare renderers' tests. React
 * writes every element with a closing tag except the void ones, quotes every attribute value
 * and escapes `"` and `>` inside them, so a tag scan finds each element and its parent. The
 * module also finds the element a cell renders for its component's root, and reads the state
 * attributes the checked-control cells vary.
 */

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
  /** Each attribute by name. An attribute written without a value holds the empty string. */
  readonly attributes: ReadonlyMap<string, string>;
  /** The index of the parent element, or undefined at the fragment's top level. */
  readonly parent: number | undefined;
};

/**
 * Every element of an HTML fragment, in document order.
 *
 * @param html - Markup from `renderToStaticMarkup`.
 * @returns The elements, each with its attributes and its parent's index.
 */
export function elementsOf(html: string): readonly MarkupElement[] {
  const elements: MarkupElement[] = [];
  const open: number[] = [];
  for (const [, closing, name = "", attributes = "", selfClosing] of html.matchAll(
    /<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g
  )) {
    if (closing === "/") {
      open.pop();
      continue;
    }
    elements.push({
      name: name.toLowerCase(),
      attributes: new Map(
        [...attributes.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map(([, key = "", value = ""]) => [
          key,
          value,
        ])
      ),
      parent: open.at(-1),
    });
    if (selfClosing !== "/" && !VOID_ELEMENTS.has(name.toLowerCase())) {
      open.push(elements.length - 1);
    }
  }
  return elements;
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
