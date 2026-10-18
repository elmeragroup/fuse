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
import { DocsGenerationError } from "./errors.ts";
import { repoRoot, fuseTsconfig } from "./paths.ts";

/**
 * The warning codes the docs accept. `unsupported-type-fallback` is the package default. The
 * extractor cannot print a template-literal index signature, so it omits the chart's per-key colour
 * property `--chart-color-${string}` from every `ChartStyle` row, and the type's JSDoc documents it
 * instead. `acceptedDiagnostic` keeps that exception to the one file that declares it.
 */
const ALLOWED_WARNING_CODES = ["unsupported-type-fallback", "omitted-index-signature"] as const;

/** The one module whose omitted index signature the docs accept: `ChartStyleVars`'s colour index. */
const ACCEPTED_INDEX_SIGNATURE_FILE = path.join(
  repoRoot,
  "packages/fuse/src/components/chart/chart-types.ts"
);

/**
 * Whether the docs accept a warning the package passed through. An omitted index signature is
 * accepted only where `ACCEPTED_INDEX_SIGNATURE_FILE` declares it, so a new one elsewhere still fails.
 */
function acceptedDiagnostic({ warning }: ApiArtifactDiagnostic): boolean {
  return (
    warning.code !== "omitted-index-signature" ||
    path.resolve(warning.filePath) === ACCEPTED_INDEX_SIGNATURE_FILE
  );
}

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
  inventory: readonly DocsApiComponent[]
): Promise<GeneratedApi> {
  const artifacts = new Map<string, GeneratedApiComponent>();
  let diagnostics: readonly ApiArtifactDiagnostic[] = [];
  try {
    const result = await generateApiArtifacts({
      projectRoot: repoRoot,
      tsconfigPath: path.relative(repoRoot, fuseTsconfig),
      generatedBy: GENERATED_BANNER,
      mode: "write",
      allowedWarningCodes: ALLOWED_WARNING_CODES,
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
    const rejected = result.diagnostics.filter((diagnostic) => !acceptedDiagnostic(diagnostic));
    if (rejected.length > 0) {
      throw new DocsGenerationError(
        rejected.map(
          ({ component, warning }) => `${component}: ${warning.code} at ${repoRelative(warning.filePath)}`
        )
      );
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
