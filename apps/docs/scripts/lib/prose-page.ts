/**
 * Reading an authored prose page, such as `/quick-start` or a handbook page, as catalog sections.
 *
 * A prose page is a `page.mdx` whose body is one `<DocsPage href="…">` element holding markdown.
 * `@next/mdx` compiles it for the browser, and this reader splits the same text into the sections
 * its markdown endpoint joins, so the page the site serves is the page the endpoint prints.
 *
 * The reader parses the page with the grammar the site compiles it with, MDX and GitHub's
 * extensions, so a code span or a fence that shows an element is code here as it is on the site.
 * The page writes each anchored heading as `<h2 id="…">` or `<h3 id="…">` on a line of its own.
 * MDX renders a literal heading element as written, so the hand-written id is the anchor, and this
 * reader takes the same id from the same element. Each section copies its stretch of the page's
 * text as written, indentation and blank lines included, and edits only the MDX in it. A heading
 * element becomes a markdown heading, a `<Demo>` becomes its heading and its demo's source, and a
 * library-data element becomes the markdown `page-data-markdown.ts` prints for it. An MDX comment
 * goes, or becomes a markdown comment where the blocks around it would otherwise join. Any other
 * element or `{expression}` fails the page, so the endpoint never drops what the page renders. So
 * does a reference-style link, because a section read alone would lose a definition that another
 * section holds. Last, each section's markdown, read as CommonMark and GitHub's extensions, must
 * parse to the same tree as the page shows, apart from a demo's source and a library-data element's
 * markdown, which the reader prints itself.
 */

import * as Result from "effect/Result";
import type { Nodes, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mdxFromMarkdown } from "mdast-util-mdx";
import type {
  MdxFlowExpression,
  MdxJsxAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx";
import { gfm } from "micromark-extension-gfm";
import { mdxjs } from "micromark-extension-mdxjs";

import type { CatalogSection } from "@elmeragroup/docs-catalog";

import { OVERVIEW_SECTION_ID } from "../../src/lib/anchors.ts";
import type { DocsRouteSection } from "../../src/lib/docs-route-files.ts";
import { DOCS_ROUTE_SECTIONS } from "../../src/lib/docs-route-files.ts";
import type { StaticPage } from "../../src/lib/pages.ts";
import { renderDemo } from "./markdown.ts";
import { readDemoDeclaration } from "./page-source.ts";

/** A prose page that cannot be read as sections, with the reason. */
export class ProsePageProblem extends Error {
  /** The tag of this failure. */
  readonly _tag = "ProsePageProblem" as const;

  /** The page's file, as failures name it. */
  readonly label: string;

  /** What the page breaks. */
  readonly reason: string;

  /**
   * @param label - The page's file, as failures name it.
   * @param reason - What the page breaks.
   */
  constructor(label: string, reason: string) {
    super(`${label}: ${reason}`);
    this.label = label;
    this.reason = reason;
  }
}

/** Where a demo of the page lives: its route section and slug, and its file in `demos/`. */
export type ProseDemoLocation = {
  /** The docs section of the page, such as `handbook`. */
  readonly section: DocsRouteSection;
  /** The page's slug inside its section. */
  readonly slug: string;
  /** The demo's file name inside the page's `demos/` directory. */
  readonly file: string;
};

/** A demo's file and source, as its section prints them. */
export type ProseDemo = {
  /** The repo-relative path of the demo file. */
  readonly sourcePath: string;
  /** The demo's source, normalized as the demo frame normalizes it. */
  readonly source: string;
};

/** What a prose page is read with. */
export type ProsePageInput = {
  /** The text of the page's `page.mdx`. */
  readonly source: string;
  /** The page's manifest entry, whose label and description `<DocsPage>` renders as its title and lede. */
  readonly page: Pick<StaticPage, "href" | "label" | "description">;
  /** The page's file, as failures name it. */
  readonly label: string;
  /** Reads one demo the page renders, or `null` when its file does not exist. */
  readonly readDemo: (location: ProseDemoLocation) => ProseDemo | null;
  /** The markdown of each library-data element the page may render, by element name. */
  readonly dataElements: ReadonlyMap<string, () => string>;
};

/** The parser options `@next/mdx` compiles a page with: MDX, and GitHub's extensions from `remark-gfm`. */
const MDX_GRAMMAR = {
  extensions: [mdxjs(), gfm()],
  mdastExtensions: [mdxFromMarkdown(), gfmFromMarkdown()],
};

const HEADING_ELEMENTS: ReadonlyMap<string, CatalogSection["depth"]> = new Map([
  ["h2", 2],
  ["h3", 3],
]);

/** An MDX element, which may stand for a block or sit inside a line of text. */
type MdxElement = MdxJsxFlowElement | MdxJsxTextElement;

/** One stretch of the page's text that the markdown prints differently, or drops when empty. */
type Edit = { readonly start: number; readonly end: number; readonly markdown: string };

/**
 * A parsed node as the parity check compares it: its kind, its text, code or link destination, and
 * its children. Positions play no part.
 */
type ParityNode = {
  readonly kind: string;
  readonly content: string;
  readonly children: readonly ParityNode[];
};

/**
 * One block of a section, in page order: page text with the edits its markdown makes and the nodes
 * the markdown must parse to, or an MDX comment the markdown drops.
 */
type Part =
  | { readonly _tag: "Block"; readonly edits: readonly Edit[]; readonly expected: readonly ParityNode[] }
  | { readonly _tag: "Comment"; readonly node: MdxFlowExpression };

/**
 * The page's title and lede as the lead section prints them, and the nodes they must parse to.
 * `<DocsPage>` renders both as plain text, so the nodes hold each one as literal text.
 */
type Lead = { readonly markdown: string; readonly expected: readonly ParityNode[] };

/**
 * A section being read. It prints the page's text from `start` to `end` with its parts' edits
 * applied, after the title and lede on the lead section.
 */
type OpenSection = {
  readonly id: string;
  readonly depth: CatalogSection["depth"];
  /** The node that opens the section, which a failure names: the first node on the lead section. */
  anchor: Nodes | null;
  /** The title and lede on the lead section, `null` on the others. */
  readonly lead: Lead | null;
  start: number | null;
  end: number;
  readonly parts: Part[];
};

/** How the markdown prints an MDX comment: gone, or as a markdown comment that keeps two blocks apart. */
type CommentPrint = "remove" | "separate";

/** The markdown comment that stands where removing an MDX comment would join two blocks. */
const SEPARATOR = "<!-- -->";

/** The grammar the markdown endpoint is read with: CommonMark and GitHub's extensions. */
const MARKDOWN_GRAMMAR = { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] };

