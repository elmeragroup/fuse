/**
 * Removing the markdown endpoints a previous generation left behind under `public/`.
 *
 * Generation owns every `.md` file under `public/`, as the ignore rule in the root `.gitignore`
 * declares, and removes any that is not a page's twin.
 */

import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

import type { Catalog } from "@elmeragroup/docs-catalog";

import { markdownEndpointFile } from "./paths.ts";

/**
 * The file of every markdown twin the catalog names: the endpoint of each document with sections.
 *
 * @param catalog - The docs catalog.
 * @returns The absolute path of each twin.
 */
export function markdownTwinFiles(catalog: Catalog): ReadonlySet<string> {
  return new Set(
    catalog.documents
      .filter((document) => document.sections.length > 0)
      .map((document) => markdownEndpointFile(document.href))
  );
}

/**
 * Removes every `.md` file under `directory` that is not in `kept`, such as the twin of a page
 * whose route was renamed or deleted. Generation owns every markdown file under `public/`, so a
 * hand-authored one there is removed too. Every other file stays, because the same folder holds
 * committed assets that no run writes.
 *
 * @param directory - The folder the endpoints are served from, `public/`.
 * @param kept - The absolute path of every markdown file to keep.
 */
export function pruneUnwrittenMarkdown(directory: string, kept: ReadonlySet<string>): void {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    const target = path.join(entry.parentPath, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md") && !kept.has(target)) {
      rmSync(target, { force: true });
    }
  }
}
