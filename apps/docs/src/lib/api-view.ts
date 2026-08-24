/**
 * Turning the committed API artifact into what a reference row displays (docs-site.md §8).
 *
 * The presentation contract asks each row three questions the artifact does not answer
 * literally: what one line stands in for the type while the row is closed, what a missing
 * default looks like, and what a screen reader hears from a single `summary`. Answering them
 * here keeps the accordion a rendering of ready strings — which is what lets the accordion be
 * the page's only client component while the highlighter, the artifact read and the em-dash
 * all stay on the server.
 */

import { highlight } from "sugar-high";

import type { ApiPart, ApiProp, RscStatus } from "./docs-model";
import { propDescription } from "./docs-model";
import { apiPartAnchor, apiPropAnchor } from "./nav";

/** What a missing default renders as (docs-site.md §8). */
export const NO_DEFAULT = "—";

/** One expandable prop row, entirely as strings. */
export type ApiPropView = {
  name: string;
  /** Anchor id of the row's `summary`; a hash pointing at it opens the row. */
  id: string;
  required: boolean;
  /**
   * The one line the *closed* row shows in the Type column: the generator's `shortType`
   * when it collapsed the printed type, otherwise the printed type itself.
   */
  closedType: string;
  /** The full printed signature, highlighted for the expanded panel. */
  signatureHtml: string;
  /** The default as written, or `null` when there is none — the row then shows an em-dash. */
  defaultValue: string | null;
  /** JSDoc description, or the recipe-axis stand-in. Markdown-ish: may contain code spans. */
  description: string;
  /** The composed label a screen reader hears instead of the row's four cells. */
  label: string;
};

/** One compound part's reference block. */
export type ApiPartView = {
  name: string;
  /** Anchor id of the part heading; the on-page TOC links to it. */
  anchor: string;
  rsc: RscStatus;
  /** How the part's RSC status reads on the page. */
  rscLabel: string;
  /** Packages whose props this part forwards. */
  forwardedFrom: readonly string[];
  forwardedCount: number;
  props: readonly ApiPropView[];
};

/**
 * A part's RSC status in the words a reader acts on: whether they may render it from a
 * server component, or whether it drags in a client boundary (performance.md §3).
 */
function rscLabel(rsc: RscStatus): string {
  return rsc === "server" ? "server-safe" : '"use client"';
}

/**
 * The label for a row's `summary`.
 *
 * A closed row is four cells of code in a grid; announced cell by cell it is noise. The
 * composed label says the same thing as one sentence — name, whether it is required, the
 * collapsed type, and the default when there is one.
 */
function propLabel(prop: ApiProp, closedType: string): string {
  const required = prop.required ? " required," : "";
  const fallback = prop.defaultValue === null ? "" : ` (default: ${prop.defaultValue})`;
  return `Prop: ${prop.name},${required} type: ${closedType}${fallback}`;
}

function toPropView(partName: string, prop: ApiProp): ApiPropView {
  const closedType = prop.shortType ?? prop.type;
  return {
    name: prop.name,
    id: apiPropAnchor(partName, prop.name),
    required: prop.required,
    closedType,
    signatureHtml: highlight(prop.type),
    defaultValue: prop.defaultValue,
    description: propDescription(prop),
    label: propLabel(prop, closedType),
  };
}

export function toPartView(part: ApiPart): ApiPartView {
  return {
    name: part.name,
    anchor: apiPartAnchor(part.name),
    rsc: part.rsc,
    rscLabel: rscLabel(part.rsc),
    forwardedFrom: part.forwardedFrom,
    forwardedCount: part.forwardedCount,
    props: part.props.map((prop) => toPropView(part.name, prop)),
  };
}
