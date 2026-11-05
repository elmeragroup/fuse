import { Option } from "effect";
import type { Nodes, PhrasingContent, Root, RootContent } from "mdast";

import * as ChangelogSection from "./changelog-section.ts";
import { textOf } from "./markdown-text.ts";
import type { Inline, MrkdwnLine } from "./mrkdwn.ts";
import type { Changelog, ShortenedBy, VersionNotes } from "./render-protocol.ts";
import { sectionPacker } from "./section-packer.ts";
import type { PackedSections } from "./section-packer.ts";

/**
 * Release notes: one version's section of a Changesets changelog, converted to Slack mrkdwn
 * section texts for a stable announcement.
 *
 * `ChangelogSection` parses the changelog and selects the version's section. Its nodes are
 * rendered here to units (text, whitespace, code, link, emphasis span), which `section-packer.ts`
 * packs into sections as they are rendered, so rendering stops once four sections are full.
 * GitHub's Markdown extensions other than strikethrough are left out: its autolink literals cost
 * time quadratic in a paragraph holding an unclosed `[` (1.8 s for 40 KB, 30 s for 120 KB), so
 * bare `http(s)://` URLs are linked here by a linear scan instead, and tables, footnotes and task
 * lists, which changelogs do not use, read as text.
 *
 * micromark's cost grows faster than its input on hostile nesting, so the announcement runs this
 * module in a child process under a time limit (`isolated-notes.ts`), and nothing here is bounded
 * by time.
 */

/**
 * How deep blocks (quotes and lists) and spans (emphasis, links) are rendered as nested. The
 * renderer recurses once per level, so a bound keeps any input's depth from exhausting the call
 * stack; a changelog nests a few levels, and mrkdwn shows no nested quotes at all. Deeper content
 * is shown as its plain text, and the notes are reported shortened.
 */
const MAX_NESTING = 32;

/**
 * Reads the notes under a changelog's depth-2 heading for `version` and converts them to Slack
 * mrkdwn sections.
 *
 * @param changelog - The part of the changelog that was read.
 * @param version - The version whose notes to read, as its heading names it.
 * @returns The sections and how much of the notes they hold, or why there are no notes to show.
 */
export function versionNotes(changelog: Changelog, version: string): VersionNotes {
  const text = ChangelogSection.sourceOf(changelog);
  const tree = ChangelogSection.parse(text);
  if (Option.isNone(tree)) return { _tag: "Unreadable", cause: "parse-failed" };
  const section = ChangelogSection.select(tree.value, version, changelog);
  if (section._tag !== "Found") return section;
  const document: SourceDocument = {
    text,
    definitions: definitionsOf(tree.value),
    flattened: { value: false },
  };
  // The depth bound keeps rendering within the stack; any failure still left is unreadable notes.
  const rendered = renderSections(section.nodes, document);
  if (Option.isNone(rendered)) return { _tag: "Unreadable", cause: "render-failed" };
  const losses = Option.orElse(rendered.value.shortenedBy, (): Option.Option<ShortenedBy> =>
    document.flattened.value ? Option.some("nesting") : Option.none()
  );
  return {
    _tag: "Notes",
    sections: rendered.value.sections,
    extent: ChangelogSection.extentOf(section, losses),
  };
}

/** The parsed source of a changelog: its text, and its link reference definitions. */
type SourceDocument = {
  readonly text: string;
  /** Each definition's URL, by its normalized label; CommonMark keeps the first of a label. */
  readonly definitions: ReadonlyMap<string, string>;
  /** Whether a node past `MAX_NESTING` was shown flattened, set as the notes render. */
  readonly flattened: { value: boolean };
};

/**
 * The link reference definitions anywhere in a changelog. mdast gives each its label normalized
 * as CommonMark matches labels (case-folded, inner whitespace collapsed) as `identifier`, and a
 * reference carries the same normalization, so the two compare directly.
 */
function definitionsOf(tree: Root): ReadonlyMap<string, string> {
  const definitions = new Map<string, string>();
  // An explicit stack, in document order, so a tree of any depth is walked.
  const pending: Nodes[] = [tree];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.type === "definition" && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
    if ("children" in node) for (const child of [...node.children].reverse()) pending.push(child);
  }
  return definitions;
}