/** The reader's context: the page's text, its inputs and how it fails. */
type Reader = {
  readonly input: ProsePageInput;
  readonly fail: (node: Nodes | null, reason: string) => never;
};

/**
 * Splits a prose page into catalog sections: the lead section, then one section per anchored
 * heading and per demo, in page order. The lead section holds the page's title and lede, which
 * `<DocsPage>` renders from the manifest, and any prose before the first heading. A second-level
 * heading or demo is depth 2, and a third-level heading under one is depth 3.
 *
 * @param input - The page's text, its manifest entry, its file name, the demo reader and the data elements.
 * @returns The sections in page order, or the first rule the page breaks.
 */
export function proseSections(
  input: ProsePageInput
): Result.Result<readonly CatalogSection[], ProsePageProblem> {
  const reader: Reader = {
    input,
    fail: (node, reason) => {
      const line = node?.position?.start.line;
      throw new ProsePageProblem(input.label, line === undefined ? reason : `line ${String(line)} ${reason}`);
    },
  };
  try {
    return Result.succeed(readSections(reader));
  } catch (error) {
    if (error instanceof ProsePageProblem) return Result.fail(error);
    throw error;
  }
}

function readSections(reader: Reader): readonly CatalogSection[] {
  const { input, fail } = reader;
  const { label, description } = input.page;
  const text = (content: string): ParityNode => ({ kind: "text", content, children: [] });
  let current: OpenSection = {
    id: OVERVIEW_SECTION_ID,
    depth: 2,
    anchor: null,
    lead: {
      markdown: `# ${label}\n\n${description}`,
      expected: [
        { kind: "heading", content: "", children: [text(label)] },
        { kind: "paragraph", content: "", children: [text(description)] },
      ],
    },
    start: null,
    end: 0,
    parts: [],
  };
  const sections = [current];
  for (const node of pageElement(reader).children) {
    const opened = isElement(node, "Demo") ? readDemoSection(reader, node) : readHeading(reader, node);
    if (opened !== null) {
      if (opened.depth === 3 && sections.length === 1) fail(node, "opens an <h3> before any <h2>");
      sections.push(opened);
      current = opened;
      continue;
    }
    current.anchor ??= node;
    current.start ??= lineStart(input.source, offset(node, "start"));
    current.end = offset(node, "end");
    current.parts.push(isComment(node) ? { _tag: "Comment", node } : readBlock(reader, node));
  }
  return sections.map((section) => ({
    id: section.id,
    depth: section.depth,
    markdown: printSection(reader, section),
  }));
}

