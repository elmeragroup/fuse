/**
 * Shared shapes for the docs generation pipeline.
 *
 * Everything here is produced at docs build time from library sources; nothing in
 * this model is ever hand-authored (docs-site.md §3.4, §6, §8).
 */

/** RSC classification of the module that declares a compound part (performance.md §3). */
export type RscStatus = "client" | "server";

/**
 * Where a documented prop comes from.
 *
 * - `declared` — written in `packages/ui` source, so it carries JSDoc and is gated on it.
 * - `recipe-axis` — synthesised by `VariantProps` over a library `tv` recipe. It has no
 *   declaration site to hang JSDoc on; its printed type *is* the documentation.
 */
export type ApiPropOrigin = "declared" | "recipe-axis";

/** One public prop row of a generated API table. */
export type ApiProp = {
  name: string;
  origin: ApiPropOrigin;
  /** Fully resolved type text, as the checker prints it. */
  type: string;
  /** Destructuring default from the part's implementation, or `null` when there is none. */
  defaultValue: string | null;
  /**
   * JSDoc description. Generation fails when a `declared` prop leaves this empty
   * (docs-site.md §8); a `recipe-axis` prop has no declaration to document.
   */
  description: string;
  required: boolean;
};

/** One compound part (or the single part of a non-compound component). */
export type ApiPart = {
  /** Display name, e.g. `Dialog.Content` or `Button`. */
  name: string;
  /** RSC status of the source module that declares this part. */
  rsc: RscStatus;
  /** Path of the declaring source file, repo-relative. */
  sourcePath: string;
  props: readonly ApiProp[];
  /** Packages whose props this part forwards, e.g. `@base-ui/react`. */
  forwardedFrom: readonly string[];
  /** How many forwarded props were omitted from the table. */
  forwardedCount: number;
};

/** A CSS custom property the component's recipe reads. */
export type TokenRef = {
  name: string;
  isColor: boolean;
};

/**
 * One authored `.tsx` demo of a component page, as the *generated* outputs see it: the
 * on-page TOC needs its id and title, and the markdown endpoint plus `llms.txt` embed its
 * source verbatim (§9).
 *
 * The rendered page needs none of this. It imports the demo module and the frame reads the
 * same file from disk (`demo-source.ts`), so no highlighted markup travels through here.
 */
export type DocsDemo = {
  /** Stable anchor id, unique inside the page. */
  id: string;
  title: string;
  /** Repo-relative path of the authored demo file. */
  sourcePath: string;
  /** Verbatim demo source, normalised by `normalizeDemoSource`. */
  source: string;
};

/**
 * The one normalisation applied to a demo file's bytes on its way to a reader.
 *
 * Both readers of a demo file go through this: the generation pass, which embeds the
 * source in the markdown endpoint and `llms.txt`, and the frame, which reads the same
 * file at render time (`demo-source.ts`). They must agree byte-for-byte — a reader who
 * copies from the page and a reader who fetches the `.md` are entitled to the same code —
 * so the trim lives here rather than being spelled twice.
 */
export function normalizeDemoSource(raw: string): string {
  return raw.replace(/\s+$/, "");
}

/** A heading contributed by the page's authored prose, for the on-page TOC. */
export type ContentHeading = {
  id: string;
  title: string;
  depth: number;
};

/** Everything a component page needs. */
export type DocsComponent = {
  slug: string;
  title: string;
  lede: string;
  /** Public import specifier, e.g. `@elmeragroup/ui/button`. */
  entry: string;
  /** The identifier the entry facade exports, e.g. `Button` or `Dialog`. */
  exportName: string;
  /** Repo-relative path of the component implementation, for **View source**. */
  sourcePath: string;
  /** Absolute URL of the component implementation on the repo host. */
  sourceUrl: string;
  /** Site-relative URL of the generated markdown endpoint (docs-site.md §9). */
  markdownUrl: string;
  rsc: RscStatus;
  headings: readonly ContentHeading[];
  demos: readonly DocsDemo[];
  parts: readonly ApiPart[];
  tokens: readonly TokenRef[];
};

/** Which SideNav group a search hit belongs to; the palette shows it next to the title. */
export type SearchGroup = "Overview" | "Handbook" | "Components";

/**
 * One destination in the ⌘K palette index (docs-site.md §3.2).
 *
 * Emitted by the docs generation pass from the two inventories the SideNav and
 * `llms.txt` already share — the authored page manifest and the generated component
 * registry — so the palette can never list a route that does not exist, and a new
 * component page becomes searchable the moment its MDX shell lands.
 */
export type SearchEntry = {
  /** Site-relative route the palette navigates to. */
  href: string;
  title: string;
  group: SearchGroup;
  /** The page's one-line description (static pages) or lede (component pages). */
  description: string;
  /** Extra match text — slug, import specifier, API part names, demo titles. */
  keywords: readonly string[];
};

/** What kind of artifact a budgeted entry measures. */
export type BundleEntryKind = "js" | "css";

/**
 * One published entry's measured min+gzip size against the ceiling `size-limit`
 * enforces (performance.md §2). Both numbers come from the library's budget module.
 */
export type BundleSize = {
  /** Budget name, e.g. `button`, `icons/Check`, `styles.css`, or `.` for the root barrel. */
  name: string;
  kind: BundleEntryKind;
  measuredGzip: number;
  ceilingGzip: number;
};

/** How much of an entry's ceiling its last measurement used, as a 0–1 fraction. */
export function ceilingUsage(entry: BundleSize): number {
  return entry.ceilingGzip === 0 ? 1 : entry.measuredGzip / entry.ceilingGzip;
}

/**
 * What an API table shows in the description cell. A recipe axis carries no JSDoc —
 * its printed union in the type column is the documentation — so it is labelled as such
 * instead of rendering an empty cell.
 */
export function propDescription(prop: ApiProp): string {
  if (prop.description !== "") {
    return prop.description;
  }
  return prop.origin === "recipe-axis" ? "Recipe axis." : "";
}
