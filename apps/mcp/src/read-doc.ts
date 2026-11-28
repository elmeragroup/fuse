/**
 * Answers `read_doc` with one text block per requested href, in request order, within one
 * character budget for the whole call.
 *
 * An href names a document, or a section of one with the docs site's own heading id as its
 * fragment, so the same href works in a browser and here. A section comes with every section
 * under it, and its block ends with a line that lists the page's second-level sections, so the
 * agent can ask for a section only some pages have. A page or section that does not fit the budget comes back as its size and the hrefs of
 * the sections under it, which the agent asks for in its next call.
 *
 * {@link buildLibrary} indexes every page and section once at startup: its range of sections, the
 * length of the block that returns it, and the sections under it. A call resolves every href first,
 * holds back room for each later href, the smaller of its block and its over-budget answer, and
 * joins the markdown only of the selections it returns.
 */

import type { CatalogDocument } from "@elmeragroup/docs-catalog";

/** The most characters one `read_doc` call returns, every block counted. */
export const CALL_BUDGET = 100_000;

/** The most hrefs one `read_doc` call takes. */
export const HREFS_PER_CALL = 8;

/** The most characters of an answer that is not docs text, such as an error or a URL. */
const SHORT_ANSWER_LENGTH = 512;

/**
 * The longest page slug or section id the server suggests near matches for, counted after the
 * href is decoded. The catalog's longest id is 37 characters, so a longer name is no near miss.
 * At this limit, eight distinct misses on the page with the most sections, 139, take about 3 ms
 * on Node 26, and the token bucket admits 50 calls a second.
 */
const SUGGESTION_NAME_LIMIT = 48;

/** A page, a section with everything under it, or the index: text that one href returns. */
type Selection = {
  /** The href the answer names, with the fragment when there is one. */
  readonly label: string;
  /** The length of the block {@link render} returns, its `Source:` and `Sections:` lines included. */
  readonly length: number;
  /** The sections one level under it, which the agent can ask for when it does not fit. */
  readonly parts: readonly Selection[];
  /** The block that returns it. Joined on demand, so a selection that does not fit costs nothing. */
  readonly render: () => string;
  /**
   * The room an earlier href leaves it: the smaller of its block and its widest over-budget answer,
   * so it gets one of the two. That answer names the room left, at most {@link CALL_BUDGET}, so
   * formatting the budget itself gives the widest number.
   */
  readonly reserve: number;
};

/** A name the server can suggest for a miss: what the answer prints, and what the miss is compared with. */
type Suggestion = { readonly label: string; readonly key: string };

/** One document, with a selection for the whole page and one for each section. */
type IndexedDocument = {
  readonly document: CatalogDocument;
  readonly whole: Selection;
  readonly sections: ReadonlyMap<string, Selection>;
  /** The sections as `#id`, in page order, for suggestions. */
  readonly suggestions: readonly Suggestion[];
};

/** What `read_doc` reads from, indexed once by {@link buildLibrary}. */
export type Library = {
  /** The indexed documents by canonical href. */
  readonly documents: ReadonlyMap<string, IndexedDocument>;
  /** The document hrefs in catalog order, compared by their last segment, for suggestions. */
  readonly pages: readonly Suggestion[];
  /** The `/llms.txt` index as a selection. */
  readonly llms: Selection;
  /** The docs site's origin, which an href may carry and the answers put in front of each href. */
  readonly origin: URL;
};

const count = new Intl.NumberFormat("en-US");

/** The block that returns docs text: its URL on a `Source:` line, a blank line, and the markdown. */
function sourceLine(label: string, origin: URL): string {
  return `Source: ${new URL(label, origin).href}\n\n`;
}

/**
 * The line that ends a section's block: a blank line, then the page's second-level sections, the
 * first as a whole href and the rest as fragments of the same page, such as
 * `Sections: /components/form#overview, #usage, #composition`. Empty for a page without them.
 */
function sectionsLine(document: CatalogDocument): string {
  const [first, ...rest] = document.sections.filter((section) => section.depth === 2);
  if (first === undefined) return "";
  const fragments = rest.map((section) => `, #${section.id}`).join("");
  return `\n\nSections: ${document.href}#${first.id}${fragments}`;
}

/** A selection with the room it needs held back. */
function withReserve(selection: Omit<Selection, "reserve">): Selection {
  return {
    ...selection,
    reserve: Math.min(selection.length, overBudget(selection, CALL_BUDGET).length),
  };
}

/**
 * Indexes the catalog for `read_doc`.
 *
 * @param documents - The catalog's documents.
 * @param index - The `/llms.txt` text.
 * @param origin - The docs site's origin.
 * @returns The library {@link readDocs} answers from.
 */
