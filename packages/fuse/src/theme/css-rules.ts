/** One declaration, with a custom property's leading dashes removed from its name. */
export type CssDeclaration = {
  name: string;
  value: string;
};

/** A style rule: a selector and the declarations of its block. */
export type CssStyleRule = {
  selector: string;
  declarations: CssDeclaration[];
};

/** A block of declarations with its prelude, which is a selector or an at-rule such as `@theme inline`. */
export type CssBlock = {
  prelude: string;
  declarations: CssDeclaration[];
};

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Read every innermost block of declarations. The reader is for the library's own
 * stylesheets, so it does not handle strings or escapes that contain braces or semicolons.
 *
 * @param css - A stylesheet.
 * @returns The blocks in source order. A block nested in another yields only itself.
 */
export function parseCssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const withoutComments = stripCssComments(css);
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = blockPattern.exec(withoutComments);
  while (match) {
    // Text since the previous block can start with statements such as `@import "x";`, which
    // end at their semicolon and are not part of this block's prelude.
    const preceding = match[1] ?? "";
    const prelude = preceding.slice(preceding.lastIndexOf(";") + 1).trim();
    const body = match[2] ?? "";
    if (prelude !== "") {
      const declarations: CssDeclaration[] = [];
      for (const chunk of body.split(";")) {
        const trimmed = chunk.trim();
        if (trimmed === "") {
          continue;
        }
        const colon = trimmed.indexOf(":");
        if (colon === -1) {
          continue;
        }
        const rawName = trimmed.slice(0, colon).trim();
        const value = trimmed.slice(colon + 1).trim();
        const name = rawName.startsWith("--") ? rawName.slice(2) : rawName;
        declarations.push({ name, value });
      }
      blocks.push({ prelude, declarations });
    }
    match = blockPattern.exec(withoutComments);
  }
  return blocks;
}

/**
 * Read the style rules of a stylesheet, skipping at-rule blocks such as `@theme`.
 *
 * @param css - A stylesheet.
 * @returns The rules in source order.
 */
export function parseStyleRules(css: string): CssStyleRule[] {
  return parseCssBlocks(css)
    .filter((block) => !block.prelude.startsWith("@"))
    .map((block) => ({ selector: block.prelude, declarations: block.declarations }));
}