/** What the block renderer gives the packer: a line, a blank line, or a code block's edge. */
type Item =
  | { readonly kind: "line"; readonly units: MrkdwnLine; readonly code: boolean }
  | { readonly kind: "open" }
  | { readonly kind: "close" };

/**
 * The text before a block's lines: `first` before its first line, `rest` before the others,
 * as a list item puts its bullet before the first line and indents the rest.
 */
type Prefix = { readonly first: string; readonly rest: string };

/**
 * Renders and packs a section's top-level nodes, rendering no more than the sections hold, or
 * none when rendering throws.
 */
const renderSections = Option.liftThrowable(packBlocks);

/** Renders and packs a section's top-level nodes, rendering no more than the sections hold. */
function packBlocks(nodes: readonly RootContent[], source: SourceDocument): PackedSections {
  const packer = sectionPacker();
  for (const item of blockItems(nodes, { first: "", rest: "" }, source, 0)) {
    if (packer.full()) break;
    if (item.kind === "open") packer.openFence();
    else if (item.kind === "close") packer.closeFence();
    else packer.addLine(item.units, { code: item.code });
  }
  return packer.finish();
}

/**
 * Renders sibling blocks in order. A blank line goes between two blocks where the source has one,
 * written as the container's indent, as Changesets indents the blank lines of a list item.
 */
function* blockItems(
  nodes: readonly RootContent[],
  prefix: Prefix,
  source: SourceDocument,
  depth: number
): Generator<Item, void, undefined> {
  for (const { node, separator, lead } of siblings(nodes, prefix)) {
    yield* separator;
    yield* blockItem(node, { first: lead, rest: prefix.rest }, source, depth);
  }
}

/** A sibling block, with the blank line before it, if any, and the prefix of its first line. */
type Sibling<Node> = { readonly node: Node; readonly separator: readonly Item[]; readonly lead: string };

/**
 * Sibling nodes, each with what goes before it: a blank line written as the container's indent
 * where the source has one, and the prefix its first line takes, `first` for the first sibling and
 * `rest` for the others.
 */
function* siblings<Node extends Nodes>(
  nodes: readonly Node[],
  prefix: Prefix
): Generator<Sibling<Node>, void, undefined> {
  let previous: Node | undefined;
  for (const node of nodes) {
    const separated = previous !== undefined && startLine(node) > endLine(previous) + 1;
    yield {
      node,
      separator: separated ? [{ kind: "line", units: prefixUnits(prefix.rest), code: false }] : [],
      lead: previous === undefined ? prefix.first : prefix.rest,
    };
    previous = node;
  }
}

function startLine(node: Nodes): number {
  return node.position?.start.line ?? 0;
}

function endLine(node: Nodes): number {
  return node.position?.end.line ?? 0;
}

