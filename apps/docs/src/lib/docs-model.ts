/**
 * Shared shapes for the docs generation pipeline.
 *
 * Everything here is produced at docs build time from library sources; nothing in
 * this model is ever hand-authored.
 */

import type {
  Density,
  DensityAttributes,
  ThemeAttributes,
  ThemeInput,
  ThemeSlug,
} from "@elmeragroup/fuse/theme";
import type {
  ApiPart,
  ApiProp,
  ApiPropOrigin,
  ComponentApiArtifact,
  RscStatus,
} from "@elmeragroup/internal/api-artifacts/model";

/**
 * The API artifact model is the generator's (`@elmeragroup/internal`), re-exported so the
 * writer (`scripts/lib/api-artifact.ts`), the drift check and the render-time reader
 * (`api-source.ts`) share one shape with the package that produces it. In brief:
 *
 * - `RscStatus` — RSC classification of the module that declares a part.
 * - `ApiPropOrigin` — `declared` (written in `packages/fuse`, so JSDoc-gated), `recipe-axis`
 *   (synthesised by `VariantProps` over a `tv` recipe; the printed type *is* the
 *   documentation) or `{ packageName }` (inherited from that dependency's declaration).
 * - `ApiProp` — one table row. `shortType` is the one-line stand-in a *closed* row shows
 *   (`"function"` for handlers, `"Union"` for long unions, `null` when `type` is short
 *   enough); `defaultValue` is the wrapper's destructuring default, then the dependency's
 *   JSDoc default, or `null`. Generation fails when a `declared` prop has no `description`.
 * - `ApiPart` — one compound part (or the single part of a non-compound component), with
 *   its declaring module's `rsc` and repo-relative `sourcePath`, and the `forwardedFrom`
 *   packages / `forwardedCount` props the table omits.
 * - `ComponentApiArtifact` — the committed `api.json`: a `$generated` banner (a note for
 *   readers, not data), the `slug`, and the `parts`.
 */
export type { ApiPart, ApiProp, ApiPropOrigin, ComponentApiArtifact, RscStatus };

/** Dependency deliberately selected for production API-reference enrichment. */
export const BASE_UI_PACKAGE_NAME = "@base-ui/react";

/** The command that rewrites every committed `api.json` — named by the artifact's own banner
 * and by every failure that blames a stale or missing one. */
export const API_REGEN_COMMAND = "pnpm --filter docs generate";

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
 * embed its source verbatim, so the generation pass reads the file the page imports.
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
 * One component page in the site manifest the browser gets.
 *
 * Deliberately *not* the page's content: the prose, the demo frames and the API reference
 * all come from the authored `page.mdx`, the demo files and the committed `api.json`. What
 * is left is the metadata no single artifact owns — the page's identity (title, lede,
 * source links), its TOC skeleton, and the tokens its recipe reads — read by the nav,
 * the intro, the QuickNav and the page's `metadata` export.
 *
 * The import specifier and the page's RSC status are absent on purpose: the generation pass
 * is their only reader, so they live on `DocsComponent` and never reach the browser.
 *
 * `partNames` is TOC material, not API data: an anchor per part heading the reference
 * renders. The reference itself never reads this — it reads `api.json`.
 */
export type ComponentPageEntry = {
  slug: string;
  title: string;
  lede: string;
  /** Repo-relative path of the component implementation, for **View source**. */
  sourcePath: string;
  /** Absolute URL of the component implementation on the repo host. */
  sourceUrl: string;
  /** Site-relative URL of the generated markdown endpoint. */
  markdownUrl: string;
  headings: readonly ContentHeading[];
  demos: readonly DemoRef[];
  /** Names of the API parts the reference renders, in order — one TOC anchor each. */
  partNames: readonly string[];
  tokens: readonly TokenRef[];
};

/**
 * One component as the *generation pass* holds it: the manifest entry plus the facts only
 * the generated markdown and the search index need — the import specifier, the page's RSC
 * status, every demo's verbatim source and the full API model.
 *
 * None of those is shipped to the browser: the manifest carries the page's metadata, the
 * page reads its demos and its `api.json` at render time. This type exists for the length of
 * one generation run, feeding the markdown endpoints, `llms.txt` and the search index.
 */
