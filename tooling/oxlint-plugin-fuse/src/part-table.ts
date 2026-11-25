import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

import { propertyKeyName } from "./ast-names.ts";

/**
 * Slots per table, module and modification time, so an editor's long-lived lint server rereads a
 * table after an edit.
 */
const partsByFile = new Map<string, ReadonlySet<string> | Error>();

/**
 * The slots a token module's part table declares: each key of the exported object `table`, up to
 * its first `[` or `:`, since a density override key is the slot plus a selector suffix. The
 * density and skeleton role rules read `PART_DENSITY` and `PART_SKELETON` through it, so each rule
 * checks the table the package itself imports.
 *
 * @param cwd - The linter's working directory.
 * @param module - The token module's path, relative to `cwd` or absolute, as a rule's options give it.
 * @param table - The exported constant that holds the table.
 * @returns The declared slots, or an error naming the module when it cannot be read or declares
 *   no entries in `table`.
 */
export function declaredParts(cwd: string, module: string, table: string): ReadonlySet<string> | Error {
  const file = resolve(cwd, module);
  const cacheKey = `${table}@${file}@${String(statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? "missing")}`;
  const cached = partsByFile.get(cacheKey);
  if (cached !== undefined) return cached;
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    const missing = new Error(`${file} cannot be read`, { cause: error });
    partsByFile.set(cacheKey, missing);
    return missing;
  }
  const parsed = parseSync(file, source);
  const slots = new Set<string>();
  for (const statement of parsed.program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration")
      continue;
    for (const declarator of statement.declaration.declarations) {
      if (declarator.id.type !== "Identifier" || declarator.id.name !== table || declarator.init === null)
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
  const result = slots.size > 0 ? slots : new Error(`${file} declares no ${table} entries`);
  partsByFile.set(cacheKey, result);
  return result;
}
