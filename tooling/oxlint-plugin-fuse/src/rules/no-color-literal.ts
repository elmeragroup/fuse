import type { ESTree, Rule } from "@oxlint/plugins";

import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/** A hex colour or a CSS colour function, spelled inside a string. */
const COLOR_LITERAL = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/iu;

/**
 * A chart module paints through custom properties, never a colour literal, so a user style sheet
 * and forced colours reach every mark (Chartability heuristic 43).
 */
export const noColorLiteral: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid colour literals in chart modules." },
    messages: {
      literal:
        "Paint through a custom property such as `var(--chart-color-…)`: a colour literal keeps user style sheets and forced colours from reaching the mark.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const check = (node: ESTree.Node): void => {
      if (COLOR_LITERAL.test(staticText(node) ?? "")) context.report({ node, messageId: "literal" });
    };
    return { Literal: check, TemplateElement: check };
  },
};