/** Renders one block: paragraphs and headings as lines, lists, quotes, code and tables. */
function* blockItem(
  node: RootContent,
  prefix: Prefix,
  source: SourceDocument,
  depth: number
): Generator<Item, void, undefined> {
  if ((node.type === "list" || node.type === "blockquote") && depth >= MAX_NESTING) {
    // Too deep to nest: the container's text, as one plain line.
    source.flattened.value = true;
    yield {
      kind: "line",
      units: [...prefixUnits(prefix.first), ...textUnits(textOf(node))],
      code: false,
    };
    return;
  }
  switch (node.type) {
    case "paragraph": {
      const lines = phrasingLines(node.children, source, { heading: false });
      for (const [index, line] of lines.entries()) {
        yield {
          kind: "line",
          units: [...prefixUnits(index === 0 ? prefix.first : prefix.rest), ...line],
          code: false,
        };
      }
      return;
    }
    case "heading": {
      const text = phrasingLines(node.children, source, { heading: true }).flatMap((line, index) =>
        index === 0 ? line : [{ kind: "space", text: " " } as const, ...line]
      );
      yield {
        kind: "line",
        units: [...prefixUnits(prefix.first), { kind: "span", mark: "*", children: text }],
        code: false,
      };
      return;
    }
    case "list": {
      let index = 0;
      for (const { node: item, separator, lead } of siblings(node.children, prefix)) {
        yield* separator;
        const marker = node.ordered === true ? `${String((node.start ?? 1) + index)}.` : "•";
        const itemPrefix = {
          first: `${lead}${marker} `,
          rest: `${prefix.rest}${" ".repeat(marker.length + 1)}`,
        };
        if (item.children.length === 0)
          yield { kind: "line", units: prefixUnits(itemPrefix.first.trimEnd()), code: false };
        else yield* blockItems(item.children, itemPrefix, source, depth + 1);
        index += 1;
      }
      return;
    }
    case "blockquote":
      yield* blockItems(
        node.children,
        { first: `${prefix.first}> `, rest: `${prefix.rest}> ` },
        source,
        depth + 1
      );
      return;
    case "code": {
      // A code block that leads a list item keeps the bullet on a line of its own.
      if (prefix.first !== prefix.rest)
        yield { kind: "line", units: prefixUnits(prefix.first.trimEnd()), code: false };
      yield { kind: "open" };
      for (const line of node.value.split("\n")) {
        // A blank code line keeps the container's indent, as Changesets writes it in a list item.
        yield { kind: "line", units: [...prefixUnits(prefix.rest), ...plainUnits(line)], code: true };
      }
      yield { kind: "close" };
      return;
    }
    case "definition":
      // A link reference definition renders nothing; the links that use it carry its URL.
      return;
    default: {
      // HTML, thematic breaks and anything else show as their source text.
      const text = sourceText(node, source);
      for (const [index, line] of text.split("\n").entries()) {
        yield {
          kind: "line",
          units: [...prefixUnits(index === 0 ? prefix.first : prefix.rest), ...textUnits(line)],
          code: false,
        };
      }
    }
  }
}

function sourceText(node: Nodes, source: SourceDocument): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? textOf(node) : source.text.slice(start, end);
}

/**
 * A prefix as units: indentation as whitespace, markers as finished mrkdwn. A prefix is built of
 * spaces, bullets, list numbers and quote markers, never a tab.
 */
function prefixUnits(prefix: string): Inline[] {
  return wordUnits(prefix).map((unit) => (unit.kind === "text" ? { kind: "raw", text: unit.text } : unit));
}

/**
 * Prose as words and whitespace, escaped when rendered. A backtick in prose, such as an escaped
 * one or one without a partner, would pair with another into a code span Slack has no way to
 * escape, so it is shown as U+02CB (ˋ), as in a code span.
 */
function textUnits(text: string): Inline[] {
  return wordUnits(text.replaceAll("`", "\u02CB"));
}

/** Text as words and whitespace, escaped when rendered. */
function wordUnits(text: string): Inline[] {
  const units: Inline[] = [];
  let start = 0;
  while (start < text.length) {
    const space = isSpace(text.charAt(start));
    let end = start + 1;
    while (end < text.length && isSpace(text.charAt(end)) === space) end += 1;
    units.push({ kind: space ? "space" : "text", text: text.slice(start, end) });
    start = end;
  }
  return units;
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t";
}

/**
 * A line of code inside a fence. Slack ends a code block at the next three backticks wherever
 * they stand, so a zero-width space goes between any two adjacent backticks of the code, as in a
 * Markdown example's own fences.
 */
function plainUnits(line: string): Inline[] {
  return wordUnits(line.replaceAll("``", "`\u200B`"));
}

/** How phrasing is rendered: in a heading, which is already bold, bold renders as plain. */
type PhrasingOptions = { readonly heading: boolean };

/** A placeholder for a line break between phrasing units, before they are split into lines. */
type Break = { readonly kind: "break" };

/** Renders phrasing nodes and splits them into lines at soft and hard line breaks. */
function phrasingLines(
  nodes: readonly PhrasingContent[],
  source: SourceDocument,
  options: PhrasingOptions
): Inline[][] {
  const lines: Inline[][] = [[]];
  for (const unit of phrasingUnits(nodes, source, options, { breaks: true, links: true, depth: 0 })) {
    if (unit.kind === "break") lines.push([]);
    else lines.at(-1)?.push(unit);
  }
  return lines;
}

/**
 * Where phrasing is rendered: whether a line break starts a new line, which mrkdwn markup cannot
 * cross, and whether bare URLs become links, which they cannot inside a link's label.
 */
