/**
 * Reading an authored component page.
 *
 * A `page.mdx` is compiled by `@next/mdx` for the browser; this is the same file read as
 * *data* by the docs generation pass, which needs what a page declares and nothing else
 * does: its lede, the headings and demos of its on-page TOC in page order, and, on a page in
 * the Usage shape, its default stage and Usage code. There is no separate registry to drift from — the page the site
 * serves is the page the generator reads.
 *
 * Deliberately a small line-oriented reader rather than an MDX/YAML parse: the schema is
 * closed (lede), so an unknown key is a build failure instead of silently ignored input,
 * and the generator stays free of the bundler's MDX plumbing.
 */

import { readFileSync } from "node:fs";

import type { PageSection } from "../../src/lib/docs-model.ts";
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
   * The page's intro, the markdown of the `<Prose>` blocks before its first demo or default stage,
   * or `""` when the page opens with one. The markdown endpoint prints it under the lede.
   */
  intro: string;
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
   * The code of the one fence under the page's `## Usage` heading, or `null` when the page is not
   * in the Usage shape. The markdown endpoint prints it under the Usage heading.
   */
  usage: string | null;
  /**
   * The markdown of the page's `## Composition` section, the body of its one `<Prose>` block, or
   * `null` when the page has none. The markdown endpoint prints it under the Composition heading.
   */
  composition: string | null;
};

/**
 * The pages that may hold a `## Composition` section between Usage and Examples, each with the
 * reason it needs one. A page belongs here only when its component cannot be used correctly
 * without knowing how its parts or sibling components fit together. A rule about one prop goes
 * in that prop's JSDoc instead.
 */
export const COMPOSITION_PAGES: ReadonlyMap<string, string> = new Map([
  ["form", "Form only routes errors through the Field parts and field components inside it."],
  ["command", "Command's parts change role with the Root's search or page stack and with Content."],
  [
    "field",
    "Field wires only the parts inside its Root, and the field components render those parts themselves.",
  ],
]);

const FRONTMATTER_FENCE = "---";
const CODE_FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{2,4})\s+(.+?)\s*#*\s*$/;
const DEMO_TAG = /<Demo\s([^>]*?)\/?>/g;
const DEFAULT_DEMO_TAG = /<DefaultDemo\s([^>]*?)\/?>/g;
const ATTRIBUTE = /([A-Za-z][\w-]*)="([^"]*)"/g;
const LEVEL_ATTRIBUTE = /\blevel=\{(\d+)\}/;
const FENCED_BLOCK = /^\s*(?:```|~~~)[^\n]*\n([\s\S]*?)^\s*(?:```|~~~)\s*$/gmu;
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
 * as example source is read as source rather than as structure. Each blanked line keeps its
 * length, so an offset into the lines joined is the same offset into the body.
 */
function withoutCodeFences(body: string): readonly string[] {
  let inFence = false;
  return body.split("\n").map((line) => {
    const blank = " ".repeat(line.length);
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
      return blank;
    }
    return inFence ? blank : line;
  });
}

/** A heading of the page as a TOC section. */
type HeadingSection = Extract<PageSection, { readonly kind: "heading" }>;