/**
 * The page's one `<DocsPage>` element. Before and after it the page may hold only imports and
 * exports, and the element names the page's own href.
 */
function pageElement(reader: Reader): MdxJsxFlowElement {
  const { input, fail } = reader;
  let root;
  try {
    root = fromMarkdown(input.source, MDX_GRAMMAR);
  } catch (error) {
    return fail(null, `it is not valid MDX: ${error instanceof Error ? error.message : String(error)}`);
  }
  let page: MdxJsxFlowElement | null = null;
  for (const node of root.children) {
    if (node.type === "mdxjsEsm") continue;
    if (page !== null || !isElement(node, "DocsPage")) {
      return fail(node, "is outside <DocsPage>, where only imports and exports may stand");
    }
    page = node;
  }
  if (page === null) return fail(null, "it renders no <DocsPage>");
  const href = stringAttributes(reader, page).get("href") ?? "";
  if (href !== input.page.href) fail(page, `names <DocsPage> href "${href}" on the ${input.page.href} page`);
  return page;
}

/** The section an anchored heading opens, or `null` when the node is not one. */
function readHeading(reader: Reader, node: RootContent): OpenSection | null {
  const element = headingElement(node);
  if (element === null) return null;
  const depth = HEADING_ELEMENTS.get(element.name ?? "") ?? 2;
  const attributes = stringAttributes(reader, element);
  const id = attributes.get("id") ?? "";
  if (id === "" || attributes.size !== 1)
    reader.fail(node, `gives an <h${String(depth)}> attributes other than one id`);
  const first = element.children[0];
  const last = element.children.at(-1);
  if (first === undefined || last === undefined) reader.fail(node, "opens a heading with no title");
  const title = printSpan(
    reader.input.source,
    offset(first, "start"),
    offset(last, "end"),
    element.children.flatMap((child) => inlineEdits(reader, child))
  );
  const shown = parityNodes(element.children, (child) => dataElementNodes(reader, child));
  return openSection(id, depth, node, shown, `${"#".repeat(depth)} ${title}`, []);
}

/**
 * The `<h2>` or `<h3>` a line holds, when it holds nothing else. MDX reads a one-line element in a
 * paragraph of its own as inline, and renders the element without the paragraph around it.
 */
function headingElement(node: RootContent): MdxJsxTextElement | null {
  if (node.type !== "paragraph") return null;
  const [only, ...rest] = node.children;
  if (only?.type !== "mdxJsxTextElement" || rest.length > 0) return null;
  return HEADING_ELEMENTS.has(only.name ?? "") ? only : null;
}

/** A `<Demo>` as its own section: its heading at its level, its file and its whole source. */
function readDemoSection(reader: Reader, element: MdxJsxFlowElement): OpenSection {
  const { input, fail } = reader;
  const attributes = stringAttributes(reader, element, "level");
  const declaration = readDemoDeclaration(attributes);
  if (Result.isFailure(declaration)) return fail(element, declaration.failure);
  const { slug, id, title, file } = declaration.success;
  const section = attributes.get("section") ?? "";
  const routeSection = DOCS_ROUTE_SECTIONS.find((name) => name === section);
  if (routeSection === undefined || `/${section}/${slug}` !== input.page.href) {
    return fail(
      element,
      `names a <Demo> section "${section}" and slug "${slug}" on the ${input.page.href} page`
    );
  }
  const depth = demoDepth(reader, element, id);
  const demo =
    input.readDemo({ section: routeSection, slug, file }) ??
    fail(element, `names the demo file ${file}, which does not exist`);
  const shown = [{ kind: "text", content: title, children: [] }];
  // The first line is the demo's heading, and the lines under it its file and source.
  const lines = renderDemo({ title, ...demo }, depth);
  const body = markdownNodes(lines.slice(1).join("\n"));
  return openSection(id, depth, element, shown, lines.join("\n"), body);
}

