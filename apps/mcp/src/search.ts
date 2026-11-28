/**
 * Ranks the docs catalog's sections against a free-text query. The index is built once at startup,
 * so a query reads maps, plus a substring search for an identifier it names in the fields that
 * hold that identifier's terms.
 *
 * A document scores on its keywords and on a query that names its whole title, and each of its
 * sections on its heading and its prose, with BM25 weights. A query term in a section's code makes
 * the section a match without adding to its score. A hit is one document with its best section, so
 * a page appears once, and the agent's next `read_doc` call can ask for that section alone.
 *
 * Pages and sections compare on an ordered list of ranks, {@link PAGE_RANKS} and
 * {@link SECTION_RANKS}. The first rank that tells two candidates apart decides, so a new rule is
 * one more entry in a list.
 */

import type { CatalogDocument } from "@elmeragroup/docs-catalog";

/** One ranked result, a document with the section that matched it best. */
export type Hit = {
  /** The document's title, with the section's heading after it when the hit is not the lead section. */
  readonly title: string;
  /** The site-relative href, with the section's fragment when the document has sections. */
  readonly href: string;
  /** Text around the match that picked the section, at most {@link EXCERPT_LENGTH} characters. */
  readonly excerpt: string;
  /**
   * The query's words, as written, that neither the page's title, keywords and description nor the
   * section holds. Empty when the hit matches the whole query. Stop words and the words that ask
   * for the API never count.
   */
  readonly missing: readonly string[];
};

/** The most characters of an excerpt. */
export const EXCERPT_LENGTH = 300;

/**
 * Words too common in queries and docs to tell pages apart. The last group is common to every
 * Fuse page, because each API table has a "Prop" column and every page documents a Fuse component.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "them",
  "this",
  "to",
  "up",
  "what",
  "when",
  "which",
  "with",
  "you",
  "component",
  "elmeragroup",
  "fuse",
  "prop",
  "property",
]);

/**
 * Query words that ask for an API reference rather than for a topic. They match no text, and a
 * query that holds one lands on a page's API parts, whose ids the docs site starts with `api-`.
 */
const API_WORDS = new Set(["api", "prop", "property"]);

/** The id the docs site gives the heading over a page's API parts. */
const API_REFERENCE_ID = "api-reference";

/**
 * Strips the plural and verb endings that keep a query word from meeting the same word in the
 * docs: "buttons" and "button", "selecting" and "select". A final "e" goes too, so "theme" meets
 * "theming" and "delete" meets "deleting". "theme" then stems to "them", which is why the pronoun
 * is a stop word: stop words leave before stemming. Query and index pass through the same
 * function, so the stems only need to agree with each other.
 */
function stem(word: string): string {
  const base = withoutEnding(word);
  return base.length > 4 && base.endsWith("e") ? base.slice(0, -1) : base;
}

/** A word without its plural or verb ending. */
function withoutEnding(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:ss|x|ch|sh)es$/u.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  return word;
}

/**
 * The terms of a text, which are its words split at case changes and punctuation, lowercased,
 * without stop words, and stemmed. `onValueChange` gives `on`, `value` and `change`.
 */
function terms(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .map(stem);
}

