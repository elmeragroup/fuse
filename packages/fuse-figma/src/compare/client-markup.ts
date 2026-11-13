/**
 * The markup check of a client cell. `renderToStaticMarkup` cannot reach a portalled popup, so the
 * run reads the markup the compare page mounted, before it forces any state, and checks it with the
 * markup check the static sets' tests use, which reports the differences it finds. A popup part or a row is checked in its slot's whole HTML.
 * An open composite has no one element around its trigger and its popup, since the popup portals
 * beside the trigger, so it is checked as its measured elements under one root that carries the
 * composite's `data-slot`, as its Figma frame holds both.
 */

import type { ComponentDefinition } from "../components/component-spec.ts";
import type { MountedHtml } from "./browser-render.ts";
import { checkMountedMarkup } from "./markup-check.ts";
import type { MarkupDiagnostic } from "./markup-check.ts";

/**
 * The markup the check reads for a client cell.
 *
 * @param slot - The definition's root slot.
 * @param union - The `data-slot` of each element an open composite's box spans, undefined for a
 *   popup part or a row.
 * @param mounted - The slot's HTML and each measured element's, as the page mounted them.
 * @returns The slot's HTML, or the composite's measured elements under one root.
 */
export function mountedMarkup(
  slot: string,
  union: readonly string[] | undefined,
  mounted: MountedHtml
): string {
  if (union === undefined) {
    return mounted.slot;
  }
  const value = slot.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return `<div data-slot="${value}">${mounted.measured.join("")}</div>`;
}

/**
 * Check a client cell's mounted markup against its definition.
 *
 * @param definition - The cell's definition.
 * @param union - The `data-slot`s an open composite's renderer names, undefined otherwise.
 * @param cell - The parsed cell.
 * @param mounted - The markup the page mounted for the cell.
 * @returns The first difference, naming the cell, or none where the markup holds what the
 *   definition says.
 */
export function checkClientMarkup(
  definition: ComponentDefinition,
  union: readonly string[] | undefined,
  cell: Readonly<Record<string, string>>,
  mounted: MountedHtml
): readonly MarkupDiagnostic[] {
  return checkMountedMarkup(definition, cell, mountedMarkup(definition.slot, union, mounted));
}
