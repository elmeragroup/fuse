import type { ESTree, Rule } from "@oxlint/plugins";

import { ruleOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/** The owner module and the spellings only it may write. */
type OwnedClassTokensOptions = { readonly owner: string; readonly spellings: readonly string[] };

/**
 * Whether a class string spells a configured form: a single class matches as a whole class, so
 * `z-50` does not match `z-500`, and a multi-class form matches as a run of whole classes.
 */
function spells(text: string, spelling: string): boolean {
  const classes = ` ${text.trim().split(/\s+/u).join(" ")} `;
  return classes.includes(` ${spelling} `);
}

/**
 * Class spellings with one owner module, such as the overlay layer `z-50` and the popup surface
 * `bg-popover text-popover-foreground`, appear in no other library module. A private copy undoes
 * the shared owner: the next change to the owner misses it. The config names the spellings and
 * their owner, and turns the rule off in the owner itself.
 */
export const ownedClassTokens: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Confine owned class spellings to their owner module." },
    messages: {
      copy: "`{{spelling}}` is spelled once, in {{owner}}. Import the owner's export instead of restating it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          owner: { type: "string" },
          spellings: { type: "array", items: { type: "string" } },
        },
        required: ["owner", "spellings"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const { owner, spellings } = ruleOptions<OwnedClassTokensOptions>(context) ?? {
      owner: "",
      spellings: [],
    };
    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      if (text === undefined) return;
      for (const spelling of spellings) {
        if (spells(text, spelling)) context.report({ node, messageId: "copy", data: { spelling, owner } });
      }
    };
    return { Literal: check, TemplateElement: check };
  },
};
