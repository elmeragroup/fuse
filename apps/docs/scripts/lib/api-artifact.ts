/**
 * The committed per-component API artifact.
 *
 * Each component page has an `api.json` next to it, generated from the library's types
 * and JSDoc by `@elmeragroup/internal` and **committed**: an API change then shows up as
 * a reviewable diff in the same PR that changes the component, and the page renders the
 * artifact directly rather than re-deriving it. Because the file is committed, it can go
 * stale — so generation records each file it rewrote, and the drift check
 * (`test/api-artifact.test.ts`) fails on that record naming the regen command.
 *
 * Key order, indentation and the trailing newline are the package's: a diff should show
 * what the API did, not how a serialiser felt about ordering.
 */

import path from "node:path";

import { ApiArtifactsError, generateApiArtifacts } from "@elmeragroup/internal";
import type { ApiArtifactDiagnostic, GeneratedApiComponent } from "@elmeragroup/internal";

import { API_REGEN_COMMAND } from "../../src/lib/docs-model.ts";
import type { DocsApiComponent } from "./docs-inspection.ts";
import { docsApiInventory } from "./docs-inspection.ts";
import { DocsGenerationError } from "./errors.ts";
import { repoRoot, fuseTsconfig } from "./paths.ts";

/** What every failure that blames a stale or missing `api.json` tells the reader to do. */
export const STALE_HINT = `Run \`${API_REGEN_COMMAND}\` and commit the updated api.json files.`;

const GENERATED_BANNER =
  `Generated from packages/fuse types and JSDoc by ${API_REGEN_COMMAND}. ` +
  "Committed so API changes are reviewable diffs — never hand-edit this file; CI fails on drift.";

type GeneratedApi = {
  /** One artifact per inventory entry, keyed by slug. */
  readonly artifacts: ReadonlyMap<string, GeneratedApiComponent>;
  /** Warnings the package accepted rather than failed on; the generation pass prints them. */
  readonly diagnostics: readonly ApiArtifactDiagnostic[];
};

/**
 * Generates every component's `api.json` through `@elmeragroup/internal`.
 *
 * A file is written only when its bytes change, and `changed` reports which committed
 * artifacts were stale. Extraction problems (missing JSDoc, unresolvable types) fail with a
 * `DocsGenerationError`.
 */
export async function generateDocsApiArtifacts(
  inventory: readonly DocsApiComponent[] = docsApiInventory()
): Promise<GeneratedApi> {
  const artifacts = new Map<string, GeneratedApiComponent>();
  let diagnostics: readonly ApiArtifactDiagnostic[] = [];
  try {
    const result = await generateApiArtifacts({
      projectRoot: repoRoot,
      tsconfigPath: path.relative(repoRoot, fuseTsconfig),
      generatedBy: GENERATED_BANNER,
      mode: "write",
      components: inventory.map((component) => ({
        slug: component.slug,
        entryFile: component.entryFile,
        exportNames: component.exportNames,
        outputFile: component.apiFile,
      })),
    });
    for (const component of result.components) {
      artifacts.set(component.slug, component);
    }
    diagnostics = result.diagnostics;
  } catch (error) {
    if (error instanceof ApiArtifactsError) {
      throw new DocsGenerationError(error.problems);
    }
    throw error;
  }
  return { artifacts, diagnostics };
}