type PhrasingContext = {
  readonly breaks: boolean;
  readonly links: boolean;
  /** How many spans and links enclose these nodes. */
  readonly depth: number;
};

/**
 * Renders phrasing nodes as units. Inside a span or a link label a line break becomes a space,
 * since mrkdwn markup cannot cross lines.
 */
function phrasingUnits(
  nodes: readonly PhrasingContent[],
  source: SourceDocument,
  options: PhrasingOptions,
  context: PhrasingContext
): (Inline | Break)[] {
  const units: (Inline | Break)[] = [];
  const add = (unit: Inline | Break): void => {
    units.push(unit);
  };
  const space: Inline = { kind: "space", text: " " };
  for (const [index, node] of nodes.entries()) {
    if (context.depth >= MAX_NESTING && isNesting(node)) {
      // Too deep to nest: the span's or link's text, without its markup.
      source.flattened.value = true;
      for (const unit of textUnits(textOf(node))) add(unit);
      continue;
    }
    switch (node.type) {
      case "text": {
        for (const [at, part] of node.value.split("\n").entries()) {
          if (at > 0) add(context.breaks ? { kind: "break" } : space);
          for (const unit of context.links ? proseUnits(part) : textUnits(part)) add(unit);
        }
        break;
      }
      case "break":
        add(context.breaks ? { kind: "break" } : space);
        break;
      case "inlineCode":
        add({ kind: "code", code: node.value });
        break;
      case "emphasis":
      case "strong":
      case "delete": {
        const children = inlineOnly(
          phrasingUnits(node.children, source, options, {
            ...context,
            breaks: false,
            depth: context.depth + 1,
          })
        );
        if (isIntraword(nodes, index)) {
          // Slack shows no emphasis inside a word, so the source's own characters stand.
          for (const unit of textUnits(sourceText(node, source))) add(unit);
        } else if (node.type === "strong" && options.heading) {
          for (const unit of children) add(unit);
        } else {
          add({
            kind: "span",
            mark: node.type === "strong" ? "*" : node.type === "emphasis" ? "_" : "~",
            children,
          });
        }
        break;
      }
      case "link": {
        const label = labelUnits(node.children, source, options, context.depth + 1);
        const text = textOf(node).toLowerCase();
        const url = node.url.toLowerCase();
        // An autolink's text is its URL, which a Slack link without a label shows.
        const autolink = text === url || `http://${text}` === url || `mailto:${text}` === url;
        for (const unit of linkUnits(node.url, label, autolink ? "url" : "label")) add(unit);
        break;
      }
      case "image":
        for (const unit of imageUnits(node.url, node.alt)) add(unit);
        break;
      case "linkReference": {
        // micromark makes a reference only for a defined label, so a missing one is a defect of
        // the lookup; it shows as the source text, as CommonMark shows an unresolved reference.
        const url = source.definitions.get(node.identifier);
        const units =
          url === undefined
            ? textUnits(sourceText(node, source))
            : linkUnits(url, labelUnits(node.children, source, options, context.depth + 1), "label");
        for (const unit of units) add(unit);
        break;
      }
      case "imageReference": {
        const url = source.definitions.get(node.identifier);
        const units = url === undefined ? textUnits(sourceText(node, source)) : imageUnits(url, node.alt);
        for (const unit of units) add(unit);
        break;
      }
      default:
        for (const unit of textUnits(sourceText(node, source))) add(unit);
    }
  }
  return units;
}

/** Whether a phrasing node nests its children: a span or a link. */
function isNesting(node: PhrasingContent): boolean {
  return node.type === "emphasis" || node.type === "strong" || node.type === "delete" || node.type === "link";
}

/** The schemes a link may use, and an image, matched without regard to case as schemes are. */
const LINK_SCHEME = /^(?:https?:\/\/|mailto:)/iu;
const IMAGE_SCHEME = /^https?:\/\//iu;

/** `url` as a target Slack can open, its scheme in lower case, or none for another scheme. */
function openable(url: string, scheme: RegExp): Option.Option<string> {
  const match = scheme.exec(url);
  return match === null ? Option.none() : Option.some(match[0].toLowerCase() + url.slice(match[0].length));
}

