/**
 * Reading a component page's committed `api.json` at render time.
 *
 * The page renders the *committed artifact*, not a fresh extraction: `api.json` is generated
 * from the library's types and JSDoc, reviewed as a diff, and read back here verbatim. The
 * page therefore shows exactly what the repository claims the API is — and the drift check
 * (`test/api-artifact.test.ts`) is what keeps that claim true.
 *
 * Server-only, like the demo-source read: this runs while the page is prerendered, so the
 * whole reference is part of the static HTML and no API data is shipped as client payload.
 * The read is synchronous: Cache Components prerenders synchronous I/O and counts an awaited
 * file read as uncached data.
 */

import { readFileSync } from "node:fs";

import type { ComponentApiArtifact } from "./docs-model";
import { API_REGEN_COMMAND } from "./docs-model";
import { componentApiFileName, docsRouteFile } from "./docs-route-files";

/**
 * Reads one committed API artifact of a component page: its own `api.json` by default, or the
 * `<artifact>.api.json` of an extra entry the page documents.
 *
 * A missing or mis-slugged artifact is a build failure: this runs during prerendering, so the
 * throw fails `next build` naming the file and the command that writes it, instead of
 * rendering an API section with no rows.
 */
export function readComponentApi(slug: string, artifactSlug: string = slug): ComponentApiArtifact {
  const location = docsRouteFile("components", slug, componentApiFileName(slug, artifactSlug));
  let raw: string;
  try {
    raw = readFileSync(location.absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `Component page "${slug}" renders an API reference, but ${location.repoPath} does not exist. ` +
        `Run \`${API_REGEN_COMMAND}\` and commit the artifact.`,
      { cause }
    );
  }

  const parsed: unknown = JSON.parse(raw);
  // `instanceof Object` rejects `null` *and* JSON's primitives (a bare string, number or
  // boolean) in one test, so a file that parsed but is not an artifact fails honestly here
  // instead of surviving to the slug comparison and reporting a mis-slug it does not have.
  if (!(parsed instanceof Object) || Array.isArray(parsed)) {
    throw new Error(`${location.repoPath} must be a JSON object. Run \`${API_REGEN_COMMAND}\`.`);
  }
  // SAFETY: `api.json` is written by this repo's own generator through one serialiser, and the
  // drift check regenerates and compares every committed file — a shape that disagrees with
  // `ComponentApiArtifact` fails there, before it can reach a render.
  const artifact = parsed as ComponentApiArtifact;
  if (artifact.slug !== artifactSlug) {
    throw new Error(
      `${location.repoPath} is the artifact of "${artifact.slug}" but sits where "${artifactSlug}"'s belongs. ` +
        `Run \`${API_REGEN_COMMAND}\`.`
    );
  }
  return artifact;
}