/** How often each term occurs in a text. */
function frequencies(words: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

/** One kind of text in a section, ready to score and to cut an excerpt from. */
type Field = {
  readonly counts: ReadonlyMap<string, number>;
  readonly length: number;
  /** The text with whitespace collapsed, for excerpts and for identifiers written in a query. */
  readonly text: string;
};

/** One section, ready to score. */
type IndexedSection = {
  readonly id: string;
  readonly heading: string;
  readonly headingTerms: ReadonlySet<string>;
  /** The part an API section documents, such as `Select.Root`, lowercased. */
  readonly partName: string | undefined;
  /** The text outside code fences: paragraphs, lists and API tables. */
  readonly prose: Field;
  /**
   * The text inside code fences, which is mostly demo source. It admits a section and gives no
   * score, so it keeps no length and no lowercased copy.
   */
  readonly code: Pick<Field, "counts" | "text">;
};

/** One document, ready to score. */
type IndexedDocument = {
  readonly document: CatalogDocument;
  readonly titleTerms: ReadonlySet<string>;
  readonly keywordTerms: ReadonlySet<string>;
  readonly descriptionTerms: ReadonlySet<string>;
  readonly sections: readonly IndexedSection[];
};

/** The search index over a catalog's documents. */
export type SearchIndex = {
  readonly documents: readonly IndexedDocument[];
  /** In how many sections each term occurs, in any field. */
  readonly sectionFrequency: ReadonlyMap<string, number>;
  /** In how many documents' titles, keywords or descriptions each term occurs. */
  readonly documentFrequency: ReadonlyMap<string, number>;
  readonly sectionCount: number;
  /** The mean length in terms of a section's prose, for BM25's length normalization. */
  readonly averageProseLength: number;
};

/** The heading text of a section, which is its first line without the leading hashes. */
function headingOf(markdown: string): string {
  const [first = ""] = markdown.split("\n", 1);
  return first.replace(/^#+\s*/u, "").trim();
}

/** The API part a heading names, such as `Select.Root` in `Select.Root · RSC: client`. */
function partNameOf(id: string, heading: string): string | undefined {
  if (!id.startsWith("api-") || id === API_REFERENCE_ID) return undefined;
  return heading.split(" · ", 1)[0]?.trim().toLowerCase();
}

/** Collapses lines into one line of text, without table cell pipes. */
function flatten(lines: readonly string[]): string {
  return lines
    .join(" ")
    .replace(/(?<!\\)\|/gu, " ")
    .replace(/\\\|/gu, "|")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * A fence line, indented or not, as the docs generator reads one: its run of three or more
 * backticks or tildes, then the rest of the line.
 */
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/u;

/**
 * Splits a section's markdown, without its heading line, into prose and code. Fence markers, table
 * rules and the `Source:` line that names a demo's or a part's file belong to neither. As in
 * CommonMark, only a run of the opening fence's character, at least as long and with no info
 * string, closes it, so a four-backtick fence can show a three-backtick one as code. A backtick
 * run followed by another backtick on its line opens no fence, because a backtick fence's info
 * string holds none, so ```` ```foo``` ```` is a code span in prose.
 */
function splitText(markdown: string) {
  const prose: string[] = [];
  const code: string[] = [];
  let open: string | null = null;
  for (const line of markdown.split(/\r\n?|\n/u).slice(1)) {
    const [, run = "", rest = ""] = FENCE.exec(line) ?? [];
    if (open === null) {
      if (run !== "" && !(run.startsWith("`") && rest.includes("`"))) open = run;
      else if (!/^\|[\s|:-]+\|$/u.test(line) && !/^Source: `[^`]*`$/u.test(line)) prose.push(line);
    } else if (run.startsWith(open[0] ?? "") && run.length >= open.length && rest.trim() === "") {
      open = null;
    } else {
      code.push(line);
    }
  }
  return { prose: flatten(prose), code: flatten(code) };
}

function fieldOf(text: string): Field {
  const words = terms(text);
  return {
    counts: frequencies(words),
    length: words.length,
    text,
  };
}

function countInto(counts: Map<string, number>, keys: Iterable<string>): void {
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Builds the search index.
 *
 * @param documents - The catalog's documents, in catalog order, which also breaks ties.
 * @returns The index {@link search} reads.
 */
export function buildIndex(documents: readonly CatalogDocument[]): SearchIndex {
  const sectionFrequency = new Map<string, number>();
  const documentFrequency = new Map<string, number>();
  let sectionCount = 0;
  let proseTotal = 0;
  const indexed = documents.map((document): IndexedDocument => {
    const titleTerms = new Set(terms(document.title));
    // A dotted keyword is an API part's name, such as `Autocomplete.List`, which its API section
    // heading already indexes. As a keyword it would rank the page for "list" as a topic.
    const keywordTerms = new Set(
      document.keywords.filter((keyword) => !keyword.includes(".")).flatMap(terms)
    );
    const descriptionTerms = new Set(terms(document.description));
    countInto(documentFrequency, new Set([...titleTerms, ...keywordTerms, ...descriptionTerms]));
    const sections = document.sections.map((section): IndexedSection => {
      const heading = headingOf(section.markdown);
      const headingTerms = new Set(terms(heading));
      const text = splitText(section.markdown);
      const prose = fieldOf(text.prose);
      const code = { counts: frequencies(terms(text.code)), text: text.code };
      countInto(sectionFrequency, new Set([...headingTerms, ...prose.counts.keys(), ...code.counts.keys()]));
      sectionCount += 1;
      proseTotal += prose.length;
      return {
        id: section.id,
        heading,
        headingTerms,
        partName: partNameOf(section.id, heading),
        prose,
        code,
      };
    });
    return { document, titleTerms, keywordTerms, descriptionTerms, sections };
  });
  return {
    documents: indexed,
    sectionFrequency,
    documentFrequency,
    sectionCount,
    averageProseLength: sectionCount === 0 ? 0 : proseTotal / sectionCount,
  };
}

/** BM25's inverse document frequency, which weighs rare terms more. */
function inverseFrequency(count: number, total: number): number {
  return Math.log(1 + (total - count + 0.5) / (count + 0.5));
}

/** BM25's term-frequency saturation and length normalization. */
const K1 = 1.2;
const B = 0.75;

/** The weights of a match in each field, relative to one BM25 body match. */
const WEIGHTS = { wholeTitle: 4, keyword: 3, heading: 2.5 } as const;

/** A query, read once. */
type Query = {
  /** The query's terms, without the words that ask for the API. */
  readonly terms: readonly string[];
  /** Whether a word of the query asks for an API reference. */
  readonly wantsApi: boolean;
  /** The query's words as written, for excerpts. */
  readonly words: readonly string[];
  /**
   * The query's words as written, each with the terms it adds to the query. A phrase an alias
   * rewrites is one entry, so `set up` stands for `install`, `quick` and `start`.
   */
  readonly written: readonly { readonly text: string; readonly terms: readonly string[] }[];
  /** The words written as identifiers, with a dot or an inner capital, such as `onValueChange`. */
  readonly identifiers: readonly {
    readonly lower: string;
    readonly terms: readonly string[];
    /** The identifier whole, case aside, so `onOpenChange` does not match inside `onOpenChangeComplete`. */
    readonly whole: RegExp;
  }[];
};

/** A term's inverse frequency over the sections. */
function sectionWeight(index: SearchIndex, term: string): number {
  return inverseFrequency(index.sectionFrequency.get(term) ?? 0, index.sectionCount);
}

/** A term's inverse frequency over the documents' titles, keywords and descriptions. */
function documentWeight(index: SearchIndex, term: string): number {
  return inverseFrequency(index.documentFrequency.get(term) ?? 0, index.documents.length);
}

function bodyScore(index: SearchIndex, field: Field, query: readonly string[]): number {
  const norm = 1 - B + (B * field.length) / Math.max(1, index.averageProseLength);
  let score = 0;
  for (const term of query) {
    const count = field.counts.get(term) ?? 0;
    if (count > 0) score += (sectionWeight(index, term) * count * (K1 + 1)) / (count + K1 * norm);
  }
  return score;
}

function headingScore(index: SearchIndex, section: IndexedSection, query: readonly string[]): number {
  let score = 0;
  for (const term of query) {
    if (section.headingTerms.has(term)) score += WEIGHTS.heading * sectionWeight(index, term);
  }
  return score;
}

function scoreDocument(index: SearchIndex, entry: IndexedDocument, query: readonly string[]): number {
  let score = 0;
  for (const term of query) {
    if (entry.keywordTerms.has(term)) score += WEIGHTS.keyword * documentWeight(index, term);
  }
  // A query that names the whole title asks for this page.
  if (entry.titleTerms.size > 0 && [...entry.titleTerms].every((term) => query.includes(term))) {
    for (const term of entry.titleTerms) score += WEIGHTS.wholeTitle * documentWeight(index, term);
  }
  return score;
}

/**
 * Whether a query word names an API part, such as `Select.Root` or `AspectRatio`. A plain word,
 * such as `button`, names a page through its title instead, so it counts only when written as an
 * identifier, with a dot or an inner capital.
 */
function namesPart(section: IndexedSection, query: Query): boolean {
  return query.identifiers.some((identifier) => identifier.lower === section.partName);
}

/**
 * How many of the query's identifiers a field holds whole and as written, case aside. An
 * identifier whose terms the field lacks cannot occur in it, so only fields that hold them all are
 * searched.
 */
function literalsIn(field: Field, query: Query): number {
  return query.identifiers.filter(
    (identifier) =>
      identifier.terms.every((term) => field.counts.has(term)) && identifier.whole.test(field.text)
  ).length;
}

/** The scores one section earns for the query terms the page's title does not cover. */
type SectionCandidate = {
  readonly section: IndexedSection;
  readonly namedPart: boolean;
  /** How many of the query's identifiers, such as `onValueChange`, the prose holds as written. */
  readonly literals: number;
  readonly prose: number;
};

/**
 * How a page's sections compare, first rank first. A section the query names as an API part wins,
 * then the prose that holds the query's identifiers as written, then the stronger match in heading
 * and prose. Equal sections keep page order.
 */
const SECTION_RANKS: readonly ((candidate: SectionCandidate) => number)[] = [
  (candidate) => (candidate.namedPart ? 1 : 0),
  (candidate) => candidate.literals,
  (candidate) => candidate.prose,
];

/** One page with the section it lands on and the evidence for both. */
type PageCandidate = {
  readonly entry: IndexedDocument;
  readonly section: IndexedSection | undefined;
  /** The query terms the page's title leaves for the sections to match. */
  readonly rest: readonly string[];
  /** Whether a query word names one of the page's API parts, such as `Chart.Line`. */
  readonly namedPart: boolean;
  /** Whether the query's terms are exactly the page's title, such as `Line chart`. */
  readonly namedTitle: boolean;
  /** How many of the query's identifiers, such as `ColorSchemeScript`, the section's prose holds as written. */
  readonly literals: number;
  /**
   * How many of the query's terms the page's title and description hold. Keywords do not count,
   * because most of them are demo titles, such as the charts' "Step before".
   */
  readonly coverage: number;
  /** How many of the query's terms the page's title holds. */
  readonly titled: number;
  /** The page's own fields and its section's heading and prose, scaled by the share of terms they hold. */
  readonly prose: number;
};

/**
 * How pages compare, first rank first. A page with an API part the query names comes first, so
 * `Chart.Line` lands on the Chart part rather than on the Line chart page, then a page the query
 * names by its title, then
 * the page whose prose holds more of the query's identifiers as written, so an export's own section
 * outranks a page whose title shares its words. Then the page whose title and description hold more
 * of the query's terms, so a word in one demo heading cannot lift a page past one that is about the
 * query, and of those the page whose title holds more of them. Then the stronger match in titles,
 * keywords, headings and prose. The sort is stable, so equal pages keep catalog order.
 */
const PAGE_RANKS: readonly ((candidate: PageCandidate) => number)[] = [
  (candidate) => (candidate.namedPart ? 1 : 0),
  (candidate) => (candidate.namedTitle ? 1 : 0),
  (candidate) => candidate.literals,
  (candidate) => candidate.coverage,
  (candidate) => candidate.titled,
  (candidate) => candidate.prose,
];

/** Compares two candidates on ranks, higher first, and on the first rank that differs. */
function byRanks<C>(ranks: readonly ((candidate: C) => number)[]) {
  return (left: C, right: C): number => {
    for (const rank of ranks) {
      const difference = rank(right) - rank(left);
      if (difference !== 0) return difference;
    }
    return 0;
  };
}

const compareSections = byRanks(SECTION_RANKS);
const comparePages = byRanks(PAGE_RANKS);

/**
 * The section a page lands on. A query that asks for the API picks among the API parts, and lands
 * on `#api-reference` when no part matches. Any other query with nothing left to match lands on the
 * lead section.
 */
function bestSection(
  index: SearchIndex,
  entry: IndexedDocument,
  query: Query,
  rest: readonly string[]
): SectionCandidate | undefined {
  let best: SectionCandidate | undefined;
  for (const section of entry.sections) {
    if (query.wantsApi && !section.id.startsWith("api-")) continue;
    const candidate = {
      section,
      namedPart: namesPart(section, query),
      literals: literalsIn(section.prose, query),
      prose: headingScore(index, section, rest) + bodyScore(index, section.prose, rest),
    };
    const inCode = rest.some((term) => section.code.counts.has(term));
    if (!candidate.namedPart && candidate.prose === 0 && !inCode) continue;
    if (best === undefined || compareSections(candidate, best) < 0) best = candidate;
  }
  return best;
}

/** Whether a page's fields, or its section's heading and prose, hold the term. */
function holds(entry: IndexedDocument, section: IndexedSection | undefined, term: string): boolean {
  return (
    entry.titleTerms.has(term) ||
    entry.keywordTerms.has(term) ||
    entry.descriptionTerms.has(term) ||
    (section !== undefined && (section.headingTerms.has(term) || section.prose.counts.has(term)))
  );
}

function rankPage(index: SearchIndex, entry: IndexedDocument, query: Query): PageCandidate | undefined {
  // The words of the page's title pick the page, and its sections compete on the rest, so
  // "date picker" lands on the lead section and "button pending" on the section about pending.
  const rest = query.terms.filter((term) => !entry.titleTerms.has(term));
  const found = bestSection(index, entry, query, rest);
  // A query whose terms are exactly the page's title, such as `DatePicker`, names the page.
  const namesTitle =
    entry.titleTerms.size > 0 && rest.length === 0 && query.terms.length === entry.titleTerms.size;
  const namedPart = found?.namedPart === true;
  const proseRaw = scoreDocument(index, entry, query.terms) + (found?.prose ?? 0);
  // A page with no sections, such as `/releases`, matches on its title and description alone.
  const coverage = query.terms.filter(
    (term) => entry.titleTerms.has(term) || entry.descriptionTerms.has(term)
  ).length;
  if (found === undefined && proseRaw === 0 && coverage === 0) return undefined;
  // A page that matches every query word ranks above one that matches a rare word alone.
  const share = query.terms.filter((term) => holds(entry, found?.section, term)).length / query.terms.length;
  const fallback = query.wantsApi
    ? entry.sections.find((section) => section.id === API_REFERENCE_ID)
    : undefined;
  return {
    entry,
    section: found?.section ?? fallback ?? entry.sections[0],
    rest,
    namedPart,
    namedTitle: namesTitle,
    literals: found?.literals ?? 0,
    coverage,
    titled: query.terms.length - rest.length,
    prose: proseRaw * share,
  };
}

/** Where a word first occurs in lowercased text, at a word start if it occurs there, or -1. */
function positionOf(lower: string, word: string): number {
  const atStart = lower.search(new RegExp(`(?<![a-z0-9])${RegExp.escape(word)}`, "u"));
  return atStart >= 0 ? atStart : lower.indexOf(word);
}

/**
 * Where a query word as written first occurs in lowercased text, or -1. An identifier counts whole
 * first, as ranking counts it, so `onOpenChange` does not anchor on `onOpenChangeComplete`. Text
 * that holds it only inside a longer identifier, as `onOpenChange` holds `onOpen`, anchors there.
 */
function writtenPosition(lower: string, word: string, query: Query): number {
  const written = word.toLowerCase();
  const identifier = query.identifiers.find((candidate) => candidate.lower === written);
  if (identifier === undefined) return positionOf(lower, written);
  const whole = lower.search(identifier.whole);
  return whole >= 0 ? whole : positionOf(lower, written);
}

/**
 * Text around the match, cut at word edges to at most {@link EXCERPT_LENGTH} characters. The
 * match is the first query word as written that the text holds, longest word first, so
 * `onValueChange` anchors on itself rather than on an earlier `value`. Without one, the earliest
 * term; without that, the text's start.
 */
function excerptOf(text: string, query: Query, matched: readonly string[]): string {
  const lower = text.toLowerCase();
  const written = [...query.words].sort((left, right) => right.length - left.length);
  let first = -1;
  for (const word of written) {
    if (terms(word).some((term) => matched.includes(term))) {
      first = writtenPosition(lower, word, query);
      if (first >= 0) break;
    }
  }
  if (first < 0) {
    const positions = matched.map((term) => positionOf(lower, term)).filter((position) => position >= 0);
    first = positions.length === 0 ? 0 : Math.min(...positions);
  }
  // Start at a word edge, unless the next space comes after the match, as in a long token holding it.
  let start = Math.max(0, first - 80);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space >= 0 && space < first) start = space + 1;
  }
  const lead = start > 0 ? "…" : "";
  const room = EXCERPT_LENGTH - lead.length;
  if (text.length - start <= room) return lead + text.slice(start);
  const cut = text.lastIndexOf(" ", start + room - 1);
  const end = cut > start ? cut : start + room - 1;
  return `${lead}${text.slice(start, end)}…`;
}

/**
 * The hit for a ranked page, with its excerpt cut from the first of the section's prose and code
 * that holds a matched term, else from its prose, else from the page's description.
 */
function hitOf(candidate: PageCandidate, query: Query): Hit {
  const { entry, section, rest } = candidate;
  const { document } = entry;
  const matched = rest.length > 0 ? rest : query.terms;
  const missing = missingWords(entry, section, query);
  if (section === undefined) {
    return {
      title: document.title,
      href: document.href,
      excerpt: excerptOf(document.description, query, matched),
      missing,
    };
  }
  const fields = [section.prose, section.code];
  const text =
    fields.find((field) => matched.some((term) => field.counts.has(term)))?.text ??
    fields.find((field) => field.text !== "")?.text ??
    document.description;
  return {
    title: section === entry.sections[0] ? document.title : `${document.title} › ${section.heading}`,
    href: `${document.href}#${section.id}`,
    excerpt: excerptOf(text, query, matched),
    missing,
  };
}

/**
 * The query's words as written that a hit lacks. A word counts as held when the page's fields or
 * the section the hit shows hold each of its terms, its code included, because code admits a
 * section and can hold the excerpt. The ranking never reads this list.
 */
function missingWords(
  entry: IndexedDocument,
  section: IndexedSection | undefined,
  query: Query
): readonly string[] {
  const held = (term: string) => holds(entry, section, term) || section?.code.counts.has(term) === true;
  return query.written.filter((word) => !word.terms.every(held)).map((word) => word.text);
}

/**
 * Phrases agents write that the docs spell another way, each with the words the docs use. "Set
 * up" alone leaves only "set", which every API table holds, and "multi-line" splits into two words
 * where the docs write "multiline". The docs never write "apply a theme": the theming handbook's
 * "The document theme" says "A page sets its brand once, on `<html>`", and "theme" names that page,
 * so its title takes the word and leaves the heading nothing to match.
 */
const ALIASES: readonly (readonly [RegExp, string])[] = [
  [/\b(?:set ?up|get(?:ting)? started)\b/giu, "install quick start"],
  [/\bmulti[- ]line\b/giu, "multiline"],
  [/\bapply(?:ing)? (?:an? |the )?((?:brand(?:ed)? |neutral )?)them(?:e|ing)\b/giu, "set $1document theme"],
];

/** Rewrites a query's phrases into the words the docs use for them. */
function withAliases(query: string): string {
  return ALIASES.reduce((text, [phrase, words]) => text.replace(phrase, words), query);
}

/**
 * A query's words as written, each with the terms it adds. A phrase an alias rewrites is one
 * entry with the terms of its rewrite. Stop words, API words and repeats drop out.
 */
function writtenWords(text: string): Query["written"] {
  const phrases = ALIASES.flatMap(([phrase, words]) =>
    [...text.matchAll(phrase)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      terms: terms(match[0].replace(phrase, words)),
    }))
  );
  const inPhrase = (match: RegExpExecArray) =>
    phrases.some((phrase) => match.index < phrase.end && match.index + match[0].length > phrase.start);
  const words = [...text.matchAll(/\S+/gu)]
    .filter((match) => !inPhrase(match))
    .map((match) => ({ start: match.index, text: trimWord(match[0]), terms: terms(match[0]) }));
  const byText = new Map<string, readonly string[]>();
  for (const entry of [...phrases, ...words].toSorted((left, right) => left.start - right.start)) {
    const kept = entry.terms.filter((term) => !API_WORDS.has(term));
    if (kept.length > 0 && !byText.has(entry.text)) byText.set(entry.text, kept);
  }
  return [...byText].map(([written, wordTerms]) => ({ text: written, terms: wordTerms }));
}

/** A written word without the punctuation around it, such as `Select.Root` from `"Select.Root",`. */
function trimWord(word: string): string {
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/gu, "");
}

/** Reads a query's terms, its API words and its words as written. */
function readQuery(text: string): Query {
  const written = [...new Set(text.split(/\s+/u).map(trimWord))].filter(
    (word) => word.length > 0 && terms(word).some((term) => !API_WORDS.has(term))
  );
  return {
    terms: [...new Set(terms(withAliases(text)))].filter((term) => !API_WORDS.has(term)),
    wantsApi: text
      .toLowerCase()
      .split(/[^a-z]+/u)
      .some((word) => API_WORDS.has(stem(word))),
    words: written,
    written: writtenWords(text),
    identifiers: written
      .filter((word) => /\.|[a-z0-9][A-Z]/u.test(word))
      .map((word) => {
        const lower = word.toLowerCase();
        const whole = new RegExp(`(?<![a-z0-9])${RegExp.escape(lower)}(?![a-z0-9])`, "iu");
        return { lower, terms: terms(word), whole };
      }),
  };
}

/**
 * Whether some page holds every word of a query, in its title, keywords or description or in any
 * of its sections. A hit names the words its own section lacks, and this tells whether a page
 * holds them at all, so a page that spreads the words over two sections counts.
 *
 * @param index - The index from {@link buildIndex}.
 * @param query - The query text.
 * @returns True when a page holds each term of the query, and false for a query without terms.
 */
export function somePageHoldsAll(index: SearchIndex, query: string): boolean {
  const { terms: wanted } = readQuery(query);
  return (
    wanted.length > 0 &&
    index.documents.some((entry) =>
      wanted.every(
        (term) =>
          holds(entry, undefined, term) ||
          entry.sections.some((section) => holds(entry, section, term) || section.code.counts.has(term))
      )
    )
  );
}

/**
 * Ranks the catalog against a query.
 *
 * @param index - The index from {@link buildIndex}.
 * @param query - The query text.
 * @param limit - The most hits to return.
 * @returns Up to `limit` hits, best first, one per document. Equal scores keep catalog order.
 *   Empty when the query has no terms or nothing matches.
 */
export function search(index: SearchIndex, query: string, limit: number): readonly Hit[] {
  const parsed = readQuery(query);
  if (parsed.terms.length === 0) return [];
  const ranked: PageCandidate[] = [];
  for (const entry of index.documents) {
    const candidate = rankPage(index, entry, parsed);
    if (candidate !== undefined) ranked.push(candidate);
  }
  // Excerpts are built for the returned hits alone.
  return ranked
    .sort(comparePages)
    .slice(0, limit)
    .map((candidate) => hitOf(candidate, parsed));
}
