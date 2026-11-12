/**
 * The Live code rewrite of one component demo, which the Turbopack loader applies
 * (`scripts/live-code-loader.ts`).
 *
 * Each part a demo renders from a lensed Fuse import, when it has settable props, is bound through
 * the one generic `lens()` wrapper (a namespace is rebuilt with those members wrapped), and each
 * of its JSX sites is stamped with its `__lensLoc`. The rewrite carries the schema of exactly the parts the demo renders, so no
 * component needs code of its own. A demo without such a part comes back unchanged.
 */

import type { PartSchema } from "../../src/lib/live-code/schema.ts";
import { findSites, readLensedImports } from "../../src/lib/live-code/sites.ts";

/** Looks up the settable props of a part, such as `Select.Root`, of the given Fuse module. */
export type SchemaLookup = (module: string, part: string) => PartSchema | undefined;

type Edit = { readonly start: number; readonly end: number; readonly text: string };

/**
 * The expression a demo binds in place of `value`, the import or namespace member named `name`:
 * the part wrapped in `lens()` when it has settable props, with `lensMembers` keeping its own
 * parts and replacing its settable ones, however deep they sit.
 */
function binding(value: string, name: string, parts: ReadonlyMap<string, PartSchema>): string {
  const own = parts.get(name);
  const members = new Set<string>();
  for (const part of parts.keys()) {
    if (part.startsWith(`${name}.`)) members.add(part.slice(name.length + 1).split(".")[0] ?? "");
  }
  const replaced = [...members].map(
    (member) => `${member}: ${binding(`${value}.${member}`, `${name}.${member}`, parts)}`
  );
  if (own === undefined && replaced.length === 0) return value;
  const self =
    own === undefined ? value : `__lens(${value}, ${JSON.stringify(name)}, ${JSON.stringify(own)})`;
  // The wrapper keeps the original's parts, such as `RadioItem.Title`, the demo may render too.
  return `__lensMembers(${value}, ${self}, ${replaced.length === 0 ? "{}" : `{ ${replaced.join(", ")} }`})`;
}

/**
 * Rewrites a demo for Live code.
 *
 * @param source - The demo module's source.
 * @param schemaOf - The settable props of a part, from the committed `api.json`.
 * @param lensModule - The specifier the rewrite imports `lens` from.
 * @returns The rewritten source, or `null` when the demo renders no part with settable props.
 */
export function lensDemoSource(source: string, schemaOf: SchemaLookup, lensModule: string): string | null {
  // A server demo renders on the server, where a client wrapper cannot run.
  if (!/^\s*["']use client["']/u.test(source)) return null;
  const declarations = readLensedImports(source);
  const sites = findSites(source);
  const edits: Edit[] = [];
  const bindings: string[] = [];
  for (const declaration of declarations) {
    const specifiers: string[] = [];
    let lensed = false;
    for (const { imported, local } of declaration.imports) {
      const parts = new Map<string, PartSchema>();
      for (const site of sites) {
        if (site.part !== imported && !site.part.startsWith(`${imported}.`)) continue;
        const schema = schemaOf(declaration.module, site.part);
        if (schema === undefined || schema.length === 0) continue;
        parts.set(site.part, schema);
        edits.push({ start: site.insertAt, end: site.insertAt, text: ` __lensLoc="${site.loc}"` });
      }
      if (parts.size === 0) {
        specifiers.push(imported === local ? imported : `${imported} as ${local}`);
        continue;
      }
      lensed = true;
      specifiers.push(`${imported} as __lens_${local}`);
      bindings.push(`const ${local} = ${binding(`__lens_${local}`, imported, parts)};`);
    }
    if (lensed) {
      edits.push({
        start: declaration.start,
        end: declaration.end,
        text: `import { ${specifiers.join(", ")} } from ${JSON.stringify(declaration.module)};`,
      });
    }
  }
  const last = declarations.at(-1);
  if (bindings.length === 0 || last === undefined) return null;
  // Imports may follow statements in a module, so the bindings sit right after the last Fuse
  // import, below the `"use client"` directive and above any code that renders a part.
  edits.push({
    start: last.end,
    end: last.end,
    text: `\nimport { lens as __lens, lensMembers as __lensMembers } from ${JSON.stringify(lensModule)};\n${bindings.join("\n")}`,
  });
  let out = source;
  for (const { start, end, text } of edits.toSorted((left, right) => right.start - left.start)) {
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}