export function buildLibrary(documents: readonly CatalogDocument[], index: string, origin: URL): Library {
  const indexed = new Map<string, IndexedDocument>();
  for (const document of documents) {
    const { sections } = document;
    // Prefix sums of the section lengths, so a range's joined length is two lookups.
    const before = [0];
    for (const section of sections) before.push((before.at(-1) ?? 0) + section.markdown.length);
    const joinedLength = (start: number, end: number) =>
      (before[end] ?? 0) - (before[start] ?? 0) + 2 * Math.max(0, end - start - 1);
    const join = (start: number, end: number) =>
      sections
        .slice(start, end)
        .map((section) => section.markdown)
        .join("\n\n");
    /** The end of the range that starts at `start`: the next section at its depth or above. */
    const endOf = (start: number) => {
      const depth = sections[start]?.depth ?? 0;
      let end = start + 1;
      while (end < sections.length && (sections[end]?.depth ?? 0) > depth) end += 1;
      return end;
    };
    // A section's selection, by its position. A section's parts come after it, so building from the
    // last section back gives each one its parts' selections, and a part's listed length is the
    // length of the block that returns it.
    const atPosition: Selection[] = [];
    const ofSection = sectionsLine(document);
    const selectionOf = (
      label: string,
      start: number,
      end: number,
      partsFrom: number,
      tail: string
    ): Selection => {
      const head = sourceLine(label, origin);
      // The parts are the shallowest sections in the range after its head.
      const depths = sections.slice(partsFrom, end).map((section) => section.depth);
      const partDepth = Math.min(...depths);
      const parts: Selection[] = [];
      for (let at = partsFrom; at < end; at++) {
        const part = atPosition[at];
        if (part !== undefined && sections[at]?.depth === partDepth) parts.push(part);
      }
      return withReserve({
        label,
        length: head.length + joinedLength(start, end) + tail.length,
        parts,
        render: () => head + join(start, end) + tail,
      });
    };
    const bySection = new Map<string, Selection>();
    for (let start = sections.length - 1; start >= 0; start--) {
      const section = sections[start];
      if (section === undefined) continue;
      const selection = selectionOf(
        `${document.href}#${section.id}`,
        start,
        endOf(start),
        start + 1,
        ofSection
      );
      atPosition[start] = selection;
      bySection.set(section.id, selection);
    }
    indexed.set(document.href, {
      document,
      // A whole page holds every section, so its block lists none.
      whole: selectionOf(document.href, 0, sections.length, 0, ""),
      sections: bySection,
      suggestions: sections.map((section) => ({ label: `#${section.id}`, key: section.id })),
    });
  }
  const llmsHead = sourceLine("/llms.txt", origin);
  return {
    documents: indexed,
    pages: documents.map((document) => ({ label: document.href, key: slug(document.href) })),
    llms: withReserve({
      label: "/llms.txt",
      length: llmsHead.length + index.length,
      parts: [],
      render: () => llmsHead + index,
    }),
    origin,
  };
}

/** The site path of an href, without the docs origin, a trailing slash or the `.md` suffix. */
function parseHref(
  href: string,
  origin: URL
):
  | { readonly _tag: "Path"; readonly path: string; readonly fragment: string }
  | { readonly _tag: "Invalid"; readonly reason: string } {
  const url = URL.parse(href.trim(), origin);
  const example = "Pass a docs path such as /components/button.";
  if (url === null) return { _tag: "Invalid", reason: `${href} is not an href. ${example}` };
  if (url.origin !== origin.origin)
    return { _tag: "Invalid", reason: `${href} is not on ${origin.origin}. ${example}` };
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith(".md")) path = path.slice(0, -".md".length);
  let fragment = url.hash.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // A malformed escape stays as written, and the section lookup names the nearest ids.
  }
  return { _tag: "Path", path, fragment };
}

/**
 * The edit distance between two strings. `rows` holds two rows at least one longer than `right`,
 * which every comparison of one miss reuses.
 */
function distance(left: string, right: string, rows: readonly [Uint16Array, Uint16Array]): number {
  let [previous, current] = rows;
  for (let j = 0; j <= right.length; j++) previous[j] = j;
  for (let i = 1; i <= left.length; i++) {
    current[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution);
    }
    [previous, current] = [current, previous];
  }
  return previous[right.length] ?? 0;
}

/**
 * The text that names the three suggestions nearest a name, nearest first, ties in their given
 * order, or nothing for a name longer than {@link SUGGESTION_NAME_LIMIT} or when there are none.
 */
