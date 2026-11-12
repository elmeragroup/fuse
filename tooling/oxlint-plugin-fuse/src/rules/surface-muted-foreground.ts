import type { ESTree, Rule } from "@oxlint/plugins";

import { classesOf, parseClass } from "../class-token.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/** A class that states `--surface`, the colour of the fill an element sits on. */
const SURFACE = /^\[--surface:.+\]$/u;

/** A class that states `--surface-muted-foreground`, the muted text paired with that fill. */
const COMPANION = /^\[--surface-muted-foreground:.+\]$/u;

/** A utility without Tailwind's important marker, written before it (v3) or after it (v4). */
function unmarked(utility: string): string {
  return utility.replace(/^!|!$/gu, "");
}

/**
 * A class string that states `--surface` states `--surface-muted-foreground` beside it, under the
 * same variants. A chart's chips paint the surface and set their text in its muted text, so each
 * fill names that text with it, and a container nested in a tinted one does not inherit the tint's.
 */
export const surfaceMutedForeground: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require `--surface-muted-foreground` beside every `--surface` a class string states.",
    },
    messages: {
      missing:
        "`{{token}}` states a surface without its muted text. Add `{{variants}}[--surface-muted-foreground:…]` in the same string.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      if (text === undefined) return;
      const classes = classesOf(text).map((token) => {
        const { variants, utility } = parseClass(token);
        return { token, variants, utility: unmarked(utility) };
      });
      const companions = new Set(
        classes.filter(({ utility }) => COMPANION.test(utility)).map(({ variants }) => variants.join(":"))
      );
      for (const { token, variants, utility } of classes) {
        if (!SURFACE.test(utility) || companions.has(variants.join(":"))) continue;
        const prefix = variants.map((variant) => `${variant}:`).join("");
        context.report({ node, messageId: "missing", data: { token, variants: prefix } });
      }
    };
    return { Literal: check, TemplateElement: check };
  },
};