/**
 * A link to `url`, showing `label`, or the URL for an autolink. A link Slack cannot open, such as
 * a relative or `javascript:` one, keeps what it displays as text: its label, or for an autolink
 * the URL text, which is its label.
 */
function linkUnits(url: string, label: readonly Inline[], shows: "label" | "url"): readonly Inline[] {
  return Option.match(openable(url, LINK_SCHEME), {
    onNone: () => label,
    onSome: (target) => [{ kind: "link", url: target, label: shows === "url" ? [] : label }],
  });
}

/** An image as a link labelled with its alt text, or showing the URL when it has none. */
function imageUnits(url: string, alt: string | null | undefined): readonly Inline[] {
  const label = textUnits(alt ?? "");
  return Option.match(openable(url, IMAGE_SCHEME), {
    onNone: () => label,
    onSome: (target) => [{ kind: "link", url: target, label }],
  });
}

/**
 * Prose as words, whitespace and links: a bare `http(s)://` URL outside a word becomes a link,
 * because the announcement posts its text verbatim and Slack then links nothing by itself.
 */
function proseUnits(text: string): Inline[] {
  const units: Inline[] = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    if (isBareUrlStart(text, index)) {
      const end = bareUrlEnd(text, index);
      // A scheme alone, such as `https://` before a space, is text.
      if (end > text.indexOf("//", index) + 2) {
        for (const unit of textUnits(text.slice(start, index))) units.push(unit);
        units.push({ kind: "link", url: text.slice(index, end), label: [] });
        start = end;
        index = end;
        continue;
      }
    }
    index += 1;
  }
  for (const unit of textUnits(text.slice(start))) units.push(unit);
  return units;
}

/** Whether a bare `http(s)://` URL starts at `index`, outside a word. */
function isBareUrlStart(text: string, index: number): boolean {
  if (isWordChar(text.charAt(index - 1))) return false;
  return text.startsWith("https://", index) || text.startsWith("http://", index);
}

/**
 * The end of a bare URL: the first whitespace, `<`, `>` or backtick, less trailing sentence
 * punctuation and a closing paren the URL did not open, as in `(see https://x.y/a).`.
 */
function bareUrlEnd(text: string, start: number): number {
  let end = start;
  let parens = 0;
  while (end < text.length && !" \t<>`".includes(text.charAt(end))) {
    const char = text.charAt(end);
    if (char === "(") parens += 1;
    if (char === ")") parens -= 1;
    end += 1;
  }
  for (;;) {
    const last = text.charAt(end - 1);
    if (".,;:!?'\"".includes(last)) end -= 1;
    else if (last === ")" && parens < 0) {
      end -= 1;
      parens += 1;
    } else return end;
  }
}

/** Units without line breaks, which never occur where `breaks` is false. */
function inlineOnly(units: readonly (Inline | Break)[]): Inline[] {
  const inline: Inline[] = [];
  for (const unit of units) if (unit.kind !== "break") inline.push(unit);
  return inline;
}

/** A link label: its text and code, without emphasis, which Slack does not show in a label. */
function labelUnits(
  nodes: readonly PhrasingContent[],
  source: SourceDocument,
  options: PhrasingOptions,
  depth: number
): Inline[] {
  const flat: Inline[] = [];
  const flatten = (units: readonly Inline[]): void => {
    for (const unit of units) {
      if (unit.kind === "span") flatten(unit.children);
      else if (unit.kind === "link") flatten(unit.label);
      else flat.push(unit);
    }
  };
  flatten(inlineOnly(phrasingUnits(nodes, source, options, { breaks: false, links: false, depth })));
  return flat;
}

/** Whether the phrasing node at `index` touches a letter or digit of a neighbouring text. */
function isIntraword(nodes: readonly PhrasingContent[], index: number): boolean {
  const before = nodes[index - 1];
  const after = nodes[index + 1];
  return (
    (before?.type === "text" && isWordChar(before.value.charAt(before.value.length - 1))) ||
    (after?.type === "text" && isWordChar(after.value.charAt(0)))
  );
}

function isWordChar(char: string): boolean {
  return char !== "" && /^[\p{L}\p{N}]$/u.test(char);
}