/**
 * The level of a demo's heading: 2 when the element names none, or the number a `level={2}` or
 * `level={3}` names. `DemoFrame` reads only those numbers, so any other form fails the page.
 */
function demoDepth(reader: Reader, element: MdxJsxFlowElement, id: string): CatalogSection["depth"] {
  const attribute = element.attributes.find(
    (candidate): candidate is MdxJsxAttribute =>
      candidate.type === "mdxJsxAttribute" && candidate.name === "level"
  );
  if (attribute === undefined) return 2;
  const { value } = attribute;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- parsed-source I/O: an MDX attribute's value is a string or an expression node
  const expression = value === null || value === undefined || typeof value === "string" ? null : value.value;
  const depth = expression === null ? undefined : HEADING_ELEMENTS.get(`h${expression}`);
  return depth ?? reader.fail(element, `gives the <Demo> "${id}" a level other than level={2} or level={3}`);
}

/**
 * A section that opens at `node`, which its markdown prints as `markdown`: a heading, then for a
 * demo the source the reader prints under it, which parses to `body`. The heading must parse to the
 * title the page shows, `title`, so a title that markdown reads another way, such as one ending in
 * ` #`, fails the page.
 */
function openSection(
  id: string,
  depth: CatalogSection["depth"],
  node: RootContent,
  title: readonly ParityNode[],
  markdown: string,
  body: readonly ParityNode[]
): OpenSection {
  return {
    id,
    depth,
    anchor: node,
    lead: null,
    start: offset(node, "start"),
    end: offset(node, "end"),
    parts: [
      {
        _tag: "Block",
        edits: [replacement(node, markdown)],
        expected: [{ kind: "heading", content: "", children: title }, ...body],
      },
    ],
  };
}

/** One block of page text: a data element's markdown, or the block's text with its inline elements printed. */
function readBlock(reader: Reader, node: RootContent): Part {
  if (node.type === "mdxJsxFlowElement") {
    const markdown = dataElementMarkdown(reader, node);
    return { _tag: "Block", edits: [replacement(node, markdown)], expected: markdownNodes(markdown) };
  }
  const edits = inlineEdits(reader, node);
  // The nodes the block shows, read as MDX, with each library-data element inside it replaced by
  // the nodes its markdown parses to.
  const expected = parityNodes([node], (child) => dataElementNodes(reader, child));
  return { _tag: "Block", edits, expected };
}

/** The edit that prints `markdown` in place of a node's text. */
function replacement(node: Nodes, markdown: string): Edit {
  return { start: offset(node, "start"), end: offset(node, "end"), markdown };
}

/**
 * A section's markdown: the page's text over its span, as written, with each part's edits applied.
 * Each MDX comment goes, unless removing it would join the blocks on either side, as it joins two
 * lists. Then a markdown comment stands in its place. The section fails the page when its markdown
 * parses to another tree than the page shows, naming the first node that differs.
 */
function printSection(reader: Reader, section: OpenSection): string {
  const comments = section.parts.filter((part) => part._tag === "Comment");
  const prints = new Map<MdxFlowExpression, CommentPrint>(comments.map(({ node }) => [node, "separate"]));
  const attempt = () => {
    const markdown = sectionMarkdown(reader.input.source, section, prints);
    return {
      markdown,
      difference: firstDifference(expectedNodes(section, prints), markdownNodes(markdown)),
    };
  };
  for (const { node } of comments) {
    prints.set(node, "remove");
    if (attempt().difference !== null) prints.set(node, "separate");
  }
  const result = attempt();
  if (result.difference !== null) {
    reader.fail(
      section.anchor,
      `opens the section "${section.id}", whose markdown differs from the page at ${result.difference}`
    );
  }
  return result.markdown;
}

/** A section's markdown with each MDX comment printed as `prints` says. */
function sectionMarkdown(
  source: string,
  section: OpenSection,
  prints: ReadonlyMap<MdxFlowExpression, CommentPrint>
): string {
  const body =
    section.start === null
      ? ""
      : printSpan(
          source,
          section.start,
          section.end,
          section.parts.flatMap((part) =>
            part._tag === "Block" ? part.edits : [commentEdit(source, part.node, prints.get(part.node))]
          )
        ).trimEnd();
  if (section.lead === null) return body;
  const { markdown } = section.lead;
  return body === "" ? markdown : `${markdown}\n\n${body.replace(/^\n+/u, "")}`;
}

