import type { ESTree, Rule } from "@oxlint/plugins";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseSync } from "oxc-parser";

import { propertyKeyName } from "../ast-names.ts";
import { jsxAttributeSlot, propertySlot } from "../data-slot.ts";
import { requiredOptions } from "../rule-options.ts";
import { isTestFile } from "../source-file.ts";

/** The name of the role table the roles module exports. */
const TABLE = "PART_DENSITY";

/**
 * Declared slots per roles module and modification time, so an editor's long-lived lint server
 * rereads the table after an edit.
 */
const declaredByFile = new Map<string, ReadonlySet<string> | Error>();

/**
 * The slots the roles module declares: each `PART_DENSITY` key up to its first `[` or `:`, since
 * an override key is the slot plus a selector suffix.
 */
function declaredSlots(file: string): ReadonlySet<string> | Error {
  const cacheKey = `${file}@${String(statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? "missing")}`;
  const cached = declaredByFile.get(cacheKey);
  if (cached !== undefined) return cached;
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    const missing = new Error(`${file} cannot be read`, { cause: error });
    declaredByFile.set(cacheKey, missing);
    return missing;
  }
  const parsed = parseSync(file, source);
  const slots = new Set<string>();
  for (const statement of parsed.program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration")
      continue;
    for (const declarator of statement.declaration.declarations) {
      if (declarator.id.type !== "Identifier" || declarator.id.name !== TABLE || declarator.init === null)
        continue;
      let init = declarator.init;
      while (init.type === "TSAsExpression" || init.type === "TSSatisfiesExpression") init = init.expression;
      if (init.type !== "ObjectExpression") continue;
      for (const property of init.properties) {
        if (property.type !== "Property") continue;
        const name = propertyKeyName(property);
        const slot = name === undefined ? undefined : /^[a-z0-9-]+/u.exec(name)?.[0];
        if (slot !== undefined) slots.add(slot);
      }
    }
  }
  const result = slots.size > 0 ? slots : new Error(`${file} declares no ${TABLE} entries`);
  declaredByFile.set(cacheKey, result);
  return result;
}

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
    const rolesFile = isAbsolute(roles) ? roles : join(context.cwd, roles);
    const check = (node: ESTree.Node, slot: string | undefined): void => {
      if (slot === undefined) return;
      const declared = declaredSlots(rolesFile);
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
