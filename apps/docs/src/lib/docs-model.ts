/**
 * Shared shapes for the docs generation pipeline.
 *
 * Everything here is produced at docs build time from library sources; nothing in
 * this model is ever hand-authored (docs-site.md §3.4, §6, §8).
 */

import type { ComponentProps, ComponentType } from "react";

/** RSC classification of the module that declares a compound part (performance.md §3). */
export type RscStatus = "client" | "server";

/**
 * Element overrides a compiled MDX shell accepts. Heading anchors are stamped at build
 * time, so a page normally renders the shell with no overrides at all.
 */
export type MdxComponentOverrides = {
  a?: ComponentType<ComponentProps<"a">>;
  code?: ComponentType<ComponentProps<"code">>;
  h2?: ComponentType<ComponentProps<"h2">>;
  h3?: ComponentType<ComponentProps<"h3">>;
  pre?: ComponentType<ComponentProps<"pre">>;
};

export type MdxContentProps = {
  components?: MdxComponentOverrides;
};

/** Default export of a compiled MDX shell. */
export type MdxContent = ComponentType<MdxContentProps>;

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

/** One authored `.tsx` demo, extracted at docs build. */
export type DocsDemo = {
  /** Stable anchor id, unique inside the page. */
  id: string;
  title: string;
  /** Exported component name found in the demo module. */
  exportName: string;
  /** Repo-relative path of the authored demo file. */
  sourcePath: string;
  /** Verbatim demo source. */
  source: string;
  /** Syntax-highlighted HTML of `source`. */
  highlighted: string;
  /** Import path of the generated demo module, relative to `src/generated`. */
  modulePath: string;
};

/** A heading contributed by the MDX shell body, for the on-page TOC. */
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
  /** Whether the MDX shell has body prose beyond its frontmatter. */
  hasContent: boolean;
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
