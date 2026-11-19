/**
 * The text of each element below a cell's root, between its element children, where an element's
 * `text` and `textIndex` lose some of it. DevTools' DOM tree leaves out a text node of white space
 * alone, and `text` joins an element's text nodes and trims them, so neither keeps the line feed
 * Code's highlighter writes between its line spans, nor the space it wraps in a span of its own. The
 * page reads the nodes itself. Each function is passed to the page as its source, so it reads nothing
 * outside its own body and its arguments.
 */

/**
 * An element's text nodes joined between its element children, where `text` and `textIndex` lose
 * some of them: the text before each element child, then the text after the last, so it holds one
 * more entry than the element has children. They lose white space at either end of a text node,
 * which `text` trims away, a node of white space alone included, and text on both sides of an
 * element child, which one `textIndex` cannot place. Runs in the page.
 *
 * @param element - The element.
 * @returns The texts, or null where `text` and `textIndex` hold all of them.
 */
export function lossyTexts(element: Element): string[] | null {
  const texts = [""];
  let trimmed = false;
  for (const node of element.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      texts.push("");
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      trimmed ||= text.trim() !== text;
      texts[texts.length - 1] += text;
    }
  }
  const split = texts.filter((text) => text !== "").length > 1;
  return trimmed || split ? texts : null;
}

/**
 * The lossy texts of an element and of every element below it but an `<svg>`'s, whose shapes the
 * capture does not read, each with the element-ordinal path from the element, `""` for the element
 * itself and `"0/2"` for its first child's third. Runs in the page.
 *
 * @param root - The element.
 * @param lossy - {@link lossyTexts}, handed to the page with it.
 * @returns Each element that has some, by path, with its texts.
 */
export function textsBelow(
  root: Element,
  lossy: (element: Element) => string[] | null
): (readonly [string, string[]])[] {
  const found: (readonly [string, string[]])[] = [];
  const visit = (element: Element, path: string): void => {
    if (element.localName === "svg") {
      return;
    }
    const texts = lossy(element);
    if (texts !== null) {
      found.push([path, texts]);
    }
    [...element.children].forEach((child, index) => {
      visit(child, path === "" ? String(index) : `${path}/${String(index)}`);
    });
  };
  visit(root, "");
  return found;
}
