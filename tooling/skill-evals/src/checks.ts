/**
 * The checks the runner decides from an app's files, as pure functions over their text. The cell
 * reads the files and runs the commands; these decide what the text shows.
 */

import type { ExpectedDocument, SourceCheck, StylesheetMode } from "./task.ts";
import { compilePattern } from "./task.ts";

/** One check's outcome, with what the runner saw. */
export type CheckResult = {
  /** The check, as the report names it. */
  readonly name: string;
  readonly passed: boolean;
  /** What the runner saw, such as the attributes found or the import that does not resolve. */
  readonly detail: string;
};

const HTML_START_TAG = /<html\b(?<attributes>[^>]*)>/iu;
const ATTRIBUTE =
  /(?<name>[^\s"'=<>/]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?/gu;

/**
 * The attributes of the first `<html>` start tag in a document.
 *
 * @param html - The document's text.
 * @returns Each attribute's value by its lowercased name, with an empty value for a bare
 *   attribute, or `undefined` when the document has no `<html>` start tag.
 */
export function htmlStartTagAttributes(html: string): ReadonlyMap<string, string> | undefined {
  const match = HTML_START_TAG.exec(html);
  if (match?.groups === undefined) return undefined;
  const attributes = new Map<string, string>();
  for (const attribute of (match.groups.attributes ?? "").matchAll(ATTRIBUTE)) {
    const groups = attribute.groups ?? {};
    const name = groups.name;
    if (name === undefined) continue;
    attributes.set(name.toLowerCase(), groups.double ?? groups.single ?? groups.bare ?? "");
  }
  return attributes;
}

/** The attribute each axis of the expected document is written to, as `documentAttributes` writes it. */
const DOCUMENT_ATTRIBUTES: ReadonlyArray<readonly [keyof ExpectedDocument, string]> = [
  ["identity", "data-theme-identity"],
  ["brand", "data-theme-brand"],
  ["segment", "data-theme-segment"],
  ["density", "data-density"],
];

/**
 * Whether the built document's `<html>` start tag carries the expected theme and density. The
 * attributes are in the HTML file, so they hold before any script runs.
 *
 * @param html - The built `index.html`, or `undefined` when the build wrote none.
 * @param expected - The theme and density the task asks for.
 * @returns The check's result.
 */
export function checkDocument(html: string | undefined, expected: ExpectedDocument): CheckResult {
  const name = "`<html>` carries the theme and density";
  if (html === undefined) return { name, passed: false, detail: "no built index.html" };
  const attributes = htmlStartTagAttributes(html);
  if (attributes === undefined) return { name, passed: false, detail: "no <html> start tag" };
  const wrong = DOCUMENT_ATTRIBUTES.flatMap(([axis, attribute]) => {
    const found = attributes.get(attribute);
    return found === expected[axis]
      ? []
      : [`${attribute}=${found ?? "(missing)"}, expected ${expected[axis]}`];
  });
  return wrong.length === 0
    ? { name, passed: true, detail: DOCUMENT_ATTRIBUTES.map(([axis]) => expected[axis]).join(" ") }
    : { name, passed: false, detail: wrong.join("; ") };
}

/** A source file of the app: its path from the app root and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

const FUSE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|@import\s+(?:url\(\s*)?)["'](?<specifier>@elmeragroup\/fuse(?:\/[^"'\s]*)?)["']/gu;

/**
 * Every `@elmeragroup/fuse` specifier a file imports: static and dynamic imports, re-exports and
 * CSS `@import`s.
 *
 * @param text - The file's text.
 * @returns The specifiers in order of appearance, each once.
 */
export function fuseSpecifiers(text: string): readonly string[] {
  const specifiers = new Set<string>();
  for (const match of text.matchAll(FUSE_SPECIFIER)) {
    const specifier = match.groups?.specifier;
    if (specifier !== undefined) specifiers.add(specifier);
  }
  return [...specifiers];
}

/**
 * An installed package's `exports`: each key, and whether its target exports a file or, as a
 * `null` target does, excludes the subpath.
 */
export type PackageExports = ReadonlyMap<string, "exported" | "excluded">;

/**
 * Whether an import of a subpath resolves, through an exact key or a pattern with one `*`, as
 * Node resolves package exports.
 */
function exportsResolve(subpath: string, exports: PackageExports): boolean {
  const exact = exports.get(subpath);
  if (exact !== undefined) return exact === "exported";
  // Node picks the pattern with the longest prefix before the `*`.
  const patterns = [...exports.keys()]
    .filter((key) => {
      const star = key.indexOf("*");
      if (star === -1 || key.includes("*", star + 1)) return false;
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      return subpath.length >= key.length && subpath.startsWith(prefix) && subpath.endsWith(suffix);
    })
    .sort((left, right) => right.indexOf("*") - left.indexOf("*"));
  const best = patterns[0];
  return best !== undefined && exports.get(best) === "exported";
}

/**
 * Whether every `@elmeragroup/fuse` import in the app's sources resolves through the installed
 * package's `exports`.
 *
 * @param sources - The app's source files.
 * @param exports - The installed package's `exports`, or `undefined` when the app has no Fuse
 *   installed.
 * @returns The check's result. It fails when the app imports no Fuse module at all.
 */
export function checkFuseImports(
  sources: readonly SourceFile[],
  exports: PackageExports | undefined
): CheckResult {
  const name = "Every Fuse import resolves";
  const imports = sources.flatMap((file) =>
    fuseSpecifiers(file.text).map((specifier) => ({ file: file.path, specifier }))
  );
  if (imports.length === 0) return { name, passed: false, detail: "no Fuse imports" };
  if (exports === undefined) return { name, passed: false, detail: "@elmeragroup/fuse is not installed" };
  const unresolved = imports.filter(
    ({ specifier }) => !exportsResolve(`.${specifier.slice("@elmeragroup/fuse".length)}`, exports)
  );
  return unresolved.length === 0
    ? { name, passed: true, detail: `${String(new Set(imports.map((i) => i.specifier)).size)} specifiers` }
    : {
        name,
        passed: false,
        detail: unresolved.map(({ file, specifier }) => `${specifier} in ${file}`).join(", "),
      };
}

const SOURCE_DIRECTIVE = /@source\s+(?:not\s+)?["'](?<path>[^"']+)["']/gu;

/** What the app's sources show about how it loads Fuse's CSS. */
export type StylesheetFindings = {
  /** The files that import Fuse's Tailwind source, `@elmeragroup/fuse/css`. */
  readonly tailwindSource: readonly string[];
  /** The files that import the standalone sheet, `@elmeragroup/fuse/styles.css`. */
  readonly standalone: readonly string[];
  /** The files that import `@elmeragroup/fuse/themes.css`. */
  readonly themes: readonly string[];
  /** Each `@source` path in a stylesheet that imports the Tailwind source, with its stylesheet. */
  readonly sourcePaths: ReadonlyArray<{ readonly file: string; readonly path: string }>;
};

/**
 * Reads how the app's sources load Fuse's CSS.
 *
 * @param sources - The app's source files.
 * @returns The files that import each Fuse stylesheet, and the `@source` paths beside the Tailwind
 *   source.
 */
export function stylesheetFindings(sources: readonly SourceFile[]): StylesheetFindings {
  const importing = (specifier: string) =>
    sources.filter((file) => fuseSpecifiers(file.text).includes(specifier)).map((file) => file.path);
  const tailwindSource = importing("@elmeragroup/fuse/css");
  return {
    tailwindSource,
    standalone: importing("@elmeragroup/fuse/styles.css"),
    themes: importing("@elmeragroup/fuse/themes.css"),
    sourcePaths: sources
      .filter((file) => tailwindSource.includes(file.path))
      .flatMap((file) =>
        [...file.text.matchAll(SOURCE_DIRECTIVE)].flatMap((match) => {
          const path = match.groups?.path;
          return path === undefined ? [] : [{ file: file.path, path }];
        })
      ),
  };
}

/**
 * Whether the app loads Fuse's CSS the way its build calls for: the Tailwind source with an
 * `@source` that reaches the installed package where the app compiles Tailwind, the standalone
 * sheet where it does not, and `themes.css` in both.
 *
 * @param findings - What the sources show, from {@link stylesheetFindings}.
 * @param expected - The mode the app's build calls for.
 * @param reachesPackage - Whether an `@source` path, read from its stylesheet's folder, is the
 *   installed package's folder.
 * @returns The check's result.
 */
export function checkStylesheetMode(
  findings: StylesheetFindings,
  expected: StylesheetMode,
  reachesPackage: (source: { readonly file: string; readonly path: string }) => boolean
): CheckResult {
  const name = `Stylesheet mode is ${expected}`;
  const problems: string[] = [];
  if (findings.themes.length === 0) problems.push("themes.css is not imported");
  if (expected === "tailwind") {
    if (findings.tailwindSource.length === 0) problems.push("@elmeragroup/fuse/css is not imported");
    else if (!findings.sourcePaths.some(reachesPackage)) {
      problems.push(
        findings.sourcePaths.length === 0
          ? "no @source beside @elmeragroup/fuse/css"
          : `no @source reaches the package (${findings.sourcePaths.map((s) => s.path).join(", ")})`
      );
    }
    if (findings.standalone.length > 0)
      problems.push(`styles.css is also imported in ${findings.standalone.join(", ")}`);
  } else {
    if (findings.standalone.length === 0) problems.push("@elmeragroup/fuse/styles.css is not imported");
    if (findings.tailwindSource.length > 0) {
      problems.push(`the Tailwind source is imported in ${findings.tailwindSource.join(", ")}`);
    }
  }
  return problems.length === 0
    ? {
        name,
        passed: true,
        detail: expected === "tailwind" ? findings.tailwindSource.join(", ") : findings.standalone.join(", "),
      }
    : { name, passed: false, detail: problems.join("; ") };
}

/**
 * Whether a task's source check holds over the app's `src` files.
 *
 * @param sources - The app's `src` files.
 * @param check - The task's check.
 * @returns The check's result, naming the first file that matches.
 */
export function checkSource(sources: readonly SourceFile[], check: SourceCheck): CheckResult {
  const compiled = compilePattern(check.pattern);
  // loadTasks rejects a task file with a pattern that does not compile.
  if (compiled._tag === "invalid") return { name: check.name, passed: false, detail: compiled.reason };
  const hit = sources.find((file) => compiled.regex.test(file.text));
  const passed = check.expect === "match" ? hit !== undefined : hit === undefined;
  return { name: check.name, passed, detail: hit === undefined ? "no file matches" : `matches ${hit.path}` };
}
