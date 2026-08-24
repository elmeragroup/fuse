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
  /**
   * One-line stand-in a *closed* reference row shows instead of `type` — `"function"`
   * for handlers, `"Union"` for long or many-branched unions (docs-site.md §8). `null`
   * means the printed type is short enough to show as it is; the expanded panel always
   * shows `type` either way.
   */
  shortType: string | null;
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

/** The command that rewrites every committed `api.json` — named by the artifact's own banner
 * and by every failure that blames a stale or missing one (docs-site.md §8). */
export const API_REGEN_COMMAND = "pnpm --filter docs generate";

/**
 * One component's committed API artifact: the `api.json` next to its `page.mdx`
 * (docs-site.md §8).
 *
 * Generated from the library's types and JSDoc, committed so an API change is a reviewable
 * diff, and read back verbatim by the page's reference — so the shape is shared by the
 * writer (`scripts/lib/api-artifact.ts`), the drift check, and the render-time reader
 * (`api-source.ts`).
 */
export type ComponentApiArtifact = {
  /** Says the file is generated and how to regenerate it. Not data — a banner for readers. */
  $generated: string;
  slug: string;
  parts: readonly ApiPart[];
};

/** A CSS custom property the component's recipe reads. */
export type TokenRef = {
  name: string;
  isColor: boolean;
};

/**
 * One demo of a component page as the *site* refers to it: the on-page TOC needs an anchor
 * and a label, and nothing more. The frame itself is the `<Demo>` element the page authored,
 * and the source it shows is read from the demo file at render time (`demo-source.ts`).
 */
export type DemoRef = {
  /** Stable anchor id, unique inside the page. */
  id: string;
  title: string;
};

/**
 * One authored `.tsx` demo as the *generated markdown* sees it: the endpoint and `llms.txt`
 * embed its source verbatim (§9), so the generation pass reads the file the page imports.
 *
 * This never reaches the browser — it exists only inside the generation pass and the
 * markdown it writes.
 */
export type DocsDemo = DemoRef & {
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

/**
 * One component page in the site manifest the browser gets (docs-site.md §3.3, §3.4).
 *
 * Deliberately *not* the page's content: the prose, the demo frames and the API reference
 * all come from the authored `page.mdx`, the demo files and the committed `api.json`. What
 * is left is the metadata no single artifact owns — the page's identity (title, lede, import
 * line, source links), its TOC skeleton, and the tokens its recipe reads — read by the nav,
 * the intro, the QuickNav and the page's `metadata` export.
 *
 * `partNames` is TOC material, not API data: an anchor per part heading the reference
 * renders. The reference itself never reads this — it reads `api.json` (§8).
 */
export type ComponentPageEntry = {
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
  demos: readonly DemoRef[];
  /** Names of the API parts the reference renders, in order — one TOC anchor each. */
  partNames: readonly string[];
  tokens: readonly TokenRef[];
};

/**
 * One component as the *generation pass* holds it: the manifest entry plus the two things
 * only the generated markdown needs — every demo's verbatim source and the full API model.
 *
 * Neither of those is shipped to the browser: the manifest carries the page's metadata, the
 * page reads its demos and its `api.json` at render time. This type exists for the length of
 * one generation run, feeding the markdown endpoints, `llms.txt` and the search index.
 */
export type DocsComponent = Omit<ComponentPageEntry, "demos" | "partNames"> & {
  demos: readonly DocsDemo[];
  parts: readonly ApiPart[];
};

/** The manifest entry of a component the generation pass just described. */
export function toPageEntry(component: DocsComponent): ComponentPageEntry {
  return {
    slug: component.slug,
    title: component.title,
    lede: component.lede,
    entry: component.entry,
    exportName: component.exportName,
    sourcePath: component.sourcePath,
    sourceUrl: component.sourceUrl,
    markdownUrl: component.markdownUrl,
    rsc: component.rsc,
    headings: component.headings,
    demos: component.demos.map((demo) => ({ id: demo.id, title: demo.title })),
    partNames: component.parts.map((part) => part.name),
    tokens: component.tokens,
  };
}

/** Which SideNav group a search hit belongs to; the palette shows it next to the title. */
export type SearchGroup = "Overview" | "Handbook" | "Components";

/**
 * One destination in the ⌘K palette index (docs-site.md §3.2).
 *
 * Emitted by the docs generation pass from the two inventories the SideNav and `llms.txt`
 * already share — the authored page manifest and the globbed component pages — so the
 * palette can never list a route that does not exist, and a new component page becomes
 * searchable the moment its `page.mdx` lands.
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
