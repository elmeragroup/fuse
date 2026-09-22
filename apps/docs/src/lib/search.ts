/**
 * Matching for the ⌘K palette.
 *
 * Pure over the generated index, so the ranking is testable without a browser and the
 * palette component holds nothing but state and keyboard wiring.
 */

import { SEARCH_ENTRIES } from "../generated/search-index";
import type { SearchEntry } from "./docs-model";

/** How many hits the palette lists at once. */
export const SEARCH_RESULT_LIMIT = 20;

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

const FIELDS = new WeakMap<SearchEntry, Fields>();

function fieldsFor(entry: SearchEntry): Fields {
  const cached = FIELDS.get(entry);
  if (cached !== undefined) {
    return cached;
  }
  const fields: Fields = {
    title: entry.title.toLowerCase(),
    keywords: entry.keywords.join(" ").toLowerCase(),
    description: entry.description.toLowerCase(),
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

function scoreEntry(entry: SearchEntry, tokens: readonly string[]): number {
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
 * The hits for a query, best first.
 *
 * Every whitespace-separated token has to match somewhere, so `dialog close` narrows
 * rather than widens. An empty query is not an error state — it lists the site in nav
 * order, which is what the palette shows the moment it opens.
 */
export function matchSearchEntries(
  query: string,
  entries: readonly SearchEntry[] = SEARCH_ENTRIES
): readonly SearchEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== "");
  if (tokens.length === 0) {
    return entries.slice(0, SEARCH_RESULT_LIMIT);
  }
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((hit) => hit.score > 0)
    .sort((left, right) =>
      right.score === left.score
        ? left.entry.title.localeCompare(right.entry.title)
        : right.score - left.score
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((hit) => hit.entry);
}
