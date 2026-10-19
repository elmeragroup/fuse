/**
 * A small CSS reader for the stylesheet Tailwind's `compile().build()` returns. That output is
 * well formed and uses only rules, declarations and at-rules, with CSS nesting inside rules,
 * so the reader tracks strings, brackets and parentheses and needs no full CSS grammar.
 */

/** A `property: value` declaration. */
export type CssDeclaration = {
  readonly type: "declaration";
  readonly property: string;
  readonly value: string;
};

/** A style rule with its selector, which may hold nested rules and at-rules. */
export type CssRule = {
  readonly type: "rule";
  readonly selector: string;
  readonly children: readonly CssNode[];
};

/** An at-rule such as `@media`, `@supports` or `@property`. A statement has no children. */
export type CssAtRule = {
  readonly type: "at-rule";
  readonly name: string;
  readonly params: string;
  readonly children: readonly CssNode[] | undefined;
};

/** A node of the stylesheet. */
export type CssNode = CssDeclaration | CssRule | CssAtRule;

type OpenBlock = {
  readonly prelude: string;
  readonly children: CssNode[];
};

/**
 * Parse a stylesheet into its nodes, in source order. Comments are skipped.
 *
 * @param css - Tailwind's build output.
 * @returns The top-level nodes.
 * @throws When a block is not closed, or closes without opening.
 */
export function parseCss(css: string): readonly CssNode[] {
  const root: CssNode[] = [];
  const stack: OpenBlock[] = [];
  let buffer = "";
  let depth = 0;
  let quote: string | undefined;
  const current = (): CssNode[] => stack.at(-1)?.children ?? root;

  for (let index = 0; index < css.length; index += 1) {
    const char = css.charAt(index);
    if (quote !== undefined) {
      buffer += char;
      if (char === "\\") {
        buffer += css.charAt(index + 1);
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "\\") {
      buffer += char + css.charAt(index + 1);
      index += 1;
      continue;
    }
    if (char === "/" && css.charAt(index + 1) === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === "(" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "]") {
      depth -= 1;
    }
    if (depth > 0) {
      buffer += char;
      continue;
    }
    if (char === "{") {
      stack.push({ prelude: buffer.trim(), children: [] });
      buffer = "";
    } else if (char === ";") {
      pushStatement(current(), buffer);
      buffer = "";
    } else if (char === "}") {
      pushStatement(current(), buffer);
      buffer = "";
      const block = stack.pop();
      if (block === undefined) {
        throw new Error(`unexpected "}" at offset ${index}`);
      }
      current().push(closeBlock(block));
    } else {
      buffer += char;
    }
  }
  if (stack.length > 0) {
    throw new Error(`unclosed block "${stack.at(-1)?.prelude ?? ""}"`);
  }
  pushStatement(root, buffer);
  return root;
}

function pushStatement(target: CssNode[], text: string): void {
  const statement = text.trim();
  if (statement === "") {
    return;
  }
  if (statement.startsWith("@")) {
    const { name, params } = splitAtRule(statement);
    target.push({ type: "at-rule", name, params, children: undefined });
    return;
  }
  const colon = statement.indexOf(":");
  if (colon === -1) {
    throw new Error(`a declaration without a colon: ${statement}`);
  }
  target.push({
    type: "declaration",
    property: statement.slice(0, colon).trim(),
    value: statement.slice(colon + 1).trim(),
  });
}

function closeBlock(block: OpenBlock): CssNode {
  if (block.prelude.startsWith("@")) {
    const { name, params } = splitAtRule(block.prelude);
    return { type: "at-rule", name, params, children: block.children };
  }
  return { type: "rule", selector: block.prelude, children: block.children };
}

/** An at-rule's name and the text after it. */
type AtRuleHead = Pick<CssAtRule, "name" | "params">;

function splitAtRule(prelude: string): AtRuleHead {
  const match = /^@([\w-]+)\s*(.*)$/s.exec(prelude);
  if (match === null) {
    throw new Error(`a malformed at-rule: ${prelude}`);
  }
  return { name: match[1] ?? "", params: (match[2] ?? "").trim() };
}
