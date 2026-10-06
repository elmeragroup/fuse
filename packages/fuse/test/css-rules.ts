/**
 * A small CSS reader for the unit tests that compare hand-written `fuse.css` with the
 * token maps in `src/theme`. No shipped module imports it, so it lives with the test tooling.
 */

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

/** A block with the preludes of the blocks around it, outermost first. */
type ScopedBlock = {
  block: CssBlock;
  ancestors: readonly string[];
};

function readScopedBlocks(css: string): ScopedBlock[] {
  const source = stripCssComments(css);
  const blocks: ScopedBlock[] = [];
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
    const ancestors = open.map((enclosing) => enclosing.prelude).filter((ancestor) => ancestor !== "");
    open.push(block);
    if (prelude !== "") {
      blocks.push({ block, ancestors });
    }
  }
  return blocks;
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
  return readScopedBlocks(css).map(({ block }) => block);
}

/** A declaration with the preludes of every block around it, outermost first. */
export type CssScopedDeclaration = CssDeclaration & {
  scope: readonly string[];
};

/**
 * Read every declaration with the chain of blocks that holds it, so a nested build
 * (`.a { @media x { … } }`) and a flattened one (`@media x { .a { … } }`) both report the
 * selector and the conditions a declaration applies under.
 *
 * @param css - A stylesheet.
 * @returns The declarations in block order. Each `scope` ends with the declaring block's prelude.
 */
export function parseScopedDeclarations(css: string): CssScopedDeclaration[] {
  return readScopedBlocks(css).flatMap(({ block, ancestors }) =>
    block.declarations.map((declaration) => ({ ...declaration, scope: [...ancestors, block.prelude] }))
  );
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
