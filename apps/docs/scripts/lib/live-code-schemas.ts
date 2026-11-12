/**
 * The settable props of every documented part, read from the committed `api.json` files. The
 * Live code loader inlines them into each demo, and the Live code sweep applies them.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { partSchema } from "../../src/lib/live-code/schema.ts";
import type { ApiPropRow, PartSchema } from "../../src/lib/live-code/schema.ts";
import { resolveComponentPaths } from "./components.ts";
import { componentRoutesDir, generatedDir } from "./paths.ts";

/**
 * The file in `src/generated` that lists the parts Fuse recognises by element identity, which
 * `identityComparedParts` writes during generation.
 */
export const LIVE_CODE_IDENTITY_PARTS = "live-code-identity-parts.json";

/** One `api.json` part, as far as the loader reads it. */
type ApiPartRow = { readonly name: string; readonly props: readonly ApiPropRow[] };

/** One committed artifact: the module it documents and its parts' schemas. */
type ArtifactSchemas = { readonly entry: string; readonly parts: ReadonlyMap<string, PartSchema> };

/** Whether a parsed `api.json` has the `parts` list the loader reads. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- file I/O boundary: this guard parses what `JSON.parse` read from a committed api.json
function hasParts(value: unknown): value is { readonly parts: readonly ApiPartRow[] } {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- file I/O boundary, as above
  return typeof value === "object" && value !== null && "parts" in value && Array.isArray(value.parts);
}

/**
 * Every committed artifact, keyed by the module it documents, such as
 * `@elmeragroup/fuse/date-picker`. The generator's own path resolution names each page's
 * entries, so a shared entry maps to the artifact the page reference renders.
 */
function readArtifacts(): readonly ArtifactSchemas[] {
  const artifacts: ArtifactSchemas[] = [];
  for (const page of readdirSync(componentRoutesDir, { withFileTypes: true })) {
    if (!page.isDirectory()) continue;
    for (const { entry, apiFile } of resolveComponentPaths(page.name).apis) {
      if (!existsSync(apiFile)) continue;
      const parsed: unknown = JSON.parse(readFileSync(apiFile, "utf8"));
      if (!hasParts(parsed)) continue;
      artifacts.push({
        entry,
        parts: new Map(parsed.parts.map((part) => [part.name, partSchema(part.props)])),
      });
    }
  }
  return artifacts;
}

let artifacts: readonly ArtifactSchemas[] | null = null;
let identityParts: ReadonlySet<string> | null = null;

/** Whether a parsed file is the list of part names generation writes. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- file I/O boundary: this guard parses what `JSON.parse` read from a generated file
function isNameList(value: unknown): value is readonly string[] {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- file I/O boundary, as above
  return Array.isArray(value) && value.every((name) => typeof name === "string");
}

/**
 * The parts Fuse recognises by element identity. A wrapper around one would no longer be that
 * part to its parent, so Live code leaves them unwrapped.
 *
 * @throws {Error} When generation has not written the list.
 */
function readIdentityParts(): ReadonlySet<string> {
  const file = path.join(generatedDir, LIVE_CODE_IDENTITY_PARTS);
  if (!existsSync(file)) {
    throw new Error(`Live code needs ${file}. Run \`pnpm --filter docs generate\` first.`);
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isNameList(parsed)) throw new Error(`${file} is not a list of part names`);
  return new Set(parsed);
}

/**
 * A part's settable props, read once per process from the committed artifacts. They come from
 * the artifact of the module's own entry when it documents the part, and otherwise from the first
 * artifact that does, as for a chart page that documents a shared entry. A part Fuse recognises by
 * element identity has none, so Live code leaves it unwrapped.
 */
export function liveCodeSchemaOf(module: string, part: string): PartSchema | undefined {
  identityParts ??= readIdentityParts();
  if (identityParts.has(part)) return undefined;
  artifacts ??= readArtifacts();
  const own = artifacts.find((artifact) => artifact.entry === module)?.parts.get(part);
  return own ?? artifacts.find((artifact) => artifact.parts.has(part))?.parts.get(part);
}