function nearest(name: string, candidates: readonly Suggestion[]): string {
  if (name.length > SUGGESTION_NAME_LIMIT) return "";
  const width = Math.max(0, ...candidates.map((candidate) => candidate.key.length)) + 1;
  const rows = [new Uint16Array(width), new Uint16Array(width)] as const;
  const near = candidates
    .map((candidate, order) => ({ candidate, order, distance: distance(name, candidate.key, rows) }))
    .sort((left, right) => left.distance - right.distance || left.order - right.order)
    .slice(0, 3)
    .map(({ candidate }) => candidate.label);
  return near.length === 0 ? "" : ` Nearest: ${near.join(", ")}.`;
}

/** The last path segment, such as `button` for `/components/button`. */
function slug(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Cuts an answer to {@link SHORT_ANSWER_LENGTH}. */
function short(text: string): string {
  return text.length <= SHORT_ANSWER_LENGTH ? text : `${text.slice(0, SHORT_ANSWER_LENGTH - 1)}…`;
}

/** The docs text one href names, or the short answer that says why it names none. */
type Target =
  | { readonly _tag: "Text"; readonly selection: Selection }
  | { readonly _tag: "Answer"; readonly text: string };

/** What a parsed href names. */
function resolvePath(library: Library, path: string, fragment: string): Target {
  if (path === "/llms.txt") return { _tag: "Text", selection: library.llms };
  const entry = library.documents.get(path);
  if (entry === undefined) {
    const near = nearest(slug(path), library.pages);
    return { _tag: "Answer", text: short(`${path} is no docs page.${near}`) };
  }
  const { document } = entry;
  if (document.sections.length === 0) {
    const label = fragment === "" ? document.href : `${document.href}#${fragment}`;
    return {
      _tag: "Answer",
      text: short(
        `${document.title} has no markdown on this server yet. Read it at ${new URL(label, library.origin).href}`
      ),
    };
  }
  if (fragment === "") return { _tag: "Text", selection: entry.whole };
  const selection = entry.sections.get(fragment);
  if (selection !== undefined) return { _tag: "Text", selection };
  const near = nearest(fragment, entry.suggestions);
  return { _tag: "Answer", text: short(`${document.href} has no section #${fragment}.${near}`) };
}

/**
 * The answer for docs text that does not fit what is left of the call. It names the selection's
 * block length, which is what the fit check measured, and the hrefs to ask for instead.
 */
function overBudget(selection: Omit<Selection, "reserve">, room: number): string {
  const size = `${selection.label} takes ${count.format(selection.length)} characters, more than the ${count.format(room)} left of this call's ${count.format(CALL_BUDGET)}.`;
  if (selection.parts.length === 0) return `${size} Ask for ${selection.label} in a call of its own.`;
  return [
    `${size} Ask for these sections, as many per call as fit:`,
    ...selection.parts.map((part) => `- ${part.label} (${count.format(part.length)} characters)`),
  ].join("\n");
}

/** The room an answer needs held back: its text, or the selection's reserve for docs text. */
function reserveOf(target: Target): number {
  return target._tag === "Answer" ? target.text.length : target.selection.reserve;
}

/**
 * Answers a `read_doc` call.
 *
 * @param library - The library from {@link buildLibrary}.
 * @param hrefs - The requested hrefs, each with or without the docs origin, `.md` and a fragment.
 * @returns One text block per href, in request order. All of them together hold at most
 *   {@link CALL_BUDGET} characters. An href whose text does not fit gets its size and the hrefs of
 *   the sections under it, and earlier hrefs never take the room that answer needs.
 */
export function readDocs(library: Library, hrefs: readonly string[]): readonly string[] {
  // A repeated href, in any spelling, resolves once.
  const resolved = new Map<string, Target>();
  const targets = hrefs.map((href): Target => {
    const parsed = parseHref(href, library.origin);
    if (parsed._tag === "Invalid") return { _tag: "Answer", text: short(parsed.reason) };
    const key = `${parsed.path}#${parsed.fragment}`;
    const known = resolved.get(key);
    if (known !== undefined) return known;
    const target = resolvePath(library, parsed.path, parsed.fragment);
    resolved.set(key, target);
    return target;
  });
  const reserves = targets.map(reserveOf);
  let reserved = reserves.reduce((sum, reserve) => sum + reserve, 0);
  let left = CALL_BUDGET;
  return targets.map((target, position) => {
    reserved -= reserves[position] ?? 0;
    const room = Math.max(0, left - reserved);
    let block: string;
    if (target._tag === "Answer") block = target.text;
    else if (target.selection.length <= room) block = target.selection.render();
    else block = overBudget(target.selection, room);
    // Eight over-budget answers fit the budget on the catalog, so this cut never runs there, as
    // read-doc.catalog.test.ts holds. It keeps the call under the budget for any catalog.
    if (block.length > room) block = block.slice(0, room);
    left -= block.length;
    return block;
  });
}
