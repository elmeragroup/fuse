import type { ESTree, Rule } from "@oxlint/plugins";

import { isTestFile } from "../source-file.ts";
import { stringLiteral } from "../static-text.ts";

/** Tailwind 4's theme colour namespace. */
const THEME_COLOR = "--color-";

/** The leading text of a style key: a literal key, or a template key's first chunk. */
function keyPrefix(property: {
  readonly key: ESTree.PropertyKey;
  readonly computed: boolean;
}): string | undefined {
  const key = property.key;
  const literal = stringLiteral(key);
  if (literal !== undefined) return literal;
  if (property.computed && key.type === "TemplateLiteral") {
    const [first] = key.quasis;
    return first?.value.cooked ?? first?.value.raw;
  }
  return undefined;
}

/**
 * A chart writes no `--color-*` custom property. `--color-*` is Tailwind 4's theme namespace, so a
 * chart that wrote `--color-<key>` for a config key named `primary` would repaint every Fuse
 * component inside it. Charts write `--chart-color-<key>` instead. Reads through `var(…)` are fine.
 */
export const noThemeColorWrite: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid writing a --color-* custom property from chart code." },
    messages: {
      write:
        "Write `--chart-color-*` here: `--color-*` is Tailwind's theme namespace, and a chart that writes it repaints every component inside.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      Property(node) {
        if (keyPrefix(node)?.startsWith(THEME_COLOR) === true) context.report({ node, messageId: "write" });
      },
      CallExpression(node) {
        const callee = node.callee;
        const [name] = node.arguments;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "setProperty" &&
          name !== undefined &&
          stringLiteral(name)?.startsWith(THEME_COLOR) === true
        ) {
          context.report({ node, messageId: "write" });
        }
      },
    };
  },
};