/** The nodes a section's markdown must parse to, with each MDX comment printed as `prints` says. */
function expectedNodes(
  section: OpenSection,
  prints: ReadonlyMap<MdxFlowExpression, CommentPrint>
): readonly ParityNode[] {
  return [
    ...(section.lead?.expected ?? []),
    ...section.parts.flatMap((part) => {
      if (part._tag === "Block") return part.expected;
      return prints.get(part.node) === "separate" ? markdownNodes(SEPARATOR) : [];
    }),
  ];
}

/**
 * The edit that prints an MDX comment. Removing it takes its whole line when the comment stands
 * alone on one, so no blank line is left where the comment was.
 */
function commentEdit(source: string, node: MdxFlowExpression, print: CommentPrint | undefined): Edit {
  const start = offset(node, "start");
  const end = offset(node, "end");
  if (print !== "remove") return { start, end, markdown: SEPARATOR };
  const from = lineStart(source, start);
  const rest = /^[ \t]*\n/u.exec(source.slice(end));
  return source.slice(from, start).trim() === "" && rest !== null
    ? { start: from, end: end + rest[0].length, markdown: "" }
    : { start, end, markdown: "" };
}

/** The nodes a markdown text parses to, read as the markdown endpoint is read. */
function markdownNodes(markdown: string): readonly ParityNode[] {
  return parityNodes(fromMarkdown(markdown, MARKDOWN_GRAMMAR).children, () => null);
}

/**
 * The nodes a library-data element inside a line prints, without the paragraph its markdown parses
 * to when it is one, or `null` for any other node.
 */
function dataElementNodes(reader: Reader, node: Nodes): readonly ParityNode[] | null {
  if (node.type !== "mdxJsxTextElement") return null;
  const nodes = markdownNodes(dataElementMarkdown(reader, node));
  const [only, ...rest] = nodes;
  return only?.kind === "paragraph" && rest.length === 0 ? only.children : nodes;
}

/**
 * Parsed nodes as the parity check compares them, each replaced where `replace` gives nodes for
 * it. Adjacent text joins, as the text around a replaced element joins the text it prints.
 */
function parityNodes(
  nodes: readonly Nodes[],
  replace: (node: Nodes) => readonly ParityNode[] | null
): readonly ParityNode[] {
  const result: ParityNode[] = [];
  for (const node of nodes) {
    for (const entry of replace(node) ?? [parityNodeOf(node, replace)]) {
      const previous = result.at(-1);
      if (previous?.kind === "text" && entry.kind === "text") {
        result[result.length - 1] = { ...previous, content: previous.content + entry.content };
      } else {
        result.push(entry);
      }
    }
  }
  return result;
}

/** One parsed node as the parity check compares it. A list's kind says whether it is ordered. */
function parityNodeOf(node: Nodes, replace: (node: Nodes) => readonly ParityNode[] | null): ParityNode {
  let content = "";
  if ("value" in node) content = node.value;
  else if ("url" in node) content = node.url;
  return {
    kind: node.type === "list" && node.ordered === true ? "ordered list" : node.type,
    content,
    children: "children" in node ? parityNodes(node.children, replace) : [],
  };
}

/**
 * Where two node trees first differ, as the path to that node and what each tree holds there, or
 * `null` when they are the same.
 */
function firstDifference(
  page: readonly ParityNode[],
  markdown: readonly ParityNode[],
  path: readonly string[] = []
): string | null {
  for (let index = 0; index < Math.max(page.length, markdown.length); index += 1) {
    const shown = page[index];
    const parsed = markdown[index];
    if (shown?.kind !== parsed?.kind || shown?.content !== parsed?.content) {
      const at = [...path, `the ${ordinal(index + 1)} node`].join(" > ");
      return `${at}: the page shows ${describeNode(shown)}, the markdown parses to ${describeNode(parsed)}`;
    }
    const inner =
      shown === undefined || parsed === undefined
        ? null
        : firstDifference(shown.children, parsed.children, [...path, shown.kind]);
    if (inner !== null) return inner;
  }
  return null;
}

