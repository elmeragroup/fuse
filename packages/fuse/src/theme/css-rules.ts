/** One declaration, with a custom property's leading dashes removed from its name. */
export type CssDeclaration = {
  name: string;
  value: string;
};

/** A style rule, which is a selector with the declarations of its block. */
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
 * The declarations among `;`-separated statements. A statement without a colon, or an at-rule
 * statement such as `@slot;` or `@apply hover:underline;`, declares nothing.
 */
function declarationsIn(statements: readonly string[]): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const statement of statements) {
    const trimmed = statement.trim();
    const colon = trimmed.indexOf(":");
    if (trimmed.startsWith("@") || colon === -1) {
      continue;
    }
    const rawName = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    const name = rawName.startsWith("--") ? rawName.slice(2) : rawName;
    declarations.push({ name, value });
  }
  return declarations;
}

/**
 * Read every block of declarations, nested ones included. A block keeps its own declarations
 * whether they come before, between or after the blocks nested in it. The reader is for the
 * library's own stylesheets, so it does not handle strings or escapes that contain braces or
 * semicolons.
 *
 * @param css - A stylesheet.
 * @returns The blocks in the order their preludes appear. A nested block follows its parent,
 *   and its prelude is its own, such as `&:hover`, not the resolved selector.
 */
export function parseCssBlocks(css: string): CssBlock[] {
  const source = stripCssComments(css);
  const blocks: CssBlock[] = [];
  const open: CssBlock[] = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char !== "{" && char !== "}") {
      continue;
    }
    const statements = source.slice(start, index).split(";");
    start = index + 1;
    const parent = open.at(-1);
    if (char === "}") {
      open.pop();
      parent?.declarations.push(...declarationsIn(statements));
      continue;
    }
    // Everything up to the last `;` belongs to the enclosing block, or is a top-level statement
    // such as `@import "x";`. The rest is this block's prelude.
    const prelude = statements.pop()?.trim() ?? "";
    parent?.declarations.push(...declarationsIn(statements));
    const block: CssBlock = { prelude, declarations: [] };
    open.push(block);
    if (prelude !== "") {
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * Read the style rules of a stylesheet, skipping at-rule blocks such as `@theme`.
 *
 * @param css - A stylesheet.
 * @returns The rules in source order, nested rules included.
 */
export function parseStyleRules(css: string): CssStyleRule[] {
  return parseCssBlocks(css)
    .filter((block) => !block.prelude.startsWith("@"))
    .map((block) => ({ selector: block.prelude, declarations: block.declarations }));
}
