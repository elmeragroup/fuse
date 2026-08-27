import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { DOCS_SHADOW_SLUGS } from "./api-shadow-types.ts";
import type { DocsShadowComponent, DocsShadowSlug, ProtectedBytes } from "./api-shadow-types.ts";
import { componentInspections } from "./docs-inspection.ts";
import { generatedDir, llmsTxtFile, markdownOutDir, repoRelative, repoRoot } from "./paths.ts";

const expectedSlugs = new Set<string>(DOCS_SHADOW_SLUGS);

function asSlug(value: string): DocsShadowSlug {
  if (!expectedSlugs.has(value)) {
    throw new Error(`docs shadow inventory contains unsupported component "${value}"`);
  }
  // SAFETY: membership in the closed expectedSlugs set above narrows this value
  // to the exact literal inventory type.
  return value as DocsShadowSlug;
}

/** Reads exactly the route-local component pages consumed by the production generator. */
export function docsShadowInventory(): readonly DocsShadowComponent[] {
  const seen = new Set<string>();
  const inventory = componentInspections().map((inspection) => {
    const slug = asSlug(inspection.slug);
    if (seen.has(slug)) throw new Error(`docs shadow inventory contains duplicate component "${slug}"`);
    seen.add(slug);
    return {
      slug,
      entryFile: inspection.paths.entryFile,
      exportName: inspection.paths.exportName,
      exportNames: inspection.paths.apiExportNames,
      sourceFile: inspection.paths.sourceFile,
    };
  });
  const actual = inventory.map((entry) => entry.slug);
  // `componentInspections()` is the same ordering production uses; keep the
  // declared inventory in that observed order.
  const expected = [...DOCS_SHADOW_SLUGS];
  if (actual.length !== expected.length || actual.some((slug, index) => slug !== expected[index])) {
    throw new Error(
      `docs shadow inventory mismatch: expected ${expected.join(", ")}; found ${actual.join(", ")}`
    );
  }
  return inventory;
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function filesUnder(directory: string): readonly string[] {
  return readdirSync(directory)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((entry) => {
      const target = path.join(directory, entry);
      return statSync(target).isDirectory() ? filesUnder(target) : [target];
    });
}

function fileManifest(files: readonly string[]) {
  return files
    .map((file) => ({ path: repoRelative(file), sha256: sha256(file) }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

/** Hashes the generator and all generated consumer-visible files. */
export function snapshotProtectedBytes(): ProtectedBytes {
  return {
    generator: {
      path: "apps/docs/scripts/generate.ts",
      sha256: sha256(path.join(repoRoot, "apps/docs/scripts/generate.ts")),
    },
    generated: fileManifest(filesUnder(generatedDir)),
    markdown: fileManifest(filesUnder(markdownOutDir)),
    llms: { path: repoRelative(llmsTxtFile), sha256: sha256(llmsTxtFile) },
  };
}

export function protectedBytesEqual(left: ProtectedBytes, right: ProtectedBytes): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