/** One heading of the page, as a TOC section. */
function readHeading(line: string): HeadingSection | null {
  const match = HEADING.exec(line);
  const hashes = match?.[1];
  const title = match?.[2];
  if (hashes === undefined || title === undefined) return null;
  return { kind: "heading", id: slugifyHeading(title), title, depth: hashes.length };
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

/** One demo the page renders, read off its own `<Demo …>` element. */
function readDemo(tag: string, slug: string, file: string): PageDemo {
  const attributes = readAttributes(tag);
  for (const required of DEMO_ATTRIBUTES) {
    if ((attributes.get(required) ?? "") === "") {
      throw new Error(`${file}: a <Demo> element is missing its "${required}" attribute`);
    }
  }
  if (attributes.get("slug") !== slug) {
    throw new Error(`${file}: a <Demo> names slug "${attributes.get("slug") ?? ""}" on the "${slug}" page`);
  }
  return {
    id: attributes.get("id") ?? "",
    title: attributes.get("title") ?? "",
    file: attributes.get("file") ?? "",
    depth: readDepth(tag, file),
  };
}

/** One structural item of the page: a heading or a demo, with the body offset it starts at. */
type PageItem = { readonly at: number } & (
  | { readonly kind: "heading"; readonly section: HeadingSection }
  | { readonly kind: "demo"; readonly demo: PageDemo }
);

/**
 * The page's headings and demos in page order, in one pass. The element the page renders *is*
 * the declaration: id, title and demo file are named once, in the markup the reader sees, so a
 * frame on the page and a row in the markdown endpoint can never disagree.
 */
function readItems(lines: readonly string[], slug: string, file: string): readonly PageItem[] {
  const items: PageItem[] = [];
  let at = 0;
  for (const line of lines) {
    const section = readHeading(line);
    if (section !== null) items.push({ at, kind: "heading", section });
    at += line.length + 1;
  }
  for (const tag of lines.join("\n").matchAll(DEMO_TAG)) {
    items.push({ at: tag.index, kind: "demo", demo: readDemo(tag[1] ?? "", slug, file) });
  }
  return items.toSorted((left, right) => left.at - right.at);
}

/**
 * An item as a TOC section. A heading inside an intro block is marked, so the markdown endpoint,
 * which prints the intro whole, does not print it a second time.
 */
function sectionOf(item: PageItem, intro: readonly IntroBlock[]): PageSection {
  if (item.kind === "heading") {
    const inIntro = intro.some((block) => item.at >= block.start && item.at < block.end);
    return inIntro ? { ...item.section, intro: true } : item.section;
  }
  return { kind: "demo", id: item.demo.id, title: item.demo.title, depth: item.demo.depth };
}

/** Fails on a level-3 demo that no `##` heading precedes, which the TOC could not nest. */
function assertNestable(sections: readonly PageSection[], file: string): void {
  const firstHeading = sections.findIndex((section) => section.kind === "heading" && section.depth === 2);
  const orphan = sections.find(
    (section, index) =>
      section.kind === "demo" && section.depth === 3 && (firstHeading === -1 || index < firstHeading)
  );
  if (orphan !== undefined) {
    throw new Error(
      `${file}: the level-3 demo "${orphan.id}" needs a "##" heading before it, such as "## Examples"`
    );
  }
}

/** What a page in the Usage shape declares beyond its sections. */
type UsageContent = {
  /** The code of the one fence under `## Usage`. */
  readonly usage: string;
  /** The markdown of the `## Composition` section, or `null` when the page has none. */
  readonly composition: string | null;
};

const USAGE_HEADINGS = "## Usage\n## Examples";
const COMPOSITION_HEADINGS = "## Usage\n## Composition\n## Examples";
const PROSE_TAG = /<Prose[\s/>]/gu;
const COMPOSITION_BODY = /^<Prose>\n([\s\S]*?)\n<\/Prose>$/u;

/**
 * Reads a page in the Usage shape, which `AGENTS.md` states: the intro, the untitled
 * `<DefaultDemo>`, `## Usage` with exactly one code block, an optional `## Composition` on a page
 * in {@link COMPOSITION_PAGES}, `## Examples` with only `level={3}` demos, then the API reference
 * and tokens. The only `<Prose>` is the one block that makes up the Composition section, with at
 * most one code block. Fails naming the first rule the page breaks.
 *
 * @param body - The page body, for the code and the Composition markdown.
 * @param lines - The body with code blocks blanked, for its structure.
 * @param items - The page's headings and demos, in page order.
 * @param slug - The page's slug, checked against {@link COMPOSITION_PAGES}.
 * @param file - The page's name in failures.
 * @returns The Usage code and the Composition markdown.
 */
function readUsagePage(
  body: string,
  lines: readonly string[],
  items: readonly PageItem[],
  slug: string,
  file: string
): UsageContent {
  const fail = (rule: string): never => {
    throw new Error(`${file}: a page with <DefaultDemo> follows the Usage shape, but ${rule}`);
  };
  // The structure outside code blocks; offsets into it are offsets into `body`.
  const structure = lines.join("\n");
  const headingItems = items.flatMap((item) => (item.kind === "heading" ? [item] : []));
  const titles = headingItems.map(({ section }) => `${"#".repeat(section.depth)} ${section.title}`);
  const hasComposition = titles.join("\n") === COMPOSITION_HEADINGS;
  if (!hasComposition && titles.join("\n") !== USAGE_HEADINGS) {
    fail(
      `its headings are ${titles.length === 0 ? "none" : titles.join(", ")}, not "## Usage", an optional "## Composition", then "## Examples"`
    );
  }
  if (hasComposition && !COMPOSITION_PAGES.has(slug)) {
    fail(
      `it has "## Composition" and "${slug}" is not in COMPOSITION_PAGES; put consumer rules in the JSDoc of their prop`
    );
  }
  const usageAt = headingItems[0]?.at ?? 0;
  const compositionAt = hasComposition ? (headingItems[1]?.at ?? 0) : null;
  const examplesAt = headingItems.at(-1)?.at ?? 0;
  const prose = [...structure.matchAll(PROSE_TAG)];
  const strayProse = prose.some(
    (tag) => compositionAt === null || tag.index < compositionAt || tag.index > examplesAt
  );
  if (strayProse) {
    fail('it renders <Prose> outside "## Composition"; put consumer rules in the JSDoc of their prop');
  }
  if (prose.length > 1) fail(`"## Composition" renders ${prose.length} <Prose> blocks, not one`);
  const apiAt = structure.search(/<ApiReference[\s/>]/u);
  // The page's parts in the order AGENTS.md states, each at its offset or -1 when missing.
  const parts = [
    { name: "<ComponentIntro>", at: structure.search(/<ComponentIntro[\s/>]/u) },
    { name: "<DefaultDemo>", at: structure.search(/<DefaultDemo[\s/>]/u) },
    { name: '"## Usage"', at: usageAt },
    { name: '"## Examples"', at: examplesAt },
    { name: "<ApiReference>", at: apiAt },
    { name: "<ComponentTokens>", at: structure.search(/<ComponentTokens[\s/>]/u) },
  ];
  const missing = parts.find((part) => part.at === -1);
  if (missing !== undefined) fail(`it renders no ${missing.name}`);
  for (const [index, part] of parts.entries()) {
    const previous = parts[index - 1];
    if (previous !== undefined && part.at < previous.at)
      fail(`its ${part.name} comes before ${previous.name}`);
  }
  for (const item of items) {
    if (item.kind !== "demo") continue;
    if (item.at < examplesAt || item.at > apiAt || item.demo.depth !== 3) {
      fail(`the demo "${item.demo.id}" is not a level={3} demo under "## Examples"`);
    }
  }
  const fences = [...body.slice(usageAt, compositionAt ?? examplesAt).matchAll(FENCED_BLOCK)];
  const [usage] = fences;
  if (fences.length !== 1 || usage === undefined) {
    return fail(`"## Usage" holds ${fences.length} code blocks, not one`);
  }
  return {
    usage: (usage[1] ?? "").trimEnd(),
    composition: compositionAt === null ? null : readComposition(body, compositionAt, examplesAt, fail),
  };
}

/**
 * The markdown of the `## Composition` section between `start` and `end`: the body of the one
 * `<Prose>` block that is the section's whole content, holding at most one code block.
 */
function readComposition(body: string, start: number, end: number, fail: (rule: string) => never): string {
  const section = body.slice(start, end).replace(/^.*\n/u, "").trim();
  const markdown = COMPOSITION_BODY.exec(section)?.[1]?.trim();
  if (markdown === undefined || markdown === "") {
    return fail('"## Composition" is not one <Prose> block of markdown');
  }
  const fences = [...markdown.matchAll(FENCED_BLOCK)].length;
  if (fences > 1) fail(`"## Composition" holds ${fences} code blocks, not one at most`);
  return markdown;
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

/** One `<Prose>` block before the first `<Demo>`: its body span and its markdown. */
type IntroBlock = { readonly start: number; readonly end: number; readonly markdown: string };

/** The `<Prose>` blocks before the first demo or default stage, which make up the page's intro. */
function readIntroBlocks(body: string): readonly IntroBlock[] {
  // `<DefaultDemo>` opens a page in the Usage shape, whose only `<Prose>` is its Composition.
  const firstDemo = body.search(/<(?:Default)?Demo\s/u);
  const head = firstDemo === -1 ? body : body.slice(0, firstDemo);
  return [...head.matchAll(PROSE_BLOCK)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    markdown: (match[1] ?? "").trim(),
  }));
}

/** Reads one authored `page.mdx`, given its text. `label` names the file in failures. */
export function parseComponentPage(source: string, slug: string, label: string): ComponentPageSource {
  const split = splitFrontmatter(source, label);
  const lines = withoutCodeFences(split.body);
  const items = readItems(lines, slug, label);
  const intro = readIntroBlocks(split.body);
  const sections = items.map((item) => sectionOf(item, intro));
  assertNestable(sections, label);
  const defaultDemo = readDefaultDemo(lines, slug, label);
  const content = defaultDemo === null ? null : readUsagePage(split.body, lines, items, slug, label);
  return {
    lede: parseFrontmatter(split.frontmatter, label),
    intro: intro
      .map((block) => block.markdown)
      .filter((markdown) => markdown !== "")
      .join("\n\n"),
    demos: items.flatMap((item) => (item.kind === "demo" ? [item.demo] : [])),
    sections,
    defaultDemo,
    usage: content?.usage ?? null,
    composition: content?.composition ?? null,
  };
}

/** Reads one authored `page.mdx` from disk as generation input. */
export function readComponentPage(pageFile: string, slug: string, label: string): ComponentPageSource {
  return parseComponentPage(readFileSync(pageFile, "utf8"), slug, label);
}
