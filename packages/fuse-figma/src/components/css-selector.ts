/**
 * A scanner for the selectors Tailwind prints, shared by the specificity count and the reading of
 * a part's presence: escaped identifiers, attributes with quoted values, pseudo-classes and
 * pseudo-elements with selector arguments, type selectors and combinators.
 */

/**
 * One piece of a complex selector, in source order. An ID, class or type selector carries its
 * name with its escapes read. An attribute selector carries the text between its brackets. A
 * pseudo-class, or a pseudo-element where `element` is set, carries its lowercase name and the text
 * between its parentheses. A combinator stands for a combinator, whitespace, the universal
 * selector or a namespace bar. An unclosed part is a bracket or parenthesis that opens at `at`
 * and never closes, which ends the scan.
 */
export type SelectorPart =
  | { readonly kind: "id" | "class" | "type"; readonly name: string }
  | { readonly kind: "attribute"; readonly body: string }
  | {
      readonly kind: "pseudo";
      readonly name: string;
      readonly element: boolean;
      readonly argument: string | undefined;
    }
  | { readonly kind: "combinator" }
  | { readonly kind: "unclosed"; readonly at: number };

/** The end of an escape that starts at `index`: up to six hex digits and one space, or one character. */
function escapeEnd(selector: string, index: number): number {
  const hex = /^[0-9a-fA-F]{1,6} ?/.exec(selector.slice(index + 1));
  return index + 1 + (hex === null ? 1 : hex[0].length);
}

/** Whether a character continues an identifier: a word character, a hyphen or any non-ASCII one. */
function continuesIdentifier(char: string): boolean {
  return /[\w-]/.test(char) || char.charCodeAt(0) > 0x7f;
}

/** The end of the identifier that starts at `index`. */
function identifierEnd(selector: string, index: number): number {
  let end = index;
  while (end < selector.length) {
    const char = selector.charAt(end);
    if (char === "\\") {
      end = escapeEnd(selector, end);
    } else if (continuesIdentifier(char)) {
      end += 1;
    } else {
      break;
    }
  }
  return end;
}

/**
 * Read the escapes of an identifier or a string's contents, such as `bg-primary\/80`.
 *
 * @param text - The text as the selector writes it.
 * @returns The text it stands for, such as `bg-primary/80`.
 */
function unescapeCss(text: string): string {
  let read = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char !== "\\") {
      read += char;
      continue;
    }
    const hex = /^[0-9a-fA-F]{1,6} ?/.exec(text.slice(index + 1));
    if (hex === null) {
      read += text.charAt(index + 1);
      index += 1;
    } else {
      read += String.fromCodePoint(Number.parseInt(hex[0].trim(), 16));
      index += hex[0].length;
    }
  }
  return read;
}

/**
 * The index just past the bracket or parenthesis that closes the one at `index`, skipping escapes
 * and quoted strings, or undefined where nothing closes it.
 */
function closingEnd(selector: string, index: number): number | undefined {
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
  return undefined;
}

/**
 * The alternatives of a selector list, split at the commas outside brackets, parentheses and
 * escapes. Where a bracket never closes, the rest of the list is one last alternative.
 */
