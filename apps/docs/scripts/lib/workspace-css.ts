import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Workspace CSS files docs `@import`s that only exist after the Fuse package
 * build. `./css` points at source and is always present; these two are
 * uncommitted codegen output.
 *
 * `turbo run dev` builds the library first; `pnpm --filter docs dev` does
 * not. Fail here — generate runs before every `next dev` / `next build` — so
 * Next cannot cache a Tailwind resolve error against an empty `dist/`.
 */
export const DOCS_FUSE_DIST_CSS = [
  { exportKey: "./themes.css", relative: "dist/themes.css" },
  { exportKey: "./demo-stage-comfortable.css", relative: "dist/demo-stage-comfortable.css" },
] as const;

export function assertDocsFuseCssExports(packageRoot: string): string[] {
  return DOCS_FUSE_DIST_CSS.map(({ exportKey, relative }) => {
    const absolute = path.join(packageRoot, relative);
    if (!existsSync(absolute)) {
      throw new Error(
        `${exportKey} is exported from ${packageRoot} as ./${relative}, but that file is missing. Run: pnpm --filter @elmeragroup/fuse build`
      );
    }
    return absolute;
  });
}
