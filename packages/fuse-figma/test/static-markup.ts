/**
 * Read the HTML `renderToStaticMarkup` writes, shared by the compare renderers' tests. React
 * writes every element with a closing tag except the void ones, quotes every attribute value
 * and escapes `"` and `>` inside them, so a tag scan finds each element and its parent.
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
