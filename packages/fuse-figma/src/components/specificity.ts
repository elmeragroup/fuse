/**
 * The specificity of a compiled selector, as CSS Selectors Level 4 section 17 defines it. The
 * spec builder orders a cell's classes by it, as the browser does for rules in one cascade
 * layer. `css-selector.ts` scans the selectors Tailwind prints: escaped class names, attributes,
 * pseudo-classes with selector arguments, type selectors, pseudo-elements and combinators.
 */

import { selectorAlternatives } from "./css-selector";
import type { SelectorPart } from "./css-selector";

/** IDs, then classes, attributes and pseudo-classes, then type selectors and pseudo-elements. */
export type Specificity = readonly [number, number, number];

const ZERO: Specificity = [0, 0, 0];

/** The CSS 2 pseudo-elements, which a selector may still write with one colon. */
const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);

/**
 * Compare two specificities.
 *
 * @returns A negative number when `left` is less specific, positive when more, 0 when equal.
 */
export function compareSpecificity(left: Specificity, right: Specificity): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

/**
 * The specificity of a selector. A selector list counts its most specific alternative, which is
 * the one a cell matches whenever its alternatives differ only inside `:where()`, as the
 * custom variants of `fuse.css` do.
 *
 * @param selector - A selector or selector list, as Tailwind prints it.
 * @returns Its specificity.
 * @throws When a bracket or parenthesis never closes, which Tailwind never prints.
 */
export function specificityOf(selector: string): Specificity {
  return selectorAlternatives(selector)
    .map((parts) => parts.map((part) => partSpecificity(selector, part)).reduce(add, ZERO))
    .reduce(highest, ZERO);
}

function highest(left: Specificity, right: Specificity): Specificity {
  return compareSpecificity(left, right) >= 0 ? left : right;
}

function add(left: Specificity, right: Specificity): Specificity {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function partSpecificity(selector: string, part: SelectorPart): Specificity {
  switch (part.kind) {
    case "id":
      return [1, 0, 0];
    case "class":
    case "attribute":
      return [0, 1, 0];
    case "type":
      return [0, 0, 1];
    case "pseudo":
      return pseudoSpecificity(part.name, part.argument ?? "", part.element);
    case "combinator":
      // A combinator, whitespace, the universal selector or a namespace bar counts nothing.
      return ZERO;
    case "unclosed":
      throw new Error(`the selector ${selector} does not close what opens at ${part.at}`);
  }
}

function pseudoSpecificity(name: string, argument: string, element: boolean): Specificity {
  if (element || LEGACY_PSEUDO_ELEMENTS.has(name)) {
    return [0, 0, 1];
  }
  switch (name) {
    case "where":
      return ZERO;
    case "is":
    case "not":
    case "has":
      return specificityOf(argument);
    default:
      return [0, 1, 0];
  }
}
