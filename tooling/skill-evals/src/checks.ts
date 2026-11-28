/**
 * The checks the runner decides from an app's files, as pure functions over their text. The cell
 * reads the files, runs the commands and resolves paths; these decide what the text shows. Script
 * sources are read through `oxc-parser` and stylesheets with their comments removed, so a
 * commented-out line never counts.
 */

import * as Predicate from "effect/Predicate";
import { parseSync, Visitor } from "oxc-parser";
import type { Expression, JSXAttribute, JSXElementName, JSXOpeningElement, ParseResult } from "oxc-parser";

import type { ComponentPath, ExpectedDocument, SourceCheck, StylesheetMode } from "./task.ts";

/** One check's outcome, with what the runner saw. */
export type CheckResult = {
  /** The check, as the report names it. */
  readonly name: string;
  readonly passed: boolean;
  /** What the runner saw, such as the attributes found or the import that does not resolve. */
  readonly detail: string;
};

/** A file of the app: its path from the app root, with `/` between segments, and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

const FUSE_PACKAGE = "@elmeragroup/fuse";

/** Whether a module specifier names Fuse's root entry or one of its subpaths. */
function isFuseSpecifier(specifier: string): boolean {
  return specifier === FUSE_PACKAGE || specifier.startsWith(`${FUSE_PACKAGE}/`);
}

const SCRIPT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];

