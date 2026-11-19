/**
 * Which elements generate no box of their own and add nothing to their parent's flow, as the
 * capture's page function reads them for the fact `noBox`. An element whose `display` is `contents`
 * generates no box, and its children and pseudo-elements take its place in its parent's flow (CSS
 * Display 3 §2.5), so the kit can lay its parts out in its parent where it adds no other box there:
 * no text of its own, which would be an anonymous box beside them (CSS 2.1 §9.2.2, CSS Grid 1 §6.1),
 * white space it preserves included,
 * and no `::before` or `::after` in flow, which would be one more box beside them (CSS Pseudo 4
 * §2). An absolute `::before` or `::after` sits out of the flow. The page records the fact only where
 * every mode it stamps shows it. Each function is passed to the page as its source, so it reads
 * nothing outside its own body and its arguments.
 */

/**
 * Whether an element holds text of its own that lays out as a line: a text node child with more
 * than white space, or white space the element preserves, which keeps its spaces under `preserve`,
 * `preserve-spaces` and `break-spaces`, and its line feeds under `preserve-breaks` (CSS Text 4
 * §3.1), so even text of white space alone lays out as an anonymous line box, as `white-space: pre`
 * keeps three spaces in a line of their own. Runs in the page.
 *
 * @param element - The element.
 * @returns True where it does.
 */
export function holdsOwnText(element: Element): boolean {
  const collapse = getComputedStyle(element).whiteSpaceCollapse;
  return [...element.childNodes].some((node) => {
    const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "") : "";
    if (text.trim() !== "") {
      return true;
    }
    if (collapse === "collapse") {
      return false;
    }
    return collapse === "preserve-breaks" ? text.includes("\n") : text.length > 0;
  });
}

/**
 * Whether an element's `::before` or `::after` generates a box in its parent's flow: its `content`
 * generates one, as anything but `none` and `normal` does on these, and it is neither absolute,
 * fixed nor `display: none`. Runs in the page.
 *
 * @param element - The element.
 * @returns True where one does.
 */
export function pseudoInFlow(element: Element): boolean {
  return ["::before", "::after"].some((pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return (
      !["none", "normal"].includes(style.content) &&
      style.display !== "none" &&
      !["absolute", "fixed"].includes(style.position)
    );
  });
}

/**
 * Whether an element generates no box and adds nothing to its parent's flow but its children's
 * boxes, as the module says. Runs in the page.
 *
 * @param element - The element.
 * @param ownText - {@link holdsOwnText}, handed to the page with it.
 * @param pseudo - {@link pseudoInFlow}, handed to the page with it.
 * @returns True where it does.
 */
export function generatesNoBox(
  element: Element,
  ownText: (element: Element) => boolean,
  pseudo: (element: Element) => boolean
): boolean {
  return getComputedStyle(element).display === "contents" && !ownText(element) && !pseudo(element);
}
