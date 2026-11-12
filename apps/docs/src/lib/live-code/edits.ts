/**
 * What a Live code edit does to a demo's source. The Code view draws each plan and Copy writes
 * it, so the code a reader sees is the code they copy.
 */

import type { Site } from "./sites";

/** A prop value the Code view sets: an enum option or a boolean. */
export type PropValue = string | boolean;

/** One site's edits: prop name to value, in the order the reader made them. */
export type SiteEdits = ReadonlyMap<string, PropValue>;

/** A frame's edits, keyed by site `loc`. */
export type FrameEdits = ReadonlyMap<string, SiteEdits>;

/** What the edits do to one site: the attributes it rewrites, and the props it gains. */
export type SitePlan = {
  /**
   * Each attribute the source writes and the reader changed, by name: its new text, or `null`
   * when it moves to `added` because a later spread would override it in place.
   */
  readonly attributes: ReadonlyMap<string, string | null>;
  /** Props the source does not write, as their attribute text, in edit order. */
  readonly added: readonly { readonly name: string; readonly text: string }[];
};

/**
 * One prop as JSX attribute text. `true` is the bare name, `false` is written out as `{false}`,
 * since leaving it out can restore a `true` default, and a string is quoted.
 *
 * @param name - The prop name.
 * @param value - The value the reader set.
 * @returns The attribute, such as `variant="outline"` or `withIcon={false}`.
 */
export function attributeText(name: string, value: PropValue): string {
  if (value === true) return name;
  if (value === false) return `${name}={false}`;
  return `${name}="${value}"`;
}

/**
 * The plan for one site under its edits. An edit rewrites a prop the source writes in place. A
 * prop the source does not write goes at the site's `insertAt`, after the last spread, and so
 * does a written prop a later spread would override.
 *
 * @param site - The site, as `findSites` read it.
 * @param edits - The site's edits, or `undefined` when it has none.
 * @returns What the edits change.
 */
export function planSite(site: Site, edits: SiteEdits | undefined): SitePlan {
  const attributes = new Map<string, string | null>();
  const added: { name: string; text: string }[] = [];
  for (const [name, value] of edits ?? []) {
    const written = site.attributes.find((attribute) => attribute.name === name);
    const text = attributeText(name, value);
    if (written !== undefined && written.start >= site.insertAt) {
      attributes.set(name, text);
      continue;
    }
    if (written !== undefined) attributes.set(name, null);
    added.push({ name, text });
  }
  return { attributes, added };
}

/** One replacement of a source range: `[start, end)` becomes `text`. */
export type SourceEdit = { readonly start: number; readonly end: number; readonly text: string };

/**
 * Applies replacements to a source, back to front, so each one's offsets hold. The ranges index
 * the original source and must not overlap; an insertion may sit at the end of a replaced range.
 *
 * @param source - The original source.
 * @param edits - The replacements, in any order.
 * @returns The edited source.
 */
export function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let out = source;
  for (const { start, end, text } of edits.toSorted((left, right) => right.start - left.start)) {
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}

/** Where an attribute's leading whitespace starts, so removing it leaves no gap. */
function removalStart(source: string, start: number): number {
  let at = start;
  while (at > 0 && /\s/u.test(source[at - 1] ?? "")) at -= 1;
  return at;
}

/**
 * The demo's source with the frame's edits written in, as Copy puts it on the clipboard.
 *
 * @param source - The demo's source, the text `sites` was read from.
 * @param sites - Its sites, from `findSites`.
 * @param edits - The frame's edits.
 * @returns The edited source, or `source` itself when there are no edits.
 */
export function editedSource(source: string, sites: readonly Site[], edits: FrameEdits): string {
  const replacements: SourceEdit[] = [];
  for (const site of sites) {
    const plan = planSite(site, edits.get(site.loc));
    if (plan.added.length > 0) {
      const text = plan.added.map((prop) => ` ${prop.text}`).join("");
      replacements.push({ start: site.insertAt, end: site.insertAt, text });
    }
    for (const attribute of site.attributes) {
      const text = plan.attributes.get(attribute.name);
      if (text === undefined) continue;
      replacements.push(
        text === null
          ? { start: removalStart(source, attribute.start), end: attribute.end, text: "" }
          : { start: attribute.start, end: attribute.end, text }
      );
    }
  }
  return applyEdits(source, replacements);
}