function isScript(path: string): boolean {
  return SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isStylesheet(path: string): boolean {
  return path.endsWith(".css");
}

const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/gu;
/** A quoted string, kept as it is, or a comment, removed. */
const CSS_STRING_OR_COMMENT = /(?<string>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?(?:\*\/|$)/gu;

/** A stylesheet's text with its comments removed. A `/*` inside a quoted path, as in a glob, stays. */
function cssWithoutComments(text: string): string {
  return text.replace(CSS_STRING_OR_COMMENT, (match, string: string | undefined) => string ?? " ");
}

const HTML_START_TAG = /<html\b(?<attributes>[^>]*)>/iu;
const ATTRIBUTE =
  /(?<name>[^\s"'=<>/]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?/gu;

/** The attribute each axis of the expected document is written to, as `documentAttributes` writes it. */
const DOCUMENT_ATTRIBUTES: ReadonlyArray<readonly [keyof ExpectedDocument, string]> = [
  ["identity", "data-theme-identity"],
  ["brand", "data-theme-brand"],
  ["segment", "data-theme-segment"],
  ["density", "data-density"],
];

/**
 * Whether the built document's `<html>` start tag carries the expected theme and density. The
 * attributes are in the HTML file, so they hold before any script runs. A commented-out tag does
 * not count, and a theme attribute written twice fails, because a browser keeps the first and a
 * reader of the file may take the last.
 *
 * @param html - The built `index.html`, or `undefined` when the build wrote none.
 * @param expected - The theme and density the task asks for.
 * @returns The check's result.
 */
export function checkDocument(html: string | undefined, expected: ExpectedDocument): CheckResult {
  const name = "`<html>` carries the theme and density";
  if (html === undefined) return { name, passed: false, detail: "no built index.html" };
  const match = HTML_START_TAG.exec(html.replace(HTML_COMMENT, " "));
  if (match?.groups === undefined) return { name, passed: false, detail: "no <html> start tag" };
  const attributes = new Map<string, string[]>();
  for (const attribute of (match.groups.attributes ?? "").matchAll(ATTRIBUTE)) {
    const groups = attribute.groups ?? {};
    if (groups.name === undefined) continue;
    const key = groups.name.toLowerCase();
    attributes.set(key, [
      ...(attributes.get(key) ?? []),
      groups.double ?? groups.single ?? groups.bare ?? "",
    ]);
  }
  const wrong = DOCUMENT_ATTRIBUTES.flatMap(([axis, attribute]) => {
    const found = attributes.get(attribute) ?? [];
    if (found.length > 1) return [`${attribute} is written ${String(found.length)} times`];
    return found[0] === expected[axis]
      ? []
      : [`${attribute}=${found[0] ?? "(missing)"}, expected ${expected[axis]}`];
  });
  return wrong.length === 0
    ? { name, passed: true, detail: DOCUMENT_ATTRIBUTES.map(([axis]) => expected[axis]).join(" ") }
    : { name, passed: false, detail: wrong.join("; ") };
}

const CSS_IMPORT = /@import\s+(?:url\(\s*)?["'](?<specifier>[^"']+)["']/gu;

/** A script parsed as TSX, which also reads plain TypeScript and JavaScript. */
function parseScript(file: SourceFile): ParseResult {
  return parseSync(file.path.replace(/\.[cm]?[jt]sx?$/u, ".tsx"), file.text, { lang: "tsx" });
}

/** The string a dynamic import's argument spells, or `undefined` for a computed one. */
function literalSpecifier(text: string, start: number, end: number): string | undefined {
  const raw = text.slice(start, end).trim();
  const quote = raw[0];
  return (quote === '"' || quote === "'" || quote === "`") && raw.endsWith(quote) && raw.length >= 2
    ? raw.slice(1, -1)
    : undefined;
}

/**
 * Every module a file imports: in a script, the static and dynamic imports and re-exports the
 * parser finds, and in a stylesheet, each `@import`. Comments hold none.
 *
 * @param file - The file.
 * @returns The specifiers in order of appearance, each once.
 */
export function moduleImports(file: SourceFile): readonly string[] {
  if (isScript(file.path)) {
    const { module } = parseScript(file);
    return [
      ...new Set([
        ...module.staticImports.map((entry) => entry.moduleRequest.value),
        ...module.staticExports.flatMap((entry) =>
          entry.entries.flatMap((exported) =>
            exported.moduleRequest === null ? [] : [exported.moduleRequest.value]
          )
        ),
        ...module.dynamicImports.flatMap((entry) => {
          const specifier = literalSpecifier(file.text, entry.moduleRequest.start, entry.moduleRequest.end);
          return specifier === undefined ? [] : [specifier];
        }),
      ]),
    ];
  }
  if (isStylesheet(file.path)) {
    return [
      ...new Set(
        [...cssWithoutComments(file.text).matchAll(CSS_IMPORT)].flatMap((match) =>
          match.groups?.specifier === undefined ? [] : [match.groups.specifier]
        )
      ),
    ];
  }
  return [];
}

/**
 * Every `@elmeragroup/fuse` specifier the app's scripts and stylesheets import, without a Vite
 * query such as `?url`, which names how Vite loads the file and is no part of its path.
 *
 * @param sources - The app's files.
 * @returns Each specifier once, in file order.
 */
export function fuseImports(sources: readonly SourceFile[]): readonly string[] {
  return [
    ...new Set(
      sources.flatMap((file) =>
        moduleImports(file)
          .filter(isFuseSpecifier)
          .map((specifier) => specifier.replace(/\?.*$/su, ""))
      )
    ),
  ];
}

/** How Node resolved a specifier from the app's folder. */
export type Resolution =
  | { readonly _tag: "resolved"; readonly file: string }
  | { readonly _tag: "unresolved"; readonly reason: string };

/**
 * Whether every `@elmeragroup/fuse` import in the app resolves to a file, as Node resolves it from
 * the app's folder.
 *
 * @param sources - The app's files.
 * @param resolutions - How each specifier from {@link fuseImports} resolved.
 * @returns The check's result. It fails when the app imports no Fuse module at all.
 */
export function checkFuseImports(
  sources: readonly SourceFile[],
  resolutions: ReadonlyMap<string, Resolution>
): CheckResult {
  const name = "Every Fuse import resolves to a file";
  const specifiers = fuseImports(sources);
  if (specifiers.length === 0) return { name, passed: false, detail: "no Fuse imports" };
  const unresolved = specifiers.flatMap((specifier) => {
    const resolution = resolutions.get(specifier);
    if (resolution === undefined) return [`${specifier}: not resolved`];
    return resolution._tag === "resolved" ? [] : [`${specifier}: ${resolution.reason}`];
  });
  return unresolved.length === 0
    ? { name, passed: true, detail: `${String(specifiers.length)} specifiers` }
    : { name, passed: false, detail: unresolved.join(", ") };
}

const MODULE_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["'](?<src>[^"']+)["'][^>]*>/giu;

/** Joins a relative specifier to the folder of the file that imports it, or `undefined` above the root. */
function joinRelative(fromFile: string, specifier: string): string | undefined {
  const segments = fromFile.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else segments.push(part);
  }
  return segments.join("/");
}

const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];

/**
 * The app's files the page reaches: the module scripts the source `index.html` loads, and every
 * file they reach through relative imports, scripts and stylesheets alike.
 *
 * @param sources - The app's files, `index.html` among them.
 * @returns The paths reached, the entry page excluded.
 */
export function reachableFiles(sources: readonly SourceFile[]): ReadonlySet<string> {
  const byPath = new Map(sources.map((file) => [file.path, file]));
  const page = byPath.get("index.html");
  const reached = new Set<string>();
  if (page === undefined) return reached;
  const resolve = (fromFile: string, specifier: string): string | undefined => {
    const joined = specifier.startsWith("/")
      ? joinRelative("index.html", specifier.slice(1))
      : joinRelative(fromFile, specifier);
    if (joined === undefined) return undefined;
    return RESOLVE_SUFFIXES.map((suffix) => `${joined}${suffix}`).find((path) => byPath.has(path));
  };
  const queue = [...page.text.replace(HTML_COMMENT, " ").matchAll(MODULE_SCRIPT)].flatMap((match) => {
    const target = match.groups?.src === undefined ? undefined : resolve("index.html", match.groups.src);
    return target === undefined ? [] : [target];
  });
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (reached.has(next)) continue;
    reached.add(next);
    const file = byPath.get(next);
    if (file === undefined) continue;
    for (const specifier of moduleImports(file)) {
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue;
      const target = resolve(next, specifier);
      if (target !== undefined && !reached.has(target)) queue.push(target);
    }
  }
  return reached;
}

const SOURCE_DIRECTIVE = /@source\s+(?<negated>not\s+)?["'](?<path>[^"']+)["']/gu;

/** A positive `@source` path in a stylesheet: one that adds files to Tailwind's scan. */
export type SourceDirective = { readonly file: string; readonly path: string };

/**
 * The positive `@source` paths in the stylesheets the page reaches. A negated `@source not`
 * removes files from the scan, so it is left out.
 *
 * @param sources - The app's files.
 * @param reached - The files the page reaches, from {@link reachableFiles}.
 * @returns Each directive with the stylesheet that holds it.
 */
export function sourceDirectives(
  sources: readonly SourceFile[],
  reached: ReadonlySet<string>
): readonly SourceDirective[] {
  return sources
    .filter((file) => isStylesheet(file.path) && reached.has(file.path))
    .flatMap((file) =>
      [...cssWithoutComments(file.text).matchAll(SOURCE_DIRECTIVE)].flatMap((match) =>
        match.groups?.negated !== undefined || match.groups?.path === undefined
          ? []
          : [{ file: file.path, path: match.groups.path }]
      )
    );
}

const DATA_SLOT_SELECTOR = /data-slot[~|^$*]?=\\?["']?(?<slot>[a-z0-9-]+)/gu;

/**
 * The `data-slot` values a stylesheet's selectors name. Fuse's parts carry a `data-slot`, so its
 * rules name them, and a Tailwind build that never scanned Fuse's source names few.
 *
 * @param css - The stylesheet's text.
 * @returns The distinct values.
 */
export function dataSlotNames(css: string): ReadonlySet<string> {
  return new Set(
    [...css.matchAll(DATA_SLOT_SELECTOR)].flatMap((match) =>
      match.groups?.slot === undefined ? [] : [match.groups.slot]
    )
  );
}

const STYLESHEET_LINK = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/giu;
const HREF = /\bhref\s*=\s*["'](?<href>[^"']+)["']/iu;

/**
 * The stylesheets the built page links, by `href`.
 *
 * @param html - The built `index.html`.
 * @returns The hrefs in document order.
 */
export function linkedStylesheets(html: string): readonly string[] {
  return [...html.replace(HTML_COMMENT, " ").matchAll(STYLESHEET_LINK)].flatMap((match) => {
    const href = HREF.exec(match[0])?.groups?.href;
    return href === undefined ? [] : [href];
  });
}

/** What the stylesheet check reads. */
export type StylesheetEvidence = {
  /** The app's files. */
  readonly sources: readonly SourceFile[];
  /** The stylesheets the built page links, with their text, or `undefined` when the build wrote no page. */
  readonly shipped: ReadonlyArray<{ readonly href: string; readonly text: string }> | undefined;
  /**
   * The `data-slot` values the installed package's standalone `styles.css` names. That sheet is
   * Fuse's own rules, built, so a shipped sheet that holds Fuse's rules names every one of them.
   */
  readonly fuseSlots: ReadonlySet<string>;
  /** Whether an `@source` path, read from its stylesheet's folder, reaches the installed package. */
  readonly reachesPackage: (directive: SourceDirective) => boolean;
};

/**
 * Whether the build shipped Fuse's CSS the way the app's build calls for. The built page must link
 * a stylesheet that holds Fuse's component rules and its theme rules. In a Tailwind app, a sheet
 * the page reaches imports Fuse's Tailwind source and a positive `@source` in such a sheet reaches
 * the installed package; in an app without Tailwind, a module the page reaches imports the
 * standalone sheet. `themes.css` is reached in both.
 *
 * @param evidence - The sources, the shipped stylesheets and the oracle.
 * @param expected - The mode the app's build calls for.
 * @returns The check's result.
 */
export function checkStylesheetMode(evidence: StylesheetEvidence, expected: StylesheetMode): CheckResult {
  const name = `The build ships Fuse's CSS in ${expected} mode`;
  const problems: string[] = [];
  const reached = reachableFiles(evidence.sources);
  const importing = (specifier: string) =>
    evidence.sources
      .filter((file) => reached.has(file.path) && moduleImports(file).includes(specifier))
      .map((file) => file.path);
  const tailwindSource = importing(`${FUSE_PACKAGE}/css`);
  const standalone = importing(`${FUSE_PACKAGE}/styles.css`);
  if (importing(`${FUSE_PACKAGE}/themes.css`).length === 0)
    problems.push("no reached module imports themes.css");
  if (expected === "tailwind") {
    if (tailwindSource.length === 0) problems.push("no reached stylesheet imports @elmeragroup/fuse/css");
    const directives = sourceDirectives(evidence.sources, reached);
    if (!directives.some(evidence.reachesPackage)) {
      problems.push(
        directives.length === 0
          ? "no positive @source in a reached stylesheet"
          : `no positive @source reaches the package (${directives.map((directive) => directive.path).join(", ")})`
      );
    }
    if (standalone.length > 0) problems.push(`styles.css is also imported in ${standalone.join(", ")}`);
  } else {
    if (standalone.length === 0) problems.push("no reached module imports @elmeragroup/fuse/styles.css");
    if (tailwindSource.length > 0)
      problems.push(`the Tailwind source is imported in ${tailwindSource.join(", ")}`);
  }

  if (evidence.shipped === undefined) problems.push("the build wrote no page");
  else if (evidence.shipped.length === 0) problems.push("the built page links no stylesheet");
  else if (evidence.fuseSlots.size === 0)
    problems.push("the installed styles.css names no data-slot, so no oracle");
  else {
    const shippedText = evidence.shipped.map((sheet) => sheet.text).join("\n");
    const shippedSlots = dataSlotNames(shippedText);
    const missing = [...evidence.fuseSlots].filter((slot) => !shippedSlots.has(slot));
    if (missing.length > 0) {
      problems.push(
        `the shipped CSS styles ${String(evidence.fuseSlots.size - missing.length)} of Fuse's ${String(evidence.fuseSlots.size)} parts (missing ${missing.slice(0, 3).join(", ")})`
      );
    }
    if (!shippedText.includes("data-theme-brand")) problems.push("the shipped CSS has no theme rules");
  }
  return problems.length === 0
    ? { name, passed: true, detail: (expected === "tailwind" ? tailwindSource : standalone).join(", ") }
    : { name, passed: false, detail: problems.join("; ") };
}

/** What an attribute's value is, as far as the syntax shows it. */
type AttributeValue =
  | { readonly _tag: "string"; readonly value: string }
  | { readonly _tag: "boolean"; readonly value: boolean }
  | { readonly _tag: "expression" };

/** A JSX element whose tag a Fuse import names, with its attributes. */
type FuseElement = {
  readonly file: string;
  /** The component as Fuse exports it, such as `ToggleGroup.Root`. */
  readonly component: string;
  readonly attributes: ReadonlyMap<string, AttributeValue>;
};

/** The names a file imports from Fuse: each local name with the export it binds, `*` for a namespace. */
function fuseBindings(parsed: ParseResult): ReadonlyMap<string, string> {
  const bindings = new Map<string, string>();
  for (const statement of parsed.module.staticImports) {
    if (!isFuseSpecifier(statement.moduleRequest.value)) continue;
    for (const entry of statement.entries) {
      if (entry.isType) continue;
      if (entry.importName.kind === "NamespaceObject") bindings.set(entry.localName.value, "*");
      else if (entry.importName.kind === "Name" && entry.importName.name !== null) {
        bindings.set(entry.localName.value, entry.importName.name);
      }
    }
  }
  return bindings;
}

/** A tag name's dotted segments, such as `["ToggleGroup", "Root"]`, or `undefined` for another form. */
function tagSegments(name: JSXElementName): readonly string[] | undefined {
  switch (name.type) {
    case "JSXIdentifier":
      return [name.name];
    case "JSXMemberExpression": {
      const left = name.object.type === "JSXIdentifier" ? [name.object.name] : tagSegments(name.object);
      return left === undefined ? undefined : [...left, name.property.name];
    }
    case "JSXNamespacedName":
      return undefined;
  }
}

/** An expression without the parentheses and TypeScript assertions around it, which keep its value. */
function unwrapped(expression: Expression): Expression {
  switch (expression.type) {
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
      return unwrapped(expression.expression);
    default:
      return expression;
  }
}

function attributeValue(attribute: JSXAttribute): AttributeValue {
  const value = attribute.value;
  if (value === null) return { _tag: "boolean", value: true };
  if (value.type === "Literal" && Predicate.isString(value.value))
    return { _tag: "string", value: value.value };
  if (value.type === "JSXExpressionContainer") {
    const expression =
      value.expression.type === "JSXEmptyExpression" ? value.expression : unwrapped(value.expression);
    if (expression.type === "Literal") {
      if (Predicate.isString(expression.value)) return { _tag: "string", value: expression.value };
      if (Predicate.isBoolean(expression.value)) return { _tag: "boolean", value: expression.value };
    }
    if (expression.type === "TemplateLiteral" && expression.expressions.length === 0) {
      return { _tag: "string", value: expression.quasis.map((quasi) => quasi.value.cooked ?? "").join("") };
    }
  }
  return { _tag: "expression" };
}

/**
 * Every JSX element in the app's scripts whose tag a Fuse import names, through a named import, a
 * renamed one or a namespace.
 */
function fuseElements(sources: readonly SourceFile[]): readonly FuseElement[] {
  return sources
    .filter((source) => isScript(source.path))
    .flatMap((source) => {
      const parsed = parseScript(source);
      const bindings = fuseBindings(parsed);
      const found: FuseElement[] = [];
      new Visitor({
        JSXOpeningElement(node: JSXOpeningElement) {
          const [local, ...members] = tagSegments(node.name) ?? [];
          const bound = local === undefined ? undefined : bindings.get(local);
          if (bound === undefined) return;
          const path = bound === "*" ? members : [bound, ...members];
          if (path.length === 0) return;
          const attributes = new Map<string, AttributeValue>();
          for (const attribute of node.attributes) {
            if (attribute.type === "JSXAttribute" && attribute.name.type === "JSXIdentifier") {
              attributes.set(attribute.name.name, attributeValue(attribute));
            }
          }
          found.push({ file: source.path, component: path.join("."), attributes });
        },
      }).visit(parsed.program);
      return found;
    });
}

function matchesComponent(element: FuseElement, components: "any" | readonly ComponentPath[]): boolean {
  return components === "any" || components.includes(element.component);
}

const CUSTOM_PROPERTY_DECLARATION = /(?:^|[\s;{])(?<property>--[\w-]+)\s*:/gu;

/**
 * Whether a task's source check holds over the app's files.
 *
 * @param sources - The app's `src` files.
 * @param check - The task's check.
 * @returns The check's result, naming the first file that decides it.
 */
export function checkSource(sources: readonly SourceFile[], check: SourceCheck): CheckResult {
  switch (check.kind) {
    case "uses": {
      const hit = fuseElements(sources).find((element) => matchesComponent(element, check.components));
      return hit === undefined
        ? { name: check.name, passed: false, detail: `no Fuse ${check.components.join(" or ")} element` }
        : { name: check.name, passed: true, detail: `${hit.component} in ${hit.file}` };
    }
    case "prop": {
      const hit = fuseElements(sources)
        .filter((element) => matchesComponent(element, check.components))
        .flatMap((element) =>
          check.props.flatMap((prop) => {
            const value = element.attributes.get(prop);
            if (value === undefined) return [];
            const holds =
              check.value === "not-false"
                ? !(value._tag === "boolean" && !value.value)
                : value._tag === "string" && value.value === check.value.equals;
            return holds ? [`${element.component} ${prop} in ${element.file}`] : [];
          })
        )[0];
      return hit === undefined
        ? { name: check.name, passed: false, detail: "no Fuse element carries it" }
        : { name: check.name, passed: true, detail: hit };
    }
    case "no-custom-property": {
      const hit = sources
        .filter((source) => isStylesheet(source.path))
        .flatMap((source) =>
          [...cssWithoutComments(source.text).matchAll(CUSTOM_PROPERTY_DECLARATION)]
            .filter(
              (match) =>
                match.groups?.property !== undefined && check.properties.includes(match.groups.property)
            )
            .map((match) => `${match.groups?.property ?? ""} in ${source.path}`)
        )[0];
      return hit === undefined
        ? { name: check.name, passed: true, detail: "none declared" }
        : { name: check.name, passed: false, detail: hit };
    }
  }
}
