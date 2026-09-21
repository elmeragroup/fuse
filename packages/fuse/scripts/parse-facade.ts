const FACADE_GRAMMAR =
  "Entry facades must be explicit named re-exports only: no export *, no local declarations, no directives";

const TYPE_REEXPORT = /^export\s+type\s*\{[\s\S]*?\}\s*from\s*("[^"]+"|'[^']+')\s*;?\s*/u;
const VALUE_REEXPORT = /^export\s*\{([\s\S]*?)\}\s*from\s*("[^"]+"|'[^']+')\s*;?\s*/u;
const EXPORT_STAR = /^export\s*\*/u;
const DIRECTIVE = /^["']use /u;

function fail(filePath: string, detail: string): never {
  throw new Error(`${filePath}: ${FACADE_GRAMMAR} (${detail})`);
}

function copyQuoted(source: string, start: number, quote: string) {
  let i = start + 1;
  let text = quote;
  while (i < source.length) {
    const ch = source[i];
    if (ch === undefined) {
      break;
    }
    text += ch;
    if (ch === "\\" && i + 1 < source.length) {
      const escaped = source[i + 1];
      if (escaped !== undefined) {
        text += escaped;
        i += 2;
        continue;
      }
    }
    if (ch === quote) {
      return { text, next: i + 1 };
    }
    i += 1;
  }
  return { text, next: source.length };
}

function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const copied = copyQuoted(source, i, ch);
      out += copied.text;
      i = copied.next;
      continue;
    }
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < source.length && source[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        i += 1;
      }
      i = Math.min(i + 2, source.length);
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function collectSpecifierName(filePath: string, specifier: string, names: string[]): void {
  const tokens = specifier.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) {
    return;
  }
  if (tokens[0] === "type") {
    return;
  }
  if (tokens.length === 1 && tokens[0] !== undefined) {
    const name = tokens[0];
    if (names.includes(name)) {
      fail(filePath, `duplicate value export \`${name}\``);
    }
    names.push(name);
    return;
  }
  if (tokens.length === 3 && tokens[1] === "as" && tokens[2] !== undefined) {
    const name = tokens[2];
    if (names.includes(name)) {
      fail(filePath, `duplicate value export \`${name}\``);
    }
    names.push(name);
    return;
  }
  fail(filePath, `unrecognized export specifier \`${specifier.trim()}\``);
}

/**
 * Statically parse an entry facade's value export names.
 * Type-only re-exports are ignored. Grammar violations throw.
 */
export function parseFacadeValueExports(filePath: string, source: string): string[] {
  let rest = stripComments(source).trim();
  if (DIRECTIVE.test(rest)) {
    fail(filePath, "directive is forbidden");
  }

  const names: string[] = [];
  while (rest.length > 0) {
    const typeMatch = TYPE_REEXPORT.exec(rest);
    if (typeMatch !== null) {
      rest = rest.slice(typeMatch[0].length).trimStart();
      continue;
    }
    if (EXPORT_STAR.test(rest)) {
      fail(filePath, "`export *` is forbidden");
    }
    const valueMatch = VALUE_REEXPORT.exec(rest);
    if (valueMatch === null) {
      fail(filePath, "local declarations are forbidden");
    }
    const inner = valueMatch[1] ?? "";
    for (const specifier of inner.split(",")) {
      collectSpecifierName(filePath, specifier, names);
    }
    rest = rest.slice(valueMatch[0].length).trimStart();
  }

  if (names.length === 0) {
    fail(filePath, "no value exports");
  }

  return names;
}
