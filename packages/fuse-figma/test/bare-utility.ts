/**
 * The utility a Tailwind class applies, without its variants: the part after the last `:` that
 * sits outside brackets and parentheses, where Tailwind's candidate parser separates variants.
 * `enabled-hover:bg-primary/80` applies `bg-primary/80`. An arbitrary variant such as
 * `[&_svg:not([class*='size-'])]` keeps its inner colons. The capture fixtures read a class's
 * declarations from its bare utility's rule where the class itself compiles to none.
 *
 * @param className - One class from a recipe's class string.
 * @returns The class with its variants removed.
 */
export function bareUtility(className: string): string {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < className.length; index += 1) {
    const char = className.charAt(index);
    if (char === "[" || char === "(") {
      depth += 1;
    } else if (char === "]" || char === ")") {
      depth -= 1;
    } else if (char === ":" && depth === 0) {
      start = index + 1;
    }
  }
  return className.slice(start);
}
