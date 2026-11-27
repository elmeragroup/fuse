/**
 * The anchor ids the docs site gives its page sections. The rendered pages and the generation
 * pass, which writes the same ids into the docs catalog, both read them here. This module imports
 * nothing generated, so the generation pass can load it before it has written anything.
 */

/** The id of the page title, which the catalog gives the lead section of each document. */
export const OVERVIEW_SECTION_ID = "overview";

/** The id of a component page's API reference heading. */
export const API_SECTION_ID = "api-reference";

/** The id of a component page's Tokens consumed heading. */
export const TOKENS_SECTION_ID = "tokens-consumed";

/** Anchor id for one compound part's generated API table. */
export function apiPartAnchor(partName: string): string {
  return `api-${partName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * Anchor id for one prop row of a part's reference, so a single prop is linkable.
 *
 * The prop keeps its own casing, so `#api-button-isVisuallyDisabled` reads as the prop it names.
 * A row that a hash points at opens itself.
 */
export function apiPropAnchor(partName: string, propName: string): string {
  return `${apiPartAnchor(partName)}-${propName}`;
}
