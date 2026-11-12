/**
 * The JSX sites of a demo's lensed Fuse imports. A site is one opening tag of a part, with the
 * attributes written on it.
 *
 * Three readers must agree on where each site is. The Turbopack loader stamps each rendered part
 * with its location, the `/demo-source` route marks the highlighted tokens with it, and the Code
 * view's serializer writes edits back into the source with it. A site's `loc` is the one-based
 * `line:column` of its `<`, and it keys the site's edits everywhere.
 *
 * This is a small scanner rather than a parser, so the client can run it. It blanks comments
 * before the scan and steps over strings and braces in attribute values. A tag written inside a
 * string literal reads as a site, and an apostrophe in JSX text inside an attribute's expression
 * can end the value early. The docs demos write neither.
 */

/**
 * Entries whose exports are not components a reader edits: icons, theme helpers and artwork. The
 * first segment of the subpath decides, so `icons/brand` stays out too.
 */
const UNLENSED_ENTRIES: ReadonlySet<string> = new Set(["icons", "theme", "illustrations", "flags"]);

const FUSE_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*["']@elmeragroup\/fuse(?:\/([a-z0-9-]+(?:\/[a-z0-9-]+)*))?["'];?/gu;

/** One value import from a lensed Fuse entry. */
export type LensedImport = {
  /** The name the entry exports, such as `Button` or `Select`. */
  readonly imported: string;
  /** The name the demo binds it to: `imported`, or the `as` alias. */
  readonly local: string;
};

/**
 * One `import { … } from "@elmeragroup/fuse/<entry>"` declaration of a lensed entry.
 */
export type LensedImportDeclaration = {
  /** Offset of the declaration's `import`. */
  readonly start: number;
  /** Offset just past the declaration, its semicolon included. */
  readonly end: number;
  /** The specifier's module, such as `@elmeragroup/fuse/button`. */
  readonly module: string;
  /** Its value imports; `type` specifiers are left out. */
  readonly imports: readonly LensedImport[];
};

/** A range of the source, as offsets. */
export type SourceRange = {
  readonly start: number;
  readonly end: number;
};

/** An attribute's value: a string literal, unquoted in `text`, or an expression container. */
export type AttributeValue =
  | (SourceRange & { readonly kind: "string"; readonly text: string })
  | (SourceRange & { readonly kind: "expression" });

/** One named attribute on a site's opening tag. */
export type SiteAttribute = SourceRange & {
  readonly name: string;
  /** `null` for a bare attribute, such as `disabled`, which means `true`. */
  readonly value: AttributeValue | null;
};

/** One JSX opening tag of a lensed part. */
export type Site = {
  /** `line:column` of the tag's `<`, one-based. */
  readonly loc: string;
  /** The part's API name: the imported name, plus the member path, such as `Select.Root`. */
  readonly part: string;
  /** The tag name as written, such as `Select.Root`. */
  readonly tag: SourceRange;
  /** The tag's type arguments with their angle brackets, such as `<StatusFilter>`, or `null`. */
  readonly typeArguments: SourceRange | null;
  /** The tag's spreads, such as `{...props}`, in source order. */
  readonly spreads: readonly SourceRange[];
  /**
   * Where an attribute goes so that it wins: after the last spread, which would otherwise
   * override it, or else after the type arguments, or else after the tag name.
   */
  readonly insertAt: number;
  /** The named attributes, in source order. Spreads and comments are skipped. */
  readonly attributes: readonly SiteAttribute[];
};

/**
 * The source with its comments blanked to spaces, offsets kept. A block comment is masked
 * wherever it starts; a line comment only when it opens its line, so a `//` in a URL survives.
 */
function maskComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
    .replace(
      /^([ \t]*)\/\/[^\n]*/gmu,
      (comment, indent: string) => indent + " ".repeat(comment.length - indent.length)
    );
}

/**
 * Every value import of a lensed Fuse entry, in source order.
 *
 * @param source - A demo module's source.
 * @returns Its lensed import declarations.
 */
export function readLensedImports(source: string): readonly LensedImportDeclaration[] {
  const declarations: LensedImportDeclaration[] = [];
  for (const match of maskComments(source).matchAll(FUSE_IMPORT)) {
    const entry = match[2];
    if (entry !== undefined && UNLENSED_ENTRIES.has(entry.split("/")[0] ?? "")) continue;
    const imports: LensedImport[] = [];
    for (const specifier of (match[1] ?? "").split(",")) {
      const trimmed = specifier.trim();
      if (trimmed === "" || trimmed.startsWith("type ")) continue;
      const [imported = "", local = imported] = trimmed.split(/\s+as\s+/u);
      imports.push({ imported, local });
    }
    declarations.push({
      start: match.index,
      end: match.index + match[0].length,
      module: entry === undefined ? "@elmeragroup/fuse" : `@elmeragroup/fuse/${entry}`,
      imports,
    });
  }
  return declarations;
}