function splitList(selector: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    if (char === "\\") {
      index = escapeEnd(selector, index);
    } else if (char === "(" || char === "[") {
      index = closingEnd(selector, index) ?? selector.length;
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

/** The pieces of one complex selector, or of a relative one inside `:has()`. */
function scanComplex(selector: string): readonly SelectorPart[] {
  const parts: SelectorPart[] = [];
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    if (char === "#" || char === ".") {
      const end = identifierEnd(selector, index + 1);
      parts.push({ kind: char === "#" ? "id" : "class", name: unescapeCss(selector.slice(index + 1, end)) });
      index = end;
    } else if (char === "[") {
      const end = closingEnd(selector, index);
      if (end === undefined) {
        parts.push({ kind: "unclosed", at: index });
        return parts;
      }
      parts.push({ kind: "attribute", body: selector.slice(index + 1, end - 1) });
      index = end;
    } else if (char === ":") {
      const element = selector.charAt(index + 1) === ":";
      const nameStart = index + (element ? 2 : 1);
      const nameEnd = identifierEnd(selector, nameStart);
      const name = selector.slice(nameStart, nameEnd).toLowerCase();
      let argument: string | undefined;
      index = nameEnd;
      if (selector.charAt(index) === "(") {
        const end = closingEnd(selector, index);
        if (end === undefined) {
          parts.push({ kind: "unclosed", at: index });
          return parts;
        }
        argument = selector.slice(index + 1, end - 1);
        index = end;
      }
      parts.push({ kind: "pseudo", name, element, argument });
    } else if (char === "\\" || continuesIdentifier(char)) {
      const end = identifierEnd(selector, index);
      parts.push({ kind: "type", name: unescapeCss(selector.slice(index, end)) });
      index = end;
    } else {
      parts.push({ kind: "combinator" });
      index += 1;
    }
  }
  return parts;
}

/**
 * Scan a selector list into the pieces of each alternative.
 *
 * @param selector - A selector or selector list, as Tailwind prints it.
 * @returns Each alternative's pieces, in source order. A bracket that never closes ends its
 *   alternative with an `unclosed` piece.
 */
export function selectorAlternatives(selector: string): readonly (readonly SelectorPart[])[] {
  return splitList(selector).map(scanComplex);
}

/**
 * The classes a selector names outside any pseudo-class's parentheses, as a utility's own class
 * sits in the selector Tailwind prints for it, whatever comes before it.
 *
 * @param selector - A selector or selector list.
 * @returns Each class name, with its escapes read.
 */
export function namedClasses(selector: string): readonly string[] {
  return selectorAlternatives(selector).flatMap((parts) =>
    parts.flatMap((part) => (part.kind === "class" ? [part.name] : []))
  );
}

/** An attribute test: the attribute, and the operator, value and flag where it compares one. */
type AttributeTest = {
  readonly name: string;
  readonly operator: string | undefined;
  readonly value: string | undefined;
  readonly flag: string | undefined;
};

const ATTRIBUTE_TEST =
  /^\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"']+))\s*([iIsS])?\s*)?$/;

/** Read an attribute selector's body, such as `data-slot="item-description"`, or undefined. */
function attributeTest(body: string): AttributeTest | undefined {
  const match = ATTRIBUTE_TEST.exec(body);
  if (match === null) {
    return undefined;
  }
  const [, name = "", operator, doubleQuoted, singleQuoted, bare, flag] = match;
  const value = doubleQuoted ?? singleQuoted ?? bare;
  return { name, operator, value: value === undefined ? undefined : unescapeCss(value), flag };
}

/** A `data-slot` a selector tests inside `:has()`, and the outermost `:has()` that holds the test. */
export type SlotTest = {
  readonly slot: string;
  readonly clause: string;
};

/**
 * What a selector reads of the parts around the element it styles: the `data-slot` values it tests
 * inside `:has()`, which hold only while such a part is there. `unreadable` says why the scanner
 * cannot tell which parts the selector reads, which differs from reading none.
 */
export type SlotReads =
  | { readonly kind: "read"; readonly tests: readonly SlotTest[] }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * Collect the `data-slot` tests inside `:has()`, at any depth.
 *
 * @param clause - The outermost `:has()` around `selector`, or undefined outside any.
 * @returns Why the scanner cannot read the selector, or undefined once it collected every test.
 */
function collectSlotTests(
  selector: string,
  clause: string | undefined,
  tests: SlotTest[]
): string | undefined {
  for (const parts of selectorAlternatives(selector)) {
    for (const part of parts) {
      if (part.kind === "unclosed") {
        return `it does not close what opens at ${part.at} of \`${selector}\``;
      }
      if (part.kind === "pseudo" && part.argument !== undefined) {
        const inner = clause ?? (part.name === "has" ? `:has(${part.argument})` : undefined);
        const reason = collectSlotTests(part.argument, inner, tests);
        if (reason !== undefined) {
          return reason;
        }
      }
      if (part.kind !== "attribute" || clause === undefined) {
        continue;
      }
      const test = attributeTest(part.body);
      if (test === undefined) {
        if (part.body.includes("data-slot")) {
          return `${clause} holds \`[${part.body}]\`, which the scanner cannot read`;
        }
        continue;
      }
      if (test.name !== "data-slot") {
        continue;
      }
      if (test.operator !== "=" || test.value === undefined || test.flag !== undefined) {
        return `${clause} tests \`[${part.body}]\`, which matches a data-slot other than by its whole value`;
      }
      tests.push({ slot: test.value, clause });
    }
  }
  return undefined;
}

/**
 * Read which parts a selector needs to be there, through the `data-slot` values it tests inside
 * `:has()`, as `item-described:` tests Item's description in
 * `:where(:has(> [data-slot="item-content"] > [data-slot="item-description"])) > .x`.
 *
 * @param selector - A selector or selector list, as Tailwind prints it.
 * @returns Each test with the `:has()` that holds it, or why the scanner cannot read the selector:
 *   a bracket that never closes, or a `data-slot` test other than one whole value.
 */
export function slotReadsOf(selector: string): SlotReads {
  const tests: SlotTest[] = [];
  const reason = collectSlotTests(selector, undefined, tests);
  return reason === undefined ? { kind: "read", tests } : { kind: "unreadable", reason };
}
