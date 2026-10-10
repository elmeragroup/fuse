/**
 * The theme studio's one entry point for shared docs code. Code outside `src/studio`,
 * `src/app/(studio)` and `test/studio` imports the studio through this module only, and
 * `test/studio-boundary.test.ts` fails on any other import.
 *
 * To remove the studio:
 *
 * 1. Delete `src/studio`, `src/app/(studio)` and `test/studio`.
 * 2. In `src/styles/globals.css`, delete the block from the `studio:start` comment to the
 *    `studio:end` comment.
 * 3. Delete the import of this module and the lines that use what it imports, in each seam:
 *    - `src/components/header.tsx`: the Studio link.
 *    - `src/app/(landing)/landing/landing-nav.tsx`: the Studio card in the Docs menu.
 *    - `src/app/og/docs/[[...path]]/route.tsx`: `STUDIO_PAGES` in the subtitle lookup and the
 *      static params.
 *    - `scripts/generate.ts`: `emitStudio`, its call in `main()` and its line in the header
 *      comment.
 *    - `scripts/lib/search.ts`: `studioEntry` and its spread in `buildSearchIndex`.
 *    - `scripts/lib/llms.ts`: the Studio section.
 *    - `scripts/lib/routes.ts`: `studioRouteFile` and `missingStudioRoutes`. Then delete their
 *      loop in `inspectGlobalDocs` (`scripts/lib/docs-inspection.ts`) and `studioRouteGroup` in
 *      `scripts/lib/paths.ts`.
 * 4. Delete `"Studio"` from `SearchGroup` in `src/lib/docs-model.ts`.
 * 5. In `turbo.json`, delete the `written-slots.ts` input of `generate`, which only the studio's
 *    slot index reads.
 * 6. Delete `test/studio-boundary.test.ts` and `"src/studio/"` from `CHECKED_SOURCES` in
 *    `test/docs-tailwind.test.ts`.
 * 7. Clean these inventory tests, which fail until their seam is gone:
 *    - `test/docs-pipeline.test.ts`: the studio route case.
 *    - `test/search-index.test.ts`: `STUDIO_PAGES` and the two theme studio queries.
 *    - `test/og-fit.test.ts`: the studio titles.
 *    - `test/site-inventory.test.ts`: the Studio section of `llms.txt`.
 *    - `test/og-images.test.ts`: the `(studio)` route group.
 *    - `test/document-html.test.ts`: the light studio document.
 * 8. In the repository root's `TODO.md`, rewrite or remove each line that references a studio
 *    file, and keep the unresolved Fuse issue it describes. The light-alias line names
 *    `apps/docs/src/studio/lib/artboard-style.ts`.
 * 9. Run `pnpm --filter docs generate`. It prunes the `studio-*` modules in `src/generated`.
 */

import type { StudioGeneratedFile, StudioGeneratorInput } from "./generate/files";
import { requireStudioPage } from "./lib/pages";

export { STUDIO_PAGES } from "./lib/pages";
export type { StudioPage } from "./lib/pages";

const HOME = requireStudioPage("/studio");

/** The docs header's link to the studio. */
export const STUDIO_HEADER_LINK = { href: HOME.href, label: "Studio" } as const;

/** The studio's card in the landing's Docs menu. */
export const STUDIO_NAV_CARD = { href: HOME.href, label: HOME.title, description: HOME.description } as const;

/**
 * The docs generation pass's studio step: the modules it writes under `src/generated`.
 *
 * The generator runs in Node and parses Fuse source. The header and the landing nav are client
 * modules that import this module, so the generator loads on call, and the ignore comment keeps
 * the bundler from compiling it into their chunks. Without the comment, Turbopack follows the
 * import into oxc-parser and the docs build fails.
 */
export async function studioGeneratedFiles(input: StudioGeneratorInput): Promise<StudioGeneratedFile[]> {
  const generator = await import(/* turbopackIgnore: true */ "./generate/files");
  return generator.studioGeneratedFiles(input);
}