/** A node as a failure names it: its kind, and the start of its text when it holds any. */
function describeNode(entry: ParityNode | undefined): string {
  if (entry === undefined) return "nothing";
  if (entry.content === "") return entry.kind;
  const content = entry.content.length > 60 ? `${entry.content.slice(0, 60)}…` : entry.content;
  return `${entry.kind} ${JSON.stringify(content)}`;
}

/** A position as English writes it, such as `1st` or `12th`. */
function ordinal(position: number): string {
  const teen = position % 100 >= 11 && position % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][position % 10] ?? "th");
  return `${String(position)}${suffix}`;
}

/** The offset where the line holding `at` starts. */
function lineStart(source: string, at: number): number {
  return source.lastIndexOf("\n", at - 1) + 1;
}

/** The page's text from `start` to `end`, with each edit, in page order, applied. */
function printSpan(source: string, start: number, end: number, edits: readonly Edit[]): string {
  let markdown = "";
  let at = start;
  for (const edit of edits) {
    markdown += source.slice(at, edit.start) + edit.markdown;
    at = edit.end;
  }
  return markdown + source.slice(at, end);
}

/** The data elements inside a node, in page order; any other MDX construct inside it fails the page. */
function inlineEdits(reader: Reader, node: Nodes): readonly Edit[] {
  switch (node.type) {
    case "mdxJsxTextElement":
      return [replacement(node, dataElementMarkdown(reader, node))];
    case "mdxJsxFlowElement":
      return reader.fail(
        node,
        `holds an element the markdown cannot print inside a block: <${node.name ?? ""}>`
      );
    case "mdxFlowExpression":
    case "mdxTextExpression":
      return reader.fail(node, "holds an expression the markdown cannot print");
    case "mdxjsEsm":
      return reader.fail(node, "holds an import or export inside <DocsPage>");
    case "heading":
      return reader.fail(node, 'is a markdown heading; write it as <h2 id="…"> or <h3 id="…">');
    case "linkReference":
    case "imageReference":
      return reader.fail(node, "is a reference-style link; write the link inline");
    case "definition":
      return reader.fail(node, "is a link definition; write the link inline");
    default:
      return "children" in node ? node.children.flatMap((child) => inlineEdits(reader, child)) : [];
  }
}

/** The markdown a library-data element prints, which fails the page for an element that has none. */
function dataElementMarkdown(reader: Reader, element: MdxElement): string {
  const name = element.name ?? "";
  const markdown = reader.input.dataElements.get(name);
  if (markdown !== undefined && element.children.length === 0) return markdown();
  if (/^[A-Z]/u.test(name) && element.children.length === 0) {
    return reader.fail(element, `renders <${name} />, which has no markdown`);
  }
  return reader.fail(element, `holds an element the markdown cannot print: <${name}>`);
}

/**
 * The element's string attributes. An attribute named `skip` stays out, for its caller to read, and
 * any other expression or a spread fails the page.
 */
function stringAttributes(reader: Reader, element: MdxElement, skip?: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  for (const attribute of element.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      reader.fail(element, `spreads an expression into <${element.name ?? ""}>`);
    }
    if (attribute.name === skip) continue;
    const { value } = attribute;
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- parsed-source I/O: an MDX attribute's value is a string or an expression node
    if (typeof value === "string") attributes.set(attribute.name, value);
    else {
      reader.fail(element, `gives <${element.name ?? ""}> a "${attribute.name}" the markdown cannot read`);
    }
  }
  return attributes;
}

/** Whether a node is the MDX element of this name. */
function isElement(node: RootContent, name: string): node is MdxJsxFlowElement {
  return node.type === "mdxJsxFlowElement" && node.name === name;
}

/** Whether a node is an expression that holds only a comment, such as `{/* prettier-ignore *\/}`. */
function isComment(node: RootContent): node is MdxFlowExpression {
  if (node.type !== "mdxFlowExpression") return false;
  const program = node.data?.estree;
  return program?.body.length === 0 && (program.comments ?? []).length > 0;
}

/** Where a parsed node starts or ends in the page's text. */
function offset(node: Nodes, edge: "start" | "end"): number {
  const value = node.position?.[edge].offset;
  if (value === undefined) throw new Error(`the MDX parser left a ${node.type} without a position`);
  return value;
}