export type DocsComponent = Omit<ComponentPageEntry, "demos" | "partNames"> & {
  /** Public import specifier, e.g. `@elmeragroup/fuse/button`. */
  entry: string;
  /**
   * The page's RSC status, read from its implementation module's own directive
   * and published by the markdown endpoint.
   */
  rsc: RscStatus;
  demos: readonly DocsDemo[];
  parts: readonly ApiPart[];
};

/** The manifest entry of a component the generation pass just described. */
export function toPageEntry(component: DocsComponent): ComponentPageEntry {
  return {
    slug: component.slug,
    title: component.title,
    lede: component.lede,
    sourcePath: component.sourcePath,
    sourceUrl: component.sourceUrl,
    markdownUrl: component.markdownUrl,
    headings: component.headings,
    demos: component.demos.map((demo) => ({ id: demo.id, title: demo.title })),
    partNames: component.parts.map((part) => part.name),
    tokens: component.tokens,
  };
}

/** Which SideNav group a search hit belongs to; the palette shows it next to the title. */
export type SearchGroup = "Overview" | "Handbook" | "Components";

/**
 * One destination in the ⌘K palette index.
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

/** CSS custom-property map: `--${token}` keys, composeTheme strings as values. */
export type ThemeCatalogTokenMap = {
  [Name in string as `--${Name}`]: string;
};

export type ThemeCatalogEntry = {
  slug: ThemeSlug;
  variant: ThemeInput["variant"];
  brand: ThemeInput["brand"];
  segment: ThemeInput["segment"];
  density: Density;
  attributes: ThemeAttributes & DensityAttributes;
  tokens: ThemeCatalogTokenMap;
};

/** Static `GET /api/themes` payload. */
export type ThemeCatalog = {
  legalThemeCount: number;
  themes: readonly ThemeCatalogEntry[];
  primitives: ThemeCatalogTokenMap;
};

/** sRGB color object Figma's native DTCG importer accepts. */
export type FigmaSrgbColor = {
  colorSpace: "srgb";
  components: readonly [number, number, number];
  alpha: number;
  hex: string;
};

export type FigmaColorToken = {
  $type: "color";
  $value: FigmaSrgbColor | `{${string}}`;
};

export type FigmaDimensionToken = {
  $type: "dimension";
  $value: { value: number; unit: "px" };
};

export type FigmaFontToken = {
  $type: "fontFamily";
  $value: string;
};

/** One DTCG file = one Figma variable mode. */
export type FigmaThemeDocument = {
  color: {
    $type: "color";
    [name: string]: "color" | FigmaColorToken;
  };
  size: {
    $type: "dimension";
    [name: string]: "dimension" | FigmaDimensionToken;
  };
  font: {
    $type: "fontFamily";
    [name: string]: "fontFamily" | FigmaFontToken;
  };
};

export type FigmaThemeIndexFile = {
  slug: string;
  href: string;
};

export type FigmaThemeIndex = {
  format: "figma";
  files: readonly FigmaThemeIndexFile[];
};

/** What kind of artifact a budgeted entry measures. */
export type BundleEntryKind = "js" | "css";

/**
 * One published entry's measured min+gzip size against the ceiling `size-limit`
 * enforces. Both numbers come from the library's budget module.
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

/** The dependency that owns a prop, or `null` for library-authored and recipe props. */
export function dependencyPackageName(origin: ApiPropOrigin): string | null {
  return origin === "declared" || origin === "recipe-axis" ? null : origin.packageName;
}

/** One source group shared by the HTML and Markdown API-reference consumers. */
export type ApiPropGroup = {
  key: string;
  label: string | null;
  props: readonly ApiProp[];
};

function dependencyPropGroupLabel(packageName: string): string {
  return packageName === BASE_UI_PACKAGE_NAME ? "Base UI primitive props" : `${packageName} props`;
}

/** Keeps library props first, then one stable group per selected dependency. */
export function groupApiProps(props: readonly ApiProp[]): readonly ApiPropGroup[] {
  const groups = new Map<string, { label: string | null; props: ApiProp[] }>();
  for (const prop of props) {
    const packageName = dependencyPackageName(prop.origin);
    const key = packageName ?? "library";
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        label: packageName === null ? null : dependencyPropGroupLabel(packageName),
        props: [prop],
      });
    } else {
      existing.props.push(prop);
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}
