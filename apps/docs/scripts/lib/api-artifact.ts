/**
 * The committed per-component API artifact (docs-site.md §8).
 *
 * Each component page has an `api.json` next to it, generated from the library's types
 * and JSDoc and **committed**: an API change then shows up as a reviewable diff in the
 * same PR that changes the component, and the page renders the artifact directly rather
 * than re-deriving it. Because the file is committed, it can go stale — so the same
 * serialisation is reachable from the drift check, which regenerates in-memory and
 * compares (`test/api-artifact.test.ts`).
 *
 * Key order is fixed by the object literals below: a diff should show what the API did,
 * not how a serialiser felt about ordering.
 */

import type { ApiPart, ApiProp } from "../../src/lib/docs-model.ts";
import { describeComponentApi, openLibraryProject } from "./api.ts";
import { componentSlugs, resolveComponentPaths } from "./components.ts";
import { ProblemLog } from "./errors.ts";

/** The command that rewrites every `api.json`. Named in the artifact and in drift failures. */
export const API_REGEN_COMMAND = "pnpm --filter docs generate";

const GENERATED_BANNER =
  `Generated from packages/ui types and JSDoc by ${API_REGEN_COMMAND} (docs-site.md §8). ` +
  "Committed so API changes are reviewable diffs — never hand-edit this file; CI fails on drift.";

/** One component's committed API data. */
export type ComponentApiArtifact = {
  /** Says the file is generated and how to regenerate it. Not data — a banner for readers. */
  $generated: string;
  slug: string;
  parts: readonly ApiPart[];
};

function orderProp(prop: ApiProp): ApiProp {
  return {
    name: prop.name,
    origin: prop.origin,
    type: prop.type,
    shortType: prop.shortType,
    defaultValue: prop.defaultValue,
    description: prop.description,
    required: prop.required,
  };
}

function orderPart(part: ApiPart): ApiPart {
  return {
    name: part.name,
    rsc: part.rsc,
    sourcePath: part.sourcePath,
    forwardedFrom: part.forwardedFrom,
    forwardedCount: part.forwardedCount,
    props: part.props.map(orderProp),
  };
}

export function buildApiArtifact(slug: string, parts: readonly ApiPart[]): ComponentApiArtifact {
  return { $generated: GENERATED_BANNER, slug, parts: parts.map(orderPart) };
}

/** The exact bytes of a component's `api.json`, trailing newline included. */
export function serializeApiArtifact(artifact: ComponentApiArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export type RegeneratedApi = {
  /** Serialised `api.json` bytes, keyed by slug. */
  texts: ReadonlyMap<string, string>;
  /** Extraction problems — the same ones that fail the docs build. */
  problems: readonly string[];
};

/**
 * Regenerates every component's `api.json` content in memory, touching no file.
 *
 * This is the drift check's half of the contract: it runs the *same* extraction and the
 * *same* serialisation the generation pass writes with, so a difference can only mean
 * the committed artifact is stale (or was hand-edited).
 */
export function regenerateApiArtifacts(): RegeneratedApi {
  const problems = new ProblemLog();
  const context = openLibraryProject();
  try {
    const texts = new Map<string, string>();
    for (const slug of componentSlugs()) {
      const paths = resolveComponentPaths(slug);
      const parts = describeComponentApi(
        context,
        { entryFile: paths.entryFile, exportName: paths.exportName },
        problems
      );
      texts.set(slug, serializeApiArtifact(buildApiArtifact(slug, parts)));
    }
    return { texts, problems: problems.problems };
  } finally {
    context.close();
  }
}
