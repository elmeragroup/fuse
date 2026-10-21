/**
 * The specificity of a compiled selector, as CSS Selectors Level 4 section 17 defines it. The
 * spec builder orders a cell's classes by it, as the browser does for rules in one cascade
 * layer. The scanner reads the selectors Tailwind prints: escaped class names, attributes,
 * pseudo-classes with selector arguments, type selectors, pseudo-elements and combinators.
 */

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
 */
export function specificityOf(selector: string): Specificity {
  return splitList(selector).map(complexSpecificity).reduce(highest, ZERO);
}

function highest(left: Specificity, right: Specificity): Specificity {
  return compareSpecificity(left, right) >= 0 ? left : right;
}

function add(left: Specificity, right: Specificity): Specificity {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

/** The end of an escape that starts at `index`: up to six hex digits and one space, or one character. */
function escapeEnd(selector: string, index: number): number {
  const hex = /^[0-9a-fA-F]{1,6} ?/.exec(selector.slice(index + 1));
  return index + 1 + (hex === null ? 1 : hex[0].length);
}

/** The end of the identifier that starts at `index`. */
function identifierEnd(selector: string, index: number): number {
  let end = index;
  while (end < selector.length) {
    const char = selector.charAt(end);
    if (char === "\\") {
      end = escapeEnd(selector, end);
    } else if (/[\w-]/.test(char) || char.charCodeAt(0) > 0x7f) {
      end += 1;
    } else {
      break;
    }
  }
  return end;
}

/** The index just past the bracket or parenthesis that closes the one at `index`. */
function closingEnd(selector: string, index: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let end = index; end < selector.length; end += 1) {
    const char = selector.charAt(end);
    if (char === "\\") {
      end = escapeEnd(selector, end) - 1;
    } else if (quote !== undefined) {
      quote = char === quote ? undefined : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return end + 1;
      }
    }
  }
  throw new Error(`the selector ${selector} does not close what opens at ${index}`);
}

/** The alternatives of a selector list, split at the commas outside brackets, parentheses and escapes. */
function splitList(selector: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    if (char === "\\") {
      index = escapeEnd(selector, index);
    } else if (char === "(" || char === "[") {
      index = closingEnd(selector, index);
    } else {
      if (char === ",") {
        parts.push(selector.slice(start, index));
        start = index + 1;
      }
      index += 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** The specificity of one complex selector, or of a relative one inside `:has()`. */
function complexSpecificity(selector: string): Specificity {
  let total = ZERO;
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    if (char === "#" || char === ".") {
      total = add(total, char === "#" ? [1, 0, 0] : [0, 1, 0]);
      index = identifierEnd(selector, index + 1);
    } else if (char === "[") {
      total = add(total, [0, 1, 0]);
      index = closingEnd(selector, index);
    } else if (char === ":") {
      const element = selector.charAt(index + 1) === ":";
      const nameStart = index + (element ? 2 : 1);
      const nameEnd = identifierEnd(selector, nameStart);
      const name = selector.slice(nameStart, nameEnd).toLowerCase();
      let argument = "";
      index = nameEnd;
      if (selector.charAt(index) === "(") {
        const end = closingEnd(selector, index);
        argument = selector.slice(index + 1, end - 1);
        index = end;
      }
      total = add(total, pseudoSpecificity(name, argument, element));
    } else if (char === "\\" || /[\w-]/.test(char) || char.charCodeAt(0) > 0x7f) {
      total = add(total, [0, 0, 1]);
      index = identifierEnd(selector, index);
    } else {
      // A combinator, whitespace, the universal selector or a namespace bar counts nothing.
      index += 1;
    }
  }
  return total;
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
