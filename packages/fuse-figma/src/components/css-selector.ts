/**
 * Reading the selectors Tailwind prints: the class a rule leads with, with its escapes read, and the
 * class a spacing rule styles every child but the last of.
 */

/**
 * The class a selector starts with, unescaped, such as `bg-primary/80` for `.bg-primary\/80`,
 * and the rest of the selector after it, empty for a rule that selects one class.
 *
 * @param selector - A selector, or the rest of one.
 * @returns The class and the rest, or undefined where the selector starts with no class.
 */
export function leadingClass(selector: string): { readonly name: string; readonly rest: string } | undefined {
  if (!selector.startsWith(".")) {
    return undefined;
  }
  let name = "";
  for (let index = 1; index < selector.length; index += 1) {
    const char = selector.charAt(index);
    if (char === "\\") {
      const hex = /^[0-9a-fA-F]{1,6} ?/.exec(selector.slice(index + 1));
      if (hex === null) {
        name += selector.charAt(index + 1);
        index += 1;
      } else {
        name += String.fromCodePoint(Number.parseInt(hex[0].trim(), 16));
        index += hex[0].length;
      }
    } else if (/[\w-]/.test(char) || char.charCodeAt(0) > 0x7f) {
      name += char;
    } else {
      return { name, rest: selector.slice(index) };
    }
  }
  return { name, rest: "" };
}

/**
 * The class a rule styles every child but the last of, as Tailwind compiles `space-y-4` to
 * `:where(.space-y-4 > :not(:last-child))`: one `:where()` around the class, the child combinator and
 * `:not(:last-child)`. The capture reads a spacing rule by this shape.
 *
 * @param selector - The rule's selector.
 * @returns The class, or undefined for a rule of any other shape.
 */
export function exceptLastChildClass(selector: string): string | undefined {
  const opening = ":where(";
  const inner = selector.startsWith(opening) ? leadingClass(selector.slice(opening.length)) : undefined;
  return inner?.rest === " > :not(:last-child))" ? inner.name : undefined;
}