/** Offset just past a quoted string or template literal that opens at `from`. */
function skipQuoted(source: string, from: number): number {
  const quote = source[from];
  let at = from + 1;
  while (at < source.length && source[at] !== quote) {
    if (source[at] === "\\") at += 1;
    else if (quote === "`" && source.startsWith("${", at)) at = skipBraces(source, at + 1) - 1;
    at += 1;
  }
  return at + 1;
}

/** Offset just past the `}` that closes the `{` at `from`, stepping over strings. */
function skipBraces(source: string, from: number): number {
  let depth = 0;
  let at = from;
  while (at < source.length) {
    const char = source[at];
    if (char === '"' || char === "'" || char === "`") {
      at = skipQuoted(source, at);
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return at + 1;
    }
    at += 1;
  }
  return at;
}

/**
 * Offset just past the type arguments that open at `from`, such as `<{ phone: string }>`. Angle
 * brackets nest, an arrow's `=>` closes nothing, and strings are stepped over.
 */
function skipTypeArguments(source: string, from: number): number {
  let depth = 0;
  let at = from;
  while (at < source.length) {
    const char = source[at];
    if (char === '"' || char === "'" || char === "`") {
      at = skipQuoted(source, at);
      continue;
    }
    if (char === "<") depth += 1;
    else if (char === ">" && source[at - 1] !== "=") {
      depth -= 1;
      if (depth === 0) return at + 1;
    }
    at += 1;
  }
  return at;
}

/** An opening tag's named attributes and its spreads. */
type TagBody = {
  readonly attributes: readonly SiteAttribute[];
  readonly spreads: readonly SourceRange[];
};

/** The attributes and spreads of the opening tag whose name, and type arguments, end at `from`. */
function readAttributes(source: string, from: number): TagBody {
  const attributes: SiteAttribute[] = [];
  const spreads: SourceRange[] = [];
  const body = (): TagBody => ({ attributes, spreads });
  let at = from;
  for (;;) {
    while (at < source.length && /\s/u.test(source[at] ?? "")) at += 1;
    if (at >= source.length || source[at] === ">" || source.startsWith("/>", at)) return body();
    if (source[at] === "{") {
      // A spread or a masked comment. Neither is a prop the Code view edits, but a spread
      // overrides the attributes before it.
      const start = at;
      at = skipBraces(source, at);
      if (/^\{\s*\.\.\./u.test(source.slice(start, at))) spreads.push({ start, end: at });
      continue;
    }
    const start = at;
    while (at < source.length && /[\w:.-]/u.test(source[at] ?? "")) at += 1;
    const name = source.slice(start, at);
    if (name === "") return body();
    if (source[at] !== "=") {
      attributes.push({ name, start, end: at, value: null });
      continue;
    }
    const valueStart = at + 1;
    const opener = source[valueStart];
    if (opener === '"' || opener === "'") {
      const end = skipQuoted(source, valueStart);
      const text = source.slice(valueStart + 1, end - 1);
      attributes.push({ name, start, end, value: { kind: "string", start: valueStart, end, text } });
      at = end;
    } else if (opener === "{") {
      const end = skipBraces(source, valueStart);
      attributes.push({ name, start, end, value: { kind: "expression", start: valueStart, end } });
      at = end;
    } else {
      return body();
    }
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * The one-based `line:column` of an offset.
 *
 * @param source - The text the offset points into.
 * @param offset - A zero-based offset.
 * @returns The location, such as `12:7`.
 */
export function lineColumn(source: string, offset: number): string {
  const before = source.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return `${String(before.split("\n").length)}:${String(offset - lineStart + 1)}`;
}

/**
 * Every JSX site of a part the demo imports from a lensed Fuse entry, in source order. A
 * namespace's parts are sites too: `<Select.Root>` is the `Select.Root` part.
 *
 * @param source - A demo module's source.
 * @returns Its sites.
 */
export function findSites(source: string): readonly Site[] {
  const imports = readLensedImports(source).flatMap((declaration) => declaration.imports);
  if (imports.length === 0) return [];
  const byLocal = new Map(imports.map((entry) => [entry.local, entry.imported]));
  const names = imports.map((entry) => escapeRegExp(entry.local)).join("|");
  const tag = new RegExp(`(?<![\\w$.])<((?:${names})(?:\\.[A-Z][\\w$]*)*)(?=[\\s>/<])`, "gu");
  const masked = maskComments(source);
  const sites: Site[] = [];
  for (const match of masked.matchAll(tag)) {
    const written = match[1] ?? "";
    const dot = written.indexOf(".");
    const local = dot === -1 ? written : written.slice(0, dot);
    const imported = byLocal.get(local);
    if (imported === undefined) continue;
    const start = match.index + 1;
    const end = start + written.length;
    const typeArguments = masked[end] === "<" ? { start: end, end: skipTypeArguments(masked, end) } : null;
    const { attributes, spreads } = readAttributes(masked, typeArguments?.end ?? end);
    sites.push({
      loc: lineColumn(source, match.index),
      part: imported + written.slice(local.length),
      tag: { start, end },
      typeArguments,
      spreads,
      insertAt: spreads.at(-1)?.end ?? typeArguments?.end ?? end,
      attributes,
    });
  }
  return sites;
}
