/**
 * One reference per component across pages that read one entry.
 *
 * Every chart page documents a namespace of `@elmeragroup/fuse/chart`, and the namespaces share
 * parts, so each committed `api.json` repeats them. The artifacts stay complete, because the
 * drift check compares them byte for byte. The page model removes the repetition instead. A part
 * whose member name and declaring module equal a part on an earlier page is that part, because a
 * shared part lives in a file that declares no family-specific part, which a Fuse unit test guards.
 */

import type { ApiPart } from "./docs-model";

/** The part on an earlier page that a repeated part is. */
export type ApiSameAs = {
  /** The owner page's slug. */
  readonly slug: string;
  /** The owner part's name, such as `Chart.Tooltip`. */
  readonly name: string;
};

/** What one shared-entry page's reference reads from the generation pass. */
export type ApiPageSameAs = {
  /** The page this page repeats whole, or null when some part is its own. */
  readonly alias: string | null;
  /** The owner of each part the page repeats, keyed by the part's own name. */
  readonly parts: Readonly<Partial<Record<string, ApiSameAs>>>;
};

/** A page's parts as the dedupe reads them, in page order. */
export type SameAsPage = {
  readonly slug: string;
  readonly parts: readonly Pick<ApiPart, "name" | "sourcePath">[];
};

/** The part's key inside its namespace, so `PieChart.Tooltip` is `Tooltip` and `Sparkline` stays whole. */
function memberName(partName: string): string {
  const dot = partName.indexOf(".");
  return dot === -1 ? partName : partName.slice(dot + 1);
}

/**
 * Links each repeated part to its owner, the first page in `pages` order with a part of the same
 * member name and declaring module.
 *
 * @param pages - The pages that share one entry, in the order that ranks their owners.
 * @returns Per page slug, the owner of each repeated part, keyed by the part's own name. Owner
 * parts and pages with no repeated part have no entry.
 */
export function sameAsLinks(
  pages: readonly SameAsPage[]
): ReadonlyMap<string, ReadonlyMap<string, ApiSameAs>> {
  const owners = new Map<string, ApiSameAs>();
  const links = new Map<string, Map<string, ApiSameAs>>();
  for (const page of pages) {
    for (const part of page.parts) {
      const key = `${part.sourcePath}\u0000${memberName(part.name)}`;
      const owner = owners.get(key);
      if (owner === undefined) {
        owners.set(key, { slug: page.slug, name: part.name });
        continue;
      }
      const pageLinks = links.get(page.slug) ?? new Map<string, ApiSameAs>();
      pageLinks.set(part.name, owner);
      links.set(page.slug, pageLinks);
    }
  }
  return links;
}

/**
 * The page a whole page repeats, when every one of its parts is a part of that one page, as an
 * alias namespace's page repeats the `chart` page.
 *
 * @param partNames - The page's part names.
 * @param links - The page's owner links from {@link sameAsLinks}.
 * @returns The owner page's slug, or `undefined` when any part is the page's own or the parts
 * come from several pages.
 */
export function aliasOf(
  partNames: readonly string[],
  links: ReadonlyMap<string, ApiSameAs> | undefined
): string | undefined {
  const slugs = new Set(partNames.map((name) => links?.get(name)?.slug));
  const [only] = slugs;
  return partNames.length > 0 && slugs.size === 1 ? only : undefined;
}

/** The namespace a part belongs to, such as `BarChart` for `BarChart.Root`. */
export function namespaceOf(partName: string): string {
  const dot = partName.indexOf(".");
  return dot === -1 ? partName : partName.slice(0, dot);
}
