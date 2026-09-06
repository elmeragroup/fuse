/**
 * Reading an authored component page (docs-site.md §1).
 *
 * A `page.mdx` is compiled by `@next/mdx` for the browser; this is the same file read as
 * *data* by the docs generation pass, which needs three things a page declares and
 * nothing else does: its frontmatter metadata, the headings its prose contributes to the
 * on-page TOC, and the demos it renders. There is no separate registry to drift from —
 * the page the site serves is the page the generator reads.
 *
 * Deliberately a small line-oriented reader rather than an MDX/YAML parse: the schema is
 * closed (title, lede), so an unknown key is a build failure instead of silently ignored
 * input, and the generator stays free of the bundler's MDX plumbing.
 */

import { readFileSync } from "node:fs";

import type { ContentHeading } from "../../src/lib/docs-model.ts";
import { slugifyHeading } from "../../src/lib/slug.ts";

/** One demo the page renders, in authored order. */
export type PageDemo = {
  /** Anchor id, unique inside the page. */
  id: string;
  title: string;
  /** File name inside the page's `demos/` directory. */
  file: string;
};

/** The editorial half of a page: what the build cannot derive from the repo layout. */
export type PageFrontmatter = {
  title: string;
  lede: string;
};

export type ComponentPageSource = PageFrontmatter & {
  headings: readonly ContentHeading[];
  demos: readonly PageDemo[];
};

const FRONTMATTER_FENCE = "---";
const CODE_FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{2,4})\s+(.+?)\s*#*\s*$/;
const DEMO_TAG = /<Demo\s([^>]*?)\/?>/g;
const ATTRIBUTE = /([A-Za-z][\w-]*)="([^"]*)"/g;
const DEMO_ATTRIBUTES = ["slug", "id", "title", "file"] as const;

type SplitPage = {
  frontmatter: string;
  body: string;
};

/** Splits the `---` fenced frontmatter block off the top of the file. */
function splitFrontmatter(source: string, file: string): SplitPage {
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

/** The editorial metadata of a page: title and lede, and nothing else. */
function parseFrontmatter(frontmatter: string, file: string): PageFrontmatter {
  const scalars = new Map<string, string>();
  const lines = frontmatter.split("\n");
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
    if (key !== "title" && key !== "lede") {
      throw new Error(`${file}: unknown frontmatter key "${key}" — a page declares title and lede`);
    }
    const rawValue = (match[2] ?? "").trim();
    if (rawValue === ">" || rawValue === "|") {
      const [value, next] = readBlockScalar(lines, index + 1, rawValue === ">");
      scalars.set(key, value);
      index = next;
      continue;
    }
    scalars.set(key, unquote(rawValue));
    index += 1;
  }
  const title = scalars.get("title") ?? "";
  const lede = scalars.get("lede") ?? "";
  if (title === "") {
    throw new Error(`${file}: frontmatter key "title" is required`);
  }
  if (lede === "") {
    throw new Error(`${file}: frontmatter key "lede" is required`);
  }
  return { title, lede };
}

/**
 * The body with fenced code blocks blanked out, so a leading `#` or a `<Demo …>` shown
 * as example source is read as source rather than as structure.
 */
function withoutCodeFences(body: string): readonly string[] {
  let inFence = false;
  return body.split("\n").map((line) => {
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

/** Headings the page's prose contributes to the on-page TOC. */
function readHeadings(lines: readonly string[]): readonly ContentHeading[] {
  const headings: ContentHeading[] = [];
  for (const line of lines) {
    const match = HEADING.exec(line);
    const hashes = match?.[1];
    const title = match?.[2];
    if (hashes !== undefined && title !== undefined) {
      headings.push({ id: slugifyHeading(title), title, depth: hashes.length });
    }
  }
  return headings;
}

/**
 * The demos the page renders, read off its own `<Demo …>` elements.
 *
 * The element the page renders *is* the declaration: id, title and demo file are named
 * once, in the markup the reader sees, so a frame on the page and a row in the markdown
 * endpoint can never disagree.
 */
function readDemos(lines: readonly string[], slug: string, file: string): readonly PageDemo[] {
  const demos: PageDemo[] = [];
  for (const tag of lines.join("\n").matchAll(DEMO_TAG)) {
    const attributes = new Map<string, string>();
    for (const attribute of (tag[1] ?? "").matchAll(ATTRIBUTE)) {
      attributes.set(attribute[1] ?? "", attribute[2] ?? "");
    }
    for (const required of DEMO_ATTRIBUTES) {
      if ((attributes.get(required) ?? "") === "") {
        throw new Error(`${file}: a <Demo> element is missing its "${required}" attribute`);
      }
    }
    if (attributes.get("slug") !== slug) {
      throw new Error(`${file}: a <Demo> names slug "${attributes.get("slug") ?? ""}" on the "${slug}" page`);
    }
    demos.push({
      id: attributes.get("id") ?? "",
      title: attributes.get("title") ?? "",
      file: attributes.get("file") ?? "",
    });
  }
  return demos;
}

/** Reads one authored `page.mdx`, given its text. `label` names the file in failures. */
export function parseComponentPage(source: string, slug: string, label: string): ComponentPageSource {
  const split = splitFrontmatter(source, label);
  const lines = withoutCodeFences(split.body);
  return {
    ...parseFrontmatter(split.frontmatter, label),
    headings: readHeadings(lines),
    demos: readDemos(lines, slug, label),
  };
}

/** Reads one authored `page.mdx` from disk as generation input. */
export function readComponentPage(pageFile: string, slug: string, label: string): ComponentPageSource {
  return parseComponentPage(readFileSync(pageFile, "utf8"), slug, label);
}
