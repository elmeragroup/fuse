/**
 * The frontmatter of an authored component page: the `---` fenced block at the top of its
 * `page.mdx`, which declares the page's lede and nothing else. The docs generator reads it through
 * `page-source.ts`, and the Figma kit's build reads the lede through {@link parsePageLede}. This
 * module imports nothing, so a package outside the docs app can read a lede without loading the
 * docs model.
 */

const FRONTMATTER_FENCE = "---";

/** A page split at its frontmatter's closing fence. */
type SplitPage = {
  frontmatter: string;
  body: string;
};

/** Splits the `---` fenced frontmatter block off the top of the file. */
export function splitFrontmatter(source: string, file: string): SplitPage {
  const normalised = source.startsWith("﻿") ? source.slice(1) : source;
  if (!normalised.startsWith(`${FRONTMATTER_FENCE}\n`)) {
    throw new Error(`${file}: a component page must open with a frontmatter block`);
  }
  const end = normalised.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length);
  if (end === -1) {
    throw new Error(`${file}: the frontmatter block is never closed`);
  }
  return {
    frontmatter: normalised.slice(FRONTMATTER_FENCE.length + 1, end),
    body: normalised.slice(end + 1 + FRONTMATTER_FENCE.length),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed.slice(0, 1);
  if (trimmed.length >= 2 && (quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Reads a `>`-folded (or `|`-literal) block scalar's indented continuation lines. */
function readBlockScalar(lines: readonly string[], start: number, fold: boolean): [string, number] {
  const collected: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() !== "" && !line.startsWith("  ")) {
      break;
    }
    collected.push(line.trim());
    index += 1;
  }
  while (collected[collected.length - 1] === "") {
    collected.pop();
  }
  return [fold ? collected.join(" ").trim() : collected.join("\n"), index];
}

/** The page's lede — the only editorial metadata a page declares — or a failure. */
export function parseFrontmatter(frontmatter: string, file: string): string {
  const lines = frontmatter.split("\n");
  let lede: string | null = null;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || line.trim().startsWith("#")) {
      index += 1;
      continue;
    }
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    const key = match?.[1];
    if (match === null || key === undefined) {
      throw new Error(`${file}: unparsable frontmatter line: ${line}`);
    }
    if (key !== "lede") {
      throw new Error(`${file}: unknown frontmatter key "${key}" — a page declares only its lede`);
    }
    const rawValue = (match[2] ?? "").trim();
    if (rawValue === ">" || rawValue === "|") {
      const [value, next] = readBlockScalar(lines, index + 1, rawValue === ">");
      lede = value;
      index = next;
      continue;
    }
    lede = unquote(rawValue);
    index += 1;
  }
  if (lede === null || lede === "") {
    throw new Error(`${file}: frontmatter key "lede" is required`);
  }
  return lede;
}

/**
 * Reads the lede of an authored `page.mdx`, given its text.
 *
 * @param source - The page's text.
 * @param label - Names the file in failures.
 * @returns The lede, a `>`-folded block joined into one line.
 * @throws {Error} When the page has no frontmatter, a key other than `lede`, or an empty lede, as
 *   the docs generator fails on the same page.
 */
export function parsePageLede(source: string, label: string): string {
  return parseFrontmatter(splitFrontmatter(source, label).frontmatter, label);
}
