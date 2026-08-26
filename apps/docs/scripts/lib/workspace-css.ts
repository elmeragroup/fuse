import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Dist CSS entries docs `@import`s. `./css` points at source and is always
 * present; these two are codegen output, uncommitted.
 */
export const DOCS_UI_DIST_CSS_EXPORTS = ["./themes.css", "./demo-stage-comfortable.css"] as const;

/**
 * Docs `@import`s workspace CSS entries that the package exports to
 * uncommitted `dist/` files. `turbo run dev` builds the library first;
 * `pnpm --filter docs dev` does not. Fail here — generate runs before every
 * `next dev` / `next build` — so Next cannot cache a Tailwind resolve error
 * against an empty `dist/`.
 */
export function assertCssExportTarget(packageRoot: string, exportKey: string): string {
  const parsed: unknown = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${packageRoot}/package.json is not an object`);
  }
  const exportsField = (parsed as { exports?: unknown }).exports;
  if (exportsField === null || typeof exportsField !== "object" || Array.isArray(exportsField)) {
    throw new Error(`${packageRoot}/package.json has no exports map`);
  }
  const target = (exportsField as Record<string, unknown>)[exportKey];
  if (typeof target !== "string") {
    throw new Error(`${packageRoot} does not export ${exportKey} as a file path`);
  }
  const absolute = path.join(packageRoot, target);
  if (!existsSync(absolute)) {
    throw new Error(
      `${exportKey} is exported from ${packageRoot} as ${target}, but that file is missing. Run: pnpm --filter @elmeragroup/ui build`
    );
  }
  return absolute;
}

export function assertDocsUiCssExports(packageRoot: string): string[] {
  return DOCS_UI_DIST_CSS_EXPORTS.map((exportKey) => assertCssExportTarget(packageRoot, exportKey));
}
