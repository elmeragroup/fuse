import type { ESTree, Rule } from "@oxlint/plugins";

import { jsxAttributeSlot, propertySlot } from "../data-slot.ts";
import { declaredParts } from "../part-table.ts";
import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";

/** The roles module, relative to the linter's working directory or absolute. */
type DeclaredDensityRoleOptions = { readonly roles: string };

/**
 * Every `data-slot` a library module writes, as a `data-slot` or `dataSlot` JSX attribute or a
 * `data-slot`, `dataSlot` or `slot` object key (props objects and `useRender` state), has a density
 * role in `PART_DENSITY`. The table drives the docs' parts-by-role tables and the theme studio, so
 * a part missing from it is a part no density decision covers.
 */
export const declaredDensityRole: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a PART_DENSITY role for every data-slot a module writes." },
    messages: {
      undeclared: "Declare a density role for `{{slot}}` in PART_DENSITY (theme/tokens/density-roles.ts).",
      table: "The density role table cannot be read: {{reason}}",
    },
    schema: [
      {
        type: "object",
        properties: { roles: { type: "string" } },
        required: ["roles"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    const { roles } = requiredOptions<DeclaredDensityRoleOptions>(context);
    const check = (node: ESTree.Node, slot: string | undefined): void => {
      if (slot === undefined) return;
      const declared = declaredParts(context.cwd, roles, "PART_DENSITY");
      if (declared instanceof Error) {
        context.report({ node, messageId: "table", data: { reason: declared.message } });
      } else if (!declared.has(slot)) {
        context.report({ node, messageId: "undeclared", data: { slot } });
      }
    };
    return {
      JSXAttribute(attribute) {
        check(attribute, jsxAttributeSlot(attribute));
      },
      Property(property) {
        check(property, propertySlot(property));
      },
    };
  },
};
