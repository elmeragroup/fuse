/**
 * Demo extraction (docs-site.md §3.5, §6).
 *
 * One authored `.tsx` per spec §10 scenario — co-located with the component's docs
 * route (§6) — feeds both outputs this ticket owns: the
 * live render and the displayed source. The exported component name is read from the
 * module's export table (an AST fact, not a filename convention), and the displayed
 * source is the file verbatim — so the frame can never drift from what it renders.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { highlight } from "sugar-high";

import type { DocsDemo } from "../../src/lib/docs-model.ts";
import type { LibraryProject } from "./api.ts";
import type { ProblemLog } from "./errors.ts";
import type { ShellDemo } from "./frontmatter.ts";
import { repoRelative } from "./paths.ts";

export type DemoRequest = {
  slug: string;
  /** Absolute path of `apps/docs/src/app/(docs)/components/<slug>/demos`. */
  demosDir: string;
  entry: ShellDemo;
};

/** Extracts one demo, or records why it could not be extracted. */
export function extractDemo(
  context: LibraryProject,
  request: DemoRequest,
  problems: ProblemLog
): DocsDemo | null {
  const absolute = path.join(request.demosDir, request.entry.file);
  const relative = repoRelative(absolute);
  const sourceFile = context.docs.program.getSourceFile(absolute);
  if (sourceFile === undefined) {
    problems.add(`${relative}: demo file is missing from the docs app program`);
    return null;
  }
  const moduleSymbol = context.docs.checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    problems.add(`${relative}: demo file has no module symbol`);
    return null;
  }
  const exports = context.docs.checker.getExportsOfModule(moduleSymbol);
  if (exports.length !== 1) {
    problems.add(`${relative}: a demo must export exactly one component (found ${String(exports.length)})`);
    return null;
  }
  const exportName = exports[0]?.name ?? "";
  if (exportName === "" || exportName === "default") {
    problems.add(`${relative}: a demo must export one named component`);
    return null;
  }

  const source = readFileSync(absolute, "utf8").replace(/\s+$/, "");
  return {
    id: request.entry.id,
    title: request.entry.title,
    exportName,
    sourcePath: relative,
    source,
    highlighted: highlight(source),
    modulePath: `./demos/${request.slug}/${request.entry.file.replace(/\.tsx?$/, "")}`,
  };
}
