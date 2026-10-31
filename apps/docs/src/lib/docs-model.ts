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
import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";
import type {
  ApiPart,
  ApiProp,
  ApiPropOrigin,
  ComponentApiArtifact,
  RscStatus,
} from "@elmeragroup/internal/api-artifacts/model";

import type { ApiAlias, ApiSameAs } from "./api-same-as";

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

/** What a client part's RSC status means for a page that composes it on the server. */
export const CLIENT_PART_NOTE = "A Server Component can still render it and pass it serialisable props.";

/** One parameter of a public function, as its reference lists it. */
export type ApiFunctionParameter = {
  readonly name: string;
  /** The printed parameter type. */
  readonly type: string;
  readonly optional: boolean;
  /** The parameter's `@param` text. */
  readonly description: string;
};

/**
 * A public function's reference, such as a hook's or a formatter's, which the props table cannot
 * describe. `scripts/lib/function-reference.ts` reads it from the library's types and JSDoc.
 */
export type ApiFunction = {
  /** The call signature as one line, such as `useChartPoint(): ChartPoint | null`. */
  readonly signature: string;
  /** The function's JSDoc description. */
  readonly description: string;
  readonly parameters: readonly ApiFunctionParameter[];
  /** The printed return type and the `@returns` text. */
  readonly returns: { readonly type: string; readonly description: string };
};

/**
 * One part as the generation pass holds it, which is the artifact's part with two additions. A part
 * that repeats a part of an earlier page reading the same entry links to that owner part, and a
 * function part carries its signature reference. The committed `api.json` carries neither, so the
 * artifacts stay complete.
 */
export type DocsApiPart = ApiPart & {
  /** The part on an earlier page that this part is. */
  readonly sameAs?: ApiSameAs;
  /** The function reference, when the part is a function rather than a component. */
  readonly function?: ApiFunction;
};

/** Dependency deliberately selected for production API-reference enrichment. */
const BASE_UI_PACKAGE_NAME = "@base-ui/react";

/** The command that rewrites every committed `api.json` — named by the artifact's own banner
 * and by every failure that blames a stale or missing one. */
export const API_REGEN_COMMAND = "pnpm --filter docs generate";

/** The one install command the quick start and the landing page show. */
export const INSTALL_COMMAND = "pnpm add @elmeragroup/fuse";

/** A CSS custom property the component's recipe reads. */
export type TokenRef = {
  name: string;
  isColor: boolean;
  /** What the token is for, from the theme catalog. Only the tokens handbook list carries it. */
  description?: string;
};

/**
 * One demo of a component page as the *site* refers to it: the on-page TOC needs an anchor
 * and a label, and nothing more. The frame itself is the `<Demo>` element the page authored,
 * and the source it shows is read from the demo file at render time (`demo-source.ts`).
 */
type DemoRef = {
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

/** One on-page TOC entry: the anchor it links and its label. */
export type TocItem = {
  id: string;
  title: string;
};

/**
 * One component page in the site manifest the server renders from.
 *
 * Deliberately *not* the page's content: the prose, the demo frames and the API reference
 * all come from the authored `page.mdx`, the demo files and the committed `api.json`. What
 * is left is the metadata no single artifact owns — the page's identity (title, lede,
 * source links) and the tokens its recipe reads — read by the intro, the Tokens-consumed
 * section, the page's `metadata` export and its Open Graph card. Client code reads
 * {@link ComponentOutline} instead, which holds the TOC skeleton and leaves out the token
 * lists.
 *
 * The import specifier and the page's RSC status are absent on purpose: the generation pass
 * is their only reader, so they live on `DocsComponent` and never reach the browser.
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
  tokens: readonly TokenRef[];
};

/**
 * One component page as client code gets it: what the SideNav, the QuickNav and the site palette
 * read on every surface, including the landing and the studio. It names the page, links its
 * markdown endpoint and holds its TOC skeleton.
 */
export type ComponentOutline = Pick<ComponentPageEntry, "slug" | "title" | "markdownUrl"> & {
  /** The page's depth-2 headings, in page order. Deeper headings stay out of the TOC. */
  headings: readonly TocItem[];
  demos: readonly DemoRef[];
  /**
   * Names of the API parts the reference renders, in order — one TOC anchor each. This is TOC
   * material, not API data: the reference itself never reads it, it reads `api.json`.
   */
  partNames: readonly string[];
  /** Whether the page renders a Tokens-consumed section, which its TOC then lists. */
  hasTokens: boolean;
};

/**
 * One component as the *generation pass* holds it: the manifest entry plus the facts the
 * generated outputs derive from — the import specifier, the page's RSC status, its headings,
 * every demo's verbatim source and the full API model.
 *
 * The client outline ships a slice of those: the depth-2 headings, each demo's id and title,
 * and the part names. The demo sources, the API model and the import specifier stay in the
 * generation run; the page reads its demos and its `api.json` at render time. This type exists
 * for the length of one generation run, feeding the manifest, the client outline, the markdown
 * endpoints, `llms.txt` and the search index.
 */
export type DocsComponent = ComponentPageEntry & {
  /** Public import specifier, e.g. `@elmeragroup/fuse/button`. */
  entry: string;
  /** The page's authored intro, the prose before its first demo, or `""` when it has none. */
  intro: string;
  /**
   * The page this page repeats whole, such as `chart` for `bar-chart`, when it is an alias. An
   * alias page has no API artifact and no parts of its own.
   */
  alias?: ApiAlias;
  /** An alias page's own part names, such as `BarChart.Root`, which its search entry matches. */
  aliasParts?: readonly string[];
  /**
   * The page's RSC status, read from its implementation module's own directive
   * and published by the markdown endpoint.
   */
  rsc: RscStatus;
  /** Every heading of the page's authored prose, in page order. */
  headings: readonly ContentHeading[];
  demos: readonly DocsDemo[];
  parts: readonly DocsApiPart[];
};

/**
 * Which group a search hit belongs to, a SideNav group or the studio; the palette shows it next
 * to the title.
 */
export type SearchGroup = "Overview" | "Handbook" | "Studio" | "Components";

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

/** One density metric as the tokens handbook prints it. */
export type DensityCatalogMetric = {
  /** The custom property without its leading dashes. */
  readonly name: string;
  /** The metric in px when dense, at the 16px root. */
  readonly dense: number;
  /** The metric in px when comfortable, at the 16px root. */
  readonly comfortable: number;
};

/** One density role, the metrics it reads and the parts that declare it. */
export type DensityCatalogRole = {
  /** The role. */
  readonly role: DensityRole;
  /** The metrics the role's parts read, in `fuse.css` order; none for `layout` and `fixed`. */
  readonly metrics: readonly DensityCatalogMetric[];
  /** The `PART_DENSITY` keys with this role, in table order. */
  readonly parts: readonly string[];
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
  $value: { value: number; unit: "px" } | `{${string}}`;
};

export type FigmaFontToken = {
  $type: "fontFamily";
  $value: string;
};

/** A CSS font weight, a number from 1 to 1000. */
export type FigmaFontWeightToken = {
  $type: "fontWeight";
  $value: number | `{${string}}`;
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
  weight: {
    $type: "fontWeight";
    [name: string]: "fontWeight" | FigmaFontWeightToken;
  };
};

type FigmaThemeIndexFile = {
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
function dependencyPackageName(origin: ApiPropOrigin): string | null {
  return origin === "declared" || origin === "recipe-axis" ? null : origin.packageName;
}

/** One source group shared by the HTML and Markdown API-reference consumers. */
type ApiPropGroup = {
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
