/**
 * Matching for the site's ⌘K palette.
 *
 * Pure over the rows it is given, from the generated index to the palette's own, so the ranking is
 * testable without a browser and the palette component holds nothing but state and keyboard wiring.
 */

/** Anything the palette ranks: a page of the index, a demo, a setting or a command. */
export type Searchable = {
  readonly title: string;
  /** Extra match text, such as an import specifier or a component's name. */
  readonly keywords?: readonly string[];
  readonly description?: string;
};

type Fields = {
  title: string;
  keywords: string;
  description: string;
};

/**
 * Field weights. A title beats an import specifier beats prose, so typing `dial` puts
 * the Dialog page above a handbook page that merely mentions dialogs.
 */
const TITLE_PREFIX_SCORE = 8;
const TITLE_SCORE = 5;
const KEYWORD_SCORE = 3;
const DESCRIPTION_SCORE = 1;

const FIELDS = new WeakMap<Searchable, Fields>();

function fieldsFor(entry: Searchable): Fields {
  const cached = FIELDS.get(entry);
  if (cached !== undefined) {
    return cached;
  }
  const fields: Fields = {
    title: entry.title.toLowerCase(),
    keywords: entry.keywords?.join(" ").toLowerCase() ?? "",
    description: entry.description?.toLowerCase() ?? "",
  };
  FIELDS.set(entry, fields);
  return fields;
}

/** Zero means the token is absent, and one absent token drops the entry. */
function scoreToken(fields: Fields, token: string): number {
  if (fields.title.startsWith(token)) {
    return TITLE_PREFIX_SCORE;
  }
  if (fields.title.includes(token)) {
    return TITLE_SCORE;
  }
  if (fields.keywords.includes(token)) {
    return KEYWORD_SCORE;
  }
  if (fields.description.includes(token)) {
    return DESCRIPTION_SCORE;
  }
  return 0;
}

function scoreEntry(entry: Searchable, tokens: readonly string[]): number {
  const fields = fieldsFor(entry);
  let total = 0;
  for (const token of tokens) {
    const score = scoreToken(fields, token);
    if (score === 0) {
      return 0;
    }
    total += score;
  }
  return total;
}

/**
 * The tokens of a query: lower-cased and split on whitespace.
 *
 * @param query - What the user typed.
 * @returns The tokens, none for a blank query.
 */
export function queryTokens(query: string): readonly string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== "");
}

/**
 * Whether every token of a query appears in `text`, in any order, so `internal telinet` finds
 * "Telinet · Private · Internal". A blank query matches everything.
 *
 * @param text - The text a row shows.
 * @param query - What the user typed.
 */
export function matchesEveryToken(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return queryTokens(query).every((token) => haystack.includes(token));
}

/**
 * The entries that every token matches, best first. Every whitespace-separated token has to match
 * somewhere, so `dialog close` narrows rather than widens. Equal scores sort by title.
 *
 * @template Entry - The kind of row ranked.
 * @param entries - The rows to rank.
 * @param tokens - The query's tokens, from `queryTokens`; at least one.
 * @param limit - How many rows to keep at most.
 * @returns The matching rows, best first, at most `limit`.
 */
export function rankEntries<Entry extends Searchable>(
  entries: readonly Entry[],
  tokens: readonly string[],
  limit: number
): readonly Entry[] {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((hit) => hit.score > 0)
    .sort((left, right) =>
      right.score === left.score
        ? left.entry.title.localeCompare(right.entry.title)
        : right.score - left.score
    )
    .slice(0, limit)
    .map((hit) => hit.entry);
}
