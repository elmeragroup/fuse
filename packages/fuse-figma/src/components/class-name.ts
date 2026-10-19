/** A Tailwind class split into its variants, outermost first, and the utility they apply. */
export type ClassParts = {
  readonly variants: readonly string[];
  readonly utility: string;
};

/**
 * Split a Tailwind class at each `:` that sits outside brackets and parentheses, the way
 * Tailwind's candidate parser separates variants. `enabled-hover:bg-primary/80` has the
 * variant `enabled-hover` and the utility `bg-primary/80`. An arbitrary variant such as
 * `[&_svg:not([class*='size-'])]` keeps its inner colons.
 *
 * @param className - One class from a recipe's class string.
 * @returns The variants and the utility.
 */
export function splitClassName(className: string): ClassParts {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < className.length; index += 1) {
    const char = className.charAt(index);
    if (char === "[" || char === "(") {
      depth += 1;
    } else if (char === "]" || char === ")") {
      depth -= 1;
    } else if (char === ":" && depth === 0) {
      parts.push(className.slice(start, index));
      start = index + 1;
    }
  }
  return { variants: parts, utility: className.slice(start) };
}
