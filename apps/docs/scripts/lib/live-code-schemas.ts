/**
 * The settable props of every documented part, read from the committed `api.json` files. The
 * Live code loader inlines them into each demo, and the Live code sweep applies them.
 *
 * Every read goes through a cache keyed by the file's modification time, so a long-running
 * `next dev` or a test run sees a regenerated artifact on its next lookup without reparsing the
 * unchanged ones. Each lookup session records the files its answers came from, which the loader
 * registers as the demo's dependencies, so Turbopack's persistent cache recompiles a demo when
 * one of them changes.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { ComponentApiArtifact } from "../../src/lib/docs-model.ts";
import { partSchema } from "../../src/lib/live-code/schema.ts";
import type { PartSchema } from "../../src/lib/live-code/schema.ts";
import { componentSlugs, resolveComponentPaths } from "./components.ts";
import type { SchemaLookup } from "./live-code-transform.ts";
import { generatedDir } from "./paths.ts";

/**
 * The file in `src/generated` that lists the parts Fuse recognises by element identity, which
 * `identityComparedParts` writes during generation.
 */
export const LIVE_CODE_IDENTITY_PARTS = "live-code-identity-parts.json";

/** One committed artifact: the module it documents, its file, and its parts' schemas. */
type ArtifactSchemas = {
  readonly entry: string;
  readonly file: string;
  readonly parts: ReadonlyMap<string, PartSchema>;
};

/**
 * A reader of one kind of file that keeps each file's result with the modification time it was
 * read at, and reads the file again only once it changed.
 *
 * @param read - What one file holds, from its text.
 * @returns The cached reader.
 */
function cachedByMtime<T>(read: (text: string, file: string) => T): (file: string) => T {
  const held = new Map<string, { readonly mtimeMs: number; readonly value: T }>();
  return (file) => {
    const { mtimeMs } = statSync(file);
    const entry = held.get(file);
    if (entry?.mtimeMs === mtimeMs) return entry.value;
    const value = read(readFileSync(file, "utf8"), file);
    held.set(file, { mtimeMs, value });
    return value;
  };
}

/** One artifact's parts and their schemas, or `null` when the file holds no parts list. */
const readArtifactParts = cachedByMtime((text): ReadonlyMap<string, PartSchema> | null => {
  const parsed: unknown = JSON.parse(text);
  if (!(parsed instanceof Object) || !("parts" in parsed)) return null;
  // SAFETY: `api.json` is written by this repo's generator through one serialiser, and the drift
  // check regenerates and compares every committed file, as `api-source.ts` argues.
  const artifact = parsed as ComponentApiArtifact;
  return new Map(artifact.parts.map((part) => [part.name, partSchema(part.props)]));
});

/**
 * Every committed artifact, keyed by the module it documents, such as
 * `@elmeragroup/fuse/date-picker`. The generator's own path resolution names each page's
 * entries, so a shared entry maps to the artifact the page reference renders.
 */
function readArtifacts(): readonly ArtifactSchemas[] {
  return componentSlugs().flatMap((slug) =>
    resolveComponentPaths(slug).apis.flatMap(({ entry, apiFile }): ArtifactSchemas[] => {
      if (!existsSync(apiFile)) return [];
      const parts = readArtifactParts(apiFile);
      return parts === null ? [] : [{ entry, file: apiFile, parts }];
    })
  );
}

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
 * @throws {Error} When the file is not a list of part names.
 */
const readIdentityList = cachedByMtime((text, file): ReadonlySet<string> => {
  const parsed: unknown = JSON.parse(text);
  if (!isNameList(parsed)) throw new Error(`${file} is not a list of part names`);
  return new Set(parsed);
});

/**
 * The identity list, once generation has written it.
 *
 * @throws {Error} When generation has not written the list.
 */
function readIdentityParts(file: string): ReadonlySet<string> {
  if (!existsSync(file)) {
    throw new Error(`Live code needs ${file}. Run \`pnpm --filter docs generate\` first.`);
  }
  return readIdentityList(file);
}

/** A lookup, and the files its answers so far came from. */
export type LiveCodeSchemas = {
  /** The settable props of a part, or `undefined` when Live code leaves it unwrapped. */
  readonly schemaOf: SchemaLookup;
  /** The files the lookups read: the identity list, and each artifact an answer depends on. */
  readonly files: () => readonly string[];
};

/**
 * Opens a lookup session over the current artifacts. A part's settable props come from the
 * artifact of the module's own entry when it documents the part, and otherwise from the first
 * artifact that does, as for a chart page that documents a shared entry. A part Fuse recognises
 * by element identity has none, so Live code leaves it unwrapped.
 *
 * @returns The session's lookup and the files it read.
 */
export function openLiveCodeSchemas(): LiveCodeSchemas {
  const identityFile = path.join(generatedDir, LIVE_CODE_IDENTITY_PARTS);
  const files = new Set<string>([identityFile]);
  let identityParts: ReadonlySet<string> | null = null;
  let artifacts: readonly ArtifactSchemas[] | null = null;
  return {
    schemaOf(module, part) {
      identityParts ??= readIdentityParts(identityFile);
      if (identityParts.has(part)) return undefined;
      artifacts ??= readArtifacts();
      const own = artifacts.filter((artifact) => artifact.entry === module);
      // The module's own artifacts decide whether a fallback is used, so a change there matters.
      for (const artifact of own) files.add(artifact.file);
      const source =
        own.find((artifact) => artifact.parts.has(part)) ??
        artifacts.find((artifact) => artifact.parts.has(part));
      if (source === undefined) return undefined;
      files.add(source.file);
      return source.parts.get(part);
    },
    files: () => [...files],
  };
}
