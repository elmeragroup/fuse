/**
 * One reference per component across pages that read one entry.
 *
 * Every chart page documents a namespace of `@elmeragroup/fuse/chart`, and the namespaces share
 * parts. A part is an earlier page's part exactly when both resolve to the same declaration, which
 * the generation pass reads from the entry itself. A page whose namespace resolves to an earlier
 * page's declarations under the same keys is that page under another name, and it has no API
 * artifact of its own.
 */

/** The part on an earlier page that a repeated part is. */
export type ApiSameAs = {
  /** The owner page's slug. */
  readonly slug: string;
  /** The owner part's name, such as `Chart.Tooltip`. */
  readonly name: string;
};

/** The page a whole page repeats under another name. */
export type ApiAlias = {
  /** The owner page's slug. */
  readonly slug: string;
  /** The page's own namespace, such as `BarChart`. */
  readonly name: string;
  /** The owner page's namespace, such as `Chart`. */
  readonly owner: string;
};

/** What one shared-entry page's reference reads from the generation pass. */
export type ApiPageSameAs = {
  /** The page this page repeats whole, or null when some part is its own. */
  readonly alias: ApiAlias | null;
  /** The owner of each part the page repeats, keyed by the part's own name. */
  readonly parts: Readonly<Partial<Record<string, ApiSameAs>>>;
};

/** A page's parts as the dedupe reads them: each part's name and its declaration, in page order. */
export type SameAsPage = {
  readonly slug: string;
  readonly parts: ReadonlyMap<string, unknown>;
};

/** The part's key inside its namespace, so `PieChart.Tooltip` is `Tooltip` and `Sparkline` stays whole. */
function memberName(partName: string): string {
  const dot = partName.indexOf(".");
  return dot === -1 ? partName : partName.slice(dot + 1);
}

/** The namespace a part belongs to, such as `BarChart` for `BarChart.Root`. */
function namespaceOf(partName: string): string {
  const dot = partName.indexOf(".");
  return dot === -1 ? partName : partName.slice(0, dot);
}

/** A page's first namespace and that namespace's parts by member key, or undefined for no parts. */
function namespaceMembers(page: SameAsPage): { name: string; members: Map<string, unknown> } | undefined {
  const [first] = page.parts.keys();
  if (first === undefined) return undefined;
  const name = namespaceOf(first);
  const members = new Map(
    [...page.parts]
      .filter(([part]) => part.includes(".") && namespaceOf(part) === name)
      .map(([part, declaration]) => [memberName(part), declaration])
  );
  return { name, members };
}

/**
 * The pages that repeat an earlier page whole, each with the first such page in `pages` order. A
 * page repeats another when its namespace holds the same declarations under the same keys as the
 * other page's first namespace, so the `chart` page's functions beside `Chart` don't count.
 *
 * @param pages - The pages that share one entry, in the order that ranks their owners.
 * @returns Per alias page slug, the page it repeats.
 */
export function pageAliases(pages: readonly SameAsPage[]): ReadonlyMap<string, ApiAlias> {
  const aliases = new Map<string, ApiAlias>();
  pages.forEach((page, index) => {
    const own = namespaceMembers(page);
    if (own === undefined || own.members.size === 0 || own.members.size !== page.parts.size) return;
    for (const candidate of pages.slice(0, index)) {
      const owner = aliases.has(candidate.slug) ? undefined : namespaceMembers(candidate);
      if (
        owner !== undefined &&
        owner.members.size === own.members.size &&
        [...own.members].every(([key, declaration]) => owner.members.get(key) === declaration)
      ) {
        aliases.set(page.slug, { slug: candidate.slug, name: own.name, owner: owner.name });
        return;
      }
    }
  });
  return aliases;
}

/**
 * Links each repeated part to its owner, the first page in `pages` order with a part of the same
 * declaration.
 *
 * @param pages - The pages that share one entry, aliases left out, in the order that ranks their owners.
 * @returns Per page slug, the owner of each repeated part, keyed by the part's own name. Owner
 * parts and pages with no repeated part have no entry.
 */
export function sameAsLinks(
  pages: readonly SameAsPage[]
): ReadonlyMap<string, ReadonlyMap<string, ApiSameAs>> {
  const owners = new Map<unknown, ApiSameAs>();
  const links = new Map<string, Map<string, ApiSameAs>>();
  for (const page of pages) {
    for (const [name, declaration] of page.parts) {
      const owner = owners.get(declaration);
      if (owner === undefined) {
        owners.set(declaration, { slug: page.slug, name });
        continue;
      }
      const pageLinks = links.get(page.slug) ?? new Map<string, ApiSameAs>();
      pageLinks.set(name, owner);
      links.set(page.slug, pageLinks);
    }
  }
  return links;
}
