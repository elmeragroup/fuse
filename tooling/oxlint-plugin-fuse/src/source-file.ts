import { dirname, resolve } from "node:path";

/**
 * The path a relative import specifier names, resolved from the linted file and written with
 * forward slashes.
 *
 * @param filename - The filename the linter reports, with either path separator.
 * @param specifier - The specifier as written in the import.
 * @returns The resolved path, or `undefined` for a specifier that starts with neither `./` nor `../`.
 */
export function relativeImportPath(filename: string, specifier: string): string | undefined {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
  return resolve(dirname(filename), specifier).replaceAll("\\", "/");
}

/**
 * Whether a linted file is a test: `*.test.ts`, `*.test.tsx`, `*.test-d.tsx` or `*.test.mjs`. The
 * source contracts bind library modules; a test may import or spell anything it checks.
 *
 * @param filename - The filename the linter reports, with either path separator.
 * @returns Whether the file is a test file.
 */
export function isTestFile(filename: string): boolean {
  return /\.test(?:-d)?\.[cm]?[jt]sx?$/u.test(filename);
}
