/**
 * What a Live code edit does to a demo's source. The Code view shows the edited source and Copy
 * writes it, from the same replacements, so the code a reader sees is the code they copy.
 */

import type { Site } from "./sites";

/** A prop value the stage editor sets: an enum option or a boolean. */
export type PropValue = string | boolean;

/** One site's edits: prop name to value, in the order the reader made them. */
export type SiteEdits = ReadonlyMap<string, PropValue>;

/** A frame's edits, keyed by site `loc`. */
export type FrameEdits = ReadonlyMap<string, SiteEdits>;

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
 * The replacements that write the frame's edits into the demo's source. The Code view applies
 * them to the source's highlighted markup, and `editedSource` to its text.
 *
 * @param source - The demo's source, the text `sites` was read from.
 * @param sites - Its sites, from `findSites`.
 * @param edits - The frame's edits.
 * @returns The replacements, indexing the original source, none of them overlapping.
 */
export function sourceEdits(
  source: string,
  sites: readonly Site[],
  edits: FrameEdits
): readonly SourceEdit[] {
  const replacements: SourceEdit[] = [];
  for (const site of sites) {
    // A prop the source writes is rewritten in place. One it does not write goes at `insertAt`,
    // after the last spread, and so does a written one a later spread would override, which
    // leaves its old place.
    let inserted = "";
    for (const [name, value] of edits.get(site.loc) ?? []) {
      const text = attributeText(name, value);
      const written = site.attributes.find((attribute) => attribute.name === name);
      if (written !== undefined && written.start >= site.insertAt) {
        replacements.push({ start: written.start, end: written.end, text });
        continue;
      }
      if (written !== undefined) {
        replacements.push({ start: removalStart(source, written.start), end: written.end, text: "" });
      }
      inserted += ` ${text}`;
    }
    if (inserted !== "") replacements.push({ start: site.insertAt, end: site.insertAt, text: inserted });
  }
  return replacements;
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
  return applyEdits(source, sourceEdits(source, sites, edits));
}
