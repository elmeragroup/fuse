/**
 * The docs catalog: every page of the docs site as ordered markdown sections, and the `/llms.txt`
 * index. The docs generation pass (`apps/docs/scripts/generate.ts`) writes it to
 * `apps/docs/src/generated/catalog.json`. Both sides come from one commit, so the schema has no
 * version field.
 */

import * as Schema from "effect/Schema";

/** One section of a document: an anchored heading and the markdown up to the next section. */
const Section = Schema.Struct({
  /**
   * The anchor the docs site gives this heading, such as `usage`, `examples`, a demo's id,
   * `api-reference`, an API part's anchor or `tokens-consumed`. The lead section is `overview`.
   */
  id: Schema.String,
  /**
   * 2 for the lead section and for a second-level heading. 3 for an anchored third-level heading
   * under one: a demo, an API part or a handbook subsection.
   */
  depth: Schema.Literals([2, 3]),
  /** This heading and the text up to the next section. A depth-2 section's children follow it. */
  markdown: Schema.String,
});

/** One page of the docs site. */
const Document = Schema.Struct({
  /** The canonical site-relative href, such as `/components/button`. */
  href: Schema.String,
  title: Schema.String,
  /** The search group the page belongs to, such as `Components` or `Handbook`. */
  group: Schema.String,
  description: Schema.String,
  /** Extra match text: slug, import specifiers, API part names and demo titles. */
  keywords: Schema.Array(Schema.String),
  /** The page's sections in page order. Empty for a page that has no markdown yet. */
  sections: Schema.Array(Section),
});

/** The whole docs catalog. */
export const Catalog = Schema.Struct({
  documents: Schema.Array(Document),
  /** The `/llms.txt` text. It sits outside `documents` so a search over them does not match it. */
  index: Schema.String,
});

/** The decoded docs catalog. */
export type Catalog = typeof Catalog.Type;

/** One page of the docs catalog. */
export type CatalogDocument = Catalog["documents"][number];

/** One anchored section of a catalog document. */
export type CatalogSection = CatalogDocument["sections"][number];
