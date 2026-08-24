/**
 * What one API reference row *is*, as types and constants only (docs-site.md §8).
 *
 * The accordion is the page's only client component, and it needs two things from the view
 * layer: the shape of a row and the string a missing default renders as. Both live here, in a
 * module with no runtime imports at all, so importing them cannot drag the server-only
 * highlighter (`sugar-high`, imported by `api-view.ts`) onto the client graph. `api-view.ts`
 * builds these rows on the server; this module only says what they look like.
 */

/** What a missing default renders as (docs-site.md §8). */
export const NO_DEFAULT = "—";

/** One expandable prop row, entirely as strings. */
export type ApiPropView = {
  name: string;
  /** Anchor id of the row's `summary`; a hash pointing at it opens the row. */
  id: string;
  required: boolean;
  /**
   * The one line the *closed* row shows in the Type column: the generator's `shortType`
   * when it collapsed the printed type, otherwise the printed type itself.
   */
  closedType: string;
  /** The full printed signature, highlighted for the expanded panel. */
  signatureHtml: string;
  /** The default as written, or `null` when there is none — the row then shows an em-dash. */
  defaultValue: string | null;
  /** JSDoc description, or the recipe-axis stand-in. Markdown-ish: may contain code spans. */
  description: string;
  /** The composed label a screen reader hears instead of the row's four cells. */
  label: string;
};
