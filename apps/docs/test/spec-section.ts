import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../scripts/lib/paths.ts";

/** The body of one numbered or named section of a spec chapter, up to the next heading. */
export function specSection(markdown: string, heading: string): string {
  const start = markdown.search(new RegExp(`^## ${escapeRegExp(heading)}(?:\\.?\\s|$)`, "m"));
  if (start === -1) {
    throw new Error(`missing ## ${heading}`);
  }
  const fromHeading = markdown.slice(start);
  const next = fromHeading.slice(3).search(/\n## /);
  return next === -1 ? fromHeading : fromHeading.slice(0, 3 + next);
}

/** Section body of `docs/spec/<file>` for a numbered heading, without the heading line. */
export function specSectionBody(file: string, heading: number): string {
  const markdown = readFileSync(join(repoRoot, "docs/spec", file), "utf8");
  const section = specSection(markdown, String(heading));
  const newline = section.indexOf("\n");
  return newline === -1 ? "" : section.slice(newline + 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
