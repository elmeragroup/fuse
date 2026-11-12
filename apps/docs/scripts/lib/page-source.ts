/**
 * Reading an authored component page.
 *
 * A `page.mdx` is compiled by `@next/mdx` for the browser; this is the same file read as
 * *data* by the docs generation pass, which needs three things a page declares and
 * nothing else does: its lede, the headings its prose contributes to the on-page TOC, and
 * the demos it renders. There is no separate registry to drift from — the page the site
 * serves is the page the generator reads.
 *
 * Deliberately a small line-oriented reader rather than an MDX/YAML parse: the schema is
 * closed (lede), so an unknown key is a build failure instead of silently ignored input,
 * and the generator stays free of the bundler's MDX plumbing.
 */

import { readFileSync } from "node:fs";

import type { ContentHeading, PageSection } from "../../src/lib/docs-model.ts";
import { slugifyHeading } from "../../src/lib/slug.ts";

/** One demo the page renders, in authored order. */
export type PageDemo = {
  /** Anchor id, unique inside the page. */
  id: string;
  title: string;
  /** File name inside the page's `demos/` directory. */
  file: string;
  /** The level of the demo's heading: 2 by default, 3 for an example under `## Examples`. */
  depth: 2 | 3;
};

/** One authored component page read as data. */
export type ComponentPageSource = {
  /** The editorial half of the page: the one-paragraph description under the H1. */
  lede: string;
  /**
   * The page's intro, the markdown of the `<Prose>` blocks before its first demo, or `""` when the
   * page opens with a demo. The markdown endpoint prints it under the lede.
   */
  intro: string;
  /** The headings the page's prose contributes to the on-page TOC. */
  headings: readonly ContentHeading[];
  /** The demos the page renders, in authored order. */
  demos: readonly PageDemo[];
  /** The headings and demos together, in page order. */
  sections: readonly PageSection[];
  /**
   * The file of the page's untitled default stage, `<DefaultDemo file="…">`, or `null` when the
   * page has none. It has no heading, so it stays out of the outline and the markdown.
   */
  defaultDemo: string | null;
  /**
   * The code of the fence under the page's `## Usage` heading, or `null` when the page has no
   * Usage section. The markdown endpoint prints it as the page's Usage section.
   */
  usage: string | null;
};

const FRONTMATTER_FENCE = "---";
const CODE_FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{2,4})\s+(.+?)\s*#*\s*$/;
const DEMO_TAG = /<Demo\s([^>]*?)\/?>/g;
const DEFAULT_DEMO_TAG = /<DefaultDemo\s([^>]*?)\/?>/g;
const ATTRIBUTE = /([A-Za-z][\w-]*)="([^"]*)"/g;
const LEVEL_ATTRIBUTE = /\blevel=\{(\d+)\}/;
const USAGE_FENCE = /^## Usage\s*$[\s\S]*?^\s*(?:```|~~~)[^\n]*\n([\s\S]*?)^\s*(?:```|~~~)\s*$/mu;
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

/** The page's lede — the only editorial metadata a page declares — or a failure. */
function parseFrontmatter(frontmatter: string, file: string): string {
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

/** The string attributes of one element's opening tag. */
function readAttributes(tag: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  for (const attribute of tag.matchAll(ATTRIBUTE)) {
    attributes.set(attribute[1] ?? "", attribute[2] ?? "");
  }
  return attributes;
}

/** A demo's heading level: `level={3}` for an example, 2 when the tag leaves it out. */
function readDepth(tag: string, file: string): 2 | 3 {
  const level = LEVEL_ATTRIBUTE.exec(tag)?.[1];
  if (level === undefined || level === "2") return 2;
  if (level === "3") return 3;
  throw new Error(`${file}: a <Demo> heading level must be 2 or 3, not ${level}`);
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
    const attributes = readAttributes(tag[1] ?? "");
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
      depth: readDepth(tag[1] ?? "", file),
    });
  }
  return demos;
}

/**
 * The headings and demos in page order. Each reader keeps its own order, so sorting the two by
 * where they start in the body restores the page's.
 */
function readSections(lines: readonly string[], slug: string, file: string): readonly PageSection[] {
  const sections: { readonly at: number; readonly section: PageSection }[] = [];
  let at = 0;
  for (const line of lines) {
    for (const heading of readHeadings([line])) {
      sections.push({ at, section: { kind: "heading", ...heading } });
    }
    at += line.length + 1;
  }
  const text = lines.join("\n");
  const demos = readDemos(lines, slug, file);
  for (const [index, tag] of [...text.matchAll(DEMO_TAG)].entries()) {
    const demo = demos[index];
    if (demo === undefined) continue;
    sections.push({
      at: tag.index,
      section: { kind: "demo", id: demo.id, title: demo.title, depth: demo.depth },
    });
  }
  const ordered = sections.toSorted((left, right) => left.at - right.at).map(({ section }) => section);
  const firstHeading = ordered.findIndex((section) => section.kind === "heading" && section.depth === 2);
  const orphan = ordered.find(
    (section, index) =>
      section.kind === "demo" && section.depth === 3 && (firstHeading === -1 || index < firstHeading)
  );
  if (orphan !== undefined) {
    throw new Error(
      `${file}: the level-3 demo "${orphan.id}" needs a "##" heading before it, such as "## Examples"`
    );
  }
  return ordered;
}

/** The file of the page's `<DefaultDemo>`, or `null`; a page renders at most one. */
function readDefaultDemo(lines: readonly string[], slug: string, file: string): string | null {
  const tags = [...lines.join("\n").matchAll(DEFAULT_DEMO_TAG)];
  if (tags.length > 1) {
    throw new Error(`${file}: a page renders at most one <DefaultDemo>`);
  }
  const tag = tags[0];
  if (tag === undefined) return null;
  const attributes = readAttributes(tag[1] ?? "");
  const demoFile = attributes.get("file") ?? "";
  if (demoFile === "") {
    throw new Error(`${file}: the <DefaultDemo> element is missing its "file" attribute`);
  }
  if (attributes.get("slug") !== slug) {
    throw new Error(
      `${file}: the <DefaultDemo> names slug "${attributes.get("slug") ?? ""}" on the "${slug}" page`
    );
  }
  return demoFile;
}

const PROSE_BLOCK = /<Prose>\n([\s\S]*?)\n<\/Prose>/gu;

/** The markdown of the `<Prose>` blocks that come before the first `<Demo>`. */
function readIntro(body: string): string {
  const firstDemo = body.search(/<Demo\s/u);
  const head = firstDemo === -1 ? body : body.slice(0, firstDemo);
  return [...head.matchAll(PROSE_BLOCK)]
    .map((match) => (match[1] ?? "").trim())
    .filter((block) => block !== "")
    .join("\n\n");
}

/** Reads one authored `page.mdx`, given its text. `label` names the file in failures. */
export function parseComponentPage(source: string, slug: string, label: string): ComponentPageSource {
  const split = splitFrontmatter(source, label);
  const lines = withoutCodeFences(split.body);
  return {
    lede: parseFrontmatter(split.frontmatter, label),
    intro: readIntro(split.body),
    headings: readHeadings(lines),
    demos: readDemos(lines, slug, label),
    sections: readSections(lines, slug, label),
    defaultDemo: readDefaultDemo(lines, slug, label),
    usage: USAGE_FENCE.exec(split.body)?.[1]?.trimEnd() ?? null,
  };
}

/** Reads one authored `page.mdx` from disk as generation input. */
export function readComponentPage(pageFile: string, slug: string, label: string): ComponentPageSource {
  return parseComponentPage(readFileSync(pageFile, "utf8"), slug, label);
}
