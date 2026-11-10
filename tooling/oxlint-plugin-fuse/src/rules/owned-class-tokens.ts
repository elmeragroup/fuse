import type { ESTree, Rule } from "@oxlint/plugins";

import { classesOf } from "../class-token.ts";
import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";
import { staticText } from "../static-text.ts";

/**
 * The owner module and the spellings only it may write, plus superseded spellings no module
 * writes any more, each with the export that replaced it.
 */
type OwnedClassTokensOptions = {
  readonly owner: string;
  readonly spellings: readonly string[];
  readonly superseded?: ReadonlyArray<{ readonly spelling: string; readonly replacement: string }>;
};

/**
 * Whether a class string spells a configured form: a single class matches as a whole class, so
 * `z-50` does not match `z-500`, and a multi-class form matches as a run of whole classes.
 */
function spells(text: string, spelling: string): boolean {
  const classes = ` ${classesOf(text).join(" ")} `;
  return classes.includes(` ${spelling} `);
}

/**
 * Class spellings with one owner module, such as the overlay layer `z-50` and the popup surface
 * `bg-popover text-popover-foreground`, appear in no other library module. A private copy undoes
 * the shared owner: the next change to the owner misses it. The config names the spellings and
 * their owner, and turns the rule off in the owner itself. A superseded spelling, an older local
 * form whose shared export now spells it differently, is reported with that export's name.
 */
export const ownedClassTokens: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Confine owned class spellings to their owner module." },
    messages: {
      copy: "`{{spelling}}` is spelled once, in {{owner}}. Import the owner's export instead of restating it.",
      superseded: "`{{spelling}}` is a superseded local form. Use {{replacement}} instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          owner: { type: "string" },
          spellings: { type: "array", items: { type: "string" } },
          superseded: {
            type: "array",
            items: {
              type: "object",
              properties: { spelling: { type: "string" }, replacement: { type: "string" } },
              required: ["spelling", "replacement"],
              additionalProperties: false,
            },
          },
        },
        required: ["owner", "spellings"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const { owner, spellings, superseded = [] } = requiredOptions<OwnedClassTokensOptions>(context);
    const check = (node: ESTree.Node): void => {
      const text = staticText(node);
      if (text === undefined) return;
      for (const spelling of spellings) {
        if (spells(text, spelling)) context.report({ node, messageId: "copy", data: { spelling, owner } });
      }
      for (const { spelling, replacement } of superseded) {
        if (spells(text, spelling)) {
          context.report({ node, messageId: "superseded", data: { spelling, replacement } });
        }
      }
    };
    return { Literal: check, TemplateElement: check };
  },
};
